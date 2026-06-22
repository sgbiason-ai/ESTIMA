// src/test/tpPriceCompute.test.js
import { describe, it, expect } from 'vitest';
import {
  computeDetail, ressourceCosts, fournitureQty, fournitureCost,
  emptyDetail, defaultCoefficients, effectiveDuree, DEFAULT_COEF,
} from '../utils/tp/tpPriceCompute';

// Reproduit l'article 1 du fichier « Sous-détail » : « Enrobés sur 0.05 », 1390 m².
function articleEnrobes() {
  const d = emptyDetail();
  d.rendement = 1390; d.duree = 1;
  // Durée par ligne laissée vide → durée totale calculée (= quantité / rendement).
  d.materiel = [
    { nombre: 1, puJour: 520, amort: 950, entret: 0, cons: 0, loc: 0 }, // Finisseur
    { nombre: 1, puJour: 0,   amort: 0,   entret: 0, cons: 0, loc: 500 }, // Double bille
    { nombre: 1, puJour: 240, amort: 105, entret: 0, cons: 0, loc: 0 }, // Cylindre
    { nombre: 3, puJour: 0,   amort: 0,   entret: 0, cons: 0, loc: 200 }, // Transfert
  ];
  d.mo = [
    { nombre: 1, puJour: 400, amort: 50, entret: 0, cons: 0, loc: 0 }, // Chef + véhicule
    { nombre: 3, puJour: 240, amort: 0,  entret: 0, cons: 0, loc: 0 }, // OS
  ];
  d.fourniture = [
    { epaisseur: 0.09, densite: 2.4, puBareme: 49.66, puForce: 49.5 }, // Grave Bitume
  ];
  return d;
}

describe('tpPriceCompute — coûts par ligne', () => {
  it('décompose part personnel / part matériel (sur la durée totale)', () => {
    expect(ressourceCosts({ nombre: 1, puJour: 520, amort: 950 }, 1))
      .toEqual({ perso: 520, mat: 950 });
    expect(ressourceCosts({ nombre: 3, loc: 200 }, 1))
      .toEqual({ perso: 0, mat: 600 });
    // durée totale (fallback) 2 jours → coût doublé
    expect(ressourceCosts({ nombre: 1, puJour: 520, amort: 950 }, 2))
      .toEqual({ perso: 1040, mat: 1900 });
    // durée FORCÉE sur la ligne (flag dureeForced) → prioritaire sur la durée totale
    expect(ressourceCosts({ nombre: 1, duree: 1, dureeForced: true, puJour: 520, amort: 950 }, 5))
      .toEqual({ perso: 520, mat: 950 });
    // un `duree` résiduel SANS flag est ignoré → durée totale (fallback) utilisée
    expect(ressourceCosts({ nombre: 1, duree: 1, puJour: 520, amort: 950 }, 2))
      .toEqual({ perso: 1040, mat: 1900 });
  });

  it('quantité fourniture = quantité × épaisseur × densité', () => {
    expect(fournitureQty({ epaisseur: 0.09, densite: 2.4 }, 1390)).toBeCloseTo(300.24, 2);
    // sans épaisseur/densité → quantité directe
    expect(fournitureQty({ qte: 12 }, 1390)).toBe(12);
  });

  it('coût fourniture utilise le PU forcé en priorité', () => {
    expect(fournitureCost({ epaisseur: 0.09, densite: 2.4, puBareme: 49.66, puForce: 49.5 }, 1390))
      .toBeCloseTo(14861.88, 2);
  });
});

describe('tpPriceCompute — sous-détail complet (Enrobés sur 0.05)', () => {
  const res = computeDetail(articleEnrobes(), 1390, defaultCoefficients());

  it('totaux secs par poste conformes au fichier', () => {
    expect(res.sec.mo).toBeCloseTo(1880, 2);          // 760 (matériel) + 1120 (MO)
    expect(res.sec.materiel).toBeCloseTo(2205, 2);     // 2155 + 50 (véhicule chef)
    expect(res.sec.fourniture).toBeCloseTo(14861.88, 2);
    expect(res.sec.soustraitance).toBe(0);
    expect(res.sec.transport).toBe(0);
  });

  it('déboursé sec et PU sec', () => {
    expect(res.deboursecSec).toBeCloseTo(18946.88, 2);
    expect(res.puSec).toBeCloseTo(13.63, 2);
  });

  it('prix de vente = déboursé × coefficient par poste', () => {
    // coef 1.15 uniforme (arrondis par poste → tolérance au centime près)
    expect(res.pvTotalTache).toBeCloseTo(18946.88 * DEFAULT_COEF, 0);
    expect(res.puVente).toBeCloseTo(13.63 * DEFAULT_COEF, 1);
    expect(res.puRetenu).toBe(res.puVente);
  });

  it('PV forcé écrase le PU retenu', () => {
    const d = articleEnrobes(); d.pvForce = 15.67;
    const r = computeDetail(d, 1390);
    expect(r.puRetenu).toBe(15.67);
    expect(r.totalVente).toBeCloseTo(15.67 * 1390, 2);
  });
});

describe('tpPriceCompute — déboursé = coût sur la durée totale / quantité', () => {
  it('le coût équipe court sur la durée totale (quantité / rendement)', () => {
    // Même article, quantité doublée (2780 m²), rendement inchangé (1390) → durée 2 j.
    const r2x = computeDetail(articleEnrobes(), 2780, defaultCoefficients());
    expect(r2x.duree).toBe(2);
    // Matériel/MO doublent (2 jours), fournitures doublent (quantité ×2)…
    expect(r2x.sec.mo).toBeCloseTo(3760, 2);
    expect(r2x.sec.materiel).toBeCloseTo(4410, 2);
    expect(r2x.sec.fourniture).toBeCloseTo(29723.76, 2);
    expect(r2x.deboursecSec).toBeCloseTo(37893.76, 2);
    // …donc le PU sec reste identique (invariant à la quantité, rendement fixe).
    expect(r2x.puSec).toBeCloseTo(13.63, 2);
  });

  it('rendement nul → durée 0 → coût équipe nul', () => {
    const d = articleEnrobes(); d.rendement = 0; d.dureeForced = false;
    const r = computeDetail(d, 1390);
    expect(r.sec.mo).toBe(0);
    expect(r.sec.materiel).toBe(0);
    // les fournitures (basées sur la quantité) restent comptées
    expect(r.sec.fourniture).toBeCloseTo(14861.88, 2);
  });
});

describe('tpPriceCompute — durée effective', () => {
  it('durée = quantité / rendement quand non forcée', () => {
    expect(effectiveDuree({ rendement: 1390, dureeForced: false }, 1390)).toBe(1);
    expect(effectiveDuree({ rendement: 695, dureeForced: false }, 1390)).toBe(2);
  });
  it('durée forcée prioritaire', () => {
    expect(effectiveDuree({ rendement: 1390, duree: 3, dureeForced: true }, 1390)).toBe(3);
  });
  it('rendement nul → durée 0', () => {
    expect(effectiveDuree({ rendement: 0, dureeForced: false }, 1390)).toBe(0);
  });
});
