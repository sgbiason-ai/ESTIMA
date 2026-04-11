// Tests pour les constantes exportées par src/data/
import { describe, it, expect } from 'vitest';
import { DEFAULT_BRANDING, AVAILABLE_FONTS } from '../data/branding';
import { SMART_MAPPING } from '../data/cctpData';

// ─── DEFAULT_BRANDING ──────────────────────────────────────────────────────

describe('DEFAULT_BRANDING', () => {
  it('a les champs identite', () => {
    expect(DEFAULT_BRANDING).toHaveProperty('logo');
    expect(DEFAULT_BRANDING).toHaveProperty('companyName');
    expect(DEFAULT_BRANDING).toHaveProperty('tagline');
    expect(DEFAULT_BRANDING).toHaveProperty('email');
    expect(DEFAULT_BRANDING).toHaveProperty('website');
  });

  it('a les couleurs par defaut en hex', () => {
    const { colors } = DEFAULT_BRANDING;
    expect(colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(colors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(colors.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(colors.subtle).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('a les polices par defaut', () => {
    expect(DEFAULT_BRANDING.fonts.headings).toBeTruthy();
    expect(DEFAULT_BRANDING.fonts.main).toBeTruthy();
  });

  it('a les tailles en demi-points', () => {
    const { sizes } = DEFAULT_BRANDING;
    expect(sizes.title1).toBeGreaterThan(sizes.body);
    expect(sizes.title1).toBeGreaterThan(sizes.title2);
    expect(sizes.title2).toBeGreaterThan(sizes.title3);
  });
});

// ─── AVAILABLE_FONTS ────────────────────────────────────────────────────────

describe('AVAILABLE_FONTS', () => {
  it('contient des polices classiques', () => {
    expect(AVAILABLE_FONTS).toContain('Helvetica');
    expect(AVAILABLE_FONTS).toContain('Arial');
    expect(AVAILABLE_FONTS).toContain('Times New Roman');
  });

  it('a au moins 5 polices', () => {
    expect(AVAILABLE_FONTS.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── SMART_MAPPING (cctpData) ───────────────────────────────────────────────

describe('SMART_MAPPING', () => {
  it('a des regles de mapping', () => {
    expect(SMART_MAPPING.length).toBeGreaterThan(10);
  });

  it('chaque regle a keywords, targetIds, mustNotContain', () => {
    SMART_MAPPING.forEach((rule, i) => {
      expect(Array.isArray(rule.keywords), `rule[${i}].keywords`).toBe(true);
      expect(rule.keywords.length, `rule[${i}].keywords.length`).toBeGreaterThan(0);
      expect(Array.isArray(rule.targetIds), `rule[${i}].targetIds`).toBe(true);
      expect(rule.targetIds.length, `rule[${i}].targetIds.length`).toBeGreaterThan(0);
      expect(Array.isArray(rule.mustNotContain), `rule[${i}].mustNotContain`).toBe(true);
    });
  });

  it('les keywords sont en minuscule sans accent', () => {
    SMART_MAPPING.forEach((rule, i) => {
      rule.keywords.forEach(kw => {
        expect(kw, `rule[${i}] keyword "${kw}"`).toBe(kw.toLowerCase());
        expect(kw, `rule[${i}] keyword "${kw}" accents`).not.toMatch(/[éèêëàâäùûüôöîïç]/);
      });
    });
  });

  it('couvre les principales sections VRD', () => {
    const allTargets = new Set(SMART_MAPPING.flatMap(r => r.targetIds));
    // Installation chantier
    expect(allTargets.has('3')).toBe(true);
    // Terrassements
    expect(allTargets.has('4.2')).toBe(true);
    // Bordures
    expect(allTargets.has('4.3')).toBe(true);
    // Revetements
    expect(allTargets.has('4.4')).toBe(true);
    // Reseaux
    expect(allTargets.has('5')).toBe(true);
  });
});
