// Tests pour src/utils/helpers.js
import { describe, it, expect } from 'vitest';
import {
  generateId, formatPrice, calculateTotal,
  getUniqueBpuCatalog, getItemRefMap,
  normalizeUnitSymbol, isFixedItem,
} from '../utils/helpers';

// ─── generateId ─────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('genere un identifiant non vide', () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(5);
  });

  it('genere des identifiants uniques', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

// ─── formatPrice ────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('formate un prix en euros FR', () => {
    const result = formatPrice(1234.56);
    expect(result).toMatch(/1[\s\u202F\u00A0]234,56/);
    expect(result).toMatch(/€/);
  });

  it('formate zero', () => {
    const result = formatPrice(0);
    expect(result).toMatch(/0,00/);
  });

  it('gere null/undefined → 0', () => {
    const result = formatPrice(null);
    expect(result).toMatch(/0,00/);
  });

  it('formate un grand nombre', () => {
    const result = formatPrice(1000000);
    expect(result).toMatch(/1[\s\u202F\u00A0]000[\s\u202F\u00A0]000/);
  });
});

// ─── calculateTotal ─────────────────────────────────────────────────────────

describe('calculateTotal', () => {
  it('calcule le total d\'un item simple', () => {
    expect(calculateTotal({ type: 'item', qty: 10, price: 5 })).toBe(50);
  });

  it('calcule avec un champ qty custom', () => {
    expect(calculateTotal({ type: 'item', clientQty: 20, price: 3 }, 'clientQty')).toBe(60);
  });

  it('retourne 0 si node null', () => {
    expect(calculateTotal(null)).toBe(0);
  });

  it('calcule recursivement les enfants (children)', () => {
    const node = {
      type: 'chapter',
      children: [
        { type: 'item', qty: 2, price: 10 },
        { type: 'item', qty: 3, price: 20 },
      ],
    };
    expect(calculateTotal(node)).toBe(80); // 20 + 60
  });

  it('calcule recursivement les enfants (chapters)', () => {
    const node = {
      type: 'chapter',
      chapters: [
        { type: 'item', qty: 5, price: 100 },
      ],
    };
    expect(calculateTotal(node)).toBe(500);
  });

  it('gere les chapitres imbriques', () => {
    const node = {
      type: 'chapter',
      children: [
        {
          type: 'chapter',
          children: [
            { type: 'item', qty: 1, price: 1000 },
          ],
        },
        { type: 'item', qty: 2, price: 500 },
      ],
    };
    expect(calculateTotal(node)).toBe(2000);
  });

  it('gere les valeurs manquantes → 0', () => {
    expect(calculateTotal({ type: 'item' })).toBe(0);
    expect(calculateTotal({ type: 'item', qty: 5 })).toBe(0);
    expect(calculateTotal({ type: 'item', price: 10 })).toBe(0);
  });

  it('gere les valeurs string', () => {
    expect(calculateTotal({ type: 'item', qty: '10', price: '5.5' })).toBe(55);
  });
});

// ─── normalizeUnitSymbol ────────────────────────────────────────────────────

describe('normalizeUnitSymbol', () => {
  it('met en majuscules', () => {
    expect(normalizeUnitSymbol('ml')).toBe('ML');
    expect(normalizeUnitSymbol('m')).toBe('M');
  });

  it('remplace les exposants unicode', () => {
    expect(normalizeUnitSymbol('m²')).toBe('M2');
    expect(normalizeUnitSymbol('m³')).toBe('M3');
  });

  it('retourne vide pour valeurs falsy', () => {
    expect(normalizeUnitSymbol('')).toBe('');
    expect(normalizeUnitSymbol(null)).toBe('');
    expect(normalizeUnitSymbol(undefined)).toBe('');
  });

  it('gere les nombres en input', () => {
    expect(normalizeUnitSymbol(42)).toBe('42');
  });
});

// ─── isFixedItem ────────────────────────────────────────────────────────────

describe('isFixedItem', () => {
  it('detecte les unites forfaitaires', () => {
    expect(isFixedItem({ unit: 'ENS', qty: 1 })).toBe(true);
    expect(isFixedItem({ unit: 'ft', qty: 1 })).toBe(true);
    expect(isFixedItem({ unit: 'F', qty: 1 })).toBe(true);
    expect(isFixedItem({ unit: 'forfait', qty: 1 })).toBe(true);
    expect(isFixedItem({ unit: 'global', qty: 1 })).toBe(true);
  });

  it('detecte les petites unites comptables (< 10)', () => {
    expect(isFixedItem({ unit: 'U', qty: 5 })).toBe(true);
    expect(isFixedItem({ unit: 'pce', qty: 3 })).toBe(true);
  });

  it('ne bloque pas les grandes quantites unitaires', () => {
    expect(isFixedItem({ unit: 'U', qty: 15 })).toBe(false);
    expect(isFixedItem({ unit: 'pce', qty: 100 })).toBe(false);
  });

  it('ne bloque pas les unites metriques', () => {
    expect(isFixedItem({ unit: 'ML', qty: 1 })).toBe(false);
    expect(isFixedItem({ unit: 'M2', qty: 1 })).toBe(false);
    expect(isFixedItem({ unit: 'T', qty: 1 })).toBe(false);
  });

  it('retourne false pour item null ou sans unite', () => {
    expect(isFixedItem(null)).toBe(false);
    expect(isFixedItem({})).toBe(false);
    expect(isFixedItem({ qty: 5 })).toBe(false);
  });
});

// ─── getUniqueBpuCatalog ────────────────────────────────────────────────────

describe('getUniqueBpuCatalog', () => {
  it('retourne les items uniques par designation', () => {
    const project = {
      chapters: [
        {
          type: 'chapter',
          children: [
            { type: 'item', designation: 'Béton' },
            { type: 'item', designation: 'Acier' },
            { type: 'item', designation: 'Béton' }, // doublon
          ],
        },
      ],
    };
    const result = getUniqueBpuCatalog(project);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.designation)).toContain('Béton');
    expect(result.map(i => i.designation)).toContain('Acier');
  });

  it('retourne vide pour projet null', () => {
    expect(getUniqueBpuCatalog(null)).toEqual([]);
    expect(getUniqueBpuCatalog({})).toEqual([]);
  });

  it('parcourt les enfants imbriques', () => {
    const project = {
      chapters: [{
        type: 'chapter',
        children: [{
          type: 'chapter',
          children: [{ type: 'item', designation: 'Profond' }],
        }],
      }],
    };
    expect(getUniqueBpuCatalog(project)).toHaveLength(1);
  });
});

// ─── getItemRefMap ──────────────────────────────────────────────────────────

describe('getItemRefMap', () => {
  it('genere des references P.01, P.02, ...', () => {
    const project = {
      chapters: [{
        children: [
          { type: 'item', designation: 'Alpha' },
          { type: 'item', designation: 'Beta' },
        ],
      }],
    };
    const map = getItemRefMap(project);
    expect(map.get('ALPHA')).toBe('P.01');
    expect(map.get('BETA')).toBe('P.02');
  });

  it('deduplique par designation (insensible casse)', () => {
    const project = {
      chapters: [{
        children: [
          { type: 'item', designation: 'Test' },
          { type: 'item', designation: 'test' },
          { type: 'item', designation: 'TEST' },
        ],
      }],
    };
    const map = getItemRefMap(project);
    expect(map.size).toBe(1);
    expect(map.get('TEST')).toBe('P.01');
  });

  it('retourne map vide pour projet null', () => {
    expect(getItemRefMap(null).size).toBe(0);
  });
});
