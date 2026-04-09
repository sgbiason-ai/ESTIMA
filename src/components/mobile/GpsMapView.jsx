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
const obsIcon = createIcon('#f59e0b', 14);

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

export default function GpsMapView({ coordinates = [], photoMarkers = [], obsMarkers = [], height = '100%' }) {
  const [activeLayer, setActiveLayer] = useState('satellite');

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
    <div style={{ height, width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Carte */}
      <div style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', minHeight: 0 }}>
        <MapContainer
          center={defaultCenter}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={cfg.url} maxZoom={cfg.maxZoom} />
          <DynamicTileLayer layerKey={activeLayer} />

          {bounds && <FitBounds bounds={bounds} />}

          {/* Tracé GPS */}
          {positions.length > 1 && (
            <Polyline positions={positions} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.9 }} />
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

          {/* Marqueurs observations */}
          {obsMarkers.map((o, i) => (
            <Marker key={`obs-${i}`} position={[o.lat, o.lng]} icon={obsIcon}>
              <Popup>
                <div style={{ maxWidth: 200, fontSize: 11 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{o.category}</div>
                  <div style={{ color: '#6b7280' }}>{o.text}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Sélecteur de fond de carte — chips */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 0 0', justifyContent: 'center' }}>
        {Object.entries(TILE_LAYERS).map(([key, layer]) => (
          <button
            key={key}
            onClick={() => setActiveLayer(key)}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              border: activeLayer === key ? '2px solid #1f2937' : '1px solid #e5e7eb',
              background: activeLayer === key ? '#1f2937' : '#fff',
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
  );
}
