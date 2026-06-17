// Tests pour src/utils/crrTextQa.js
import { describe, it, expect } from 'vitest';
import { detectTextIssues, nameEmailMismatch } from '../utils/crrTextQa';

describe('detectTextIssues — fautes connues (dictionnaire)', () => {
  it('detecte diffuera → diffusera', () => {
    const issues = detectTextIssues("Le maitre d'oeuvre diffuera le compte rendu.");
    expect(issues.some((i) => i.type === 'spelling' && i.suggestion === 'diffusera')).toBe(true);
  });

  it('detecte tramsettra → transmettra (insensible a la casse)', () => {
    const issues = detectTextIssues("L'entreprise TRAMSETTRA les plans.");
    expect(issues.some((i) => i.suggestion === 'transmettra')).toBe(true);
  });

  it('deduplique une faute repetee', () => {
    const issues = detectTextIssues('diffuera puis diffuera encore');
    expect(issues.filter((i) => i.type === 'spelling').length).toBe(1);
  });
});

describe('detectTextIssues — heuristiques structurelles', () => {
  it('mots colles / espace manquant (MARCOULYindique)', () => {
    const issues = detectTextIssues('MARCOULYindique la reprise.');
    expect(issues.some((i) => i.type === 'spacing' && /MARCOULYindique/.test(i.message))).toBe(true);
  });

  it('espace manquant apres une ponctuation', () => {
    expect(detectTextIssues('travaux finis.Le chantier').some((i) => i.type === 'spacing')).toBe(true);
  });

  it('ponctuation repetee', () => {
    expect(detectTextIssues('Attention !!').some((i) => i.type === 'punct')).toBe(true);
  });

  it('espaces multiples', () => {
    expect(detectTextIssues('mot  colle').some((i) => i.type === 'spacing')).toBe(true);
  });

  it('texte propre ou vide → aucune anomalie', () => {
    expect(detectTextIssues('Les entreprises signalent toute absence 48 h avant la réunion.')).toEqual([]);
    expect(detectTextIssues('')).toEqual([]);
    expect(detectTextIssues(null)).toEqual([]);
  });
});

describe('nameEmailMismatch', () => {
  it('signale FAUGIE / augie (le « f » manque)', () => {
    expect(nameEmailMismatch('FAUGIE', 'augie@ville.fr')).toBe(true);
  });

  it('accepte les conventions courantes (jdupont, mcurie)', () => {
    expect(nameEmailMismatch('Jean Dupont', 'jdupont@x.fr')).toBe(false);
    expect(nameEmailMismatch('Marie Curie', 'mcurie@x.fr')).toBe(false);
  });

  it('gere les accents (Géraud / geraud)', () => {
    expect(nameEmailMismatch('Géraud', 'geraud@x.fr')).toBe(false);
  });

  it('ne juge pas les boites generiques ni les donnees manquantes', () => {
    expect(nameEmailMismatch('Service Urbanisme', 'contact@x.fr')).toBe(false);
    expect(nameEmailMismatch('', 'x@y.fr')).toBe(false);
    expect(nameEmailMismatch('Bob', '')).toBe(false);
  });
});
