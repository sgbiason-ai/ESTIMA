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
