// src/utils/pdf/pdfSharedHelpers.js
// Helpers partagés entre tous les générateurs PDF (jsPDF)
// Centralise : conversion couleurs, chargement images, formatage dates

// ─── COULEURS ──────────────────────────────────────────────────────────────

/** Convertit un hex (#RRGGBB) en tableau [R, G, B]. Retourne null si invalide. */
export const hexToRgbArray = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
};

/** Eclaircit un tableau RGB par un facteur (0..1). */
export const lightenRgb = (rgb, f = 0.85) => rgb.map((c) => Math.round(c + (255 - c) * f));

/** Assombrit un tableau RGB par un facteur (0..1). */
export const darkenRgb = (rgb, f = 0.15) => rgb.map((c) => Math.round(c * (1 - f)));

// ─── IMAGES ────────────────────────────────────────────────────────────────

/** Charge une image (URL ou data:) et retourne un HTMLImageElement ou null. */
export const loadImage = (source) =>
  new Promise((resolve) => {
    if (!source) return resolve(null);
    const img = new Image();
    if (!source.startsWith('data:')) img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = source;
  });

// ─── FORMATAGE ─────────────────────────────────────────────────────────────

/** Formate une date YYYY-MM-DD en DD/MM/YYYY. */
export const formatDateFr = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

/** Formate une date YYYY-MM-DD en format long français (ex: "lundi 4 avril 2026"). */
export const formatDateLong = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return formatDateFr(dateStr); }
};

/** Nettoie un nom de fichier (retire accents, garde espaces comme _, caracteres speciaux retirés). */
export const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return 'Document';
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // é→e, è→e, à→a, etc.
    .replace(/\s+/g, '_')                               // espaces → _
    .replace(/[^a-zA-Z0-9_\-]/g, '')                    // retire les caractères spéciaux
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .substring(0, 60);
};

/** Retire les retours a la ligne et trim. */
export const cleanText = (str) => typeof str === 'string' ? str.replace(/[\r\n]+/g, ' ').trim() : '';

/** Formate un nombre avec locale FR (ex: 1 234,56). */
export const formatNumberFr = (value) => {
  if (value === undefined || value === null || value === '' || isNaN(Number(value))) return '-';
  const num = Number(value);
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
};
