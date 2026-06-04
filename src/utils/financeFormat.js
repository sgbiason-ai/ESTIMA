// src/utils/financeFormat.js
// Source unique pour l'arrondi monétaire et la ventilation HT / TVA / TTC.
//
// Conventions arrêtées (audit exactitude financière F1 / F3) :
//   - Arrondi « à la ligne puis somme » (usage DQE / BTP) : chaque ligne est
//     arrondie au centime, puis on additionne. Le total = somme des lignes affichées.
//   - TTC = HT + TVA (jamais HT × 1.2 recalculé indépendamment), pour garantir
//     l'identité HT + TVA = TTC à l'affichage, opposable sur un acte d'engagement.
//
// Le taux par défaut reste 20 % (F2 — taux configurable par projet — viendra
// alimenter le paramètre `rate` sans changer cette mécanique).

/** Taux de TVA par défaut (marché VRD standard). */
export const DEFAULT_TVA_RATE = 0.20;

/**
 * Arrondi monétaire au centime (2 décimales).
 * Strictement identique à l'arrondi par ligne historique du PDF
 * (`Math.round(n * 100) / 100`) pour que PDF et Excel coïncident au centime.
 * @param {number} n
 * @returns {number} valeur arrondie (0 si non finie)
 */
export function roundEuro(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/**
 * Ventile un total HT en { ht, tva, ttc } au centime, avec TTC = HT + TVA.
 * @param {number} totalHT - total HT (idéalement déjà une somme de lignes arrondies)
 * @param {number} [rate=DEFAULT_TVA_RATE] - taux de TVA (0.20 = 20 %)
 * @returns {{ ht: number, tva: number, ttc: number }}
 */
export function computeVatBreakdown(totalHT, rate = DEFAULT_TVA_RATE) {
  const ht = roundEuro(totalHT);
  const r = Number.isFinite(Number(rate)) ? Number(rate) : DEFAULT_TVA_RATE;
  const tva = roundEuro(ht * r);
  const ttc = roundEuro(ht + tva);
  return { ht, tva, ttc };
}
