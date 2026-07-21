// src/utils/ignTiles.js
// Definitions des tuiles IGN Geoplateforme — module pur, SANS dependance Leaflet,
// pour etre partage entre la carte de l'app (leafletConfig) et les generateurs PDF
// (assemblage canvas + tuiles). Source unique des URLs WMTS.

export const IGN_BASE = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

export const TILE_LAYERS = {
  satellite: { url: `${IGN_BASE}&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&FORMAT=image/jpeg`, maxZoom: 19, label: 'Satellite' },
  plan:      { url: `${IGN_BASE}&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png`, maxZoom: 19, label: 'Plan' },
  cadastre:  { url: `${IGN_BASE}&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&FORMAT=image/png`, maxZoom: 20, label: 'Cadastre' },
  abf:       { type: 'wms', url: 'https://data.geopf.fr/wms-v/ows', layers: 'monument_historique', maxZoom: 20, label: 'ABF (MH)', overlayOnly: true },
};

// ─── Maths « slippy tiles » (identiques a Leaflet / WMTS PM) ────────────────

const deg2rad = (d) => d * Math.PI / 180;

export const lng2tileX = (lng, z) => Math.floor((lng + 180) / 360 * (1 << z));

export const lat2tileY = (lat, z) => Math.floor(
  (1 - Math.log(Math.tan(deg2rad(lat)) + 1 / Math.cos(deg2rad(lat))) / Math.PI) / 2 * (1 << z)
);

/** Convertit lat/lng en pixel dans le systeme de tuiles mondial (256 px/tuile). */
export const latLng2px = (lat, lng, z) => {
  const n = 1 << z;
  const latRad = deg2rad(lat);
  return {
    x: ((lng + 180) / 360) * n * 256,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256,
  };
};

/** URL de tuile WMTS pour un calque et un triplet z/x/y (null si calque WMS). */
export const buildTileUrl = (key, z, x, y) => {
  const cfg = TILE_LAYERS[key];
  if (!cfg || cfg.type === 'wms') return null;
  return cfg.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
};

// ─── Vues cartographiques des exports PDF ────────────────────────────────────
// Une vue = une pile de calques dessines dans l'ordre (fond puis surcouches).
// `dual` : deux vignettes cote a cote — reserve aux vignettes d'observation,
// la carte pleine page n'expose que les vues a pile unique.

export const PDF_MAP_VIEWS = {
  satellite: { label: 'Satellite', hint: 'Photo aérienne', stack: ['satellite'] },
  plan:      { label: 'Plan', hint: 'Rues et bâti', stack: ['plan'] },
  cadastre:  { label: 'Cadastre', hint: 'Parcelles sur fond plan', stack: ['plan', 'cadastre'] },
  dual:      { label: 'Satellite + Plan', hint: 'Deux vignettes côte à côte', stack: ['satellite'], dual: [['satellite'], ['plan']] },
};

/** Vues proposees pour la carte pleine page (pas de vignette double). */
export const PDF_OVERVIEW_VIEWS = Object.fromEntries(
  Object.entries(PDF_MAP_VIEWS).filter(([, v]) => !v.dual)
);

// Defauts = rendu historique du PDF (vignettes en plan, vue d'ensemble aerienne).
export const DEFAULT_PDF_VIEWS = { obs: 'plan', overview: 'satellite' };
