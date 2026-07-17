import { describe, expect, it } from 'vitest';
import {
  aggregateDxfTakeoff,
  applyRowAdjustments,
  buildEntityIndex,
  buildMeasurementRows,
  buildSelectionRows,
  computeRobustFitBounds,
  entityOutlinePoints,
  measureBulgeSegment,
  measureClosedPolylineArea,
  measurePolylineLength,
  measureSelection,
} from '../utils/takeoff/dxfTakeoff';
import {
  buildEntityGrid,
  buildHighlightBuffers,
  collectEntityBounds,
  hitTestEntities,
} from '../components/takeoff/dxfEntityPicking';
import {
  assignMissingMeasurementColors,
  NETWORK_MEASUREMENT_PALETTES,
  OTHER_MEASUREMENT_COLORS,
  nextMeasurementColor,
  suggestMeasurementColor,
} from '../components/takeoff/measurementColors';
import {
  applyTakeoffToProject,
  flattenProjectItems,
  isUnitCompatible,
  syncTakeoffAssociations,
  takeoffConversionFactor,
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

describe('métré DXF — sélection d’éléments', () => {
  const dxf = {
    entities: [
      { type: 'LINE', layer: 'AEP', handle: 'A1', vertices: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
      { type: 'LWPOLYLINE', layer: 'VOIRIE', shape: true, vertices: [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 },
      ] },
      { type: 'INSERT', layer: 'REGARDS', name: 'REGARD_EP', position: { x: 5, y: 5 }, rowCount: 2, columnCount: 3 },
      { type: 'TEXT', layer: 'TEXTES' },
      { type: 'LINE', layer: 'AEP', inPaperSpace: true, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
  };

  it('aplatit un arc de bulge en gardant une longueur fidèle', () => {
    const outline = entityOutlinePoints({
      type: 'LWPOLYLINE',
      vertices: [{ x: 0, y: 0, bulge: 1 }, { x: 2, y: 0 }],
    });
    expect(outline.length).toBeGreaterThan(4);
    expect(measurePolylineLength(outline)).toBeCloseTo(Math.PI, 1);
  });

  it('indexe les entités mesurables avec handle, mesures et contours', () => {
    const index = buildEntityIndex(dxf);

    expect(index.count).toBe(3);
    expect(index.ids[0]).toBe('A1');
    expect(index.ids[1]).toBe('#1'); // pas de handle → rang dans le fichier
    expect(index.lengths[0]).toBe(5);
    expect(index.areas[1]).toBe(40);
    expect(index.counts[2]).toBe(6);
    expect(index.layerNames[index.layerCodes[2]]).toBe('REGARDS');
    expect(index.pointOffsets[1] - index.pointOffsets[0]).toBe(2); // ligne = 2 points
    expect(index.pointOffsets[3] - index.pointOffsets[2]).toBe(1); // bloc = point d'insertion
  });

  it('se désactive au-delà de la limite d’entités', () => {
    expect(buildEntityIndex(dxf, 2)).toEqual({ skipped: true });
  });

  it('somme les mesures d’une sélection et signale les ids introuvables', () => {
    const index = buildEntityIndex(dxf);
    const measure = measureSelection(index, ['A1', '#1', 'ZZ']);

    expect(measure.entityCount).toBe(2);
    expect(measure.rawLength).toBeCloseTo(5 + 28, 8); // ligne + périmètre du rectangle
    expect(measure.rawArea).toBe(40);
    expect(measure.missingIds).toEqual(['ZZ']);
  });

  it('convertit une sélection en lignes de métré à l’échelle', () => {
    const rows = buildSelectionRows([{
      id: 's1', label: 'Réseau AEP', rawLength: 1000, rawArea: 0, rawCount: 0, entityCount: 3,
    }], 0.001);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'sel::s1::length', metric: 'length', quantity: 1, layer: 'Réseau AEP', isSelection: true,
    });
  });

  it('crée une ligne de métré manuelle vide avec son unité', () => {
    const rows = buildSelectionRows([{
      id: 'manual1', label: 'Article DQE', metric: 'area', unit: 'm³', isManual: true,
      highlightHidden: true,
    }], 1);

    expect(rows).toEqual([expect.objectContaining({
      id: 'sel::manual1::area',
      layer: 'Article DQE',
      metric: 'area',
      unit: 'm³',
      quantity: 0,
      isManual: true,
      highlightHidden: true,
    })]);
  });

  it('attribue des nuances distinctes dans chaque famille de réseau', () => {
    const existing = [
      { id: 's1', highlightColor: OTHER_MEASUREMENT_COLORS[0].color },
      { id: 's2', highlightColor: OTHER_MEASUREMENT_COLORS[1].color },
    ];
    expect(nextMeasurementColor(existing)).toBe(OTHER_MEASUREMENT_COLORS[2].color);

    const migrated = assignMissingMeasurementColors([
      { id: 's1', label: 'Canalisation AEP principale' },
      { id: 's2', label: 'Branchement AEP secondaire', highlightColor: '#123456' },
      { id: 's3', label: 'Réseau EU', highlightColor: '#abcdef', colorLocked: true },
    ]);
    const aep = NETWORK_MEASUREMENT_PALETTES.find((palette) => palette.id === 'eau_potable');
    const assainissement = NETWORK_MEASUREMENT_PALETTES.find((palette) => palette.id === 'assainissement');
    const telecom = NETWORK_MEASUREMENT_PALETTES.find((palette) => palette.id === 'telecom');

    expect(migrated[0].highlightColor).toBe(aep.colors[0]);
    expect(migrated[1].highlightColor).toBe(aep.colors[1]);
    expect(migrated[2].highlightColor).toBe('#abcdef');
    expect(suggestMeasurementColor('Canalisation AEP')).toBe(aep.colors[0]);
    expect(suggestMeasurementColor('Réseau EU')).toBe(assainissement.colors[0]);
    expect(suggestMeasurementColor('Fourreau fibre TBT')).toBe(telecom.colors[0]);
  });

  it('ordonne chaque gamme réseau de la nuance la plus claire à la plus foncée', () => {
    const brightness = (color) => {
      const value = Number.parseInt(color.slice(1), 16);
      const red = value >> 16;
      const green = (value >> 8) & 255;
      const blue = value & 255;
      return (red * 299 + green * 587 + blue * 114) / 1000;
    };

    for (const palette of NETWORK_MEASUREMENT_PALETTES) {
      const levels = palette.colors.map(brightness);
      expect(levels, palette.label).toEqual([...levels].sort((a, b) => b - a));
    }
  });

  it('retrouve l’entité la plus proche du clic (grille + tolérance + isolation)', () => {
    const index = buildEntityIndex(dxf);
    const grid = buildEntityGrid(index);
    const relX = (x) => x - index.origin.x;
    const relY = (y) => y - index.origin.y;

    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 0.5)).toBe(0); // sur la ligne AEP
    expect(hitTestEntities(index, grid, relX(20), relY(20), 0.5)).toBe(-1); // dans le vide
    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 0.5, 'VOIRIE')).toBe(1); // intérieur du rectangle
    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 0.5, 'REGARDS')).toBe(-1); // calque isolé sans candidat
    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 3, 'VOIRIE')).toBe(1);
    expect(hitTestEntities(index, grid, relX(5.1), relY(5), 0.2)).toBe(2); // point d'insertion du bloc
  });

  it('restreint la visée à la métrique du mode (Linéaire / Surfaces / Comptage)', () => {
    const index = buildEntityIndex(dxf);
    const grid = buildEntityGrid(index);
    const relX = (x) => x - index.origin.x;
    const relY = (y) => y - index.origin.y;
    const NO_LAYER = '';
    const NO_SEL = null;

    // (1.5,2) : sur la ligne AEP et dans le rectangle VOIRIE.
    // Mode Linéaire → la ligne (0) ; pas de clic intérieur (contour seul).
    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 0.5, NO_LAYER, NO_SEL, 'length')).toBe(0);
    // Mode Surfaces → la ligne est ignorée (aucune aire), clic intérieur → rectangle (1).
    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 0.5, NO_LAYER, NO_SEL, 'area')).toBe(1);
    // Mode Comptage → ni ligne ni surface, rien à cet endroit.
    expect(hitTestEntities(index, grid, relX(1.5), relY(2), 0.5, NO_LAYER, NO_SEL, 'count')).toBe(-1);
    // Mode Comptage → le bloc à son point d'insertion.
    expect(hitTestEntities(index, grid, relX(5.1), relY(5), 0.2, NO_LAYER, NO_SEL, 'count')).toBe(2);
    // Mode Linéaire → clic à l'intérieur du rectangle : refusé (contour seul).
    expect(hitTestEntities(index, grid, relX(7), relY(2), 0.5, NO_LAYER, NO_SEL, 'length')).toBe(-1);
  });

  it('applique les corrections manuelles (+/−) aux lignes de métré', () => {
    const rows = [
      { id: 'A::length', metric: 'length', quantity: 128 },
      { id: 'B::area', metric: 'area', quantity: 40 },
      { id: 'C::count', metric: 'count', quantity: 3 },
    ];
    const adjusted = applyRowAdjustments(rows, { 'A::length': 15, 'B::area': -100 });

    // +15 → 143, avec base et delta conservés
    expect(adjusted[0]).toMatchObject({ quantity: 143, baseQuantity: 128, adjustment: 15 });
    // −100 sur 40 : borné à 0 (jamais négatif)
    expect(adjusted[1]).toMatchObject({ quantity: 0, baseQuantity: 40, adjustment: -100 });
    // ligne sans ajustement : intacte, pas de champ ajouté
    expect(adjusted[2]).toEqual({ id: 'C::count', metric: 'count', quantity: 3 });

    // map absente / delta nul : lignes inchangées
    expect(applyRowAdjustments(rows, null)).toBe(rows);
    expect(applyRowAdjustments(rows, { 'A::length': 0 })[0]).toBe(rows[0]);
  });

  it('n’émet que la métrique du mode dans les lignes de sélection', () => {
    // Sélection issue du mode Linéaire sur une polyligne fermée (a longueur ET aire) :
    // seule la longueur doit sortir.
    const rows = buildSelectionRows([{
      id: 's1', label: 'Linéaire 1', metric: 'length', rawLength: 28, rawArea: 40, rawCount: 0, entityCount: 1,
    }], 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ metric: 'length', quantity: 28 });

    // Sans metric (ancienne sélection) : rétrocompatibilité, toutes les métriques présentes.
    const legacy = buildSelectionRows([{
      id: 's2', label: 'Sélection 1', rawLength: 28, rawArea: 40, rawCount: 0, entityCount: 1,
    }], 1);
    expect(legacy.map((row) => row.metric).sort()).toEqual(['area', 'length']);
  });

  it('sélectionne une surface par un clic à l’intérieur (la plus petite si imbriquées)', () => {
    const index = buildEntityIndex(dxf);
    const grid = buildEntityGrid(index);

    // (7,2) est loin de tout contour mais dans le rectangle VOIRIE
    expect(hitTestEntities(index, grid, 7 - index.origin.x, 2 - index.origin.y, 0.5)).toBe(1);
    expect(hitTestEntities(index, grid, 7 - index.origin.x, 2 - index.origin.y, 0.5, 'AEP')).toBe(-1);

    const nested = buildEntityIndex({
      entities: [
        { type: 'LWPOLYLINE', layer: 'A', shape: true, vertices: [
          { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
        ] },
        { type: 'LWPOLYLINE', layer: 'B', shape: true, vertices: [
          { x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 },
        ] },
      ],
    });
    const nestedGrid = buildEntityGrid(nested);
    expect(hitTestEntities(nested, nestedGrid, 5, 5, 0.2)).toBe(1); // îlot intérieur
    expect(hitTestEntities(nested, nestedGrid, 2, 2, 0.2)).toBe(0); // hors îlot → grande surface
  });

  it('re-cliquer un élément sélectionné le retire même si un voisin est plus proche', () => {
    const twin = buildEntityIndex({
      entities: [
        { type: 'LINE', layer: 'A', handle: 'L1', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
        { type: 'LINE', layer: 'A', handle: 'L2', vertices: [{ x: 0, y: 0.3 }, { x: 10, y: 0.3 }] },
      ],
    });
    const twinGrid = buildEntityGrid(twin);

    // Clic à y=0,2 : L2 (0,1) est plus proche que L1 (0,2)…
    expect(hitTestEntities(twin, twinGrid, 5, 0.2, 0.5)).toBe(1);
    // …mais si L1 est déjà sélectionnée, le re-clic la vise (désélection prioritaire).
    expect(hitTestEntities(twin, twinGrid, 5, 0.2, 0.5, '', new Set([0]))).toBe(0);
  });

  it('borne et surligne les entités choisies dans le repère de la scène', () => {
    const index = buildEntityIndex(dxf);

    expect(collectEntityBounds(index, ['A1'])).toEqual({ minX: 0, maxX: 3, minY: 0, maxY: 4 });

    const buffers = buildHighlightBuffers(index, ['A1', '#2'], { x: 1, y: 1 });
    expect(Array.from(buffers.linePositions)).toEqual([-1, -1, 0, 2, 3, 0]);
    expect(buffers.fillPositions).toHaveLength(0);
    expect(Array.from(buffers.markerPositions)).toEqual([4, 4, 0]);

    const surfaceBuffers = buildHighlightBuffers(index, ['#1'], { x: 0, y: 0 });
    expect(surfaceBuffers.fillPositions).toHaveLength(18); // rectangle = 2 triangles
    expect(Array.from(surfaceBuffers.markerPositions)).toEqual([]);
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
    // Traçabilité : la quantité porte sa source DXF (fichier + calques), effacée à l'édition manuelle.
    const src = result.chapters[0].children[0].takeoffSource?.global;
    expect(src?.fileName).toBe('plan.dxf');
    expect(src?.layers).toEqual(['AEP-1', 'AEP-2']);
  });

  it('ajoute le métré à la quantité existante', () => {
    const result = applyTakeoffToProject(project, [
      { itemId: 'i2', layer: 'REGARDS', metric: 'count', coefficient: 1, appliedQuantity: 4 },
    ], { mode: 'add' });
    expect(result.chapters[0].children[1].qty).toBe(5);
  });

  it('synchronise une suppression en conservant la saisie manuelle', () => {
    const manuallyAdjusted = {
      ...project,
      chapters: [{ ...project.chapters[0], children: [
        { ...project.chapters[0].children[0], qty: 25 }, // 20 DXF + 5 saisis manuellement
        project.chapters[0].children[1],
      ] }],
    };
    const result = syncTakeoffAssociations(manuallyAdjusted, [
      { itemId: 'i1', layer: 'AEP', metric: 'length', quantity: 20 },
    ], [], { fileName: 'plan.dxf' });
    expect(result.chapters[0].children[0].qty).toBe(5);
  });

  it('transfère la contribution DXF vers le nouvel article', () => {
    const applied = {
      ...project,
      chapters: [{ ...project.chapters[0], children: [
        { ...project.chapters[0].children[0], qty: 23 }, // 20 DXF + 3 manuels
        { ...project.chapters[0].children[1], qty: 6 }, // 6 manuels
      ] }],
    };
    const result = syncTakeoffAssociations(applied, [
      { itemId: 'i1', layer: 'AEP', metric: 'length', quantity: 20 },
    ], [
      { itemId: 'i2', layer: 'AEP', metric: 'length', appliedQuantity: 20 },
    ], { fileName: 'plan.dxf' });
    expect(result.chapters[0].children[0].qty).toBe(3);
    expect(result.chapters[0].children[1].qty).toBe(26);
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

  it('convertit géométriquement m²/ml vers m³ ou T (comme les blocs)', () => {
    expect(takeoffConversionFactor('m²', 'm³', { epaisseur: 0.2 })).toBeCloseTo(0.2); // × épaisseur
    expect(takeoffConversionFactor('m²', 'T', { epaisseur: 0.2, densite: 2.4 })).toBeCloseTo(0.48); // × ép × densité
    expect(takeoffConversionFactor('ml', 'm²', { largeur: 3 })).toBeCloseTo(3); // × largeur
    expect(takeoffConversionFactor('m²', 'm²', {})).toBe(1); // unités compatibles → pas de conversion
    expect(takeoffConversionFactor('u', 'm³', { epaisseur: 0.2 })).toBe(1); // comptage → jamais de conversion
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
