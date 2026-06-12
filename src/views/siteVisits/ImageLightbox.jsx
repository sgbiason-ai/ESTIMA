// src/views/siteVisits/ImageLightbox.jsx
// Lightbox desktop — agrandit une photo en plein écran.
// Fermeture : croix, touche Échap, ou clic en dehors de l'image.
// Navigation gauche/droite (boutons + flèches clavier) entre les photos d'une même observation.
// Zoom : molette (centré sur le curseur), double-clic pour basculer, déplacement à la souris
//        quand l'image est zoomée, remise à zéro au changement de photo ou via la touche « 0 ».

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZERO_VIEW = { scale: 1, tx: 0, ty: 0 };

export default function ImageLightbox({ images, index = 0, onClose }) {
  // Normalise : accepte des chaînes (base64/url) ou des objets { src }.
  const list = (images || []).map((i) => (typeof i === 'string' ? i : i?.src)).filter(Boolean);
  const [cur, setCur] = useState(index);
  const [view, setView] = useState(ZERO_VIEW); // { scale, tx, ty } — tx/ty en pixels écran
  const [panning, setPanning] = useState(false);

  const stageRef = useRef(null);
  const panRef = useRef(null);   // { x, y, tx, ty } au début du déplacement
  const movedRef = useRef(false); // pour ne pas fermer après un glissé

  const reset = useCallback(() => setView(ZERO_VIEW), []);

  useEffect(() => { setCur(index); }, [index]);
  useEffect(() => { reset(); }, [cur, reset]); // zoom remis à zéro quand on change de photo

  const go = useCallback((delta) => {
    setCur((c) => (c + delta + list.length) % list.length);
  }, [list.length]);

  // ── Clavier : Échap / flèches / « 0 » pour réinitialiser le zoom ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && list.length > 1) go(-1);
      else if (e.key === 'ArrowRight' && list.length > 1) go(1);
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go, list.length, reset]);

  // ── Zoom molette (listener natif non-passif pour pouvoir preventDefault) ──
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - (rect.left + rect.width / 2);
      const py = e.clientY - (rect.top + rect.height / 2);
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        if (next === MIN_SCALE) return ZERO_VIEW;
        // Garde le point sous le curseur fixe (zoom centré curseur).
        return {
          scale: next,
          tx: px - (next * (px - v.tx)) / v.scale,
          ty: py - (next * (py - v.ty)) / v.scale,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Déplacement (pan) quand l'image est zoomée ──
  useEffect(() => {
    if (!panning) return;
    const onMove = (e) => {
      const p = panRef.current;
      if (!p) return;
      movedRef.current = true;
      setView((v) => ({ ...v, tx: p.tx + (e.clientX - p.x), ty: p.ty + (e.clientY - p.y) }));
    };
    const onUp = () => { setPanning(false); panRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  const handleImgMouseDown = (e) => {
    if (view.scale <= 1) return;
    e.preventDefault();
    movedRef.current = false;
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    setPanning(true);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setView((v) => (v.scale > 1 ? ZERO_VIEW : { scale: 2.5, tx: 0, ty: 0 }));
  };

  // Ferme si on clique sur le fond (pas l'image/boutons) et qu'on n'a pas glissé.
  const handleBackdropClick = (e) => {
    if (e.target !== e.currentTarget) return;
    if (movedRef.current) { movedRef.current = false; return; }
    onClose();
  };

  if (list.length === 0) return null;
  const multi = list.length > 1;
  const zoomed = view.scale > 1;

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-sm flex items-center justify-center overflow-hidden select-none"
      onClick={handleBackdropClick}
    >
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
        title="Fermer (Échap)">
        <X size={22} />
      </button>

      {multi && (
        <>
          <button onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            title="Photo précédente">
            <ChevronLeft size={26} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            title="Photo suivante">
            <ChevronRight size={26} />
          </button>
        </>
      )}

      {/* Indicateurs bas : compteur + niveau de zoom */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-white text-xs font-bold">
        {multi && (
          <span className="px-3 py-1 rounded-full bg-white/10 tabular-nums">{cur + 1} / {list.length}</span>
        )}
        {zoomed && (
          <button onClick={(e) => { e.stopPropagation(); reset(); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition tabular-nums"
            title="Réinitialiser le zoom (0)">
            <ZoomIn size={13} /> {Math.round(view.scale * 100)}%
          </button>
        )}
      </div>

      <img src={list[cur]} alt="" draggable={false}
        className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: panning ? 'none' : 'transform 0.12s ease-out',
          cursor: zoomed ? (panning ? 'grabbing' : 'grab') : 'zoom-in',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleImgMouseDown}
      />
    </div>
  );
}
