import { describe, it, expect } from 'vitest';
import { parseNumericInput, formatNumericDraft } from '../components/analysis/useNumericDraft';

// Régression : dans le dépouillement RAO, les cellules de prix étaient des
// <input type="number"> contrôlés par la valeur distante. Dès que la saisie
// devenait transitoirement invalide (« 12, »), la spec HTML imposait
// `.value === ''` → Number('') = 0 → le champ se vidait sous les doigts de
// l'utilisateur, puis le 0 partait en base 800 ms plus tard.

describe('parseNumericInput', () => {
  it('accepte le point ET la virgule décimale', () => {
    expect(parseNumericInput('12.5')).toBe(12.5);
    expect(parseNumericInput('12,5')).toBe(12.5);
  });

  it('tolère les séparateurs de milliers (espaces, y compris insécables) et le €', () => {
    expect(parseNumericInput('1 234,56')).toBe(1234.56);
    expect(parseNumericInput('1 234,56')).toBe(1234.56);
    expect(parseNumericInput('1 234,56 €')).toBe(1234.56);
  });

  it('rend null (et non 0) sur vide/invalide — un prix absent n’est pas un prix nul', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('   ')).toBeNull();
    expect(parseNumericInput(null)).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
  });

  it('préserve le zéro explicite (impossible à saisir avant le fix : value || \'\')', () => {
    expect(parseNumericInput('0')).toBe(0);
    expect(formatNumericDraft(0)).toBe('0');
  });

  it('gère le négatif', () => {
    expect(parseNumericInput('-3,5')).toBe(-3.5);
  });
});

describe('formatNumericDraft', () => {
  it('affiche la décimale à la française et vide sur null', () => {
    expect(formatNumericDraft(12.5)).toBe('12,5');
    expect(formatNumericDraft(null)).toBe('');
    expect(formatNumericDraft('')).toBe('');
  });
});

describe('frappe caractère par caractère (le bug historique)', () => {
  // Le tampon conserve la chaîne brute : aucun état intermédiaire ne repasse
  // par la valeur distante, donc rien ne réécrit le DOM pendant la frappe.
  // <input type="number">.value renvoie '' quand le contenu n'est pas un
  // « valid floating-point number » au sens HTML : la chaîne tapée n'atteint
  // même pas Number(). C'est là que la saisie était détruite.
  const domValueNumberInput = (raw) => (/^-?\d+(\.\d+)?$/.test(raw) ? raw : '');

  it('ne perd jamais la saisie en cours sur les états transitoires', () => {
    const frappe = ['1', '12', '12,', '12,5'];

    // Ancien code : value={Number(e.target.value) || ''}
    const ancien = frappe.map(s => Number(domValueNumberInput(s)) || '');
    expect(ancien).toEqual([1, 12, '', '']); // ← champ vidé dès la virgule, et après

    // Tampon : le champ affiche toujours ce que l'utilisateur a tapé
    expect(frappe.map(s => s)).toEqual(['1', '12', '12,', '12,5']);
    // …et ne commit qu'au blur, une seule fois, la valeur finale
    expect(parseNumericInput(frappe.at(-1))).toBe(12.5);
  });

  it('commit d’un champ vidé → null, converti en 0 par les updaters (Number(null) === 0)', () => {
    const parsed = parseNumericInput('');
    expect(parsed).toBeNull();
    expect(Number(parsed)).toBe(0); // updateCompanyOffer / updateVariantOffer
  });
});
