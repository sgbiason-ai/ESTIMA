// src/hooks/useMobileCrc.js
//
// Charge les données CRC (Compte Rendu Chantier) depuis Firestore.
// Utilisé par la vue mobile — lecture + écriture.
// Chemin : companies/{companyId}/crr/

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { buildActionRows } from '../utils/crcActionPlan';

const APP_SUPER_ADMIN_EMAIL = 'samuel.biason@papyrus-be.fr';

export const useMobileCrc = (user, companyId) => {
  const [chantiers, setChantiers] = useState([]);
  // Plan d'actions transversal : lignes extraites des docs complets pendant le
  // fetch (les docs sont deja telecharges pour le resume, puis relaches).
  const [actionRows, setActionRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const fetchChantiers = useCallback(async () => {
    if (!user || !companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'crr'));
      const isSuperUser = user.email === APP_SUPER_ADMIN_EMAIL;
      const fullDocs = []; // docs complets, le temps d'en extraire les actions
      const list = (await Promise.all(snap.docs.map(async d => {
        let data = d.data();
        // Reprise des anciens CRC sans propriétaire — best-effort : un refus de
        // règle ne doit jamais faire disparaître la liste (cf. desktop CrcView).
        if (isSuperUser && !data.ownerId) {
          const ownership = { ownerId: user.uid, ownerEmail: user.email || '' };
          try {
            await setDoc(d.ref, ownership, { merge: true });
            data = { ...data, ...ownership };
          } catch (e) {
            console.warn('[useMobileCrc] Reprise ownerId ignorée:', d.id, e?.code || e);
          }
        }
        const config = data.crrConfig || {};
        const meetings = data.crrMeetings || [];
        fullDocs.push({ id: d.id, ...data });
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
          // Chantier termine (cf. utils/crcChantierStatus) : masque par defaut
          // dans la liste terrain, ouvrable en lecture seule.
          archivedAt: data.archivedAt || null,
        };
      })))
        .sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || ''));

      setChantiers(list);
      setActionRows(buildActionRows(fullDocs));
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

  // Terminer / reactiver une affaire (champ archivedAt, cf. crcChantierStatus).
  // updateDoc cible et non setDoc : aucun risque d'ecraser le document complet
  // depuis le mobile, qui n'en detient qu'un resume.
  const setChantierArchived = useCallback(async (chantierId, archived) => {
    if (!companyId) return;
    await updateDoc(doc(db, 'companies', companyId, 'crr', chantierId), archived
      ? { archivedAt: new Date().toISOString(), archivedBy: user?.email || '' }
      : { archivedAt: deleteField(), archivedBy: deleteField() });
    setChantiers((prev) => prev.map((c) => (c.id === chantierId
      ? { ...c, archivedAt: archived ? new Date().toISOString() : null }
      : c)));
    // Plan d'actions : un chantier termine sort de l'echeancier immediatement ;
    // une reactivation necessite le doc complet → re-fetch.
    if (archived) setActionRows((prev) => prev.filter((r) => r.chantierId !== chantierId));
    else fetchChantiers();
  }, [companyId, user, fetchChantiers]);

  return { chantiers, actionRows, isLoading, error, refetch: fetchChantiers, loadChantier, saveChantier, setChantierArchived };
};
