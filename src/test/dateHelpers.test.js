// Tests pour src/utils/dateHelpers.js
import { describe, it, expect } from 'vitest';
import { formatDateFr, formatDateLong, formatDateLocale } from '../utils/dateHelpers';

// ─── formatDateFr (re-export) ───────────────────────────────────────────────

describe('formatDateFr (re-export)', () => {
  it('convertit ISO en DD/MM/YYYY', () => {
    expect(formatDateFr('2026-04-04')).toBe('04/04/2026');
  });

  it('retourne vide pour null', () => {
    expect(formatDateFr('')).toBe('');
    expect(formatDateFr(null)).toBe('');
  });
});

// ─── formatDateLong (re-export) ─────────────────────────────────────────────

describe('formatDateLong (re-export)', () => {
  it('retourne date longue en francais', () => {
    const result = formatDateLong('2026-04-04');
    expect(result).toContain('2026');
    expect(result).toContain('avril');
  });
});

// ─── formatDateLocale ───────────────────────────────────────────────────────

describe('formatDateLocale', () => {
  it('formate un Date object en DD/MM/YYYY', () => {
    const result = formatDateLocale(new Date(2026, 3, 4)); // avril = 3
    expect(result).toBe('04/04/2026');
  });

  it('formate une string ISO', () => {
    const result = formatDateLocale('2026-04-04');
    expect(result).toMatch(/04\/04\/2026/);
  });

  it('retourne fallback par defaut pour null', () => {
    expect(formatDateLocale(null)).toBe('');
    expect(formatDateLocale('')).toBe('');
  });

  it('retourne fallback custom', () => {
    expect(formatDateLocale(null, { fallback: '...........' })).toBe('...........');
    expect(formatDateLocale('', { fallback: '--' })).toBe('--');
  });

  it('retourne fallback pour date invalide', () => {
    expect(formatDateLocale('not-a-date', { fallback: 'N/A' })).toBe('N/A');
  });

  it('format medium (jour mois abrege annee)', () => {
    const result = formatDateLocale(new Date(2026, 3, 4), { format: 'medium' });
    expect(result).toContain('04');
    // Le mois abrégé et l'année courte
    expect(result).toMatch(/avr/i);
  });

  it('format long (jour complet)', () => {
    const result = formatDateLocale(new Date(2026, 3, 4), { format: 'long' });
    expect(result).toContain('avril');
    expect(result).toContain('2026');
    expect(result).toMatch(/samedi/i);
  });
});
