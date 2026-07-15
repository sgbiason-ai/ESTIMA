import { describe, expect, it } from 'vitest';
import {
  aggregateDxfTakeoff,
  buildMeasurementRows,
  computeRobustFitBounds,
  measureBulgeSegment,
  measureClosedPolylineArea,
  measurePolylineLength,
} from '../utils/takeoff/dxfTakeoff';
import {
  applyTakeoffToProject,
  flattenProjectItems,
  isUnitCompatible,
} from '../utils/takeoff/applyTakeoff';

describe('métré DXF — géométrie', () => {
  it('calcule une longueur de polyligne ouverte', () => {
    expect(measurePolylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
  });

  it('calcule un demi-cercle défini par bulge', () => {
    expect(measureBulgeSegment({ x: 0, y: 0 }, { x: 2, y: 0 }, 1)).toBeCloseTo(Math.PI, 8);
  });

  it('calcule la surface d’un rectangle fermé', () => {
    expect(measureClosedPolylineArea([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 0, y: 4 },
    ])).toBe(40);
  });

  it('agrège les longueurs, surfaces et blocs par calque', () => {
    const summary = aggregateDxfTakeoff({
      header: { $ACADVER: 'AC1032', $INSUNITS: 6 },
      entities: [
        { type: 'LINE', layer: 'AEP', vertices: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
        { type: 'LWPOLYLINE', layer: 'VOIRIE', shape: true, vertices: [
          { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }, { x: 0, y: 2 },
        ] },
        { type: 'INSERT', layer: 'REGARDS', name: 'REGARD_EP', rowCount: 2, columnCount: 3 },
        { type: 'TEXT', layer: 'TEXTES' },
      ],
    }, { ACAD_PROXY_ENTITY: 8, LINE: 1 });

    expect(summary.metadata.unitLabel).toBe('Mètres');
    expect(summary.metadata.proxyEntityCount).toBe(8);
    expect(summary.layers.find((layer) => layer.name === 'AEP').rawLength).toBe(5);
    expect(summary.layers.find((layer) => layer.name === 'VOIRIE').rawArea).toBe(10);
    expect(summary.layers.find((layer) => layer.name === 'REGARDS').rawCount).toBe(6);
    expect(summary.layers.find((layer) => layer.name === 'TEXTES').unmeasuredCount).toBe(1);
  });

  it('convertit correctement longueurs et surfaces depuis des millimètres', () => {
    const rows = buildMeasurementRows({ layers: [{
      name: 'TEST', rawLength: 1000, rawArea: 1_000_000, rawCount: 2,
      entityCount: 3, approximateCount: 0, unmeasuredCount: 0, types: {},
    }] }, 0.001);
    expect(rows.find((row) => row.metric === 'length').quantity).toBe(1);
    expect(rows.find((row) => row.metric === 'area').quantity).toBe(1);
    expect(rows.find((row) => row.metric === 'count').quantity).toBe(2);
  });
});

describe('métré DXF — cadrage robuste', () => {
  it('écarte une coordonnée aberrante sans modifier les entités', () => {
    const entities = Array.from({ length: 100 }, (_, index) => ({
      type: 'POINT',
      position: { x: index, y: index * 2 },
    }));
    entities.push({ type: 'POINT', position: { x: 1_000_000, y: -1_000_000 } });

    const bounds = computeRobustFitBounds(entities);

    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(99);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(198);
    expect(entities).toHaveLength(101);
  });

  it('conserve le cadrage natif lorsqu’aucun point aberrant n’est détecté', () => {
    const entities = Array.from({ length: 100 }, (_, index) => ({
      type: 'POINT',
      position: { x: index, y: index * 2 },
    }));

    expect(computeRobustFitBounds(entities)).toBeNull();
  });
});

describe('métré DXF — application au projet', () => {
  const project = {
    id: 'p1',
    tranches: [],
    sourceIds: [],
    chapters: [{
      id: 'c1', type: 'chapter', title: 'RÉSEAUX', children: [
        { id: 'i1', uid: 'bpu1', type: 'item', designation: 'Canalisation', unit: 'ml', qty: 10, price: 20, formula: '', quantities: {}, quantitiesFormula: {} },
        { id: 'i2', uid: 'bpu2', type: 'item', designation: 'Regard', unit: 'u', qty: 1, price: 100, formula: '', quantities: {}, quantitiesFormula: {} },
      ],
    }],
  };

  it('applique plusieurs calques sur un même article en mode remplacement', () => {
    const result = applyTakeoffToProject(project, [
      { itemId: 'i1', layer: 'AEP-1', metric: 'length', coefficient: 1, appliedQuantity: 12.5 },
      { itemId: 'i1', layer: 'AEP-2', metric: 'length', coefficient: 2, appliedQuantity: 7.5 },
    ], { fileName: 'plan.dxf' });
    expect(result.chapters[0].children[0].qty).toBe(20);
    expect(result.takeoffImports).toHaveLength(1);
    expect(project.chapters[0].children[0].qty).toBe(10);
  });

  it('ajoute le métré à la quantité existante', () => {
    const result = applyTakeoffToProject(project, [
      { itemId: 'i2', layer: 'REGARDS', metric: 'count', coefficient: 1, appliedQuantity: 4 },
    ], { mode: 'add' });
    expect(result.chapters[0].children[1].qty).toBe(5);
  });

  it('applique dans une tranche et efface sa formule', () => {
    const sliced = {
      ...project,
      tranches: [{ id: 't1', name: 'Tranche 1' }],
      chapters: [{ ...project.chapters[0], children: [{
        ...project.chapters[0].children[0], quantities: { t1: 3 }, quantitiesFormula: { t1: '=1+2' },
      }] }],
    };
    const result = applyTakeoffToProject(sliced, [
      { itemId: 'i1', layer: 'AEP', metric: 'length', coefficient: 1, appliedQuantity: 18 },
    ], { trancheId: 't1' });
    expect(result.chapters[0].children[0].quantities.t1).toBe(18);
    expect(result.chapters[0].children[0].quantitiesFormula.t1).toBe('');
  });

  it('aplatit les articles et contrôle la compatibilité des unités', () => {
    const items = flattenProjectItems(project.chapters);
    expect(items).toHaveLength(2);
    expect(items[0].chapterPath).toBe('RÉSEAUX');
    expect(isUnitCompatible('length', 'ml')).toBe(true);
    expect(isUnitCompatible('area', 'm²')).toBe(true);
    expect(isUnitCompatible('count', 'ml')).toBe(false);
  });
});
