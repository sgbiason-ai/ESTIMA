// src/hooks/useNegoTemplate.js
//
// Trame globale du courrier de négociation, persistée au niveau utilisateur dans Firestore :
//   users/{uid}/preferences/negotiation_template
//
// La trame est partagée entre tous les projets du même utilisateur (une "trame standard"
// PAPYRUS / MOE). Sync multi-device via onSnapshot.

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const PATH = (uid) => ['users', uid, 'preferences', 'negotiation_template'];

export const useNegoTemplate = (defaultTemplate) => {
  const [template, setTemplate] = useState(defaultTemplate);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setTemplate(defaultTemplate);
      setLoading(false);
      return;
    }
    const ref = doc(db, ...PATH(uid));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setTemplate(data?.html || defaultTemplate);
        setLoading(false);
      },
      (err) => {
        console.warn('[useNegoTemplate] onSnapshot:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [defaultTemplate]);

  const saveTemplate = useCallback(async (html) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const ref = doc(db, ...PATH(uid));
      await setDoc(
        ref,
        { html, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn('[useNegoTemplate] saveTemplate:', e.message);
    }
  }, []);

  return { template, saveTemplate, loading };
};
