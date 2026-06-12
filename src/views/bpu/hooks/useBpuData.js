import { useState, useMemo } from 'react';
import { getUniqueBpuCatalog } from '../../../utils/helpers';
import { buildRefMap, buildDuplicateIndex } from '../../../utils/projectCalculations';
import { confirm } from '../../../utils/globalUI';

/**
 * useBpuData
 * Gère toute la logique métier du BPU :
 *   - numérotation des articles (refMap)
 *   - résolution des unités (unitResolver)
 *   - catalogue trié avec overrides appliqués (sortedCatalog)
 *   - CRUD des overrides par affaire (saveOverride / resetOverride / resetAllOverrides)
 */
export const useBpuData = ({ project, setProject, bpuConfig, units }) => {

  // ── TRI MANUEL ──────────────────────────────────────────────────────────────
  const [forceManualSort, setForceManualSort] = useState(true);

  // ── OVERRIDES ────────────────────────────────────────────────────────────────
  // Stockés dans project.bpuOverrides = { [itemId]: { designation?, description? } }
  const bpuOverrides = project?.bpuOverrides || {};

  const overrideCount = Object.keys(bpuOverrides).filter(
    (k) => bpuOverrides[k]?.designation !== undefined || bpuOverrides[k]?.description !== undefined
  ).length;

  const saveOverride = (itemId, field, value) => {
    if (!setProject || !itemId) return;
    setProject((prev) => ({
      ...prev,
      bpuOverrides: {
        ...(prev?.bpuOverrides || {}),
        [itemId]: {
          ...(prev?.bpuOverrides?.[itemId] || {}),
          [field]: value,
        },
      },
    }));
  };

  const resetOverride = (itemId, field) => {
    if (!setProject) return;
    setProject((prev) => {
      const overrides = { ...(prev?.bpuOverrides || {}) };
      if (overrides[itemId]) {
        overrides[itemId] = { ...overrides[itemId] };
        delete overrides[itemId][field];
        if (Object.keys(overrides[itemId]).length === 0) delete overrides[itemId];
      }
      return { ...prev, bpuOverrides: overrides };
    });
  };

  const resetAllOverrides = async () => {
    const ok = await confirm('Réinitialiser toutes les modifications ?', { danger: true });
    if (!setProject || !ok) return;
    setProject((prev) => ({ ...prev, bpuOverrides: {} }));
  };

  // ── NUMÉROTATION (refMap) ────────────────────────────────────────────────────
  const refMap = useMemo(() => {
    // Mode hiérarchique (DQE « 2.1.3 ») : mêmes numéros que le tableau d'estimation
    // (fonction pure partagée — séquence partagée articles/sous-chapitres + unicité).
    // Alias designation/uid → numéro, comme pour les autres modes ci-dessous.
    if (bpuConfig?.numberingMode === 'hierarchical') {
      const map = buildRefMap(project?.chapters || [], bpuConfig);
      const addAliases = (nodes) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((node) => {
          if (!node) return;
          if (node.type === 'item') {
            const ref = map.get(node.id);
            if (ref) {
              if (node.designation) map.set(node.designation.trim().toUpperCase(), ref);
              if (node.uid) map.set(node.uid, ref);
            }
          }
          if (node.children) addAliases(node.children);
        });
      };
      addAliases(project?.chapters || []);
      return map;
    }

    const map = new Map();
    const registry = new Map();
    let counter = 1;

    const buildKey = (node) => {
      if (node?.uid) return `UID:${String(node.uid)}`;
      const d = (node?.designation || '').trim().toUpperCase();
      const u = (node?.unit || '').trim().toUpperCase();
      const p = Number(node?.price || 0);
      return `FALLBACK:${d}|${u}|${p}`;
    };

    const traverse = (nodes) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach((node) => {
        if (!node) return;
        if (node.type === 'item') {
          let refLabel;
          if (bpuConfig?.numberingMode === 'manual' && node.bpuNum) {
            refLabel = String(node.bpuNum).trim();
          } else {
            const key = buildKey(node);
            if (registry.has(key)) {
              refLabel = registry.get(key);
            } else {
              refLabel = `P.${counter++}`;
              registry.set(key, refLabel);
            }
          }
          if (node.designation) map.set(node.designation.trim().toUpperCase(), refLabel);
          if (node.uid) map.set(node.uid, refLabel);
          map.set(node.id, refLabel);
        }
        if (node.children) traverse(node.children);
      });
    };

    traverse(project?.chapters || []);
    return map;
  }, [project, bpuConfig]);

  // ── RÉSOLUTION DES UNITÉS ────────────────────────────────────────────────────
  const unitResolver = useMemo(() => {
    const map = new Map();
    const normalize = (str) => {
      if (!str) return '';
      return str.toString().toLowerCase().trim()
        .replace(/\s+/g, '').replace('²', '2').replace('³', '3');
    };
    units.forEach((u) => { if (u.symbol) map.set(normalize(u.symbol), u.label); });

    return (rawSymbol) => {
      if (!rawSymbol) return 'UNITÉ';
      const cleanKey = normalize(rawSymbol);
      if (map.has(cleanKey)) return map.get(cleanKey);
      if (cleanKey === 'u' || cleanKey === 'unite') return 'Unité';
      return rawSymbol;
    };
  }, [units]);

  // ── PRIX RÉPÉTÉS (badge « ×N » sur la ligne du bordereau) ───────────────────
  const duplicateIndex = useMemo(
    () => buildDuplicateIndex(project?.chapters || []),
    [project]
  );

  // ── CATALOGUE TRIÉ AVEC OVERRIDES ───────────────────────────────────────────
  const sortedCatalog = useMemo(() => {
    if (!project) return [];
    const list = getUniqueBpuCatalog ? getUniqueBpuCatalog(project) : [];

    const getRef = (item) =>
      refMap.get(item.id) ||
      refMap.get(item.uid) ||
      refMap.get((item.designation || '').trim().toUpperCase()) ||
      '';

    const getAutoNum = (item) => {
      const ref = getRef(item);
      if (!ref) return 999999;
      const match = String(ref).match(/([0-9]+(\.[0-9]+)?)/);
      return match ? parseFloat(match[0]) : 999999;
    };

    const sorted = list.sort((a, b) => {
      if (bpuConfig?.numberingMode === 'manual' && forceManualSort) {
        return (a.bpuNum || '').toString().localeCompare(
          (b.bpuNum || '').toString(),
          undefined,
          { numeric: true, sensitivity: 'base' }
        );
      }
      if (bpuConfig?.numberingMode === 'hierarchical') {
        // Tri segment par segment (2.1.2 avant 2.1.10) ; réfs vides à la fin.
        const refA = getRef(a);
        const refB = getRef(b);
        if (!refA && !refB) return 0;
        if (!refA) return 1;
        if (!refB) return -1;
        return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return getAutoNum(a) - getAutoNum(b);
    });

    return sorted.map((item) => {
      const displayNum =
        bpuConfig?.numberingMode === 'manual'
          ? item.bpuNum ? String(item.bpuNum) : ''
          : refMap.get(item.id) ||
            refMap.get(item.uid) ||
            refMap.get((item.designation || '').trim().toUpperCase()) ||
            '-';

      const ov = (project?.bpuOverrides || {})[item.id] || {};
      return {
        ...item,
        _displayNum: displayNum,
        _usageCount: duplicateIndex.get(item.id)?.count || 1,
        _overrideDesignation: ov.designation,
        _overrideDescription: ov.description,
        _hasOverride: ov.designation !== undefined || ov.description !== undefined,
      };
    });
  }, [project, bpuConfig, forceManualSort, refMap, duplicateIndex]);

  return {
    // Tri
    forceManualSort,
    setForceManualSort,
    // Overrides
    bpuOverrides,
    overrideCount,
    saveOverride,
    resetOverride,
    resetAllOverrides,
    // Données calculées
    refMap,
    unitResolver,
    sortedCatalog,
  };
};
