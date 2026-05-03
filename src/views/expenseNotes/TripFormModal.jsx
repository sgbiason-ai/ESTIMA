// src/views/expenseNotes/TripFormModal.jsx
// Phase 2 : autocomplete adresses Nominatim + calcul OSRM automatique + favoris.
// Le user peut toujours ajuster le km manuellement (override OSRM).

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Calendar, Repeat, FileText, Hash, Loader2, MapPin, Home as HomeIcon, TrendingUp, Plus, Trash2, RotateCcw, AlertTriangle, CalendarRange } from 'lucide-react';
import { toast } from '../../utils/globalUI';
import AddressAutocomplete from '../../components/expenseNotes/AddressAutocomplete';
import TripMapPreview from '../../components/expenseNotes/TripMapPreview';
import { calculateRouteDistance, formatDuration } from '../../utils/expenseGeo';
import { applyDistanceMargin, getApplicableMarginPct } from '../../utils/distanceMargin';
import { getHolidayLabel, isWeekend, getWeekendName } from '../../utils/frenchHolidays';

// Motifs preetablis (le user peut taper du libre en plus)
const DEFAULT_MOTIFS = ['Chantier', 'Reunion sur site', 'Visite de site', 'Commerce'];

// Genere la liste des dates ISO (YYYY-MM-DD) entre start (inclus) et until
// (inclus) selon la frequence demandee. Cap a 366 dates (1 an) par sécurité.
function generateRecurringDates(startIso, untilIso, frequency) {
  if (!startIso || !untilIso) return [];
  const start = new Date(startIso + 'T00:00:00');
  const until = new Date(untilIso + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(until.getTime())) return [];
  if (until < start) return [];

  const out = [];
  const cursor = new Date(start);
  let safety = 366;

  const addCurrent = () => {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
  };

  while (cursor <= until && safety-- > 0) {
    if (frequency === 'weekdays') {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) addCurrent();
      cursor.setDate(cursor.getDate() + 1);
    } else {
      addCurrent();
      if (frequency === 'daily') cursor.setDate(cursor.getDate() + 1);
      else if (frequency === 'weekly') cursor.setDate(cursor.getDate() + 7);
      else if (frequency === 'biweekly') cursor.setDate(cursor.getDate() + 14);
      else if (frequency === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
      else break;
    }
  }
  return out;
}

const TripFormModal = ({ month, trip, expense, onSave, onClose }) => {
  const [date, setDate] = useState(trip?.date || `${month}-01`);
  const [motif, setMotif] = useState(trip?.motif || '');
  const [departure, setDeparture] = useState(
    trip?.departureGeo
      ? { label: trip.departure || '', lat: trip.departureGeo.lat, lon: trip.departureGeo.lon }
      : trip?.departure
        ? { label: trip.departure, lat: null, lon: null }
        : null
  );
  const [arrival, setArrival] = useState(
    trip?.arrivalGeo
      ? { label: trip.arrival || '', lat: trip.arrivalGeo.lat, lon: trip.arrivalGeo.lon }
      : trip?.arrival
        ? { label: trip.arrival, lat: null, lon: null }
        : null
  );
  const [waypoints, setWaypoints] = useState(trip?.waypoints || []);
  const [km, setKm] = useState(trip?.km != null ? String(trip.km) : '');
  const [kmManualOverride, setKmManualOverride] = useState(Boolean(trip?.kmManualOverride));
  const [roundTrip, setRoundTrip] = useState(trip?.roundTrip || false);
  const [duration, setDuration] = useState(trip?.durationMin || null);
  const [computing, setComputing] = useState(false);
  const [askSaveHome, setAskSaveHome] = useState(false);
  const [rawKm, setRawKm] = useState(trip?.rawKmOsrm || null); // distance OSRM aller (avec etapes)
  const [estimated, setEstimated] = useState(false); // true si fallback Haversine (OSRM indispo)
  // Geometrie OSRM : Firestore n'accepte pas les arrays imbriques, on stocke
  // donc des [{lat, lon}, ...] et on reconvertit en [[lat, lon], ...] pour Leaflet.
  const objToLatLon = (arr) => Array.isArray(arr) ? arr.map((p) => Array.isArray(p) ? p : [p.lat, p.lon]) : null;
  const [routeCoords, setRouteCoords] = useState(objToLatLon(trip?.routeCoords));
  // Retour direct (A/R + etapes) : retour SANS repasser par les etapes
  const [rawKmReturn, setRawKmReturn] = useState(trip?.rawKmReturn || null);
  const [returnCoords, setReturnCoords] = useState(objToLatLon(trip?.returnCoords));

  // Recurrence : repete ce trajet sur plusieurs dates (jours ouvres / hebdo / etc.)
  // jusqu'a une date de fin. Disponible uniquement pour les nouveaux trajets.
  const [recurEnabled, setRecurEnabled] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState('weekly');
  const [recurUntil, setRecurUntil] = useState('');

  // Dropdown motif (autocomplete custom — remplace le <datalist> natif qui se
  // positionnait n'importe ou selon le navigateur)
  const [motifFocused, setMotifFocused] = useState(false);

  const noHomeYet = !expense.homeLocation;

  // Suggestions motif : defauts + motifs deja utilises dans l'historique
  const motifSuggestions = useMemo(() => {
    const set = new Set(DEFAULT_MOTIFS);
    for (const note of Object.values(expense.notes || {})) {
      for (const t of note.trips || []) {
        const m = (t.motif || '').trim();
        if (m) set.add(m);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [expense.notes]);

  // Frequence des motifs par adresse d'arrivee : "Mairie d'Albi" → {"Chantier": 5, "RDV": 1}
  // Permet de suggerer le motif le plus probable quand l'utilisateur choisit une arrivee.
  const motifByArrival = useMemo(() => {
    const map = new Map();
    for (const note of Object.values(expense.notes || {})) {
      for (const t of note.trips || []) {
        const motif = (t.motif || '').trim();
        const arrLabel = (t.arrival || '').trim().toLowerCase();
        if (!motif || !arrLabel) continue;
        if (!map.has(arrLabel)) map.set(arrLabel, new Map());
        const m = map.get(arrLabel);
        m.set(motif, (m.get(motif) || 0) + 1);
      }
    }
    return map;
  }, [expense.notes]);

  const suggestMotifForArrival = (label) => {
    const key = (label || '').trim().toLowerCase();
    const counts = motifByArrival.get(key);
    if (!counts || counts.size === 0) return null;
    let best = null;
    let bestCount = 0;
    for (const [m, c] of counts) {
      if (c > bestCount) { best = m; bestCount = c; }
    }
    return best;
  };
  // On laisse vide pour qu'a l'ouverture d'un trajet existant, on re-fetche
  // OSRM et qu'on recupere la geometrie pour afficher le vrai trace sur la
  // carte (sinon : ligne droite seulement). Le cache OSRM cote utilitaire
  // rend l'appel quasi-instantane si meme coords.
  const lastComputeKey = useRef('');

  // Pre-remplir le depart avec le domicile si nouvelle saisie + domicile defini
  useEffect(() => {
    if (!trip && !departure && expense.homeLocation) {
      const h = expense.homeLocation;
      setDeparture({ label: h.label, lat: h.lat, lon: h.lon });
    }
  }, [trip, expense.homeLocation]); // eslint-disable-line

  // Effect 1 : fetch OSRM (aller via etapes + eventuellement retour direct si A/R + etapes)
  const validWaypoints = waypoints.filter((w) => w?.lat != null && w?.lon != null);
  const waypointsKey = validWaypoints.map((w) => `${w.lat},${w.lon}`).join('|');

  useEffect(() => {
    if (kmManualOverride) return;
    const fromOk = departure?.lat != null && departure?.lon != null;
    const toOk = arrival?.lat != null && arrival?.lon != null;
    if (!fromOk || !toOk) {
      setDuration(null);
      return;
    }
    const key = `${departure.lat},${departure.lon}|${waypointsKey}|${arrival.lat},${arrival.lon}|${roundTrip ? 'AR' : 'A'}`;
    if (key === lastComputeKey.current) return;
    lastComputeKey.current = key;

    setComputing(true);
    let cancelled = false;

    // Fetch aller (avec etapes)
    const forwardP = calculateRouteDistance(departure, arrival, validWaypoints);
    // Fetch retour direct UNIQUEMENT si A/R coche ET il y a des etapes
    // (sans etape, le retour = aller × 2 calcul automatique cote getTripTotalKm)
    const returnP = (roundTrip && validWaypoints.length > 0)
      ? calculateRouteDistance(arrival, departure, [])
      : Promise.resolve(null);

    Promise.all([forwardP, returnP]).then(([fwd, ret]) => {
      if (cancelled) return;
      setComputing(false);
      if (fwd) {
        setRawKm(fwd.km);
        setDuration(fwd.durationMin);
        setRouteCoords(fwd.coordinates || null);
        // Si l'aller OU le retour est une estimation, on flag
        setEstimated(Boolean(fwd.estimated || ret?.estimated));
      }
      if (ret) {
        setRawKmReturn(ret.km);
        setReturnCoords(ret.coordinates || null);
      } else {
        // Pas de A/R+etapes : nettoyer le retour stocke
        setRawKmReturn(null);
        setReturnCoords(null);
      }
    });
    return () => { cancelled = true; };
  }, [departure?.lat, departure?.lon, arrival?.lat, arrival?.lon, kmManualOverride, waypointsKey, roundTrip]); // eslint-disable-line

  // Effect 2 : applique la majoration courante au rawKm (recompute live quand
  // les regles changent). Sert aussi a la 1ere init quand on ouvre un trajet
  // existant avec son rawKm restaure.
  useEffect(() => {
    if (kmManualOverride) return;
    if (!rawKm) return;
    const finalKm = expense.distanceMarginsEnabled
      ? applyDistanceMargin(rawKm, expense.distanceMargins)
      : rawKm;
    setKm(String(finalKm));
  }, [rawKm, expense.distanceMarginsEnabled, expense.distanceMargins, kmManualOverride]);

  // Pourcentage de majoration appliquee (pour affichage)
  const appliedMarginPct = rawKm && expense.distanceMarginsEnabled
    ? getApplicableMarginPct(rawKm, expense.distanceMargins)
    : 0;
  // Idem pour le retour direct (cas A/R + etapes seulement)
  const appliedMarginPctReturn = rawKmReturn && expense.distanceMarginsEnabled
    ? getApplicableMarginPct(rawKmReturn, expense.distanceMargins)
    : 0;
  const kmReturn = rawKmReturn
    ? (expense.distanceMarginsEnabled
        ? applyDistanceMargin(rawKmReturn, expense.distanceMargins)
        : rawKmReturn)
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const kmNum = Number(String(km).replace(',', '.'));
    if (!date || !kmNum || kmNum <= 0) return;

    // Ne stocker que les etapes valides (avec coords ou texte non vide)
    const cleanWaypoints = waypoints
      .filter((w) => w && (w.label?.trim() || w.lat != null))
      .map((w) => ({
        label: (w.label || '').trim(),
        lat: w.lat ?? null,
        lon: w.lon ?? null,
      }));

    // Firestore ne supporte pas les arrays imbriques → on convertit en objets
    const latLonToObj = (arr) => Array.isArray(arr) ? arr.map(([lat, lon]) => ({ lat, lon })) : null;

    const tripPayload = {
      date,
      motif: motif.trim(),
      departure: departure?.label?.trim() || '',
      arrival: arrival?.label?.trim() || '',
      departureGeo: departure?.lat != null ? { lat: departure.lat, lon: departure.lon } : null,
      arrivalGeo: arrival?.lat != null ? { lat: arrival.lat, lon: arrival.lon } : null,
      waypoints: cleanWaypoints,
      km: kmNum,
      rawKmOsrm: rawKm,                            // aller : distance route brute (avant majoration)
      routeCoords: latLonToObj(routeCoords),        // [{lat, lon}, ...] pour Firestore
      rawKmReturn,                                  // retour direct (A/R + etapes uniquement, sinon null)
      returnCoords: latLonToObj(returnCoords),
      kmManualOverride,
      durationMin: duration,
      roundTrip,
    };

    // Si récurrence activée et nouveau trajet, on passe les dates générées
    // au parent qui se charge du batch insert.
    const recurrence = recurEnabled && !isEdit && recurringDates.length > 1
      ? { dates: recurringDates }
      : null;

    onSave(tripPayload, recurrence);

    // Sauvegarde domicile en background (non-bloquant) : la fermeture du modal
    // est deja faite cote parent (handleSaveTrip optimiste).
    if (askSaveHome && departure?.lat != null) {
      expense.addLocation({
        label: departure.label,
        address: departure.label,
        lat: departure.lat,
        lon: departure.lon,
        isHome: true,
      }).catch((err) => {
        console.warn('[TripForm] save home failed', err);
      });
    }
  };

  const handleSaveFavorite = async (data) => {
    try {
      await expense.addLocation({
        ...data,
        isHome: false,
      });
    } catch (err) {
      console.warn('[TripForm] saveFavorite failed', err);
    }
  };


  const handleKmChange = (e) => {
    setKm(e.target.value);
    setKmManualOverride(true);
  };

  // Edit = trajet existant en base. Une duplication passe un trip pre-rempli
  // SANS id donc isEdit reste false (titre "Nouveau trajet", action "Enregistrer").
  const isEdit = Boolean(trip?.id);

  // Aperçu des dates générées par la récurrence
  const recurringDates = useMemo(
    () => recurEnabled && !isEdit ? generateRecurringDates(date, recurUntil, recurFrequency) : [],
    [recurEnabled, isEdit, date, recurUntil, recurFrequency],
  );

  // Suggestions filtrees selon ce qui est tape dans le champ motif
  const filteredMotifSuggestions = useMemo(() => {
    const q = motif.trim().toLowerCase();
    if (!q) return motifSuggestions;
    return motifSuggestions.filter((s) => s.toLowerCase().includes(q));
  }, [motifSuggestions, motif]);

  // Avertissement weekend / jour férié pour la date du trajet (single)
  const dateWarning = useMemo(() => {
    if (!date) return null;
    const holiday = getHolidayLabel(date);
    if (holiday) return { type: 'holiday', label: holiday };
    const wkName = getWeekendName(date);
    if (wkName) return { type: 'weekend', label: wkName };
    return null;
  }, [date]);

  // Stats weekends / jours fériés sur les dates générées (récurrence)
  const recurringStats = useMemo(() => {
    let weekends = 0;
    const holidays = []; // [{date, label}]
    for (const d of recurringDates) {
      const h = getHolidayLabel(d);
      if (h) holidays.push({ date: d, label: h });
      else if (isWeekend(d)) weekends++;
    }
    return { weekends, holidays };
  }, [recurringDates]);
  const hasWaypoints = validWaypoints.length > 0;
  const kmNum = Number(String(km).replace(',', '.') || 0);
  // Total enregistré : aller (avec majoration) + retour
  //  - Sans étape : retour = aller × 2
  //  - Avec étapes : retour direct (rawKmReturn, avec majoration éventuelle)
  let totalKm = kmNum;
  if (roundTrip) {
    if (hasWaypoints && rawKmReturn) {
      const ret = expense.distanceMarginsEnabled
        ? applyDistanceMargin(rawKmReturn, expense.distanceMargins)
        : rawKmReturn;
      totalKm = kmNum + ret;
    } else {
      totalKm = kmNum * 2;
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden"
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

        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_420px] gap-6">
          <div className="space-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
                <Calendar size={11} /> Date
                {dateWarning && (
                  <span
                    className={`ml-auto normal-case tracking-normal px-1.5 py-0.5 rounded text-[9px] font-bold truncate max-w-[88px] ${
                      dateWarning.type === 'holiday'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}
                    title={dateWarning.type === 'holiday' ? `Jour férié : ${dateWarning.label}` : `${dateWarning.label} (weekend)`}
                  >
                    {dateWarning.type === 'holiday' ? '🎉' : '🟡'} {dateWarning.label}
                  </span>
                )}
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
              <div className="relative">
                <input
                  type="text"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  onFocus={() => setMotifFocused(true)}
                  onBlur={() => setTimeout(() => setMotifFocused(false), 150)}
                  placeholder="Chantier, Reunion sur site…"
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                />
                {motifFocused && filteredMotifSuggestions.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-30">
                    {filteredMotifSuggestions.map((s) => (
                      <li
                        key={s}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setMotif(s);
                          setMotifFocused(false);
                        }}
                        className="px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
              <MapPin size={11} className="text-emerald-600" /> Depart
              {noHomeYet && departure?.lat != null && (
                <button
                  type="button"
                  onClick={() => setAskSaveHome((v) => !v)}
                  className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-colors ${
                    askSaveHome ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                  title="Sauvegarder comme adresse domicile (1ere fois seulement)"
                >
                  <HomeIcon size={9} />
                  {askSaveHome ? 'Sera enregistre comme domicile' : 'Definir comme domicile'}
                </button>
              )}
            </label>
            <AddressAutocomplete
              value={departure}
              onChange={setDeparture}
              favorites={expense.locations}
              placeholder="Toulouse, 12 rue de la Republique…"
              iconColor="text-emerald-500"
              onSaveAsFavorite={handleSaveFavorite}
            />
          </div>

          {/* Etapes intermediaires */}
          {waypoints.map((wp, idx) => (
            <div key={idx}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
                <MapPin size={11} className="text-blue-500" /> Etape {idx + 1}
                <button
                  type="button"
                  onClick={() => setWaypoints((arr) => arr.filter((_, i) => i !== idx))}
                  className="ml-auto p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                  title="Supprimer cette etape"
                >
                  <Trash2 size={11} />
                </button>
              </label>
              <AddressAutocomplete
                value={wp}
                onChange={(val) => setWaypoints((arr) => arr.map((w, i) => (i === idx ? val : w)))}
                favorites={expense.locations}
                placeholder="Etape intermediaire..."
                iconColor="text-blue-500"
                onSaveAsFavorite={handleSaveFavorite}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setWaypoints((arr) => [...arr, null])}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-[11px] font-medium w-fit"
          >
            <Plus size={11} />
            Ajouter une etape
          </button>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
              <MapPin size={11} className="text-rose-600" /> Arrivee
            </label>
            <AddressAutocomplete
              value={arrival}
              onChange={(val) => {
                setArrival(val);
                // Suggestion intelligente : si motif vide et adresse deja utilisee
                // historiquement avec un motif dominant, on le pre-remplit
                if (val?.label && !motif.trim()) {
                  const suggested = suggestMotifForArrival(val.label);
                  if (suggested) setMotif(suggested);
                }
              }}
              favorites={expense.locations}
              placeholder="Albi, Mairie de Castres…"
              iconColor="text-rose-500"
              onSaveAsFavorite={handleSaveFavorite}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-1.5">
                <Hash size={11} /> Distance (km)
                {kmManualOverride && (
                  <button
                    type="button"
                    onClick={() => setKmManualOverride(false)}
                    className="ml-auto text-[9px] font-bold text-blue-600 hover:underline"
                  >
                    Recalculer auto
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={km}
                  onChange={handleKmChange}
                  required
                  placeholder="78.4"
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm tabular-nums pr-12"
                />
                {computing && (
                  <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
                )}
              </div>
            </div>
            <label
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl border border-gray-200/60 cursor-pointer select-none hover:bg-gray-200/50 transition-colors"
              title={
                hasWaypoints
                  ? 'Coché : retour direct depuis l\'arrivée vers le départ (sans repasser par les étapes)'
                  : 'Coché : la distance est doublée (aller-retour)'
              }
            >
              <input
                type="checkbox"
                checked={roundTrip}
                onChange={(e) => setRoundTrip(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              {hasWaypoints ? (
                <>
                  <RotateCcw size={12} className="text-gray-500" />
                  <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Retour au départ</span>
                </>
              ) : (
                <>
                  <Repeat size={12} className="text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">A/R</span>
                </>
              )}
            </label>
          </div>

          {(duration || (roundTrip && km) || appliedMarginPct > 0 || estimated) && (
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-gray-500 italic px-1">
              {estimated && !kmManualOverride && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 not-italic font-medium"
                  title={`Service de routing temporairement indisponible. Distance estimée à vol d'oiseau × ${1.3} (facteur route europe). Tu peux ajuster le km manuellement.`}
                >
                  <AlertTriangle size={11} />
                  Routing indispo — estimation vol d'oiseau ×1.3
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">⏱</span>
                  ~{formatDuration(duration)} {kmManualOverride && '(estimation initiale)'}
                </span>
              )}
              {/* CAS DETAILLE : A/R + etapes (rawKmReturn defini) → aller + retour direct */}
              {roundTrip && hasWaypoints && rawKmReturn && !kmManualOverride ? (
                <>
                  {duration && <span className="text-gray-300">·</span>}
                  <span className="flex items-center gap-1 text-indigo-600 not-italic font-medium">
                    <TrendingUp size={11} />
                    Aller : {rawKm?.toLocaleString('fr-FR')} km
                    {appliedMarginPct > 0 && ` → ${Number(km).toLocaleString('fr-FR')} km (+${appliedMarginPct}%)`}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1 text-indigo-600 not-italic font-medium">
                    <RotateCcw size={11} />
                    Retour direct : {rawKmReturn.toLocaleString('fr-FR')} km
                    {appliedMarginPctReturn > 0 && ` → ${kmReturn.toLocaleString('fr-FR')} km (+${appliedMarginPctReturn}%)`}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="not-italic font-bold text-gray-700">
                    Total : {totalKm.toLocaleString('fr-FR')} km enregistrés
                  </span>
                </>
              ) : (
                <>
                  {/* CAS SIMPLE : majoration sur l'aller seul (avec ou sans doublement) */}
                  {appliedMarginPct > 0 && rawKm && !kmManualOverride && (
                    <>
                      {duration && <span className="text-gray-300">·</span>}
                      <span className="flex items-center gap-1 text-indigo-600 not-italic font-medium">
                        <TrendingUp size={11} />
                        +{appliedMarginPct}% appliqué ({rawKm.toLocaleString('fr-FR')} km → {Number(km).toLocaleString('fr-FR')} km)
                      </span>
                    </>
                  )}
                  {/* Doublement A/R sans etape */}
                  {roundTrip && km && (
                    <>
                      {(duration || appliedMarginPct > 0) && <span className="text-gray-300">·</span>}
                      <span className="not-italic font-bold text-gray-700">
                        A/R : {totalKm.toLocaleString('fr-FR')} km enregistrés
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Récurrence (nouveaux trajets uniquement) */}
          {!isEdit && (
            <div className="rounded-xl border border-gray-200/60 bg-gray-50/50 p-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recurEnabled}
                  onChange={(e) => {
                    setRecurEnabled(e.target.checked);
                    // Pré-remplir une date « jusqu'au » sensée : 1 mois après
                    if (e.target.checked && !recurUntil) {
                      const d = new Date(date + 'T00:00:00');
                      d.setMonth(d.getMonth() + 1);
                      setRecurUntil(d.toISOString().slice(0, 10));
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <CalendarRange size={14} className="text-blue-500" />
                <span className="text-xs font-bold text-gray-700">Répéter ce trajet</span>
                {recurEnabled && recurringDates.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    {recurringDates.length} trajet{recurringDates.length > 1 ? 's' : ''}
                  </span>
                )}
              </label>

              {recurEnabled && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                      Fréquence
                    </label>
                    <select
                      value={recurFrequency}
                      onChange={(e) => setRecurFrequency(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-xl text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    >
                      <option value="daily">Quotidien</option>
                      <option value="weekdays">Jours ouvrés (lun-ven)</option>
                      <option value="weekly">Hebdomadaire (même jour)</option>
                      <option value="biweekly">Toutes les 2 semaines</option>
                      <option value="monthly">Mensuel (même date)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                      Jusqu'au
                    </label>
                    <input
                      type="date"
                      value={recurUntil}
                      min={date}
                      onChange={(e) => setRecurUntil(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-xl text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>
                  {recurringDates.length > 0 && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-[10px] text-gray-500 italic leading-relaxed">
                        <span className="font-bold text-gray-700 not-italic">{recurringDates.length}</span> trajet{recurringDates.length > 1 ? 's' : ''} sera {recurringDates.length > 1 ? 'créés' : 'créé'} : du <span className="tabular-nums">{recurringDates[0]}</span> au <span className="tabular-nums">{recurringDates[recurringDates.length - 1]}</span> {recurringDates.length > 366 && '(plafonné à 366)'}
                      </p>
                      {(recurringStats.weekends > 0 || recurringStats.holidays.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 not-italic">
                          {recurringStats.weekends > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700"
                              title="Trajets tombant un samedi ou un dimanche"
                            >
                              🟡 {recurringStats.weekends} weekend{recurringStats.weekends > 1 ? 's' : ''}
                            </span>
                          )}
                          {recurringStats.holidays.length > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 border border-rose-200 text-rose-700"
                              title={recurringStats.holidays.map((h) => `${h.label} (${h.date})`).join('\n')}
                            >
                              🎉 {recurringStats.holidays.length} jour{recurringStats.holidays.length > 1 ? 's' : ''} férié{recurringStats.holidays.length > 1 ? 's' : ''}
                              {recurringStats.holidays.length <= 3 && (
                                <> : {recurringStats.holidays.map((h) => h.label).join(', ')}</>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {recurringDates.length === 0 && recurUntil && (
                    <p className="col-span-2 text-[10px] text-amber-600 italic">
                      Aucune date générée — vérifie la date de fin et la fréquence.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Colonne droite : carte preview */}
          <div className="md:sticky md:top-0">
            {(departure?.lat != null || arrival?.lat != null || validWaypoints.length > 0) ? (
              <TripMapPreview from={departure} to={arrival} waypoints={waypoints} coordinates={routeCoords} returnCoordinates={returnCoords} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 h-[420px] flex items-center justify-center text-[11px] text-gray-400 italic px-4 text-center">
                Selectionne un depart et une arrivee pour voir le trajet sur la carte.
              </div>
            )}
          </div>
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
            {isEdit ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TripFormModal;
