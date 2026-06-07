// src/test/negoLetterUtils.test.js
import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  looksLikeHtml,
  htmlToPlainText,
  buildAnomalySectionHtml,
  applyTemplate,
} from '../components/rao/tabs/nego/negoLetterUtils';

// ── escapeHtml ──────────────────────────────────────────────────────────────
describe('escapeHtml', () => {
  it('échappe les caractères spéciaux HTML', () => {
    expect(escapeHtml('<b>A & "B" \'C\'>')).toBe('&lt;b&gt;A &amp; &quot;B&quot; &#39;C&#39;&gt;');
  });
  it('renvoie une chaîne vide pour null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

// ── looksLikeHtml ───────────────────────────────────────────────────────────
describe('looksLikeHtml', () => {
  it('détecte les balises de bloc Quill', () => {
    expect(looksLikeHtml('<p>x</p>')).toBe(true);
    expect(looksLikeHtml('<ul><li>a</li></ul>')).toBe(true);
    expect(looksLikeHtml('<strong>x</strong>')).toBe(true);
  });
  it('renvoie false sur du texte brut', () => {
    expect(looksLikeHtml('Bonjour le monde')).toBe(false);
    expect(looksLikeHtml('')).toBe(false);
    expect(looksLikeHtml(null)).toBe(false);
  });
});

// ── htmlToPlainText (input texte brut → renvoyé tel quel, sans DOM) ──────────
describe('htmlToPlainText', () => {
  it('renvoie le texte brut inchangé (pas de HTML)', () => {
    const txt = '➡️ Titre\n- puce 1\n- puce 2';
    expect(htmlToPlainText(txt)).toBe(txt);
  });
  it('gère null/undefined', () => {
    expect(htmlToPlainText(null)).toBe('');
    expect(htmlToPlainText(undefined)).toBe('');
  });
});

// ── buildAnomalySectionHtml ─────────────────────────────────────────────────
describe('buildAnomalySectionHtml', () => {
  it('wrappe la section dans data-anomaly du bon type', () => {
    expect(buildAnomalySectionHtml('low', '<p>txt</p>', [])).toMatch(/^<div data-anomaly="low">/);
    expect(buildAnomalySectionHtml('high', '<p>txt</p>', [])).toMatch(/^<div data-anomaly="high">/);
  });

  it('utilise le rouge pour low et l\'amber pour high dans l\'en-tête de table', () => {
    const items = [{ ref: 'P.01', label: 'Terrassement', pu: '12,00', unit: 'm3' }];
    expect(buildAnomalySectionHtml('low', '<p>t</p>', items)).toContain('#dc2626');
    expect(buildAnomalySectionHtml('high', '<p>t</p>', items)).toContain('#d97706');
  });

  it('ajoute la colonne Unité seulement si au moins un item a une unité', () => {
    const withUnit = [{ ref: 'P.01', label: 'A', pu: '1', unit: 'm3' }];
    const noUnit = [{ ref: 'P.02', label: 'B', pu: '2', unit: '' }];
    expect(buildAnomalySectionHtml('low', '<p>t</p>', withUnit)).toContain('>Unité<');
    expect(buildAnomalySectionHtml('low', '<p>t</p>', noUnit)).not.toContain('>Unité<');
  });

  it('parse les items legacy au format chaîne', () => {
    const legacy = ['Prix n°P.05 — Béton : PU proposé de 250,00 € HT/m3.'];
    const out = buildAnomalySectionHtml('high', '<p>t</p>', legacy);
    expect(out).toContain('P.05');
    expect(out).toContain('Béton');
    expect(out).toContain('250,00');
    expect(out).toContain('>m3<');
  });

  it('style les <p> Quill non stylés (justify) et conserve les <p> déjà stylés', () => {
    expect(buildAnomalySectionHtml('low', '<p>brut</p>', [])).toContain('text-align:justify');
    const styled = '<p style="color:red">x</p>';
    expect(buildAnomalySectionHtml('low', styled, [])).toContain('style="color:red"');
  });

  it('convertit l\'ancien format texte brut (titre + puces) en HTML', () => {
    const raw = '➡️ TITRE\n- ligne A\n- ligne B';
    const out = buildAnomalySectionHtml('low', raw, []);
    expect(out).toContain('<strong>TITRE</strong>');
    expect(out).toContain('<li');
    expect(out).toContain('ligne A');
  });
});

// ── applyTemplate ───────────────────────────────────────────────────────────
describe('applyTemplate', () => {
  const tpl = '{{NOM_ENTREPRISE}}|{{OBJET_MARCHE}}|{{CLIENT}}|{{LIEU}}|{{PHASE}}|{{SIGNATAIRE}}';

  it('priorise project sur consultation puis fallback', () => {
    const out = applyTemplate(tpl, 'SARL BTP', '', { signatoryName: 'M. Dupont' },
      { objet: 'Conso objet', client: 'Conso client', lieu: 'Conso lieu' },
      { name: 'Projet objet', client: 'Projet client', location: 'Projet lieu' });
    expect(out).toBe('SARL BTP|Projet objet|Projet client|Projet lieu|ACT|M. Dupont');
  });

  it('retombe sur consultation quand project est absent', () => {
    const out = applyTemplate(tpl, 'X', '', {}, { objet: 'O', client: 'C', lieu: 'L' }, null);
    expect(out).toBe('X|O|C|L|ACT|[Nom du signataire]');
  });

  it('force PHASE à ACT', () => {
    expect(applyTemplate('{{PHASE}}', 'X', '', {}, {}, null)).toBe('ACT');
  });

  it('insère un marker invisible quand QUESTIONS est vide', () => {
    const out = applyTemplate('{{QUESTIONS}}', 'X', '', {}, {}, null);
    expect(out).toContain('data-questions-marker');
  });

  it('convertit les sauts de ligne d\'adresse en <br/>', () => {
    const out = applyTemplate('{{ADRESSE_ENTREPRISE}}', 'X', '',
      { adresseEntreprise: 'Ligne1\nLigne2' }, {}, null);
    expect(out).toBe('Ligne1<br/>Ligne2');
  });
});
