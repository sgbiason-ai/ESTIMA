// src/data/changelog.js
// Version courante et historique des nouveautés.
// Pour ajouter une version : ajouter une entrée en haut du tableau, bumper APP_VERSION.

export const APP_VERSION = '2.1.0';

export const CHANGELOG = [
  {
    version: '2.1.0',
    date: '2026-04-07',
    title: 'Refonte visuelle & Expérience utilisateur',
    highlights: [
      'Nouveau hub d\'accueil style Bento Box Apple (fond clair)',
      'Widget météo dynamique intégré (Open-Meteo, sans clé API)',
      'Couleurs par dossier dans la gestion de projets',
      'Design fond clair moderne sur le hub et la gestion de projets',
      'Ribbon toolbar redesigné pour le gestionnaire de projets',
      'Sidebar dossiers avec couleurs distinctives',
      'Système de changelog intégré (cette fenêtre !)',
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
