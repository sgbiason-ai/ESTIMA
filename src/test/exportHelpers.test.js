// Tests pour src/utils/exportHelpers.js
import { describe, it, expect } from 'vitest';
import { buildExportFilename } from '../utils/exportHelpers';

// ─── buildExportFilename ────────────────────────────────────────────────────

describe('buildExportFilename', () => {
  const vars = { number: 3, projectName: 'Chantier Test', date: '2026-04-04', ext: 'pdf' };

  it('substitue les variables dans le pattern', () => {
    const result = buildExportFilename('CR{N}_{NOM}_{DATE}', vars);
    expect(result).toBe('CR03_CHANTIER_TEST_2026-04-04.pdf');
  });

  it('utilise le pattern par defaut si null', () => {
    const result = buildExportFilename(null, vars);
    expect(result).toBe('CR03_CHANTIER_TEST_2026-04-04.pdf');
  });

  it('utilise le pattern par defaut si vide', () => {
    const result = buildExportFilename('', vars);
    expect(result).toBe('CR03_CHANTIER_TEST_2026-04-04.pdf');
  });

  it('pad le numero sur 2 chiffres', () => {
    const result = buildExportFilename('CR{N}', { ...vars, number: 1 });
    expect(result).toMatch(/CR01/);
  });

  it('gere un numero a 2+ chiffres', () => {
    const result = buildExportFilename('CR{N}', { ...vars, number: 15 });
    expect(result).toMatch(/CR15/);
  });

  it('ajoute l\'extension si absente', () => {
    const result = buildExportFilename('MonFichier', vars);
    expect(result).toMatch(/\.pdf$/);
  });

  it('ne double pas l\'extension', () => {
    const result = buildExportFilename('MonFichier.pdf', { ...vars, ext: 'pdf' });
    expect(result).toMatch(/\.pdf$/);
    expect(result).not.toMatch(/\.pdf\.pdf$/);
  });

  it('gere l\'extension doc', () => {
    const result = buildExportFilename('CR{N}', { ...vars, ext: 'doc' });
    expect(result).toMatch(/\.doc$/);
  });

  it('sanitize les caracteres speciaux dans le resultat', () => {
    const result = buildExportFilename('CR{N}', { ...vars, projectName: 'Test<>:"/\\|?*' });
    expect(result).not.toMatch(/[<>:"/\\|?*]/);
  });

  it('substitue {TYPE} avec l\'extension', () => {
    const result = buildExportFilename('Export_{TYPE}_{NOM}', vars);
    expect(result).toContain('pdf');
  });

  it('gere le projectName manquant', () => {
    const result = buildExportFilename('CR{N}_{NOM}', { number: 1, ext: 'pdf' });
    expect(result).toContain('PROJET');
  });

  it('gere la date manquante', () => {
    const result = buildExportFilename('CR{N}_{DATE}', { number: 1, ext: 'pdf' });
    expect(result).toContain('ND');
  });

  it('est insensible a la casse des variables', () => {
    const result = buildExportFilename('cr{n}_{nom}_{date}', vars);
    expect(result).toMatch(/cr03/);
    expect(result).toContain('CHANTIER_TEST');
  });

  it('sanitize les accents dans le nom de projet', () => {
    const result = buildExportFilename('{NOM}', { ...vars, projectName: 'Résumé été' });
    expect(result).toContain('RESUME_ETE');
  });
});
