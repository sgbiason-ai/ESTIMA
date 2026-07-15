const GROUP_PAIR_PATTERN = /(?:^|\r?\n)[ \t]*(-?\d+)[ \t]*\r?\n([^\r\n]*)/g;
const TRACKED_RECORDS = new Set(['LAYOUT', 'VIEWPORT', 'LAYER']);

const lastValue = (record, code) => {
  const values = record?.values.get(code);
  return values?.[values.length - 1];
};

const numberValue = (record, code, fallback = 0) => {
  const value = Number(lastValue(record, code));
  return Number.isFinite(value) ? value : fallback;
};

const pointValue = (record, xCode, yCode, zCode = null) => ({
  x: numberValue(record, xCode),
  y: numberValue(record, yCode),
  ...(zCode == null ? {} : { z: numberValue(record, zCode) }),
});

function addRecordValue(record, code, value) {
  const values = record.values.get(code) || [];
  values.push(value);
  record.values.set(code, values);
}

function isTopView(direction) {
  return Math.abs(direction.x) < 1e-6
    && Math.abs(direction.y) < 1e-6
    && Math.abs(Math.abs(direction.z) - 1) < 1e-6;
}

function parseViewport(record) {
  const width = numberValue(record, 40);
  const height = numberValue(record, 41);
  const viewHeight = numberValue(record, 45);
  const viewportNumber = numberValue(record, 69);
  const viewDirection = pointValue(record, 16, 26, 36);
  const frozenLayerHandles = record.values.get(331) || [];

  const paperCenter = pointValue(record, 10, 20);
  const viewCenter = pointValue(record, 12, 22);
  const sameCenter = Math.hypot(
    paperCenter.x - viewCenter.x,
    paperCenter.y - viewCenter.y,
  ) < 1e-6;
  const sameHeight = Math.abs(height - viewHeight) < 1e-6;
  const isPaperViewport = viewportNumber === 1 || (sameCenter && sameHeight);

  return {
    handle: String(lastValue(record, 5) || ''),
    ownerHandle: String(lastValue(record, 330) || ''),
    viewportNumber,
    status: numberValue(record, 68),
    paperCenter,
    paperSize: { width, height },
    viewCenter,
    viewHeight,
    viewTwistAngle: numberValue(record, 51),
    viewDirection,
    viewTarget: pointValue(record, 17, 27, 37),
    frozenLayerHandles,
    clipHandle: String(lastValue(record, 340) || ''),
    isPaperViewport,
    isRenderable: width > 0 && height > 0 && viewHeight > 0 && !isPaperViewport,
    isTopView: isTopView(viewDirection),
  };
}

function parseLayout(record) {
  return {
    handle: String(lastValue(record, 5) || ''),
    name: String(lastValue(record, 1) || '').trim(),
    order: numberValue(record, 71),
    blockRecordHandle: String(lastValue(record, 330) || ''),
    activeViewportHandle: String(lastValue(record, 331) || ''),
  };
}

/**
 * Scan structurel léger : compte les enregistrements et extrait uniquement les
 * layouts, VIEWPORT et handles de calques nécessaires à l'aperçu papier.
 */
export function scanDxfStructure(source) {
  const rawEntityCounts = {};
  const records = [];
  let record = null;

  const finalizeRecord = () => {
    if (record) records.push(record);
    record = null;
  };

  GROUP_PAIR_PATTERN.lastIndex = 0;
  let match;
  while ((match = GROUP_PAIR_PATTERN.exec(source || '')) !== null) {
    const code = Number(match[1]);
    const value = match[2].trim();
    if (code === 0) {
      finalizeRecord();
      const type = value.toUpperCase();
      rawEntityCounts[type] = (rawEntityCounts[type] || 0) + 1;
      if (TRACKED_RECORDS.has(type)) record = { type, values: new Map() };
    } else if (record) {
      addRecordValue(record, code, value);
    }
  }
  finalizeRecord();

  const layerNamesByHandle = new Map();
  const viewports = [];
  const layouts = [];
  for (const current of records) {
    if (current.type === 'LAYER') {
      const handle = String(lastValue(current, 5) || '').toUpperCase();
      const name = String(lastValue(current, 2) || '');
      if (handle && name) layerNamesByHandle.set(handle, name);
    } else if (current.type === 'VIEWPORT') {
      viewports.push(parseViewport(current));
    } else if (current.type === 'LAYOUT') {
      layouts.push(parseLayout(current));
    }
  }

  const paperLayouts = layouts
    .filter((layout) => layout.name && layout.name.toLocaleLowerCase('fr') !== 'model')
    .sort((left, right) => left.order - right.order)
    .map((layout, index) => {
      const ownerHandle = layout.blockRecordHandle.toUpperCase();
      const layoutViewports = viewports
        .filter((viewport) => viewport.ownerHandle.toUpperCase() === ownerHandle)
        .filter((viewport) => viewport.isRenderable)
        .map((viewport) => ({
          ...viewport,
          frozenLayers: viewport.frozenLayerHandles
            .map((handle) => layerNamesByHandle.get(handle.toUpperCase()))
            .filter(Boolean),
        }));
      return {
        ...layout,
        id: layout.handle ? `layout-${layout.handle}` : `layout-${index + 1}`,
        viewports: layoutViewports,
        simplified: layoutViewports.some((viewport) => viewport.clipHandle || !viewport.isTopView),
      };
    });

  return { rawEntityCounts, layouts: paperLayouts };
}

export function collectReferencedBlocks(entities, blocks) {
  const selected = {};
  const pending = [];
  const sourceBlocks = blocks || {};

  const queueReferences = (items) => {
    for (const entity of items || []) {
      const name = entity?.type === 'INSERT' ? entity.name : entity?.block;
      if (name && !selected[name]) pending.push(name);
    }
  };

  queueReferences(entities);
  while (pending.length > 0) {
    const name = pending.pop();
    if (selected[name]) continue;
    const block = sourceBlocks[name];
    if (!block) continue;
    selected[name] = block;
    queueReferences(block.entities);
  }
  return selected;
}

export function createPaperSpaceDxf(dxf, layout) {
  const ownerHandle = String(layout?.blockRecordHandle || '').toUpperCase();
  const paperBlock = Object.values(dxf?.blocks || {}).find(
    (block) => String(block?.ownerHandle || '').toUpperCase() === ownerHandle,
  );
  const blockEntities = paperBlock?.entities || [];
  const topLevelEntities = (dxf?.entities || []).filter((entity) => (
    entity?.inPaperSpace
      && String(entity?.ownerHandle || '').toUpperCase() === ownerHandle
  ));
  const entities = blockEntities.length > 0 ? blockEntities : topLevelEntities;

  return {
    header: dxf?.header || {},
    tables: dxf?.tables || {},
    blocks: collectReferencedBlocks(entities, dxf?.blocks),
    entities,
  };
}

export function computeLayoutPaperBounds(layout, sceneBounds = null) {
  const rectangles = (layout?.viewports || []).map((viewport) => ({
    minX: viewport.paperCenter.x - viewport.paperSize.width / 2,
    maxX: viewport.paperCenter.x + viewport.paperSize.width / 2,
    minY: viewport.paperCenter.y - viewport.paperSize.height / 2,
    maxY: viewport.paperCenter.y + viewport.paperSize.height / 2,
  }));
  if (sceneBounds) rectangles.push(sceneBounds);
  if (rectangles.length === 0) return null;

  return rectangles.reduce((bounds, rectangle) => ({
    minX: Math.min(bounds.minX, rectangle.minX),
    maxX: Math.max(bounds.maxX, rectangle.maxX),
    minY: Math.min(bounds.minY, rectangle.minY),
    maxY: Math.max(bounds.maxY, rectangle.maxY),
  }));
}
