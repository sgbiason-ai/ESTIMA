// src/components/mobile/ImageViewerModal.jsx
//
// Overlay plein écran pour visualiser une image avec pinch-to-zoom.

import React from 'react';
import Icon from './Icon';

export default function ImageViewerModal({ src: rawSrc, onClose }) {
  const src = typeof rawSrc === 'object' ? rawSrc?.src : rawSrc;
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-modal-stack bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white"
      >
        <Icon name="close" size={24} color="#fff" />
      </button>
      <img
        src={src}
        alt="Observation"
        className="max-w-full max-h-full object-contain"
        style={{ touchAction: 'pinch-zoom' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
