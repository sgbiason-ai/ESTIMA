// src/hooks/useRobustSave.js
// Hook partagé pour sauvegarde robuste : debounce, retry, brouillon localStorage,
// indicateur de statut, protection beforeunload/visibilitychange/pagehide.

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
  const lastSavedJsonRef = useRef('');

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
      lastSavedJsonRef.current = JSON.stringify(data);
      if (draftKeyRef.current) safeStorage.remove(draftKeyRef.current);
    } catch (err) {
      console.error('[RobustSave] Erreur sauvegarde:', err);
      retryCountRef.current++;
      if (retryCountRef.current < maxRetries) {
        if (retryCountRef.current === 2) {
          toast.warning('Connexion instable, nouvelle tentative...', { duration: 3000 });
        }
        const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000);
        retryTimerRef.current = setTimeout(executeSave, backoff);
      } else {
        setSaveStatus('error');
        retryCountRef.current = 0;
        toast.error('Sauvegarde impossible. Vos données sont conservées localement.', {
          title: 'Erreur de connexion',
          duration: 10000,
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
        console.warn('[RobustSave] Brouillon non sauvegardé:', e);
      }
    }

    setSaveStatus('waiting');

    // Annuler le debounce précédent
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // Annuler un retry en cours (nouvelle donnée → recommencer)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryCountRef.current = 0;

    saveTimerRef.current = setTimeout(executeSave, debounceMs);
  }, [debounceMs, executeSave]);

  // ── forceSave : bypass debounce ───────────────────────────────────────────
  const forceSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (pendingDataRef.current) {
      executeSave();
    }
  }, [executeSave]);

  // ── saveDraftSync : permet au caller de forcer un brouillon localStorage ──
  const saveDraftSync = useCallback((data) => {
    if (!draftKeyRef.current || !data) return;
    try { safeStorage.set(draftKeyRef.current, JSON.stringify(data)); } catch {}
  }, []);

  // ── Protection beforeunload + visibilitychange + pagehide ─────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pendingDataRef.current && statusRef.current !== 'saved' && statusRef.current !== 'idle') {
        e.preventDefault();
        e.returnValue = '';
        if (draftKeyRef.current && pendingDataRef.current) {
          safeStorage.set(draftKeyRef.current, JSON.stringify(pendingDataRef.current));
        }
      }
    };

    const handlePageHide = () => {
      // Flush immédiat — pagehide est le dernier signal fiable sur mobile/tablette
      if (pendingDataRef.current && statusRef.current !== 'saved' && statusRef.current !== 'idle') {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (draftKeyRef.current) {
          safeStorage.set(draftKeyRef.current, JSON.stringify(pendingDataRef.current));
        }
        executeSave();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingDataRef.current &&
          (statusRef.current === 'waiting' || statusRef.current === 'error')) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        executeSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [executeSave]);

  // ── Auto-flush périodique : rattrape les debounces ratés ──────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingDataRef.current && statusRef.current === 'waiting') {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        executeSave();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [executeSave]);

  // ── Cleanup timers on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const hasPendingChanges = saveStatus !== 'saved' && saveStatus !== 'idle';

  return { saveStatus, triggerSave, forceSave, saveDraftSync, hasPendingChanges };
}
