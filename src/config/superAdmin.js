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
  { id: 'estim_rapide',     label: 'Estimation Rapide',           group: 'Projet & Estimation' },
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

// Liste canonique des modules du Hub MOBILE pouvant être individuellement
// attribués à un utilisateur. Stockés dans le champ `mobileModules` du doc
// /users/{uid}. Par défaut (champ absent) → tous autorisés (sous réserve du
// desktopGate : les permissions desktop prévalent).
//
// `desktopGate` mappe vers les IDs desktop équivalents :
//  - Si vide ([]) → module toujours autorisé (ex : Serveur Papyrus)
//  - Sinon → mobile visible uniquement si AU MOINS un desktopGate est autorisé
//           dans `modules` côté user. En plus, le toggle `mobileModules` peut
//           encore restreindre (mais jamais étendre au-delà du desktop).
export const ASSIGNABLE_MOBILE_MODULES = [
  { id: 'projects',    label: 'Projets & RAO',    group: 'Mobile', desktopGate: ['projects_manager', 'estima', 'rao_analysis'] },
  { id: 'pdf_reader',  label: 'Serveur Papyrus',  group: 'Mobile', desktopGate: [] },
  { id: 'site_visits', label: 'Visites de Site',  group: 'Mobile', desktopGate: ['site_visits'] },
  { id: 'crc',         label: 'Comptes Rendus',   group: 'Mobile', desktopGate: ['crc'] },
  { id: 'moe',         label: 'Devis MOE',        group: 'Mobile', desktopGate: ['devis_moe'] },
  { id: 'doc_admin',   label: 'Documents Admin',  group: 'Mobile', desktopGate: ['doc_admin'] },
];

export const ASSIGNABLE_MOBILE_MODULE_IDS = ASSIGNABLE_MOBILE_MODULES.map(m => m.id);

/**
 * Vrai si le user satisfait le desktopGate d'un module mobile.
 *  - mod.desktopGate vide → toujours vrai
 *  - userModules null → fallback legacy : tout autorisé côté desktop → vrai
 *  - Sinon : au moins un ID du gate doit être dans userModules.
 */
export const satisfiesDesktopGate = (mod, userModules) => {
  if (!mod.desktopGate || mod.desktopGate.length === 0) return true;
  if (!Array.isArray(userModules)) return true;
  return mod.desktopGate.some(id => userModules.includes(id));
};
