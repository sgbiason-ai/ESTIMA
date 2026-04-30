// src/data/baremeFiscal2025.js
// Bareme kilometrique fiscal francais (impots.gouv.fr)
// Applicable pour les declarations de revenus 2024-2025.
// Si le bareme officiel change, mettre a jour les valeurs ci-dessous.
//
// Pour chaque puissance fiscale (CV) :
//   - rate1   : taux pour les ≤ 5 000 km
//   - rate2   : taux pour la tranche 5 001 - 20 000 km
//   - fixed2  : forfait additionnel sur cette tranche
//   - rate3   : taux pour > 20 000 km
//
// Formules officielles :
//   ≤ 5 000 km          : montant = km × rate1
//   5 001 a 20 000 km   : montant = km × rate2 + fixed2
//   > 20 000 km         : montant = km × rate3

export const BAREME_2025 = {
  3: { rate1: 0.529, rate2: 0.316, fixed2: 1065, rate3: 0.370 },
  4: { rate1: 0.606, rate2: 0.340, fixed2: 1330, rate3: 0.407 },
  5: { rate1: 0.636, rate2: 0.357, fixed2: 1395, rate3: 0.427 },
  6: { rate1: 0.665, rate2: 0.374, fixed2: 1457, rate3: 0.447 },
  7: { rate1: 0.697, rate2: 0.394, fixed2: 1515, rate3: 0.470 },
};

export const PUISSANCES = [
  { value: 3, label: '3 CV et moins' },
  { value: 4, label: '4 CV' },
  { value: 5, label: '5 CV' },
  { value: 6, label: '6 CV' },
  { value: 7, label: '7 CV et plus' },
];

const TRANCHE_BREAKS = [5000, 20000];

/** Resout la puissance vers l'entree de bareme (clamp 3-7). */
function getBareme(puissance) {
  const p = Math.max(3, Math.min(7, Number(puissance) || 5));
  return BAREME_2025[p];
}

/**
 * Montant deductible total pour un cumul annuel de km donne.
 * Conforme bareme officiel (formule par tranche).
 */
export function calculateAnnualAmount(annualKm, puissance) {
  if (!annualKm || annualKm <= 0) return 0;
  const b = getBareme(puissance);
  if (annualKm <= TRANCHE_BREAKS[0]) {
    return annualKm * b.rate1;
  }
  if (annualKm <= TRANCHE_BREAKS[1]) {
    return annualKm * b.rate2 + b.fixed2;
  }
  return annualKm * b.rate3;
}

/**
 * Montant attribuable a un mois precis = differentiel des cumuls.
 *   amount(mois N) = total(cumul jusqu'a fin N) − total(cumul jusqu'a fin N-1)
 * Methode fiscalement correcte (les tranches sont annuelles, pas mensuelles).
 */
export function calculateMonthAmount(cumulBeforeMonth, monthKm, puissance) {
  const cumulAfter = (cumulBeforeMonth || 0) + (monthKm || 0);
  return calculateAnnualAmount(cumulAfter, puissance) - calculateAnnualAmount(cumulBeforeMonth || 0, puissance);
}

/** Tranche fiscale active pour un cumul annuel donne (pour affichage). */
export function getActiveTranche(cumulKm) {
  if (cumulKm <= TRANCHE_BREAKS[0]) return { index: 0, label: 'Tranche 1 (≤ 5 000 km/an)' };
  if (cumulKm <= TRANCHE_BREAKS[1]) return { index: 1, label: 'Tranche 2 (5 001 a 20 000 km/an)' };
  return { index: 2, label: 'Tranche 3 (> 20 000 km/an)' };
}

/** Taux marginal au cumul donne (utile pour estimation per-trajet). */
export function getMarginalRate(cumulKm, puissance) {
  const b = getBareme(puissance);
  if (cumulKm <= TRANCHE_BREAKS[0]) return b.rate1;
  if (cumulKm <= TRANCHE_BREAKS[1]) return b.rate2;
  return b.rate3;
}
