// src/test/analysisCompute.test.js
import { describe, it, expect } from 'vitest';
import {
  scoreOffer,
  computeChaptersData,
  computeAnalysisStats,
  computeOABDetail,
  computeOABThreshold,
  getEffectiveOffers,
  companiesHaveNego,
  getCompanyRabaisPct,
  getEffectiveConclusion,
  isConclusionNonRegular,
  isRegularizedAfterNego,
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

// ── Phase après négociation : offres effectives + comparatif ─────────────────
describe('getEffectiveOffers', () => {
  const company = { offers: { i1: 100, i2: 50 }, offersNego: { i1: 90 } };

  it("basis 'initial' (ou absent) → offres initiales telles quelles", () => {
    expect(getEffectiveOffers(company)).toEqual({ i1: 100, i2: 50 });
    expect(getEffectiveOffers(company, 'initial')).toEqual({ i1: 100, i2: 50 });
  });

  it("basis 'nego' → fusion article par article (le négocié prime, le reste est repris)", () => {
    expect(getEffectiveOffers(company, 'nego')).toEqual({ i1: 90, i2: 50 });
  });

  it('entreprise sans contre-proposition → offre initiale reprise intégralement', () => {
    expect(getEffectiveOffers({ offers: { i1: 100 } }, 'nego')).toEqual({ i1: 100 });
    expect(getEffectiveOffers({ offers: { i1: 100 }, offersNego: {} }, 'nego')).toEqual({ i1: 100 });
  });

  it('est robuste à une entreprise nulle', () => {
    expect(getEffectiveOffers(null, 'nego')).toEqual({});
  });
});

describe('companiesHaveNego', () => {
  it('détecte au moins une entreprise avec prix négociés', () => {
    expect(companiesHaveNego([{ offers: {} }, { offers: {}, offersNego: { i1: 5 } }])).toBe(true);
    expect(companiesHaveNego([{ offers: { i1: 10 } }, { offersNego: {} }])).toBe(false);
    expect(companiesHaveNego([])).toBe(false);
    expect(companiesHaveNego(null)).toBe(false);
  });

  it('détecte aussi un rabais commercial seul (sans prix renégociés)', () => {
    expect(companiesHaveNego([{ offers: { i1: 10 }, negoRabaisPct: 2.5 }])).toBe(true);
    expect(companiesHaveNego([{ offers: { i1: 10 }, negoRabaisPct: 0 }])).toBe(false);
  });
});

describe('getCompanyRabaisPct', () => {
  it("ne s'applique qu'en basis 'nego'", () => {
    expect(getCompanyRabaisPct({ negoRabaisPct: 3 })).toBe(0);
    expect(getCompanyRabaisPct({ negoRabaisPct: 3 }, 'initial')).toBe(0);
    expect(getCompanyRabaisPct({ negoRabaisPct: 3 }, 'nego')).toBe(3);
  });

  it('borne à [0, 100] et ignore les valeurs invalides', () => {
    expect(getCompanyRabaisPct({ negoRabaisPct: 150 }, 'nego')).toBe(100);
    expect(getCompanyRabaisPct({ negoRabaisPct: -5 }, 'nego')).toBe(0);
    expect(getCompanyRabaisPct({ negoRabaisPct: 'abc' }, 'nego')).toBe(0);
    expect(getCompanyRabaisPct({}, 'nego')).toBe(0);
    expect(getCompanyRabaisPct(null, 'nego')).toBe(0);
  });
});

describe("computeAnalysisStats — rabais commercial (basis 'nego')", () => {
  // A : 1000 € brut avec 10 % de rabais ; B : 950 € sans rabais.
  const chaptersData = [
    {
      id: 'c1', title: 'Lot', isOption: false,
      items: [{ estimationTotal: 900, companyData: { A: { lineTotal: 1000 }, B: { lineTotal: 950 } } }],
    },
  ];
  const companies = [{ id: 'A', negoRabaisPct: 10 }, { id: 'B' }];
  const cfg = { mode: 'f1', maxScore: 40 };

  it('déduit le rabais du Total HT (net) et conserve le brut', () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg, 'nego');
    expect(r.companiesTotals.A).toBe(900);        // 1000 × (1 − 10 %)
    expect(r.companiesTotalsBrut.A).toBe(1000);
    expect(r.companiesTotals.B).toBe(950);        // sans rabais
    expect(r.companiesRabais).toEqual({ A: 10 });
  });

  it('la notation porte sur les montants nets (le rabais peut inverser le classement)', () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg, 'nego');
    // Net : A = 900 (moins-disant), B = 950
    expect(r.Pmin).toBe(900);
    expect(r.companyScores.A).toBe(40);
    expect(r.companyScores.B).toBeCloseTo(40 * (900 / 950), 5);
  });

  it("basis 'initial' (ou absent) : aucun rabais appliqué", () => {
    const r = computeAnalysisStats(chaptersData, companies, cfg);
    expect(r.companiesTotals.A).toBe(1000);
    expect(r.companiesRabais).toEqual({});
    expect(r.Pmin).toBe(950);
  });
});

// ── Régularité effective : régularisation d'une offre après négociation ──────
describe('getEffectiveConclusion / régularisation après négo', () => {
  it("phase 'initial' : renvoie toujours le statut initial (ignore conclusionNego)", () => {
    const admin = { conclusion: 'irreguliere', conclusionNego: 'reguliere' };
    expect(getEffectiveConclusion(admin, 'initial')).toBe('irreguliere');
    expect(getEffectiveConclusion(admin)).toBe('irreguliere');
  });

  it("phase 'nego' : conclusionNego prend le pas (régularisation)", () => {
    const admin = { conclusion: 'irreguliere', conclusionNego: 'reguliere' };
    expect(getEffectiveConclusion(admin, 'nego')).toBe('reguliere');
  });

  it("phase 'nego' sans override : hérite du statut initial", () => {
    expect(getEffectiveConclusion({ conclusion: 'irreguliere' }, 'nego')).toBe('irreguliere');
    expect(getEffectiveConclusion({ conclusion: 'irreguliere', conclusionNego: '' }, 'nego')).toBe('irreguliere');
  });

  it('robuste à un admin nul', () => {
    expect(getEffectiveConclusion(null, 'nego')).toBeUndefined();
  });

  it('isConclusionNonRegular suit le statut effectif selon la phase', () => {
    const admin = { conclusion: 'irreguliere', conclusionNego: 'reguliere' };
    expect(isConclusionNonRegular(admin, 'initial')).toBe(true);   // irrégulière avant négo
    expect(isConclusionNonRegular(admin, 'nego')).toBe(false);     // régularisée après négo
    expect(isConclusionNonRegular({ conclusion: 'inacceptable' }, 'nego')).toBe(true);
    expect(isConclusionNonRegular({ conclusion: 'reguliere' })).toBe(false);
  });

  it('isRegularizedAfterNego : vrai seulement si initial non régulier ET nego régulier', () => {
    expect(isRegularizedAfterNego({ conclusion: 'irreguliere', conclusionNego: 'reguliere' })).toBe(true);
    expect(isRegularizedAfterNego({ conclusion: 'inacceptable', conclusionNego: 'reguliere' })).toBe(true);
    // initial déjà régulier → pas une régularisation
    expect(isRegularizedAfterNego({ conclusion: 'reguliere', conclusionNego: 'reguliere' })).toBe(false);
    // reste non régulier après négo → pas régularisée
    expect(isRegularizedAfterNego({ conclusion: 'irreguliere', conclusionNego: 'inacceptable' })).toBe(false);
    // pas d'override → pas régularisée
    expect(isRegularizedAfterNego({ conclusion: 'irreguliere' })).toBe(false);
    expect(isRegularizedAfterNego(null)).toBe(false);
  });
});

describe("computeChaptersData — basis 'nego'", () => {
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
  // A a renégocié i1 (120 → 100) ; B n'a rien renégocié.
  const companies = [
    { id: 'A', offers: { i1: 120, i2: 60 }, offersNego: { i1: 100 } },
    { id: 'B', offers: { i1: 90, i2: 40 } },
  ];
  const qtyMap = { i1: 10, i2: 4 };

  it('reprend le prix négocié quand il existe, sinon le prix initial', () => {
    const data = computeChaptersData(project, companies, qtyMap, 'nego');
    const [i1, i2] = data[0].items;
    expect(i1.companyData.A.pu).toBe(100);        // négocié
    expect(i1.companyData.A.lineTotal).toBe(1000);
    expect(i2.companyData.A.pu).toBe(60);         // non renégocié → initial
    expect(i1.companyData.B.pu).toBe(90);         // pas de contre-proposition
  });

  it('porte puInitial (prix avant négo) pour le marqueur visuel', () => {
    const data = computeChaptersData(project, companies, qtyMap, 'nego');
    expect(data[0].items[0].companyData.A.puInitial).toBe(120);
    expect(data[0].items[0].companyData.B.puInitial).toBe(90);
  });

  it("basis 'initial' : ni fusion ni puInitial (comportement historique)", () => {
    const data = computeChaptersData(project, companies, qtyMap);
    expect(data[0].items[0].companyData.A.pu).toBe(120);
    expect(data[0].items[0].companyData.A.puInitial).toBeUndefined();
  });

  it('la notation suit les montants négociés (chaîne complète stats)', () => {
    const cfg = { mode: 'f1', maxScore: 40 };
    const statsInitial = computeAnalysisStats(computeChaptersData(project, companies, qtyMap), companies, cfg);
    const statsNego = computeAnalysisStats(computeChaptersData(project, companies, qtyMap, 'nego'), companies, cfg);
    // A : 10·120 + 4·60 = 1440 → après négo 10·100 + 4·60 = 1240
    expect(statsInitial.companiesTotals.A).toBe(1440);
    expect(statsNego.companiesTotals.A).toBe(1240);
    // B inchangé (offre initiale reprise)
    expect(statsNego.companiesTotals.B).toBe(1060);
    // Le score de A s'améliore avec la baisse négociée
    expect(statsNego.companyScores.A).toBeGreaterThan(statsInitial.companyScores.A);
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
