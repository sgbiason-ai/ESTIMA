import { describe, it, expect } from 'vitest';
import {
  analyzeChapters,
  computeItemDiff,
  mergeChapters,
  buildComparison,
  computeChapterTotal,
  countChapterItems,
} from '../utils/archiveDiff';

// ─── Fixtures ────────────────────────────────────────────────────────
const item = (over = {}) => ({
  type: 'item',
  id: `line_${Math.random().toString(36).slice(2)}`,
  uid: 'U1',
  designation: 'Article',
  unit: 'm3',
  qty: 1,
  price: 100,
  isOption: false,
  ...over,
});

const chapter = (title, children = []) => ({ type: 'chapter', id: `c_${title}`, title, children });

describe('analyzeChapters', () => {
  it('aplatit articles + chapitres et calcule le total HT (hors options)', () => {
    const chapters = [
      chapter('Terrassement', [
        item({ uid: 'A', qty: 2, price: 50 }), // 100
        item({ uid: 'B', qty: 3, price: 10, isOption: true }), // option → exclue
      ]),
      chapter('Voirie', [item({ uid: 'C', qty: 1, price: 250 })]), // 250
    ];
    const res = analyzeChapters(chapters);
    expect(res.totalHT).toBe(350);
    expect(res.itemCount).toBe(2); // options exclues du compteur
    expect(res.items).toHaveLength(3);
    expect(res.chapters).toHaveLength(2);
  });

  it('gère un arbre vide', () => {
    const res = analyzeChapters([]);
    expect(res.totalHT).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('parcourt les sous-chapitres récursivement', () => {
    const chapters = [
      chapter('Parent', [
        item({ uid: 'A', qty: 1, price: 100 }),
        chapter('Enfant', [item({ uid: 'B', qty: 2, price: 100 })]),
      ]),
    ];
    const res = analyzeChapters(chapters);
    expect(res.totalHT).toBe(300);
    expect(res.itemCount).toBe(2);
  });
});

describe('computeChapterTotal / countChapterItems', () => {
  it('total exclut les options, compteur les inclut', () => {
    const chap = chapter('X', [
      item({ qty: 2, price: 100 }), // 200
      item({ qty: 5, price: 100, isOption: true }), // option
    ]);
    expect(computeChapterTotal(chap)).toBe(200);
    expect(countChapterItems(chap)).toBe(2);
  });
});

describe('computeItemDiff', () => {
  const source = analyzeChapters([
    chapter('C', [
      item({ uid: 'A', qty: 1, price: 100 }),
      item({ uid: 'B', qty: 2, price: 50 }),
    ]),
  ]);

  it('détecte un article ajouté', () => {
    const target = analyzeChapters([
      chapter('C', [
        item({ uid: 'A', qty: 1, price: 100 }),
        item({ uid: 'B', qty: 2, price: 50 }),
        item({ uid: 'C', qty: 1, price: 999 }),
      ]),
    ]);
    const diff = computeItemDiff(source, target);
    expect(diff.added.map((i) => i.uid)).toEqual(['C']);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('détecte un article supprimé', () => {
    const target = analyzeChapters([chapter('C', [item({ uid: 'A', qty: 1, price: 100 })])]);
    const diff = computeItemDiff(source, target);
    expect(diff.removed.map((i) => i.uid)).toEqual(['B']);
    expect(diff.added).toHaveLength(0);
  });

  it('détecte un changement de quantité avec écart de montant signé', () => {
    const target = analyzeChapters([
      chapter('C', [
        item({ uid: 'A', qty: 3, price: 100 }), // 100 → 300
        item({ uid: 'B', qty: 2, price: 50 }),
      ]),
    ]);
    const diff = computeItemDiff(source, target);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].source.uid).toBe('A');
    expect(diff.changed[0].diff).toBe(200);
  });

  it('détecte un changement de prix', () => {
    const target = analyzeChapters([
      chapter('C', [
        item({ uid: 'A', qty: 1, price: 100 }),
        item({ uid: 'B', qty: 2, price: 75 }), // 100 → 150
      ]),
    ]);
    const diff = computeItemDiff(source, target);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].diff).toBe(50);
  });

  it('aucune différence → listes vides', () => {
    const diff = computeItemDiff(source, source);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('retourne des listes vides si une donnée manque', () => {
    expect(computeItemDiff(null, source)).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe('mergeChapters', () => {
  it('apparie par titre et garde les chapitres orphelins', () => {
    const a = [{ title: 'Commun', total: 100 }, { title: 'SourceSeul', total: 50 }];
    const b = [{ title: 'Commun', total: 120 }, { title: 'TargetSeul', total: 80 }];
    const merged = mergeChapters(a, b);
    const commun = merged.find((m) => m.title === 'Commun');
    expect(commun.source.total).toBe(100);
    expect(commun.target.total).toBe(120);
    expect(merged.find((m) => m.title === 'SourceSeul').target).toBeNull();
    expect(merged.find((m) => m.title === 'TargetSeul').source).toBeNull();
  });
});

describe('buildComparison', () => {
  it('produit une synthèse complète avec écart total et %', () => {
    const src = [chapter('C', [item({ uid: 'A', qty: 1, price: 100 })])];
    const tgt = [chapter('C', [item({ uid: 'A', qty: 1, price: 150 })])];
    const cmp = buildComparison(src, tgt);
    expect(cmp.source.totalHT).toBe(100);
    expect(cmp.target.totalHT).toBe(150);
    expect(cmp.totalDiff).toBe(50);
    expect(cmp.totalDiffPct).toBeCloseTo(50);
    expect(cmp.hasChanges).toBe(true);
    expect(cmp.items.changed).toHaveLength(1);
  });

  it('hasChanges=false si versions identiques', () => {
    const src = [chapter('C', [item({ uid: 'A', qty: 1, price: 100 })])];
    const cmp = buildComparison(src, src);
    expect(cmp.hasChanges).toBe(false);
    expect(cmp.totalDiff).toBe(0);
    expect(cmp.totalDiffPct).toBe(0);
  });
});

describe('décomposition qté/prix (computeItemDiff)', () => {
  it('sépare effet quantité et effet prix, somme = écart total', () => {
    // source : 10 × 100 = 1000 ; cible : 12 × 110 = 1320 ; écart = 320
    const src = analyzeChapters([chapter('C', [item({ uid: 'A', qty: 10, price: 100 })])]);
    const tgt = analyzeChapters([chapter('C', [item({ uid: 'A', qty: 12, price: 110 })])]);
    const { changed } = computeItemDiff(src, tgt);
    expect(changed).toHaveLength(1);
    const c = changed[0];
    // effet qté = (12-10)*100 = 200 ; effet prix = (110-100)*12 = 120
    expect(c.qtyEffect).toBe(200);
    expect(c.priceEffect).toBe(120);
    expect(c.qtyEffect + c.priceEffect).toBe(c.diff);
    expect(c.diff).toBe(320);
    expect(c.qtyChanged).toBe(true);
    expect(c.priceChanged).toBe(true);
  });

  it('changement de prix seul : effet quantité nul', () => {
    const src = analyzeChapters([chapter('C', [item({ uid: 'A', qty: 5, price: 100 })])]);
    const tgt = analyzeChapters([chapter('C', [item({ uid: 'A', qty: 5, price: 120 })])]);
    const c = computeItemDiff(src, tgt).changed[0];
    expect(c.qtyEffect).toBe(0);
    expect(c.priceEffect).toBe(100);
    expect(c.qtyChanged).toBe(false);
    expect(c.priceChanged).toBe(true);
  });
});

describe('waterfall + tri par impact (buildComparison)', () => {
  const src = [
    chapter('C', [
      item({ uid: 'A', qty: 10, price: 100 }), // 1000
      item({ uid: 'B', qty: 1, price: 500 }),  // 500 (sera supprimé)
      item({ uid: 'C', qty: 2, price: 50 }),   // 100
    ]),
  ];
  const tgt = [
    chapter('C', [
      item({ uid: 'A', qty: 12, price: 100 }), // 1200 (+200)
      item({ uid: 'C', qty: 2, price: 80 }),   // 160 (+60)
      item({ uid: 'D', qty: 1, price: 300 }),  // 300 (ajouté)
    ]),
  ];

  it('waterfall : start + added + removed + changed = end', () => {
    const { waterfall } = buildComparison(src, tgt);
    expect(waterfall.start).toBe(1600);
    expect(waterfall.added).toBe(300);
    expect(waterfall.removed).toBe(-500);
    expect(waterfall.changed).toBe(260); // +200 (A) +60 (C)
    expect(waterfall.start + waterfall.added + waterfall.removed + waterfall.changed)
      .toBe(waterfall.end);
    expect(waterfall.end).toBe(1660);
  });

  it('waterfall : qtyEffect + priceEffect = changed', () => {
    const { waterfall } = buildComparison(src, tgt);
    // A : Δqté → 200 ; C : Δprix → (80-50)*2 = 60
    expect(waterfall.qtyEffect).toBe(200);
    expect(waterfall.priceEffect).toBe(60);
    expect(waterfall.qtyEffect + waterfall.priceEffect).toBe(waterfall.changed);
  });

  it('changedByImpact trié par écart absolu décroissant', () => {
    const { items } = buildComparison(src, tgt);
    const impacts = items.changedByImpact.map((c) => Math.abs(c.diff));
    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
    expect(items.changedByImpact[0].source.uid).toBe('A'); // +200 en tête
  });
});

describe('analyzeChapters avec qtyMap (tranches)', () => {
  it('utilise les quantités de la map au lieu de node.qty', () => {
    const chapters = [chapter('C', [item({ id: 'i1', uid: 'A', qty: 0, price: 100 })])];
    const res = analyzeChapters(chapters, { i1: 7 });
    expect(res.totalHT).toBe(700);
    expect(res.items[0].qty).toBe(7);
  });

  it('buildComparison compare deux tranches via maps', () => {
    const chapters = [chapter('C', [item({ id: 'i1', uid: 'A', qty: 0, price: 100 })])];
    const cmp = buildComparison(chapters, chapters, { sourceQtyMap: { i1: 5 }, targetQtyMap: { i1: 8 } });
    expect(cmp.source.totalHT).toBe(500);
    expect(cmp.target.totalHT).toBe(800);
    expect(cmp.totalDiff).toBe(300);
  });
});
