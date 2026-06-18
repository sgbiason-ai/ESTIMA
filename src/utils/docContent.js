// src/utils/docContent.js
// Moteur partagé de rendu du contenu des documents (CCTP / RC / CCAP).
// Centralise : sections conditionnelles, substitution de variables,
// retrait des notes éditeur (mode final) et génération automatique de la
// liste des dérogations au CCAG (article 12 du CCAP).

// Marqueur des notes internes destinées au rédacteur (jamais livrées).
const EDITOR_NOTE_MARKER = 'Note éditeur';
const EDITOR_NOTE_FLAG = '⚑'; // ⚑

// ── Sections conditionnelles : {{#var}} … {{/var}} ──────────────────────────
// Si la variable est vide / absente → tout le bloc disparaît (y compris le
// texte autour de la variable). Sinon le contenu interne est conservé (les
// {{var}} qu'il contient seront substitués ensuite).
export const applyConditionalSections = (html, variables = {}) => {
  if (!html) return '';
  const re = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let prev;
  let out = String(html);
  // Boucle pour gérer d'éventuelles sections imbriquées.
  do {
    prev = out;
    out = out.replace(re, (_m, key, inner) => {
      const v = variables[key];
      const truthy = v !== undefined && v !== null && String(v).trim() !== '';
      return truthy ? inner : '';
    });
  } while (out !== prev);
  return out;
};

// ── Substitution simple {{var}} (vide → chaîne vide) ────────────────────────
export const substituteVariables = (html, variables = {}) => {
  if (!html) return '';
  let out = String(html);
  Object.keys(variables).forEach((key) => {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    out = out.replace(re, String(variables[key] ?? ''));
  });
  return out;
};

// ── Retrait des notes éditeur (mode final / export) ─────────────────────────
// Supprime tout bloc de niveau paragraphe dont le texte porte le marqueur
// « ⚑ Note éditeur » (ou simplement « Note éditeur »).
export const stripEditorNotes = (html) => {
  if (!html || (!html.includes(EDITOR_NOTE_MARKER) && !html.includes(EDITOR_NOTE_FLAG))) {
    return html || '';
  }
  const div = document.createElement('div');
  div.innerHTML = String(html);
  const isNote = (el) => {
    const t = (el.textContent || '').trim();
    return t.startsWith(EDITOR_NOTE_FLAG) || t.toLowerCase().includes(EDITOR_NOTE_MARKER.toLowerCase());
  };
  // On cible les blocs de plus haut niveau pour retirer la note entière.
  div.querySelectorAll('p, div, blockquote, li').forEach((el) => {
    // Ne pas retirer un conteneur englobant tout le document.
    if (el.parentElement === div || /^(P|DIV|BLOCKQUOTE|LI)$/.test(el.nodeName)) {
      if (isNote(el)) el.remove();
    }
  });
  return div.innerHTML;
};

// ── Pipeline de rendu pour l'EXPORT (Word / PDF) ────────────────────────────
// Ordre : retrait notes (final) → sections conditionnelles → substitution.
export const renderForExport = (html, variables = {}) => {
  if (!html) return '';
  let out = stripEditorNotes(html);
  out = applyConditionalSections(out, variables);
  out = substituteVariables(out, variables);
  return out;
};

// ── Pipeline de rendu pour l'APERÇU écran (notes conservées) ────────────────
// Ne retire PAS les notes (mode brouillon). Gère le conditionnel et renvoie le
// HTML après application des sections ; la substitution finale (avec
// surbrillance des variables manquantes) reste à la charge de l'aperçu.
export const renderForPreview = (html, variables = {}) =>
  applyConditionalSections(html || '', variables);

// ── Génération automatique de la liste des dérogations (article 12) ─────────
// Scanne le contenu des chapitres SÉLECTIONNÉS à la recherche des phrases
// « Par dérogation à l'article X du CCAG … » et construit une liste <ul>
// (article + extrait), dédoublonnée par article, dans l'ordre du document.
const stripTags = (html) => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = String(html)
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ');
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
};

// Extrait les n° d'article qui suivent immédiatement « par dérogation … ».
const DEROG_RE = /par\s+d[ée]rogation\s+(?:à\s+l['’]article|aux?\s+articles?)\s+([\d]+(?:\.\d+)*(?:\s+et\s+(?:à\s+l['’]article\s+)?[\d]+(?:\.\d+)*)*)/gi;

export const computeDerogations = (treeData, selectedIds) => {
  const sentences = [];
  const collect = (nodes) => {
    nodes.forEach((node) => {
      if (selectedIds && !selectedIds.has(node.id)) return;
      const text = stripTags(node.content || '');
      if (text) {
        // Découpe en phrases (le point suivi d'une espace ; « 19.2.3 » n'a pas
        // d'espace après ses points, il n'est donc pas coupé).
        text.split(/(?<=\.)\s+/).forEach((s) => {
          if (/par\s+d[ée]rogation/i.test(s)) sentences.push(s.trim());
        });
      }
      if (node.children) collect(node.children);
    });
  };
  collect(treeData || []);

  const seen = new Set();
  const items = [];
  sentences.forEach((sentence) => {
    DEROG_RE.lastIndex = 0;
    const m = DEROG_RE.exec(sentence);
    if (!m) return;
    const articles = (m[1].match(/\d+(?:\.\d+)*/g) || []);
    articles.forEach((art) => {
      if (seen.has(art)) return;
      seen.add(art);
      items.push({ article: art, sentence });
    });
  });

  if (items.length === 0) {
    return '<p><em>Le présent CCAP ne déroge à aucune disposition du CCAG Travaux.</em></p>';
  }

  const li = items
    .map(
      (it) =>
        `<li><strong>Article ${it.article} du CCAG Travaux</strong> — ${it.sentence}</li>`
    )
    .join('');
  return `<ul>${li}</ul>`;
};
