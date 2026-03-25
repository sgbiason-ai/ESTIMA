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
    // eslint-disable-next-line no-unused-vars
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
          });
        }

        // 4. Unité modifiée
        const dbUnit = (dbMatch.unit || '').trim().toUpperCase();
        const projectUnit = (item.unit || '').trim().toUpperCase();
        if (dbUnit && projectUnit && dbUnit !== projectUnit) {
          itemIssues.push({
            type: 'unit_diff',
            label: `Unité modifiée (base: ${dbMatch.unit} → projet: ${item.unit})`,
          });
        }
      }

      // 5. Description différente de la base
      if (dbMatch) {
        const dbDesc = cleanText(dbMatch.description || '').trim();
        const currentDesc = ov.description !== undefined
          ? cleanText(ov.description || '').trim()
          : cleanText(item.description || '').trim();
        if (dbDesc && currentDesc && dbDesc !== currentDesc) {
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
        const { description, ...rest } = ov; // eslint-disable-line no-unused-vars
        if (Object.keys(rest).length > 0) cleanOverrides[id] = rest;
      });

      return {
        ...prev,
        bpuOverrides: cleanOverrides,
      };
    });

    setAuditVersion(v => v + 1);
  }, [setProject, dbIndex]);

  return {
    audit,
    showAudit,
    setShowAudit,
    refresh,
    syncDescriptions,
  };
};
