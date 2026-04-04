// src/hooks/useOrientation.js
//
// Détecte l'orientation de l'écran (portrait/paysage).
// Utilisé par les composants mobiles pour adapter le layout.

import { useState, useEffect } from 'react';

const mql = typeof window !== 'undefined'
  ? window.matchMedia('(orientation: landscape)')
  : null;

export const useOrientation = () => {
  const [isLandscape, setIsLandscape] = useState(mql?.matches || false);

  useEffect(() => {
    if (!mql) return;
    const handler = (e) => setIsLandscape(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return { isLandscape, isPortrait: !isLandscape };
};
