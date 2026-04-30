// src/views/expenseNotes/VehiclesPanel.jsx
// Modale de gestion des vehicules (CRUD + selection vehicule par defaut).

import React, { useState } from 'react';
import { X, Plus, Trash2, Star, Car } from 'lucide-react';
import { PUISSANCES } from '../../data/baremeFiscal2025';
import { confirm } from '../../utils/globalUI';

const VehiclesPanel = ({ expense, onClose }) => {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newPuissance, setNewPuissance] = useState(5);
  const [newPlate, setNewPlate] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    await expense.addVehicle({
      label: newLabel.trim(),
      puissance: Number(newPuissance),
      plateNumber: newPlate.trim(),
      isDefault: expense.vehicles.length === 0,
    });
    setNewLabel('');
    setNewPlate('');
    setNewPuissance(5);
    setAdding(false);
  };

  const handleSetDefault = async (id) => {
    // Un seul defaut a la fois
    for (const v of expense.vehicles) {
      if (v.id === id && !v.isDefault) {
        await expense.updateVehicle(v.id, { isDefault: true });
      } else if (v.id !== id && v.isDefault) {
        await expense.updateVehicle(v.id, { isDefault: false });
      }
    }
  };

  const handleDelete = async (v) => {
    if (expense.vehicles.length <= 1) {
      await confirm('Impossible de supprimer le dernier vehicule.', { variant: 'info' });
      return;
    }
    const ok = await confirm(`Supprimer le vehicule "${v.label}" ?`, { danger: true });
    if (!ok) return;
    await expense.deleteVehicle(v.id);
    // Si on a supprime le defaut, en redesigner un
    if (v.isDefault) {
      const next = expense.vehicles.find((x) => x.id !== v.id);
      if (next) await expense.updateVehicle(next.id, { isDefault: true });
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Car size={18} className="text-amber-600" />
            <h2 className="text-base font-bold text-gray-900">Vehicules</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
          {expense.vehicles.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                v.isDefault ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200/60'
              }`}
            >
              <button
                onClick={() => handleSetDefault(v.id)}
                title={v.isDefault ? 'Vehicule par defaut' : 'Definir par defaut'}
                className={`p-1.5 rounded-lg transition-colors ${
                  v.isDefault ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'
                }`}
              >
                <Star size={16} fill={v.isDefault ? 'currentColor' : 'none'} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900 truncate">{v.label}</div>
                <div className="text-xs text-gray-500">
                  {PUISSANCES.find((p) => p.value === v.puissance)?.label || `${v.puissance} CV`}
                  {v.plateNumber ? ` · ${v.plateNumber}` : ''}
                </div>
              </div>
              <button
                onClick={() => handleDelete(v)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {adding ? (
            <form
              onSubmit={handleAdd}
              className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4 space-y-3"
            >
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Libelle</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                  autoFocus
                  placeholder="Tesla Model Y, Renault Clio…"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Puissance fiscale</label>
                  <select
                    value={newPuissance}
                    onChange={(e) => setNewPuissance(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400"
                  >
                    {PUISSANCES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Immatriculation</label>
                  <input
                    type="text"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="AB-123-CD"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-200 text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold"
                >
                  Ajouter
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all text-sm font-medium"
            >
              <Plus size={14} />
              Ajouter un vehicule
            </button>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500">
          La puissance fiscale est utilisee pour calculer le bareme kilometrique. L'etoile designe le vehicule par defaut.
        </div>
      </div>
    </div>
  );
};

export default VehiclesPanel;
