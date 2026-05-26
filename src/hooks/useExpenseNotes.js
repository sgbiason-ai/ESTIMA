// src/hooks/useExpenseNotes.js
// CRUD + temps reel pour le module Notes de Frais Kilometriques.
// Donnees ISOLEES par utilisateur (chaque user ne voit que ses propres notes).
//
// Stockage Firestore :
//   /companies/{cId}/users/{uid}/expenseNotes/{YYYY-MM}      — un doc par mois (trips[])
//   /companies/{cId}/users/{uid}/vehicles/{vehicleId}        — vehicules personnels
//   /companies/{cId}/users/{uid}/expenseLocations/{id}       — adresses favorites perso
//   /companies/{cId}/users/{uid}/expenseYearSettings/{YYYY}  — reglages annuels perso
//   /companies/{cId}/expenseSettings/main                    — reglages globaux (admin only)

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDocs,
  onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const monthId = (year, monthIdx0) => `${year}-${String(monthIdx0 + 1).padStart(2, '0')}`;

export function useExpenseNotes(companyId, year, uid) {
  const [notes, setNotes] = useState({});       // { 'YYYY-MM': { id, trips, totalKm, ... } }
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [locations, setLocations] = useState([]);
  const [yearSettings, setYearSettings] = useState({}); // { 'YYYY': { priorKm, forcedTranche } }
  const [globalSettings, setGlobalSettings] = useState({}); // { distanceMargins, distanceMarginsEnabled, ... }
  const [loading, setLoading] = useState(true);

  // ── Sub : notes du mois pour l'annee selectionnee ─────────────────────────
  useEffect(() => {
    if (!companyId || !year || !uid) {
      setNotes({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const yearStr = String(year);
    const q = query(
      collection(db, 'companies', companyId, 'users', uid, 'expenseNotes'),
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
  }, [companyId, year, uid]);

  // ── Sub : vehicules ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId || !uid) { setVehicles([]); setVehiclesLoaded(false); return; }
    setVehiclesLoaded(false);
    const unsub = onSnapshot(collection(db, 'companies', companyId, 'users', uid, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setVehiclesLoaded(true);
    }, (err) => console.error('[ExpenseNotes] vehicles snapshot error', err));
    return () => unsub();
  }, [companyId, uid]);

  // ── Sub : adresses favorites ──────────────────────────────────────────────
  useEffect(() => {
    if (!companyId || !uid) { setLocations([]); return; }
    const unsub = onSnapshot(collection(db, 'companies', companyId, 'users', uid, 'expenseLocations'), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('[ExpenseNotes] locations snapshot error', err));
    return () => unsub();
  }, [companyId, uid]);

  // ── Sub : reglages par annee (priorKm pour cumul initial) ─────────────────
  useEffect(() => {
    if (!companyId || !uid) { setYearSettings({}); return; }
    const unsub = onSnapshot(collection(db, 'companies', companyId, 'users', uid, 'expenseYearSettings'), (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      setYearSettings(map);
    }, (err) => console.error('[ExpenseNotes] yearSettings snapshot error', err));
    return () => unsub();
  }, [companyId, uid]);

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
    if (!companyId || !uid) return;
    const ref = doc(db, 'companies', companyId, 'users', uid, 'expenseYearSettings', String(yr));
    // null pour reinitialiser
    await setDoc(ref, { forcedTranche: value === null ? null : Number(value), updatedAt: serverTimestamp() }, { merge: true });
  }, [companyId, uid]);

  const setCustomBareme = useCallback(async (yr, bareme) => {
    if (!companyId || !uid) return;
    const ref = doc(db, 'companies', companyId, 'users', uid, 'expenseYearSettings', String(yr));
    await setDoc(ref, { customBareme: bareme, updatedAt: serverTimestamp() }, { merge: true });
  }, [companyId, uid]);

  // ── Helpers note (trajets) ────────────────────────────────────────────────
  const upsertNote = useCallback(async (month, patch) => {
    if (!companyId || !uid) return;
    const ref = doc(db, 'companies', companyId, 'users', uid, 'expenseNotes', month);
    await setDoc(ref, { ...patch, month, updatedAt: serverTimestamp() }, { merge: true });
  }, [companyId, uid]);

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

  // ── CRUD Vehicules (per-user) ─────────────────────────────────────────────
  const addVehicle = useCallback(async (data) => {
    if (!companyId || !uid) return;
    return addDoc(collection(db, 'companies', companyId, 'users', uid, 'vehicles'), {
      ...data, createdAt: serverTimestamp(),
    });
  }, [companyId, uid]);

  const updateVehicle = useCallback(async (id, patch) => {
    if (!companyId || !uid) return;
    return updateDoc(doc(db, 'companies', companyId, 'users', uid, 'vehicles', id), patch);
  }, [companyId, uid]);

  const deleteVehicle = useCallback(async (id) => {
    if (!companyId || !uid) return;
    return deleteDoc(doc(db, 'companies', companyId, 'users', uid, 'vehicles', id));
  }, [companyId, uid]);

  // ── CRUD Adresses favorites (per-user) ────────────────────────────────────
  const addLocation = useCallback(async (data) => {
    if (!companyId || !uid) return;
    return addDoc(collection(db, 'companies', companyId, 'users', uid, 'expenseLocations'), {
      ...data, createdAt: serverTimestamp(),
    });
  }, [companyId, uid]);

  const updateLocation = useCallback(async (id, patch) => {
    if (!companyId || !uid) return;
    return updateDoc(doc(db, 'companies', companyId, 'users', uid, 'expenseLocations', id), patch);
  }, [companyId, uid]);

  const deleteLocation = useCallback(async (id) => {
    if (!companyId || !uid) return;
    return deleteDoc(doc(db, 'companies', companyId, 'users', uid, 'expenseLocations', id));
  }, [companyId, uid]);

  // Vehicule par defaut (premier marque isDefault, sinon premier de la liste)
  const defaultVehicle = useMemo(() => {
    return vehicles.find((v) => v.isDefault) || vehicles[0] || null;
  }, [vehicles]);

  // Domicile (premiere adresse marquee isHome)
  const homeLocation = useMemo(() => locations.find((l) => l.isHome) || null, [locations]);

  // ── Migration des donnees legacy (chemins partages -> per-user) ──────────
  // Lit les anciens chemins /companies/{cId}/{collection}/... (donnees partagees
  // avant V2.5.x) et copie chaque doc sous /companies/{cId}/users/{uid}/...
  // Ne supprime PAS les originaux (backup). setDoc avec { merge:true } pour
  // ne pas ecraser des donnees per-user existantes plus recentes.
  const migrateLegacyData = useCallback(async () => {
    if (!companyId || !uid) throw new Error('companyId ou uid manquant');
    const result = { notes: 0, vehicles: 0, locations: 0, yearSettings: 0 };

    const migrateCollection = async (collName, counterKey) => {
      const snap = await getDocs(collection(db, 'companies', companyId, collName));
      for (let i = 0; i < snap.docs.length; i += 10) {
        const batch = snap.docs.slice(i, i + 10);
        await Promise.all(batch.map((d) => setDoc(
          doc(db, 'companies', companyId, 'users', uid, collName, d.id),
          d.data(),
          { merge: true },
        )));
        result[counterKey] += batch.length;
      }
    };

    await migrateCollection('expenseNotes', 'notes');
    await migrateCollection('vehicles', 'vehicles');
    await migrateCollection('expenseLocations', 'locations');
    await migrateCollection('expenseYearSettings', 'yearSettings');

    return result;
  }, [companyId, uid]);

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
    migrateLegacyData,
  };
}

export const monthIdFor = monthId;
