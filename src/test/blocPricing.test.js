import { describe, it, expect } from 'vitest';
import {
  blocUnitFactor, articleContribution, blocUnitPrice, getBlocArticles,
  geoSpec, blocFormulaFactor, buildBlocSubChapter,
  buildAggregateSubChapter, getBlocKind, isBlocRef,
} from '../utils/blocPricing';
import { recalculateProject } from '../utils/projectCalculations';

// Base d'articles d'exemple (cas "Voirie légère en granulaire" → m²)
const BPU = {
  a1: { id: 'a1', designation: '0/80 GNT', unit: 't',  price: 12 },
  a2: { id: 'a2', designation: '0/20 GNT', unit: 't',  price: 14 },
  a3: { id: 'a3', designation: 'Enduit de scellement', unit: 'm²', price: 3.5 },
  a4: { id: 'a4', designation: "Couche d'accrochage", unit: 'm²', price: 1.2 },
  a5: { id: 'a5', designation: 'Remblai', unit: 'm³', price: 20 },
};

// Signature : blocUnitFactor(blocUnit, articleUnit, largeur, epaisseur, densite, perte)
// (la largeur ne sert qu'aux blocs ml ; en m²/m³ elle est ignorée)
describe('blocUnitFactor (bloc m² — défaut historique)', () => {
  it('tonne → épaisseur × densité', () => {
    expect(blocUnitFactor('m²', 't', 0, 0.3, 2)).toBeCloseTo(0.6, 6);
    expect(blocUnitFactor('m²', 'T', 0, 0.1, 2.1)).toBeCloseTo(0.21, 6);
  });
  it('m³ → épaisseur (densité ignorée)', () => {
    expect(blocUnitFactor('m²', 'm³', 0, 0.25, 999)).toBeCloseTo(0.25, 6);
    expect(blocUnitFactor('m²', 'm3', 0, 0.4)).toBeCloseTo(0.4, 6);
  });
  it('autre unité → 1', () => {
    expect(blocUnitFactor('m²', 'm²', 0, 0.3, 2)).toBe(1);
    expect(blocUnitFactor('m²', 'ml', 0, 5, 5)).toBe(1);
    expect(blocUnitFactor('m²', 'u')).toBe(1);
  });
  it('valeurs manquantes → 0 pour les unités à conversion', () => {
    expect(blocUnitFactor('m²', 't', 0, '', '')).toBe(0);
    expect(blocUnitFactor('m²', 't', 0, 0.3, '')).toBe(0);
  });
  it('bloc sans unité = m² (rétro-compat)', () => {
    expect(blocUnitFactor('', 't', 0, 0.3, 2)).toBeCloseTo(0.6, 6);
    expect(blocUnitFactor(undefined, 'm³', 0, 0.25)).toBeCloseTo(0.25, 6);
  });
  it('m² : la largeur est ignorée', () => {
    expect(blocUnitFactor('m²', 'm³', 99, 0.25)).toBeCloseTo(0.25, 6);
  });
});

describe('geoSpec (couple unité bloc / unité article)', () => {
  it('bloc m² : épaisseur pour t et m³, densité pour t — jamais de largeur', () => {
    expect(geoSpec('m²', 't')).toEqual({ needsLargeur: false, needsEpaisseur: true, needsDensity: true });
    expect(geoSpec('m²', 'm³')).toEqual({ needsLargeur: false, needsEpaisseur: true, needsDensity: false });
    expect(geoSpec('m²', 'm²')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: false });
    expect(geoSpec('m²', 'u')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: false });
  });
  it('bloc ml : largeur + épaisseur pour t/m³, largeur seule pour m²', () => {
    expect(geoSpec('ml', 'm³')).toEqual({ needsLargeur: true, needsEpaisseur: true, needsDensity: false });
    expect(geoSpec('ml', 't')).toEqual({ needsLargeur: true, needsEpaisseur: true, needsDensity: true });
    expect(geoSpec('ml', 'm²')).toEqual({ needsLargeur: true, needsEpaisseur: false, needsDensity: false });
    expect(geoSpec('ml', 'ml')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: false });
  });
  it('bloc m³ : densité seule pour t, rien pour m³ — jamais de largeur', () => {
    expect(geoSpec('m³', 't')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: true });
    expect(geoSpec('m³', 'm³')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: false });
  });
});

// Signature : articleContribution(blocUnit, article, largeur, epaisseur, densite, perte)
describe('articleContribution (bloc m²)', () => {
  it('tonne : prix × épaisseur × densité', () => {
    expect(articleContribution('m²', BPU.a1, 0, 0.3, 2)).toBeCloseTo(7.2, 6);   // 12 × 0.6
    expect(articleContribution('m²', BPU.a2, 0, 0.1, 2.1)).toBeCloseTo(2.94, 6); // 14 × 0.21
  });
  it('m² : prix inchangé (facteur 1)', () => {
    expect(articleContribution('m²', BPU.a3)).toBeCloseTo(3.5, 6);
    expect(articleContribution('m²', BPU.a4)).toBeCloseTo(1.2, 6);
  });
  it('m³ : prix × épaisseur', () => {
    expect(articleContribution('m²', BPU.a5, 0, 0.25)).toBeCloseTo(5, 6); // 20 × 0.25
  });
});

describe('blocUnitPrice', () => {
  it('somme des coûts ramenés = prix au m² du bloc', () => {
    const bloc = {
      name: 'Voirie légère', unit: 'm²',
      articles: [
        { id: 'a1', epaisseur: 0.3, densite: 2 },
        { id: 'a2', epaisseur: 0.1, densite: 2.1 },
        { id: 'a3' },
        { id: 'a4' },
      ],
    };
    expect(blocUnitPrice(bloc, BPU)).toBeCloseTo(14.84, 6); // 7.2 + 2.94 + 3.5 + 1.2
  });
  it('ignore les articles introuvables', () => {
    const bloc = { unit: 'm²', articles: [{ id: 'a3' }, { id: 'zzz' }] };
    expect(blocUnitPrice(bloc, BPU)).toBeCloseTo(3.5, 6);
  });
});

describe('getBlocArticles (rétro-compat)', () => {
  it('lit le nouveau format articles', () => {
    expect(getBlocArticles({ articles: [{ id: 'a1' }] })).toEqual([{ id: 'a1' }]);
  });
  it('convertit l’ancien format articleIds', () => {
    expect(getBlocArticles({ articleIds: ['a1', 'a2'] })).toEqual([
      { id: 'a1', largeur: '', epaisseur: '', densite: '', perte: '' },
      { id: 'a2', largeur: '', epaisseur: '', densite: '', perte: '' },
    ]);
  });
  it('vide par défaut', () => {
    expect(getBlocArticles({})).toEqual([]);
  });
});

// Signature : blocFormulaFactor(blocUnit, articleUnit, largeur, epaisseur, densite, perte)
describe('blocFormulaFactor (bloc m²)', () => {
  it('t → "ép*densité", m³ → "ép", autre → null', () => {
    expect(blocFormulaFactor('m²', 't', 0, 0.3, 2)).toBe('0.3*2');
    expect(blocFormulaFactor('m²', 'm³', 0, 0.25)).toBe('0.25');
    expect(blocFormulaFactor('m²', 'm²')).toBeNull();
  });
});

describe('perte (coefficient % — tous articles)', () => {
  it('facteur = base × (1 + perte/100)', () => {
    expect(blocUnitFactor('m²', 't', 0, 0.3, 2, 5)).toBeCloseTo(0.63, 6);   // 0.6 × 1.05
    expect(blocUnitFactor('m²', 'm³', 0, 0.4, 0, 10)).toBeCloseTo(0.44, 6); // 0.4 × 1.10
    expect(blocUnitFactor('m²', 'm²', 0, 0, 0, 3)).toBeCloseTo(1.03, 6);    // 1 × 1.03 (perte sur m²)
  });
  it('vide / 0 → pas de perte (coef 1)', () => {
    expect(blocUnitFactor('m²', 'm²', 0, 0, 0, '')).toBe(1);
    expect(blocUnitFactor('m²', 't', 0, 0.3, 2, 0)).toBeCloseTo(0.6, 6);
  });
  it('contribution intègre la perte', () => {
    expect(articleContribution('m²', BPU.a1, 0, 0.3, 2, 5)).toBeCloseTo(12 * 0.63, 6); // 7.56
    expect(articleContribution('m²', BPU.a3, 0, 0, 0, 10)).toBeCloseTo(3.5 * 1.1, 6);  // 3.85 (m² + perte)
  });
  it('formule : perte ajoutée comme multiplicateur, même sans base', () => {
    expect(blocFormulaFactor('m²', 't', 0, 0.3, 2, 5)).toBe('0.3*2*1.05');
    expect(blocFormulaFactor('m²', 'm³', 0, 0.4, 0, 10)).toBe('0.4*1.1');
    expect(blocFormulaFactor('m²', 'm²', '', '', '', 5)).toBe('1.05'); // base 1 → seul le coef
    expect(blocFormulaFactor('m²', 'm²', '', '', '', 0)).toBeNull();   // pas de perte → null
  });
  it('blocUnitPrice agrège les pertes', () => {
    const bloc = { unit: 'm²', articles: [
      { id: 'a1', epaisseur: 0.3, densite: 2, perte: 5 },  // 12 × 0.63 = 7.56
      { id: 'a3', perte: 10 },                              // 3.5 × 1.1 = 3.85
    ] };
    expect(blocUnitPrice(bloc, BPU)).toBeCloseTo(7.56 + 3.85, 6);
  });

  it('buildBlocSubChapter : la perte figure dans la formule + le blocFactor', () => {
    const bloc = { name: 'V', unit: 'm²', articles: [
      { id: 'a1', epaisseur: 0.3, densite: 2, perte: 5 }, // t
      { id: 'a3', perte: 10 },                            // m²
    ] };
    const { node } = buildBlocSubChapter(bloc, BPU, []);
    const blocId = node.id;
    const compT = node.children.find(l => l.uid === 'a1');
    const compM2 = node.children.find(l => l.uid === 'a3');
    expect(compT.formula).toBe(`={${blocId}}*0.3*2*1.05`);
    expect(compM2.formula).toBe(`={${blocId}}*1.1`); // base 1 → seul le coef de perte
    expect(compT.blocFactor).toBeCloseTo(0.3 * 2 * 1.05, 6);
  });
});

// ── Bloc linéaire (ml) : tranchée — section = largeur × épaisseur, m² = largeur ──
describe('bloc linéaire (ml) — tranchée', () => {
  const TR = {
    rem: { id: 'rem', designation: 'Remblai',    unit: 'm³', price: 20 },
    gnt: { id: 'gnt', designation: 'GNT',         unit: 't',  price: 12 },
    geo: { id: 'geo', designation: 'Géotextile',  unit: 'm²', price: 2 },
    tuy: { id: 'tuy', designation: 'Tuyau PVC',   unit: 'ml', price: 30 },
  };
  it('m³ : facteur = largeur × épaisseur (× perte)', () => {
    expect(blocUnitFactor('ml', 'm³', 0.6, 0.5)).toBeCloseTo(0.3, 6);   // 0.6 × 0.5 = 0.3 m³/ml
    expect(blocFormulaFactor('ml', 'm³', 0.6, 0.5)).toBe('0.6*0.5');
    expect(articleContribution('ml', TR.rem, 0.6, 0.5)).toBeCloseTo(6, 6); // 20 × 0.3
  });
  it('t : largeur × épaisseur × densité', () => {
    expect(blocUnitFactor('ml', 't', 0.6, 0.2, 2)).toBeCloseTo(0.24, 6); // 0.6 × 0.2 × 2
    expect(blocFormulaFactor('ml', 't', 0.6, 0.2, 2)).toBe('0.6*0.2*2');
  });
  it('m² : facteur = largeur (épaisseur ignorée)', () => {
    expect(blocUnitFactor('ml', 'm²', 1.2)).toBeCloseTo(1.2, 6);        // 1 ml × 1.2 m = 1.2 m²
    expect(blocFormulaFactor('ml', 'm²', 1.2)).toBe('1.2');
    expect(articleContribution('ml', TR.geo, 1.2)).toBeCloseTo(2.4, 6);
  });
  it('ml / u → 1 pour 1 (pas de coef)', () => {
    expect(blocUnitFactor('ml', 'ml', 99, 99)).toBe(1);
    expect(blocFormulaFactor('ml', 'ml', 99, 99)).toBeNull();
  });
  it('prix au ml du bloc = somme des contributions', () => {
    const bloc = { name: 'Tranchée', unit: 'ml', articles: [
      { id: 'rem', largeur: 0.6, epaisseur: 0.5 },             // section 0.3 → 20 × 0.3 = 6
      { id: 'gnt', largeur: 0.6, epaisseur: 0.2, densite: 2 }, // 0.24 → 12 × 0.24 = 2.88
      { id: 'geo', largeur: 1.2 },                             // largeur 1.2 → 2 × 1.2 = 2.4
      { id: 'tuy' },                                           // 1 pour 1 → 30
    ] };
    expect(blocUnitPrice(bloc, TR)).toBeCloseTo(6 + 2.88 + 2.4 + 30, 6); // 41.28
  });
  it('intégration : linéaire saisi → quantités composants', () => {
    const bloc = { name: 'Tranchée', unit: 'ml', articles: [
      { id: 'rem', largeur: 0.6, epaisseur: 0.5 }, { id: 'geo', largeur: 1.2 }, { id: 'tuy' },
    ] };
    const { node } = buildBlocSubChapter(bloc, TR, []);
    node.qty = 80; // 80 ml
    const { updatedChapters } = recalculateProject([{ id: 'c1', type: 'chapter', children: [node] }], []);
    const f = updatedChapters[0].children[0].children;
    expect(f.find(l => l.uid === 'rem').qty).toBeCloseTo(80 * 0.3, 4); // 24 m³
    expect(f.find(l => l.uid === 'geo').qty).toBeCloseTo(80 * 1.2, 4); // 96 m²
    expect(f.find(l => l.uid === 'tuy').qty).toBeCloseTo(80, 4);       // 80 ml
  });
  it('perte combinée à la géométrie (ml)', () => {
    expect(blocUnitFactor('ml', 't', 0.6, 0.2, 2, 5)).toBeCloseTo(0.252, 6);   // 0.24 × 1.05
    expect(blocFormulaFactor('ml', 't', 0.6, 0.2, 2, 5)).toBe('0.6*0.2*2*1.05');
    expect(blocUnitFactor('ml', 'm³', 0.6, 0.5, 0, 10)).toBeCloseTo(0.33, 6);  // 0.3 × 1.10
    expect(blocFormulaFactor('ml', 'm³', 0.6, 0.5, 0, 10)).toBe('0.6*0.5*1.1');
    expect(blocUnitFactor('ml', 'm²', 1.2, 0, 0, 5)).toBeCloseTo(1.26, 6);     // 1.2 × 1.05
    expect(blocFormulaFactor('ml', 'm²', 1.2, 0, 0, 5)).toBe('1.2*1.05');
  });
  it('intégration : la perte se propage jusqu\'à la quantité résolue (ml)', () => {
    const bloc = { name: 'Tranchée', unit: 'ml', articles: [
      { id: 'rem', largeur: 0.6, epaisseur: 0.5, perte: 5 },              // 0.3 × 1.05
      { id: 'gnt', largeur: 0.6, epaisseur: 0.2, densite: 2, perte: 10 }, // 0.24 × 1.10
    ] };
    const { node } = buildBlocSubChapter(bloc, TR, []);
    node.qty = 80;
    const { updatedChapters } = recalculateProject([{ id: 'c1', type: 'chapter', children: [node] }], []);
    const f = updatedChapters[0].children[0].children;
    expect(f.find(l => l.uid === 'rem').qty).toBeCloseTo(80 * 0.3 * 1.05, 4);  // 25.2
    expect(f.find(l => l.uid === 'gnt').qty).toBeCloseTo(80 * 0.24 * 1.10, 4); // 21.12
  });
  it('intégration AVEC tranches (ml) : quantité par tranche + somme globale', () => {
    const bloc = { name: 'Tranchée', unit: 'ml', articles: [{ id: 'rem', largeur: 0.6, epaisseur: 0.5 }] };
    const tranches = [{ id: 't1' }, { id: 't2' }];
    const { node } = buildBlocSubChapter(bloc, TR, tranches);
    node.quantities = { t1: 80, t2: 20 };
    const { updatedChapters } = recalculateProject([{ id: 'c1', type: 'chapter', children: [node] }], tranches);
    const blocNode = updatedChapters[0].children[0];
    expect(blocNode.qty).toBeCloseTo(100, 4); // somme des tranches
    const rem = blocNode.children.find(l => l.uid === 'rem');
    expect(rem.quantities.t1).toBeCloseTo(80 * 0.3, 4); // 24
    expect(rem.quantities.t2).toBeCloseTo(20 * 0.3, 4); // 6
    expect(rem.qty).toBeCloseTo(100 * 0.3, 4);          // 30
  });
});

// ── Bloc volumique (m³) : déblais — densité seule pour les tonnes ──
describe('bloc volumique (m³) — déblais', () => {
  const V = {
    deb: { id: 'deb', designation: 'Déblais',    unit: 'm³', price: 8 },
    eva: { id: 'eva', designation: 'Évacuation', unit: 't',  price: 15 },
  };
  it('m³ → 1 pour 1 (volume direct)', () => {
    expect(blocUnitFactor('m³', 'm³', 0, 0)).toBe(1);
    expect(blocFormulaFactor('m³', 'm³')).toBeNull();
    expect(articleContribution('m³', V.deb)).toBeCloseTo(8, 6);
  });
  it('t → densité seule (pas de géométrie)', () => {
    expect(blocUnitFactor('m³', 't', 0, 0, 1.8)).toBeCloseTo(1.8, 6);
    expect(blocFormulaFactor('m³', 't', 0, 0, 1.8)).toBe('1.8');
    expect(articleContribution('m³', V.eva, 0, 0, 1.8)).toBeCloseTo(27, 6); // 15 × 1.8
  });
  it('m² / ml / u → 1 pour 1 (largeur & épaisseur ignorées)', () => {
    expect(blocUnitFactor('m³', 'm²', 99, 0.5, 9)).toBe(1); // largeur & épaisseur ignorées
    expect(blocFormulaFactor('m³', 'm²', 99, 0.5)).toBeNull();
    expect(blocUnitFactor('m³', 'ml', 5, 5, 5)).toBe(1);
    expect(blocUnitFactor('m³', 'u')).toBe(1);
    expect(blocFormulaFactor('m³', 'ml')).toBeNull();
    expect(articleContribution('m³', { id: 'x', unit: 'm²', price: 7 }, 99, 0.5)).toBeCloseTo(7, 6);
    expect(geoSpec('m³', 'm²')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: false });
    expect(geoSpec('m³', 'ml')).toEqual({ needsLargeur: false, needsEpaisseur: false, needsDensity: false });
  });
  it('perte combinée à la densité (m³)', () => {
    expect(blocUnitFactor('m³', 't', 0, 0, 1.8, 10)).toBeCloseTo(1.98, 6); // 1.8 × 1.10
    expect(blocFormulaFactor('m³', 't', 0, 0, 1.8, 10)).toBe('1.8*1.1');
  });
  it('intégration : volume saisi → quantités', () => {
    const bloc = { name: 'Déblais', unit: 'm³', articles: [
      { id: 'deb' }, { id: 'eva', densite: 1.8 },
    ] };
    const { node } = buildBlocSubChapter(bloc, V, []);
    node.qty = 200; // 200 m³
    const { updatedChapters } = recalculateProject([{ id: 'c1', type: 'chapter', children: [node] }], []);
    const f = updatedChapters[0].children[0].children;
    expect(f.find(l => l.uid === 'deb').qty).toBeCloseTo(200, 4);       // 200 m³
    expect(f.find(l => l.uid === 'eva').qty).toBeCloseTo(200 * 1.8, 4); // 360 t
  });
});

describe('buildBlocSubChapter', () => {
  const bloc = {
    name: 'Voirie légère en granulaire', unit: 'm²',
    articles: [
      { id: 'a1', epaisseur: 0.3, densite: 2 },   // t
      { id: 'a3' },                                // m²
      { id: 'zzz' },                               // introuvable
    ],
  };

  it('crée un sous-chapitre bloc + N composants trouvés, compte les manquants', () => {
    const { node, added, missing } = buildBlocSubChapter(bloc, BPU, []);
    expect(added).toBe(2);
    expect(missing).toBe(1);
    expect(node.type).toBe('chapter');
    expect(node.isBloc).toBe(true);
    expect(node.children).toHaveLength(2);
  });

  it('le sous-chapitre porte le nom du bloc + unité, qté 0, pas de prix', () => {
    const { node } = buildBlocSubChapter(bloc, BPU, []);
    expect(node.title).toBe('Voirie légère en granulaire');
    expect(node.unit).toBe('m²');
    expect(node.qty).toBe(0);
    expect(node.price).toBeUndefined(); // un chapitre n'a pas de prix
  });

  it('les composants référencent le sous-chapitre via {id} × facteur', () => {
    const { node } = buildBlocSubChapter(bloc, BPU, []);
    const blocId = node.id;
    const compT = node.children.find(l => l.uid === 'a1');
    const compM2 = node.children.find(l => l.uid === 'a3');
    expect(compT.formula).toBe(`={${blocId}}*0.3*2`);
    expect(compT.price).toBe(12);
    expect(compM2.formula).toBe(`={${blocId}}`); // facteur 1 → pas de multiplicateur
  });

  it('propage la formule sur chaque tranche', () => {
    const tranches = [{ id: 't1' }, { id: 't2' }];
    const { node } = buildBlocSubChapter(bloc, BPU, tranches);
    const blocId = node.id;
    const compT = node.children.find(l => l.uid === 'a1');
    expect(compT.quantitiesFormula).toEqual({
      t1: `={${blocId}}*0.3*2`,
      t2: `={${blocId}}*0.3*2`,
    });
  });
});

// ── Intégration : la surface saisie sur le sous-chapitre propage les quantités ──
describe('intégration buildBlocSubChapter → recalculateProject', () => {
  const PRICED = {
    a1: { id: 'a1', designation: 'Bétons 0/10', unit: 't',  price: 135 }, // T
    a3: { id: 'a3', designation: 'Enduit',      unit: 'm²', price: 3.5 }, // m²
    a5: { id: 'a5', designation: 'GNT 0/80',    unit: 'm³', price: 50 },  // m³
  };
  const bloc = {
    name: 'Voirie', unit: 'm²',
    articles: [
      { id: 'a1', epaisseur: 0.06, densite: 2.45 }, // facteur 0.147
      { id: 'a3' },                                 // facteur 1
      { id: 'a5', epaisseur: 0.4 },                 // facteur 0.4
    ],
  };
  // Le bloc est un sous-chapitre, inséré dans un chapitre parent.
  const wrap = (node) => [{ id: 'c1', type: 'chapter', children: [node] }];
  const comps = (chapters) => chapters[0].children[0].children;

  it('projet SANS tranches : qty composant = surface × facteur', () => {
    const { node } = buildBlocSubChapter(bloc, PRICED, []);
    node.qty = 250; // surface saisie sur l'en-tête du bloc
    const { updatedChapters } = recalculateProject(wrap(node), []);
    const f = comps(updatedChapters);
    expect(f.find(l => l.uid === 'a1').qty).toBeCloseTo(250 * 0.06 * 2.45, 4); // 36.75
    expect(f.find(l => l.uid === 'a3').qty).toBeCloseTo(250, 4);
    expect(f.find(l => l.uid === 'a5').qty).toBeCloseTo(100, 4);              // 250 × 0.4
  });

  it('projet AVEC tranches : quantité par tranche + somme globale + surface bloc sommée', () => {
    const tranches = [{ id: 't1' }, { id: 't2' }];
    const { node } = buildBlocSubChapter(bloc, PRICED, tranches);
    node.quantities = { t1: 250, t2: 100 }; // surface par tranche sur l'en-tête
    const { updatedChapters } = recalculateProject(wrap(node), tranches);
    const blocNode = updatedChapters[0].children[0];
    expect(blocNode.qty).toBeCloseTo(350, 4); // surface globale = somme des tranches
    const bb = blocNode.children.find(l => l.uid === 'a1');
    expect(bb.quantities.t1).toBeCloseTo(250 * 0.147, 4); // 36.75
    expect(bb.quantities.t2).toBeCloseTo(100 * 0.147, 4); // 14.70
    expect(bb.qty).toBeCloseTo(350 * 0.147, 4);           // somme = 51.45
  });
});

// ── Bloc AGRÉGAT : simple regroupement d'articles, sans calcul ni formule ──
describe('bloc agrégat (sans formule)', () => {
  it('getBlocKind : formula par défaut, aggregate si kind explicite', () => {
    expect(getBlocKind({})).toBe('formula');
    expect(getBlocKind({ kind: 'formula' })).toBe('formula');
    expect(getBlocKind({ kind: 'aggregate' })).toBe('aggregate');
  });

  it('buildBlocSubChapter route un agrégat vers un sous-chapitre NORMAL (pas isBloc)', () => {
    const bloc = { name: 'Regard complet', kind: 'aggregate', articles: [{ id: 'a3' }, { id: 'a5' }] };
    const { node, added, missing } = buildBlocSubChapter(bloc, BPU, []);
    expect(added).toBe(2);
    expect(missing).toBe(0);
    expect(node.type).toBe('chapter');
    expect(node.isBloc).toBeUndefined(); // pas de surface pilote
    expect(node.title).toBe('Regard complet');
    node.children.forEach(c => {
      expect(c.type).toBe('item');
      expect(c.qty).toBe(0);             // quantité vide à saisir
      expect(c.formula).toBeUndefined(); // aucune formule
      expect(c.quantitiesFormula).toEqual({});
    });
    expect(node.children.map(c => c.uid)).toEqual(['a3', 'a5']);
    expect(node.children[0].unit).toBe('m²');
    expect(node.children[0].price).toBe(3.5);
  });

  it('buildAggregateSubChapter compte les articles introuvables', () => {
    const bloc = { name: 'X', kind: 'aggregate', articles: [{ id: 'a3' }, { id: 'zzz' }] };
    const { added, missing } = buildAggregateSubChapter(bloc, BPU);
    expect(added).toBe(1);
    expect(missing).toBe(1);
  });

  it('intégration : un agrégat inséré ne propage aucune quantité (lignes indépendantes)', () => {
    const bloc = { name: 'Agg', kind: 'aggregate', articles: [{ id: 'a3' }, { id: 'a5' }] };
    const { node } = buildBlocSubChapter(bloc, BPU, []);
    const { updatedChapters } = recalculateProject([{ id: 'c1', type: 'chapter', children: [node] }], []);
    updatedChapters[0].children[0].children.forEach(c => expect(c.qty).toBe(0));
  });
});

// ── Blocs imbriqués : un agrégat peut contenir d'autres blocs (templates) ──
describe('blocs imbriqués (agrégat ⊃ blocs)', () => {
  // Sous-blocs feuilles (m² → facteur 1, prix lisibles)
  const voirie = { id: 'b_voirie', name: 'Voirie', kind: 'aggregate', articles: [{ id: 'a3' }, { id: 'a4' }] }; // 3.5 + 1.2
  const assain = { id: 'b_assain', name: 'Assainissement', kind: 'aggregate', articles: [{ id: 'a4' }] };       // 1.2
  // Template Lotissement = agrégat de sous-blocs + un article direct
  const lotissement = {
    id: 'b_lot', name: 'Lotissement', kind: 'aggregate',
    articles: [{ ref: 'bloc', id: 'b_voirie' }, { ref: 'bloc', id: 'b_assain' }, { id: 'a3' }],
  };
  const blocsById = { b_voirie: voirie, b_assain: assain, b_lot: lotissement };

  it('isBlocRef distingue un sous-bloc d\'un article', () => {
    expect(isBlocRef({ ref: 'bloc', id: 'x' })).toBe(true);
    expect(isBlocRef({ id: 'a3' })).toBe(false);
  });

  it('matérialise une structure imbriquée (sous-chapitres + ligne directe)', () => {
    const { node, added, missing } = buildBlocSubChapter(lotissement, BPU, [], blocsById);
    expect(missing).toBe(0);
    expect(added).toBe(4); // a3+a4 (voirie) + a4 (assain) + a3 (direct)
    expect(node.title).toBe('Lotissement');
    expect(node.children).toHaveLength(3);
    const [cVoirie, cAssain, lineDirect] = node.children;
    expect(cVoirie.type).toBe('chapter');
    expect(cVoirie.isBloc).toBeUndefined();
    expect(cVoirie.title).toBe('Voirie');
    expect(cVoirie.children.map(c => c.uid)).toEqual(['a3', 'a4']);
    expect(cAssain.children.map(c => c.uid)).toEqual(['a4']);
    expect(lineDirect.type).toBe('item');
    expect(lineDirect.uid).toBe('a3');
  });

  it('blocUnitPrice est récursif (somme des sous-blocs + article direct)', () => {
    expect(blocUnitPrice(lotissement, BPU, blocsById)).toBeCloseTo(4.7 + 1.2 + 3.5, 6); // 9.4
  });

  it('garde anti-cycle : un bloc se référençant lui-même ne boucle pas', () => {
    const self = { id: 'b_self', name: 'Self', kind: 'aggregate', articles: [{ ref: 'bloc', id: 'b_self' }, { id: 'a3' }] };
    const { node, added, missing } = buildBlocSubChapter(self, BPU, [], { b_self: self });
    expect(added).toBe(1);
    expect(missing).toBe(1);
    expect(node.children.map(c => c.uid)).toEqual(['a3']);
    // blocUnitPrice ne boucle pas non plus
    expect(blocUnitPrice(self, BPU, { b_self: self })).toBeCloseTo(3.5, 6);
  });

  it('garde anti-cycle : A ⊂ B ⊂ A ne boucle pas', () => {
    const A = { id: 'A', name: 'A', kind: 'aggregate', articles: [{ ref: 'bloc', id: 'B' }, { id: 'a3' }] };
    const B = { id: 'B', name: 'B', kind: 'aggregate', articles: [{ ref: 'bloc', id: 'A' }, { id: 'a4' }] };
    const { added, missing } = buildBlocSubChapter(A, BPU, [], { A, B });
    expect(added).toBe(2);   // a4 (dans B) + a3 (dans A) ; la réf B→A est bloquée
    expect(missing).toBe(1);
  });

  it('bloc enfant introuvable → compté manquant', () => {
    const lot = { id: 'L', name: 'L', kind: 'aggregate', articles: [{ ref: 'bloc', id: 'inconnu' }, { id: 'a3' }] };
    const { added, missing } = buildBlocSubChapter(lot, BPU, [], { L: lot });
    expect(added).toBe(1);
    expect(missing).toBe(1);
  });

  it('agrégat ⊃ bloc FORMULE : le sous-bloc garde sa surface pilote + formules, et recalcule', () => {
    const voirieF = { id: 'b_voirieF', name: 'Voirie', kind: 'formula', unit: 'm²', articles: [{ id: 'a1', epaisseur: 0.3, densite: 2 }] };
    const lot = { id: 'b_lot2', name: 'Lot', kind: 'aggregate', articles: [{ ref: 'bloc', id: 'b_voirieF' }, { id: 'a3' }] };
    const { node, added } = buildBlocSubChapter(lot, BPU, [], { b_voirieF: voirieF, b_lot2: lot });
    expect(added).toBe(2);
    const voirieNode = node.children[0];
    expect(voirieNode.isBloc).toBe(true);          // sous-bloc formule = surface pilote conservée
    expect(voirieNode.unit).toBe('m²');
    expect(voirieNode.children[0].formula).toBe(`={${voirieNode.id}}*0.3*2`);

    voirieNode.qty = 100; // surface saisie sur l'en-tête du sous-bloc
    const { updatedChapters } = recalculateProject([{ id: 'c1', type: 'chapter', children: [node] }], []);
    const lotNode = updatedChapters[0].children[0]; // sous-chapitre « Lot »
    const v = lotNode.children[0];                  // sous-bloc « Voirie » (isBloc)
    expect(v.children.find(l => l.uid === 'a1').qty).toBeCloseTo(100 * 0.6, 6); // 60
    expect(lotNode.children.find(l => l.uid === 'a3').qty).toBe(0);             // article direct = manuel
  });
});
