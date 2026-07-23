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
const EMPTY_GPS_TRACKING = Object.freeze({
  coordinates: Object.freeze([]),
  startTime: null,
  endTime: null,
  distance: 0,
});

// ─── Composant principal ───────────────────────────────────────────────────

export default function GpsTrackingSection({
  meeting,
  manager,
  obsByCategory,
  onToast,
  onFlushTracking,
  onRecordingChange,
  externalObsMarkers,
  readOnly = false,
}) {
  const tracking = useMemo(
    () => meeting?.gpsTracking || EMPTY_GPS_TRACKING,
    [meeting?.gpsTracking]
  );
  const [isRecording, setIsRecording] = useState(false);
  const [liveCoords, setLiveCoords] = useState(tracking.coordinates || []);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [liveBearing, setLiveBearing] = useState(null); // cap de déplacement (° depuis le nord)
  const lastBearingPtRef = useRef(null);
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const startTimeRef = useRef(tracking.startTime || null);
  const liveCoordsRef = useRef(tracking.coordinates || []);
  const isRecordingRef = useRef(false);
  const pendingBreakRef = useRef(false);
  const acceptedSinceFlushRef = useRef(0);
  const trackingRef = useRef(tracking);
  const managerRef = useRef(manager);
  const onToastRef = useRef(onToast);
  const onFlushTrackingRef = useRef(onFlushTracking);
  const onRecordingChangeRef = useRef(onRecordingChange);
  const gpsProcessorRef = useRef(createGpsFixProcessor(tracking.coordinates || []));
  const [traceBeforeClean, setTraceBeforeClean] = useState(null);

  trackingRef.current = tracking;
  managerRef.current = manager;
  onToastRef.current = onToast;
  onFlushTrackingRef.current = onFlushTracking;
  onRecordingChangeRef.current = onRecordingChange;

  // Sync liveCoords quand le meeting change
  useEffect(() => {
    if (!isRecording) {
      const nextCoordinates = tracking.coordinates || [];
      liveCoordsRef.current = nextCoordinates;
      startTimeRef.current = tracking.startTime || null;
      setLiveCoords(nextCoordinates);
    }
  }, [meeting?.id, tracking.coordinates, tracking.startTime, isRecording]);

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
  }, [externalObsMarkers, obsByCategory, liveCoords, tracking.coordinates]);

  // ── Wake Lock ──
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch { /* non supporté ou refusé */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  // ── Start/Stop recording ──
  const stopWatchAndTimer = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const persistTracking = useCallback((payload) => {
    managerRef.current?.updateMeetingField('gpsTracking', payload);
    try {
      const pending = onFlushTrackingRef.current?.(payload);
      if (pending?.catch) pending.catch((error) => console.warn('GPS flush error:', error));
    } catch (error) {
      console.warn('GPS flush error:', error);
    }
  }, []);

  const createTrackingPayload = useCallback((coordinates, { finalize = false } = {}) => ({
    ...trackingRef.current,
    startTime: startTimeRef.current || trackingRef.current.startTime || null,
    endTime: finalize ? new Date().toISOString() : null,
    coordinates,
    distance: Math.round(totalDistance(coordinates)),
    // De nouveaux points enregistrés → la trace redevient nettoyable (le
    // verrou cleanedAt ne vaut que pour la trace figée qu'il a nettoyée).
    cleanedAt: null,
  }), []);

  const flushCurrentTracking = useCallback(({ finalize = false } = {}) => {
    if (!isRecordingRef.current) return null;
    const payload = createTrackingPayload(liveCoordsRef.current, { finalize });
    persistTracking(payload);
    acceptedSinceFlushRef.current = 0;
    return payload;
  }, [createTrackingPayload, persistTracking]);

  const finishRecording = useCallback(({ errorMessage = null, notify = true } = {}) => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    setIsRecording(false);
    onRecordingChangeRef.current?.(false);
    stopWatchAndTimer();
    releaseWakeLock();

    const rawCoordinates = liveCoordsRef.current;
    const rawCount = rawCoordinates.length;
    const simplified = cleanGpsTrace(rawCoordinates);
    liveCoordsRef.current = simplified;
    setLiveCoords(simplified);
    persistTracking(createTrackingPayload(simplified, { finalize: true }));
    acceptedSinceFlushRef.current = 0;

    if (errorMessage) {
      setGpsError(errorMessage);
      onToastRef.current?.(errorMessage);
    } else if (notify) {
      onToastRef.current?.(`Tracé enregistré — ${simplified.length} pts (${rawCount - simplified.length} supprimés)`);
    }
  }, [createTrackingPayload, persistTracking, releaseWakeLock, stopWatchAndTimer]);

  const getGpsErrorMessage = useCallback((error) => {
    if (error?.code === 1) {
      return 'Localisation refusée. Autorisez la position précise dans les réglages du Pixel, puis réessayez.';
    }
    if (error?.code === 3) {
      return 'Le GPS ne répond pas. Placez-vous à découvert, vérifiez la localisation, puis réessayez.';
    }
    return 'Position GPS indisponible. Vérifiez la localisation et votre connexion, puis réessayez.';
  }, []);

  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    if (!navigator.geolocation) {
      const message = 'Géolocalisation non disponible sur cet appareil.';
      setGpsError(message);
      onToastRef.current?.(message);
      onRecordingChangeRef.current?.(false);
      return;
    }

    const currentCoordinates = liveCoordsRef.current;
    const hasExistingTrack = currentCoordinates.some(point =>
      Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
    );
    const startedAt = startTimeRef.current || trackingRef.current.startTime || new Date().toISOString();

    startTimeRef.current = startedAt;
    recordingStartedAtRef.current = Date.now();
    pendingBreakRef.current = hasExistingTrack;
    acceptedSinceFlushRef.current = 0;
    isRecordingRef.current = true;
    setGpsError(null);
    setLastAccuracy(null);
    setElapsed(0);
    setIsRecording(true);
    onRecordingChangeRef.current?.(true);
    requestWakeLock();

    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - recordingStartedAtRef.current);
    }, 1000);

    // Le même startTime est réutilisé pendant toute la trace, y compris à la reprise.
    persistTracking(createTrackingPayload(currentCoordinates));

    lastBearingPtRef.current = null;
    gpsProcessorRef.current = createGpsFixProcessor(hasExistingTrack ? [] : currentCoordinates);
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isRecordingRef.current) return;
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: Math.round(pos.coords.accuracy * 10) / 10,
        };
        setLastAccuracy(point.accuracy);
        const filteredPoint = gpsProcessorRef.current.push(point);
        if (!filteredPoint) return;

        // Cap de déplacement : heading GPS si dispo (en mouvement), sinon cap entre 2 fixes ≥5m.
        const heading = pos.coords.heading;
        const speed = pos.coords.speed;
        let candidate = (heading != null && !Number.isNaN(heading) && speed != null && speed > 0.5)
          ? heading
          : null;
        const lastPoint = lastBearingPtRef.current;
        if (lastPoint == null || haversine(lastPoint, filteredPoint) >= 5) {
          if (candidate == null && lastPoint) candidate = bearingBetween(lastPoint, filteredPoint);
          lastBearingPtRef.current = filteredPoint;
        }
        if (candidate != null) setLiveBearing(previous => smoothBearing(previous, candidate));

        const breakMarker = pendingBreakRef.current
          ? [{ break: true, timestamp: filteredPoint.timestamp }]
          : [];
        pendingBreakRef.current = false;
        const updated = [...liveCoordsRef.current, ...breakMarker, filteredPoint];
        liveCoordsRef.current = updated;
        setLiveCoords(updated);

        acceptedSinceFlushRef.current += 1;
        if (acceptedSinceFlushRef.current >= 5) {
          persistTracking(createTrackingPayload(updated));
          acceptedSinceFlushRef.current = 0;
        }
      },
      (error) => {
        if (!isRecordingRef.current) return;
        console.warn('GPS error:', error?.message);
        finishRecording({ errorMessage: getGpsErrorMessage(error), notify: false });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
      );
    } catch (error) {
      console.warn('GPS start error:', error);
      finishRecording({ errorMessage: getGpsErrorMessage(error), notify: false });
    }
  }, [
    createTrackingPayload,
    finishRecording,
    getGpsErrorMessage,
    persistTracking,
    requestWakeLock,
  ]);

  const stopRecording = useCallback(() => {
    finishRecording();
  }, [finishRecording]);

  const cleanExistingTrace = useCallback(() => {
    // Une seule fois par trace (marquée cleanedAt) : le filtre médian et le
    // lissage exponentiel de cleanGpsTrace ne sont pas idempotents —
    // réappliqués sur une trace déjà nettoyée, ils rabotaient le tracé à
    // chaque clic jusqu'à ne plus laisser grand-chose.
    if (tracking?.cleanedAt) { onToast?.('Trace déjà nettoyée'); return; }
    const cleaned = cleanGpsTrace(liveCoords);
    setTraceBeforeClean(liveCoords);
    liveCoordsRef.current = cleaned;
    setLiveCoords(cleaned);
    persistTracking({
      ...tracking,
      coordinates: cleaned,
      distance: Math.round(totalDistance(cleaned)),
      cleanedAt: new Date().toISOString(),
    });
    onToast?.(`Trace nettoyée — ${liveCoords.length} → ${cleaned.length} points`);
  }, [liveCoords, tracking, onToast, persistTracking]);

  const undoTraceCleaning = useCallback(() => {
    if (!traceBeforeClean) return;
    liveCoordsRef.current = traceBeforeClean;
    setLiveCoords(traceBeforeClean);
    // Retirer cleanedAt : la trace restaurée redevient nettoyable.
    const { cleanedAt: _cleanedAt, ...rest } = tracking || {};
    persistTracking({
      ...rest,
      coordinates: traceBeforeClean,
      distance: Math.round(totalDistance(traceBeforeClean)),
    });
    setTraceBeforeClean(null);
    onToast?.('Nettoyage annulé');
  }, [traceBeforeClean, tracking, onToast, persistTracking]);

  // Android peut figer/fermer l'onglet sans laisser le temps au bouton Arrêter.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushCurrentTracking();
    };
    const handlePageHide = () => {
      if (!isRecordingRef.current) return;
      flushCurrentTracking({ finalize: true });
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
      stopWatchAndTimer();
      releaseWakeLock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushCurrentTracking({ finalize: true });
      isRecordingRef.current = false;
      onRecordingChangeRef.current?.(false);
      stopWatchAndTimer();
      releaseWakeLock();
    };
  }, [flushCurrentTracking, releaseWakeLock, stopWatchAndTimer]);

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
              <button onClick={cleanExistingTrace} disabled={!!tracking?.cleanedAt}
                title={tracking?.cleanedAt ? 'Trace déjà nettoyée (une seule fois par trace)' : 'Nettoyer la trace GPS'}
                className={`p-2.5 rounded-xl transition ${tracking?.cleanedAt ? 'bg-gray-100 text-gray-300' : 'bg-blue-50 text-blue-600 active:bg-blue-100'}`}><Wand2 size={15} /></button>
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
        {gpsError && !isRecording && (
          <div
            role="alert"
            className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-snug text-red-700"
          >
            {gpsError}
          </div>
        )}
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
