// src/components/mobile/SiteVisitObsEditSheet.jsx
// Éditeur d'observation simplifié pour les visites de site.

import React, { useState, useRef } from 'react';
import Icon from './Icon';
import { fmtCoord, fmtDist } from '../../utils/geoHelpers';
import { uploadSiteVisitImage, deleteSiteVisitImage } from '../../utils/siteVisitImageStorage';

// Cle stable d'une image (path Storage, sinon src/base64)
const imgKey = (img) => (typeof img === 'object' && img ? (img.path || img.src) : img);

export default function SiteVisitObsEditSheet({ obs, onUpdate, onDelete, onClose, onViewImage, inline = false, companyId, visitId }) {
  const [text, setText] = useState(obs.text || '');
  const [images, setImages] = useState(obs.images || []);
  const [uploading, setUploading] = useState(false);
  const originalRef = useRef(obs.images || []);
  const fileRef = useRef(null);
  const isSegment = !!(obs.segmentFrom && obs.segmentTo);

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

  // Supprimer l'observation : confirmation puis nettoyage des photos Storage.
  const handleDeleteObs = async () => {
    const { confirm } = await import('../../utils/globalUI');
    const ok = await confirm('Supprimer cette observation ?', { danger: true });
    if (!ok) return;
    for (const img of images) deleteSiteVisitImage(img);
    onDelete(obs.id);
    onClose();
  };

  return (
    <div className={inline ? "flex flex-col h-full" : "fixed inset-0 z-50 flex flex-col bg-white"}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl shrink-0">
        <button onClick={handleCancel} className="text-[13px] font-medium text-gray-500">Annuler</button>
        <span className="text-[14px] font-bold text-gray-900">{isSegment ? 'Segment' : 'Observation'}</span>
        <button onClick={handleSave} disabled={uploading} className="text-[13px] font-bold text-blue-600 disabled:opacity-40">Enregistrer</button>
      </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Contexte du segment (lecture seule) */}
          {isSegment && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-blue-700">
                <Icon name="map" size={14} color="#1d4ed8" />
                Segment — {fmtDist(obs.segmentDistance)}
                {obs.segmentUncertainty != null && <span className="font-normal text-gray-400 text-[10px]">±{Math.round(obs.segmentUncertainty)}m</span>}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 font-mono">
                {fmtCoord(obs.segmentFrom.lat, obs.segmentFrom.lng)} → {fmtCoord(obs.segmentTo.lat, obs.segmentTo.lng)}
              </div>
            </div>
          )}

          {/* Bouton ajouter photo — en haut, agrandi */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2.5 w-full mt-3 py-4 bg-blue-50 border border-blue-200 rounded-2xl text-[15px] font-semibold text-blue-600 active:bg-blue-100 transition disabled:opacity-50"
          >
            <Icon name="camera" size={22} color="#2563eb" />
            {uploading ? 'Téléversement…' : 'Ajouter une photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={handleAddPhotos} />

          {/* Texte */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={isSegment ? 'Commentaire sur ce segment…' : 'Décrivez votre observation…'}
            className="w-full min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mt-3"
          />

          {/* Photos — vignettes sous la note */}
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
        </div>

        {/* Footer — Supprimer épinglé en bas (avec confirmation) */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-200/60 bg-white">
          <button
            onClick={handleDeleteObs}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[14px] font-semibold text-red-600 bg-red-50 active:bg-red-100 transition"
          >
            <Icon name="trash" size={16} color="#dc2626" />
            Supprimer cette observation
          </button>
        </div>
    </div>
  );
}
