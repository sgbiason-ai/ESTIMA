// src/hooks/useProjectHistory.js
//
// Lit l'historique d'un projet depuis Firestore.
// Chemin : companies/{companyId}/projects/{projectId}/history/{entryId}
//
// Usage :
//   const { entries, loading } = useProjectHistory(companyId, projectId);

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const MAX_ENTRIES = 50; // dernières 50 sauvegardes

export function useProjectHistory(companyId, projectId) {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!companyId || !projectId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const ref = collection(db, 'companies', companyId, 'projects', projectId, 'history');
        const q   = query(ref, orderBy('savedAt', 'desc'), limit(MAX_ENTRIES));
        const snap = await getDocs(q);
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('[useProjectHistory] Erreur lecture historique:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [companyId, projectId]);

  return { entries, loading };
}