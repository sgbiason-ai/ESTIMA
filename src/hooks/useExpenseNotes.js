// src/hooks/useExpenseNotes.js
// CRUD + temps reel pour le module Notes de Frais Kilometriques (admin uniquement).
//
// Stockage Firestore :
//   /companies/{cId}/expenseNotes/{YYYY-MM}      — un doc par mois (trips[])
//   /companies/{cId}/vehicles/{vehicleId}        — vehicules avec puissance fiscale
//   /companies/{cId}/expenseLocations/{id}       — adresses favorites (incl. domicile)

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const monthId = (year, monthIdx0) => `${year}-${String(monthIdx0 + 1).padStart(2, '0')}`;

export function useExpenseNotes(companyId, year) {
  const [notes, setNotes] = useState({});       // { 'YYYY-MM': { id, trips, totalKm, ... } }
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [locations, setLocations] = useState([]);
  const [yearSettings, setYearSettings] = useState({}); // { 'YYYY': { priorKm, forcedTranche } }
  const [globalSettings, setGlobalSettings] = useState({}); // { distanceMargins, distanceMarginsEnabled, ... }
  const [loading, setLoading] = useState(true);

  // ── Sub : notes du mois pour l'annee selectionnee ─────────────────────────
  useEffect(() => {
    if (!companyId || !year) {
      setNotes({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const yearStr = String(year);
    const q = query(
      collection(db, 'companies', companyId, 'expenseNotes'),
      where('month', '>=', `${yearStr}-01`),
      where('month', '<=', `${yearStr}-12`),
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
      setNotes(map);
      setLoading(false);
    }, (err) => {
      console.error('[ExpenseNotes] notes snapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, year]);

  // ── Sub : vehicules ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) { setVehicles([]); setVehiclesLoaded(false); return; }
    setVehiclesLoaded(false);
    const unsub = onSnapshot(collection(db, 'companies', companyId, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setVehiclesLoaded(true);
    }, (err) => console.error('[ExpenseNotes] vehicles snapshot error', err));
    return () => unsub();
  }, [companyId]);

  // ── Sub : adresses favorites ──────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) { setLocations([]); return; }
    const unsub = onSnapshot(collection(db, 'companies', companyId, 'expenseLocations'), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('[ExpenseNotes] locations snapshot error', err));
    return () => unsub();
  }, [companyId]);

  // ── Sub : reglages par annee (priorKm pour cumul initial) ─────────────────
  useEffect(() => {
    if (!companyId) { setYearSettings({}); return; }
    const unsub = onSnapshot(collection(db, 'companies', companyId, 'expenseYearSettings'), (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      setYearSettings(map);
    }, (err) => console.error('[ExpenseNotes] yearSettings snapshot error', err));
    return () => unsub();
  }, [companyId]);

  // ── Sub : reglages globaux (majorations distances, etc.) ──────────────────
  useEffect(() => {
    if (!companyId) { setGlobalSettings({}); return; }
    const ref = doc(db, 'companies', companyId, 'expenseSettings', 'main');
    const unsub = onSnapshot(ref, (snap) => {
      setGlobalSettings(snap.exists() ? snap.data() : {});
    }, (err) => console.error('[ExpenseNotes] globalSettings snapshot error', err));
    return () => unsub();
  }, [companyId]);

  const distanceMargins = useMemo(() => globalSettings.distanceMargins || [], [globalSettings]);
  const distanceMarginsEnabled = useMemo(() => globalSettings.distanceMarginsEnabled !== false, [globalSettings]);

  const setDistanceMargins = useCallback(async (rules, enabled) => {
    if (!companyId) return;
    const ref = doc(db, 'companies', companyId, 'expenseSettings', 'main');
    await setDoc(ref, {
      distanceMargins: rules,
      distanceMarginsEnabled: enabled,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [companyId]);

  const customBareme = useMemo(() => yearSettings[String(year)]?.customBareme || null, [yearSettings, year]);

  // forcedTranche : index 0/1/2 pour fixer la tranche fiscale appliquee aux
  // trajets, ou null pour auto (selon cumul saisi).
  const forcedTranche = useMemo(() => {
    const v = yearSettings[String(year)]?.forcedTranche;
    return (v === 0 || v === 1 || v === 2) ? v : null;
  }, [yearSettings, year]);

  const setForcedTranche = useCallback(async (yr, value) => {
    if (!companyId) return;
    const ref = doc(db, 'companies', companyId, 'expenseYearSettings', String(yr));
    // null pour reinitialiser
    await setDoc(ref, { forcedTranche: value === null ? null : Number(value), updatedAt: serverTimestamp() }, { merge: true });
  }, [companyId]);

  const setCustomBareme = useCallback(async (yr, bareme) => {
    if (!companyId) return;
    const ref = doc(db, 'companies', companyId, 'expenseYearSettings', String(yr));
    await setDoc(ref, { customBareme: bareme, updatedAt: serverTimestamp() }, { merge: true });
  }, [companyId]);

  // ── Helpers note (trajets) ────────────────────────────────────────────────
  const upsertNote = useCallback(async (month, patch) => {
    if (!companyId) return;
    const ref = doc(db, 'companies', companyId, 'expenseNotes', month);
    await setDoc(ref, { ...patch, month, updatedAt: serverTimestamp() }, { merge: true });
  }, [companyId]);

  const recomputeTotals = (trips) => {
    const totalKm = trips.reduce((s, t) => s + (Number(t.km) || 0), 0);
    return { trips, totalKm };
  };

  const addTrip = useCallback(async (month, trip) => {
    const note = notes[month] || { trips: [] };
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newTrip = { ...trip, id };
    const { trips, totalKm } = recomputeTotals([...(note.trips || []), newTrip]);
    await upsertNote(month, { trips, totalKm });
    return id;
  }, [notes, upsertNote]);

  const updateTrip = useCallback(async (month, tripId, patch) => {
    const note = notes[month];
    if (!note) return;
    const { trips, totalKm } = recomputeTotals(
      (note.trips || []).map((t) => (t.id === tripId ? { ...t, ...patch } : t))
    );
    await upsertNote(month, { trips, totalKm });
  }, [notes, upsertNote]);

  const deleteTrip = useCallback(async (month, tripId) => {
    const note = notes[month];
    if (!note) return;
    const { trips, totalKm } = recomputeTotals((note.trips || []).filter((t) => t.id !== tripId));
    await upsertNote(month, { trips, totalKm });
  }, [notes, upsertNote]);

  const setNoteVehicle = useCallback(async (month, vehicleId) => {
    await upsertNote(month, { vehicleId });
  }, [upsertNote]);

  // ── Cumul annuel ──────────────────────────────────────────────────────────
  const sortedMonths = useMemo(() => Object.keys(notes).sort(), [notes]);

  const getCumulBeforeMonth = useCallback((month) => {
    let cumul = 0;
    for (const m of sortedMonths) {
      if (m >= month) break;
      cumul += notes[m]?.totalKm || 0;
    }
    return cumul;
  }, [notes, sortedMonths]);

  const getCumulToMonth = useCallback((month) => {
    return getCumulBeforeMonth(month) + (notes[month]?.totalKm || 0);
  }, [notes, getCumulBeforeMonth]);

  // Total km saisi dans l'app sur l'annee
  const yearLoggedKm = useMemo(
    () => sortedMonths.reduce((s, m) => s + (notes[m]?.totalKm || 0), 0),
    [notes, sortedMonths],
  );

  // Alias historique
  const yearTotalKm = yearLoggedKm;

  // ── CRUD Vehicules ────────────────────────────────────────────────────────
  const addVehicle = useCallback(async (data) => {
    if (!companyId) return;
    return addDoc(collection(db, 'companies', companyId, 'vehicles'), {
      ...data, createdAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateVehicle = useCallback(async (id, patch) => {
    if (!companyId) return;
    return updateDoc(doc(db, 'companies', companyId, 'vehicles', id), patch);
  }, [companyId]);

  const deleteVehicle = useCallback(async (id) => {
    if (!companyId) return;
    return deleteDoc(doc(db, 'companies', companyId, 'vehicles', id));
  }, [companyId]);

  // ── CRUD Adresses favorites ───────────────────────────────────────────────
  const addLocation = useCallback(async (data) => {
    if (!companyId) return;
    return addDoc(collection(db, 'companies', companyId, 'expenseLocations'), {
      ...data, createdAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateLocation = useCallback(async (id, patch) => {
    if (!companyId) return;
    return updateDoc(doc(db, 'companies', companyId, 'expenseLocations', id), patch);
  }, [companyId]);

  const deleteLocation = useCallback(async (id) => {
    if (!companyId) return;
    return deleteDoc(doc(db, 'companies', companyId, 'expenseLocations', id));
  }, [companyId]);

  // Vehicule par defaut (premier marque isDefault, sinon premier de la liste)
  const defaultVehicle = useMemo(() => {
    return vehicles.find((v) => v.isDefault) || vehicles[0] || null;
  }, [vehicles]);

  // Domicile (premiere adresse marquee isHome)
  const homeLocation = useMemo(() => locations.find((l) => l.isHome) || null, [locations]);

  // ── Trajets recurrents : creation en lot a partir d'un trajet template ────
  // Genere un id unique pour chaque trajet, regroupe par mois pour minimiser
  // les writes Firestore (1 write par mois touché).
  const addRecurringTrips = useCallback(async (baseTrip, dates) => {
    if (!Array.isArray(dates) || dates.length === 0) return;
    const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Group by month YYYY-MM
    const byMonth = new Map();
    for (const date of dates) {
      const m = String(date).slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(date);
    }

    // Sequentiel pour eviter les races sur le meme mois
    for (const [m, monthDates] of byMonth.entries()) {
      const existing = notes[m]?.trips || [];
      const newTrips = monthDates.map((date) => ({
        ...baseTrip,
        id: newId(),
        date,
      }));
      const merged = [...existing, ...newTrips];
      const totalKm = merged.reduce((s, t) => s + (Number(t.km) || 0), 0);
      await upsertNote(m, { trips: merged, totalKm });
    }
  }, [notes, upsertNote]);

  return {
    notes, vehicles, vehiclesLoaded, locations, loading,
    defaultVehicle, homeLocation,
    yearTotalKm, yearLoggedKm,
    forcedTranche, setForcedTranche,
    customBareme, setCustomBareme,
    distanceMargins, distanceMarginsEnabled, setDistanceMargins,
    addTrip, updateTrip, deleteTrip, setNoteVehicle,
    addRecurringTrips,
    getCumulBeforeMonth, getCumulToMonth,
    addVehicle, updateVehicle, deleteVehicle,
    addLocation, updateLocation, deleteLocation,
  };
}

export const monthIdFor = monthId;
