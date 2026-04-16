// src/utils/formatObsText.jsx
// Formatage WYSIWYG pour les observations CRC.
// Le texte est stocke en HTML inline (bold, underline, highlight).
// Retro-compatibilite avec l'ancien format markdown (**gras**, __souligne__, ==fluo==).

import React from 'react';

// ── Conversion ancien markdown -> HTML (retro-compat) ────────────────────────

const markdownToHtml = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>');

const hasMarkdown = (text) => /\*\*.+?\*\*|__.+?__|==.+?==/.test(text);

/** Normalise le texte : convertit l'ancien markdown en HTML si detecte */
export const normalizeObsText = (text) => {
  if (!text) return '';
  if (hasMarkdown(text)) return markdownToHtml(text);
  return text;
};

// ── Detecter si le texte contient du HTML ────────────────────────────────────

const hasHtml = (text) => /<\/?[a-z][\s\S]*>/i.test(text);

// ── Parse HTML en segments { text, bold, underline, highlight } ──────────────
// Utilise pour le rendu PDF (jsPDF ne comprend pas le HTML)

export const parseObsHtml = (html) => {
  if (!html) return [];
  const normalized = normalizeObsText(html);
  if (!hasHtml(normalized)) return [{ text: normalized, bold: false, underline: false, highlight: false, indent: 0 }];

  const div = document.createElement('div');
  div.innerHTML = normalized;
  const segments = [];

  const walk = (node, styles) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        segments.push({ text: node.textContent, ...styles });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    // <br> = saut de ligne
    if (tag === 'br') {
      segments.push({ text: '\n', ...styles });
      return;
    }

    // <div> et <p> = saut de ligne (sauf le premier enfant du conteneur)
    if ((tag === 'div' || tag === 'p') && segments.length > 0) {
      const last = segments[segments.length - 1];
      if (last && !last.text.endsWith('\n')) {
        segments.push({ text: '\n', ...styles });
      }
    }

    // <li> = saut de ligne + puce avec retrait
    if (tag === 'li') {
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        if (last && !last.text.endsWith('\n')) {
          segments.push({ text: '\n', ...styles });
        }
      }
      segments.push({ text: '• ', ...styles, bullet: true });
    }

    const newStyles = { ...styles };
    // Contenu d'un <li> hérite indent pour retrait des lignes wrappées
    if (tag === 'li') newStyles.indent = (styles.indent || 0) + 1;
    if (tag === 'b' || tag === 'strong') newStyles.bold = true;
    if (tag === 'u') newStyles.underline = true;
    if (tag === 'mark' || (tag === 'span' && node.style.backgroundColor)) newStyles.highlight = true;

    for (const child of node.childNodes) {
      walk(child, newStyles);
    }
  };

  walk(div, { bold: false, underline: false, highlight: false, indent: 0 });
  return segments;
};

// ── Rendu React securise (pour CrrPreview) ───────────────────────────────────

const ALLOWED_TAGS = ['b', 'strong', 'u', 'mark', 'span', 'br', 'div', 'ul', 'ol', 'li'];

const sanitizeHtml = (html) => {
  if (!html) return '';
  const normalized = normalizeObsText(html);
  // Strip tout sauf les tags autorisés, ET supprimer les attributs (protection XSS)
  return normalized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.includes(tagLower)) return '';
    // Reconstruire le tag SANS attributs (supprime onmouseover, onclick, style, etc.)
    if (match.startsWith('</')) return `</${tagLower}>`;
    const selfClose = match.endsWith('/>') ? ' /' : '';
    return `<${tagLower}${selfClose}>`;
  });
};

export const renderFormattedText = (text) => {
  if (!text) return null;
  const safe = sanitizeHtml(text);
  if (!hasHtml(safe)) return text;
  // Ajouter styles inline pour les listes (Tailwind reset les list-style)
  const withListStyles = safe
    .replace(/<ul>/gi, '<ul style="list-style-type:disc;padding-left:1.2em;margin:2px 0">')
    .replace(/<ol>/gi, '<ol style="list-style-type:decimal;padding-left:1.2em;margin:2px 0">');
  return <span dangerouslySetInnerHTML={{ __html: withListStyles }} />;
};

// ── Texte brut sans balises (pour calcul dimensions PDF) ─────────────────────

export const stripHtml = (html) => {
  if (!html) return '';
  const normalized = normalizeObsText(html);
  const text = normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, '');
  // Décoder les entités HTML (&nbsp; &amp; &lt; &gt; &quot; &#xxx;)
  const el = typeof document !== 'undefined' && document.createElement('textarea');
  if (el) { el.innerHTML = text; return el.value; }
  return text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
};

// ── Conversion pour export Word (deja en HTML, juste normaliser) ─────────────

export const obsTextToHtml = (text) => {
  if (!text) return '';
  const normalized = normalizeObsText(text);
  // Convertir <mark> en span avec background pour compatibilite Word
  return normalized
    .replace(/<mark>/g, '<span style="background:#fde68a;padding:0 2px">')
    .replace(/<\/mark>/g, '</span>')
    // Listes : puce explicite, compact, pas de <p> (Word ajoute des marges aux <p>)
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, content) =>
      content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,
        '<div style="margin:0">&#x2022; $1</div>'))
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, content) => {
      let idx = 0;
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
        idx++;
        return `<div style="margin:0">${idx}. ${inner}</div>`;
      });
    });
};
