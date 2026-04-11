// Tests pour src/utils/formatObsText.jsx
import { describe, it, expect } from 'vitest';
import { normalizeObsText, stripHtml, obsTextToHtml } from '../utils/formatObsText';

// ─── normalizeObsText ───────────────────────────────────────────────────────

describe('normalizeObsText', () => {
  it('retourne vide pour valeurs falsy', () => {
    expect(normalizeObsText('')).toBe('');
    expect(normalizeObsText(null)).toBe('');
    expect(normalizeObsText(undefined)).toBe('');
  });

  it('retourne le texte brut tel quel', () => {
    expect(normalizeObsText('Texte simple')).toBe('Texte simple');
  });

  it('convertit le markdown gras en HTML', () => {
    expect(normalizeObsText('**gras**')).toBe('<b>gras</b>');
  });

  it('convertit le markdown souligne en HTML', () => {
    expect(normalizeObsText('__souligne__')).toBe('<u>souligne</u>');
  });

  it('convertit le markdown fluo en HTML', () => {
    expect(normalizeObsText('==important==')).toBe('<mark>important</mark>');
  });

  it('convertit plusieurs formats dans un meme texte', () => {
    const input = '**gras** et __souligne__ et ==fluo==';
    const result = normalizeObsText(input);
    expect(result).toContain('<b>gras</b>');
    expect(result).toContain('<u>souligne</u>');
    expect(result).toContain('<mark>fluo</mark>');
  });

  it('ne modifie pas le HTML existant', () => {
    const html = '<b>deja en html</b>';
    expect(normalizeObsText(html)).toBe(html);
  });

  it('gere le markdown imbrique dans du texte', () => {
    const input = 'Debut **milieu gras** fin';
    expect(normalizeObsText(input)).toBe('Debut <b>milieu gras</b> fin');
  });
});

// ─── stripHtml ──────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('retourne vide pour valeurs falsy', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
  });

  it('retire les balises HTML', () => {
    expect(stripHtml('<b>gras</b>')).toBe('gras');
    expect(stripHtml('<u>souligne</u>')).toBe('souligne');
  });

  it('convertit <br> en saut de ligne', () => {
    expect(stripHtml('ligne1<br>ligne2')).toBe('ligne1\nligne2');
    expect(stripHtml('a<br/>b')).toBe('a\nb');
  });

  it('convertit les div/p en sauts de ligne', () => {
    expect(stripHtml('</div><div>next')).toContain('\n');
    expect(stripHtml('</p><p>next')).toContain('\n');
  });

  it('normalise le markdown avant de stripper', () => {
    expect(stripHtml('**bold** text')).toBe('bold text');
    expect(stripHtml('==highlight==')).toBe('highlight');
  });

  it('gere un texte complexe', () => {
    const html = '<b>Important</b>: <u>check</u><br>==urgent==';
    const result = stripHtml(html);
    expect(result).toContain('Important');
    expect(result).toContain('check');
    expect(result).toContain('urgent');
    expect(result).not.toMatch(/<[^>]+>/);
  });
});

// ─── obsTextToHtml ──────────────────────────────────────────────────────────

describe('obsTextToHtml', () => {
  it('retourne vide pour valeurs falsy', () => {
    expect(obsTextToHtml('')).toBe('');
    expect(obsTextToHtml(null)).toBe('');
  });

  it('convertit <mark> en span avec background', () => {
    const result = obsTextToHtml('<mark>fluo</mark>');
    expect(result).toContain('background:#fde68a');
    expect(result).not.toContain('<mark>');
  });

  it('normalise le markdown avant conversion', () => {
    const result = obsTextToHtml('==important==');
    expect(result).toContain('background:#fde68a');
    expect(result).toContain('important');
  });

  it('garde les autres balises intactes', () => {
    const result = obsTextToHtml('<b>gras</b> et <u>souligne</u>');
    expect(result).toContain('<b>gras</b>');
    expect(result).toContain('<u>souligne</u>');
  });
});
