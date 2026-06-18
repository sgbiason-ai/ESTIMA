// src/utils/parsePdfCctp.js
//
// Importe un CCTP (ou RC) au format PDF et reconstruit l'arbre de chapitres
// attendu par Estima : { id, title, level, content (HTML), children[] }.
//
// Stratégie :
// 1. Si le PDF a un sommaire embarqué (signets/outline) → structure directe
//    (le niveau d'imbrication des signets = le niveau du chapitre). C'est le
//    cas idéal et le plus fiable.
// 2. Sinon → détection des titres par numérotation ("Chapitre 1", "1.2.3 …").
// 3. Le contenu de chaque section = le texte situé entre un titre et le suivant
//    (reconstruction des lignes par position Y, regroupées en paragraphes via
//    les écarts verticaux, puces simples détectées).
//
// Limites connues : sous-puces à glyphe non standard (rendues en texte),
// capitales espacées des sous-titres (« T ROTTOIR »), tableaux aplatis en texte.
// Le contenu reste intégralement présent et éditable dans l'éditeur riche.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_SIZE = 30 * 1024 * 1024;   // 30 Mo
const MAX_CONTENT_LENGTH = 50000;         // 50 Ko par section (aligné sur l'import Word)
const MAX_LEVEL = 5;                       // Estima gère jusqu'au niveau 5

let __idCounter = 0;
const generateId = () => {
  __idCounter = (__idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `pdf_${Date.now()}_${__idCounter}`;
};

// Retire la numérotation de tête ("Chapitre 1 - ", "1.2.3. ") : l'UI recalcule
// son propre numéro par position, comme pour l'import Word.
const cleanTitle = (t) =>
  String(t || '')
    .replace(/^(chapitre\s+\d+\s*[-–—:.]*\s*|\d+(\.\d+)*\.?\s*)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Puce = glyphe de liste OU tiret suivi d'un espace (conservateur pour éviter
// les faux positifs sur les phrases commençant par un chiffre/une lettre).
const BULLET_RE = /^\s*[•▪◦‣·▶➤-]\s+/;
const stripBullet = (s) => s.replace(BULLET_RE, '').trim();

const normLoose = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ─── Résolution d'une destination de signet → { pageIndex, y } ───────────────
async function resolveDest(pdf, dest) {
  try {
    let d = dest;
    if (typeof d === 'string') d = await pdf.getDestination(d);
    if (!Array.isArray(d) || !d[0]) return null;
    const pageIndex = await pdf.getPageIndex(d[0]);
    let y = null;
    const name = d[1] && d[1].name;
    if (name === 'XYZ') y = d[3];
    else if (name === 'FitH' || name === 'FitBH') y = d[2];
    return { pageIndex, y: typeof y === 'number' ? y : null };
  } catch {
    return null;
  }
}

// ─── Extraction des lignes (page, y, texte) + fréquence pour le bruit ────────
async function extractPages(pdf) {
  const pages = [];
  const lineFreq = new Map();
  const tocPages = new Set(); // pages "SOMMAIRE" (beaucoup de lignes finissant par un n° de page)
  const topFreq = new Map();  // textes récurrents en haut de page (en-têtes courants)
  const botFreq = new Map();  // textes récurrents en bas de page (pieds de page)

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewportWidth = page.getViewport({ scale: 1 }).width || 595;
    const content = await page.getTextContent();

    const byY = new Map();
    for (const item of content.items) {
      if (!item.str || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      let key = null;
      for (const ey of byY.keys()) {
        if (Math.abs(ey - y) <= 2) { key = ey; break; }
      }
      if (key === null) key = y;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key).push({ x: item.transform[4], str: item.str });
    }

    const lines = [...byY.keys()]
      .sort((a, b) => b - a) // haut → bas (Y décroissant)
      .map((y) => {
        const items = byY.get(y).sort((a, b) => a.x - b.x);
        const text = items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
        // Entrée de sommaire = se termine par un n° de page (1-3 chiffres) aligné à droite.
        const last = items[items.length - 1];
        const isTocEntry =
          items.length >= 2 &&
          text.length > 6 &&
          /^\d{1,3}$/.test(last.str.trim()) &&
          last.x > viewportWidth * 0.72;
        return { y, text, isTocEntry };
      })
      .filter((l) => l.text);

    for (const l of lines) lineFreq.set(l.text, (lineFreq.get(l.text) || 0) + 1);
    if (lines.filter((l) => l.isTocEntry).length >= 4) tocPages.add(p - 1);
    // En-tête/pied courants : 2 premières et 2 dernières lignes, clé débarrassée du
    // n° de page final (« … Travaux 9 » / « … Travaux 10 » → même en-tête récurrent).
    [lines[0], lines[1]].forEach((l) => l && tallyRunning(topFreq, l.text));
    [lines[lines.length - 1], lines[lines.length - 2]].forEach((l) => l && tallyRunning(botFreq, l.text));
    pages[p - 1] = lines;
  }

  // Une ligne récurrente en haut ou en bas de ≥3 pages = en-tête/pied courant → bruit.
  const minRepeat = Math.min(3, pdf.numPages);
  const runningLines = new Set();
  for (const [t, n] of topFreq) if (n >= minRepeat) runningLines.add(t);
  for (const [t, n] of botFreq) if (n >= minRepeat) runningLines.add(t);

  return { pages, lineFreq, tocPages, runningLines };
}

// ─── Filtre du bruit (en-têtes/pieds de page répétés, pagination) ────────────
function makeNoiseFilter(lineFreq, numPages, runningLines = new Set()) {
  const threshold = Math.max(3, Math.floor(numPages * 0.25));
  return (text) => {
    if (runningLines.has(text) || runningLines.has(stripTrailingPageNum(text))) return true; // en-tête/pied courant
    if (/^\d{1,3}\s*\/\s*\d{1,3}$/.test(text)) return true;           // "12/129"
    if (/^\d{1,4}$/.test(text)) return true;                           // numéro de page seul
    if (/^\d{1,4}\s+sur\s+\d{1,4}$/i.test(text)) return true;          // "3 sur 44" (pied de page)
    if (/Page\s+\d+\s+sur\s+\d+/i.test(text)) return true;             // "… Page X sur Y"
    if (/^Consultation\s+n[°o]\s*:/i.test(text)) return true;          // bandeau de consultation
    if ((lineFreq.get(text) || 0) >= threshold && text.length < 80) return true;
    return false;
  };
}

// Ligne de sommaire = points de suite + (éventuel) numéro de page : "TITRE …… 27".
// On les écarte pour ne pas dupliquer la structure (les vrais titres sont dans le corps).
const isTocLine = (text) => /\.{4,}\s*\d{0,4}\s*$/.test(text);

// Retire un éventuel n° de page final ("… Travaux 9" → "… Travaux") pour reconnaître
// un en-tête courant dont seul le numéro de page change d'une page à l'autre.
const stripTrailingPageNum = (s) => s.replace(/\s+\d{1,3}$/, '').trim();
const tallyRunning = (map, text) => {
  const k = stripTrailingPageNum(text);
  if (k.length >= 8) map.set(k, (map.get(k) || 0) + 1);
};

// ─── Lignes [{p,y,text}] → HTML (paragraphes par écart vertical + puces) ─────
function linesToHtml(lines) {
  if (!lines || !lines.length) return '';

  // Écart médian entre lignes consécutives d'une même page = hauteur de ligne.
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].p === lines[i - 1].p) gaps.push(lines[i - 1].y - lines[i].y);
  }
  gaps.sort((a, b) => a - b);
  const medGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;
  const paraBreak = medGap * 1.6;

  // Regroupe en blocs : saut de page, écart vertical large ou début de puce.
  const blocks = [];
  let cur = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const samePage = lines[i].p === lines[i - 1].p;
    const gap = samePage ? lines[i - 1].y - lines[i].y : Infinity;
    const startsBullet = BULLET_RE.test(lines[i].text);
    if (!samePage || gap > paraBreak || startsBullet) {
      blocks.push(cur);
      cur = [lines[i]];
    } else {
      cur.push(lines[i]);
    }
  }
  blocks.push(cur);

  let html = '';
  let listOpen = false;
  for (const b of blocks) {
    const text = b.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (BULLET_RE.test(b[0].text)) {
      if (!listOpen) { html += '<ul>'; listOpen = true; }
      html += `<li>${escapeHtml(stripBullet(text))}</li>`;
    } else {
      if (listOpen) { html += '</ul>'; listOpen = false; }
      html += `<p>${escapeHtml(text)}</p>`;
    }
    if (html.length >= MAX_CONTENT_LENGTH) break;
  }
  if (listOpen) html += '</ul>';
  return html.slice(0, MAX_CONTENT_LENGTH);
}

// ─── Attribution du contenu à chaque section selon les bornes (page, y) ──────
function assignContent(flat, pages, numPages, isNoise) {
  const afterStart = (p, y, sP, sY) => p > sP || (p === sP && (sY == null || y <= sY - 1));
  const beforeEnd = (p, y, eP, eY) => eP == null || p < eP || (p === eP && (eY == null || y > eY - 1));

  for (let i = 0; i < flat.length; i++) {
    const cur = flat[i];
    if (cur.pageIndex == null) { cur.node.content = ''; continue; }

    const next = flat.slice(i + 1).find((n) => n.pageIndex != null);
    const eP = next ? next.pageIndex : null;
    const eY = next ? next.y : null;
    const sP = cur.pageIndex;
    const sY = cur.y;

    const collected = [];
    const lastPage = eP == null ? numPages - 1 : eP;
    for (let p = sP; p <= lastPage; p++) {
      for (const l of pages[p] || []) {
        if (!afterStart(p, l.y, sP, sY)) continue;
        if (!beforeEnd(p, l.y, eP, eY)) continue;
        if (isNoise(l.text)) continue;
        collected.push({ p, y: l.y, text: l.text });
      }
    }

    // Retire la (les) ligne(s) de titre répétée(s) en tête de section.
    const title = normLoose(cur.rawTitle);
    while (
      collected.length &&
      title &&
      (normLoose(collected[0].text).includes(title) || title.includes(normLoose(collected[0].text)))
    ) {
      collected.shift();
    }

    cur.node.content = linesToHtml(collected);
  }
}

// ─── Construction depuis le sommaire embarqué (cas idéal) ────────────────────
async function buildFromOutline(pdf, outline, pages, numPages, isNoise) {
  const flat = [];

  const makeNodes = (items, level) => {
    const arr = [];
    for (const it of items || []) {
      const node = {
        id: generateId(),
        title: cleanTitle(it.title) || 'Section',
        level: Math.min(level, MAX_LEVEL),
        content: '',
        children: [],
      };
      // Pré-ordre : le parent est poussé avant ses enfants (= ordre de lecture).
      flat.push({ node, rawTitle: it.title || '', dest: it.dest, pageIndex: null, y: null });
      if (it.items && it.items.length) node.children = makeNodes(it.items, level + 1);
      arr.push(node);
    }
    return arr;
  };

  const tree = makeNodes(outline, 1);

  for (const e of flat) {
    const r = await resolveDest(pdf, e.dest);
    if (r) { e.pageIndex = r.pageIndex; e.y = r.y; }
  }

  assignContent(flat, pages, numPages, isNoise);
  return tree;
}

// ─── Fallback : détection des titres par numérotation (pas de sommaire) ──────
//
// Gère les conventions rencontrées sur les marchés publics :
//  - numéro seul sur sa ligne, titre sur la ligne suivante  ("1." ⏎ "TITRE")
//  - numéro + titre sur la même ligne                         ("1.2 TITRE", "10.1. TITRE")
//  - "Chapitre N" / "Titre N"
// Les pages SOMMAIRE entières (tocPages), les lignes à points de suite et le bruit
// sont écartés pour ne pas dupliquer la structure.
function buildFromHeadings(pages, isNoise, tocPages = new Set()) {
  const numSegments = (s) => Math.min(s.split('.').filter(Boolean).length, MAX_LEVEL);

  const CHAP_RE = /^(chapitre|titre)\s+([0-9]+|[ivxlcdm]+)\b/i;
  const NUM_ONLY_RE = /^(\d{1,3}(?:\.\d{1,3})*)\.?$/;          // "1.", "1.1", "10.2."
  const NUM_INLINE_RE = /^(\d{1,3}(?:\.\d{1,3})*)\.?\s+(.+)$/; // "1.2 TITRE", "0. OBJET"

  // Un vrai titre CCTP commence par une majuscule (les phrases "3 (trois)…",
  // "2 faces cintrées…" sont ainsi écartées).
  const headingLike = (title) => {
    const t = title.trim();
    if (t.length < 2 || t[0] === '(') return false;
    return /^[A-ZÀ-Ÿ]/.test(t);
  };

  const root = [];
  const stack = [];        // stack[k] = { node, level }
  let buffer = [];         // lignes de contenu du nœud courant
  let pendingNum = null;   // numéro en attente de son titre (numéro sur ligne séparée)

  const flushBuffer = () => {
    const node = stack[stack.length - 1]?.node;
    if (node && buffer.length) node.content += linesToHtml(buffer);
    buffer = [];
  };

  const addHeading = (level, rawTitle) => {
    flushBuffer();
    const node = { id: generateId(), title: cleanTitle(rawTitle) || 'Section', level, content: '', children: [] };
    while (stack.length >= level) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ node, level });
  };

  for (let p = 0; p < pages.length; p++) {
    if (tocPages.has(p)) continue; // page SOMMAIRE entière → ignorée
    for (const l of pages[p] || []) {
      const text = l.text;
      if (isNoise(text) || isTocLine(text)) continue;

      if (CHAP_RE.test(text)) { addHeading(1, text); pendingNum = null; continue; }

      const mOnly = text.match(NUM_ONLY_RE);
      if (mOnly) {
        if (pendingNum) addHeading(numSegments(pendingNum), 'Section'); // n° précédent resté sans titre (rare)
        pendingNum = mOnly[1];
        continue;
      }

      if (pendingNum) {                         // cette ligne est le titre du numéro précédent
        addHeading(numSegments(pendingNum), text);
        pendingNum = null;
        continue;
      }

      const mInline = text.match(NUM_INLINE_RE);
      if (mInline && headingLike(mInline[2])) {
        addHeading(numSegments(mInline[1]), text);
        continue;
      }

      if (stack.length) buffer.push({ p, y: l.y, text });
    }
  }
  flushBuffer();
  return root;
}

/**
 * Parse un fichier PDF et retourne l'arbre CCTP { id, title, level, content, children }.
 * @param {File} file
 * @returns {Promise<Array>}
 */
export const parsePdfToTree = async (file) => {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (ext !== 'pdf') throw new Error('Format non supporté. Utilisez un fichier .pdf.');
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). Maximum : 30 Mo.`);
  }

  __idCounter = 0;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const { pages, lineFreq, tocPages, runningLines } = await extractPages(pdf);
  const isNoise = makeNoiseFilter(lineFreq, pdf.numPages, runningLines);

  let outline = null;
  try { outline = await pdf.getOutline(); } catch { outline = null; }

  const tree = outline && outline.length
    ? await buildFromOutline(pdf, outline, pages, pdf.numPages, isNoise)
    : buildFromHeadings(pages, isNoise, tocPages);

  if (!tree || tree.length === 0) {
    throw new Error("Aucune structure détectée dans le PDF (ni sommaire, ni titres numérotés).");
  }
  return tree;
};

// Indique si l'import s'appuiera sur le sommaire embarqué (utile pour l'UI).
export const pdfHasOutline = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const outline = await pdf.getOutline();
    return !!(outline && outline.length);
  } catch {
    return false;
  }
};
