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

// ─── HTML → BLOCS STYLÉS (rendu fidèle PDF + Excel) ───────────────────────────
//
// Retourne [{ type: 'p' | 'li', runs: [{ text, bold, underline }] }].
// Tokeniseur sans DOM (résultat identique en navigateur et en environnement de
// test). Gère <b>/<strong>, <u>, <p>/<div>/<hN>, <br>, <ul>/<ol>/<li> ; les
// images et autres balises sont ignorées en tant que conteneurs neutres.

const decodeEntities = (s) => (s || '')
  .replace(/&nbsp;/gi, String.fromCharCode(160))
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#0*39;/g, "'")
  .replace(/&apos;/gi, "'")
  .replace(/&amp;/gi, '&');

export function htmlToRichBlocks(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return [];

  const blocks = [];
  let current = null;
  let boldDepth = 0;
  let underlineDepth = 0;
  const open = (type) => { current = { type, runs: [] }; blocks.push(current); };
  const addText = (raw) => {
    const text = collapseWs(decodeEntities(raw));
    if (!text) return;
    if (!current) open('p');
    current.runs.push({ text, bold: boldDepth > 0, underline: underlineDepth > 0 });
  };

  const tokenRe = /<\/?([a-zA-Z0-9]+)[^>]*>|[^<]+/g;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    const token = m[0];
    if (token[0] !== '<') { addText(token); continue; }

    const isClose = token[1] === '/';
    const tag = (m[1] || '').toLowerCase();
    const isBlock = tag === 'p' || tag === 'div' || tag === 'li' || /^h[1-6]$/.test(tag);

    if (isClose) {
      if (tag === 'b' || tag === 'strong') boldDepth = Math.max(0, boldDepth - 1);
      else if (tag === 'u') underlineDepth = Math.max(0, underlineDepth - 1);
      else if (isBlock) current = null;
    } else {
      if (tag === 'b' || tag === 'strong') boldDepth += 1;
      else if (tag === 'u') underlineDepth += 1;
      else if (tag === 'br') open(current && current.type === 'li' ? 'li' : 'p');
      else if (tag === 'li') open('li');
      else if (tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag)) open('p');
      // img, ul, ol, span, em, i, font… : conteneurs neutres
    }
  }

  // Fusionne les runs adjacents de même style, supprime les blocs vides.
  return blocks
    .map((b) => {
      const merged = [];
      b.runs.forEach((r) => {
        const last = merged[merged.length - 1];
        if (last && last.bold === r.bold && last.underline === r.underline) last.text += r.text;
        else merged.push({ ...r });
      });
      return { type: b.type, runs: merged.filter((r) => r.text) };
    })
    .filter((b) => b.runs.some((r) => r.text.trim()));
}
