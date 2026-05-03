// src/config/superAdmin.js
// Identification du super-administrateur global de l'application.
// Le super-admin est le seul à pouvoir gérer les permissions par module
// dans l'onglet « Permissions » de l'Administration.

export const SUPER_ADMIN_EMAIL = 'samuel.biason@papyrus-be.fr';

export const isSuperAdmin = (email) =>
  !!email && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

// Liste canonique des modules du Hub pouvant être individuellement attribués
// à un utilisateur. Le module « admin » n'est volontairement PAS dans cette
// liste : il est entièrement contrôlé par le flag `isAdmin` du document user.
export const ASSIGNABLE_MODULES = [
  { id: 'projects_manager', label: 'Gestion de Projets',          group: 'Projet & Estimation' },
  { id: 'estima',           label: 'ESTIMA VRD',                  group: 'Projet & Estimation' },
  { id: 'rao_analysis',     label: 'RAO & Analyse',               group: 'Projet & Estimation' },
  { id: 'devis_moe',        label: 'Devis MOE',                   group: 'Outils & Administration' },
  { id: 'expense_notes',    label: 'Notes de Frais',              group: 'Outils & Administration' },
  { id: 'crc',              label: 'Compte Rendu Chantier',       group: 'Outils & Administration' },
  { id: 'doc_admin',        label: 'Documents Administratifs',    group: 'Outils & Administration' },
  { id: 'site_visits',      label: 'Visites de Site',             group: 'Outils & Administration' },
  { id: 'branding',         label: 'Identité & Charte Graphique', group: 'Paramètres & Compte' },
  { id: 'rgpd',             label: 'Mon Compte & Données',        group: 'Paramètres & Compte' },
];

export const ASSIGNABLE_MODULE_IDS = ASSIGNABLE_MODULES.map(m => m.id);
