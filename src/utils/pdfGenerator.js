// src/utils/pdfGenerator.js
// Génère le PDF Estimation / DQE.
// Cover page, signatures, footer MOE : fonctions partagées (pdfSharedHelpers).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getItemRefMap, normalizeUnitSymbol } from './helpers';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from './fileSaver';
import { stampPdfCredit } from './estimaCredit';
import { sanitizeFilename, loadLogos, drawCoverPage as _drawCoverPage } from './pdf/pdfSharedHelpers';
import { buildTheme } from './pdf/buildTheme';
import { computePseDeltas, buildPseNumbers, collectPseRoots, collectSubstitutions, buildChapterNumberMap } from './projectCalculations';
import { getCurrentPhaseCode } from './phaseModel';
import { computeVatBreakdown } from './financeFormat';
import { htmlToPlainText, htmlToRichBlocks } from './richText';

const cleanFormat = (num) => {
  if (num === undefined || num === null || num === '' || isNaN(num)) return "0,00";
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num).replace(/\s/g, ' ');
};

// ─── RENDU FIDÈLE D'UN TEXTE RICHE (gras / souligné / puces) ──────────────────
// Mise en page mot à mot avec retour à la ligne, à partir des blocs de
// htmlToRichBlocks. Retourne un tableau de lignes prêtes à dessiner.
const layoutRichBlocks = (doc, blocks, { maxWidth, fontSize, font = 'Helvetica' }) => {
  const lines = [];
  blocks.forEach((block) => {
    const isLi = block.type === 'li';
    const indent = isLi ? 3 : 0;
    const bulletW = isLi ? doc.getTextWidth('• ') : 0;
    const lineStartX = indent + bulletW;
    let line = { items: [], bullet: isLi, indent };
    let curX = lineStartX;
    const wrap = () => { lines.push(line); line = { items: [], bullet: false, indent }; curX = lineStartX; };
    block.runs.forEach((run) => {
      doc.setFont(font, run.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const words = run.text.split(/(\s+)/).filter((w) => w !== '');
      words.forEach((word) => {
        const isSpace = /^\s+$/.test(word);
        const w = doc.getTextWidth(word);
        if (curX + w > maxWidth && curX > lineStartX) { wrap(); if (isSpace) return; }
        if (isSpace && curX === lineStartX) return;
        line.items.push({ text: word, bold: run.bold, underline: run.underline, x: curX, w });
        curX += w;
      });
    });
    lines.push(line); // fin de bloc
  });
  return lines;
};

const drawRichLines = (doc, lines, { x, startY, lineHeight, fontSize, font = 'Helvetica', color }) => {
  let y = startY;
  lines.forEach((line) => {
    if (line.bullet) {
      doc.setFont(font, 'normal'); doc.setFontSize(fontSize); doc.setTextColor(...color);
      doc.text('•', x + line.indent, y);
    }
    line.items.forEach((it) => {
      doc.setFont(font, it.bold ? 'bold' : 'normal'); doc.setFontSize(fontSize); doc.setTextColor(...color);
      doc.text(it.text, x + it.x, y);
      if (it.underline) {
        doc.setDrawColor(...color); doc.setLineWidth(0.2);
        doc.line(x + it.x, y + 0.6, x + it.x + it.w, y + 0.6);
      }
    });
    y += lineHeight;
  });
  return y;
};

// Encadré « DESCRIPTION » de la page PSE : rendu fidèle + texte centré en hauteur.
// Lève une erreur si le bloc ne tient pas sur la page (repli texte simple paginé).
const drawPseDescriptionBox = (doc, blocks, THEME, startY) => {
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const marginX = 10, pad = 3, fontSize = 8, lineHeight = 4.2, labelH = 4.5;

  const innerX = marginX + pad;
  const maxWidth = pageW - 2 * marginX - 2 * pad;
  const lines = layoutRichBlocks(doc, blocks, { maxWidth, fontSize });
  const textH = Math.max(lines.length * lineHeight, lineHeight);
  const innerH = Math.max(textH, 10);                 // hauteur mini pour l'effet de centrage
  const boxH = pad + labelH + innerH + pad;

  if (startY + boxH > pageH - 16) throw new Error('PSE description trop haute pour la page');

  doc.setFillColor(...THEME.pseBg);
  doc.rect(marginX, startY, pageW - 2 * marginX, boxH, 'F');

  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...THEME.pse);
  doc.text('DESCRIPTION', innerX, startY + pad + 2.8);

  const textAreaTop = startY + pad + labelH;
  const firstBaseline = textAreaTop + (innerH - textH) / 2 + lineHeight * 0.72; // centrage vertical
  drawRichLines(doc, lines, { x: innerX, startY: firstBaseline, lineHeight, fontSize, color: THEME.text });

  return startY + boxH + 3;
};

// ─── COLLECTE DES DONNÉES ─────────────────────────────────────────────────────

const collectData = (nodes, isParentOption, level, mode, projectRefMap, currentQtyMap, bpuConfig, includePM = true, chapterNumMap = null) => {
  let rows = [];
  let total = 0;
  nodes.forEach(node => {
    const isEffectiveOption = isParentOption || !!node.isOption;
    if (mode === 'base' && isEffectiveOption) return;
    if (mode === 'option' && !isEffectiveOption && node.type === 'item') return;

    if (node.type === 'item') {
      const mapKey = String(node.id);
      const rawQty = currentQtyMap?.has(mapKey) ? Number(currentQtyMap.get(mapKey)) : (Number(node.qty) || 0);
      const qtyClient = Math.round(rawQty * 100) / 100;
      const price = Number(node.price || 0);
      const lineTotal = Math.round(qtyClient * price * 100) / 100;
      if (!includePM && qtyClient === 0) return;
      const key = (node.designation || '').trim().toUpperCase();
      let reference = "";
      if (bpuConfig?.numberingMode === 'manual' && node.bpuNum) {
        reference = String(node.bpuNum).trim();
      } else {
        reference = projectRefMap.get(key) || '';
      }
      rows.push({ 
        type: 'ITEM', 
        ref: reference, 
        designation: (node.designation || '').toUpperCase(), 
        unit: node.unit, 
        qty: qtyClient, 
        price, 
        total: lineTotal 
      });
      total += lineTotal;
    } else if (node.children) {
      const childData = collectData(node.children, isEffectiveOption, level + 1, mode, projectRefMap, currentQtyMap, bpuConfig, includePM, chapterNumMap);
      if (childData.rows.length > 0) {
        const titleStr = node.title ? node.title.toUpperCase() : (node.designation || '').toUpperCase();
        // Numéro de (sous-)chapitre identique à l'écran (base uniquement ; PSE garde « PSE n°X »).
        const chapNum = mode === 'base' && chapterNumMap ? chapterNumMap.get(node.id) : null;
        const numberedTitle = chapNum ? `${chapNum}. ${titleStr}` : titleStr;
        const displayTitle = level > 0 ? `  ${numberedTitle}` : numberedTitle;
        rows.push({ type: 'HEADER', designation: displayTitle, level });
        // Commentaire de chapitre : ligne italique sous le titre (DQE + pages PSE).
        if (node.comment) rows.push({ type: 'COMMENT', designation: node.comment, level });
        rows = rows.concat(childData.rows);
        rows.push({ type: 'SUBTOTAL', designation: `SOUS-TOTAL ${numberedTitle.trim()}`, total: childData.total, level });
        total += childData.total;
      }
    }
  });
  return { rows, total };
};

// ─── PSE SUBSTITUTION ──────────────────────────────────────────────────────────
// Quantité d'un article telle qu'utilisée par collectData (map du tranche/export,
// repli sur node.qty) — sert à computePseDeltas pour aligner le PDF sur l'écran.
const qtyFromMap = (currentQtyMap) => (item) => {
  const k = String(item?.id);
  return currentQtyMap?.has(k) ? Number(currentQtyMap.get(k)) : Number(item?.qty || 0);
};

// Index id → nœud (pour retrouver le libellé de la prestation de base).
const buildNodeIndex = (chapters) => {
  const map = new Map();
  const walk = (nodes) => {
    (nodes || []).forEach((n) => { if (n) { map.set(n.id, n); if (n.children) walk(n.children); } });
  };
  walk(chapters);
  return map;
};

// Réf + libellé lisibles d'une prestation de base (article ou sous-chapitre).
const baseLabelOf = (baseId, nodeIndex, projectRefMap) => {
  const node = nodeIndex.get(baseId);
  if (!node) return { ref: '', label: '' };
  if (node.type === 'item') {
    const ref = projectRefMap.get((node.designation || '').trim().toUpperCase()) || '';
    return { ref, label: node.designation || '' };
  }
  return { ref: '', label: node.title || '' };
};

// ─── PAGE DE GARDE ────────────────────────────────────────────────────────────
// Utilise drawCoverPage partagé depuis pdfSharedHelpers.js

const drawCoverPage = (doc, project, logoMoe, logoClient, type, today, branding = null, logoCoTraitants = []) => {
  const THEME = buildTheme(branding);
  const docType = type === 'DQE' ? 'DÉTAIL QUANTITATIF ET ESTIMATIF' : 'ESTIMATION CONFIDENTIELLE DES TRAVAUX';

  _drawCoverPage(doc, {
    docType,
    title: project?.name,
    subtitle1: (project.subtitle1 || '').trim(),
    subtitle2: (project.subtitle2 || '').trim(),
    phaseLabel: getCurrentPhaseCode(project).toUpperCase(),
    clientName: project.client || 'Non renseigné',
    clientStreet: project.clientAddress ? project.clientAddress.trim() : '',
    clientCityZip: [project.clientZip, project.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: project.location || 'Non renseignée',
    codeAffaire: project.code || 'Non défini',
    showSignatures: project.showSignatures === true,
    signatories: project.signatories || ['', '', '', ''],
    branding,
    today,
  }, THEME, { logoMoe, logoClient, logoCoTraitants });
};

// ─── FONCTION PRINCIPALE ──────────────────────────────────────────────────────

export const generateProfessionalPDF = async (project, clientQtyMaps, type = 'ESTIMATION', bpuConfig = {}, options = {}, branding = null) => {
  const { includeCover = true, selectedExports = ['global'], includeSummary = false, includePM = true, tranches = [] } = options;
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-FR');

  const THEME = buildTheme(branding);

  // Chargement des logos (fonction partagée)
  const { logoMoe, logoClient, logoCoTraitants } = await loadLogos(branding, project);

  const phaseLabel = getCurrentPhaseCode(project).toUpperCase();
  const isDQE = type === 'DQE';

  let currentHeaderTrancheName = "";
  const getTrancheName = (id) => id === 'global' ? 'GLOBAL' : tranches.find(t => t.id === id)?.name || id;

  const sortedExports = [...selectedExports].sort((a, b) => {
    const nameA = String(getTrancheName(a)).toUpperCase();
    const nameB = String(getTrancheName(b)).toUpperCase();
    if (a === 'global' || nameA === 'GLOBAL') return -1;
    if (b === 'global' || nameB === 'GLOBAL') return 1;
    return nameA.localeCompare(nameB, undefined, { numeric: true });
  });

  if (includeCover) {
    // [MODIFIÉ] On passe `branding` en plus
    drawCoverPage(doc, project, logoMoe, logoClient, type, today, branding, logoCoTraitants);
  }

  let projectRefMap = new Map();
  try { if (project?.chapters) projectRefMap = getItemRefMap(project); } catch { /* ignore */ }
  // Numéro de chaque (sous-)chapitre, comme à l'écran — numérote les sous-chapitres des exports.
  const chapterNumMap = buildChapterNumberMap(project?.chapters || [], bpuConfig);

  // Label du total général : on ne précise « (Hors PSE) » que s'il existe des PSE.
  const hasPse = collectPseRoots(project?.chapters || []).length > 0;
  const totalHtLabel = hasPse ? 'TOTAL GÉNÉRAL HT (Hors PSE)' : 'TOTAL GÉNÉRAL HT';

  const drawHeader = () => {
    if (includeCover && doc.internal.getCurrentPageInfo().pageNumber === 1) return;
    const pageWidth = doc.internal.pageSize.width;
    const marginX = 10;
    const moeBlockWidth = 40;
    const moeBlockX = pageWidth - marginX - moeBlockWidth;

    if (logoMoe) {
      const boxH = 18; const ratio = logoMoe.width / logoMoe.height;
      let w = moeBlockWidth; let h = w / ratio;
      if (h > boxH) { h = boxH; w = h * ratio; }
      doc.addImage(logoMoe, 'JPEG', moeBlockX + (moeBlockWidth - w), 12, w, h);
    }
    const centerX = 10 + (moeBlockX - 15) / 2;
    doc.setDrawColor(...THEME.accent); doc.setFillColor(...THEME.chapterBg);
    doc.roundedRect(centerX - 35, 8, 70, 6, 2, 2, 'FD');
    doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont("Helvetica", "bold");
    const headerTitle = isDQE ? "Détail Quantitatif et Estimatif" : "ESTIMATION CONFIDENTIELLE";
    doc.text(headerTitle, centerX, 12, { align: 'center' });
    const titleText = currentHeaderTrancheName
      ? `${(project?.name || "PROJET").toUpperCase()} - ${currentHeaderTrancheName}`
      : (project?.name || "PROJET").toUpperCase();
    doc.setFontSize(12);
    // Largeur max pour rester centré sans déborder sur le bord ni le logo MOE → wrap.
    const maxTitleW = 2 * (moeBlockX - 5 - centerX);
    const titleLines = doc.splitTextToSize(titleText, maxTitleW);
    const titleLineH = 5.5;
    const titleStartY = 25 - ((titleLines.length - 1) * titleLineH) / 2;
    titleLines.forEach((line, i) => {
      doc.text(line, centerX, titleStartY + i * titleLineH, { align: 'center' });
    });
    const bandY = 38; doc.setFillColor(...THEME.secondary); doc.rect(15, bandY, pageWidth - 30, 8, 'F');
    doc.setFontSize(7); doc.text(`PHASE : ${phaseLabel}  -  DATE : ${today}`, centerX, bandY + 5, { align: 'center' });
  };

  const tableConfig = {
    theme: 'grid',
    styles: { font: 'Helvetica', fontSize: 7, overflow: 'linebreak' },
    headStyles: { fillColor: THEME.tableHeader, textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
    bodyStyles: { textColor: THEME.text, lineColor: THEME.borders },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 8, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' }
    },
    didDrawPage: drawHeader,
    margin: { top: 58, bottom: 15, left: 10, right: 10 }
  };

  const safeRender = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/≤/g, '<=').replace(/\u2264/g, '<=')
      .replace(/≥/g, '>=').replace(/\u2265/g, '>=')
      .replace(/</g, ' < ').replace(/>/g, ' > ')
      .replace(/[«»""]/g, '"').trim();
  };

  // ── RÉCAPITULATIF ──
  if (includeSummary && sortedExports.length > 0) {
    if (includeCover) doc.addPage();
    currentHeaderTrancheName = "RÉCAPITULATIF FINANCIER";
    doc.setFontSize(14); doc.setTextColor(...THEME.primary); doc.setFont("Helvetica", "bold");
    doc.text("RÉCAPITULATIF FINANCIER", 10, 52);

    let summaryExports = [...sortedExports];
    if (tranches.length > 0 && !summaryExports.includes('global')) summaryExports.push('global');
    summaryExports.sort((a, b) => {
      const nameA = String(getTrancheName(a)).toUpperCase();
      const nameB = String(getTrancheName(b)).toUpperCase();
      if (a === 'global' || nameA === 'GLOBAL') return -1;
      if (b === 'global' || nameB === 'GLOBAL') return 1;
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });

    const head = [["DÉSIGNATION", ...summaryExports.map(getTrancheName)]];
    const body = [];
    const totals = new Array(summaryExports.length).fill(0);

    if (project.chapters) {
      // PSE substitution : deltas par export (récap aligné sur l'écran + page PSE).
      const pseDeltasByExport = {};
      summaryExports.forEach((expId) => {
        pseDeltasByExport[expId] = computePseDeltas(
          project.chapters,
          qtyFromMap(new Map(Object.entries(clientQtyMaps[expId] || {})))
        );
      });
      // Déduction « base remplacée » contenue dans un nœud (pour un export donné).
      const substDeductionFor = (node, expId) =>
        collectSubstitutions(node, pseDeltasByExport[expId]).reduce((s, { info }) => s + info.baseTotal, 0);
      // Le nœud est-il lui-même une PSE substitution valide ? (missing est structurel)
      const isValidSubstitution = (node) => {
        if (!(node.isOption && node.pseMode === 'substitution')) return false;
        const info = pseDeltasByExport[summaryExports[0]]?.get(node.id);
        return !!info && !info.missing;
      };
      // Numéros de PSE (PSE n°1, n°2…) — mêmes racines que les pages PSE et l'écran.
      const pseNumbersSummary = buildPseNumbers(project.chapters);

      const buildSummaryRows = (nodes, level, mode, parentIsOption = false) => {
        let rows = [];
        nodes.forEach((node) => {
          if (node.children) {
            const effOption = parentIsOption || !!node.isOption;
            // En mode PSE : un conteneur de base (non-option) ne s'affiche pas en tant
            // que PSE — on descend chercher les racines PSE à l'intérieur, au même niveau.
            if (mode === 'option' && !effOption) {
              rows.push(...buildSummaryRows(node.children, level, mode, false));
              return;
            }
            const subst = mode === 'option' && isValidSubstitution(node);
            const isPseRoot = mode === 'option' && pseNumbersSummary.has(node.id);
            // Plus-value (delta ≥ 0) / moins-value (delta < 0) — signe de la colonne « global ».
            const substDelta = subst ? (pseDeltasByExport[summaryExports[0]]?.get(node.id)?.delta ?? 0) : 0;
            const substSuffix = subst ? (substDelta >= 0 ? ' (PLUS-VALUE)' : ' (MOINS-VALUE)') : '';
            const rawTitle = (node.title || node.designation || '') + substSuffix;
            // Numéro de (sous-)chapitre (base uniquement) — récap numéroté à tous les niveaux.
            const chapNum = mode === 'base' ? chapterNumMap.get(node.id) : null;
            const chapPrefix = chapNum ? `${chapNum}. ` : '';
            const title = isPseRoot
              ? `PSE n°${pseNumbersSummary.get(node.id)} - ${rawTitle}`.toUpperCase()
              : `${chapPrefix}${rawTitle}`.toUpperCase();
            const rowData = [];
            let hasContent = false;
            const cellTotals = [];
            summaryExports.forEach((expId) => {
              const map = new Map(Object.entries(clientQtyMaps[expId] || {}));
              const nodeData = collectData([node], false, 0, mode, projectRefMap, map, bpuConfig, includePM);
              // En mode PSE : on retranche les prestations de base remplacées (delta).
              const t = mode === 'option' ? nodeData.total - substDeductionFor(node, expId) : nodeData.total;
              if (t !== 0) hasContent = true;
              cellTotals.push(t);
            });
            if (hasContent) {
              rowData.push({
                content: safeRender(title),
                styles: {
                  fontStyle: level === 0 ? 'bold' : 'normal',
                  fontSize: level === 0 ? 8 : 7,
                  halign: 'left',
                  textColor: mode === 'option' ? THEME.pse : (level === 0 ? THEME.text : THEME.lightText),
                  cellPadding: { left: 5 + (level * 6), top: 2, bottom: 2, right: 2 }
                }
              });
              cellTotals.forEach(t => {
                rowData.push({
                  content: isDQE ? '' : cleanFormat(t) + " €",
                  styles: {
                    fontStyle: level === 0 ? 'bold' : 'normal',
                    fontSize: level === 0 ? 8 : 7,
                    halign: 'right',
                    textColor: mode === 'option' ? THEME.pse : (level === 0 ? THEME.text : THEME.lightText)
                  }
                });
              });
              rows.push(rowData);
              // Description de la PSE sous sa ligne (récap), si renseignée.
              if (isPseRoot && node.pseDescription) {
                const descTxt = htmlToPlainText(node.pseDescription);
                if (descTxt) {
                  rows.push([{
                    content: descTxt,
                    colSpan: summaryExports.length + 1,
                    styles: { fontSize: 6.5, fontStyle: 'italic', textColor: THEME.lightText, halign: 'left', valign: 'middle', cellPadding: { left: 8, top: 0, bottom: 2, right: 2 } }
                  }]);
                }
              }
              // Une PSE substitution s'affiche en une seule ligne (son surcoût) :
              // on NE descend PAS dans son sous-arbre (déjà inclus dans le delta).
              if (!(mode === 'option' && isValidSubstitution(node))) {
                rows.push(...buildSummaryRows(node.children, level + 1, mode, effOption));
              }
            }
          }
        });
        return rows;
      };

      body.push(...buildSummaryRows(project.chapters, 0, 'base'));
      project.chapters.forEach(chap => {
        summaryExports.forEach((expId, idx) => {
          const map = new Map(Object.entries(clientQtyMaps[expId] || {}));
          const chapData = collectData([chap], false, 0, 'base', projectRefMap, map, bpuConfig, includePM);
          totals[idx] += chapData.total;
        });
      });
      // TOTAL GÉNÉRAL HT (Hors PSE) : juste APRÈS la base, AVANT les PSE.
      // Les PSE n'entrent jamais dans ce total.
      body.push([
        { content: totalHtLabel, styles: { fillColor: THEME.secondary, textColor: 0, fontStyle: 'bold', halign: 'left', fontSize: 8 } },
        ...totals.map(t => ({
          content: isDQE ? '' : cleanFormat(t) + " €",
          styles: { fillColor: THEME.secondary, textColor: 0, fontStyle: 'bold', halign: 'right', fontSize: 8 }
        }))
      ]);
      // Les PSE sont listées APRÈS le total général (hors total).
      const pseRows = buildSummaryRows(project.chapters, 0, 'option');
      if (pseRows.length > 0) {
        body.push([{ content: 'OPTIONS / PRESTATIONS SUPPLÉMENTAIRES', colSpan: summaryExports.length + 1, styles: { fillColor: THEME.pseBg, textColor: THEME.pse, fontStyle: 'bold', halign: 'center' } }]);
        body.push(...pseRows);
      }
    }

    // Largeurs de colonnes proportionnelles : désignation + N colonnes de prix
    const pageContentWidth = doc.internal.pageSize.width - 20; // 10mm margins each side
    const numPriceCols = summaryExports.length;
    const priceColWidth = Math.min(35, (pageContentWidth * 0.7) / numPriceCols);
    const designationWidth = pageContentWidth - (priceColWidth * numPriceCols);
    const summaryColumnStyles = { 0: { halign: 'left', fontStyle: 'bold', cellWidth: designationWidth } };
    for (let ci = 1; ci <= numPriceCols; ci++) {
      summaryColumnStyles[ci] = { halign: 'right', cellWidth: priceColWidth, overflow: 'linebreak' };
    }

    autoTable(doc, {
      theme: 'grid', startY: 58, head, body,
      headStyles: { fillColor: THEME.tableHeader, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
      styles: { font: 'Helvetica', fontSize: 8, halign: 'right', cellPadding: { left: 2, right: 2, top: 2, bottom: 2 } },
      columnStyles: summaryColumnStyles,
      alternateRowStyles: { fillColor: THEME.tableAlt },
      didDrawPage: drawHeader,
      margin: { top: 58, bottom: 15, left: 10, right: 10 }
    });
  }

  // ── DÉTAIL PAR EXPORT ──
  sortedExports.forEach((expId, expIdx) => {
    const currentMap = new Map(Object.entries(clientQtyMaps[expId] || {}));
    currentHeaderTrancheName = getTrancheName(expId);

    if (expIdx > 0 || includeSummary || includeCover) doc.addPage();

    let currentY = 58;
    doc.setFontSize(12); doc.setTextColor(...THEME.primary); doc.setFont("Helvetica", "bold");
    doc.text(`DÉTAIL QUANTITATIF - ${currentHeaderTrancheName.toUpperCase()}`, 10, 52);

    let globalTotal = 0;

    if (project.chapters) {
      // Tous les chapitres dans UN SEUL tableau : l'en-tête de colonnes (N° · DÉSIGNATION…)
      // n'est alors réimprimé qu'en haut de chaque page (autoTable), et non à chaque chapitre.
      const allDetailRows = [];
      project.chapters.forEach((chap) => {
        // chapterNumMap numérote désormais le HEADER racine ET ses sous-chapitres (+ leurs sous-totaux).
        const chapData = collectData([chap], false, 0, 'base', projectRefMap, currentMap, bpuConfig, includePM, chapterNumMap);
        if (chapData.rows.length === 0 || (!isDQE && chapData.total === 0 && !includePM)) return;

        allDetailRows.push(...chapData.rows.filter(row => !(row.type === 'SUBTOTAL' && row.total === 0)));
        globalTotal += chapData.total;
      });

      if (allDetailRows.length > 0) {
        autoTable(doc, {
          ...tableConfig,
          startY: currentY,
          head: [["N°", "DÉSIGNATION DES OUVRAGES", "U", "QTÉ", "P.U. HT", "TOTAL HT"]],
          body: allDetailRows.map(row => {
            if (row.type === 'HEADER') return [safeRender(row.designation), '', '', '', '', ''];
            if (row.type === 'COMMENT') return [safeRender(row.designation), '', '', '', '', ''];
            if (row.type === 'SUBTOTAL') return ['', safeRender(row.designation), '', '', '', isDQE ? '' : cleanFormat(row.total) + " €"];
            const displayQty = row.qty === 0 ? "PM" : row.qty;
            const displayPrice = isDQE ? '' : cleanFormat(row.price);
            const displayTotal = isDQE ? '' : (row.qty === 0 ? "PM" : cleanFormat(row.total));
            const displayUnit = normalizeUnitSymbol(row.unit);
            return [row.ref, safeRender(row.designation), displayUnit, displayQty, displayPrice, displayTotal];
          }),
          didParseCell: (data) => {
            if (data.section === 'body') {
              const row = allDetailRows[data.row.index];
              if (row.type === 'HEADER') {
                data.cell.styles.halign = 'left'; data.cell.colSpan = 6; data.cell.styles.fontStyle = 'bold';
                data.cell.styles.cellPadding = { left: 5, top: 2, bottom: 2 };
                if (row.level === 0) { data.cell.styles.fillColor = THEME.chapterBg; data.cell.styles.fontSize = 8; }
              }
              if (row.type === 'COMMENT') {
                data.cell.styles.halign = 'left'; data.cell.colSpan = 6;
                data.cell.styles.fontStyle = 'italic'; data.cell.styles.fontSize = 6.5;
                data.cell.styles.textColor = THEME.lightText;
                data.cell.styles.cellPadding = { left: 8, top: 0.5, bottom: 2, right: 4 };
              }
              if ((data.column.index === 3 || data.column.index === 5) && data.cell.raw === "PM") {
                data.cell.styles.fontStyle = 'italic'; data.cell.styles.textColor = THEME.lightText;
              }
              if (row.type === 'SUBTOTAL') {
                data.cell.styles.fontStyle = 'bold';
                if (row.level === 0) { data.cell.styles.fillColor = THEME.secondary; }
                if (data.column.index === 1) data.cell.styles.halign = 'right';
                if (data.column.index === 5) data.cell.styles.halign = 'right';
              }
            }
          }
        });
        currentY = doc.lastAutoTable.finalY + 5;
      }
    }

    if (!isDQE) {
      if (currentY > doc.internal.pageSize.height - 40) {
        doc.addPage(); drawHeader(); currentY = 58;
      }
      const marginX = 10;
      const rightAlignX = doc.internal.pageSize.width - marginX;
      // Taux de TVA configurable par projet (défaut 20 %). TTC = HT + TVA (audit F1/F2).
      const tvaRatePct = Number(project?.tauxTVA ?? 20);
      const { ht, tva, ttc } = computeVatBreakdown(globalTotal, tvaRatePct / 100);
      doc.setFontSize(9); doc.setFont("Helvetica", "bold");
      doc.text(`${totalHtLabel} : ${cleanFormat(ht)} €`, rightAlignX, currentY + 5, { align: 'right' });
      doc.setFont("Helvetica", "normal");
      doc.text(`T.V.A. (${String(tvaRatePct).replace('.', ',')}%) : ${cleanFormat(tva)} €`, rightAlignX, currentY + 11, { align: 'right' });
      doc.setFontSize(11); doc.setFont("Helvetica", "bold");
      doc.text(`TOTAL GÉNÉRAL TTC : ${cleanFormat(ttc)} €`, rightAlignX, currentY + 19, { align: 'right' });
    }

    // Pages PSE — une page numérotée par PSE (racine option), avec son propre total.
    if (project.chapters) {
      // Deltas PSE substitution pour CE tranche/export (aligné sur l'écran).
      const pseDeltas = computePseDeltas(project.chapters, qtyFromMap(currentMap));
      const pseNodeIndex = buildNodeIndex(project.chapters);
      const pseNumbers = buildPseNumbers(project.chapters);
      const pseRoots = collectPseRoots(project.chapters);
      pseRoots.forEach((chap) => {
        const pseNo = pseNumbers.get(chap.id);
        const pseData = collectData([chap], false, 0, 'option', projectRefMap, currentMap, bpuConfig, includePM);
        if (pseData && pseData.rows.length > 0 && (isDQE || pseData.total !== 0)) {
          doc.addPage();
          doc.setFontSize(10); doc.setTextColor(...THEME.pse); doc.setFont("Helvetica", "bold");
          doc.text(`PSE n°${pseNo} : ${(chap.title || '').toUpperCase()} - ${currentHeaderTrancheName}`, 14, 52);

          // Description / justification de la PSE — rendu fidèle (gras/souligné/puces),
          // texte centré en hauteur ; repli texte simple paginé si trop haute.
          let pseTableStartY = 58;
          const pseBlocks = htmlToRichBlocks(chap.pseDescription);
          if (pseBlocks.length) {
            try {
              pseTableStartY = drawPseDescriptionBox(doc, pseBlocks, THEME, 55);
            } catch {
              autoTable(doc, {
                startY: 56,
                margin: { left: 10, right: 10 },
                theme: 'plain',
                styles: { font: 'Helvetica', fontSize: 8, textColor: THEME.text, cellPadding: { left: 3, right: 3, top: 2, bottom: 2 }, overflow: 'linebreak', valign: 'middle' },
                head: [[{ content: 'DESCRIPTION', styles: { fontStyle: 'bold', fontSize: 7, textColor: THEME.pse, cellPadding: { left: 3, top: 1, bottom: 0 } } }]],
                body: [[{ content: htmlToPlainText(chap.pseDescription), styles: { fillColor: THEME.pseBg } }]],
                didDrawPage: drawHeader,
              });
              pseTableStartY = doc.lastAutoTable.finalY + 3;
            }
          }

          autoTable(doc, {
            ...tableConfig,
            startY: pseTableStartY,
            head: [["N°", "DÉSIGNATION", "U", "QTÉ", "P.U. HT", "TOTAL HT"]],
            headStyles: { ...tableConfig.headStyles, fillColor: THEME.pse },
            body: (() => {
              const filteredPseRows = pseData.rows.filter(row => !(row.type === 'SUBTOTAL' && row.total === 0));
              pseData._filteredRows = filteredPseRows;
              return filteredPseRows.map(row => {
                if (row.type === 'HEADER') return [safeRender(row.designation), '', '', '', '', ''];
                if (row.type === 'COMMENT') return [safeRender(row.designation), '', '', '', '', ''];
                if (row.type === 'SUBTOTAL') return ['', safeRender(row.designation), '', '', '', isDQE ? '' : cleanFormat(row.total) + " €"];
                const dQty = row.qty === 0 ? "PM" : row.qty;
                const dPrice = isDQE ? '' : cleanFormat(row.price);
                const dTotal = isDQE ? '' : (row.qty === 0 ? "PM" : cleanFormat(row.total));
                const displayUnit = normalizeUnitSymbol(row.unit);
                return [row.ref, safeRender(row.designation), displayUnit, dQty, dPrice, dTotal];
              });
            })(),
            didParseCell: (data) => {
              if (data.section === 'body') {
                const row = (pseData._filteredRows || pseData.rows)[data.row.index];
                if (row.type === 'HEADER') {
                  data.cell.styles.halign = 'left'; data.cell.colSpan = 6; data.cell.styles.fontStyle = 'bold';
                  data.cell.styles.cellPadding = { left: 5, top: 2, bottom: 2 };
                  if (row.level === 0) data.cell.styles.fillColor = THEME.pseBg;
                }
                if (row.type === 'COMMENT') {
                  data.cell.styles.halign = 'left'; data.cell.colSpan = 6;
                  data.cell.styles.fontStyle = 'italic'; data.cell.styles.fontSize = 6.5;
                  data.cell.styles.textColor = THEME.lightText;
                  data.cell.styles.cellPadding = { left: 8, top: 0.5, bottom: 2, right: 4 };
                }
                if (row.type === 'SUBTOTAL') {
                  data.cell.styles.fontStyle = 'bold';
                  if (data.column.index === 1) data.cell.styles.halign = 'right';
                  if (data.column.index === 5) data.cell.styles.halign = 'right';
                }
              }
            }
          });
          if (!isDQE) {
            const marginX = 10;
            const rightAlignX = doc.internal.pageSize.width - marginX;
            const labelX = 78; // libellés alignés à gauche, montants alignés à droite
            let pY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(9);

            // Une ligne « libellé … montant » : libellé tronqué pour ne jamais déborder
            // sur la colonne montant (montants jusqu'à 6 chiffres).
            const totalLine = (label, amount, y) => {
              const max = 50;
              const lbl = label.length > max ? label.slice(0, max - 1) + '…' : label;
              doc.text(lbl, labelX, y);
              doc.text(amount, rightAlignX, y, { align: 'right' });
            };

            // PSE substitution : valeur = montant PSE − prestation(s) de base remplacée(s).
            const substitutions = collectSubstitutions(chap, pseDeltas);

            if (substitutions.length > 0) {
              const deduction = substitutions.reduce((s, { info }) => s + info.baseTotal, 0);
              const valeur = pseData.total - deduction; // delta signé (Σ substitutions + PSE simples)
              const isPlus = valeur >= 0;
              const motHT = isPlus ? 'PLUS-VALUE HT PSE' : 'MOINS-VALUE HT PSE';
              const motTTC = isPlus ? 'PLUS-VALUE TTC PSE' : 'MOINS-VALUE TTC PSE';

              doc.setFont('Helvetica', 'normal'); doc.setTextColor(...THEME.lightText);
              totalLine('Montant PSE HT', `${cleanFormat(pseData.total)} €`, pY);
              pY += 6;
              substitutions.forEach(({ info }) => {
                const { ref, label } = baseLabelOf(info.baseId, pseNodeIndex, projectRefMap);
                const name = [ref, label].filter(Boolean).join(' ');
                totalLine(`- Base remplacée : ${name}`, `-${cleanFormat(info.baseTotal)} €`, pY);
                pY += 6;
              });
              doc.setFont('Helvetica', 'bold'); doc.setTextColor(...THEME.pse);
              totalLine(motHT, `${isPlus ? '+' : ''}${cleanFormat(valeur)} €`, pY + 1);
              totalLine(motTTC, `${isPlus ? '+' : ''}${cleanFormat(valeur * 1.2)} €`, pY + 9);
              doc.setFont('Helvetica', 'normal');
            } else {
              totalLine('TOTAL HT PSE', `${cleanFormat(pseData.total)} €`, pY);
              totalLine('TOTAL TTC PSE', `${cleanFormat(pseData.total * 1.2)} €`, pY + 8);
            }
          }
        }
      });
    }
  });

  // Numérotation
  const totalPages = doc.internal.getNumberOfPages();
  const startPage = includeCover ? 2 : 1;
  const totalPagesCount = includeCover ? totalPages - 1 : totalPages;
  for (let i = startPage; i <= totalPages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(0, 0, 0); doc.setFont("Helvetica", "normal");
    const pageLabel = includeCover ? i - 1 : i;
    doc.text(`PAGE : ${pageLabel} / ${totalPagesCount}`, doc.internal.pageSize.width - 20, 43, { align: 'right' });
  }

  stampPdfCredit(doc);

  const safeName = sanitizeFilename(project?.name || 'Projet');
  const dateStr = new Date().toISOString().slice(0, 10);
  const suggestedName = `${type}_${safeName}_${dateStr}.pdf`;
  const blob = doc.output('blob');

  if (options.previewOnly) {
    return { blobUrl: URL.createObjectURL(blob), suggestedName, blob };
  }

  await saveFileWithPicker(blob, suggestedName, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
};