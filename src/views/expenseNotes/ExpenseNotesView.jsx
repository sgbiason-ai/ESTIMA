// src/views/expenseNotes/ExpenseNotesView.jsx
// Vue principale du module Notes de Frais Kilometriques.
// Affiche la grille des 12 mois de l'annee courante OU le detail d'un mois selectionne.

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Car, Plus, Settings } from 'lucide-react';
import { useExpenseNotes } from '../../hooks/useExpenseNotes';
import { calculateAnnualAmount, getActiveTranche, PUISSANCES } from '../../data/baremeFiscal2025';
import ExpenseNotesMonthView from './ExpenseNotesMonthView';
import VehiclesPanel from './VehiclesPanel';

const MONTH_LABELS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const formatEur = (n) => {
  if (!n) return '0 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
};

const formatKm = (n) => `${(n || 0).toLocaleString('fr-FR')} km`;

const ExpenseNotesView = ({ user, companyId, onBackToHub }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null); // 'YYYY-MM' ou null
  const [showVehicles, setShowVehicles] = useState(false);

  const expense = useExpenseNotes(companyId, year);

  // Bootstrap : creer un vehicule par defaut si l'utilisateur n'en a aucun
  useEffect(() => {
    if (!companyId) return;
    if (expense.loading) return;
    if (expense.vehicles.length === 0) {
      expense.addVehicle({
        label: 'Vehicule personnel',
        puissance: 5,
        plateNumber: '',
        isDefault: true,
      });
    }
  }, [companyId, expense.loading, expense.vehicles.length, expense.addVehicle]);

  const yearAmount = useMemo(() => {
    const puissance = expense.defaultVehicle?.puissance || 5;
    return calculateAnnualAmount(expense.yearTotalKm, puissance);
  }, [expense.yearTotalKm, expense.defaultVehicle]);

  const tranche = useMemo(() => getActiveTranche(expense.yearTotalKm), [expense.yearTotalKm]);

  // ── Vue mensuelle (delegation) ────────────────────────────────────────────
  if (selectedMonth) {
    return (
      <ExpenseNotesMonthView
        month={selectedMonth}
        expense={expense}
        onBack={() => setSelectedMonth(null)}
        onBackToHub={onBackToHub}
      />
    );
  }

  // ── Vue annuelle (grille des 12 mois) ─────────────────────────────────────
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
        <div className="flex items-center gap-2">
          <Car size={18} className="text-amber-600" strokeWidth={1.8} />
          <h1 className="font-bold text-lg text-gray-900 tracking-tight">Notes de Frais</h1>
          <span className="text-xs text-gray-400 font-medium">Kilometriques</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowVehicles(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all text-xs font-medium"
        >
          <Settings size={14} />
          Vehicules
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Header annuel */}
        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setYear((y) => y - 1)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Annee precedente"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-3xl font-bold tracking-tight">{year}</h2>
              <button
                onClick={() => setYear((y) => y + 1)}
                disabled={year >= today.getFullYear()}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Annee suivante"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {expense.defaultVehicle ? (
                <span className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 font-semibold">
                  {expense.defaultVehicle.label} · {PUISSANCES.find((p) => p.value === expense.defaultVehicle.puissance)?.label || `${expense.defaultVehicle.puissance} CV`}
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl">Aucun vehicule</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">Total Annuel</div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatKm(expense.yearTotalKm)}</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Montant Deductible</div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatEur(yearAmount)}</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
              <div className="text-[10px] uppercase font-bold text-violet-600 tracking-widest">Tranche Active</div>
              <div className="text-sm font-bold text-gray-900 mt-1">{tranche.label}</div>
            </div>
          </div>
        </div>

        {/* Grille des 12 mois */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {MONTH_LABELS.map((label, idx) => {
            const m = `${year}-${String(idx + 1).padStart(2, '0')}`;
            const note = expense.notes[m];
            const km = note?.totalKm || 0;
            const trips = note?.trips?.length || 0;
            const isCurrent = m === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const isFuture = year > today.getFullYear() || (year === today.getFullYear() && idx > today.getMonth());

            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`text-left bg-white rounded-2xl border p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  isCurrent ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200/60'
                } ${isFuture ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</div>
                    <div className="text-lg font-bold text-gray-900">{label}</div>
                  </div>
                  {isCurrent && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">En cours</span>
                  )}
                </div>

                {km > 0 ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatKm(km)}</div>
                    <div className="text-xs text-gray-500">{trips} trajet{trips > 1 ? 's' : ''}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-300 py-2">
                    <Plus size={14} />
                    Aucun trajet
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showVehicles && (
        <VehiclesPanel expense={expense} onClose={() => setShowVehicles(false)} />
      )}
    </div>
  );
};

export default ExpenseNotesView;
