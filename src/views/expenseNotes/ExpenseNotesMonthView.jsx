// src/views/expenseNotes/ExpenseNotesMonthView.jsx
// Detail d'une note de frais mensuelle : tableau des trajets + ajout/edition.

import React, { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { Plus, Trash2, ArrowLeft, FileDown, Search, Copy, X, Calendar, Car as CarIcon, Map as MapIcon, ChevronDown } from 'lucide-react';
import { calculateMonthAmount, calculateAnnualAmount, getActiveTranche, getMarginalRate, getRateForTranche, getTrancheLabel, PUISSANCES } from '../../data/baremeFiscal2025';
import { getTripTotalKm } from '../../utils/distanceMargin';
import { getHolidayLabel, getWeekendName } from '../../utils/frenchHolidays';
import { getMotifColor } from '../../utils/motifColors';
import TripFormModal from './TripFormModal';
import MonthTripsMap from '../../components/expenseNotes/MonthTripsMap';
import { confirm, toast } from '../../utils/globalUI';
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

const formatDateLong = (iso) => {
  if (!iso) return 'Sans date';
  const date = new Date(iso + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
};

const todayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalize = (s) => (s || '').toString().toLowerCase().trim();

const ExpenseNotesMonthView = ({ month, expense, branding, user, onBack, onBackToHub }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMotifFilter, setActiveMotifFilter] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [editingKmTripId, setEditingKmTripId] = useState(null);
  const [editingKmValue, setEditingKmValue] = useState('');
  const [recentlyTouchedId, setRecentlyTouchedId] = useState(null);
  const searchInputRef = useRef(null);

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

  // Liste des motifs uniques presents dans le mois (pour les filtres)
  const allMotifs = useMemo(() => {
    const set = new Set();
    for (const t of tripsWithAmount) {
      const m = (t.motif || '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [tripsWithAmount]);

  // Filtrage : recherche texte + motif actif
  const filteredTrips = useMemo(() => {
    const q = normalize(searchQuery);
    return tripsWithAmount.filter((t) => {
      if (activeMotifFilter && (t.motif || '').trim() !== activeMotifFilter) return false;
      if (!q) return true;
      const haystack = [
        t.motif,
        t.departure,
        t.arrival,
        ...(t.waypoints || []).map((w) => w?.label),
      ].map(normalize).join(' | ');
      return haystack.includes(q);
    });
  }, [tripsWithAmount, searchQuery, activeMotifFilter]);

  // Groupement par date (Lundi 5 mai → [trajets...])
  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const t of filteredTrips) {
      const d = t.date || '';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(t);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTrips]);

  const filteredKm = useMemo(
    () => filteredTrips.reduce((s, t) => s + (t.effectiveKm || 0), 0),
    [filteredTrips],
  );
  const filteredAmount = useMemo(
    () => filteredTrips.reduce((s, t) => s + (t.amount || 0), 0),
    [filteredTrips],
  );

  const isFiltering = Boolean(searchQuery.trim() || activeMotifFilter);
  const clearFilters = () => { setSearchQuery(''); setActiveMotifFilter(null); };

  // Raccourcis clavier : N (nouveau), / (recherche), ESC (fermer/clear)
  // Skip si focus dans un input/textarea ou si une modale est ouverte (sauf ESC)
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

      // ESC : ferme le modal s'il est ouvert, sinon vide les filtres si actifs
      if (e.key === 'Escape') {
        if (showForm) return; // le modal gère son propre ESC
        if (isFiltering) {
          e.preventDefault();
          clearFilters();
        }
        return;
      }

      if (showForm) return;            // pas d'autres raccourcis quand le modal est ouvert
      if (isTyping) return;             // on n'intercepte pas pendant la frappe

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingTrip(null);
        setShowForm(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showForm, isFiltering]);

  const handleSaveTrip = (data, recurrence) => {
    // Fermeture optimiste : on ferme le modal immediatement et on ecrit en
    // arriere-plan (le write Firestore peut prendre 200-500ms). En cas
    // d'echec, toast d'erreur ; l'utilisateur peut re-saisir.
    // wasEditing : on edite si l'editingTrip a un id (sinon c'est un nouveau /
    // une duplication).
    const wasEditing = Boolean(editingTrip?.id);
    const editId = editingTrip?.id;
    setShowForm(false);
    setEditingTrip(null);

    let promise;
    if (wasEditing) {
      promise = expense.updateTrip(month, editId, data).then(() => {
        // Highlight la ligne mise a jour pendant 1.8s
        setRecentlyTouchedId(editId);
        setTimeout(() => setRecentlyTouchedId((id) => id === editId ? null : id), 1800);
      });
    } else if (recurrence?.dates?.length > 1) {
      // Recurrence : on supprime la date du baseTrip (ce sera celle de chaque
      // occurrence) et on laisse le hook generer les ids + repartir par mois.
      const { date: _ignoredDate, ...baseTrip } = data;
      promise = expense.addRecurringTrips(baseTrip, recurrence.dates).then(() => {
        toast.success(`${recurrence.dates.length} trajets créés`);
      });
    } else {
      promise = expense.addTrip(month, data).then((newId) => {
        if (newId) {
          setRecentlyTouchedId(newId);
          setTimeout(() => setRecentlyTouchedId((id) => id === newId ? null : id), 1800);
        }
      });
    }

    promise.catch((err) => {
      console.error('[ExpenseNotes] save trip failed', err);
      toast.error(`Échec de la sauvegarde : ${err?.message || err}`);
    });
  };

  const handleDeleteTrip = async (trip) => {
    const ok = await confirm(`Supprimer le trajet du ${formatDateShort(trip.date)} ?`, { danger: true });
    if (ok) await expense.deleteTrip(month, trip.id);
  };

  // Dupliquer un trajet : reprend toutes les donnees (depart/arrivee/etapes/km
  // /motif...) sauf l'id et la date (qui devient celle du jour). L'utilisateur
  // peut ensuite ajuster avant d'enregistrer.
  const handleDuplicateTrip = (trip) => {
    const copy = { ...trip, id: undefined, date: todayIso() };
    setEditingTrip(copy);
    setShowForm(true);
  };

  // Inline edit du km : passe la cellule en input, save sur Enter/blur, ESC = cancel
  const startEditKm = (trip) => {
    setEditingKmTripId(trip.id);
    setEditingKmValue(String(trip.km || ''));
  };
  const cancelEditKm = () => {
    setEditingKmTripId(null);
    setEditingKmValue('');
  };
  const commitEditKm = (trip) => {
    const num = Number(String(editingKmValue).replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      cancelEditKm();
      return;
    }
    if (num !== Number(trip.km)) {
      // On marque kmManualOverride = true car l'edition manuelle court-circuite
      // la majoration auto.
      expense.updateTrip(month, trip.id, { km: num, kmManualOverride: true })
        .catch((err) => {
          console.error('[ExpenseNotes] inline edit km failed', err);
          toast.error(`Échec de la mise à jour : ${err?.message || err}`);
        });
    }
    cancelEditKm();
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

        {/* Carte du mois (panneau dépliable) */}
        {tripsWithAmount.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowMap((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200/60 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700 shadow-sm"
              title="Voir tous les trajets du mois sur une carte"
            >
              <MapIcon size={14} className="text-blue-500" />
              {showMap ? 'Masquer la carte' : 'Voir la carte du mois'}
              <ChevronDown size={13} className={`transition-transform ${showMap ? 'rotate-180' : ''} text-gray-400`} />
              <span className="text-[10px] text-gray-400 ml-1">
                {tripsWithAmount.filter((t) => t.departureGeo?.lat != null || t.routeCoords?.length).length} géolocalisés
              </span>
            </button>
            {showMap && (
              <div className="mt-3">
                <MonthTripsMap trips={tripsWithAmount} />
              </div>
            )}
          </div>
        )}

        {/* Toolbar : recherche + filtres motif */}
        {tripsWithAmount.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-3 mb-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un motif, lieu, étape... (raccourci : /)"
                className="w-full pl-9 pr-9 py-2 bg-gray-100 border border-gray-200/60 rounded-xl text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  title="Effacer la recherche"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {allMotifs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {allMotifs.map((mt) => {
                  const active = activeMotifFilter === mt;
                  return (
                    <button
                      key={mt}
                      onClick={() => setActiveMotifFilter(active ? null : mt)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {mt}
                    </button>
                  );
                })}
              </div>
            )}

            {isFiltering && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:bg-gray-100 transition-colors"
                title="Réinitialiser les filtres"
              >
                <X size={11} />
                Effacer
              </button>
            )}

            {isFiltering && (
              <span className="ml-auto text-[11px] text-gray-500 tabular-nums">
                {filteredTrips.length} trajet{filteredTrips.length > 1 ? 's' : ''} · {formatKm(filteredKm)} · {formatEur(filteredAmount)}
              </span>
            )}
          </div>
        )}

        {/* Tableau trajets — groupes par date */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
          {tripsWithAmount.length > 0 && (
            <div className="grid grid-cols-[1fr_1.2fr_1.2fr_80px_50px_95px_72px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <span>Motif</span>
              <span>Départ</span>
              <span>Arrivée</span>
              <span className="text-right">KM</span>
              <span className="text-center">A/R</span>
              <span className="text-right">Montant</span>
              <span />
            </div>
          )}

          {tripsWithAmount.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <CarIcon size={26} className="text-gray-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-gray-700">Aucun trajet ce mois-ci</h3>
              <p className="text-xs text-gray-400 mt-1 mb-4 max-w-[300px]">
                Saisis ton premier trajet pour démarrer cette note de frais.
              </p>
              <button
                onClick={() => { setEditingTrip(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors text-xs font-bold uppercase tracking-wider"
              >
                <Plus size={14} />
                Premier trajet
              </button>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Search size={22} className="text-gray-300 mb-2" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold text-gray-600">Aucun résultat</h3>
              <p className="text-xs text-gray-400 mt-1">Essaie d'élargir la recherche ou retire les filtres.</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-xs font-medium text-blue-600 hover:underline"
              >
                Effacer les filtres
              </button>
            </div>
          ) : (
            groupedByDate.map(([dateStr, dateTrips]) => {
              const dateKm = dateTrips.reduce((s, t) => s + (t.effectiveKm || 0), 0);
              const dateAmount = dateTrips.reduce((s, t) => s + (t.amount || 0), 0);
              const holiday = getHolidayLabel(dateStr);
              const weekendName = !holiday ? getWeekendName(dateStr) : null;
              const headerBg = holiday
                ? 'bg-rose-50/60 border-rose-100'
                : weekendName
                  ? 'bg-amber-50/60 border-amber-100'
                  : 'bg-gray-50/60 border-gray-100';
              return (
                <Fragment key={dateStr}>
                  <div className={`flex items-center gap-3 px-4 py-3 border-b-2 ${headerBg} ${holiday ? 'border-l-4 border-l-rose-400' : weekendName ? 'border-l-4 border-l-amber-400' : ''}`}>
                    <Calendar size={14} className={`shrink-0 ${holiday ? 'text-rose-500' : weekendName ? 'text-amber-600' : 'text-gray-500'}`} />
                    <span className="text-sm font-bold text-gray-900 capitalize tracking-tight">{formatDateLong(dateStr)}</span>
                    {holiday && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                        title={`Jour férié : ${holiday}`}
                      >
                        🎉 {holiday}
                      </span>
                    )}
                    {weekendName && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                        title={`${weekendName} (weekend)`}
                      >
                        🟡 {weekendName}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500 font-medium">
                      {dateTrips.length} trajet{dateTrips.length > 1 ? 's' : ''}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-700 tabular-nums font-bold">
                      {formatKm(dateKm)} · {formatEur(dateAmount)}
                    </span>
                  </div>
                  {dateTrips.map((trip) => (
                    <div
                      key={trip.id}
                      onDoubleClick={() => { setEditingTrip(trip); setShowForm(true); }}
                      className={`grid grid-cols-[1fr_1.2fr_1.2fr_80px_50px_95px_72px] gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors group items-center cursor-pointer select-none ${
                        recentlyTouchedId === trip.id
                          ? 'bg-emerald-50 ring-2 ring-emerald-300/80 animate-[pulse_1s_ease-in-out_2]'
                          : ''
                      }`}
                      title="Double-cliquer pour modifier"
                    >
                      <span className="min-w-0 truncate" title={trip.motif}>
                        {trip.motif ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getMotifColor(trip.motif).tag}`}>
                            {trip.motif}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">aucun motif</span>
                        )}
                      </span>
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
                      {editingKmTripId === trip.id ? (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          autoFocus
                          value={editingKmValue}
                          onChange={(e) => setEditingKmValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => commitEditKm(trip)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEditKm(trip); }
                            else if (e.key === 'Escape') { e.preventDefault(); cancelEditKm(); }
                          }}
                          className="px-1.5 py-1 text-xs font-bold text-right text-gray-900 tabular-nums bg-blue-50 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startEditKm(trip); }}
                          className="text-xs font-bold text-gray-900 tabular-nums text-right hover:bg-blue-50 rounded px-1 py-0.5 -my-0.5 transition-colors"
                          title="Cliquer pour modifier le km (saisie manuelle)"
                        >
                          {formatKm(trip.effectiveKm)}
                        </button>
                      )}
                      <span className="text-center">
                        {trip.roundTrip && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">A/R</span>}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 tabular-nums text-right">{formatEur(trip.amount)}</span>
                      <span className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDuplicateTrip(trip); }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Dupliquer ce trajet (date du jour)"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                  ))}
                </Fragment>
              );
            })
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
