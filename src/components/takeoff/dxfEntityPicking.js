// Hit-test des entités du métré DXF sur l'index compact (dxfTakeoff.buildEntityIndex).
// Toutes les coordonnées manipulées ici sont RELATIVES à index.origin (précision float32) ;
// le panneau d'aperçu fait les conversions écran ↔ monde ↔ origine. Fonctions pures.

import { entityLookup } from '../../utils/takeoff/dxfTakeoff';

const GRID_DIM = 256; // grille spatiale ~256×256 cellules sur l'étendue du plan
const GRID_KEY_STRIDE = 4096;

const clampCell = (value) => Math.min(GRID_DIM - 1, Math.max(0, value));

/** Grille spatiale : cellule → rangs d'entités dont un segment traverse la cellule. */
export function buildEntityGrid(index) {
  const points = index?.points;
  if (!points || points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let cursor = 0; cursor < points.length; cursor += 2) {
    if (points[cursor] < minX) minX = points[cursor];
    if (points[cursor] > maxX) maxX = points[cursor];
    if (points[cursor + 1] < minY) minY = points[cursor + 1];
    if (points[cursor + 1] > maxY) maxY = points[cursor + 1];
  }
  const cellSize = Math.max(maxX - minX, maxY - minY) / GRID_DIM || 1;
  const cells = new Map();
  const cellX = (x) => clampCell(Math.floor((x - minX) / cellSize));
  const cellY = (y) => clampCell(Math.floor((y - minY) / cellSize));

  const insert = (cx, cy, rank) => {
    const key = cx * GRID_KEY_STRIDE + cy;
    const bucket = cells.get(key);
    if (!bucket) cells.set(key, [rank]);
    else if (bucket[bucket.length - 1] !== rank) bucket.push(rank);
  };

  const offsets = index.pointOffsets;
  // Anneaux fermés (polylignes fermées, cercles, ellipses…) : sélectionnables aussi par un
  // clic À L'INTÉRIEUR → on garde leurs bornes pour un balayage bbox + point-dans-polygone.
  const closedRanks = [];
  const closedBounds = [];
  for (let rank = 0; rank < index.count; rank += 1) {
    const start = offsets[rank];
    const end = offsets[rank + 1];
    if (end - start === 1) {
      insert(cellX(points[start * 2]), cellY(points[start * 2 + 1]), rank);
      continue;
    }
    let entityMinX = Infinity;
    let entityMinY = Infinity;
    let entityMaxX = -Infinity;
    let entityMaxY = -Infinity;
    for (let pair = start; pair + 1 < end; pair += 1) {
      const ax = points[pair * 2];
      const ay = points[pair * 2 + 1];
      const bx = points[pair * 2 + 2];
      const by = points[pair * 2 + 3];
      if (Math.min(ax, bx) < entityMinX) entityMinX = Math.min(ax, bx);
      if (Math.max(ax, bx) > entityMaxX) entityMaxX = Math.max(ax, bx);
      if (Math.min(ay, by) < entityMinY) entityMinY = Math.min(ay, by);
      if (Math.max(ay, by) > entityMaxY) entityMaxY = Math.max(ay, by);
      const cx0 = cellX(Math.min(ax, bx));
      const cx1 = cellX(Math.max(ax, bx));
      const cy0 = cellY(Math.min(ay, by));
      const cy1 = cellY(Math.max(ay, by));
      for (let cx = cx0; cx <= cx1; cx += 1) {
        for (let cy = cy0; cy <= cy1; cy += 1) insert(cx, cy, rank);
      }
    }
    const isRing = end - start >= 4
      && points[start * 2] === points[(end - 1) * 2]
      && points[start * 2 + 1] === points[(end - 1) * 2 + 1];
    if (isRing) {
      closedRanks.push(rank);
      closedBounds.push(entityMinX, entityMinY, entityMaxX, entityMaxY);
    }
  }
  return {
    minX,
    minY,
    cellSize,
    cells,
    closedRanks: Uint32Array.from(closedRanks),
    closedBounds: Float32Array.from(closedBounds),
  };
}

function pointInRing(points, start, end, x, y) {
  let inside = false;
  for (let i = start, j = end - 1; i < end; j = i, i += 1) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Entité la plus proche du point (coordonnées relatives à index.origin) à `tolerance` près.
 * `layerName` non vide = ne considérer que ce calque (isolation active). `selectedRanks`
 * (Set de rangs) = éléments déjà sélectionnés : à portée de clic, ils sont PRIORITAIRES
 * même si un voisin est plus proche → re-cliquer un élément sélectionné le retire toujours
 * (réseaux parallèles à quelques pixels). `metric` ('length'|'area'|'count') restreint la
 * visée aux entités portant cette métrique — mode Linéaire / Surfaces / Comptage ; le clic
 * intérieur des formes fermées est coupé en mode Linéaire (contour seul).
 * Renvoie le rang dans l'index, ou -1.
 */
export function hitTestEntities(index, grid, x, y, tolerance, layerName = '', selectedRanks = null, metric = '') {
  if (!index?.points || !grid) return -1;
  const points = index.points;
  const offsets = index.pointOffsets;
  const matchesMetric = (rank) => {
    if (!metric) return true;
    if (metric === 'length') return index.lengths[rank] > 0;
    if (metric === 'area') return index.areas[rank] > 0;
    return index.counts[rank] > 0;
  };
  const radius = Math.max(0, Math.ceil(tolerance / grid.cellSize));
  const centerX = clampCell(Math.floor((x - grid.minX) / grid.cellSize));
  const centerY = clampCell(Math.floor((y - grid.minY) / grid.cellSize));

  let bestRank = -1;
  let bestDistance = tolerance;
  let bestSelectedRank = -1;
  let bestSelectedDistance = tolerance;
  const seen = new Set();
  for (let cx = clampCell(centerX - radius); cx <= clampCell(centerX + radius); cx += 1) {
    for (let cy = clampCell(centerY - radius); cy <= clampCell(centerY + radius); cy += 1) {
      const bucket = grid.cells.get(cx * GRID_KEY_STRIDE + cy);
      if (!bucket) continue;
      for (const rank of bucket) {
        if (seen.has(rank)) continue;
        seen.add(rank);
        if (!matchesMetric(rank)) continue;
        if (layerName && index.layerNames[index.layerCodes[rank]] !== layerName) continue;
        const start = offsets[rank];
        const end = offsets[rank + 1];
        let distance;
        if (end - start === 1) {
          distance = Math.hypot(x - points[start * 2], y - points[start * 2 + 1]);
        } else {
          distance = Infinity;
          for (let pair = start; pair + 1 < end; pair += 1) {
            const d = distanceToSegment(
              x, y,
              points[pair * 2], points[pair * 2 + 1],
              points[pair * 2 + 2], points[pair * 2 + 3],
            );
            if (d < distance) distance = d;
          }
        }
        if (distance < bestDistance) {
          bestDistance = distance;
          bestRank = rank;
        }
        if (selectedRanks?.has(rank) && distance < bestSelectedDistance) {
          bestSelectedDistance = distance;
          bestSelectedRank = rank;
        }
      }
    }
  }
  if (bestSelectedRank >= 0) return bestSelectedRank; // re-clic = désélection prioritaire
  if (bestRank >= 0) return bestRank; // un contour à portée de clic gagne toujours
  if (metric === 'length') return -1; // mode Linéaire : contour seul, pas de clic intérieur

  // Sinon, clic à l'intérieur d'une forme fermée : la plus petite surface englobante gagne
  // (formes imbriquées : îlot dans un parking → l'îlot).
  let bestArea = Infinity;
  const ranks = grid.closedRanks || [];
  for (let cursor = 0; cursor < ranks.length; cursor += 1) {
    const rank = ranks[cursor];
    const box = cursor * 4;
    if (x < grid.closedBounds[box] || x > grid.closedBounds[box + 2]
      || y < grid.closedBounds[box + 1] || y > grid.closedBounds[box + 3]) continue;
    if (!matchesMetric(rank)) continue;
    if (layerName && index.layerNames[index.layerCodes[rank]] !== layerName) continue;
    if (!pointInRing(points, offsets[rank], offsets[rank + 1], x, y)) continue;
    const area = (grid.closedBounds[box + 2] - grid.closedBounds[box])
      * (grid.closedBounds[box + 3] - grid.closedBounds[box + 1]);
    if (area < bestArea) {
      bestArea = area;
      bestRank = rank;
    }
  }
  return bestRank;
}

/** Bornes (coordonnées dessin absolues) d'une liste d'entités — pour recadrer la vue. */
export function collectEntityBounds(index, entityIds) {
  const lookup = entityLookup(index);
  if (!lookup) return null;
  const points = index.points;
  const offsets = index.pointOffsets;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const entityId of entityIds || []) {
    const rank = lookup.get(entityId);
    if (rank == null) continue;
    found = true;
    for (let pair = offsets[rank]; pair < offsets[rank + 1]; pair += 1) {
      const x = points[pair * 2];
      const y = points[pair * 2 + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!found) return null;
  return {
    minX: minX + index.origin.x,
    maxX: maxX + index.origin.x,
    minY: minY + index.origin.y,
    maxY: maxY + index.origin.y,
  };
}

/**
 * Buffers de surlignage Three.js (positions xyz) pour une liste d'entités :
 * segments pour les contours, marqueurs pour les entités ponctuelles (blocs, points).
 * `viewerOrigin` = origine de la scène dxf-viewer (les positions rendues y sont relatives).
 */
export function buildHighlightBuffers(index, entityIds, viewerOrigin = { x: 0, y: 0 }) {
  const empty = { linePositions: new Float32Array(0), markerPositions: new Float32Array(0) };
  const lookup = entityLookup(index);
  if (!lookup) return empty;
  const shiftX = index.origin.x - (viewerOrigin.x || 0);
  const shiftY = index.origin.y - (viewerOrigin.y || 0);
  const points = index.points;
  const offsets = index.pointOffsets;
  const lines = [];
  const markers = [];
  for (const entityId of entityIds || []) {
    const rank = lookup.get(entityId);
    if (rank == null) continue;
    const start = offsets[rank];
    const end = offsets[rank + 1];
    if (end - start === 1) {
      markers.push(points[start * 2] + shiftX, points[start * 2 + 1] + shiftY, 0);
      continue;
    }
    for (let pair = start; pair + 1 < end; pair += 1) {
      lines.push(
        points[pair * 2] + shiftX, points[pair * 2 + 1] + shiftY, 0,
        points[pair * 2 + 2] + shiftX, points[pair * 2 + 3] + shiftY, 0,
      );
    }
  }
  return { linePositions: Float32Array.from(lines), markerPositions: Float32Array.from(markers) };
}
