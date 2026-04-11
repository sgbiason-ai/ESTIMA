// Tests pour src/utils/colorHelpers.js
import { describe, it, expect } from 'vitest';
import { hexToRgbString, lightenHex } from '../utils/colorHelpers';

// ─── hexToRgbString ─────────────────────────────────────────────────────────

describe('hexToRgbString', () => {
  it('convertit un hex en string RGB', () => {
    expect(hexToRgbString('#286E55')).toBe('40, 110, 85');
  });

  it('gere hex sans #', () => {
    expect(hexToRgbString('FF0000')).toBe('255, 0, 0');
  });

  it('retourne fallback pour null', () => {
    expect(hexToRgbString(null)).toBe('40, 110, 85');
    expect(hexToRgbString('')).toBe('40, 110, 85');
  });

  it('accepte un fallback custom', () => {
    expect(hexToRgbString(null, '0, 0, 0')).toBe('0, 0, 0');
  });

  it('retourne fallback pour hex invalide', () => {
    expect(hexToRgbString('ZZZ')).toBe('40, 110, 85');
  });
});

// ─── lightenHex ─────────────────────────────────────────────────────────────

describe('lightenHex', () => {
  it('retourne un string rgb()', () => {
    const result = lightenHex('#000000', 0.5);
    expect(result).toBe('rgb(128, 128, 128)');
  });

  it('eclaircit avec facteur par defaut (0.9)', () => {
    const result = lightenHex('#000000');
    expect(result).toBe('rgb(230, 230, 230)');
  });

  it('blanc reste blanc', () => {
    expect(lightenHex('#FFFFFF', 0.5)).toBe('rgb(255, 255, 255)');
  });

  it('retourne fallback pour null', () => {
    expect(lightenHex(null)).toBe('rgb(230, 240, 235)');
    expect(lightenHex('')).toBe('rgb(230, 240, 235)');
  });

  it('retourne fallback pour hex invalide', () => {
    expect(lightenHex('XYZ')).toBe('rgb(230, 240, 235)');
  });
});
