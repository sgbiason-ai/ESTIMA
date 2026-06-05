// src/utils/estimRapideCalc.js
//
// Fonctions pures de calcul du module Estimation Rapide.
// Aucune dépendance React/Firebase — testées via estimRapideCalc.test.js.

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Montant HT d'un poste = quantité × ratio. */
export const posteMontant = (poste) => toNum(poste?.qty) * toNum(poste?.ratio);

/** Sous-total HT d'un grand lot. */
export const lotSubtotal = (lot) =>
  (lot?.postes || []).reduce((sum, p) => sum + posteMontant(p), 0);

/** Total HT hors aléas (somme des lots). */
export const estimateBaseTotal = (estimate) =>
  (estimate?.lots || []).reduce((sum, lot) => sum + lotSubtotal(lot), 0);

/** Montant des aléas (0 si désactivés). */
export const aleasAmount = (estimate) => {
  const aleas = estimate?.aleas;
  if (!aleas?.enabled) return 0;
  return estimateBaseTotal(estimate) * (toNum(aleas.percent) / 100);
};

/** Total HT final (base + aléas éventuels). */
export const estimateTotalHT = (estimate) =>
  estimateBaseTotal(estimate) + aleasAmount(estimate);

/** Un lot contient-il au moins un poste renseigné (qty > 0) ? */
export const lotHasValues = (lot) =>
  (lot?.postes || []).some(p => toNum(p.qty) > 0);

/**
 * Récapitulatif prêt pour l'affichage et le PDF :
 * { lots: [{ id, key, label, subtotal, postesCount }], base, aleas, totalHT }
 */
export const buildSummary = (estimate) => {
  const lots = (estimate?.lots || []).map(lot => ({
    id: lot.id,
    key: lot.key,
    label: lot.label,
    subtotal: lotSubtotal(lot),
    postesCount: (lot.postes || []).length,
  }));
  const base = lots.reduce((sum, l) => sum + l.subtotal, 0);
  const aleas = aleasAmount(estimate);
  return { lots, base, aleas, totalHT: base + aleas };
};
