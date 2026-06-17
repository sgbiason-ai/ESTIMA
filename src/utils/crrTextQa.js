// src/utils/crrTextQa.js
//
// Contrôles qualité de saisie pour le module CRC (signalement écran, jamais
// bloquant) :
//   - detectTextIssues(plainText) : fautes connues (dictionnaire maison) +
//     heuristiques structurelles (espace manquant, ponctuation répétée…)
//   - nameEmailMismatch(name, email) : cohérence nom / adresse e-mail
//
// Module PUR (aucune dépendance DOM) → testable directement. Le texte passé à
// detectTextIssues doit déjà être en clair (cf. stripHtml côté appelant).

// ── Dictionnaire de fautes récurrentes (extensible) ─────────────────────────
// Clé = forme fautive normalisée (minuscules, sans accents) → correction.
export const KNOWN_TYPOS = {
  diffuera: 'diffusera',
  diffueront: 'diffuseront',
  diffuer: 'diffuser',
  tramsettra: 'transmettra',
  tramsmettra: 'transmettra',
  tramsmettre: 'transmettre',
  tramsmet: 'transmet',
  raport: 'rapport',
  reunnion: 'réunion',
  echeancier: 'échéancier',
};

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Analyse un texte (déjà en clair) et retourne la liste des anomalies de saisie.
 * @param {string} text
 * @returns {Array<{type:'spelling'|'spacing'|'punct', message:string, word?:string, suggestion?:string}>}
 */
export const detectTextIssues = (text) => {
  const issues = [];
  if (!text || !text.trim()) return issues;

  // 1. Fautes connues (mot entier, insensible casse/accents, dédupliqué)
  const seen = new Set();
  const wordRe = /[A-Za-zÀ-ÿ]+/g;
  let m;
  while ((m = wordRe.exec(text)) !== null) {
    const key = norm(m[0]);
    if (KNOWN_TYPOS[key] && !seen.has(key)) {
      seen.add(key);
      issues.push({
        type: 'spelling',
        word: m[0],
        suggestion: KNOWN_TYPOS[key],
        message: `« ${m[0]} » → « ${KNOWN_TYPOS[key]} »`,
      });
    }
  }

  // 2. Heuristiques structurelles (que le correcteur natif ne voit pas)
  // Espace manquant : mots collés (minuscule→MAJUSCULE, ou MAJUSCULES collées
  // à une minuscule comme « MARCOULYindique »).
  // Classes distinguant vraiment MAJUSCULE accentuée (À-Ö, Ø-Þ) de minuscule
  // accentuée (à-ö, ø-ÿ) — la plage naïve « À-Ÿ » inclut à tort les minuscules.
  const glued = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]*(?:[a-zà-öø-ÿ][A-ZÀ-ÖØ-Þ]|[A-ZÀ-ÖØ-Þ]{2,}[a-zà-öø-ÿ])[A-Za-zÀ-ÖØ-öø-ÿ]*/);
  if (glued) {
    issues.push({ type: 'spacing', message: `espace manquant : « ${glued[0]} »` });
  }
  // Espace manquant après une virgule / un point suivi d'une lettre
  if (/[,.][A-Za-zÀ-ÿ]/.test(text)) {
    issues.push({ type: 'spacing', message: 'espace manquant après une virgule ou un point' });
  }
  // Ponctuation répétée (« !! », « ?? », « !? »…) → ton à neutraliser
  if (/[!?]{2,}/.test(text)) {
    issues.push({ type: 'punct', message: 'ponctuation répétée (ex. « !! ») — préférer une formulation factuelle' });
  }
  // Espaces multiples consécutifs
  if (/ {2,}/.test(text)) {
    issues.push({ type: 'spacing', message: 'espaces multiples' });
  }

  return issues;
};

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
