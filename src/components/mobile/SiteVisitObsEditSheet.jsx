// src/components/mobile/SiteVisitObsEditSheet.jsx
// Éditeur d'observation simplifié pour les visites de site.

import React, { useState, useRef } from 'react';
import Icon from './Icon';
import { compressImage } from '../../utils/imageCompressor';

export default function SiteVisitObsEditSheet({ obs, onUpdate, onDelete, onClose, onViewImage }) {
  const [text, setText] = useState(obs.text || '');
  const [images, setImages] = useState(obs.images || []);
  const fileRef = useRef(null);

  const handleSave = () => {
    onUpdate(obs.id, { text, images });
    onClose();
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const compressed = await Promise.all(files.map(f => compressImage(f)));
    setImages(prev => [...prev, ...compressed]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRemoveImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white border-t border-gray-200 rounded-t-3xl overflow-hidden shadow-2xl max-h-[85vh]">

        {/* Handle + header */}
        <div className="flex flex-col items-center pt-3 pb-2 px-4 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 mb-3" />
          <div className="flex items-center justify-between w-full">
            <button onClick={onClose} className="text-[13px] font-medium text-gray-500">Annuler</button>
            <span className="text-[14px] font-bold text-gray-900">Observation</span>
            <button onClick={handleSave} className="text-[13px] font-bold text-blue-600">Enregistrer</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Texte */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Décrivez votre observation…"
            className="w-full min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mt-3"
          />

          {/* Photos */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {images.map((img, idx) => {
                const imgSrc = typeof img === 'string' ? img : img.src;
                return (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                    <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy"
                      onClick={() => onViewImage?.(imgSrc)} />
                    <button onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center">
                      <Icon name="close" size={10} color="#fff" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bouton ajouter photo */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full mt-3 py-3 bg-gray-100 rounded-xl text-[13px] font-medium text-gray-600 active:bg-gray-200 transition"
          >
            <Icon name="camera" size={16} color="#6b7280" />
            Ajouter des photos
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={handleAddPhotos} />

          {/* Supprimer */}
          <button
            onClick={() => { onDelete(obs.id); onClose(); }}
            className="flex items-center justify-center gap-2 w-full mt-4 py-3 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition"
          >
            <Icon name="trash" size={14} color="#ef4444" />
            Supprimer cette observation
          </button>
        </div>
      </div>
    </>
  );
}
