// src/views/ged/PhaseEditorModal.jsx
// Éditeur de la liste de phases d'une affaire (création + édition).
// Ajouter / renommer / réordonner / retirer. La suppression d'une phase déjà
// figée (version dans la GED) est bloquée — les archives sont immuables.

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, GripVertical, Trash2, Plus, Lock, RotateCcw, Layers } from 'lucide-react';
import {
  buildPhases, DEFAULT_PHASE_DEFS, validatePhases, canRemovePhase,
  phaseColorFor, styleForColor,
} from '../../utils/phaseModel';
import { generateId } from '../../utils/helpers';

const PhaseEditorModal = ({ show, onClose, phases: initialPhases, archives = [], onSave }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      setRows(initialPhases && initialPhases.length ? initialPhases.map((p) => ({ ...p })) : buildPhases());
      setError(null);
    }
  }, [show, initialPhases]);

  if (!show) return null;

  const update = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: field === 'code' ? value.toUpperCase() : value } : r)));
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, { id: `phase_${generateId()}`, code: '', label: '' }]);

  const removeRow = (i) => {
    const row = rows[i];
    if (!canRemovePhase(row, archives)) return; // sécurité (le bouton est déjà désactivé)
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const resetStandard = () => { setRows(buildPhases(DEFAULT_PHASE_DEFS)); setError(null); };

  const handleSave = () => {
    const cleaned = rows
      .map((r) => ({ id: r.id || `phase_${generateId()}`, code: String(r.code || '').trim().toUpperCase(), label: String(r.label || '').trim() || String(r.code || '').trim() }))
      .filter((r) => r.code);
    const v = validatePhases(cleaned);
    if (!v.ok) { setError(v.error); return; }
    onSave(cleaned);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-900 rounded-xl"><Layers size={18} className="text-white" /></div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">Phases de l'affaire</h2>
              <p className="text-[11px] text-slate-400">Définissez le cycle de vie : ajoutez, renommez, réordonnez</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        {/* Liste */}
        <div className="px-6 py-4 overflow-y-auto space-y-2">
          {/* En-tête colonnes */}
          <div className="grid grid-cols-[28px_90px_1fr_60px] gap-2 px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            <span></span>
            <span>Code</span>
            <span>Libellé</span>
            <span className="text-right">Ordre</span>
          </div>

          {rows.map((row, i) => {
            const figee = !canRemovePhase(row, archives);
            const st = styleForColor(phaseColorFor(row.code, i));
            return (
              <div key={row.id} className="grid grid-cols-[28px_90px_1fr_60px] gap-2 items-center">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${st.light} ${st.border} border`}>
                  <span className={`w-2 h-2 rounded-full ${st.bg}`} />
                </div>
                <input
                  value={row.code}
                  onChange={(e) => update(i, 'code', e.target.value)}
                  placeholder="DCE"
                  maxLength={6}
                  className="px-2 py-2 text-[12px] font-bold uppercase bg-gray-100 border border-gray-200/60 rounded-lg focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <input
                  value={row.label}
                  onChange={(e) => update(i, 'label', e.target.value)}
                  placeholder="Libellé complet (ex : Consultation des Entreprises)"
                  className="px-2 py-2 text-[12px] bg-gray-100 border border-gray-200/60 rounded-lg focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <div className="flex items-center justify-end gap-0.5">
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Monter"
                    className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300">
                    <GripVertical size={13} className="rotate-90" />
                  </button>
                  {figee ? (
                    <span title="Phase figée — suppression impossible (versions émises)" className="p-1 text-amber-400"><Lock size={13} /></span>
                  ) : (
                    <button onClick={() => removeRow(i)} title="Supprimer"
                      className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}

          <button onClick={addRow}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 text-[11px] font-semibold text-blue-600 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
            <Plus size={14} /> Ajouter une phase
          </button>

          {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2 shrink-0">
          <button onClick={resetStandard}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <RotateCcw size={13} /> Modèle standard
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
            <button onClick={handleSave}
              className="px-4 py-2 bg-gray-900 text-white text-[12px] font-bold rounded-xl hover:bg-gray-700 transition-colors active:scale-95">
              Enregistrer les phases
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

PhaseEditorModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  phases: PropTypes.array,
  archives: PropTypes.array,
  onSave: PropTypes.func.isRequired,
};

export default PhaseEditorModal;
