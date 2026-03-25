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
export function usePresence({ user, companyId, projectId, projectName, activeTab }) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user || !companyId) return;

    const ref = doc(db, 'companies', companyId, 'presence', user.uid);
    const isOnProject = activeTab === 'project' && !!projectId;

    const write = async () => {
      try {
        await setDoc(ref, {
          uid:         user.uid,
          email:       user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
          projectId:   isOnProject ? projectId   : null,
          projectName: isOnProject ? projectName : null,
          activeTab:   activeTab || null,
          lastSeen:    serverTimestamp(),
        }, { merge: true });
      } catch {}
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
  }, [user?.uid, companyId, projectId, projectName, activeTab]);
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