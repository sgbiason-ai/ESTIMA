// src/views/siteVisits/PlanAnnotationView.jsx
// Mode Annotation des visites de site — plans (PDF/image) annotés de pins
// d'observations. Composant partagé desktop / mobile.
//
// Contrat de données (doc visite) :
//   visit.plans   = [{ id, name, src, path, width, height, page, createdAt }]
//   obs.planPin   = { planId, x, y }  (x, y normalisés 0-1, origine coin haut-gauche)
// Le numéro affiché d'un pin = index de l'observation dans visit.observations + 1
// (jamais persisté). Import/suppression via utils/siteVisitPlanStorage, chargé
// paresseusement (le module tire pdfjs).
// `readOnly` (visite partagée en lecture seule) : consultation uniquement —
// zoom/pan et « Ouvrir » depuis un pin ; import, ajout/déplacement/retrait de
// pin, renommage et suppression de plan masqués.
//
// Visionneuse : Pointer Events unifiés (souris + tactile), pan/pinch/molette,
// état transitoire de gestuelle en refs → AUCUN re-render pendant un pan/zoom
// (le DOM du "stage" est écrit directement ; les pins gardent une taille écran
// constante via la variable CSS --pin-scale = 1/z, contre-échelle).

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Map as MapIcon, Plus, Pencil, Trash2, X, Link2, Move, Upload } from 'lucide-react';
import { stripHtml } from '../../utils/formatObsText';
import PlanImportModal from './PlanImportModal';

const TAP_MAX_DIST = 8;      // px écran : au-delà, le geste est un drag
const TAP_MAX_MS = 400;      // durée max d'un tap
const DOUBLE_TAP_MS = 300;   // fenêtre du double-tap
const DOUBLE_TAP_DIST = 30;  // rayon de regroupement des deux taps
const MAX_ZOOM_FACTOR = 8;   // zoom max = 8 × le zoom "fit"
const DOUBLE_TAP_ZOOM = 2.5; // double-tap : fit ↔ 2,5 × fit
const PIN_CENTER_OFFSET = 18; // centre visuel de la pastille au-dessus de la pointe (px écran)

// ─── Pin numéroté (goutte) ──────────────────────────────────────────────────
// Wrapper de taille nulle ancré au point exact → scale(--pin-scale) autour du
// point, puis translate(-50%,-100%) pour poser la pointe dessus.
function PlanPin({ number, x, y, variant }) {
  const tipColor = variant === 'active' ? '#4f46e5' : variant === 'moving' ? '#f59e0b' : '#2563eb';
  const circleBg = variant === 'active' ? 'bg-indigo-600' : variant === 'moving' ? 'bg-amber-500' : 'bg-blue-600';
  return (
    <div className="absolute pointer-events-none"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'scale(var(--pin-scale, 1))', transformOrigin: '0 0' }}>
      <div className={`flex flex-col items-center ${variant === 'moving' ? 'animate-pulse' : ''}`}
        style={{ transform: 'translate(-50%, -100%)' }}>
        <div className={`w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center ${circleBg}`}>
          <span className="text-white text-[11px] font-bold leading-none">{number}</span>
        </div>
        <div style={{
          width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
          borderTop: `8px solid ${tipColor}`, marginTop: -2,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
        }} />
      </div>
    </div>
  );
}

// ─── Sheet/modale de choix après placement d'un pin ─────────────────────────
function PinChoiceSheet({ isMobile, linkables, onNew, onLink, onCancel }) {
  const [step, setStep] = useState('choice'); // choice | link
  const btnH = isMobile ? 'min-h-[48px]' : 'min-h-[42px]';
  return (
    <div className={`fixed inset-0 bg-black/40 z-modal flex ${isMobile ? 'items-end' : 'items-center justify-center p-3'}`}
      onMouseDown={onCancel}>
      <div
        className={isMobile
          ? 'bg-white rounded-t-3xl w-full max-h-[70vh] flex flex-col p-4 pb-6'
          : 'bg-white rounded-2xl shadow-2xl w-[400px] max-w-full max-h-[80vh] flex flex-col p-5'}
        onMouseDown={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm font-bold text-gray-900">
            {step === 'choice' ? 'Nouveau pin' : 'Lier à une observation'}
          </h3>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-xl transition">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {step === 'choice' ? (
          <div className="space-y-2">
            <button onClick={onNew}
              className={`w-full ${btnH} flex items-center gap-3 px-3.5 rounded-2xl bg-gray-900 text-white active:scale-[0.98] transition`}>
              <Plus size={18} className="shrink-0" />
              <span className="text-[13px] font-bold">Nouvelle observation</span>
            </button>
            <button onClick={() => setStep('link')}
              className={`w-full ${btnH} flex items-center gap-3 px-3.5 rounded-2xl bg-gray-100 text-gray-800 active:scale-[0.98] transition`}>
              <Link2 size={18} className="shrink-0 text-blue-600" />
              <span className="text-[13px] font-bold">Lier à une observation existante</span>
            </button>
            <button onClick={onCancel}
              className="w-full py-3 text-[13px] font-medium text-gray-500 rounded-xl hover:bg-gray-100 transition">
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
            {linkables.length === 0 && (
              <p className="text-[12px] text-gray-400 text-center py-6">
                Toutes les observations ont déjà un pin sur ce plan.
              </p>
            )}
            {linkables.map(o => (
              <button key={o.id} onClick={() => onLink(o.id)}
                className="w-full flex items-start gap-2.5 p-3 rounded-xl border border-gray-200/60 hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.99] transition text-left">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {o.number}
                </span>
                <span className="flex-1 min-w-0">
                  {o.text
                    ? <span className="block text-[12px] text-gray-700 leading-snug line-clamp-2">{o.text}</span>
                    : <span className="block text-[12px] text-gray-400 italic">Observation vide</span>}
                  <span className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                    {o.imgCount > 0 && <span>{o.imgCount} photo{o.imgCount > 1 ? 's' : ''}</span>}
                    {o.pinnedElsewhere && <span className="text-amber-600 font-semibold">Pin sur un autre plan — il sera déplacé</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function PlanAnnotationView({ visit, companyId, onChangeVisit, onEditObs, isMobile, readOnly = false }) {
  const plans = useMemo(() => visit?.plans || [], [visit?.plans]);
  const observations = useMemo(() => visit?.observations || [], [visit?.observations]);

  const [activePlanId, setActivePlanId] = useState(null);
  const [placing, setPlacing] = useState(false);        // mode placement d'un nouveau pin
  const [movingObsId, setMovingObsId] = useState(null); // mode déplacement d'un pin existant
  const [pinDraft, setPinDraft] = useState(null);       // { x, y } en attente de choix (sheet)
  const [popover, setPopover] = useState(null);         // { obsId, left?, top? }
  const [pdfFile, setPdfFile] = useState(null);         // PDF en attente de choix de pages
  const [importBusy, setImportBusy] = useState(false);  // import image en cours
  const [importError, setImportError] = useState(null);
  const fileRef = useRef(null);

  // ── Dérivés ──
  const activePlan = useMemo(() => plans.find(p => p.id === activePlanId) || null, [plans, activePlanId]);
  const hasViewer = !!activePlan;

  const obsNumberById = useMemo(() => {
    const m = new Map();
    observations.forEach((o, i) => m.set(o.id, i + 1));
    return m;
  }, [observations]);

  const activePins = useMemo(
    () => observations.filter(o => o.planPin && o.planPin.planId === activePlanId),
    [observations, activePlanId]
  );

  const pinCountByPlan = useMemo(() => {
    const m = new Map();
    observations.forEach(o => {
      if (o.planPin) m.set(o.planPin.planId, (m.get(o.planPin.planId) || 0) + 1);
    });
    return m;
  }, [observations]);

  // Obs proposables au lien : sans pin sur CE plan (un pin posé ailleurs sera déplacé)
  const linkables = useMemo(() => {
    if (!pinDraft) return [];
    return observations
      .map((o, i) => ({ o, number: i + 1 }))
      .filter(({ o }) => !(o.planPin && o.planPin.planId === activePlanId))
      .map(({ o, number }) => ({
        id: o.id,
        number,
        text: stripHtml(o.text || ''),
        imgCount: (o.images || []).length,
        pinnedElsewhere: !!o.planPin,
      }));
  }, [pinDraft, observations, activePlanId]);

  // ── Miroirs en refs (les handlers de gestuelle ne doivent jamais être périmés) ──
  const visitRef = useRef(visit); visitRef.current = visit;
  const activePlanRef = useRef(null); activePlanRef.current = activePlan;
  const pinsRef = useRef([]); pinsRef.current = activePins;
  const placingRef = useRef(false); placingRef.current = placing;
  const movingRef = useRef(null); movingRef.current = movingObsId;
  const popoverOpenRef = useRef(false); popoverOpenRef.current = popover != null;

  // ── Plan actif : suivre le tableau (suppression, premier import) ──
  useEffect(() => {
    if (plans.length === 0) {
      if (activePlanId) setActivePlanId(null);
      return;
    }
    if (!activePlanId || !plans.some(p => p.id === activePlanId)) setActivePlanId(plans[0].id);
  }, [plans, activePlanId]);

  // Changement de plan → sortir des modes transitoires
  useEffect(() => {
    setPopover(null);
    setPlacing(false);
    setMovingObsId(null);
  }, [activePlanId]);

  useEffect(() => {
    if (!importError) return;
    const t = setTimeout(() => setImportError(null), 6000);
    return () => clearTimeout(t);
  }, [importError]);

  // ── Visionneuse : état transform en refs, DOM écrit directement ──
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const viewRef = useRef({ tx: 0, ty: 0, z: 1 });
  const fitScaleRef = useRef(1);
  const maxZoomRef = useRef(MAX_ZOOM_FACTOR);
  const pointersRef = useRef(new Map()); // pointerId → { x, y } (coords conteneur)
  const gestureRef = useRef(null);       // { type:'pan'|... } geste en cours
  const lastTapRef = useRef(null);       // { t, x, y } pour le double-tap

  const applyTransform = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const { tx, ty, z } = viewRef.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    el.style.setProperty('--pin-scale', String(1 / z));
  }, []);

  // Bornes de pan : axe plus petit que le conteneur → centré ; sinon jamais de vide
  const clampView = useCallback((v) => {
    const c = containerRef.current;
    const plan = activePlanRef.current;
    if (!c || !plan?.width || !plan?.height) return v;
    const cw = c.clientWidth, ch = c.clientHeight;
    const sw = plan.width * v.z, sh = plan.height * v.z;
    return {
      z: v.z,
      tx: sw <= cw ? (cw - sw) / 2 : Math.min(0, Math.max(cw - sw, v.tx)),
      ty: sh <= ch ? (ch - sh) / 2 : Math.min(0, Math.max(ch - sh, v.ty)),
    };
  }, []);

  const fitView = useCallback(() => {
    const c = containerRef.current;
    const plan = activePlanRef.current;
    if (!c || !plan?.width || !plan?.height) return;
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!cw || !ch) return;
    const z = Math.min(cw / plan.width, ch / plan.height);
    fitScaleRef.current = z;
    maxZoomRef.current = z * MAX_ZOOM_FACTOR;
    viewRef.current = { z, tx: (cw - plan.width * z) / 2, ty: (ch - plan.height * z) / 2 };
    applyTransform();
  }, [applyTransform]);

  // Zoom vers un point fixe du conteneur (curseur molette, milieu du pinch, double-tap)
  const zoomTo = useCallback((zTarget, cx, cy) => {
    const v = viewRef.current;
    const z = Math.min(maxZoomRef.current, Math.max(fitScaleRef.current, zTarget));
    if (z === v.z) return;
    const px = (cx - v.tx) / v.z;
    const py = (cy - v.ty) / v.z;
    viewRef.current = clampView({ z, tx: cx - px * z, ty: cy - py * z });
    applyTransform();
  }, [clampView, applyTransform]);

  const toggleFitZoom = useCallback((cx, cy) => {
    if (viewRef.current.z > fitScaleRef.current * 1.05) fitView();
    else zoomTo(fitScaleRef.current * DOUBLE_TAP_ZOOM, cx, cy);
  }, [fitView, zoomTo]);

  const closePopover = useCallback(() => {
    if (popoverOpenRef.current) setPopover(null);
  }, []);

  // Au montage et au changement de plan : fit + centrage, gestes remis à zéro
  useLayoutEffect(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
    lastTapRef.current = null;
    fitView();
  }, [activePlanId, fitView]);

  // Redimensionnement du conteneur : refit si on était au fit, sinon re-borner
  useEffect(() => {
    const c = containerRef.current;
    if (!c || !hasViewer || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const plan = activePlanRef.current;
      if (!plan?.width || !plan?.height) return;
      const cw = c.clientWidth, ch = c.clientHeight;
      if (!cw || !ch) return;
      const wasFit = Math.abs(viewRef.current.z - fitScaleRef.current) < 1e-3;
      const fitZ = Math.min(cw / plan.width, ch / plan.height);
      fitScaleRef.current = fitZ;
      maxZoomRef.current = fitZ * MAX_ZOOM_FACTOR;
      if (wasFit || viewRef.current.z < fitZ) fitView();
      else { viewRef.current = clampView(viewRef.current); applyTransform(); }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [hasViewer, fitView, clampView, applyTransform]);

  // Molette = zoom vers le curseur (listener natif : React enregistre wheel en passif)
  useEffect(() => {
    const c = containerRef.current;
    if (!c || !hasViewer) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      zoomTo(viewRef.current.z * Math.exp(-e.deltaY * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
      closePopover();
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [hasViewer, zoomTo, closePopover]);

  // ── Mutations du doc (toujours depuis visitRef pour éviter les instantanés périmés) ──

  const movePin = useCallback((obsId, x, y) => {
    const planId = activePlanRef.current?.id;
    if (!planId) return;
    onChangeVisit({
      observations: (visitRef.current.observations || []).map(o =>
        o.id === obsId ? { ...o, planPin: { planId, x, y } } : o),
    });
  }, [onChangeVisit]);

  const removePin = (obsId) => {
    onChangeVisit({
      observations: (visitRef.current.observations || []).map(o => {
        if (o.id !== obsId || !o.planPin) return o;
        const rest = { ...o };
        delete rest.planPin; // jamais `undefined` (Firestore le rejette)
        return rest;
      }),
    });
    setPopover(null);
  };

  const handleCreateObs = () => {
    if (!pinDraft || !activePlanId) return;
    const newObs = {
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: '',
      images: [],
      date: new Date().toISOString().slice(0, 10),
      planPin: { planId: activePlanId, x: pinDraft.x, y: pinDraft.y },
    };
    onChangeVisit({ observations: [...(visitRef.current.observations || []), newObs] });
    setPinDraft(null);
    onEditObs?.(newObs.id);
  };

  const handleLinkObs = (obsId) => {
    if (!pinDraft || !activePlanId) return;
    onChangeVisit({
      observations: (visitRef.current.observations || []).map(o =>
        o.id === obsId ? { ...o, planPin: { planId: activePlanId, x: pinDraft.x, y: pinDraft.y } } : o),
    });
    setPinDraft(null);
  };

  // ── Popover d'un pin existant (position calculée à l'ouverture, coords conteneur) ──
  const openPopover = useCallback((obs) => {
    if (isMobile) { setPopover({ obsId: obs.id }); return; }
    const c = containerRef.current;
    const plan = activePlanRef.current;
    if (!c || !plan) return;
    const { tx, ty, z } = viewRef.current;
    const px = obs.planPin.x * plan.width * z + tx;
    const py = obs.planPin.y * plan.height * z + ty;
    const cw = c.clientWidth, ch = c.clientHeight;
    const W = 240, H = 175;
    const left = Math.min(Math.max(px - W / 2, 8), Math.max(8, cw - W - 8));
    const top = py + 14 + H <= ch ? py + 14 : Math.max(8, py - H - 44);
    setPopover({ obsId: obs.id, left, top });
  }, [isMobile]);

  // ── Tap (résolu par la gestuelle : pointerup < 8 px et < 400 ms) ──
  const handleTap = useCallback((cx, cy) => {
    const plan = activePlanRef.current;
    if (!plan?.width || !plan?.height) return;
    const { tx, ty, z } = viewRef.current;
    const nx = (cx - tx) / z / plan.width;
    const ny = (cy - ty) / z / plan.height;
    const inside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;

    if (placingRef.current) {
      if (inside) { setPlacing(false); setPinDraft({ x: nx, y: ny }); }
      return;
    }
    if (movingRef.current) {
      if (inside) { movePin(movingRef.current, nx, ny); setMovingObsId(null); }
      return;
    }

    // Tap sur un pin existant ? (hit-test manuel : les pins sont pointer-events-none)
    const hitRadius = isMobile ? 26 : 20;
    let best = null, bestDist = Infinity;
    for (const obs of pinsRef.current) {
      const px = obs.planPin.x * plan.width * z + tx;
      const py = obs.planPin.y * plan.height * z + ty - PIN_CENTER_OFFSET;
      const d = Math.hypot(cx - px, cy - py);
      if (d < hitRadius && d < bestDist) { best = obs; bestDist = d; }
    }
    if (best) { lastTapRef.current = null; openPopover(best); return; }
    if (popoverOpenRef.current) { lastTapRef.current = null; setPopover(null); return; }

    // Double-tap / double-clic → toggle fit ↔ zoom rapproché
    const now = performance.now();
    const lt = lastTapRef.current;
    if (lt && now - lt.t < DOUBLE_TAP_MS && Math.hypot(cx - lt.x, cy - lt.y) < DOUBLE_TAP_DIST) {
      lastTapRef.current = null;
      toggleFitZoom(cx, cy);
    } else {
      lastTapRef.current = { t: now, x: cx, y: cy };
    }
  }, [isMobile, movePin, openPopover, toggleFitZoom]);

  // ── Pointer Events unifiés (souris + tactile) ──
  const getRelPos = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((e) => {
    const c = containerRef.current;
    if (!c || !activePlanRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    c.setPointerCapture?.(e.pointerId);
    const p = getRelPos(e);
    pointersRef.current.set(e.pointerId, p);
    const pts = [...pointersRef.current.values()];
    if (pts.length === 1) {
      gestureRef.current = { type: 'pan', startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, t0: performance.now(), moved: false };
    } else if (pts.length === 2) {
      closePopover();
      const [a, b] = pts;
      const v = viewRef.current;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gestureRef.current = {
        type: 'pinch',
        d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        z0: v.z,
        // Point image sous le milieu initial : il reste sous le milieu courant
        px: (mid.x - v.tx) / v.z,
        py: (mid.y - v.ty) / v.z,
      };
    }
  }, [getRelPos, closePopover]);

  const handlePointerMove = useCallback((e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const p = getRelPos(e);
    pointersRef.current.set(e.pointerId, p);
    const g = gestureRef.current;
    if (!g) return;
    if (g.type === 'pan') {
      const dx = p.x - g.lastX, dy = p.y - g.lastY;
      g.lastX = p.x; g.lastY = p.y;
      if (!g.moved && Math.hypot(p.x - g.startX, p.y - g.startY) >= TAP_MAX_DIST) {
        g.moved = true;
        closePopover();
      }
      if (!g.moved) return; // zone morte du tap : pas de micro-pan involontaire
      const v = viewRef.current;
      viewRef.current = clampView({ z: v.z, tx: v.tx + dx, ty: v.ty + dy });
      applyTransform();
    } else if (g.type === 'pinch' && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = Math.min(maxZoomRef.current, Math.max(fitScaleRef.current, g.z0 * (d / g.d0)));
      viewRef.current = clampView({ z, tx: mid.x - g.px * z, ty: mid.y - g.py * z });
      applyTransform();
    }
  }, [getRelPos, clampView, applyTransform, closePopover]);

  const handlePointerUp = useCallback((e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const p = getRelPos(e);
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (!g) return;
    if (g.type === 'pan') {
      gestureRef.current = null;
      const dt = performance.now() - g.t0;
      if (!g.moved && dt < TAP_MAX_MS && Math.hypot(p.x - g.startX, p.y - g.startY) < TAP_MAX_DIST) {
        handleTap(p.x, p.y);
      }
    } else if (g.type === 'pinch') {
      if (pointersRef.current.size === 1) {
        // Un doigt levé → on continue en pan avec le doigt restant (jamais un tap)
        const [q] = [...pointersRef.current.values()];
        gestureRef.current = { type: 'pan', startX: q.x, startY: q.y, lastX: q.x, lastY: q.y, t0: performance.now(), moved: true };
      } else if (pointersRef.current.size === 0) {
        gestureRef.current = null;
      }
    }
  }, [getRelPos, handleTap]);

  const handlePointerCancel = useCallback((e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (!g) return;
    if (pointersRef.current.size === 0) {
      // Plus aucun contact : geste terminé (une annulation ne déclenche jamais un tap).
      gestureRef.current = null;
    } else if (g.type === 'pinch' && pointersRef.current.size === 1) {
      // Un doigt du pinch annulé (bord d'écran, palm-rejection, reprise par l'OS) →
      // on repart en pan avec le doigt restant, sinon la visionneuse se fige
      // (handlePointerMove exige size >= 2 pour le pinch). Cf. handlePointerUp.
      const [q] = [...pointersRef.current.values()];
      gestureRef.current = { type: 'pan', startX: q.x, startY: q.y, lastX: q.x, lastY: q.y, t0: performance.now(), moved: true };
    }
  }, []);

  // ── Import (module chargé paresseusement : il tire pdfjs) ──

  const openFilePicker = () => fileRef.current?.click();

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (isPdf) { setPdfFile(file); return; }
    setImportBusy(true);
    try {
      const { importImagePlan } = await import('../../utils/siteVisitPlanStorage');
      const name = (file.name || 'Plan').replace(/\.[^.]+$/, '') || 'Plan';
      const plan = await importImagePlan({ file, companyId, visitId: visit.id, name });
      onChangeVisit({ plans: [...(visitRef.current.plans || []), plan] });
      setActivePlanId(plan.id);
    } catch (err) {
      console.error('[Plans] Import image échoué:', err);
      setImportError("Impossible d'importer cette image.");
    } finally {
      setImportBusy(false);
    }
  };

  const handlePdfImported = (newPlans) => {
    if (!newPlans?.length) return;
    onChangeVisit({ plans: [...(visitRef.current.plans || []), ...newPlans] });
    setActivePlanId(newPlans[0].id);
  };

  const handleRenamePlan = () => {
    const plan = activePlan;
    if (!plan) return;
    const name = window.prompt('Nom du plan', plan.name || '');
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onChangeVisit({
      plans: (visitRef.current.plans || []).map(p => p.id === plan.id ? { ...p, name: trimmed } : p),
    });
  };

  const handleDeletePlan = async () => {
    const plan = activePlan;
    if (!plan) return;
    const pinCount = pinCountByPlan.get(plan.id) || 0;
    const msg = `Supprimer le plan « ${plan.name || 'Plan'} » ?`
      + (pinCount > 0 ? `\n${pinCount} pin${pinCount > 1 ? 's seront retirés' : ' sera retiré'} (les observations sont conservées).` : '');
    if (!window.confirm(msg)) return;
    try {
      const { deletePlan } = await import('../../utils/siteVisitPlanStorage');
      await deletePlan(plan);
    } catch (err) {
      // Fichier Storage déjà absent ou réseau KO : on retire quand même du doc
      console.error('[Plans] Suppression Storage échouée:', err);
    }
    const nextPlans = (visitRef.current.plans || []).filter(p => p.id !== plan.id);
    const nextObs = (visitRef.current.observations || []).map(o => {
      if (o.planPin?.planId !== plan.id) return o;
      const rest = { ...o };
      delete rest.planPin;
      return rest;
    });
    onChangeVisit({ plans: nextPlans, observations: nextObs });
    setPopover(null);
    setActivePlanId(nextPlans[0]?.id || null);
  };

  const startPlacing = () => {
    setPopover(null);
    setMovingObsId(null);
    setPlacing(true);
  };

  const cancelModes = () => {
    setPlacing(false);
    setMovingObsId(null);
  };

  // ── Popover : observation ciblée (fermée d'office si le pin a disparu) ──
  const popoverObs = popover
    ? observations.find(o => o.id === popover.obsId && o.planPin?.planId === activePlanId) || null
    : null;

  const renderPopoverContent = (obs) => {
    const num = obsNumberById.get(obs.id);
    const text = stripHtml(obs.text || '');
    const imgCount = (obs.images || []).length;
    const btnH = isMobile ? 'min-h-[44px]' : 'py-2';
    return (
      <>
        <div className="flex items-center gap-2">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{num}</span>
          <span className="flex-1 text-[12px] font-bold text-gray-900">Observation n°{num}</span>
          <button onClick={() => setPopover(null)} className="p-1 rounded-lg hover:bg-gray-100 transition">
            <X size={14} className="text-gray-400" />
          </button>
        </div>
        {text
          ? <p className="text-[12px] text-gray-600 leading-snug line-clamp-2 mt-1.5">{text}</p>
          : <p className="text-[12px] text-gray-400 italic mt-1.5">Observation vide</p>}
        {imgCount > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{imgCount} photo{imgCount > 1 ? 's' : ''}</p>}
        <div className="flex gap-1.5 mt-2.5">
          <button onClick={() => { setPopover(null); onEditObs?.(obs.id); }}
            className={`flex-1 ${btnH} bg-gray-900 text-white rounded-xl text-[12px] font-bold active:scale-[0.97] transition`}>
            Ouvrir
          </button>
          {!readOnly && (
            <button onClick={() => { setPopover(null); setPlacing(false); setMovingObsId(obs.id); }}
              className={`flex-1 ${btnH} flex items-center justify-center gap-1 bg-gray-100 text-gray-700 rounded-xl text-[12px] font-semibold active:scale-[0.97] transition`}>
              <Move size={13} /> Déplacer
            </button>
          )}
        </div>
        {!readOnly && (
          <button onClick={() => removePin(obs.id)}
            className={`w-full ${btnH} mt-1.5 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold active:scale-[0.97] transition`}>
            Retirer le pin
          </button>
        )}
      </>
    );
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-full min-h-0">
      <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChosen} />

      {plans.length === 0 ? (
        /* ── État vide ── */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-sm w-full">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
              <MapIcon size={22} className="text-blue-600" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-bold text-gray-900">Aucun plan</p>
            <p className="text-[12px] text-gray-500 mt-1">
              {readOnly
                ? "Aucun plan n'a été importé pour cette visite."
                : 'Importez un plan du site (PDF ou image) pour y épingler vos observations.'}
            </p>
            {importError && <p className="text-[11px] text-red-600 mt-2">{importError}</p>}
            {!readOnly && (
              <button onClick={openFilePicker}
                className="mt-4 w-full min-h-[48px] flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition">
                <Upload size={15} /> Importer un plan (PDF ou image)
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Sélecteur de plans (chips) + ajout de pin (desktop) ── */}
          <div className="shrink-0 flex items-center gap-2 pb-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto">
              {plans.map(p => {
                const active = p.id === activePlanId;
                const count = pinCountByPlan.get(p.id) || 0;
                return (
                  <div key={p.id}
                    className={`shrink-0 flex items-center rounded-xl transition ${isMobile ? 'min-h-[44px]' : ''} ${
                      active ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                    }`}>
                    <button onClick={() => setActivePlanId(p.id)}
                      className={`flex items-center gap-1.5 pl-3 py-2 max-w-[190px] ${active && !readOnly ? 'pr-1' : 'pr-3'}`}>
                      <span className="text-[12px] font-bold truncate">{p.name || 'Plan'}</span>
                      {count > 0 && (
                        <span className={`shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          active ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                    {active && !readOnly && (
                      <>
                        <button onClick={handleRenamePlan} title="Renommer le plan"
                          className="p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition">
                          <Pencil size={13} className="text-white/80" />
                        </button>
                        <button onClick={handleDeletePlan} title="Supprimer le plan"
                          className="p-2 mr-1 rounded-lg hover:bg-white/10 active:bg-white/20 transition">
                          <Trash2 size={13} className="text-red-300" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {!readOnly && (
                <button onClick={openFilePicker} title="Importer un autre plan"
                  className={`shrink-0 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.95] transition ${
                    isMobile ? 'w-11 h-11' : 'w-9 h-9'
                  }`}>
                  <Plus size={16} />
                </button>
              )}
            </div>
            {!isMobile && !readOnly && (
              <button onClick={startPlacing} disabled={!activePlan || placing || !!movingObsId}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[12px] font-bold hover:bg-blue-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <MapPin size={14} /> Ajouter un pin
              </button>
            )}
          </div>

          {importError && (
            <p className="shrink-0 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-2">
              {importError}
            </p>
          )}

          {/* ── Visionneuse zoom/pan ── */}
          <div
            ref={containerRef}
            className={`relative flex-1 min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 select-none ${
              placing || movingObsId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            }`}
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {activePlan && (
              <div
                ref={stageRef}
                className="absolute left-0 top-0 origin-top-left will-change-transform"
                style={{
                  width: activePlan.width || 1,
                  height: activePlan.height || 1,
                  transform: `translate(${viewRef.current.tx}px, ${viewRef.current.ty}px) scale(${viewRef.current.z})`,
                  '--pin-scale': String(1 / viewRef.current.z),
                }}
              >
                <img
                  src={activePlan.src}
                  alt={activePlan.name || 'Plan'}
                  width={activePlan.width}
                  height={activePlan.height}
                  draggable={false}
                  className="w-full h-full select-none bg-white shadow-sm"
                  style={{ WebkitTouchCallout: 'none' }}
                />
                {activePins.map(obs => (
                  <PlanPin
                    key={obs.id}
                    number={obsNumberById.get(obs.id)}
                    x={obs.planPin.x}
                    y={obs.planPin.y}
                    variant={popover?.obsId === obs.id ? 'active' : movingObsId === obs.id ? 'moving' : 'default'}
                  />
                ))}
              </div>
            )}

            {/* Bandeau mode placement / déplacement */}
            {(placing || movingObsId) && (
              <div
                className="absolute top-2 left-1/2 -translate-x-1/2 z-20 max-w-[95%] flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm text-white rounded-xl pl-3 pr-1.5 py-1.5 shadow-lg"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MapPin size={13} className="shrink-0 text-blue-300" />
                <span className="text-[12px] font-semibold truncate">
                  {placing
                    ? 'Touchez le plan pour placer le pin'
                    : `Touchez le nouvel emplacement du pin n°${obsNumberById.get(movingObsId) || ''}`}
                </span>
                <button onClick={cancelModes}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold transition">
                  Annuler
                </button>
              </div>
            )}

            {/* Popover pin — desktop ancré, mobile mini-sheet en bas de la visionneuse */}
            {popoverObs && !isMobile && (
              <div
                className="absolute z-20 w-[240px] bg-white rounded-2xl border border-gray-200/60 shadow-xl p-3"
                style={{ left: popover.left, top: popover.top }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {renderPopoverContent(popoverObs)}
              </div>
            )}
            {popoverObs && isMobile && (
              <div
                className="absolute z-20 left-2 right-2 bottom-2 bg-white rounded-2xl border border-gray-200 shadow-xl p-3"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {renderPopoverContent(popoverObs)}
              </div>
            )}
          </div>

          {/* ── Barre d'action mobile ── */}
          {isMobile && !readOnly && (
            <div className="shrink-0 pt-2">
              <button onClick={startPlacing} disabled={!activePlan || placing || !!movingObsId}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-[13px] font-bold active:scale-[0.97] transition shadow-sm disabled:opacity-50">
                <MapPin size={16} /> Ajouter un pin
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Overlays globaux ── */}
      {importBusy && (
        <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-2">
          <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] font-semibold text-gray-600">Import du plan…</p>
        </div>
      )}

      {pinDraft && (
        <PinChoiceSheet
          isMobile={isMobile}
          linkables={linkables}
          onNew={handleCreateObs}
          onLink={handleLinkObs}
          onCancel={() => setPinDraft(null)}
        />
      )}

      {pdfFile && (
        <PlanImportModal
          file={pdfFile}
          companyId={companyId}
          visitId={visit.id}
          onClose={() => setPdfFile(null)}
          onImported={handlePdfImported}
        />
      )}
    </div>
  );
}
