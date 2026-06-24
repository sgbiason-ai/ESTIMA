// src/views/estimaTp/bordereau/TpBordereau.jsx
// Bordereau ESTIMA TP — reprend la « forme du devis » ESTIMA (arborescence
// chapitres/sous-chapitres/articles, colonnes, repli, glisser-déposer, ƒ(x))
// sans la machinerie MOE (BPU/tranches/PSE/% client).
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Trash2, GripVertical, ChevronDown, ChevronRight, Plus, FolderPlus, Layers } from 'lucide-react';
import { TpBordereauContext } from './TpBordereauContext';
import TpItemList from './TpItemList';
import {
  newSubChapter, newItem, addNode, removeNode, updateNode, moveNode,
  refMapOf, nodeTotal, countItems, grandTotal,
} from './tpBordereauModel';

const fmt = (n) => `${Math.round(Number(n || 0)).toLocaleString('fr-FR')} €`;

export default function TpBordereau({ chapters, onChange, readOnly = false, onOpenSousDetail, selectedId: selectedIdProp, onSelectId }) {
  const list = useMemo(() => chapters || [], [chapters]);
  // Sélection contrôlée si le parent fournit selectedId/onSelectId, sinon état interne.
  const [selectedIdState, setSelectedIdState] = useState(null);
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : selectedIdState;
  const setSelectedId = onSelectId || setSelectedIdState;
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [formulaMode, setFormulaMode] = useState({ activeId: null });

  const refMap = useMemo(() => refMapOf(list), [list]);
  const reverseRefMap = useMemo(() => {
    const m = new Map();
    refMap.forEach((label, id) => { if (label) m.set(label, id); });
    return m;
  }, [refMap]);

  const toggleCollapsed = useCallback((id) => {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // Auto-déplie la chaîne d'ancêtres du nœud sélectionné — évite d'insérer (ou de
  // sélectionner programmatiquement) un nœud invisible dans un chapitre replié.
  useEffect(() => {
    if (!selectedId) return;
    const chain = [];
    const walk = (arr, parents) => {
      for (const n of arr || []) {
        if (!n) continue;
        if (n.id === selectedId) { chain.push(...parents); return true; }
        if (n.children && walk(n.children, [...parents, n.id])) return true;
      }
      return false;
    };
    walk(list, []);
    if (chain.length === 0) return;
    setCollapsed(prev => {
      let next = prev, changed = false;
      chain.forEach(id => {
        if (next.has(id)) { if (!changed) { next = new Set(next); changed = true; } next.delete(id); }
      });
      return changed ? next : prev;
    });
  }, [selectedId, list]);

  // Handlers d'édition (immuables, recalcul ƒ(x) intégré au modèle)
  const onUpdateNode = useCallback((id, patch) => onChange(updateNode(list, id, patch)), [list, onChange]);
  const onRemoveNode = useCallback((id) => onChange(removeNode(list, id)), [list, onChange]);
  const onAddItem = useCallback((parentId) => onChange(addNode(list, parentId, newItem())), [list, onChange]);
  const onAddSub = useCallback((parentId) => onChange(addNode(list, parentId, newSubChapter())), [list, onChange]);

  const onDragEnd = useCallback((result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    onChange(moveNode(list, source.droppableId, source.index, destination.droppableId, destination.index));
  }, [list, onChange]);

  const ctx = {
    refMap, reverseRefMap, selectedId, setSelectedId, collapsed, toggleCollapsed,
    formulaMode, setFormulaMode, onUpdateNode, onRemoveNode, onAddItem, onAddSub, readOnly,
    onOpenSousDetail,
  };

  const total = grandTotal(list);

  return (
    <TpBordereauContext.Provider value={ctx}>
      {/* Barre d'action — compteurs ; ajout de chapitre dans le ruban (groupe « Insertion ») */}
      <div className="flex items-center gap-2 text-sm mb-3">
        <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold">{list.length} chapitre{list.length > 1 ? 's' : ''}</span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">{countItems(list)} article{countItems(list) > 1 ? 's' : ''}</span>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white/60 border border-dashed border-slate-200 rounded-2xl text-center px-6">
          <div className="p-4 rounded-2xl bg-orange-50 mb-4"><Layers size={28} className="text-orange-500" strokeWidth={1.5} /></div>
          <p className="text-sm font-semibold text-slate-700">Bordereau vide</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">Utilisez le ruban (groupe « Insertion ») pour ajouter chapitres, sous-chapitres et articles — comme dans un devis ESTIMA.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={readOnly ? () => {} : onDragEnd}>
          <Droppable droppableId="root" type="CHAPTER" isDropDisabled={readOnly}>
            {(prov) => (
              <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-4">
                {list.map((chap, index) => {
                  const isCollapsed = collapsed.has(chap.id);
                  const chapTotal = nodeTotal(chap);
                  const nb = isCollapsed ? countItems(chap.children) : 0;
                  const selected = selectedId === chap.id;
                  return (
                    <Draggable key={chap.id} draggableId={`node:${chap.id}`} index={index} isDragDisabled={readOnly}>
                      {(p, snap) => (
                        <div ref={p.innerRef} {...p.draggableProps} className={`rounded-xl border overflow-hidden transition-all ${selected ? 'ring-2 ring-orange-200 border-orange-400' : 'border-slate-200 hover:shadow-md'} ${snap.isDragging ? 'shadow-2xl z-50 rotate-1 bg-white' : 'bg-white'}`}>
                          {/* En-tête chapitre (sombre, façon ESTIMA) */}
                          <div className={`p-3 flex justify-between items-center ${selected ? 'bg-orange-600 text-white' : 'bg-slate-900 text-white'}`} onClick={() => setSelectedId(chap.id)}>
                            <div className="flex items-center gap-3 min-w-0">
                              {!readOnly && (
                                <button onClick={(e) => { e.stopPropagation(); onRemoveNode(chap.id); }} className="p-1 text-white/40 hover:text-red-300" title="Supprimer le chapitre"><Trash2 size={16} /></button>
                              )}
                              <div {...p.dragHandleProps} className={`p-1 ${readOnly ? 'opacity-0' : 'text-white/40 hover:text-white cursor-grab active:cursor-grabbing'}`}>{!readOnly && <GripVertical size={18} />}</div>
                              <button onClick={(e) => { e.stopPropagation(); toggleCollapsed(chap.id); }} className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10" title={isCollapsed ? 'Déplier' : 'Replier'}>
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span className="w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-black bg-white/20 text-white shrink-0">{index + 1}</span>
                              <ChapterTitle value={chap.title} disabled={readOnly} onCommit={(val) => onUpdateNode(chap.id, { title: val })} />
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {isCollapsed && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/80">{nb} ligne{nb > 1 ? 's' : ''}</span>}
                              <span className="font-mono font-black text-xs px-3 py-1 rounded-full bg-black/20 text-white">{fmt(chapTotal)}</span>
                              {!readOnly && (
                                <button onClick={(e) => { e.stopPropagation(); onAddSub(chap.id); }} className="p-1.5 rounded-md hover:bg-white/20 text-white" title="Ajouter un sous-chapitre"><Plus size={16} /></button>
                              )}
                            </div>
                          </div>

                          {/* Corps */}
                          {!isCollapsed && (
                            <div className="flex flex-col w-full">
                              {/* En-tête de colonnes */}
                              <div className="flex items-center py-1.5 bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                <div className="w-7 shrink-0" />
                                <div className="w-16 text-center shrink-0">N°</div>
                                <div className="flex-1 px-2">Désignation</div>
                                <div className="w-16 text-center shrink-0">Unité</div>
                                <div className="w-24 text-right px-2 shrink-0">Quantité</div>
                                <div className="w-28 text-right px-2 shrink-0">PU HT</div>
                                <div className="w-28 text-right px-3 shrink-0">Total</div>
                                <div className="w-8 shrink-0" />
                              </div>
                              <Droppable droppableId={chap.id} type="ITEM" isDropDisabled={readOnly}>
                                {(dp, ds) => (
                                  <div ref={dp.innerRef} {...dp.droppableProps} className={`flex flex-col w-full min-h-[44px] transition-colors ${ds.isDraggingOver ? 'bg-orange-50/50' : 'bg-white'}`}>
                                    <TpItemList items={chap.children} parentId={chap.id} level={0} />
                                    {dp.placeholder}
                                    {(!chap.children || chap.children.length === 0) && !ds.isDraggingOver && (
                                      <div className="p-6 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">Chapitre vide</div>
                                    )}
                                    {!readOnly && (
                                      <div className="flex items-center gap-3 py-2 px-3 border-t border-slate-100">
                                        <button onClick={() => onAddItem(chap.id)} className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700"><Plus size={13} /> Article</button>
                                        <button onClick={() => onAddSub(chap.id)} className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"><FolderPlus size={13} /> Sous-chapitre</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {prov.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Total général */}
      {list.length > 0 && (
        <div className="flex items-center justify-end gap-4 mt-4 px-5 py-3 bg-slate-900 text-white rounded-2xl">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Total bordereau HT</span>
          <span className="text-lg font-mono font-black">{fmt(total)}</span>
        </div>
      )}
    </TpBordereauContext.Provider>
  );
}

// Titre de chapitre éditable (commit au blur)
function ChapterTitle({ value, onCommit, disabled }) {
  const [v, setV] = useState(value ?? '');
  React.useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <input
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value.toUpperCase())}
      onBlur={() => { if (v !== (value ?? '')) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onClick={(e) => e.stopPropagation()}
      placeholder="INTITULÉ DU CHAPITRE"
      className="font-black uppercase tracking-widest text-[11px] bg-transparent border border-transparent hover:border-white/20 focus:border-white/40 rounded px-1.5 py-0.5 outline-none text-white placeholder:text-white/40 min-w-0 flex-1"
    />
  );
}
