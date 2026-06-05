// src/utils/blocPricing.js
// Logique de prix des "blocs" (ouvrages composites) et construction des lignes
// d'estimation à l'insertion. Source unique, testée (blocPricing.test.js).
//
// Un bloc a une unité (ex. m²). Chaque article composant est ramené à cette unité
// via un facteur dépendant de SON unité :
//   - tonne (T)  → facteur = épaisseur(m) × densité(t/m³)   [t par unité de bloc]
//   - m³ (M3)    → facteur = épaisseur(m)                    [m³ par unité de bloc]
//   - autre      → facteur = 1
// Coût ramené d'un article = prix × facteur. Prix du bloc = Σ des coûts ramenés.
import { normalizeUnitSymbol, generateId } from './helpers';

const MASS_UNITS = ['T', 'TONNE', 'TONNES'];
const VOLUME_UNITS = ['M3'];

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// Représentation courte d'un nombre pour une formule (0.30 → "0.3", 2 → "2").
const numStr = (v) => { const n = Number(v); return Number.isFinite(n) ? String(n) : '0'; };

/** Le calcul a-t-il besoin d'une épaisseur pour cette unité d'article ? (T ou m³) */
export function needsThickness(articleUnit) {
  const u = normalizeUnitSymbol(articleUnit || '');
  return MASS_UNITS.includes(u) || VOLUME_UNITS.includes(u);
}

/** Le calcul a-t-il besoin d'une densité pour cette unité d'article ? (T uniquement) */
export function needsDensity(articleUnit) {
  return MASS_UNITS.includes(normalizeUnitSymbol(articleUnit || ''));
}

/** Facteur numérique pour ramener 1 unité de bloc → quantité d'article. */
export function blocUnitFactor(articleUnit, epaisseur, densite) {
  const u = normalizeUnitSymbol(articleUnit || '');
  if (MASS_UNITS.includes(u)) return num(epaisseur) * num(densite);
  if (VOLUME_UNITS.includes(u)) return num(epaisseur);
  return 1;
}

/** Coût d'un article ramené à l'unité du bloc (prix × facteur). */
export function articleContribution(article, epaisseur, densite) {
  return num(article?.price) * blocUnitFactor(article?.unit, epaisseur, densite);
}

/** Normalise les composants d'un bloc (gère l'ancien format `articleIds`). */
export function getBlocArticles(bloc) {
  if (Array.isArray(bloc?.articles)) return bloc.articles;
  if (Array.isArray(bloc?.articleIds)) {
    return bloc.articleIds.map(id => ({ id: String(id), epaisseur: '', densite: '' }));
  }
  return [];
}

/** Prix unitaire du bloc (Σ des coûts ramenés), à partir d'un lookup id→article. */
export function blocUnitPrice(bloc, bpuById) {
  return getBlocArticles(bloc).reduce((sum, a) => {
    const art = bpuById?.[String(a.id)];
    return art ? sum + articleContribution(art, a.epaisseur, a.densite) : sum;
  }, 0);
}

/** Fragment de formule multiplicateur (hors quantité pilote), ou null si facteur = 1. */
export function blocFormulaFactor(articleUnit, epaisseur, densite) {
  const u = normalizeUnitSymbol(articleUnit || '');
  if (MASS_UNITS.includes(u)) return `${numStr(epaisseur)}*${numStr(densite)}`;
  if (VOLUME_UNITS.includes(u)) return `${numStr(epaisseur)}`;
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
export function buildBlocSubChapter(bloc, bpuById, tranches = []) {
  const articles = getBlocArticles(bloc);
  const blocId = generateId();

  const components = [];
  let missing = 0;

  articles.forEach(a => {
    const art = bpuById?.[String(a.id)];
    if (!art) { missing++; return; }

    const factorStr = blocFormulaFactor(art.unit, a.epaisseur, a.densite);
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
      // Facteur de conversion mémorisé → permet d'afficher le PU moyen du bloc
      // (Σ prix×facteur) même à surface nulle, sans relire le BPU.
      blocFactor: blocUnitFactor(art.unit, a.epaisseur, a.densite),
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
