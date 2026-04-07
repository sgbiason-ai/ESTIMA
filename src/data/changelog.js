// src/data/changelog.js
// Version courante et historique des nouveautés.
// Pour ajouter une version : ajouter une entrée en haut du tableau, bumper APP_VERSION.

export const APP_VERSION = '2.1.0';

export const CHANGELOG = [
  {
    version: '2.1.0',
    date: '2026-04-07',
    title: 'Refonte visuelle EstimaStyle + fonctionnalités CRC',
    highlights: [
      'Nouveau hub d\'accueil Bento Box Apple (fond clair, 3 thèmes)',
      'Widget météo dynamique intégré (Open-Meteo)',
      'Design EstimaStyle sur toutes les vues : Hub, Login, Administration, Branding, Gestion de Projets, CRC, Documents Admin',
      'Design EstimaMobileStyle haute lisibilité pour usage extérieur',
      'Sidebar ESTIMA refaite en fond clair avec navigation bleue',
      'Couleurs par dossier dans la gestion de projets (6 couleurs)',
      'Drag & drop des observations CRC (réordonner + déplacer entre catégories)',
      'Logo commune dans la fiche info chantier CRC (glisser-déposer)',
      'Logo commune centré dans l\'export PDF et l\'aperçu CRC',
      'Onglets mobiles haute visibilité (noir sur blanc)',
      'Système de changelog intégré avec modal Nouveautés',
      'Correction accès module Administration (Firestore rules super-admin)',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-04-01',
    title: 'Estima Suite V2 — Lancement',
    highlights: [
      'Nouvelle architecture modulaire (hub + modules indépendants)',
      'Gestion de projets Cloud avec dossiers hiérarchiques',
      'Sauvegarde automatique avec historique de snapshots',
      'Export PDF et Excel améliorés (jsPDF, ExcelJS)',
      'Système de branding centralisé (masterBranding)',
      'PWA mobile avec partage natif et mode hors-ligne',
      'Monitoring Sentry + ErrorBoundary',
      'Multi-tenant Firestore avec isolation stricte',
    ],
  },
];
