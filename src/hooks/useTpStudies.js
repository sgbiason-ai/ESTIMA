// src/hooks/useTpStudies.js
// ESTIMA TP — gestion des études de prix (chiffrage entreprise).
// Une étude est un document autonome (indépendant des projets MOE) stocké dans
// la sous-collection companies/{companyId}/tpStudies/{studyId}.
import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';

/** Squelette d'une étude vierge (Phase 1 : cadre seul). */
export function emptyStudy({ name = '', reference = '', maitreOuvrage = '' } = {}) {
  return {
    name: name.trim() || 'Nouvelle étude',
    reference: reference.trim(),
    maitreOuvrage: maitreOuvrage.trim(),
    cadre: { chapters: [] },
    createdAt: new Date().toISOString(),
    lastSaved: new Date().toISOString(),
  };
}

/**
 * Liste + CRUD des études de prix TP d'une entreprise.
 * @param {string} companyId
 */
export function useTpStudies(companyId) {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!companyId) { setStudies([]); setLoading(false); return; }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'tpStudies'));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));
      setStudies(list);
    } catch (e) {
      console.error('[useTpStudies] Chargement échoué:', e);
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { reload(); }, [reload]);

  const createStudy = useCallback(async (meta) => {
    if (!companyId) return null;
    const id = `tp_${generateId()}`;
    const data = emptyStudy(meta);
    await setDoc(doc(db, 'companies', companyId, 'tpStudies', id), {
      ...data,
      _serverCreatedAt: serverTimestamp(),
    });
    const created = { id, ...data };
    setStudies(prev => [created, ...prev]);
    return created;
  }, [companyId]);

  const deleteStudy = useCallback(async (id) => {
    if (!companyId || !id) return;
    await deleteDoc(doc(db, 'companies', companyId, 'tpStudies', id));
    setStudies(prev => prev.filter(s => s.id !== id));
  }, [companyId]);

  return { studies, loading, reload, createStudy, deleteStudy };
}
