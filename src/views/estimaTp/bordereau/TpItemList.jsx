// src/views/estimaTp/bordereau/TpItemList.jsx
// Renderer récursif du bordereau TP (forme ESTIMA) : articles + sous-chapitres
// imbriqués, glisser-déposer, repli. Aucune notion MOE (BPU/PSE/tranches/% client).
import React, { useState, useEffect, memo } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, ChevronDown, ChevronRight, Plus, FolderPlus, Layers } from 'lucide-react';
import { useTpBordereau } from './TpBordereauContext';
import TpFormulaCell from './TpFormulaCell';
import { nodeTotal, countItems } from './tpBordereauModel';

const fmt = (n) => `${Math.round(Number(n || 0)).toLocaleString('fr-FR')} €`;

// Petit champ éditable (commit au blur) — désignation, unité, titre.
function InlineInput({ value, onCommit, className, placeholder, upper = false, stopProps = true }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const stop = stopProps ? (e) => e.stopPropagation() : undefined;
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(upper ? e.target.value.toUpperCase() : e.target.value)}
      onBlur={() => { if (v !== (value ?? '')) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onClick={stop}
      onMouseDown={stop}
      className={className}
    />
  );
}

// ─── Ligne ARTICLE ────────────────────────────────────────────────────────────
const ItemRow = memo(function ItemRow({ el, index, level }) {
  const { refMap, selectedId, setSelectedId, onUpdateNode, onRemoveNode, formulaMode, readOnly, onOpenSousDetail } = useTpBordereau();
  const selected = selectedId === el.id;
  const total = Number(el.qty || 0) * Number(el.price || 0);
  const isPM = total === 0;
  const formActive = formulaMode?.activeId && formulaMode.activeId !== el.id;

  return (
    <Draggable draggableId={`node:${el.id}`} index={index} isDragDisabled={readOnly}>
      {(p, snap) => (
        <div
          ref={p.innerRef}
          {...p.draggableProps}
          id={`tp-item-${el.id}`}
          onClick={(e) => { if (formActive) return; e.stopPropagation(); setSelectedId(el.id); }}
          onMouseDown={(e) => {
            if (formActive && formulaMode.onInsert) { e.preventDefault(); e.stopPropagation(); formulaMode.onInsert(el.id); }
          }}
          className={`group flex items-center border-b border-slate-100 py-1 transition-colors
            ${selected ? 'bg-orange-50 ring-1 ring-inset ring-orange-200' : 'bg-white'}
            ${el.formula?.startsWith('=') && !selected ? 'bg-emerald-50/30' : ''}
            ${formActive ? 'cursor-crosshair hover:bg-amber-50 hover:ring-1 hover:ring-inset hover:ring-amber-300' : 'hover:bg-orange-50/50'}
            ${snap.isDragging ? 'shadow-lg z-50 rotate-1' : ''}`}
        >
          <div {...p.dragHandleProps} className={`w-7 flex justify-center shrink-0 ${readOnly ? 'opacity-0' : 'text-slate-300 hover:text-orange-500 cursor-grab active:cursor-grabbing'}`}>
            {!readOnly && <GripVertical size={14} />}
          </div>
          <div className="w-16 text-center shrink-0">
            <span
              onDoubleClick={(e) => {
                if (formActive || !onOpenSousDetail) return;
                e.stopPropagation();
                onOpenSousDetail(el.id);
              }}
              title={onOpenSousDetail ? 'Double-cliquer pour ouvrir le sous-détail de prix' : undefined}
              className={`text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-1.5 rounded select-none ${onOpenSousDetail && !formActive ? 'cursor-pointer hover:bg-orange-200 hover:ring-1 hover:ring-orange-300' : ''}`}
            >
              {refMap.get(el.id) || '—'}
            </span>
          </div>
          <div className="flex-1 px-2 min-w-0" style={{ paddingLeft: `${level * 18 + 8}px` }}>
            <InlineInput
              value={el.designation}
              onCommit={(val) => onUpdateNode(el.id, { designation: val })}
              placeholder="Désignation de l'article"
              className="w-full text-[11px] font-semibold text-slate-800 uppercase bg-transparent border border-transparent hover:border-slate-200 focus:border-orange-400 focus:bg-white rounded px-1.5 py-0.5 outline-none placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
          <div className="w-16 flex justify-center shrink-0 px-1">
            <InlineInput
              value={el.unit}
              upper
              onCommit={(val) => onUpdateNode(el.id, { unit: val.trim() })}
              placeholder="U"
              className="w-full text-center text-[9px] font-bold text-slate-600 uppercase bg-slate-50 border border-slate-200 focus:border-orange-400 focus:bg-white rounded px-1 py-0.5 outline-none"
            />
          </div>
          <div className="w-24 px-2 shrink-0"><TpFormulaCell el={el} /></div>
          <div className="w-28 px-2 shrink-0">
            {el.detail ? (
              <div className="relative flex items-center" title="PU piloté par le sous-détail de prix">
                <span className="w-full text-right text-xs font-mono font-bold text-orange-700 pr-4 truncate">
                  {Number(el.price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 text-[7px] font-black text-orange-400" title="Sous-détail">SD</span>
                <span className="absolute right-1.5 text-[10px] text-orange-300 font-black pointer-events-none">€</span>
              </div>
            ) : (
              <div className="relative flex items-center">
                <InlineInput
                  value={el.price === 0 ? '' : el.price}
                  onCommit={(val) => onUpdateNode(el.id, { price: Number(String(val).replace(',', '.')) || 0 })}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded py-0.5 px-1 pr-4 text-right text-xs font-mono font-bold text-slate-800 outline-none"
                />
                <span className="absolute right-1.5 text-[10px] text-slate-300 font-black pointer-events-none">€</span>
              </div>
            )}
          </div>
          <div className="w-28 text-right px-3 shrink-0">
            <span className={`text-[11px] font-mono font-black ${isPM ? 'italic text-slate-400 font-medium' : 'text-slate-900'}`}>
              {isPM ? 'PM' : fmt(total)}
            </span>
          </div>
          <div className="w-8 flex justify-center shrink-0">
            {!readOnly && (
              <button onClick={(e) => { e.stopPropagation(); onRemoveNode(el.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="Supprimer l'article">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
});

// ─── Ligne SOUS-CHAPITRE ──────────────────────────────────────────────────────
const DEPTH_BG = ['bg-slate-200/70 border-slate-300', 'bg-slate-100 border-slate-200', 'bg-slate-50 border-slate-200'];

const SubChapterRow = memo(function SubChapterRow({ el, index, level }) {
  const { refMap, selectedId, setSelectedId, onUpdateNode, onRemoveNode, onAddItem, onAddSub, collapsed, toggleCollapsed, readOnly } = useTpBordereau();
  const selected = selectedId === el.id;
  const isCollapsed = collapsed.has(el.id);
  const depthBg = DEPTH_BG[Math.min(level, DEPTH_BG.length - 1)];
  const total = nodeTotal(el);
  const nb = isCollapsed ? countItems(el.children) : 0;

  return (
    <Draggable draggableId={`node:${el.id}`} index={index} isDragDisabled={readOnly}>
      {(p, snap) => (
        <div
          ref={p.innerRef}
          {...p.draggableProps}
          data-subchapter-id={String(el.id)}
          className={`flex flex-col border rounded-lg my-2 overflow-hidden transition-all ${snap.isDragging ? 'shadow-xl bg-white z-50' : ''} ${depthBg}`}
        >
          <Droppable droppableId={String(el.id)} type="ITEM" isDropDisabled={readOnly}>
            {(drop, dropSnap) => (
              <div ref={drop.innerRef} {...drop.droppableProps} className={`flex flex-col ${dropSnap.isDraggingOver ? 'ring-2 ring-orange-300 bg-orange-50/40' : ''}`}>
                <div className={`flex items-center py-2 ${selected ? 'bg-orange-100' : 'hover:bg-black/5'}`} onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}>
                  <div className="w-7 flex justify-center shrink-0">
                    {!readOnly && (
                      <button onClick={(e) => { e.stopPropagation(); onRemoveNode(el.id); }} className="text-slate-300 hover:text-red-500" title="Supprimer le sous-chapitre"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div {...p.dragHandleProps} className={`w-7 flex justify-center shrink-0 ${readOnly ? 'opacity-0' : 'text-slate-400 hover:text-orange-600 cursor-grab active:cursor-grabbing'}`}>
                    {!readOnly && <GripVertical size={14} />}
                  </div>
                  <div className="w-16 text-center text-[10px] font-mono font-black text-slate-600 shrink-0">{refMap.get(el.id) || '-'}</div>
                  <div className="flex-1 px-2 flex items-center gap-2 min-w-0" style={{ paddingLeft: `${level * 18 + 4}px` }}>
                    <button onClick={(e) => { e.stopPropagation(); toggleCollapsed(el.id); }} className="shrink-0 p-0.5 rounded text-slate-500 hover:bg-black/10" title={isCollapsed ? 'Déplier' : 'Replier'}>
                      {isCollapsed ? <ChevronRight size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
                    </button>
                    <Layers size={14} className="shrink-0 text-orange-600" />
                    <InlineInput
                      value={el.title}
                      upper
                      onCommit={(val) => onUpdateNode(el.id, { title: val })}
                      placeholder="Sous-chapitre"
                      className="flex-1 min-w-0 text-[11px] font-black uppercase text-slate-800 tracking-wider bg-transparent hover:bg-white/50 focus:bg-white border border-transparent focus:border-orange-400 rounded px-1 py-0.5 outline-none"
                    />
                    {isCollapsed && <span className="shrink-0 text-[9px] font-bold text-slate-500 bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded-full">{nb} ligne{nb > 1 ? 's' : ''}</span>}
                  </div>
                  <div className="w-28 text-right px-3 text-[11px] font-mono font-black text-orange-800 shrink-0">{fmt(total)}</div>
                  <div className="w-8 shrink-0" />
                </div>

                {!isCollapsed && (
                  <div className="pl-4 border-l border-slate-300 ml-4 min-h-[36px]">
                    <TpItemList items={el.children} parentId={el.id} level={level + 1} />
                    {drop.placeholder}
                    {(!el.children || el.children.length === 0) && (
                      <div className="h-8 flex items-center text-[9px] italic pl-2 text-slate-400">{dropSnap.isDraggingOver ? 'Déposer ici ↓' : 'Vide'}</div>
                    )}
                    {!readOnly && (
                      <div className="flex items-center gap-3 py-1.5 pl-2">
                        <button onClick={(e) => { e.stopPropagation(); onAddItem(el.id); }} className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 hover:text-orange-700"><Plus size={12} /> Article</button>
                        <button onClick={(e) => { e.stopPropagation(); onAddSub(el.id); }} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700"><FolderPlus size={12} /> Sous-chapitre</button>
                      </div>
                    )}
                  </div>
                )}
                {isCollapsed && <div className="ml-4">{drop.placeholder}</div>}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
});

// ─── Orchestrateur récursif ───────────────────────────────────────────────────
export default function TpItemList({ items, level = 0 }) {
  if (!Array.isArray(items)) return null;
  return items.map((el, index) => {
    if (!el) return null;
    return el.type === 'item'
      ? <ItemRow key={el.id} el={el} index={index} level={level} />
      : <SubChapterRow key={el.id} el={el} index={index} level={level} />;
  });
}
