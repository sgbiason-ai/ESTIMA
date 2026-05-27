// src/components/crr/CrrObservations.jsx
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import ReactDOM from 'react-dom';
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  MinusCircle, Circle, Loader, CheckCircle2,
  ImagePlus, Camera, X, Bold, Underline, Highlighter, List, GripVertical,
  ArrowUp, ArrowDown, TextSelect,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { OBSERVATION_STATUSES, getGroupColor, abbreviateGroup } from '../../data/crrData';
import { confirm, toast } from '../../utils/globalUI';
import { normalizeObsText } from '../../utils/formatObsText.jsx';
import { uploadCrrImage, deleteCrrImage } from '../../utils/crrImageStorage';

// ── Pastille de groupe (partagee entre observations et participants) ─────────

const GroupBadge = memo(({ name, colorIndex, onRemove }) => {
  const c = getGroupColor(colorIndex);
  const abbr = abbreviateGroup(name);
  return (
    <span className={`inline-flex items-center rounded-full border font-bold leading-none whitespace-nowrap text-[9px] px-1.5 py-0.5 gap-1 ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {abbr}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 -mr-0.5">
          <X size={8} />
        </button>
      )}
    </span>
  );
});

// ── Selecteur multi-groupes avec pastilles (Emetteur / PAR) ─────────────────

const GroupPicker = ({ value, onChange, groups, placeholder, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, openUp: false });

  // value = "MOE, Entreprises" → Set {"MOE", "Entreprises"}
  const selected = new Set((value || '').split(',').map((s) => s.trim()).filter(Boolean));

  // Map nom groupe → index pour couleur stable
  const groupIndexMap = {};
  const validNames = new Set();
  groups.forEach((g, i) => { groupIndexMap[g.name] = i; validNames.add(g.name); });

  // Séparer pastilles valides et orphelines (groupe supprimé)
  const orphanNames = [...selected].filter((n) => !validNames.has(n));

  // Supprimer une pastille orpheline
  const removeOrphan = (name, e) => {
    e.stopPropagation();
    const next = new Set(selected);
    next.delete(name);
    onChange([...next].join(', '));
  };

  // Calculer la position du dropdown en fixed par rapport au bouton
  // Auto-flip vers le haut si pas assez d'espace en bas
  const openDropdown = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const ITEM_HEIGHT = 36; // px-3 py-2 text-xs ≈ 36px
      const PADDING = 8;      // py-1 container
      const estimatedHeight = groups.length * ITEM_HEIGHT + PADDING;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedHeight + 16 && rect.top > spaceBelow;
      setDropPos({
        top: openUp ? null : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : null,
        left: rect.left,
        openUp,
      });
    }
    setOpen((v) => !v);
  };

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (name) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next].join(', '));
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Zone cliquable : pastilles ou placeholder */}
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        className={`w-full min-h-[28px] flex flex-wrap items-center justify-center gap-1 px-1.5 py-0.5 border border-slate-200 rounded bg-slate-50 transition-all
          ${open ? 'ring-1 ring-emerald-400 border-emerald-400' : 'hover:border-slate-300'}`}
      >
        {selected.size > 0 ? (
          [...selected].map((name) => {
            const isOrphan = orphanNames.includes(name);
            return isOrphan ? (
              <span key={name} className="inline-flex items-center rounded-full border font-bold leading-none whitespace-nowrap text-[9px] px-1.5 py-0.5 gap-1 bg-red-50 text-red-400 border-red-200 line-through">
                {name}
                <button onClick={(e) => removeOrphan(name, e)} className="hover:text-red-600 -mr-0.5" title="Supprimer (groupe inexistant)">
                  <X size={8} />
                </button>
              </span>
            ) : (
              <GroupBadge key={name} name={name} colorIndex={groupIndexMap[name] ?? 0} />
            );
          })
        ) : (
          <span className="text-[10px] text-slate-400 w-full text-center">{placeholder}</span>
        )}
      </button>

      {/* Dropdown rendu en fixed pour échapper au overflow-hidden du parent */}
      {open && ReactDOM.createPortal(
        <div
          className="w-52 bg-white border border-slate-200 rounded-lg shadow-2xl py-1"
          style={{
            position: 'fixed',
            left: dropPos.left,
            zIndex: 99999,
            ...(dropPos.openUp
              ? { bottom: dropPos.bottom }
              : { top: dropPos.top }),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {groups.map((group, idx) => {
            const isSelected = selected.has(group.name);
            const c = getGroupColor(idx);
            return (
              <button
                key={group.id}
                onClick={() => toggle(group.name)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors
                  ${isSelected ? `${c.bg} font-semibold` : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[10px]
                  ${isSelected ? `${c.dot} border-transparent text-white` : 'border-slate-300'}`}>
                  {isSelected ? '✓' : ''}
                </span>
                <GroupBadge name={group.name} colorIndex={idx} />
                <span className="truncate text-slate-700">
                  {group.name}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

const StatusBadge = memo(({ status, onChange }) => {
  const cycle = () => {
    const states = ['empty', 'open', 'in_progress', 'done'];
    const idx = states.indexOf(status);
    onChange(states[(idx + 1) % states.length]);
  };

  const st = OBSERVATION_STATUSES.find((s) => s.value === status) || OBSERVATION_STATUSES[0];
  const icons = {
    minus: <MinusCircle size={12} />,
    circle: <Circle size={12} />,
    loader: <Loader size={12} className="animate-spin" />,
    check: <CheckCircle2 size={12} />,
  };

  return (
    <button
      onClick={cycle}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all hover:scale-105 ${st.bg} ${st.color} border border-current/20`}
      title={`Statut: ${st.label} — Cliquez pour changer`}
    >
      {icons[st.icon]}
      {st.label}
    </button>
  );
}, (prev, next) => prev.status === next.status && prev.onChange === next.onChange);

// ── Barre formatage + photo intégrée en haut du bloc en cours d'édition ────

const InlineToolbar = ({ onExecFormat, onHighlight, onSelectAll, fileRef, cameraRef }) => {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 bg-gradient-to-b from-blue-50 to-white border-b border-blue-200/60 rounded-t-lg"
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        // Empêche le doigt qui touche un bouton de faire perdre le focus à l'éditeur
        // (sans bloquer le clic lui-même)
        if (e.target.closest('button')) e.preventDefault();
      }}
    >
      <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-gray-200/60">
        <button type="button" onClick={() => onExecFormat('bold')} title="Gras (Ctrl+B)"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
          <Bold size={14} strokeWidth={2.5} />
        </button>
        <button type="button" onClick={() => onExecFormat('underline')} title="Souligné (Ctrl+U)"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
          <Underline size={14} strokeWidth={2.5} />
        </button>
        <button type="button" onClick={onHighlight} title="Fluo (Ctrl+H)"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-all">
          <Highlighter size={14} strokeWidth={2.5} />
        </button>
        <button type="button" onClick={() => onExecFormat('insertUnorderedList')} title="Liste à puces (Ctrl+L)"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
          <List size={14} strokeWidth={2.5} />
        </button>
        <button type="button" onClick={onSelectAll} title="Tout sélectionner (Ctrl+A)"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all">
          <TextSelect size={14} strokeWidth={2.5} />
        </button>
      </div>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-gray-200/60">
        <button type="button" onClick={() => fileRef.current?.click()} title="Ajouter une photo"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-emerald-600 transition-all flex items-center gap-1">
          <ImagePlus size={14} />
          <span className="text-[11px] font-medium hidden sm:inline">Photo</span>
        </button>
        <button type="button" onClick={() => cameraRef.current?.click()} title="Prendre une photo (tablette/mobile)"
          className="p-1.5 [@media(pointer:coarse)]:p-2.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-emerald-600 transition-all flex items-center gap-1">
          <Camera size={14} />
          <span className="text-[11px] font-medium hidden sm:inline">Caméra</span>
        </button>
      </div>
    </div>
  );
};

const ObservationRow = memo(({ obs, onUpdate, onDelete, meetingDate, participantGroups, dragHandleProps, companyId, crrId, isEditing, onEditorFocus, onEditorBlur }) => {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const editorRef = useRef(null);
  const lastHtmlRef = useRef('');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const normalized = normalizeObsText(obs.text);
    if (normalized !== lastHtmlRef.current) {
      lastHtmlRef.current = normalized;
      el.innerHTML = normalized;
    }
  }, [obs.text]);

  const handleEditorInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    if (html !== lastHtmlRef.current) {
      lastHtmlRef.current = html;
      onUpdate(obs.id, { text: html === '<br>' ? '' : html });
    }
  }, [obs.id, onUpdate]);

  const execFormat = useCallback((cmd, value) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? null);
    handleEditorInput();
  }, [handleEditorInput]);

  const handleHighlight = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const range = sel.getRangeAt(0);

    const unwrap = (markEl) => {
      const parent = markEl.parentNode;
      if (!parent) return;
      while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
      parent.removeChild(markEl);
    };

    const findMarkAncestor = (node) => {
      let n = node;
      while (n && n !== editor) {
        if (n.nodeType === 1 && n.tagName === 'MARK') return n;
        n = n.parentNode;
      }
      return null;
    };

    const anchorMark = findMarkAncestor(sel.anchorNode);
    const focusMark = findMarkAncestor(sel.focusNode);
    const intersecting = Array.from(editor.querySelectorAll('mark'))
      .filter((m) => range.intersectsNode(m));

    if (anchorMark || focusMark || intersecting.length > 0) {
      const toUnwrap = new Set(intersecting);
      if (anchorMark) toUnwrap.add(anchorMark);
      if (focusMark) toUnwrap.add(focusMark);
      toUnwrap.forEach(unwrap);
      handleEditorInput();
      return;
    }

    const mark = document.createElement('mark');
    mark.style.backgroundColor = '#fde68a';
    mark.style.borderRadius = '2px';
    mark.style.padding = '0 1px';
    try {
      range.surroundContents(mark);
    } catch {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
    handleEditorInput();
  }, [handleEditorInput]);

  const handleSelectAll = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === 'b') { e.preventDefault(); execFormat('bold'); }
      else if (e.key === 'u') { e.preventDefault(); execFormat('underline'); }
      else if (e.key === 'h') { e.preventDefault(); handleHighlight(); }
      else if (e.key === 'l') { e.preventDefault(); execFormat('insertUnorderedList'); }
    }
  }, [execFormat, handleHighlight]);

  const isCarried = obs.originMeetingNumber && obs.originMeetingNumber !== undefined;
  const images = obs.images || [];

  const handleAddImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!companyId || !crrId) {
      toast.error('Contexte CRC incomplet, impossible d\'uploader.');
      return;
    }
    try {
      const uploaded = await Promise.all(
        files.map((f) => uploadCrrImage(f, { companyId, crrId, obsId: obs.id }))
      );
      onUpdate(obs.id, { images: [...images, ...uploaded] });
    } catch (err) {
      console.error('[CRC] Upload photo echoue:', err);
      toast.error('Une photo n\'a pas pu etre uploadee. Reessayez.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const removeImage = (idx) => {
    const removed = images[idx];
    onUpdate(obs.id, { images: images.filter((_, i) => i !== idx) });
    deleteCrrImage(removed);
  };

  const handleFocus = useCallback(() => {
    onEditorFocus({ obsId: obs.id, editorRef, execFormat, handleHighlight, fileRef, cameraRef });
  }, [obs.id, onEditorFocus, execFormat, handleHighlight]);

  // Échéance dépassée : date d'action passée + statut différent de "done"
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isOverdue = obs.actionDeadline && obs.actionDeadline < todayISO && obs.status !== 'done';
  const daysLate = isOverdue
    ? Math.floor((Date.parse(todayISO) - Date.parse(obs.actionDeadline)) / 86400000)
    : 0;

  return (
    <div
      className={`border rounded-lg transition-all overflow-hidden ${
        isEditing
          ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/20'
          : obs.status === 'done'
          ? 'border-emerald-200 bg-emerald-50/30 opacity-75'
          : obs.status === 'in_progress'
          ? 'border-blue-200 bg-blue-50/30'
          : 'border-slate-200 bg-white'
      }`}
    >
      {isEditing && (
        <InlineToolbar
          onExecFormat={execFormat}
          onHighlight={handleHighlight}
          onSelectAll={handleSelectAll}
          fileRef={fileRef}
          cameraRef={cameraRef}
        />
      )}
      <div className="px-3 py-2">
        <div className="grid grid-cols-[24px_48px_100px_1fr_72px_48px_100px_24px] xl:grid-cols-[30px_80px_120px_1fr_86px_80px_120px_30px] gap-x-2 items-center">
          {/* Col 1 — Drag */}
          {dragHandleProps ? (
            <div {...dragHandleProps} className="flex items-center justify-center cursor-grab active:cursor-grabbing" title="Glisser pour réordonner">
              <GripVertical size={14} className="text-gray-300 hover:text-gray-500 transition-colors" />
            </div>
          ) : <span />}

          {/* Col 2 — Emetteur */}
          <GroupPicker
            value={obs.emitter}
            onChange={(name) => onUpdate(obs.id, { emitter: name })}
            groups={participantGroups}
            placeholder="Em."
          />

          {/* Col 3 — Date obs */}
          <div className="flex items-center gap-0.5">
            <input
              type="date"
              value={obs.date}
              onChange={(e) => onUpdate(obs.id, { date: e.target.value })}
              className={`w-full text-[11px] px-1 xl:px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 ${obs.date ? 'text-slate-800' : 'text-slate-300'}`}
            />
            {obs.date && (
              <button onClick={() => onUpdate(obs.id, { date: '' })} className="p-0.5 text-slate-300 hover:text-red-400 transition-colors" title="Effacer la date">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Col 4 — Texte observation */}
          <div className="flex flex-col gap-1 min-w-0">
            <div
              ref={(el) => {
                editorRef.current = el;
                if (el && !el.hasAttribute('data-init')) {
                  el.setAttribute('data-init', '1');
                  el.innerHTML = normalizeObsText(obs.text);
                  lastHtmlRef.current = el.innerHTML;
                }
              }}
              contentEditable
              onInput={handleEditorInput}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={onEditorBlur}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              spellCheck
              lang="fr"
              data-placeholder="Observation..."
              className="w-full text-xs [@media(pointer:coarse)]:text-[15px] [@media(pointer:coarse)]:leading-relaxed px-2 py-1 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 min-h-[28px] [@media(pointer:coarse)]:min-h-[44px] text-slate-800 whitespace-pre-wrap select-text empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300"
              style={{
                outline: 'none',
                WebkitUserSelect: 'text',
                userSelect: 'text',
                WebkitTouchCallout: 'default',
                WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.15)',
              }}
            />

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, idx) => {
                  const imgSrc = typeof img === 'string' ? img : img.src;
                  const lat = typeof img === 'object' ? img.lat : null;
                  const lng = typeof img === 'object' ? img.lng : null;
                  const hasGps = lat != null && lng != null;
                  return (
                    <div key={idx} className="relative group flex flex-col items-center">
                      <div className="w-16 h-16 rounded border border-gray-200 overflow-hidden bg-gray-100">
                        <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      {hasGps && (
                        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[9px] italic text-blue-500 hover:text-blue-700 hover:underline mt-0.5"
                          title={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}>
                          Localisation
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddImages} />
          </div>

          {/* Col 5 — Statut */}
          <StatusBadge
            status={obs.status}
            onChange={(s) => onUpdate(obs.id, { status: s })}
          />

          {/* Col 6 — PAR */}
          <GroupPicker
            value={obs.actionBy}
            onChange={(name) => onUpdate(obs.id, { actionBy: name })}
            groups={participantGroups}
            placeholder="PAR"
          />

          {/* Col 7 — Date action */}
          <div className="flex items-center gap-0.5">
            <input
              type="date"
              value={obs.actionDeadline || ''}
              onChange={(e) => onUpdate(obs.id, { actionDeadline: e.target.value })}
              className={`w-full text-[11px] px-1 xl:px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                isOverdue
                  ? 'text-red-700 bg-red-50 border-red-300 font-semibold'
                  : obs.actionDeadline
                  ? 'text-slate-800 border-slate-200'
                  : 'text-slate-300 border-slate-200'
              }`}
              title={isOverdue ? `En retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}` : 'Pour le'}
            />
            {obs.actionDeadline && (
              <button onClick={() => onUpdate(obs.id, { actionDeadline: '' })} className="p-0.5 text-slate-300 hover:text-red-400 transition-colors" title="Effacer la date">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Col 8 — Supprimer */}
          <button
            onClick={async () => {
              const ok = await confirm('Supprimer cette observation ?', { danger: true });
              if (ok) onDelete(obs.id);
            }}
            className="p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-all flex items-center justify-center"
            title="Supprimer"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {isCarried && (
          <div className="mt-1 text-[10px] text-slate-400 italic" style={{ marginLeft: 'calc(24px + 56px + 120px + 1rem)' }}>
            Report du CR n°{obs.originMeetingNumber}
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.obs === next.obs
    && prev.meetingDate === next.meetingDate
    && prev.participantGroups === next.participantGroups
    && prev.dragHandleProps === next.dragHandleProps
    && prev.companyId === next.companyId
    && prev.crrId === next.crrId
    && prev.isEditing === next.isEditing;
});

const CrrObservations = ({
  meeting,
  categories,
  observationsByCategory,
  addObservation,
  updateObservation,
  deleteObservation,
  reorderObservations,
  legalText,
  participantGroups = [],
  companyId,
  crrId,
  sortDate,
  sortCat,
  onCycleDateSort,
  onCycleCatSort,
}) => {
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [activeEdit, setActiveEdit] = useState(null);
  const blurTimeoutRef = useRef(null);

  const sortedCategories = sortCat
    ? [...categories].sort((a, b) => sortCat === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    : categories;

  const sortObsForCat = (obs) => {
    if (!sortDate) return obs;
    return [...obs].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return sortDate === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });
  };

  const toggleCat = (cat) => {
    const s = new Set(collapsedCats);
    if (s.has(cat)) s.delete(cat);
    else s.add(cat);
    setCollapsedCats(s);
  };

  const handleEditorFocus = useCallback((info) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setActiveEdit(info);
  }, []);

  const handleEditorBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setActiveEdit(null);
      blurTimeoutRef.current = null;
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleDragEnd = useCallback((result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    reorderObservations?.(draggableId, destination.droppableId, destination.index);
  }, [reorderObservations]);

  if (!meeting) return null;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
    <div className="space-y-3">
      {/* Texte legal */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-[11px] text-amber-800 leading-relaxed italic">
          {legalText}
        </p>
      </div>

      {/* En-tete tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-0 z-30">
        <div className="grid grid-cols-[24px_48px_100px_1fr_72px_48px_100px_24px] xl:grid-cols-[30px_80px_120px_1fr_86px_80px_120px_30px] gap-x-2 items-center px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          <span />
          <span className="text-center">Emet.</span>
          <button onClick={onCycleDateSort} className={`flex items-center justify-center gap-0.5 hover:text-blue-600 transition-colors ${sortDate ? 'text-blue-600' : ''}`} title="Trier par date">
            Date
            {sortDate === 'asc' && <ArrowUp size={10} />}
            {sortDate === 'desc' && <ArrowDown size={10} />}
          </button>
          <button onClick={onCycleCatSort} className={`flex items-center gap-0.5 hover:text-blue-600 transition-colors ${sortCat ? 'text-blue-600' : ''}`} title="Trier par chapitre">
            Observations
            {sortCat === 'asc' && <ArrowUp size={10} />}
            {sortCat === 'desc' && <ArrowDown size={10} />}
          </button>
          <span className="text-center">Statut</span>
          <span className="text-center">Par</span>
          <span className="text-center">Pour le</span>
          <span />
        </div>
      </div>

      {/* Categories */}
      {sortedCategories.map((cat) => {
        const obs = sortObsForCat(observationsByCategory[cat] || []);
        const isCollapsed = collapsedCats.has(cat);

        return (
          <div key={cat} className="space-y-1.5">
            <div
              className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl px-4 py-2.5 cursor-pointer hover:from-blue-100/80 hover:to-indigo-100/80 transition-all"
              onClick={() => toggleCat(cat)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-blue-600" />
                ) : (
                  <ChevronDown size={14} className="text-blue-600" />
                )}
                <span className="text-sm font-bold text-gray-900">{cat}</span>
                <span className="text-[10px] text-gray-400">
                  ({obs.length} observation{obs.length !== 1 ? 's' : ''})
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addObservation(cat);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200/80 transition-all font-medium"
              >
                <Plus size={10} />
                Ajouter
              </button>
            </div>

            {!isCollapsed && (
              <Droppable droppableId={cat}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-1.5 pl-2 min-h-[40px] rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/50' : ''}`}
                  >
                    {obs.length === 0 && (
                      <div className="text-center text-gray-400 text-xs py-4 italic">
                        Aucune observation — glissez-en une ici ou cliquez Ajouter
                      </div>
                    )}
                    {obs.map((ob, idx) => (
                      <Draggable key={ob.id} draggableId={ob.id} index={idx}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            className={`${snap.isDragging ? 'shadow-lg ring-2 ring-blue-300 rounded-lg' : ''}`}
                          >
                            <ObservationRow
                              obs={ob}
                              onUpdate={updateObservation}
                              onDelete={deleteObservation}
                              meetingDate={meeting.date}
                              participantGroups={participantGroups}
                              dragHandleProps={prov.dragHandleProps}
                              companyId={companyId}
                              crrId={crrId}
                              isEditing={activeEdit?.obsId === ob.id}
                              onEditorFocus={handleEditorFocus}
                              onEditorBlur={handleEditorBlur}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        );
      })}
    </div>

    </DragDropContext>
  );
};

export default CrrObservations;
