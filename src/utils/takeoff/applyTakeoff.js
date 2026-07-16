import { recalculateProject } from '../projectCalculations';
import { geoSpec, blocUnitFactor } from '../blocPricing';
import { dimensionOf } from '../../data/units';

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

// Conversion géométrique d'une quantité DXF vers l'unité de l'article (réutilise la logique
// testée des blocs) : m²→m³ (×épaisseur), m²→T (×épaisseur×densité), ml→m² (×largeur),
// ml→m³/T, etc. Seules les métriques ml/m² se convertissent (le comptage n'a pas de volume).
export function takeoffGeoSpec(metricUnit, articleUnit) {
  const none = { needsLargeur: false, needsEpaisseur: false, needsDensity: false };
  const dim = dimensionOf(metricUnit);
  if (dim !== 'length' && dim !== 'area') return none;
  return geoSpec(metricUnit, articleUnit);
}

export function takeoffConversionFactor(metricUnit, articleUnit, mapping) {
  const spec = takeoffGeoSpec(metricUnit, articleUnit);
  if (!(spec.needsLargeur || spec.needsEpaisseur || spec.needsDensity)) return 1;
  const factor = blocUnitFactor(
    metricUnit, articleUnit, mapping?.largeur, mapping?.epaisseur, mapping?.densite, mapping?.perte,
  );
  return Number.isFinite(factor) ? factor : 0;
}

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

function updateTargetItems(nodes, targets, trancheId, mode, sources) {
  const sourceKey = trancheId || 'global';
  return (nodes || []).map((node) => {
    // Articles ET blocs pilotes exposent une quantité référençable (cf. projectCalculations).
    const isTargetable = node?.type === 'item' || node?.isBloc;
    if (isTargetable && targets.has(String(node.id))) {
      const quantity = targets.get(String(node.id));
      const src = sources?.get(String(node.id));
      // Trace l'origine DXF de la quantité, par tranche (ou global) → badge dans l'estimation.
      const takeoffSource = src
        ? { ...(node.takeoffSource || {}), [sourceKey]: src }
        : node.takeoffSource;
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
          takeoffSource,
        };
      }
      const previous = finite(node.qty);
      return {
        ...node,
        qty: mode === 'add' ? previous + quantity : quantity,
        formula: '',
        takeoffSource,
      };
    }
    // Ne pas descendre dans les enfants d'un bloc : ils sont pilotés par sa formule.
    if (node?.children && !node?.isBloc) {
      return { ...node, children: updateTargetItems(node.children, targets, trancheId, mode, sources) };
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
  const fileName = String(options.fileName || 'Plan DXF');
  const importedAt = new Date().toISOString();
  const targets = new Map();
  const sources = new Map();
  for (const mapping of activeMappings) {
    const itemId = String(mapping.itemId);
    targets.set(itemId, finite(targets.get(itemId)) + finite(mapping.appliedQuantity));
    const src = sources.get(itemId) || {
      fileName, importedAt, layers: [], metric: String(mapping.metric || ''),
    };
    const layer = String(mapping.layer || '');
    if (layer && !src.layers.includes(layer)) src.layers.push(layer);
    sources.set(itemId, src);
  }

  const chapters = updateTargetItems(project.chapters, targets, trancheId, mode, sources);
  const { updatedChapters, sourceIds } = recalculateProject(chapters, project.tranches || []);
  const historyEntry = {
    id: `takeoff_${Date.now()}`,
    fileName,
    importedAt,
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
