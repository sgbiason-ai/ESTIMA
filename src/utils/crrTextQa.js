// src/utils/crrTextQa.js
//
// Contrôle qualité de saisie pour le module CRC (signalement écran, jamais
// bloquant) :
//   - nameEmailMismatch(name, email) : cohérence nom / adresse e-mail
//
// L'orthographe des observations est laissée au correcteur natif du navigateur
// (contentEditable spellCheck lang="fr"). Module PUR → testable directement.

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Cohérence nom / e-mail ──────────────────────────────────────────────────

// Boîtes génériques : on ne juge pas la cohérence (mail de service, pas de personne).
const GENERIC_LOCALS = new Set([
  'contact', 'info', 'infos', 'accueil', 'secretariat', 'direction', 'commande',
  'commandes', 'compta', 'comptabilite', 'sav', 'admin', 'administration',
  'agence', 'bureau', 'mairie', 'dgs', 'dst', 'urbanisme', 'marches', 'marche',
  'travaux', 'no-reply', 'noreply',
]);

/**
 * Détecte une incohérence probable entre un nom et une adresse e-mail.
 * Cohérent si la partie locale contient un mot du nom (≥3 lettres) ou correspond
 * aux initiales. Ex. FAUGIE / « augie@… » → incohérent (le « f » manque).
 * Conservateur : ne signale qu'en cas d'absence totale de recouvrement.
 * @returns {boolean} true si une incohérence est probable.
 */
export const nameEmailMismatch = (name, email) => {
  if (!name || !email) return false;
  const at = email.indexOf('@');
  if (at < 1) return false;

  const local = norm(email.slice(0, at)).replace(/[^a-z]/g, '');
  if (local.length < 3 || GENERIC_LOCALS.has(local)) return false;

  const rawTokens = norm(name).split(/[^a-z]+/).filter(Boolean);
  const tokens = rawTokens.filter((t) => t.length >= 3);
  if (tokens.length === 0) return false; // nom trop court pour juger

  // Cohérent si l'e-mail contient un mot du nom en sous-chaîne
  if (tokens.some((t) => local.includes(t))) return false;

  // Cohérent si l'e-mail correspond aux initiales (ex. « jd » pour Jean Dupont)
  const initials = rawTokens.map((t) => t[0]).join('');
  if (initials.length >= 2 && (local === initials || local.startsWith(initials))) return false;

  return true;
};
