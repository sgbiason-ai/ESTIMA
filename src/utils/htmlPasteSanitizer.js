// src/utils/htmlPasteSanitizer.js
//
// Nettoie le HTML collé depuis Word, Google Docs ou une page web pour l'éditeur
// de chapitres (CCTP / RC). Objectif : garder la STRUCTURE utile (titres, listes,
// tableaux, gras / italique / souligné) tout en supprimant polices, tailles,
// couleurs et autres styles inline qui rendent le contenu « difficilement éditable ».
//
// L'émphase exprimée en style inline (ex. Google Docs : <span style="font-weight:700">)
// est reconvertie en balises sémantiques <strong>/<em>/<u> pour ne pas la perdre.

// Balises supprimées entièrement (avec leur contenu).
const DROP_TAGS = new Set([
  'style', 'script', 'meta', 'link', 'title', 'head', 'html', 'body', 'base',
  'col', 'colgroup', 'img', 'figure', 'figcaption', 'iframe', 'object', 'embed',
  'svg', 'input', 'button', 'form', 'select', 'textarea', 'o:p', 'xml',
]);

// Balises de bloc / structure conservées telles quelles.
const BLOCK_KEEP = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'blockquote', 'br', 'hr',
]);

const BLOCK_LEVEL = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'tr', 'td', 'th', 'blockquote', 'hr', 'div',
]);

// Balises d'emphase → balise sémantique normalisée.
const EMPH = {
  b: 'strong', strong: 'strong', i: 'em', em: 'em', u: 'u', ins: 'u',
  s: 's', strike: 's', del: 's', sub: 'sub', sup: 'sup', mark: 'mark',
};

const EMPH_ORDER = ['strong', 'em', 'u', 's', 'sub', 'sup', 'mark'];

// Emphase issue du style inline — peut AJOUTER ou ANNULER (true/false).
// Indispensable pour Google Docs : son wrapper <b style="font-weight:normal">
// n'est PAS du gras.
const emphasisFromStyle = (el) => {
  const s = (el.getAttribute && el.getAttribute('style') || '').toLowerCase();
  const r = {};
  if (/font-weight\s*:\s*(bold(er)?|[6-9]00)/.test(s)) r.strong = true;
  else if (/font-weight\s*:\s*(normal|lighter|[1-5]00)/.test(s)) r.strong = false;
  if (/font-style\s*:\s*italic/.test(s)) r.em = true;
  else if (/font-style\s*:\s*normal/.test(s)) r.em = false;
  if (/text-decoration\s*:\s*none/.test(s)) r.u = false;
  else if (/text-decoration[^;]*underline/.test(s)) r.u = true;
  return r;
};

// Imbrique une liste de nœuds dans une pile de balises (ex. ['strong','em']).
const wrapWith = (doc, tags, childNodes) => {
  const uniq = [...new Set(tags)];
  if (uniq.length === 0) return childNodes;
  let frag = doc.createDocumentFragment();
  childNodes.forEach((n) => frag.appendChild(n));
  for (let i = uniq.length - 1; i >= 0; i--) {
    const w = doc.createElement(uniq[i]);
    w.appendChild(frag);
    frag = doc.createDocumentFragment();
    frag.appendChild(w);
  }
  return Array.from(frag.childNodes);
};

const hasBlockChild = (nodes) =>
  nodes.some((n) => n.nodeType === 1 && BLOCK_LEVEL.has(n.nodeName.toLowerCase()));

// Traite récursivement un nœud → tableau de nœuds DOM nettoyés.
const processNode = (node, doc) => {
  if (node.nodeType === 3) {
    const t = node.textContent.replace(/\s+/g, ' ');
    return t ? [doc.createTextNode(t)] : [];
  }
  if (node.nodeType !== 1) return []; // commentaires, etc.

  const tag = node.nodeName.toLowerCase();
  if (tag.includes(':') || DROP_TAGS.has(tag)) return [];

  const children = Array.from(node.childNodes).flatMap((c) => processNode(c, doc));

  if (tag === 'br' || tag === 'hr') return [doc.createElement(tag)];

  if (BLOCK_KEEP.has(tag)) {
    const el = doc.createElement(tag);
    if (tag === 'td' || tag === 'th') {
      ['colspan', 'rowspan'].forEach((a) => {
        const v = node.getAttribute && node.getAttribute(a);
        if (v && /^\d+$/.test(v) && Number(v) > 1) el.setAttribute(a, v);
      });
    }
    children.forEach((c) => el.appendChild(c));
    return [el];
  }

  if (tag === 'div') {
    // bloc-conteneur : on déballe s'il contient déjà des blocs, sinon on en fait un <p>
    if (children.length === 0) return [];
    if (hasBlockChild(children)) return children;
    const p = doc.createElement('p');
    children.forEach((c) => p.appendChild(c));
    return [p];
  }

  // Inline (span, font, a, b, i, u, …) → on déballe en conservant l'emphase.
  const eff = {};
  if (EMPH[tag]) eff[EMPH[tag]] = true;        // emphase de la balise
  Object.assign(eff, emphasisFromStyle(node)); // le style inline peut annuler/ajouter
  const tags = EMPH_ORDER.filter((t) => eff[t]);
  // Pas d'emphase autour d'un bloc (éviterait <strong><p>…) :
  if (tags.length && !hasBlockChild(children)) return wrapWith(doc, tags, children);
  return children;
};

// Nettoyage final : supprime les éléments inline/blocs vides.
const pruneEmpty = (root) => {
  const INLINE_EMPTY = new Set(['strong', 'em', 'u', 's', 'sub', 'sup', 'mark', 'span']);
  const BLOCK_EMPTY = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);
  let changed = true;
  while (changed) {
    changed = false;
    root.querySelectorAll('*').forEach((el) => {
      const tag = el.nodeName.toLowerCase();
      const empty = el.textContent.trim() === '' && !el.querySelector('br, img, td, th');
      if (empty && (INLINE_EMPTY.has(tag) || BLOCK_EMPTY.has(tag))) {
        el.remove();
        changed = true;
      }
    });
  }
};

/**
 * sanitizePastedHtml(html) → HTML nettoyé (chaîne).
 * @param {string} html  HTML brut du presse-papiers (text/html)
 * @returns {string}
 */
export const sanitizePastedHtml = (html) => {
  if (!html || !html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = doc.createElement('div');
  Array.from(doc.body.childNodes)
    .flatMap((n) => processNode(n, doc))
    .forEach((n) => out.appendChild(n));
  pruneEmpty(out);
  return out.innerHTML.trim();
};

/** Échappe du texte brut en HTML (fallback quand le presse-papiers n'a pas de HTML). */
export const escapeTextToHtml = (text) => {
  if (!text) return '';
  const esc = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .split(/\n{2,}/)
    .map((para) => '<p>' + para.replace(/\n/g, '<br>') + '</p>')
    .join('');
};
