import DxfParser from 'dxf-viewer/src/parser/DxfParser.js';
import { DxfScene } from 'dxf-viewer/src/DxfScene.js';
import opentype from 'opentype.js';
import { aggregateDxfTakeoff } from '../utils/takeoff/dxfTakeoff';
import {
  computeLayoutPaperBounds,
  createPaperSpaceDxf,
  scanDxfStructure,
} from '../utils/takeoff/dxfLayouts';

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
