// src/utils/pdfRaoGenerator.js
// Génère le PDF du Rapport d'Analyse des Offres (RAO)
// INCLUT l'Analyse Financière (Synthèse A4 + Détails A4 paysage) avec codes couleurs par entreprise
// Style : Vert Papyrus — typographie H1 14pt / H2 12pt / body 9pt — marges 15mm

import { DEFAULT_CRITERIA, DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../hooks/useRao';
import { normalizeUnitSymbol } from './helpers';
import { formatNumberFr, cleanText, loadLogos, drawCoverPage as _drawCoverPage, fitTextToWidth } from './pdf/pdfSharedHelpers';
import { NON_REGULAR_STATUSES } from '../components/rao/RaoConstants';
import { buildTheme as _buildTheme } from './pdf/buildTheme';
import { getCurrentPhaseCode } from './phaseModel';
import { computeVatBreakdown } from './financeFormat';
import { scoreOffer, computePriceReference, getEffectiveOffers, getEffectiveVariantOffers, getEffectiveVariantNewItems, getVariantEffectiveTotal, getCompanyRabaisPct, getEffectiveConclusion, getEffectiveTechnical, getEffectiveIrregularityReason, isRegularizedAfterNego, companiesHaveNego } from './analysisCompute';
import { stampPdfCredit } from './estimaCredit';
import { htmlToPlainText, isRichTextEmpty } from './richText';

// ─── COULEUR PRIMAIRE RAO : VERT PAPYRUS ────────────────────────────────────
const VERT_PAPYRUS = [45, 138, 78];   // #2d8a4e
const VERT_CLAIR   = [232, 245, 233]; // fond léger
const VERT_FONCE   = [30, 100, 55];   // texte foncé

const RAO_OVERRIDES = {
  primary: VERT_PAPYRUS,
  accent:  VERT_PAPYRUS,
  yes: [40, 167, 69],
  no:  [220, 53, 69],
};
const RAO_DEFAULTS = {
  tableAlt: [245, 250, 247],
};

const buildTheme = (branding) => {
  const base = _buildTheme(branding, RAO_OVERRIDES, RAO_DEFAULTS);
  // Forcer la couleur primaire RAO vert papyrus (indépendant du branding)
  return { ...base, primary: VERT_PAPYRUS, accent: VERT_PAPYRUS };
};

// Couleurs entreprises
const COMPANY_COLORS = [
  { header: [30, 58, 138],  body: [239, 246, 255], text: [30, 58, 138] },
  { header: [6, 78, 59],    body: [236, 253, 245], text: [6, 78, 59] },
  { header: [88, 28, 135],  body: [250, 245, 255], text: [88, 28, 135] },
  { header: [124, 45, 18],  body: [255, 247, 237], text: [124, 45, 18] },
  { header: [131, 24, 67],  body: [255, 241, 242], text: [131, 24, 67] },
  { header: [22, 78, 99],   body: [236, 254, 255], text: [22, 78, 99] },
];
const getCompanyStyle = (index) => COMPANY_COLORS[index % COMPANY_COLORS.length];

// Éclaircit une couleur RGB d'environ 45 % vers le blanc (utilisé pour les variantes).
const lighten = (rgb, factor = 0.45) => {
  if (!Array.isArray(rgb) || rgb.length < 3) return rgb;
  return rgb.map(c => Math.min(255, Math.round(c + (255 - c) * factor)));
};

// ─── HELPERS FORMATAGE ──────────────────────────────────────────────────────
const fmt = (n) => {
  if (typeof n !== 'number') return n || '—';
  const fixed = n.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
};
const fmtScore = (n) => typeof n === 'number' ? n.toFixed(2) : '—';


const getHeatmapStyle = (value, reference) => {
  if (!value || !reference || reference === 0) return null;
  const delta = (value - reference) / reference;
  if (delta > 0.50) return { fill: [248, 113, 113], text: [255, 255, 255] };
  if (delta > 0.25) return { fill: [252, 165, 165], text: [30, 41, 59] };
  if (delta > 0.10) return { fill: [254, 202, 202], text: [30, 41, 59] };
  if (delta > 0.00) return { fill: [254, 226, 226], text: [30, 41, 59] };
  if (delta < -0.50) return { fill: [52, 211, 153], text: [255, 255, 255] };
  if (delta < -0.25) return { fill: [110, 231, 183], text: [30, 41, 59] };
  if (delta < -0.10) return { fill: [167, 243, 208], text: [30, 41, 59] };
  if (delta < 0) return { fill: [209, 250, 229], text: [30, 41, 59] };
  return null;
};

// ─── HELPERS VISUELS ────────────────────────────────────────────────────────
// Barre de score CARRÉE (pas arrondie)
// opts.label : string custom OU null/'' pour masquer le label intérieur
const drawScoreBar = (doc, x, y, w, h, score, maxScore, color, opts = {}) => {
  if (maxScore <= 0) return;
  const pct = Math.min(1, Math.max(0, score / maxScore));
  // Fond gris
  doc.setFillColor(235, 235, 240);
  doc.rect(x, y, w, h, 'F');
  // Barre colorée
  if (pct > 0.01) {
    doc.setFillColor(...color);
    doc.rect(x, y, Math.max(2, w * pct), h, 'F');
  }
  // Texte centré dans la barre (sauf si label explicitement masqué)
  const label = ('label' in opts) ? opts.label : fmtScore(score);
  if (label === null || label === '' || label === undefined) {
    doc.setTextColor(0, 0, 0);
    return;
  }
  const fs = h > 5 ? 7 : 5.5;
  doc.setFontSize(fs);
  doc.setFont('Helvetica', 'bold');
  const textY = y + h / 2 + fs * 0.13;
  const textX = pct > 0.15 ? x + (w * pct) / 2 : x + w * pct + 4;
  doc.setTextColor(pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60);
  doc.text(label, textX, textY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

// ─── CONSTANTES LAYOUT ─────────────────────────────────────────────────────
const M = 15; // marge standard 15mm

// ─── HELPER : TEXTE JUSTIFIÉ MULTI-PARAGRAPHES ─────────────────────────────
// Le texte est splité sur "\n" : chaque sous-paragraphe est justifié SÉPARÉMENT,
// ce qui évite d'étirer la dernière ligne d'un paragraphe avant un retour ligne.
// Retourne { y, lines } pour avancer le curseur de l'appelant.
const drawJustifiedText = (doc, text, x, y, maxWidth, lineH = 4.5) => {
  const paragraphs = String(text == null ? '' : text).split('\n');
  let curY = y;
  let totalLines = 0;
  paragraphs.forEach((para) => {
    if (para.trim() === '') {
      // Ligne vide : on avance d'une hauteur de ligne
      curY += lineH;
      totalLines += 1;
      return;
    }
    const lines = doc.splitTextToSize(para, maxWidth);
    if (lines.length === 1) {
      // Une seule ligne (pas de wrap) → on rend sans justify pour ne pas étirer
      doc.text(lines[0], x, curY);
    } else {
      // Plusieurs lignes → justify (jsPDF ne stretche pas la dernière ligne)
      doc.text(para, x, curY, { align: 'justify', maxWidth });
    }
    curY += lines.length * lineH;
    totalLines += lines.length;
  });
  return { y: curY, lines: totalLines };
};

// ─── RENDU HTML → PDF (Gras / Italique / Souligné + listes à puces / numérotées) ──
// Parseur minimaliste utilisé par l'étape 6 (réponses et engagements de négociation).
// Produit une liste de blocs { kind, olIndex?, runs:[{text, bold, italic, underline}] }.
// Ignore les balises non gérées (structure conservée, styles WYSIWYG hors périmètre).

// Sanitize pour la police Helvetica standard (WinAnsi/CP1252). Le texte utilisateur
// peut contenir des caractères hors jeu (flèches, symboles math, espaces spéciaux,
// zero-width…) qui, s'ils atteignent `doc.text()`, sortent en glyphes de substitution
// (« !' » ou « ” ») et cassent le kerning. Ici on les remplace par un équivalent ASCII,
// on retire les caractères invisibles/parasites, et on collapse les blancs.
const sanitizeForPdf = (s) => {
  if (!s) return '';
  return String(s)
    // Zero-width, joiners, BOM (U+200B..U+200F, U+202A..U+202E, U+2060..U+2064, U+FEFF, U+FFF9..U+FFFB)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFFF9-\uFFFB]/g, '')
    // Line/paragraph separators (U+2028, U+2029) -> newline
    .replace(/[\u2028\u2029]/g, '\n')
    // Espaces speciaux (U+2000..U+200A, U+202F, U+205F, U+3000) -> espace normal
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Fleches courantes -> equivalents ASCII
    .replace(/[\u2190\u21D0\u2906]/g, '<-')          // <- / <= / <==
    .replace(/[\u2192\u21D2\u2907\u21A6]/g, '->')   // -> / => / ==> / |->
    .replace(/[\u2194\u21D4]/g, '<->')
    .replace(/[\u2191\u21D1]/g, '^')
    .replace(/[\u2193\u21D3]/g, 'v')
    // Symboles math (hors WinAnsi)
    .replace(/\u2212/g, '-')       // MINUS SIGN
    .replace(/\u2248/g, '~')       // ALMOST EQUAL TO
    .replace(/\u2265/g, '>=')      // GREATER-THAN OR EQUAL TO
    .replace(/\u2264/g, '<=')      // LESS-THAN OR EQUAL TO
    .replace(/\u2260/g, '!=')      // NOT EQUAL TO
    .replace(/\u221A/g, 'racine')  // SQUARE ROOT
    .replace(/\u221E/g, 'inf')     // INFINITY
    // Guillemet bas simple (U+201A) -> virgule
    .replace(/\u201A/g, ',')
    // Puces exotiques (U+25AA U+25AB U+25CB U+25CF U+25C6 U+25C7) -> tiret
    .replace(/[\u25AA\u25AB\u25CB\u25CF\u25C6\u25C7]/g, '-');
};

const parseHtmlToBlocks = (html) => {
  const blocks = [];
  if (!html || typeof DOMParser === 'undefined') return blocks;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  if (!root) return blocks;

  const decode = (s) => (s || '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

  // Assemble les runs d'un noeud inline (récursif). style = { bold, italic, underline }.
  const collectRuns = (node, style, runs) => {
    if (node.nodeType === 3) {
      // TEXT — sanitize WinAnsi ici pour que la mesure de largeur (utilisée par
      // le wrap) reçoive du texte propre (sinon les glyphes non-mappables font
      // planter le kerning et fragmentent le rendu en « e t 1 0 0 5 »).
      const t = sanitizeForPdf(decode(node.nodeValue));
      if (t) runs.push({ text: t, ...style });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...style };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    if (tag === 'br') { runs.push({ text: '\n', ...style }); return; }
    for (const child of node.childNodes) collectRuns(child, next, runs);
  };

  // Découpe une séquence de runs sur \n → plusieurs blocs paragraphes.
  const flushParagraph = (runs) => {
    // Sépare sur \n : les newlines créent des blocs séparés
    let cur = [];
    runs.forEach(r => {
      const parts = r.text.split('\n');
      parts.forEach((p, i) => {
        if (p) cur.push({ ...r, text: p });
        if (i < parts.length - 1) {
          if (cur.length) blocks.push({ kind: 'para', runs: cur });
          else blocks.push({ kind: 'para', runs: [{ text: '', bold: false, italic: false, underline: false }] });
          cur = [];
        }
      });
    });
    if (cur.length) blocks.push({ kind: 'para', runs: cur });
  };

  const traverse = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) {
        if (child.nodeType === 3 && decode(child.nodeValue).trim()) {
          const runs = [];
          collectRuns(child, { bold: false, italic: false, underline: false }, runs);
          if (runs.length) flushParagraph(runs);
        }
        continue;
      }
      const tag = child.tagName.toLowerCase();
      if (tag === 'p' || tag === 'div') {
        const runs = [];
        collectRuns(child, { bold: false, italic: false, underline: false }, runs);
        if (runs.length) flushParagraph(runs);
        else blocks.push({ kind: 'para', runs: [{ text: '', bold: false, italic: false, underline: false }] });
      } else if (tag === 'ul' || tag === 'ol') {
        let idx = 1;
        for (const li of child.querySelectorAll(':scope > li')) {
          const runs = [];
          collectRuns(li, { bold: false, italic: false, underline: false }, runs);
          if (runs.length) blocks.push({ kind: tag === 'ol' ? 'li-ol' : 'li-ul', olIndex: idx, runs });
          idx++;
        }
      } else if (tag === 'br') {
        blocks.push({ kind: 'para', runs: [{ text: '', bold: false, italic: false, underline: false }] });
      } else {
        // Inline non enveloppé dans un bloc → un paragraphe
        const runs = [];
        collectRuns(child, { bold: false, italic: false, underline: false }, runs);
        if (runs.length) flushParagraph(runs);
      }
    }
  };
  traverse(root);
  return blocks;
};

// Résout la variante de police jsPDF pour un style de run donné.
const _fontStyle = (bold, italic) => (bold && italic) ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';

// Wrap une liste de runs sur une largeur maxWidth → tableau de lignes,
// chaque ligne = tableau de segments { text, bold, italic, underline, width }.
const _wrapRunsToLines = (doc, runs, maxWidth, fontName, fontSize) => {
  const measure = (text, bold, italic) => {
    doc.setFont(fontName, _fontStyle(bold, italic));
    doc.setFontSize(fontSize);
    return doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
  };
  const lines = [];
  let curLine = [];
  let curWidth = 0;
  runs.forEach(run => {
    // Coupe le run en tokens : mots + espaces (préserve les espaces)
    const tokens = run.text.split(/(\s+)/).filter(t => t.length > 0);
    tokens.forEach(tok => {
      const tokW = measure(tok, run.bold, run.italic);
      // Un token vide de type espace en début de ligne : ignoré
      if (/^\s+$/.test(tok) && curLine.length === 0) return;
      if (curWidth + tokW > maxWidth && curLine.length > 0) {
        // Push la ligne courante et démarre une nouvelle
        lines.push(curLine);
        curLine = [];
        curWidth = 0;
        if (/^\s+$/.test(tok)) return; // pas d'espace en tête de nouvelle ligne
      }
      // Ajoute (ou fusionne au dernier segment si même style)
      const last = curLine[curLine.length - 1];
      const same = last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline;
      if (same) {
        last.text += tok;
        last.width += tokW;
      } else {
        curLine.push({ text: tok, bold: run.bold, italic: run.italic, underline: run.underline, width: tokW });
      }
      curWidth += tokW;
    });
  });
  if (curLine.length) lines.push(curLine);
  return lines;
};

/**
 * Dessine une séquence de blocs HTML (parseHtmlToBlocks) dans le PDF.
 * Gère : gras / italique / souligné (via jsPDF setFont + doc.line pour l'underline)
 * et listes à puces / numérotées (préfixe + indentation).
 *
 * @returns {number} nouvel y après le dernier bloc
 */
const drawHtmlBlocks = (doc, blocks, x, y, maxWidth, opts = {}) => {
  const fontName = opts.fontName || 'Helvetica';
  const fontSize = opts.fontSize || 9;
  const lineH = opts.lineH || 4.5;
  // dryRun : mesure seule (wrap réel via les métriques de police), aucun dessin.
  // Sert aux paginations qui distribuent les blocs par hauteur AVANT de dessiner
  // (section technique) — l'estimation « chars / 90 » est trop grossière pour ça.
  const dryRun = opts.dryRun === true;
  // blockGap = 0 par defaut : le browser contentEditable enveloppe CHAQUE ligne
  // dans son propre <div> (typique apres Enter). Avec un gap non nul, les
  // reponses saisies au champ « Reponses & Engagements » apparaissaient trop
  // aerees dans le PDF (l'utilisateur percoit un espacement « trop grand » alors
  // qu'il n'a tape que des retours-ligne simples). lineH seul suffit à separer
  // visuellement les paragraphes de facon compacte, comme dans Word single spacing.
  const blockGap = opts.blockGap != null ? opts.blockGap : 0;
  const listIndent = opts.listIndent || 5; // mm
  const pageBreak = opts.pageBreak; // fn(y, height) → { y (post-break), broke: bool } ou null

  let curY = y;
  const textColor = opts.textColor || [0, 0, 0];
  // La couleur du texte doit etre re-appliquee apres CHAQUE saut de page :
  // addPage → drawHeader/drawFooter changent la couleur (blanc pour le titre,
  // gris pour le pied) ; sans reset le corps du bloc suivant sortirait "delave".
  const applyTextColor = () => doc.setTextColor(...textColor);
  applyTextColor();

  // Compaction : les <div><br></div> / <p></p> / <br><br> generes par le browser
  // ou lors du typing produisent des paragraphes vides successifs. On les fusionne
  // (max 1 blanc consecutif) pour eviter les « trous » verticaux involontaires.
  const isEmpty = (b) => b.kind === 'para' && b.runs.length === 1 && !b.runs[0].text;
  const compactedBlocks = [];
  let prevEmpty = false;
  blocks.forEach(b => {
    const e = isEmpty(b);
    if (e && prevEmpty) return; // skip : doublon
    compactedBlocks.push(b);
    prevEmpty = e;
  });
  // Enleve un blanc en tete/queue (le user n'attend pas de vide avant/apres son texte).
  while (compactedBlocks.length && isEmpty(compactedBlocks[0])) compactedBlocks.shift();
  while (compactedBlocks.length && isEmpty(compactedBlocks[compactedBlocks.length - 1])) compactedBlocks.pop();

  compactedBlocks.forEach((blk) => {
    // Préfixe éventuel (liste)
    const isList = blk.kind === 'li-ul' || blk.kind === 'li-ol';
    const prefix = blk.kind === 'li-ul' ? '•  ' : blk.kind === 'li-ol' ? `${blk.olIndex || 1}.  ` : '';
    const indent = isList ? listIndent : 0;

    // Wrap les runs sur la largeur disponible (moins le prefixe pour la 1re ligne, indent pour la suite)
    doc.setFont(fontName, 'normal'); doc.setFontSize(fontSize);
    const contentMaxW = maxWidth - indent;
    // Ligne vide (paragraphe blanc) : juste un espace vertical
    if (blk.runs.length === 1 && !blk.runs[0].text) {
      curY += lineH;
      return;
    }
    const lines = _wrapRunsToLines(doc, blk.runs, contentMaxW, fontName, fontSize);
    if (lines.length === 0) return;

    const totalH = lines.length * lineH + blockGap;
    if (pageBreak) {
      const res = pageBreak(curY, totalH);
      if (res && res.broke) {
        curY = res.y;
        // addPage a change la couleur (drawHeader / drawFooter) : reset avant de continuer.
        applyTextColor();
      }
    }

    lines.forEach((line, li) => {
      let curX = x + indent;
      // Préfixe de liste sur la 1re ligne
      if (isList && li === 0 && prefix && !dryRun) {
        doc.setFont(fontName, 'normal'); doc.setFontSize(fontSize);
        doc.text(prefix, x, curY);
      }
      if (!dryRun) line.forEach(seg => {
        doc.setFont(fontName, _fontStyle(seg.bold, seg.italic));
        doc.setFontSize(fontSize);
        doc.text(seg.text, curX, curY);
        if (seg.underline && seg.text.trim()) {
          const uY = curY + 0.6;
          doc.setLineWidth(0.25);
          doc.line(curX, uY, curX + seg.width, uY);
        }
        curX += seg.width;
      });
      curY += lineH;
    });
    curY += blockGap;
  });

  return curY;
};

// Champ riche OU texte plain hérité → blocs prêts pour drawHtmlBlocks.
// Tous les champs texte du RAO passent par là depuis leur bascule WYSIWYG :
// les anciennes saisies plain (retours à la ligne) restent rendues à l'identique.
const richFieldToBlocks = (raw) => {
  const s = String(raw || '');
  if (!s.trim()) return [];
  const html = /<[a-z][^>]*>/i.test(s)
    ? s
    : s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return parseHtmlToBlocks(html);
};

// Hauteur exacte (mm) qu'occupera drawHtmlBlocks — wrap réel, aucun dessin.
const measureHtmlBlocks = (doc, blocks, maxWidth, opts = {}) =>
  drawHtmlBlocks(doc, blocks, 0, 0, maxWidth, { ...opts, dryRun: true, pageBreak: null });

// Vacuité d'un champ riche (résidus contentEditable : <div><br></div>, &nbsp;…)
const isRichEmpty = (v) => !String(v || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();

// ─── PAGE DE GARDE RAO — utilise drawCoverPage partagé + bloc consultation ──
const drawCoverPageRao = (doc, project, consultation, logoMoe, logoClient, today, branding, THEME, logoCoTraitants = [], negotiationPhase = 'none') => {
  // Formater la date de remise
  let remiseStr = '—';
  if (consultation?.dateRemise) {
    try {
      const parts = consultation.dateRemise.split('-');
      if (parts.length === 3) remiseStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      else remiseStr = consultation.dateRemise;
      if (consultation.timeRemise) remiseStr += ` à ${consultation.timeRemise}`;
    } catch { /* ignore */ }
  }

  _drawCoverPage(doc, {
    docType: "RAPPORT D'ANALYSE DES OFFRES",
    title: consultation?.objet || project?.name,
    subtitle1: (consultation?.subtitle1 || project?.subtitle1 || '').trim(),
    subtitle2: (consultation?.subtitle2 || project?.subtitle2 || '').trim(),
    phaseLabel: (consultation?.phase || getCurrentPhaseCode(project)).toUpperCase(),
    negotiationPhase,
    clientName: consultation?.client || project?.client || 'Non renseigné',
    clientStreet: project?.clientAddress ? project.clientAddress.trim() : '',
    clientCityZip: [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: consultation?.lieu || project?.location || 'Non renseignée',
    codeAffaire: consultation?.code || project?.code || 'Non défini',
    showSignatures: project?.showSignatures === true,
    signatories: project?.signatories || ['', '', '', ''],
    branding,
    today,
    extraBlocks: [
      {
        height: 30,
        rows: [
          { label: 'PROCÉDURE', value: consultation?.procedure || '—', col: 1 },
          { label: 'DATE LIMITE REMISE', value: remiseStr, col: 2 },
        ],
      },
      // Bloc LOT affiché uniquement si un lot est renseigné
      ...((consultation?.lot || '').trim() ? [{
        height: 30,
        rows: [
          { label: 'LOT', value: consultation.lot.trim(), col: 1 },
        ],
      }] : []),
    ],
  }, THEME, { logoMoe, logoClient, logoCoTraitants });
};

// ── EN-TÊTE : bande verte pleine + titre blanc ────────────────────────────
// Hauteur dynamique : 22mm si titre tient sur 1 ligne, 30mm si wrap sur 2 lignes.
// Renvoie la hauteur effective pour que l'appelant ajuste le `y` de départ.
const drawHeader = (doc, title, consultation, project, THEME, logoMoe) => {
  const W = doc.internal.pageSize.getWidth();

  // Calcul du logo (pour réserver la place à droite)
  let logoW = 0;
  if (logoMoe) {
    const maxW = 30; const maxH = 12;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    logoW = w;
  }

  // Largeur dispo pour le titre = W - marge gauche - logo - marge droite - padding sécurité
  const TITLE_FS = 12;
  const titleMaxW = W - M - logoW - M - 6;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(TITLE_FS);
  const titleText = (title || '').toUpperCase();
  const titleLines = doc.splitTextToSize(titleText, titleMaxW);
  // Hauteur du bandeau = base 22mm + supplément si plus d'une ligne (~5.5mm/ligne en plus)
  const extraLines = Math.max(0, titleLines.length - 1);
  const headerHeight = 22 + extraLines * 5.5;

  // Bande latérale verte
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, doc.internal.pageSize.getHeight(), 'F');

  // Bandeau header : fond vert plein avec texte blanc — hauteur adaptée
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, W, headerHeight, 'F');

  // Logo : positionné verticalement centré dans le bandeau
  if (logoMoe) {
    const maxW = 30; const maxH = 12;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const logoY = (headerHeight - h) / 2;
    doc.addImage(logoMoe, 'JPEG', W - M - w, logoY, w, h);
  }

  // Titre — 1 ou 2 lignes selon longueur
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(TITLE_FS);
  const titleStartY = 10;
  titleLines.forEach((ln, idx) => {
    doc.text(ln, M, titleStartY + idx * 5.5);
  });

  // Sous-titre (objet/projet) — placé sous le titre
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text((consultation?.objet || project?.name || '').toUpperCase(), M, headerHeight - 5);

  return headerHeight;
};

// ── PIED DE PAGE : Réf + Date + Page (idempotent, 1 seul rendu par page) ──
const drawFooter = (doc, _ignoredPageNum, consultation, project, THEME) => {
  // Idempotence : on ne dessine le pied qu'une seule fois par page physique.
  // Les multiples appels (addPage + didDrawPage d'autoTable + pages internes
  // d'autoTable) sont ainsi déduplicés.
  const currentPage = doc.internal.getNumberOfPages();
  if (!doc._raoFootedPages) doc._raoFootedPages = new Set();
  if (doc._raoFootedPages.has(currentPage)) return;
  doc._raoFootedPages.add(currentPage);

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...THEME.primary);
  doc.setLineWidth(0.4);
  doc.line(M, H - 15, W - M, H - 15);
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.ref || project?.code || '', M, H - 9);
  const today = new Date().toLocaleDateString('fr-FR');
  doc.text(`Édité le ${today}`, W / 2, H - 9, { align: 'center' });
  // Numéro de page LIVE (et non figé), pour que les pages internes d'autoTable
  // affichent leur vrai numéro et pas celui de la page d'origine du tableau.
  doc.text(`Page ${currentPage}`, W - M, H - 9, { align: 'right' });
};

// ── TITRE DE SECTION : fond vert plein + texte blanc ──────────────────────
const sectionTitle = (doc, text, y, colorArr) => {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...(colorArr || VERT_PAPYRUS));
  doc.rect(M, y - 4, W - 2 * M, 10, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(text, M + 4, y + 3);
  doc.setTextColor(0, 0, 0);
  return y + 14;
};

// ── GÉNÉRATION PRINCIPALE DU RAO ───────────────────────────────────────────
export const generateRaoPDF = async (optionsParams) => {
  const {
    project, consultation, criteria, rao, analysisCompanies, ranking, rankingInitial, rankingNego, branding,
    analysisStats, analysisStatsInitial, chaptersData, bpuRefMap, tranches, analysisMode, scoringConfig,
    // Nouvelles props refonte complète
    optionChapters = [], includedOptions = {},
    // Quantités « à valoir » (client, majorées) par tranche — source unique computeQtyMaps.
    // Indispensable pour le détail par tranche : sinon repli sur la quantité d'étude brute.
    clientQtyMaps = {},
    // Inclure ou non les annexes A (formules de notation) et B (références CCP).
    // Défaut true : annexes présentes comme avant pour les appelants qui ne passent pas l'option.
    includeAnnexes = true,
    // Phase de négociation à marquer sur le rapport : 'none' | 'before' | 'after'.
    //   - badge coloré sur la page de garde (ambre « AVANT » / vert « APRÈS »)
    //   - préfixe de la phrase de recommandation par défaut (conclusion)
    // Défaut 'none' : aucune mention (rétro-compatible, ex. appelants mobile).
    negotiationPhase = 'none',
    // Format papier des annexes de prix A/B : 'a4' (defaut, compact) ou
    // 'a3' (police plus lisible, utile quand il y a beaucoup d'entreprises/variantes).
    pricesPaperSize = 'a4',
    // Comparatif avant/après négociation : [{ name, initialTotal, negoTotal,
    // delta, deltaPct, negotiated, scoreInitial, scoreNego }] | null.
    // Rendu à l'étape 7 dès que des données négociées existent.
    negoComparison = null,
    // Phase « après négo » active dans l'analyse : le détail des prix unitaires
    // reprend alors les prix négociés (fusion initial + négocié par article).
    negoActive = false,
  } = optionsParams;

  // Taux de TVA configurable par projet (défaut 20 %), partagé par toutes les sorties RAO (audit F2).
  const projectTvaRate = Number(project?.tauxTVA ?? 20) / 100;
  const projectTvaPct = String(Number(project?.tauxTVA ?? 20)).replace('.', ',');

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const THEME = buildTheme(branding);

  const { logoMoe, logoClient, logoCoTraitants } = await loadLogos(branding, project);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const companiesData = rao.companies || {};
  const companyNames = analysisCompanies.map(c => c.name);
  const hasNegoPriceData = companiesHaveNego(analysisCompanies);
  const today = new Date().toLocaleDateString('fr-FR');
  const W = doc.internal.pageSize.getWidth();
  let pageNum = 1;

  // Tracking des sections pour le sommaire (on enregistre la page de début)
  const tocEntries = [];

  // ── EXTENDED RANKING : base + variantes retenues, scores recalculés ──
  // Calculé EN AMONT pour être utilisé à la fois dans la Synthèse Exécutive
  // et dans le Récapitulatif Final (cohérence des chiffres).
  // - Exclut les bases irrégulières du Pmin/Pmax/Pmoy
  // - Recalcule priceScore + totalScore pour TOUTES les lignes valides
  // - Réattribue les rangs (1, 2, 3...) après recalcul
  const NON_REG_RECAP = ['irreguliere', 'inacceptable', 'inappropriee'];
  const buildExtendedRanking = (sourceRanking = ranking, basis = 'initial') => {
    if (!sourceRanking || sourceRanking.length === 0) return [];
    const N = Number(scoringConfig?.maxScore || 40);
    const mode = scoringConfig?.mode || 'f1';

    const flat = [];
    sourceRanking.forEach(r => {
      flat.push({ ...r, kind: 'base' });
      const co = analysisCompanies.find(c => c.name === r.name);
      const retainedVars = (co?.variants || []).filter(v => v.retained);
      retainedVars.forEach((v, vi) => {
        const variantConcl = v.adminConclusion || null;
        const variantIrregular = variantConcl && NON_REG_RECAP.includes(variantConcl);
        flat.push({
          ...r,
          kind: 'variant',
          variantId: v.id,
          variantIndex: vi + 1,
          variantLabel: v.label || '',
          // Total net (rabais commercial global de l'entreprise déduit) — même
          // primitif que le comparatif RAO et le Récap (source unique).
          price: getVariantEffectiveTotal(co, v, basis),
          irregular: !!variantIrregular,
          irregularLabel: variantConcl,
        });
      });
    });

    // Réintégration CCP : toutes les offres concourent (régulières ET irrégulières).
    const { Pmin, Pmax, Pmoy } = computePriceReference(flat.map(r => r.price));

    // Notation prix : primitif partagé scoreOffer (src/utils/analysisCompute.js).
    // Garde Pmin > 0 conservée (sinon pas de moins-disant valide → 0).
    const scoreFor = (p) => (Pmin > 0 ? scoreOffer(p, Pmin, Pmax, Pmoy, N, mode) : 0);

    const recomputed = flat.map(r => {
      const priceScore = scoreFor(r.price);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      return { ...r, priceScore, totalScore: priceScore + techTotal };
    });

    // Toutes les offres classées ensemble ; le flag `irregular` est conservé pour
    // le marquage « sous réserve de régularisation » dans le rapport.
    return recomputed
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  };
  const extendedRanking = buildExtendedRanking(
    hasNegoPriceData ? (rankingNego || ranking) : (rankingInitial || ranking),
    hasNegoPriceData ? 'nego' : 'initial',
  );

  const addPage = (sectionTitle_, format = 'a4', orientation = 'portrait') => {
    doc.addPage(format, orientation);
    pageNum++;
    const hdrH = drawHeader(doc, sectionTitle_, consultation, project, THEME, logoMoe);
    drawFooter(doc, pageNum, consultation, project, THEME);
    // y de départ contenu = bas du header + 8mm de respiration
    return (hdrH || 22) + 8;
  };

  // ── PAGE 1 : COUVERTURE ──
  drawCoverPageRao(doc, project, consultation, logoMoe, logoClient, today, branding, THEME, logoCoTraitants, negotiationPhase);

  // ── PAGE 2 : SOMMAIRE ──
  // On insère une page placeholder pour le sommaire — on la remplira à la fin
  doc.addPage('a4', 'portrait');
  pageNum++;
  drawHeader(doc, 'Sommaire', consultation, project, THEME, logoMoe);
  drawFooter(doc, pageNum, consultation, project, THEME);
  // On garde la référence de cette page pour la remplir plus tard
  const sommairePageIndex = doc.internal.getNumberOfPages();

  // ── PAGE : OBJET + CRITÈRES ──
  // (Synthèse Exécutive supprimée — les données clés sont déjà présentes dans le
  //  Récapitulatif Général et la Recommandation finale.)
  let y = addPage('1 — Consultation', 'a4', 'portrait');
  tocEntries.push({ label: '1. Consultation', page: pageNum });
  y = sectionTitle(doc, '1.1  Objet de la consultation', y, THEME.primary);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9); // body
  doc.setTextColor(...THEME.text);
  doc.text('Objet des travaux', M, y + 2);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  const objLines = doc.splitTextToSize(consultation?.objet || project?.name || '—', W - 2 * M);
  doc.text(objLines, M, y);
  y += objLines.length * 4.5 + 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.text);
  doc.text('Lieu d\'exécution :', M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.lieu || '—', 55, y);
  y += 5;

  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...THEME.text);
  doc.text('Procédure :', M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.procedure || '—', 55, y);
  y += 10;

  // Section 2 : Remise des dossiers
  y = sectionTitle(doc, '1.2  Remise des dossiers de réponse', y, THEME.primary);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text('Date et heure limites de réception des offres :', M, y + 2);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...THEME.text);

  let remiseStr = '—';
  if (consultation?.dateRemise) {
      try {
          const parts = consultation.dateRemise.split('-');
          if(parts.length === 3) remiseStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
          else remiseStr = consultation.dateRemise;
          if (consultation.timeRemise) remiseStr += ` à ${consultation.timeRemise}`;
      } catch { /* ignore */ }
  }
  doc.text(remiseStr, W / 2, y + 10, { align: 'center' });
  y += 18;

  // Section 3 (Négociations) supprimée — les négociations sont exclues du PDF RAO.

  // Section 3 : Critères de notation — RENDU MANUEL (pas d'autoTable)
  //   pour avoir un contrôle total sur la hauteur des blocs et la justification.
  y = sectionTitle(doc, '1.3  Rappel des critères de notation', y, THEME.primary);

  // Constantes layout
  const BOTTOM_CRIT = 297 - 25;
  const COL_NUM_W = 28;        // largeur "Critère N" / "N.M"
  const COL_WEIGHT_W = 34;     // largeur "%"
  const COL_LABEL_W = W - 2 * M - COL_NUM_W - COL_WEIGHT_W;
  const PAD_X = 4;             // padding horizontal cellule
  // ⚠ Ces 5 tailles sont volontairement `let` : un facteur d'échelle (calculé plus
  //   bas) les réduit pour faire tenir tout le rappel des critères sur une seule page.
  let PAD_Y = 5;               // padding vertical cellule
  let FS_MAIN = 11;            // font critère principal
  let FS_SUB = 9;              // font sous-critère
  let FS_WEIGHT_MAIN = 12;
  let FS_WEIGHT_SUB = 10;
  const HEADER_H = 10;         // hauteur du bandeau d'en-tête du tableau

  // Header tableau (bandeau vert pleine largeur)
  const drawCritHeader = (yPos) => {
    doc.setFillColor(...THEME.primary);
    doc.rect(M, yPos, W - 2 * M, HEADER_H, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Critère',     M + COL_NUM_W / 2,                           yPos + 6, { align: 'center' });
    doc.text('Intitulé',    M + COL_NUM_W + COL_LABEL_W / 2,             yPos + 6, { align: 'center' });
    doc.text('Pondération', M + COL_NUM_W + COL_LABEL_W + COL_WEIGHT_W / 2, yPos + 6, { align: 'center' });
    return yPos + HEADER_H;
  };

  // Calcule la hauteur effective d'un bloc (label + ligne vide + description).
  // `padY` est passé explicitement pour permettre la simulation à différentes échelles.
  const computeBlockHeight = (label, description, fs, padY = PAD_Y) => {
    const lineH = fs * 0.5;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(fs);
    const labelLines = doc.splitTextToSize(label || '', COL_LABEL_W - 2 * PAD_X);
    let h = labelLines.length * lineH;
    if (!isRichEmpty(description)) {
      // Description riche (gras/listes) — mesure par le même moteur que le dessin
      h += measureHtmlBlocks(doc, richFieldToBlocks(description), COL_LABEL_W - 2 * PAD_X, { fontSize: fs, lineH });
      h += lineH; // ligne vide entre label et description
    }
    return h + 2 * padY;
  };

  // Dessine un bloc complet (1 critère ou 1 sous-critère)
  const drawCritBlock = (numLabel, label, description, weightLabel, isMain, yPos) => {
    const fs = isMain ? FS_MAIN : FS_SUB;
    const fsWeight = isMain ? FS_WEIGHT_MAIN : FS_WEIGHT_SUB;
    const bgFill = isMain ? VERT_CLAIR : null;
    const textColor = isMain ? VERT_FONCE : [60, 60, 60];
    const numColor = isMain ? VERT_FONCE : [80, 80, 80];
    const lineH = fs * 0.5;

    const blockH = computeBlockHeight(label, description, fs);

    // Fond bloc (uniquement pour les critères principaux)
    if (bgFill) {
      doc.setFillColor(...bgFill);
      doc.rect(M, yPos, W - 2 * M, blockH, 'F');
    }
    // Bordure inférieure fine pour séparer les blocs
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.3);
    doc.line(M, yPos + blockH, W - M, yPos + blockH);
    // Bordures verticales pour matérialiser les colonnes
    doc.line(M + COL_NUM_W, yPos, M + COL_NUM_W, yPos + blockH);
    doc.line(M + COL_NUM_W + COL_LABEL_W, yPos, M + COL_NUM_W + COL_LABEL_W, yPos + blockH);

    // Col 1 : Numéro (centré horizontalement et en haut verticalement)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(isMain ? fs : 9.5);
    doc.setTextColor(...numColor);
    doc.text(numLabel, M + COL_NUM_W / 2, yPos + PAD_Y + fs * 0.4, { align: 'center' });

    // Col 2 : Label (gras) + description (justifiée)
    let textY = yPos + PAD_Y + fs * 0.4;
    const textX = M + COL_NUM_W + PAD_X;
    const textW = COL_LABEL_W - 2 * PAD_X;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(fs);
    doc.setTextColor(...textColor);
    const labelLines = doc.splitTextToSize(label || '', textW);
    labelLines.forEach((ln, idx) => doc.text(ln, textX, textY + idx * lineH));
    textY += labelLines.length * lineH;
    if (!isRichEmpty(description)) {
      textY += lineH; // ligne vide
      drawHtmlBlocks(doc, richFieldToBlocks(description), textX, textY, textW, { fontSize: fs, lineH, textColor });
    }

    // Col 3 : Pondération (% en haut)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(fsWeight);
    doc.setTextColor(...numColor);
    doc.text(weightLabel, M + COL_NUM_W + COL_LABEL_W + COL_WEIGHT_W / 2, yPos + PAD_Y + fs * 0.4, { align: 'center' });

    return yPos + blockH;
  };

  // ── Facteur d'échelle « tout sur une page » ─────────────────────────────
  // On simule la hauteur totale (en-tête + tous les blocs) à différentes
  // échelles, puis on réduit police + paddings jusqu'à ce que l'ensemble
  // tienne sous BOTTOM_CRIT, sur la page courante (sous §1 / §2).
  const availH = BOTTOM_CRIT - y;                 // hauteur dispo sous le titre §3
  const BASE = { FS_MAIN, FS_SUB, FS_WEIGHT_MAIN, FS_WEIGHT_SUB, PAD_Y };
  const totalHeightAt = (s) => {
    let total = HEADER_H;
    criteria.forEach((c) => {
      const hasSubs = (c.subCriteria || []).length > 0;
      total += computeBlockHeight(c.label, !hasSubs ? c.description : '', BASE.FS_MAIN * s, BASE.PAD_Y * s);
      if (hasSubs) {
        c.subCriteria.forEach((sc) => {
          total += computeBlockHeight(sc.label, sc.description, BASE.FS_SUB * s, BASE.PAD_Y * s);
        });
      }
    });
    return total;
  };
  // Plancher de lisibilité : on ne descend pas sous 0.55 (≈ 6 pt) même si, dans
  // un cas extrême, le contenu devait alors déborder très légèrement.
  let scale = 1;
  while (scale > 0.55 && totalHeightAt(scale) > availH) scale -= 0.02;
  // Applique l'échelle retenue aux constantes de rendu (police + interlignes + padding).
  FS_MAIN *= scale; FS_SUB *= scale;
  FS_WEIGHT_MAIN *= scale; FS_WEIGHT_SUB *= scale;
  PAD_Y *= scale;

  y = drawCritHeader(y);

  // Itérer sur les critères — plus aucun saut de page : l'échelle garantit la tenue sur 1 page.
  criteria.forEach((c, i) => {
    const hasSubs = (c.subCriteria || []).length > 0;
    const weight = c.auto
      ? (scoringConfig?.maxScore || c.weight)
      : (hasSubs ? c.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0) : c.weight);

    y = drawCritBlock(`Critère ${i + 1}`, c.label, !hasSubs ? c.description : '', `${weight}%`, true, y);

    if (hasSubs) {
      c.subCriteria.forEach((sc, si) => {
        y = drawCritBlock(`${i + 1}.${si + 1}`, sc.label, sc.description, `${sc.weight || 0}%`, false, y);
      });
    }
  });
  y += 10;

  // ── PAGE : RÉGIME DES VARIANTES (CCP R2151-8) ──
  y = addPage('1 — Consultation · Variantes', 'a4', 'portrait');
  y = sectionTitle(doc, '1.4  Régime des variantes — CCP R2151-8 à R2151-11', y, THEME.primary);

  const variantsRegime = consultation?.variantsAllowed || 'forbidden';
  const variantsRegimeLabels = {
    forbidden: { label: 'INTERDITES', color: [220, 53, 69], desc: 'Aucune variante ne sera examinée.' },
    allowed:   { label: 'AUTORISÉES', color: [30, 100, 180], desc: 'Les variantes sont examinées en complément de l\'offre de base.' },
    mandatory: { label: 'OBLIGATOIRES', color: [180, 100, 30], desc: 'Le soumissionnaire doit proposer au moins une variante.' },
  };
  const regimeInfo = variantsRegimeLabels[variantsRegime] || variantsRegimeLabels.forbidden;

  // Tuile régime
  doc.setFillColor(...regimeInfo.color);
  doc.rect(M, y, 60, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(regimeInfo.label, M + 30, y + 9, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text(regimeInfo.desc, M + 65, y + 9);
  y += 22;

  // Exigences minimales (si déclarées)
  if (!isRichEmpty(consultation?.variantsRequirements) && variantsRegime !== 'forbidden') {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.text);
    doc.text('Exigences minimales fixées dans la consultation :', M, y);
    y += 6;
    // Contenu riche (gras/listes) — hauteur mesurée avant le fond gris
    const reqBlocks = richFieldToBlocks(consultation.variantsRequirements);
    const reqOpts = { fontName: 'Helvetica', fontSize: 9, lineH: 4.5, textColor: THEME.lightText };
    const reqH = measureHtmlBlocks(doc, reqBlocks, W - 2 * M - 10, reqOpts);
    doc.setFillColor(248, 250, 252);
    doc.rect(M, y - 3, W - 2 * M, reqH + 6, 'F');
    drawHtmlBlocks(doc, reqBlocks, M + 5, y + 2, W - 2 * M - 10, reqOpts);
    y += reqH + 12;
  }

  // Référence CCP
  doc.setFillColor(...VERT_CLAIR);
  doc.rect(M, y, W - 2 * M, 24, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...VERT_FONCE);
  doc.text('Article R2151-8 du Code de la Commande Publique', M + 4, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.lightText);
  const ccpText = "En procédure formalisée par un pouvoir adjudicateur, les variantes sont interdites sauf mention contraire dans l'avis de marché. En procédure adaptée, elles sont autorisées sauf mention contraire dans les documents de consultation. La variante retenue se substitue à la solution de base dans ses éléments qui en diffèrent (R2151-11).";
  drawJustifiedText(doc, ccpText, M + 4, y + 12, W - 2 * M - 8, 4);
  y += 32;

  // ── Section "Réponses reçues" supprimée — les conclusions admin et les
  //    groupements sont déjà visibles dans le PV de dépouillement et l'analyse
  //    administrative qui suivent.

  // ── PV DE DÉPOUILLEMENT (devient la section 5 après suppression de "Réponses reçues") ──
  y = addPage('2 — Dépouillement initial', 'a4', 'portrait');
  tocEntries.push({ label: '2. Dépouillement initial', page: pageNum });
  y = sectionTitle(doc, '2  Procès-verbal de dépouillement initial (CCP L2113-1)', y, THEME.primary);

  // Date d'ouverture des plis
  const dateOuverture = consultation?.dateOuverturePLis || consultation?.dateRemise || '';
  let dateOuvStr = '—';
  if (dateOuverture) {
    try {
      const parts = dateOuverture.split('-');
      if (parts.length === 3) dateOuvStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      else dateOuvStr = dateOuverture;
    } catch { /* ignore */ }
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.text);
  doc.text("Date d'ouverture des plis :", M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(dateOuvStr, 75, y);
  y += 10;

  // Tableau des entreprises avec montants AE annoncés + variantes (montant inclus)
  // Une ligne par variante en plus de la base — pas de ligne de cumul (peu utile)
  // La colonne « Variantes » n'est affichée que si au moins une entreprise en a déposé.
  const hasAnyVariant = analysisCompanies.some(c => (c.variants || []).length > 0);
  const depouillementBody = [];

  analysisCompanies.forEach((c, idx) => {
    // Ligne entreprise (offre de base) — montant HT relevé sur l'AE + TTC au taux du projet
    const aeAmountHt = c.aeAmount != null ? fmt(c.aeAmount) + ' €' : '—';
    const aeAmountTtc = c.aeAmount != null
      ? fmt(computeVatBreakdown(c.aeAmount, projectTvaRate).ttc) + ' €'
      : '—';
    const baseRow = [
      { content: String(idx + 1), styles: { halign: 'center', fontStyle: 'bold' } },
      { content: cleanText(c.name), styles: { fontStyle: 'bold' } },
      { content: aeAmountHt, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: aeAmountTtc, styles: { halign: 'right', fontStyle: 'bold' } },
    ];
    if (hasAnyVariant) baseRow.push({ content: (c.variants || []).length > 0 ? `${c.variants.length} variante${c.variants.length > 1 ? 's' : ''}` : '—', styles: { fontSize: 7, halign: 'center' } });
    depouillementBody.push(baseRow);

    // Une ligne supplémentaire par variante (montant HT + TTC explicites)
    (c.variants || []).forEach((v, vi) => {
      const vHt = v.aeAmount != null ? v.aeAmount : (v.total != null ? v.total : null);
      const vAmountHt = vHt != null ? fmt(vHt) + ' €' : '—';
      const vAmountTtc = vHt != null ? fmt(computeVatBreakdown(vHt, projectTvaRate).ttc) + ' €' : '—';
      depouillementBody.push([
        { content: '', styles: { } },
        { content: `   > V${vi + 1} ${cleanText(v.label || `Variante ${vi + 1}`)}`, styles: { fontSize: 7, textColor: [88, 28, 135], fontStyle: 'italic' } },
        { content: vAmountHt, styles: { halign: 'right', fontSize: 7, textColor: [88, 28, 135], fontStyle: 'italic' } },
        { content: vAmountTtc, styles: { halign: 'right', fontSize: 7, textColor: [88, 28, 135], fontStyle: 'italic' } },
        { content: '', styles: { } },
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [hasAnyVariant
      ? ['N°', 'Entreprise / Variante', 'Montant AE HT', 'Montant AE TTC', 'Variantes']
      : ['N°', 'Entreprise', 'Montant AE HT', 'Montant AE TTC']],
    body: depouillementBody,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 33, halign: 'right' }, 3: { cellWidth: 33, halign: 'right' }, ...(hasAnyVariant ? { 4: { cellWidth: 26, halign: 'center' } } : {}) },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 8;

  // Note de bas
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const noteAe = `Les montants HT et TTC ci-dessus sont ceux relevés sur les actes d'engagement (AE) à l'ouverture des plis. Ils engagent contractuellement les soumissionnaires (article L2113-1 CCP). Toute divergence avec le total recalculé à partir du BPU sera signalée à la section Conformité.`;
  drawJustifiedText(doc, noteAe, M, y, W - 2 * M, 4);

  // ── ANALYSE ADMINISTRATIVE — Tableau comparatif avec colonnes subdivisées pour groupements ──
  {
    y = addPage('3 — Analyse administrative initiale', 'a4', 'portrait');
    tocEntries.push({ label: '3. Analyse administrative initiale', page: pageNum });
    y = sectionTitle(doc, '3  ANALYSE ADMINISTRATIVE INITIALE — PIÈCES DE CANDIDATURE', y, THEME.primary);

    const conclLabelsA = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
    const conclColorsA = { reguliere: THEME.yes, irreguliere: [255, 140, 0], inacceptable: THEME.no, inappropriee: THEME.no };

    // Utiliser les pièces custom si définies
    const pdfAdminPieces = rao.adminPieces || DEFAULT_ADMIN_PIECES;
    const pdfOfferPieces = rao.offerPieces || DEFAULT_OFFER_PIECES;

    // Construire les colonnes avec subdivision pour groupements
    // subColumns = [{ companyName, memberKey, memberLabel, companyIndex }]
    const subColumns = [];
    companyNames.forEach((name, ci) => {
      const admin = companiesData[name]?.admin || {};
      if (admin.isGroupement && admin.groupementMembers?.length > 0) {
        admin.groupementMembers.forEach(m => {
          subColumns.push({ companyName: name, memberKey: m.id, memberLabel: m.name || 'Sans nom', role: m.role || 'Cotraitant', companyIndex: ci });
        });
      } else {
        subColumns.push({ companyName: name, memberKey: '_self', memberLabel: name, role: null, companyIndex: ci });
      }
    });

    const totalCols = 1 + subColumns.length; // Pièce + sub-columns
    // Largeur disponible = largeur page - marges. La 1ère colonne (libellé pièce) prend une portion fixe,
    // les colonnes entreprises se partagent équitablement le reste pour remplir toute la page.
    const usableWidth = W - 2 * M;
    const labelColWidth = Math.max(40, Math.min(60, usableWidth * 0.28)); // ~28% pour le libellé, mini 40mm / maxi 60mm
    const colW = Math.max(8, (usableWidth - labelColWidth) / subColumns.length);

    // Header row 1 : company names spanning their members
    const headRow1 = ['Pièce'];
    const headRow1Spans = []; // track spans for merging
    let colIdx = 1;
    companyNames.forEach((name, ci) => {
      const admin = companiesData[name]?.admin || {};
      const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
      headRow1.push({ content: name, colSpan: memberCount, styles: { fillColor: getCompanyStyle(ci).header, halign: 'center' } });
      headRow1Spans.push({ start: colIdx, span: memberCount, ci });
      colIdx += memberCount;
    });

    // Header row 2 : member names / roles (only if at least one groupement)
    const hasAnyGroupement = companyNames.some(n => {
      const a = companiesData[n]?.admin || {};
      return a.isGroupement && a.groupementMembers?.length > 0;
    });

    const headRows = [headRow1];
    if (hasAnyGroupement) {
      const headRow2 = [''];
      subColumns.forEach(sc => {
        headRow2.push(sc.role ? `${sc.role}\n${sc.memberLabel}` : sc.memberLabel);
      });
      headRows.push(headRow2);
    }

    // Body rows
    const adminBody = [];

    // Section: Pièces administratives (par membre)
    adminBody.push([{ content: 'PIÈCES ADMINISTRATIVES', colSpan: totalCols, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
    pdfAdminPieces.forEach(p => {
      adminBody.push([p.label, ...subColumns.map(sc => {
        const pieces = companiesData[sc.companyName]?.admin?.pieces || {};
        const pieceKey = sc.memberKey === '_self' ? p.id : `${sc.memberKey}_${p.id}`;
        return pieces[pieceKey] === false ? 'NON' : pieces[pieceKey] === true ? 'OUI' : '—';
      })]);
    });

    // Section: Offre de l'entreprise (une seule colonne par entreprise, span si groupement)
    adminBody.push([{ content: 'OFFRE DE L\'ENTREPRISE', colSpan: totalCols, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
    pdfOfferPieces.forEach(p => {
      const row = [p.label];
      companyNames.forEach(name => {
        const admin = companiesData[name]?.admin || {};
        const pieces = admin.pieces || {};
        const val = pieces[p.id] === false ? 'NON' : pieces[p.id] === true ? 'OUI' : '—';
        const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
        row.push(memberCount > 1 ? { content: val, colSpan: memberCount, styles: { halign: 'center' } } : val);
      });
      adminBody.push(row);
    });

    // Ligne CONCLUSION supprimee (la conclusion admin apparait deja dans le bloc
    // Recommandation finale + ailleurs dans le PDF — eviter la redondance).

    // Motif de non-régularité (si au moins une offre écartée) — rappel synthétique
    // dans la fiche administrative ; le texte complet figure au §3.1 Conformité.
    const NON_REG_ADMIN = ['irreguliere', 'inacceptable', 'inappropriee'];
    const hasIrregReason = companyNames.some(n => {
      const a = companiesData[n]?.admin || {};
      return NON_REG_ADMIN.includes(a.conclusion) && !isRichTextEmpty(a.irregularityReason);
    });
    if (hasIrregReason) {
      adminBody.push([{ content: 'MOTIF DE NON-RÉGULARITÉ (CCP R2181-1)', colSpan: totalCols, styles: { fillColor: [255, 140, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
      const reasonRow = [{ content: 'Motif retenu', styles: { fontStyle: 'bold' } }];
      companyNames.forEach(name => {
        const admin = companiesData[name]?.admin || {};
        const isNonReg = NON_REG_ADMIN.includes(admin.conclusion);
        // Cellule de tableau : texte aplati (le rendu riche est réservé au §3.1).
        const reason = isNonReg ? htmlToPlainText(admin.irregularityReason).trim() : '';
        const content = isNonReg ? (reason || '(motif non renseigné)') : '—';
        const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
        const styles = { halign: 'left', fontSize: 6, textColor: isNonReg ? [146, 64, 14] : [180, 180, 180] };
        reasonRow.push(memberCount > 1 ? { content, colSpan: memberCount, styles } : { content, styles });
      });
      adminBody.push(reasonRow);
    }

    // Observations admin (si saisies)
    const hasObs = companyNames.some(n => companiesData[n]?.admin?.obsAdmin || companiesData[n]?.admin?.obsOffre);
    if (hasObs) {
      adminBody.push([{ content: 'OBSERVATIONS', colSpan: totalCols, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
      const obsRow = [{ content: 'Observations', styles: { fontStyle: 'bold' } }];
      companyNames.forEach(name => {
        const admin = companiesData[name]?.admin || {};
        const obs = [admin.obsAdmin, admin.obsOffre].filter(Boolean).join(' / ') || '—';
        const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
        obsRow.push(memberCount > 1 ? { content: obs, colSpan: memberCount, styles: { halign: 'center', fontSize: 6 } } : { content: obs, styles: { halign: 'center', fontSize: 6 } });
      });
      adminBody.push(obsRow);
    }

    const compColStyles = {};
    subColumns.forEach((_, i) => { compColStyles[i + 1] = { cellWidth: colW, halign: 'center', fontSize: 6.5 }; });

    autoTable(doc, {
      startY: y,
      head: headRows,
      body: adminBody,
      tableWidth: usableWidth, // remplit toute la largeur utile
      styles: { font: 'Helvetica', fontSize: 6.5, cellPadding: 2 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
      columnStyles: { 0: { cellWidth: labelColWidth, fontSize: 6.5 }, ...compColStyles },
      alternateRowStyles: { fillColor: THEME.tableAlt },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          // Extraire le texte brut (gère les cellules simples ET celles avec colSpan/objet)
          const cellText = typeof data.cell.raw === 'object' && data.cell.raw !== null ? data.cell.raw.content : data.cell.raw;
          if (cellText === 'OUI') { data.cell.styles.textColor = THEME.yes; data.cell.styles.fontStyle = 'bold'; }
          else if (cellText === 'NON') { data.cell.styles.textColor = THEME.no; data.cell.styles.fontStyle = 'bold'; }
          else if (cellText === '—') { data.cell.styles.textColor = [180, 180, 180]; }
          const conclVals = Object.values(conclLabelsA);
          if (conclVals.includes(cellText)) {
            const conclKey = Object.keys(conclLabelsA).find(k => conclLabelsA[k] === cellText) || 'reguliere';
            data.cell.styles.textColor = conclColorsA[conclKey] || THEME.yes;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 6;
          }
        }
        if (data.section === 'head' && data.row.index === 0 && data.column.index > 0) {
          // Company color on first header row
          const sc = subColumns[data.column.index - 1];
          if (sc) data.cell.styles.fillColor = getCompanyStyle(sc.companyIndex).header;
        }
        if (data.section === 'head' && data.row.index === 1 && data.column.index > 0) {
          // Member sub-header: lighter shade
          const sc = subColumns[data.column.index - 1];
          if (sc) {
            const c = getCompanyStyle(sc.companyIndex).header;
            data.cell.styles.fillColor = [Math.min(255, c[0] + 40), Math.min(255, c[1] + 40), Math.min(255, c[2] + 40)];
            data.cell.styles.fontSize = 5.5;
          }
        }
      },
      margin: { left: M, right: M },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── ÉTAPE 3.1 : CONFORMITÉ ET ANOMALIES DÉTECTÉES ──
  // Pour chaque entreprise avec écart AE / écart quantité, liste détaillée
  {
    // Une entreprise apparaît en 3.1 si elle a un écart AE/quantités, OU un
    // statut non régulier (initial OU effectif), OU a été régularisée en négo
    // (pour tracer la transition avant → après, CCP R2152-2).
    // Exception : une offre explicitement jugée RÉGULIÈRE par l'analyste ne
    // porte plus aucun commentaire d'anomalie dans le rapport — l'adjudication
    // a tranché, imprimer les écarts contredirait la conclusion. La trace de
    // régularisation après négociation reste imprimée (transition R2152-2).
    const irregularCompanies = analysisCompanies.filter(c => {
      const admin = companiesData[c.name]?.admin || {};
      const effConcl = getEffectiveConclusion(admin, 'initial');
      const regularized = false;
      if (effConcl === 'reguliere' && !regularized) return false;
      return (c.amountMismatch
        || (c.quantityMismatches || []).length > 0
        || ['irreguliere', 'inacceptable', 'inappropriee'].includes(admin.conclusion)
        || ['irreguliere', 'inacceptable', 'inappropriee'].includes(effConcl));
    });

    if (irregularCompanies.length > 0) {
      y = addPage('3 — Conformité et anomalies initiales', 'a4', 'portrait');
      tocEntries.push({ label: '3.1 Conformité et anomalies initiales', page: pageNum });
      y = sectionTitle(doc, '3.1  Conformité et anomalies initiales (CCP L2152-2)', y, THEME.primary);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const introCnf = "Les offres présentant des écarts avec le DQE ou avec leur acte d'engagement, ou jugées non régulières, sont signalées ci-dessous ; le motif retenu est précisé sous l'entreprise concernée. Conformément aux articles L2152-1 et suivants du CCP, ces offres restent analysées et classées SOUS RÉSERVE : une offre non régularisée ne peut être déclarée attributaire en l'état."
        + (negotiationPhase === 'before'
          ? " La présente analyse étant établie AVANT négociation, il est rappelé sous chaque entreprise concernée la possibilité d'inviter le(s) soumissionnaire(s) à régulariser leur offre (art. R2152-2), dans le respect de l'égalité de traitement."
          : "");
      ({ y } = drawJustifiedText(doc, introCnf, M, y, W - 2 * M, 4.5));
      y += 6;

      const NON_REG_CNF = ['irreguliere', 'inacceptable', 'inappropriee'];

      const CONCL_LABELS_CNF = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };

      irregularCompanies.forEach(c => {
        const admin = companiesData[c.name]?.admin || {};
        // Statut effectif (après régularisation éventuelle) = celui du badge et du classement.
        const concl = getEffectiveConclusion(admin, 'initial') || 'reguliere';
        const conclLabel = CONCL_LABELS_CNF[concl] || concl;
        const regularized = false;

        // Pagination
        if (y > 250) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }

        // Header entreprise
        doc.setFillColor(...VERT_CLAIR);
        doc.rect(M, y, W - 2 * M, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...VERT_FONCE);
        doc.text(cleanText(c.name), M + 3, y + 5);

        // Badge statut (effectif)
        const badgeColor = concl === 'reguliere' ? THEME.yes : (concl === 'irreguliere' ? [255, 140, 0] : THEME.no);
        const badgeW = doc.getTextWidth(conclLabel) + 6;
        doc.setFillColor(...badgeColor);
        doc.roundedRect(W - M - badgeW - 3, y + 1, badgeW, 5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(conclLabel, W - M - badgeW / 2 - 3, y + 4.5, { align: 'center' });
        y += 10;

        // Transition de régularisation (CCP R2152-2) — offre non régulière avant
        // négociation, régularisée à l'issue de la négociation. Encadré vert + motif.
        if (regularized) {
          const initLabel = CONCL_LABELS_CNF[admin.conclusion] || admin.conclusion;
          const regComment = (admin.regularizationComment || '').replace(/\r\n?/g, '\n').trim();
          const headTxt = `Offre ${initLabel} avant négociation, RÉGULARISÉE à l'issue de la négociation (art. R2152-2).`;
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          const hLines = doc.splitTextToSize(headTxt, W - 2 * M - 8);
          const mLines = regComment ? doc.splitTextToSize(`Motif : ${regComment}`, W - 2 * M - 8) : [];
          const boxH = 4.5 + hLines.length * 4.2 + (mLines.length ? 2 + mLines.length * 4 : 0) + 4;
          if (y + boxH > 285 && y > 60) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }
          doc.setFillColor(236, 253, 245); // emerald-50
          doc.roundedRect(M, y, W - 2 * M, boxH, 1.5, 1.5, 'F');
          doc.setDrawColor(167, 243, 208); // emerald-200
          doc.setLineWidth(0.3);
          doc.roundedRect(M, y, W - 2 * M, boxH, 1.5, 1.5);
          doc.setTextColor(6, 78, 59); // emerald-900
          let ry = y + 5.5;
          hLines.forEach(ln => { doc.text(ln, M + 4, ry); ry += 4.2; });
          if (mLines.length) {
            ry += 2;
            doc.setFont('Helvetica', 'normal');
            doc.setTextColor(30, 50, 40);
            mLines.forEach(ln => { doc.text(ln, M + 4, ry); ry += 4; });
          }
          y += boxH + 4;
        }

        // Motif de non-régularité saisi par l'analyste (obligation de motivation
        // du rejet, CCP R2181-1). Texte riche → blocs mesurés puis dessinés.
        if (NON_REG_CNF.includes(concl)) {
          const reasonBlocks = richFieldToBlocks(getEffectiveIrregularityReason(admin, 'initial'));
          if (reasonBlocks.length) {
            const rOpts = { fontSize: 8, lineH: 4.2, textColor: [80, 40, 10] };
            const innerW = W - 2 * M - 8;
            const txtH = measureHtmlBlocks(doc, reasonBlocks, innerW, rOpts);
            const boxH = 5.5 + 4.5 + txtH + 4;
            if (y + boxH > 285 && y > 60) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }
            doc.setFillColor(255, 251, 235); // amber-50
            doc.roundedRect(M, y, W - 2 * M, boxH, 1.5, 1.5, 'F');
            doc.setDrawColor(253, 230, 138); // amber-300
            doc.setLineWidth(0.3);
            doc.roundedRect(M, y, W - 2 * M, boxH, 1.5, 1.5);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(146, 64, 14); // amber-800
            doc.text(`MOTIF — POURQUOI CETTE OFFRE EST ${conclLabel}`, M + 4, y + 5);
            drawHtmlBlocks(doc, reasonBlocks, M + 4, y + 9.5, innerW, rOpts);
            y += boxH + 4;
          }
        }

        // Recommandation de régularisation (CCP) — différenciée par statut.
        if (NON_REG_CNF.includes(concl)) {
          let recoTxt = '';
          let boxColor = [254, 243, 199]; // amber-100 (recommandation)
          let txtColor = [146, 64, 14];   // amber-800
          if (concl === 'inappropriee') {
            recoTxt = "Offre inappropriée (art. L2152-4) : elle est éliminée et NE PEUT PAS être régularisée (art. R2152-1), quelle que soit la procédure.";
            boxColor = [254, 226, 226]; txtColor = [153, 27, 27]; // rose-100 / red-800
          } else if (negotiationPhase === 'before') {
            recoTxt = `Recommandation (analyse avant négociation) : avant tout écartement, inviter ${cleanText(c.name)} — ainsi que tout autre soumissionnaire dans la même situation, par égalité de traitement — à régulariser son offre dans un délai approprié (art. R2152-2), sans modification de ses caractéristiques substantielles.`;
          } else {
            recoTxt = "Offre non régulière : sa régularisation (art. R2152-2) relève d'une décision du pouvoir adjudicateur, sans modification des caractéristiques substantielles.";
          }
          // IMPORTANT : mesurer dans la MÊME police que le rendu (gras), sinon les
          // lignes calculées en normal débordent une fois dessinées en gras.
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          const rLines = doc.splitTextToSize(recoTxt, W - 2 * M - 8);
          const rLineH = 4.4;
          const rH = 4.5 + rLines.length * rLineH + 4;
          if (y + rH > 285 && y > 60) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }
          doc.setFillColor(...boxColor);
          doc.roundedRect(M, y, W - 2 * M, rH, 1.5, 1.5, 'F');
          doc.setTextColor(...txtColor);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          let ry = y + 5.5;
          rLines.forEach(ln => { doc.text(ln, M + 4, ry); ry += rLineH; });
          y += rH + 4;
        }

        // Écart AE (si présent)
        if (c.amountMismatch) {
          const mm = c.amountMismatch;
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.text);
          doc.text("Écart Acte d'Engagement vs total recalculé", M + 3, y);
          y += 5;

          autoTable(doc, {
            startY: y,
            head: [['Annoncé AE', 'Recalculé', 'Écart', '%']],
            body: [[
              fmt(mm.expectedAe) + ' €',
              fmt(mm.computedTotal) + ' €',
              { content: (mm.delta >= 0 ? '+' : '') + fmt(mm.delta) + ' €', styles: { textColor: mm.delta > 0 ? [180, 80, 50] : [30, 130, 50], fontStyle: 'bold' } },
              { content: (mm.deltaPct >= 0 ? '+' : '') + mm.deltaPct + ' %', styles: { textColor: mm.delta > 0 ? [180, 80, 50] : [30, 130, 50] } },
            ]],
            styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2, halign: 'center' },
            headStyles: { fillColor: [254, 215, 170], textColor: [120, 60, 0], fontStyle: 'bold', halign: 'center' },
            margin: { left: M, right: M },
            didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
          });
          y = doc.lastAutoTable.finalY + 4;
        }

        // Écarts de quantités vs DQE
        const qtyMM = c.quantityMismatches || [];
        if (qtyMM.length > 0) {
          if (y > 240) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.text);
          doc.text(`Écarts de quantités vs DQE — ${qtyMM.length} article${qtyMM.length > 1 ? 's' : ''}`, M + 3, y);
          y += 5;
          autoTable(doc, {
            startY: y,
            head: [['Article', 'Unité', 'Qté DQE', 'Qté offre', 'Écart']],
            body: qtyMM.slice(0, 30).map(m => [
              cleanText(m.designation || ''),
              m.unit || '',
              { content: fmt(m.moeQty), styles: { halign: 'right' } },
              { content: fmt(m.offerQty), styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 53, 69] } },
              { content: (m.delta >= 0 ? '+' : '') + fmt(m.delta), styles: { halign: 'right', textColor: m.delta > 0 ? [180, 80, 50] : [30, 80, 180] } },
            ]),
            styles: { font: 'Helvetica', fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [254, 202, 202], textColor: [120, 30, 30], fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 25 } },
            margin: { left: M, right: M },
            didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
          });
          y = doc.lastAutoTable.finalY + 4;
          if (qtyMM.length > 30) {
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text(`(${qtyMM.length - 30} articles supplémentaires non affichés — voir l'analyse complète dans l'application)`, M + 3, y);
            y += 5;
          }
        }

        // Raison du flag automatique
        if (admin.autoFlaggedReason) {
          doc.setFontSize(7);
          doc.setTextColor(120, 60, 0);
          const reasonLabel = admin.autoFlaggedReason === 'quantity_mismatch' ? 'Flag automatique : quantités du DQE modifiées par le soumissionnaire (L2152-2)' : `Flag automatique : ${admin.autoFlaggedReason}`;
          doc.text(fitTextToWidth(doc, reasonLabel, W - 2 * M - 6), M + 3, y);
          y += 5;
        }

        y += 4;
      });
    }
  }

  // ── ANALYSE FINANCIÈRE ──
  const renderFinancialSummary = () => {
    const workflowStats = analysisStatsInitial || analysisStats;
    if (!workflowStats || analysisCompanies.length === 0) return;
    y = addPage('5 — Récapitulatif avant négociation', 'a4', 'portrait');
    tocEntries.push({ label: '5. Récapitulatif avant négociation', page: pageNum });
    y = sectionTitle(doc, `5  SYNTHÈSE FINANCIÈRE AVANT NÉGOCIATION`, y, THEME.primary);

    const maxScore = Number(scoringConfig?.maxScore || 40);
    const grandTotalBase = workflowStats.totalEstimation || 0;
    const NON_REGULAR_SYNTH = ['irreguliere', 'inacceptable', 'inappropriee'];

    // 1. Construire la liste : base + variantes retenues. Réintégration CCP : les
    //    offres non régulières sont INCLUSES (statut conservé pour marquage « sous réserve »).
    const synthRows = [];
    analysisCompanies.forEach(c => {
      const admin = companiesData[c.name]?.admin || {};
      // Statut effectif : en phase après négo, une offre régularisée redevient régulière.
      const effConcl = getEffectiveConclusion(admin, 'initial');
      const baseConcl = effConcl && NON_REGULAR_SYNTH.includes(effConcl) ? effConcl : null;
      synthRows.push({
        id: c.id, name: c.name, kind: 'base',
        total: workflowStats.companiesTotals[c.id] || 0,
        irregular: !!baseConcl, irregularLabel: baseConcl,
      });
      // Variantes retenues : ajoutées en plus
      (c.variants || []).filter(v => v.retained).forEach((v, vi) => {
        const vConcl = v.adminConclusion && NON_REGULAR_SYNTH.includes(v.adminConclusion) ? v.adminConclusion : null;
        synthRows.push({
          id: `${c.id}_${v.id}`,
          name: c.name,
          kind: 'variant',
          variantIndex: vi + 1,
          variantLabel: v.label || `Variante ${vi + 1}`,
          baseCompanyId: c.id,
          // Total net (rabais commercial global déduit en phase après négo) —
          // même primitif que le comparatif RAO et le Récap (source unique).
          total: getVariantEffectiveTotal(c, v, 'initial'),
          irregular: !!vConcl, irregularLabel: vConcl,
        });
      });
    });

    // 2. Recalcul Pmin/Pmoy/Pmax — toutes les offres incluses (irrégulières comprises).
    const { Pmin: PminS, Pmax: PmaxS, Pmoy: PmoyS } = computePriceReference(synthRows.map(r => r.total));
    const modeS = scoringConfig?.mode || 'f1';
    // Notation prix : même primitif partagé scoreOffer (source unique de la formule).
    const scoreForS = (p) => (PminS > 0 ? scoreOffer(p, PminS, PmaxS, PmoyS, maxScore, modeS) : 0);

    const summaryData = synthRows.map(r => ({
      ...r,
      score: scoreForS(r.total),
      deviation: grandTotalBase > 0 ? ((r.total - grandTotalBase) / grandTotalBase) * 100 : 0,
    }));
    summaryData.sort((a, b) => b.score - a.score);

    const STATUS_LABEL_SYNTH = { irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
    const summaryBody = summaryData.map((d, index) => {
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const ttc = computeVatBreakdown(d.total, projectTvaRate).ttc;
      const isVariant = d.kind === 'variant';
      const irr = !!d.irregular;
      // Lignes non régulières : fond rosé + mention « sous réserve » ; variantes : violet.
      const rowFill = irr ? [254, 226, 226] : (isVariant ? [243, 232, 255] : undefined);
      const statusTag = irr ? `\n${STATUS_LABEL_SYNTH[d.irregularLabel] || 'NON RÉGULIÈRE'} (sous réserve)` : '';
      // Rabais commercial (phase après négo) : le total affiché est NET — rappel sous le nom.
      const rabaisSynth = d.kind === 'base' ? (workflowStats.companiesRabais?.[d.id] || 0) : 0;
      const rabaisTag = rabaisSynth > 0 ? `\n(rabais commercial -${String(rabaisSynth).replace('.', ',')} % déduit)` : '';
      const displayName = (isVariant
        ? `  > ${d.name} - V${d.variantIndex}${d.variantLabel ? ` (${d.variantLabel})` : ''}`
        : d.name) + statusTag + rabaisTag;
      const rangSuffix = index === 0 ? 'er' : 'ème';
      const nameStyles = irr
        ? { textColor: [190, 18, 60], fontStyle: 'bold', fontSize: 8 }
        : isVariant
          ? { textColor: [88, 28, 135], fontStyle: 'italic', fontSize: 8 }
          : { textColor: cStyle.header, fontStyle: 'bold' };
      return [
        { content: `${index + 1}${rangSuffix}`, styles: { fontStyle: 'bold', halign: 'center', fillColor: rowFill } },
        { content: displayName, styles: { ...nameStyles, fillColor: rowFill } },
        { content: formatNumberFr(d.total) + ' €', styles: { fontStyle: 'bold', halign: 'right', fillColor: rowFill } },
        { content: formatNumberFr(ttc) + ' €', styles: { halign: 'right', fillColor: rowFill } },
        { content: (d.deviation > 0 ? '+' : '') + d.deviation.toFixed(2) + '%', styles: { textColor: d.deviation > 0 ? [200, 0, 0] : [0, 150, 0], halign: 'center', fillColor: rowFill } },
        { content: d.score.toFixed(2) + ` / ${maxScore}`, styles: { fontStyle: 'bold', halign: 'center', fillColor: rowFill } }
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [['Rang prix', 'Entreprise', 'Montant HT', 'Montant TTC', 'Écart / Estim.', 'Note prix']],
      body: summaryBody,
      theme: 'striped',
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 5: { cellWidth: 28 } },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 8;

    // Barres visuelles des montants
    const maxTotal = Math.max(...summaryData.map(d => d.total));
    const barW = W - 80;
    summaryData.forEach((d) => {
      if (y > 270) { y = addPage('Analyse financière — Synthèse', 'a4', 'portrait'); }
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...cStyle.header);
      const bHf = 6;
      doc.text(d.name, M, y + bHf / 2 + 1);
      // Barre sans label intérieur : le montant est affiché à droite
      drawScoreBar(doc, 55, y, barW, bHf, d.total, maxTotal, cStyle.header, { label: null });
      doc.setTextColor(...THEME.lightText);
      doc.setFontSize(6);
      doc.text(fmt(d.total) + ' €', 55 + barW + 2, y + bHf / 2 + 1);
      y += 9;
    });
    y += 6;

    const initialRecap = buildExtendedRanking(rankingInitial || ranking, 'initial');
    if (initialRecap.length > 0) {
      if (y > 215) y = addPage('5 — Classement avant négociation', 'a4', 'portrait');
      y = sectionTitle(doc, '5.1  CLASSEMENT GÉNÉRAL AVANT NÉGOCIATION', y, THEME.primary);
      const initialRecapBody = initialRecap.map((row) => {
        const techScore = Object.values(row.techScores || {}).reduce((sum, value) => sum + Number(value || 0), 0);
        const label = row.kind === 'variant'
          ? `${row.name} — ${row.variantLabel || `Variante ${row.variantIndex || ''}`}`
          : row.name;
        return [
          cleanText(label),
          { content: formatNumberFr(row.price) + ' €', styles: { halign: 'right' } },
          { content: fmtScore(row.priceScore), styles: { halign: 'center' } },
          { content: fmtScore(techScore), styles: { halign: 'center' } },
          { content: fmtScore(row.totalScore), styles: { halign: 'center', fontStyle: 'bold' } },
          { content: String(row.rank), styles: { halign: 'center', fontStyle: 'bold' } },
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [['Entreprise', 'Montant HT', 'Note prix', 'Note technique', 'Total / 100', 'Rang']],
        body: initialRecapBody,
        styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: THEME.tableAlt },
        margin: { left: M, right: M },
        didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  };

  // ── ÉTAPE 7 : DÉPOUILLEMENT APRÈS NÉGOCIATION ──
  const renderNegoDepouillement = () => {
    if (!hasNegoPriceData) return;
    y = addPage('7 — Dépouillement après négociation', 'a4', 'portrait');
    tocEntries.push({ label: '7. Dépouillement après négociation', page: pageNum });
    y = sectionTitle(doc, `7  COMPARAISON DES OFFRES AVANT / APRÈS NÉGOCIATION`, y, THEME.primary);

    if (!Array.isArray(negoComparison) || negoComparison.length === 0) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...THEME.lightText);
      doc.text('Aucun comparatif financier avant/après négociation n’est disponible.', M, y);
      return;
    }

    // Pas de paragraphe d'introduction : le tableau se suffit.
    const maxScoreNego = Number(scoringConfig?.maxScore || 40);
    const negoBody = negoComparison.map(r => {
        const origIdx = analysisCompanies.findIndex(c => c.name === r.name);
        const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
        const down = r.delta < -0.005;
        const up = r.delta > 0.005;
        const deltaColor = down ? [0, 150, 0] : up ? [200, 0, 0] : [120, 120, 120];
        return [
          { content: cleanText(r.name) + (r.negotiated ? '' : '\n(offre initiale reprise)'), styles: { textColor: cStyle.header, fontStyle: 'bold' } },
          { content: formatNumberFr(r.initialTotal) + ' €', styles: { halign: 'right' } },
          { content: (r.rabaisPct || 0) > 0 ? `-${String(r.rabaisPct).replace('.', ',')} %` : '—', styles: { halign: 'center', textColor: (r.rabaisPct || 0) > 0 ? [0, 150, 0] : [150, 150, 150], fontStyle: 'bold' } },
          { content: formatNumberFr(r.negoTotal) + ' €', styles: { halign: 'right', fontStyle: 'bold' } },
          { content: (r.delta > 0 ? '+' : '') + formatNumberFr(r.delta) + ' €', styles: { halign: 'right', textColor: deltaColor, fontStyle: 'bold' } },
          { content: (r.deltaPct > 0 ? '+' : '') + r.deltaPct.toFixed(2) + ' %', styles: { halign: 'center', textColor: deltaColor } },
          { content: r.scoreInitial.toFixed(2), styles: { halign: 'center', textColor: [120, 120, 120] } },
          { content: r.scoreNego.toFixed(2) + ` / ${maxScoreNego}`, styles: { halign: 'center', fontStyle: 'bold' } },
        ];
    });

    autoTable(doc, {
        startY: y + 2,
        head: [['Entreprise', 'Montant initial HT', 'Rabais', 'Après négo HT (net)', 'Écart (€)', 'Écart (%)', 'Note init.', 'Note prix finale']],
        body: negoBody,
        theme: 'striped',
        headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          1: { cellWidth: 27 }, 2: { cellWidth: 15 }, 3: { cellWidth: 28 },
          4: { cellWidth: 24 }, 5: { cellWidth: 15 }, 6: { cellWidth: 15 }, 7: { cellWidth: 21 },
        },
        didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  // ── ÉTAPE 6 : RÉPONSES & ENGAGEMENTS DES SOUMISSIONNAIRES ──
    // Rendue uniquement si au moins une entreprise a consigné des réponses
    // (champ nego.responses saisi dans l'onglet Négociation).
    // Contenu WYSIWYG : gras / italique / souligné + listes à puces/numérotées
    // (parsés HTML via parseHtmlToBlocks / drawHtmlBlocks). Compat : les anciennes
    // saisies texte plain (avec \n) sont converties transparente à l'affichage.
  const renderNegoResponses = () => {
      if (!hasNegoPriceData) return;
      const isHtmlContent = (v) => typeof v === 'string' && /<[a-z][^>]*>/i.test(v);
      const negoRespRows = analysisCompanies
        .map(c => {
          const raw = companiesData[c.name]?.negotiation?.responses || '';
          // Test de non-vidité : on retire balises + &nbsp; pour ne pas garder un <p></p> vide.
          const plainProbe = String(raw).replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
          return { name: c.name, raw: String(raw), hasContent: plainProbe.length > 0 };
        })
        .filter(r => r.hasContent);

      y = addPage('6 — Négociation', 'a4', 'portrait');
      tocEntries.push({ label: '6. Négociation — Réponses et engagements', page: pageNum });
      y = sectionTitle(doc, `6  NÉGOCIATION — RÉPONSES ET ENGAGEMENTS`, y, THEME.primary);

      if (negoRespRows.length === 0) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...THEME.lightText);
        doc.text('Aucune réponse ou engagement complémentaire n’a été consigné dans le module RAO.', M, y);
        return;
      }

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const introResp = doc.splitTextToSize(
          "Les réponses et engagements ci-dessous ont été consignés à l'issue de la négociation, à partir des retours écrits des soumissionnaires (courrier de réponse, échanges formalisés). Ils actent les engagements pris par chaque entreprise dans le cadre de la présente consultation.",
          W - 2 * M
        );
        doc.text(introResp, M, y);
        y += introResp.length * 4 + 6;

        negoRespRows.forEach(r => {
          // Contenu WYSIWYG : parse une fois pour connaître la hauteur avant le bandeau,
          // et pour paginer proprement si nécessaire.
          const htmlSrc = isHtmlContent(r.raw)
            ? r.raw
            // Legacy texte plain → conversion minimale (retours à la ligne préservés)
            : String(r.raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
          const blocks = parseHtmlToBlocks(htmlSrc);

          const nameH = 10;
          // Estimation grossière de la hauteur (lignes de bloc à 4.5 mm)
          const estH = blocks.reduce((acc, b) => {
            if (b.runs.length === 1 && !b.runs[0].text) return acc + 4.5;
            const chars = b.runs.reduce((s, r) => s + r.text.length, 0);
            const lineChars = 90; // approx à 9pt sur W-2M-6
            return acc + Math.max(1, Math.ceil(chars / lineChars)) * 4.5 + 1.5;
          }, 0);
          if (y + nameH + Math.min(estH, 60) > 285 && y > 60) {
            y = addPage('Réponses & engagements (suite)', 'a4', 'portrait');
          }

          // Bandeau nom d'entreprise (fond vert clair, texte vert foncé)
          doc.setFillColor(...VERT_CLAIR);
          doc.rect(M, y, W - 2 * M, 7, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...VERT_FONCE);
          doc.text(cleanText(r.name), M + 3, y + 5);
          y += 10;

          // Corps : rendu HTML (styles inline + listes)
          y = drawHtmlBlocks(doc, blocks, M + 3, y, W - 2 * M - 6, {
            fontName: 'Helvetica', fontSize: 9, lineH: 4.5, blockGap: 1.5,
            textColor: THEME.text,
            // Pagination automatique bloc par bloc si dépassement
            pageBreak: (curY, blockH) => {
              if (curY + blockH > 285 && curY > 60) {
                const newY = addPage('Réponses & engagements (suite)', 'a4', 'portrait');
                return { y: newY, broke: true };
              }
              return { y: curY, broke: false };
            },
          });
          y += 6;
        });
  };

  // ── ANNEXES A/B : DÉTAIL DES PRIX UNITAIRES PAR PHASE ──
  const renderPriceAnnex = (basis, annexCode) => {
    const isNegoBasis = basis === 'nego';
    const phaseLabel = isNegoBasis ? 'APRÈS NÉGOCIATION' : 'AVANT NÉGOCIATION';
    if (chaptersData && chaptersData.length > 0) {

      // Helper : construit chaptersData pour une tranche donnée.
      // Les quantités affichées doivent être les « à valoir » (clientQtyMaps[trancheId])
      // — identiques à l'écran et au global — et NON les quantités d'étude brutes.
      // Repli sur l'étude (node.quantities[trancheId] / node.qty) seulement si la map manque.
      const buildTrancheChapters = (trancheId) => {
        const tMap = (trancheId ? clientQtyMaps?.[trancheId] : clientQtyMaps?.global) || {};
        return (project?.chapters || []).map(chapter => {
          const items = [];
          const extract = (nodes) => {
            nodes.forEach(node => {
              if (node.type === 'item') {
                const avaloir = tMap[node.id];
                const rawQty = (avaloir !== undefined)
                  ? avaloir
                  : (trancheId ? node.quantities?.[trancheId] : node.qty);
                const activeQty = Number(rawQty) || 0;
                items.push({ ...node, activeQty });
              } else if (node.children) extract(node.children);
            });
          };
          extract(chapter.children || []);
          return { id: chapter.id, title: chapter.title, isOption: chapter.isOption, items };
        });
      };

      // Déterminer les tranches à afficher
      const hasTr = tranches && tranches.length > 0;
      const trancheList = hasTr
        ? tranches.map(t => ({ id: t.id, name: t.name || t.id, chapters: buildTrancheChapters(t.id) }))
        : [{ id: 'global', name: 'Global', chapters: chaptersData }];

      let tocAdded = false;

      // ─── Construction des "colonnes virtuelles" : base + variantes retenues ─
      // Même logique que l'onglet d'analyse financière de l'app (AnalysisTable).
      // Réintégration CCP : les offres non régulières sont INCLUSES (colonne marquée
      // « sous réserve »), leur statut conservé via `irregular` / `irregularLabel`.
      const NON_REG_DETAIL = ['irreguliere', 'inacceptable', 'inappropriee'];
      const detailColumns = [];
      analysisCompanies.forEach((c, idx) => {
        const admin = companiesData[c.name]?.admin || {};
        // Statut effectif (régularisation après négo prise en compte).
        const effConcl = getEffectiveConclusion(admin, basis);
        const baseConcl = effConcl && NON_REG_DETAIL.includes(effConcl) ? effConcl : null;
        // Rabais commercial global (phase après négo) — s'applique à la colonne
        // base ET à ses variantes (déduit du Total HT en pied de tableau).
        const rabaisPct = isNegoBasis ? getCompanyRabaisPct(c, 'nego') : 0;
        detailColumns.push({
          key: `${c.id}_base`,
          companyId: c.id,
          companyName: c.name,
          companyIndex: idx,
          kind: 'base',
          offers: getEffectiveOffers(c, basis),
          quantities: {},
          removedIds: new Set(),
          newItems: [],
          irregular: !!baseConcl,
          irregularLabel: baseConcl,
          rabaisPct,
        });
        // Variantes retenues uniquement (CCP R2151-11)
        (c.variants || []).filter(v => v.retained).forEach((v, vi) => {
          const vConcl = v.adminConclusion && NON_REG_DETAIL.includes(v.adminConclusion) ? v.adminConclusion : null;
          detailColumns.push({
            key: `${c.id}_${v.id}`,
            companyId: c.id,
            companyName: c.name,
            companyIndex: idx,
            variantIndex: vi + 1,
            variantLabel: v.label || `Variante ${vi + 1}`,
            kind: 'variant',
            // Fusion base + variante, puis prix négociés propres à la variante en
            // phase après négo (source unique — cohérent avec le total dénormalisé v.totalNego).
            offers: getEffectiveVariantOffers(c, v, basis),
            quantities: v.quantities || {},
            removedIds: new Set((v.removedItems || []).map(it => it.itemId)),
            newItems: getEffectiveVariantNewItems(v, basis),
            irregular: !!vConcl,
            irregularLabel: vConcl,
            rabaisPct,
          });
        });
      });

      // Nombre de sous-colonnes par "colonne" : 3 (base) ou 4 (variante avec Qté var)
      const subCount = (col) => col.kind === 'variant' ? 4 : 3;
      const totalSubCols = detailColumns.reduce((a, c) => a + subCount(c), 0);

      trancheList.forEach((tranche) => {
        const trLabel = hasTr ? tranche.name : 'Détail des prix unitaires';
        y = addPage(`${annexCode} — Prix ${isNegoBasis ? 'après' : 'avant'} négociation · ${trLabel}`, pricesPaperSize, 'landscape');
        if (!tocAdded) {
          tocEntries.push({ label: `${annexCode} — Prix ${isNegoBasis ? 'après' : 'avant'} négociation (${pricesPaperSize.toUpperCase()} paysage)`, page: pageNum });
          tocAdded = true;
        }

        doc.setFontSize(14); doc.setTextColor(...THEME.primary); doc.setFont("Helvetica", "bold");
        const title = hasTr
          ? `${annexCode.toUpperCase()} — PRIX ${phaseLabel} — ${tranche.name.toUpperCase()}`
          : `${annexCode.toUpperCase()} — DÉTAIL DES PRIX ${phaseLabel}`;
        doc.text(title, M, y);

        if (analysisMode === 'heatmap') {
          doc.setFontSize(8); doc.setTextColor(0); doc.setFont("Helvetica", "normal");
          doc.setFillColor(248, 113, 113); doc.rect(80, y - 3, 4, 4, 'F'); doc.text("> +50%", 86, y);
          doc.setFillColor(52, 211, 153); doc.rect(100, y - 3, 4, 4, 'F'); doc.text("< -50%", 106, y);
        }
        y += 6;

        const trChapters = tranche.chapters;

        // Calcul totaux pour cette tranche (par colonne virtuelle)
        let trEstTotal = 0;
        const trColumnTotals = {};
        detailColumns.forEach(col => { trColumnTotals[col.key] = 0; });
        trChapters.forEach(chap => {
          if (chap.isOption) return;
          chap.items.forEach(item => {
            trEstTotal += item.activeQty * (item.price || 0);
            detailColumns.forEach(col => {
              if (col.removedIds.has(item.id)) return;
              const pu = Number(col.offers[item.id] || 0);
              const qty = col.quantities[item.id] != null ? Number(col.quantities[item.id]) : item.activeQty;
              trColumnTotals[col.key] += qty * pu;
            });
          });
        });

        const tableBody = [];
        const mainHeaders = [
          { content: 'N°', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Désignation', rowSpan: 2, styles: { halign: 'left', valign: 'middle', cellWidth: 42 } },
          { content: 'U', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Qté', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Estimation', colSpan: 2, styles: { halign: 'center', fillColor: [240, 240, 255] } }
        ];
        const subHeaders = [
          { content: 'P.U.', styles: { halign: 'right', fillColor: [240, 240, 255], fontStyle: 'bold' } },
          { content: 'Total', styles: { halign: 'right', fillColor: [240, 240, 255], fontStyle: 'bold' } }
        ];
        const columnStyles = {};

        const STATUS_LABEL_DETAIL = { irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
        let runningColIdx = 6;
        detailColumns.forEach((col) => {
          const style = getCompanyStyle(col.companyIndex);
          const isVar = col.kind === 'variant';
          // Variante = même couleur que l'entreprise mais plus claire (header + body)
          let headerBg = isVar ? lighten(style.header, 0.45) : style.header;
          let headerText = isVar ? style.text : [255, 255, 255];
          let bodyBg = isVar ? lighten(style.header, 0.88) : style.body;
          let labelTitle = isVar
            ? `${col.companyName} - V${col.variantIndex} (RETENUE)`
            : col.companyName;
          // Offre non régulière : en-tête rouge + mention « sous réserve », corps rosé.
          if (col.irregular) {
            headerBg = [190, 18, 60];   // rose-700
            headerText = [255, 255, 255];
            bodyBg = [254, 226, 226];   // rose-100
            labelTitle = `${col.companyName}${isVar ? ` - V${col.variantIndex}` : ''}\n${STATUS_LABEL_DETAIL[col.irregularLabel] || 'NON RÉGULIÈRE'}`;
          }

          mainHeaders.push({
            content: labelTitle,
            colSpan: subCount(col),
            styles: { halign: 'center', fillColor: headerBg, fontStyle: 'bold', textColor: headerText },
          });
          if (isVar) {
            subHeaders.push({ content: 'Qté var', styles: { halign: 'center', fillColor: bodyBg, textColor: style.text, fontStyle: 'bold' } });
          }
          subHeaders.push({ content: 'P.U.', styles: { halign: 'right', fillColor: bodyBg, textColor: style.text } });
          subHeaders.push({ content: 'Total', styles: { halign: 'right', fillColor: bodyBg, textColor: style.text } });
          subHeaders.push({ content: '%', styles: { halign: 'center', fillColor: bodyBg, textColor: style.text } });

          for (let i = 0; i < subCount(col); i++) {
            columnStyles[runningColIdx + i] = { fillColor: bodyBg };
          }
          runningColIdx += subCount(col);
        });

        trChapters.forEach(chapter => {
          const activeItems = chapter.items.filter(i => i.activeQty > 0);
          if (activeItems.length === 0) return;

          tableBody.push([{ content: chapter.title.toUpperCase(), colSpan: 6 + totalSubCols, styles: { fillColor: [220, 220, 225], fontStyle: 'bold', textColor: [50, 50, 60] } }]);
          activeItems.forEach((item) => {
            const qty = item.activeQty;
            const estTotal = item.price * qty;
            const row = [
              { content: bpuRefMap?.get?.(item.id) || (item.bpuNum || '-') },
              { content: cleanText(item.designation) },
              { content: normalizeUnitSymbol(item.unit) },
              { content: qty },
              { content: formatNumberFr(item.price) },
              { content: formatNumberFr(estTotal), styles: { fontStyle: 'bold' } }
            ];
            detailColumns.forEach((col) => {
              const isVar = col.kind === 'variant';
              const isRemoved = col.removedIds.has(item.id);
              const variantQty = col.quantities[item.id];
              const activeQty = variantQty != null ? Number(variantQty) : qty;
              const priceVal = col.offers[item.id];
              const price = (priceVal !== undefined && priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
              const hasPrice = price !== null && !isRemoved;
              const total = hasPrice ? price * activeQty : 0;
              const deviation = (hasPrice && item.price > 0) ? ((price - item.price) / item.price) * 100 : 0;
              let cellStyle = {};
              if (isRemoved) {
                cellStyle = { fillColor: [241, 245, 249], textColor: [150, 150, 150], fontStyle: 'italic' };
              } else if (analysisMode === 'heatmap' && hasPrice && item.price > 0) {
                const hs = getHeatmapStyle(price, item.price);
                if (hs) cellStyle = { fillColor: hs.fill, textColor: hs.text, fontStyle: 'bold' };
              }

              // Pour les variantes : ajouter colonne Qté var en premier
              if (isVar) {
                const qtyChanged = variantQty != null && Number(variantQty) !== qty;
                row.push({
                  content: isRemoved ? '-' : String(activeQty),
                  styles: { halign: 'center', fontStyle: qtyChanged ? 'bold' : 'normal', textColor: qtyChanged ? [180, 83, 9] : undefined },
                });
              }

              row.push({ content: isRemoved ? 'supprimé' : (hasPrice ? formatNumberFr(price) : '-'), styles: { halign: 'right', ...cellStyle } });
              row.push({ content: isRemoved ? '-' : (hasPrice ? formatNumberFr(total) : '-'), styles: { halign: 'right' } });
              row.push({ content: isRemoved ? '-' : (hasPrice ? (deviation > 0 ? '+' : '') + deviation.toFixed(0) + '%' : '-'), styles: { halign: 'center', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fontSize: 6 } });
            });
            tableBody.push(row);
          });

          // Total chapitre
          {
            const chapEstTotal = activeItems.reduce((acc, i) => acc + (i.activeQty * i.price), 0);
            const isPSE = chapter.isOption;
            const bgColor  = isPSE ? [254, 243, 199] : [226, 232, 240];
            const prefix   = isPSE ? 'PSE — ' : 'TOTAL ';
            const chapTotalRow = [
              { content: `${prefix}${chapter.title.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } },
              { content: '', colSpan: 1, styles: { fillColor: bgColor } },
              { content: formatNumberFr(chapEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } }
            ];
            detailColumns.forEach(col => {
              const isVar = col.kind === 'variant';
              const totalChap = activeItems.reduce((acc, i) => {
                if (col.removedIds.has(i.id)) return acc;
                const p = Number(col.offers[i.id] || 0);
                const q = col.quantities[i.id] != null ? Number(col.quantities[i.id]) : i.activeQty;
                return acc + q * p;
              }, 0);
              const deviation = chapEstTotal > 0 ? ((totalChap - chapEstTotal) / chapEstTotal) * 100 : 0;
              if (isVar) chapTotalRow.push({ content: '', styles: { fillColor: bgColor } }); // Qté var
              chapTotalRow.push({ content: '', styles: { fillColor: bgColor } });
              chapTotalRow.push({ content: formatNumberFr(totalChap), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } });
              chapTotalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%', styles: { halign: 'center', fontSize: 7, fontStyle: 'bold', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: bgColor } });
            });
            tableBody.push(chapTotalRow);
            tableBody.push([{ content: '', colSpan: 6 + totalSubCols, styles: { cellPadding: 1, fillColor: [255, 255, 255] } }]);
          }
        });

        // ─── Articles hors DQE (newItems des variantes retenues) ────────────
        const newItemsByCol = detailColumns
          .filter(col => col.kind === 'variant' && (col.newItems || []).length > 0)
          .flatMap(col => col.newItems.filter(it => Number(it.qty || 0) > 0).map(it => ({ ...it, col })));
        if (newItemsByCol.length > 0) {
          tableBody.push([{ content: 'ARTICLES HORS DQE (AJOUTÉS PAR VARIANTES)', colSpan: 6 + totalSubCols, styles: { fillColor: [220, 252, 231], fontStyle: 'bold', textColor: [22, 101, 52] } }]);
          // Agrégation par (ref + désignation)
          const aggMap = new Map();
          newItemsByCol.forEach(({ col, ...it }) => {
            const key = `${(it.ref || '').toLowerCase()}|${(it.designation || '').toLowerCase()}`;
            if (!aggMap.has(key)) {
              aggMap.set(key, { ref: it.ref || '+', designation: it.designation || '', unit: it.unit || '', perCol: {} });
            }
            aggMap.get(key).perCol[col.key] = { qty: it.qty, price: it.price, total: it.lineTotal || (it.qty * it.price) };
          });
          [...aggMap.values()].forEach(row => {
            const r = [
              { content: row.ref, styles: { fontSize: 6 } },
              { content: '+ ' + cleanText(row.designation), styles: { fontStyle: 'italic', textColor: [22, 101, 52] } },
              { content: normalizeUnitSymbol(row.unit), styles: { halign: 'center' } },
              { content: '-', styles: { halign: 'center', textColor: [180, 180, 180] } },
              { content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } },
              { content: 'Hors estim.', styles: { halign: 'right', fontSize: 6, fontStyle: 'italic', textColor: [120, 120, 120] } },
            ];
            detailColumns.forEach(col => {
              const cell = row.perCol[col.key];
              const isVar = col.kind === 'variant';
              if (!isVar) {
                // Base : pas de nouveaux articles → tirets
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'center', textColor: [180, 180, 180], fontSize: 6 } });
                return;
              }
              // Variante : Qté var + PU + Total + %
              if (cell) {
                r.push({ content: String(cell.qty), styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 252, 231] } });
                r.push({ content: formatNumberFr(cell.price), styles: { halign: 'right', fillColor: [220, 252, 231] } });
                r.push({ content: formatNumberFr(cell.total), styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 252, 231] } });
                r.push({ content: '+', styles: { halign: 'center', fontStyle: 'bold', textColor: [22, 101, 52], fillColor: [220, 252, 231] } });
              } else {
                r.push({ content: '-', styles: { halign: 'center', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'center', textColor: [180, 180, 180], fontSize: 6 } });
              }
            });
            tableBody.push(r);
          });
        }

        // Total net d'une colonne (brut qté×PU + newItems variante, rabais commercial
        // global déduit en phase après négo) — cohérent avec la synthèse financière
        // et le comparatif avant/après négo (source unique du montant noté).
        const colNetTotal = (col) => {
          const isVar = col.kind === 'variant';
          let total = trColumnTotals[col.key] || 0;
          if (isVar) {
            total += (col.newItems || []).reduce((s, it) => s + Number(it.lineTotal || (it.qty * it.price) || 0), 0);
          }
          if (col.rabaisPct > 0) total *= (1 - col.rabaisPct / 100);
          return total;
        };

        // Total HT tranche (avec newItems pour les variantes)
        const totalRow = [
          { content: `TOTAL ${hasTr ? tranche.name.toUpperCase() : 'GÉNÉRAL'} HT`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: '-', styles: { halign: 'center' } },
          { content: formatNumberFr(trEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } },
        ];
        detailColumns.forEach(col => {
          const isVar = col.kind === 'variant';
          const total = colNetTotal(col);
          const deviation = trEstTotal > 0 ? ((total - trEstTotal) / trEstTotal) * 100 : 0;
          if (isVar) totalRow.push({ content: '-', styles: { halign: 'center' } });
          totalRow.push({ content: '-', styles: { halign: 'center' } });
          totalRow.push({ content: formatNumberFr(total), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255] } });
          totalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(2) + '%', styles: { halign: 'center', fontStyle: 'bold' } });
        });
        tableBody.push(totalRow);

        // TVA 20%
        const tvaRate = projectTvaRate;
        const estVat = computeVatBreakdown(trEstTotal, tvaRate);
        const tvaEstTotal = estVat.tva;
        const tvaRow = [{ content: `TVA (${projectTvaPct}%)`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } }, { content: '', styles: { fillColor: [245, 245, 250] } }, { content: formatNumberFr(tvaEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } }];
        detailColumns.forEach(col => {
          const isVar = col.kind === 'variant';
          const tva = computeVatBreakdown(colNetTotal(col), tvaRate).tva;
          if (isVar) tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
          tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
          tvaRow.push({ content: formatNumberFr(tva), styles: { halign: 'right', fillColor: [245, 245, 250] } });
          tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
        });
        tableBody.push(tvaRow);

        // Total TTC
        const ttcEstTotal = estVat.ttc;
        const ttcRow = [{ content: `TOTAL ${hasTr ? tranche.name.toUpperCase() : 'GÉNÉRAL'} TTC`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }, { content: '', styles: { fillColor: [209, 250, 229] } }, { content: formatNumberFr(ttcEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }];
        detailColumns.forEach(col => {
          const isVar = col.kind === 'variant';
          const ttc = computeVatBreakdown(colNetTotal(col), tvaRate).ttc;
          if (isVar) ttcRow.push({ content: '', styles: { fillColor: [209, 250, 229] } });
          ttcRow.push({ content: '', styles: { fillColor: [209, 250, 229] } });
          ttcRow.push({ content: formatNumberFr(ttc), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } });
          ttcRow.push({ content: '', styles: { fillColor: [209, 250, 229] } });
        });
        tableBody.push(ttcRow);

        autoTable(doc, {
          startY: y,
          head: [mainHeaders, subHeaders],
          body: tableBody,
          theme: 'grid',
          // Font size adapte au format papier : A4 compact (5.5 pt) ou A3 confort
          // de lecture (6.5 pt — le format offre ~40% de largeur en plus, on peut relacher).
          // Padding legerement plus serre en A4 pour eviter le wrap sur les grands nombres.
          styles: { font: 'Helvetica', fontSize: pricesPaperSize === 'a3' ? 6.5 : 5.5, cellPadding: pricesPaperSize === 'a3' ? 1.2 : 0.8, lineColor: [220, 220, 220], lineWidth: 0.1 },
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [180, 180, 180], fontSize: pricesPaperSize === 'a3' ? 6.5 : 5.5 },
          columnStyles,
          margin: { left: 10, right: 10 },
          didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
        });
      }); // fin boucle tranches
    }
  };

  // ── ANNEXE C : VARIANTES RETENUES ET PSE ──
  // Pour chaque entreprise ayant des variantes retenues, détail des modifications
  const renderVariantsAnnex = () => {
    const variantBasis = hasNegoPriceData ? 'nego' : 'initial';
    let variantsTocAdded = false;
    const addVariantsToc = () => {
      if (variantsTocAdded) return;
      tocEntries.push({ label: 'Annexe C — Variantes retenues et PSE', page: pageNum });
      variantsTocAdded = true;
    };
    const companiesWithRetainedVariants = analysisCompanies.filter(c =>
      (c.variants || []).some(v => v.retained)
    );

    if (companiesWithRetainedVariants.length > 0) {
      y = addPage('Annexe C — Variantes retenues', 'a4', 'portrait');
      addVariantsToc();
      y = sectionTitle(doc, 'ANNEXE C.1 — Variantes retenues (CCP R2151-11)', y, THEME.primary);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const introVar = "Les variantes ci-dessous ont été déclarées 'retenues' par le pouvoir adjudicateur. Conformément à l'article R2151-11 du CCP, la variante retenue se substitue à la solution de base dans ses éléments qui en diffèrent.";
      ({ y } = drawJustifiedText(doc, introVar, M, y, W - 2 * M, 4.5));
      y += 6;

      companiesWithRetainedVariants.forEach(c => {
        const retainedVariants = (c.variants || []).filter(v => v.retained);
        retainedVariants.forEach((v, vi) => {
          if (y > 240) { y = addPage('Variantes retenues (suite)', 'a4', 'portrait'); }

          // Header variante
          doc.setFillColor(...VERT_CLAIR);
          doc.rect(M, y, W - 2 * M, 12, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...VERT_FONCE);
          doc.text(fitTextToWidth(doc, `${cleanText(c.name)} — V${vi + 1} ${v.label ? `(${cleanText(v.label)})` : ''}`, W - 2 * M - 6), M + 3, y + 5);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.lightText);
          {
            // Total net (rabais commercial global de l'entreprise déduit en phase après négo) —
            // même primitif que la synthèse financière et le Récap (source unique).
            const vTotalEff = getVariantEffectiveTotal(c, v, variantBasis);
            const vRabaisPct = negoActive ? getCompanyRabaisPct(c, 'nego') : 0;
            doc.text(`Total HT : ${fmt(vTotalEff)} €${vRabaisPct > 0 ? ` (net, rabais -${vRabaisPct}%)` : ''}  •  Base HT : ${fmt(analysisStats?.companiesTotals?.[c.id] || 0)} €`, M + 3, y + 10);
          }
          y += 16;

          if (!isRichEmpty(v.description)) {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.lightText);
            doc.text('Descriptif :', M + 3, y);
            y += 4.5;
            y = drawHtmlBlocks(doc, richFieldToBlocks(v.description), M + 3, y, W - 2 * M - 3, {
              fontSize: 8, lineH: 4.5, textColor: THEME.lightText,
            });
            y += 3;
          }

          // ► Justification de l'acceptation (saisie en tab Technique)
          if (!isRichEmpty(v.justification)) {
            // Encadré vert clair pour faire ressortir la motivation
            doc.setFillColor(236, 253, 245); // emerald-50
            const tmpY = y;
            // Contenu riche (gras/listes) : hauteur mesurée avant de dessiner le fond
            const justifBlocks = richFieldToBlocks(v.justification);
            const justifOpts = { fontName: 'Helvetica', fontSize: 8, lineH: 4.2, textColor: [30, 50, 40] };
            const justifH = 6 + measureHtmlBlocks(doc, justifBlocks, W - 2 * M - 12, justifOpts) + 4;
            doc.rect(M + 3, y, W - 2 * M - 3, justifH, 'F');
            doc.setDrawColor(167, 243, 208); // emerald-200
            doc.setLineWidth(0.3);
            doc.rect(M + 3, y, W - 2 * M - 3, justifH);
            // Label
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(6, 78, 59); // emerald-900
            doc.text("Motivation de l'acceptation par le pouvoir adjudicateur :", M + 6, y + 5);
            drawHtmlBlocks(doc, justifBlocks, M + 6, y + 9, W - 2 * M - 12, justifOpts);
            y = tmpY + justifH + 4;
          }

          // Articles ajoutés (newItems) — prix négociés appliqués en phase après négo
          const newItems = getEffectiveVariantNewItems(v, variantBasis)
            .filter(it => Number(it.qty || 0) > 0);
          if (newItems.length > 0) {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.text);
            doc.text(`Articles ajoutés (+ ${newItems.length})`, M + 3, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Réf', 'Désignation', 'Unité', 'Qté', 'PU', 'Total']],
              body: newItems.map(it => [
                it.ref || '',
                cleanText(it.designation || ''),
                it.unit || '',
                { content: fmt(it.qty), styles: { halign: 'right' } },
                { content: fmt(it.price), styles: { halign: 'right' } },
                { content: fmt(it.lineTotal || it.qty * it.price), styles: { halign: 'right', fontStyle: 'bold' } },
              ]),
              styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold' },
              margin: { left: M, right: M },
              didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
            });
            y = doc.lastAutoTable.finalY + 4;
          }

          // Articles supprimés (removedItems)
          const removedItems = (v.removedItems || []).filter(it => Number(it.lostAmount || 0) > 0);
          if (removedItems.length > 0) {
            if (y > 250) { y = addPage('Variantes retenues (suite)', 'a4', 'portrait'); }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.text);
            doc.text(`Articles supprimés (- ${removedItems.length})`, M + 3, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Désignation', 'Unité', 'Qté DQE', 'PU base', 'Montant perdu']],
              body: removedItems.map(it => [
                cleanText(it.designation || ''),
                it.unit || '',
                { content: fmt(it.moeQty), styles: { halign: 'right' } },
                { content: fmt(it.basePrice), styles: { halign: 'right' } },
                { content: '- ' + fmt(it.lostAmount), styles: { halign: 'right', fontStyle: 'bold', textColor: [120, 60, 60] } },
              ]),
              styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
              margin: { left: M, right: M },
              didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
            });
            y = doc.lastAutoTable.finalY + 4;
          }

          // Quantités modifiées
          const qtyChanges = (v.mismatchesVsMoe || []).filter(m => Number(m.delta || 0) !== 0);
          if (qtyChanges.length > 0) {
            if (y > 250) { y = addPage('Variantes retenues (suite)', 'a4', 'portrait'); }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.text);
            doc.text(`Quantités modifiées (${qtyChanges.length})`, M + 3, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Désignation', 'Qté DQE', 'Qté variante', 'Écart']],
              body: qtyChanges.slice(0, 25).map(m => [
                cleanText(m.designation || ''),
                { content: fmt(m.moeQty), styles: { halign: 'right' } },
                { content: fmt(m.offerQty), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: (m.delta >= 0 ? '+' : '') + fmt(m.delta), styles: { halign: 'right', textColor: m.delta > 0 ? [180, 80, 50] : [30, 80, 180] } },
              ]),
              styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [254, 215, 170], textColor: [120, 60, 0], fontStyle: 'bold' },
              margin: { left: M, right: M },
              didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
            });
            y = doc.lastAutoTable.finalY + 6;
          }

          y += 4;
        });
      });
    }

  // ── ANNEXE C.2 : PSE / OPTIONS ──
  // Décision sur les chapitres marqués comme options dans le DQE
  if (optionChapters && optionChapters.length > 0) {
    y = addPage('Annexe C — PSE / Options', 'a4', 'portrait');
    addVariantsToc();
    y = sectionTitle(doc, 'ANNEXE C.2 — Prestations Supplémentaires Éventuelles (PSE) / Options', y, THEME.primary);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    const introPse = "Les chapitres déclarés comme options (PSE) dans le DQE sont listés ci-dessous. Pour chaque option, le pouvoir adjudicateur indique si elle est retenue dans le marché final.";
    ({ y } = drawJustifiedText(doc, introPse, M, y, W - 2 * M, 4.5));
    y += 6;

    const pseBody = optionChapters.map(chap => {
      const inclus = !!includedOptions[chap.id];
      return [
        cleanText(chap.title || 'Option sans titre'),
        {
          content: inclus ? 'RETENUE' : 'NON RETENUE',
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [255, 255, 255],
            fillColor: inclus ? [40, 167, 69] : [120, 120, 120],
          },
        },
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Option / PSE', 'Décision']],
      body: pseBody,
      styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { cellWidth: 40, halign: 'center' } },
      alternateRowStyles: { fillColor: THEME.tableAlt },
      margin: { left: M, right: M },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;

    const nbRetenues = optionChapters.filter(c => includedOptions[c.id]).length;
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    doc.text(`${nbRetenues} option${nbRetenues > 1 ? 's' : ''} retenue${nbRetenues > 1 ? 's' : ''} sur ${optionChapters.length}.`, M, y);
  }
  };

  // ── ANALYSE TECHNIQUE — 1 à 2 pages par critère pour aérer la lecture ──
  const renderTechnicalAnalysis = (basis, stepNum, phaseLabel) => {
    const nonAutoCriteria = criteria.filter(c => !c.auto);
    if (nonAutoCriteria.length > 0) {
      // Bas de page utile (A4 portrait = 297mm, footer ~20mm)
      const BOTTOM = 297 - 22;

      nonAutoCriteria.forEach((crit, critIdx) => {
        // ► NOUVEAU : chaque critère démarre sur une nouvelle page A4 portrait
        y = addPage(`${stepNum} — Analyse technique ${phaseLabel}`, 'a4', 'portrait');
        if (critIdx === 0) {
          tocEntries.push({ label: `${stepNum}. Analyse technique ${phaseLabel}`, page: pageNum });
        }

        const hasSubs = (crit.subCriteria || []).length > 0;

        // Header critère — bande verte avec poids
        y = sectionTitle(doc, `${stepNum}.${critIdx + 1}  ${crit.label}  (${crit.weight}%)`, y, THEME.primary);
        y += 2;

        // Pondération max = poids critère (échelle de la barre)
        const critMax = Number(crit.weight) || 1;

        if (hasSubs) {
          crit.subCriteria.forEach((sc, si) => {
            // ► Nouvelle page pour chaque sous-critère (sauf le 1er qui reste sous le titre du critère)
            if (si > 0) {
              y = addPage(`${crit.label} (suite)`, 'a4', 'portrait');
              doc.setFont('Helvetica', 'italic');
              doc.setFontSize(8);
              doc.setTextColor(...THEME.lightText);
              doc.text(`Critère : ${crit.label}  (${crit.weight}%)`, M, y);
              y += 6;
            }

            // Bandeau sous-critère — wrap si trop long pour tenir sur 1 ligne
            {
              const bandText = `${critIdx + 2}.${si + 1}  ${sc.label || 'Sous-critère'}  (${sc.weight || 0}%)`;
              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(10);
              const bandLines = doc.splitTextToSize(bandText, W - 2 * M - 6);
              const bandH = Math.max(8, bandLines.length * 5 + 3);
              doc.setFillColor(...VERT_CLAIR);
              doc.rect(M, y, W - 2 * M, bandH, 'F');
              doc.setTextColor(...VERT_FONCE);
              bandLines.forEach((ln, idx) => doc.text(ln, M + 3, y + 5 + idx * 5));
              y += bandH + 4;
            }

            if (!isRichEmpty(sc.description)) {
              y = drawHtmlBlocks(doc, richFieldToBlocks(sc.description), M, y, W - 2 * M, {
                fontSize: 8, lineH: 4, textColor: THEME.lightText,
              });
              y += 4;
            }

            const scMax = Number(sc.weight) || 1;
            const FONT_BODY = 8.5, LINE_H = 4.5, MIN_GAP = 6, MAX_GAP = 25;
            const BAR_H = 6, HEADER_BLOCK = BAR_H + 4; // nom + barre + note + petit gap interne

            // Mesure chaque bloc entreprise (texte complet, pas de troncature).
            // Réintégration CCP : les offres non régulières restent dans l'analyse
            // technique, signalées « sous réserve ». Index « ci » d'origine conservé.
            const blocks = companyNames
              .map((name, ci) => ({ name, ci }))
              .map(({ name, ci }) => {
                const irregular = NON_REGULAR_STATUSES.includes(getEffectiveConclusion(companiesData[name]?.admin, basis));
                // Notes effectives : en phase après négo, technicalNego surcharge l'initial.
                const tech = getEffectiveTechnical(companiesData[name], basis);
                const sd = tech[sc.id] || {};
                let h = HEADER_BLOCK;
                // Commentaire riche (gras/listes) : mesure exacte par le moteur
                // de dessin lui-même — la pagination gloutonne en dépend.
                const rich = richFieldToBlocks(sd.text);
                const textH = rich.length
                  ? measureHtmlBlocks(doc, rich, W - 2 * M - 10, { fontSize: FONT_BODY, lineH: LINE_H })
                  : 0;
                h += textH;
                return { name, ci, sd, h, rich, textH, irregular };
              });

            // Distribution gloutonne sur 1+ pages
            const spaceAvail = BOTTOM - y;
            const pages = [];
            let cur = [], curH = 0;
            for (const b of blocks) {
              const needGap = cur.length > 0 ? MIN_GAP : 0;
              if (curH + needGap + b.h > spaceAvail && cur.length > 0) {
                pages.push(cur);
                cur = [b];
                curH = b.h;
              } else {
                cur.push(b);
                curH += needGap + b.h;
              }
            }
            if (cur.length) pages.push(cur);

            pages.forEach((pg, pgIdx) => {
              if (pgIdx > 0) {
                y = addPage(`${sc.label} (suite ${pgIdx + 1}/${pages.length})`, 'a4', 'portrait');
                // Bandeau de continuation — wrap si trop long
                const bandText = `${critIdx + 2}.${si + 1}  ${sc.label || 'Sous-critère'}  (suite ${pgIdx + 1}/${pages.length})`;
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(10);
                const bandLines = doc.splitTextToSize(bandText, W - 2 * M - 6);
                const bandH = Math.max(8, bandLines.length * 5 + 3);
                doc.setFillColor(...VERT_CLAIR);
                doc.rect(M, y, W - 2 * M, bandH, 'F');
                doc.setTextColor(...VERT_FONCE);
                bandLines.forEach((ln, idx) => doc.text(ln, M + 3, y + 5 + idx * 5));
                y += bandH + 4;
              }
              // Gap aéré : on répartit l'espace restant entre les blocs
              const pageStart = y;
              const totalContent = pg.reduce((a, b) => a + b.h, 0);
              const remainingSpace = (BOTTOM - pageStart) - totalContent;
              const effectiveGap = pg.length > 1
                ? Math.max(MIN_GAP, Math.min(MAX_GAP, remainingSpace / pg.length))
                : 0;

              pg.forEach((b, k) => {
                const cStyle = getCompanyStyle(b.ci);
                const sNote = Number(b.sd.note || 0);
                const sMaxN = Number(b.sd.noteMax || 5);
                const sPond = sMaxN > 0 ? (sNote / sMaxN) * (Number(sc.weight) || 0) : 0;

                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(...(b.irregular ? [190, 18, 60] : cStyle.header));
                doc.text(cleanText(b.name), M + 3, y + BAR_H / 2 + 1.5);
                drawScoreBar(doc, 75, y, W - 115, BAR_H, sPond, scMax, b.irregular ? [190, 18, 60] : cStyle.header);
                doc.setTextColor(...THEME.text);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(`${sNote}/${sMaxN}  =  ${fmtScore(sPond)}`, W - M, y + BAR_H / 2 + 1.5, { align: 'right' });
                y += BAR_H + 4;

                if (b.rich.length > 0) {
                  drawHtmlBlocks(doc, b.rich, M + 10, y, W - 2 * M - 10, {
                    fontSize: FONT_BODY, lineH: LINE_H, textColor: THEME.lightText,
                  });
                  y += b.textH;
                }

                if (k < pg.length - 1) y += effectiveGap;
              });
            });
          });
        } else {
          if (!isRichEmpty(crit.description)) {
            y = drawHtmlBlocks(doc, richFieldToBlocks(crit.description), M, y, W - 2 * M, {
              fontSize: 8.5, lineH: 4, textColor: THEME.lightText,
            });
            y += 4;
          }

          // Même logique de distribution multi-pages que pour les sous-critères
          const FONT_BODY = 8.5, LINE_H = 4.5, MIN_GAP = 6, MAX_GAP = 25;
          const BAR_H = 6, HEADER_BLOCK = BAR_H + 4;

          // Réintégration CCP : offres non régulières incluses (marquées « sous réserve »).
          // Index « ci » d'origine conservé (couleur stable).
          const blocks = companyNames
            .map((name, ci) => ({ name, ci }))
            .map(({ name, ci }) => {
              const irregular = NON_REGULAR_STATUSES.includes(getEffectiveConclusion(companiesData[name]?.admin, basis));
              // Notes effectives : en phase après négo, technicalNego surcharge l'initial.
              const tech = getEffectiveTechnical(companiesData[name], basis);
              const d = tech[crit.id] || {};
              let h = HEADER_BLOCK;
              // Synthèse riche : mesure exacte (cf. bloc sous-critères ci-dessus)
              const rich = richFieldToBlocks(d.text);
              const textH = rich.length
                ? measureHtmlBlocks(doc, rich, W - 2 * M - 5, { fontSize: FONT_BODY, lineH: LINE_H })
                : 0;
              h += textH;
              return { name, ci, d, h, rich, textH, irregular };
            });

          const spaceAvail = BOTTOM - y;
          const pages = [];
          let cur = [], curH = 0;
          for (const b of blocks) {
            const needGap = cur.length > 0 ? MIN_GAP : 0;
            if (curH + needGap + b.h > spaceAvail && cur.length > 0) {
              pages.push(cur);
              cur = [b];
              curH = b.h;
            } else {
              cur.push(b);
              curH += needGap + b.h;
            }
          }
          if (cur.length) pages.push(cur);

          pages.forEach((pg, pgIdx) => {
            if (pgIdx > 0) {
              y = addPage(`${crit.label} (suite ${pgIdx + 1}/${pages.length})`, 'a4', 'portrait');
              y = sectionTitle(doc, `${stepNum}.${critIdx + 1}  ${crit.label}  (${crit.weight}%) — suite ${pgIdx + 1}/${pages.length}`, y, THEME.primary);
              y += 2;
            }
            const pageStart = y;
            const totalContent = pg.reduce((a, b) => a + b.h, 0);
            const remainingSpace = (BOTTOM - pageStart) - totalContent;
            const effectiveGap = pg.length > 1
              ? Math.max(MIN_GAP, Math.min(MAX_GAP, remainingSpace / pg.length))
              : 0;

            pg.forEach((b, k) => {
              const cStyle = getCompanyStyle(b.ci);
              const note = Number(b.d.note || 0);
              const noteMax = Number(b.d.noteMax || 5);
              const notePond = noteMax > 0 ? (note / noteMax) * crit.weight : 0;

              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(9);
              doc.setTextColor(...(b.irregular ? [190, 18, 60] : cStyle.header));
              doc.text(cleanText(b.name), M + 3, y + BAR_H / 2 + 1.5);
              drawScoreBar(doc, 75, y, W - 115, BAR_H, notePond, critMax, b.irregular ? [190, 18, 60] : cStyle.header);
              doc.setTextColor(...THEME.text);
              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(8);
              doc.text(`${note}/${noteMax}  =  ${fmtScore(notePond)}`, W - M, y + BAR_H / 2 + 1.5, { align: 'right' });
              y += BAR_H + 4;

              if (b.rich.length > 0) {
                drawHtmlBlocks(doc, b.rich, M + 5, y, W - 2 * M - 5, {
                  fontSize: FONT_BODY, lineH: LINE_H, textColor: THEME.lightText,
                });
                y += b.textH;
              }

              if (k < pg.length - 1) y += effectiveGap;
            });
          });
        }
      });

      // Tableau récap des notes techniques — toujours sur sa propre page
      y = addPage(`${stepNum} — Récapitulatif des notes techniques · phase ${phaseLabel}`, 'a4', 'portrait');
      y = sectionTitle(doc, `${stepNum} — Récapitulatif des notes techniques · phase ${phaseLabel}`, y, THEME.primary);
      const techRecapCols = [];
      nonAutoCriteria.forEach(crit => {
        const hasSubs = (crit.subCriteria || []).length > 0;
        if (hasSubs) {
          crit.subCriteria.forEach((sc) => {
            techRecapCols.push({ id: sc.id, label: `${sc.label || 'SC'}`, weight: sc.weight || 0, parentId: crit.id, isSub: true });
          });
        } else {
          techRecapCols.push({ id: crit.id, label: crit.label, weight: crit.weight, isSub: false });
        }
      });

      const techRecapHead = ['Entreprise', ...techRecapCols.map(c => {
        const short = c.label.length > 14 ? c.label.slice(0, 13) + '...' : c.label;
        return `${short}\n(${c.weight}%)`;
      }), 'Total'];

      const techRecapBody = companyNames.map((name) => {
        // Notes effectives : en phase après négo, technicalNego surcharge l'initial.
        const tech = getEffectiveTechnical(companiesData[name], basis);
        let total = 0;
        const notes = techRecapCols.map(col => {
          const d = tech[col.id] || {};
          const n = Number(d.note || 0);
          const m = Number(d.noteMax || 5);
          const score = m > 0 ? (n / m) * col.weight : 0;
          total += score;
          return fmtScore(score);
        });
        return [name, ...notes, { content: fmtScore(total), styles: { fontStyle: 'bold' } }];
      });

      autoTable(doc, {
        startY: y,
        head: [techRecapHead],
        body: techRecapBody,
        styles: { font: 'Helvetica', fontSize: 6.5, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 }, [techRecapHead.length - 1]: { fontStyle: 'bold', fillColor: VERT_CLAIR } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const cStyle = getCompanyStyle(data.row.index);
            data.cell.styles.textColor = cStyle.header;
          }
        },
        margin: { left: M, right: M },
        didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  };

  const renderAdminAfterNego = () => {
    if (!hasNegoPriceData || companyNames.length === 0) return;
    y = addPage('8 — Analyse administrative après négociation', 'a4', 'portrait');
    tocEntries.push({ label: '8. Analyse administrative après négociation', page: pageNum });
    y = sectionTitle(doc, '8  ANALYSE ADMINISTRATIVE APRÈS NÉGOCIATION', y, THEME.primary);

    const statusLabels = {
      reguliere: 'RÉGULIÈRE',
      irreguliere: 'IRRÉGULIÈRE',
      inacceptable: 'INACCEPTABLE',
      inappropriee: 'INAPPROPRIÉE',
    };
    const NON_REG_AFTER = ['irreguliere', 'inacceptable', 'inappropriee'];
    // Colonne « Motif » ajoutée seulement si au moins une offre reste écartée
    // après négociation (obligation de motivation du rejet, CCP R2181-1).
    const hasIrregAfter = companyNames.some(name =>
      NON_REG_AFTER.includes(getEffectiveConclusion(companiesData[name]?.admin, 'nego')));

    const adminAfterBody = companyNames.map((name) => {
      const admin = companiesData[name]?.admin || {};
      const initial = getEffectiveConclusion(admin, 'initial');
      const after = getEffectiveConclusion(admin, 'nego') || initial;
      const regularized = isRegularizedAfterNego(admin);
      const evolution = regularized
        ? 'Régularisée après négociation'
        : initial !== after
          ? 'Statut modifié'
          : 'Statut inchangé';
      const row = [
        { content: cleanText(name), styles: { fontStyle: 'bold' } },
        statusLabels[initial] || 'NON RENSEIGNÉE',
        { content: statusLabels[after] || 'NON RENSEIGNÉE', styles: { fontStyle: 'bold' } },
        { content: evolution, styles: { textColor: regularized ? [21, 128, 61] : THEME.lightText } },
      ];
      if (hasIrregAfter) {
        const isNonReg = NON_REG_AFTER.includes(after);
        // Motif de non-régularité, ou motif de régularisation si l'offre a été régularisée.
        const txt = isNonReg
          ? (htmlToPlainText(getEffectiveIrregularityReason(admin, 'nego')).trim() || '(motif non renseigné)')
          : (regularized ? (admin.regularizationComment || '').trim() || '—' : '—');
        row.push({
          content: cleanText(txt),
          styles: { fontSize: 7, textColor: isNonReg ? [146, 64, 14] : (regularized ? [21, 128, 61] : [180, 180, 180]) },
        });
      }
      return row;
    });

    const headAfter = ['Entreprise', 'Statut initial', 'Statut après négociation', 'Évolution'];
    if (hasIrregAfter) headAfter.push('Motif (CCP R2181-1)');

    autoTable(doc, {
      startY: y,
      head: [headAfter],
      body: adminAfterBody,
      styles: { font: 'Helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: hasIrregAfter ? { 4: { cellWidth: 55 } } : {},
      alternateRowStyles: { fillColor: THEME.tableAlt },
      margin: { left: M, right: M },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  // Ordre du corps du rapport = ordre canonique du workflow RAO.
  renderTechnicalAnalysis('initial', 4, 'initiale');
  renderFinancialSummary();
  if (hasNegoPriceData) {
    renderNegoResponses();
    renderNegoDepouillement();
    renderAdminAfterNego();
    renderTechnicalAnalysis('nego', 9, 'après négociation');
  }

  // ── RÉCAPITULATIF FINAL ──
  const recapStep = hasNegoPriceData ? 10 : '5.2';
  const recapLabel = hasNegoPriceData ? 'Récapitulatif final' : 'Conclusion avant négociation';
  y = addPage(`${recapStep} — ${recapLabel}`, 'a4', 'portrait');
  tocEntries.push({ label: `${recapStep}${hasNegoPriceData ? '.' : ''} ${recapLabel}`, page: pageNum });
  y = sectionTitle(doc, `${recapStep}  ${recapLabel.toUpperCase()}`, y, THEME.primary);

  const techCs = criteria.filter(c => !c.auto);

  // extendedRanking est déjà calculé en haut du générateur (cohérence Synthèse + Récap)
  const maxScorePrice = Number(scoringConfig?.maxScore || 50);
  const headCols = [
    'Entreprise',
    ...techCs.map(c => c.label.length > 25 ? c.label.slice(0, 25) + '...' : c.label),
    `C1 Prix\n/${maxScorePrice} pts`,
    'Prix HT',
    'Total\n/100',
    'Rang'
  ];

  const STATUS_LABEL_RECAP = { irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
  const bodyRows = extendedRanking.map((r) => {
    // Offre non régulière : notée et classée comme les autres, mais signalée
    // « sous réserve » (le statut est ajouté sous le nom, fond rosé via didParseCell).
    const statusTag = r.irregular ? `\n${STATUS_LABEL_RECAP[r.irregularLabel] || 'NON RÉGULIÈRE'} (sous réserve)` : '';
    const displayName = (r.kind === 'variant'
      ? `  > ${r.name} - V${r.variantIndex}${r.variantLabel ? ` (${r.variantLabel})` : ''} [RETENUE]`
      : r.name.toUpperCase()) + statusTag;
    return [
      displayName,
      ...techCs.map(c => fmtScore(r.techScores?.[c.id] || 0)),
      fmtScore(r.priceScore || 0),
      fmt(r.price) + ' €',
      fmtScore(r.totalScore),
      `${r.rank}`,
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [headCols],
    body: bodyRows,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 4, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', minCellWidth: 35 },
      [headCols.length - 3]: { halign: 'right', minCellWidth: 26 },
      [headCols.length - 2]: { fontStyle: 'bold', textColor: THEME.primary, fontSize: 9 },
      [headCols.length - 1]: { fontStyle: 'bold', fontSize: 10 }
    },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowData = extendedRanking[data.row.index];
        if (!rowData) return;
        const rank = rowData.rank;
        const isVariant = rowData.kind === 'variant';
        const isIrregular = !!rowData.irregular;

        const originalIdx = analysisCompanies.findIndex(c => c.name === rowData.name);
        const cStyle = getCompanyStyle(originalIdx !== -1 ? originalIdx : 0);

        // Ligne irrégulière : notée et classée, mais signalée (fond rosé + texte rouge).
        // Pas de médaille de rang (réservée aux offres régulières attribuables).
        if (isIrregular) {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
          if (data.column.index === 0) {
            data.cell.styles.textColor = [190, 18, 60];
            data.cell.styles.fontStyle = 'bold';
          }
        } else {
          // Ligne variante : fond légèrement violet
          if (isVariant) {
            data.cell.styles.fillColor = [243, 232, 255];
            if (data.column.index === 0) {
              data.cell.styles.textColor = [88, 28, 135];
              data.cell.styles.fontStyle = 'italic';
            }
          }

          if (data.column.index === 0 && !isVariant) {
            data.cell.styles.textColor = cStyle.header;
          }

          if (rank === 1) {
            data.cell.styles.fillColor = VERT_CLAIR;
          }
          if (data.column.index === headCols.length - 1) {
            if (rank === 1) {
              data.cell.styles.fillColor = [255, 215, 0];
              data.cell.styles.textColor = [0, 0, 0];
            } else if (rank === 2) {
              data.cell.styles.fillColor = [224, 224, 224];
              data.cell.styles.textColor = [0, 0, 0];
            } else if (rank === 3) {
              data.cell.styles.fillColor = [205, 127, 50];
              data.cell.styles.textColor = [255, 255, 255];
            }
          }
        }
      }
    },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Barres empilées (prix + technique) — utilise extendedRanking ──
  // (mêmes scores que le tableau au-dessus : variantes retenues + Pmin recalculé,
  //  offres irrégulières exclues de l'affichage car non-notées)
  if (y < 297 - 60) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...VERT_FONCE);
    doc.text('VISUALISATION DES SCORES', M, y + 3);
    y += 8;
    const barMaxW = W - 80;
    extendedRanking.forEach((r) => {
      if (y > 280) return;
      const origIdx = analysisCompanies.findIndex(c => c.name === r.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      const priceW = barMaxW * (r.priceScore || 0) / 100;
      const techW = barMaxW * techTotal / 100;

      const barH = 6;
      const isVariant = r.kind === 'variant';
      const label = isVariant ? `${r.name} · V${r.variantIndex}` : r.name;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...(r.irregular ? [190, 18, 60] : cStyle.header));
      doc.text(label, M, y + barH / 2 + 6.5 * 0.13);

      // Fond gris
      doc.setFillColor(235, 235, 240);
      doc.rect(55, y, barMaxW, barH, 'F');
      // Barre prix (vert papyrus pour base, plus clair pour variante)
      if (priceW > 2) {
        const priceColor = isVariant ? lighten(VERT_PAPYRUS, 0.35) : VERT_PAPYRUS;
        doc.setFillColor(...priceColor);
        doc.rect(55, y, priceW, barH, 'F');
        if (priceW > 12) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
          doc.text(fmtScore(r.priceScore || 0), 55 + priceW / 2, y + barH / 2 + 0.8, { align: 'center' });
        }
      }
      // Barre technique (bleu)
      if (techW > 2) {
        const techColor = isVariant ? lighten([59, 130, 246], 0.35) : [59, 130, 246];
        doc.setFillColor(...techColor);
        doc.rect(55 + priceW, y, techW, barH, 'F');
        if (techW > 12) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
          doc.text(fmtScore(techTotal), 55 + priceW + techW / 2, y + barH / 2 + 0.8, { align: 'center' });
        }
      }
      // Total à droite
      doc.setTextColor(...THEME.text);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(fmtScore(r.totalScore), 55 + barMaxW + 2, y + barH / 2 + 0.8);
      y += 8;
    });
    // Légende
    doc.setFillColor(...VERT_PAPYRUS); doc.rect(55, y, 4, 3, 'F');
    doc.setFillColor(59, 130, 246); doc.rect(65, y, 4, 3, 'F');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...THEME.lightText);
    doc.text('Prix', 60, y + 2.5); doc.text('Technique', 70, y + 2.5);
    y += 10;
  }

  // ── Recommandation conforme CCP — utilise extendedRanking (rang 1 réel) ──
  const winner = extendedRanking.find(r => r.rank === 1) || ranking[0];
  if (winner) {
    if (y > 265) { y = addPage('Récapitulatif général', 'a4', 'portrait'); }
    const isVariantWinner = winner.kind === 'variant';
    const winnerLabel = isVariantWinner
      ? `${winner.name.toUpperCase()} — VARIANTE V${winner.variantIndex}${winner.variantLabel ? ` (${cleanText(winner.variantLabel)})` : ''}`
      : winner.name.toUpperCase();
    // Texte personnalise si l'utilisateur l'a edite dans TabRecap, sinon texte par defaut.
    // Le texte custom est stocke dans rao.recommendation (string).
    // Bandeau centré blanc-sur-vert : rendu en texte simple — la mise en forme
    // saisie au RichTextField (gras/listes) est aplatie ici, le bandeau imposant
    // sa propre typographie (gras, centré). htmlToPlainText préserve puces et
    // retours à la ligne.
    const customText = htmlToPlainText(rao?.recommendation || '').trim();
    // Préfixe selon la phase de négociation — appliqué uniquement au texte par défaut
    // (un texte personnalisé saisi dans TabRecap est respecté tel quel).
    const negoPrefix = negotiationPhase === 'after'
      ? "À l'issue de la phase de négociation, et au regard des critères d'attribution définis dans les documents de consultation,"
      : negotiationPhase === 'before'
        ? "Sur la base des offres initiales remises, et au regard des critères d'attribution définis dans les documents de consultation,"
        : "Au regard des critères d'attribution définis dans les documents de consultation,";
    // Une offre non régulière ne peut être déclarée économiquement la plus avantageuse
    // ni attributaire en l'état (CCP) : la conclusion par défaut le mentionne explicitement.
    const winnerIrregular = !!winner.irregular;
    const recoText = customText || (winnerIrregular
      ? `${negoPrefix} l'offre de l'entreprise ${winnerLabel} obtient le meilleur classement, mais elle est jugée NON RÉGULIÈRE : elle ne peut être déclarée économiquement la plus avantageuse ni attributaire en l'état, sous réserve de sa régularisation (art. R2152-2).`
      : `${negoPrefix} l'offre de l'entreprise ${winnerLabel} est l'offre économiquement la plus avantageuse.`);
    // IMPORTANT : fixer la police AVANT de mesurer. splitTextToSize calcule le
    // retour à la ligne avec la taille de police COURANTE ; si elle est héritée du
    // bloc précédent (légende 5,5pt par ex.), la phrase tient sur une seule ligne
    // à la mesure puis est dessinée à 10pt → débordement horizontal.
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    // Mesurer la hauteur pour adapter le rectangle (wrap auto)
    const textWidth = W - 2 * M - 8;
    const lines = doc.splitTextToSize(cleanText(recoText), textWidth);
    const lineH = 4.5;
    const padTop = 6;
    const padBottom = 10;
    const scoreLineH = 6;
    const rectH = padTop + lines.length * lineH + scoreLineH + padBottom;
    doc.setFillColor(...(winnerIrregular ? [153, 27, 27] : THEME.primary)); // rouge si offre non régulière
    doc.roundedRect(M, y, W - 2 * M, rectH, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    let textY = y + padTop;
    lines.forEach(ln => { doc.text(ln, W / 2, textY, { align: 'center' }); textY += lineH; });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Score : ${fmtScore(winner.totalScore)} / 100  —  Montant : ${fmt(winner.price)} € HT  —  ${fmt(computeVatBreakdown(winner.price, projectTvaRate).ttc)} € TTC`, W / 2, textY + 2, { align: 'center' });
  }

  // ── ANNEXES DU RAPPORT ──
  renderPriceAnnex('initial', 'Annexe A');
  if (hasNegoPriceData) renderPriceAnnex('nego', 'Annexe B');
  renderVariantsAnnex();

  // Annexes méthodologiques et réglementaires — masquées si exclues.
  if (includeAnnexes) {
  // ── ANNEXE D — Formules de scoring ──
  y = addPage('Annexes — Formules', 'a4', 'portrait');
  tocEntries.push({ label: 'Annexe D — Formules de notation', page: pageNum });
  y = sectionTitle(doc, 'ANNEXE D — Formules de notation du critère prix', y, THEME.primary);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text('Notations : P = prix de l\'offre ; Pmin = prix le plus bas ; Pmoy = moyenne des prix ; N = note maximale.', M, y);
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...VERT_FONCE);
  doc.text(`Formule active sur ce dossier : ${(scoringConfig?.mode || 'f1').toUpperCase()}  —  Note max : ${scoringConfig?.maxScore || 40} points`, M, y);
  y += 8;

  const formulasBody = [
    ['f1', 'Linéaire',                     'N x (Pmin / P)'],
    ['f2', 'Quadratique',                  'N x (Pmin / P)^2'],
    ['f3', 'Cubique',                      'N x (Pmin / P)^3'],
    ['f4', 'Écart relatif',                'N x (1 - (P - Pmin) / Pmin)'],
    ['f5', 'Amortie par moyenne',          'N x (1 - (P - Pmin) / Pmoy)'],
    ['f6', 'Mixte (sous/au-dessus moy.)',  'Si P <= Pmoy : N x racine(Pmin/P) ; sinon : N x (Pmin/P)^2'],
    ['f7', 'Bornée Pmin / Pmax',           'N x (1 - (P - Pmin) / (Pmax - Pmin))'],
    ['f8', 'Inverse de moyenne',           '(N x Pmoy) / (Pmoy + P)'],
    ['f9', 'Double minimum',               'N x (2 x Pmin / (Pmin + P))'],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Nom', 'Formule mathématique']],
    body: formulasBody.map(([c, n, f]) => [
      { content: c, styles: { fontStyle: 'bold', halign: 'center', fillColor: c === (scoringConfig?.mode || 'f1') ? VERT_CLAIR : undefined } },
      n,
      { content: f, styles: { font: 'Courier', fontSize: 8 } },
    ]),
    styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 18 } },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── ANNEXE E — Références CCP ──
  if (y > 200) { y = addPage('Annexes — Références CCP', 'a4', 'portrait'); }
  tocEntries.push({ label: 'Annexe E — Références CCP', page: pageNum });
  y = sectionTitle(doc, 'ANNEXE E — Références du Code de la Commande Publique', y, THEME.primary);

  const ccpRefs = [
    {
      art: 'L2113-1',
      titre: "Acte d'engagement",
      desc: "L'acte d'engagement (AE) constitue le document contractuel par lequel le candidat s'engage à exécuter le marché aux conditions qu'il propose. Le montant porté sur l'AE engage le soumissionnaire."
    },
    {
      art: 'L2152-2',
      titre: 'Offre irrégulière',
      desc: "Une offre est irrégulière lorsqu'elle ne respecte pas les exigences des documents de consultation, notamment si elle modifie les quantités du DQE. Elle peut être régularisée par décision motivée du pouvoir adjudicateur dans le respect du principe d'égalité de traitement."
    },
    {
      art: 'R2151-8 à R2151-11',
      titre: 'Variantes',
      desc: "En procédure formalisée, les variantes sont interdites par défaut sauf mention contraire dans l'avis de marché. En procédure adaptée, elles sont autorisées sauf mention contraire. Les exigences minimales doivent être précisées dans les documents de consultation. La variante retenue se substitue à la solution de base dans ses éléments qui en diffèrent."
    },
    {
      art: 'R2152-2',
      titre: "Régularisation des offres",
      desc: "Toutes les offres irrégulières peuvent faire l'objet d'une régularisation. Cette faculté ne peut être exercée que dans le respect des principes d'égalité de traitement, de transparence et sans modification substantielle des caractéristiques de l'offre."
    },
  ];

  ccpRefs.forEach(ref => {
    if (y > 250) { y = addPage('Annexes — Références CCP (suite)', 'a4', 'portrait'); }
    // Largeur dynamique selon longueur du label article (min 30, +2mm par caractère au-delà de 12)
    const labelText = `Article ${ref.art}`;
    const labelW = Math.max(30, doc.getTextWidth(labelText) + 6);
    doc.setFillColor(...VERT_CLAIR);
    doc.rect(M, y, labelW, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...VERT_FONCE);
    doc.text(labelText, M + 2, y + 4);
    doc.setFontSize(9);
    doc.setTextColor(...THEME.text);
    doc.text(ref.titre, M + labelW + 5, y + 4);
    y += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    const lines = doc.splitTextToSize(ref.desc, W - 2 * M - 4);
    drawJustifiedText(doc, ref.desc, M + 4, y, W - 2 * M - 4, 4.5);
    y += lines.length * 4.5 + 6;
  });
  }

  // ── REMPLIR LE SOMMAIRE (page 2) ──
  doc.setPage(sommairePageIndex);
  let tocY = 30;
  // Titre H1
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14); // H1
  doc.setTextColor(...VERT_PAPYRUS);
  doc.text('SOMMAIRE', M, tocY);
  tocY += 4;
  // Ligne décorative
  doc.setDrawColor(...VERT_PAPYRUS);
  doc.setLineWidth(1);
  doc.line(M, tocY, M + 30, tocY);
  tocY += 10;

  tocEntries.forEach((entry) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.text);
    doc.text(entry.label, M + 2, tocY);
    // Points de conduite
    const labelW = doc.getTextWidth(entry.label);
    const pageStr = `${entry.page}`;
    const pageW = doc.getTextWidth(pageStr);
    const dotsStart = M + 2 + labelW + 2;
    const dotsEnd = W - M - pageW - 2;
    doc.setTextColor(...THEME.lightText);
    doc.setFontSize(8);
    let dotX = dotsStart;
    while (dotX < dotsEnd) {
      doc.text('.', dotX, tocY);
      dotX += 2;
    }
    // Numéro de page
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...VERT_PAPYRUS);
    doc.text(pageStr, W - M, tocY, { align: 'right' });
    tocY += 8;
  });

  const safeName = (consultation?.objet || project?.name || 'RAO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  stampPdfCredit(doc);
  doc.save(`RAO_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
