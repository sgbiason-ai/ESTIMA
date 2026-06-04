// src/test/financeFormat.test.js
import { describe, it, expect } from 'vitest';
import { roundEuro, computeVatBreakdown, DEFAULT_TVA_RATE } from '../utils/financeFormat';

describe('financeFormat — roundEuro', () => {
  it('arrondit au centime', () => {
    expect(roundEuro(2.344)).toBe(2.34);
    expect(roundEuro(2.346)).toBe(2.35);
    expect(roundEuro(10)).toBe(10);
    expect(roundEuro(1234.5)).toBe(1234.5);
  });

  it('renvoie 0 pour les valeurs non finies', () => {
    expect(roundEuro(NaN)).toBe(0);
    expect(roundEuro(Infinity)).toBe(0);
    expect(roundEuro(undefined)).toBe(0);
    expect(roundEuro('abc')).toBe(0);
  });
});

describe('financeFormat — computeVatBreakdown', () => {
  it('ventile HT/TVA/TTC à 20 % par défaut', () => {
    expect(computeVatBreakdown(100)).toEqual({ ht: 100, tva: 20, ttc: 120 });
  });

  it('garantit TTC = HT + TVA (identité opposable sur un acte d\'engagement)', () => {
    for (const total of [0, 0.01, 1, 99.99, 100.005, 1234.56, 7654.321, 250000.5]) {
      const { ht, tva, ttc } = computeVatBreakdown(total);
      expect(roundEuro(ht + tva)).toBe(ttc);
    }
  });

  it('reste cohérent là où le calcul naïf (3 arrondis indépendants) peut diverger (audit F1)', () => {
    // Balaye des totaux à fraction de centime (cas des sommes exactes RAO / Excel pré-F3).
    let naiveDivergences = 0;
    for (let i = 1; i <= 20000; i++) {
      const total = i * 0.001;
      // Calcul naïf historique : HT, TVA, TTC arrondis indépendamment depuis la valeur brute.
      if (roundEuro(total) + roundEuro(total * 0.2) !== roundEuro(total * 1.2)) naiveDivergences++;
      // Le helper garantit TTC = HT + TVA : l'identité affichée tient toujours.
      const bd = computeVatBreakdown(total);
      expect(roundEuro(bd.ht + bd.tva)).toBe(bd.ttc);
    }
    expect(naiveDivergences).toBeGreaterThan(0); // la classe de bug F1 existe réellement
  });

  it('supporte un taux réduit (préfigure F2 — taux configurable)', () => {
    expect(computeVatBreakdown(100, 0.055)).toEqual({ ht: 100, tva: 5.5, ttc: 105.5 });
    expect(computeVatBreakdown(200, 0.10)).toEqual({ ht: 200, tva: 20, ttc: 220 });
  });

  it('retombe sur le taux par défaut si le taux est invalide', () => {
    expect(computeVatBreakdown(100, NaN)).toEqual({ ht: 100, tva: 20, ttc: 120 });
    expect(DEFAULT_TVA_RATE).toBe(0.20);
  });
});
