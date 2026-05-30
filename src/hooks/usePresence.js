// src/hooks/usePresence.js
//
// Présence temps réel via Firestore.
// Chemin : companies/{companyId}/presence/{userId}
//
// Chaque utilisateur écrit sa position toutes les HEARTBEAT_MS.
// Les entrées > STALE_MS sont considérées hors-ligne.

import { useEffect, useRef, useState } from 'react';
import {
  doc, setDoc, deleteDoc, onSnapshot,
  collection, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const HEARTBEAT_MS = 25_000;
const STALE_MS     = 70_000;

// ─── HOOK ÉMETTEUR ────────────────────────────────────────────────────────────
// Diffuse la présence de l'utilisateur. En plus du couple projectId/projectName
// (consommé par les tuiles de la Gestion de Projets, comportement inchangé), on
// publie une "entité" générique { entityType, entityId, entityName } qui désigne
// l'élément réellement ouvert dans n'importe quel module (estimation, RAO, CRC,
// devis MOE, doc admin, visite…). C'est cette entité que lit useCoEditors pour
// afficher la bannière d'alerte de co-édition.
export function usePresence({
  user, companyId, projectId, projectName, activeTab,
  entityType = null, entityId = null, entityName = null,
}) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user || !companyId) return;

    const ref = doc(db, 'companies', companyId, 'presence', user.uid);
    const isOnProject = activeTab === 'project' && !!projectId;
    const hasEntity = !!entityType && !!entityId;

    const write = async () => {
      try {
        await setDoc(ref, {
          uid:         user.uid,
          email:       user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
          projectId:   isOnProject ? projectId   : null,
          projectName: isOnProject ? projectName : null,
          entityType:  hasEntity ? entityType : null,
          entityId:    hasEntity ? entityId   : null,
          entityName:  hasEntity ? entityName : null,
          activeTab:   activeTab || null,
          lastSeen:    serverTimestamp(),
        }, { merge: true });
      } catch { /* ignore */ }
    };

    write();
    intervalRef.current = setInterval(write, HEARTBEAT_MS);

    const handleUnload = () => deleteDoc(ref).catch(() => {});
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
      deleteDoc(ref).catch(() => {});
    };
  }, [user?.uid, companyId, projectId, projectName, activeTab, entityType, entityId, entityName]);
}

// ─── HOOK LECTEUR : CO-ÉDITEURS D'UNE ENTITÉ ──────────────────────────────────
// Retourne la liste des AUTRES utilisateurs actuellement sur la même entité
// (même entityType + entityId). Utilisé pour la bannière d'alerte d'écrasement.
export function useCoEditors({ companyId, currentUserId, entityType, entityId }) {
  const [editors, setEditors] = useState([]);

  useEffect(() => {
    if (!companyId || !entityType || !entityId) {
      setEditors([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'companies', companyId, 'presence'),
      (snap) => {
        const now = Date.now();
        const active = snap.docs
          .map(d => ({ ...d.data(), _id: d.id }))
          .filter(p => {
            if (!p.lastSeen) return false;
            const ms = p.lastSeen instanceof Timestamp ? p.lastSeen.toMillis() : now;
            return (now - ms) < STALE_MS;
          })
          .filter(p => p.uid !== currentUserId)
          .filter(p => p.entityType === entityType && p.entityId === entityId);
        setEditors(active);
      },
      () => {}
    );

    return () => unsub();
  }, [companyId, currentUserId, entityType, entityId]);

  return editors;
}

// ─── HOOK LECTEUR ─────────────────────────────────────────────────────────────
export function usePresenceReader({ companyId, currentUserId }) {
  const [allPresence, setAllPresence] = useState([]);

  useEffect(() => {
    if (!companyId) return;

    const unsub = onSnapshot(
      collection(db, 'companies', companyId, 'presence'),
      (snap) => {
        const now = Date.now();
        const active = snap.docs
          .map(d => ({ ...d.data(), _id: d.id }))
          .filter(p => {
            if (!p.lastSeen) return false;
            const ms = p.lastSeen instanceof Timestamp
              ? p.lastSeen.toMillis() : now;
            return (now - ms) < STALE_MS;
          })
          .filter(p => p.uid !== currentUserId);
        setAllPresence(active);
      },
      () => {}
    );

    return () => unsub();
  }, [companyId, currentUserId]);

  const presenceByProject = allPresence.reduce((acc, p) => {
    if (!p.projectId) return acc;
    if (!acc[p.projectId]) acc[p.projectId] = [];
    acc[p.projectId].push(p);
    return acc;
  }, {});

  return { allPresence, presenceByProject };
}