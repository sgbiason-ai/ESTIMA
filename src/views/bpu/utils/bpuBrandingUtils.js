// ── HELPERS COULEURS ──────────────────────────────────────────────────────────

export const hexToRgb = (hex) => {
  if (!hex) return "40, 110, 85";
  const r = parseInt(hex.slice(1, 3), 16) || 40;
  const g = parseInt(hex.slice(3, 5), 16) || 110;
  const b = parseInt(hex.slice(5, 7), 16) || 85;
  return `${r}, ${g}, ${b}`;
};

export const hexToDocxColor = (hex) => (hex ? hex.replace('#', '') : "286E55");

export const lighten = (hex, amount = 0.9) => {
  if (!hex) return 'rgb(240, 245, 243)';
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgb(${Math.round(r + (255 - r) * amount)}, ${Math.round(g + (255 - g) * amount)}, ${Math.round(b + (255 - b) * amount)})`;
};

// ── RÉSOLUTION DU BRANDING DEPUIS masterBranding ──────────────────────────────
// Centralisé ici pour que tous les fichiers utilisent le même objet normalisé.

export const resolveBranding = (masterBranding = {}) => ({
  logo:        masterBranding?.logo        || null,
  companyName: masterBranding?.companyName || '',
  tagline:     masterBranding?.tagline     || '',
  address:     masterBranding?.address     || '',
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
