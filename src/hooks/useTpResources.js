// src/hooks/useTpResources.js
// ESTIMA TP — bibliothèque de ressources réutilisable (niveau entreprise).
// Stockée dans companies/{companyId}/tpResources/{id}. Chaque ressource porte
// une catégorie (poste : materiel, mo, fourniture, soustraitance, transport).
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';

export const emptyResource = (category = 'materiel') => ({
  category, designation: '', unit: category === 'fourniture' ? 'T' : (category === 'soustraitance' ? 'U' : 'J'),
  puJour: 0, amort: 0, entret: 0, cons: 0, loc: 0,        // matériel / MO / transport
  epaisseur: 0, densite: 0, puBareme: 0,                   // fourniture / sous-traitance
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

  return { resources, loading, reload, saveResource, deleteResource, importResources };
}
