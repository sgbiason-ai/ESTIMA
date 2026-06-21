// src/hooks/useTpStudy.js
// ESTIMA TP — chargement + sauvegarde auto (debounced) d'une étude de prix.
import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SAVE_DELAY = 1200; // ms

/**
 * Charge l'étude {studyId} et expose un setter avec auto-save debounced.
 * @param {string} companyId
 * @param {string} studyId
 */
export function useTpStudy(companyId, studyId) {
  const [study, setStudyState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const skipNextSave = useRef(true); // ne pas re-sauver juste après le chargement

  // Chargement initial
  useEffect(() => {
    if (!companyId || !studyId) { setLoading(false); return; }
    let cancelled = false;
    skipNextSave.current = true;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'companies', companyId, 'tpStudies', studyId));
        if (!cancelled) setStudyState(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.error('[useTpStudy] Chargement échoué:', e);
        if (!cancelled) setStudyState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [companyId, studyId]);

  // Écriture Firestore (merge), horodatée
  const persist = useCallback(async (data) => {
    if (!companyId || !studyId) return;
    setSaving(true);
    try {
      const payload = { ...data, lastSaved: new Date().toISOString() };
      delete payload.id;
      await setDoc(doc(db, 'companies', companyId, 'tpStudies', studyId), payload, { merge: true });
    } catch (e) {
      console.error('[useTpStudy] Sauvegarde échouée:', e);
    } finally {
      setSaving(false);
    }
  }, [companyId, studyId]);

  // Setter public : maj locale immédiate + auto-save debounced
  const setStudy = useCallback((updater) => {
    setStudyState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(next), SAVE_DELAY);
      return next;
    });
  }, [persist]);

  return { study, setStudy, loading, saving };
}
