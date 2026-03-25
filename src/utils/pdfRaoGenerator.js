// src/utils/pdfRaoGenerator.js
// Génère le PDF du Rapport d'Analyse des Offres (RAO)
// INCLUT l'Analyse Financière (Synthèse A4 + Détails A3) avec codes couleurs par entreprise

import { DEFAULT_CRITERIA, DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../hooks/useRao';
import { normalizeUnitSymbol } from './helpers';

// ─── THÈME ET HELPERS ────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  primary:   [40, 110, 85],
  secondary: [245, 250, 248],
  accent:    [50, 180, 130],
  text:      [40, 40, 40],
  lightText: [100, 116, 139],
  borders:   [220, 235, 230],
  white:     [255, 255, 255],
  yes:       [40, 167, 69],
  no:        [220, 53, 69],
};

// Les mêmes couleurs que dans l'Analyse Financière
const COMPANY_COLORS = [
  { header: [30, 58, 138],  body: [239, 246, 255], text: [30, 58, 138] },
  { header: [6, 78, 59],    body: [236, 253, 245], text: [6, 78, 59] },
  { header: [88, 28, 135],  body: [250, 245, 255], text: [88, 28, 135] },
  { header: [124, 45, 18],  body: [255, 247, 237], text: [124, 45, 18] },
  { header: [131, 24, 67],  body: [255, 241, 242], text: [131, 24, 67] },
  { header: [22, 78, 99],   body: [236, 254, 255], text: [22, 78, 99] },
];

const getCompanyStyle = (index) => COMPANY_COLORS[index % COMPANY_COLORS.length];

const hexToRgbArray = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
};

const buildTheme = (branding) => {
  if (!branding?.colors) return { ...DEFAULT_THEME, tableAlt: [245, 250, 247] };

  const primary   = hexToRgbArray(branding.colors.primary)   || DEFAULT_THEME.primary;
  const secondary = hexToRgbArray(branding.colors.secondary) || DEFAULT_THEME.accent;
  const text      = hexToRgbArray(branding.colors.text)      || DEFAULT_THEME.text;
  const lightText = hexToRgbArray(branding.colors.subtle)    || DEFAULT_THEME.lightText;

  const lighten = (c) => Math.round(c + (255 - c) * 0.96); 
  const tableAlt = primary.map(lighten);
  const borders = primary.map(c => Math.round(c + (255 - c) * 0.80));

  return {
    primary, accent: secondary, text, lightText, borders, tableAlt,
    secondary: tableAlt, 
    white: DEFAULT_THEME.white, yes: DEFAULT_THEME.yes, no: DEFAULT_THEME.no,
  };
};

const fmt = (n) => typeof n === 'number'
  ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\s\u202F\u00A0]/g, ' ')
  : (n || '—');

const fmtScore = (n) => typeof n === 'number' ? n.toFixed(2) : '—';

const formatNumberFr = (value) => {
  if (value === undefined || value === null || value === '' || isNaN(Number(value))) return '-';
  const num = Number(value);
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
};

const calculateOABThreshold = (values) => {
  const validValues = values.filter(v => v > 0);
  if (validValues.length === 0) return 0;
  const M1 = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const upperLimit = M1 * 1.20;
  const filteredValues = validValues.filter(v => v <= upperLimit);
  if (filteredValues.length === 0) return M1 * 0.90;
  return (filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length) * 0.90;
};

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
  if (delta < -0.00) return { fill: [209, 250, 229], text: [30, 41, 59] };
  return null;
};

const cleanText = (str) => typeof str === 'string' ? str.replace(/[\r\n]+/g, ' ').trim() : '';

const loadLogoFromSource = (source) => {
  return new Promise((resolve) => {
    if (!source) return resolve(null);
    const img = new Image();
    img.src = source;
    if (!source.startsWith('data:')) img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};

// ─── PAGE DE GARDE ──────────────────────────────────────────────────────────
const drawCoverPage = (doc, project, consultation, logoMoe, logoClient, today, branding, THEME) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const phaseLabel = (consultation?.phase || project?.phase || 'DCE').toUpperCase();
  const clientName = consultation?.client || project?.client || 'Non renseigné';
  const clientStreet = project?.clientAddress ? project.clientAddress.trim() : '';
  const clientCityZip = [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim();
  const locationRaw = consultation?.lieu || project?.location || 'Non renseignée';
  const codeAffaire = consultation?.code || project?.code || 'Non défini';
  const subtitle1 = (consultation?.subtitle1 || project?.subtitle1 || '').trim();
  const subtitle2 = (consultation?.subtitle2 || project?.subtitle2 || '').trim();
  const showSignatures = project?.showSignatures !== false;
  const signatories = project?.signatories || ['', '', '', ''];

  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, pageHeight, 'F');

  const renderLogo = (logoImage, isLeft) => {
    if (!logoImage) return;
    const maxW = 45; const maxH = 25;
    const ratio = logoImage.width / logoImage.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const yPos = 18 + (maxH - h) / 2;
    const xPos = isLeft ? 18 : pageWidth - 18 - w;
    doc.addImage(logoImage, 'JPEG', xPos, yPos, w, h);
  };
  renderLogo(logoMoe, true);
  renderLogo(logoClient, false);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...THEME.lightText);
  doc.text("RAPPORT D'ANALYSE DES OFFRES", pageWidth - 18, 52, { align: 'right' });
  doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.5);
  doc.line(pageWidth - 85, 57, pageWidth - 18, 57);

  doc.setFontSize(32);
  doc.setTextColor(...THEME.primary);
  const title = (consultation?.objet || project?.name || "NOM DU PROJET").toUpperCase();
  const splitTitle = doc.splitTextToSize(title, pageWidth - 40);
  doc.text(splitTitle, 18, 100);

  const titleHeight = splitTitle.length * 12;
  doc.setDrawColor(...THEME.accent);
  doc.setLineWidth(1.5);
  doc.line(18, 100 + titleHeight + 4, 60, 100 + titleHeight + 4);

  let subtitleOffset = 0;
  if (subtitle1) {
    subtitleOffset += 10;
    doc.setFontSize(13); doc.setFont("Helvetica", "normal"); doc.setTextColor(...THEME.lightText);
    doc.text(subtitle1.toUpperCase(), 18, 100 + titleHeight + 4 + subtitleOffset);
  }
  if (subtitle2) {
    subtitleOffset += 7;
    doc.setFontSize(11); doc.setFont("Helvetica", "normal"); doc.setTextColor(...THEME.lightText);
    doc.text(subtitle2.toUpperCase(), 18, 100 + titleHeight + 4 + subtitleOffset);
  }

  const blockY = 125 + titleHeight + subtitleOffset;
  doc.setFillColor(...THEME.secondary);
  doc.roundedRect(18, blockY, pageWidth - 36, 60, 3, 3, 'F');

  const col1X = 28;
  const col2X = pageWidth / 2 + 10;
  let startY = blockY + 12;

  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("MAÎTRE D'OUVRAGE", col1X, startY);
  doc.setFontSize(11); doc.setTextColor(...THEME.text);
  const splitClient = doc.splitTextToSize(clientName.toUpperCase(), (pageWidth / 2) - 40);
  doc.text(splitClient, col1X, startY + 6);
  let currentY = startY + 6 + (splitClient.length * 5);
  doc.setFontSize(9); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "normal");
  if (clientStreet) {
    const splitStreet = doc.splitTextToSize(clientStreet.toUpperCase(), (pageWidth / 2) - 40);
    doc.text(splitStreet, col1X, currentY);
    currentY += (splitStreet.length * 5);
  }
  if (clientCityZip) {
    const splitCityZip = doc.splitTextToSize(clientCityZip.toUpperCase(), (pageWidth / 2) - 40);
    doc.text(splitCityZip, col1X, currentY);
    currentY += (splitCityZip.length * 5);
  }
  currentY += 6;
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("LIEU DE RÉALISATION", col1X, currentY);
  doc.setFontSize(11); doc.setTextColor(...THEME.text);
  const splitLoc = doc.splitTextToSize(locationRaw.toUpperCase(), (pageWidth / 2) - 40);
  doc.text(splitLoc, col1X, currentY + 6);

  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("PHASE DU PROJET", col2X, startY);
  doc.setFillColor(...THEME.primary);
  doc.roundedRect(col2X, startY + 3, 28, 6, 1.5, 1.5, 'F');
  doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont("Helvetica", "bold");
  doc.text(phaseLabel, col2X + 14, startY + 7.5, { align: 'center' });

  let rightY = startY + 20;
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("RÉFÉRENCE PROJET (CODE AFFAIRE)", col2X, rightY);
  doc.setFontSize(11); doc.setTextColor(...THEME.text);
  doc.text(codeAffaire.toUpperCase(), col2X, rightY + 6);

  const block2Y = blockY + 65;
  doc.setFillColor(...THEME.secondary);
  doc.roundedRect(18, block2Y, pageWidth - 36, 40, 3, 3, 'F');
  let b2StartY = block2Y + 12;

  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("PROCÉDURE", col1X, b2StartY);
  doc.setFontSize(10); doc.setTextColor(...THEME.text); doc.setFont("Helvetica", "normal");
  doc.text(doc.splitTextToSize(consultation?.procedure || '—', (pageWidth / 2) - 40), col1X, b2StartY + 5);

  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("LOT", col2X, b2StartY);
  doc.setFontSize(10); doc.setTextColor(...THEME.text); doc.setFont("Helvetica", "normal");
  doc.text(doc.splitTextToSize(consultation?.lot || '—', (pageWidth / 2) - 20), col2X, b2StartY + 5);

  let b2CurrentY = b2StartY + 16;
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("DATE LIMITE REMISE", col1X, b2CurrentY);
  doc.setFontSize(10); doc.setTextColor(...THEME.text); doc.setFont("Helvetica", "normal");
  
  let remiseStr = '—';
  if (consultation?.dateRemise) {
      try {
          const parts = consultation.dateRemise.split('-');
          if(parts.length === 3) remiseStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
          else remiseStr = consultation.dateRemise;
          if (consultation.timeRemise) remiseStr += ` à ${consultation.timeRemise}`;
      } catch(e) {}
  }
  doc.text(remiseStr, col1X, b2CurrentY + 5);

  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("DATE LIMITE APRÈS NÉGO.", col2X, b2CurrentY);
  doc.setFontSize(10); doc.setTextColor(...THEME.text); doc.setFont("Helvetica", "normal");
  doc.text(consultation?.dateNego || '—', col2X, b2CurrentY + 5);

  const footerTopY  = branding?.companyName ? pageHeight - 28 : pageHeight - 20;
  const sigZoneTop  = block2Y + 40 + 6;
  const sigZoneH    = footerTopY - 6 - sigZoneTop;

  if (showSignatures && sigZoneH > 25) {
    const margin = 18; const gap = 4; const n = 4;
    const boxW = (pageWidth - margin * 2 - gap * (n - 1)) / n;
    const labelH = 8;

    for (let i = 0; i < n; i++) {
      const bx = margin + i * (boxW + gap);
      const by = sigZoneTop;
      doc.setFillColor(...THEME.secondary);
      doc.roundedRect(bx, by, boxW, sigZoneH, 2, 2, 'F');
      doc.setDrawColor(...THEME.primary);
      doc.setLineWidth(0.4);
      doc.roundedRect(bx, by, boxW, sigZoneH, 2, 2, 'S');

      doc.setFillColor(...THEME.primary);
      doc.roundedRect(bx, by, boxW, labelH, 2, 2, 'F');
      doc.rect(bx, by + labelH / 2, boxW, labelH / 2, 'F');

      const sigName = (signatories[i] || ['Le Maître d\'Ouvrage', 'Le Maître d\'Œuvre', 'L\'Entreprise', 'Le Bureau de Contrôle'][i]).trim();
      doc.setFontSize(7); doc.setFont("Helvetica", "bold"); doc.setTextColor(255, 255, 255);
      doc.text(sigName.toUpperCase(), bx + boxW / 2, by + labelH / 2 + 1.5, { align: 'center' });

      const luY = by + sigZoneH - 10;
      doc.setDrawColor(...THEME.borders);
      doc.setLineWidth(0.3);
      doc.line(bx + 3, luY, bx + boxW - 3, luY);

      doc.setFontSize(6); doc.setFont("Helvetica", "normal"); doc.setTextColor(...THEME.lightText);
      doc.text('Lu et approuvé — Signature', bx + boxW / 2, by + sigZoneH - 4, { align: 'center' });
    }
  }

  if (branding?.companyName) {
    const footerY = pageHeight - 20;
    doc.setDrawColor(...THEME.borders);
    doc.setLineWidth(0.3);
    doc.line(18, footerY - 8, pageWidth - 18, footerY - 8);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...THEME.primary);
    doc.text(branding.companyName.toUpperCase(), 18, footerY - 3);

    if (branding.tagline) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...THEME.lightText);
      doc.text(branding.tagline, 18, footerY + 2);
    }

    const contactParts = [branding.address, branding.phone, branding.email, branding.website].filter(Boolean);
    if (contactParts.length > 0) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...THEME.lightText);
      doc.text(contactParts.join('  ·  '), pageWidth - 18, footerY - 3, { align: 'right' });
    }

    doc.setFontSize(6);
    doc.text(`Édité le ${today}`, pageWidth - 18, footerY + 2, { align: 'right' });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    doc.setFont("Helvetica", "normal");
    doc.text(`Édité le ${today}`, pageWidth - 18, pageHeight - 12, { align: 'right' });
  }
};

// ── EN-TÊTES ET PIEDS DE PAGES ─────────────────────────────────────────────
const drawHeader = (doc, title, consultation, project, THEME, logoMoe) => {
  const W = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, doc.internal.pageSize.getHeight(), 'F');

  if (logoMoe) {
    const maxW = 35; const maxH = 15;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(logoMoe, 'JPEG', W - 15 - w, 8, w, h);
  }

  doc.setTextColor(...THEME.text);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), 15, 14);
  
  doc.setTextColor(...THEME.lightText);
  doc.setFontSize(8);
  doc.text((consultation?.objet || project?.name || '').toUpperCase(), 15, 20);

  doc.setDrawColor(...THEME.borders);
  doc.setLineWidth(0.5);
  doc.line(15, 25, W - 15, 25);
};

const drawFooter = (doc, pageNum, consultation, project, THEME) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...THEME.borders);
  doc.setLineWidth(0.3);
  doc.line(15, H - 15, W - 15, H - 15);
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.ref || project?.code || '', 15, H - 8);
  doc.text(`Page ${pageNum}`, W - 15, H - 8, { align: 'right' });
};

// ── TITRE DE SECTION (A été modifié pour accepter une couleur dynamique) ──
const sectionTitle = (doc, text, y, colorArr) => {
  doc.setFillColor(...colorArr);
  doc.rect(15, y - 4, 3, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...colorArr);
  doc.text(text, 22, y + 2);
  return y + 10;
};

// ── GÉNÉRATION PRINCIPALE DU RAO ───────────────────────────────────────────
export const generateRaoPDF = async (optionsParams) => {
  const {
    project, consultation, criteria, rao, analysisCompanies, scores, ranking, branding,
    analysisStats, chaptersData, bpuRefMap, activeTrancheId, tranches, analysisMode, scoringConfig
  } = optionsParams;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const THEME = buildTheme(branding);
  
  const logoMoe = await loadLogoFromSource(branding?.logo || '/logo.jpg'); 
  const logoClient = await loadLogoFromSource(project?.clientLogo);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const companiesData = rao.companies || {};
  const companyNames = analysisCompanies.map(c => c.name);
  const today = new Date().toLocaleDateString('fr-FR');
  let pageNum = 1;

  const addPage = (sectionTitle_, format = 'a4', orientation = 'portrait') => {
    doc.addPage(format, orientation);
    pageNum++;
    drawHeader(doc, sectionTitle_, consultation, project, THEME, logoMoe);
    drawFooter(doc, pageNum, consultation, project, THEME);
    return format === 'a3' ? 28 : 35;
  };

  // ── PAGE 1 : COUVERTURE ──
  drawCoverPage(doc, project, consultation, logoMoe, logoClient, today, branding, THEME);

  // ── PAGE 2 : OBJET + CRITÈRES ──
  let y = addPage('Critères de notation', 'a4', 'portrait');
  y = sectionTitle(doc, '1  Objet de la consultation', y, THEME.primary);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...THEME.text);
  doc.text('Objet des travaux', 15, y + 4);
  y += 10;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  const W = doc.internal.pageSize.getWidth();
  const objLines = doc.splitTextToSize(consultation?.objet || project?.name || '—', W - 30);
  doc.text(objLines, 15, y);
  y += objLines.length * 5 + 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.text);
  doc.text('Lieu d\'exécution :', 15, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.lieu || '—', 60, y);
  y += 6;

  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...THEME.text);
  doc.text('Procédure :', 15, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.procedure || '—', 60, y);
  y += 14;

  y = sectionTitle(doc, '2  Remise des dossiers de réponse', y, THEME.primary);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text('Date et heure limites de réception des offres :', 15, y + 4);
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
      } catch(e) {}
  }
  doc.text(remiseStr, W / 2, y + 12, { align: 'center' });
  y += 22;

  if (consultation?.dateNego) {
    y = sectionTitle(doc, '3  Phase de Négociations', y, THEME.primary);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.lightText);
    doc.text('Date et heure limites de réception des offres après négociation :', 15, y + 4);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.text);
    doc.text(consultation.dateNego, W / 2, y + 12, { align: 'center' });
    y += 22;
  }

  y = sectionTitle(doc, '4  Rappel des critères de notation', y, THEME.primary);
  autoTable(doc, {
    startY: y,
    head: [['Critère', 'Intitulé', 'Pondération']],
    body: criteria.map((c, i) => [
      `Critère ${i + 1}`,
      c.label + (c.description ? '\n' + c.description : ''),
      c.weight + '%',
    ]),
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: THEME.primary, textColor: THEME.white, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 22, halign: 'center' } },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: 15, right: 15 },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 14;

  // ── PAGE : RÉPONSES REÇUES ──
  y = addPage('Réponses reçues', 'a4', 'portrait');
  y = sectionTitle(doc, '5  Réponses reçues', y, THEME.primary);
  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...cStyle.header); // Couleur de l'entreprise
    doc.text(`-  ${name}`, 25, y + 4);
    y += 8;
  });

  // ── ANALYSE ADMINISTRATIVE ──
  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    y = addPage(`Analyse administrative — ${name}`, 'a4', 'portrait');
    y = sectionTitle(doc, `ENTREPRISE : ${name}`, y, cStyle.header); // Titre couleur entreprise

    const admin = companiesData[name]?.admin || {};
    const pieces = admin.pieces || {};

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cStyle.header);
    doc.text('PIÈCES ADMINISTRATIVES', 15, y + 4);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [['Pièce', 'Fourni']],
      body: DEFAULT_ADMIN_PIECES.map(p => [p.label, pieces[p.id] === false ? 'NON' : 'OUI']),
      styles: { font: 'Helvetica', fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: cStyle.header, textColor: THEME.white }, // En-tête couleur entreprise
      columnStyles: { 1: { cellWidth: 18, halign: 'center' } },
      didParseCell: (data) => {
        if (data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'NON' ? THEME.no : THEME.yes;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 15, right: 15 },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;

    if (admin.obsAdmin) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const obsLines = doc.splitTextToSize(`Observations : ${admin.obsAdmin}`, W - 30);
      doc.text(obsLines, 15, y);
      y += obsLines.length * 4.5 + 4;
    }

    const concl = admin.conclusion || 'reguliere';
    const conclLabels = { reguliere: 'OFFRE RÉGULIÈRE', irreguliere: 'OFFRE IRRÉGULIÈRE', inacceptable: 'OFFRE INACCEPTABLE', inappropriee: 'OFFRE INAPPROPRIÉE' };
    const conclColors = { reguliere: THEME.yes, irreguliere: THEME.no, inacceptable: THEME.no, inappropriee: THEME.no };
    doc.setFillColor(...(conclColors[concl] || THEME.yes));
    doc.roundedRect(15, y, 80, 10, 2, 2, 'F');
    doc.setTextColor(...THEME.white);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(conclLabels[concl] || concl.toUpperCase(), 55, y + 7, { align: 'center' });
    y += 16;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cStyle.header);
    doc.text('OFFRE DE L\'ENTREPRISE', 15, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Pièce', 'Fourni']],
      body: DEFAULT_OFFER_PIECES.map(p => [p.label, pieces[p.id] === false ? 'NON' : 'OUI']),
      styles: { font: 'Helvetica', fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: cStyle.header, textColor: THEME.white }, // En-tête couleur entreprise
      columnStyles: { 1: { cellWidth: 18, halign: 'center' } },
      didParseCell: (data) => {
        if (data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'NON' ? THEME.no : THEME.yes;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 15, right: 15 },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;

    if (admin.obsOffre) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const obsLines = doc.splitTextToSize(`Observations : ${admin.obsOffre}`, W - 30);
      doc.text(obsLines, 15, y);
    }
  });

  // ── ANALYSE FINANCIÈRE ──
  if (analysisStats && analysisCompanies.length > 0) {
    y = addPage('Analyse financière — Synthèse', 'a4', 'portrait');
    y = sectionTitle(doc, `SYNTHÈSE DE L'ANALYSE FINANCIÈRE`, y, THEME.primary);

    const maxScore = Number(scoringConfig?.maxScore || 40);
    const grandTotalBase = analysisStats.totalEstimation || 0;

    const summaryData = analysisCompanies.map(c => {
      const total = analysisStats.companiesTotals[c.id] || 0;
      const score = analysisStats.companyScores[c.id] || 0;
      const deviation = grandTotalBase > 0 ? ((total - grandTotalBase) / grandTotalBase) * 100 : 0;
      return { id: c.id, name: c.name, total, score, deviation };
    });
    summaryData.sort((a, b) => b.score - a.score);

    const summaryBody = summaryData.map((d, index) => {
      // Retrouver l'index d'origine pour la couleur
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      return [
        { content: `${index + 1}${index === 0 ? 'er' : 'ème'}`, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: d.name, styles: { textColor: cStyle.header, fontStyle: 'bold' } }, // Nom de l'entreprise coloré
        { content: formatNumberFr(d.total) + ' €', styles: { fontStyle: 'bold', halign: 'right' } },
        { content: (d.deviation > 0 ? '+' : '') + d.deviation.toFixed(2) + '%', styles: { textColor: d.deviation > 0 ? [200, 0, 0] : [0, 150, 0], halign: 'center' } },
        { content: d.score.toFixed(2) + ` / ${maxScore}`, styles: { fontStyle: 'bold', halign: 'center' } }
      ];
    });

    autoTable(doc, {
      startY: y + 4,
      head: [['Rang', 'Entreprise', 'Montant HT', 'Écart / Estim.', 'Note Finale']],
      body: summaryBody,
      theme: 'striped',
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 40 }, 4: { cellWidth: 30 } },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });

    if (chaptersData && chaptersData.length > 0) {
      y = addPage('Analyse financière — Détail des Prix Unitaires', 'a3', 'landscape');
      doc.setFontSize(14); doc.setTextColor(...THEME.primary); doc.setFont("Helvetica", "bold");
      doc.text("DÉTAIL DES PRIX UNITAIRES (Format A3)", 15, y);
      
      if (analysisMode === 'oab' || analysisMode === 'heatmap') {
         doc.setFontSize(8); doc.setTextColor(0); doc.setFont("Helvetica", "normal");
         if (analysisMode === 'oab') {
           doc.setFillColor(255, 237, 213); doc.rect(80, y - 3, 4, 4, 'F');
           doc.text("Prix bas suspecté (OAB)", 86, y);
         } else if (analysisMode === 'heatmap') {
           doc.setFillColor(248, 113, 113); doc.rect(80, y - 3, 4, 4, 'F'); doc.text("> +50%", 86, y);
           doc.setFillColor(52, 211, 153); doc.rect(100, y - 3, 4, 4, 'F'); doc.text("< -50%", 106, y);
         }
      }
      y += 6;

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

      analysisCompanies.forEach((company, idx) => {
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
        tableBody.push([{ content: chapter.title.toUpperCase(), colSpan: 6 + (analysisCompanies.length * 3), styles: { fillColor: [220, 220, 225], fontStyle: 'bold', textColor: [50, 50, 60] } }]);
        chapter.items.forEach((item) => {
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
          const itemPrices = analysisCompanies.map(c => Number(c.offers?.[item.id] || 0));
          const lineOabThreshold = analysisMode === 'oab' ? calculateOABThreshold(itemPrices) : 0;

          analysisCompanies.forEach((company) => {
            const priceVal = company.offers?.[item.id];
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

        {
          const chapEstTotal = chapter.items.reduce((acc, i) => acc + (i.activeQty * i.price), 0);
          const isPSE = chapter.isOption;
          // Style : gris-bleu pour base, amber pour PSE/variante
          const bgColor  = isPSE ? [254, 243, 199] : [226, 232, 240]; // amber-100 / slate-200
          const prefix   = isPSE ? 'PSE — ' : 'TOTAL ';
          const chapTotalRow = [
            { content: `${prefix}${chapter.title.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } },
            { content: '', colSpan: 1, styles: { fillColor: bgColor } },
            { content: formatNumberFr(chapEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } }
          ];
          analysisCompanies.forEach(company => {
            const totalChap = chapter.items.reduce((acc, i) => { const p = Number(company.offers?.[i.id] || 0); return acc + (i.activeQty * p); }, 0);
            const deviation = chapEstTotal > 0 ? ((totalChap - chapEstTotal) / chapEstTotal) * 100 : 0;
            chapTotalRow.push({ content: '', styles: { fillColor: bgColor } });
            chapTotalRow.push({ content: formatNumberFr(totalChap), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } });
            chapTotalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%', styles: { halign: 'center', fontSize: 7, fontStyle: 'bold', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: bgColor } });
          });
          tableBody.push(chapTotalRow);
          tableBody.push([{ content: '', colSpan: 6 + (analysisCompanies.length * 3), styles: { cellPadding: 1, fillColor: [255, 255, 255] } }]);
        }
      });

      const totalRow = [{ content: 'TOTAL GÉNÉRAL HT', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: '-', styles: { halign: 'center' } }, { content: formatNumberFr(grandTotalBase), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }];
      analysisCompanies.forEach(company => {
        const total = analysisStats.companiesTotals[company.id] || 0;
        const deviation = grandTotalBase > 0 ? ((total - grandTotalBase) / grandTotalBase) * 100 : 0;
        totalRow.push({ content: '-', styles: { halign: 'center' } });
        totalRow.push({ content: formatNumberFr(total), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255] } });
        totalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(2) + '%', styles: { halign: 'center', fontStyle: 'bold' } });
      });
      tableBody.push(totalRow);

      // ── Lignes PSE par chapitre (sous-total individuel) ─────────────────────
      const optionChaps = chaptersData.filter(c => c.isOption);
      if (optionChaps.length > 0) {
        // Séparateur
        tableBody.push([{ content: '', colSpan: 6 + (analysisCompanies.length * 3), styles: { cellPadding: 1, fillColor: [255, 255, 255] } }]);

        let pse_estTotal = 0;
        const pse_coTotals = {};
        analysisCompanies.forEach(c => { pse_coTotals[c.id] = 0; });

        optionChaps.forEach(chapter => {
          const chapEstTotal = chapter.items.reduce((acc, i) => acc + (i.activeQty * i.price), 0);
          pse_estTotal += chapEstTotal;

          const pseRow = [
            { content: `OPTION — ${chapter.title.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'italic', halign: 'right', textColor: [146, 64, 14], fillColor: [255, 251, 235] } },
            { content: '', styles: { fillColor: [255, 251, 235] } },
            { content: formatNumberFr(chapEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 251, 235] } }
          ];
          analysisCompanies.forEach(company => {
            const totalChap = chapter.items.reduce((acc, i) => { const p = Number(company.offers?.[i.id] || 0); return acc + (i.activeQty * p); }, 0);
            pse_coTotals[company.id] += totalChap;
            const deviation = chapEstTotal > 0 ? ((totalChap - chapEstTotal) / chapEstTotal) * 100 : 0;
            pseRow.push({ content: '', styles: { fillColor: [255, 251, 235] } });
            pseRow.push({ content: totalChap > 0 ? formatNumberFr(totalChap) : '-', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 251, 235] } });
            pseRow.push({ content: totalChap > 0 ? (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%' : '-', styles: { halign: 'center', fontSize: 7, textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: [255, 251, 235] } });
          });
          tableBody.push(pseRow);
        });

        // ── Ligne TOTAL BASE + PSE (toutes options)
        const totalWithPse_est = grandTotalBase + pse_estTotal;
        const totalPseRow = [
          { content: 'TOTAL BASE + PSE (TOUTES OPTIONS)', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 208, 254], textColor: [88, 28, 135] } },
          { content: '', styles: { fillColor: [245, 208, 254] } },
          { content: formatNumberFr(totalWithPse_est), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 208, 254] } }
        ];
        analysisCompanies.forEach(company => {
          const baseTotal = analysisStats.companiesTotals[company.id] || 0;
          const totalWithPse = baseTotal + (pse_coTotals[company.id] || 0);
          const deviation = totalWithPse_est > 0 ? ((totalWithPse - totalWithPse_est) / totalWithPse_est) * 100 : 0;
          totalPseRow.push({ content: '', styles: { fillColor: [245, 208, 254] } });
          totalPseRow.push({ content: formatNumberFr(totalWithPse), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 208, 254], textColor: [88, 28, 135] } });
          totalPseRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(2) + '%', styles: { halign: 'center', fontStyle: 'bold', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: [245, 208, 254] } });
        });
        tableBody.push(totalPseRow);
      }

      autoTable(doc, {
        startY: y,
        head: [mainHeaders, subHeaders],
        body: tableBody,
        theme: 'grid',
        styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [180, 180, 180] },
        columnStyles,
        didDrawCell: (data) => {
          if (data.column.index >= 6 && (data.column.index - 6) % 3 === 0 && data.section === 'body') {
            const d = data.doc;
            d.setDrawColor(100, 100, 100); d.setLineWidth(0.3);
            d.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
          }
        },
        margin: { left: 10, right: 10 },
        didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
      });
    }
  }

  // ── ANALYSE TECHNIQUE ──
  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    const tech = companiesData[name]?.technical || {};
    const nonAutoCriteria = criteria.filter(c => !c.auto);
    if (nonAutoCriteria.length === 0) return;

    y = addPage(`Analyse technique — ${name}`, 'a4', 'portrait');
    y = sectionTitle(doc, `ANALYSE TECHNIQUE — ${name}`, y, cStyle.header); // Titre coloré !

    let noteTotal = 0;
    nonAutoCriteria.forEach((crit) => {
      if (y > 297 - 60) { y = addPage(`Analyse technique — ${name}`, 'a4', 'portrait'); }

      const d = tech[crit.id] || {};
      const note = Number(d.note || 0);
      const noteMax = Number(d.noteMax || 5);
      const notePond = noteMax > 0 ? (note / noteMax) * crit.weight : 0;
      noteTotal += notePond;

      doc.setFillColor(...cStyle.body); // Fond coloré clair
      doc.rect(15, y, W - 30, 9, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cStyle.header); // Texte coloré foncé
      doc.text(`${crit.label}`, 18, y + 6);
      doc.setTextColor(...THEME.text);
      doc.text(`Note /20`, W - 15, y + 6, { align: 'right' });
      y += 14;

      if (d.text) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...THEME.lightText);
        const lines = doc.splitTextToSize(d.text, W - 30);
        const maxLines = Math.floor((297 - y - 35) / 4.5);
        const visibleLines = lines.slice(0, maxLines);
        doc.text(visibleLines, 15, y);
        y += visibleLines.length * 4.5 + 4;
        if (lines.length > maxLines) {
          const remainLines = lines.slice(maxLines);
          y = addPage(`Analyse technique — ${name}`, 'a4', 'portrait');
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.lightText);
          doc.text(remainLines, 15, y);
          y += remainLines.length * 4.5 + 4;
        }
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...THEME.text);
      doc.text(`La note retenue est de ${note}/${noteMax} soit pondérée :`, 15, y);
      y += 6;
      doc.setFillColor(...cStyle.header); // Bouton de note coloré !
      doc.roundedRect(W - 50, y - 5, 35, 10, 2, 2, 'F');
      doc.setTextColor(...THEME.white);
      doc.setFontSize(11);
      doc.text(fmtScore(notePond), W - 32.5, y + 2, { align: 'center' });
      y += 14;
    });

    doc.setFillColor(...cStyle.header); // Total coloré !
    doc.rect(15, y, W - 30, 10, 'F');
    doc.setTextColor(...THEME.white);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('NOTE TECHNIQUE ATTRIBUÉE À L\'ENTREPRISE', 18, y + 7);
    doc.text(fmtScore(noteTotal), W - 18, y + 7, { align: 'right' });
    y += 18;
  });

  // ── NÉGOCIATION ──
  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    const nego = companiesData[name]?.negotiation || {};
    if (!nego.questions && !nego.responses) return;

    y = addPage(`Négociation — ${name}`, 'a4', 'portrait');
    y = sectionTitle(doc, `NÉGOCIATION — ${name}`, y, cStyle.header); // Titre coloré !

    if (nego.questions) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cStyle.header); // Surtitre coloré !
      doc.text('Dans le cadre des négociations, nous avons questionné l\'entreprise sur les points suivants :', 15, y);
      y += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const qLines = doc.splitTextToSize(nego.questions, W - 30);
      doc.text(qLines, 15, y);
      y += qLines.length * 4.5 + 10;
    }

    if (nego.responses) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cStyle.header); // Surtitre coloré !
      doc.text('RÉPONSES DE L\'ENTREPRISE', 15, y);
      y += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const rLines = doc.splitTextToSize(nego.responses, W - 30);
      doc.text(rLines, 15, y);
    }
  });

  // ── RÉCAPITULATIF FINAL ──
  y = addPage('Récapitulatif général', 'a4', 'portrait');
  y = sectionTitle(doc, 'RÉCAPITULATIF GÉNÉRAL APRÈS NÉGOCIATION', y, THEME.primary);

  const priceC = criteria.find(c => c.auto) || criteria[0];
  const techCs = criteria.filter(c => !c.auto);

  const headCols = [
    'Entreprise', 
    ...techCs.map(c => c.label.length > 25 ? c.label.slice(0, 25) + '…' : c.label), 
    `C1 Prix\n/${priceC?.weight || 60} pts`, 
    'Prix HT', 
    'Total\n/100', 
    'Rang'
  ];

  const bodyRows = ranking.map((r) => [
    r.rank === 1 ? `${r.name.toUpperCase()}\n(Mieux-disant)` : r.name.toUpperCase(),
    ...techCs.map(c => fmtScore(r.techScores?.[c.id] || 0)),
    fmtScore(r.priceScore || 0),
    fmt(r.price) + ' €',
    fmtScore(r.totalScore),
    `${r.rank}`,
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [headCols],
    body: bodyRows,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 4, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: THEME.primary, textColor: THEME.white, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 
      0: { halign: 'left', fontStyle: 'bold', minCellWidth: 35 },
      [headCols.length - 3]: { halign: 'right', minCellWidth: 26 }, 
      [headCols.length - 2]: { fontStyle: 'bold', textColor: THEME.primary, fontSize: 9 }, 
      [headCols.length - 1]: { fontStyle: 'bold', fontSize: 10 }
    },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rank = parseInt(bodyRows[data.row.index][headCols.length - 1], 10);
        
        // Retrouver la couleur de l'entreprise pour son nom
        const rName = ranking[data.row.index].name;
        const originalIdx = analysisCompanies.findIndex(c => c.name === rName);
        const cStyle = getCompanyStyle(originalIdx !== -1 ? originalIdx : 0);

        if (data.column.index === 0) {
           data.cell.styles.textColor = cStyle.header;
        }

        if (rank === 1) {
          data.cell.styles.fillColor = [235, 248, 240];
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
    },
    margin: { left: 15, right: 15 },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 12;

  const winner = ranking[0];
  if (winner) {
    doc.setFillColor(...THEME.primary);
    doc.roundedRect(15, y, W - 30, 16, 3, 3, 'F');
    doc.setTextColor(...THEME.white);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`RECOMMANDATION : L'entreprise ${winner.name.toUpperCase()} est classée 1ère (Mieux-disante).`, W / 2, y + 6, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Score final : ${fmtScore(winner.totalScore)} / 100  —  Montant de l'offre : ${fmt(winner.price)} € HT`, W / 2, y + 12, { align: 'center' });
  }

  const safeName = (consultation?.objet || project?.name || 'RAO').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  doc.save(`RAO_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};