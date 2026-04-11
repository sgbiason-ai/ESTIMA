// src/utils/colorHelpers.js
// Utilitaires couleurs pour contextes CSS (inline styles, Tailwind)
// Pour contextes PDF (jsPDF arrays), utiliser pdf/pdfSharedHelpers.js

/**
 * Convertit un hex (#RRGGBB) en string "R, G, B" pour usage CSS rgba()
 */
export const hexToRgbString = (hex, fallback = '40, 110, 85') => {
  if (!hex) return fallback;
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return fallback;
  return m.map(c => parseInt(c, 16)).join(', ');
};

/**
 * Eclaircit un hex et retourne "rgb(R, G, B)" pour inline styles
 */
export const lightenHex = (hex, factor = 0.9) => {
  if (!hex) return 'rgb(230, 240, 235)';
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return 'rgb(230, 240, 235)';
  const rgb = m.map(c => {
    const v = parseInt(c, 16);
    return Math.round(v + (255 - v) * factor);
  });
  return `rgb(${rgb.join(', ')})`;
};
