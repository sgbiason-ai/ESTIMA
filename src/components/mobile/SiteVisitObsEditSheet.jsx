// src/components/mobile/SiteVisitObsEditSheet.jsx
// Éditeur d'observation simplifié pour les visites de site.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './Icon';
import { compressImage } from '../../utils/imageCompressor';
import { useSpeechToText } from '../../hooks/useSpeechToText';

export default function SiteVisitObsEditSheet({ obs, onUpdate, onDelete, onClose, onViewImage, inline = false }) {
  const [text, setText] = useState(obs.text || '');
  const [images, setImages] = useState(obs.images || []);
  const fileRef = useRef(null);

  // ── Speech-to-text ──
  const { isListening, transcript, interimTranscript, isSupported: micSupported, error: micError, start: startMic, stop: stopMic } = useSpeechToText();

  // Quand la transcription finale arrive, l'ajouter au texte
  useEffect(() => {
    if (transcript) {
      setText(prev => {
        const separator = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
        return prev + separator + transcript;
      });
    }
  }, [transcript]);

  const toggleMic = useCallback(async () => {
    if (isListening) stopMic();
    else await startMic();
  }, [isListening, startMic, stopMic]);

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
    <div className={inline ? "flex flex-col h-full" : "fixed inset-0 z-50 flex flex-col bg-white"}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl shrink-0">
        <button onClick={onClose} className="text-[13px] font-medium text-gray-500">Annuler</button>
        <span className="text-[14px] font-bold text-gray-900">Observation</span>
        <button onClick={handleSave} className="text-[13px] font-bold text-blue-600">Enregistrer</button>
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

          {/* Indicateur d'écoute */}
          {isListening && (
            <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg bg-red-50 border border-red-200">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[13px] font-medium text-red-700">
                {interimTranscript ? interimTranscript + '…' : 'Parlez maintenant…'}
              </span>
            </div>
          )}

          {/* Erreur micro */}
          {micError && (
            <div className="px-3 py-2 mt-1 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
              {micError}
            </div>
          )}

          {/* Bouton dictée vocale */}
          {micSupported && (
            <button
              onClick={toggleMic}
              type="button"
              className={`flex items-center justify-center gap-2 w-full mt-2 py-3 rounded-xl text-[13px] font-semibold transition active:scale-[0.98] ${
                isListening
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-violet-50 border border-violet-200 text-violet-600'
              }`}
            >
              <Icon name={isListening ? 'stop' : 'mic'} size={16} color={isListening ? '#fff' : '#7c3aed'} />
              {isListening ? 'Arrêter la dictée' : 'Dictée vocale'}
            </button>
          )}

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
  );
}
