// src/views/expenseNotes/TripFormModal.jsx
// Phase 1 : modal d'ajout / edition de trajet — saisie manuelle des km.
// Phase 2 (futur) : autocomplete adresses + calcul OSRM auto.

import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, MapPin, Repeat, FileText, Hash } from 'lucide-react';

const TripFormModal = ({ month, trip, onSave, onClose }) => {
  const [date, setDate] = useState(trip?.date || `${month}-01`);
  const [motif, setMotif] = useState(trip?.motif || '');
  const [departure, setDeparture] = useState(trip?.departure || '');
  const [arrival, setArrival] = useState(trip?.arrival || '');
  const [km, setKm] = useState(trip?.km != null ? String(trip.km) : '');
  const [roundTrip, setRoundTrip] = useState(trip?.roundTrip || false);

  // Sync si on edite un autre trajet sans demonter le modal
  useEffect(() => {
    if (trip) {
      setDate(trip.date || `${month}-01`);
      setMotif(trip.motif || '');
      setDeparture(trip.departure || '');
      setArrival(trip.arrival || '');
      setKm(trip.km != null ? String(trip.km) : '');
      setRoundTrip(trip.roundTrip || false);
    }
  }, [trip, month]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const kmNum = Number(String(km).replace(',', '.'));
    if (!date || !kmNum || kmNum <= 0) return;
    onSave({
      date,
      motif: motif.trim(),
      departure: departure.trim(),
      arrival: arrival.trim(),
      km: kmNum,
      roundTrip,
    });
  };

  const isEdit = Boolean(trip);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Modifier le trajet' : 'Nouveau trajet'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
              <Calendar size={11} /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
              <FileText size={11} /> Motif
            </label>
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Visite chantier, RDV client, deplacement bureau…"
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
                <MapPin size={11} className="text-emerald-600" /> Depart
              </label>
              <input
                type="text"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                placeholder="Toulouse"
                className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
                <MapPin size={11} className="text-rose-600" /> Arrivee
              </label>
              <input
                type="text"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                placeholder="Albi"
                className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
                <Hash size={11} /> Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                required
                placeholder="78.4"
                className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm tabular-nums"
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl border border-gray-200/60 cursor-pointer select-none hover:bg-gray-200/50 transition-colors">
              <input
                type="checkbox"
                checked={roundTrip}
                onChange={(e) => setRoundTrip(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <Repeat size={12} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-700">A/R</span>
            </label>
          </div>

          {roundTrip && km && (
            <div className="text-[11px] text-gray-500 italic">
              Aller-retour : {(Number(String(km).replace(',', '.')) * 2).toLocaleString('fr-FR')} km au total seront enregistres.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm font-bold"
          >
            <Save size={14} />
            {isEdit ? 'Mettre a jour' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TripFormModal;
