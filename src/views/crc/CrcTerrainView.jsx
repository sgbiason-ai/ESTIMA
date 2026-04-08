// src/views/crc/CrcTerrainView.jsx
// Vue Terrain desktop — carte satellite pleine largeur avec tracé GPS, photos et observations.

import React, { Suspense, lazy, useMemo } from 'react';
import { MapPin, Camera, MessageSquare, Navigation, Clock, Ruler } from 'lucide-react';
import { stripHtml } from '../../utils/formatObsText';

const GpsMapView = lazy(() => import('../../components/mobile/GpsMapView'));

const fmtDistance = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
const fmtDuration = (ms) => {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const h = Math.floor(min / 60);
  if (h > 0) return `${h}h${String(min % 60).padStart(2, '0')}`;
  return `${min} min`;
};

export default function CrcTerrainView({ meeting, observationsByCategory }) {
  const tracking = meeting?.gpsTracking || {};
  const coordinates = tracking.coordinates || [];
  const hasTrack = coordinates.length > 0;

  // Photos géolocalisées
  const photoMarkers = useMemo(() => {
    const markers = [];
    (meeting?.observations || []).forEach(obs => {
      (obs.images || []).forEach(img => {
        if (typeof img === 'object' && img.lat != null && img.lng != null) {
          markers.push({ lat: img.lat, lng: img.lng, src: img.src, obsText: stripHtml(obs.text || '').slice(0, 80) });
        }
      });
    });
    return markers;
  }, [meeting?.observations]);

  // Observations positionnées (approximation milieu du tracé)
  const obsMarkers = useMemo(() => {
    const markers = [];
    if (coordinates.length === 0) return markers;
    Object.entries(observationsByCategory || {}).forEach(([cat, obs]) => {
      obs.forEach((o, i) => {
        // Répartir les observations le long du tracé
        const idx = Math.min(Math.floor((i / Math.max(obs.length, 1)) * coordinates.length), coordinates.length - 1);
        const pt = coordinates[idx];
        if (pt) markers.push({ lat: pt.lat, lng: pt.lng, category: cat, text: stripHtml(o.text || '').slice(0, 120) });
      });
    });
    return markers;
  }, [observationsByCategory, coordinates]);

  const duration = tracking.startTime && tracking.endTime
    ? new Date(tracking.endTime) - new Date(tracking.startTime)
    : 0;

  if (!hasTrack && photoMarkers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <MapPin size={48} className="mb-4 opacity-30" />
        <p className="text-sm font-medium text-gray-500">Aucune donnée terrain pour ce CR</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
          Utilisez l'application mobile pour enregistrer vos déplacements sur le terrain et prendre des photos géolocalisées.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">

      {/* Stats bar */}
      <div className="flex gap-3 shrink-0">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
          <Navigation size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-900">{coordinates.length} points</span>
        </div>
        {tracking.distance > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
            <Ruler size={14} className="text-emerald-500" />
            <span className="text-xs font-bold text-gray-900">{fmtDistance(tracking.distance)}</span>
          </div>
        )}
        {duration > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
            <Clock size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-gray-900">{fmtDuration(duration)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
          <Camera size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-900">{photoMarkers.length} photo{photoMarkers.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
          <MessageSquare size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-gray-900">{obsMarkers.length} obs.</span>
        </div>
      </div>

      {/* Carte pleine largeur */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
            Chargement de la carte satellite…
          </div>
        }>
          <GpsMapView
            coordinates={coordinates}
            photoMarkers={photoMarkers}
            obsMarkers={obsMarkers}
            height="100%"
          />
        </Suspense>
      </div>
    </div>
  );
}
