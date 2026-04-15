// src/hooks/useRobustSave.js
// Hook partagé pour sauvegarde robuste : debounce, retry, brouillon localStorage,
// indicateur de statut, protection beforeunload/visibilitychange.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

// ── Safe localStorage wrapper (pattern de usePriceAnalysis.js) ──────────────
const safeStorage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch {} },
};

/** Charge un brouillon depuis localStorage */
export function loadDraft(key) {
  if (!key) return null;
  const raw = safeStorage.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Supprime un brouillon localStorage */
export function clearDraft(key) {
  if (key) safeStorage.remove(key);
}

// ── Hook principal ──────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {(data: any) => Promise<void>} options.saveFn   — fonction de sauvegarde Firestore
 * @param {string|null}  options.draftKey   — clé localStorage pour brouillon (null = désactivé)
 * @param {number}       [options.debounceMs=1500] — délai debounce en ms
 * @param {number}       [options.maxRetries=3]    — nombre max de tentatives
 */
export function useRobustSave({ saveFn, draftKey, debounceMs = 1500, maxRetries = 3 }) {
  const toast = useToast();

  // Status : 'idle' | 'waiting' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');

  // Refs pour closures stables (pattern prouvé dans usePriceAnalysis.js)
  const saveFnRef = useRef(saveFn);
  const draftKeyRef = useRef(draftKey);
  const pendingDataRef = useRef(null);
  const saveTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const statusRef = useRef('idle');

  // Garder les refs à jour sans déclencher de re-renders
  useEffect(() => { saveFnRef.current = saveFn; }, [saveFn]);
  useEffect(() => { draftKeyRef.current = draftKey; }, [draftKey]);
  useEffect(() => { statusRef.current = saveStatus; }, [saveStatus]);

  // ── executeSave : tentative + retry avec backoff ──────────────────────────
  const executeSave = useCallback(async () => {
    const data = pendingDataRef.current;
    if (!data || !saveFnRef.current) return;

    setSaveStatus('saving');
    try {
      await saveFnRef.current(data);
      setSaveStatus('saved');
      retryCountRef.current = 0;
      pendingDataRef.current = null;
      // Brouillon réussi → nettoyer localStorage
      if (draftKeyRef.current) safeStorage.remove(draftKeyRef.current);
    } catch (err) {
      console.error('[RobustSave] Erreur sauvegarde:', err);
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000);
        retryTimerRef.current = setTimeout(executeSave, backoff);
        // Rester en 'saving' pendant les retries
      } else {
        setSaveStatus('error');
        retryCountRef.current = 0;
        toast.error('Sauvegarde impossible. Vos données sont conservées localement.', {
          title: 'Erreur de connexion',
        });
      }
    }
  }, [maxRetries, toast]);

  // ── triggerSave : debounce + brouillon localStorage ───────────────────────
  const triggerSave = useCallback((data) => {
    pendingDataRef.current = data;

    // Sauvegarder le brouillon en localStorage immédiatement
    if (draftKeyRef.current) {
      try {
        safeStorage.set(draftKeyRef.current, JSON.stringify(data));
      } catch (e) {
        // JSON.stringify peut échouer si données trop volumineuses ou circulaires
        console.warn('[RobustSave] Brouillon non sauvegardé:', e);
      }
    }

    setSaveStatus('waiting');

    // Annuler le debounce précédent
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // Annuler un retry en cours
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryCountRef.current = 0;

    saveTimerRef.current = setTimeout(executeSave, debounceMs);
  }, [debounceMs, executeSave]);

  // ── forceSave : bypass debounce ───────────────────────────────────────────
  const forceSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryCountRef.current = 0;
    if (pendingDataRef.current) {
      executeSave();
    }
  }, [executeSave]);

  // ── Protection beforeunload + visibilitychange ────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pendingDataRef.current && statusRef.current !== 'saved' && statusRef.current !== 'idle') {
        e.preventDefault();
        e.returnValue = '';
        // Tenter un flush synchrone du brouillon (le Firestore write est async, on ne peut pas l'attendre)
        if (draftKeyRef.current && pendingDataRef.current) {
          safeStorage.set(draftKeyRef.current, JSON.stringify(pendingDataRef.current));
        }
      }
    };

    const handleVisibilityChange = () => {
      // Quand l'utilisateur switch d'app (caméra, appel, etc.) → flush immédiat
      if (document.visibilityState === 'hidden' && pendingDataRef.current &&
          (statusRef.current === 'waiting' || statusRef.current === 'error')) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        retryCountRef.current = 0;
        executeSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executeSave]);

  // ── Cleanup timers on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const hasPendingChanges = saveStatus !== 'saved' && saveStatus !== 'idle';

  return { saveStatus, triggerSave, forceSave, hasPendingChanges };
}
