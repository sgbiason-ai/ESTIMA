// src/components/crr/CrrObservations.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  MinusCircle, Circle, Loader, CheckCircle2, Calendar, User, MessageSquare,
  ImagePlus, X, Bold, Underline, Highlighter, GripVertical,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { OBSERVATION_STATUSES, getGroupColor, abbreviateGroup } from '../../data/crrData';
import { confirm } from '../../utils/globalUI';
import { normalizeObsText } from '../../utils/formatObsText.jsx';

// ── Pastille de groupe (partagee entre observations et participants) ─────────

const GroupBadge = ({ name, colorIndex, onRemove }) => {
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
};

// ── Selecteur multi-groupes avec pastilles (Emetteur / PAR) ─────────────────

const GroupPicker = ({ value, onChange, groups, placeholder, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // value = "MOE, Entreprises" → Set {"MOE", "Entreprises"}
  const selected = new Set((value || '').split(',').map((s) => s.trim()).filter(Boolean));

  // Map nom groupe → index pour couleur stable
  const groupIndexMap = {};
  groups.forEach((g, i) => { groupIndexMap[g.name] = i; });

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full min-h-[28px] flex flex-wrap items-center gap-1 px-1.5 py-0.5 border border-slate-200 rounded bg-slate-50 transition-all
          ${open ? 'ring-1 ring-emerald-400 border-emerald-400' : 'hover:border-slate-300'}`}
      >
        {selected.size > 0 ? (
          [...selected].map((name) => (
            <GroupBadge key={name} name={name} colorIndex={groupIndexMap[name] ?? 0} />
          ))
        ) : (
          <span className="text-[10px] text-slate-400 w-full text-center">{placeholder}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-xl py-1">
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
        </div>
      )}
    </div>
  );
};

import { compressImage } from '../../utils/imageCompressor';

const StatusBadge = ({ status, onChange }) => {
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
};

const ObservationRow = ({ obs, onUpdate, onDelete, meetingDate, participantGroups, dragHandleProps }) => {
  const [expanded, setExpanded] = useState(true);
  const fileRef = useRef(null);
  const editorRef = useRef(null);
  const lastHtmlRef = useRef('');

  // Synchroniser le contenu HTML quand obs.text change (ex: undo externe)
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
    // Eviter les boucles : ne mettre a jour que si le contenu a change
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
    editorRef.current?.focus();
    // Verifier si deja surligne pour toggle
    const parent = sel.anchorNode?.parentElement;
    if (parent?.tagName === 'MARK') {
      // Retirer le surlignage
      const text = document.createTextNode(parent.textContent);
      parent.replaceWith(text);
    } else {
      const range = sel.getRangeAt(0);
      const mark = document.createElement('mark');
      mark.style.backgroundColor = '#fde68a';
      mark.style.borderRadius = '2px';
      mark.style.padding = '0 1px';
      range.surroundContents(mark);
    }
    handleEditorInput();
  }, [handleEditorInput]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === 'b') { e.preventDefault(); execFormat('bold'); }
      else if (e.key === 'u') { e.preventDefault(); execFormat('underline'); }
      else if (e.key === 'h') { e.preventDefault(); handleHighlight(); }
    }
  }, [execFormat, handleHighlight]);

  const isCarried = obs.originMeetingNumber && obs.originMeetingNumber !== undefined;
  const images = obs.images || [];

  const handleAddImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    onUpdate(obs.id, { images: [...images, ...compressed] });
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (idx) => {
    onUpdate(obs.id, { images: images.filter((_, i) => i !== idx) });
  };

  return (
    <div
      className={`border rounded-lg transition-all ${
        obs.status === 'done'
          ? 'border-emerald-200 bg-emerald-50/30 opacity-75'
          : obs.status === 'in_progress'
          ? 'border-blue-200 bg-blue-50/30'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="px-3 py-2">
        {/* Ligne principale */}
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          {dragHandleProps && (
            <div {...dragHandleProps} className="flex items-center pt-1.5 cursor-grab active:cursor-grabbing shrink-0" title="Glisser pour réordonner">
              <GripVertical size={14} className="text-gray-300 hover:text-gray-500 transition-colors" />
            </div>
          )}
          {/* Emetteur */}
          <GroupPicker
            value={obs.emitter}
            onChange={(name) => onUpdate(obs.id, { emitter: name })}
            groups={participantGroups}
            placeholder="Emetteur"
            className="w-24 shrink-0"
          />

          {/* Date */}
          <input
            type="date"
            value={obs.date}
            onChange={(e) => onUpdate(obs.id, { date: e.target.value })}
            className="w-32 shrink-0 text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-800"
          />

          {/* Texte observation + images */}
          <div className="flex-1 flex flex-col gap-1">
            {/* Mini-toolbar formatage */}
            <div className="flex items-center gap-0.5">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat('bold')} title="Gras (Ctrl+B)"
                className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <Bold size={13} strokeWidth={2.5} />
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat('underline')} title="Souligné (Ctrl+U)"
                className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <Underline size={13} strokeWidth={2.5} />
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleHighlight} title="Fluo (Ctrl+H)"
                className="p-0.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition-colors">
                <Highlighter size={13} strokeWidth={2.5} />
              </button>
            </div>
            {/* Editeur WYSIWYG */}
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
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              spellCheck
              lang="fr"
              data-placeholder="Observation..."
              className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 min-h-[28px] text-slate-800 whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300"
              style={{ outline: 'none' }}
            />

            {/* Miniatures images */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {images.map((src, idx) => (
                  <div key={idx} className="relative group w-16 h-16 rounded border border-slate-200 overflow-hidden bg-slate-100">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bouton ajout image */}
            <button
              onClick={() => fileRef.current?.click()}
              className="self-start flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-600 transition-colors"
            >
              <ImagePlus size={12} />
              Photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddImages}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0 items-end">
            <StatusBadge
              status={obs.status}
              onChange={(s) => onUpdate(obs.id, { status: s })}
            />
            <div className="flex items-center gap-1">
              <GroupPicker
                value={obs.actionBy}
                onChange={(name) => onUpdate(obs.id, { actionBy: name })}
                groups={participantGroups}
                placeholder="PAR"
                className="w-28"
              />
              <input
                type="date"
                value={obs.actionDeadline || ''}
                onChange={(e) =>
                  onUpdate(obs.id, { actionDeadline: e.target.value })
                }
                className="w-32 text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-800"
                title="Pour le"
              />
            </div>
          </div>

          {/* Supprimer */}
          <button
            onClick={async () => {
              const ok = await confirm('Supprimer cette observation ?', { danger: true });
              if (ok) onDelete(obs.id);
            }}
            className="p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-all shrink-0"
            title="Supprimer"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Indicateur report */}
        {isCarried && (
          <div className="mt-1 ml-[6.5rem] text-[10px] text-slate-400 italic">
            Report du CR n°{obs.originMeetingNumber}
          </div>
        )}
      </div>
    </div>
  );
};

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
}) => {
  const [collapsedCats, setCollapsedCats] = useState(new Set());

  const toggleCat = (cat) => {
    const s = new Set(collapsedCats);
    if (s.has(cat)) s.delete(cat);
    else s.add(cat);
    setCollapsedCats(s);
  };

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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[30px_100px_120px_1fr_280px_30px] gap-1 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          <span />
          <span>Emetteur</span>
          <span>Date</span>
          <span>Observations</span>
          <span className="text-center">Actions (Par / Pour le)</span>
          <span />
        </div>
      </div>

      {/* Categories */}
      {categories.map((cat) => {
        const obs = observationsByCategory[cat] || [];
        const isCollapsed = collapsedCats.has(cat);

        return (
          <div key={cat} className="space-y-1.5">
            {/* Bandeau categorie */}
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

            {/* Observations — Droppable zone */}
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
