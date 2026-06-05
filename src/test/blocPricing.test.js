import { describe, it, expect } from 'vitest';
import {
  blocUnitFactor, articleContribution, blocUnitPrice, getBlocArticles,
  needsThickness, needsDensity, blocFormulaFactor, buildBlocSubChapter,
  buildAggregateSubChapter, getBlocKind,
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

describe('blocUnitFactor', () => {
  it('tonne → épaisseur × densité', () => {
    expect(blocUnitFactor('t', 0.3, 2)).toBeCloseTo(0.6, 6);
    expect(blocUnitFactor('T', 0.1, 2.1)).toBeCloseTo(0.21, 6);
  });
  it('m³ → épaisseur (densité ignorée)', () => {
    expect(blocUnitFactor('m³', 0.25, 999)).toBeCloseTo(0.25, 6);
    expect(blocUnitFactor('m3', 0.4)).toBeCloseTo(0.4, 6);
  });
  it('autre unité → 1', () => {
    expect(blocUnitFactor('m²', 0.3, 2)).toBe(1);
    expect(blocUnitFactor('ml', 5, 5)).toBe(1);
    expect(blocUnitFactor('u')).toBe(1);
  });
  it('valeurs manquantes → 0 pour les unités à conversion', () => {
    expect(blocUnitFactor('t', '', '')).toBe(0);
    expect(blocUnitFactor('t', 0.3, '')).toBe(0);
  });
});

describe('needsThickness / needsDensity', () => {
  it('épaisseur requise pour t et m³, pas pour m²/ml/u', () => {
    expect(needsThickness('t')).toBe(true);
    expect(needsThickness('m³')).toBe(true);
    expect(needsThickness('m²')).toBe(false);
    expect(needsThickness('u')).toBe(false);
  });
  it('densité requise pour t uniquement', () => {
    expect(needsDensity('t')).toBe(true);
    expect(needsDensity('m³')).toBe(false);
    expect(needsDensity('m²')).toBe(false);
  });
});

describe('articleContribution', () => {
  it('tonne : prix × épaisseur × densité', () => {
    expect(articleContribution(BPU.a1, 0.3, 2)).toBeCloseTo(7.2, 6);   // 12 × 0.6
    expect(articleContribution(BPU.a2, 0.1, 2.1)).toBeCloseTo(2.94, 6); // 14 × 0.21
  });
  it('m² : prix inchangé (facteur 1)', () => {
    expect(articleContribution(BPU.a3)).toBeCloseTo(3.5, 6);
    expect(articleContribution(BPU.a4)).toBeCloseTo(1.2, 6);
  });
  it('m³ : prix × épaisseur', () => {
    expect(articleContribution(BPU.a5, 0.25)).toBeCloseTo(5, 6); // 20 × 0.25
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
      { id: 'a1', epaisseur: '', densite: '', perte: '' },
      { id: 'a2', epaisseur: '', densite: '', perte: '' },
    ]);
  });
  it('vide par défaut', () => {
    expect(getBlocArticles({})).toEqual([]);
  });
});

describe('blocFormulaFactor', () => {
  it('t → "ép*densité", m³ → "ép", autre → null', () => {
    expect(blocFormulaFactor('t', 0.3, 2)).toBe('0.3*2');
    expect(blocFormulaFactor('m³', 0.25)).toBe('0.25');
    expect(blocFormulaFactor('m²')).toBeNull();
  });
});

describe('perte (coefficient % — tous articles)', () => {
  it('facteur = base × (1 + perte/100)', () => {
    expect(blocUnitFactor('t', 0.3, 2, 5)).toBeCloseTo(0.63, 6);   // 0.6 × 1.05
    expect(blocUnitFactor('m³', 0.4, 0, 10)).toBeCloseTo(0.44, 6); // 0.4 × 1.10
    expect(blocUnitFactor('m²', 0, 0, 3)).toBeCloseTo(1.03, 6);    // 1 × 1.03 (perte sur m²)
  });
  it('vide / 0 → pas de perte (coef 1)', () => {
    expect(blocUnitFactor('m²', 0, 0, '')).toBe(1);
    expect(blocUnitFactor('t', 0.3, 2, 0)).toBeCloseTo(0.6, 6);
  });
  it('contribution intègre la perte', () => {
    expect(articleContribution(BPU.a1, 0.3, 2, 5)).toBeCloseTo(12 * 0.63, 6); // 7.56
    expect(articleContribution(BPU.a3, 0, 0, 10)).toBeCloseTo(3.5 * 1.1, 6);  // 3.85 (m² + perte)
  });
  it('formule : perte ajoutée comme multiplicateur, même sans base', () => {
    expect(blocFormulaFactor('t', 0.3, 2, 5)).toBe('0.3*2*1.05');
    expect(blocFormulaFactor('m³', 0.4, 0, 10)).toBe('0.4*1.1');
    expect(blocFormulaFactor('m²', '', '', 5)).toBe('1.05'); // base 1 → seul le coef
    expect(blocFormulaFactor('m²', '', '', 0)).toBeNull();   // pas de perte → null
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
