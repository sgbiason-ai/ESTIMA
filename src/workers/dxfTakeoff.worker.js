import DxfParser from 'dxf-viewer/src/parser/DxfParser.js';
import { DxfScene } from 'dxf-viewer/src/DxfScene.js';
import opentype from 'opentype.js';
import { aggregateDxfTakeoff } from '../utils/takeoff/dxfTakeoff';

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

  const rawEntityCounts = {};
  const entityPattern = /(?:^|\r?\n)\s*0\r?\n([A-Z][A-Z0-9_]*)\r?\n/g;
  let match;
  while ((match = entityPattern.exec(buffer)) !== null) {
    const type = match[1];
    rawEntityCounts[type] = (rawEntityCounts[type] || 0) + 1;
  }

  sendProgress(sequence, 'parse', 0, totalSize);
  const dxf = new DxfParser().parseSync(buffer);
  return { dxf, rawEntityCounts };
}

function createFontFetchers(urls, sequence) {
  return (urls || []).map((url) => async () => {
    sendProgress(sequence, 'font', 0, null);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Police DXF inaccessible (${response.status})`);
    const font = opentype.parse(await response.arrayBuffer());
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

self.onmessage = async (event) => {
  const message = event.data;
  if (message?.signature !== SIGNATURE) return;

  const response = { signature: SIGNATURE, seq: message.seq, type: message.type };
  const transfers = [];
  try {
    if (message.type === LOAD) {
      const { url, fonts, options = {} } = message.data || {};
      const { dxf, rawEntityCounts } = await fetchDxf(url, options.fileEncoding, message.seq);
      const takeoffSummary = aggregateDxfTakeoff(dxf, rawEntityCounts);
      takeoffSummary.metadata.invalidHatchesSkipped = removeInvalidHatches(dxf);
      sendProgress(message.seq, 'prepare', 0, null);

      const dxfScene = new DxfScene(options);
      await dxfScene.Build(dxf, createFontFetchers(fonts, message.seq));
      const scene = dxfScene.scene;
      takeoffSummary.metadata.fitBounds = takeoffSummary.metadata.robustFitBounds || scene.bounds;
      takeoffSummary.metadata.robustFitApplied = Boolean(takeoffSummary.metadata.robustFitBounds);
      transfers.push(scene.vertices, scene.indices, scene.transforms);
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
