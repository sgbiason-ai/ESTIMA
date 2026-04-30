import { useEffect, useRef, useState, useCallback } from 'react';

const HISTORY_LIMIT = 30;
const DEBOUNCE_MS = 500;

// Slice du projet trackée par l'historique (Estima uniquement)
const sliceForHistory = (p) => ({
  chapters: p?.chapters,
  tranches: p?.tranches,
  bpuOverrides: p?.bpuOverrides,
});

export const useProjectUndo = (project, setProject) => {
  const stack = useRef([]);
  const lastSerialized = useRef(null);
  const pendingSnapshot = useRef(null);
  const debounceTimer = useRef(null);
  const isUndoing = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [canUndo, setCanUndo] = useState(false);

  const flushPending = useCallback(() => {
    if (!debounceTimer.current) return false;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    if (pendingSnapshot.current !== null) {
      stack.current.push(pendingSnapshot.current);
      if (stack.current.length > HISTORY_LIMIT) stack.current.shift();
      pendingSnapshot.current = null;
      setCanUndo(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!project) return;
    const slice = sliceForHistory(project);
    const serialized = JSON.stringify(slice);

    // Premier passage : juste mémoriser, pas de snapshot
    if (lastSerialized.current === null) {
      lastSerialized.current = serialized;
      return;
    }

    // Pas de changement
    if (serialized === lastSerialized.current) return;

    // Si on vient de undo, on ignore ce changement (et on consomme le flag)
    if (isUndoing.current) {
      isUndoing.current = false;
      lastSerialized.current = serialized;
      return;
    }

    // Début d'un burst : on capture l'état AVANT ce changement
    if (!debounceTimer.current) {
      pendingSnapshot.current = lastSerialized.current;
      // Active immédiatement le bouton Annuler — même si le debounce n'a pas encore flush
      setCanUndo(true);
    }

    // Reset du timer (debounce)
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (pendingSnapshot.current !== null) {
        stack.current.push(pendingSnapshot.current);
        if (stack.current.length > HISTORY_LIMIT) stack.current.shift();
        pendingSnapshot.current = null;
        setCanUndo(true);
      }
      debounceTimer.current = null;
    }, DEBOUNCE_MS);

    lastSerialized.current = serialized;
  }, [project]);

  // Reset complet (changement de projet, ouverture cloud, archive, etc.)
  // On NE remet PAS lastSerialized à null : on le réinitialise sur la base du projet courant
  // pour que la PREMIÈRE action utilisateur après le reset soit bien tracquée.
  const reset = useCallback(() => {
    stack.current = [];
    pendingSnapshot.current = null;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setCanUndo(false);
    lastSerialized.current = projectRef.current
      ? JSON.stringify(sliceForHistory(projectRef.current))
      : null;
  }, []);

  const undo = useCallback(() => {
    // Si une snapshot est en attente (debounce non flushed), la valider d'abord
    flushPending();
    if (stack.current.length === 0) return;

    const snapshot = stack.current.pop();
    if (stack.current.length === 0) setCanUndo(false);

    isUndoing.current = true;
    lastSerialized.current = snapshot;

    const restored = JSON.parse(snapshot);
    setProject((prev) => ({ ...prev, ...restored }));
  }, [setProject, flushPending]);

  return { undo, canUndo, reset };
};
