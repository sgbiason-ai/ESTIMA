// src/views/expenseNotes/ExpenseNotesMonthView.jsx
// Detail d'une note de frais mensuelle : tableau des trajets + ajout/edition.

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import { calculateMonthAmount, getActiveTranche, PUISSANCES } from '../../data/baremeFiscal2025';
import TripFormModal from './TripFormModal';
import { confirm } from '../../utils/globalUI';

const MONTH_LABELS_FR = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const formatEur = (n) => {
  if (!n) return '0 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
};
const formatKm = (n) => `${(n || 0).toLocaleString('fr-FR')} km`;

const formatDateShort = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const ExpenseNotesMonthView = ({ month, expense, onBack, onBackToHub }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  const note = expense.notes[month] || { trips: [], totalKm: 0 };
  const trips = useMemo(() => {
    const list = note.trips || [];
    return [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [note.trips]);

  const [year, m] = month.split('-');
  const monthIdx = Number(m) - 1;
  const monthLabel = MONTH_LABELS_FR[monthIdx];

  const vehicle = expense.defaultVehicle;
  const puissance = vehicle?.puissance || 5;

  const cumulBefore = expense.getCumulBeforeMonth(month);
  const cumulAfter = cumulBefore + (note.totalKm || 0);
  const monthAmount = calculateMonthAmount(cumulBefore, note.totalKm || 0, puissance);
  const tranche = getActiveTranche(cumulAfter);

  const handleSaveTrip = async (data) => {
    if (editingTrip) {
      await expense.updateTrip(month, editingTrip.id, data);
    } else {
      await expense.addTrip(month, data);
    }
    setShowForm(false);
    setEditingTrip(null);
  };

  const handleDeleteTrip = async (trip) => {
    const ok = await confirm(`Supprimer le trajet du ${formatDateShort(trip.date)} ?`, { danger: true });
    if (ok) await expense.deleteTrip(month, trip.id);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all text-xs font-medium"
        >
          <ArrowLeft size={14} />
          Annee {year}
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <h1 className="font-bold text-lg text-gray-900 tracking-tight">{monthLabel} {year}</h1>
        <div className="flex-1" />
        <button
          onClick={() => { setEditingTrip(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors text-xs font-bold uppercase tracking-wider"
        >
          <Plus size={14} />
          Trajet
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats du mois */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white rounded-xl border border-gray-200/60 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">KM du mois</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatKm(note.totalKm || 0)}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
            <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Montant</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatEur(monthAmount)}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">Cumul {year}</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatKm(cumulAfter)}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
            <div className="text-[10px] uppercase font-bold text-violet-600 tracking-widest">Tranche fiscale</div>
            <div className="text-sm font-bold text-gray-900 mt-1 leading-tight">{tranche.label}</div>
            <div className="text-[10px] text-violet-600 mt-1">
              {vehicle ? `${PUISSANCES.find((p) => p.value === puissance)?.label}` : 'Aucun vehicule'}
            </div>
          </div>
        </div>

        {/* Tableau trajets */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_1.2fr_1.2fr_90px_60px_50px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span>Date</span>
            <span>Motif</span>
            <span>Depart</span>
            <span>Arrivee</span>
            <span className="text-right">KM</span>
            <span className="text-center">A/R</span>
            <span />
          </div>

          {trips.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Aucun trajet ce mois-ci.
              <button
                onClick={() => { setEditingTrip(null); setShowForm(true); }}
                className="ml-2 text-blue-600 hover:underline font-medium"
              >
                Ajouter le premier trajet
              </button>
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="grid grid-cols-[110px_1fr_1.2fr_1.2fr_90px_60px_50px] gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors group items-center"
              >
                <span className="text-xs font-medium text-gray-700 tabular-nums">{formatDateShort(trip.date)}</span>
                <span className="text-xs text-gray-700 truncate" title={trip.motif}>{trip.motif || <span className="text-gray-300 italic">aucun motif</span>}</span>
                <span className="text-xs text-gray-700 truncate" title={trip.departure}>{trip.departure || '-'}</span>
                <span className="text-xs text-gray-700 truncate" title={trip.arrival}>{trip.arrival || '-'}</span>
                <span className="text-xs font-bold text-gray-900 tabular-nums text-right">{formatKm(trip.km)}</span>
                <span className="text-center">
                  {trip.roundTrip && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">A/R</span>}
                </span>
                <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingTrip(trip); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteTrip(trip)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {showForm && (
        <TripFormModal
          month={month}
          trip={editingTrip}
          onSave={handleSaveTrip}
          onClose={() => { setShowForm(false); setEditingTrip(null); }}
        />
      )}
    </div>
  );
};

export default ExpenseNotesMonthView;
