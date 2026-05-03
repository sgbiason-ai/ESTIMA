// src/components/expenseNotes/MonthTripsMap.jsx
// Carte agregee de tous les trajets d'un mois : un trace par trajet,
// markers depart/arrivee. Couleur par motif (palette tournante).

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMotifColor } from '../../utils/motifColors';

// On reutilise la palette deterministe de motifColors.js : un motif aura
// la meme couleur dans la carte ET dans le tableau du mois.

const dotIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function FitBounds({ bounds }) {
  const map = useMap();
  React.useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

const MonthTripsMap = ({ trips }) => {
  // Convertit un array Firestore [{lat,lon}, ...] en [[lat,lon], ...] pour Leaflet
  const objToLatLon = (arr) => Array.isArray(arr) ? arr.map((p) => Array.isArray(p) ? p : [p.lat, p.lon]) : null;

  // Extraction des trajets visibles (au moins départ + arrivée géocodés OU une routeCoords)
  const data = useMemo(() => {
    return (trips || []).flatMap((t) => {
      const fromOk = t.departureGeo?.lat != null && t.departureGeo?.lon != null;
      const toOk = t.arrivalGeo?.lat != null && t.arrivalGeo?.lon != null;
      const route = objToLatLon(t.routeCoords);
      const returnRoute = objToLatLon(t.returnCoords);
      if (!fromOk && !toOk && !route?.length) return [];
      const motif = (t.motif || '').trim() || '(sans motif)';
      const color = getMotifColor(motif).dot;
      // Fallback : ligne droite si pas de route stockée
      const path = route && route.length > 1
        ? route
        : (fromOk && toOk ? [[t.departureGeo.lat, t.departureGeo.lon], [t.arrivalGeo.lat, t.arrivalGeo.lon]] : null);
      return [{
        id: t.id,
        motif,
        color,
        from: fromOk ? [t.departureGeo.lat, t.departureGeo.lon] : null,
        to: toOk ? [t.arrivalGeo.lat, t.arrivalGeo.lon] : null,
        path,
        returnPath: returnRoute,
        label: `${t.departure || '?'} → ${t.arrival || '?'} · ${t.km} km`,
      }];
    });
  }, [trips]);

  // Bounds englobant tous les segments
  const bounds = useMemo(() => {
    const all = [];
    for (const d of data) {
      if (d.path) all.push(...d.path);
      if (d.returnPath) all.push(...d.returnPath);
    }
    if (all.length === 0) return null;
    const lats = all.map((p) => p[0]);
    const lons = all.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [data]);

  // Légende motif → couleur
  const legend = useMemo(() => {
    const map = new Map();
    for (const d of data) if (!map.has(d.motif)) map.set(d.motif, d.color);
    return [...map.entries()];
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-xs text-gray-400">
        Aucun trajet géolocalisé pour ce mois — saisis des adresses via l'autocomplete pour les voir sur la carte.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200/60 shadow-sm relative"
      style={{ isolation: 'isolate', zIndex: 0 }}
    >
      <MapContainer
        center={[46.5, 2.5]} // France approximative, fitBounds prend le relais
        zoom={6}
        style={{ height: '380px', width: '100%' }}
        attributionControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {bounds && <FitBounds bounds={bounds} />}

        {data.map((d) => (
          <React.Fragment key={d.id}>
            {d.path && (
              <Polyline
                positions={d.path}
                pathOptions={{ color: d.color, weight: 3, opacity: 0.8 }}
              >
                <Tooltip direction="top" sticky>
                  <div className="text-[11px]">
                    <div className="font-bold">{d.motif}</div>
                    <div className="text-gray-600">{d.label}</div>
                  </div>
                </Tooltip>
              </Polyline>
            )}
            {d.returnPath && d.returnPath.length > 1 && (
              <Polyline
                positions={d.returnPath}
                pathOptions={{ color: d.color, weight: 2, opacity: 0.55, dashArray: '6 4' }}
              />
            )}
            {d.from && <Marker position={d.from} icon={dotIcon('#10b981')} />}
            {d.to && <Marker position={d.to} icon={dotIcon('#ef4444')} />}
          </React.Fragment>
        ))}
      </MapContainer>

      {/* Légende motifs */}
      {legend.length > 0 && (
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2 max-w-[180px] z-[400]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Motifs</div>
          <div className="flex flex-col gap-0.5">
            {legend.map(([motif, color]) => (
              <div key={motif} className="flex items-center gap-1.5 text-[10px] text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="truncate">{motif}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthTripsMap;
