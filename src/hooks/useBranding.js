// src/hooks/useBranding.js
//
// Source unique de résolution du branding.
//
// Ordre de priorité (du plus faible au plus fort) :
//   1. DEFAULT_BRANDING        — valeurs par défaut garanties
//   2. localStorage fallback   — branding sauvegardé hors-ligne (legacy)
//   3. masterBranding Firebase — branding MOE global (resources/branding)
//   4. project.branding        — surcharge spécifique au projet (optionnelle)
//
// Chaque niveau fait un deep-merge partiel : seuls les champs présents
// et non-null écrasent le niveau inférieur.
// Les consommateurs reçoivent toujours un objet complet — jamais d'undefined.
//
// Usage :
//   const branding = useBranding(masterBranding, project);
//   // → objet résolu, stable, mémoïsé

import { useMemo } from 'react';

// ─── VALEURS PAR DÉFAUT ───────────────────────────────────────────────────────
// Copie locale pour éviter une dépendance circulaire avec BrandingView.
// Si DEFAULT_BRANDING évolue dans BrandingView, synchroniser ici.
export const DEFAULT_BRANDING = {
  logo:        null,
  companyName: '',
  tagline:     '',
  address:     '',
  zip:         '',
  city:        '',
  phone:       '',
  email:       '',
  website:     '',
  showEstimaCredit: true,
  colors: {
    primary:   '#286E55',
    secondary: '#32B482',
    text:      '#282828',
    subtle:    '#64748B',
  },
  fonts: {
    headings: 'Helvetica',
    main:     'Helvetica',
  },
  sizes: {
    title1: 28,
    title2: 24,
    title3: 22,
    title4: 20,
    title5: 18,
    body:   22,
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * deepMerge(base, ...overrides)
 * Fusionne profondément les sous-objets connus (colors, fonts, sizes).
 * Les valeurs null/undefined dans les overrides sont ignorées.
 */
function deepMerge(base, ...overrides) {
  let result = { ...base };

  overrides.forEach(override => {
    if (!override || typeof override !== 'object') return;

    Object.entries(override).forEach(([key, val]) => {
      if (val === null || val === undefined) return;

      if (
        typeof val === 'object' &&
        !Array.isArray(val) &&
        typeof result[key] === 'object' &&
        result[key] !== null
      ) {
        // Deep merge pour les sous-objets (colors, fonts, sizes)
        result[key] = { ...result[key] };
        Object.entries(val).forEach(([subKey, subVal]) => {
          if (subVal !== null && subVal !== undefined) {
            result[key][subKey] = subVal;
          }
        });
      } else {
        result[key] = val;
      }
    });
  });

  return result;
}

/**
 * readLocalStorageFallback()
 * Lit le branding sauvegardé en localStorage (legacy offline).
 * Retourne null si absent ou invalide.
 */
function readLocalStorageFallback() {
  try {
    const raw = localStorage.getItem('papyrus_branding');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

/**
 * useBranding(masterBranding, project?)
 *
 * @param {object|null} masterBranding  — branding MOE depuis Firebase (useAppResources)
 * @param {object|null} project         — projet courant (peut contenir project.branding)
 * @returns {object}                    — branding résolu, toujours complet
 */
export function useBranding(masterBranding, project = null) {
  return useMemo(() => {
    // Niveau 2 : localStorage (fallback hors-ligne, uniquement si Firebase n'a rien)
    const localFallback = (!masterBranding || Object.keys(masterBranding).length === 0)
      ? readLocalStorageFallback()
      : null;

    // Niveau 4 : surcharge projet (champ optionnel, rarement renseigné)
    const projectBranding = project?.branding || null;

    return deepMerge(
      DEFAULT_BRANDING,    // base
      localFallback,       // niveau 2 (null ignoré par deepMerge)
      masterBranding,      // niveau 3
      projectBranding,     // niveau 4
    );
  }, [masterBranding, project?.branding]);
}