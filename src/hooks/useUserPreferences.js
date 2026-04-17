// src/hooks/useUserPreferences.js
//
// Préférences utilisateur persistées dans Firestore : users/{uid}/preferences/modules
// Stocke le dernier item ouvert par module (projet, chantier, fiche, devis, visite).
// Sync multi-device via onSnapshot.

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const PREFS_PATH = (uid) => ['users', uid, 'preferences', 'modules'];

export const useUserPreferences = (userId) => {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPrefs({});
      setLoading(false);
      return;
    }
    const ref = doc(db, ...PREFS_PATH(userId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setPrefs(snap.exists() ? snap.data() : {});
        setLoading(false);
      },
      (err) => {
        console.warn('[useUserPreferences] onSnapshot:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userId]);

  const setLastOpened = useCallback(async (moduleKey, id) => {
    if (!userId || !moduleKey) return;
    try {
      const ref = doc(db, ...PREFS_PATH(userId));
      await setDoc(
        ref,
        { [moduleKey]: id || null, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn('[useUserPreferences] setLastOpened:', e.message);
    }
  }, [userId]);

  const clearLastOpened = useCallback(
    (moduleKey) => setLastOpened(moduleKey, null),
    [setLastOpened]
  );

  return { prefs, loading, setLastOpened, clearLastOpened };
};
