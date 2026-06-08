// src/utils/pdf/buildTheme.js
//
// ─────────────────────────────────────────────────────────────────────────────
// Thème PDF centralisé — utilisé par tous les générateurs PDF.
//
// `buildTheme(branding, overrides)` renvoie un objet THEME complet.
// Les générateurs qui ont besoin de couleurs spécifiques (CRR status,
// RAO oui/non…) passent un objet `overrides` qui sera fusionné à la fin.
// ─────────────────────────────────────────────────────────────────────────────

import { hexToRgbArray, lightenRgb } from './pdfSharedHelpers';

// ─── THÈME PAR DÉFAUT ─────────────────────────────────────────────────────────
// Valeurs utilisées quand aucun branding n'est fourni.
export const DEFAULT_THEME = {
  primary:    [40, 110, 85],
  accent:     [50, 180, 130],
  text:       [40, 40, 40],
  lightText:  [100, 116, 139],
  chapterBg:  [200, 245, 225],
  secondary:  [245, 250, 248],
  borders:    [220, 235, 230],
  headerBg:   [245, 250, 248],   // lightenRgb(primary, 0.92)
  tableBg:    [230, 244, 238],   // lightenRgb(primary, 0.88)
  lightBg:    [245, 250, 248],   // lightenRgb(primary, 0.96)
  categoryBg: [207, 236, 224],   // lightenRgb(primary, 0.82)
  tableAlt:   [245, 250, 248],   // lightenRgb(primary, 0.96)
  tableHeader:[40, 110, 85],     // = primary (fond en-tête tableau)
  pse:        [180, 83, 9],
  pseBg:      [255, 245, 230],   // fond clair des blocs PSE / options
  white:      [255, 255, 255],
};

// ─── CONSTRUCTION DU THÈME DEPUIS LE BRANDING ───────────────────────────────
// Si `branding.colors` est renseigné, toutes les variantes sont recalculées
// depuis la couleur primaire. Sinon on retourne le DEFAULT_THEME.
//
// `overrides` — couleurs spécifiques au générateur (status CRR, oui/non RAO…).
// `defaults`  — permet à un générateur de surcharger les couleurs par défaut
//               quand aucun branding n'est fourni (ex: CCTP bleu, Analyse vert foncé).
export const buildTheme = (branding, overrides = {}, defaults = {}) => {
  const base = { ...DEFAULT_THEME, ...defaults };

  if (!branding?.colors) return { ...base, ...overrides };

  const primary   = hexToRgbArray(branding.colors.primary)   || base.primary;
  const accent    = hexToRgbArray(branding.colors.secondary)  || base.accent;
  const text      = hexToRgbArray(branding.colors.text)       || base.text;
  const lightText = hexToRgbArray(branding.colors.subtle)     || base.lightText;

  // Couleurs « avancées » : override explicite, sinon dérivée ("auto").
  const c = branding.colors;
  const pse = hexToRgbArray(c.pse) || DEFAULT_THEME.pse;

  return {
    primary,
    accent,
    text,
    lightText,
    chapterBg:  hexToRgbArray(c.chapterBg)   || lightenRgb(primary, 0.85),
    secondary:  lightenRgb(primary, 0.96),
    borders:    lightenRgb(primary, 0.80),
    headerBg:   lightenRgb(primary, 0.92),
    tableBg:    lightenRgb(primary, 0.88),
    lightBg:    lightenRgb(primary, 0.96),
    categoryBg: lightenRgb(primary, 0.82),
    tableAlt:   hexToRgbArray(c.tableAlt)    || lightenRgb(primary, 0.96),
    tableHeader:hexToRgbArray(c.tableHeader) || primary,
    pse,
    pseBg:      lightenRgb(pse, 0.88),
    white:      DEFAULT_THEME.white,
    ...overrides,
  };
};
