// src/views/TeslaModeView.jsx
// Mode Tesla — carte plein ecran + mesure de segments OSRM + GPS optionnel.
// Optimise pour ecran tactile Tesla Model 3 (2023) en split conduite (~1200x1050).

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useMobileSiteVisits } from '../hooks/useMobileSiteVisits';
import { simplifyGpsTrace } from '../utils/gpsSimplify';
import {
  Navigation, Play, Square, Plus, X, LogOut, MapPin, Flag, MessageSquare, Trash2, Check, Route, LocateFixed, Pin, ChevronLeft, ChevronRight
} from 'lucide-react';

// ─── Tile Layers ──────────────────────────────────────────────────────────────

// IGN Géoplateforme (libre, officiel, France) — fair-use ~50 req/s soutenu
const IGN_BASE = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const TILE_LAYERS = {
  satellite: { url: `${IGN_BASE}&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&FORMAT=image/jpeg`, maxZoom: 19, label: 'Satellite' },
  plan: { url: `${IGN_BASE}&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png`, maxZoom: 19, label: 'Plan' },
  cadastre: { url: `${IGN_BASE}&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&FORMAT=image/png`, maxZoom: 20, label: 'Cadastre' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const haversine = (a, b) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const totalDistance = (coords) => {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    if (coords[i]._break) continue; // ne pas compter le saut entre segments
    d += haversine(coords[i - 1], coords[i]);
  }
  return d;
};

const fmtDist = (m) => m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
const fmtUncertainty = (u) => u == null ? '' : u < 1000 ? `±${Math.round(u)}m` : `±${(u / 1000).toFixed(1)}km`;
const fmtCoord = (lat, lng) => lat.toFixed(4) + ', ' + lng.toFixed(4);

const accuracyColor = (acc) => acc <= 5 ? '#22c55e' : acc <= 15 ? '#f59e0b' : '#ef4444';

const fmtDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

// ─── Leaflet icons ────────────────────────────────────────────────────────────

const createDot = (color, size = 14) => L.divIcon({
  className: '',
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

const createSegmentIcon = (number) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;font-family:system-ui">${number}</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

const createPointIcon = (number) => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:30px;height:36px;display:flex;align-items:flex-start;justify-content:center">
    <div style="position:absolute;top:0;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#8b5cf6;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>
    <div style="position:absolute;top:5px;color:white;font-size:11px;font-weight:800;font-family:system-ui;line-height:1">P${number}</div>
  </div>`,
  iconSize: [30, 36], iconAnchor: [15, 34],
});

const pendingIcon = createDot('#f97316', 18);
const startGpsIcon = createDot('#22c55e', 14);
const endGpsIcon = createDot('#ef4444', 14);

// ─── Map sub-components ───────────────────────────────────────────────────────

function DynamicTileLayer({ layerKey }) {
  const map = useMap();
  useEffect(() => {
    map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
    const cfg = TILE_LAYERS[layerKey];
    L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom }).addTo(map);
  }, [map, layerKey]);
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

function MapRefCapture({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
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

// FitBounds une seule fois (au premier rendu avec des données)
function FitBoundsOnce({ bounds }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!fittedRef.current && bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      fittedRef.current = true;
    }
  }, [map, bounds]);
  return null;
}

// ─── Geolocation helper ───────────────────────────────────────────────────────

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non disponible'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

// ─── Routing : IGN Itinéraires (libre, France) ────────────────────────────────

async function fetchIgnRoute(from, to) {
  try {
    const url = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}&profile=car&optimization=fastest&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const geom = data?.geometry;
    if (!geom?.coordinates?.length) return null;
    return {
      coordinates: geom.coordinates.map(c => [c[1], c[0]]), // lng,lat → lat,lng
      distance: Number(data.distance) || 0,
    };
  } catch { return null; }
}

// ─── Composant Principal ──────────────────────────────────────────────────────

export default function TeslaModeView({ user, companyId, onExit }) {
  const { visits, isLoading, refetch, loadVisit, saveVisit, createVisit } = useMobileSiteVisits(user, companyId);

  // ── State ──
  const [activeVisit, setActiveVisit] = useState(null);
  const [showPicker, setShowPicker] = useState(true);
  const [activeLayer, setActiveLayer] = useState('plan');

  // Segment measurement (GPS-based: Départ / Fin)
  const [pendingPoint, setPendingPoint] = useState(null); // point A en attente (geoloc)
  const [gettingPosition, setGettingPosition] = useState(false); // loading state

  // GPS tracking
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveCoords, setLiveCoords] = useState([]);
  const [gpsElapsed, setGpsElapsed] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const gpsBreakNextRef = useRef(false); // marquer une coupure au prochain point GPS

  // Toast feedback
  const [toast, setToast] = useState(null);
  const showToast = (msg, dur = 3000) => { setToast(msg); setTimeout(() => setToast(null), dur); };

  // Map ref (pour fallback position = centre de la carte)
  const mapRef = useRef(null);

  // Follow mode : la carte suit la position GPS (désactivé dès qu'on touche la carte)
  const [followMode, setFollowMode] = useState(true);

  // Drag/zoom = navigation libre, follow désactivé
  const handleUserInteraction = useCallback(() => setFollowMode(false), []);

  // Ref pour bounds (synchronisé via useEffect après bounds useMemo)
  const boundsRef = useRef(null);

  // Bouton recentrer : si suivi actif → stop ; si pas de suivi → zoom global sur toutes les obs + trace
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;
    if (followMode) {
      setFollowMode(false);
      return;
    }
    if (boundsRef.current && boundsRef.current.isValid()) {
      mapRef.current.fitBounds(boundsRef.current, { padding: [60, 60], maxZoom: 18, animate: true, duration: 0.5 });
    }
  }, [followMode]);

  // Re-engager suivi GPS (seulement visible quand enregistrement + pas en suivi)
  const handleFollowGps = useCallback(() => setFollowMode(true), []);

  // Segments (observations)
  const [segments, setSegments] = useState([]);
  const [editingSegIdx, setEditingSegIdx] = useState(null);
  const [editingNote, setEditingNote] = useState('');
  const [routeCache, setRouteCache] = useState({}); // segId -> { coordinates, distance }

  // Panel droit rétractable
  const [panelOpen, setPanelOpen] = useState(true);
  // Synchro obs sélectionnée (carte ↔ liste)
  const [selectedObsId, setSelectedObsId] = useState(null);
  const cardRefs = useRef({});
  // Scroll auto vers la carte sélectionnée dans le panel
  useEffect(() => {
    if (selectedObsId && cardRefs.current[selectedObsId]) {
      cardRefs.current[selectedObsId].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedObsId]);
  // Confirmation suppression (double-tap)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);

  // Sync segments depuis visite chargee
  useEffect(() => {
    if (activeVisit) {
      const obs = activeVisit.observations || [];
      setSegments(obs);
      setPanelOpen(obs.length > 0);
      // Pre-load route cache pour les segments existants
      obs.forEach(o => {
        if (routeCache[o.id]) return;
        // Priorité : route déjà stockée en Firestore (nouveau format)
        if (Array.isArray(o.segmentRoute) && o.segmentRoute.length >= 2) {
          setRouteCache(prev => ({ ...prev, [o.id]: {
            coordinates: o.segmentRoute.map(c => [c.lat, c.lng]),
            distance: o.segmentDistance || 0,
          } }));
          return;
        }
        // Legacy : re-fetch via IGN
        if (o.segmentFrom && o.segmentTo) {
          fetchIgnRoute(o.segmentFrom, o.segmentTo).then(route => {
            if (route) setRouteCache(prev => ({ ...prev, [o.id]: route }));
          });
        }
      });
    }
  }, [activeVisit?.id]);

  // Sync liveCoords
  useEffect(() => {
    if (!isRecording) setLiveCoords(activeVisit?.gpsTracking?.coordinates || []);
  }, [activeVisit?.id, activeVisit?.gpsTracking?.coordinates?.length, isRecording]);

  // ── Visit selection ──
  const handleSelectVisit = useCallback(async (visitId) => {
    const v = await loadVisit(visitId);
    setActiveVisit(v);
    setShowPicker(false);
  }, [loadVisit]);

  const handleCreateVisit = useCallback(async () => {
    const v = await createVisit();
    if (v) { setActiveVisit(v); setShowPicker(false); refetch(); }
  }, [createVisit, refetch]);

  // ── Obtenir position (GPS réel ou fallback centre carte) ──
  // Priorité : dernier fix du tracé actif (<10s) pour éviter timeout getCurrentPosition
  // qui peut échouer alors que watchPosition (tracé) fonctionne parfaitement.
  const getPosition = useCallback(async () => {
    if (isRecording && liveCoords.length > 0) {
      const last = liveCoords[liveCoords.length - 1];
      const ts = last.timestamp ? new Date(last.timestamp).getTime() : 0;
      const ageMs = Date.now() - ts;
      if (ageMs >= 0 && ageMs < 10000) {
        return { lat: last.lat, lng: last.lng, accuracy: last.accuracy || 999 };
      }
    }
    try {
      return await getCurrentPosition();
    } catch (e) {
      // Fallback 1 : dernier fix du tracé même si > 10s (mieux que rien)
      if (liveCoords.length > 0) {
        const last = liveCoords[liveCoords.length - 1];
        showToast('GPS lent — dernier fix du tracé utilisé');
        return { lat: last.lat, lng: last.lng, accuracy: last.accuracy || 999 };
      }
      // Fallback 2 : centre de la carte visible (test desktop)
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        showToast('GPS indisponible — position estimée au centre de la carte');
        return { lat: center.lat, lng: center.lng, accuracy: 999 };
      }
      throw e;
    }
  }, [isRecording, liveCoords]);

  // ── Segment measurement (GPS position) ──
  const handleDepart = useCallback(async () => {
    if (!activeVisit || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      setPendingPoint({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, timestamp: Date.now() });
      showToast(`Départ marqué (±${Math.round(pos.accuracy)}m)`);
    } catch (e) {
      showToast('Erreur GPS : ' + e.message);
    }
    setGettingPosition(false);
  }, [activeVisit, gettingPosition, getPosition]);

  const handleFin = useCallback(async () => {
    if (!activeVisit || !pendingPoint || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      const pointA = pendingPoint;
      const pointB = { lat: pos.lat, lng: pos.lng };
      const tsA = pointA.timestamp || 0;
      const tsB = Date.now();
      setPendingPoint(null);

      let routeCoords = null; // [{lat, lng}, ...]
      let distance = null;
      let source = null; // 'trace' | 'ign' | 'haversine'

      // Priorité 1 : tracé GPS actif pendant la mesure → distance réelle parcourue
      if (isRecording && tsA && liveCoords.length > 0) {
        const slice = liveCoords.filter(c => {
          const t = c.timestamp ? new Date(c.timestamp).getTime() : 0;
          return t >= tsA && t <= tsB;
        });
        if (slice.length >= 2) {
          routeCoords = slice.map(c => ({ lat: c.lat, lng: c.lng }));
          distance = totalDistance(slice);
          source = 'trace';
        }
      }

      // Priorité 2 : IGN Itinéraires (fallback réseau)
      if (!routeCoords) {
        showToast('Calcul itinéraire IGN...');
        const ign = await fetchIgnRoute(pointA, pointB);
        if (ign && ign.distance > 0) {
          routeCoords = ign.coordinates.map(c => ({ lat: c[0], lng: c[1] }));
          distance = ign.distance;
          source = 'ign';
        }
      }

      // Priorité 3 : haversine (vol d'oiseau) — dernier recours
      if (distance == null) {
        distance = haversine(pointA, pointB);
        source = 'haversine';
      }

      // Incertitude = précision GPS point A + point B + marge (~5m)
      const uncertainty = Math.round((pointA.accuracy || 0) + (pos.accuracy || 0) + 5);

      const segId = `seg_${Date.now()}`;
      const newSeg = {
        id: segId,
        text: '',
        images: [],
        date: new Date().toISOString().split('T')[0],
        segmentFrom: pointA,
        segmentTo: pointB,
        segmentDistance: distance,
        segmentDistanceStraight: haversine(pointA, pointB),
        segmentUncertainty: uncertainty,
        segmentSource: source,
        segmentRoute: routeCoords, // stocké pour rendu sans re-fetch
      };

      if (routeCoords) {
        setRouteCache(prev => ({ ...prev, [segId]: { coordinates: routeCoords.map(c => [c.lat, c.lng]), distance } }));
      }

      const updatedObs = [...segments, newSeg];
      setSegments(updatedObs);
      const updated = { ...activeVisit, observations: updatedObs };
      setActiveVisit(updated);
      await saveVisit(activeVisit.id, updated);

      const label = source === 'trace' ? 'tracé réel' : source === 'ign' ? 'IGN' : 'vol d\'oiseau';
      showToast(`Segment créé — ${fmtDist(distance)} (${label}) ${fmtUncertainty(uncertainty)}`);
    } catch (e) {
      showToast('Erreur GPS : ' + e.message);
    }
    setGettingPosition(false);
  }, [activeVisit, pendingPoint, gettingPosition, segments, saveVisit, getPosition, isRecording, liveCoords]);

  const cancelPending = useCallback(() => setPendingPoint(null), []);

  // ── Observation ponctuelle (1 point GPS) ──
  const handlePoint = useCallback(async () => {
    if (!activeVisit || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      const ptId = `pt_${Date.now()}`;
      const newPt = {
        id: ptId,
        text: '',
        images: [],
        date: new Date().toISOString().split('T')[0],
        pointLocation: { lat: pos.lat, lng: pos.lng },
        pointAccuracy: Math.round(pos.accuracy),
      };
      const updatedObs = [...segments, newPt];
      setSegments(updatedObs);
      const updated = { ...activeVisit, observations: updatedObs };
      setActiveVisit(updated);
      await saveVisit(activeVisit.id, updated);
      showToast(`Point créé (±${Math.round(pos.accuracy)}m)`);
    } catch (e) {
      showToast('Erreur GPS : ' + e.message);
    }
    setGettingPosition(false);
  }, [activeVisit, gettingPosition, getPosition, segments, saveVisit]);

  // ── Delete segment ──
  const deleteSegment = useCallback(async (segId) => {
    if (!activeVisit) return;
    const updatedObs = segments.filter(s => s.id !== segId);
    setSegments(updatedObs);
    const updated = { ...activeVisit, observations: updatedObs };
    setActiveVisit(updated);
    await saveVisit(activeVisit.id, updated);
  }, [activeVisit, segments, saveVisit]);

  // ── Delete avec confirmation double-tap ──
  const handleDeleteClick = useCallback((obsId) => {
    if (confirmDeleteId === obsId) {
      if (confirmTimerRef.current) { clearTimeout(confirmTimerRef.current); confirmTimerRef.current = null; }
      setConfirmDeleteId(null);
      deleteSegment(obsId);
    } else {
      setConfirmDeleteId(obsId);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  }, [confirmDeleteId, deleteSegment]);

  // ── Save note ──
  const saveSegmentNote = useCallback(async () => {
    if (!activeVisit || editingSegIdx == null) return;
    const seg = segments[editingSegIdx];
    if (!seg) return;
    const updatedObs = segments.map((s, i) => i === editingSegIdx ? { ...s, text: editingNote } : s);
    setSegments(updatedObs);
    const updated = { ...activeVisit, observations: updatedObs };
    setActiveVisit(updated);
    await saveVisit(activeVisit.id, updated);
    setEditingSegIdx(null);
    setEditingNote('');
  }, [activeVisit, editingSegIdx, editingNote, segments, saveVisit]);

  // ── GPS Recording ──
  const startGps = useCallback(() => {
    if (!navigator.geolocation || !activeVisit) return;
    setIsRecording(true);
    startTimeRef.current = Date.now();
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(wl => { wakeLockRef.current = wl; }).catch(() => {});
    timerRef.current = setInterval(() => setGpsElapsed(Date.now() - startTimeRef.current), 1000);

    // Si des coords existent déjà, le prochain point démarrera un nouveau segment
    if (liveCoords.length > 0) gpsBreakNextRef.current = true;

    const ref = doc(db, 'companies', companyId, 'site_visits', activeVisit.id);
    updateDoc(ref, { 'gpsTracking.startTime': new Date().toISOString() }).catch(() => {});

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString(), accuracy: Math.round(pos.coords.accuracy * 10) / 10 };
        if (gpsBreakNextRef.current) { point._break = true; gpsBreakNextRef.current = false; }
        setLastAccuracy(point.accuracy);
        setLiveCoords(prev => {
          // Filtre distance min 5m — ignorer si trop proche du dernier point (sauf break = nouveau segment)
          if (!point._break && prev.length > 0) {
            const last = prev[prev.length - 1];
            if (haversine(last, point) < 5) return prev;
          }
          const updated = [...prev, point];
          if (updated.length % 5 === 0) {
            const ref = doc(db, 'companies', companyId, 'site_visits', activeVisit.id);
            updateDoc(ref, { 'gpsTracking.coordinates': updated, 'gpsTracking.distance': Math.round(totalDistance(updated)) }).catch(() => {});
          }
          return updated;
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [companyId, activeVisit?.id, liveCoords.length]);

  const stopGps = useCallback(async () => {
    setIsRecording(false);
    wakeLockRef.current?.release(); wakeLockRef.current = null;
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // Simplification Douglas-Peucker (epsilon 5m)
    const simplified = simplifyGpsTrace(liveCoords, 5);
    setLiveCoords(simplified);

    if (activeVisit?.id) {
      const ref = doc(db, 'companies', companyId, 'site_visits', activeVisit.id);
      await updateDoc(ref, { 'gpsTracking.endTime': new Date().toISOString(), 'gpsTracking.coordinates': simplified, 'gpsTracking.distance': Math.round(totalDistance(simplified)) }).catch(() => {});
      const v = await loadVisit(activeVisit.id);
      setActiveVisit(v);
    }
  }, [companyId, activeVisit?.id, liveCoords, loadVisit]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockRef.current?.release();
    };
  }, []);

  // ── Tesla resilience : token keepalive + wake lock + GPS restart on resume ──
  useEffect(() => {
    // Refresh auth token toutes les 30 min (évite expiration pendant longues sessions)
    const tokenInterval = setInterval(() => {
      auth.currentUser?.getIdToken(true).catch(() => {});
    }, 30 * 60 * 1000);

    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;

      // 1. Force token refresh au retour d'écran
      try { await auth.currentUser?.getIdToken(true); } catch { /* géré par auth state listener */ }

      // 2. Re-acquérir Wake Lock si on enregistrait
      if (isRecording && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
      }

      // 3. Redémarrer GPS watch si le navigateur l'a tué pendant le sleep
      if (isRecording && navigator.geolocation) {
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
        gpsBreakNextRef.current = true; // ne pas relier ancien tracé et nouveau
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString(), accuracy: Math.round(pos.coords.accuracy * 10) / 10 };
            if (gpsBreakNextRef.current) { point._break = true; gpsBreakNextRef.current = false; }
            setLastAccuracy(point.accuracy);
            setLiveCoords(prev => {
              if (!point._break && prev.length > 0 && haversine(prev[prev.length - 1], point) < 5) return prev;
              const updated = [...prev, point];
              if (updated.length % 5 === 0 && activeVisit?.id) {
                updateDoc(doc(db, 'companies', companyId, 'site_visits', activeVisit.id), {
                  'gpsTracking.coordinates': updated, 'gpsTracking.distance': Math.round(totalDistance(updated)),
                }).catch(() => {});
              }
              return updated;
            });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      }

      // 4. Flush les coords GPS accumulées vers Firestore (rattrapage réseau)
      if (isRecording && activeVisit?.id && liveCoords.length > 0) {
        updateDoc(doc(db, 'companies', companyId, 'site_visits', activeVisit.id), {
          'gpsTracking.coordinates': liveCoords, 'gpsTracking.distance': Math.round(totalDistance(liveCoords)),
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(tokenInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isRecording, companyId, activeVisit?.id, liveCoords]);

  // ── Computed ──
  const gpsCoords = isRecording ? liveCoords : (activeVisit?.gpsTracking?.coordinates || []);
  const gpsPositions = gpsCoords.map(c => [c.lat, c.lng]);
  const currentGpsPosition = gpsPositions.length > 0 ? gpsPositions[gpsPositions.length - 1] : null;

  // Découper le tracé GPS en segments séparés aux points _break (pas de ligne entre arrêt/reprise)
  const gpsSegments = useMemo(() => {
    const segs = [];
    let current = [];
    for (const coord of gpsCoords) {
      if (coord._break && current.length > 0) {
        segs.push(current);
        current = [];
      }
      current.push([coord.lat, coord.lng]);
    }
    if (current.length > 0) segs.push(current);
    return segs;
  }, [gpsCoords]);

  // Sélection obs (carte ↔ liste)
  const selectObs = useCallback((id, opts = {}) => {
    const { flyToMap = false } = opts;
    setSelectedObsId(id);
    if (!panelOpen) setPanelOpen(true);
    if (flyToMap && mapRef.current) {
      const obs = segments.find(s => s.id === id);
      if (!obs) return;
      setFollowMode(false);
      if (obs.pointLocation) {
        mapRef.current.setView([obs.pointLocation.lat, obs.pointLocation.lng], 18, { animate: true, duration: 0.5 });
      } else if (obs.segmentFrom && obs.segmentTo) {
        const b = L.latLngBounds([[obs.segmentFrom.lat, obs.segmentFrom.lng], [obs.segmentTo.lat, obs.segmentTo.lng]]);
        mapRef.current.fitBounds(b, { padding: [80, 80], maxZoom: 18, animate: true, duration: 0.5 });
      }
    }
  }, [panelOpen, segments]);

  // Numerotation des observations : segments (1,2,3…) et points (P1,P2,P3…) en ordre chrono
  const indexedObs = useMemo(() => {
    let segN = 0, ptN = 0;
    return segments.map(s => {
      if (s.pointLocation) return { ...s, _num: ++ptN, _type: 'point' };
      return { ...s, _num: ++segN, _type: 'segment' };
    });
  }, [segments]);

  const bounds = useMemo(() => {
    const pts = [...gpsPositions];
    segments.forEach(s => {
      if (s.segmentFrom) pts.push([s.segmentFrom.lat, s.segmentFrom.lng]);
      if (s.segmentTo) pts.push([s.segmentTo.lat, s.segmentTo.lng]);
      if (s.pointLocation) pts.push([s.pointLocation.lat, s.pointLocation.lng]);
    });
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [gpsPositions, segments]);

  // Sync bounds vers ref (pour handleRecenter sans rebuilder le callback à chaque fix GPS)
  useEffect(() => { boundsRef.current = bounds; }, [bounds]);

  const defaultCenter = gpsPositions.length > 0 ? gpsPositions[0] : [43.6, 2.0];

  // ─── RENDER — Tesla Dashboard Style ──────────────────────────────────────────
  // Palette Tesla: bg #000/#171823, cards #1e2028/#2a2d35, accent #148ce8, text white/#a9c5cf

  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';
  const T = { bg: '#000', card: '#1e2028', cardHover: '#2a2d35', accent: '#148ce8', accentHover: '#1a9df7', text: '#fff', muted: '#a9c5cf', border: '#38434d', green: '#22c55e', red: '#ef4444' };

  // ── Visit Picker Overlay ──
  if (showPicker) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ fontFamily: FONT, background: T.bg }}>
        <div className="w-full max-w-lg px-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: T.accent }}>
              <Navigation size={22} color="#fff" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: T.text }}>ESTIMA</span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest" style={{ background: T.card, color: T.muted, border: `1px solid ${T.border}` }}>Tesla</span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: T.muted }}>Mesure de segments terrain</p>
            </div>
            <button onClick={onExit} className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition active:scale-[0.97]" style={{ background: T.card, color: T.red, border: `1px solid ${T.border}` }}>
              <LogOut size={14} /> Quitter
            </button>
          </div>

          <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <button onClick={handleCreateVisit}
              className="w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition" style={{ background: T.accent, color: '#fff' }}>
              <Plus size={18} /> Nouvelle visite
            </button>

            {isLoading && <p className="text-center py-4 text-sm" style={{ color: T.muted }}>Chargement...</p>}

            <div className="space-y-2 mt-4 max-h-[50vh] overflow-y-auto">
              {visits.map(v => (
                <button key={v.id} onClick={() => handleSelectVisit(v.id)}
                  className="w-full text-left px-4 py-3.5 rounded-xl transition active:scale-[0.98]"
                  style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text }}>
                  <div className="text-base font-semibold">{v.nom || '(Sans nom)'}</div>
                  <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: T.muted }}>
                    {v.lieu && <span>{v.lieu}</span>}
                    <span>{v.obsCount} obs.</span>
                    {v.hasGps && <span style={{ color: T.green }} className="font-medium">GPS</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Map View — Tesla dark chrome ──
  return (
    <div className="h-screen flex" style={{ fontFamily: FONT, background: T.bg }}>

      {/* ── Carte plein ecran ── */}
      <div className="flex-1 relative min-h-0">
        <MapContainer center={defaultCenter} zoom={17} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url={TILE_LAYERS[activeLayer].url} maxZoom={TILE_LAYERS[activeLayer].maxZoom} />
          <DynamicTileLayer layerKey={activeLayer} />
          <InvalidateSize />
          <MapRefCapture mapRef={mapRef} />
          <FollowPosition position={currentGpsPosition} follow={followMode} />
          <UserInteractionDetector onInteraction={handleUserInteraction} />
          {bounds && <FitBoundsOnce bounds={bounds} />}

          {/* Point A en attente (Départ marqué) */}
          {pendingPoint && (
            <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={pendingIcon}>
              <Popup><span style={{ fontSize: 12, fontWeight: 700 }}>Départ — appuyez « Fin » pour terminer</span></Popup>
            </Marker>
          )}

          {/* Observations : segments + points ponctuels */}
          {indexedObs.map((obs) => {
            if (obs._type === 'point' && obs.pointLocation) {
              return (
                <Marker key={obs.id} position={[obs.pointLocation.lat, obs.pointLocation.lng]} icon={createPointIcon(obs._num)}
                  eventHandlers={{ click: () => selectObs(obs.id) }}>
                  <Popup>
                    <div style={{ fontSize: 12, fontFamily: 'system-ui', maxWidth: 200 }}>
                      <div style={{ fontWeight: 800, color: '#8b5cf6', marginBottom: 2 }}>Point P{obs._num}</div>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>{fmtCoord(obs.pointLocation.lat, obs.pointLocation.lng)} ±{obs.pointAccuracy}m</div>
                      {obs.text && <div style={{ color: '#6b7280', marginTop: 2 }}>{obs.text}</div>}
                    </div>
                  </Popup>
                </Marker>
              );
            }
            const route = routeCache[obs.id];
            if (!obs.segmentFrom || !obs.segmentTo) return null;
            return (
              <React.Fragment key={obs.id}>
                {route && <Polyline positions={route.coordinates} pathOptions={{ color: '#f97316', weight: 6, opacity: 0.9 }} />}
                {!route && <Polyline positions={[[obs.segmentFrom.lat, obs.segmentFrom.lng], [obs.segmentTo.lat, obs.segmentTo.lng]]} pathOptions={{ color: '#f97316', weight: 6, dashArray: '8 6', opacity: 0.8 }} />}
                <Marker
                  position={route ? route.coordinates[Math.floor(route.coordinates.length / 2)] : [(obs.segmentFrom.lat + obs.segmentTo.lat) / 2, (obs.segmentFrom.lng + obs.segmentTo.lng) / 2]}
                  icon={createSegmentIcon(obs._num)}
                  eventHandlers={{ click: () => selectObs(obs.id) }}
                >
                  <Popup>
                    <div style={{ fontSize: 12, fontFamily: 'system-ui', maxWidth: 200 }}>
                      <div style={{ fontWeight: 800, color: T.accent, marginBottom: 2 }}>Segment {obs._num}</div>
                      <div style={{ fontWeight: 700 }}>{fmtDist(obs.segmentDistance)} <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 500 }}>{fmtUncertainty(obs.segmentUncertainty)}</span></div>
                      {obs.text && <div style={{ color: '#6b7280', marginTop: 2 }}>{obs.text}</div>}
                    </div>
                  </Popup>
                </Marker>
                <Marker position={[obs.segmentFrom.lat, obs.segmentFrom.lng]} icon={createDot(T.green, 10)} />
                <Marker position={[obs.segmentTo.lat, obs.segmentTo.lng]} icon={createDot(T.red, 10)} />
              </React.Fragment>
            );
          })}

          {/* Trace GPS — segments séparés (pas de ligne entre arrêt/reprise) */}
          {gpsSegments.map((seg, i) => seg.length > 1 && <Polyline key={`gps-seg-${i}`} positions={seg} pathOptions={{ color: '#80c4f2', weight: 3, opacity: 0.7 }} />)}
          {gpsPositions.length > 0 && <Marker position={gpsPositions[0]} icon={startGpsIcon} />}
          {gpsPositions.length > 1 && <Marker position={gpsPositions[gpsPositions.length - 1]} icon={endGpsIcon} />}
        </MapContainer>

        {/* ── Overlay controls — top (Tesla dark glass) ── */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
          {/* Left : Départ/Fin (gros boutons tactiles) */}
          <div className="flex items-center gap-3 pointer-events-auto">
            {!pendingPoint ? (
              <>
                <button onClick={handleDepart} disabled={gettingPosition}
                  className="flex items-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold transition active:scale-[0.97] shadow-lg"
                  style={{ background: gettingPosition ? T.border : T.green, color: '#fff' }}>
                  <MapPin size={24} />
                  {gettingPosition ? 'GPS...' : 'Départ'}
                </button>
                <button onClick={handlePoint} disabled={gettingPosition}
                  className="flex items-center gap-3 px-6 py-4 rounded-2xl text-lg font-bold transition active:scale-[0.97] shadow-lg"
                  style={{ background: gettingPosition ? T.border : '#8b5cf6', color: '#fff' }}>
                  <Pin size={22} />
                  {gettingPosition ? 'GPS...' : 'Point'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold backdrop-blur-md" style={{ background: 'rgba(34,197,94,0.25)', color: T.green, border: `1px solid ${T.green}` }}>
                  <MapPin size={16} /> Départ OK
                </div>
                <button onClick={handleFin} disabled={gettingPosition}
                  className="flex items-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold transition active:scale-[0.97] shadow-lg"
                  style={{ background: gettingPosition ? T.border : T.red, color: '#fff' }}>
                  <Flag size={24} />
                  {gettingPosition ? 'GPS...' : 'Fin'}
                </button>
                <button onClick={cancelPending} className="p-3 rounded-xl backdrop-blur-md transition" style={{ background: 'rgba(0,0,0,0.75)', color: T.muted, border: `1px solid ${T.border}` }}>
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Right : GPS tracé + Sortir (boutons gros format) */}
          <div className="flex items-center gap-3 pointer-events-auto">
            {!isRecording ? (
              <button onClick={() => { setGpsEnabled(true); startGps(); }}
                className="flex items-center gap-3 px-6 py-4 rounded-2xl text-lg font-bold transition active:scale-[0.97] shadow-lg"
                style={{ background: '#0ea5e9', color: '#fff' }}>
                <Play size={22} fill="currentColor" /> Tracé
              </button>
            ) : (
              <>
                {lastAccuracy != null && (
                  <div className="flex items-center gap-2 px-3 py-3 rounded-2xl backdrop-blur-md text-sm font-bold" style={{ background: 'rgba(0,0,0,0.75)', border: `1px solid ${T.border}` }}>
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: accuracyColor(lastAccuracy) }} />
                    <span style={{ color: accuracyColor(lastAccuracy) }}>±{lastAccuracy}m</span>
                  </div>
                )}
                <div className="px-3 py-3 rounded-2xl backdrop-blur-md text-sm font-mono font-bold tabular-nums" style={{ background: 'rgba(0,0,0,0.75)', color: T.text, border: `1px solid ${T.border}` }}>
                  {fmtDuration(gpsElapsed)}
                </div>
                <button onClick={stopGps}
                  className="flex items-center gap-3 px-6 py-4 rounded-2xl text-lg font-bold transition active:scale-[0.97] shadow-lg"
                  style={{ background: T.red, color: '#fff' }}>
                  <Square size={20} fill="white" /> Stop
                </button>
              </>
            )}
            <button onClick={onExit}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl text-lg font-bold transition active:scale-[0.97] shadow-lg"
              style={{ background: T.card, color: T.red, border: `1px solid ${T.border}` }}>
              <LogOut size={22} /> Sortir
            </button>
          </div>
        </div>

        {/* ── Contrôles bas gauche : recentrer + tile switcher (gros format tactile) ── */}
        <div className="absolute bottom-20 left-3 z-[1000] flex flex-col gap-3">
          {/* Bouton recentrer : vue globale quand pas de suivi */}
          <button onClick={handleRecenter}
            className="flex items-center gap-2.5 px-5 py-3.5 rounded-2xl backdrop-blur-md text-base font-bold transition active:scale-[0.97] shadow-lg"
            style={{
              background: followMode ? T.accent : 'rgba(0,0,0,0.75)',
              color: followMode ? '#fff' : T.muted,
              border: `1px solid ${followMode ? T.accent : T.border}`,
            }}>
            <LocateFixed size={22} />
            {followMode ? 'Suivi actif' : 'Vue globale'}
          </button>

          {/* Bouton re-engager suivi GPS : uniquement si traçé actif + pas de suivi */}
          {isRecording && !followMode && (
            <button onClick={handleFollowGps}
              className="flex items-center gap-2.5 px-5 py-3.5 rounded-2xl backdrop-blur-md text-base font-bold transition active:scale-[0.97] shadow-lg"
              style={{ background: 'rgba(0,0,0,0.75)', color: '#80c4f2', border: `1px solid #80c4f2` }}>
              <Navigation size={20} />
              Suivre GPS
            </button>
          )}

          {/* Tile layer switcher */}
          <div className="flex gap-1.5 backdrop-blur-md p-1.5 rounded-2xl" style={{ background: 'rgba(0,0,0,0.75)', border: `1px solid ${T.border}` }}>
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <button key={key} onClick={() => setActiveLayer(key)}
                className="px-5 py-3 rounded-xl text-base font-bold transition active:scale-[0.97]"
                style={{ background: activeLayer === key ? T.accent : 'transparent', color: activeLayer === key ? '#fff' : T.muted }}>
                {layer.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Toast feedback ── */}
        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 z-[2000] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-pulse" style={{ bottom: 40, background: 'rgba(0,0,0,0.85)', color: '#fff', border: `1px solid ${T.border}` }}>
            {toast}
          </div>
        )}
      </div>

      {/* ── Bandeau droit rétractable : Observations ── */}
      <div className="shrink-0 flex flex-col transition-all duration-300 overflow-hidden" style={{ width: panelOpen ? 360 : 48, background: T.card, borderLeft: `1px solid ${T.border}` }}>
        {panelOpen ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => setPanelOpen(false)}
                className="p-2 rounded-xl transition active:scale-[0.95]"
                style={{ background: T.bg, color: T.muted, border: `1px solid ${T.border}` }}>
                <ChevronRight size={18} />
              </button>
              <span className="text-sm font-bold" style={{ color: T.text }}>Observations</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: T.accent + '30', color: T.accent }}>{segments.length}</span>
              {isRecording && (
                <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: T.muted }}>
                  <div className="w-2 h-2 rounded-full bg-[#80c4f2] animate-pulse" />
                  {liveCoords.length}pts · {fmtDist(totalDistance(liveCoords))}
                </div>
              )}
            </div>

            {editingSegIdx == null ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {segments.length === 0 && (
                  <p className="text-sm py-6 px-2 text-center" style={{ color: T.muted }}>Aucune observation. Appuyez « Départ » pour un segment ou « Point » pour une observation ponctuelle.</p>
                )}
                {indexedObs.map((obs, idx) => {
                  const isPoint = obs._type === 'point';
                  const badgeColor = isPoint ? '#8b5cf6' : T.accent;
                  const badgeLabel = isPoint ? `P${obs._num}` : obs._num;
                  const isConfirming = confirmDeleteId === obs.id;
                  const isSelected = selectedObsId === obs.id;
                  return (
                    <div key={obs.id}
                      ref={(el) => { if (el) cardRefs.current[obs.id] = el; else delete cardRefs.current[obs.id]; }}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition hover:brightness-110"
                      onClick={() => selectObs(obs.id, { flyToMap: true })}
                      style={{
                        background: isSelected ? T.accent + '22' : T.bg,
                        border: `1px solid ${isSelected ? T.accent : T.border}`,
                        boxShadow: isSelected ? `0 0 0 2px ${T.accent}55` : 'none',
                      }}>
                      <div className="shrink-0 flex items-center justify-center text-sm font-bold rounded-full"
                        style={{ background: badgeColor, color: '#fff', width: isPoint ? 'auto' : 32, height: 32, minWidth: 32, padding: isPoint ? '0 8px' : 0 }}>
                        {badgeLabel}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isPoint && obs.pointLocation ? (
                          <>
                            <div className="text-sm font-bold" style={{ color: T.text }}>
                              Point <span className="text-[10px] font-normal" style={{ color: T.muted }}>±{obs.pointAccuracy}m</span>
                            </div>
                            <div className="text-[10px] font-mono truncate mt-0.5" style={{ color: '#c4b5fd' }}>
                              {fmtCoord(obs.pointLocation.lat, obs.pointLocation.lng)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-bold" style={{ color: T.text }}>{fmtDist(obs.segmentDistance)} <span className="text-[10px] font-normal" style={{ color: T.muted }}>{fmtUncertainty(obs.segmentUncertainty)}</span></div>
                            {obs.segmentFrom && obs.segmentTo && (
                              <div className="text-[10px] font-mono truncate mt-0.5" style={{ color: T.muted }}>
                                <span style={{ color: T.green }}>{fmtCoord(obs.segmentFrom.lat, obs.segmentFrom.lng)}</span>
                                <span> → </span>
                                <span style={{ color: T.red }}>{fmtCoord(obs.segmentTo.lat, obs.segmentTo.lng)}</span>
                              </div>
                            )}
                          </>
                        )}
                        {obs.text && <div className="text-[11px] mt-1.5 line-clamp-2" style={{ color: T.muted }}>{obs.text}</div>}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button onClick={(e) => { e.stopPropagation(); setEditingSegIdx(idx); setEditingNote(obs.text || ''); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition"
                            style={{ background: T.card, color: T.muted, border: `1px solid ${T.border}` }}>
                            <MessageSquare size={12} /> Note
                          </button>
                          {isConfirming ? (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(obs.id); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition animate-pulse"
                              style={{ background: T.red, color: '#fff' }}>
                              <Check size={12} /> Confirmer ?
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(obs.id); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition"
                              style={{ background: T.card, color: T.red, border: `1px solid ${T.border}` }}>
                              <Trash2 size={12} /> Suppr.
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                <div className="flex items-center gap-2">
                  {indexedObs[editingSegIdx]?._type === 'point' ? (
                    <>
                      <div className="rounded-full text-xs font-bold flex items-center justify-center px-2" style={{ background: '#8b5cf6', color: '#fff', height: 24 }}>P{indexedObs[editingSegIdx]._num}</div>
                      <span className="text-sm font-bold" style={{ color: T.text }}>Point P{indexedObs[editingSegIdx]._num} <span className="text-[10px] font-normal" style={{ color: T.muted }}>±{segments[editingSegIdx]?.pointAccuracy}m</span></span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.accent, color: '#fff' }}>{indexedObs[editingSegIdx]?._num}</div>
                      <span className="text-sm font-bold" style={{ color: T.text }}>Segment {indexedObs[editingSegIdx]?._num} <span className="text-[10px] font-normal" style={{ color: T.muted }}>({fmtDist(segments[editingSegIdx]?.segmentDistance)})</span></span>
                    </>
                  )}
                </div>
                <textarea value={editingNote} onChange={(e) => setEditingNote(e.target.value)}
                  className="w-full min-h-[160px] p-3 rounded-xl text-base resize-none outline-none"
                  style={{ background: T.bg, color: T.text, border: `1px solid ${T.border}` }}
                  placeholder="Note optionnelle..."
                  autoFocus />
                <div className="flex gap-2">
                  <button onClick={saveSegmentNote} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold transition active:scale-[0.97]" style={{ background: T.accent, color: '#fff' }}>
                    <Check size={14} /> Enregistrer
                  </button>
                  <button onClick={() => { setEditingSegIdx(null); setEditingNote(''); }} className="px-4 py-3 rounded-xl text-sm font-medium transition" style={{ background: T.bg, color: T.muted, border: `1px solid ${T.border}` }}>
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Panel replié : bande verticale cliquable */
          <button onClick={() => setPanelOpen(true)}
            className="h-full w-full flex flex-col items-center justify-start py-4 gap-3 transition active:scale-[0.98]"
            style={{ background: 'transparent' }}>
            <ChevronLeft size={22} color={T.muted} />
            <div className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: T.accent + '30', color: T.accent }}>{segments.length}</div>
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8 }}>
              Observations
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
