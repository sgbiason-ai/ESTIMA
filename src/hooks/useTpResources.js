// src/hooks/useTpResources.js
// ESTIMA TP — bibliothèque de ressources réutilisable (niveau entreprise).
// Stockée dans companies/{companyId}/tpResources/{id}. Chaque ressource porte
// une catégorie (poste : materiel, mo, fourniture, soustraitance, transport).
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';

export const emptyResource = (category = 'materiel') => ({
  category,
  designation: '',
  unit: category === 'fourniture' ? 'T' : (category === 'soustraitance' ? 'U' : (category === 'transport' ? 'T' : 'J')),
  puJour: 0, amort: 0, entret: 0, cons: 0, loc: 0,        // matériel / MO (A/E/I + Personnel + Location)
  puBareme: 0,                                            // fourniture / sous-traitance (juste un prix)
  contenance: 0, coutJour: 0,                             // transport (contenance/voyage + coût journalier)
});

export function useTpResources(companyId) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!companyId) { setResources([]); setLoading(false); return; }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'tpResources'));
      setResources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('[useTpResources] Chargement échoué:', e);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { reload(); }, [reload]);

  const saveResource = useCallback(async (res) => {
    if (!companyId) return null;
    const id = res.id || `tpres_${generateId()}`;
    const data = { ...res }; delete data.id;
    await setDoc(doc(db, 'companies', companyId, 'tpResources', id), data, { merge: true });
    setResources(prev => {
      const i = prev.findIndex(r => r.id === id);
      const next = { id, ...data };
      if (i === -1) return [...prev, next];
      const copy = [...prev]; copy[i] = next; return copy;
    });
    return id;
  }, [companyId]);

  const deleteResource = useCallback(async (id) => {
    if (!companyId || !id) return;
    await deleteDoc(doc(db, 'companies', companyId, 'tpResources', id));
    setResources(prev => prev.filter(r => r.id !== id));
  }, [companyId]);

  // Import en masse (barème). replace=true vide d'abord la bibliothèque.
  // Écritures par lots de 450 (limite Firestore : 500 opérations/batch).
  const importResources = useCallback(async (list, { replace = false } = {}) => {
    if (!companyId || !Array.isArray(list) || list.length === 0) return 0;
    const colRef = collection(db, 'companies', companyId, 'tpResources');
    const CHUNK = 450;

    if (replace) {
      const snap = await getDocs(colRef);
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const b = writeBatch(db);
        docs.slice(i, i + CHUNK).forEach(d => b.delete(d.ref));
        await b.commit();
      }
    }

    let n = 0;
    for (let i = 0; i < list.length; i += CHUNK) {
      const b = writeBatch(db);
      list.slice(i, i + CHUNK).forEach(r => {
        const data = { ...r }; delete data.id;
        b.set(doc(colRef, `tpres_${generateId()}`), data);
      });
      await b.commit();
      n += Math.min(CHUNK, list.length - i);
    }
    await reload();
    return n;
  }, [companyId, reload]);

  // Fusion sans doublon (import par type). Clé = catégorie + désignation normalisée :
  // une ligne dont la clé existe déjà MET À JOUR la ressource, les autres sont CRÉÉES.
  // Le fichier est aussi dédoublonné en interne (dernière occurrence d'une clé gagne).
  const mergeResources = useCallback(async (list) => {
    if (!companyId || !Array.isArray(list) || list.length === 0) return { added: 0, updated: 0 };
    const colRef = collection(db, 'companies', companyId, 'tpResources');
    const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const keyOf = (r) => `${r.category}::${norm(r.designation)}`;

    const existing = new Map();
    resources.forEach(r => existing.set(keyOf(r), r.id));

    const byKey = new Map();
    list.forEach(r => { if (norm(r.designation)) byKey.set(keyOf(r), r); });

    const ops = [];
    let added = 0, updated = 0;
    byKey.forEach((r, key) => {
      const data = { ...r }; delete data.id;
      const id = existing.get(key);
      if (id) { ops.push({ id, data }); updated++; }
      else { ops.push({ id: `tpres_${generateId()}`, data }); added++; }
    });

    const CHUNK = 450;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const b = writeBatch(db);
      ops.slice(i, i + CHUNK).forEach(({ id, data }) => b.set(doc(colRef, id), data, { merge: true }));
      await b.commit();
    }
    await reload();
    return { added, updated };
  }, [companyId, resources, reload]);

  return { resources, loading, reload, saveResource, deleteResource, importResources, mergeResources };
}
