// src/components/expenseNotes/TripMapPreview.jsx
// Mini carte Leaflet pour previsualiser un trajet (depart, arrivee, route OSRM).

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icones Leaflet (defaut casse en bundler)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const startIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const endIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const waypointIcon = (n) => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);color:white;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;">${n}</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({ bounds }) {
  const map = useMap();
  React.useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

const TripMapPreview = ({ from, to, waypoints = [], coordinates, returnCoordinates }) => {
  const fromOk = from?.lat != null && from?.lon != null;
  const toOk = to?.lat != null && to?.lon != null;
  const validWaypoints = waypoints.filter((w) => w?.lat != null && w?.lon != null);

  // Polyline finale : geometrie OSRM si dispo, sinon ligne droite passant par les etapes
  const path = useMemo(() => {
    if (coordinates && coordinates.length > 1) return coordinates;
    const all = [];
    if (fromOk) all.push([from.lat, from.lon]);
    for (const w of validWaypoints) all.push([w.lat, w.lon]);
    if (toOk) all.push([to.lat, to.lon]);
    return all.length > 1 ? all : null;
  }, [coordinates, from, to, fromOk, toOk, validWaypoints]);

  // Bounds pour fit auto (inclut aussi le retour direct si A/R + etapes)
  const bounds = useMemo(() => {
    const allPoints = [];
    if (path) allPoints.push(...path);
    if (returnCoordinates && returnCoordinates.length > 1) allPoints.push(...returnCoordinates);
    if (allPoints.length === 0) return null;
    const lats = allPoints.map((p) => p[0]);
    const lons = allPoints.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [path, returnCoordinates]);

  if (!fromOk && !toOk) return null;

  // Cas mono-point (une seule extremite geocodee) : centrer dessus, zoom 12
  const center = fromOk ? [from.lat, from.lon] : [to.lat, to.lon];

  return (
    // isolation:isolate cree un stacking context : les z-index internes Leaflet
    // (markers a 600, popups a 700) ne sortent plus de la carte et ne couvrent
    // plus les dropdowns d'autocomplete adresse au-dessus.
    <div
      className="rounded-xl overflow-hidden border border-gray-200/60 shadow-sm relative"
      style={{ isolation: 'isolate', zIndex: 0 }}
    >
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '420px', width: '100%' }}
        attributionControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {bounds && <FitBounds bounds={bounds} />}
        {/* Aller : trace solide bleu */}
        {path && <Polyline positions={path} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85 }} />}
        {/* Retour direct (A/R + etapes) : trace pointilles orange */}
        {returnCoordinates && returnCoordinates.length > 1 && (
          <Polyline positions={returnCoordinates} pathOptions={{ color: '#f97316', weight: 3, opacity: 0.85, dashArray: '8 6' }} />
        )}
        {fromOk && <Marker position={[from.lat, from.lon]} icon={startIcon} />}
        {validWaypoints.map((w, i) => (
          <Marker key={`wp-${i}`} position={[w.lat, w.lon]} icon={waypointIcon(i + 1)} />
        ))}
        {toOk && <Marker position={[to.lat, to.lon]} icon={endIcon} />}
      </MapContainer>
    </div>
  );
};

export default TripMapPreview;
