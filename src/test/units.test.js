import { describe, it, expect, beforeEach } from 'vitest';
import {
  DIMENSIONS, dimensionOf, factorOf, sameDimension, convert,
  enrichUnit, enrichUnits, dedupeUnits, defaultUnits, commonUnitSymbols, recognizedUnitTokens,
  canonicalSymbol, isUpperCanonical, mergeDimensions,
  lookupUnit, setRuntimeUnits, resetRuntimeUnits, MATERIAL_DENSITIES, densityOf,
  auditUnits,
} from '../data/units';

describe('units — dimensions & lookup', () => {
  beforeEach(() => resetRuntimeUnits());

  it('résout les symboles standard (casse / exposants indifférents)', () => {
    expect(dimensionOf('m²')).toBe('area');
    expect(dimensionOf('M2')).toBe('area');   // exposant ASCII + majuscule
    expect(dimensionOf('m³')).toBe('volume');
    expect(dimensionOf('ML')).toBe('length');
    expect(dimensionOf('t')).toBe('mass');
    expect(dimensionOf('TONNE')).toBe('mass'); // alias
    expect(dimensionOf('u')).toBe('count');
    expect(dimensionOf('forfait')).toBe('lumpsum'); // alias de 'f'
  });

  it('retourne null pour une unité inconnue', () => {
    expect(dimensionOf('zzz')).toBeNull();
    expect(lookupUnit('zzz')).toBeNull();
  });

  it('expose les 7 familles de dimensions', () => {
    expect(DIMENSIONS.map((d) => d.key)).toEqual(
      ['length', 'area', 'volume', 'mass', 'count', 'time', 'lumpsum'],
    );
  });
});

describe('units — conversion', () => {
  beforeEach(() => resetRuntimeUnits());

  it('facteur vers unité de base', () => {
    expect(factorOf('t')).toBe(1000);
    expect(factorOf('kg')).toBe(1);
    expect(factorOf('cm')).toBe(0.01);
    expect(factorOf('inconnu')).toBe(1); // défaut neutre
  });

  it('convertit dans une même dimension', () => {
    expect(convert(2, 't', 'kg')).toBe(2000);
    expect(convert(500, 'kg', 't')).toBe(0.5);
    expect(convert(1, 'km', 'ml')).toBe(1000);
    expect(convert(1, 'ha', 'm²')).toBe(10000);
  });

  it('refuse les dimensions incompatibles', () => {
    expect(convert(1, 't', 'm²')).toBeNull();
    expect(sameDimension('t', 'm²')).toBe(false);
    expect(sameDimension('m²', 'ha')).toBe(true);
  });

  it('refuse une quantité non numérique', () => {
    expect(convert('abc', 't', 'kg')).toBeNull();
  });
});

describe('units — enrichissement / migration', () => {
  beforeEach(() => resetRuntimeUnits());

  it('complète un ancien {symbol,label} depuis le canonique et force le symbole en MAJUSCULES', () => {
    const e = enrichUnit({ symbol: 'm²', label: 'Mètre carré' });
    expect(e.symbol).toBe('M2');
    expect(e.dimension).toBe('area');
    expect(e.factor).toBe(1);
    expect(e.aliases).toContain('m2');
  });

  it('préserve les valeurs déjà fournies', () => {
    const e = enrichUnit({ symbol: 'palette', label: 'Palette', dimension: 'count', factor: 1, aliases: ['pal'] });
    expect(e.dimension).toBe('count');
    expect(e.aliases).toEqual(['pal']);
  });

  it('inconnu sans dimension → count par défaut', () => {
    expect(enrichUnit({ symbol: 'zzz', label: 'Truc' }).dimension).toBe('count');
  });

  it('enrichUnits mappe une liste', () => {
    expect(enrichUnits([{ symbol: 't', label: 'Tonne' }])[0].dimension).toBe('mass');
    expect(enrichUnits(null)).toEqual([]);
  });
});

describe('units — registre runtime (unités personnalisées)', () => {
  beforeEach(() => resetRuntimeUnits());

  it('une unité personnalisée participe aux dimensions', () => {
    expect(dimensionOf('palette')).toBeNull();
    setRuntimeUnits([{ symbol: 'palette', label: 'Palette', dimension: 'volume', factor: 1, aliases: [] }]);
    expect(dimensionOf('palette')).toBe('volume');
    // le canonique reste disponible
    expect(dimensionOf('t')).toBe('mass');
    resetRuntimeUnits();
    expect(dimensionOf('palette')).toBeNull();
  });
});

describe('units — helpers de listes & densités', () => {
  it('defaultUnits est le set canonique sans le flag interne', () => {
    const list = defaultUnits();
    expect(list.length).toBeGreaterThanOrEqual(14);
    expect(list[0]).not.toHaveProperty('common');
    expect(list.every((u) => u.symbol && u.dimension)).toBe(true);
  });

  it('commonUnitSymbols est en majuscules', () => {
    const c = commonUnitSymbols();
    expect(c).toContain('M2');
    expect(c).toContain('ML');
    expect(c).toContain('U');
    expect(c).not.toContain('m²');
  });

  it('recognizedUnitTokens couvre symboles + alias en minuscules', () => {
    const t = recognizedUnitTokens();
    expect(t).toContain('tonne');
    expect(t).toContain('m2');
    expect(t).toContain('forfait');
  });

  it('densités matériaux accessibles', () => {
    expect(MATERIAL_DENSITIES.length).toBeGreaterThan(0);
    expect(densityOf('enrobe')).toBe(2.4);
    expect(densityOf('inconnu')).toBeNull();
  });
});

describe('units — normalisation MAJUSCULES', () => {
  it('canonicalSymbol ramène tout en majuscules canoniques', () => {
    expect(canonicalSymbol('m²')).toBe('M2');
    expect(canonicalSymbol('m³')).toBe('M3');
    expect(canonicalSymbol('ml')).toBe('ML');
    expect(canonicalSymbol('t')).toBe('T');
    expect(canonicalSymbol('forfait')).toBe('F');   // via alias
    expect(canonicalSymbol('tonne')).toBe('T');      // via alias
    expect(canonicalSymbol('palette')).toBe('PALETTE'); // inconnu → normalisé
    expect(canonicalSymbol('')).toBe('');
  });

  it('isUpperCanonical distingue les formes déjà en majuscules', () => {
    expect(isUpperCanonical('M2')).toBe(true);
    expect(isUpperCanonical('m²')).toBe(false);
    expect(isUpperCanonical('ml')).toBe(false);
  });

  it('le catalogue par défaut est entièrement en majuscules', () => {
    expect(defaultUnits().every((u) => u.symbol === u.symbol.toUpperCase())).toBe(true);
    expect(defaultUnits().map((u) => u.symbol)).toEqual(expect.arrayContaining(['M2', 'M3', 'ML', 'T', 'U']));
  });

  it('dedupeUnits fusionne les doublons par symbole normalisé', () => {
    const list = dedupeUnits([
      { symbol: 'M2', label: 'A' },
      { symbol: 'm²', label: 'B' },  // doublon de M2
      { symbol: 'ML', label: 'C' },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe('A'); // 1re occurrence conservée
  });
});

describe('units — catégories éditables (mergeDimensions)', () => {
  it('sans override : les 7 dimensions intégrées, dans l’ordre', () => {
    const merged = mergeDimensions([]);
    expect(merged.map((d) => d.key)).toEqual(DIMENSIONS.map((d) => d.key));
    expect(merged.every((d) => d.custom === false)).toBe(true);
  });

  it('renomme une dimension intégrée sans changer sa clé', () => {
    const merged = mergeDimensions([{ key: 'area', label: 'Surfaces VRD' }]);
    const area = merged.find((d) => d.key === 'area');
    expect(area.label).toBe('Surfaces VRD');
    expect(area.custom).toBe(false);
  });

  it('ajoute une catégorie personnalisée à la suite', () => {
    const merged = mergeDimensions([{ key: 'signalisation', label: 'Signalisation', custom: true }]);
    const custom = merged.find((d) => d.key === 'signalisation');
    expect(custom).toBeTruthy();
    expect(custom.custom).toBe(true);
    expect(custom.base).toBeNull();
    expect(merged).toHaveLength(DIMENSIONS.length + 1);
  });

  it('une override custom ne peut pas écraser une clé intégrée', () => {
    const merged = mergeDimensions([{ key: 'mass', label: 'Fake', custom: true }]);
    // 'mass' reste intégrée (custom:false), le label custom s'applique comme renommage
    expect(merged.filter((d) => d.key === 'mass')).toHaveLength(1);
    expect(merged.find((d) => d.key === 'mass').custom).toBe(false);
  });
});

describe('units - audit catalogue/BPU', () => {
  it('detecte les usages inconnus et les ecritures a normaliser', () => {
    const audit = auditUnits({
      units: defaultUnits(),
      bpu: [
        { id: 'a', unit: 'm²' },
        { id: 'b', unit: 'M2' },
        { id: 'c', unit: 'palette' },
      ],
    });

    expect(audit.legacyUsages).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: 'm²', canonical: 'M2', count: 1 }),
    ]));
    expect(audit.unknownUsages).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: 'palette', suggestion: 'PALETTE', count: 1 }),
    ]));
  });

  it('signale les conflits alias entre unites personnalisees', () => {
    const audit = auditUnits({
      units: [
        ...defaultUnits(),
        { symbol: 'PAL', label: 'Palette', dimension: 'count', aliases: ['palette'] },
        { symbol: 'PLT', label: 'Palette chantier', dimension: 'count', aliases: ['palette'] },
      ],
      bpu: [],
    });

    expect(audit.aliasConflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ alias: 'PALETTE', units: expect.arrayContaining(['PAL', 'PLT']) }),
    ]));
  });
});
