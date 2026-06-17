// src/views/crc/CrcCategoriesModal.jsx
// Modal de gestion des catégories d'observations CRC
import React, { useState } from 'react';
import { Plus, Trash2, X, Check, Edit3, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { confirm } from '../../utils/globalUI';
import { defaultCategoryCode } from '../../data/crrData';

export default function CrcCategoriesModal({ isOpen, onClose, categories, addCategory, renameCategory, deleteCategory, reorderCategories, categoryCodes = {}, setCategoryCode }) {
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); }
  };

  const startEdit = (cat) => { setEditingCat(cat); setEditValue(cat); };

  const confirmEdit = () => {
    if (editValue.trim() && editValue !== editingCat) renameCategory(editingCat, editValue.trim());
    setEditingCat(null);
  };

  const handleDelete = async (cat) => {
    const ok = await confirm(`Supprimer la categorie "${cat}" ?`, { danger: true });
    if (ok) deleteCategory(cat);
  };

  const handleDragEnd = (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    reorderCategories(reordered);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[80vh] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800">Gestion des categories</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="p-5 space-y-2 overflow-y-auto max-h-[50vh]">
                {categories.map((cat, index) => (
                  <Draggable key={cat} draggableId={cat} index={index} isDragDisabled={editingCat === cat}>
                    {(prov, snapshot) => (
                      <div ref={prov.innerRef} {...prov.draggableProps}
                        className={`flex items-center gap-2 group rounded-lg transition-shadow ${snapshot.isDragging ? 'shadow-lg bg-white ring-2 ring-emerald-300' : ''}`}>
                        {editingCat === cat ? (
                          <>
                            <div className="w-6" />
                            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 text-sm px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800"
                              autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmEdit()} />
                            <button onClick={confirmEdit} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={14} /></button>
                          </>
                        ) : (
                          <>
                            <div {...prov.dragHandleProps} className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                              <GripVertical size={14} />
                            </div>
                            <span className="flex-1 text-sm text-slate-700 px-3 py-2 bg-slate-50 rounded-lg truncate" title={cat}>{cat}</span>
                            <input
                              type="text"
                              value={categoryCodes[cat] || ''}
                              onChange={(e) => setCategoryCode?.(cat, e.target.value)}
                              placeholder={defaultCategoryCode(cat)}
                              title={`Code de numérotation — préfixe du numéro (ex. ${defaultCategoryCode(cat)}.04)`}
                              className="w-24 text-[11px] font-bold uppercase tracking-wide px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-700 placeholder:font-normal placeholder:normal-case placeholder:text-slate-300"
                            />
                            <button onClick={() => startEdit(cat)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Edit3 size={12} /></button>
                            <button onClick={() => handleDelete(cat)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="px-5 py-3 border-t border-slate-200 flex gap-2">
          <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
            placeholder="Nouvelle categorie..." className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} disabled={!newCat.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-40 transition-all">
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <p className="text-[10px] text-slate-400 italic">Glissez-deposez pour reordonner · le code sert de prefixe au numero (ex. CHANTIER.04)</p>
          <button onClick={onClose}
            className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
