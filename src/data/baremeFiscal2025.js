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

export const DEFAULT_TRANCHE_BREAKS = [5000, 20000];

// Bonus officiel +20% pour vehicules electriques
// (impots.gouv.fr : "le bareme applicable aux vehicules electriques
// fait l'objet d'une majoration de 20%")
export const ELECTRIC_BONUS = 1.2;

/** Resout la puissance vers l'entree de bareme (clamp 3-7). */
function resolvePuissance(puissance) {
  return Math.max(3, Math.min(7, Number(puissance) || 5));
}

/**
 * Resout le bareme effectif :
 * - Si `custom` est fourni avec `enabled: true`, on l'utilise
 * - Sinon on retombe sur BAREME_2025 + DEFAULT_TRANCHE_BREAKS
 *
 * @param {number} puissance
 * @param {{ enabled, breaks: [n1, n2], byPuissance: { 3: {rate1,rate2,fixed2,rate3}, ... } }} custom
 * @returns {{ breaks: [number, number], rates: { rate1, rate2, fixed2, rate3 } }}
 */
function resolveBareme(puissance, custom) {
  const p = resolvePuissance(puissance);
  if (custom?.enabled && custom.breaks?.length === 2 && custom.byPuissance?.[p]) {
    return { breaks: custom.breaks, rates: custom.byPuissance[p] };
  }
  return { breaks: DEFAULT_TRANCHE_BREAKS, rates: BAREME_2025[p] };
}

/**
 * Format le bareme par defaut pour l'edition (clone profond editable).
 */
export function defaultCustomBareme() {
  return {
    enabled: false,
    breaks: [...DEFAULT_TRANCHE_BREAKS],
    byPuissance: Object.fromEntries(
      Object.entries(BAREME_2025).map(([p, v]) => [p, { ...v }])
    ),
  };
}

/**
 * Montant deductible total pour un cumul annuel de km donne.
 * @param {boolean} isElectric - applique +20% si vrai (bonus officiel)
 */
export function calculateAnnualAmount(annualKm, puissance, custom, isElectric = false) {
  if (!annualKm || annualKm <= 0) return 0;
  const { breaks, rates } = resolveBareme(puissance, custom);
  let amount;
  if (annualKm <= breaks[0]) {
    amount = annualKm * rates.rate1;
  } else if (annualKm <= breaks[1]) {
    amount = annualKm * rates.rate2 + rates.fixed2;
  } else {
    amount = annualKm * rates.rate3;
  }
  return isElectric ? amount * ELECTRIC_BONUS : amount;
}

/** Montant attribuable a un mois precis = differentiel des cumuls. */
export function calculateMonthAmount(cumulBeforeMonth, monthKm, puissance, custom, isElectric = false) {
  const cumulAfter = (cumulBeforeMonth || 0) + (monthKm || 0);
  return calculateAnnualAmount(cumulAfter, puissance, custom, isElectric)
       - calculateAnnualAmount(cumulBeforeMonth || 0, puissance, custom, isElectric);
}

/** Tranche fiscale active pour un cumul annuel donne (pour affichage). */
export function getActiveTranche(cumulKm, custom) {
  const { breaks } = resolveBareme(5, custom);
  const fmt = (n) => n.toLocaleString('fr-FR');
  if (cumulKm <= breaks[0]) return { index: 0, label: `Tranche 1 (≤ ${fmt(breaks[0])} km/an)` };
  if (cumulKm <= breaks[1]) return { index: 1, label: `Tranche 2 (${fmt(breaks[0] + 1)} a ${fmt(breaks[1])} km/an)` };
  return { index: 2, label: `Tranche 3 (> ${fmt(breaks[1])} km/an)` };
}

/** Taux marginal au cumul donne (utile pour estimation per-trajet). */
export function getMarginalRate(cumulKm, puissance, custom, isElectric = false) {
  const { breaks, rates } = resolveBareme(puissance, custom);
  let rate;
  if (cumulKm <= breaks[0]) rate = rates.rate1;
  else if (cumulKm <= breaks[1]) rate = rates.rate2;
  else rate = rates.rate3;
  return isElectric ? rate * ELECTRIC_BONUS : rate;
}

/** Taux marginal pour une tranche donnee (0, 1 ou 2) — selecteur manuel. */
export function getRateForTranche(trancheIdx, puissance, custom, isElectric = false) {
  const { rates } = resolveBareme(puissance, custom);
  let rate;
  if (trancheIdx === 0) rate = rates.rate1;
  else if (trancheIdx === 1) rate = rates.rate2;
  else rate = rates.rate3;
  return isElectric ? rate * ELECTRIC_BONUS : rate;
}

/** Libelle d'une tranche (0, 1 ou 2). */
export function getTrancheLabel(trancheIdx, custom) {
  const { breaks } = resolveBareme(5, custom);
  const fmt = (n) => n.toLocaleString('fr-FR');
  if (trancheIdx === 0) return `Tranche 1 (≤ ${fmt(breaks[0])} km)`;
  if (trancheIdx === 1) return `Tranche 2 (${fmt(breaks[0] + 1)} a ${fmt(breaks[1])} km)`;
  return `Tranche 3 (> ${fmt(breaks[1])} km)`;
}
