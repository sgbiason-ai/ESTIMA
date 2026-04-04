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
  if (!hasHtml(normalized)) return [{ text: normalized, bold: false, underline: false, highlight: false }];

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

    const newStyles = { ...styles };
    if (tag === 'b' || tag === 'strong') newStyles.bold = true;
    if (tag === 'u') newStyles.underline = true;
    if (tag === 'mark' || (tag === 'span' && node.style.backgroundColor)) newStyles.highlight = true;

    for (const child of node.childNodes) {
      walk(child, newStyles);
    }
  };

  walk(div, { bold: false, underline: false, highlight: false });
  return segments;
};

// ── Rendu React securise (pour CrrPreview) ───────────────────────────────────

const ALLOWED_TAGS = ['b', 'strong', 'u', 'mark', 'span', 'br', 'div'];

const sanitizeHtml = (html) => {
  if (!html) return '';
  const normalized = normalizeObsText(html);
  // Strip tout sauf les tags autorises
  return normalized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
    return '';
  });
};

export const renderFormattedText = (text) => {
  if (!text) return null;
  const safe = sanitizeHtml(text);
  if (!hasHtml(safe)) return text;
  return <span dangerouslySetInnerHTML={{ __html: safe }} />;
};

// ── Texte brut sans balises (pour calcul dimensions PDF) ─────────────────────

export const stripHtml = (html) => {
  if (!html) return '';
  const normalized = normalizeObsText(html);
  const text = normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
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
  return normalized.replace(/<mark>/g, '<span style="background:#fde68a;padding:0 2px">').replace(/<\/mark>/g, '</span>');
};
