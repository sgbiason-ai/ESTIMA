// src/components/mobile/SiteVisitObsEditSheet.jsx
// Éditeur d'observation simplifié pour les visites de site.

import React, { useState, useRef } from 'react';
import Icon from './Icon';
import { uploadSiteVisitImage, deleteSiteVisitImage } from '../../utils/siteVisitImageStorage';

// Cle stable d'une image (path Storage, sinon src/base64)
const imgKey = (img) => (typeof img === 'object' && img ? (img.path || img.src) : img);

export default function SiteVisitObsEditSheet({ obs, onUpdate, onDelete, onClose, onViewImage, inline = false, companyId, visitId }) {
  const [text, setText] = useState(obs.text || '');
  const [images, setImages] = useState(obs.images || []);
  const [uploading, setUploading] = useState(false);
  const originalRef = useRef(obs.images || []);
  const fileRef = useRef(null);

  // Enregistrer : supprimer de Storage les images retirees.
  const handleSave = () => {
    const finalKeys = new Set(images.map(imgKey));
    originalRef.current
      .filter(img => !finalKeys.has(imgKey(img)))
      .forEach(img => deleteSiteVisitImage(img));
    onUpdate(obs.id, { text, images });
    onClose();
  };

  // Annuler : supprimer de Storage les images ajoutees cette session.
  const handleCancel = () => {
    const originalKeys = new Set(originalRef.current.map(imgKey));
    images
      .filter(img => !originalKeys.has(imgKey(img)))
      .forEach(img => deleteSiteVisitImage(img));
    onClose();
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;
    if (!companyId || !visitId || !obs?.id) {
      console.error('[Visite] Upload photo impossible : contexte manquant');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(f => uploadSiteVisitImage(f, { companyId, visitId, obsId: obs.id }))
      );
      setImages(prev => [...prev, ...uploaded]);
    } catch (err) {
      console.error('[Visite] Erreur upload photo:', err);
    } finally {
      setUploading(false);
    }
  };

  // Retrait local uniquement (suppression Storage differee a l'enregistrement).
  const handleRemoveImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Supprimer l'observation : nettoyer ses photos Storage.
  const handleDeleteObs = () => {
    for (const img of images) deleteSiteVisitImage(img);
    onDelete(obs.id);
    onClose();
  };

  return (
    <div className={inline ? "flex flex-col h-full" : "fixed inset-0 z-50 flex flex-col bg-white"}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl shrink-0">
        <button onClick={handleCancel} className="text-[13px] font-medium text-gray-500">Annuler</button>
        <span className="text-[14px] font-bold text-gray-900">Observation</span>
        <button onClick={handleSave} disabled={uploading} className="text-[13px] font-bold text-blue-600 disabled:opacity-40">Enregistrer</button>
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
            {uploading ? 'Téléversement…' : 'Ajouter des photos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={handleAddPhotos} />

          {/* Supprimer */}
          <button
            onClick={handleDeleteObs}
            className="flex items-center justify-center gap-2 w-full mt-4 py-3 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition"
          >
            <Icon name="trash" size={14} color="#ef4444" />
            Supprimer cette observation
          </button>
        </div>
    </div>
  );
}
