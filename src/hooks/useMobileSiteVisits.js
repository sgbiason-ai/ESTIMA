// src/hooks/useMobileSiteVisits.js
// Hook Firestore pour les visites de site (mobile + desktop lecture).

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useMobileSiteVisits = (user, companyId) => {
  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    if (!user || !companyId) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'site_visits'));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nom: data.nom || '(Sans nom)',
          lieu: data.lieu || '',
          date: data.date || '',
          client: data.client || '',
          obsCount: (data.observations || []).length,
          hasGps: !!(data.gpsTracking?.coordinates?.length),
          lastSaved: data.lastSaved || '',
        };
      }).sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || ''));
      setVisits(list);
    } catch (e) {
      console.error('Erreur chargement visites :', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const loadVisit = useCallback(async (visitId) => {
    if (!companyId) return null;
    const snap = await getDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }, [companyId]);

  const saveVisit = useCallback(async (visitId, data) => {
    if (!companyId) return;
    try {
      await setDoc(doc(db, 'companies', companyId, 'site_visits', visitId), {
        ...data,
        lastSaved: new Date().toISOString(),
        updatedBy: user?.email || '',
      });
    } catch (err) {
      console.error('[SiteVisit] Erreur sauvegarde:', err);
      throw err; // Relancer pour que useRobustSave gère le retry
    }
  }, [companyId, user]);

  const createVisit = useCallback(async () => {
    if (!companyId) return null;
    const id = `sv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const visit = {
      id,
      nom: '',
      lieu: '',
      date: new Date().toISOString().split('T')[0],
      client: '',
      observations: [],
      gpsTracking: { coordinates: [], startTime: null, endTime: null, distance: 0 },
      lastSaved: new Date().toISOString(),
      updatedBy: user?.email || '',
    };
    await setDoc(doc(db, 'companies', companyId, 'site_visits', id), visit);
    return visit;
  }, [companyId, user]);

  const deleteVisit = useCallback(async (visitId) => {
    if (!companyId) return;
    await deleteDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
    setVisits(prev => prev.filter(v => v.id !== visitId));
  }, [companyId]);

  return { visits, isLoading, refetch: fetchVisits, loadVisit, saveVisit, createVisit, deleteVisit };
};
