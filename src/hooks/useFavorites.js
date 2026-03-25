// src/hooks/useFavorites.js
//
// Gestion des clauses favorites (CCTP + RC).
// Persistance localStorage — clé "estima_favorites".
//
// Structure d'un favori :
// {
//   id        : string  — identifiant unique du favori
//   nodeId    : string  — id du nœud source
//   type      : 'cctp' | 'rc'
//   title     : string
//   content   : string  — HTML
//   level     : number
//   addedAt   : string  — ISO date
// }

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'estima_favorites';

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const save = (favorites) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {}
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useState(load);

  // Persistance automatique
  useEffect(() => {
    save(favorites);
  }, [favorites]);

  // Ajoute ou retire un nœud des favoris
  const toggleFavorite = useCallback((node, type) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.nodeId === node.id && f.type === type);
      if (exists) {
        return prev.filter(f => !(f.nodeId === node.id && f.type === type));
      }
      return [
        ...prev,
        {
          id: `${type}_${node.id}_${Date.now()}`,
          nodeId: node.id,
          type,
          title: node.title || 'Sans titre',
          content: node.content || '',
          level: node.level || 1,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const isFavorite = useCallback(
    (nodeId, type) => favorites.some(f => f.nodeId === nodeId && f.type === type),
    [favorites]
  );

  const removeFavorite = useCallback((favoriteId) => {
    setFavorites(prev => prev.filter(f => f.id !== favoriteId));
  }, []);

  const getFavoritesByType = useCallback(
    (type) => favorites.filter(f => f.type === type),
    [favorites]
  );

  // Met à jour le contenu d'un favori si le nœud source a été modifié
  const syncFavorite = useCallback((node, type) => {
    setFavorites(prev =>
      prev.map(f =>
        f.nodeId === node.id && f.type === type
          ? { ...f, title: node.title || f.title, content: node.content ?? f.content }
          : f
      )
    );
  }, []);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    removeFavorite,
    getFavoritesByType,
    syncFavorite,
  };
};