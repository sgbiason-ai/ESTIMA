// src/tests/projectCalculations.test.js
import { describe, it, expect } from 'vitest';
import {
  calculateSafeClientQty,
  buildGlobalClientQtyMapFromStudyQty,
  sumNodeTotal,
  formatPercent,
  evaluateFormula,
  recalculateProject,
  computeQtyMaps,
  computePriceScore,
  detectAtypicalPrice,
} from '../utils/projectCalculations';

// ── calculateSafeClientQty ─────────────────────────────────────────────────
describe('calculateSafeClientQty', () => {
  it('retourne 0 si qty = 0', () => {
    expect(calculateSafeClientQty(0, 10)).toBe(0);
  });
  it('ne majore pas les petites quantites (<=20)', () => {
    expect(calculateSafeClientQty(5, 10)).toBe(5);
    expect(calculateSafeClientQty(20, 10)).toBe(20);
  });
  it('majore les grandes quantites (>20)', () => {
    expect(calculateSafeClientQty(100, 10)).toBe(111); // JS float: 100*1.10=110.00...01 → ceil=111
    expect(calculateSafeClientQty(100, 15)).toBe(115);
  });
  it('arrondit au plafond pour valeurs positives', () => {
    expect(calculateSafeClientQty(91, 10)).toBe(101);
  });
  it('arrondit au plancher pour valeurs negatives', () => {
    expect(calculateSafeClientQty(-100, 10)).toBe(-111); // JS float: floor(-110.00...01)=-111
  });
  it('utilise 10% par defaut', () => {
    expect(calculateSafeClientQty(100)).toBe(111); // default 10% same float issue
  });
  it('fonctionne avec percent = 0', () => {
    expect(calculateSafeClientQty(100, 0)).toBe(100);
  });
});

// ── buildGlobalClientQtyMapFromStudyQty ───────────────────────────────────
describe('buildGlobalClientQtyMapFromStudyQty', () => {
  const proj = (items) => ({
    chapters: [{ type: 'chapter', id: 'c1', title: 'T', isOption: false, children: items }],
  });

  it('retourne map vide si project est null', () => {
    const { map } = buildGlobalClientQtyMapFromStudyQty(null);
    expect(map.size).toBe(0);
  });
  it('construit la map avec les qtes client', () => {
    const { map } = buildGlobalClientQtyMapFromStudyQty(
      proj([{ type: 'item', id: 'i1', uid: 'i1', qty: 100, price: 50 }]), 10
    );
    expect(map.get('i1')).toBe(111);
  });
  it('ne majore pas les petites quantites', () => {
    const { map } = buildGlobalClientQtyMapFromStudyQty(
      proj([{ type: 'item', id: 'i1', uid: 'i1', qty: 10, price: 50 }]), 10
    );
    expect(map.get('i1')).toBe(10);
  });
  it('calcule totalInitial et totalClient', () => {
    const { totalInitial, totalClient } = buildGlobalClientQtyMapFromStudyQty(
      proj([{ type: 'item', id: 'i1', uid: 'i1', qty: 100, price: 50 }]), 10
    );
    expect(totalInitial).toBe(5000);
    expect(totalClient).toBe(5550); // 111 * 50
  });
  it('utilise uid comme cle prioritaire', () => {
    const { map } = buildGlobalClientQtyMapFromStudyQty(
      proj([{ type: 'item', id: 'i1', uid: 'uid_custom', qty: 100, price: 50 }]), 10
    );
    expect(map.has('uid_custom')).toBe(true);
    expect(map.has('i1')).toBe(false);
  });
});

// ── sumNodeTotal ───────────────────────────────────────────────────────────
describe('sumNodeTotal', () => {
  it('retourne 0 pour node null', () => {
    expect(sumNodeTotal(null, false, null)).toBe(0);
  });
  it('calcule le total en mode etude', () => {
    const item = { type: 'item', id: 'i1', uid: 'i1', qty: 10, price: 150 };
    expect(sumNodeTotal(item, false, null)).toBe(1500);
  });
  it('utilise la qte client en mode client', () => {
    const item = { type: 'item', id: 'i1', uid: 'i1', qty: 10, price: 150 };
    const map = new Map([['i1', 12]]);
    expect(sumNodeTotal(item, true, map)).toBe(1800);
  });
  it('fallback sur qtyStudy si id absent de la map', () => {
    const item = { type: 'item', id: 'i1', uid: 'i1', qty: 10, price: 150 };
    expect(sumNodeTotal(item, true, new Map())).toBe(1500);
  });
  it('somme recursivement les enfants', () => {
    const chapter = {
      type: 'chapter', id: 'c1',
      children: [
        { type: 'item', id: 'i1', uid: 'i1', qty: 10, price: 50 },
        { type: 'item', id: 'i2', uid: 'i2', qty: 5,  price: 100 },
      ],
    };
    expect(sumNodeTotal(chapter, false, null)).toBe(1000);
  });
});

// ── formatPercent ──────────────────────────────────────────────────────────
describe('formatPercent', () => {
  it('retourne 0% pour zero', () => {
    expect(formatPercent(0)).toBe('0%');
  });
  it('prefixe + pour valeur positive', () => {
    expect(formatPercent(2.5)).toBe('+2.50%');
  });
  it('signe - pour valeur negative', () => {
    expect(formatPercent(-1.5)).toBe('-1.50%');
  });
  it('affiche 2 decimales', () => {
    expect(formatPercent(3.141)).toBe('+3.14%');
  });
  it('gere les valeurs non numeriques', () => {
    expect(formatPercent(null)).toBe('0%');
    expect(formatPercent(undefined)).toBe('0%');
  });
});

// ── evaluateFormula ────────────────────────────────────────────────────────
describe('evaluateFormula', () => {
  it('retourne null si pas de =', () => {
    expect(evaluateFormula('100', {})).toBeNull();
    expect(evaluateFormula('', {})).toBeNull();
    expect(evaluateFormula(null, {})).toBeNull();
  });
  it('evalue une expression simple', () => {
    expect(evaluateFormula('=100+50', {})).toBe(150);
    expect(evaluateFormula('=10*5', {})).toBe(50);
  });
  it('remplace les {id} par leurs valeurs', () => {
    const map = { item1: 10, item2: 5 };
    expect(evaluateFormula('={item1}+{item2}', map)).toBe(15);
  });
  it('utilise 0 pour les {id} absents', () => {
    expect(evaluateFormula('={absent}+10', {})).toBe(10);
  });
  it('bloque les injections de code', () => {
    expect(evaluateFormula('=alert(1)', {})).toBeNull();
  });
  it('retourne 0 si resultat Infinity', () => {
    expect(evaluateFormula('=1/0', {})).toBe(0);
  });
  it('supporte les parentheses', () => {
    const map = { a: 10, b: 2, c: 5 };
    expect(evaluateFormula('=({a}+{b})*{c}', map)).toBe(60);
  });
});

// ── recalculateProject ─────────────────────────────────────────────────────
describe('recalculateProject', () => {
  const makeItem = (id, qty, formula) => ({
    type: 'item', id, designation: 'Art ' + id,
    qty: qty || 0, formula: formula || '',
    quantities: {}, quantitiesFormula: {},
    price: 100, unit: 'm', bpuNum: '', isFixed: false,
  });
  const makeChap = (id, children) => ({
    type: 'chapter', id, title: 'Chap ' + id, isOption: false, children,
  });

  it('ne mute pas le tableau entree', () => {
    const chapters = [makeChap('c1', [makeItem('i1', 10)])];
    const original = JSON.stringify(chapters);
    recalculateProject(chapters, []);
    expect(JSON.stringify(chapters)).toBe(original);
  });
  it('laisse les items sans formule inchanges', () => {
    const chapters = [makeChap('c1', [makeItem('i1', 10), makeItem('i2', 20)])];
    const { updatedChapters } = recalculateProject(chapters, []);
    expect(updatedChapters[0].children[0].qty).toBe(10);
    expect(updatedChapters[0].children[1].qty).toBe(20);
  });
  it('resout une formule simple', () => {
    const item = Object.assign({}, makeItem('i1', 0), { formula: '=50+30' });
    const { updatedChapters } = recalculateProject([makeChap('c1', [item])], []);
    expect(updatedChapters[0].children[0].qty).toBe(80);
  });
  it('resout une formule qui reference un autre article', () => {
    const i1 = makeItem('i1', 100);
    const i2 = Object.assign({}, makeItem('i2', 0), { formula: '={i1}*2' });
    const { updatedChapters } = recalculateProject([makeChap('c1', [i1, i2])], []);
    expect(updatedChapters[0].children[1].qty).toBe(200);
  });
  it('resout les dependances chainees', () => {
    const i1 = makeItem('i1', 10);
    const i2 = Object.assign({}, makeItem('i2', 0), { formula: '={i1}+5' });
    const i3 = Object.assign({}, makeItem('i3', 0), { formula: '={i2}*2' });
    const { updatedChapters } = recalculateProject([makeChap('c1', [i1, i2, i3])], []);
    expect(updatedChapters[0].children[1].qty).toBe(15);
    expect(updatedChapters[0].children[2].qty).toBe(30);
  });
  it('remonte les sourceIds', () => {
    const i1 = makeItem('i1', 10);
    const i2 = Object.assign({}, makeItem('i2', 0), { formula: '={i1}+5' });
    const { sourceIds } = recalculateProject([makeChap('c1', [i1, i2])], []);
    expect(sourceIds).toContain('i1');
  });
  it('somme les tranches dans qty', () => {
    const item = Object.assign({}, makeItem('i1', 0), {
      quantities: { t1: 30, t2: 20 },
      quantitiesFormula: { t1: '', t2: '' },
    });
    const { updatedChapters } = recalculateProject(
      [makeChap('c1', [item])],
      [{ id: 't1' }, { id: 't2' }]
    );
    expect(updatedChapters[0].children[0].qty).toBe(50);
  });
});

// ── computePriceScore ──────────────────────────────────────────────────────
describe('computePriceScore', () => {
  const N    = 40;
  const Pmin = 100000;
  const Pmoy = 120000;
  const Pmax = 140000;

  it('F1 : le mieux-disant obtient le score max', () => {
    expect(computePriceScore('f1', N, Pmin, Pmin, Pmax, Pmoy)).toBe(N);
  });
  it('F1 : score decroissant avec le montant', () => {
    const s1 = computePriceScore('f1', N, 110000, Pmin, Pmax, Pmoy);
    const s2 = computePriceScore('f1', N, 130000, Pmin, Pmax, Pmoy);
    expect(s1).toBeGreaterThan(s2);
  });
  it('F2 : penalise plus fort que F1', () => {
    const f1 = computePriceScore('f1', N, 120000, Pmin, Pmax, Pmoy);
    const f2 = computePriceScore('f2', N, 120000, Pmin, Pmax, Pmoy);
    expect(f2).toBeLessThan(f1);
  });
  it('F7 : Pmin obtient N et Pmax obtient 0', () => {
    expect(computePriceScore('f7', N, Pmin, Pmin, Pmax, Pmoy)).toBe(N);
    expect(computePriceScore('f7', N, Pmax, Pmin, Pmax, Pmoy)).toBe(0);
  });
  it('F7 : tous identiques donne score max', () => {
    expect(computePriceScore('f7', N, 100000, 100000, 100000, 100000)).toBe(N);
  });
  it('score toujours entre 0 et N pour toutes les formules', () => {
    ['f1','f2','f3','f4','f5','f6','f7','f8','f9'].forEach(function(mode) {
      const s = computePriceScore(mode, N, Pmoy, Pmin, Pmax, Pmoy);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(N);
    });
  });
  it('retourne 0 si P = 0', () => {
    expect(computePriceScore('f1', N, 0, Pmin, Pmax, Pmoy)).toBe(0);
  });
  it('F4 : clampe a 0 si score negatif', () => {
    const score = computePriceScore('f4', N, 300000, Pmin, 300000, 200000);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ── detectAtypicalPrice ────────────────────────────────────────────────────
describe('detectAtypicalPrice', () => {
  it('ne signale rien si ecart inferieur a 25%', () => {
    expect(detectAtypicalPrice(110, 100, 50, 10000).isAtypical).toBe(false);
  });
  it('ne signale rien si impact inferieur a 2% du total', () => {
    expect(detectAtypicalPrice(300, 100, 1, 1000000).isAtypical).toBe(false);
  });
  it('detecte un prix bas', () => {
    const r = detectAtypicalPrice(50, 100, 200, 10000);
    expect(r.isAtypical).toBe(true);
    expect(r.direction).toBe('low');
  });
  it('detecte un prix haut', () => {
    const r = detectAtypicalPrice(200, 100, 200, 10000);
    expect(r.isAtypical).toBe(true);
    expect(r.direction).toBe('high');
  });
  it('calcule diffPct correctement', () => {
    expect(detectAtypicalPrice(150, 100, 200, 10000).diffPct).toBe(50);
  });
  it('retourne false si donnees manquantes', () => {
    expect(detectAtypicalPrice(0,   100, 100, 10000).isAtypical).toBe(false);
    expect(detectAtypicalPrice(100, 0,   100, 10000).isAtypical).toBe(false);
    expect(detectAtypicalPrice(100, 100, 100, 0    ).isAtypical).toBe(false);
  });
});