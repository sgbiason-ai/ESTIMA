// src/utils/pdfAnalysisGenerator.js
//
// ═══════════════════════════════════════════════════════════════════
// CE QUI A CHANGÉ PAR RAPPORT À L'ORIGINAL :
//
//  1. `hexToRgbArray(hex)` — [NOUVEAU] même utilitaire que pdfGenerator
//     convertit '#065F46' → [6, 95, 70] pour jsPDF.
//
//  2. `buildTheme(branding)` — [NOUVEAU] construit THEME depuis branding.
//     Appliqué au bandeau supérieur de la page de garde et à l'en-tête A3.
//
//  3. `drawCoverPage` — [MODIFIÉ] :
//     - Le bandeau haut utilise la couleur primaire du branding
//     - Si `branding.companyName` est renseigné, il s'affiche dans le
//       bandeau supérieur à la place de rien
//     - Pied de page MOE : nom, tagline, adresse, tél, email, site
//
//  4. `generateAnalysisPDF` — [MODIFIÉ] :
//     - Passe `branding` à `drawCoverPage`
//     - L'en-tête du tableau de synthèse utilise la couleur primaire
//
// Tout le reste est IDENTIQUE à l'original.
// ═══════════════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanText, normalizeUnitSymbol } from './helpers';
import { sanitizeFilename, formatNumberFr, fitTextToWidth } from './pdf/pdfSharedHelpers';
import { stampPdfCredit } from './estimaCredit';
import { buildTheme as _buildTheme } from './pdf/buildTheme';
import { getCurrentPhaseCode } from './phaseModel';
import { computeOABThreshold as calculateOABThreshold } from './analysisCompute';

// ─── CONSTRUCTION DU THÈME DEPUIS LE BRANDING ───────────────────────────────
// Analyse utilise des defaults vert foncé différents du thème principal.
const ANALYSIS_DEFAULTS = {
  primary:   [6, 95, 70],
  accent:    [16, 185, 129],
};

const buildTheme = (branding) => _buildTheme(branding, {}, ANALYSIS_DEFAULTS);

// ─── COULEURS PAR ENTREPRISE ─────────────────────────────────────────────────
const COMPANY_COLORS = [
  { header: [30, 58, 138],  body: [239, 246, 255], text: [30, 58, 138] },
  { header: [6, 78, 59],    body: [236, 253, 245], text: [6, 78, 59] },
  { header: [88, 28, 135],  body: [250, 245, 255], text: [88, 28, 135] },
  { header: [124, 45, 18],  body: [255, 247, 237], text: [124, 45, 18] },
  { header: [131, 24, 67],  body: [255, 241, 242], text: [131, 24, 67] },
  { header: [22, 78, 99],   body: [236, 254, 255], text: [22, 78, 99] },
];

const SCORING_FORMULAS = {
  f1: 'N × ( Pmin / P )',
  f2: 'N × ( Pmin / P )²',
  f3: 'N × ( Pmin / P )³',
  f4: 'N × [ 1 - ( P - Pmin ) / Pmin ]',
  f5: 'N × [ 1 - ( P - Pmin ) / Pmoy ]',
  f6: 'Si P < Pmoy : N × √( Pmin / P ) | Sinon : N × ( Pmin / P )²',
  f7: 'N × [ 1 - ( P - Pmin ) / ( Pmax - Pmin ) ]',
  f8: '( N × Pmoy ) / ( Pmoy + P )',
  f9: 'N × ( 2 × Pmin ) / ( Pmin + P )'
};

const getCompanyStyle = (index) => COMPANY_COLORS[index % COMPANY_COLORS.length];


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

// ─── CHARGEMENT LOGO ──────────────────────────────────────────────────────────

const loadLogoAsBase64 = async (source) => {
  if (!source) return null;
  try {
    if (source.startsWith('data:')) return source;
    const response = await fetch(`${source}?t=${Date.now()}`);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

const getImageDimensions = (base64Data) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = base64Data;
  });
};

// ─── PAGE DE GARDE ────────────────────────────────────────────────────────────
// [MODIFIÉ] Reçoit `branding` pour :
//   - Bandeau haut en couleur primaire du branding
//   - Nom société dans le bandeau
//   - Pied de page avec les coordonnées MOE

const drawCoverPage = (doc, project, logoMoeData, logoMoeDims, logoClientData, logoClientDims, title, today, branding = null, coTraitantLogos = []) => {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  // [MODIFIÉ] Thème dynamique
  const THEME = buildTheme(branding);

  const clientRaw = project.client || 'Non renseigné';

  // ── Bandeau supérieur (couleur primaire du branding) ──
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, pageWidth, 25, 'F');

  // [NOUVEAU] Nom société dans le bandeau si disponible
  if (branding?.companyName) {
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(branding.companyName.toUpperCase(), pageWidth - 14, 15, { align: 'right' });
  }

  // ── Logo MOE (haut à gauche — remplace haut à droite de l'original) ──
  if (logoMoeData && logoMoeDims) {
    const ratio = logoMoeDims.width / logoMoeDims.height;
    const maxH = 18; const maxW = 50;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    // Logo centré verticalement dans le bandeau (hauteur 25)
    doc.addImage(logoMoeData, 'JPEG', 14, (25 - h) / 2, w, h);
  }

  // ── Logos co-traitants (groupement) — empilés sous le bandeau, à gauche ──
  let coY = 30;
  (coTraitantLogos || []).forEach(({ data, dims }) => {
    if (!data || !dims) return;
    const ratio = dims.width / dims.height;
    const maxW = 50; const maxH = 16;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(data, 'JPEG', 14, coY, w, h);
    coY += h + 3;
  });

  // ── Logo Client (en dessous du bandeau, à droite) ──
  if (logoClientData && logoClientDims) {
    const ratio = logoClientDims.width / logoClientDims.height;
    const maxW = 50; const maxH = 30;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(logoClientData, 'JPEG', pageWidth - w - 20, 35, w, h);
  }

  // Titre du document
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...THEME.lightText);
  doc.text(title, 20, 100);

  doc.setDrawColor(...THEME.accent);
  doc.setLineWidth(1.5);
  doc.line(20, 105, 100, 105);

  // Nom du projet
  doc.setFontSize(32);
  doc.setTextColor(0, 0, 0);
  const projTitle = (project?.name || "NOM DU PROJET").toUpperCase();
  const splitTitle = doc.splitTextToSize(projTitle, pageWidth - 40);
  doc.text(splitTitle, 20, 130);

  // Client
  doc.setFontSize(12);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("CLIENT / MAÎTRE D'OUVRAGE :", 20, 170);
  doc.setFont("Helvetica", "normal");
  doc.text(fitTextToWidth(doc, clientRaw.toUpperCase(), pageWidth - 40), 20, 178);

  if (project.location) {
    doc.setFont("Helvetica", "bold");
    doc.text("LOCALISATION :", 20, 195);
    doc.setFont("Helvetica", "normal");
    doc.text(fitTextToWidth(doc, project.location.toUpperCase(), pageWidth - 40), 20, 203);
  }

  // Phase ACT
  doc.setDrawColor(...THEME.primary);
  doc.setLineWidth(0.5);
  const phaseLabel = `PHASE ${getCurrentPhaseCode(project).toUpperCase()}`;
  // Mesurer la largeur de la boîte AVEC la police de dessin (18pt bold), sinon
  // getTextWidth mesure à 12pt (hérité) → boîte trop étroite pour le texte 18pt.
  doc.setFontSize(18);
  doc.setFont("Helvetica", "bold");
  const phaseBoxWidth = Math.max(80, doc.getTextWidth(phaseLabel) + 16);
  doc.roundedRect(centerX - phaseBoxWidth / 2, 235, phaseBoxWidth, 15, 2, 2, 'S');
  doc.setTextColor(...THEME.primary);
  doc.text(phaseLabel, centerX, 245, { align: 'center' });

  // ── [NOUVEAU] PIED DE PAGE MOE ──────────────────────────────────────────────
  if (branding?.companyName) {
    const footerY = pageHeight - 18;

    doc.setDrawColor(...THEME.primary);
    doc.setLineWidth(0.3);
    doc.line(20, footerY - 8, pageWidth - 20, footerY - 8);

    // Nom + tagline (gauche)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...THEME.primary);
    doc.text(branding.companyName.toUpperCase(), 20, footerY - 3);

    if (branding.tagline) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...THEME.lightText);
      doc.text(branding.tagline, 20, footerY + 2);
    }

    // Coordonnées (droite)
    const contactParts = [
      branding.address,
      branding.phone,
      branding.email,
      branding.website,
    ].filter(Boolean);

    if (contactParts.length > 0) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...THEME.lightText);
      doc.text(fitTextToWidth(doc, contactParts.join('  ·  '), (pageWidth - 40) / 2), pageWidth - 20, footerY - 3, { align: 'right' });
    }

    doc.setFontSize(6);
    doc.text(`Date d'émission : ${today}`, pageWidth - 20, footerY + 2, { align: 'right' });

  } else {
    // Comportement original
    doc.setFontSize(10);
    doc.setTextColor(...THEME.lightText);
    doc.setFont("Helvetica", "normal");
    doc.text(`Date d'émission : ${today}`, 20, pageHeight - 20);
  }
};

// ─── FONCTION PRINCIPALE ──────────────────────────────────────────────────────

export const generateAnalysisPDF = async ({
  project,
  companies,
  chaptersData,
  stats,
  bpuRefMap,
  activeTrancheId,
  tranches,
  analysisMode,
  scoringConfig,
  branding = null,
}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // [MODIFIÉ] Thème dynamique
  const THEME = buildTheme(branding);

  // Chargement logos
  const moeSource = branding?.logo || '/logo.jpg';
  const logoMoeData = await loadLogoAsBase64(moeSource);
  const logoMoeDims = logoMoeData ? await getImageDimensions(logoMoeData) : null;
  const logoClientData = project.clientLogo ? await loadLogoAsBase64(project.clientLogo) : null;
  const logoClientDims = logoClientData ? await getImageDimensions(logoClientData) : null;

  // Logos co-traitants (groupement) — base64 + dimensions
  const coTraitantSources = Array.isArray(project.coTraitantLogos) ? project.coTraitantLogos.filter(Boolean) : [];
  const coTraitantLogos = [];
  for (const src of coTraitantSources) {
    const data = await loadLogoAsBase64(src);
    const dims = data ? await getImageDimensions(data) : null;
    if (data && dims) coTraitantLogos.push({ data, dims });
  }

  // Page de garde A4 — [MODIFIÉ] : on passe `branding`
  drawCoverPage(doc, project, logoMoeData, logoMoeDims, logoClientData, logoClientDims, "RAPPORT D'ANALYSE DES OFFRES", dateStr, branding, coTraitantLogos);

  // Passage A3 paysage
  doc.addPage('a3', 'l');

  const scoringMode = scoringConfig?.mode || 'f1';
  const maxScore = Number(scoringConfig?.maxScore || 40);

  // Stats
  const grandTotalBase = stats.totalEstimation;
  const summaryData = companies.map(c => {
    const total = stats.companiesTotals[c.id] || 0;
    const score = stats.companyScores[c.id] || 0;
    const deviation = grandTotalBase > 0 ? ((total - grandTotalBase) / grandTotalBase) * 100 : 0;
    return { id: c.id, name: c.name, total, score, deviation };
  });
  summaryData.sort((a, b) => b.score - a.score);

  // En-tête A3
  const trancheName = activeTrancheId === 'global' ? 'GLOBAL' : tranches.find(t => t.id === activeTrancheId)?.name || 'Tranche';
  doc.setFontSize(16); doc.setTextColor(0, 0, 0);
  doc.text("SYNTHÈSE DE L'ANALYSE FINANCIÈRE", 14, 15);
  doc.setFontSize(10);
  doc.text(fitTextToWidth(doc, `Lot/Tranche : ${trancheName} | Date : ${dateStr}`, doc.internal.pageSize.width - 28), 14, 22);
  doc.setFontSize(9); doc.setTextColor(80);
  const formulaLabel = SCORING_FORMULAS[scoringMode] || scoringMode.toUpperCase();
  doc.text(`Notation (${maxScore} pts) : ${formulaLabel}`, 14, 30);
  doc.setTextColor(0);

  // Légende heatmap / OAB (inchangé)
  if (analysisMode === 'oab') {
    doc.setDrawColor(200); doc.setFillColor(255, 237, 213);
    doc.rect(200, 12, 5, 5, 'FD');
    doc.text("Prix bas suspecté (OAB)", 207, 16);
  } else if (analysisMode === 'heatmap') {
    doc.setFontSize(8);
    const legendY = 12; const boxSize = 4; const startX = 220;
    const reds = [{ color: [254, 226, 226], label: "> 0%" }, { color: [254, 202, 202], label: "> +10%" }, { color: [252, 165, 165], label: "> +25%" }, { color: [248, 113, 113], label: "> +50%" }];
    reds.forEach((item, i) => { doc.setFillColor(...item.color); doc.rect(startX + (i * 20), legendY, boxSize, boxSize, 'FD'); doc.text(item.label, startX + (i * 20) + 5, legendY + 3); });
    const greens = [{ color: [209, 250, 229], label: "< 0%" }, { color: [167, 243, 208], label: "< -10%" }, { color: [110, 231, 183], label: "< -25%" }, { color: [52, 211, 153], label: "< -50%" }];
    greens.forEach((item, i) => { doc.setFillColor(...item.color); doc.rect(startX + (i * 20), legendY + 5, boxSize, boxSize, 'FD'); doc.text(item.label, startX + (i * 20) + 5, legendY + 8); });
  }

  // Tableau de synthèse — [MODIFIÉ] : en-tête avec couleur primaire du branding
  const summaryBody = summaryData.map((d, index) => [
    { content: `${index + 1}${index === 0 ? 'er' : 'ème'}`, styles: { fontStyle: 'bold', halign: 'center' } },
    d.name,
    { content: formatNumberFr(d.total) + ' €', styles: { fontStyle: 'bold', halign: 'right' } },
    { content: (d.deviation > 0 ? '+' : '') + d.deviation.toFixed(2) + '%', styles: { textColor: d.deviation > 0 ? [200, 0, 0] : [0, 150, 0], halign: 'center' } },
    { content: d.score.toFixed(2) + ` / ${maxScore}`, styles: { fontStyle: 'bold', halign: 'center' } }
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Rang', 'Entreprise', 'Montant HT', 'Écart / Estim.', 'Note Finale']],
    body: summaryBody,
    theme: 'striped',
    // [MODIFIÉ] Couleur d'en-tête depuis le branding
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 40 }, 4: { cellWidth: 30 } }
  });

  // Détail des prix unitaires (inchangé)
  const startYDetail = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12); doc.setTextColor(0, 0, 0);
  doc.text("DÉTAIL DES PRIX UNITAIRES (Format A3)", 14, startYDetail - 5);

  const tableBody = [];
  const mainHeaders = [
    { content: 'N°', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    { content: 'Désignation', rowSpan: 2, styles: { halign: 'left', valign: 'middle', cellWidth: 60 } },
    { content: 'U', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    { content: 'Qté', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    { content: 'Estimation', colSpan: 2, styles: { halign: 'center', fillColor: [240, 240, 255] } }
  ];
  const subHeaders = [
    { content: 'P.U.', styles: { halign: 'right', fillColor: [240, 240, 255], fontStyle: 'bold' } },
    { content: 'Total', styles: { halign: 'right', fillColor: [240, 240, 255], fontStyle: 'bold' } }
  ];
  const columnStyles = {};

  companies.forEach((company, idx) => {
    const style = getCompanyStyle(idx);
    mainHeaders.push({ content: company.name, colSpan: 3, styles: { halign: 'center', fillColor: style.header, fontStyle: 'bold', textColor: [255, 255, 255] } });
    subHeaders.push({ content: 'P.U.', styles: { halign: 'right', fillColor: style.body, textColor: style.text } });
    subHeaders.push({ content: 'Total', styles: { halign: 'right', fillColor: style.body, textColor: style.text } });
    subHeaders.push({ content: '%', styles: { halign: 'center', fillColor: style.body, textColor: style.text } });
    const startCol = 6 + (idx * 3);
    columnStyles[startCol] = { fillColor: style.body };
    columnStyles[startCol + 1] = { fillColor: style.body };
    columnStyles[startCol + 2] = { fillColor: style.body };
  });

  chaptersData.forEach(chapter => {
    tableBody.push([{ content: chapter.title.toUpperCase(), colSpan: 6 + (companies.length * 3), styles: { fillColor: [220, 220, 225], fontStyle: 'bold', textColor: [50, 50, 60] } }]);

    chapter.items.forEach((item) => {
      const qty = item.activeQty;
      const estTotal = item.price * qty;
      const row = [
        { content: bpuRefMap.get(item.id) || (item.bpuNum || '-') },
        { content: cleanText(item.designation) },
        { content: normalizeUnitSymbol(item.unit) },
        { content: qty },
        { content: formatNumberFr(item.price) },
        { content: formatNumberFr(estTotal), styles: { fontStyle: 'bold' } }
      ];
      const itemPrices = companies.map(c => Number(c.offers[item.id] || 0));
      const lineOabThreshold = analysisMode === 'oab' ? calculateOABThreshold(itemPrices) : 0;
      companies.forEach((company) => {
        const priceVal = company.offers[item.id];
        const price = (priceVal !== undefined && priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
        const hasPrice = price !== null;
        const total = hasPrice ? price * qty : 0;
        const deviation = (hasPrice && item.price > 0) ? ((price - item.price) / item.price) * 100 : 0;
        let cellStyle = {};
        if (analysisMode === 'oab' && hasPrice && price > 0 && price < lineOabThreshold) {
          cellStyle = { fillColor: [255, 237, 213], textColor: [180, 83, 9], fontStyle: 'bold' };
        } else if (analysisMode === 'heatmap' && hasPrice && item.price > 0) {
          const hs = getHeatmapStyle(price, item.price);
          if (hs) cellStyle = { fillColor: hs.fill, textColor: hs.text, fontStyle: 'bold' };
        }
        row.push({ content: hasPrice ? formatNumberFr(price) : '-', styles: { halign: 'right', ...cellStyle } });
        row.push({ content: hasPrice ? formatNumberFr(total) : '-', styles: { halign: 'right' } });
        row.push({ content: hasPrice ? (deviation > 0 ? '+' : '') + deviation.toFixed(0) + '%' : '-', styles: { halign: 'center', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fontSize: 6 } });
      });
      tableBody.push(row);
    });

    if (!chapter.isOption) {
      const chapEstTotal = chapter.items.reduce((acc, i) => acc + (i.activeQty * i.price), 0);
      const chapTotalRow = [
        { content: `TOTAL ${chapter.title.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: '', colSpan: 1, styles: { fillColor: [226, 232, 240] } },
        { content: formatNumberFr(chapEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } }
      ];
      companies.forEach(company => {
        const totalChap = chapter.items.reduce((acc, i) => { const p = Number(company.offers[i.id] || 0); return acc + (i.activeQty * p); }, 0);
        const deviation = chapEstTotal > 0 ? ((totalChap - chapEstTotal) / chapEstTotal) * 100 : 0;
        chapTotalRow.push({ content: '', styles: { fillColor: [226, 232, 240] } });
        chapTotalRow.push({ content: formatNumberFr(totalChap), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } });
        chapTotalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%', styles: { halign: 'center', fontSize: 7, fontStyle: 'bold', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: [226, 232, 240] } });
      });
      tableBody.push(chapTotalRow);
      tableBody.push([{ content: '', colSpan: 6 + (companies.length * 3), styles: { cellPadding: 1, fillColor: [255, 255, 255] } }]);
    }
  });

  const totalRow = [{ content: 'TOTAL GÉNÉRAL HT', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: '-', styles: { halign: 'center' } }, { content: formatNumberFr(stats.totalEstimation), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }];
  companies.forEach(company => {
    const total = stats.companiesTotals[company.id] || 0;
    const deviation = grandTotalBase > 0 ? ((total - grandTotalBase) / grandTotalBase) * 100 : 0;
    totalRow.push({ content: '-', styles: { halign: 'center' } });
    totalRow.push({ content: formatNumberFr(total), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255] } });
    totalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(2) + '%', styles: { halign: 'center', fontStyle: 'bold' } });
  });
  tableBody.push(totalRow);

  const noteRow = [{ content: `NOTE PRIX (/${maxScore})`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: '', colSpan: 2 }];
  companies.forEach(company => {
    const score = stats.companyScores[company.id] || 0;
    noteRow.push({ content: score.toFixed(2), colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fontSize: 12 } });
  });
  tableBody.push(noteRow);

  autoTable(doc, {
    startY: startYDetail,
    head: [mainHeaders, subHeaders],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [180, 180, 180] },
    columnStyles,
    didDrawCell: (data) => {
      if (data.column.index >= 6 && (data.column.index - 6) % 3 === 0 && data.section === 'body') {
        const d = data.doc;
        d.setDrawColor(100, 100, 100); d.setLineWidth(0.3);
        d.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
      }
    }
  });

  stampPdfCredit(doc);

  const safeTitle = sanitizeFilename(project?.title || project?.name || "Export");
  const safeTranche = sanitizeFilename(activeTrancheId === 'global' ? 'Global' : activeTrancheId);
  doc.save(`Analyse_${safeTitle}_${safeTranche}_${new Date().toISOString().slice(0, 10)}.pdf`);
};