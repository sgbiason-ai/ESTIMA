// src/utils/distanceMargin.js
// Helpers pour appliquer une majoration en % a une distance, selon des seuils.
//
// Cas d'usage : OSRM calcule la distance route theorique, mais en pratique
// on fait souvent plus de km (zigzag, parking, detours). On majore.
//
// Format des regles : array d'objets { maxKm, marginPct } tries par maxKm
// croissant. Au-dela du dernier seuil → 0% (pas de majoration).
//
// Exemple :
//   [{ maxKm: 10, marginPct: 15 }, { maxKm: 30, marginPct: 10 }]
//   → 5 km   → 5.75 km   (+15%)
//   → 25 km  → 27.5 km   (+10%)
//   → 50 km  → 50 km     (au-dela, 0%)

export const DEFAULT_MARGINS = [
  { maxKm: 10, marginPct: 15 },
  { maxKm: 30, marginPct: 10 },
  { maxKm: 100, marginPct: 5 },
];

/** Trie + filtre les regles valides. */
function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((r) => Number(r?.maxKm) > 0 && Number(r?.marginPct) >= 0)
    .map((r) => ({ maxKm: Number(r.maxKm), marginPct: Number(r.marginPct) }))
    .sort((a, b) => a.maxKm - b.maxKm);
}

/** Trouve la majoration applicable a une distance donnee (en %). 0 si aucune. */
export function getApplicableMarginPct(km, rules) {
  if (!km || km <= 0) return 0;
  const sorted = normalizeRules(rules);
  for (const r of sorted) {
    if (km <= r.maxKm) return r.marginPct;
  }
  return 0;
}

/** Applique la majoration a une distance et arrondi a 0.1 km. */
export function applyDistanceMargin(km, rules) {
  const pct = getApplicableMarginPct(km, rules);
  if (pct === 0) return km;
  const majored = km * (1 + pct / 100);
  return Math.round(majored * 10) / 10;
}

/**
 * Distance "effective" (one-way) apres majoration eventuelle.
 * NE multiplie PAS par 2 pour l'A/R — utiliser getTripTotalKm pour ca.
 *
 *  - Override manuel : valeur saisie (trip.km, telle quelle)
 *  - OSRM + majorations on : applyDistanceMargin(rawKmOsrm) — applique le %
 *  - OSRM + majorations off : rawKmOsrm brut
 *  - Ancien trajet sans rawKmOsrm : trip.km
 */
export function getEffectiveOneWayKm(trip, rules, enabled) {
  if (!trip) return 0;
  const stored = Number(trip.km) || 0;
  if (trip.kmManualOverride) return stored;
  const raw = Number(trip.rawKmOsrm);
  if (!raw) return stored;
  if (!enabled) return raw;
  return applyDistanceMargin(raw, rules);
}

/**
 * Distance totale du trajet : aller + retour si A/R coche.
 *
 * Logique retour quand A/R :
 *   - Si trip.rawKmReturn est defini (cas A/R avec etapes intermediaires —
 *     retour direct stocke separement, sans repasser par les etapes) :
 *     retour = applyMargin(rawKmReturn)
 *   - Sinon (legacy ou A/R sans etape) : retour = aller (donc total = aller × 2)
 */
export function getTripTotalKm(trip, rules, enabled) {
  const oneWay = getEffectiveOneWayKm(trip, rules, enabled);
  if (!trip?.roundTrip) return oneWay;

  const hasDirectReturn = Number(trip?.rawKmReturn) > 0;
  if (hasDirectReturn) {
    const ret = enabled
      ? applyDistanceMargin(Number(trip.rawKmReturn), rules)
      : Number(trip.rawKmReturn);
    return oneWay + ret;
  }
  return oneWay * 2;
}
