// Tests pour src/utils/crrTextQa.js
import { describe, it, expect } from 'vitest';
import { nameEmailMismatch } from '../utils/crrTextQa';

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
