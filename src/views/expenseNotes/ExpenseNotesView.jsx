// src/views/expenseNotes/ExpenseNotesView.jsx
// Vue principale du module Notes de Frais Kilometriques.
// Affiche la grille des 12 mois de l'annee courante OU le detail d'un mois selectionne.

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Car, Plus, Settings, Zap, Sliders, MapPin, AlertCircle, Download, Check } from 'lucide-react';
import { useExpenseNotes } from '../../hooks/useExpenseNotes';
import { useBranding } from '../../hooks/useBranding';
import { calculateAnnualAmount, getActiveTranche, getMarginalRate, getRateForTranche, getTrancheLabel, PUISSANCES, DEFAULT_TRANCHE_BREAKS } from '../../data/baremeFiscal2025';
import { getTripTotalKm } from '../../utils/distanceMargin';
import ExpenseNotesMonthView from './ExpenseNotesMonthView';
import VehiclesPanel from './VehiclesPanel';
import LocationsPanel from './LocationsPanel';
import DistanceMarginsModal from './DistanceMarginsModal';

const MONTH_LABELS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const formatEur = (n) => {
  if (!n) return '0 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
};

const formatKm = (n) => `${(n || 0).toLocaleString('fr-FR')} km`;

const ExpenseNotesView = ({ user, companyId, onBackToHub, masterBranding }) => {
  const branding = useBranding(masterBranding, null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null); // 'YYYY-MM' ou null
  const [showVehicles, setShowVehicles] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showMargins, setShowMargins] = useState(false);

  // Migration des anciennes donnees partagees (chemins pre-V2.5.x) vers per-user.
  // Le bandeau s'affiche tant que l'utilisateur n'a aucune note ni adresse,
  // ou apres declenchement, jusqu'a dismiss.
  const [migrationStatus, setMigrationStatus] = useState('idle'); // idle | running | done | error
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  const expense = useExpenseNotes(companyId, year, user?.uid);

  // Bootstrap : creer un vehicule par defaut UNIQUEMENT apres le 1er snapshot
  // Firestore (sinon on cree des doublons en boucle a chaque reload pendant
  // la milliseconde ou vehicles est encore vide cote client).
  useEffect(() => {
    if (!companyId) return;
    if (!expense.vehiclesLoaded) return;
    if (expense.vehicles.length > 0) return;
    expense.addVehicle({
      label: 'Vehicule personnel',
      puissance: 5,
      plateNumber: '',
      isDefault: true,
    });
  }, [companyId, expense.vehiclesLoaded, expense.vehicles.length, expense.addVehicle]);

  const puissance = expense.defaultVehicle?.puissance || 5;
  const isElectric = expense.defaultVehicle?.isElectric || false;
  const customBareme = expense.customBareme;
  const forcedTranche = expense.forcedTranche;
  const margins = expense.distanceMargins;
  const marginsEnabled = expense.distanceMarginsEnabled;

  // Sommes effectives par mois (avec A/R + majoration courante)
  const effectiveMonthlyKm = useMemo(() => {
    const map = {};
    for (let i = 0; i < 12; i++) {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`;
      const monthTrips = expense.notes[m]?.trips || [];
      map[m] = monthTrips.reduce((s, t) => s + getTripTotalKm(t, margins, marginsEnabled), 0);
    }
    return map;
  }, [expense.notes, year, margins, marginsEnabled]);

  const effectiveYearKm = useMemo(
    () => Object.values(effectiveMonthlyKm).reduce((s, k) => s + k, 0),
    [effectiveMonthlyKm],
  );

  const maxMonthKm = useMemo(
    () => Math.max(0, ...Object.values(effectiveMonthlyKm)),
    [effectiveMonthlyKm],
  );

  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Index de la tranche fiscale active selon le cumul annuel et les breaks
  // (custom si actif, sinon DEFAULT_TRANCHE_BREAKS = [5000, 20000])
  const trancheBreaks = customBareme?.enabled && customBareme?.breaks?.length === 2
    ? customBareme.breaks
    : DEFAULT_TRANCHE_BREAKS;
  const activeTrancheIdx = effectiveYearKm <= trancheBreaks[0]
    ? 0
    : effectiveYearKm <= trancheBreaks[1] ? 1 : 2;

  // Si tranche forcee : taux fixe applique a tous les trajets (km × rate)
  // Sinon : differentiel des cumuls annuels (mode default fiscalement exact)
  const ratePerKm = useMemo(() => {
    if (forcedTranche !== null) {
      return getRateForTranche(forcedTranche, puissance, customBareme, isElectric);
    }
    return getMarginalRate(effectiveYearKm, puissance, customBareme, isElectric);
  }, [forcedTranche, puissance, customBareme, isElectric, effectiveYearKm]);

  const yearAmount = useMemo(() => {
    if (forcedTranche !== null) {
      return effectiveYearKm * ratePerKm;
    }
    return calculateAnnualAmount(effectiveYearKm, puissance, customBareme, isElectric);
  }, [forcedTranche, effectiveYearKm, ratePerKm, puissance, customBareme, isElectric]);

  const trancheLabel = useMemo(() => {
    if (forcedTranche !== null) return getTrancheLabel(forcedTranche, customBareme);
    return getActiveTranche(effectiveYearKm, customBareme).label;
  }, [forcedTranche, effectiveYearKm, customBareme]);

  const handleTrancheChange = async (e) => {
    const v = e.target.value;
    if (v === 'auto') {
      await expense.setForcedTranche(year, null);
    } else {
      await expense.setForcedTranche(year, Number(v));
    }
  };

  const handleMigrate = async () => {
    if (migrationStatus === 'running' || migrationStatus === 'done') return;
    setMigrationStatus('running');
    try {
      const result = await expense.migrateLegacyData();
      setMigrationResult(result);
      setMigrationStatus('done');
    } catch (e) {
      console.error('[ExpenseNotes] Migration echouee:', e);
      setMigrationResult({ error: e?.code || e?.message || 'erreur inconnue' });
      setMigrationStatus('error');
    }
  };

  const notesCount = Object.keys(expense.notes || {}).length;
  const locationsCount = expense.locations?.length || 0;
  // Affiche le bandeau si l'utilisateur n'a encore rien (cas perte donnees),
  // ou pendant/apres une migration, jusqu'a dismiss.
  const showMigrationBanner = !migrationDismissed && (
    migrationStatus !== 'idle' ||
    (notesCount === 0 && locationsCount === 0)
  );

  // Montant par mois (utilise km effectif avec A/R + majoration)
  const monthlyAmounts = useMemo(() => {
    const map = {};
    if (forcedTranche !== null) {
      for (let i = 0; i < 12; i++) {
        const m = `${year}-${String(i + 1).padStart(2, '0')}`;
        map[m] = (effectiveMonthlyKm[m] || 0) * ratePerKm;
      }
    } else {
      let running = 0;
      for (let i = 0; i < 12; i++) {
        const m = `${year}-${String(i + 1).padStart(2, '0')}`;
        const km = effectiveMonthlyKm[m] || 0;
        const before = running;
        running += km;
        map[m] = calculateAnnualAmount(running, puissance, customBareme, isElectric)
               - calculateAnnualAmount(before, puissance, customBareme, isElectric);
      }
    }
    return map;
  }, [effectiveMonthlyKm, forcedTranche, year, puissance, customBareme, isElectric, ratePerKm]);

  // ── Vue mensuelle (delegation) ────────────────────────────────────────────
  if (selectedMonth) {
    return (
      <ExpenseNotesMonthView
        month={selectedMonth}
        expense={expense}
        branding={branding}
        user={user}
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
          onClick={() => setShowLocations(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all text-xs font-medium"
          title="Gerer les adresses favorites (domicile, chantiers...)"
        >
          <MapPin size={14} />
          Adresses
          {expense.locations?.length > 0 && (
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">{expense.locations.length}</span>
          )}
        </button>
        <button
          onClick={() => setShowMargins(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-xs font-medium ${
            expense.distanceMarginsEnabled && expense.distanceMargins?.length > 0
              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="Configurer la majoration automatique des distances"
        >
          <Sliders size={14} />
          Majoration km
        </button>
        <button
          onClick={() => setShowVehicles(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all text-xs font-medium"
        >
          <Settings size={14} />
          Vehicules
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Bandeau migration anciennes donnees partagees -> per-user */}
        {showMigrationBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-sm">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-900 text-sm">Anciennes donnees disponibles</div>
              <div className="text-xs text-amber-800 mt-1">
                Les notes de frais sont maintenant isolees par utilisateur. Tes trajets,
                vehicules et adresses saisis avant cette mise a jour sont toujours stockes
                au niveau de l'entreprise. Clique sur <strong>Recuperer</strong> pour les
                copier vers ton compte personnel (les originaux sont conserves).
              </div>
              {migrationStatus === 'done' && migrationResult && (
                <div className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-start gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <div>
                    <strong>Migration reussie.</strong> Recuperes : {migrationResult.notes} note(s) mensuelle(s),
                    {' '}{migrationResult.vehicles} vehicule(s), {migrationResult.locations} adresse(s),
                    {' '}{migrationResult.yearSettings} reglage(s) annuel(s).
                    {(migrationResult.notes + migrationResult.vehicles + migrationResult.locations + migrationResult.yearSettings) === 0 && (
                      <span className="block mt-1 italic">Aucune donnee a l'ancien emplacement — rien a recuperer.</span>
                    )}
                  </div>
                </div>
              )}
              {migrationStatus === 'error' && migrationResult?.error && (
                <div className="mt-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-2.5">
                  <strong>Erreur :</strong> {migrationResult.error}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={handleMigrate}
                disabled={migrationStatus === 'running' || migrationStatus === 'done'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {migrationStatus === 'running' ? (
                  <>Migration...</>
                ) : migrationStatus === 'done' ? (
                  <><Check size={12} strokeWidth={3} /> Termine</>
                ) : (
                  <><Download size={12} strokeWidth={2.5} /> Recuperer</>
                )}
              </button>
              <button
                onClick={() => setMigrationDismissed(true)}
                className="px-3 py-1.5 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-100 transition-colors"
              >
                {migrationStatus === 'done' ? 'Fermer' : 'Masquer'}
              </button>
            </div>
          </div>
        )}

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
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 font-semibold">
                  {expense.defaultVehicle.label} · {PUISSANCES.find((p) => p.value === expense.defaultVehicle.puissance)?.label || `${expense.defaultVehicle.puissance} CV`}
                  {isElectric && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      <Zap size={9} fill="currentColor" /> +20%
                    </span>
                  )}
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl">Aucun vehicule</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">Total Annuel</div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatKm(effectiveYearKm)}</div>
              <div className="text-[10px] text-blue-400 mt-1 italic">
                {effectiveYearKm > 0
                  ? `km effectifs ${marginsEnabled && margins?.length > 0 ? '(A/R + majoration)' : '(A/R inclus)'}`
                  : 'Aucun trajet'}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Montant Deductible</div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatEur(yearAmount)}</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase font-bold text-violet-600 tracking-widest">Tranche Active</div>
                {forcedTranche !== null && (
                  <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded uppercase tracking-wider">forcee</span>
                )}
              </div>
              <select
                value={forcedTranche === null ? 'auto' : String(forcedTranche)}
                onChange={handleTrancheChange}
                className="w-full mt-1 px-2 py-1 bg-white/80 border border-violet-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 cursor-pointer"
              >
                <option value="auto">Auto (selon cumul saisi)</option>
                <option value="0">{getTrancheLabel(0, customBareme)}</option>
                <option value="1">{getTrancheLabel(1, customBareme)}</option>
                <option value="2">{getTrancheLabel(2, customBareme)}</option>
              </select>
              <div className="text-[11px] font-bold text-violet-700 tabular-nums mt-1.5">
                {ratePerKm.toFixed(3)} € / km
                {isElectric && <span className="ml-1 text-emerald-600">(+20%)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Évolution mensuelle + progression tranche fiscale */}
        {effectiveYearKm > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Chart : 12 barres mensuelles (lg = 2 cols sur 3) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Évolution mensuelle</h3>
                <span className="text-[10px] text-gray-400 tabular-nums">
                  Pic : {Math.round(maxMonthKm).toLocaleString('fr-FR')} km
                </span>
              </div>
              <div className="flex items-end gap-1.5 h-24">
                {MONTH_LABELS.map((label, i) => {
                  const m = `${year}-${String(i + 1).padStart(2, '0')}`;
                  const km = effectiveMonthlyKm[m] || 0;
                  const amount = monthlyAmounts[m] || 0;
                  const heightPct = maxMonthKm > 0 ? (km / maxMonthKm) * 100 : 0;
                  const isCurrent = m === currentMonth;
                  const isFuture = year > today.getFullYear() || (year === today.getFullYear() && i > today.getMonth());
                  return (
                    <button
                      key={m}
                      onClick={() => !isFuture && setSelectedMonth(m)}
                      disabled={isFuture}
                      className="flex-1 flex flex-col items-stretch gap-1 group disabled:cursor-not-allowed h-full"
                      title={`${label} ${year} : ${formatKm(km)} · ${formatEur(amount)}`}
                    >
                      <div className="flex-1 flex items-end relative">
                        <div
                          className={`w-full rounded-t transition-all ${
                            isCurrent
                              ? 'bg-amber-400 group-hover:bg-amber-500'
                              : isFuture
                                ? 'bg-gray-100'
                                : km > 0
                                  ? 'bg-blue-300 group-hover:bg-blue-500'
                                  : 'bg-gray-100'
                          }`}
                          style={{ height: km > 0 ? `${Math.max(heightPct, 5)}%` : '4px' }}
                        />
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider text-center ${
                        isCurrent ? 'text-amber-700 font-bold' : 'text-gray-400'
                      }`}>
                        {label.slice(0, 3)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progression tranche fiscale */}
            <div className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Progression tranche</h3>
                <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                  T{activeTrancheIdx + 1}
                </span>
              </div>
              {(() => {
                const barMax = Math.max(trancheBreaks[1], effectiveYearKm);
                const fillPct = (effectiveYearKm / barMax) * 100;
                const mark1Pct = (trancheBreaks[0] / barMax) * 100;
                const mark2Pct = (trancheBreaks[1] / barMax) * 100;
                return (
                  <>
                    <div className="text-xl font-bold text-gray-900 tabular-nums mb-3">
                      {formatKm(effectiveYearKm)}
                    </div>
                    <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                      {/* marker 5000 */}
                      <div className="absolute inset-y-0 w-px bg-gray-400/70" style={{ left: `${mark1Pct}%` }} />
                      {/* marker 20000 */}
                      <div className="absolute inset-y-0 w-px bg-gray-400/70" style={{ left: `${mark2Pct}%` }} />
                    </div>
                    <div className="relative h-3 mt-1 text-[9px] text-gray-400 tabular-nums">
                      <span className="absolute" style={{ left: `${mark1Pct}%`, transform: 'translateX(-50%)' }}>
                        {trancheBreaks[0].toLocaleString('fr-FR')}
                      </span>
                      <span className="absolute" style={{ left: `${mark2Pct}%`, transform: 'translateX(-50%)' }}>
                        {trancheBreaks[1].toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
                      {activeTrancheIdx === 0 && (
                        <>Reste <span className="font-bold text-gray-700 tabular-nums">{formatKm(trancheBreaks[0] - effectiveYearKm)}</span> avant la tranche 2</>
                      )}
                      {activeTrancheIdx === 1 && (
                        <>Reste <span className="font-bold text-gray-700 tabular-nums">{formatKm(trancheBreaks[1] - effectiveYearKm)}</span> avant la tranche 3</>
                      )}
                      {activeTrancheIdx === 2 && (
                        <>Tranche maximale atteinte</>
                      )}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Skeleton loader pendant le 1er fetch Firestore */}
        {expense.loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200/60 p-5 animate-pulse">
                <div className="h-3 w-8 bg-gray-200 rounded mb-2" />
                <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
                <div className="h-7 w-24 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Grille des 12 mois */}
        {!expense.loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {MONTH_LABELS.map((label, idx) => {
            const m = `${year}-${String(idx + 1).padStart(2, '0')}`;
            const note = expense.notes[m];
            const km = effectiveMonthlyKm[m] || 0;
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
                    <div className="text-sm font-bold text-emerald-600 tabular-nums">{formatEur(monthlyAmounts[m] || 0)}</div>
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
        )}
      </div>

      {showVehicles && (
        <VehiclesPanel expense={expense} onClose={() => setShowVehicles(false)} />
      )}

      {showLocations && (
        <LocationsPanel expense={expense} onClose={() => setShowLocations(false)} />
      )}

      {showMargins && (
        <DistanceMarginsModal
          rules={expense.distanceMargins}
          enabled={expense.distanceMarginsEnabled}
          onSave={(rules, enabled) => expense.setDistanceMargins(rules, enabled)}
          onClose={() => setShowMargins(false)}
        />
      )}

    </div>
  );
};

export default ExpenseNotesView;
