// src/views/siteVisits/MapSubComponents.jsx
// Sous-composants Leaflet utilisés par SiteVisitsView — gestion des couches, resize, suivi GPS.

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { TILE_LAYERS, createTileLayer } from '../../utils/leafletConfig';

// Double couche : fond + overlay optionnel (cadastre/ABF/etc.)
export function DualTileLayer({ baseKey, overlayKey, overlayOpacity }) {
  const map = useMap();
  const overlayRef = useRef(null);
  useEffect(() => {
    map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
    overlayRef.current = null;
    createTileLayer(baseKey).addTo(map);
    if (overlayKey && overlayKey !== baseKey) {
      const ol = createTileLayer(overlayKey, overlayOpacity);
      ol.addTo(map);
      overlayRef.current = ol;
    }
  }, [map, baseKey, overlayKey]);
  useEffect(() => { if (overlayRef.current) overlayRef.current.setOpacity(overlayOpacity); }, [overlayOpacity]);
  return null;
}

// Clic sur couche WMS -> GetFeatureInfo -> popup avec infos du monument
export function WmsFeatureInfo({ overlayKey }) {
  const map = useMap();
  useEffect(() => {
    if (!overlayKey) return;
    const cfg = TILE_LAYERS[overlayKey];
    if (cfg?.type !== 'wms') return;

    const handleClick = async (e) => {
      const point = map.latLngToContainerPoint(e.latlng);
      const size = map.getSize();
      const bounds = map.getBounds();
      const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
      const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
      const url = `${cfg.url}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo`
        + `&LAYERS=${cfg.layers}&QUERY_LAYERS=${cfg.layers}`
        + `&INFO_FORMAT=application/json`
        + `&I=${Math.round(point.x)}&J=${Math.round(point.y)}`
        + `&CRS=EPSG:3857&BBOX=${sw.x},${sw.y},${ne.x},${ne.y}`
        + `&WIDTH=${size.x}&HEIGHT=${size.y}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.features?.length) return;
        const p = data.features[0].properties || {};
        const labels = { nom: 'Monument', type: 'Type', categorie: 'Catégorie', dateProt: 'Date protection', commune: 'Commune', departement: 'Département', codeInsee: 'Code INSEE' };
        let html = '<div style="font-family:system-ui;font-size:12px;max-width:300px;line-height:1.5">';
        const nom = p.nom || p.NOM || p.libelle || p.LIBELLE || '';
        if (nom) html += `<div style="font-weight:800;color:#1f2937;font-size:13px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${nom}</div>`;
        for (const [key, val] of Object.entries(p)) {
          if (!val || key === 'bbox' || key === 'gid' || key === 'geom') continue;
          const label = labels[key] || key.replace(/_/g, ' ');
          html += `<div><span style="font-weight:600;color:#6b7280;font-size:11px">${label} :</span> <span style="color:#374151">${val}</span></div>`;
        }
        html += '</div>';
        L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent(html).openOn(map);
      } catch { /* ignore */ }
    };
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [map, overlayKey]);
  return null;
}

// Invalide la taille de la carte quand le conteneur change (split resize)
export function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Capture la ref de la carte Leaflet
export function MapRefCapture({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

// Suit la position GPS et recentre la carte quand followMode est actif
export function FollowPosition({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (follow && position) map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
  }, [map, follow, position?.[0], position?.[1]]);
  return null;
}

// Detecte quand l'utilisateur interagit avec la carte (drag/zoom)
export function UserInteractionDetector({ onInteraction }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onInteraction();
    map.on('dragstart', handler); map.on('zoomstart', handler);
    return () => { map.off('dragstart', handler); map.off('zoomstart', handler); };
  }, [map, onInteraction]);
  return null;
}

// FitBounds une seule fois (au premier rendu avec des donnees)
export function FitBoundsOnce({ bounds }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!fittedRef.current && bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      fittedRef.current = true;
    }
  }, [map, bounds]);
  return null;
}
