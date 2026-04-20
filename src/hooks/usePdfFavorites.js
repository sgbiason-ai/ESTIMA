// src/hooks/usePdfFavorites.js
//
// Favoris PDF (URLs SharePoint) persistés dans Firestore :
// users/{uid}/preferences/pdfFavorites → { list: [{id, name, url}], updatedAt }
// Sync multi-device via onSnapshot.

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const PATH = (uid) => ['users', uid, 'preferences', 'pdfFavorites'];

const uid6 = () => Math.random().toString(36).slice(2, 8);

export const usePdfFavorites = (userId) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    const ref = doc(db, ...PATH(userId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setFavorites(Array.isArray(data.list) ? data.list : []);
        setLoading(false);
      },
      (err) => {
        console.warn('[usePdfFavorites] onSnapshot:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userId]);

  const persist = useCallback(async (list) => {
    if (!userId) return;
    try {
      const ref = doc(db, ...PATH(userId));
      await setDoc(ref, { list, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn('[usePdfFavorites] persist:', e.message);
    }
  }, [userId]);

  const addFavorite = useCallback((name, url) => {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl) return;
    if (favorites.some(f => f.url === cleanUrl)) return; // déjà présent
    const next = [...favorites, { id: uid6(), name: (name || '').trim() || cleanUrl, url: cleanUrl }];
    persist(next);
  }, [favorites, persist]);

  const updateFavorite = useCallback((id, patch) => {
    const next = favorites.map(f => f.id === id ? { ...f, ...patch } : f);
    persist(next);
  }, [favorites, persist]);

  const removeFavorite = useCallback((id) => {
    persist(favorites.filter(f => f.id !== id));
  }, [favorites, persist]);

  const moveFavorite = useCallback((id, direction) => {
    const idx = favorites.findIndex(f => f.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= favorites.length) return;
    const next = [...favorites];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    persist(next);
  }, [favorites, persist]);

  const isFavorite = useCallback((url) => favorites.some(f => f.url === url), [favorites]);

  const toggleFavorite = useCallback((url, name) => {
    const existing = favorites.find(f => f.url === url);
    if (existing) {
      removeFavorite(existing.id);
    } else {
      addFavorite(name, url);
    }
  }, [favorites, addFavorite, removeFavorite]);

  return {
    favorites,
    loading,
    addFavorite,
    updateFavorite,
    removeFavorite,
    moveFavorite,
    isFavorite,
    toggleFavorite,
  };
};
