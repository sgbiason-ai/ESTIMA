// src/utils/devisMoeCalculations.js
import { generateId, formatPrice } from './helpers';

export const pct = (lot, tauxGlobal) =>
  (parseFloat(lot.montantTravauxHT) || 0) * (parseFloat(tauxGlobal) || 0) / 100;

export const honPhasePct = (honLot, repartition, phaseId) => {
  const r = (repartition || []).find(r => r.phaseId === phaseId);
  return honLot * (parseFloat(r?.pourcentage) || 0) / 100;
};

export const honPhaseTemps = (lot, phaseId, categories) => {
  const pt = (lot.phasesTemps || []).find(p => p.phaseId === phaseId);
  if (!pt) return 0;
  // Nouveau format : sousTaches[]
  if (pt.sousTaches?.length > 0) {
    return pt.sousTaches.reduce((total, st) =>
      total + (categories || []).reduce((s, c) =>
        s + (parseFloat(st.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
  }
  // Ancien format : temps direct sur la phase (rétro-compat)
  return (categories || []).reduce((s, c) =>
    s + (parseFloat(pt.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0);
};

export const newSousTache = (categories) => ({
  id: generateId(),
  description: '',
  temps: Object.fromEntries((categories || []).map(c => [c.id, ''])),
});

export const totalRep = (repartition) =>
  (repartition || []).reduce((s, r) => s + (parseFloat(r.pourcentage) || 0), 0);

export const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0);
export const fmtE = (n) => formatPrice(n);

// ─── Temps passé : détection format nested & calculs par assignee ────────────

/** Détecte si temps est au format nested (clés = assignee IDs) vs flat (clés = category IDs) */
export const isNestedTemps = (temps, categoryIds) => {
  if (!temps || typeof temps !== 'object') return false;
  const keys = Object.keys(temps);
  if (keys.length === 0) return false;
  // Si la première clé est un ID de catégorie → format flat
  return !categoryIds.includes(keys[0]);
};

/** Retourne les clés assignee : ['mandataire', ...cotraitantIds] ou ['mandataire', 'notreEntreprise'] en mode cotraitant */
export const getAssigneeKeys = (draft) => {
  if (draft.moeType === 'cotraitant') return ['mandataire', 'notreEntreprise'];
  const keys = ['mandataire'];
  (draft.cotraitants || []).forEach(c => keys.push(c.id));
  return keys;
};

/** Résout les catégories pour un assignee : categoriesOrMap peut être un array (global) ou un objet { assigneeKey: cats[] } */
const resolveCats = (categoriesOrMap, assigneeKey) =>
  Array.isArray(categoriesOrMap) ? categoriesOrMap : (categoriesOrMap?.[assigneeKey] || []);

/** Récupère tous les catIds uniques depuis categoriesOrMap */
const allCatIds = (categoriesOrMap, assigneeKeys) => {
  if (Array.isArray(categoriesOrMap)) return categoriesOrMap.map(c => c.id);
  const ids = new Set();
  assigneeKeys.forEach(k => (categoriesOrMap?.[k] || []).forEach(c => ids.add(c.id)));
  return [...ids];
};

/** Budget d'une tâche ventilé par assignee */
export const tacheBudgetByAssignee = (tache, categoriesOrMap, assigneeKeys) => {
  const result = {};
  const catIds = allCatIds(categoriesOrMap, assigneeKeys);
  const nested = isNestedTemps(tache.temps, catIds);

  assigneeKeys.forEach(key => {
    const cats = resolveCats(categoriesOrMap, key);
    const tempsData = nested ? (tache.temps?.[key] || {}) : (key === 'mandataire' ? (tache.temps || {}) : {});
    result[key] = (cats || []).reduce((s, c) =>
      s + (parseFloat(tempsData[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0);
  });
  return result;
};

/** Budget total d'une tâche (somme sur tous les assignees) */
export const tacheTotalBudget = (tache, categoriesOrMap, assigneeKeys) => {
  const byA = tacheBudgetByAssignee(tache, categoriesOrMap, assigneeKeys);
  return Object.values(byA).reduce((s, v) => s + v, 0);
};

/** Budget d'une phase ventilé par assignee */
export const phaseBudgetByAssignee = (taches, phaseId, categoriesOrMap, assigneeKeys) => {
  const result = {};
  assigneeKeys.forEach(k => { result[k] = 0; });
  (taches || []).filter(t => t.phaseId === phaseId).forEach(t => {
    const byA = tacheBudgetByAssignee(t, categoriesOrMap, assigneeKeys);
    assigneeKeys.forEach(k => { result[k] += byA[k] || 0; });
  });
  return result;
};

/** Grand total ventilé par assignee */
export const grandTotalByAssignee = (taches, categoriesOrMap, assigneeKeys) => {
  const result = {};
  assigneeKeys.forEach(k => { result[k] = 0; });
  (taches || []).forEach(t => {
    const byA = tacheBudgetByAssignee(t, categoriesOrMap, assigneeKeys);
    assigneeKeys.forEach(k => { result[k] += byA[k] || 0; });
  });
  return result;
};

/** Heures totales par assignee+catégorie pour une phase */
export const phaseHoursByAssignee = (taches, phaseId, categoriesOrMap, assigneeKeys) => {
  const catIds = allCatIds(categoriesOrMap, assigneeKeys);
  const result = {};
  assigneeKeys.forEach(k => {
    result[k] = Object.fromEntries(catIds.map(c => [c, 0]));
  });
  (taches || []).filter(t => t.phaseId === phaseId).forEach(t => {
    const nested = isNestedTemps(t.temps, catIds);
    assigneeKeys.forEach(k => {
      const tempsData = nested ? (t.temps?.[k] || {}) : (k === 'mandataire' ? (t.temps || {}) : {});
      catIds.forEach(cId => {
        result[k][cId] += parseFloat(tempsData[cId]) || 0;
      });
    });
  });
  return result;
};

/** Heures totales grand total par assignee+catégorie */
export const grandHoursByAssignee = (taches, categoriesOrMap, assigneeKeys) => {
  const catIds = allCatIds(categoriesOrMap, assigneeKeys);
  const result = {};
  assigneeKeys.forEach(k => {
    result[k] = Object.fromEntries(catIds.map(c => [c, 0]));
  });
  (taches || []).forEach(t => {
    const nested = isNestedTemps(t.temps, catIds);
    assigneeKeys.forEach(k => {
      const tempsData = nested ? (t.temps?.[k] || {}) : (k === 'mandataire' ? (t.temps || {}) : {});
      catIds.forEach(cId => {
        result[k][cId] += parseFloat(tempsData[cId]) || 0;
      });
    });
  });
  return result;
};

// ─── Cotraitants : calculs par assignee (mode pourcentage) ───────────────────

export const getAssigneeName = (key, draft) => {
  if (key === 'mandataire') return draft.mandataire?.nom || 'Mandataire';
  if (key === 'notreEntreprise') return draft.notreEntreprise?.nom || 'Notre entreprise';
  const cot = (draft.cotraitants || []).find(c => c.id === key);
  return cot?.nom || 'Co-traitant';
};

export const calcHonByAssignee = (draft) => {
  const lots = draft.lots || [];
  const cats = draft.categories || [];
  const isPct = draft.methode === 'pourcentage';
  const phases = (draft.phases || []).filter(p => p.actif);
  const result = {};

  lots.forEach(lot => {
    const key = lot.assigneA || 'mandataire';
    if (!result[key]) result[key] = { lots: [], totalTravauxHT: 0, totalHonHT: 0, phases: {} };
    const entry = result[key];
    entry.lots.push(lot);
    entry.totalTravauxHT += parseFloat(lot.montantTravauxHT) || 0;

    const honLot = isPct
      ? pct(lot, draft.tauxHonorairesGlobal)
      : phases.reduce((s, ph) => s + honPhaseTemps(lot, ph.id, cats), 0);
    entry.totalHonHT += honLot;

    phases.forEach(ph => {
      const honPh = isPct
        ? honPhasePct(honLot, lot.repartitionPhases, ph.id)
        : honPhaseTemps(lot, ph.id, cats);
      entry.phases[ph.id] = (entry.phases[ph.id] || 0) + honPh;
    });
  });

  return result;
};