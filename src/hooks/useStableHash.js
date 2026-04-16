// src/hooks/useStableHash.js
// Hook utilitaire : retourne un hash stable (string) d'un objet.
// Ne re-calcule le hash que si la référence change, et ne trigger un
// changement de valeur que si le contenu a réellement changé.
// Usage principal : remplacer JSON.stringify(project) dans les deps useEffect.

import { useRef } from 'react';

/**
 * Retourne un hash string stable pour un objet.
 * La string ne change que si le contenu JSON a changé.
 * Évite de sérialiser à chaque render si la référence n'a pas changé.
 *
 * @param {any} value - l'objet à observer
 * @returns {string} hash stable (JSON string, comparaison par valeur)
 */
export const useStableHash = (value) => {
  const prevRef = useRef(value);
  const hashRef = useRef('');

  // Si la référence est la même, le contenu n'a pas changé
  if (value === prevRef.current) return hashRef.current;

  // Référence différente → sérialiser pour comparer
  const newHash = JSON.stringify(value);
  if (newHash !== hashRef.current) {
    hashRef.current = newHash;
  }
  prevRef.current = value;

  return hashRef.current;
};
