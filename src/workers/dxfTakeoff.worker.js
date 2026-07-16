import DxfParser from 'dxf-viewer/src/parser/DxfParser.js';
import { DxfScene } from 'dxf-viewer/src/DxfScene.js';
import opentype from 'opentype.js';
import { aggregateDxfTakeoff, HATCH_RENDER_LAYER } from '../utils/takeoff/dxfTakeoff';
import {
  computeLayoutPaperBounds,
  createPaperSpaceDxf,
  scanDxfStructure,
} from '../utils/takeoff/dxfLayouts';

// dxf-viewer émet un console.warn pour CHAQUE entité HATCH dont il ne sait pas convertir
// les contours (types de boucles non implémentés). Ces hachures sont simplement ignorées au
// rendu (et le métré n'utilise jamais les HATCH) → on filtre ce message pour éviter le flood.
const originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('HATCH entity with empty boundary loops')) return;
  originalWarn(...args);
};

const SIGNATURE = 'DxfWorkerMsg';
const LOAD = 'LOAD';
const PROGRESS = 'PROGRESS';
const DESTROY = 'DESTROY';

function sendProgress(sequence, phase, size, totalSize) {
  self.postMessage({
    signature: SIGNATURE,
    seq: sequence,
    type: PROGRESS,
    data: { phase, size, totalSize },
  });
}

async function fetchDxf(url, encoding, sequence) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lecture DXF impossible (${response.status})`);
  const totalSize = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const decoder = new TextDecoder(encoding || 'utf-8');
  let receivedSize = 0;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode(new ArrayBuffer(0), { stream: false });
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    receivedSize += value.length;
    sendProgress(sequence, 'fetch', receivedSize, totalSize);
  }

  sendProgress(sequence, 'parse', 0, totalSize);
  const structure = scanDxfStructure(buffer);
  const dxf = new DxfParser().parseSync(buffer);
  return { dxf, structure };
}

function createFontFetchers(urls, sequence) {
  const cache = new Map();
  return (urls || []).map((url) => async () => {
    if (!cache.has(url)) {
      sendProgress(sequence, 'font', 0, null);
      cache.set(url, fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`Police DXF inaccessible (${response.status})`);
        return opentype.parse(await response.arrayBuffer());
      }));
    }
    const font = await cache.get(url);
    sendProgress(sequence, 'prepare', 0, null);
    return font;
  });
}

function removeInvalidHatches(dxf) {
  let skipped = 0;
  const filter = (entities) => (entities || []).filter((entity) => {
    const invalid = entity?.type === 'HATCH'
      && (!Array.isArray(entity.boundaryLoops) || entity.boundaryLoops.length === 0);
    if (invalid) skipped += 1;
    return !invalid;
  });

  dxf.entities = filter(dxf.entities);
  for (const block of Object.values(dxf.blocks || {})) block.entities = filter(block.entities);
  return skipped;
}

// dxf-viewer (_FilterEntity) masque les calques GELÉS et les entités cachées, alors que le
// métré les compte. On les révèle pour que l'aperçu corresponde au métré.
function revealHiddenGeometry(dxf) {
  let unfrozen = 0;
  const layers = dxf?.tables?.layer?.layers;
  if (layers) {
    for (const layer of Object.values(layers)) {
      if (layer && layer.frozen) { layer.frozen = false; unfrozen += 1; }
    }
  }
  const unhide = (entities) => {
    for (const entity of entities || []) {
      if (entity && entity.hidden) entity.hidden = false;
    }
  };
  unhide(dxf.entities);
  for (const block of Object.values(dxf.blocks || {})) unhide(block.entities);
  return unfrozen;
}

// Regroupe les aplats pleins (HATCH/SOLID) sur un calque de rendu dédié pour pouvoir les
// masquer sans cacher le texte (rendu aussi en Mesh). Ajoute ce calque à la table pour que
// dxf-viewer l'instancie réellement (sinon les objets retombent sur le calque « 0 »).
function retagFillLayers(dxf) {
  const layers = dxf.tables?.layer?.layers;
  if (layers && !layers[HATCH_RENDER_LAYER]) {
    layers[HATCH_RENDER_LAYER] = {
      name: HATCH_RENDER_LAYER, frozen: false, visible: true, color: 0x9aa0a6, colorIndex: 8,
    };
  }
  // Aplats de niveau supérieur → calque de rendu dédié (masquables via le bouton « Hachures »).
  for (const entity of dxf.entities || []) {
    if (entity && (entity.type === 'HATCH' || entity.type === 'SOLID')) entity.layer = HATCH_RENDER_LAYER;
  }
  // Dans les blocs, l'INSERT impose SON calque aux entités (dxf-viewer, cf. _CreateObjects) → le
  // retag est inopérant. On SUPPRIME donc les HATCH des définitions de blocs (gros aplats
  // instanciés, jamais métrés) ; les SOLID (petits symboles remplis) sont conservés.
  for (const block of Object.values(dxf.blocks || {})) {
    if (block.entities) block.entities = block.entities.filter((entity) => entity?.type !== 'HATCH');
  }
}

function addSceneTransfers(scene, transfers) {
  transfers.push(scene.vertices, scene.indices, scene.transforms);
}

async function buildPaperLayouts(dxf, layouts, options, fontFetchers, sequence, transfers) {
  const paperOptions = {
    ...options,
    sceneOptions: { ...options.sceneOptions, suppressPaperSpace: false },
  };
  const result = [];

  for (let index = 0; index < layouts.length; index += 1) {
    sendProgress(sequence, 'layouts', index, layouts.length);
    const layout = layouts[index];
    const paperDxf = createPaperSpaceDxf(dxf, layout);
    const paperSceneBuilder = new DxfScene(paperOptions);
    await paperSceneBuilder.Build(paperDxf, fontFetchers);
    const paperScene = paperSceneBuilder.scene;
    addSceneTransfers(paperScene, transfers);
    result.push({
      ...layout,
      paperEntityCount: paperDxf.entities.length,
      paperBounds: computeLayoutPaperBounds(layout, paperScene.bounds),
      paperScene,
    });
  }
  sendProgress(sequence, 'layouts', layouts.length, layouts.length);
  return result;
}

self.onmessage = async (event) => {
  const message = event.data;
  if (message?.signature !== SIGNATURE) return;

  const response = { signature: SIGNATURE, seq: message.seq, type: message.type };
  const transfers = [];
  try {
    if (message.type === LOAD) {
      const { url, fonts, options = {} } = message.data || {};
      const { dxf, structure } = await fetchDxf(url, options.fileEncoding, message.seq);
      const takeoffSummary = aggregateDxfTakeoff(dxf, structure.rawEntityCounts);
      takeoffSummary.metadata.invalidHatchesSkipped = removeInvalidHatches(dxf);
      takeoffSummary.metadata.unfrozenLayers = revealHiddenGeometry(dxf);
      retagFillLayers(dxf);
      sendProgress(message.seq, 'prepare', 0, null);

      const fontFetchers = createFontFetchers(fonts, message.seq);
      const dxfScene = new DxfScene(options);
      await dxfScene.Build(dxf, fontFetchers);
      const scene = dxfScene.scene;
      takeoffSummary.metadata.fitBounds = takeoffSummary.metadata.robustFitBounds || scene.bounds;
      takeoffSummary.metadata.robustFitApplied = Boolean(takeoffSummary.metadata.robustFitBounds);
      takeoffSummary.layouts = await buildPaperLayouts(
        dxf,
        structure.layouts,
        options,
        fontFetchers,
        message.seq,
        transfers,
      );
      addSceneTransfers(scene, transfers);
      // DxfViewer conserve ce champ dans GetDxf(). On y place uniquement le
      // résumé léger, jamais l'objet DXF complet de plusieurs centaines de Mo.
      response.data = { scene, dxf: takeoffSummary };
    } else if (message.type === DESTROY) {
      response.data = null;
    } else {
      throw new Error(`Message worker inconnu : ${message.type}`);
    }
  } catch (error) {
    response.error = error instanceof Error ? error.message : String(error);
  }

  self.postMessage(response, transfers);
  if (message.type === DESTROY) self.close();
};
