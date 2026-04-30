// src/views/devisMoe/TacheTypeEditModal.jsx
// Modal d'ajout / modification d'une tâche type
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, X } from 'lucide-react';
import { PHASES_LOI_MOP } from '../../hooks/useDevisMoe';

export default function TacheTypeEditModal({ isOpen, tache, phases, onSave, onClose }) {
  const [label, setLabel] = useState('');
  const [selectedPhases, setSelectedPhases] = useState([]);

  // Sync state on open
  useEffect(() => {
    if (isOpen && tache) {
      setLabel(tache.label || '');
      setSelectedPhases([...(tache.phases || [])]);
    } else if (isOpen) {
      setLabel('');
      setSelectedPhases([]);
    }
  }, [isOpen, tache]);

  if (!isOpen) return null;

  const togglePhase = (phaseId) => {
    setSelectedPhases(prev =>
      prev.includes(phaseId) ? prev.filter(p => p !== phaseId) : [...prev, phaseId]
    );
  };

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ label: label.trim(), phases: selectedPhases });
  };

  const isEdit = !!tache;
  const activePhases = (phases || PHASES_LOI_MOP).filter(p => p.actif);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal-stack flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-[480px] mx-4 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              {isEdit ? <Pencil size={15} className="text-emerald-600" /> : <Plus size={15} className="text-emerald-600" />}
            </div>
            <h3 className="font-bold text-sm text-slate-800">{isEdit ? 'Modifier la tâche type' : 'Nouvelle tâche type'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Label */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Intitulé de la tâche
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Réunion de chantier, Étude technique…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-slate-800 placeholder-slate-300"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && label.trim() && handleSave()}
            />
          </div>

          {/* Phases */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Phases MOP associées <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {activePhases.map(p => (
                <button key={p.id} onClick={() => togglePhase(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-default border ${
                    selectedPhases.includes(p.id)
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                  }`}>
                  <span>{p.code}</span>
                  <span className={`text-[10px] font-normal ${selectedPhases.includes(p.id) ? 'text-slate-300' : 'text-slate-300'}`}>
                    {p.label.length > 20 ? p.label.slice(0, 20) + '…' : p.label}
                  </span>
                </button>
              ))}
            </div>
            {selectedPhases.length === 0 && (
              <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1">
                Aucune phase sélectionnée — cette tâche sera «Générale» (visible dans toutes les phases)
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all cursor-default">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!label.trim()}
            className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-default ${
              label.trim()
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}>
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
