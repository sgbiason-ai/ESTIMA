// src/views/SiteVisitsView.jsx
// Vue desktop — sidebar liste | observations + segments gauche | carte Leaflet droite.
// Parité fonctionnelle avec TeslaModeView : segments GPS, OSRM, tracé continu, édition.

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import lazyWithReload from '../utils/lazyWithReload';
import { MapContainer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDoc, doc, deleteDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  MapPin, RefreshCw, Camera, MessageSquare, Ruler, Trash2, FileDown,
  Maximize2, X, Play, Square, Flag, LocateFixed, Pencil, Plus, Info,
  Layers, Navigation, Share2, LockKeyhole, Wand2, Undo2,
} from 'lucide-react';
import { stripHtml } from '../utils/formatObsText';
import { confirm } from '../utils/globalUI';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';
import { cleanGpsTrace, createGpsFixProcessor } from '../utils/gpsSimplify';
import { useMobileSiteVisits } from '../hooks/useMobileSiteVisits';
import { useRobustSave, loadDraft, clearDraft } from '../hooks/useRobustSave';
import { deleteSiteVisitImage } from '../utils/siteVisitImageStorage';
import SaveStatusDot from '../components/mobile/SaveStatusDot';
import {
  haversine, totalDistance, splitTraceSegments, accuracyColor,
  fmtDuration, fmtDate, fmtDist, fmtUncertainty, fmtCoord,
  computeUncertainty, getCurrentPosition, fetchIgnRoute,
} from '../utils/geoHelpers';
import {
  TILE_LAYERS, createDot, createSegmentIcon, createObsIcon,
  pendingIcon, startGpsIcon, endGpsIcon,
} from '../utils/leafletConfig';
import {
  DualTileLayer, WmsFeatureInfo, InvalidateSize, MapRefCapture,
  FollowPosition, UserInteractionDetector, FitBoundsOnce,
} from './siteVisits/MapSubComponents';
import { VisitInfoModal, ObsEditModal } from './siteVisits/SiteVisitModals';
import SiteVisitExportModal from './siteVisits/SiteVisitExportModal';
import ImageLightbox from './siteVisits/ImageLightbox';
import SiteVisitShareModal from './siteVisits/SiteVisitShareModal';
import { usePresence, useCoEditors } from '../hooks/usePresence';
import CoEditBanner from '../components/common/CoEditBanner';

// PROVISOIRE — Mode Tesla depuis le desktop
const TeslaModeView = lazyWithReload(() => import('./TeslaModeView'));

// Mode Annotation (plans épinglés) — lazy : chargé à l'ouverture de l'onglet « Plans »
const PlanAnnotationView = lazyWithReload(() => import('./siteVisits/PlanAnnotationView'));

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Composant Principal ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function SiteVisitsView({ companyId, masterBranding }) {
  const user = auth.currentUser;
  const { visits, isLoading: listLoading, refetch, loadVisit, saveVisit, createVisit, updateSharing } = useMobileSiteVisits(user, companyId);

  // ── Sauvegarde robuste (debounce, retry, brouillon localStorage, beforeunload) ──
  const visitSaveFn = useCallback(async (data) => {
    if (!data?.id) return;
    await saveVisit(data.id, data);
  }, [saveVisit]);
  const [selectedId, setSelectedId] = useState(null);
  const { saveStatus, triggerSave, forceSave } = useRobustSave({
    saveFn: visitSaveFn,
    draftKey: selectedId ? `draft_svd_${selectedId}` : null,
    debounceMs: 1500,
  });

  // PROVISOIRE — Mode Tesla
  const [teslaMode, setTeslaMode] = useState(false);

  const [fullVisit, setFullVisit] = useState(null);

  // ── Présence + co-édition (alerte d'écrasement) ───────────────────────────
  usePresence({
    user, companyId, activeTab: 'site_visits',
    entityType: selectedId ? 'site_visit' : null,
    entityId: selectedId || null,
    entityName: fullVisit?.nom || null,
  });
  const coEditors = useCoEditors({
    companyId, currentUserId: user?.uid,
    entityType: 'site_visit', entityId: selectedId || null,
  });
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [mapPanelTab, setMapPanelTab] = useState('map'); // volet droit : 'map' | 'plans'
  const [highlightedObs, setHighlightedObs] = useState(null);
  const [splitPct, setSplitPct] = useState(50);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingObs, setEditingObs] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images: [...], index: number }

  // ── Segments + OSRM ──
  const [routeCache, setRouteCache] = useState({});
  const [pendingPoint, setPendingPoint] = useState(null);
  const [gettingPosition, setGettingPosition] = useState(false);

  // ── GPS tracking ──
  const [isRecording, setIsRecording] = useState(false);
  const [liveCoords, setLiveCoords] = useState([]);
  const [gpsElapsed, setGpsElapsed] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const gpsProcessorRef = useRef(createGpsFixProcessor());
  const [traceBeforeClean, setTraceBeforeClean] = useState(null);

  // ── Map ──
  const [activeLayer, setActiveLayer] = useState('plan');
  const [overlayLayer, setOverlayLayer] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const mapRef = useRef(null);

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const showToast = (msg, dur = 3000) => { setToast(msg); setTimeout(() => setToast(null), dur); };

  // ── Load visit list + auto-select (dernière visite ouverte via Firestore prefs) ──
  const prefsLoadedRef = useRef(false);
  useEffect(() => {
    if (visits.length === 0 || selectedId || prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;
    (async () => {
      let target = visits[0].id;
      if (user?.uid) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'preferences', 'modules'));
          const lastId = snap.exists() ? snap.data().visites : null;
          if (lastId && visits.some((v) => v.id === lastId)) target = lastId;
        } catch { /* ignore */ }
      }
      handleLoadDetail(target);
    })();
  }, [visits]);

  const handleLoadDetail = useCallback(async (visitId) => {
    forceSave();
    setSelectedId(visitId);
    setDetailLoading(true);
    try {
      const v = await loadVisit(visitId);
      // Brouillon local plus récent (sauvegarde interrompue) → restaurer + re-pousser.
      const draft = loadDraft(`draft_svd_${visitId}`);
      const draftAt = draft?._draftAt || 0;
      const fsAt = v?.lastSaved ? new Date(v.lastSaved).getTime() : 0;
      if (draft && draftAt > fsAt) {
        const { _draftAt, ...cleanDraft } = draft;
        setFullVisit(cleanDraft);
        // Ne nettoyer le brouillon qu'après confirmation de la sauvegarde Firestore.
        try {
          await saveVisit(visitId, cleanDraft);
          clearDraft(`draft_svd_${visitId}`);
          showToast('Brouillon local synchronisé ✓');
        } catch {
          showToast('Brouillon restauré — sync en attente réseau');
        }
      } else {
        setFullVisit(v);
        if (draft) clearDraft(`draft_svd_${visitId}`);
      }
      if (user?.uid && visitId) {
        setDoc(
          doc(db, 'users', user.uid, 'preferences', 'modules'),
          { visites: visitId, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }
    } catch { setFullVisit(null); }
    finally { setDetailLoading(false); }
  }, [loadVisit, saveVisit, user, forceSave]);

  // ── Pre-load routes : stockée en Firestore si dispo, sinon IGN ──
  useEffect(() => {
    if (!fullVisit) return;
    (fullVisit.observations || []).forEach(obs => {
      if (routeCache[obs.id]) return;
      if (Array.isArray(obs.segmentRoute) && obs.segmentRoute.length >= 2) {
        setRouteCache(prev => ({ ...prev, [obs.id]: {
          coordinates: obs.segmentRoute.map(c => [c.lat, c.lng]),
          distance: obs.segmentDistance || 0,
        } }));
        return;
      }
      if (obs.segmentFrom && obs.segmentTo) {
        fetchIgnRoute(obs.segmentFrom, obs.segmentTo).then(route => {
          if (route) setRouteCache(prev => ({ ...prev, [obs.id]: route }));
        });
      }
    });
  }, [fullVisit?.id, fullVisit?.observations?.length]);

  // ── Sync liveCoords ──
  useEffect(() => {
    if (!isRecording) setLiveCoords(fullVisit?.gpsTracking?.coordinates || []);
  }, [fullVisit?.id, fullVisit?.gpsTracking?.coordinates?.length, isRecording]);

  useEffect(() => setTraceBeforeClean(null), [fullVisit?.id]);

  // ── Delete visit ──
  const handleDelete = useCallback(async (visitId, visitNom) => {
    const ok = await confirm(`Supprimer la visite "${visitNom}" et toutes ses données ?`, { danger: true });
    if (!ok) return;
    try {
      // Nettoyer les photos et plans Storage de la visite avant de supprimer le doc.
      const data = selectedId === visitId && fullVisit ? fullVisit : await loadVisit(visitId);
      for (const obs of (data?.observations || [])) {
        for (const img of (obs.images || [])) deleteSiteVisitImage(img);
      }
      if ((data?.plans || []).length > 0) {
        const { deletePlan } = await import('../utils/siteVisitPlanStorage');
        for (const plan of data.plans) deletePlan(plan);
      }
      await deleteDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
      refetch();
      if (selectedId === visitId) { setSelectedId(null); setFullVisit(null); }
    } catch (e) { console.error('Erreur suppression:', e); }
  }, [companyId, selectedId, fullVisit, loadVisit, refetch]);

  // ── Sauvegarde plein-document, protégée pendant un enregistrement GPS ──
  // Pendant un tracé, la trace fraîche vit dans liveCoords + Firestore (écrite
  // par updateDoc tous les 5 points et à l'arrêt) ; fullVisit.gpsTracking reste
  // volontairement périmé. Un save plein-document ne doit donc PAS réécrire
  // gpsTracking (setDoc merge l'écraserait, trace perdue) : on l'omet du payload,
  // merge laisse le champ serveur intact. Les actions de nettoyage de trace
  // écrivent gpsTracking volontairement et ne tournent qu'à l'arrêt (triggerSave direct).
  const isRecordingRef = useRef(false);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  const saveVisitData = useCallback((updated) => {
    if (isRecordingRef.current && updated && 'gpsTracking' in updated) {
      const { gpsTracking: _gps, ...rest } = updated;
      triggerSave(rest);
    } else {
      triggerSave(updated);
    }
  }, [triggerSave]);

  // ── Save visit info (modal) ──
  const handleSaveInfo = useCallback((info) => {
    if (!fullVisit?.isOwner) return;
    const updated = { ...fullVisit, ...info };
    setFullVisit(updated);
    saveVisitData(updated);
    refetch();
  }, [fullVisit, saveVisitData, refetch]);

  // ── Save observation (text + images) ──
  const handleSaveObsText = useCallback((newText, newImages) => {
    if (!fullVisit?.isOwner || !editingObs) return;
    const updatedObs = (fullVisit.observations || []).map(o =>
      o.id === editingObs.id
        ? { ...o, text: newText, ...(newImages !== undefined ? { images: newImages } : {}) }
        : o
    );
    const updated = { ...fullVisit, observations: updatedObs };
    setFullVisit(updated);
    saveVisitData(updated);
    setEditingObs(null);
  }, [fullVisit, editingObs, saveVisitData]);

  // ── Mode Annotation (plans + pins) — même chemin de sauvegarde que le reste
  //    (setFullVisit + triggerSave du useRobustSave, debounce 1,5 s) ──
  const handlePlanVisitChange = useCallback((partial) => {
    if (!fullVisit?.isOwner) return;
    const updated = { ...fullVisit, ...partial };
    setFullVisit(updated);
    saveVisitData(updated);
  }, [fullVisit, saveVisitData]);

  // Ouverture d'une obs depuis un pin : l'obs peut venir d'être créée dans le
  // même tick (onChangeVisit pas encore flushé) → on attend qu'elle existe
  // dans fullVisit avant d'ouvrir ObsEditModal.
  const [pendingEditObsId, setPendingEditObsId] = useState(null);
  useEffect(() => {
    if (!pendingEditObsId) return;
    const obs = (fullVisit?.observations || []).find(o => o.id === pendingEditObsId);
    if (obs) setEditingObs(obs);
    setPendingEditObsId(null);
  }, [pendingEditObsId, fullVisit]);
  const handleEditObsFromPlan = useCallback((obsId) => setPendingEditObsId(obsId), []);

  // ── Create visit ──
  const handleCreateVisit = useCallback(async () => {
    const v = await createVisit();
    if (v) {
      refetch();
      setSelectedId(v.id);
      setFullVisit(v);
      setShowInfoModal(true);
    }
  }, [createVisit, refetch]);

  // ── GPS position helper ──
  const getPosition = useCallback(async () => {
    try { return await getCurrentPosition(); }
    catch (e) {
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        showToast('GPS indisponible — position estimée au centre de la carte');
        return { lat: center.lat, lng: center.lng, accuracy: 999 };
      }
      throw e;
    }
  }, []);

  // ── Segment: Départ ──
  const handleDepart = useCallback(async () => {
    if (!fullVisit || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      setPendingPoint({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, timestamp: Date.now() });
      showToast(`Départ marqué (±${Math.round(pos.accuracy)}m)`);
    } catch (e) { showToast('Erreur GPS : ' + e.message); }
    setGettingPosition(false);
  }, [fullVisit, gettingPosition, getPosition]);

  // ── Segment: Fin — IGN route (distance + visu), fallback haversine ──
  const handleFin = useCallback(async () => {
    if (!fullVisit || !pendingPoint || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      const pointA = pendingPoint;
      const pointB = { lat: pos.lat, lng: pos.lng };
      setPendingPoint(null);

      showToast('Calcul itinéraire IGN...');
      let routeCoords = null;
      let distance = null;
      let source = null;

      const ign = await fetchIgnRoute(pointA, pointB);
      if (ign && ign.distance > 0 && ign.coordinates?.length >= 2) {
        routeCoords = ign.coordinates.map(c => ({ lat: c[0], lng: c[1] }));
        distance = ign.distance;
        source = 'ign';
      } else {
        distance = haversine(pointA, pointB);
        source = 'haversine';
      }

      const uncertainty = computeUncertainty(source, pointA.accuracy, pos.accuracy, distance);
      const segId = `seg_${Date.now()}`;
      const newSeg = {
        id: segId, text: '', images: [], date: new Date().toISOString().split('T')[0],
        segmentFrom: pointA, segmentTo: pointB,
        segmentDistance: distance,
        segmentDistanceStraight: haversine(pointA, pointB),
        segmentUncertainty: uncertainty,
        segmentSource: source,
        segmentRoute: routeCoords,
      };
      if (routeCoords) {
        setRouteCache(prev => ({ ...prev, [segId]: { coordinates: routeCoords.map(c => [c.lat, c.lng]), distance } }));
      }

      const updatedObs = [...(fullVisit.observations || []), newSeg];
      const updated = { ...fullVisit, observations: updatedObs };
      setFullVisit(updated);
      saveVisitData(updated);
      const label = source === 'ign' ? 'IGN' : 'vol d\'oiseau';
      showToast(`Segment créé — ${fmtDist(distance)} (${label}) ${fmtUncertainty(uncertainty)}`);
    } catch (e) { showToast('Erreur GPS : ' + e.message); }
    setGettingPosition(false);
  }, [fullVisit, pendingPoint, gettingPosition, getPosition, saveVisitData]);

  const cancelPending = useCallback(() => setPendingPoint(null), []);

  // ── Observation ponctuelle (1 point GPS) ──
  const handlePoint = useCallback(async () => {
    if (!fullVisit || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      const ptId = `pt_${Date.now()}`;
      const newPt = {
        id: ptId,
        text: `${fmtCoord(pos.lat, pos.lng)} (±${Math.round(pos.accuracy)}m)`,
        images: [],
        date: new Date().toISOString().split('T')[0],
        pointLocation: { lat: pos.lat, lng: pos.lng },
        pointAccuracy: Math.round(pos.accuracy),
      };
      const updatedObs = [...(fullVisit.observations || []), newPt];
      const updated = { ...fullVisit, observations: updatedObs };
      setFullVisit(updated);
      saveVisitData(updated);
      showToast(`Point marqué — ${fmtCoord(pos.lat, pos.lng)} (±${Math.round(pos.accuracy)}m)`);
    } catch (e) { showToast('Erreur GPS : ' + e.message); }
    setGettingPosition(false);
  }, [fullVisit, gettingPosition, getPosition, saveVisitData]);

  // ── Delete segment/obs ──
  const handleDeleteObs = useCallback((obsId) => {
    if (!fullVisit) return;
    const removed = (fullVisit.observations || []).find(o => o.id === obsId);
    for (const img of (removed?.images || [])) deleteSiteVisitImage(img);
    const updatedObs = (fullVisit.observations || []).filter(o => o.id !== obsId);
    const updated = { ...fullVisit, observations: updatedObs };
    setFullVisit(updated);
    saveVisitData(updated);
  }, [fullVisit, saveVisitData]);

  // ── Zoom to segment on map ──
  const zoomToSegment = useCallback((obs) => {
    if (!obs.segmentFrom || !obs.segmentTo || !mapRef.current) return;
    setFollowMode(false);
    const bounds = L.latLngBounds(
      [[obs.segmentFrom.lat, obs.segmentFrom.lng], [obs.segmentTo.lat, obs.segmentTo.lng]]
    );
    mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 18, animate: true, duration: 0.5 });
  }, []);

  // ── GPS Recording: Start ──
  const startGpsRecording = useCallback(() => {
    if (!navigator.geolocation || !fullVisit) { alert('Géolocalisation non disponible'); return; }
    setIsRecording(true);
    startTimeRef.current = Date.now();
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(wl => { wakeLockRef.current = wl; }).catch(() => {});
    timerRef.current = setInterval(() => setGpsElapsed(Date.now() - startTimeRef.current), 1000);

    const ref = doc(db, 'companies', companyId, 'site_visits', fullVisit.id);
    updateDoc(ref, { 'gpsTracking.startTime': new Date().toISOString() }).catch(() => {});

    // Marquer une coupure si on reprend le suivi après un arrêt
    const isResume = liveCoords.length > 0;
    if (isResume) setLiveCoords(prev => [...prev, { break: true }]);
    gpsProcessorRef.current = createGpsFixProcessor(isResume ? [] : liveCoords);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString(), accuracy: Math.round(pos.coords.accuracy * 10) / 10 };
        setLastAccuracy(point.accuracy);
        const filteredPoint = gpsProcessorRef.current.push(point);
        if (!filteredPoint) return;
        setLiveCoords(prev => {
          const updated = [...prev, filteredPoint];
          if (updated.length % 5 === 0) {
            const ref = doc(db, 'companies', companyId, 'site_visits', fullVisit.id);
            updateDoc(ref, { 'gpsTracking.coordinates': updated, 'gpsTracking.distance': Math.round(totalDistance(updated)) }).catch(() => {});
          }
          return updated;
        });
      },
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
  }, [companyId, fullVisit?.id]);

  // ── GPS Recording: Stop ──
  const stopGpsRecording = useCallback(async () => {
    setIsRecording(false);
    wakeLockRef.current?.release(); wakeLockRef.current = null;
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const simplified = cleanGpsTrace(liveCoords);
    setLiveCoords(simplified);
    if (fullVisit?.id) {
      const ref = doc(db, 'companies', companyId, 'site_visits', fullVisit.id);
      // Nouveaux points enregistrés → la trace redevient nettoyable.
      await updateDoc(ref, { 'gpsTracking.endTime': new Date().toISOString(), 'gpsTracking.coordinates': simplified, 'gpsTracking.distance': Math.round(totalDistance(simplified)), 'gpsTracking.cleanedAt': null }).catch(() => {});
      handleLoadDetail(fullVisit.id);
    }
  }, [companyId, fullVisit?.id, liveCoords, handleLoadDetail]);

  const handleCleanTrace = useCallback(() => {
    if (!fullVisit || liveCoords.length < 3) return;
    // Une seule fois par trace (marquée cleanedAt) : le filtre médian et le
    // lissage exponentiel de cleanGpsTrace ne sont pas idempotents —
    // réappliqués sur une trace déjà nettoyée, ils rabotaient le tracé à
    // chaque clic jusqu'à ne plus laisser grand-chose.
    if (fullVisit.gpsTracking?.cleanedAt) { showToast('Trace déjà nettoyée'); return; }
    const cleaned = cleanGpsTrace(liveCoords);
    const updated = {
      ...fullVisit,
      gpsTracking: { ...fullVisit.gpsTracking, coordinates: cleaned, distance: Math.round(totalDistance(cleaned)), cleanedAt: new Date().toISOString() },
    };
    setTraceBeforeClean(liveCoords);
    setLiveCoords(cleaned);
    setFullVisit(updated);
    triggerSave(updated);
    showToast(`Trace nettoyée — ${liveCoords.length} → ${cleaned.length} points`);
  }, [fullVisit, liveCoords, triggerSave]);

  const handleUndoTraceClean = useCallback(() => {
    if (!fullVisit || !traceBeforeClean) return;
    // Retirer cleanedAt : la trace restaurée redevient nettoyable.
    const { cleanedAt: _cleanedAt, ...tracking } = fullVisit.gpsTracking || {};
    const updated = {
      ...fullVisit,
      gpsTracking: { ...tracking, coordinates: traceBeforeClean, distance: Math.round(totalDistance(traceBeforeClean)) },
    };
    setLiveCoords(traceBeforeClean);
    setFullVisit(updated);
    setTraceBeforeClean(null);
    triggerSave(updated);
    showToast('Nettoyage annulé');
  }, [fullVisit, traceBeforeClean, triggerSave]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockRef.current?.release();
    };
  }, []);

  // ── Export PDF (vues cartographiques choisies dans la modale) ──
  const runExportPdf = useCallback(async (views) => {
    if (!fullVisit) return;
    setExporting(true);
    try {
      const { generateSiteVisitPdf } = await import('../utils/pdfSiteVisitGenerator');
      await generateSiteVisitPdf(fullVisit, { branding: masterBranding, ...views });
    } catch (e) { console.error('Erreur export PDF:', e); }
    setExporting(false);
  }, [fullVisit, masterBranding]);

  // ── Computed ──
  const tracking = fullVisit?.gpsTracking || {};
  const canEdit = fullVisit?.isOwner === true;
  const coordinates = isRecording ? liveCoords : (tracking.coordinates || []);
  const observations = fullVisit?.observations || [];
  const liveDistance = totalDistance(coordinates);
  const gpsSegments = splitTraceSegments(coordinates);
  const gpsPositions = coordinates.filter(c => !c.break).map(c => [c.lat, c.lng]);
  const currentGpsPosition = gpsPositions.length > 0 ? gpsPositions[gpsPositions.length - 1] : null;

  const photoMarkers = useMemo(() => {
    const markers = [];
    observations.forEach(obs => {
      (obs.images || []).forEach(img => {
        if (typeof img === 'object' && img.lat != null && img.lng != null) markers.push({ lat: img.lat, lng: img.lng, src: img.src });
      });
    });
    return markers;
  }, [observations]);

  const obsMarkers = useMemo(() => {
    return observations.map((obs, idx) => {
      let lat = null, lng = null;
      if (obs.pointLocation) { lat = obs.pointLocation.lat; lng = obs.pointLocation.lng; }
      if (lat == null && obs.segmentFrom && obs.segmentTo) { lat = (obs.segmentFrom.lat + obs.segmentTo.lat) / 2; lng = (obs.segmentFrom.lng + obs.segmentTo.lng) / 2; }
      if (lat == null) { for (const img of (obs.images || [])) { if (typeof img === 'object' && img.lat != null) { lat = img.lat; lng = img.lng; break; } } }
      if (lat == null && coordinates.length > 0) { const pos = Math.min(Math.floor((idx / Math.max(observations.length, 1)) * coordinates.length), coordinates.length - 1); lat = coordinates[pos].lat; lng = coordinates[pos].lng; }
      if (lat == null) return null;
      return { lat, lng, number: idx + 1, text: stripHtml(obs.text || '').slice(0, 100), isSegment: !!(obs.segmentFrom && obs.segmentTo) };
    }).filter(Boolean);
  }, [observations, coordinates]);

  const bounds = useMemo(() => {
    const pts = [...gpsPositions];
    observations.forEach(o => {
      if (o.segmentFrom) pts.push([o.segmentFrom.lat, o.segmentFrom.lng]);
      if (o.segmentTo) pts.push([o.segmentTo.lat, o.segmentTo.lng]);
      if (o.pointLocation) pts.push([o.pointLocation.lat, o.pointLocation.lng]);
    });
    photoMarkers.forEach(p => pts.push([p.lat, p.lng]));
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [gpsPositions, observations, photoMarkers]);

  const hasMap = coordinates.length > 0 || photoMarkers.length > 0 || obsMarkers.length > 0 || observations.some(o => o.segmentFrom);
  const defaultCenter = gpsPositions.length > 0 ? gpsPositions[0] : [43.6, 2.0];

  const handleUserInteraction = useCallback(() => setFollowMode(false), []);
  const handleRecenter = useCallback(() => setFollowMode(true), []);

  // Scroll vers observation surlignée
  useEffect(() => {
    if (highlightedObs) {
      const el = document.getElementById(`obs-${highlightedObs}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedObs]);

  // ── PROVISOIRE — Mode Tesla plein écran ──
  if (teslaMode) {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-400">Chargement Mode Tesla…</div>}>
        <TeslaModeView user={user} companyId={companyId} onExit={() => setTeslaMode(false)} />
      </Suspense>
    );
  }

  // ── Carte Leaflet (partagée entre inline et fullscreen) ──
  const renderMap = (height = '100%') => (
    <MapContainer center={defaultCenter} zoom={17} style={{ height, width: '100%' }} zoomControl={false} attributionControl={false}>
      <DualTileLayer baseKey={activeLayer} overlayKey={overlayLayer} overlayOpacity={overlayOpacity} />
      <WmsFeatureInfo overlayKey={overlayLayer} />
      <InvalidateSize />
      <MapRefCapture mapRef={mapRef} />
      <FollowPosition position={currentGpsPosition} follow={followMode} />
      <UserInteractionDetector onInteraction={handleUserInteraction} />
      {bounds && <FitBoundsOnce bounds={bounds} />}

      {/* Point A en attente */}
      {pendingPoint && (
        <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={pendingIcon}>
          <Popup><span className="text-xs font-bold">Départ — cliquez « Fin » pour terminer</span></Popup>
        </Marker>
      )}

      {/* Segments OSRM */}
      {observations.map((obs, idx) => {
        if (!obs.segmentFrom || !obs.segmentTo) return null;
        const route = routeCache[obs.id];
        return (
          <React.Fragment key={obs.id}>
            {route && <Polyline positions={route.coordinates} pathOptions={{ color: activeLayer === 'cadastre' ? '#22c55e' : '#f97316', weight: 5, opacity: 0.9 }} />}
            {!route && <Polyline positions={[[obs.segmentFrom.lat, obs.segmentFrom.lng], [obs.segmentTo.lat, obs.segmentTo.lng]]} pathOptions={{ color: activeLayer === 'cadastre' ? '#22c55e' : '#f97316', weight: 5, dashArray: '8 6', opacity: 0.8 }} />}
            <Marker
              position={route ? route.coordinates[Math.floor(route.coordinates.length / 2)] : [(obs.segmentFrom.lat + obs.segmentTo.lat) / 2, (obs.segmentFrom.lng + obs.segmentTo.lng) / 2]}
              icon={createSegmentIcon(idx + 1)}
              zIndexOffset={1000}
              eventHandlers={{ click: () => { setHighlightedObs(idx + 1); zoomToSegment(obs); } }}
            >
              <Popup>
                <div className="text-xs max-w-[200px]" style={{ fontFamily: 'system-ui' }}>
                  <div className="font-extrabold text-blue-500 mb-0.5">Segment {idx + 1}</div>
                  <div className="font-bold">{fmtDist(obs.segmentDistance)} <span className="text-[9px] opacity-60 font-normal">{fmtUncertainty(obs.segmentUncertainty)}</span></div>
                  {obs.text && <div className="text-gray-500 mt-0.5">{obs.text}</div>}
                </div>
              </Popup>
            </Marker>
            <Marker position={[obs.segmentFrom.lat, obs.segmentFrom.lng]} icon={createDot('#22c55e', 10)} />
            <Marker position={[obs.segmentTo.lat, obs.segmentTo.lng]} icon={createDot('#ef4444', 10)} />
          </React.Fragment>
        );
      })}

      {/* Obs markers (sans segment) */}
      {obsMarkers.filter((m) => !m.isSegment).map((m) => (
        <Marker key={`obs-${m.number}`} position={[m.lat, m.lng]} icon={createObsIcon(m.number, highlightedObs === m.number)}
          zIndexOffset={1000}
          eventHandlers={{ click: () => setHighlightedObs(m.number) }}>
          <Popup><div className="text-xs max-w-[180px]">{m.text || `Observation ${m.number}`}</div></Popup>
        </Marker>
      ))}

      {/* Tracé GPS — segments séparés (pas de ligne entre arrêt et reprise) */}
      {gpsSegments.map((seg, i) => <Polyline key={`gps-seg-${i}`} positions={seg} pathOptions={{ color: '#60a5fa', weight: 3, opacity: 0.7 }} />)}
      {gpsPositions.length > 0 && <Marker position={gpsPositions[0]} icon={startGpsIcon} />}
      {gpsPositions.length > 1 && <Marker position={gpsPositions[gpsPositions.length - 1]} icon={endGpsIcon} />}

      {/* Photos */}
      {photoMarkers.map((p, i) => (
        <Marker key={`photo-${i}`} position={[p.lat, p.lng]} icon={createDot('#3b82f6', 10)}>
          <Popup>
            <div className="text-xs max-w-[180px]">
              {p.src && <img src={p.src} alt="" className="w-full rounded mb-1 cursor-zoom-in hover:opacity-90 transition"
                onClick={() => setLightbox({ images: [p.src], index: 0 })} />}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="siteVisits" />
      <VisitInfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} visit={fullVisit} onSave={handleSaveInfo} />
      <ObsEditModal isOpen={!!editingObs} onClose={() => setEditingObs(null)} obs={editingObs} onSave={handleSaveObsText} companyId={companyId} visitId={fullVisit?.id} />
      <SiteVisitExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} visit={fullVisit} onExport={runExportPdf} />
      <SiteVisitShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        visit={fullVisit}
        companyId={companyId}
        currentUser={user}
        onSave={async members => {
          await updateSharing(fullVisit.id, members);
          await handleLoadDetail(fullVisit.id);
          await refetch();
          showToast('Partage mis à jour');
        }}
      />

      <CoEditBanner editors={coEditors} />

      <div className="flex flex-1 min-h-0">

      {/* ── Sidebar liste ── */}
      <div className="w-64 shrink-0 border-r border-gray-200/60 bg-white/80 backdrop-blur-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 shrink-0">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visites</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setTeslaMode(true)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-900 text-white hover:bg-gray-700 transition"
              title="Mode Tesla (carte plein écran + mesure segments)">
              🚗 Tesla
            </button>
            <HelpButton onClick={() => setShowHelp(true)} />
            <button onClick={refetch} className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
              <RefreshCw size={14} className={listLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Bouton + Nouvelle visite */}
        <div className="px-2 pt-2 shrink-0">
          <button onClick={handleCreateVisit}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition active:scale-[0.97]">
            <Plus size={13} /> Nouvelle visite
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {listLoading && <div className="text-center py-8 text-gray-400 text-xs">Chargement…</div>}
          {visits.map(v => (
            <div key={v.id} className={`group flex items-center rounded-xl mb-1 transition-all ${selectedId === v.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <button onClick={() => handleLoadDetail(v.id)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                <div className={`text-xs font-semibold truncate ${selectedId === v.id ? 'text-blue-700' : 'text-gray-600'}`}>{v.nom || '(Sans nom)'}</div>
                {v.lieu && <div className="text-[10px] text-gray-400 truncate mt-0.5">{v.lieu}</div>}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                  <span>{v.obsCount} obs.</span>
                  {v.hasGps && <span className="text-emerald-500 font-medium">GPS</span>}
                  {v.date && <span>{fmtDate(v.date)}</span>}
                </div>
              </button>
              {v.isOwner && <button onClick={() => handleDelete(v.id, v.nom)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all mr-1 shrink-0">
                <Trash2 size={13} />
              </button>}
            </div>
          ))}
          {!listLoading && visits.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs">Aucune visite.</div>
          )}
        </div>
      </div>

      {/* ── Contenu principal ── */}
      {detailLoading && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Chargement…
        </div>
      )}

      {!detailLoading && !fullVisit && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <MapPin size={48} className="mb-4 opacity-30" />
          <p className="text-sm">Sélectionnez une visite</p>
        </div>
      )}

      {!detailLoading && fullVisit && (
        <div className="flex-1 flex min-h-0 relative"
          onMouseMove={draggingSplit ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSplitPct(Math.max(25, Math.min(75, ((e.clientX - rect.left) / rect.width) * 100)));
          } : undefined}
          onMouseUp={() => setDraggingSplit(false)}
          onMouseLeave={() => setDraggingSplit(false)}>

          {/* ── Gauche : infos + observations ── */}
          <div className="flex flex-col border-r border-gray-200/60 overflow-hidden" style={{ width: `${splitPct}%` }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200/60 shrink-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 truncate">{fullVisit.nom || 'Visite sans nom'}</h2>
                    {canEdit ? <SaveStatusDot status={saveStatus} /> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-bold"><LockKeyhole size={10} /> Lecture seule</span>}
                    {canEdit && <button onClick={() => setShowInfoModal(true)} className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition shrink-0" title="Modifier les informations">
                      <Pencil size={14} />
                    </button>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {fullVisit.lieu && <span>📍 {fullVisit.lieu}</span>}
                    {fullVisit.client && <span>👤 {fullVisit.client}</span>}
                    {fullVisit.date && <span>📅 {fmtDate(fullVisit.date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && <button onClick={() => setShowInfoModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition active:scale-[0.97] border border-blue-200">
                    <Info size={13} /> Infos visite
                  </button>}
                  {canEdit && <button onClick={() => setShowShareModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition active:scale-[0.97] border border-indigo-200">
                    <Share2 size={13} /> Partager{fullVisit.sharedWith?.length ? ` (${fullVisit.sharedWith.length})` : ''}
                  </button>}
                  <button onClick={() => setShowExportModal(true)} disabled={exporting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition active:scale-[0.97] ${exporting ? 'bg-gray-400 text-gray-200 cursor-wait' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                    <FileDown size={13} className={exporting ? 'animate-pulse' : ''} /> {exporting ? 'Export...' : 'PDF'}
                  </button>
                  {canEdit && <button onClick={() => handleDelete(fullVisit.id, fullVisit.nom)}
                    className="p-1.5 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={15} />
                  </button>}
                </div>
              </div>

              {/* Stats + GPS + Segments controls */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {coordinates.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                    <Navigation size={10} className="text-blue-500" /> {coordinates.length} pts
                  </div>
                )}
                {(liveDistance > 0 || tracking.distance > 0) && (() => {
                  const d = isRecording ? liveDistance : tracking.distance;
                  // Tracé GPS : ±5% (jitter cumulé)
                  const u = Math.round(0.05 * d);
                  return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                      <Ruler size={10} className="text-emerald-500" /> {fmtDist(d)} <span className="text-gray-400 text-[9px]">{fmtUncertainty(u)}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                  <Camera size={10} className="text-blue-500" /> {photoMarkers.length} photo{photoMarkers.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                  <MessageSquare size={10} className="text-amber-500" /> {observations.length} obs.
                </div>

                {canEdit && !isRecording && coordinates.length >= 3 && (
                  <div className="flex items-center gap-1">
                    {traceBeforeClean && <button onClick={handleUndoTraceClean} title="Annuler le nettoyage"
                      className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"><Undo2 size={12} /></button>}
                    <button onClick={handleCleanTrace} disabled={!!tracking.cleanedAt}
                      title={tracking.cleanedAt ? 'Trace déjà nettoyée (une seule fois par trace)' : 'Supprimer les points GPS aberrants'}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${tracking.cleanedAt ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                      <Wand2 size={12} /> {tracking.cleanedAt ? 'Nettoyée' : 'Nettoyer'}
                    </button>
                  </div>
                )}

                {canEdit && <div className="ml-auto flex items-center gap-2">
                  {/* Segment buttons */}
                  {!pendingPoint ? (
                    <>
                      <button onClick={handleDepart} disabled={gettingPosition}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition active:scale-[0.97] shadow-sm disabled:opacity-50">
                        <MapPin size={13} /> {gettingPosition ? 'GPS...' : 'Départ'}
                      </button>
                      <button onClick={handlePoint} disabled={gettingPosition}
                        title="Observation ponctuelle : marque un seul point GPS"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-500 text-white hover:bg-violet-600 transition active:scale-[0.97] shadow-sm disabled:opacity-50">
                        <LocateFixed size={13} /> Point
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <MapPin size={10} /> OK
                      </div>
                      <button onClick={handleFin} disabled={gettingPosition}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition active:scale-[0.97] shadow-sm disabled:opacity-50">
                        <Flag size={13} /> {gettingPosition ? 'GPS...' : 'Fin'}
                      </button>
                      <button onClick={cancelPending} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                        <X size={13} />
                      </button>
                    </>
                  )}

                  <div className="w-px h-5 bg-gray-200" />

                  {/* GPS Recording */}
                  {isRecording && lastAccuracy != null && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accuracyColor(lastAccuracy) }} />
                      <span className="text-[10px] font-bold" style={{ color: accuracyColor(lastAccuracy) }}>±{lastAccuracy}m</span>
                    </div>
                  )}
                  {isRecording && <span className="text-[10px] font-mono font-bold text-gray-600 tabular-nums">{fmtDuration(gpsElapsed)}</span>}
                  {isRecording ? (
                    <button onClick={stopGpsRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition active:scale-[0.97] shadow-sm">
                      <Square size={11} fill="white" /> Arrêter
                    </button>
                  ) : (
                    <button onClick={startGpsRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition active:scale-[0.97] shadow-sm">
                      <Play size={11} fill="white" /> Tracé GPS
                    </button>
                  )}
                </div>}
              </div>
            </div>

            {/* Observations scrollables */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {observations.map((obs, idx) => {
                const images = obs.images || [];
                const obsNum = idx + 1;
                const isHighlighted = highlightedObs === obsNum;
                const isSegment = !!(obs.segmentFrom && obs.segmentTo);
                return (
                  <div key={obs.id} id={`obs-${obsNum}`}
                    className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${isHighlighted ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-200' : 'bg-white border-gray-200/60 hover:shadow-md hover:-translate-y-0.5'}`}
                    onClick={() => {
                      setHighlightedObs(isHighlighted ? null : obsNum);
                      if (isSegment) zoomToSegment(obs);
                    }}>
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center ${isHighlighted ? 'bg-orange-500' : isSegment ? 'bg-blue-600' : 'bg-gray-500'}`}>
                        {obsNum}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isSegment && (
                          <div className="text-xs font-mono mb-1.5 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="text-gray-500">Départ</span>
                              <a href={`https://www.google.com/maps?q=${obs.segmentFrom.lat},${obs.segmentFrom.lng}`} target="_blank" rel="noreferrer"
                                className="text-blue-600 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{fmtCoord(obs.segmentFrom.lat, obs.segmentFrom.lng)}</a>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
                              <span className="text-gray-500">Arrivée</span>
                              <a href={`https://www.google.com/maps?q=${obs.segmentTo.lat},${obs.segmentTo.lng}`} target="_blank" rel="noreferrer"
                                className="text-blue-600 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{fmtCoord(obs.segmentTo.lat, obs.segmentTo.lng)}</a>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Ruler size={12} className="text-blue-500 shrink-0" />
                              <span className="text-blue-700 font-bold">{fmtDist(obs.segmentDistance)}</span>
                              {obs.segmentUncertainty != null && <span className="text-gray-400 text-[10px]">{fmtUncertainty(obs.segmentUncertainty)}</span>}
                            </div>
                          </div>
                        )}
                        {obs.text && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{stripHtml(obs.text)}</p>}
                        {!obs.text && <p className="text-sm text-gray-300 italic">Pas de note</p>}
                        {images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {images.map((img, imgIdx) => {
                              const imgSrc = typeof img === 'string' ? img : img.src;
                              const hasGps = typeof img === 'object' && img.lat != null;
                              return (
                                <div key={imgIdx} className="flex flex-col items-center">
                                  <img src={imgSrc} alt="" loading="lazy"
                                    className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-zoom-in hover:ring-2 hover:ring-blue-300 hover:opacity-95 transition"
                                    onClick={(e) => { e.stopPropagation(); setLightbox({ images, index: imgIdx }); }} />
                                  {hasGps && (
                                    <a href={`https://www.google.com/maps?q=${img.lat},${img.lng}`} target="_blank" rel="noreferrer"
                                      className="text-[9px] italic text-blue-500 hover:underline mt-0.5" onClick={(e) => e.stopPropagation()}>Localisation</a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {obs.date && <div className="text-[10px] text-gray-400 mt-2">{fmtDate(obs.date)}</div>}
                      </div>

                      {/* Actions */}
                      {canEdit && <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setEditingObs(obs); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition" title="Modifier">
                          <Pencil size={13} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteObs(obs.id); }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition" title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      </div>}
                    </div>
                  </div>
                );
              })}
              {observations.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Aucune observation — utilisez « Départ / Fin » pour créer un segment</p>}
            </div>
          </div>

          {/* ── Divider draggable ── */}
          <div className={`w-1.5 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-blue-100 transition-colors ${draggingSplit ? 'bg-blue-200' : 'bg-gray-100'}`}
            onMouseDown={() => setDraggingSplit(true)}>
            <div className={`w-0.5 h-8 rounded-full transition-colors ${draggingSplit ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-400'}`} />
          </div>

          {/* ── Droite : carte Leaflet | plans annotés ── */}
          <div className="flex flex-col min-h-0 relative" style={{ width: `${100 - splitPct}%` }}>
            {!fullscreenMap ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                  {/* Segmented control Carte | Plans */}
                  <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
                    <button onClick={() => setMapPanelTab('map')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${mapPanelTab === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                      Carte
                    </button>
                    <button onClick={() => setMapPanelTab('plans')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${mapPanelTab === 'plans' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                      Plans{fullVisit.plans?.length ? ` (${fullVisit.plans.length})` : ''}
                    </button>
                  </div>
                  {mapPanelTab === 'map' && hasMap && <div className="flex items-center gap-2">
                    {/* Tile layer switcher */}
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
                        {Object.entries(TILE_LAYERS).filter(([, l]) => !l.overlayOnly).map(([key, layer]) => (
                          <button key={key} onClick={() => { setActiveLayer(key); if (overlayLayer === key) setOverlayLayer(null); }}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition ${activeLayer === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                            {layer.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowOverlayPanel(!showOverlayPanel)}
                        className={`p-1.5 rounded-lg transition active:scale-[0.95] ${overlayLayer ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                        title="Superposer une couche">
                        <Layers size={14} />
                      </button>
                    </div>
                    <button onClick={() => setFullscreenMap(true)}
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition active:scale-[0.95]" title="Plein écran">
                      <Maximize2 size={14} className="text-gray-600" />
                    </button>
                  </div>}
                </div>
                {mapPanelTab === 'plans' ? (
                <div className="flex-1 min-h-0 p-3">
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center">
                      <RefreshCw size={18} className="animate-spin text-gray-300" />
                    </div>
                  }>
                    <PlanAnnotationView
                      visit={fullVisit}
                      companyId={companyId}
                      onChangeVisit={handlePlanVisitChange}
                      onEditObs={handleEditObsFromPlan}
                      isMobile={false}
                      readOnly={!canEdit}
                    />
                  </Suspense>
                </div>
                ) : hasMap ? (
                <div className="flex-1 min-h-0 relative">
                  {renderMap('100%')}

                  {/* Panneau overlay — sur la carte */}
                  {showOverlayPanel && (
                    <div className="absolute top-3 right-3 z-[1100] bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 p-3 min-w-[220px]">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Superposer</div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(TILE_LAYERS).filter(([key]) => key !== activeLayer).map(([key, layer]) => (
                          <button key={key} onClick={() => setOverlayLayer(overlayLayer === key ? null : key)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${overlayLayer === key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
                            {layer.label}
                          </button>
                        ))}
                      </div>
                      {overlayLayer && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 font-semibold">Opacité</span>
                          <input type="range" min="0" max="100" value={Math.round(overlayOpacity * 100)}
                            onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                            className="flex-1 h-1 accent-blue-500" />
                          <span className="text-[10px] font-bold text-gray-700 min-w-[28px] text-right">{Math.round(overlayOpacity * 100)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recentrer */}
                  <div className="absolute bottom-3 left-3 z-[1000]">
                    <button onClick={handleRecenter}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                        followMode ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur-md text-gray-500 border border-gray-200/60 hover:text-gray-900'
                      }`}>
                      <LocateFixed size={14} />
                      {followMode ? 'Suivi actif' : 'Recentrer'}
                    </button>
                  </div>
                </div>
                ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <MapPin size={40} className="mb-3 opacity-30" />
                  <p className="text-xs">Aucune donnée terrain</p>
                  <p className="text-[10px] text-gray-300 mt-1">Cliquez « Départ » ou « Tracé GPS » pour commencer</p>
                </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                <Maximize2 size={32} className="mb-2 opacity-30" />
                <p className="text-xs">Carte en plein écran</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Carte plein écran ── */}
      {fullscreenMap && hasMap && (
        <div className="fixed inset-0 z-[5000] bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
            <span className="text-sm font-bold text-gray-900">{fullVisit?.nom || 'Carte terrain'}</span>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
                    {Object.entries(TILE_LAYERS).filter(([, l]) => !l.overlayOnly).map(([key, layer]) => (
                      <button key={key} onClick={() => { setActiveLayer(key); if (overlayLayer === key) setOverlayLayer(null); }}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold transition ${activeLayer === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                        {layer.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowOverlayPanel(!showOverlayPanel)}
                    className={`p-1.5 rounded-lg transition active:scale-[0.95] ${overlayLayer ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                    title="Superposer une couche">
                    <Layers size={14} />
                  </button>
                </div>
              </div>
              <span className="text-xs text-gray-400">{coordinates.length} pts · {photoMarkers.length} photos</span>
              <button onClick={() => setFullscreenMap(false)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition active:scale-[0.95]">
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            {renderMap('100%')}

            {/* Panneau overlay — sur la carte fullscreen */}
            {showOverlayPanel && (
              <div className="absolute top-3 right-3 z-[5100] bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 p-3 min-w-[220px]">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Superposer</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(TILE_LAYERS).filter(([key]) => key !== activeLayer).map(([key, layer]) => (
                    <button key={key} onClick={() => setOverlayLayer(overlayLayer === key ? null : key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${overlayLayer === key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
                      {layer.label}
                    </button>
                  ))}
                </div>
                {overlayLayer && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-semibold">Opacité</span>
                    <input type="range" min="0" max="100" value={Math.round(overlayOpacity * 100)}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                      className="flex-1 h-1 accent-blue-500" />
                    <span className="text-[10px] font-bold text-gray-700 min-w-[28px] text-right">{Math.round(overlayOpacity * 100)}%</span>
                  </div>
                )}
              </div>
            )}

            <div className="absolute bottom-3 left-3 z-[1000]">
              <button onClick={handleRecenter}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                  followMode ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur-md text-gray-500 border border-gray-200/60'
                }`}>
                <LocateFixed size={14} /> {followMode ? 'Suivi actif' : 'Recentrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox photo (fiches + popups carte) ── */}
      {lightbox && (
        <ImageLightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[2000] px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg bg-gray-900/90 text-white">
          {toast}
        </div>
      )}
      </div>
    </div>
  );
}
