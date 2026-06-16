// src/utils/richText.js
//
// Conversion du HTML riche produit par RichTextEditor (gras, souligné, listes à
// puces, sauts de ligne) vers du texte simple exploitable par les exports
// (puces « • », retours à la ligne) — page PSE du PDF, bloc Excel, récapitulatif.
//
// Pur côté logique ; utilise le DOM si disponible (navigateur + jsdom des tests),
// avec un repli regex sans DOM (SSR / environnement sans document).

const collapseWs = (s) => (s || '').split(String.fromCharCode(160)).join(' ').replace(/[\t\x20]+/g, ' ');

// ─── HTML → TEXTE SIMPLE ──────────────────────────────────────────────────────

export function htmlToPlainText(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return '';

  const pre = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n').replace(/<p[^>]*>/gi, '')
    .replace(/<\/div\s*>/gi, '\n').replace(/<div[^>]*>/gi, '')
    .replace(/<\/li\s*>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '')
    .replace(/<\/h[1-6]\s*>/gi, '\n').replace(/<h[1-6][^>]*>/gi, '');

  let txt;
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = pre;
    txt = tmp.textContent || tmp.innerText || '';
  } else {
    txt = pre
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  return collapseWs(txt.replace(/\r/g, ''))
    .replace(/[\x20\t]*\n[\x20\t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
