// src/utils/pdf/pdfNegoLetterGenerator.js
// Génère le courrier de négociation PDF.
// Structure fixe (date, dest/exp, objet, footer) + paragraphes du corps
// extraits du TEMPLATE HTML (modifiable par l'utilisateur).
// Les variables sont injectées et {{QUESTIONS}} déclenche le rendu des tableaux de prix.

import { sanitizeFilename, loadLogos, renderLogo } from './pdfSharedHelpers';
import { buildTheme } from './buildTheme';
import { stampPdfCredit } from '../estimaCredit';

const FONT = 'helvetica';
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 18;
const MR = 18;
const CONTENT_W = PAGE_W - ML - MR;

export async function generateNegoLetterPDF({
  companyName,
  questions,
  letterConfig,
  consultation,
  branding = null,
  project = null,
  masterTemplate,
  // eslint-disable-next-line no-unused-vars
  analysisCompanies = [],
  chaptersData = [],
  bpuRefMap = null,
  returnFile = false,
}) {
  // Construire un map { ref → unit } à partir des chapitres pour lookup ultérieur
  const unitByRef = new Map();
  if (Array.isArray(chaptersData)) {
    for (const chapter of chaptersData) {
      for (const item of (chapter.items || [])) {
        const refLabel = (bpuRefMap?.get?.(item.id)) || item.bpuNum || item.ref;
        if (refLabel && item.unit) {
          unitByRef.set(String(refLabel).trim(), item.unit);
        }
      }
    }
  }
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // ─── Branding + logos ──────────────────────────────────────────────
  const THEME = buildTheme(branding);
  const PRIMARY = THEME.primary;
  const PALE    = PRIMARY.map(c => Math.min(255, Math.round(c + (255 - c) * 0.85)));
  const DARK    = PRIMARY.map(c => Math.round(c * 0.7));
  const { logoMoe, logoClient } = await loadLogos(branding, project);
  const headerLogo = logoClient || logoMoe;

  // ─── Variables à injecter ──────────────────────────────────────────
  // Adresse + ville expéditeur : priorité fiche affaire (project.*), fallback letterConfig
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const city = project?.clientCity || letterConfig.city || consultation?.lieu || '[Ville]';
  const deadline = letterConfig.deadline
    ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '[Date limite]';
  const signatory = letterConfig.signatoryName || '[Nom du signataire]';
  const objet = consultation?.objet || '[Objet du marché]';
  // Nom du client : priorité project.client (fiche affaire), fallback consultation.client
  const client = project?.client || consultation?.client || '[Nom du Client]';
  // Adresse expéditeur reconstruite à partir de la fiche affaire (sinon letterConfig)
  const adresseExp = (() => {
    if (letterConfig.adresseExpediteur && letterConfig.adresseExpediteur.trim()) {
      return letterConfig.adresseExpediteur;
    }
    const lines = [];
    if (project?.clientAddress) lines.push(project.clientAddress);
    const zipCity = [project?.clientZip, project?.clientCity].filter(Boolean).join(' ');
    if (zipCity) lines.push(zipCity);
    return lines.join('\n');
  })();
  const adresseEnt = letterConfig.adresseEntreprise || '';
  const variables = {
    VILLE: city,
    DATE_EMISSION: today,
    NOM_ENTREPRISE: companyName,
    OBJET_MARCHE: objet,
    LOT: consultation?.lot || '[Lot]',
    CLIENT: client,
    MOE: consultation?.moe || '[Maître d\'Œuvre]',
    CODE_AFFAIRE: consultation?.code || '[Code Affaire]',
    LIEU: consultation?.lieu || '[Lieu]',
    PHASE: consultation?.phase || '[Phase]',
    DATE_LIMITE: deadline,
    SIGNATAIRE: signatory,
    ADRESSE_ENTREPRISE: adresseEnt,
    ADRESSE_EXPEDITEUR: adresseExp,
  };

  // ─── Helpers ──────────────────────────────────────────────────────
  const clean = (text) => String(text == null ? '' : text)
    .replace(/[  \u200B]/g, ' ')
    .replace(/ /g, ' ')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');

  const setFont = (style = 'normal', size = 10) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  let y = 0;
  const BOTTOM_Y = PAGE_H - 22;

  const drawHeader = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, 6, PAGE_H, 'F');
    if (headerLogo) renderLogo(doc, headerLogo, ML, 10, 32, 18);
  };

  const drawFooter = (pageNum, totalPages) => {
    doc.setDrawColor(...PALE);
    doc.setLineWidth(0.4);
    doc.line(ML, PAGE_H - 16, PAGE_W - MR, PAGE_H - 16);
    setFont('normal', 7);
    doc.setTextColor(140, 140, 140);
    doc.text(clean(client || 'Maître d\'œuvre'), ML, PAGE_H - 11);
    doc.text('Document confidentiel — usage strictement professionnel', PAGE_W / 2, PAGE_H - 11, { align: 'center' });
    doc.text(`Page ${pageNum} / ${totalPages}`, PAGE_W - MR, PAGE_H - 11, { align: 'right' });
  };

  const checkPage = (needed = 8) => {
    if (y + needed > BOTTOM_Y) {
      doc.addPage();
      drawHeader();
      // ► Padding intérieur (4mm) pour que le texte ne touche pas la bordure du cadre
      y = 32 + 4;
    }
  };

  // Texte justifié simple
  const writeJustified = (text, x, maxW, fontSize = 10, style = 'normal', color = [40, 40, 50]) => {
    const t = clean(text);
    if (!t.trim()) return;
    setFont(style, fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(t, maxW);
    const lineH = fontSize * 0.5;
    if (y + lines.length * lineH <= BOTTOM_Y) {
      doc.text(t, x, y, { align: 'justify', maxWidth: maxW });
      y += lines.length * lineH;
    } else {
      for (const line of lines) {
        checkPage(lineH + 1);
        doc.text(line, x, y);
        y += lineH;
      }
    }
  };

  // Rend un paragraphe HTML : détecte gras, surlignage jaune, align, texte
  const renderHtmlParagraph = (pEl, opts = {}) => {
    const xLeft = opts.x != null ? opts.x : ML;
    const maxW = opts.maxW != null ? opts.maxW : CONTENT_W;
    const baseFontSize = opts.fontSize || 10;
    const styleAttr = pEl.getAttribute('style') || '';
    const align = (() => {
      const m = styleAttr.match(/text-align\s*:\s*(\w+)/);
      return m ? m[1] : 'justify';
    })();
    const paddingLeftMm = (() => {
      const m = styleAttr.match(/padding-left\s*:\s*(\d+)(%|px|pt)/);
      if (!m) return 0;
      const v = parseInt(m[1]);
      if (m[2] === '%') return (v / 100) * maxW;
      if (m[2] === 'pt') return v * 0.353;
      return v * 0.265; // px → mm approximation
    })();

    // Détecte si le paragraphe contient un surlignage jaune
    const hasYellow = /background[^;"]*(?:#FF0|#FFFF00|yellow)/i.test(pEl.innerHTML);

    // Extraction des runs (text + bold + highlight)
    const runs = [];
    const walk = (node, ctx) => {
      if (node.nodeType === 3) { // text node
        if (node.textContent) runs.push({ text: node.textContent, ...ctx });
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      const newCtx = { ...ctx };
      if (tag === 'strong' || tag === 'b') newCtx.bold = true;
      if (tag === 'em' || tag === 'i') newCtx.italic = true;
      const ns = node.getAttribute && node.getAttribute('style') || '';
      if (/background[^;"]*(?:#FF0|#FFFF00|yellow)/i.test(ns)) newCtx.highlight = true;
      if (tag === 'br') { runs.push({ text: '\n', ...newCtx }); return; }
      for (const ch of node.childNodes) walk(ch, newCtx);
    };
    walk(pEl, {});

    const fullText = clean(runs.map(r => r.text).join(''));
    if (!fullText.trim()) {
      y += baseFontSize * 0.5;
      return;
    }

    setFont('normal', baseFontSize);
    const indent = paddingLeftMm;
    const effMaxW = maxW - indent;
    const lines = doc.splitTextToSize(fullText, effMaxW);
    const lineH = baseFontSize * 0.5;

    // Si pas de surlignage et pas de gras → rendu simple via justify
    if (!hasYellow && !runs.some(r => r.bold || r.italic)) {
      checkPage(lines.length * lineH + 1);
      if (align === 'right') {
        for (const line of lines) {
          checkPage(lineH);
          doc.setTextColor(40, 40, 50);
          doc.text(line, xLeft + indent + effMaxW, y, { align: 'right' });
          y += lineH;
        }
      } else if (align === 'center') {
        for (const line of lines) {
          checkPage(lineH);
          doc.setTextColor(40, 40, 50);
          doc.text(line, xLeft + indent + effMaxW / 2, y, { align: 'center' });
          y += lineH;
        }
      } else {
        doc.setTextColor(40, 40, 50);
        doc.text(fullText, xLeft + indent, y, { align: align === 'justify' ? 'justify' : 'left', maxWidth: effMaxW });
        y += lines.length * lineH;
      }
      return;
    }

    // Rendu ligne par ligne avec runs (gras + surlignage)
    let charIdx = 0;
    // Calcul positions globales des runs
    const runStarts = [];
    let acc = 0;
    for (const r of runs) {
      runStarts.push(acc);
      acc += r.text.length;
    }

    for (let li = 0; li < lines.length; li++) {
      checkPage(lineH + 1);
      const line = lines[li];
      let cx = xLeft + indent;
      if (align === 'right') {
        cx = xLeft + indent + effMaxW - doc.getTextWidth(line);
      } else if (align === 'center') {
        cx = xLeft + indent + (effMaxW - doc.getTextWidth(line)) / 2;
      }

      const lineEnd = charIdx + line.length;
      let consumed = 0;
      for (let ri = 0; ri < runs.length; ri++) {
        const r = runs[ri];
        const rStart = runStarts[ri];
        const rEnd = rStart + r.text.length;
        if (rEnd <= charIdx) continue;
        if (rStart >= lineEnd) break;
        const segStart = Math.max(rStart, charIdx + consumed);
        const segEnd = Math.min(rEnd, lineEnd);
        if (segEnd <= segStart) continue;
        const segText = r.text.substring(segStart - rStart, segEnd - rStart);
        if (!segText) continue;

        const fs = r.bold ? 'bold' : (r.italic ? 'italic' : 'normal');
        setFont(fs, baseFontSize);
        doc.setTextColor(40, 40, 50);

        if (r.highlight) {
          const segW = doc.getTextWidth(segText);
          doc.setFillColor(255, 235, 0);
          doc.rect(cx - 0.3, y - baseFontSize * 0.32, segW + 0.6, baseFontSize * 0.45, 'F');
        }
        doc.text(clean(segText), cx, y);
        cx += doc.getTextWidth(segText);
        consumed += segEnd - segStart;
      }
      charIdx += line.length;
      if (charIdx < fullText.length && fullText[charIdx] === ' ') charIdx++;
      y += lineH;
    }
  };

  // Rendu bloc questions (intros + tableaux prix)
  const renderQuestionsBlock = (xLeft, maxW) => {
    if (!questions || !questions.trim()) return;

    const blocks = parseQuestionsBlocks(questions, unitByRef);
    for (const block of blocks) {
      if (block.intro && block.intro.trim()) {
        const paragraphs = block.intro.split(/\n/);
        for (const para of paragraphs) {
          const p = clean(para);
          if (!p.trim()) { y += 2.5; continue; }
          if (/^-\s+/.test(p)) {
            const txt = p.replace(/^-\s+/, '');
            const lines = doc.splitTextToSize(txt, maxW - 6);
            checkPage(lines.length * 4.5 + 2);
            setFont('normal', 10);
            doc.setTextColor(40, 40, 50);
            for (let i = 0; i < lines.length; i++) {
              if (i === 0) doc.text('-', xLeft + 1, y);
              doc.text(lines[i], xLeft + 6, y);
              y += 4.5;
            }
          } else {
            writeJustified(p, xLeft, maxW);
          }
        }
        y += 2;
      }
      if (block.items.length > 0) {
        // Couleur d'en-tête déduite du titre du bloc :
        //  - "PRIX ATYPIQUES" (bloc unifié) → slate neutre
        //  - "anormalement bas" / L.2152-6 / rejet → rouge
        //  - sinon (prix excessifs) → amber
        const intro = block.intro || '';
        const isUnified = /prix\s+atypiques|atypique/i.test(intro);
        const isLow = !isUnified && /anormalement\s+bas|l\.?2152[-‐]6|rejet/i.test(intro);
        const headColor = isUnified ? [71, 85, 105] : isLow ? [220, 38, 38] : [217, 119, 6];
        checkPage(20);
        // Détecter si on a au moins une unité → afficher la colonne Unité
        const hasAnyUnit = block.items.some(it => (it.unit || '').trim());
        const head = hasAnyUnit
          ? [['Réf.', 'Désignation', 'Unité', 'PU proposé (HT)']]
          : [['Réf.', 'Désignation', 'PU proposé (HT)']];
        const body = block.items.map(it => {
          const baseRow = [
            it.ref || '—',
            clean(it.label || ''),
          ];
          if (hasAnyUnit) baseRow.push(it.unit || '—');
          baseRow.push(it.pu ? `${it.pu} €` : '—');
          return baseRow;
        });
        const columnStyles = hasAnyUnit
          ? {
              0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
              1: { cellWidth: maxW - 18 - 16 - 30 },
              2: { cellWidth: 16, halign: 'center' },
              3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
            }
          : {
              0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
              1: { cellWidth: maxW - 18 - 32 },
              2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
            };
        autoTable(doc, {
          startY: y,
          head,
          body,
          theme: 'grid',
          styles: { font: FONT, fontSize: 8.5, cellPadding: 2, textColor: [40, 40, 50] },
          headStyles: { fillColor: headColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles,
          alternateRowStyles: { fillColor: [250, 250, 252] },
          // ► Marges adaptées au cadre du courrier
          // bottom = 22 (footer) + 4 (padding) = 26mm pour rester DANS le cadre
          // top sur pages suite : header + cadre top + padding = 36mm
          margin: {
            left: xLeft,
            right: PAGE_W - (xLeft + maxW),
            top: 36,
            bottom: 26,
          },
        });
        // Saut de ligne explicite après chaque tableau (lisibilité)
        y = doc.lastAutoTable.finalY + 8;
      }
    }
  };

  // ─── DEBUT du rendu ────────────────────────────────────────────────
  drawHeader();
  y = 32;

  // 1. Date à droite
  setFont('normal', 10);
  doc.setTextColor(60, 60, 60);
  doc.text(clean(`${city}, le ${today}`), PAGE_W - MR, y, { align: 'right' });
  y += 8;

  // 2. Tableau Destinataire / Expéditeur (structure fixe)
  const tableTop = y;
  const col1W = CONTENT_W * 0.55;
  const colGap = 3;
  const col2W = CONTENT_W - col1W - colGap;
  const col1X = ML;
  const col2X = ML + col1W + colGap;
  const headerH = 6;
  const cellPad = 3;
  const lineH = 4.2;
  const destLines = [companyName, ...adresseEnt.split('\n').filter(Boolean)];
  const expLines = [client, ...adresseExp.split('\n').filter(Boolean)];
  const maxLines = Math.max(destLines.length, expLines.length, 3);
  const cellH = cellPad * 2 + maxLines * lineH;

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  // Col 1
  doc.rect(col1X, tableTop, col1W, headerH);
  setFont('bold', 9);
  doc.setTextColor(40, 40, 50);
  doc.text('DESTINATAIRE :', col1X + col1W / 2, tableTop + 4, { align: 'center' });
  doc.rect(col1X, tableTop + headerH, col1W, cellH);
  let cy = tableTop + headerH + cellPad + 3;
  setFont('bold', 10);
  doc.setTextColor(20, 20, 30);
  doc.text(clean(companyName), col1X + cellPad, cy);
  cy += lineH;
  setFont('normal', 9);
  doc.setTextColor(60, 60, 70);
  for (const ln of adresseEnt.split('\n').filter(Boolean)) {
    doc.text(clean(ln), col1X + cellPad, cy);
    cy += lineH;
  }
  // Col 2
  doc.rect(col2X, tableTop, col2W, headerH);
  setFont('bold', 9);
  doc.setTextColor(40, 40, 50);
  doc.text('EXPÉDITEUR :', col2X + col2W / 2, tableTop + 4, { align: 'center' });
  doc.rect(col2X, tableTop + headerH, col2W, cellH);
  cy = tableTop + headerH + cellPad + 3;
  setFont('bold', 10);
  doc.setTextColor(20, 20, 30);
  doc.text(clean(client), col2X + cellPad, cy);
  cy += lineH;
  setFont('normal', 9);
  doc.setTextColor(60, 60, 70);
  for (const ln of adresseExp.split('\n').filter(Boolean)) {
    doc.text(clean(ln), col2X + cellPad, cy);
    cy += lineH;
  }
  y = tableTop + headerH + cellH + 8;

  // 3. OBJET
  checkPage(10);
  setFont('bold', 10);
  doc.setTextColor(...DARK);
  doc.text(clean(`OBJET :  ${objet}`), ML, y);
  y += 5;
  doc.setTextColor(40, 40, 50);
  doc.text('Négociation avec les candidats', ML, y);
  y += 8;

  // 4. Corps de la lettre — extrait des paragraphes du TEMPLATE
  const bodyStartY = y;
  const bodyML = ML + 3;
  const bodyW = CONTENT_W - 6;
  y += 4;

  // Préparer le template : injecter variables + remplacer {{QUESTIONS}} par un marker
  const templateRaw = (masterTemplate || '').trim() || FALLBACK_TEMPLATE_BODY;
  let injected = templateRaw;
  for (const [key, val] of Object.entries(variables)) {
    const safeVal = (val == null ? '' : String(val)).replace(/\n/g, '<br/>');
    injected = injected.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), safeVal);
  }
  // Marker {{QUESTIONS}} → div avec data-pdf-questions
  injected = injected.replace(/\{\{\s*QUESTIONS\s*\}\}/g, '<div data-pdf-questions="1"></div>');

  // Parser le template puis filtrer les paragraphes :
  // on rend uniquement les paragraphes du CORPS de la lettre,
  // en SKIPPANT ceux déjà rendus en hardcodé (date, dest/exp, objet, footer).
  // Cette approche fonctionne quelle que soit la structure (flat ou nested).
  let dom = null;
  try {
    dom = new DOMParser().parseFromString(injected, 'text/html');
  } catch (err) {
    console.error('[NegoPDF] Erreur parsing template :', err);
  }

  // Patterns de paragraphes à EXCLURE (déjà rendus en hardcodé)
  // - Patterns statiques (titres de sections)
  // - Patterns dynamiques (valeurs des cards dest/exp aplaties par ReactQuill)
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const SKIP_PATTERNS = [
    /^DESTINATAIRE\s*:?\s*$/i,
    /^EXP[ÉE]DITEUR\s*:?\s*$/i,
    /^OBJET\s*:/i,
    /^N[ée]gociation\s+avec\s+les\s+candidats/i,
    /NOMBRE\s+DE\s+PAGES/i,
    // Date : "PEYROLE, le 20 mai 2026"
    /^[A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\-' ]+,\s*le\s+\d/,
    // Valeurs dynamiques des cartes Destinataire/Expéditeur — déjà rendues en hardcodé
    new RegExp(`^${escapeRegex(companyName || '')}\\s*$`, 'i'),
    new RegExp(`^${escapeRegex(client || '')}\\s*$`, 'i'),
  ];
  // Adresses (multi-lignes) éventuellement aplaties en paragraphes séparés
  const addressLines = [
    ...adresseEnt.split('\n').filter(l => l.trim()),
    ...adresseExp.split('\n').filter(l => l.trim()),
  ];
  for (const ln of addressLines) {
    SKIP_PATTERNS.push(new RegExp(`^${escapeRegex(ln.trim())}\\s*$`, 'i'));
  }
  const shouldSkipText = (txt) => {
    const t = (txt || '').trim();
    if (!t) return true;
    // 1. Match direct sur une ligne entière
    if (SKIP_PATTERNS.some(p => p.test(t))) return true;
    // 2. Match par lignes (cas card dest/exp aplatie : "MAIRIE DE PEYROLE\nAdresse\nCP VILLE")
    const lines = t.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every(line => SKIP_PATTERNS.some(p => p.test(line)))) return true;
    // 3. Texte contient companyName ou client comme mot complet → carte dest/exp probable
    if (companyName && new RegExp(`\\b${escapeRegex(companyName)}\\b`).test(t)) return true;
    if (client && new RegExp(`\\b${escapeRegex(client)}\\b`).test(t)) return true;
    return false;
  };

  // Helper : extrait le texte d'un élément en convertissant les <br/> en \n
  // (textContent ignore les <br/> et colle les lignes — ex : "Saint-Maurice<br/>81310 PEYROLE"
  // devient "Saint-Maurice81310 PEYROLE" ce qui casse les patterns de skip d'adresse).
  const getElementText = (el) => {
    if (!el) return '';
    const html = el.innerHTML || '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  if (dom) {
    // Récupère tous les <p> et markers questions en document order
    const elements = Array.from(dom.querySelectorAll('p, [data-pdf-questions="1"]'));
    for (const el of elements) {
      // Ignore les <p> à l'intérieur de divs flex (dest/exp cards) — leurs
      // contenus sont rendus en hardcodé
      let inFlex = false;
      let cur = el.parentElement;
      while (cur && cur !== dom.body) {
        const st = cur.getAttribute('style') || '';
        if (/display\s*:\s*flex/i.test(st)) { inFlex = true; break; }
        cur = cur.parentElement;
      }
      if (inFlex) continue;

      if (el.getAttribute('data-pdf-questions') === '1') {
        renderQuestionsBlock(bodyML, bodyW);
        continue;
      }
      // Skip si match un pattern hardcodé (utilise getElementText pour respecter <br/>)
      const text = getElementText(el);
      if (shouldSkipText(text)) continue;

      renderHtmlParagraph(el, { x: bodyML, maxW: bodyW });
    }
  } else {
    // Pas de DOM parsable → rendu minimal questions
    renderQuestionsBlock(bodyML, bodyW);
  }

  y += 4;

  // Cadre du body sur toutes les pages — start à 30mm sur pages suite (3mm avant y=33)
  // pour que le texte (qui démarre à y=36 avec padding 4mm) soit bien à l'intérieur.
  const totalPages = doc.internal.getNumberOfPages();
  const cadreTopFollow = 30; // mm (avant le y de départ contenu 32+4)
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(180, 180, 190);
    doc.setLineWidth(0.3);
    if (p === 1 && totalPages === 1) {
      doc.rect(ML, bodyStartY, CONTENT_W, y - bodyStartY);
    } else if (p === 1) {
      doc.rect(ML, bodyStartY, CONTENT_W, PAGE_H - 22 - bodyStartY);
    } else if (p === totalPages) {
      doc.rect(ML, cadreTopFollow, CONTENT_W, y - cadreTopFollow + 2);
    } else {
      doc.rect(ML, cadreTopFollow, CONTENT_W, PAGE_H - 22 - cadreTopFollow);
    }
  }
  doc.setPage(totalPages);

  // Footer sur toutes les pages
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }
  doc.setPage(totalPages);

  stampPdfCredit(doc);
  const safeName = sanitizeFilename(companyName);
  const filename = `Courrier_Negociation_${safeName}.pdf`;
  if (returnFile) {
    return { blob: doc.output('blob'), filename };
  }
  doc.save(filename);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseQuestionsBlocks(text, unitByRef = null) {
  const blocks = [];
  let introBuf = [];
  let itemsBuf = [];
  let inItems = false;
  const flushBlock = () => {
    const intro = introBuf.join('\n').replace(/^\n+|\n+$/g, '');
    if (intro || itemsBuf.length > 0) blocks.push({ intro, items: [...itemsBuf] });
    introBuf = [];
    itemsBuf = [];
    inItems = false;
  };
  const parseItemLine = (line) => {
    // Format : "- Prix n°XXX — Désignation : PU proposé de YY € HT[/UNIT].")
    const m = line.match(/^-?\s*Prix\s*n[°o]?\s*([^\s—-]+)\s*[—-]\s*(.+?)\s*:\s*PU\s*(?:proposé\s+)?de\s*([\d\s.,]+)\s*€\s*HT(?:\s*\/\s*([^\s.]+))?\s*\.?\s*$/i);
    if (m) {
      const pu = m[3].replace(/\s/g, '').trim();
      const ref = m[1].trim();
      // Unité prioritairement extraite du texte, sinon lookup par référence dans chaptersData
      let unit = m[4] ? m[4].trim() : '';
      if (!unit && unitByRef) {
        unit = unitByRef.get(ref) || '';
      }
      return { ref, label: m[2].trim(), pu, unit };
    }
    return null;
  };
  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim();
    if (/^Articles\s+concernés\s*:?$/i.test(trimmed)) { inItems = true; continue; }
    if (!trimmed) { if (inItems) flushBlock(); else introBuf.push(''); continue; }
    const item = parseItemLine(trimmed);
    if (item) { itemsBuf.push(item); inItems = true; continue; }
    if (inItems) flushBlock();
    introBuf.push(rawLine);
  }
  flushBlock();
  return blocks;
}

// Fallback en cas d'absence de masterTemplate : on génère un body minimal
const FALLBACK_TEMPLATE_BODY = `
<div style="border:1px solid #000;">
<p>Monsieur,</p>
<p>Dans le cadre de la consultation relative au marché de travaux {{OBJET_MARCHE}} à {{LIEU}}, votre entreprise a présenté une offre, laquelle a fait l'objet d'une analyse conformément aux critères et modalités définis au règlement de consultation.</p>
<p>Afin de permettre au pouvoir adjudicateur de vérifier la cohérence économique de votre offre au regard des prestations prévues au marché, et sans préjuger de la conformité ni du caractère de votre proposition, nous vous remercions de bien vouloir nous confirmer les prix des prestations suivantes :</p>
{{QUESTIONS}}
<p>Par ailleurs, conformément aux règles applicables aux marchés passés selon une procédure adaptée, le pouvoir adjudicateur a décidé d'engager une phase de négociation portant sur les aspects financiers de votre offre.</p>
<p>Dans ce cadre, nous vous invitons à bien vouloir réexaminer le montant de votre proposition financière et à nous faire parvenir, le cas échéant, une offre financière révisée, intégrant une remise sur le prix initialement proposé, tout en maintenant le niveau de prestations et les dispositions techniques décrites dans votre mémoire technique.</p>
<p>Cette phase de négociation a pour objet de permettre l'optimisation de l'économie générale du marché, sans modification des caractéristiques essentielles du lot ni des exigences du dossier de consultation.</p>
<p>Les éléments demandés devront être transmis sur la plateforme au plus tard le <strong><span style="background:#FF0;">{{DATE_LIMITE}}</span></strong>, et seront intégrés à l'analyse des offres avant toute décision d'attribution.</p>
<p>Nous vous prions d'agréer, Monsieur, l'expression de nos salutations distinguées.</p>
<p style="padding-left:55%;">{{SIGNATAIRE}}</p>
</div>
`;
