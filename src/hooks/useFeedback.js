// src/hooks/useFeedback.js
// Accès Firestore au module Feedback.
//  - submitFeedback : création par tout utilisateur authentifié (collection globale)
//  - useFeedbackList : abonnement temps réel, réservé au super-admin (rules)
//  - updateFeedback / deleteFeedback : mutations super-admin

import { useEffect, useState } from 'react';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const COL = 'feedback';

/**
 * Envoi d'un feedback. Le statut et la priorité par défaut sont posés ici
 * (et non côté UI) pour rester cohérents quelle que soit la source.
 */
export const submitFeedback = (payload) =>
  addDoc(collection(db, COL), {
    ...payload,
    status: 'nouveau',
    priority: 'moyenne',
    adminNote: '',
    createdAt: serverTimestamp(),
  });

/**
 * Abonnement temps réel à tous les feedbacks (super-admin uniquement).
 * @param {boolean} enabled - n'abonne que si vrai (évite les permission-denied)
 */
export const useFeedbackList = (enabled) => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { setError(err); setLoading(false); }
    );
    return unsub;
  }, [enabled]);

  return { items, loading, error };
};

export const updateFeedback = (id, patch) => updateDoc(doc(db, COL, id), patch);
export const deleteFeedback = (id)         => deleteDoc(doc(db, COL, id));
