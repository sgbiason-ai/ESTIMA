// src/components/mobile/GpsTrackingSection.jsx
// Onglet "Terrain" du CRC mobile — enregistrement GPS + carte satellite.

import React, { useState, useCallback, useRef, useEffect, Suspense, useMemo } from 'react';
import lazyWithReload from '../../utils/lazyWithReload';
import Icon from './Icon';
import { simplifyGpsTrace } from '../../utils/gpsSimplify';
import { stripHtml } from '../../utils/formatObsText';
import { Maximize2, X } from 'lucide-react';
import {
  haversine, totalDistance, accuracyColor,
  fmtDuration, fmtDist as fmtDistance,
} from '../../utils/geoHelpers';

const GpsMapView = lazyWithReload(() => import('./GpsMapView'));

// ─── Composant principal ───────────────────────────────────────────────────

export default function GpsTrackingSection({ meeting, manager, obsByCategory, onToast, externalObsMarkers }) {
  const tracking = meeting?.gpsTracking || { coordinates: [], startTime: null, endTime: null };
  const [isRecording, setIsRecording] = useState(false);
  const [liveCoords, setLiveCoords] = useState(tracking.coordinates || []);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Sync liveCoords quand le meeting change
  useEffect(() => {
    if (!isRecording) setLiveCoords(tracking.coordinates || []);
  }, [meeting?.id, tracking.coordinates?.length, isRecording]);

  // ── Photos géolocalisées de ce CR ──
  const photoMarkers = useMemo(() => {
    const markers = [];
    (meeting?.observations || []).forEach(obs => {
      (obs.images || []).forEach(img => {
        if (typeof img === 'object' && img.lat != null && img.lng != null) {
          markers.push({ lat: img.lat, lng: img.lng, src: img.src });
        }
      });
    });
    return markers;
  }, [meeting?.observations]);

  // ── Segments mesurés (lignes + endpoints pour la carte) ──
  const segmentLines = useMemo(() => {
    return (meeting?.observations || [])
      .filter(obs => obs.segmentFrom && obs.segmentTo)
      .map((obs) => ({
        from: [obs.segmentFrom.lat, obs.segmentFrom.lng],
        to: [obs.segmentTo.lat, obs.segmentTo.lng],
        distance: obs.segmentDistance,
      }));
  }, [meeting?.observations]);

  const segmentEndpoints = useMemo(() => {
    const pts = [];
    (meeting?.observations || []).forEach((obs, idx) => {
      if (obs.segmentFrom && obs.segmentTo) {
        pts.push({ lat: obs.segmentFrom.lat, lng: obs.segmentFrom.lng, type: 'start', number: idx + 1 });
        pts.push({ lat: obs.segmentTo.lat, lng: obs.segmentTo.lng, type: 'end', number: idx + 1 });
      }
    });
    return pts;
  }, [meeting?.observations]);

  // ── Observations — utiliser externalObsMarkers si fourni ──
  const obsMarkers = useMemo(() => {
    if (externalObsMarkers) return externalObsMarkers;
    const markers = [];
    Object.entries(obsByCategory || {}).forEach(([cat, obs]) => {
      obs.forEach(o => {
        const coords = liveCoords.length > 0 ? liveCoords : (tracking.coordinates || []);
        if (coords.length > 0) {
          const mid = coords[Math.floor(coords.length / 2)];
          if (mid) markers.push({ lat: mid.lat, lng: mid.lng, category: cat, text: stripHtml(o.text || '').slice(0, 100) });
        }
      });
    });
    return markers;
  }, [obsByCategory, liveCoords, tracking.coordinates]);

  // ── Wake Lock ──
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch { /* non supporté ou refusé */ }
  };

  const releaseWakeLock = () => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  };

  // ── Start/Stop recording ──
  const startRecording = useCallback(() => {
    if (!navigator.geolocation) {
      onToast?.('Géolocalisation non disponible');
      return;
    }

    setIsRecording(true);
    startTimeRef.current = Date.now();
    requestWakeLock();

    // Timer pour le compteur
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 1000);

    // Sauvegarder le startTime
    if (manager) {
      manager.updateMeetingField('gpsTracking', {
        ...tracking,
        startTime: new Date().toISOString(),
        coordinates: liveCoords,
      });
    }

    // GPS watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: Math.round(pos.coords.accuracy * 10) / 10,
        };
        setLastAccuracy(point.accuracy);
        setLiveCoords(prev => {
          // Filtre distance min 5m — ignorer si trop proche du dernier point
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = haversine(last, point);
            if (dist < 5) return prev;
          }
          const updated = [...prev, point];
          // Sauvegarde périodique (tous les 5 points)
          if (updated.length % 5 === 0 && manager) {
            manager.updateMeetingField('gpsTracking', {
              startTime: tracking.startTime || new Date().toISOString(),
              coordinates: updated,
              distance: Math.round(totalDistance(updated)),
            });
          }
          return updated;
        });
      },
      (err) => {
        console.warn('GPS error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [manager, tracking, liveCoords, onToast]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    releaseWakeLock();

    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Simplification Douglas-Peucker (epsilon 5m) + sauvegarde finale
    const rawCount = liveCoords.length;
    const simplified = simplifyGpsTrace(liveCoords, 5);
    setLiveCoords(simplified);

    if (manager) {
      manager.updateMeetingField('gpsTracking', {
        startTime: tracking.startTime,
        endTime: new Date().toISOString(),
        coordinates: simplified,
        distance: Math.round(totalDistance(simplified)),
      });
    }

    onToast?.(`Tracé enregistré — ${simplified.length} pts (${rawCount - simplified.length} supprimés)`);
  }, [manager, tracking, liveCoords, onToast]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      releaseWakeLock();
    };
  }, []);

  const distance = totalDistance(liveCoords);
  const hasTrack = liveCoords.length > 0;
  // La carte s'affiche aussi quand il y a des segments ou des photos géolocalisées, pas seulement un tracé.
  const hasMapData = hasTrack || segmentLines.length > 0 || photoMarkers.length > 0;
  const coords = liveCoords;
  const currentLivePosition = isRecording && liveCoords.length > 0 ? [liveCoords[liveCoords.length - 1].lat, liveCoords[liveCoords.length - 1].lng] : null;

  return (
    <div className="flex flex-col gap-4 pb-6">

      {/* ── Contrôle enregistrement ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Suivi terrain</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {isRecording ? 'Enregistrement en cours…' : hasTrack ? 'Tracé enregistré' : 'Démarrer le suivi GPS'}
            </p>
          </div>
          {isRecording && lastAccuracy != null && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: accuracyColor(lastAccuracy) }} />
              <span className="text-[11px] font-bold" style={{ color: accuracyColor(lastAccuracy) }}>
                ±{lastAccuracy}m
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        {(isRecording || hasTrack) && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{coords.length}</div>
              <div className="text-[10px] text-gray-500 font-medium">Points</div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{fmtDistance(distance)} <span className="text-[9px] text-gray-400 font-medium">±{Math.round(distance * 0.05)}m</span></div>
              <div className="text-[10px] text-gray-500 font-medium">Distance</div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{isRecording ? fmtDuration(elapsed) : tracking.endTime ? fmtDuration(new Date(tracking.endTime) - new Date(tracking.startTime)) : '—'}</div>
              <div className="text-[10px] text-gray-500 font-medium">Durée</div>
            </div>
          </div>
        )}

        {/* Bouton Start/Stop */}
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="w-full py-4 rounded-2xl bg-red-500 text-white text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition shadow-sm"
          >
            <div className="w-4 h-4 rounded-sm bg-white" />
            Arrêter l'enregistrement
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition shadow-sm"
          >
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            Démarrer le suivi GPS
          </button>
        )}

        {isRecording && (
          <p className="text-[10px] text-gray-400 text-center mt-2 italic">
            L'écran reste allumé pendant l'enregistrement
          </p>
        )}
      </div>

      {/* ── Carte (miniature ou plein écran) ── */}
      {hasMapData && !fullscreenMap && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-900">Carte</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">
                {photoMarkers.length} photo{photoMarkers.length !== 1 ? 's' : ''}
                {segmentLines.length > 0 && ` · ${segmentLines.length} segment${segmentLines.length !== 1 ? 's' : ''}`}
                {coords.length > 0 && ` · ${coords.length} pts`}
              </span>
              <button
                onClick={() => setFullscreenMap(true)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 active:scale-[0.95] transition"
                title="Plein écran"
              >
                <Maximize2 size={14} className="text-gray-600" />
              </button>
            </div>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              Chargement de la carte…
            </div>
          }>
            <GpsMapView
              coordinates={coords}
              photoMarkers={photoMarkers}
              obsMarkers={obsMarkers}
              segmentEndpoints={segmentEndpoints}
              segmentLines={segmentLines}
              livePosition={currentLivePosition}
              height="50vh"
            />
          </Suspense>
        </div>
      )}

      {hasMapData && fullscreenMap && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0 bg-white/80 backdrop-blur-xl">
            <span className="text-[15px] font-bold text-gray-900">Carte terrain</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">
                {photoMarkers.length} photo{photoMarkers.length !== 1 ? 's' : ''}
                {segmentLines.length > 0 && ` · ${segmentLines.length} segment${segmentLines.length !== 1 ? 's' : ''}`}
                {coords.length > 0 && ` · ${coords.length} pts`}
              </span>
              <button
                onClick={() => setFullscreenMap(false)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-[0.95] transition"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                Chargement…
              </div>
            }>
              <GpsMapView
                coordinates={coords}
                photoMarkers={photoMarkers}
                obsMarkers={obsMarkers}
                segmentEndpoints={segmentEndpoints}
                segmentLines={segmentLines}
                livePosition={currentLivePosition}
                height="100%"
                showMeasure
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Pas de tracé ── */}
      {!hasMapData && !isRecording && (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="chart" size={24} color="#9ca3af" />
          </div>
          <p className="text-[13px] text-gray-500">Aucun tracé pour ce compte rendu</p>
          <p className="text-[11px] text-gray-400 mt-1">Appuyez sur « Démarrer » pour enregistrer vos déplacements</p>
        </div>
      )}
    </div>
  );
}
