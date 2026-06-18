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
  buildRefMap,
  buildChapterNumberMap,
  buildDuplicateIndex,
  computePseDeltas,
  buildPseNumbers,
  checkPriceConsistency,
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
  it('seuil personnalisé : 30 non majoré avec seuil 50, 51 majoré', () => {
    expect(calculateSafeClientQty(30, 10, 50)).toBe(30);
    expect(calculateSafeClientQty(51, 10, 50)).toBe(57); // 51*1.1=56.1 → ceil 57
  });
  it('seuil 0 : toute quantité non nulle est majorée', () => {
    expect(calculateSafeClientQty(5, 10, 0)).toBe(6); // 5*1.1=5.5 → ceil 6
  });
  it('seuil invalide (NaN/négatif) : retombe sur 20', () => {
    expect(calculateSafeClientQty(10, 10, NaN)).toBe(10);
    expect(calculateSafeClientQty(21, 10, -5)).toBe(24); // 21*1.1=23.1 → ceil 24
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
  it('respecte le seuil du projet (clientQtyThreshold)', () => {
    const p = proj([{ type: 'item', id: 'i1', uid: 'i1', qty: 30, price: 50 }]);
    p.clientQtyThreshold = 50;
    const { map } = buildGlobalClientQtyMapFromStudyQty(p, 10);
    expect(map.get('i1')).toBe(30); // 30 ≤ 50 → non majoré
  });
  it('ne majore jamais isFixed ni qtyLocked', () => {
    const { map } = buildGlobalClientQtyMapFromStudyQty(
      proj([
        { type: 'item', id: 'f1', uid: 'f1', qty: 100, price: 50, isFixed: true },
        { type: 'item', id: 'l1', uid: 'l1', qty: 100, price: 50, qtyLocked: true },
      ]), 10
    );
    expect(map.get('f1')).toBe(100);
    expect(map.get('l1')).toBe(100);
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

// ── computeQtyMaps ─────────────────────────────────────────────────────────
describe('computeQtyMaps', () => {
  const item = (id, qty, extra = {}) => ({
    type: 'item', id, designation: 'Art ' + id, qty,
    quantities: {}, quantitiesFormula: {}, price: 100, unit: 'm', isFixed: false, ...extra,
  });

  it('valeurs brutes sans tranches (study + client)', () => {
    const { studyQtyMaps, clientQtyMaps } = computeQtyMaps([item('i1', 10), item('i2', 100)], false, [], 10);
    expect(studyQtyMaps.global.i1).toBe(10);
    expect(studyQtyMaps.global.i2).toBe(100);
    expect(clientQtyMaps.global.i1).toBe(10);   // ≤20 → non majoré
    expect(clientQtyMaps.global.i2).toBe(111);  // 100*1.1=110.00…1 → ceil 111
  });

  it('borne ±20 : 20 non majoré, 21 majoré', () => {
    const { clientQtyMaps } = computeQtyMaps([item('a', 20), item('b', 21)], false, [], 10);
    expect(clientQtyMaps.global.a).toBe(20);
    expect(clientQtyMaps.global.b).toBe(24);    // 21*1.1=23.1 → ceil 24
  });

  it('isFixed jamais majoré', () => {
    const { clientQtyMaps } = computeQtyMaps([item('f', 100, { isFixed: true })], false, [], 10);
    expect(clientQtyMaps.global.f).toBe(100);
  });

  it('qtyLocked jamais majoré (quantité figée)', () => {
    const { studyQtyMaps, clientQtyMaps } = computeQtyMaps([item('l', 100, { qtyLocked: true })], false, [], 10);
    expect(studyQtyMaps.global.l).toBe(100);
    expect(clientQtyMaps.global.l).toBe(100);
  });

  it('seuil personnalisé 50 : 30 non majoré, 60 majoré', () => {
    const { clientQtyMaps } = computeQtyMaps([item('a', 30), item('b', 60)], false, [], 10, 50);
    expect(clientQtyMaps.global.a).toBe(30);
    expect(clientQtyMaps.global.b).toBe(66);    // 60*1.1=66
  });

  it('seuil personnalisé : formule décimale sous le seuil NON arrondie', () => {
    const { studyQtyMaps } = computeQtyMaps([item('i1', '=100/3')], false, [], 10, 50);
    expect(studyQtyMaps.global.i1).toBeCloseTo(33.333, 2); // 33.33 ≤ 50 → pas d'arrondi
  });

  it('formule simple résolue', () => {
    const { studyQtyMaps, clientQtyMaps } = computeQtyMaps([item('i1', '=50+30')], false, [], 10);
    expect(studyQtyMaps.global.i1).toBe(80);
    expect(clientQtyMaps.global.i1).toBe(88);   // 80*1.1=88
  });

  it('formule décimale ≥|20| arrondie au plafond (ceil #3)', () => {
    const { studyQtyMaps, clientQtyMaps } = computeQtyMaps([item('i1', '=100/3')], false, [], 10);
    expect(studyQtyMaps.global.i1).toBe(34);    // 33.33 → ceil 34
    expect(clientQtyMaps.global.i1).toBe(38);   // 34*1.1=37.4 → ceil 38
  });

  it('formule décimale <20 NON arrondie', () => {
    const { studyQtyMaps } = computeQtyMaps([item('i1', '=10/3')], false, [], 10);
    expect(studyQtyMaps.global.i1).toBeCloseTo(3.333, 2);
  });

  it('formule référençant un autre article', () => {
    const { studyQtyMaps } = computeQtyMaps([item('i1', 100), item('i2', '={i1}*2')], false, [], 10);
    expect(studyQtyMaps.global.i2).toBe(200);
  });

  it('agrégation tranches : somme study + client par tranche', () => {
    const it1 = item('x', 0, { quantities: { t1: 30, t2: 20 } });
    const { studyQtyMaps, clientQtyMaps } = computeQtyMaps([it1], true, [{ id: 't1' }, { id: 't2' }], 10);
    expect(studyQtyMaps.t1.x).toBe(30);
    expect(studyQtyMaps.t2.x).toBe(20);
    expect(studyQtyMaps.global.x).toBe(50);
    expect(clientQtyMaps.t1.x).toBe(33);        // 30*1.1=33
    expect(clientQtyMaps.t2.x).toBe(20);        // ≤20 → non majoré
    expect(clientQtyMaps.global.x).toBe(53);    // 33 + 20 (somme des clients par tranche)
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

// ── buildRefMap ────────────────────────────────────────────────────────────
describe('buildRefMap', () => {
  const chapters = [
    { type: 'chapter', id: 'c1', children: [
      { type: 'item', id: 'i1', uid: 'A', bpuNum: '1.01', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'B', bpuNum: '1.02', designation: 'Remblai', unit: 'm3', price: 20 },
      { type: 'chapter', id: 'c2', children: [
        { type: 'item', id: 'i3', uid: 'A', bpuNum: '1.01', designation: 'Déblai', unit: 'm3', price: 10 },
      ]},
    ]},
  ];

  it('mode auto : numérote P.1, P.2… par clé uid', () => {
    const m = buildRefMap(chapters, { numberingMode: 'auto' });
    expect(m.get('i1')).toBe('P.1');
    expect(m.get('i2')).toBe('P.2');
    // i3 a le même uid que i1 → même numéro
    expect(m.get('i3')).toBe('P.1');
  });

  it('mode manuel : utilise le bpuNum saisi', () => {
    const m = buildRefMap(chapters, { numberingMode: 'manual' });
    expect(m.get('i1')).toBe('1.01');
    expect(m.get('i2')).toBe('1.02');
    expect(m.get('i3')).toBe('1.01');
  });

  it('mode manuel mais bpuNum vide → repli auto', () => {
    const ch = [{ type: 'chapter', id: 'c', children: [
      { type: 'item', id: 'x', uid: 'Z', designation: 'X', unit: 'u', price: 5 },
    ]}];
    expect(buildRefMap(ch, { numberingMode: 'manual' }).get('x')).toBe('P.1');
  });

  it('défaut (config vide) = mode auto', () => {
    expect(buildRefMap(chapters, {}).get('i1')).toBe('P.1');
  });

  // ── Mode hiérarchique (numérotation DQE « 2.1.3 ») ──
  describe('mode hiérarchique', () => {
    it('séquence partagée : articles ET sous-chapitres consomment les rangs dans l\'ordre', () => {
      const ch = [
        { type: 'chapter', id: 'c1', children: [
          { type: 'item', id: 'a', uid: 'A', designation: 'A', unit: 'u', price: 1 },
          { type: 'chapter', id: 's1', children: [
            { type: 'item', id: 'b', uid: 'B', designation: 'B', unit: 'u', price: 2 },
          ]},
          { type: 'item', id: 'c', uid: 'C', designation: 'C', unit: 'u', price: 3 },
        ]},
        { type: 'chapter', id: 'c2', children: [
          { type: 'item', id: 'd', uid: 'D', designation: 'D', unit: 'u', price: 4 },
        ]},
      ];
      const m = buildRefMap(ch, { numberingMode: 'hierarchical' });
      expect(m.get('c1')).toBe('1');
      expect(m.get('a')).toBe('1.1');
      expect(m.get('s1')).toBe('1.2');   // le sous-chapitre prend le rang suivant l'article
      expect(m.get('b')).toBe('1.2.1');
      expect(m.get('c')).toBe('1.3');    // l'article après le sous-chapitre continue la séquence
      expect(m.get('c2')).toBe('2');
      expect(m.get('d')).toBe('2.1');
    });

    it('unicité : la 2ᵉ occurrence garde le numéro de la 1ʳᵉ et ne consomme pas de rang', () => {
      const ch = [
        { type: 'chapter', id: 'c1', children: [
          { type: 'chapter', id: 's1', children: [
            { type: 'item', id: 'x1', uid: 'X', designation: 'X', unit: 'u', price: 1 },
            { type: 'item', id: 'y1', uid: 'Y', designation: 'Y', unit: 'u', price: 2 },
          ]},
        ]},
        { type: 'chapter', id: 'c2', children: [
          { type: 'item', id: 'x2', uid: 'X', designation: 'X', unit: 'u', price: 1 }, // doublon
          { type: 'item', id: 'z', uid: 'Z', designation: 'Z', unit: 'u', price: 3 },
        ]},
      ];
      const m = buildRefMap(ch, { numberingMode: 'hierarchical' });
      expect(m.get('x1')).toBe('1.1.1');
      expect(m.get('x2')).toBe('1.1.1'); // même numéro partout
      expect(m.get('z')).toBe('2.1');    // pas de trou : z prend le 1er rang du chapitre 2
    });

    it('unicité par clé de repli (désignation|unité|prix) sans uid', () => {
      const ch = [
        { type: 'chapter', id: 'c1', children: [
          { type: 'item', id: 'p1', designation: 'Béton', unit: 'm3', price: 100 },
          { type: 'item', id: 'p2', designation: 'Béton', unit: 'm3', price: 100 }, // même clé
          { type: 'item', id: 'p3', designation: 'Béton', unit: 'm3', price: 120 }, // prix ≠ → clé ≠
        ]},
      ];
      const m = buildRefMap(ch, { numberingMode: 'hierarchical' });
      expect(m.get('p1')).toBe('1.1');
      expect(m.get('p2')).toBe('1.1');
      expect(m.get('p3')).toBe('1.2');
    });

    it('le bpuNum est ignoré en mode hiérarchique (numérotation par position)', () => {
      const m = buildRefMap(chapters, { numberingMode: 'hierarchical' });
      expect(m.get('i1')).toBe('1.1');   // pas « 1.01 » du bpuNum
      expect(m.get('i2')).toBe('1.2');
      expect(m.get('c2')).toBe('1.3');
      expect(m.get('i3')).toBe('1.1');   // même uid que i1 → unicité
    });
  });
});

// ── buildDuplicateIndex ─────────────────────────────────────────────────────
describe('buildDuplicateIndex', () => {
  const chapters = [
    { type: 'chapter', id: 'c1', title: 'TERRASSEMENTS', children: [
      { type: 'item', id: 'i1', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'B', designation: 'Remblai', unit: 'm3', price: 20 },
      { type: 'chapter', id: 's1', title: 'Sous-chap', children: [
        { type: 'item', id: 'i3', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      ]},
    ]},
    { type: 'chapter', id: 'c2', title: 'VOIRIE', children: [
      { type: 'item', id: 'i4', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
    ]},
  ];

  it('recense uniquement les prix répétés, avec rang et occurrences ordonnées', () => {
    const idx = buildDuplicateIndex(chapters);
    expect(idx.has('i2')).toBe(false);            // prix unique → absent
    expect(idx.get('i1')).toMatchObject({ count: 3, index: 0 });
    expect(idx.get('i3')).toMatchObject({ count: 3, index: 1 });
    expect(idx.get('i4')).toMatchObject({ count: 3, index: 2 });
    expect(idx.get('i1').ids).toEqual(['i1', 'i3', 'i4']);
  });

  it('labels = titre du chapitre racine de chaque occurrence (sous-chapitre inclus)', () => {
    const idx = buildDuplicateIndex(chapters);
    expect(idx.get('i1').labels).toEqual(['TERRASSEMENTS', 'TERRASSEMENTS', 'VOIRIE']);
  });

  it('clé de repli sans uid : désignation|unité|prix (prix différent → pas un doublon)', () => {
    const ch = [{ type: 'chapter', id: 'c', title: 'CH', children: [
      { type: 'item', id: 'p1', designation: 'Béton', unit: 'm3', price: 100 },
      { type: 'item', id: 'p2', designation: 'Béton', unit: 'm3', price: 100 },
      { type: 'item', id: 'p3', designation: 'Béton', unit: 'm3', price: 120 },
    ]}];
    const idx = buildDuplicateIndex(ch);
    expect(idx.get('p1')?.count).toBe(2);
    expect(idx.get('p2')?.index).toBe(1);
    expect(idx.has('p3')).toBe(false);
  });

  it('arbre vide ou null → index vide', () => {
    expect(buildDuplicateIndex([]).size).toBe(0);
    expect(buildDuplicateIndex(null).size).toBe(0);
  });
});

// ── computePseDeltas (PSE substitution) ─────────────────────────────────────
describe('computePseDeltas', () => {
  // Base = article P (200×10=2000) ; PSE substitution = sous-chapitre (1×2600=2600)
  const project = [
    { type: 'chapter', id: 'c1', title: 'VOIRIE', children: [
      { type: 'item', id: 'base', uid: 'B', designation: 'Bicouche', unit: 'm2', price: 10, qty: 200 },
      { type: 'chapter', id: 'pse', title: 'VARIANTE ENROBÉ', isOption: true, pseMode: 'substitution', pseBaseId: 'base', children: [
        { type: 'item', id: 'p1', designation: 'BBSG', unit: 'm2', price: 13, qty: 200 },
      ]},
    ]},
  ];

  it('delta = montant PSE − montant base', () => {
    const m = computePseDeltas(project);
    // PSE = 200×13 = 2600 ; base = 200×10 = 2000 → delta = 600
    expect(m.get('pse')).toMatchObject({ pseTotal: 2600, baseTotal: 2000, delta: 600, missing: false });
  });

  it('delta négatif (moins-value) conservé tel quel', () => {
    const p = JSON.parse(JSON.stringify(project));
    p[0].children[1].children[0].price = 8; // PSE = 1600 < base 2000
    expect(computePseDeltas(p).get('pse').delta).toBe(-400);
  });

  it('quantités propres via getItemQty (mode client)', () => {
    // base ×1.1 = 220, pse ×1.1 = 220 → 220×13 − 220×10 = 660
    const clientQty = { base: 220, p1: 220 };
    const m = computePseDeltas(project, (it) => clientQty[it.id] ?? Number(it.qty || 0));
    expect(m.get('pse').delta).toBe(660);
  });

  it('base introuvable → missing, repli sur montant plein', () => {
    const p = JSON.parse(JSON.stringify(project));
    p[0].children[1].pseBaseId = 'inexistant';
    expect(computePseDeltas(p).get('pse')).toMatchObject({ missing: true, delta: 2600 });
  });

  it('base = descendant de la PSE → invalide (missing)', () => {
    const p = JSON.parse(JSON.stringify(project));
    p[0].children[1].pseBaseId = 'p1'; // p1 est dans la PSE
    expect(computePseDeltas(p).get('pse').missing).toBe(true);
  });

  it('PSE simple (sans pseMode) ou non-option → absente de la map', () => {
    const p = [
      { type: 'chapter', id: 'c', title: 'C', children: [
        { type: 'chapter', id: 's1', isOption: true, children: [{ type: 'item', id: 'i', price: 5, qty: 2 }] }, // PSE simple
        { type: 'chapter', id: 's2', pseMode: 'substitution', pseBaseId: 'x', children: [] }, // pas option
      ]},
    ];
    const m = computePseDeltas(p);
    expect(m.has('s1')).toBe(false);
    expect(m.has('s2')).toBe(false);
  });
});

// ── buildPseNumbers ─────────────────────────────────────────────────────────
describe('buildPseNumbers', () => {
  it('numérote chaque racine PSE en séquence, dans l\'ordre du document', () => {
    const ch = [
      { type: 'chapter', id: 'c1', children: [
        { type: 'item', id: 'i1' },
        { type: 'chapter', id: 'pseA', isOption: true, children: [{ type: 'item', id: 'a1' }] }, // PSE n°1
      ]},
      { type: 'chapter', id: 'c2', isOption: true, children: [ // PSE n°2 (chapitre entier)
        { type: 'item', id: 'b1' },
      ]},
      { type: 'chapter', id: 'c3', children: [
        { type: 'chapter', id: 'pseC', isOption: true, children: [] }, // PSE n°3
      ]},
    ];
    const m = buildPseNumbers(ch);
    expect(m.get('pseA')).toBe(1);
    expect(m.get('c2')).toBe(2);
    expect(m.get('pseC')).toBe(3);
    expect(m.size).toBe(3);
  });

  it('un élément sous une PSE n\'a pas de numéro propre (seule la racine compte)', () => {
    const ch = [
      { type: 'chapter', id: 'c', isOption: true, children: [
        { type: 'chapter', id: 'sub', isOption: true, children: [] }, // sous une PSE → pas racine
      ]},
    ];
    const m = buildPseNumbers(ch);
    expect(m.get('c')).toBe(1);
    expect(m.has('sub')).toBe(false);
    expect(m.size).toBe(1);
  });

  it('aucune PSE → map vide', () => {
    expect(buildPseNumbers([{ type: 'chapter', id: 'c', children: [] }]).size).toBe(0);
  });
});

// ── checkPriceConsistency ───────────────────────────────────────────────────
describe('checkPriceConsistency', () => {
  const wrap = (items) => [{ type: 'chapter', id: 'c1', title: 'Chap', children: items }];

  it('projet cohérent → ok, aucune anomalie', () => {
    // Même uid → même numéro, contenu identique
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
    ]), { numberingMode: 'auto' });
    expect(r.ok).toBe(true);
    expect(r.numberConflicts).toHaveLength(0);
    expect(r.duplicateNumbers).toHaveLength(0);
    expect(r.totalItems).toBe(2);
    expect(r.anomalyCount).toBe(0);
    expect(r.flaggedItemIds).toHaveLength(0);
  });

  it('même numéro, libellés divergents → conflit (libellé)', () => {
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'A', designation: 'Remblai', unit: 'm3', price: 10 },
    ]), { numberingMode: 'auto' });
    expect(r.ok).toBe(false);
    expect(r.numberConflicts).toHaveLength(1);
    expect(r.numberConflicts[0].ref).toBe('P.1');
    expect(r.numberConflicts[0].divergesOn).toContain('libellé');
    expect(r.numberConflicts[0].items).toHaveLength(2);
    expect(r.anomalyCount).toBe(1);
    expect([...r.flaggedItemIds].sort()).toEqual(['i1', 'i2']);
  });

  it('même numéro, unités divergentes → conflit (unité)', () => {
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'A', designation: 'Déblai', unit: 'm2', price: 10 },
    ]), { numberingMode: 'auto' });
    expect(r.numberConflicts).toHaveLength(1);
    expect(r.numberConflicts[0].divergesOn).toEqual(['unité']);
  });

  it('même libellé + unité sous deux numéros → doublon', () => {
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'B', designation: 'Déblai', unit: 'm3', price: 10 },
    ]), { numberingMode: 'auto' });
    expect(r.numberConflicts).toHaveLength(0);
    expect(r.duplicateNumbers).toHaveLength(1);
    expect(r.duplicateNumbers[0].refs.sort()).toEqual(['P.1', 'P.2']);
    expect(r.duplicateNumbers[0].items).toHaveLength(2);
    expect([...r.flaggedItemIds].sort()).toEqual(['i1', 'i2']);
  });

  it('comparaison insensible à la casse et aux espaces', () => {
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'A', designation: '  déblai  ', unit: 'M3', price: 10 },
    ]), { numberingMode: 'auto' });
    expect(r.ok).toBe(true);
  });

  it('ignore les lignes sans libellé pour les doublons', () => {
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', designation: '', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'B', designation: '', unit: 'm3', price: 10 },
    ]), { numberingMode: 'auto' });
    expect(r.ok).toBe(true);
    expect(r.duplicateNumbers).toHaveLength(0);
  });

  it('mode manuel : même n° saisi sur contenus différents → conflit', () => {
    const r = checkPriceConsistency(wrap([
      { type: 'item', id: 'i1', uid: 'A', bpuNum: '201', designation: 'Déblai', unit: 'm3', price: 10 },
      { type: 'item', id: 'i2', uid: 'B', bpuNum: '201', designation: 'Remblai', unit: 'm3', price: 20 },
    ]), { numberingMode: 'manual' });
    expect(r.numberConflicts).toHaveLength(1);
    expect(r.numberConflicts[0].ref).toBe('201');
  });
});

// ── buildChapterNumberMap ──────────────────────────────────────────────────
describe('buildChapterNumberMap', () => {
  it('numérote (sous-)chapitres en séquentiel et ignore les articles', () => {
    const chapters = [
      { id: 'a', children: [
        { type: 'item', id: 'a-i1' },             // article : ne consomme pas de rang
        { id: 'a1', children: [{ id: 'a1x' }] },  // sous-chapitre 1.1 puis 1.1.1
        { id: 'a2' },                             // sous-chapitre 1.2
      ] },
      { id: 'b' },                                // chapitre 2
    ];
    const map = buildChapterNumberMap(chapters, { numberingMode: 'sequential' });
    expect(map.get('a')).toBe('1');
    expect(map.get('a1')).toBe('1.1');
    expect(map.get('a1x')).toBe('1.1.1');
    expect(map.get('a2')).toBe('1.2');
    expect(map.get('b')).toBe('2');
    expect(map.has('a-i1')).toBe(false); // article non numéroté
  });

  it('mode hiérarchique : délègue à buildRefMap', () => {
    const chapters = [{ id: 'a', children: [{ id: 'a1' }] }];
    const cfg = { numberingMode: 'hierarchical' };
    const viaMap = buildChapterNumberMap(chapters, cfg);
    const viaRef = buildRefMap(chapters, cfg);
    expect(viaMap.get('a')).toBe(viaRef.get('a'));
    expect(viaMap.get('a1')).toBe(viaRef.get('a1'));
  });

  it('gère les entrées vides ou non-tableau', () => {
    expect(buildChapterNumberMap(null).size).toBe(0);
    expect(buildChapterNumberMap([]).size).toBe(0);
  });
});