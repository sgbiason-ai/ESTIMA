// src/components/mobile/GpsMapView.jsx
// Carte Leaflet multi-fonds (satellite, plan, cadastre) avec tracé GPS, photos et observations.

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Layers } from 'lucide-react';
import RotatingMapFrame from '../common/RotatingMapFrame';

// Fix icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icônes personnalisées
const createIcon = (color, size = 12) => L.divIcon({
  className: '',
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
});

const startIcon = createIcon('#22c55e', 16);
const endIcon = createIcon('#ef4444', 16);
const photoIcon = createIcon('#3b82f6', 14);

// Icône numérotée pour les observations (bleu par défaut, orange si highlight)
const createNumberIcon = (number, highlighted = false) => {
  const bg = highlighted ? '#f97316' : '#2563eb';
  const size = highlighted ? 30 : 24;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${highlighted ? '3px' : '2px'} solid white;box-shadow:0 ${highlighted ? '2px 8px' : '1px 4px'} rgba(0,0,0,${highlighted ? '0.5' : '0.4'});display:flex;align-items:center;justify-content:center;color:white;font-size:${highlighted ? '13' : '11'}px;font-weight:800;font-family:system-ui;transition:all 0.2s;cursor:pointer">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Anti-chevauchement : décaler les points proches
const spreadOverlapping = (markers, minDist = 0.00008) => {
  const result = markers.map(m => ({ ...m }));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const dx = result[j].lng - result[i].lng;
      const dy = result[j].lat - result[i].lat;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        const angle = (j * 2.2) + i; // angle unique par paire
        result[j].lat += Math.sin(angle) * minDist;
        result[j].lng += Math.cos(angle) * minDist;
      }
    }
  }
  return result;
};

// ─── IGN Itinéraires (libre, France) — remplace OSRM demo ────────────────

async function fetchIgnRoute(from, to, retries = 2) {
  const url = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${from[1]},${from[0]}&end=${to[1]},${to[0]}&profile=car&optimization=fastest&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const geom = data?.geometry;
        if (geom?.coordinates?.length >= 2) {
          return { coordinates: geom.coordinates.map(c => [c[1], c[0]]), distance: Number(data.distance) || 0 };
        }
      }
    } catch { /* retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
}

// ─── Lissage Catmull-Rom (courbe naturelle entre les points GPS) ────────────

function smoothPath(points, tension = 0.5, segments = 8) {
  if (points.length < 3) return points;
  const result = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    for (let t = 0; t < segments; t++) {
      const s = t / segments;
      const s2 = s * s;
      const s3 = s2 * s;

      const lat = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * s * tension +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 * tension +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3 * tension
      );
      const lng = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * s * tension +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 * tension +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3 * tension
      );
      result.push([lat, lng]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

// ─── Fonds de carte (import partagé) ──────────────────────────────────────
import { TILE_LAYERS, createTileLayer } from '../../utils/leafletConfig';

// Recalcule la taille de la carte quand le conteneur change (split resize)
// Clic sur couche WMS → GetFeatureInfo → popup avec infos du monument
function WmsFeatureInfo({ overlayKey, disabled }) {
  const map = useMap();
  useEffect(() => {
    if (!overlayKey || disabled) return;
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
  }, [map, overlayKey, disabled]);
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// FitBounds une seule fois (au premier rendu avec des données) — ne recentre plus ensuite
function FitBounds({ bounds }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!fittedRef.current && bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
      fittedRef.current = true;
    }
  }, [map, bounds]);
  return null;
}

// Gère fond de base + couche overlay avec opacité variable
function DualTileLayer({ baseKey, overlayKey, overlayOpacity }) {
  const map = useMap();
  const overlayRef = useRef(null);

  useEffect(() => {
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    overlayRef.current = null;
    createTileLayer(baseKey).addTo(map);
    if (overlayKey && overlayKey !== baseKey) {
      const ol = createTileLayer(overlayKey, overlayOpacity);
      ol.addTo(map);
      overlayRef.current = ol;
    }
  }, [map, baseKey, overlayKey]);

  useEffect(() => {
    if (overlayRef.current) overlayRef.current.setOpacity(overlayOpacity);
  }, [overlayOpacity]);

  return null;
}

// Suit la position GPS et recentre la carte quand followMode est actif
function FollowPosition({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (follow && position) {
      map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [map, follow, position?.[0], position?.[1]]);
  return null;
}

// Detecte quand l'utilisateur interagit avec la carte (drag/zoom)
function UserInteractionDetector({ onInteraction }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onInteraction();
    map.on('dragstart', handler);
    map.on('zoomstart', handler);
    return () => { map.off('dragstart', handler); map.off('zoomstart', handler); };
  }, [map, onInteraction]);
  return null;
}

// ─── Outil de mesure ────────────────────────────────────────────────────────

function MeasureTool({ active, points, onAddPoint }) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;
    const handleClick = (e) => onAddPoint([e.latlng.lat, e.latlng.lng]);
    map.on('click', handleClick);
    map.getContainer().style.cursor = 'crosshair';
    return () => {
      map.off('click', handleClick);
      map.getContainer().style.cursor = '';
    };
  }, [map, active, onAddPoint]);

  if (!active || points.length === 0) return null;

  const haversine = (a, b) => {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  let totalDist = 0;
  for (let i = 1; i < points.length; i++) totalDist += haversine(points[i - 1], points[i]);
  const fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
  // Incertitude mesure manuelle : ~5m par clic (résolution tuile + doigt), propagation quadratique
  const clickSigma = 5;
  const manualUncertainty = Math.round(Math.sqrt(points.length * clickSigma * clickSigma));

  return (
    <>
      {/* Ligne de mesure */}
      <Polyline positions={points} pathOptions={{ color: '#f97316', weight: 3, dashArray: '8 6', opacity: 0.9 }} />

      {/* Points de mesure */}
      {points.map((p, i) => {
        let segDist = '';
        if (i > 0) segDist = fmtDist(haversine(points[i - 1], p));
        return (
          <Marker key={`measure-${i}`} position={p} icon={L.divIcon({
            className: '',
            html: `<div style="width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
            iconSize: [10, 10], iconAnchor: [5, 5],
          })}>
            {segDist && <Popup><span style={{ fontSize: 11, fontWeight: 700 }}>{segDist}</span></Popup>}
          </Marker>
        );
      })}

      {/* Label total au dernier point */}
      {points.length > 1 && (
        <Marker position={points[points.length - 1]} icon={L.divIcon({
          className: '',
          html: `<div style="position:relative;top:-28px;left:8px;background:#f97316;color:white;font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);font-family:system-ui">${fmtDist(totalDist)} <span style="opacity:0.7;font-weight:500;font-size:9px">±${manualUncertainty}m</span></div>`,
          iconSize: [0, 0], iconAnchor: [0, 0],
        })} />
      )}
    </>
  );
}

// ─── Route entre 2 observations (IGN) ─────────────────────────────────────

function RouteOverlay({ from, to }) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDist, setRouteDist] = useState(null);
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to) { setRouteCoords([]); setRouteDist(null); return; }
    let cancelled = false;
    setLoading(true);
    fetchIgnRoute(from, to)
      .then(route => {
        if (cancelled || !route) return;
        setRouteCoords(route.coordinates);
        setRouteDist(route.distance);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

  if (routeCoords.length === 0) return null;

  const mid = routeCoords[Math.floor(routeCoords.length / 2)];
  // Incertitude route IGN : endpoints (5m manuels chacun) + 2% routage
  const routeUncertainty = routeDist != null ? Math.round(Math.sqrt(50 + (0.02 * routeDist) ** 2)) : 5;

  return (
    <>
      <Polyline positions={routeCoords} pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.8 }} />
      {routeDist != null && mid && (
        <Marker position={mid} icon={L.divIcon({
          className: '',
          html: `<div style="position:relative;top:-24px;left:-30px;background:#22c55e;color:white;font-size:12px;font-weight:800;padding:3px 10px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-family:system-ui">🛣️ ${fmtDist(routeDist)} <span style="opacity:0.7;font-weight:500;font-size:9px">±${routeUncertainty}m</span></div>`,
          iconSize: [0, 0], iconAnchor: [0, 0],
        })} />
      )}
    </>
  );
}

// Un point [lat, lng] valide (protège Leaflet des coordonnées undefined/NaN,
// ex. marqueurs de saut « break » dans un tracé importé du desktop).
const isValidLatLng = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// ─── Composant principal ────────────────────────────────────────────────────

export default function GpsMapView({ coordinates = [], photoMarkers = [], obsMarkers = [], segmentEndpoints = [], segmentLines = [], livePosition = null, liveBearing = null, height = '100%', highlightedObs = null, onSelectObs = null, showMeasure = false }) {
  const [activeLayer, setActiveLayer] = useState('satellite');
  const [overlayLayer, setOverlayLayer] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [routeMode, setRouteMode] = useState(false);
  const [routeFrom, setRouteFrom] = useState(null); // [lat, lng]
  const [routeTo, setRouteTo] = useState(null);

  // Follow mode : la carte suit la position GPS live. Toucher la carte suspend le
  // suivi, qui se ré-engage automatiquement après 10 s sans interaction (GPS voiture).
  const [followMode, setFollowMode] = useState(true);
  const refollowTimerRef = useRef(null);
  const handleUserInteraction = useCallback(() => {
    setFollowMode(false);
    clearTimeout(refollowTimerRef.current);
    refollowTimerRef.current = setTimeout(() => setFollowMode(true), 10000);
  }, []);
  const handleRecenter = useCallback(() => {
    clearTimeout(refollowTimerRef.current);
    setFollowMode(true);
  }, []);
  useEffect(() => () => clearTimeout(refollowTimerRef.current), []);

  // Rotation « cap vers le haut » : uniquement en suivi actif avec un cap connu,
  // jamais pendant Mesurer/Route (les taps carte seraient décalés par la rotation CSS).
  const mapRotation = (followMode && livePosition && liveBearing != null && !measuring && !routeMode) ? liveBearing : 0;

  const positions = coordinates.map(c => [c.lat, c.lng]).filter(isValidLatLng);

  const bounds = useMemo(() => {
    const allPoints = [
      ...positions,
      ...photoMarkers.map(p => [p.lat, p.lng]),
      ...obsMarkers.map(o => [o.lat, o.lng]),
      ...segmentEndpoints.map(p => [p.lat, p.lng]),
      ...segmentLines.flatMap(s => [s.from, s.to]),
    ].filter(isValidLatLng);
    if (allPoints.length === 0) return null;
    return L.latLngBounds(allPoints);
  }, [positions, photoMarkers, obsMarkers, segmentEndpoints, segmentLines]);

  // ── Cache routes IGN pour les segments (fallback si pas de route stockée) ──
  const [segmentRoutes, setSegmentRoutes] = useState({});
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    segmentLines.forEach((seg) => {
      if (!isValidLatLng(seg.from) || !isValidLatLng(seg.to)) return;
      const key = `${seg.from[0]},${seg.from[1]}-${seg.to[0]},${seg.to[1]}`;
      if (fetchedRef.current.has(key)) return;
      fetchedRef.current.add(key);
      fetchIgnRoute(seg.from, seg.to).then(route => {
        if (route) setSegmentRoutes(prev => ({ ...prev, [key]: route.coordinates }));
      });
    });
  }, [segmentLines]);

  const defaultCenter = positions.length > 0 ? positions[0] : [43.6, 2.0];

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      {/* Carte */}
      <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
        <RotatingMapFrame rotation={mapRotation} style={{ position: 'absolute', inset: 0 }}>
        <MapContainer
          center={defaultCenter}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <DualTileLayer baseKey={activeLayer} overlayKey={overlayLayer} overlayOpacity={overlayOpacity} />
          <WmsFeatureInfo overlayKey={overlayLayer} disabled={measuring || routeMode} />
          <InvalidateSize />
          {livePosition && <FollowPosition position={livePosition} follow={followMode} />}
          <UserInteractionDetector onInteraction={handleUserInteraction} />
          <MeasureTool active={measuring} points={measurePoints}
            onAddPoint={(p) => setMeasurePoints(prev => [...prev, p])}
            onReset={() => setMeasurePoints([])} />

          {bounds && <FitBounds bounds={bounds} />}

          {/* Tracé GPS */}
          {positions.length > 1 && (
            <Polyline positions={smoothPath(positions)} pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7 }} />
          )}

          {/* Segments mesurés (trait épais orange, route OSRM) */}
          {segmentLines.map((seg, i) => {
            if (!isValidLatLng(seg.from) || !isValidLatLng(seg.to)) return null;
            const key = `${seg.from[0]},${seg.from[1]}-${seg.to[0]},${seg.to[1]}`;
            const routeCoords = segmentRoutes[key];
            return routeCoords
              ? <Polyline key={`seg-line-${i}`} positions={routeCoords} pathOptions={{ color: '#f97316', weight: 6, opacity: 0.9 }} />
              : <Polyline key={`seg-line-${i}`} positions={[seg.from, seg.to]} pathOptions={{ color: '#f97316', weight: 5, dashArray: '8 6', opacity: 0.8 }} />;
          })}

          {/* Point de départ */}
          {positions.length > 0 && (
            <Marker position={positions[0]} icon={startIcon}>
              <Popup><span style={{ fontSize: 11, fontWeight: 700 }}>Départ</span></Popup>
            </Marker>
          )}

          {/* Point d'arrivée */}
          {positions.length > 1 && (
            <Marker position={positions[positions.length - 1]} icon={endIcon}>
              <Popup><span style={{ fontSize: 11, fontWeight: 700 }}>Arrivée</span></Popup>
            </Marker>
          )}

          {/* Marqueurs photos */}
          {photoMarkers.map((p, i) => (
            <Marker key={`photo-${i}`} position={[p.lat, p.lng]} icon={photoIcon}>
              <Popup>
                <div style={{ maxWidth: 150 }}>
                  <img src={p.src} alt="" style={{ width: '100%', borderRadius: 6 }} />
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Photo</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Route entre 2 observations */}
          <RouteOverlay from={routeFrom} to={routeTo} />

          {/* Marqueurs observations (numérotés, anti-chevauchement, cliquables) */}
          {spreadOverlapping(obsMarkers.filter(o => Number.isFinite(o?.lat) && Number.isFinite(o?.lng))).map((o, i) => {
            const isHighlighted = highlightedObs === o.number;
            const isRoutePoint = routeFrom && o.lat === routeFrom[0] && o.lng === routeFrom[1]
              || routeTo && o.lat === routeTo[0] && o.lng === routeTo[1];
            return (
              <Marker key={`obs-${i}`} position={[o.lat, o.lng]}
                icon={o.number ? createNumberIcon(o.number, isHighlighted || isRoutePoint) : createIcon('#f59e0b', 14)}
                eventHandlers={{ click: () => {
                  if (routeMode) {
                    if (!routeFrom) { setRouteFrom([o.lat, o.lng]); }
                    else if (!routeTo) { setRouteTo([o.lat, o.lng]); }
                    else { setRouteFrom([o.lat, o.lng]); setRouteTo(null); }
                  } else {
                    onSelectObs?.(isHighlighted ? null : o.number);
                  }
                } }}>
                <Popup>
                  <div style={{ maxWidth: 200, fontSize: 11 }}>
                    {o.number && <div style={{ fontWeight: 800, color: isHighlighted ? '#f97316' : '#2563eb', marginBottom: 2 }}>Observation n°{o.number}</div>}
                    {o.category && <div style={{ fontWeight: 700, marginBottom: 2 }}>{o.category}</div>}
                    <div style={{ color: '#6b7280' }}>{o.text}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Marqueurs départ/arrivée des segments */}
          {segmentEndpoints.filter(pt => Number.isFinite(pt?.lat) && Number.isFinite(pt?.lng)).map((pt, i) => (
            <Marker key={`seg-ep-${i}`} position={[pt.lat, pt.lng]}
              icon={createIcon(pt.type === 'start' ? '#22c55e' : '#ef4444', 10)}>
              <Popup>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {pt.type === 'start' ? 'Départ' : 'Arrivée'} — Segment {pt.number}
                </span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        </RotatingMapFrame>

        {/* Bouton recentrer — en bas à gauche */}
        {livePosition && (
          <button onClick={handleRecenter}
            style={{
              position: 'absolute', bottom: 56, left: 10, zIndex: 1000,
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: followMode ? '#3b82f6' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
              color: followMode ? '#fff' : '#6b7280', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              transition: 'all 0.15s',
            }}>
            <LocateFixed size={14} />
            {followMode ? 'Suivi actif' : 'Recentrer'}
          </button>
        )}

        {/* Boutons outils — en haut à droite */}
        {showMeasure && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 4 }}>
            {/* Mesurer */}
            <button
              onClick={() => { setMeasuring(!measuring); if (measuring) setMeasurePoints([]); setRouteMode(false); setRouteFrom(null); setRouteTo(null); }}
              style={{
                padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: measuring ? '#f97316' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
                color: measuring ? '#fff' : '#6b7280', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
                <path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" />
              </svg>
              {measuring ? 'Arrêter' : 'Mesurer'}
            </button>

            {/* Distance route */}
            <button
              onClick={() => { setRouteMode(!routeMode); if (routeMode) { setRouteFrom(null); setRouteTo(null); } setMeasuring(false); setMeasurePoints([]); }}
              style={{
                padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: routeMode ? '#22c55e' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
                color: routeMode ? '#fff' : '#6b7280', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
              }}>
              🛣️ {routeMode ? (routeFrom && !routeTo ? 'Cliquez obs B' : routeTo ? 'Recliquez pour refaire' : 'Cliquez obs A') : 'Route'}
            </button>

            {/* Effacer */}
            {(measuring && measurePoints.length > 0) || (routeFrom || routeTo) ? (
              <button
                onClick={() => { setMeasurePoints([]); setRouteFrom(null); setRouteTo(null); }}
                style={{
                  padding: '6px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', color: '#ef4444',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                Effacer
              </button>
            ) : null}
          </div>
        )}

        {/* Panneau overlay — au-dessus du sélecteur */}
        {showOverlayPanel && (
          <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', padding: '8px 12px', borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Superposer</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: overlayLayer ? 8 : 0 }}>
              {Object.entries(TILE_LAYERS)
                .filter(([key]) => key !== activeLayer)
                .map(([key, layer]) => (
                  <button
                    key={key}
                    onClick={() => setOverlayLayer(overlayLayer === key ? null : key)}
                    style={{
                      padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: overlayLayer === key ? '#3b82f6' : '#f3f4f6',
                      color: overlayLayer === key ? '#fff' : '#6b7280',
                    }}
                  >
                    {layer.label}
                  </button>
                ))}
            </div>
            {overlayLayer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>Opacité</span>
                <input
                  type="range" min="0" max="100" value={Math.round(overlayOpacity * 100)}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                  style={{ flex: 1, accentColor: '#3b82f6', height: 4 }}
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', minWidth: 28, textAlign: 'right' }}>{Math.round(overlayOpacity * 100)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Sélecteur de fond de carte + bouton overlay */}
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: 4, alignItems: 'center', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', padding: '4px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {Object.entries(TILE_LAYERS)
            .filter(([, layer]) => !layer.overlayOnly)
            .map(([key, layer]) => (
            <button
              key={key}
              onClick={() => { setActiveLayer(key); if (overlayLayer === key) setOverlayLayer(null); }}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                border: 'none',
                background: activeLayer === key ? '#1f2937' : 'transparent',
                color: activeLayer === key ? '#fff' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {layer.label}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: '#e5e7eb', margin: '0 2px' }} />
          <button
            onClick={() => setShowOverlayPanel(!showOverlayPanel)}
            style={{
              padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: overlayLayer ? '#3b82f6' : (showOverlayPanel ? '#f3f4f6' : 'transparent'),
              color: overlayLayer ? '#fff' : '#6b7280',
              display: 'flex', alignItems: 'center', transition: 'all 0.15s',
            }}
          >
            <Layers size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
