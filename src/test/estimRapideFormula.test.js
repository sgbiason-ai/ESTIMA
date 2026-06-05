// src/test/estimRapideFormula.test.js
import { describe, it, expect } from 'vitest';
import {
  isFormula,
  normalizeFormula,
  flattenPostes,
  buildRefIndex,
  formulaToDisplay,
  displayToFormula,
  resolveEstimate,
} from '../utils/estimRapideFormula';

const poste = (id, qty, { label = '', ratio = 1, formula } = {}) => ({ id, label, unit: 'u', qty, ratio, formula });
const est = (postes) => ({ lots: [{ id: 'L1', key: 'k', label: 'Lot', postes }] });

describe('isFormula', () => {
  it('détecte les formules', () => {
    expect(isFormula('=10*2')).toBe(true);
    expect(isFormula('  =1+1')).toBe(true);
    expect(isFormula('120')).toBe(false);
    expect(isFormula(120)).toBe(false);
    expect(isFormula(null)).toBe(false);
  });
});

describe('normalizeFormula', () => {
  it('convertit les décimales françaises entre chiffres', () => {
    expect(normalizeFormula('=10*0,3')).toBe('=10*0.3');
    expect(normalizeFormula('=[A]*1,5+2,25')).toBe('=[A]*1.5+2.25');
  });
  it('laisse les non-formules intactes', () => {
    expect(normalizeFormula('120')).toBe('120');
  });
});

describe('flattenPostes', () => {
  it('aplatit avec libellé ou repli P{n}', () => {
    const flat = flattenPostes(est([poste('a', 1, { label: 'Surface' }), poste('b', 2)]));
    expect(flat).toHaveLength(2);
    expect(flat[0].label).toBe('Surface');
    expect(flat[1].label).toBe('P2'); // repli sur l'ordinal global
  });
  it('robuste sur estimation vide', () => {
    expect(flattenPostes({})).toEqual([]);
    expect(flattenPostes(null)).toEqual([]);
  });
});

describe('buildRefIndex', () => {
  it('mappe id→label et nom→id', () => {
    const { idToLabel, nameToId } = buildRefIndex(est([poste('a', 1, { label: 'Surface' })]));
    expect(idToLabel.get('a')).toBe('Surface');
    expect(nameToId.get('surface')).toBe('a');
  });
});

describe('formulaToDisplay / displayToFormula', () => {
  const e = est([poste('a', 1, { label: 'Surface' }), poste('b', 2, { label: 'Largeur' })]);
  const { idToLabel, nameToId } = buildRefIndex(e);

  it('formule stockée → affichage lisible', () => {
    expect(formulaToDisplay('={a}*{b}', idToLabel)).toBe('=[Surface]*[Largeur]');
  });
  it('affichage lisible → formule stockée', () => {
    expect(displayToFormula('=[Surface]*[Largeur]', nameToId)).toBe('={a}*{b}');
  });
  it('aller-retour stable', () => {
    const raw = '={a}*0.3+{b}';
    expect(displayToFormula(formulaToDisplay(raw, idToLabel), nameToId)).toBe(raw);
  });
  it('sessionMap prioritaire (désignations en double)', () => {
    // deux postes même libellé → nameToId garde le dernier (b2), sessionMap force le 1er (a1)
    const dup = est([poste('a1', 1, { label: 'Tranchée' }), poste('b2', 2, { label: 'Tranchée' })]);
    const idx = buildRefIndex(dup);
    const session = new Map([['Tranchée', 'a1']]);
    expect(displayToFormula('=[Tranchée]*2', idx.nameToId)).toBe('={b2}*2');           // sans session → dernier
    expect(displayToFormula('=[Tranchée]*2', idx.nameToId, session)).toBe('={a1}*2');   // avec session → exact
  });
  it('laisse les non-formules telles quelles', () => {
    expect(formulaToDisplay('120', idToLabel)).toBe('120');
    expect(displayToFormula('120', nameToId)).toBe('120');
  });
});

describe('resolveEstimate', () => {
  it('résout une référence simple', () => {
    const { estimate, changed } = resolveEstimate(est([
      poste('b', 10),
      poste('a', 0, { formula: '={b}*2' }),
    ]));
    expect(changed).toBe(true);
    expect(estimate.lots[0].postes[1].qty).toBe(20);
  });

  it('résout des dépendances chaînées (multi-passes)', () => {
    const { estimate } = resolveEstimate(est([
      poste('c', 0, { formula: '={a}+5' }),
      poste('a', 0, { formula: '={b}*2' }),
      poste('b', 10),
    ]));
    const byId = Object.fromEntries(estimate.lots[0].postes.map(p => [p.id, p.qty]));
    expect(byId.a).toBe(20);
    expect(byId.c).toBe(25);
  });

  it('gère les décimales françaises', () => {
    const { estimate } = resolveEstimate(est([
      poste('b', 10),
      poste('a', 0, { formula: '={b}*0,5' }),
    ]));
    expect(estimate.lots[0].postes[1].qty).toBe(5);
  });

  it('résout les références par désignation', () => {
    const { estimate } = resolveEstimate(est([
      poste('b', 8, { label: 'Largeur' }),
      poste('a', 0, { label: 'Surface', formula: '=[Largeur]*3' }),
    ]));
    expect(estimate.lots[0].postes[1].qty).toBe(24);
  });

  it('sans formule : inchangé', () => {
    const input = est([poste('a', 5), poste('b', 3)]);
    const { estimate, changed } = resolveEstimate(input);
    expect(changed).toBe(false);
    expect(estimate).toBe(input); // même référence (aucune copie)
  });

  it('référence circulaire : pas de boucle infinie, valeur finie', () => {
    const { estimate } = resolveEstimate(est([poste('a', 0, { formula: '={a}+1' })]));
    const q = estimate.lots[0].postes[0].qty;
    expect(Number.isFinite(q)).toBe(true);
  });

  it('robuste sur estimation vide', () => {
    expect(resolveEstimate({}).changed).toBe(false);
  });
});
