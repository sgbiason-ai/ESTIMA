// src/hooks/useTpResources.js
// ESTIMA TP — bibliothèque de ressources réutilisable (niveau entreprise).
// Stockée dans companies/{companyId}/tpResources/{id}. Chaque ressource porte
// une catégorie (poste : materiel, mo, fourniture, soustraitance, transport).
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
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

  return { resources, loading, reload, saveResource, deleteResource };
}
