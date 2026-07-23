// src/components/mobile/SiteVisitObsEditSheet.jsx
// Éditeur d'observation simplifié pour les visites de site.

import React, { useEffect, useState, useRef } from 'react';
import Icon from './Icon';
import { fmtCoord, fmtDist } from '../../utils/geoHelpers';
import { syncPendingSiteVisitImage, uploadSiteVisitImage } from '../../utils/siteVisitImageStorage';

export default function SiteVisitObsEditSheet({
  obs,
  onUpdate,
  onDelete,
  onClose,
  onViewImage,
  onToast,
  onUploadingChange,
  inline = false,
  companyId,
  visitId,
}) {
  const [text, setText] = useState(obs.text || '');
  const [images, setImages] = useState(obs.images || []);
  const [uploading, setUploading] = useState(false);
  const imagesRef = useRef(obs.images || []);
  const fileRef = useRef(null);
  const syncAttemptedRef = useRef(false);
  const isSegment = !!(obs.segmentFrom && obs.segmentTo);

  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange]);

  const setUploadState = (nextUploading) => {
    setUploading(nextUploading);
    onUploadingChange?.(nextUploading);
  };

  useEffect(() => {
    if (syncAttemptedRef.current) return;
    const currentImages = imagesRef.current;
    if (!currentImages.some(image => image?.pendingStorage)) return;
    syncAttemptedRef.current = true;

    setUploading(true);
    onUploadingChange?.(true);
    Promise.all(currentImages.map(image => (
      image?.pendingStorage
        ? syncPendingSiteVisitImage(image, { companyId, visitId, obsId: obs.id })
        : image
    )))
      .then(nextImages => {
        const syncedCount = nextImages.filter((image, index) => (
          currentImages[index]?.pendingStorage && !image?.pendingStorage
        )).length;
        if (syncedCount > 0) {
          imagesRef.current = nextImages;
          setImages(nextImages);
          onUpdate(obs.id, { images: nextImages });
          onToast?.(`${syncedCount} photo${syncedCount > 1 ? 's resynchronisées' : ' resynchronisée'}`);
        }
      })
      .finally(() => {
        setUploading(false);
        onUploadingChange?.(false);
      });
  }, [companyId, obs.id, onToast, onUpdate, onUploadingChange, visitId]);

  const handleClose = () => {
    if (uploading) return;
    onClose();
  };

  const handleTextChange = (event) => {
    const nextText = event.target.value;
    setText(nextText);
    onUpdate(obs.id, { text: nextText });
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;
    if (!companyId || !visitId || !obs?.id) {
      console.error('[Visite] Upload photo impossible : contexte manquant');
      onToast?.('Impossible d’ajouter la photo : visite non initialisée');
      return;
    }
    setUploadState(true);
    try {
      const results = await Promise.allSettled(
        files.map(f => uploadSiteVisitImage(f, { companyId, visitId, obsId: obs.id }))
      );
      const uploaded = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      const failures = results.filter(result => result.status === 'rejected');
      const localFallbacks = uploaded.filter(image => image?.pendingStorage);

      if (uploaded.length > 0) {
        const nextImages = [...imagesRef.current, ...uploaded];
        imagesRef.current = nextImages;
        setImages(nextImages);
        onUpdate(obs.id, { images: nextImages });
      }

      if (failures.length > 0) {
        failures.forEach(result => console.error('[Visite] Erreur upload photo:', result.reason));
        const successMessage = uploaded.length > 0
          ? ` ${uploaded.length} photo${uploaded.length > 1 ? 's ont' : ' a'} bien été conservée${uploaded.length > 1 ? 's' : ''}.`
          : '';
        onToast?.(
          `${failures.length} photo${failures.length > 1 ? 's n’ont' : ' n’a'} pas pu être ajoutée${failures.length > 1 ? 's' : ''}.${successMessage}`
        );
      }
      if (localFallbacks.length > 0) {
        onToast?.(
          `${localFallbacks.length} photo${localFallbacks.length > 1 ? 's conservées' : ' conservée'} hors connexion dans la visite`
        );
      }
    } finally {
      setUploadState(false);
    }
  };

  const handleRemoveImage = (idx) => {
    if (uploading) return;
    const nextImages = imagesRef.current.filter((_, i) => i !== idx);
    imagesRef.current = nextImages;
    setImages(nextImages);
    onUpdate(obs.id, { images: nextImages });
  };

  const handleDeleteObs = async () => {
    if (uploading) return;
    const { confirm } = await import('../../utils/globalUI');
    const ok = await confirm('Supprimer cette observation ?', { danger: true });
    if (!ok) return;
    try {
      await onDelete(obs.id);
      onClose();
    } catch (err) {
      console.error('[Visite] Erreur suppression observation:', err);
      onToast?.('Impossible de supprimer l’observation');
    }
  };

  return (
    <div className={inline ? "flex flex-col h-full" : "fixed inset-0 z-50 flex flex-col bg-white"}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl shrink-0">
        <button
          onClick={handleClose}
          disabled={uploading}
          className="text-[13px] font-medium text-gray-600 disabled:opacity-40"
        >
          Fermer
        </button>
        <span className="text-[14px] font-bold text-gray-900">{isSegment ? 'Segment' : 'Observation'}</span>
        <span className="min-w-[58px] text-right text-[11px] font-medium text-gray-500">
          {uploading ? 'Envoi…' : 'Auto'}
        </span>
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
            onChange={handleTextChange}
            placeholder={isSegment ? 'Commentaire sur ce segment…' : 'Décrivez votre observation…'}
            className="w-full min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mt-3"
          />

          {/* Photos — vignettes sous la note */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {images.map((img, idx) => {
                const imgSrc = typeof img === 'string' ? img : img.src;
                const isLocalFallback = typeof img === 'object' && img?.pendingStorage;
                return (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                    <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy"
                      onClick={() => onViewImage?.(imgSrc)} />
                    {isLocalFallback && (
                      <span className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold">
                        Hors ligne
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      disabled={uploading}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center disabled:opacity-40"
                    >
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
            disabled={uploading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[14px] font-semibold text-red-600 bg-red-50 active:bg-red-100 transition disabled:opacity-40"
          >
            <Icon name="trash" size={16} color="#dc2626" />
            Supprimer cette observation
          </button>
        </div>
    </div>
  );
}
