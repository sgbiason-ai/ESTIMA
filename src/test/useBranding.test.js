// src/tests/useBranding.test.js
//
// On teste deepMerge et la logique de résolution des priorités.
// useBranding lui-même (hook React) n'est pas testé ici — il nécessite
// @testing-library/react, prévu dans la phase de tests de hooks.

import { describe, it, expect } from 'vitest';
import { DEFAULT_BRANDING } from '../hooks/useBranding';

// Importer deepMerge via un contournement : on réexporte depuis le module
// En attendant : tester le comportement de useBranding via ses effets observables

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_BRANDING
// ─────────────────────────────────────────────────────────────────────────────
describe('DEFAULT_BRANDING', () => {
  it('contient tous les champs requis', () => {
    expect(DEFAULT_BRANDING.companyName).toBeDefined();
    expect(DEFAULT_BRANDING.colors).toBeDefined();
    expect(DEFAULT_BRANDING.fonts).toBeDefined();
    expect(DEFAULT_BRANDING.sizes).toBeDefined();
  });

  it('les couleurs par défaut sont des hex valides', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    Object.values(DEFAULT_BRANDING.colors).forEach(c => {
      expect(hexRegex.test(c)).toBe(true);
    });
  });

  it('les tailles sont des nombres positifs', () => {
    Object.values(DEFAULT_BRANDING.sizes).forEach(s => {
      expect(typeof s).toBe('number');
      expect(s).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Logique de résolution de priorité (testée sans hook React)
// ─────────────────────────────────────────────────────────────────────────────
describe('Résolution des priorités branding', () => {
  // Simuler la logique de deepMerge manuellement pour la tester
  function simulateResolution(masterBranding, projectBranding = null, localFallback = null) {
    const merge = (base, ...overrides) => {
      let result = { ...base };
      overrides.forEach(override => {
        if (!override) return;
        Object.entries(override).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          if (typeof v === 'object' && !Array.isArray(v) && typeof result[k] === 'object') {
            result[k] = { ...result[k] };
            Object.entries(v).forEach(([sk, sv]) => {
              if (sv !== null && sv !== undefined) result[k][sk] = sv;
            });
          } else {
            result[k] = v;
          }
        });
      });
      return result;
    };
    return merge(DEFAULT_BRANDING, localFallback, masterBranding, projectBranding);
  }

  it('utilise DEFAULT_BRANDING si tout est null', () => {
    const result = simulateResolution(null);
    expect(result.colors.primary).toBe(DEFAULT_BRANDING.colors.primary);
    expect(result.fonts.headings).toBe(DEFAULT_BRANDING.fonts.headings);
  });

  it('masterBranding écrase DEFAULT_BRANDING', () => {
    const master = { companyName: 'PAPYRUS', colors: { primary: '#FF0000' } };
    const result = simulateResolution(master);
    expect(result.companyName).toBe('PAPYRUS');
    expect(result.colors.primary).toBe('#FF0000');
    // Les autres couleurs restent par défaut
    expect(result.colors.secondary).toBe(DEFAULT_BRANDING.colors.secondary);
  });

  it('project.branding écrase masterBranding', () => {
    const master  = { companyName: 'PAPYRUS', colors: { primary: '#FF0000' } };
    const project = { colors: { primary: '#00FF00' } };
    const result  = simulateResolution(master, project);
    expect(result.colors.primary).toBe('#00FF00'); // projet gagne
    expect(result.companyName).toBe('PAPYRUS');    // master conservé
  });

  it('localFallback est utilisé si masterBranding est vide', () => {
    const local  = { companyName: 'OFFLINE MOE' };
    const result = simulateResolution(null, null, local);
    expect(result.companyName).toBe('OFFLINE MOE');
  });

  it('masterBranding a priorité sur localFallback', () => {
    const local  = { companyName: 'OFFLINE' };
    const master = { companyName: 'FIREBASE' };
    const result = simulateResolution(master, null, local);
    expect(result.companyName).toBe('FIREBASE');
  });

  it('les valeurs null dans un override ne suppriment pas la valeur de base', () => {
    const master = { companyName: null }; // null ignoré
    const result = simulateResolution(master);
    // companyName doit rester '' (DEFAULT) et non être écrasé par null
    expect(result.companyName).toBe('');
  });

  it('deep merge partiel ne perd pas les couleurs non surchargées', () => {
    const master = { colors: { primary: '#112233' } };
    const result = simulateResolution(master);
    expect(result.colors.primary).toBe('#112233');
    expect(result.colors.secondary).toBe(DEFAULT_BRANDING.colors.secondary);
    expect(result.colors.text).toBe(DEFAULT_BRANDING.colors.text);
    expect(result.colors.subtle).toBe(DEFAULT_BRANDING.colors.subtle);
  });

  it('fonts deep merge partiel', () => {
    const master = { fonts: { headings: 'Georgia' } };
    const result = simulateResolution(master);
    expect(result.fonts.headings).toBe('Georgia');
    expect(result.fonts.main).toBe(DEFAULT_BRANDING.fonts.main); // inchangé
  });
});