// ── HELPERS COULEURS ──────────────────────────────────────────────────────────
// hexToRgb et lighten centralisés dans colorHelpers.js
// Re-exports pour compatibilité avec les imports existants
import { hexToRgbString, lightenHex } from '../../../utils/colorHelpers';

export const hexToRgb = hexToRgbString;
export const lighten = lightenHex;

export const hexToDocxColor = (hex) => (hex ? hex.replace('#', '') : "286E55");

// ── RÉSOLUTION DU BRANDING DEPUIS masterBranding ──────────────────────────────
// Centralisé ici pour que tous les fichiers utilisent le même objet normalisé.

export const resolveBranding = (masterBranding = {}) => ({
  coverTemplate: masterBranding?.coverTemplate || 'estima',
  logo:        masterBranding?.logo        || null,
  companyName: masterBranding?.companyName || '',
  tagline:     masterBranding?.tagline     || '',
  address:     masterBranding?.address     || '',
  zip:         masterBranding?.zip         || '',
  city:        masterBranding?.city        || '',
  phone:       masterBranding?.phone       || '',
  email:       masterBranding?.email       || '',
  website:     masterBranding?.website     || '',
  colors: {
    primary:   masterBranding?.colors?.primary   || '#286E55',
    secondary: masterBranding?.colors?.secondary || '#32B482',
    text:      masterBranding?.colors?.text      || '#282828',
    subtle:    masterBranding?.colors?.subtle    || '#64748B',
  },
  fonts: {
    headings: masterBranding?.fonts?.headings || 'Helvetica',
    main:     masterBranding?.fonts?.main     || 'Helvetica',
  },
});
