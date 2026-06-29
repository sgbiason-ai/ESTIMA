// src/data/branding.js
//
// ═══════════════════════════════════════════════════════════════════
// CE FICHIER EST LE POINT CENTRAL DE LA CHARTE GRAPHIQUE.
//
// Il est importé par :
//  - BrandingModal.jsx  → pour réinitialiser aux valeurs par défaut
//  - BrandingView.jsx   → même usage
//  - pdfGenerator.js    → couleurs par défaut si pas de branding
//  - cctpExport.js      → polices et tailles par défaut
//  - rcExport.js        → idem
//
// STRUCTURE DE L'OBJET BRANDING :
//
//  Racine :
//    logo, companyName, tagline, address, phone, email, website
//
//  Sous-objets :
//    colors  : { primary, secondary, text, subtle }  → codes hex
//    fonts   : { headings, main }                    → noms polices
//    sizes   : { title1..title5, body }              → demi-points Word
//
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_BRANDING = {
  // Identité société (affiché en pied de page de garde)
  logo:        null,
  companyName: '',
  tagline:     '',
  address:     '',
  phone:       '',
  email:       '',
  website:     '',

  // Mention produit « Édité avec ESTIMA VRD » sur les exports (true = affichée)
  showEstimaCredit: true,

  // Couleurs (hexadécimaux)
  colors: {
    primary:   '#286E55',  // titres, bandeau, accents forts
    secondary: '#32B482',  // traits, soulignements
    text:      '#282828',  // corps de texte
    subtle:    '#64748B',  // labels, notes, métadonnées
  },

  // Polices (noms valides pour jsPDF + docx)
  fonts: {
    headings: 'Helvetica',
    main:     'Helvetica',
  },

  // Tailles en demi-points (÷2 = points réels)
  // Ex : 28 → 14pt
  sizes: {
    title1: 28,
    title2: 24,
    title3: 22,
    title4: 20,
    title5: 18,
    body:   22,
  },
};

// Polices proposées dans les menus déroulants
export const AVAILABLE_FONTS = [
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Calibri',
  'Arial',
  'Trebuchet MS',
  'Verdana',
  'Palatino',
  'Book Antiqua',
  'Cambria',
  'Century Gothic',
];