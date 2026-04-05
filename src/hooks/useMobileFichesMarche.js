// src/hooks/useMobileFichesMarche.js
//
// Charge les fiches marche depuis Firestore pour la vue mobile (lecture seule).
// Collection : companies/{companyId}/fichesMarche/

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const col = (companyId) => collection(db, 'companies', companyId, 'fichesMarche');

export const useMobileFichesMarche = (user, companyId) => {
  const [fiches, setFiches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFiches = useCallback(async () => {
    if (!user || !companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const snap = await getDocs(col(companyId));
      const list = snap.docs.map((d) => {
        const data = d.data();
        const lots = data.sectionD?.lots || [];
        const exeMap = data.exeParEntreprise || {};
        const exeKeys = Object.keys(exeMap);
        const hasExe1 = exeKeys.some((k) => (exeMap[k].exe1 || []).length > 0);
        const hasReception = exeKeys.some((k) => exeMap[k].reception && Object.keys(exeMap[k].reception).length > 0);

        return {
          id: d.id,
          nom: data.nom || '(Sans nom)',
          pouvoirAdj: data.sectionA?.designation || '',
          updatedAt: data.updatedAt || data.createdAt || '',
          nbLots: lots.length,
          hasExe1,
          hasReception,
        };
      }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      setFiches(list);
    } catch (e) {
      console.error('[useMobileFichesMarche] Erreur chargement:', e);
      setError('Impossible de charger les fiches marché.');
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => { fetchFiches(); }, [fetchFiches]);

  const loadFiche = useCallback(async (ficheId) => {
    if (!companyId) return null;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'fichesMarche', ficheId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (e) {
      console.error('[useMobileFichesMarche] Erreur chargement fiche:', e);
      return null;
    }
  }, [companyId]);

  return { fiches, isLoading, error, refetch: fetchFiches, loadFiche };
};
