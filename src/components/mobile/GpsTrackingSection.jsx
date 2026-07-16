// src/components/mobile/GpsTrackingSection.jsx
// Onglet "Terrain" du CRC mobile — enregistrement GPS + carte satellite.

import React, { useState, useCallback, useRef, useEffect, Suspense, useMemo } from 'react';
import lazyWithReload from '../../utils/lazyWithReload';
import Icon from './Icon';
import { cleanGpsTrace, createGpsFixProcessor } from '../../utils/gpsSimplify';
import { stripHtml } from '../../utils/formatObsText';
import { Maximize2, X, Wand2, Undo2 } from 'lucide-react';
import {
  haversine, totalDistance, accuracyColor,
  fmtDuration, fmtDist as fmtDistance,
  bearingBetween, smoothBearing,
} from '../../utils/geoHelpers';

const GpsMapView = lazyWithReload(() => import('./GpsMapView'));

// ─── Composant principal ───────────────────────────────────────────────────

export default function GpsTrackingSection({ meeting, manager, obsByCategory, onToast, externalObsMarkers, readOnly = false }) {
  const tracking = meeting?.gpsTracking || { coordinates: [], startTime: null, endTime: null };
  const [isRecording, setIsRecording] = useState(false);
  const [liveCoords, setLiveCoords] = useState(tracking.coordinates || []);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const [liveBearing, setLiveBearing] = useState(null); // cap de déplacement (° depuis le nord)
  const lastBearingPtRef = useRef(null);
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const gpsProcessorRef = useRef(createGpsFixProcessor(tracking.coordinates || []));
  const [traceBeforeClean, setTraceBeforeClean] = useState(null);

  // Sync liveCoords quand le meeting change
  useEffect(() => {
    if (!isRecording) setLiveCoords(tracking.coordinates || []);
  }, [meeting?.id, tracking.coordinates?.length, isRecording]);

  useEffect(() => setTraceBeforeClean(null), [meeting?.id]);

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
    lastBearingPtRef.current = null;
    gpsProcessorRef.current = createGpsFixProcessor(liveCoords);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: Math.round(pos.coords.accuracy * 10) / 10,
        };
        setLastAccuracy(point.accuracy);
        const filteredPoint = gpsProcessorRef.current.push(point);
        if (!filteredPoint) return;
        // Cap de déplacement : heading GPS si dispo (en mouvement), sinon cap entre 2 fixes ≥5m
        {
          const h = pos.coords.heading, s = pos.coords.speed;
          let cand = (h != null && !Number.isNaN(h) && s != null && s > 0.5) ? h : null;
          const lastPt = lastBearingPtRef.current;
          if (lastPt == null || haversine(lastPt, filteredPoint) >= 5) {
            if (cand == null && lastPt) cand = bearingBetween(lastPt, filteredPoint);
            lastBearingPtRef.current = filteredPoint;
          }
          if (cand != null) setLiveBearing(prev => smoothBearing(prev, cand));
        }
        setLiveCoords(prev => {
          const updated = [...prev, filteredPoint];
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
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

    // Nettoyage final : précision, pointes, lissage, espacement et simplification 2 m.
    const rawCount = liveCoords.length;
    const simplified = cleanGpsTrace(liveCoords);
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

  const cleanExistingTrace = useCallback(() => {
    const cleaned = cleanGpsTrace(liveCoords);
    setTraceBeforeClean(liveCoords);
    setLiveCoords(cleaned);
    manager?.updateMeetingField('gpsTracking', {
      ...tracking,
      coordinates: cleaned,
      distance: Math.round(totalDistance(cleaned)),
    });
    onToast?.(`Trace nettoyée — ${liveCoords.length} → ${cleaned.length} points`);
  }, [liveCoords, manager, tracking, onToast]);

  const undoTraceCleaning = useCallback(() => {
    if (!traceBeforeClean) return;
    setLiveCoords(traceBeforeClean);
    manager?.updateMeetingField('gpsTracking', {
      ...tracking,
      coordinates: traceBeforeClean,
      distance: Math.round(totalDistance(traceBeforeClean)),
    });
    setTraceBeforeClean(null);
    onToast?.('Nettoyage annulé');
  }, [traceBeforeClean, manager, tracking, onToast]);

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
    <div className="h-full flex flex-col gap-2">

      {/* ── Contrôle enregistrement (barre compacte : stats inline + bouton) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-3 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-gray-900">Suivi terrain</h3>
              {isRecording && lastAccuracy != null && (
                <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: accuracyColor(lastAccuracy) }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accuracyColor(lastAccuracy) }} />
                  ±{lastAccuracy}m
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
              {(isRecording || hasTrack) ? (
                <>
                  {coords.length} pts · {fmtDistance(distance)} <span className="text-gray-400">±{Math.round(distance * 0.05)}m</span> · {isRecording ? fmtDuration(elapsed) : tracking.endTime ? fmtDuration(new Date(tracking.endTime) - new Date(tracking.startTime)) : '—'}
                  {isRecording && <span className="text-gray-400"> · écran allumé</span>}
                </>
              ) : 'Enregistrez vos déplacements GPS'}
            </div>
          </div>

          {!readOnly && !isRecording && hasTrack && (
            <div className="flex items-center gap-1">
              {traceBeforeClean && <button onClick={undoTraceCleaning} title="Annuler le nettoyage"
                className="p-2.5 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 transition"><Undo2 size={15} /></button>}
              <button onClick={cleanExistingTrace} title="Nettoyer la trace GPS"
                className="p-2.5 rounded-xl bg-blue-50 text-blue-600 active:bg-blue-100 transition"><Wand2 size={15} /></button>
            </div>
          )}

          {/* Bouton Start/Stop */}
          {!readOnly && (isRecording ? (
            <button
              onClick={stopRecording}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-bold flex items-center gap-2 active:scale-[0.97] transition shadow-sm"
            >
              <div className="w-3 h-3 rounded-sm bg-white" />
              Arrêter
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-bold flex items-center gap-2 active:scale-[0.97] transition shadow-sm"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              Démarrer
            </button>
          ))}
        </div>
      </div>

      {/* ── Carte (occupe tout l'espace restant, ou plein écran) ── */}
      {hasMapData && !fullscreenMap && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex-1 min-h-[300px] flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
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
          <div className="flex-1 min-h-0">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full text-gray-400">
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
                liveBearing={liveBearing}
                height="100%"
              />
            </Suspense>
          </div>
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
                liveBearing={liveBearing}
                height="100%"
                showMeasure
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Pas de tracé ── */}
      {!hasMapData && !isRecording && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
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
