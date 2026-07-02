// src/components/common/RotatingMapFrame.jsx
// Cadre « heading-up » (GPS voiture) pour une carte Leaflet : la carte est rendue
// dans un carré de la taille de la diagonale du viewport puis tournée en CSS pour
// mettre le cap de déplacement vers le haut. Leaflet ignore la rotation (transform
// pur) — les clics carte étant décalés en mode tourné, l'appelant doit couper la
// rotation dès qu'une interaction précise est requise (mesure, route…).
// Les pastilles/markers (divIcon → div enfant) sont contre-rotées pour rester lisibles.

import React, { useEffect, useRef, useState } from 'react';

let frameSeq = 0;

export default function RotatingMapFrame({ rotation = 0, style, className, children }) {
  const hostRef = useRef(null);
  const [diag, setDiag] = useState(null);
  const [cls] = useState(() => `rotmap-${++frameSeq}`);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setDiag(Math.ceil(Math.hypot(r.width, r.height)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = rotation !== 0 && diag != null;

  return (
    <div ref={hostRef} className={`${cls} ${className || ''}`} style={{ ...style, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: active ? diag : '100%',
        height: active ? diag : '100%',
        transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
        transition: 'transform 0.6s ease-out',
      }}>
        {children}
      </div>
      {/* Contre-rotation des icônes divIcon (badges numérotés, labels) */}
      <style>{`.${cls} .leaflet-marker-icon > div { transform: rotate(${rotation}deg); transition: transform 0.6s ease-out; }`}</style>
    </div>
  );
}
