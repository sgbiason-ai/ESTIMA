// src/test/analysisCompute.test.js
import { describe, it, expect } from 'vitest';
import {
  scoreOffer,
  computeChaptersData,
  computeAnalysisStats,
  computeOABDetail,
  computeOABThreshold,
} from '../utils/analysisCompute';

// ── scoreOffer : primitif de notation partagé desktop + mobile ──────────────
describe('scoreOffer', () => {
  it('retourne 0 si l\'offre est nulle, négative ou absente (garde P > 0)', () => {
    expect(scoreOffer(0, 100, 300, 150, 40, 'f1')).toBe(0);
    expect(scoreOffer(-50, 100, 300, 150, 40, 'f1')).toBe(0);
    expect(scoreOffer(undefined, 100, 300, 150, 40, 'f1')).toBe(0);
  });

  it('f1 = N·(Pmin/P) : note maximale pour le moins-disant', () => {
    expect(scoreOffer(100, 100, 300, 150, 40, 'f1')).toBe(40);   // P = Pmin
    expect(scoreOffer(200, 100, 300, 150, 40, 'f1')).toBe(20);   // 40·(100/200)
  });

  it('f2 et f3 = puissances de (Pmin/P)', () => {
    expect(scoreOffer(200, 100, 300, 150, 40, 'f2')).toBe(10);   // 40·0.25
    expect(scoreOffer(200, 100, 300, 150, 40, 'f3')).toBe(5);    // 40·0.125
  });

  it('f5 = N·(1 − (P−Pmin)/Pmoy) (utilise Pmoy)', () => {
    // 40·(1 − (200−100)/150) = 40·0.3333…
    expect(scoreOffer(200, 100, 300, 150, 40, 'f5')).toBeCloseTo(13.333, 2);
  });

  it('f6 = racine si P ≤ Pmoy, carré sinon', () => {
    expect(scoreOffer(120, 100, 300, 150, 40, 'f6')).toBeCloseTo(40 * Math.sqrt(100 / 120), 5);
    expect(scoreOffer(200, 100, 300, 150, 40, 'f6')).toBeCloseTo(40 * (100 / 200) ** 2, 5);
  });

  it('f7 = linéaire entre Pmin et Pmax ; renvoie N si Pmax === Pmin', () => {
    expect(scoreOffer(200, 100, 300, 150, 40, 'f7')).toBe(20);   // 40·(1 − 100/200)
    expect(scoreOffer(100, 100, 100, 100, 40, 'f7')).toBe(40);   // Pmax === Pmin
  });

  it('f8 et f9 : formules de moyenne harmonique', () => {
    expect(scoreOffer(150, 100, 300, 150, 40, 'f8')).toBe(20);   // 40·150/300
    expect(scoreOffer(300, 100, 300, 150, 40, 'f9')).toBe(20);   // 40·(200/400)
  });

  it('mode inconnu → repli sur f1', () => {
    expect(scoreOffer(200, 100, 300, 150, 40, 'fX')).toBe(scoreOffer(200, 100, 300, 150, 40, 'f1'));
  });

  // ── Comportement clé du clamp [0, N] (ce qui manquait au calcScore mobile) ──
  it('borne basse : f4 sur une offre chère est ramené à 0 (jamais négatif)', () => {
    // 40·(1 − (300−100)/100) = 40·(−1) = −40  →  clampé à 0
    expect(scoreOffer(300, 100, 300, 150, 40, 'f4')).toBe(0);
  });

  it('borne haute : un score théorique > N est ramené à N', () => {
    // P < Pmin (cas dégénéré) : 40·(100/50) = 80  →  clampé à 40
    expect(scoreOffer(50, 100, 300, 150, 40, 'f1')).toBe(40);
  });
});

// ── computeAnalysisStats : agrégation + notation par entreprise ─────────────
describe('computeAnalysisStats', () => {
  const chaptersData = [
    {
      id: 'c1', title: 'Terrassement', isOption: false,
      items: [
        { estimationTotal: 1000, companyData: { A: { lineTotal: 1200 }, B: { lineTotal: 900 } } },
        { estimationTotal: 500,  companyData: { A: { lineTotal: 600 },  B: { lineTotal: 450 } } },
      ],
    },
  ];
  const companies = [{ id: 'A' }, { id: 'B' }];
  const cfg = { mode: 'f1', maxScore: 40 };

  it('calcule totalEstimation et les totaux par entreprise', () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg);
    expect(r.totalEstimation).toBe(1500);
    expect(r.companiesTotals.A).toBe(1800);
    expect(r.companiesTotals.B).toBe(1350);
  });

  it('calcule Pmin / Pmax / Pmoy sur les totaux entreprises', () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg);
    expect(r.Pmin).toBe(1350);
    expect(r.Pmax).toBe(1800);
    expect(r.Pmoy).toBe(1575);
  });

  it('note le moins-disant à N et les autres au prorata (f1)', () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg);
    expect(r.companyScores.B).toBe(40);              // moins-disant
    expect(r.companyScores.A).toBeCloseTo(30, 5);    // 40·(1350/1800)
  });

  it('calcule les écarts absolus et relatifs vs estimation', () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg);
    expect(r.companyEcarts.A).toEqual({ abs: 300, pct: 20 });
    expect(r.companyEcarts.B).toEqual({ abs: -150, pct: -10 });
  });

  it('exclut les chapitres « option » du calcul', () => {
    const withOption = [
      ...chaptersData,
      { id: 'opt', title: 'Option', isOption: true,
        items: [{ estimationTotal: 9999, companyData: { A: { lineTotal: 9999 }, B: { lineTotal: 9999 } } }] },
    ];
    const r = computeAnalysisStats(withOption, companies, cfg);
    expect(r.totalEstimation).toBe(1500);            // option ignorée
    expect(r.companiesTotals.A).toBe(1800);
  });

  it('renvoie le rapport de base si aucun total valide', () => {
    const empty = [{ id: 'c', title: 'x', isOption: false, items: [] }];
    const r = computeAnalysisStats(empty, companies, cfg);
    expect(r.Pmin).toBe(0);
    expect(r.companyScores).toEqual({});
  });

  it('est robuste aux entrées non-tableaux', () => {
    expect(() => computeAnalysisStats(null, null, cfg)).not.toThrow();
  });
});

// ── computeChaptersData : enrichissement des items (smoke test) ─────────────
describe('computeChaptersData', () => {
  const project = {
    chapters: [
      {
        id: 'c1', title: 'Lot 1', isOption: false,
        children: [
          { type: 'item', id: 'i1', price: 100 },
          { type: 'item', id: 'i2', price: 50 },
        ],
      },
    ],
  };
  const companies = [
    { id: 'A', offers: { i1: 120, i2: 60 } },
    { id: 'B', offers: { i1: 90, i2: 40 } },
  ];
  const qtyMap = { i1: 10, i2: 4 };

  it('calcule lineTotal, écart et min/max PU par item', () => {
    const data = computeChaptersData(project, companies, qtyMap);
    const i1 = data[0].items[0];
    expect(i1.estimationTotal).toBe(1000);                 // 10·100
    expect(i1.companyData.A.lineTotal).toBe(1200);         // 10·120
    expect(i1.companyData.B.lineTotal).toBe(900);          // 10·90
    expect(i1.minPU).toBe(90);
    expect(i1.maxPU).toBe(120);
  });

  it('repli quantité 0 quand l\'item est absent de la carte de quantités (alignement desktop/mobile, audit F4)', () => {
    const data = computeChaptersData(project, companies, { i1: 10 }); // i2 absent de la carte
    const i2 = data[0].items[1];
    expect(i2.activeQty).toBe(0);
    expect(i2.estimationTotal).toBe(0);
    expect(i2.companyData.A.lineTotal).toBe(0);
  });

  it('retourne [] si le projet est vide', () => {
    expect(computeChaptersData(null, companies, qtyMap)).toEqual([]);
  });
});

// ── computeOABDetail / computeOABThreshold : seuil Double Moyenne ────────────
describe('computeOABDetail', () => {
  it('renvoie des zéros si aucune offre valide', () => {
    expect(computeOABDetail([])).toEqual({ M1: 0, plafond: 0, filtered: [], M2: 0, threshold: 0 });
    expect(computeOABDetail([0, -5])).toEqual({ M1: 0, plafond: 0, filtered: [], M2: 0, threshold: 0 });
  });

  it('cas simple sans offre écartée (toutes ≤ plafond)', () => {
    // M1 = 110, plafond = 132, filtered = [100,110,120], M2 = 110, seuil = 99
    const d = computeOABDetail([100, 110, 120]);
    expect(d.M1).toBe(110);
    expect(d.plafond).toBeCloseTo(132, 5);
    expect(d.filtered).toEqual([100, 110, 120]);
    expect(d.M2).toBe(110);
    expect(d.threshold).toBeCloseTo(99, 5);
  });

  it('écarte les offres au-dessus du plafond (M1 × 1.20) pour M2', () => {
    // [100,110,120,500] : M1 = 207.5, plafond = 249, 500 écartée
    // M2 = moyenne(100,110,120) = 110, seuil = 99
    const d = computeOABDetail([100, 110, 120, 500]);
    expect(d.M1).toBe(207.5);
    expect(d.plafond).toBeCloseTo(249, 5);
    expect(d.filtered).toEqual([100, 110, 120]);
    expect(d.threshold).toBeCloseTo(99, 5);
  });

  it('ignore les valeurs nulles ou négatives', () => {
    expect(computeOABDetail([0, 100, -5, 110, 120]).threshold)
      .toBeCloseTo(computeOABDetail([100, 110, 120]).threshold, 5);
  });

  it('est robuste à une entrée non-tableau', () => {
    expect(computeOABDetail(null).threshold).toBe(0);
  });
});

describe('computeOABThreshold', () => {
  it('renvoie le seuil seul (= computeOABDetail.threshold)', () => {
    const values = [100, 110, 120, 500];
    expect(computeOABThreshold(values)).toBe(computeOABDetail(values).threshold);
    expect(computeOABThreshold([])).toBe(0);
  });
});
