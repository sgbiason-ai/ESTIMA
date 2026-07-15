import { recalculateProject } from '../projectCalculations';

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function flattenProjectItems(chapters, parents = []) {
  const result = [];
  for (const node of chapters || []) {
    if (!node) continue;
    if (node.type === 'item') {
      result.push({
        id: node.id,
        uid: node.uid,
        designation: node.designation || 'Article sans désignation',
        unit: node.unit || '',
        chapterPath: parents.join(' › '),
        qty: finite(node.qty),
        formula: node.formula || '',
        quantities: node.quantities || {},
        quantitiesFormula: node.quantitiesFormula || {},
      });
    } else if (node.isBloc) {
      // Bloc pilote (ouvrage composite) : cible d'association à part entière — sa
      // quantité pilote propage aux articles enfants (formule ={bloc}×facteur). On
      // expose donc le bloc et on NE descend PAS dans ses enfants (pilotés, masqués).
      result.push({
        id: node.id,
        uid: node.id,
        designation: node.title || 'Bloc',
        unit: node.unit || '',
        chapterPath: parents.join(' › '),
        qty: finite(node.qty),
        formula: '',
        quantities: node.quantities || {},
        quantitiesFormula: node.quantitiesFormula || {},
        isBloc: true,
      });
    } else if (node.children) {
      result.push(...flattenProjectItems(node.children, [...parents, node.title || 'Chapitre']));
    }
  }
  return result;
}
export function normalizeTakeoffUnit(unit) {
  return String(unit || '')
    .trim()
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/\s+/g, '');
}

export function isUnitCompatible(metric, unit) {
  const normalized = normalizeTakeoffUnit(unit);
  if (metric === 'length') return ['ml', 'm', 'metre', 'mètre'].includes(normalized);
  if (metric === 'area') return ['m2', 'metrecarre', 'mètrecarré'].includes(normalized);
  if (metric === 'count') return ['u', 'un', 'unite', 'unité', 'nb'].includes(normalized);
  return false;
}

function updateTargetItems(nodes, targets, trancheId, mode) {
  return (nodes || []).map((node) => {
    // Articles ET blocs pilotes exposent une quantité référençable (cf. projectCalculations).
    const isTargetable = node?.type === 'item' || node?.isBloc;
    if (isTargetable && targets.has(String(node.id))) {
      const quantity = targets.get(String(node.id));
      if (trancheId) {
        const previous = finite(node.quantities?.[trancheId]);
        return {
          ...node,
          quantities: {
            ...(node.quantities || {}),
            [trancheId]: mode === 'add' ? previous + quantity : quantity,
          },
          quantitiesFormula: {
            ...(node.quantitiesFormula || {}),
            [trancheId]: '',
          },
        };
      }
      const previous = finite(node.qty);
      return {
        ...node,
        qty: mode === 'add' ? previous + quantity : quantity,
        formula: '',
      };
    }
    // Ne pas descendre dans les enfants d'un bloc : ils sont pilotés par sa formule.
    if (node?.children && !node?.isBloc) {
      return { ...node, children: updateTargetItems(node.children, targets, trancheId, mode) };
    }
    return node;
  });
}

/** Applique en une seule mutation les métrés validés et conserve une trace légère. */
export function applyTakeoffToProject(project, mappings, options = {}) {
  const activeMappings = (mappings || []).filter(
    (mapping) => mapping?.itemId && finite(mapping.appliedQuantity) >= 0,
  );
  if (!project || activeMappings.length === 0) return project;

  const trancheId = options.trancheId || null;
  const mode = options.mode === 'add' ? 'add' : 'replace';
  const targets = new Map();
  for (const mapping of activeMappings) {
    const itemId = String(mapping.itemId);
    targets.set(itemId, finite(targets.get(itemId)) + finite(mapping.appliedQuantity));
  }

  const chapters = updateTargetItems(project.chapters, targets, trancheId, mode);
  const { updatedChapters, sourceIds } = recalculateProject(chapters, project.tranches || []);
  const historyEntry = {
    id: `takeoff_${Date.now()}`,
    fileName: String(options.fileName || 'Plan DXF'),
    importedAt: new Date().toISOString(),
    trancheId: trancheId || 'global',
    mode,
    mappings: activeMappings.map((mapping) => ({
      layer: String(mapping.layer || ''),
      metric: String(mapping.metric || ''),
      itemId: String(mapping.itemId),
      coefficient: finite(mapping.coefficient, 1),
      quantity: finite(mapping.appliedQuantity),
    })),
  };

  return {
    ...project,
    chapters: updatedChapters,
    sourceIds,
    takeoffImports: [...(project.takeoffImports || []), historyEntry].slice(-20),
  };
}
