// src/views/devisMoe/TacheTypeModal.jsx
// Modal bibliothèque de tâches types — réordonnement, ajout, modification
import React, { useState } from 'react';
import { Plus, Trash2, BookOpen, RotateCcw, X, GripVertical, Pencil } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PHASES_LOI_MOP, TACHE_TEMPLATES } from '../../hooks/useDevisMoe';
import TacheTypeEditModal from './TacheTypeEditModal';

export default function TacheTypeModal({ draft, setDraft, onClose }) {
  const [editingIdx, setEditingIdx] = useState(null); // null = closed, -1 = add new, 0+ = edit index
  const [filterPhase, setFilterPhase] = useState(null); // null = toutes, sinon id phase
  const tpls = draft.customTemplates || [...TACHE_TEMPLATES];
  const updateTpls = (newTpls) => setDraft({ ...draft, customTemplates: newTpls });
  const activePhasesRef = (draft.phases || PHASES_LOI_MOP).filter(p => p.actif);
  const filteredTpls = filterPhase
    ? tpls.map((t, i) => ({ ...t, _idx: i })).filter(t => t.phases && t.phases.includes(filterPhase))
    : tpls.map((t, i) => ({ ...t, _idx: i }));

  const removeTpl = (idx) => updateTpls(tpls.filter((_, i) => i !== idx));
  const resetTpls = () => updateTpls(null);
  const reorderTpls = (fromIdx, toIdx) => {
    const arr = [...tpls];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    updateTpls(arr);
  };

  const handleSaveEdit = (data) => {
    if (editingIdx === -1) {
      // Ajout
      updateTpls([...tpls, data]);
    } else {
      // Modification
      updateTpls(tpls.map((t, i) => i === editingIdx ? data : t));
    }
    setEditingIdx(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
        <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <BookOpen size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Bibliothèque de tâches types</h3>
                <p className="text-[11px] text-slate-400">
                  {filterPhase ? `${filteredTpls.length} / ${tpls.length}` : tpls.length} tâche{(filterPhase ? filteredTpls.length : tpls.length) > 1 ? 's' : ''} · glissez pour réordonner
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-default">
              <X size={18} />
            </button>
          </div>

          {/* Filtre par phase */}
          <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-1.5 flex-wrap shrink-0">
            <button onClick={() => setFilterPhase(null)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-default ${
                !filterPhase ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              Toutes
            </button>
            {activePhasesRef.map(p => (
              <button key={p.id} onClick={() => setFilterPhase(filterPhase === p.id ? null : p.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-default ${
                  filterPhase === p.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {p.code}
              </button>
            ))}
          </div>

          {/* Body */}
          <DragDropContext onDragEnd={(result) => {
            if (!result.destination) return;
            if (filterPhase) return; // pas de réordonnement en mode filtré
            reorderTpls(result.source.index, result.destination.index);
          }}>
            <Droppable droppableId="tpl-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-6 space-y-2">
                  {filteredTpls.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      {filterPhase ? 'Aucune tâche pour cette phase.' : 'Aucune tâche type. Cliquez «Ajouter» pour en créer.'}
                    </div>
                  )}
                  {filteredTpls.map((tpl) => (
                    <Draggable key={`tpl-${tpl._idx}`} draggableId={`tpl-${tpl._idx}`} index={tpl._idx}>
                      {(dragProvided, dragSnapshot) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                          className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 group transition-shadow ${
                            dragSnapshot.isDragging ? 'shadow-lg bg-white' : ''
                          }`}>
                          <div {...dragProvided.dragHandleProps} className="text-slate-200 hover:text-slate-400 cursor-grab shrink-0">
                            <GripVertical size={14} />
                          </div>

                          {/* Label */}
                          <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                            {tpl.label || <span className="text-slate-300 italic">Sans titre</span>}
                          </span>

                          {/* Phases badges */}
                          <div className="flex gap-1 shrink-0">
                            {tpl.phases && tpl.phases.length > 0 ? (
                              tpl.phases.map(phaseId => {
                                const phase = (draft.phases || PHASES_LOI_MOP).find(p => p.id === phaseId);
                                return phase ? (
                                  <span key={phaseId} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-white">
                                    {phase.code}
                                  </span>
                                ) : null;
                              })
                            ) : (
                              <span className="text-[9px] text-amber-500 font-semibold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">
                                Générale
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <button onClick={() => setEditingIdx(tpl._idx)}
                              className="p-1 rounded text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-default"
                              title="Modifier">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => removeTpl(tpl._idx)}
                              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-default"
                              title="Supprimer">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 shrink-0">
            <div className="flex gap-2">
              <button onClick={() => setEditingIdx(-1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 border border-emerald-200 transition-all cursor-default">
                <Plus size={13} />Ajouter
              </button>
              <button onClick={resetTpls}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-slate-500 text-xs font-semibold hover:bg-slate-100 border border-slate-200 transition-all cursor-default">
                <RotateCcw size={13} />Réinitialiser
              </button>
            </div>
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all cursor-default">
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Sous-modale ajout/modification */}
      <TacheTypeEditModal
        isOpen={editingIdx !== null}
        tache={editingIdx !== null && editingIdx >= 0 ? tpls[editingIdx] : null}
        phases={draft.phases}
        onSave={handleSaveEdit}
        onClose={() => setEditingIdx(null)}
      />
    </>
  );
}
