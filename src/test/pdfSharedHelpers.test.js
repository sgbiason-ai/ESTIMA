// Tests pour src/utils/pdf/pdfSharedHelpers.js
import { describe, it, expect } from 'vitest';
import {
  hexToRgbArray, lightenRgb, darkenRgb,
  formatDateFr, formatDateLong, sanitizeFilename,
  cleanText, formatNumberFr,
} from '../utils/pdf/pdfSharedHelpers';

// ─── hexToRgbArray ──────────────────────────────────────────────────────────

describe('hexToRgbArray', () => {
  it('convertit un hex standard avec #', () => {
    expect(hexToRgbArray('#FF0000')).toEqual([255, 0, 0]);
    expect(hexToRgbArray('#00FF00')).toEqual([0, 255, 0]);
    expect(hexToRgbArray('#0000FF')).toEqual([0, 0, 255]);
  });

  it('convertit un hex sans #', () => {
    expect(hexToRgbArray('286E55')).toEqual([40, 110, 85]);
  });

  it('gere les couleurs mixtes', () => {
    expect(hexToRgbArray('#1E3A8A')).toEqual([30, 58, 138]);
    expect(hexToRgbArray('#FFFFFF')).toEqual([255, 255, 255]);
    expect(hexToRgbArray('#000000')).toEqual([0, 0, 0]);
  });

  it('retourne null pour valeurs invalides', () => {
    expect(hexToRgbArray(null)).toBeNull();
    expect(hexToRgbArray(undefined)).toBeNull();
    expect(hexToRgbArray('')).toBeNull();
    expect(hexToRgbArray(123)).toBeNull();
    expect(hexToRgbArray('#FFF')).toBeNull(); // trop court
    expect(hexToRgbArray('#GGHHII')).toEqual([NaN, NaN, NaN]); // hex invalide
  });

  it('est insensible a la casse', () => {
    expect(hexToRgbArray('#ff0000')).toEqual([255, 0, 0]);
    expect(hexToRgbArray('#Ff00fF')).toEqual([255, 0, 255]);
  });
});

// ─── lightenRgb ─────────────────────────────────────────────────────────────

describe('lightenRgb', () => {
  it('eclaircit avec facteur par defaut (0.85)', () => {
    const result = lightenRgb([40, 110, 85]);
    expect(result).toEqual([223, 233, 230]); // Math.round(c + (255-c)*0.85)
  });

  it('eclaircit avec facteur 0', () => {
    expect(lightenRgb([100, 100, 100], 0)).toEqual([100, 100, 100]);
  });

  it('eclaircit avec facteur 1 → blanc', () => {
    expect(lightenRgb([100, 100, 100], 1)).toEqual([255, 255, 255]);
  });

  it('eclaircit le noir', () => {
    expect(lightenRgb([0, 0, 0], 0.5)).toEqual([128, 128, 128]);
  });

  it('ne change pas le blanc', () => {
    expect(lightenRgb([255, 255, 255], 0.5)).toEqual([255, 255, 255]);
  });
});

// ─── darkenRgb ──────────────────────────────────────────────────────────────

describe('darkenRgb', () => {
  it('assombrit avec facteur par defaut (0.15)', () => {
    const result = darkenRgb([200, 200, 200]);
    expect(result).toEqual([170, 170, 170]);
  });

  it('assombrit avec facteur 0 → inchange', () => {
    expect(darkenRgb([100, 100, 100], 0)).toEqual([100, 100, 100]);
  });

  it('assombrit avec facteur 1 → noir', () => {
    expect(darkenRgb([100, 100, 100], 1)).toEqual([0, 0, 0]);
  });

  it('ne change pas le noir', () => {
    expect(darkenRgb([0, 0, 0], 0.5)).toEqual([0, 0, 0]);
  });
});

// ─── formatDateFr ───────────────────────────────────────────────────────────

describe('formatDateFr', () => {
  it('formate une date ISO en DD/MM/YYYY', () => {
    expect(formatDateFr('2026-04-04')).toBe('04/04/2026');
    expect(formatDateFr('2025-12-31')).toBe('31/12/2025');
    expect(formatDateFr('2024-01-01')).toBe('01/01/2024');
  });

  it('retourne vide pour valeurs falsy', () => {
    expect(formatDateFr('')).toBe('');
    expect(formatDateFr(null)).toBe('');
    expect(formatDateFr(undefined)).toBe('');
  });
});

// ─── formatDateLong ─────────────────────────────────────────────────────────

describe('formatDateLong', () => {
  it('formate en format long francais', () => {
    const result = formatDateLong('2026-04-04');
    expect(result).toMatch(/samedi/i);
    expect(result).toMatch(/4/);
    expect(result).toMatch(/avril/i);
    expect(result).toMatch(/2026/);
  });

  it('retourne vide pour valeurs falsy', () => {
    expect(formatDateLong('')).toBe('');
    expect(formatDateLong(null)).toBe('');
  });
});

// ─── sanitizeFilename ───────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('retire les accents', () => {
    expect(sanitizeFilename('Résumé été')).toBe('Resume_ete');
  });

  it('retire les caracteres speciaux', () => {
    expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file_name');
  });

  it('condense les underscores multiples', () => {
    expect(sanitizeFilename('a   b   c')).toBe('a_b_c');
  });

  it('tronque a 40 caracteres', () => {
    const long = 'A'.repeat(60);
    expect(sanitizeFilename(long).length).toBe(40);
  });

  it('retourne Document pour valeurs invalides', () => {
    expect(sanitizeFilename(null)).toBe('Document');
    expect(sanitizeFilename('')).toBe('Document');
    expect(sanitizeFilename(123)).toBe('Document');
  });

  it('retire les underscores en debut/fin', () => {
    expect(sanitizeFilename(' test ')).toBe('test');
  });
});

// ─── cleanText ──────────────────────────────────────────────────────────────

describe('cleanText', () => {
  it('retire les retours a la ligne', () => {
    expect(cleanText('ligne1\nligne2\rligne3')).toBe('ligne1 ligne2 ligne3');
  });

  it('trim les espaces', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });

  it('retourne vide pour non-string', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(123)).toBe('');
  });

  it('gere les retours multiples', () => {
    expect(cleanText('a\n\n\nb')).toBe('a b');
  });
});

// ─── formatNumberFr ─────────────────────────────────────────────────────────

describe('formatNumberFr', () => {
  it('formate un entier avec decimales', () => {
    expect(formatNumberFr(1234)).toBe('1 234,00');
  });

  it('formate un decimal', () => {
    expect(formatNumberFr(1234.56)).toBe('1 234,56');
  });

  it('formate un grand nombre', () => {
    expect(formatNumberFr(1234567.89)).toBe('1 234 567,89');
  });

  it('formate zero', () => {
    expect(formatNumberFr(0)).toBe('0,00');
  });

  it('formate un nombre negatif', () => {
    expect(formatNumberFr(-1234.56)).toBe('-1 234,56');
  });

  it('accepte une string numerique', () => {
    expect(formatNumberFr('5000')).toBe('5 000,00');
  });

  it('retourne tiret pour valeurs invalides', () => {
    expect(formatNumberFr(null)).toBe('-');
    expect(formatNumberFr(undefined)).toBe('-');
    expect(formatNumberFr('')).toBe('-');
    expect(formatNumberFr('abc')).toBe('-');
    expect(formatNumberFr(NaN)).toBe('-');
  });

  it('arrondit a 2 decimales', () => {
    expect(formatNumberFr(1.999)).toBe('2,00');
    expect(formatNumberFr(1.005)).toBe('1,00'); // JS floating point: 1.005 rounds to 1.00
  });
});
