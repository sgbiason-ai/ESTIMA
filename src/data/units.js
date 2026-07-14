// src/data/units.js
//
// CATALOGUE CENTRAL DES UNITÉS — source de vérité unique du projet.
//
// Historiquement, la notion d'« unité » était éparpillée et figée à ~4 endroits
// qui s'ignoraient (blocPricing, estimRapideTemplates, parsePdfOffer, defaults).
// Une unité personnalisée ajoutée dans les Réglages n'était donc reconnue nulle
// part ailleurs. Ce module rassemble tout :
//
//   • DIMENSIONS      — familles physiques (longueur, surface, volume, masse…)
//   • CANONICAL_UNITS — unités standard VRD avec dimension, alias, facteur base
//   • enrichUnit()    — complète un {symbol,label} minimal (migration douce)
//   • moteur de conversion (convert / sameDimension / factorOf / dimensionOf)
//   • MATERIAL_DENSITIES — densités matériaux réutilisables dans les blocs
//   • registre runtime — les unités personnalisées chargées depuis le Cloud
//     participent aux conversions (blocs) sans changer les signatures existantes.
//
// Aucune dépendance React/Firebase → pur, testé (units.test.js).

import { normalizeUnitSymbol } from '../utils/helpers';

// ─── DIMENSIONS (familles physiques) ─────────────────────────────────────────
// `base` = symbole normalisé de l'unité de référence de la famille. Le `factor`
// d'une unité exprime « combien d'unités de base vaut 1 de cette unité ».
export const DIMENSIONS = [
  { key: 'length',  label: 'Longueur', base: 'ML', color: 'sky' },
  { key: 'area',    label: 'Surface',  base: 'M2', color: 'emerald' },
  { key: 'volume',  label: 'Volume',   base: 'M3', color: 'indigo' },
  { key: 'mass',    label: 'Masse',    base: 'KG', color: 'amber' },
  { key: 'count',   label: 'Comptage', base: 'U',  color: 'rose' },
  { key: 'time',    label: 'Temps',    base: 'H',  color: 'violet' },
  { key: 'lumpsum', label: 'Forfait',  base: 'ENS', color: 'slate' },
];

export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key);
export const dimensionMeta = (key) => DIMENSIONS.find((d) => d.key === key) || null;
export const dimensionLabel = (key) => dimensionMeta(key)?.label || 'Autre';

// Couleurs disponibles pour les catégories personnalisées (cycle).
export const DIMENSION_COLORS = ['sky', 'emerald', 'indigo', 'amber', 'rose', 'violet', 'slate', 'teal', 'orange', 'cyan'];

/**
 * Fusionne les dimensions intégrées avec la config utilisateur (renommages +
 * catégories personnalisées). Les 7 dimensions physiques sont toujours présentes
 * (leurs clés pilotent les conversions de blocs) mais leur LIBELLÉ est éditable ;
 * les catégories personnalisées (`custom: true`) s'ajoutent à la suite.
 * @param {Array<{key:string,label?:string,color?:string,order?:number,custom?:boolean}>} overrides
 */
export const mergeDimensions = (overrides) => {
  const byKey = new Map((overrides || []).filter((o) => o && o.key).map((o) => [o.key, o]));
  const builtins = DIMENSIONS.map((d, i) => {
    const o = byKey.get(d.key);
    return { ...d, label: o?.label || d.label, order: o?.order ?? i, custom: false };
  });
  const customs = (overrides || [])
    .filter((o) => o && o.key && o.custom && !DIMENSIONS.some((d) => d.key === o.key))
    .map((o, i) => ({
      key: o.key,
      label: o.label || o.key,
      base: null,
      color: o.color || DIMENSION_COLORS[(DIMENSIONS.length + i) % DIMENSION_COLORS.length],
      order: o.order ?? (DIMENSIONS.length + i),
      custom: true,
    }));
  return [...builtins, ...customs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

// ─── UNITÉS CANONIQUES ───────────────────────────────────────────────────────
// factor : quantité exprimée dans l'unité de base de la dimension.
//   masse → kg (T = 1000), longueur → ml (cm = 0.01), etc.
// aliases : orthographes équivalentes (normalisées à la comparaison).
// Symboles affichés/stockés en MAJUSCULES ASCII (choix métier : « que des
// majuscules dans les unités »). Les anciennes formes (m², m³, ml, minuscules)
// deviennent des alias → aucune donnée existante n'est perdue, tout reste reconnu.
// `common: true` = unité proposée par défaut dans les menus déroulants (picker).
export const CANONICAL_UNITS = [
  // Longueur
  { symbol: 'ML', label: 'Mètre linéaire', dimension: 'length', factor: 1,     aliases: ['ml', 'm', 'mètre', 'metre'], common: true },
  { symbol: 'CM', label: 'Centimètre',     dimension: 'length', factor: 0.01,  aliases: ['cm'] },
  { symbol: 'KM', label: 'Kilomètre',      dimension: 'length', factor: 1000,  aliases: ['km'] },
  // Surface
  { symbol: 'M2', label: 'Mètre carré',    dimension: 'area',   factor: 1,     aliases: ['m²', 'm2'], common: true },
  { symbol: 'HA', label: 'Hectare',        dimension: 'area',   factor: 10000, aliases: ['ha'] },
  // Volume
  { symbol: 'M3', label: 'Mètre cube',     dimension: 'volume', factor: 1,     aliases: ['m³', 'm3'], common: true },
  { symbol: 'L',  label: 'Litre',          dimension: 'volume', factor: 0.001, aliases: ['l', 'litre'] },
  // Masse
  { symbol: 'T',  label: 'Tonne',          dimension: 'mass',   factor: 1000,  aliases: ['t', 'tonne', 'tonnes'], common: true },
  { symbol: 'KG', label: 'Kilogramme',     dimension: 'mass',   factor: 1,     aliases: ['kg'] },
  // Comptage
  { symbol: 'U',  label: 'Unité',          dimension: 'count',  factor: 1,     aliases: ['u', 'un', 'unit', 'pce', 'p', 'pièce', 'piece'], common: true },
  // Temps
  { symbol: 'H',  label: 'Heure',          dimension: 'time',   factor: 1,     aliases: ['h', 'hr'] },
  { symbol: 'J',  label: 'Jour',           dimension: 'time',   factor: 8,     aliases: ['j', 'jour'] },
  // Forfait
  { symbol: 'ENS', label: 'Ensemble',      dimension: 'lumpsum', factor: 1,    aliases: ['ens'], common: true },
  { symbol: 'F',   label: 'Forfait',       dimension: 'lumpsum', factor: 1,    aliases: ['f', 'forfait', 'ft', 'global'], common: true },
];

// ─── INDEX & REGISTRE RUNTIME ────────────────────────────────────────────────
// L'index associe un symbole NORMALISÉ (et chaque alias normalisé) à son
// descripteur. Construit une fois sur le catalogue canonique, puis étendu par
// les unités personnalisées via setRuntimeUnits() au chargement du Cloud.

const buildIndex = (list) => {
  const map = new Map();
  list.forEach((u) => {
    if (!u || !u.symbol) return;
    const norm = normalizeUnitSymbol(u.symbol);
    if (norm && !map.has(norm)) map.set(norm, u);
    (u.aliases || []).forEach((a) => {
      const na = normalizeUnitSymbol(a);
      if (na && !map.has(na)) map.set(na, u);
    });
  });
  return map;
};

const CANONICAL_INDEX = buildIndex(CANONICAL_UNITS);

// Registre runtime : unités personnalisées chargées depuis Firestore. On repart
// toujours du canonique puis on superpose le custom (le custom peut redéfinir la
// dimension d'un symbole personnalisé, jamais casser un standard déjà indexé).
let runtimeIndex = CANONICAL_INDEX;

/** Alimente le registre runtime avec les unités enrichies chargées du Cloud. */
export const setRuntimeUnits = (units) => {
  if (!Array.isArray(units) || units.length === 0) {
    runtimeIndex = CANONICAL_INDEX;
    return;
  }
  const merged = buildIndex(units);
  // Le canonique reste la base (garantit m²/m³/ml/t… même si absents du Cloud).
  CANONICAL_INDEX.forEach((val, key) => { if (!merged.has(key)) merged.set(key, val); });
  runtimeIndex = merged;
};

/** Réinitialise le registre au seul catalogue canonique (tests / logout). */
export const resetRuntimeUnits = () => { runtimeIndex = CANONICAL_INDEX; };

/** Descripteur d'une unité (symbole ou alias, casse/exposants indifférents). */
export const lookupUnit = (symbol) => runtimeIndex.get(normalizeUnitSymbol(symbol)) || null;

/**
 * Forme d'affichage/stockage CANONIQUE d'un symbole, toujours en MAJUSCULES.
 *   'm²' → 'M2', 'ml' → 'ML', 'forfait' → 'F', 'palette' → 'PALETTE'.
 * Si le symbole correspond (par alias) à une unité canonique, on renvoie SON
 * symbole ; sinon on renvoie simplement la forme normalisée (majuscules ASCII).
 */
export const canonicalSymbol = (symbol) => {
  const norm = normalizeUnitSymbol(symbol);
  if (!norm) return '';
  const canon = CANONICAL_INDEX.get(norm);
  return canon ? canon.symbol : norm;
};

/** Le symbole est-il déjà sous sa forme majuscule canonique ? */
export const isUpperCanonical = (symbol) => !!symbol && symbol === canonicalSymbol(symbol);

// ─── MOTEUR DE CONVERSION ────────────────────────────────────────────────────

/** Dimension d'une unité ('length'|'area'|…), ou null si inconnue. */
export const dimensionOf = (symbol) => lookupUnit(symbol)?.dimension || null;

/** Facteur vers l'unité de base de la dimension (1 par défaut si inconnu). */
export const factorOf = (symbol) => {
  const f = lookupUnit(symbol)?.factor;
  return Number.isFinite(f) ? f : 1;
};

/** Deux unités partagent-elles la même dimension (connue) ? */
export const sameDimension = (a, b) => {
  const da = dimensionOf(a);
  const db = dimensionOf(b);
  return !!da && da === db;
};

/**
 * Convertit une quantité entre deux unités de MÊME dimension.
 * @returns {number|null} quantité convertie, ou null si dimensions incompatibles
 *          ou unités inconnues.
 */
export const convert = (qty, from, to) => {
  const n = Number(qty);
  if (!Number.isFinite(n)) return null;
  if (!sameDimension(from, to)) return null;
  const ff = factorOf(from);
  const ft = factorOf(to);
  if (!ft) return null;
  return (n * ff) / ft;
};

// ─── ENRICHISSEMENT / MIGRATION ──────────────────────────────────────────────

/**
 * Complète un descripteur d'unité minimal `{symbol,label}` (ancien modèle) avec
 * dimension / factor / aliases inférés du catalogue canonique. Préserve toute
 * valeur déjà présente (une unité déjà enrichie n'est pas écrasée).
 */
export const enrichUnit = (unit) => {
  if (!unit || !unit.symbol) return unit;
  const canon = CANONICAL_INDEX.get(normalizeUnitSymbol(unit.symbol));
  return {
    // Symbole toujours ramené à sa forme MAJUSCULE canonique (m² → M2, ml → ML).
    symbol: canonicalSymbol(unit.symbol),
    label: unit.label || canon?.label || canonicalSymbol(unit.symbol),
    dimension: unit.dimension || canon?.dimension || 'count',
    factor: Number.isFinite(unit.factor) ? unit.factor : (canon?.factor ?? 1),
    aliases: Array.isArray(unit.aliases) && unit.aliases.length ? unit.aliases : (canon?.aliases || []),
    ...(unit.order != null ? { order: unit.order } : {}),
  };
};

/** Enrichit une liste d'unités (migration à la lecture Cloud). */
export const enrichUnits = (units) =>
  Array.isArray(units) ? units.map(enrichUnit) : [];

/** Déduplique une liste d'unités par symbole normalisé (garde la 1re occurrence). */
export const dedupeUnits = (units) => {
  const seen = new Set();
  const out = [];
  (units || []).forEach((u) => {
    if (!u || !u.symbol) return;
    const key = normalizeUnitSymbol(u.symbol);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(u);
  });
  return out;
};

/** Set canonique complet, prêt à écrire comme défaut d'une nouvelle société. */
export const defaultUnits = () => CANONICAL_UNITS.map((u) => ({
  symbol: u.symbol, label: u.label, dimension: u.dimension, factor: u.factor, aliases: [...u.aliases],
}));

/** Symboles usuels proposés dans les menus déroulants (EstimRapide, éditeurs). */
export const commonUnitSymbols = () => CANONICAL_UNITS.filter((u) => u.common).map((u) => u.symbol);

/**
 * Tous les jetons reconnaissables (symboles + alias), en minuscules — utilisé par
 * le parser PDF pour détecter une unité dans un flux OCR bruité.
 */
export const recognizedUnitTokens = () => {
  const set = new Set();
  CANONICAL_UNITS.forEach((u) => {
    set.add(String(u.symbol).toLowerCase());
    (u.aliases || []).forEach((a) => set.add(String(a).toLowerCase()));
  });
  return [...set];
};

// ─── DENSITÉS MATÉRIAUX (réutilisables dans les blocs) ───────────────────────
// densité en t/m³. Sert de préréglage à la saisie « densité » d'un composant de
// bloc quand un article en tonnes est ramené à un volume (voir blocPricing).
export const MATERIAL_DENSITIES = [
  { key: 'enrobe',   label: 'Enrobé bitumineux',      density: 2.4 },
  { key: 'gnt',      label: 'Grave non traitée (GNT)', density: 2.1 },
  { key: 'gb',       label: 'Grave bitume (GB)',       density: 2.4 },
  { key: 'beton',    label: 'Béton',                   density: 2.4 },
  { key: 'sable',    label: 'Sable',                   density: 1.6 },
  { key: 'gravier',  label: 'Gravier / grave 0/20',    density: 1.8 },
  { key: 'terre',    label: 'Terre végétale',          density: 1.5 },
  { key: 'remblai',  label: 'Remblai / tout-venant',   density: 1.9 },
  { key: 'acier',    label: 'Acier',                   density: 7.85 },
];

export const densityOf = (key) => MATERIAL_DENSITIES.find((m) => m.key === key)?.density ?? null;
