// src/test/tpPriceCompute.test.js
import { describe, it, expect } from 'vitest';
import {
  computeDetail, ressourceCosts, fournitureQty, fournitureCost,
  sousTraitanceQty, sousTraitanceCost, transportQty, transportCost, transportCamions,
  emptyDetail, defaultCoefficients, effectiveDuree, rendementFromDuree, DEFAULT_COEF,
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
  it('coût ressource = nombre × durée × somme (Personnel + A + E + I + Location)', () => {
    expect(ressourceCosts({ nombre: 1, puJour: 520, amort: 950 }, 1)).toBe(1470);
    expect(ressourceCosts({ nombre: 3, loc: 200 }, 1)).toBe(600);
    // durée totale (fallback) 2 jours → coût doublé
    expect(ressourceCosts({ nombre: 1, puJour: 520, amort: 950 }, 2)).toBe(2940);
    // durée FORCÉE sur la ligne (flag dureeForced) → prioritaire sur la durée totale
    expect(ressourceCosts({ nombre: 1, duree: 1, dureeForced: true, puJour: 520, amort: 950 }, 5)).toBe(1470);
    // un `duree` résiduel SANS flag est ignoré → durée totale (fallback) utilisée
    expect(ressourceCosts({ nombre: 1, duree: 1, puJour: 520, amort: 950 }, 2)).toBe(2940);
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

  it('totaux secs par poste (somme complète, sans séparation chauffeur)', () => {
    expect(res.sec.materiel).toBeCloseTo(2915, 2);     // 1470 + 500 + 345 + 600
    expect(res.sec.mo).toBeCloseTo(1170, 2);           // 450 (chef+véhicule) + 720 (OS)
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
    expect(r2x.sec.materiel).toBeCloseTo(5830, 2);
    expect(r2x.sec.mo).toBeCloseTo(2340, 2);
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

describe('tpPriceCompute — sous-traitance', () => {
  it('quantité unitaire 1 par défaut si même unité (sous-traitance de l\'ouvrage entier)', () => {
    expect(sousTraitanceQty({ unit: 'm2' }, 250, 'M2')).toBe(250); // insensible à la casse
    expect(sousTraitanceCost({ unit: 'm2', puBareme: 10 }, 250, 'M2')).toBe(2500);
  });
  it('quantité totale = quantité unitaire × quantité d\'ouvrage', () => {
    expect(sousTraitanceQty({ qteUnitaire: 0.5 }, 200, 'M2')).toBe(100);
    expect(sousTraitanceCost({ qteUnitaire: 0.5, puForce: 8 }, 200, 'M2')).toBe(800);
  });
  it('unité différente sans quantité unitaire → 0 (à renseigner)', () => {
    expect(sousTraitanceQty({ unit: 'U' }, 250, 'M2')).toBe(0);
  });
});

describe('tpPriceCompute — transport (contenance / voyages / camions)', () => {
  // Camion 13 T, 5 voyages/j, coût 500 €/j ; à transporter : 300 T (article en T).
  const camion = { unit: 'T', contenance: 13, voyagesParJour: 5, coutJour: 500 };
  it('quantité transportée = quantité d\'ouvrage (ou × épaisseur × densité)', () => {
    expect(transportQty(camion, 300)).toBe(300);
    expect(transportQty({ epaisseur: 0.09, densite: 2.4 }, 1390)).toBeCloseTo(300.24, 2);
  });
  it('coût = camions-jours × coût journalier', () => {
    // camions-jours = 300 / (13 × 5) = 4.615… ; coût = ×500 ≈ 2307,69 €
    expect(transportCost(camion, 300)).toBeCloseTo((300 / 65) * 500, 2);
  });
  it('nombre de camions en parallèle = camions-jours / durée', () => {
    // camions-jours ≈ 4.615 ; sur 2 jours → ≈ 2.31 camions
    expect(transportCamions(camion, 300, 2)).toBeCloseTo((300 / 65) / 2, 2);
  });
  it('contenance ou voyages nuls → coût 0', () => {
    expect(transportCost({ contenance: 0, voyagesParJour: 5, coutJour: 500 }, 300)).toBe(0);
  });
});

describe('tpPriceCompute — durée ↔ rendement (liés par la quantité)', () => {
  it('durée = quantité / rendement', () => {
    expect(effectiveDuree({ rendement: 1390 }, 1390)).toBe(1);
    expect(effectiveDuree({ rendement: 695 }, 1390)).toBe(2);
  });
  it('rendement = quantité / durée (sens inverse)', () => {
    expect(rendementFromDuree(1390, 1)).toBe(1390);
    expect(rendementFromDuree(1390, 2)).toBe(695);
  });
  it('aller-retour durée → rendement → durée cohérent', () => {
    const rdt = rendementFromDuree(250, 2); // 125
    expect(effectiveDuree({ rendement: rdt }, 250)).toBe(2);
  });
  it('valeurs nulles → 0', () => {
    expect(effectiveDuree({ rendement: 0 }, 1390)).toBe(0);
    expect(rendementFromDuree(1390, 0)).toBe(0);
  });
});
