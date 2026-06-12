// src/views/siteVisits/ImageLightbox.jsx
// Lightbox desktop — agrandit une photo en plein écran.
// Fermeture : croix, touche Échap, ou clic en dehors de l'image.
// Navigation gauche/droite (boutons + flèches clavier) entre les photos d'une même observation.

import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageLightbox({ images, index = 0, onClose }) {
  // Normalise : accepte des chaînes (base64/url) ou des objets { src }.
  const list = (images || []).map((i) => (typeof i === 'string' ? i : i?.src)).filter(Boolean);
  const [cur, setCur] = useState(index);

  useEffect(() => { setCur(index); }, [index]);

  const go = useCallback((delta) => {
    setCur((c) => (c + delta + list.length) % list.length);
  }, [list.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && list.length > 1) go(-1);
      else if (e.key === 'ArrowRight' && list.length > 1) go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go, list.length]);

  if (list.length === 0) return null;
  const multi = list.length > 1;

  return (
    <div
      className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <button onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
        title="Fermer (Échap)">
        <X size={22} />
      </button>

      {multi && (
        <>
          <button onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            title="Photo précédente">
            <ChevronLeft size={26} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            title="Photo suivante">
            <ChevronRight size={26} />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold tabular-nums">
            {cur + 1} / {list.length}
          </div>
        </>
      )}

      <img src={list[cur]} alt=""
        className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
