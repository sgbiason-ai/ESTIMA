// src/utils/motifColors.js
// Couleurs deterministes pour les motifs de trajets.
//
// - Motifs predefinis : couleurs fixes (Chantier=ambre, Reunion=bleu, etc.)
// - Motifs custom : hash → palette tournante (rose, cyan, fuchsia, lime, ...)
//
// Tailwind n'evalue pas les classes dynamiques (`bg-${color}-100`) :
// on retourne donc des objets de classes statiques.

// Pour chaque preset : tag (Tailwind classes), dot (hex pour Leaflet), pdf
// (RGB tuples pour jsPDF). Les RGB de pdf correspondent aux *-100 (fond) +
// *-800 (texte) de Tailwind, equivalent visuel des badges UI.
const PRESET = {
  'Chantier':           { tag: 'bg-amber-100 text-amber-800 border-amber-200',     dot: '#f59e0b', pdf: { bg: [254, 243, 199], text: [146, 64, 14] } },
  'Reunion sur site':   { tag: 'bg-blue-100 text-blue-800 border-blue-200',       dot: '#3b82f6', pdf: { bg: [219, 234, 254], text: [30, 64, 175] } },
  'Visite de site':     { tag: 'bg-violet-100 text-violet-800 border-violet-200', dot: '#8b5cf6', pdf: { bg: [237, 233, 254], text: [91, 33, 182] } },
  'Commerce':           { tag: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: '#10b981', pdf: { bg: [209, 250, 229], text: [6, 95, 70] } },
};

// Variantes accentuees (re/Reunion, Réunion, etc.) → meme couleur que la version "officielle"
const ALIASES = new Map([
  ['réunion sur site', 'Reunion sur site'],
  ['reunion sur site', 'Reunion sur site'],
  ['chantier', 'Chantier'],
  ['visite de site', 'Visite de site'],
  ['visite', 'Visite de site'],
  ['commerce', 'Commerce'],
]);

const FALLBACK_PALETTE = [
  { tag: 'bg-rose-100 text-rose-800 border-rose-200',           dot: '#f43f5e', pdf: { bg: [255, 228, 230], text: [159, 18, 57] } },
  { tag: 'bg-cyan-100 text-cyan-800 border-cyan-200',           dot: '#06b6d4', pdf: { bg: [207, 250, 254], text: [21, 94, 117] } },
  { tag: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',  dot: '#d946ef', pdf: { bg: [250, 232, 255], text: [134, 25, 143] } },
  { tag: 'bg-lime-100 text-lime-800 border-lime-200',           dot: '#84cc16', pdf: { bg: [236, 252, 203], text: [54, 83, 20] } },
  { tag: 'bg-orange-100 text-orange-800 border-orange-200',     dot: '#f97316', pdf: { bg: [255, 237, 213], text: [154, 52, 18] } },
  { tag: 'bg-teal-100 text-teal-800 border-teal-200',           dot: '#14b8a6', pdf: { bg: [204, 251, 241], text: [17, 94, 89] } },
  { tag: 'bg-indigo-100 text-indigo-800 border-indigo-200',     dot: '#6366f1', pdf: { bg: [224, 231, 255], text: [55, 48, 163] } },
  { tag: 'bg-pink-100 text-pink-800 border-pink-200',           dot: '#ec4899', pdf: { bg: [252, 231, 243], text: [157, 23, 77] } },
];

const NEUTRAL = { tag: 'bg-gray-100 text-gray-600 border-gray-200', dot: '#9ca3af', pdf: { bg: [243, 244, 246], text: [75, 85, 99] } };

// Hash deterministe simple (FNV-like) pour mapper un motif libre a un index palette
function hashMotif(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}

/** Retourne {tag, dot} pour un motif donne. */
export function getMotifColor(motif) {
  const m = (motif || '').trim();
  if (!m) return NEUTRAL;
  // Match direct sur preset
  if (PRESET[m]) return PRESET[m];
  // Match via alias (lowercase / accents)
  const alias = ALIASES.get(m.toLowerCase());
  if (alias && PRESET[alias]) return PRESET[alias];
  // Hash → palette tournante
  return FALLBACK_PALETTE[hashMotif(m) % FALLBACK_PALETTE.length];
}
