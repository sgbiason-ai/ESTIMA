// Tests du moteur de contenu partagé (sections conditionnelles + substitution).
// Note : stripEditorNotes / computeDerogations utilisent le DOM (document) et
// ne sont pas couverts ici (environnement de test = node, sans jsdom).
import { describe, it, expect } from 'vitest';
import { applyConditionalSections, substituteVariables } from '../utils/docContent';

describe('applyConditionalSections', () => {
  it('conserve le bloc si la variable est renseignée', () => {
    const html = 'circulation{{#voie}} et fermeture de {{voie}}{{/voie}}, suite';
    expect(applyConditionalSections(html, { voie: 'RD820' }))
      .toBe('circulation et fermeture de {{voie}}, suite');
  });

  it('supprime le bloc si la variable est vide', () => {
    const html = 'circulation{{#voie}} et fermeture de {{voie}}{{/voie}}, suite';
    expect(applyConditionalSections(html, { voie: '' })).toBe('circulation, suite');
  });

  it('supprime le bloc si la variable est absente', () => {
    const html = 'A{{#x}}B{{/x}}C';
    expect(applyConditionalSections(html, {})).toBe('AC');
  });

  it('traite les espaces seuls comme vide', () => {
    const html = 'A{{#x}}B{{/x}}C';
    expect(applyConditionalSections(html, { x: '   ' })).toBe('AC');
  });

  it('gère plusieurs sections indépendantes', () => {
    const html = '{{#a}}A{{/a}}-{{#b}}B{{/b}}';
    expect(applyConditionalSections(html, { a: '1', b: '' })).toBe('A-');
  });

  it('gère les sections imbriquées', () => {
    const html = '{{#a}}X{{#b}}Y{{/b}}Z{{/a}}';
    expect(applyConditionalSections(html, { a: '1', b: '' })).toBe('XZ');
    expect(applyConditionalSections(html, { a: '', b: '1' })).toBe('');
  });
});

describe('substituteVariables', () => {
  it('remplace les variables présentes', () => {
    expect(substituteVariables('Index {{idx}}', { idx: 'TP08' })).toBe('Index TP08');
  });

  it('remplace une variable vide par une chaîne vide', () => {
    expect(substituteVariables('X {{v}} Y', { v: '' })).toBe('X  Y');
  });

  it('remplace toutes les occurrences', () => {
    expect(substituteVariables('{{v}}-{{v}}', { v: 'a' })).toBe('a-a');
  });
});
