// src/components/feedback/feedbackConstants.js
// Constantes partagées du module Feedback (widget utilisateur + panneau super-admin).

import { Bug, Lightbulb, Sparkles, HelpCircle } from 'lucide-react';

// Types de feedback proposés à l'utilisateur
export const FEEDBACK_TYPES = [
  { id: 'bug',         label: 'Bug',          icon: Bug,        color: 'red' },
  { id: 'idea',        label: 'Idée',         icon: Lightbulb,  color: 'amber' },
  { id: 'improvement', label: 'Amélioration', icon: Sparkles,   color: 'blue' },
  { id: 'question',    label: 'Question',     icon: HelpCircle, color: 'violet' },
];

// Statuts de traitement (gérés par le super-admin)
export const FEEDBACK_STATUSES = [
  { id: 'nouveau',  label: 'Nouveau',  color: 'blue' },
  { id: 'en_cours', label: 'En cours', color: 'amber' },
  { id: 'traite',   label: 'Traité',   color: 'emerald' },
  { id: 'rejete',   label: 'Rejeté',   color: 'gray' },
];

// Niveaux de priorité (gérés par le super-admin)
export const FEEDBACK_PRIORITIES = [
  { id: 'basse',    label: 'Basse',    color: 'gray' },
  { id: 'moyenne',  label: 'Moyenne',  color: 'blue' },
  { id: 'haute',    label: 'Haute',    color: 'amber' },
  { id: 'critique', label: 'Critique', color: 'red' },
];

export const typeMeta     = (id) => FEEDBACK_TYPES.find(t => t.id === id)      || FEEDBACK_TYPES[3];
export const statusMeta   = (id) => FEEDBACK_STATUSES.find(s => s.id === id)   || FEEDBACK_STATUSES[0];
export const priorityMeta = (id) => FEEDBACK_PRIORITIES.find(p => p.id === id) || FEEDBACK_PRIORITIES[1];

// Libellés lisibles des modules (clé = valeur de `activeModule` dans App.jsx)
export const MODULE_LABELS = {
  projects_manager: 'Gestion de Projets',
  estima:           'Estima VRD',
  rao_analysis:     'RAO & Analyse',
  tp_etude_prix:    'Étude de Prix (TP)',
  crc:              'Compte Rendu Chantier',
  doc_admin:        'Documents Administratifs',
  devis_moe:        'Devis MOE',
  expense_notes:    'Notes de Frais',
  branding:         'Identité & Charte',
  rgpd:             'Mon Compte & Données',
  site_visits:      'Visites de Site',
  admin:            'Administration',
};

export const moduleLabel = (id) => MODULE_LABELS[id] || 'Hub / Accueil';
