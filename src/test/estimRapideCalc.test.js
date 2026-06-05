// src/test/estimRapideCalc.test.js
import { describe, it, expect } from 'vitest';
import {
  posteMontant,
  lotSubtotal,
  estimateBaseTotal,
  aleasAmount,
  estimateTotalHT,
  lotHasValues,
  buildSummary,
} from '../utils/estimRapideCalc';

const poste = (qty, ratio) => ({ qty, ratio });
const lot = (postes, extra = {}) => ({ id: 'l1', key: 'k', label: 'Lot', postes, ...extra });

describe('posteMontant', () => {
  it('multiplie quantité × ratio', () => {
    expect(posteMontant(poste(10, 45))).toBe(450);
  });
  it('coerce les chaînes numériques', () => {
    expect(posteMontant(poste('12', '100'))).toBe(1200);
  });
  it('retourne 0 sur valeurs invalides ou manquantes', () => {
    expect(posteMontant(poste('abc', 50))).toBe(0);
    expect(posteMontant({})).toBe(0);
    expect(posteMontant(null)).toBe(0);
    expect(posteMontant(undefined)).toBe(0);
  });
});

describe('lotSubtotal', () => {
  it('somme les postes du lot', () => {
    expect(lotSubtotal(lot([poste(10, 45), poste(2, 100), poste(1, 800)]))).toBe(450 + 200 + 800);
  });
  it('retourne 0 pour un lot vide ou nul', () => {
    expect(lotSubtotal(lot([]))).toBe(0);
    expect(lotSubtotal(null)).toBe(0);
    expect(lotSubtotal({})).toBe(0);
  });
});

describe('estimateBaseTotal', () => {
  const estimate = {
    lots: [
      lot([poste(100, 45)]),                 // 4500
      lot([poste(50, 180), poste(3, 900)]),  // 9000 + 2700 = 11700
    ],
  };
  it('somme les sous-totaux de tous les lots', () => {
    expect(estimateBaseTotal(estimate)).toBe(4500 + 11700);
  });
  it("gère l'absence de lots", () => {
    expect(estimateBaseTotal({})).toBe(0);
    expect(estimateBaseTotal(null)).toBe(0);
  });
});

describe('aleasAmount', () => {
  const base = { lots: [lot([poste(100, 45)])] }; // base 4500
  it('retourne 0 si aléas désactivés', () => {
    expect(aleasAmount({ ...base, aleas: { enabled: false, percent: 10 } })).toBe(0);
    expect(aleasAmount(base)).toBe(0);
  });
  it('applique le pourcentage si activé', () => {
    expect(aleasAmount({ ...base, aleas: { enabled: true, percent: 10 } })).toBe(450);
  });
  it('traite un pourcentage invalide comme 0', () => {
    expect(aleasAmount({ ...base, aleas: { enabled: true, percent: 'x' } })).toBe(0);
  });
});

describe('estimateTotalHT', () => {
  it('additionne base + aléas', () => {
    const estimate = { lots: [lot([poste(100, 45)])], aleas: { enabled: true, percent: 10 } };
    expect(estimateTotalHT(estimate)).toBe(4500 + 450);
  });
  it('égale la base si aléas off', () => {
    const estimate = { lots: [lot([poste(100, 45)])] };
    expect(estimateTotalHT(estimate)).toBe(4500);
  });
});

describe('lotHasValues', () => {
  it('vrai si au moins un poste a qty > 0', () => {
    expect(lotHasValues(lot([poste(0, 45), poste(5, 10)]))).toBe(true);
  });
  it('faux si tous les postes sont à 0', () => {
    expect(lotHasValues(lot([poste(0, 45), poste(0, 10)]))).toBe(false);
    expect(lotHasValues(lot([]))).toBe(false);
    expect(lotHasValues(null)).toBe(false);
  });
});

describe('buildSummary', () => {
  const estimate = {
    lots: [
      lot([poste(100, 45)], { id: 'a', key: 'voirie', label: 'Voirie' }),  // 4500
      lot([poste(50, 180)], { id: 'b', key: 'assainEU', label: 'EU' }),    // 9000
    ],
    aleas: { enabled: true, percent: 10 },
  };
  it('expose un récap par lot + totaux', () => {
    const s = buildSummary(estimate);
    expect(s.lots).toHaveLength(2);
    expect(s.lots[0]).toMatchObject({ id: 'a', key: 'voirie', label: 'Voirie', subtotal: 4500, postesCount: 1 });
    expect(s.base).toBe(13500);
    expect(s.aleas).toBe(1350);
    expect(s.totalHT).toBe(14850);
  });
  it('robuste sur estimation vide', () => {
    expect(buildSummary({})).toEqual({ lots: [], base: 0, aleas: 0, totalHT: 0 });
  });
});
