// src/components/mobile/ObservationEditSheet.jsx
//
// Bottom sheet pour éditer une observation CRC sur mobile.
// contentEditable pour le texte, capture caméra + galerie pour les images.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from './Icon';
import { compressImage } from '../../utils/imageCompressor';
import { useOrientation } from '../../hooks/useOrientation';
import { useSpeechToText } from '../../hooks/useSpeechToText';

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'empty',       label: 'Vide',     bg: 'bg-gray-500/20',   activeBg: 'bg-gray-500',   text: 'text-gray-600' },
  { value: 'open',        label: 'Ouvert',   bg: 'bg-orange-500/20',  activeBg: 'bg-orange-500',  text: 'text-orange-300' },
  { value: 'in_progress', label: 'En cours', bg: 'bg-blue-500/20',    activeBg: 'bg-blue-500',    text: 'text-blue-300' },
  { value: 'done',        label: 'FAIT',     bg: 'bg-emerald-500/20', activeBg: 'bg-emerald-500', text: 'text-emerald-300' },
];

// ─── FIELD WRAPPER ─────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const selectClass = 'w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-900 appearance-none';
const inputClass  = 'w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-900';

// ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────
export default function ObservationEditSheet({
  obs,
  participantGroups = [],
  onUpdate,
  onDelete,
  onClose,
  onViewImage,
}) {
  const { isLandscape } = useOrientation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const textRef = useRef(null);

  const images = obs?.images || [];

  // ── Speech-to-text ──
  const { isListening, transcript, interimTranscript, isSupported: micSupported, error: micError, start: startMic, stop: stopMic } = useSpeechToText();

  // Quand la transcription finale arrive, l'ajouter au texte
  useEffect(() => {
    if (transcript && textRef.current) {
      const current = textRef.current.innerHTML || '';
      const separator = current && !current.endsWith(' ') && !current.endsWith('<br>') ? ' ' : '';
      textRef.current.innerHTML = current + separator + transcript;
      if (onUpdate && obs) onUpdate(obs.id, { text: textRef.current.innerHTML });
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = useCallback(async () => {
    if (isListening) {
      stopMic();
    } else {
      await startMic();
    }
  }, [isListening, startMic, stopMic]);

  // ── Handlers ──
  const update = useCallback((patch) => {
    if (onUpdate && obs) onUpdate(obs.id, patch);
  }, [onUpdate, obs]);

  const handleImageFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const compressed = await Promise.all(fileList.map((f) => compressImage(f)));
    update({ images: [...images, ...compressed] });
  }, [images, update]);

  const handleRemoveImage = useCallback((idx) => {
    const next = images.filter((_, i) => i !== idx);
    update({ images: next });
  }, [images, update]);

  const handleTextBlur = useCallback(() => {
    if (textRef.current) {
      update({ text: textRef.current.innerHTML });
    }
  }, [update]);

  const handleDelete = useCallback(() => {
    if (onDelete && obs) {
      onDelete(obs.id);
      onClose();
    }
  }, [onDelete, obs, onClose]);

  // ── Group names for selects ──
  const groupNames = participantGroups.map((g) => g.name).filter(Boolean);

  if (!obs) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white border-t border-gray-200 rounded-t-3xl overflow-hidden animate-slideUp shadow-2xl ${isLandscape ? 'max-h-[95vh]' : 'max-h-[88vh]'}`}>

        {/* Handle + header */}
        <div className="flex flex-col items-center pt-3 pb-2 px-4 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 mb-3" />
          <div className="flex items-center justify-between w-full">
            <h3 className="text-sm font-bold text-gray-900">Modifier l'observation</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white">
              <Icon name="close" size={18} color="#94a3b8" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

          {/* Status pills */}
          <Field label="Statut">
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ status: s.value })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${
                    obs.status === s.value
                      ? `${s.activeBg} text-white shadow-lg`
                      : `${s.bg} ${s.text}`
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Emitter + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Émetteur">
              <select
                value={obs.emitter || ''}
                onChange={(e) => update({ emitter: e.target.value })}
                className={selectClass}
              >
                <option value="">—</option>
                {groupNames.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={obs.date || ''}
                onChange={(e) => update({ date: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Text (contentEditable) + Voice */}
          <Field label="Observation">
            <div
              ref={textRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleTextBlur}
              className="min-h-[100px] px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-900 leading-relaxed focus:outline-none focus:border-emerald-500/40"
              dangerouslySetInnerHTML={{ __html: obs.text || '' }}
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
                className={`flex items-center justify-center gap-2 w-full mt-2 py-3 rounded-xl text-xs font-semibold transition active:scale-[0.98] ${
                  isListening
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'bg-violet-50 border border-violet-200 text-violet-600'
                }`}
              >
                <Icon name={isListening ? 'stop' : 'mic'} size={16} color={isListening ? '#fff' : '#7c3aed'} />
                {isListening ? 'Arrêter la dictée' : 'Dictée vocale'}
              </button>
            )}
          </Field>

          {/* Action by + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Action par">
              <select
                value={obs.actionBy || ''}
                onChange={(e) => update({ actionBy: e.target.value })}
                className={selectClass}
              >
                <option value="">—</option>
                {groupNames.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Échéance">
              <input
                type="date"
                value={obs.actionDeadline || ''}
                onChange={(e) => update({ actionDeadline: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Images */}
          <Field label={`Photos (${images.length})`}>
            {/* Thumbnails grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {images.map((img, idx) => {
                  const imgSrc = typeof img === 'string' ? img : img.src;
                  return (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={imgSrc}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onClick={() => onViewImage?.(imgSrc)}
                        loading="lazy"
                      />
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center"
                      >
                        <Icon name="close" size={10} color="#fff" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Camera + Gallery buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold active:scale-[0.98] transition"
              >
                <Icon name="camera" size={16} color="#34d399" />
                Photo
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-semibold active:scale-[0.98] transition"
              >
                <Icon name="image" size={16} color="#60a5fa" />
                Galerie
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ''; }}
            />
          </Field>

          {/* Delete button */}
          <div className="pt-2 border-t border-white/[0.06]">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 text-xs font-semibold hover:bg-red-500/10 transition"
              >
                <Icon name="trash" size={14} color="#f87171" />
                Supprimer cette observation
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.04] text-gray-600 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-xs font-bold"
                >
                  Confirmer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animation keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </>
  );
}
