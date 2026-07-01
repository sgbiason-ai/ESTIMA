// src/components/mobile/SiteVisitDetailView.jsx
// Vue détail d'une visite de site — observations + terrain.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MapPin, Flag, LocateFixed, X, Ruler, Navigation } from 'lucide-react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { stripHtml } from '../../utils/formatObsText';
import ImageViewerModal from './ImageViewerModal';
import SiteVisitObsEditSheet from './SiteVisitObsEditSheet';
import GpsTrackingSection from './GpsTrackingSection';
import SaveStatusDot from './SaveStatusDot';
import {
  fmtCoord, fmtDist, fmtUncertainty, accuracyColor,
  haversine, computeUncertainty, getCurrentPosition, fetchIgnRoute,
} from '../../utils/geoHelpers';
import { deleteSiteVisitImage } from '../../utils/siteVisitImageStorage';

// ─── Sous-composants ───────────────────────────────────────────────────────

function SectionTab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-bold rounded-xl transition ${
        active ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
      }`}>
      {label}
    </button>
  );
}

// Barre de capture GPS d'un segment (Départ → Fin, distance routière) ou d'un point.
// Rendue dans les onglets Observations ET Terrain (état partagé via le parent).
function SegmentCaptureBar({ pendingPoint, gettingPosition, liveRouteDist, liveRouteStatus, liveStraight, liveAccuracy, onDepart, onFin, onPoint, onCancel }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Ruler size={14} className="text-blue-600" />
          <span className="text-[13px] font-bold text-gray-900">Mesurer un segment</span>
        </div>
        {pendingPoint && liveAccuracy != null && (
          <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: accuracyColor(liveAccuracy) }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accuracyColor(liveAccuracy) }} />
            ±{Math.round(liveAccuracy)}m
          </span>
        )}
      </div>

      {!pendingPoint ? (
        <div className="flex items-center gap-2">
          <button onClick={onDepart} disabled={gettingPosition}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold bg-emerald-500 text-white active:scale-[0.97] transition disabled:opacity-50 shadow-sm">
            <MapPin size={15} /> {gettingPosition ? 'GPS…' : 'Départ'}
          </button>
          <button onClick={onPoint} disabled={gettingPosition}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-violet-500 text-white active:scale-[0.97] transition disabled:opacity-50 shadow-sm">
            <LocateFixed size={15} /> Point
          </button>
        </div>
      ) : (
        <>
          {/* Distance PAR LA ROUTE en direct depuis le départ (IGN) */}
          <div className="flex items-center justify-center gap-2 mb-2 py-2.5 bg-blue-50 rounded-xl">
            <Navigation size={16} className="text-blue-600" />
            {liveRouteDist != null ? (
              <>
                <span className="text-[17px] font-bold text-blue-700 tabular-nums">{fmtDist(liveRouteDist)}</span>
                <span className="text-[10px] text-gray-400 font-medium">par la route</span>
              </>
            ) : liveAccuracy == null ? (
              <span className="text-[13px] font-semibold text-blue-600">Acquisition GPS…</span>
            ) : liveRouteStatus === 'error' && liveStraight != null ? (
              <span className="text-[13px] font-semibold text-gray-500 tabular-nums">
                ≈ {fmtDist(liveStraight)} <span className="text-[10px] font-normal">vol d'oiseau · route indispo.</span>
              </span>
            ) : (
              <span className="text-[13px] font-semibold text-blue-600 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Calcul de la route…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onFin} disabled={gettingPosition}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold bg-red-500 text-white active:scale-[0.97] transition disabled:opacity-50 shadow-sm">
              <Flag size={15} /> {gettingPosition ? 'GPS…' : 'Fin — distance routière'}
            </button>
            <button onClick={onCancel} disabled={gettingPosition}
              className="p-2.5 rounded-xl bg-gray-100 text-gray-500 active:bg-gray-200 transition disabled:opacity-50">
              <X size={16} />
            </button>
          </div>
        </>
      )}

      <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">
        {pendingPoint
          ? 'Distance par la route mise à jour au fil de votre déplacement. Valeur définitive à l\'appui sur « Fin ».'
          : 'Posez le départ, marchez jusqu\'à l\'arrivée, puis « Fin ». « Point » enregistre un seul repère GPS.'}
      </p>
    </div>
  );
}

function ObsCard({ obs, number, onTap, onDelete, onViewImage }) {
  const text = stripHtml(obs.text || '');
  const images = obs.images || [];
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef(null);
  const swipeRef = useRef(0);
  const wasTapRef = useRef(true);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Bouton supprimer (révélé par swipe gauche) */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-r-xl"
        onClick={() => onDelete?.(obs.id)}>
        <Icon name="trash" size={18} color="#fff" />
      </div>

      <div
        className="relative w-full bg-white border border-gray-200 p-3 active:bg-gray-50 cursor-pointer rounded-xl"
        style={{ transform: `translateX(${Math.min(0, Math.max(-80, swipeX))}px)`, transition: touchStartRef.current != null ? 'none' : 'transform 0.25s ease' }}
        onClick={() => { if (wasTapRef.current) onTap(obs); else { swipeRef.current = 0; setSwipeX(0); } wasTapRef.current = true; }}
        onTouchStart={e => { touchStartRef.current = e.touches[0].clientX; swipeRef.current = 0; wasTapRef.current = true; }}
        onTouchMove={e => { if (touchStartRef.current != null) { const dx = e.touches[0].clientX - touchStartRef.current; swipeRef.current = dx; setSwipeX(dx); } }}
        onTouchEnd={() => { wasTapRef.current = Math.abs(swipeRef.current) < 15; touchStartRef.current = null; if (swipeRef.current > -60) { swipeRef.current = 0; setSwipeX(0); } }}
      >
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{number}</span>
        <div className="flex-1 min-w-0">
      {obs.segmentFrom && obs.segmentTo && (
        <div className="text-[11px] font-mono mb-1.5 space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <a href={`https://www.google.com/maps?q=${obs.segmentFrom.lat},${obs.segmentFrom.lng}`} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()} className="text-blue-600 font-medium">{fmtCoord(obs.segmentFrom.lat, obs.segmentFrom.lng)}</a>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <a href={`https://www.google.com/maps?q=${obs.segmentTo.lat},${obs.segmentTo.lng}`} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()} className="text-blue-600 font-medium">{fmtCoord(obs.segmentTo.lat, obs.segmentTo.lng)}</a>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-blue-700 font-bold">{fmtDist(obs.segmentDistance)}</span>
            {obs.segmentUncertainty != null && <span className="text-gray-400 text-[9px]">±{Math.round(obs.segmentUncertainty)}m</span>}
          </div>
        </div>
      )}
      {text && (
        <p className="text-[13px] text-gray-700 leading-relaxed line-clamp-4 whitespace-pre-line">{text}</p>
      )}
      {!text && !obs.segmentFrom && images.length === 0 && (
        <p className="text-[13px] text-gray-500 italic">Observation vide — appuyez pour éditer</p>
      )}
      {!text && obs.segmentFrom && (
        <p className="text-[12px] text-blue-500 italic flex items-center gap-1">
          <Icon name="edit" size={11} color="#3b82f6" /> Appuyez pour ajouter un commentaire
        </p>
      )}
      {images.length > 0 && (
        <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
          {images.slice(0, 4).map((img, idx) => {
            const imgSrc = typeof img === 'string' ? img : img.src;
            const hasGps = typeof img === 'object' && img.lat != null;
            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0"
                  onClick={() => onViewImage?.(imgSrc)}>
                  <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                {hasGps && (
                  <a href={`https://www.google.com/maps?q=${img.lat},${img.lng}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[8px] italic text-blue-500 mt-0.5">
                    Loc.
                  </a>
                )}
              </div>
            );
          })}
          {images.length > 4 && (
            <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gray-600">+{images.length - 4}</span>
            </div>
          )}
        </div>
      )}
      {obs.date && <div className="text-[10px] text-gray-500 mt-2">{dateFr(obs.date)}</div>}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────

export default function SiteVisitDetailView({ visit, onSave, saveStatus, onToast, isLandscape, branding, companyId }) {
  const [activeSection, setActiveSection] = useState('observations');
  const [editingObs, setEditingObs] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [localVisit, setLocalVisit] = useState(visit);

  // ── Auto-save via useEffect (pas de side-effect dans les setState updaters) ──
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const isUserEdit = useRef(false);

  useEffect(() => {
    if (!isUserEdit.current) return;
    isUserEdit.current = false;
    onSaveRef.current(localVisit.id, localVisit);
  }, [localVisit]);

  // ── Manager simplifié (imite l'interface de useCrrManager pour GpsTrackingSection) ──
  const manager = useMemo(() => ({
    updateMeetingField: (field, value) => {
      isUserEdit.current = true;
      setLocalVisit(prev => ({ ...prev, [field]: value }));
    },
  }), []);

  // ── Observations CRUD ──
  const addObservation = useCallback(() => {
    const newObs = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      text: '',
      images: [],
      date: new Date().toISOString().split('T')[0],
    };
    isUserEdit.current = true;
    setLocalVisit(prev => ({ ...prev, observations: [...(prev.observations || []), newObs] }));
    setEditingObs(newObs);
  }, []);

  const updateObservation = useCallback((obsId, patch) => {
    isUserEdit.current = true;
    setLocalVisit(prev => ({
      ...prev,
      observations: (prev.observations || []).map(o => o.id === obsId ? { ...o, ...patch } : o),
    }));
  }, []);

  const deleteObservation = useCallback((obsId) => {
    isUserEdit.current = true;
    setLocalVisit(prev => {
      const removed = (prev.observations || []).find(o => o.id === obsId);
      for (const img of (removed?.images || [])) deleteSiteVisitImage(img);
      return { ...prev, observations: (prev.observations || []).filter(o => o.id !== obsId) };
    });
  }, []);

  const updateInfo = useCallback((patch) => {
    isUserEdit.current = true;
    setLocalVisit(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Segments GPS (Départ / Fin / Point) — parité desktop SiteVisitsView ──
  const [pendingPoint, setPendingPoint] = useState(null);
  const [gettingPosition, setGettingPosition] = useState(false);

  const getPosition = useCallback(async () => {
    try {
      return await getCurrentPosition();
    } catch (e) {
      onToast?.('GPS indisponible : ' + (e.message || 'position non obtenue'));
      throw e;
    }
  }, [onToast]);

  const handleDepart = useCallback(async () => {
    if (gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      setPendingPoint({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, timestamp: Date.now() });
      onToast?.(`Départ marqué (±${Math.round(pos.accuracy)}m)`);
    } catch { /* toast déjà émis */ }
    setGettingPosition(false);
  }, [gettingPosition, getPosition, onToast]);

  const handleFin = useCallback(async () => {
    if (!pendingPoint || gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      const pointA = pendingPoint;
      const pointB = { lat: pos.lat, lng: pos.lng };
      setPendingPoint(null);
      onToast?.('Calcul de l\'itinéraire IGN…');

      // Distance routière IGN (visu + distance), fallback vol d'oiseau (haversine).
      let routeCoords = null, distance = null, source = null;
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
      const newSeg = {
        id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        text: '', images: [], date: new Date().toISOString().split('T')[0],
        segmentFrom: pointA, segmentTo: pointB,
        segmentDistance: distance,
        segmentDistanceStraight: haversine(pointA, pointB),
        segmentUncertainty: uncertainty,
        segmentSource: source,
        segmentRoute: routeCoords,
      };
      isUserEdit.current = true;
      setLocalVisit(prev => ({ ...prev, observations: [...(prev.observations || []), newSeg] }));
      const label = source === 'ign' ? 'route IGN' : 'vol d\'oiseau';
      onToast?.(`Segment créé — ${fmtDist(distance)} (${label}) ${fmtUncertainty(uncertainty)}`);
    } catch { /* toast déjà émis */ }
    setGettingPosition(false);
  }, [pendingPoint, gettingPosition, getPosition, onToast]);

  const handlePoint = useCallback(async () => {
    if (gettingPosition) return;
    setGettingPosition(true);
    try {
      const pos = await getPosition();
      const newPt = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        text: `${fmtCoord(pos.lat, pos.lng)} (±${Math.round(pos.accuracy)}m)`,
        images: [], date: new Date().toISOString().split('T')[0],
        pointLocation: { lat: pos.lat, lng: pos.lng },
        pointAccuracy: Math.round(pos.accuracy),
      };
      isUserEdit.current = true;
      setLocalVisit(prev => ({ ...prev, observations: [...(prev.observations || []), newPt] }));
      onToast?.(`Point marqué — ${fmtCoord(pos.lat, pos.lng)} (±${Math.round(pos.accuracy)}m)`);
    } catch { /* toast déjà émis */ }
    setGettingPosition(false);
  }, [gettingPosition, getPosition, onToast]);

  const cancelPending = useCallback(() => setPendingPoint(null), []);

  // ── Suivi GPS en direct pendant la mesure (entre Départ et Fin) ──
  const [livePos, setLivePos] = useState(null);
  const livePosRef = useRef(null);
  livePosRef.current = livePos;
  useEffect(() => {
    if (!pendingPoint || !navigator.geolocation) { setLivePos(null); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => setLivePos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
    return () => { navigator.geolocation.clearWatch(id); setLivePos(null); };
  }, [pendingPoint]);

  // ── Distance PAR LA ROUTE en direct (IGN), throttlée (~3 s, ≥10 m, 1 requête à la fois) ──
  const [liveRoute, setLiveRoute] = useState({ dist: null, status: 'idle' }); // status: idle|loading|ok|error
  const routeCtlRef = useRef({ inFlight: false, lastPos: null });
  useEffect(() => {
    if (!pendingPoint) { setLiveRoute({ dist: null, status: 'idle' }); routeCtlRef.current = { inFlight: false, lastPos: null }; return; }
    let cancelled = false;
    const tick = async () => {
      const cur = livePosRef.current;
      const ctl = routeCtlRef.current;
      if (!cur || ctl.inFlight) return;
      if (ctl.lastPos && haversine(ctl.lastPos, cur) < 10) return; // pas assez bougé → on garde la dernière valeur
      ctl.inFlight = true;
      setLiveRoute(prev => (prev.dist == null ? { ...prev, status: 'loading' } : prev));
      try {
        const route = await fetchIgnRoute(pendingPoint, cur, 0);
        if (cancelled) return;
        if (route && route.distance > 0) {
          ctl.lastPos = cur;
          setLiveRoute({ dist: route.distance, status: 'ok' });
        } else {
          setLiveRoute(prev => (prev.dist == null ? { dist: null, status: 'error' } : prev));
        }
      } catch {
        if (!cancelled) setLiveRoute(prev => (prev.dist == null ? { dist: null, status: 'error' } : prev));
      } finally {
        ctl.inFlight = false;
      }
    };
    const iv = setInterval(tick, 3000);
    const t0 = setTimeout(tick, 500); // premier calcul dès que le GPS est acquis
    return () => { cancelled = true; clearInterval(iv); clearTimeout(t0); };
  }, [pendingPoint]);

  // Repli vol d'oiseau uniquement si la route est indisponible (hors réseau)
  const liveStraight = pendingPoint && livePos ? haversine(pendingPoint, livePos) : null;

  const observations = localVisit.observations || [];

  // ── Export PDF ──
  const handleExportPdf = useCallback(async () => {
    try {
      const { generateSiteVisitPdf } = await import('../../utils/pdfSiteVisitGenerator');
      await generateSiteVisitPdf(localVisit, { branding });
      onToast?.('PDF téléchargé');
    } catch (err) {
      console.error('Export PDF visite:', err);
      onToast?.('Erreur export PDF');
    }
  }, [localVisit, onToast, branding]);

  // Fake meeting object pour GpsTrackingSection
  const fakeMeeting = useMemo(() => ({
    ...localVisit,
    gpsTracking: localVisit.gpsTracking || { coordinates: [], startTime: null, endTime: null, distance: 0 },
  }), [localVisit]);

  // ObsMarkers numérotés pour la carte (les segments sont tracés à part → ignorés ici)
  const obsMarkersForMap = useMemo(() => {
    const coords = localVisit.gpsTracking?.coordinates || [];
    return observations.map((obs, idx) => {
      if (obs.segmentFrom && obs.segmentTo) return null; // segment = ligne + départ/arrivée dédiés
      let lat = null, lng = null;
      if (obs.pointLocation) { lat = obs.pointLocation.lat; lng = obs.pointLocation.lng; }
      if (lat == null) {
        for (const img of (obs.images || [])) {
          if (typeof img === 'object' && img.lat != null) { lat = img.lat; lng = img.lng; break; }
        }
      }
      if (lat == null && coords.length > 0) {
        const pos = Math.min(Math.floor((idx / Math.max(observations.length, 1)) * coords.length), coords.length - 1);
        lat = coords[pos]?.lat; lng = coords[pos]?.lng;
      }
      if (lat == null) return null;
      return { lat, lng, number: idx + 1, text: stripHtml(obs.text || '').slice(0, 80) };
    }).filter(Boolean);
  }, [observations, localVisit.gpsTracking]);

  return (
    <div className="flex flex-col h-full">

      {/* ── Header info visite ── */}
      <div className={`mx-4 bg-white rounded-xl border border-gray-200 ${isLandscape ? 'mt-1 mb-1 p-2' : 'mt-2 mb-2 p-3'}`}>
        {editingInfo ? (
          <div className="space-y-2">
            <input value={localVisit.nom || ''} onChange={e => updateInfo({ nom: e.target.value })}
              placeholder="Nom du site" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            <input value={localVisit.lieu || ''} onChange={e => updateInfo({ lieu: e.target.value })}
              placeholder="Lieu / adresse" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            <input value={localVisit.client || ''} onChange={e => updateInfo({ client: e.target.value })}
              placeholder="Client / contact" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            <input type="date" value={localVisit.date || ''} onChange={e => updateInfo({ date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:border-blue-400" />
            <button onClick={() => setEditingInfo(false)} className="w-full py-2 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition">
              Fermer
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between" onClick={() => setEditingInfo(true)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[15px] font-bold text-gray-900 truncate">{localVisit.nom || 'Visite sans nom'}</div>
                <SaveStatusDot status={saveStatus} />
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[12px] text-gray-500">
                {localVisit.lieu && <span>{localVisit.lieu}</span>}
                {localVisit.client && (<><span className="text-gray-300">·</span><span>{localVisit.client}</span></>)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
              <span className="text-[12px] text-gray-400">{dateFr(localVisit.date)}</span>
              {/* PDF — agrandi + libellé, séparé de l'édition */}
              <button onClick={handleExportPdf}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-[13px] font-bold active:bg-red-100 active:scale-[0.97] transition">
                <Icon name="download" size={16} color="#ef4444" />
                PDF
              </button>
              {/* Édition — bouton dédié */}
              <button onClick={() => setEditingInfo(true)}
                className="p-2 rounded-xl bg-gray-100 active:bg-gray-200 transition">
                <Icon name="edit" size={16} color="#6b7280" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section toggle ── */}
      <div className={`flex gap-1 mx-4 p-1 bg-gray-100 rounded-2xl ${isLandscape ? 'mb-1' : 'mb-2'}`}>
        <SectionTab label="Observations" active={activeSection === 'observations'} onClick={() => setActiveSection('observations')} />
        <SectionTab label="Terrain" active={activeSection === 'terrain'} onClick={() => setActiveSection('terrain')} />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {/* Éditeur plein zone si une obs est en édition */}
        {editingObs ? (
          <SiteVisitObsEditSheet
            obs={editingObs}
            onUpdate={updateObservation}
            onDelete={deleteObservation}
            onClose={() => setEditingObs(null)}
            onViewImage={setViewingImage}
            inline
            companyId={companyId}
            visitId={localVisit.id}
          />
        ) : activeSection === 'observations' && (
          <div className="space-y-2">
            <SegmentCaptureBar
              pendingPoint={pendingPoint} gettingPosition={gettingPosition}
              liveRouteDist={liveRoute.dist} liveRouteStatus={liveRoute.status} liveStraight={liveStraight} liveAccuracy={livePos?.accuracy}
              onDepart={handleDepart} onFin={handleFin} onPoint={handlePoint} onCancel={cancelPending}
            />

            {observations.map((obs, idx) => (
              <ObsCard key={obs.id} obs={obs} number={idx + 1} onTap={setEditingObs} onDelete={deleteObservation} onViewImage={setViewingImage} />
            ))}

            <button onClick={addObservation}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition mt-2">
              <Icon name="plus" size={14} color="#fff" />
              Ajouter une observation
            </button>

            {observations.length === 0 && (
              <div className="text-center py-6">
                <p className="text-[13px] text-gray-400">Aucune observation</p>
                <p className="text-[11px] text-gray-300 mt-1">« Départ / Fin » pour un segment, ou « Ajouter » pour une note</p>
              </div>
            )}
          </div>
        )}

        {/* Terrain toujours monté (GPS en arrière-plan), masqué si pas actif ou si éditeur ouvert */}
        <div style={{ display: activeSection === 'terrain' && !editingObs ? 'block' : 'none' }}>
          <div className="mb-3">
            <SegmentCaptureBar
              pendingPoint={pendingPoint} gettingPosition={gettingPosition}
              liveRouteDist={liveRoute.dist} liveRouteStatus={liveRoute.status} liveStraight={liveStraight} liveAccuracy={livePos?.accuracy}
              onDepart={handleDepart} onFin={handleFin} onPoint={handlePoint} onCancel={cancelPending}
            />
          </div>
          <GpsTrackingSection
            meeting={fakeMeeting}
            manager={manager}
            obsByCategory={{}}
            onToast={onToast}
            externalObsMarkers={obsMarkersForMap}
          />
        </div>
      </div>

      {/* ── Modals ── */}
      {viewingImage && <ImageViewerModal src={viewingImage} onClose={() => setViewingImage(null)} />}

      {/* Éditeur maintenant inline dans le content ci-dessus */}
    </div>
  );
}
