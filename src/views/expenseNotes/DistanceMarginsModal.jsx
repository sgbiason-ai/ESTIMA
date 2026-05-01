// src/views/expenseNotes/DistanceMarginsModal.jsx
// Modale d'edition des regles de majoration des distances OSRM.

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, RotateCcw, Sliders } from 'lucide-react';
import { DEFAULT_MARGINS } from '../../utils/distanceMargin';
import { confirm } from '../../utils/globalUI';

const DistanceMarginsModal = ({ rules, enabled, onSave, onClose }) => {
  const [localRules, setLocalRules] = useState(() => {
    return Array.isArray(rules) && rules.length > 0
      ? rules.map((r) => ({ maxKm: r.maxKm, marginPct: r.marginPct }))
      : DEFAULT_MARGINS.map((r) => ({ ...r }));
  });
  const [localEnabled, setLocalEnabled] = useState(enabled !== false);

  useEffect(() => {
    if (Array.isArray(rules) && rules.length > 0) {
      setLocalRules(rules.map((r) => ({ maxKm: r.maxKm, marginPct: r.marginPct })));
    }
  }, [rules]);

  const updateRule = (idx, field, value) => {
    setLocalRules((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], [field]: Number(String(value).replace(',', '.')) || 0 };
      return next;
    });
  };

  const removeRule = (idx) => {
    setLocalRules((arr) => arr.filter((_, i) => i !== idx));
  };

  const addRule = () => {
    const last = localRules[localRules.length - 1];
    const nextMax = last ? last.maxKm * 2 : 10;
    setLocalRules((arr) => [...arr, { maxKm: nextMax, marginPct: 5 }]);
  };

  const handleReset = async () => {
    const ok = await confirm('Reinitialiser les seuils par defaut ?');
    if (!ok) return;
    setLocalRules(DEFAULT_MARGINS.map((r) => ({ ...r })));
  };

  const handleSave = async () => {
    // Trier + filtrer avant sauvegarde
    const sorted = localRules
      .filter((r) => r.maxKm > 0 && r.marginPct >= 0)
      .sort((a, b) => a.maxKm - b.maxKm);
    await onSave(sorted, localEnabled);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">Majoration des distances</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-gray-500 leading-relaxed">
            La distance route calculee par OSRM est theorique. En realite tu fais souvent plus de km
            (parking, detours, zigzag). Definis ici les majorations a appliquer automatiquement
            apres le calcul, selon la distance.
          </p>

          <label className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200/60 cursor-pointer select-none hover:bg-gray-100/50 transition-colors">
            <input
              type="checkbox"
              checked={localEnabled}
              onChange={(e) => setLocalEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span className="text-sm font-bold text-gray-900">Activer les majorations automatiques</span>
          </label>

          <fieldset disabled={!localEnabled} className={!localEnabled ? 'opacity-50' : ''}>
            <div className="space-y-2">
              {localRules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-indigo-50/40 border border-indigo-100 rounded-xl p-3">
                  <span className="text-xs text-gray-500 shrink-0">Distance ≤</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={rule.maxKm}
                      onChange={(e) => updateRule(idx, 'maxKm', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-md text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 pr-9"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">km</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">→ majoration</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={rule.marginPct}
                      onChange={(e) => updateRule(idx, 'marginPct', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-md text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 pr-7"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    disabled={!localEnabled}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Supprimer ce seuil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <div className="text-xs text-gray-400 italic px-3 py-2">
                Au-dela du dernier seuil : aucune majoration appliquee.
              </div>

              <button
                type="button"
                onClick={addRule}
                disabled={!localEnabled}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-indigo-300 text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-sm font-medium disabled:opacity-50"
              >
                <Plus size={14} />
                Ajouter un seuil
              </button>
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-200 text-xs font-medium transition-colors"
          >
            <RotateCcw size={12} />
            Reinitialiser defaut
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-200 text-sm font-medium">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-bold"
            >
              <Save size={14} />
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistanceMarginsModal;
