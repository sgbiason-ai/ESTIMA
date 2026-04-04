// src/hooks/useMobileDevisMoe.js
//
// Charge les devis MOE depuis Firestore — lecture seule mobile.
// Chemin : companies/{companyId}/devisMoe/

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useMobileDevisMoe = (user, companyId) => {
  const [devisList, setDevisList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const fetchDevis = useCallback(async () => {
    if (!user || !companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'devisMoe'));
      const list = snap.docs.map(d => {
        const data = d.data();
        const lots = data.lots || [];
        const taches = data.taches || [];
        const cats = data.categories || [];
        const isPct = data.methode === 'pourcentage';

        // Calcul rapide du total HT pour l'aperçu
        let totalHT = 0;
        if (isPct) {
          const taux = parseFloat(data.tauxHonorairesGlobal) || 0;
          totalHT = lots.reduce((s, l) => s + (parseFloat(l.montantTravauxHT) || 0) * taux / 100, 0);
        } else if (taches.length > 0) {
          totalHT = taches.reduce((s, t) =>
            s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
        }

        return {
          id: d.id,
          nom: data.nom || '(Sans nom)',
          reference: data.reference || '',
          dateDevis: data.dateDevis || '',
          client: data.client?.designation || '',
          methode: data.methode || 'pourcentage',
          moeType: data.moeType || 'seul',
          nbLots: lots.length,
          nbPhases: (data.phases || []).filter(p => p.actif).length,
          totalHT,
          updatedAt: data.updatedAt || data.createdAt || '',
        };
      })
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      setDevisList(list);
    } catch (e) {
      console.error('[useMobileDevisMoe] Erreur chargement:', e);
      setError('Impossible de charger les devis MOE.');
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);

  const loadDevis = useCallback(async (devisId) => {
    if (!companyId) return null;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'devisMoe', devisId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (e) {
      console.error('[useMobileDevisMoe] Erreur chargement devis:', e);
      return null;
    }
  }, [companyId]);

  return { devisList, isLoading, error, refetch: fetchDevis, loadDevis };
};
