// src/hooks/useMobileCrc.js
//
// Charge les données CRC (Compte Rendu Chantier) depuis Firestore.
// Utilisé par la vue mobile — lecture + écriture.
// Chemin : companies/{companyId}/crr/

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const APP_SUPER_ADMIN_EMAIL = 'samuel.biason@papyrus-be.fr';

export const useMobileCrc = (user, companyId) => {
  const [chantiers, setChantiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const fetchChantiers = useCallback(async () => {
    if (!user || !companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'crr'));
      const isSuperUser = user.email === APP_SUPER_ADMIN_EMAIL;
      const list = await Promise.all(snap.docs.map(async d => {
        let data = d.data();
        if (isSuperUser && !data.ownerId) {
          const ownership = { ownerId: user.uid, ownerEmail: user.email || '' };
          await setDoc(d.ref, ownership, { merge: true });
          data = { ...data, ...ownership };
        }
        const config = data.crrConfig || {};
        const meetings = data.crrMeetings || [];
        return {
          id: d.id,
          name: config.chantierInfo?.nom || '(Sans nom)',
          lieu: config.chantierInfo?.lieu || '',
          meetingCount: meetings.length,
          lastMeetingDate: meetings.length > 0
            ? meetings[meetings.length - 1].date || ''
            : '',
          lastSaved: data.lastSaved || '',
          ownerId: data.ownerId || null,
          isOwner: data.ownerId === user.uid,
        };
      }))
        .sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || ''));

      setChantiers(list);
    } catch (e) {
      console.error('[useMobileCrc] Erreur chargement chantiers:', e);
      setError('Impossible de charger les chantiers.');
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => { fetchChantiers(); }, [fetchChantiers]);

  const loadChantier = useCallback(async (chantierId) => {
    if (!companyId) return null;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'crr', chantierId));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.error('[useMobileCrc] Erreur chargement chantier:', e);
      return null;
    }
  }, [companyId]);

  const saveChantier = useCallback(async (chantierId, data) => {
    if (!companyId) return;
    if (data?.ownerId !== user?.uid) throw new Error('Modification réservée au créateur du CRC.');
    try {
      await setDoc(doc(db, 'companies', companyId, 'crr', chantierId), {
        ...data,
        lastSaved: new Date().toISOString(),
        updatedBy: user?.email || '',
      });
    } catch (err) {
      console.error('[useMobileCrc] Erreur sauvegarde:', err);
      throw err; // Relancer pour que useRobustSave gère le retry
    }
  }, [companyId, user]);

  return { chantiers, isLoading, error, refetch: fetchChantiers, loadChantier, saveChantier };
};
