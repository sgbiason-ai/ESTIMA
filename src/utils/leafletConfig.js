// src/utils/leafletConfig.js
// Configuration Leaflet partagée — tile layers IGN + factories d'icônes.
// Centralise la config dupliquée entre SiteVisitsView, TeslaModeView, GpsMapView.

import L from 'leaflet';
import { IGN_BASE, TILE_LAYERS } from './ignTiles';

// ─── Tile Layers IGN ─────────────────────────────────────────────────────────
// IGN Géoplateforme (libre, officiel, France) — fair-use ~50 req/s soutenu
// Definitions dans ignTiles.js (module pur, reutilise par les generateurs PDF).

export { IGN_BASE, TILE_LAYERS };

/** Crée un L.TileLayer (ou WMS) à partir d'une clé TILE_LAYERS */
export function createTileLayer(key, opacity = 1) {
  const cfg = TILE_LAYERS[key];
  if (cfg.type === 'wms') {
    return L.tileLayer.wms(cfg.url, { layers: cfg.layers, format: 'image/png', transparent: true, version: '1.3.0', opacity, maxZoom: cfg.maxZoom });
  }
  return L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom, opacity });
}

// ─── Leaflet icon factories ─────────────────────────────────────────────────

/** Point coloré simple (GPS start/end, position courante, etc.) */
export const createDot = (color, size = 14) => L.divIcon({
  className: '',
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

/** Numéro de segment (cercle bleu avec chiffre blanc) */
export const createSegmentIcon = (number) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;font-family:system-ui">${number}</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

/** Numéro d'observation (plus petit, orange si highlighted) */
export const createObsIcon = (number, highlighted) => L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:${highlighted ? '#f97316' : '#3b82f6'};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:800;font-family:system-ui">${number}</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

/** Point de marquage Tesla (pin violet avec numéro) */
export const createPointIcon = (number) => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:30px;height:36px;display:flex;align-items:flex-start;justify-content:center">
    <div style="position:absolute;top:0;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#8b5cf6;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>
    <div style="position:absolute;top:5px;color:white;font-size:11px;font-weight:800;font-family:system-ui;line-height:1">P${number}</div>
  </div>`,
  iconSize: [30, 36], iconAnchor: [15, 34],
});

// ─── Icônes pré-créées ──────────────────────────────────────────────────────

export const pendingIcon = createDot('#f97316', 18);
export const startGpsIcon = createDot('#22c55e', 14);
export const endGpsIcon = createDot('#ef4444', 14);
