// src/views/expenseNotes/LocationsPanel.jsx
// Modale de gestion des adresses favorites (CRUD + designation Domicile).
// Ajout par autocomplete Nominatim, edition inline du libelle.

import React, { useState } from 'react';
import { X, Plus, Trash2, Home as HomeIcon, Pencil, Check, MapPin, Search } from 'lucide-react';
import AddressAutocomplete from '../../components/expenseNotes/AddressAutocomplete';
import { confirm } from '../../utils/globalUI';

const LocationsPanel = ({ expense, onClose }) => {
  const [adding, setAdding] = useState(false);
  const [newAddress, setNewAddress] = useState(null); // { label, lat, lon }
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  const handleAdd = async () => {
    if (!newAddress) return;
    const label = newLabel.trim() || newAddress.label;
    await expense.addLocation({
      label,
      address: newAddress.label,
      lat: newAddress.lat,
      lon: newAddress.lon,
      isHome: false,
    });
    setNewAddress(null);
    setNewLabel('');
    setAdding(false);
  };

  const handleSetHome = async (id) => {
    // Un seul domicile a la fois
    for (const l of expense.locations) {
      if (l.id === id && !l.isHome) {
        await expense.updateLocation(l.id, { isHome: true });
      } else if (l.id !== id && l.isHome) {
        await expense.updateLocation(l.id, { isHome: false });
      }
    }
  };

  const handleSaveLabel = async (id) => {
    const v = editLabel.trim();
    if (!v) {
      setEditingId(null);
      return;
    }
    await expense.updateLocation(id, { label: v });
    setEditingId(null);
  };

  const handleDelete = async (l) => {
    const ok = await confirm(`Supprimer l'adresse "${l.label}" ?`, { danger: true });
    if (!ok) return;
    await expense.deleteLocation(l.id);
  };

  const sorted = [...(expense.locations || [])].sort((a, b) => {
    if (a.isHome) return -1;
    if (b.isHome) return 1;
    return (a.label || '').localeCompare(b.label || '', 'fr');
  });

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Adresses favorites</h2>
            <span className="text-[10px] font-medium text-gray-400">({sorted.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-2">
          {sorted.length === 0 && !adding && (
            <div className="text-center py-8 text-gray-400 text-sm italic">
              Aucune adresse favorite. Ajoute tes lieux frequents pour gagner du temps.
            </div>
          )}

          {sorted.map((l) => {
            const isEditing = editingId === l.id;
            return (
              <div
                key={l.id}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                  l.isHome ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200/60'
                }`}
              >
                <button
                  onClick={() => handleSetHome(l.id)}
                  title={l.isHome ? 'Adresse domicile' : 'Definir comme domicile'}
                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                    l.isHome ? 'text-amber-600' : 'text-gray-300 hover:text-amber-500'
                  }`}
                >
                  <HomeIcon size={16} fill={l.isHome ? 'currentColor' : 'none'} />
                </button>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveLabel(l.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => handleSaveLabel(l.id)}
                        className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-sm text-gray-900 truncate flex items-center gap-1.5">
                        {l.label}
                        {l.isHome && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wider">Domicile</span>
                        )}
                      </div>
                      {l.address && l.address !== l.label && (
                        <div className="text-[11px] text-gray-500 truncate">{l.address}</div>
                      )}
                      {l.lat != null && l.lon != null && (
                        <div className="text-[10px] text-gray-400 tabular-nums">
                          {l.lat.toFixed(4)}, {l.lon.toFixed(4)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!isEditing && (
                  <>
                    <button
                      onClick={() => { setEditingId(l.id); setEditLabel(l.label); }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                      title="Renommer"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(l)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {adding ? (
            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block flex items-center gap-1">
                  <Search size={10} /> Rechercher l'adresse
                </label>
                <AddressAutocomplete
                  value={newAddress}
                  onChange={(addr) => {
                    setNewAddress(addr);
                    if (addr && !newLabel) setNewLabel(addr.label);
                  }}
                  favorites={[]}
                  placeholder="Ville, adresse, lieu..."
                />
              </div>
              {newAddress && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                    Libelle (modifiable)
                  </label>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ex: Bureau Toulouse, Chantier Albi…"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-400"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewAddress(null); setNewLabel(''); }}
                  className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-200 text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newAddress}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ajouter
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-emerald-300 text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-sm font-medium"
            >
              <Plus size={14} />
              Ajouter une adresse
            </button>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500">
          L'icone maison <HomeIcon size={9} className="inline" /> designe le domicile (utilise comme depart par defaut). Les favoris s'affichent en haut de l'autocomplete dans le formulaire de trajet.
        </div>
      </div>
    </div>
  );
};

export default LocationsPanel;
