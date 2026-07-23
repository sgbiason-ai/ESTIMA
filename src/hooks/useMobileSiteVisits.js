// src/hooks/useMobileSiteVisits.js
// Hook Firestore pour les visites de site (mobile + desktop lecture).

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const APP_SUPER_ADMIN_EMAIL = 'samuel.biason@papyrus-be.fr';

export const useMobileSiteVisits = (user, companyId) => {
  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVisits = useCallback(async () => {
    if (!user || !companyId) {
      setVisits([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const isSuperUser = user.email === APP_SUPER_ADMIN_EMAIL;
      const visitsRef = collection(db, 'companies', companyId, 'site_visits');
      const snap = await getDocs(isSuperUser ? visitsRef : query(visitsRef, where('accessUids', 'array-contains', user.uid)));

      // Migration transparente : les anciennes visites appartiennent au super-utilisateur.
      if (isSuperUser) {
        await Promise.all(snap.docs
          .filter(d => !d.data().ownerId)
          .map(d => updateDoc(d.ref, {
            ownerId: user.uid,
            ownerEmail: user.email || '',
            accessUids: [user.uid],
            sharedWith: [],
          })));
      }

      const list = snap.docs.map(d => {
        const data = d.data();
        const hasAccess = !data.ownerId
          ? isSuperUser
          : data.ownerId === user.uid || (data.accessUids || []).includes(user.uid);
        return {
          id: d.id,
          nom: data.nom || '(Sans nom)',
          lieu: data.lieu || '',
          date: data.date || '',
          client: data.client || '',
          obsCount: (data.observations || []).length,
          hasGps: !!(data.gpsTracking?.coordinates?.length),
          lastSaved: data.lastSaved || '',
          ownerId: data.ownerId || (isSuperUser ? user.uid : null),
          isOwner: !data.ownerId ? isSuperUser : data.ownerId === user.uid,
          isShared: hasAccess && !!data.ownerId && data.ownerId !== user.uid,
          sharedCount: Array.isArray(data.sharedWith) ? data.sharedWith.length : 0,
        };
      }).filter(v => v.isOwner || v.isShared)
        .sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || ''));
      setVisits(list);
    } catch (e) {
      console.error('Erreur chargement visites :', e);
      setError('Impossible de charger les visites. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const loadVisit = useCallback(async (visitId) => {
    if (!companyId) return null;
    const snap = await getDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      isOwner: data.ownerId === user?.uid || (!data.ownerId && user?.email === APP_SUPER_ADMIN_EMAIL),
      isReadOnly: data.ownerId !== user?.uid && !!data.ownerId,
    };
  }, [companyId, user]);

  const saveVisit = useCallback(async (visitId, data) => {
    if (!companyId) return;
    try {
      const persistedData = { ...data };
      delete persistedData.isOwner;
      delete persistedData.isReadOnly;
      // La sauvegarde métier ne doit jamais écraser les droits de partage.
      delete persistedData.ownerId;
      delete persistedData.ownerEmail;
      delete persistedData.accessUids;
      delete persistedData.sharedWith;
      await setDoc(doc(db, 'companies', companyId, 'site_visits', visitId), {
        ...persistedData,
        lastSaved: new Date().toISOString(),
        updatedBy: user?.email || '',
      }, { merge: true });
    } catch (err) {
      console.error('[SiteVisit] Erreur sauvegarde:', err);
      throw err; // Relancer pour que useRobustSave gère le retry
    }
  }, [companyId, user]);

  const createVisit = useCallback(async () => {
    if (!companyId || !user?.uid) throw new Error('Utilisateur ou entreprise indisponible');
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
      ownerId: user.uid,
      ownerEmail: user.email || '',
      accessUids: [user.uid],
      sharedWith: [],
    };
    try {
      const writePromise = setDoc(doc(db, 'companies', companyId, 'site_visits', id), visit);
      const reportLateFailure = (err) => {
        console.error('[SiteVisit] Création différée échouée :', err);
        setError('La nouvelle visite reste en attente de synchronisation.');
      };

      // Firestore garde l'écriture dans son cache persistant hors ligne, mais
      // sa Promise ne se résout qu'au retour du réseau. Ouvrir la visite tout
      // de suite évite un bouton « Création… » bloqué sur le chantier.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        writePromise.catch(reportLateFailure);
      } else {
        const outcome = await Promise.race([
          writePromise.then(() => 'synced'),
          new Promise(resolve => setTimeout(() => resolve('queued'), 6000)),
        ]);
        if (outcome === 'queued') writePromise.catch(reportLateFailure);
      }
      return { ...visit, isOwner: true, isReadOnly: false };
    } catch (err) {
      console.error('[SiteVisit] Erreur création:', err);
      throw err;
    }
  }, [companyId, user]);

  const deleteVisit = useCallback(async (visitId) => {
    if (!companyId) return;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
      setVisits(prev => prev.filter(v => v.id !== visitId));
    } catch (err) {
      console.error('[SiteVisit] Erreur suppression:', err);
      throw err;
    }
  }, [companyId]);

  const updateSharing = useCallback(async (visitId, sharedWith) => {
    if (!companyId || !user?.uid) return;
    const visitRef = doc(db, 'companies', companyId, 'site_visits', visitId);
    const visitSnap = await getDoc(visitRef);
    if (!visitSnap.exists()) return;
    const previousIds = new Set((visitSnap.data().sharedWith || []).map(member => member.uid));
    const collaborators = sharedWith.map(member => ({
      uid: member.uid,
      displayName: member.displayName || '',
      email: member.email || '',
    }));
    const batch = writeBatch(db);
    batch.update(visitRef, {
      sharedWith: collaborators,
      accessUids: [user.uid, ...collaborators.map(member => member.uid)],
      lastSaved: new Date().toISOString(),
      updatedBy: user.email || '',
    });
    collaborators.filter(member => !previousIds.has(member.uid)).forEach(member => {
      batch.set(doc(collection(db, 'users', member.uid, 'notifications')), {
        type: 'site_visit_share',
        recipientId: member.uid,
        senderId: user.uid,
        senderEmail: user.email || '',
        companyId,
        visitId,
        visitName: visitSnap.data().nom || 'Visite sans nom',
        createdAt: serverTimestamp(),
        readAt: null,
      });
    });
    await batch.commit();
  }, [companyId, user]);

  return {
    visits,
    isLoading,
    error,
    refetch: fetchVisits,
    loadVisit,
    saveVisit,
    createVisit,
    deleteVisit,
    updateSharing,
  };
};
