// src/utils/blocPricing.js
// Logique de prix des "blocs" (ouvrages composites) et construction des lignes
// d'estimation à l'insertion. Source unique, testée (blocPricing.test.js).
//
// Un bloc a une unité PILOTE (m², ml ou m³). Chaque article composant est ramené à
// cette unité via une géométrie (largeur, épaisseur, densité) qui dépend du COUPLE
// (unité du bloc, unité de l'article), puis majoré d'un coefficient de perte (%) :
//
//   Bloc m² (surface)             Bloc ml (linéaire)               Bloc m³ (volume)
//   ─────────────────             ──────────────────               ────────────────
//   art m³ : × épaisseur(m)       art m³ : × largeur×épaisseur      art m³ : × 1
//   art T  : × épaisseur×densité  art T  : × largeur×épaisseur×dens art T  : × densité
//   art m² : × 1                  art m² : × largeur(m)             art m² : × 1
//   art ml/u/… : × 1              art ml/u/… : × 1                  art ml/u/… : × 1
//
//   facteur = base × (1 + perte/100)        (perte = % de chutes/foisonnement, tous articles)
// Coût ramené d'un article = prix × facteur. Prix du bloc = Σ des coûts ramenés.
// Géométrie stockée par composant : `largeur`, `epaisseur`, `densite` (+ `perte`). La
// largeur ne sert qu'aux blocs ml (section = largeur×épaisseur ; m² = largeur développée).
// Un bloc sans unité explicite est traité comme m² (défaut historique).
import { normalizeUnitSymbol, generateId } from './helpers';
import { dimensionOf } from '../data/units';

// La famille physique d'une unité provient désormais du catalogue central
// (src/data/units.js) : dimensionOf('T')→'mass', 'M3'→'volume', 'M2'→'area',
// 'ML'→'length'. Les unités personnalisées déclarant une dimension participent
// donc automatiquement aux conversions de blocs (avant : listes figées ici).
const isMass = (u) => dimensionOf(u) === 'mass';
const isVolume = (u) => dimensionOf(u) === 'volume';
const isArea = (u) => dimensionOf(u) === 'area';
const isLength = (u) => dimensionOf(u) === 'length';
// Unité de bloc normalisée, m² par défaut (rétro-compat des blocs sans unité).
const blocU = (blocUnit) => normalizeUnitSymbol(blocUnit || '') || 'M2';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// Représentation courte d'un nombre pour une formule (0.30 → "0.3", 2 → "2").
const numStr = (v) => { const n = Number(v); return Number.isFinite(n) ? String(n) : '0'; };
// Coefficient multiplicateur de perte à partir d'un pourcentage (5 → 1.05). Vide/0 → 1.
const perteCoef = (perte) => Math.round((1 + num(perte) / 100) * 1e6) / 1e6;

/**
 * Spécification de la saisie géométrique pour un couple (unité du bloc, unité de
 * l'article) : quels champs faut-il (largeur / épaisseur / densité) ? La largeur n'est
 * jamais demandée hors bloc ml.
 * @returns {{needsLargeur:boolean, needsEpaisseur:boolean, needsDensity:boolean}}
 */
export function geoSpec(blocUnit, articleUnit) {
  const b = blocU(blocUnit);
  const a = normalizeUnitSymbol(articleUnit || '');
  const none = { needsLargeur: false, needsEpaisseur: false, needsDensity: false };
  if (isLength(b)) {                 // bloc ml (linéaire)
    if (isVolume(a) || isMass(a)) return { needsLargeur: true, needsEpaisseur: true, needsDensity: isMass(a) };
    if (isArea(a))                return { needsLargeur: true, needsEpaisseur: false, needsDensity: false };
    return none;
  }
  if (isVolume(b)) {                 // bloc m³ (volume) : densité seule pour les tonnes
    return isMass(a) ? { needsLargeur: false, needsEpaisseur: false, needsDensity: true } : none;
  }
  // bloc m² (ou unité non géométrique) : comportement historique (épaisseur)
  if (isMass(a))   return { needsLargeur: false, needsEpaisseur: true, needsDensity: true };
  if (isVolume(a)) return { needsLargeur: false, needsEpaisseur: true, needsDensity: false };
  return none;
}

// Volume (m³) d'article par unité de bloc, selon la géométrie du pilote.
//   ml  → section = largeur × épaisseur     m³ → 1 (volume direct)     m² → épaisseur
const volumePerBlocUnit = (b, largeur, epaisseur) => {
  if (isLength(b)) return num(largeur) * num(epaisseur);
  if (isVolume(b)) return 1;
  return num(epaisseur);
};

/** Facteur numérique pour ramener 1 unité de bloc → quantité d'article (perte incluse). */
export function blocUnitFactor(blocUnit, articleUnit, largeur, epaisseur, densite, perte) {
  const b = blocU(blocUnit);
  const a = normalizeUnitSymbol(articleUnit || '');
  let base = 1;
  if (isMass(a))                     base = volumePerBlocUnit(b, largeur, epaisseur) * num(densite);
  else if (isVolume(a))              base = volumePerBlocUnit(b, largeur, epaisseur);
  else if (isArea(a) && isLength(b)) base = num(largeur);   // ml × largeur = m²
  return base * perteCoef(perte);
}

/** Coût d'un article ramené à l'unité du bloc (prix × facteur, perte incluse). */
export function articleContribution(blocUnit, article, largeur, epaisseur, densite, perte) {
  return num(article?.price) * blocUnitFactor(blocUnit, article?.unit, largeur, epaisseur, densite, perte);
}

/** Normalise les composants d'un bloc (gère l'ancien format `articleIds`). */
export function getBlocArticles(bloc) {
  if (Array.isArray(bloc?.articles)) return bloc.articles;
  if (Array.isArray(bloc?.articleIds)) {
    return bloc.articleIds.map(id => ({ id: String(id), largeur: '', epaisseur: '', densite: '', perte: '' }));
  }
  return [];
}

/**
 * Type d'un bloc :
 *  - 'formula'   : ouvrage composite (défaut) — articles ramenés à l'unité du bloc
 *                  via épaisseur/densité/perte, inséré avec une surface pilote + formules.
 *  - 'aggregate' : simple regroupement d'articles (pas de calcul), inséré en
 *                  sous-chapitre normal avec quantités à saisir.
 * Rétro-compat : un bloc sans `kind` est considéré 'formula'.
 */
export function getBlocKind(bloc) {
  return bloc?.kind === 'aggregate' ? 'aggregate' : 'formula';
}

/** Un composant de bloc référence-t-il un autre bloc (vs un article BPU) ? */
export function isBlocRef(component) {
  return component?.ref === 'bloc';
}

/**
 * Prix unitaire du bloc (Σ des coûts ramenés), à partir d'un lookup id→article.
 * Récursif : un composant `{ref:'bloc'}` ajoute le prix du sous-bloc (résolu via
 * `blocsById`). `visited` empêche les boucles (A⊂B⊂A) ; un cycle compte pour 0.
 */
export function blocUnitPrice(bloc, bpuById, blocsById = {}, visited = new Set()) {
  const seen = new Set(visited);
  if (bloc?.id) seen.add(String(bloc.id));
  return getBlocArticles(bloc).reduce((sum, a) => {
    if (isBlocRef(a)) {
      const child = blocsById?.[String(a.id)];
      if (!child || seen.has(String(a.id))) return sum;
      return sum + blocUnitPrice(child, bpuById, blocsById, seen);
    }
    const art = bpuById?.[String(a.id)];
    return art ? sum + articleContribution(bloc?.unit, art, a.largeur, a.epaisseur, a.densite, a.perte) : sum;
  }, 0);
}

// Fragment "volume par unité de bloc" pour une formule : "L*E" (ml), "E" (m²), null (m³).
const volumeFactorStr = (b, largeur, epaisseur) => {
  if (isLength(b)) return `${numStr(largeur)}*${numStr(epaisseur)}`;
  if (isVolume(b)) return null;
  return `${numStr(epaisseur)}`;
};

/** Fragment de formule multiplicateur (hors quantité pilote), ou null si facteur = 1. */
export function blocFormulaFactor(blocUnit, articleUnit, largeur, epaisseur, densite, perte) {
  const b = blocU(blocUnit);
  const a = normalizeUnitSymbol(articleUnit || '');
  let base = null;
  if (isMass(a)) {
    // Volume × densité, le volume dépendant de la géométrie du pilote (bloc m³ → densité seule).
    const v = volumeFactorStr(b, largeur, epaisseur);
    base = v ? `${v}*${numStr(densite)}` : `${numStr(densite)}`;
  } else if (isVolume(a)) {
    base = volumeFactorStr(b, largeur, epaisseur);   // bloc m³ → volume direct (null)
  } else if (isArea(a) && isLength(b)) {
    base = `${numStr(largeur)}`;   // ml × largeur = m²
  }
  const coef = perteCoef(perte);
  const coefStr = coef !== 1 ? numStr(coef) : null;
  if (base && coefStr) return `${base}*${coefStr}`;
  if (base) return base;
  if (coefStr) return coefStr;
  return null;
}

/**
 * Construit le SOUS-CHAPITRE d'estimation à insérer pour un bloc :
 *  - un nœud `type:'chapter'` marqué `isBloc`, porteur de l'unité + d'une quantité
 *    (la "surface", saisie sur l'en-tête, par tranche) → transparent pour le BPU
 *    (jamais numéroté, jamais compté comme article, titre de regroupement à l'export).
 *  - ses enfants = les composants (prix/unité natifs, FIGÉS) dont la quantité est
 *    une formule =({sous-chapitre}) × facteur, posée en global ET sur chaque tranche.
 * Référence par {id} (résolue par recalculateProject ; rendue [titre] dans la barre ƒ(x)).
 *
 * @returns { node, added, missing }
 */
export function buildBlocSubChapter(bloc, bpuById, tranches = [], blocsById = {}, visited = new Set()) {
  const seen = new Set(visited);
  if (bloc?.id) seen.add(String(bloc.id));

  if (getBlocKind(bloc) === 'aggregate') return buildAggregateSubChapter(bloc, bpuById, blocsById, seen, tranches);

  // Branche FORMULE : composants = articles uniquement (une éventuelle réf de bloc,
  // non résolue par bpuById, est ignorée → comptée « missing »).
  const articles = getBlocArticles(bloc);
  const blocId = generateId();

  const components = [];
  let missing = 0;

  articles.forEach(a => {
    const art = bpuById?.[String(a.id)];
    if (!art) { missing++; return; }

    const factorStr = blocFormulaFactor(bloc?.unit, art.unit, a.largeur, a.epaisseur, a.densite, a.perte);
    const formula = factorStr ? `={${blocId}}*${factorStr}` : `={${blocId}}`;

    const quantitiesFormula = {};
    (tranches || []).forEach(t => { quantitiesFormula[t.id] = formula; });

    components.push({
      type: 'item',
      id: `line_${generateId()}`,
      uid: String(art.id ?? a.id ?? ''),
      designation: art.designation || '',
      unit: art.unit || '',
      price: num(art.price),
      qty: 0,
      formula,
      quantities: {},
      quantitiesFormula,
      bpuNum: art.bpuNum ?? '',
      isFixed: !!art.isFixed,
      // Facteur de conversion mémorisé (perte incluse) → permet d'afficher le PU moyen
      // du bloc (Σ prix×facteur) même à surface nulle, sans relire le BPU.
      blocFactor: blocUnitFactor(bloc?.unit, art.unit, a.largeur, a.epaisseur, a.densite, a.perte),
    });
  });

  const node = {
    id: blocId,
    type: 'chapter',
    isBloc: true,
    title: bloc?.name || 'Bloc',
    unit: bloc?.unit || '',
    qty: 0,
    quantities: {},
    quantitiesFormula: {},
    isOption: false,
    children: components,
  };

  return { node, added: components.length, missing };
}

/**
 * Sous-chapitre d'un bloc AGRÉGAT (simple regroupement, sans calcul) :
 *  - un nœud `type:'chapter'` NORMAL (numéroté, sous-totalisé) — pas de `isBloc`,
 *    donc aucune surface pilote ni formule.
 *  - ses enfants = les articles en lignes standard (quantité VIDE à saisir) ET,
 *    pour un composant `{ref:'bloc'}`, le sous-chapitre du bloc enfant inséré
 *    RÉCURSIVEMENT (templates « bloc de blocs », ex. Lotissement ⊃ Voirie ⊃ articles).
 *    Le bloc enfant garde son propre type (un sous-bloc formule conserve sa surface
 *    pilote + ses formules).
 *  - `blocsById` résout les blocs enfants ; `visited` empêche les cycles (A⊂B⊂A).
 * `added` = nombre total de lignes d'articles FEUILLES (récursif) ; `missing` =
 * composants non résolus (article/bloc introuvable, ou référence cyclique ignorée).
 * @returns { node, added, missing }
 */
export function buildAggregateSubChapter(bloc, bpuById, blocsById = {}, visited = new Set(), tranches = []) {
  const components = [];
  let added = 0;
  let missing = 0;

  getBlocArticles(bloc).forEach(a => {
    // Composant = sous-bloc → on insère récursivement son sous-chapitre.
    if (isBlocRef(a)) {
      const child = blocsById?.[String(a.id)];
      if (!child || visited.has(String(a.id))) { missing++; return; } // introuvable ou cycle
      const sub = buildBlocSubChapter(child, bpuById, tranches, blocsById, visited);
      components.push(sub.node);
      added += sub.added;
      missing += sub.missing;
      return;
    }

    // Composant = article → ligne standard, quantité vide.
    const art = bpuById?.[String(a.id)];
    if (!art) { missing++; return; }

    components.push({
      type: 'item',
      id: `line_${generateId()}`,
      uid: String(art.id ?? a.id ?? ''),
      designation: art.designation || '',
      unit: art.unit || '',
      price: num(art.price),
      qty: 0,
      quantities: {},
      quantitiesFormula: {},
      bpuNum: art.bpuNum ?? '',
      isFixed: !!art.isFixed,
    });
    added += 1;
  });

  const node = {
    id: generateId(),
    type: 'chapter',
    title: bloc?.name || 'Bloc',
    qty: 0,
    quantities: {},
    quantitiesFormula: {},
    isOption: false,
    children: components,
  };

  return { node, added, missing };
}
