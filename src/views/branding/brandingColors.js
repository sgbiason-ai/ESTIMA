// src/views/branding/brandingColors.js
// Source unique des couleurs « avancées » de la charte (contextes CSS / hexa).
//
// Modèle "auto par défaut, débrayage ponctuel" :
//   - si la couleur n'est PAS définie dans branding.colors → valeur DÉRIVÉE ("auto")
//   - si elle est définie → override explicite
//
// Le rendu PDF (buildTheme.js) applique la même dérivation côté RGB.
// Garder les deux formules alignées (lightenToHex ↔ lightenRgb, mêmes facteurs).

import { lightenToHex } from '../../utils/colorHelpers';

export const PSE_DEFAULT = '#B45309';       // orange PSE / options (rgb 180,83,9)
export const HEADING3_DEFAULT = '#444444';  // titre niveau 3 (CCTP / RC)

const FALLBACK_PRIMARY = '#286E55';
const FALLBACK_SECONDARY = '#32B482';

/**
 * Renvoie la valeur effective (override ou dérivée) de chaque couleur avancée.
 * @param {object} colors - branding.colors
 */
export const resolveAdvancedColors = (colors = {}) => {
  const primary = colors.primary || FALLBACK_PRIMARY;
  const secondary = colors.secondary || FALLBACK_SECONDARY;
  return {
    tableHeader: colors.tableHeader || primary,
    tableAlt:    colors.tableAlt    || lightenToHex(primary, 0.96),
    chapterBg:   colors.chapterBg   || lightenToHex(primary, 0.85),
    pse:         colors.pse         || PSE_DEFAULT,
    heading1:    colors.heading1    || primary,
    heading2:    colors.heading2    || secondary,
    heading3:    colors.heading3    || HEADING3_DEFAULT,
  };
};

// Métadonnées pour l'éditeur (onglet Couleurs).
export const ADVANCED_TABLE_COLORS = [
  { key: 'tableHeader', label: 'En-tête de tableau', description: "Fond de la ligne d'en-tête (N°, Désignation…)" },
  { key: 'tableAlt',    label: 'Lignes alternées',   description: 'Fond une ligne sur deux' },
  { key: 'chapterBg',   label: 'Fond de chapitre',   description: 'Bandeau de titre de chapitre' },
  { key: 'pse',         label: 'PSE / Options',      description: 'Blocs prestations supplémentaires (texte + fond)' },
];

export const ADVANCED_TITLE_COLORS = [
  { key: 'heading1', label: 'Titre 1', description: 'Chapitres (CCTP, RC) — MAJUSCULES' },
  { key: 'heading2', label: 'Titre 2', description: 'Sous-chapitres' },
  { key: 'heading3', label: 'Titre 3', description: 'Niveau 3 (italique)' },
];
