import { useState, useMemo, useCallback } from 'react';
import { cleanText } from '../../../utils/helpers';
import { confirm } from '../../../utils/globalUI';

/**
 * useBpuAudit
 * Analyse la cohérence entre les articles du projet (sortedCatalog)
 * et la base de données BPU (articlesDb).
 *
 * Détecte :
 *   - Articles sans description
 *   - Articles absents de la base BPU
 *   - Prix modifié par rapport à la base
 *   - Unité modifiée par rapport à la base
 *   - Désignation modifiée par rapport à la base (override)
 */
export const useBpuAudit = ({ sortedCatalog, articlesDb, bpuOverrides, setProject }) => {
  const [showAudit, setShowAudit] = useState(false);
  const [auditVersion, setAuditVersion] = useState(0);

  // Construit un index rapide de la base BPU par désignation normalisée et par id
  const dbIndex = useMemo(() => {
    const byDesignation = new Map();
    const byId = new Map();
    (articlesDb || []).forEach(dbItem => {
      const key = cleanText(dbItem.designation || '').trim().toUpperCase();
      if (key) byDesignation.set(key, dbItem);
      if (dbItem.id) byId.set(dbItem.id, dbItem);
    });
    return { byDesignation, byId };
  }, [articlesDb]);

  // Analyse complète
  const audit = useMemo(() => {
    const _v = auditVersion; // force recalcul au refresh

    const issues = [];
    const overrides = bpuOverrides || {};

    (sortedCatalog || []).forEach(item => {
      const ref = item._displayNum || '-';
      const designation = cleanText(item.designation || '').trim();
      const designationKey = designation.toUpperCase();
      const itemIssues = [];

      // Trouver l'article correspondant dans la base
      const dbMatch = dbIndex.byId.get(item.articleId || item.uid || item.id)
        || dbIndex.byDesignation.get(designationKey);

      // 1. Article absent de la base
      if (!dbMatch) {
        itemIssues.push({ type: 'missing', label: 'Absent de la base BPU' });
      }

      // 2. Article sans description
      const ov = overrides[item.id] || {};
      const hasDescription = !!(
        ov.description
        || (dbMatch && dbMatch.description && cleanText(dbMatch.description).trim())
        || (item.description && cleanText(item.description).trim())
      );
      if (!hasDescription) {
        itemIssues.push({ type: 'no_description', label: 'Pas de description' });
      }

      // 3. Prix modifié par rapport à la base
      if (dbMatch) {
        const dbPrice = Number(dbMatch.price || 0);
        const projectPrice = Number(item.price || 0);
        if (dbPrice !== 0 && projectPrice !== dbPrice) {
          itemIssues.push({
            type: 'price_diff',
            label: `Prix modifié (base: ${dbPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € → projet: ${projectPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €)`,
            dbValue: dbMatch.price,
          });
        }

        // 4. Unité modifiée
        const dbUnit = (dbMatch.unit || '').trim().toUpperCase();
        const projectUnit = (item.unit || '').trim().toUpperCase();
        if (dbUnit && projectUnit && dbUnit !== projectUnit) {
          itemIssues.push({
            type: 'unit_diff',
            label: `Unité modifiée (base: ${dbMatch.unit} → projet: ${item.unit})`,
            dbValue: dbMatch.unit,
          });
        }
      }

      // 5. Description différente de la base
      // Aligné sur getRawDescription : si pas d'override, le rendu utilise dbDesc → pas de diff possible.
      // On ne flag QUE quand il y a un override qui diverge de la base.
      if (dbMatch && ov.description !== undefined) {
        const dbDesc = cleanText(dbMatch.description || '').trim();
        const overrideDesc = cleanText(ov.description || '').trim();
        if (dbDesc && overrideDesc && dbDesc !== overrideDesc) {
          itemIssues.push({ type: 'desc_diff', label: 'Description différente de la base BPU' });
        }
      }

      // 6. Override de désignation
      if (ov.designation !== undefined) {
        itemIssues.push({ type: 'override', label: 'Désignation surchargée localement' });
      }

      if (itemIssues.length > 0) {
        issues.push({ ref, designation, id: item.id, issues: itemIssues });
      }
    });

    // Statistiques
    const stats = {
      total: sortedCatalog?.length || 0,
      ok: (sortedCatalog?.length || 0) - issues.length,
      errors: issues.length,
      missing: issues.filter(i => i.issues.some(x => x.type === 'missing')).length,
      noDescription: issues.filter(i => i.issues.some(x => x.type === 'no_description')).length,
      priceDiff: issues.filter(i => i.issues.some(x => x.type === 'price_diff')).length,
      unitDiff: issues.filter(i => i.issues.some(x => x.type === 'unit_diff')).length,
      descDiff: issues.filter(i => i.issues.some(x => x.type === 'desc_diff')).length,
      overrides: issues.filter(i => i.issues.some(x => x.type === 'override')).length,
    };

    return { issues, stats };
  }, [sortedCatalog, dbIndex, bpuOverrides, auditVersion]);

  const refresh = useCallback(() => {
    setAuditVersion(v => v + 1);
  }, []);

  // Synchronise toutes les descriptions depuis la base BPU
  const syncDescriptions = useCallback(async () => {
    if (!setProject) return;
    const ok = await confirm('Remettre toutes les descriptions conformes à la base BPU ?\nLes modifications locales de description seront supprimées.', { danger: true });
    if (!ok) return;

    setProject(prev => {
      // Supprimer tous les overrides de description
      // Les descriptions seront résolues à la volée depuis articlesDb par getRawDescription()
      const cleanOverrides = {};
      Object.entries(prev?.bpuOverrides || {}).forEach(([id, ov]) => {
        const { description, ...rest } = ov;
        if (Object.keys(rest).length > 0) cleanOverrides[id] = rest;
      });

      return {
        ...prev,
        bpuOverrides: cleanOverrides,
      };
    });

    setAuditVersion(v => v + 1);
  }, [setProject, dbIndex]);

  // Restaure une liste d'issues : [{ itemId, type, dbValue }]
  // - price_diff / unit_diff : modifie l'article dans project.chapters
  // - desc_diff / override : supprime l'override correspondant
  const restoreIssues = useCallback((restoreList) => {
    if (!setProject || !restoreList?.length) return;

    const fieldUpdates = new Map(); // itemId -> { price?, unit? }
    const overrideRemovals = new Map(); // itemId -> Set(['description', 'designation'])

    restoreList.forEach(({ itemId, type, dbValue }) => {
      if (!itemId) return;
      if (type === 'price_diff') {
        const prev = fieldUpdates.get(itemId) || {};
        fieldUpdates.set(itemId, { ...prev, price: Number(dbValue) || 0 });
      } else if (type === 'unit_diff') {
        const prev = fieldUpdates.get(itemId) || {};
        fieldUpdates.set(itemId, { ...prev, unit: dbValue });
      } else if (type === 'desc_diff') {
        if (!overrideRemovals.has(itemId)) overrideRemovals.set(itemId, new Set());
        overrideRemovals.get(itemId).add('description');
      } else if (type === 'override') {
        if (!overrideRemovals.has(itemId)) overrideRemovals.set(itemId, new Set());
        overrideRemovals.get(itemId).add('designation');
      }
    });

    setProject(prev => {
      const walk = (nodes) => (nodes || []).map(node => {
        if (node?.type === 'item' && fieldUpdates.has(node.id)) {
          return { ...node, ...fieldUpdates.get(node.id) };
        }
        if (node?.children) {
          return { ...node, children: walk(node.children) };
        }
        return node;
      });

      const newOverrides = { ...(prev?.bpuOverrides || {}) };
      overrideRemovals.forEach((fields, itemId) => {
        if (!newOverrides[itemId]) return;
        const cleaned = { ...newOverrides[itemId] };
        fields.forEach(f => { delete cleaned[f]; });
        if (Object.keys(cleaned).length === 0) delete newOverrides[itemId];
        else newOverrides[itemId] = cleaned;
      });

      return {
        ...prev,
        chapters: fieldUpdates.size > 0 ? walk(prev?.chapters || []) : prev?.chapters,
        bpuOverrides: newOverrides,
      };
    });

    setAuditVersion(v => v + 1);
  }, [setProject]);

  return {
    audit,
    showAudit,
    setShowAudit,
    refresh,
    syncDescriptions,
    restoreIssues,
  };
};
