// src/views/expenseNotes/ExpenseNotesMonthView.jsx
// Detail d'une note de frais mensuelle : tableau des trajets + ajout/edition.

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowLeft, FileDown } from 'lucide-react';
import { calculateMonthAmount, calculateAnnualAmount, getActiveTranche, getMarginalRate, getRateForTranche, getTrancheLabel, PUISSANCES } from '../../data/baremeFiscal2025';
import { getTripTotalKm } from '../../utils/distanceMargin';
import TripFormModal from './TripFormModal';
import { confirm } from '../../utils/globalUI';
import { generateExpenseNotesPdf } from '../../utils/pdf/pdfExpenseNotesGenerator';

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

const ExpenseNotesMonthView = ({ month, expense, branding, user, onBack, onBackToHub }) => {
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
  const isElectric = vehicle?.isElectric || false;
  const customBareme = expense.customBareme;
  const forcedTranche = expense.forcedTranche;
  const margins = expense.distanceMargins;
  const marginsEnabled = expense.distanceMarginsEnabled;

  // Km effectif par trajet (avec A/R double + majoration)
  const effectiveTripKm = useMemo(
    () => trips.map((t) => getTripTotalKm(t, margins, marginsEnabled)),
    [trips, margins, marginsEnabled],
  );
  const effectiveMonthKm = useMemo(
    () => effectiveTripKm.reduce((s, k) => s + k, 0),
    [effectiveTripKm],
  );

  // Cumul avant ce mois recalcule en effectif (A/R + majoration)
  const cumulBefore = useMemo(() => {
    const sortedMonths = Object.keys(expense.notes).sort();
    let sum = 0;
    for (const mm of sortedMonths) {
      if (mm >= month) break;
      const monthTrips = expense.notes[mm]?.trips || [];
      for (const t of monthTrips) sum += getTripTotalKm(t, margins, marginsEnabled);
    }
    return sum;
  }, [expense.notes, month, margins, marginsEnabled]);
  const cumulAfter = cumulBefore + effectiveMonthKm;

  // Tranche + taux : forces si l'utilisateur a choisi une tranche dans la
  // vue annuelle, sinon auto-determine selon le cumul.
  const trancheLabel = forcedTranche !== null
    ? getTrancheLabel(forcedTranche, customBareme)
    : getActiveTranche(cumulAfter, customBareme).label;

  const ratePerKm = forcedTranche !== null
    ? getRateForTranche(forcedTranche, puissance, customBareme, isElectric)
    : getMarginalRate(cumulAfter, puissance, customBareme, isElectric);

  // Montant par trajet — utilise km effectif (A/R + majoration)
  const tripsWithAmount = useMemo(() => {
    if (forcedTranche !== null) {
      return trips.map((t, i) => ({ ...t, effectiveKm: effectiveTripKm[i], amount: effectiveTripKm[i] * ratePerKm }));
    }
    let running = cumulBefore;
    return trips.map((t, i) => {
      const before = running;
      const k = effectiveTripKm[i];
      running += k;
      const amount = calculateAnnualAmount(running, puissance, customBareme, isElectric)
                   - calculateAnnualAmount(before, puissance, customBareme, isElectric);
      return { ...t, effectiveKm: k, amount };
    });
  }, [trips, effectiveTripKm, cumulBefore, puissance, customBareme, isElectric, forcedTranche, ratePerKm]);

  const monthAmount = forcedTranche !== null
    ? effectiveMonthKm * ratePerKm
    : calculateMonthAmount(cumulBefore, effectiveMonthKm, puissance, customBareme, isElectric);

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

  const handleExportPdf = () => {
    if (tripsWithAmount.length === 0) return;
    generateExpenseNotesPdf({
      monthLabel: `${monthLabel} ${year}`,
      vehicle: {
        label: vehicle?.label || 'Vehicule',
        plateNumber: vehicle?.plateNumber || '',
        puissanceLabel: PUISSANCES.find((p) => p.value === puissance)?.label || `${puissance} CV`,
        isElectric,
      },
      tripsWithAmount,
      totalKm: effectiveMonthKm,
      totalAmount: monthAmount,
      trancheLabel,
      ratePerKm,
      forcedTranche: forcedTranche !== null,
      branding,
      userName: user?.displayName || user?.email || '',
    });
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
          onClick={handleExportPdf}
          disabled={tripsWithAmount.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          title="Exporter la note du mois en PDF"
        >
          <FileDown size={14} />
          PDF
        </button>
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
            <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatKm(effectiveMonthKm)}</div>
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
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-bold text-violet-600 tracking-widest">Tranche fiscale</div>
              {forcedTranche !== null && (
                <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded uppercase tracking-wider">forcee</span>
              )}
            </div>
            <div className="text-sm font-bold text-gray-900 mt-1 leading-tight">{trancheLabel}</div>
            <div className="text-[11px] font-bold text-violet-700 tabular-nums mt-1">
              {ratePerKm.toFixed(3)} € / km
              {isElectric && <span className="ml-1 text-emerald-600">(+20%)</span>}
            </div>
            <div className="text-[10px] text-violet-600 mt-0.5">
              {vehicle ? `${PUISSANCES.find((p) => p.value === puissance)?.label}` : 'Aucun vehicule'}
            </div>
          </div>
        </div>

        {/* Tableau trajets */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[100px_1fr_1.2fr_1.2fr_80px_50px_95px_40px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span>Date</span>
            <span>Motif</span>
            <span>Depart</span>
            <span>Arrivee</span>
            <span className="text-right">KM</span>
            <span className="text-center">A/R</span>
            <span className="text-right">Montant</span>
            <span />
          </div>

          {tripsWithAmount.length === 0 ? (
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
            tripsWithAmount.map((trip) => (
              <div
                key={trip.id}
                onDoubleClick={() => { setEditingTrip(trip); setShowForm(true); }}
                className="grid grid-cols-[100px_1fr_1.2fr_1.2fr_80px_50px_95px_40px] gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors group items-center cursor-pointer select-none"
                title="Double-cliquer pour modifier"
              >
                <span className="text-xs font-medium text-gray-700 tabular-nums">{formatDateShort(trip.date)}</span>
                <span className="text-xs text-gray-700 truncate" title={trip.motif}>{trip.motif || <span className="text-gray-300 italic">aucun motif</span>}</span>
                <span className="min-w-0">
                  <span className="block text-xs text-gray-700 truncate" title={trip.departure}>{trip.departure || '-'}</span>
                  {trip.waypoints?.length > 0 && (
                    <span
                      className="block text-[10px] text-blue-600 truncate"
                      title={trip.waypoints.map((w) => w.label).join(' → ')}
                    >
                      via {trip.waypoints.map((w) => w.label).join(', ')}
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-700 truncate" title={trip.arrival}>{trip.arrival || '-'}</span>
                <span className="text-xs font-bold text-gray-900 tabular-nums text-right">{formatKm(trip.effectiveKm)}</span>
                <span className="text-center">
                  {trip.roundTrip && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">A/R</span>}
                </span>
                <span className="text-xs font-bold text-emerald-700 tabular-nums text-right">{formatEur(trip.amount)}</span>
                <span className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip); }}
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
          expense={expense}
          onSave={handleSaveTrip}
          onClose={() => { setShowForm(false); setEditingTrip(null); }}
        />
      )}
    </div>
  );
};

export default ExpenseNotesMonthView;
