import { describe, it, expect } from 'vitest';
import { htmlToPlainText, htmlToRichBlocks, isRichTextEmpty } from '../utils/richText';

describe('htmlToPlainText', () => {
  it('retourne une chaîne vide pour une entrée vide / nulle', () => {
    expect(htmlToPlainText('')).toBe('');
    expect(htmlToPlainText(null)).toBe('');
    expect(htmlToPlainText('<p></p>')).toBe('');
  });

  it('convertit les <br> et </p> en sauts de ligne', () => {
    expect(htmlToPlainText('<p>Ligne 1</p><p>Ligne 2</p>')).toBe('Ligne 1\nLigne 2');
    expect(htmlToPlainText('A<br>B')).toBe('A\nB');
  });

  it('préfixe les <li> par une puce', () => {
    const out = htmlToPlainText('<ul><li>Un</li><li>Deux</li></ul>');
    expect(out).toBe('• Un\n• Deux');
  });

  it('retire le gras / souligné mais conserve le texte', () => {
    expect(htmlToPlainText('<b>Gras</b> et <u>souligné</u>')).toBe('Gras et souligné');
  });

  it('normalise les espaces et les retours à la ligne multiples', () => {
    expect(htmlToPlainText('<p>A</p><p></p><p></p><p>B</p>')).toBe('A\n\nB');
  });
});

describe('htmlToRichBlocks', () => {
  it('retourne un tableau vide pour une entrée vide', () => {
    expect(htmlToRichBlocks('')).toEqual([]);
    expect(htmlToRichBlocks(null)).toEqual([]);
  });

  it('marque le gras et le souligné au niveau du run', () => {
    const blocks = htmlToRichBlocks('Normal <b>gras</b> <u>souligné</u>');
    const runs = blocks.flatMap((b) => b.runs);
    expect(runs.find((r) => r.text.includes('gras')).bold).toBe(true);
    expect(runs.find((r) => r.text.includes('souligné')).underline).toBe(true);
    expect(runs.find((r) => r.text.includes('Normal')).bold).toBe(false);
  });

  it('produit un bloc de type "li" par puce', () => {
    const blocks = htmlToRichBlocks('<ul><li>Un</li><li><b>Deux</b></li></ul>');
    expect(blocks.map((b) => b.type)).toEqual(['li', 'li']);
    expect(blocks[1].runs[0].bold).toBe(true);
  });

  it('fusionne les runs adjacents de même style', () => {
    const blocks = htmlToRichBlocks('<b>A</b><b>B</b>');
    expect(blocks[0].runs).toHaveLength(1);
    expect(blocks[0].runs[0].text).toBe('AB');
  });
});

describe('isRichTextEmpty', () => {
  it('compte comme vides les résidus contentEditable', () => {
    ['', null, undefined, '<div><br></div>', '<p></p>', '&nbsp; ', '<div>&nbsp;</div>', '  \n '].forEach(v => {
      expect(isRichTextEmpty(v)).toBe(true);
    });
  });
  it('détecte le contenu réel, riche ou plain', () => {
    ['texte', '<b>gras</b>', '<ul><li>point</li></ul>', 'ligne\nligne'].forEach(v => {
      expect(isRichTextEmpty(v)).toBe(false);
    });
  });
});
