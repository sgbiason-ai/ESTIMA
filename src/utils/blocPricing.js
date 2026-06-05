// src/utils/blocPricing.js
// Logique de prix des "blocs" (ouvrages composites) et construction des lignes
// d'estimation à l'insertion. Source unique, testée (blocPricing.test.js).
//
// Un bloc a une unité (ex. m²). Chaque article composant est ramené à cette unité
// via un facteur dépendant de SON unité, puis majoré d'un coefficient de perte (%) :
//   - tonne (T)  → base = épaisseur(m) × densité(t/m³)   [t par unité de bloc]
//   - m³ (M3)    → base = épaisseur(m)                    [m³ par unité de bloc]
//   - autre      → base = 1
//   facteur = base × (1 + perte/100)        (perte = % de chutes/foisonnement, tous articles)
// Coût ramené d'un article = prix × facteur. Prix du bloc = Σ des coûts ramenés.
import { normalizeUnitSymbol, generateId } from './helpers';

const MASS_UNITS = ['T', 'TONNE', 'TONNES'];
const VOLUME_UNITS = ['M3'];

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// Représentation courte d'un nombre pour une formule (0.30 → "0.3", 2 → "2").
const numStr = (v) => { const n = Number(v); return Number.isFinite(n) ? String(n) : '0'; };
// Coefficient multiplicateur de perte à partir d'un pourcentage (5 → 1.05). Vide/0 → 1.
const perteCoef = (perte) => Math.round((1 + num(perte) / 100) * 1e6) / 1e6;

/** Le calcul a-t-il besoin d'une épaisseur pour cette unité d'article ? (T ou m³) */
export function needsThickness(articleUnit) {
  const u = normalizeUnitSymbol(articleUnit || '');
  return MASS_UNITS.includes(u) || VOLUME_UNITS.includes(u);
}

/** Le calcul a-t-il besoin d'une densité pour cette unité d'article ? (T uniquement) */
export function needsDensity(articleUnit) {
  return MASS_UNITS.includes(normalizeUnitSymbol(articleUnit || ''));
}

/** Facteur numérique pour ramener 1 unité de bloc → quantité d'article (perte incluse). */
export function blocUnitFactor(articleUnit, epaisseur, densite, perte) {
  const u = normalizeUnitSymbol(articleUnit || '');
  let base = 1;
  if (MASS_UNITS.includes(u)) base = num(epaisseur) * num(densite);
  else if (VOLUME_UNITS.includes(u)) base = num(epaisseur);
  return base * perteCoef(perte);
}

/** Coût d'un article ramené à l'unité du bloc (prix × facteur, perte incluse). */
export function articleContribution(article, epaisseur, densite, perte) {
  return num(article?.price) * blocUnitFactor(article?.unit, epaisseur, densite, perte);
}

/** Normalise les composants d'un bloc (gère l'ancien format `articleIds`). */
export function getBlocArticles(bloc) {
  if (Array.isArray(bloc?.articles)) return bloc.articles;
  if (Array.isArray(bloc?.articleIds)) {
    return bloc.articleIds.map(id => ({ id: String(id), epaisseur: '', densite: '', perte: '' }));
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
    return art ? sum + articleContribution(art, a.epaisseur, a.densite, a.perte) : sum;
  }, 0);
}

/** Fragment de formule multiplicateur (hors quantité pilote), ou null si facteur = 1. */
export function blocFormulaFactor(articleUnit, epaisseur, densite, perte) {
  const u = normalizeUnitSymbol(articleUnit || '');
  let base = null;
  if (MASS_UNITS.includes(u)) base = `${numStr(epaisseur)}*${numStr(densite)}`;
  else if (VOLUME_UNITS.includes(u)) base = `${numStr(epaisseur)}`;
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

    const factorStr = blocFormulaFactor(art.unit, a.epaisseur, a.densite, a.perte);
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
      blocFactor: blocUnitFactor(art.unit, a.epaisseur, a.densite, a.perte),
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
