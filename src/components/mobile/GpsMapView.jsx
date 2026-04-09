// src/components/mobile/GpsMapView.jsx
// Carte Leaflet multi-fonds (satellite, plan, cadastre) avec tracé GPS, photos et observations.

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// ─── Fonds de carte ────────────────────────────────────────────────────────

const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    label: 'Satellite',
  },
  plan: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    label: 'Plan',
  },
  cadastre: {
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png',
    maxZoom: 20,
    label: 'Cadastre',
  },
};

// Recalcule la taille de la carte quand le conteneur change (split resize)
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Composant qui recentre la carte
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
    }
  }, [map, bounds]);
  return null;
}

// Composant qui change le fond de carte dynamiquement
function DynamicTileLayer({ layerKey }) {
  const map = useMap();
  useEffect(() => {
    // Supprimer les anciens tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    const cfg = TILE_LAYERS[layerKey];
    L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom }).addTo(map);
  }, [map, layerKey]);
  return null;
}

// ─── Outil de mesure ────────────────────────────────────────────────────────

function MeasureTool({ active, points, onAddPoint, onReset }) {
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
          html: `<div style="position:relative;top:-28px;left:8px;background:#f97316;color:white;font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);font-family:system-ui">${fmtDist(totalDist)}</div>`,
          iconSize: [0, 0], iconAnchor: [0, 0],
        })} />
      )}
    </>
  );
}

// ─── Route entre 2 observations (OSRM) ─────────────────────────────────────

function RouteOverlay({ from, to }) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDist, setRouteDist] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to) { setRouteCoords([]); setRouteDist(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const route = data.routes?.[0];
        if (route) {
          setRouteCoords(route.geometry.coordinates.map(c => [c[1], c[0]]));
          setRouteDist(route.distance);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

  if (routeCoords.length === 0) return null;

  const mid = routeCoords[Math.floor(routeCoords.length / 2)];

  return (
    <>
      <Polyline positions={routeCoords} pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.8 }} />
      {routeDist != null && mid && (
        <Marker position={mid} icon={L.divIcon({
          className: '',
          html: `<div style="position:relative;top:-24px;left:-30px;background:#22c55e;color:white;font-size:12px;font-weight:800;padding:3px 10px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-family:system-ui">🛣️ ${fmtDist(routeDist)}</div>`,
          iconSize: [0, 0], iconAnchor: [0, 0],
        })} />
      )}
    </>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function GpsMapView({ coordinates = [], photoMarkers = [], obsMarkers = [], height = '100%', highlightedObs = null, onSelectObs = null, showMeasure = false }) {
  const [activeLayer, setActiveLayer] = useState('satellite');
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [routeMode, setRouteMode] = useState(false);
  const [routeFrom, setRouteFrom] = useState(null); // [lat, lng]
  const [routeTo, setRouteTo] = useState(null);

  const positions = coordinates.map(c => [c.lat, c.lng]);

  const bounds = useMemo(() => {
    const allPoints = [
      ...positions,
      ...photoMarkers.map(p => [p.lat, p.lng]),
      ...obsMarkers.map(o => [o.lat, o.lng]),
    ];
    if (allPoints.length === 0) return null;
    return L.latLngBounds(allPoints);
  }, [positions, photoMarkers, obsMarkers]);

  const defaultCenter = positions.length > 0 ? positions[0] : [43.6, 2.0];
  const cfg = TILE_LAYERS[activeLayer];

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      {/* Carte */}
      <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
        <MapContainer
          center={defaultCenter}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={cfg.url} maxZoom={cfg.maxZoom} />
          <DynamicTileLayer layerKey={activeLayer} />
          <InvalidateSize />
          <MeasureTool active={measuring} points={measurePoints}
            onAddPoint={(p) => setMeasurePoints(prev => [...prev, p])}
            onReset={() => setMeasurePoints([])} />

          {bounds && <FitBounds bounds={bounds} />}

          {/* Tracé GPS */}
          {positions.length > 1 && (
            <Polyline positions={smoothPath(positions)} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.9 }} />
          )}

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
          {spreadOverlapping(obsMarkers).map((o, i) => {
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
        </MapContainer>

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

        {/* Sélecteur de fond de carte — superposé en bas de la carte */}
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', padding: '4px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <button
              key={key}
              onClick={() => setActiveLayer(key)}
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
        </div>
      </div>
    </div>
  );
}
