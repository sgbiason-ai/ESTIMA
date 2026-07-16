// Fonctions pures du POC de métré DXF.
// Les valeurs géométriques restent exprimées dans l'unité native du dessin ;
// la conversion en mètres est appliquée uniquement dans l'interface.

const EPSILON = 1e-9;
const FIT_POINT_KEYS = ['position', 'center', 'startPoint', 'endPoint', 'alignmentPoint'];
const FIT_POINT_ARRAY_KEYS = ['vertices', 'controlPoints', 'fitPoints'];
const OUTLIER_GAP_RATIO = 5;

export const DXF_UNITS = Object.freeze({
  0: { label: 'Sans unité', scaleToMeters: 1, uncertain: true },
  1: { label: 'Pouces', scaleToMeters: 0.0254 },
  2: { label: 'Pieds', scaleToMeters: 0.3048 },
  3: { label: 'Miles', scaleToMeters: 1609.344 },
  4: { label: 'Millimètres', scaleToMeters: 0.001 },
  5: { label: 'Centimètres', scaleToMeters: 0.01 },
  6: { label: 'Mètres', scaleToMeters: 1 },
  7: { label: 'Kilomètres', scaleToMeters: 1000 },
  10: { label: 'Yards', scaleToMeters: 0.9144 },
  14: { label: 'Décimètres', scaleToMeters: 0.1 },
  15: { label: 'Décamètres', scaleToMeters: 10 },
  16: { label: 'Hectomètres', scaleToMeters: 100 },
  21: { label: 'Pieds US', scaleToMeters: 1200 / 3937 },
});

export const METRIC_LABELS = Object.freeze({
  length: { label: 'Longueur', unit: 'ml' },
  area: { label: 'Surface', unit: 'm²' },
  count: { label: 'Comptage', unit: 'u' },
});

// Calque de rendu synthétique où l'on regroupe les aplats pleins (HATCH/SOLID) pour pouvoir
// les masquer isolément, sans toucher au texte (lui aussi rendu en Mesh par dxf-viewer).
// Jamais métré (le retag a lieu APRÈS l'agrégation, et measureEntity ignore HATCH/SOLID).
export const HATCH_RENDER_LAYER = '__ESTIMA_HATCH__';

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const pointDistance = (a, b) => {
  if (!a || !b) return 0;
  return Math.hypot(finite(b.x) - finite(a.x), finite(b.y) - finite(a.y));
};

const normalizePositiveAngle = (angle) => {
  let normalized = finite(angle);
  while (normalized < 0) normalized += Math.PI * 2;
  while (normalized >= Math.PI * 2) normalized -= Math.PI * 2;
  return normalized;
};

function pushFitPoint(point, xValues, yValues) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  xValues.push(x);
  yValues.push(y);
}

function robustAxisBounds(values) {
  if (values.length < 20) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.max(1, Math.floor(sorted.length * 0.01));
  const fullMin = sorted[0];
  const fullMax = sorted[sorted.length - 1];
  const trimmedMin = sorted[trimCount];
  const trimmedMax = sorted[sorted.length - 1 - trimCount];
  const referenceSpan = trimmedMax - trimmedMin;
  if (!Number.isFinite(referenceSpan) || referenceSpan <= EPSILON) return null;

  const lowerOutlier = trimmedMin - fullMin > referenceSpan * OUTLIER_GAP_RATIO;
  const upperOutlier = fullMax - trimmedMax > referenceSpan * OUTLIER_GAP_RATIO;
  return {
    min: lowerOutlier ? trimmedMin : fullMin,
    max: upperOutlier ? trimmedMax : fullMax,
    adjusted: lowerOutlier || upperOutlier,
  };
}

/** Calcule un cadrage dominant sans supprimer les entités géométriques éloignées. */
export function computeRobustFitBounds(entities) {
  const xValues = [];
  const yValues = [];
  for (const entity of entities || []) {
    for (const key of FIT_POINT_KEYS) pushFitPoint(entity?.[key], xValues, yValues);
    for (const key of FIT_POINT_ARRAY_KEYS) {
      for (const point of entity?.[key] || []) pushFitPoint(point, xValues, yValues);
    }
  }

  const xBounds = robustAxisBounds(xValues);
  const yBounds = robustAxisBounds(yValues);
  if (!xBounds || !yBounds || (!xBounds.adjusted && !yBounds.adjusted)) return null;
  return {
    minX: xBounds.min,
    maxX: xBounds.max,
    minY: yBounds.min,
    maxY: yBounds.max,
    pointCount: Math.min(xValues.length, yValues.length),
  };
}

/** Longueur exacte d'un segment de polyligne, y compris un arc défini par bulge. */
export function measureBulgeSegment(start, end, bulge = 0) {
  const chord = pointDistance(start, end);
  const safeBulge = finite(bulge);
  if (chord <= EPSILON || Math.abs(safeBulge) <= EPSILON) return chord;

  const theta = 4 * Math.atan(Math.abs(safeBulge));
  const sinHalf = Math.sin(theta / 2);
  if (Math.abs(sinHalf) <= EPSILON) return chord;
  const radius = chord / (2 * sinHalf);
  return Math.abs(radius * theta);
}

function polylineEdges(vertices, closed) {
  const points = Array.isArray(vertices) ? vertices.filter(Boolean) : [];
  const edges = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    edges.push([points[index], points[index + 1]]);
  }
  if (closed && points.length > 2) edges.push([points[points.length - 1], points[0]]);
  return edges;
}

export function measurePolylineLength(vertices, closed = false) {
  return polylineEdges(vertices, closed).reduce(
    (total, [start, end]) => total + measureBulgeSegment(start, end, start?.bulge),
    0,
  );
}

/** Aire exacte d'une polyligne fermée, avec correction des segments en arc (bulge). */
export function measureClosedPolylineArea(vertices) {
  const edges = polylineEdges(vertices, true);
  if (edges.length < 3) return 0;

  let signedArea = 0;
  for (const [start, end] of edges) {
    signedArea += (finite(start.x) * finite(end.y) - finite(end.x) * finite(start.y)) / 2;

    const bulge = finite(start?.bulge);
    const chord = pointDistance(start, end);
    if (Math.abs(bulge) <= EPSILON || chord <= EPSILON) continue;

    const theta = 4 * Math.atan(Math.abs(bulge));
    const sinHalf = Math.sin(theta / 2);
    if (Math.abs(sinHalf) <= EPSILON) continue;
    const radius = chord / (2 * sinHalf);
    const segmentArea = (radius * radius / 2) * (theta - Math.sin(theta));
    signedArea += Math.sign(bulge) * segmentArea;
  }
  return Math.abs(signedArea);
}

function approximateEllipseLength(entity) {
  const major = Math.hypot(
    finite(entity?.majorAxisEndPoint?.x),
    finite(entity?.majorAxisEndPoint?.y),
  );
  const minor = major * Math.abs(finite(entity?.axisRatio, 1));
  if (major <= EPSILON || minor <= EPSILON) return 0;

  const start = finite(entity?.startAngle, 0);
  const end = entity?.endAngle == null ? Math.PI * 2 : finite(entity.endAngle);
  const span = normalizePositiveAngle(end - start) || Math.PI * 2;
  const steps = Math.max(16, Math.ceil(span / (Math.PI / 32)));
  let length = 0;
  let previous = { x: major * Math.cos(start), y: minor * Math.sin(start) };
  for (let index = 1; index <= steps; index += 1) {
    const angle = start + (span * index) / steps;
    const current = { x: major * Math.cos(angle), y: minor * Math.sin(angle) };
    length += pointDistance(previous, current);
    previous = current;
  }
  return length;
}

function measureEntity(entity) {
  switch (entity?.type) {
    case 'LINE':
      return { length: pointDistance(entity.vertices?.[0], entity.vertices?.[1]) };
    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const closed = Boolean(entity.shape);
      return {
        length: measurePolylineLength(entity.vertices, closed),
        area: closed ? measureClosedPolylineArea(entity.vertices) : 0,
      };
    }
    case 'ARC': {
      const span = normalizePositiveAngle(finite(entity.endAngle) - finite(entity.startAngle));
      return { length: Math.abs(finite(entity.radius) * span) };
    }
    case 'ELLIPSE':
      return { length: approximateEllipseLength(entity), approximate: true };
    case 'SPLINE': {
      const points = entity.fitPoints?.length > 1 ? entity.fitPoints : entity.controlPoints;
      return {
        length: measurePolylineLength(points, Boolean(entity.closed)),
        approximate: true,
      };
    }
    case 'INSERT':
      return {
        count: Math.max(1, finite(entity.rowCount, 1)) * Math.max(1, finite(entity.columnCount, 1)),
      };
    case 'POINT':
    case 'CIRCLE':
      return { count: 1 };
    default:
      return null;
  }
}

function emptyLayer(name) {
  return {
    name,
    entityCount: 0,
    measurableCount: 0,
    unmeasuredCount: 0,
    approximateCount: 0,
    rawLength: 0,
    rawArea: 0,
    rawCount: 0,
    types: {},
    blocks: {},
  };
}

/**
 * Agrège le DXF parsé sans renvoyer ses milliers d'entités au thread principal.
 * `rawEntityCounts` vient du scan léger du worker et inclut les objets ignorés
 * par le parseur (notamment ACAD_PROXY_ENTITY).
 */
export function aggregateDxfTakeoff(dxf, rawEntityCounts = {}) {
  const layers = new Map();
  let paperSpaceSkipped = 0;
  const entities = Array.isArray(dxf?.entities) ? dxf.entities : [];

  for (const entity of entities) {
    if (entity?.inPaperSpace) {
      paperSpaceSkipped += 1;
      continue;
    }
    const layerName = String(entity?.layer || '0');
    const layer = layers.get(layerName) || emptyLayer(layerName);
    layer.entityCount += 1;
    layer.types[entity.type] = (layer.types[entity.type] || 0) + 1;

    const measurement = measureEntity(entity);
    if (!measurement) {
      layer.unmeasuredCount += 1;
    } else {
      layer.measurableCount += 1;
      layer.rawLength += finite(measurement.length);
      layer.rawArea += finite(measurement.area);
      layer.rawCount += finite(measurement.count);
      if (measurement.approximate) layer.approximateCount += 1;
      if (entity.type === 'INSERT') {
        const blockName = String(entity.name || 'Bloc sans nom');
        layer.blocks[blockName] = (layer.blocks[blockName] || 0) + finite(measurement.count);
      }
    }
    layers.set(layerName, layer);
  }

  const unitCode = finite(dxf?.header?.$INSUNITS, 0);
  const unit = DXF_UNITS[unitCode] || DXF_UNITS[0];
  const rawCounts = Object.fromEntries(
    Object.entries(rawEntityCounts || {}).map(([type, count]) => [type, finite(count)]),
  );
  const rawEntityTotal = Object.values(rawCounts).reduce((total, count) => total + count, 0);
  const parsedEntityTotal = entities.length;
  const robustFitBounds = computeRobustFitBounds(entities);

  return {
    metadata: {
      acadVersion: String(dxf?.header?.$ACADVER || ''),
      unitCode,
      unitLabel: unit.label,
      detectedScaleToMeters: unit.scaleToMeters,
      unitUncertain: Boolean(unit.uncertain),
      parsedEntityTotal,
      rawEntityTotal,
      paperSpaceSkipped,
      proxyEntityCount: finite(rawCounts.ACAD_PROXY_ENTITY),
      robustFitBounds,
      rawEntityCounts: rawCounts,
    },
    layers: Array.from(layers.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export function buildMeasurementRows(summary, scaleToMeters = 1) {
  const scale = Math.max(EPSILON, finite(scaleToMeters, 1));
  const rows = [];
  for (const layer of summary?.layers || []) {
    const common = {
      layer: layer.name,
      entityCount: layer.entityCount,
      approximateCount: layer.approximateCount,
      unmeasuredCount: layer.unmeasuredCount,
      types: layer.types,
    };
    const length = finite(layer.rawLength) * scale;
    const area = finite(layer.rawArea) * scale * scale;
    const count = finite(layer.rawCount);
    if (length > EPSILON) rows.push({ ...common, id: `${layer.name}::length`, metric: 'length', quantity: length });
    if (area > EPSILON) rows.push({ ...common, id: `${layer.name}::area`, metric: 'area', quantity: area });
    if (count > EPSILON) rows.push({ ...common, id: `${layer.name}::count`, metric: 'count', quantity: count });
  }
  return rows;
}
