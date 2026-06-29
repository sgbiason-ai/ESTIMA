// src/utils/wordNegoLetterGenerator.js
//
// Export Word (.docx) du courrier de négociation RAO — pendant Word de
// pdfNegoLetterGenerator.js. Reproduit la structure du courrier :
//   en-tête (date, destinataire/expéditeur, objet) reconstruite explicitement,
//   corps (Monsieur → signature, AVEC les tableaux de prix atypiques) extrait
//   de l'aperçu HTML via stripStructuralFromHtml() puis converti en éléments docx.
//
// Le document Word est entièrement modifiable (paragraphes, listes, tableaux).

import { saveAs } from 'file-saver';
import { appendEstimaWordCredit } from './estimaWordCredit';
import { DEFAULT_BRANDING } from '../data/branding';
import { sanitizeFilename, loadImage } from './pdf/pdfSharedHelpers';
import { stripStructuralFromHtml } from '../components/rao/tabs/nego/negoLetterUtils';

// ── Classes docx (lazy-load au premier appel) ──
let Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber,
    Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ImageRun;

const ensureDocx = async () => {
  if (Document) return;
  const docx = await import('docx');
  ({ Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber,
     Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ImageRun } = docx);
};

// ── Helpers ──
const cleanColor = (hex, fb = '000000') => {
  if (!hex) return fb;
  const m = String(hex).match(/#?([0-9a-fA-F]{6})/);
  return m ? m[1].toUpperCase() : fb;
};

const sanitize = (s) => {
  if (s == null) return '';
  return String(s)
    // eslint-disable-next-line no-control-regex -- retire les caractères de contrôle invalides en XML/Word
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[\u200B\u00A0\u202F\u2009]/g, ' ');
};

const base64ToBytes = (dataURL) => {
  const re = /^data:image\/(png|jpe?g);base64,/i;
  if (!dataURL || !re.test(dataURL)) return null;
  try {
    const bin = window.atob(dataURL.replace(re, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const type = /png/i.test(dataURL.slice(0, 20)) ? 'png' : 'jpg';
    return { bytes, type };
  } catch { return null; }
};

// Largeur utile (twips) : A4 (11906) − marges gauche/droite (2×1134)
const CONTENT_TW = 11906 - 1134 * 2;

// mm → pixels @96 dpi (unité des transformations d'image docx)
const mmToPx = (mm) => Math.round((mm / 25.4) * 96);

// Construit le paragraphe d'en-tête contenant le logo, en HAUT À GAUCHE et
// SANS déformation : l'image est contenue (object-fit: contain) dans une boîte
// de 32×18 mm, comme l'aperçu et le PDF. Retourne null si pas de logo valide.
const buildLogoParagraph = async (dataURL) => {
  const img = base64ToBytes(dataURL);
  if (!img) return null;
  const boxW = mmToPx(32), boxH = mmToPx(18);
  let width = boxW, height = boxH;
  try {
    const el = await loadImage(dataURL);
    if (el?.naturalWidth && el?.naturalHeight) {
      const scale = Math.min(boxW / el.naturalWidth, boxH / el.naturalHeight);
      width = Math.max(1, Math.round(el.naturalWidth * scale));
      height = Math.max(1, Math.round(el.naturalHeight * scale));
    }
  } catch { /* ratio par défaut si la mesure échoue */ }
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new ImageRun({ data: img.bytes, type: img.type, transformation: { width, height } })],
  });
};

// Alignement docx depuis un style inline (text-align)
const alignFromStyle = (style = '') => {
  const m = style.match(/text-align\s*:\s*(\w+)/i);
  const v = m ? m[1].toLowerCase() : 'justify';
  if (v === 'right') return AlignmentType.RIGHT;
  if (v === 'center') return AlignmentType.CENTER;
  if (v === 'left') return AlignmentType.LEFT;
  return AlignmentType.JUSTIFIED;
};

// Indentation gauche (twips) depuis padding-left (% ou px) — utilisé pour la signature
const indentFromStyle = (style = '') => {
  const m = style.match(/padding-left\s*:\s*(\d+)(%|px|pt)/i);
  if (!m) return 0;
  const v = parseInt(m[1], 10);
  if (m[2] === '%') return Math.round((v / 100) * CONTENT_TW);
  if (m[2] === 'pt') return Math.round(v * 20);
  return Math.round(v * 15); // px → twips approx
};

// Extrait les runs inline (gras/italique/souligné/surlignage jaune) d'un élément.
// `bold` force le gras sur tous les runs (en-têtes de tableau).
const runsFromEl = (el, { font, size, color = '282828', bold = false } = {}) => {
  const out = [];
  const walk = (node, ctx) => {
    if (node.nodeType === 3) {
      const txt = sanitize(node.textContent);
      if (txt) out.push(new TextRun({
        text: txt, font, size, color: ctx.color || color,
        bold: ctx.bold, italics: ctx.italic,
        underline: ctx.underline ? { type: 'single' } : undefined,
        highlight: ctx.hl ? 'yellow' : undefined,
      }));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') { out.push(new TextRun({ text: '', break: 1, font, size })); return; }
    const c = { ...ctx };
    if (tag === 'strong' || tag === 'b') c.bold = true;
    if (tag === 'em' || tag === 'i') c.italic = true;
    if (tag === 'u') c.underline = true;
    const st = node.getAttribute?.('style') || '';
    if (/background[^;"]*(?:#ff0\b|#ffff00|yellow)/i.test(st)) c.hl = true;
    for (const ch of node.childNodes) walk(ch, c);
  };
  walk(el, { bold });
  return out.length ? out : [new TextRun({ text: ' ', font, size })];
};

// Convertit un <table> HTML (tableau de prix atypiques) en Table docx
const tableToDocx = (tableEl, { font }) => {
  const trs = Array.from(tableEl.querySelectorAll('tr')).filter(tr => tr.querySelector('td,th'));
  if (!trs.length) return null;

  // Couleur d'en-tête lue depuis le background du <th> (rouge/amber/slate)
  const thStyle = tableEl.querySelector('th')?.getAttribute('style') || '';
  const headFill = cleanColor(thStyle.match(/background\s*:\s*([^;]+)/i)?.[1], '475569');
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };

  const rows = trs.map(tr => {
    const cells = Array.from(tr.querySelectorAll('td,th'));
    return new TableRow({
      children: cells.map(cell => {
        const isHead = cell.tagName.toLowerCase() === 'th';
        const cellStyle = cell.getAttribute('style') || '';
        return new TableCell({
          shading: isHead ? { fill: headFill } : undefined,
          verticalAlign: VerticalAlign.CENTER,
          borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({
            alignment: alignFromStyle(cellStyle),
            spacing: { after: 0 },
            children: runsFromEl(cell, { font, size: 18, color: isHead ? 'FFFFFF' : '282828', bold: isHead }),
          })],
        });
      }),
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder,
      insideHorizontal: cellBorder, insideVertical: cellBorder,
    },
  });
};

// Convertit le corps HTML (paragraphes, listes, tableaux, divs) en éléments docx
const bodyToDocx = (html, { font }) => {
  const out = [];
  if (!html) return out;
  const doc = new DOMParser().parseFromString(`<div id="__b">${html}</div>`, 'text/html');
  const root = doc.getElementById('__b');
  if (!root) return out;

  const walk = (node) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      const style = el.getAttribute('style') || '';
      if (/display\s*:\s*none/i.test(style)) continue; // marker invisible

      if (tag === 'p') {
        const txt = (el.textContent || '').trim();
        if (!txt) { out.push(new Paragraph({ children: [new TextRun({ text: '', font })], spacing: { after: 80 } })); continue; }
        const indent = indentFromStyle(style);
        out.push(new Paragraph({
          alignment: alignFromStyle(style),
          indent: indent ? { left: indent } : undefined,
          spacing: { after: 140, line: 276 },
          children: runsFromEl(el, { font, size: 22 }),
        }));
      } else if (tag === 'ul' || tag === 'ol') {
        const ordered = tag === 'ol';
        Array.from(el.querySelectorAll(':scope > li')).forEach(li => {
          out.push(new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 60, line: 276 },
            bullet: ordered ? undefined : { level: 0 },
            numbering: ordered ? { reference: 'nego-ol', level: 0 } : undefined,
            children: runsFromEl(li, { font, size: 22 }),
          }));
        });
      } else if (tag === 'table') {
        const t = tableToDocx(el, { font });
        if (t) { out.push(t); out.push(new Paragraph({ children: [new TextRun({ text: '', font })], spacing: { after: 120 } })); }
      } else if (tag === 'div') {
        walk(el); // ex: <div data-anomaly="..."> qui contient p/ul/table
      }
    }
  };
  walk(root);
  return out;
};

// ── Bloc destinataire / expéditeur (cellule bordée) ──
const partyCell = (font, widthPct, headerLabel, name, addressLines) => {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' } },
      children: [new TextRun({ text: headerLabel, font, size: 18, color: '404040' })],
    }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: sanitize(name), font, size: 20, bold: true })] }),
    ...addressLines.filter(Boolean).map(ln => new Paragraph({
      spacing: { after: 0 }, children: [new TextRun({ text: sanitize(ln), font, size: 18, color: '404046' })],
    })),
  ];
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: { top: border, bottom: border, left: border, right: border },
    children,
  });
};

// ── EXPORT PRINCIPAL ──
export const generateNegoLetterWord = async ({
  companyName,
  letterHtml,
  letterConfig = {},
  consultation = {},
  branding = DEFAULT_BRANDING,
  project = null,
}) => {
  await ensureDocx();
  const b = branding || DEFAULT_BRANDING;
  const font = b.fonts?.main || 'Calibri';
  const primary = cleanColor(b.colors?.primary, '286E55');

  // ── Données d'en-tête (mêmes sources que le PDF / applyTemplate) ──
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const city = letterConfig.city || project?.clientCity || consultation?.lieu || '[Ville]';
  const objet = project?.name || consultation?.objet || '[Objet du marché]';
  const client = project?.client || consultation?.client || '[Nom du Client]';
  const adresseEnt = (letterConfig.adresseEntreprise || '').split('\n');
  const adresseExp = (() => {
    if (letterConfig.adresseExpediteur && letterConfig.adresseExpediteur.trim()) return letterConfig.adresseExpediteur.split('\n');
    const lines = [];
    if (project?.clientAddress) lines.push(project.clientAddress);
    const zipCity = [project?.clientZip, project?.clientCity].filter(Boolean).join(' ');
    if (zipCity) lines.push(zipCity);
    return lines;
  })();

  // ── Corps (Monsieur → signature, + tableaux de prix) extrait de l'aperçu ──
  const bodyHtml = stripStructuralFromHtml(letterHtml || '');
  const bodyElements = bodyToDocx(bodyHtml, { font });

  // ── En-tête de page : logo en haut à gauche (client prioritaire, sinon MOE) ──
  const logoPara = (await buildLogoParagraph(project?.clientLogo)) || (await buildLogoParagraph(b.logo));
  const headerChildren = [logoPara || new Paragraph({ children: [new TextRun({ text: '' })] })];

  // ── Pied de page : client | page X/Y | mention ──
  const footer = new Footer({ children: [new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' } },
    tabStops: [
      { type: 'center', position: Math.round(CONTENT_TW / 2) },
      { type: 'right', position: CONTENT_TW },
    ],
    children: [
      new TextRun({ text: sanitize(client), font, size: 14, color: '888888' }),
      new TextRun({ text: '\tPage ', font, size: 14, color: '888888' }),
      new TextRun({ children: [PageNumber.CURRENT], font, size: 14, color: '888888' }),
      new TextRun({ text: ' / ', font, size: 14, color: '888888' }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: 14, color: '888888' }),
      new TextRun({ text: '\tDocument confidentiel', font, size: 14, color: '888888' }),
    ],
  })] });

  // ── Assemblage des éléments ──
  const children = [
    // 1. Date à droite
    new Paragraph({
      alignment: AlignmentType.RIGHT, spacing: { after: 200 },
      children: [new TextRun({ text: sanitize(`${city}, le ${today}`), font, size: 22 })],
    }),
    // 2. Destinataire / Expéditeur
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [Math.round(CONTENT_TW * 0.55), Math.round(CONTENT_TW * 0.45)],
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
      },
      rows: [new TableRow({ children: [
        partyCell(font, 55, 'DESTINATAIRE :', companyName, adresseEnt),
        partyCell(font, 45, 'EXPÉDITEUR :', client, adresseExp),
      ] })],
    }),
    // 3. Objet
    new Paragraph({ spacing: { before: 240, after: 0 }, children: [
      new TextRun({ text: 'OBJET :  ', font, size: 22, bold: true, color: primary }),
      new TextRun({ text: sanitize(objet), font, size: 22, bold: true, color: primary }),
    ] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Négociation avec les candidats', font, size: 22, bold: true })] }),
    // 4. Corps + tableaux de prix
    ...bodyElements,
  ];

  appendEstimaWordCredit(children);

  const doc = new Document({
    numbering: { config: [{ reference: 'nego-ol', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }] }] },
    styles: { default: { document: { run: { font, size: 22, color: '282828' } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: new Header({ children: headerChildren }) },
      footers: { default: footer },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Courrier_Negociation_${sanitizeFilename(companyName)}.docx`);
};
