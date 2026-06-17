// src/components/mobile/ObservationEditSheet.jsx
//
// Bottom sheet pour éditer une observation CRC sur mobile.
// contentEditable pour le texte, capture caméra + galerie pour les images.

import React, { useState, useRef, useCallback } from 'react';
import Icon from './Icon';
import { uploadCrrImage, deleteCrrImage } from '../../utils/crrImageStorage';
import { useOrientation } from '../../hooks/useOrientation';
import { sanitizeHtml } from '../../utils/helpers';
import { stripHtml } from '../../utils/formatObsText';
import { toast } from '../../utils/globalUI';
import { getGroupColor, obsValidation } from '../../data/crrData';
import { detectTextIssues } from '../../utils/crrTextQa';

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'empty',       label: 'Vide',     bg: 'bg-gray-500/20',   activeBg: 'bg-gray-500',   text: 'text-gray-600' },
  { value: 'open',        label: 'Ouvert',   bg: 'bg-orange-500/20',  activeBg: 'bg-orange-500',  text: 'text-orange-500' },
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
  groupColorMap = {},
  onUpdate,
  onDelete,
  onClose,
  onViewImage,
  companyId,
  crrId,
}) {
  useOrientation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const textRef = useRef(null);

  const images = obs?.images || [];

  // ── Handlers ──
  const update = useCallback((patch) => {
    if (onUpdate && obs) onUpdate(obs.id, patch);
  }, [onUpdate, obs]);

  const handleImageFiles = useCallback(async (files, { withGps = true } = {}) => {
    if (!files || files.length === 0) return;
    if (!companyId || !crrId || !obs?.id) {
      toast.error('Contexte CRC incomplet, impossible d\'uploader.');
      return;
    }
    const fileList = Array.from(files);
    try {
      const uploaded = await Promise.all(
        fileList.map((f) => uploadCrrImage(f, { companyId, crrId, obsId: obs.id, withGps }))
      );
      update({ images: [...images, ...uploaded] });
    } catch (err) {
      console.error('[CRC] Upload photo echoue:', err);
      toast.error('Une photo n\'a pas pu etre uploadee. Reessayez.');
    }
  }, [images, update, companyId, crrId, obs?.id]);

  const handleRemoveImage = useCallback((idx) => {
    const removed = images[idx];
    const next = images.filter((_, i) => i !== idx);
    update({ images: next });
    deleteCrrImage(removed);
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

  const handleValidate = useCallback(() => {
    if (textRef.current) {
      update({ text: textRef.current.innerHTML });
    }
    onClose();
  }, [update, onClose]);

  // ── Group names for selects ──
  const groupNames = participantGroups.map((g) => g.name).filter(Boolean);

  if (!obs) return null;

  // Champs requis manquants (obs Ouverte/En cours) → signalement rouge.
  const { missingResponsable, missingEcheance } = obsValidation(obs);
  // Anomalies de saisie (fautes connues + heuristiques) — suggestion de relecture.
  const textIssues = detectTextIssues(stripHtml(obs.text));

  return (
    <>
      {/* Plein écran */}
      <div className="fixed inset-0 z-50 flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl">
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <Icon name="close" size={18} color="#6b7280" />
          </button>
          <h3 className="text-sm font-bold text-gray-900">Modifier l'observation</h3>
          <div className="w-8" />
        </div>

        {/* Content — flex col pour maximiser la zone texte */}
        <div className="flex-1 flex flex-col overflow-hidden px-4">

          {/* Compact top row: status + emitter + date */}
          <div className="flex items-end gap-2 py-2 shrink-0">
            <div className="flex gap-1 flex-1">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ status: s.value })}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center transition-all ${
                    obs.status === s.value
                      ? `${s.activeBg} text-white shadow-sm`
                      : `${s.bg} ${s.text}`
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pb-2 shrink-0">
            <ColoredSelect value={obs.emitter || ''} onChange={(v) => update({ emitter: v })} placeholder="Émetteur…" options={groupNames} groupColorMap={groupColorMap} />
            <input type="date" value={obs.date || ''} onChange={(e) => update({ date: e.target.value })} className={`${inputClass} text-xs py-2`} />
          </div>

          {/* Toolbar formatage */}
          <FormatToolbar textRef={textRef} onInput={handleTextBlur} />

          {/* Zone texte — prend tout l'espace restant */}
          <div
            ref={textRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleTextBlur}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
                else if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
                else if (e.key === 'l') { e.preventDefault(); document.execCommand('insertUnorderedList'); }
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
            className="flex-1 overflow-y-auto px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 [&_mark]:bg-amber-200 [&_mark]:rounded-sm [&_mark]:px-0.5"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(obs.text || '') }}
          />

          {/* Bas de page scrollable sous la zone texte */}
          <div className="shrink-0 space-y-3 pt-3">
            {/* Action par + Échéance */}
            <div className="grid grid-cols-2 gap-2">
              <ColoredSelect value={obs.actionBy || ''} onChange={(v) => update({ actionBy: v })} placeholder="Action par…" options={groupNames} groupColorMap={groupColorMap} invalid={missingResponsable} />
              <input type="date" value={obs.actionDeadline || ''} onChange={(e) => update({ actionDeadline: e.target.value })} className={`${inputClass} text-xs py-2 ${missingEcheance ? 'border-red-300 bg-red-50 text-red-600' : ''}`} placeholder="Échéance" />
            </div>
            {(missingResponsable || missingEcheance) && (
              <p className="text-[11px] text-red-600 font-semibold -mt-1.5">
                {missingResponsable && missingEcheance
                  ? 'Responsable et échéance requis (observation ouverte / en cours)'
                  : missingResponsable ? 'Responsable requis' : 'Échéance requise'}
              </p>
            )}
            {textIssues.length > 0 && (
              <p className="text-[11px] text-slate-500 -mt-1">
                Relecture : {textIssues.slice(0, 2).map((i) => i.message).join('  ·  ')}{textIssues.length > 2 ? `  ·  +${textIssues.length - 2}` : ''}
              </p>
            )}

            {/* Photos — compact row */}
            <div className="flex items-center gap-2">
              {images.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                  {images.map((img, idx) => {
                    const imgSrc = typeof img === 'string' ? img : img.src;
                    return (
                      <div key={idx} className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                        <img src={imgSrc} alt="" className="w-full h-full object-cover" onClick={() => onViewImage?.(imgSrc)} loading="lazy" />
                        <button onClick={() => handleRemoveImage(idx)} className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <Icon name="close" size={8} color="#fff" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={() => cameraRef.current?.click()} className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 active:scale-95 transition">
                <Icon name="camera" size={16} color="#3b82f6" />
              </button>
              <button onClick={() => galleryRef.current?.click()} className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 active:scale-95 transition">
                <Icon name="image" size={16} color="#60a5fa" />
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleImageFiles(e.target.files, { withGps: true }); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleImageFiles(e.target.files, { withGps: false }); e.target.value = ''; }} />
          </div>
        </div>

        {/* Footer : Supprimer + Valider */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-white">
          {!showDeleteConfirm ? (
            <>
              <button onClick={() => setShowDeleteConfirm(true)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 border border-red-200 active:bg-red-100 transition">
                <Icon name="trash" size={16} color="#ef4444" />
              </button>
              <button onClick={handleValidate} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm active:scale-[0.98] transition">
                Valider
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold active:bg-gray-200 transition">
                Annuler
              </button>
              <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-xs font-bold active:bg-red-600 transition">
                Supprimer
              </button>
            </>
          )}
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

// ─── TOOLBAR FORMATAGE ────────────────────────────────────────────────────

function ColoredSelect({ value, onChange, placeholder, options, groupColorMap, invalid = false }) {
  const colorIdx = groupColorMap[value];
  const c = colorIdx != null ? getGroupColor(colorIdx) : null;
  return (
    <div className="relative">
      {c && (
        <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${c.dot}`} />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectClass} text-xs py-2 ${c ? `pl-7 ${c.border} ${c.bg}` : ''} ${invalid ? 'border-red-300 bg-red-50' : ''}`}
      >
        <option value="">{placeholder}</option>
        {options.map((g) => (<option key={g} value={g}>{g}</option>))}
      </select>
    </div>
  );
}

function FormatToolbar({ textRef, onInput }) {
  const exec = (cmd) => {
    textRef.current?.focus();
    document.execCommand(cmd, false, null);
    onInput?.();
  };

  const handleHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const editor = textRef.current;
    if (!editor) return;
    editor.focus();
    const range = sel.getRangeAt(0);

    const findMark = (node) => {
      let n = node;
      while (n && n !== editor) {
        if (n.nodeType === 1 && n.tagName === 'MARK') return n;
        n = n.parentNode;
      }
      return null;
    };

    const marks = Array.from(editor.querySelectorAll('mark')).filter(m => range.intersectsNode(m));
    const anchorMark = findMark(sel.anchorNode);
    const focusMark = findMark(sel.focusNode);

    if (anchorMark || focusMark || marks.length > 0) {
      const toUnwrap = new Set([...marks, anchorMark, focusMark].filter(Boolean));
      toUnwrap.forEach(m => {
        const p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
      });
      onInput?.();
      return;
    }

    const mark = document.createElement('mark');
    mark.style.backgroundColor = '#fde68a';
    mark.style.borderRadius = '2px';
    mark.style.padding = '0 1px';
    try { range.surroundContents(mark); } catch { mark.appendChild(range.extractContents()); range.insertNode(mark); }
    onInput?.();
  };

  const btnClass = 'w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 active:bg-white active:shadow-sm active:text-gray-900 transition-all';

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1 mb-1.5">
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} className={btnClass} title="Gras">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
      </button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} className={btnClass} title="Souligné">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
      </button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={handleHighlight} className={btnClass} title="Surligner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} className={btnClass} title="Liste à puces">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
    </div>
  );
}
