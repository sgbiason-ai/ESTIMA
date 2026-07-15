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
import {
  collectReferencedBlocks,
  computeLayoutPaperBounds,
  createPaperSpaceDxf,
  scanDxfStructure,
} from '../utils/takeoff/dxfLayouts';
import {
  panViewByPixels,
  paperRectToCanvas,
  zoomViewAtCanvasPoint,
} from '../components/takeoff/dxfLayoutRendering';

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

describe('métré DXF — présentations', () => {
  const dxfSource = [
    [0, 'SECTION'],
    [0, 'LAYER'], [5, 'AA'], [2, 'AEP'],
    [0, 'LAYOUT'], [5, '10'], [1, 'Model'], [71, 0], [330, 'MODEL'],
    [0, 'LAYOUT'], [5, '20'], [1, 'Plan réseaux'], [71, 2], [330, 'PAPER'], [331, 'VP1'],
    [0, 'VIEWPORT'], [5, 'VP0'], [330, 'PAPER'],
    [10, 210], [20, 148], [40, 420], [41, 297], [12, 210], [22, 148], [45, 297],
    [0, 'VIEWPORT'], [5, 'VP1'], [330, 'PAPER'], [69, 2],
    [10, 210], [20, 148], [40, 360], [41, 240], [12, 1650000], [22, 3140000], [45, 480],
    [16, 0], [26, 0], [36, 1], [331, 'AA'], [340, 'CLIP'],
    [0, 'ENDSEC'], [0, 'EOF'],
  ].map(([code, value]) => `${code}\n${value}`).join('\n');

  it('extrait les onglets papier et leurs fenêtres dans l’ordre AutoCAD', () => {
    const structure = scanDxfStructure(dxfSource);

    expect(structure.rawEntityCounts.VIEWPORT).toBe(2);
    expect(structure.layouts).toHaveLength(1);
    expect(structure.layouts[0]).toMatchObject({
      name: 'Plan réseaux',
      blockRecordHandle: 'PAPER',
      simplified: true,
    });
    expect(structure.layouts[0].viewports).toHaveLength(1);
    expect(structure.layouts[0].viewports[0]).toMatchObject({
      handle: 'VP1',
      frozenLayers: ['AEP'],
      clipHandle: 'CLIP',
      viewCenter: { x: 1650000, y: 3140000 },
      viewHeight: 480,
    });
  });

  it('ne conserve que les blocs utilisés par le cartouche papier', () => {
    const blocks = {
      CARTOUCHE: { name: 'CARTOUCHE', entities: [{ type: 'INSERT', name: 'LOGO' }] },
      LOGO: { name: 'LOGO', entities: [{ type: 'LINE' }] },
      INUTILE: { name: 'INUTILE', entities: [{ type: 'CIRCLE' }] },
    };
    expect(Object.keys(collectReferencedBlocks([
      { type: 'INSERT', name: 'CARTOUCHE' },
    ], blocks))).toEqual(['CARTOUCHE', 'LOGO']);
  });

  it('isole les entités du paper space associé au layout', () => {
    const dxf = {
      header: { $INSUNITS: 6 },
      tables: {},
      entities: [],
      blocks: {
        '*Paper_Space2': {
          name: '*Paper_Space2',
          ownerHandle: 'PAPER',
          entities: [{ type: 'INSERT', name: 'CARTOUCHE', inPaperSpace: true }],
        },
        CARTOUCHE: { name: 'CARTOUCHE', entities: [{ type: 'LINE' }] },
        MODELE: { name: 'MODELE', entities: [{ type: 'CIRCLE' }] },
      },
    };

    const paperDxf = createPaperSpaceDxf(dxf, { blockRecordHandle: 'paper' });
    expect(paperDxf.entities).toHaveLength(1);
    expect(Object.keys(paperDxf.blocks)).toEqual(['CARTOUCHE']);
  });

  it('convertit une fenêtre papier dans le repère du canvas', () => {
    expect(paperRectToCanvas({
      paperCenter: { x: 50, y: 25 },
      paperSize: { width: 40, height: 20 },
    }, {
      minX: 0, maxX: 100, minY: 0, maxY: 50,
    }, 1000, 500)).toEqual({
      viewport: { x: 300, y: 150, width: 400, height: 200 },
      scissor: { x: 300, y: 150, width: 400, height: 200 },
    });
    expect(paperRectToCanvas({
      paperCenter: { x: 1050, y: 2025 },
      paperSize: { width: 40, height: 20 },
    }, {
      minX: 0, maxX: 100, minY: 0, maxY: 50,
    }, 1000, 500, { x: 1000, y: 2000 })).toEqual({
      viewport: { x: 300, y: 150, width: 400, height: 200 },
      scissor: { x: 300, y: 150, width: 400, height: 200 },
    });
  });

  it('découpe une fenêtre hors écran sans modifier ses proportions', () => {
    const rect = paperRectToCanvas({
      paperCenter: { x: 0, y: 25 },
      paperSize: { width: 40, height: 20 },
    }, {
      minX: 0, maxX: 100, minY: 0, maxY: 50,
    }, 1000, 500);

    expect(rect).toEqual({
      viewport: { x: -200, y: 150, width: 400, height: 200 },
      scissor: { x: 0, y: 150, width: 200, height: 200 },
    });
    expect(rect.viewport.width / rect.viewport.height).toBe(2);
  });

  it('cadre ensemble le cartouche et toutes les fenêtres papier', () => {
    const bounds = computeLayoutPaperBounds({
      viewports: [{
        paperCenter: { x: 100, y: 50 },
        paperSize: { width: 160, height: 80 },
      }],
    }, { minX: -20, maxX: 20, minY: 0, maxY: 100 });
    expect(bounds).toEqual({ minX: -20, maxX: 180, minY: 0, maxY: 100 });
  });

  it('zoome autour de la position de la souris dans la présentation', () => {
    const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 50 };
    expect(zoomViewAtCanvasPoint(
      bounds,
      { x: 0, y: 0 },
      1000,
      500,
      0.5,
      1,
      1000,
    )).toEqual({ center: { x: 25, y: 37.5 }, width: 50 });
  });

  it('déplace la feuille selon le glissement au clic milieu', () => {
    expect(panViewByPixels(
      { minX: 0, maxX: 100, minY: 0, maxY: 50 },
      100,
      50,
      1000,
      500,
    )).toEqual({ center: { x: 40, y: 30 }, width: 100 });
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

  it('expose les blocs pilotes (enfants masqués) et propage le métré aux articles', () => {
    const withBloc = {
      id: 'p2',
      tranches: [],
      sourceIds: [],
      chapters: [{
        id: 'c1', type: 'chapter', title: 'VOIRIE', children: [
          {
            id: 'b1', type: 'chapter', isBloc: true, title: 'Chaussée', unit: 'm²',
            qty: 0, quantities: {}, quantitiesFormula: {}, children: [
              { id: 'l1', uid: 'bpuA', type: 'item', designation: 'GNT', unit: 'm³', price: 30, qty: 0, formula: '={b1}*0.3', quantities: {}, quantitiesFormula: {} },
            ],
          },
        ],
      }],
    };
    // Le bloc est exposé comme cible ; son article piloté est masqué de la liste.
    const items = flattenProjectItems(withBloc.chapters);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'b1', unit: 'm²', isBloc: true });
    // Appliquer une surface au bloc pose sa quantité pilote et propage à l'enfant.
    const result = applyTakeoffToProject(withBloc, [
      { itemId: 'b1', layer: 'CHAUSSEE', metric: 'area', coefficient: 1, appliedQuantity: 100 },
    ], { fileName: 'plan.dxf' });
    const bloc = result.chapters[0].children[0];
    expect(bloc.qty).toBe(100);
    expect(bloc.children[0].qty).toBe(30); // 100 m² × 0,3
  });
});
