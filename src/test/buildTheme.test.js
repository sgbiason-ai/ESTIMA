// Tests pour src/utils/pdf/buildTheme.js
import { describe, it, expect } from 'vitest';
import { buildTheme, DEFAULT_THEME } from '../utils/pdf/buildTheme';

// ─── DEFAULT_THEME ──────────────────────────────────────────────────────────

describe('DEFAULT_THEME', () => {
  it('a tous les champs requis', () => {
    const required = ['primary', 'accent', 'text', 'lightText', 'chapterBg',
      'secondary', 'borders', 'headerBg', 'tableBg', 'lightBg', 'categoryBg',
      'tableAlt', 'pse', 'white'];
    required.forEach(key => {
      expect(DEFAULT_THEME[key], `DEFAULT_THEME.${key}`).toBeDefined();
      expect(Array.isArray(DEFAULT_THEME[key]), `${key} is array`).toBe(true);
      expect(DEFAULT_THEME[key]).toHaveLength(3);
    });
  });

  it('white est [255, 255, 255]', () => {
    expect(DEFAULT_THEME.white).toEqual([255, 255, 255]);
  });
});

// ─── buildTheme ─────────────────────────────────────────────────────────────

describe('buildTheme', () => {
  it('retourne DEFAULT_THEME si pas de branding', () => {
    const theme = buildTheme(null);
    expect(theme.primary).toEqual(DEFAULT_THEME.primary);
    expect(theme.accent).toEqual(DEFAULT_THEME.accent);
  });

  it('retourne DEFAULT_THEME si branding sans colors', () => {
    const theme = buildTheme({ logo: 'test' });
    expect(theme.primary).toEqual(DEFAULT_THEME.primary);
  });

  it('calcule les variantes depuis branding.colors', () => {
    const branding = {
      colors: {
        primary: '#FF0000',   // rouge pur
        secondary: '#00FF00', // vert pur
        text: '#333333',
        subtle: '#999999',
      },
    };
    const theme = buildTheme(branding);
    expect(theme.primary).toEqual([255, 0, 0]);
    expect(theme.accent).toEqual([0, 255, 0]);
    expect(theme.text).toEqual([51, 51, 51]);
    // chapterBg = lightenRgb([255,0,0], 0.85) = [255, 217, 217]
    expect(theme.chapterBg[0]).toBe(255); // rouge reste 255
    expect(theme.chapterBg[1]).toBeGreaterThan(200); // eclaircissement
  });

  it('applique les overrides', () => {
    const theme = buildTheme(null, { custom: [1, 2, 3], borders: [0, 0, 0] });
    expect(theme.custom).toEqual([1, 2, 3]);
    expect(theme.borders).toEqual([0, 0, 0]); // override
  });

  it('applique les defaults pour generateur specifique', () => {
    const blueDefaults = { primary: [37, 99, 235] };
    const theme = buildTheme(null, {}, blueDefaults);
    expect(theme.primary).toEqual([37, 99, 235]);
  });

  it('branding prend priorite sur defaults', () => {
    const branding = { colors: { primary: '#FF0000' } };
    const blueDefaults = { primary: [37, 99, 235] };
    const theme = buildTheme(branding, {}, blueDefaults);
    expect(theme.primary).toEqual([255, 0, 0]); // branding gagne
  });

  it('overrides prend priorite sur tout', () => {
    const branding = { colors: { primary: '#FF0000' } };
    const theme = buildTheme(branding, { primary: [0, 0, 0] });
    expect(theme.primary).toEqual([0, 0, 0]); // override gagne
  });

  it('tous les champs lighten sont des arrays RGB valides', () => {
    const branding = { colors: { primary: '#286E55' } };
    const theme = buildTheme(branding);
    const lightenFields = ['chapterBg', 'secondary', 'borders', 'headerBg',
      'tableBg', 'lightBg', 'categoryBg', 'tableAlt'];
    lightenFields.forEach(key => {
      expect(theme[key], key).toHaveLength(3);
      theme[key].forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      });
    });
  });
});
