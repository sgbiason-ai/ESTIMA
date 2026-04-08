// src/components/mobile/GpsMapView.jsx
// Carte satellite Leaflet avec tracé GPS, photos et observations.
// Chargé dynamiquement (React.lazy) pour ne pas alourdir le bundle.

import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icônes Leaflet (manquantes par défaut avec bundlers)
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

const startIcon = createIcon('#22c55e', 16); // vert
const endIcon = createIcon('#ef4444', 16);   // rouge
const photoIcon = createIcon('#3b82f6', 14); // bleu
const obsIcon = createIcon('#f59e0b', 14);   // amber

// Composant qui recentre la carte sur les bounds
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
    }
  }, [map, bounds]);
  return null;
}

export default function GpsMapView({ coordinates = [], photoMarkers = [], obsMarkers = [], height = '100%' }) {
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

  return (
    <div style={{ height, width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={17}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {bounds && <FitBounds bounds={bounds} />}

        {/* Tracé GPS */}
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.9 }}
          />
        )}

        {/* Point de départ */}
        {positions.length > 0 && (
          <Marker position={positions[0]} icon={startIcon}>
            <Popup><span className="text-xs font-bold">Départ</span></Popup>
          </Marker>
        )}

        {/* Point d'arrivée */}
        {positions.length > 1 && (
          <Marker position={positions[positions.length - 1]} icon={endIcon}>
            <Popup><span className="text-xs font-bold">Arrivée</span></Popup>
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
  );
}
