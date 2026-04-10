// src/utils/pdfRaoGenerator.js
// Génère le PDF du Rapport d'Analyse des Offres (RAO)
// INCLUT l'Analyse Financière (Synthèse A4 + Détails A3) avec codes couleurs par entreprise
// Style : Vert Papyrus — typographie H1 14pt / H2 12pt / body 9pt — marges 15mm

import { DEFAULT_CRITERIA, DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../hooks/useRao';
import { normalizeUnitSymbol } from './helpers';
import { loadImage, formatNumberFr, cleanText } from './pdf/pdfSharedHelpers';
import { buildTheme as _buildTheme } from './pdf/buildTheme';

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

// ─── HELPERS FORMATAGE ──────────────────────────────────────────────────────
const fmt = (n) => {
  if (typeof n !== 'number') return n || '—';
  const fixed = n.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
};
const fmtScore = (n) => typeof n === 'number' ? n.toFixed(2) : '—';

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

// ─── HELPERS VISUELS ────────────────────────────────────────────────────────
// Barre de score CARRÉE (pas arrondie)
const drawScoreBar = (doc, x, y, w, h, score, maxScore, color) => {
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
  // Texte centré dans la barre
  const fs = h > 5 ? 7 : 5.5;
  doc.setFontSize(fs);
  doc.setFont('Helvetica', 'bold');
  const textY = y + h / 2 + fs * 0.13;
  const textX = pct > 0.15 ? x + (w * pct) / 2 : x + w * pct + 4;
  doc.setTextColor(pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60);
  doc.text(fmtScore(score), textX, textY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

// ─── CONSTANTES LAYOUT ─────────────────────────────────────────────────────
const M = 15; // marge standard 15mm

// ─── PAGE DE GARDE (inchangée, utilise THEME) ──────────────────────────────
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

// ── EN-TÊTE : bande verte pleine + titre blanc ────────────────────────────
const drawHeader = (doc, title, consultation, project, THEME, logoMoe) => {
  const W = doc.internal.pageSize.getWidth();

  // Bande latérale verte
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, doc.internal.pageSize.getHeight(), 'F');

  // Bandeau header : fond vert plein avec texte blanc
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, W, 22, 'F');

  if (logoMoe) {
    const maxW = 30; const maxH = 12;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(logoMoe, 'JPEG', W - M - w, 5, w, h);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12); // H2
  doc.text(title.toUpperCase(), M, 10);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text((consultation?.objet || project?.name || '').toUpperCase(), M, 17);
};

// ── PIED DE PAGE : Réf + Date + Page ──────────────────────────────────────
const drawFooter = (doc, pageNum, consultation, project, THEME) => {
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
  doc.text(`Page ${pageNum}`, W - M, H - 9, { align: 'right' });
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
    project, consultation, criteria, rao, analysisCompanies, scores, ranking, branding,
    analysisStats, chaptersData, bpuRefMap, activeTrancheId, tranches, analysisMode, scoringConfig
  } = optionsParams;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const THEME = buildTheme(branding);

  const logoMoe = await loadImage(branding?.logo || '/logo.jpg');
  const logoClient = await loadImage(project?.clientLogo);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const companiesData = rao.companies || {};
  const companyNames = analysisCompanies.map(c => c.name);
  const today = new Date().toLocaleDateString('fr-FR');
  const W = doc.internal.pageSize.getWidth();
  let pageNum = 1;

  // Tracking des sections pour le sommaire (on enregistre la page de début)
  const tocEntries = [];

  const addPage = (sectionTitle_, format = 'a4', orientation = 'portrait') => {
    doc.addPage(format, orientation);
    pageNum++;
    drawHeader(doc, sectionTitle_, consultation, project, THEME, logoMoe);
    drawFooter(doc, pageNum, consultation, project, THEME);
    return 30; // espace après header standardisé
  };

  // ── PAGE 1 : COUVERTURE ──
  drawCoverPage(doc, project, consultation, logoMoe, logoClient, today, branding, THEME);

  // ── PAGE 2 : SOMMAIRE ──
  // On insère une page placeholder pour le sommaire — on la remplira à la fin
  const sommairePage = pageNum + 1;
  doc.addPage('a4', 'portrait');
  pageNum++;
  drawHeader(doc, 'Sommaire', consultation, project, THEME, logoMoe);
  drawFooter(doc, pageNum, consultation, project, THEME);
  // On garde la référence de cette page pour la remplir plus tard
  const sommairePageIndex = doc.internal.getNumberOfPages();

  // ── PAGE 3 : OBJET + CRITÈRES ──
  let y = addPage('Critères de notation', 'a4', 'portrait');
  tocEntries.push({ label: '1. Objet de la consultation', page: pageNum });
  y = sectionTitle(doc, '1  Objet de la consultation', y, THEME.primary);

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
  tocEntries.push({ label: '2. Remise des dossiers de réponse', page: pageNum });
  y = sectionTitle(doc, '2  Remise des dossiers de réponse', y, THEME.primary);
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
      } catch(e) {}
  }
  doc.text(remiseStr, W / 2, y + 10, { align: 'center' });
  y += 18;

  if (consultation?.dateNego) {
    tocEntries.push({ label: '3. Phase de Négociations', page: pageNum });
    y = sectionTitle(doc, '3  Phase de Négociations', y, THEME.primary);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.lightText);
    doc.text('Date et heure limites de réception des offres après négociation :', M, y + 2);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.text);
    doc.text(consultation.dateNego, W / 2, y + 10, { align: 'center' });
    y += 18;
  }

  // Section 4 : Critères de notation
  tocEntries.push({ label: '4. Rappel des critères de notation', page: pageNum });
  y = sectionTitle(doc, '4  Rappel des critères de notation', y, THEME.primary);
  const criteriaBody = [];
  criteria.forEach((c, i) => {
    const hasSubs = (c.subCriteria || []).length > 0;
    const weight = c.auto ? (scoringConfig?.maxScore || c.weight) : (hasSubs ? c.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0) : c.weight);
    criteriaBody.push([
      { content: `Critère ${i + 1}`, styles: { fontStyle: 'bold' } },
      { content: c.label + (!hasSubs && c.description ? '\n' + c.description : ''), styles: { fontStyle: 'bold' } },
      { content: weight + '%', styles: { fontStyle: 'bold' } },
    ]);
    if (hasSubs) {
      c.subCriteria.forEach((sc, si) => {
        criteriaBody.push([
          { content: `  ${i + 1}.${si + 1}`, styles: { textColor: [100, 100, 100] } },
          { content: sc.label + (sc.description ? '\n' + sc.description : ''), styles: { textColor: [80, 80, 80], fontSize: 7 } },
          { content: (sc.weight || 0) + '%', styles: { textColor: [100, 100, 100] } },
        ]);
      });
    }
  });
  autoTable(doc, {
    startY: y,
    head: [['Critère', 'Intitulé', 'Pondération']],
    body: criteriaBody,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 22, halign: 'center' } },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── PAGE : RÉPONSES REÇUES ──
  y = addPage('Réponses reçues', 'a4', 'portrait');
  tocEntries.push({ label: '5. Réponses reçues', page: pageNum });
  y = sectionTitle(doc, '5  Réponses reçues', y, THEME.primary);

  // Calculer la position X alignée pour toutes les pastilles (après le nom le plus long)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  const maxNameW = Math.max(...companyNames.map(n => doc.getTextWidth(`-  ${n}`)));
  const pastilleAlignX = 25 + maxNameW + 6;

  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    const admin = companiesData[name]?.admin || {};
    const concl = admin.conclusion || 'reguliere';
    const conclLabels = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
    const conclColors = { reguliere: THEME.yes, irreguliere: [255, 140, 0], inacceptable: THEME.no, inappropriee: THEME.no };

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cStyle.header);
    doc.text(`-  ${name}`, 25, y + 4);

    // Pastille conclusion — alignée verticalement
    const conclText = conclLabels[concl] || 'RÉGULIÈRE';
    const conclW = doc.getTextWidth(conclText) + 6;
    doc.setFillColor(...(conclColors[concl] || THEME.yes));
    doc.roundedRect(pastilleAlignX, y, conclW, 6, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(conclText, pastilleAlignX + conclW / 2, y + 4.2, { align: 'center' });

    // Membres groupement
    if (admin.isGroupement && admin.groupementMembers?.length > 0) {
      y += 7;
      admin.groupementMembers.forEach(m => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...THEME.lightText);
        doc.text(`     ${m.role || 'Cotraitant'} : ${m.name || '—'}`, 30, y + 3);
        y += 5;
      });
    }
    y += 8;
  });

  // ── ANALYSE ADMINISTRATIVE — Tableau comparatif unique ──
  {
    y = addPage('Analyse administrative', 'a4', 'portrait');
    tocEntries.push({ label: '6. Analyse administrative', page: pageNum });
    y = sectionTitle(doc, '6  ANALYSE ADMINISTRATIVE — PIÈCES DE CANDIDATURE', y, THEME.primary);

    const conclLabelsA = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
    const conclColorsA = { reguliere: THEME.yes, irreguliere: [255, 140, 0], inacceptable: THEME.no, inappropriee: THEME.no };

    const adminHead = ['Pièce', ...companyNames];
    const colW = Math.max(14, Math.min(22, (W - 2 * M - 55) / companyNames.length));

    const adminBody = [];
    adminBody.push([{ content: 'PIÈCES ADMINISTRATIVES', colSpan: adminHead.length, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
    DEFAULT_ADMIN_PIECES.forEach(p => {
      adminBody.push([p.label, ...companyNames.map(name => {
        const pieces = companiesData[name]?.admin?.pieces || {};
        return pieces[p.id] === false ? 'NON' : 'OUI';
      })]);
    });
    adminBody.push([{ content: 'OFFRE DE L\'ENTREPRISE', colSpan: adminHead.length, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
    DEFAULT_OFFER_PIECES.forEach(p => {
      adminBody.push([p.label, ...companyNames.map(name => {
        const pieces = companiesData[name]?.admin?.pieces || {};
        return pieces[p.id] === false ? 'NON' : 'OUI';
      })]);
    });
    // Ligne conclusion
    adminBody.push([{ content: 'CONCLUSION', styles: { fontStyle: 'bold' } }, ...companyNames.map(name => {
      const concl = companiesData[name]?.admin?.conclusion || 'reguliere';
      return conclLabelsA[concl] || 'RÉGULIÈRE';
    })]);

    const compColStyles = {};
    companyNames.forEach((_, ci) => { compColStyles[ci + 1] = { cellWidth: colW, halign: 'center', fontSize: 7 }; });

    autoTable(doc, {
      startY: y,
      head: [adminHead],
      body: adminBody,
      styles: { font: 'Helvetica', fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: { 0: { cellWidth: 60, fontSize: 7 }, ...compColStyles },
      alternateRowStyles: { fillColor: THEME.tableAlt },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          if (data.cell.raw === 'OUI') { data.cell.styles.textColor = THEME.yes; data.cell.styles.fontStyle = 'bold'; }
          else if (data.cell.raw === 'NON') { data.cell.styles.textColor = THEME.no; data.cell.styles.fontStyle = 'bold'; }
          const conclVals = Object.values(conclLabelsA);
          if (conclVals.includes(data.cell.raw)) {
            const conclKey = Object.keys(conclLabelsA).find(k => conclLabelsA[k] === data.cell.raw) || 'reguliere';
            data.cell.styles.textColor = conclColorsA[conclKey] || THEME.yes;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 6;
          }
        }
        if (data.section === 'head' && data.column.index > 0) {
          const cStyle = getCompanyStyle(data.column.index - 1);
          data.cell.styles.fillColor = cStyle.header;
        }
      },
      margin: { left: M, right: M },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── ANALYSE FINANCIÈRE ──
  if (analysisStats && analysisCompanies.length > 0) {
    y = addPage('Analyse financière — Synthèse', 'a4', 'portrait');
    tocEntries.push({ label: '7. Synthèse de l\'analyse financière', page: pageNum });
    y = sectionTitle(doc, `7  SYNTHÈSE DE L'ANALYSE FINANCIÈRE`, y, THEME.primary);

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
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const ttc = d.total * 1.2;
      return [
        { content: `${index + 1}${index === 0 ? 'er' : 'ème'}`, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: d.name, styles: { textColor: cStyle.header, fontStyle: 'bold' } },
        { content: formatNumberFr(d.total) + ' €', styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatNumberFr(ttc) + ' €', styles: { halign: 'right' } },
        { content: (d.deviation > 0 ? '+' : '') + d.deviation.toFixed(2) + '%', styles: { textColor: d.deviation > 0 ? [200, 0, 0] : [0, 150, 0], halign: 'center' } },
        { content: d.score.toFixed(2) + ` / ${maxScore}`, styles: { fontStyle: 'bold', halign: 'center' } }
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [['Rang', 'Entreprise', 'Montant HT', 'Montant TTC', 'Écart / Estim.', 'Note Finale']],
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
      drawScoreBar(doc, 55, y, barW, bHf, d.total, maxTotal, cStyle.header);
      doc.setTextColor(...THEME.lightText);
      doc.setFontSize(6);
      doc.text(fmt(d.total) + ' €', 55 + barW + 2, y + bHf / 2 + 1);
      y += 9;
    });
    y += 6;

    if (chaptersData && chaptersData.length > 0) {
      y = addPage('Analyse financière — Détail des Prix Unitaires', 'a3', 'landscape');
      tocEntries.push({ label: '8. Détail des prix unitaires (A3)', page: pageNum });
      doc.setFontSize(14); doc.setTextColor(...THEME.primary); doc.setFont("Helvetica", "bold");
      doc.text("DÉTAIL DES PRIX UNITAIRES (Format A3)", M, y);

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
          const bgColor  = isPSE ? [254, 243, 199] : [226, 232, 240];
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

      // PSE par chapitre
      const optionChaps = chaptersData.filter(c => c.isOption);
      if (optionChaps.length > 0) {
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

  // ── ANALYSE TECHNIQUE — Regroupé par critère ──
  {
    const nonAutoCriteria = criteria.filter(c => !c.auto);
    if (nonAutoCriteria.length > 0) {
      y = addPage('Analyse technique', 'a4', 'portrait');
      tocEntries.push({ label: '9. Analyse technique', page: pageNum });

      nonAutoCriteria.forEach((crit, critIdx) => {
        if (y > 297 - 70) { y = addPage('Analyse technique', 'a4', 'portrait'); }
        const hasSubs = (crit.subCriteria || []).length > 0;

        // Header critère — fond vert avec poids
        y = sectionTitle(doc, `${crit.label}  (${crit.weight}%)`, y, THEME.primary);

        if (hasSubs) {
          crit.subCriteria.forEach((sc, si) => {
            if (y > 297 - 60) { y = addPage('Analyse technique', 'a4', 'portrait'); }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...VERT_FONCE);
            doc.text(`${critIdx + 2}.${si + 1}  ${sc.label || 'Sous-critère'}  (${sc.weight || 0}%)`, M + 3, y + 3);
            y += 7;

            companyNames.forEach((name, ci) => {
              if (y > 297 - 25) { y = addPage('Analyse technique', 'a4', 'portrait'); }
              const cStyle = getCompanyStyle(ci);
              const tech = companiesData[name]?.technical || {};
              const sd = tech[sc.id] || {};
              const sNote = Number(sd.note || 0);
              const sMax = Number(sd.noteMax || 5);
              const sPond = sMax > 0 ? (sNote / sMax) * (Number(sc.weight) || 0) : 0;

              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(7);
              doc.setTextColor(...cStyle.header);
              const bH = 5;
              doc.text(name, M + 5, y + bH / 2 + 1);
              drawScoreBar(doc, 68, y, W - 110, bH, sPond, sc.weight || 1, cStyle.header);
              doc.setTextColor(...THEME.text);
              doc.setFontSize(6.5);
              doc.text(`${sNote}/${sMax} = ${fmtScore(sPond)}`, W - M, y + bH / 2 + 1, { align: 'right' });
              y += bH + 4;

              if (sd.text) {
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(...THEME.lightText);
                const lines = doc.splitTextToSize(sd.text, W - 2 * M - 10);
                let remaining = [...lines];
                while (remaining.length > 0) {
                  const maxL = Math.floor((297 - y - 20) / 3.8);
                  if (maxL <= 0) { y = addPage('Analyse technique', 'a4', 'portrait'); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...THEME.lightText); continue; }
                  const batch = remaining.splice(0, maxL);
                  doc.text(batch, M + 10, y);
                  y += batch.length * 3.8 + 2;
                }
                y += 2;
              }
            });
            y += 6;
          });
        } else {
          companyNames.forEach((name, ci) => {
            if (y > 297 - 25) { y = addPage('Analyse technique', 'a4', 'portrait'); }
            const cStyle = getCompanyStyle(ci);
            const tech = companiesData[name]?.technical || {};
            const d = tech[crit.id] || {};
            const note = Number(d.note || 0);
            const noteMax = Number(d.noteMax || 5);
            const notePond = noteMax > 0 ? (note / noteMax) * crit.weight : 0;

            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(...cStyle.header);
            const bH2 = 5;
            doc.text(name, M, y + bH2 / 2 + 1);
            drawScoreBar(doc, 68, y, W - 110, bH2, notePond, crit.weight, cStyle.header);
            doc.setTextColor(...THEME.text);
            doc.setFontSize(6.5);
            doc.text(`${note}/${noteMax} = ${fmtScore(notePond)}`, W - M, y + bH2 / 2 + 1, { align: 'right' });
            y += bH2 + 4;

            if (d.text) {
              doc.setFont('Helvetica', 'normal');
              doc.setFontSize(7.5);
              doc.setTextColor(...THEME.lightText);
              const lines = doc.splitTextToSize(d.text, W - 2 * M - 5);
              let remaining = [...lines];
              while (remaining.length > 0) {
                const maxL = Math.floor((297 - y - 20) / 3.8);
                if (maxL <= 0) { y = addPage('Analyse technique', 'a4', 'portrait'); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...THEME.lightText); continue; }
                const batch = remaining.splice(0, maxL);
                doc.text(batch, M + 5, y);
                y += batch.length * 3.8 + 2;
              }
              y += 2;
            }
          });
        }
        y += 6;
      });

      // Tableau récap des notes techniques
      if (y > 297 - 50) { y = addPage('Analyse technique', 'a4', 'portrait'); }
      y = sectionTitle(doc, 'Récapitulatif des notes techniques', y, THEME.primary);
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
        const tech = companiesData[name]?.technical || {};
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
  }

  // ── NÉGOCIATION ──
  companyNames.forEach((name, idx) => {
    const cStyle = getCompanyStyle(idx);
    const nego = companiesData[name]?.negotiation || {};
    if (!nego.questions && !nego.responses) return;

    y = addPage(`Négociation — ${name}`, 'a4', 'portrait');
    if (!tocEntries.find(e => e.label.startsWith('10.'))) {
      tocEntries.push({ label: '10. Négociations', page: pageNum });
    }
    y = sectionTitle(doc, `NÉGOCIATION — ${name}`, y, cStyle.header);

    if (nego.questions) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cStyle.header);
      doc.text('Dans le cadre des négociations, nous avons questionné l\'entreprise sur les points suivants :', M, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...THEME.lightText);
      const qLines = doc.splitTextToSize(nego.questions, W - 2 * M);
      let qRemaining = [...qLines];
      while (qRemaining.length > 0) {
        const maxL = Math.floor((297 - y - 20) / 4.5);
        if (maxL <= 0) { y = addPage(`Négociation — ${name}`, 'a4', 'portrait'); doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...THEME.lightText); continue; }
        const batch = qRemaining.splice(0, maxL);
        doc.text(batch, M, y);
        y += batch.length * 4.5 + 2;
      }
      y += 6;
    }

    if (nego.responses) {
      if (y > 260) { y = addPage(`Négociation — ${name}`, 'a4', 'portrait'); }
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cStyle.header);
      doc.text('RÉPONSES DE L\'ENTREPRISE', M, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...THEME.lightText);
      const rLines = doc.splitTextToSize(nego.responses, W - 2 * M);
      let rRemaining = [...rLines];
      while (rRemaining.length > 0) {
        const maxL = Math.floor((297 - y - 20) / 4.5);
        if (maxL <= 0) { y = addPage(`Négociation — ${name}`, 'a4', 'portrait'); doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...THEME.lightText); continue; }
        const batch = rRemaining.splice(0, maxL);
        doc.text(batch, M, y);
        y += batch.length * 4.5 + 2;
      }
    }
  });

  // ── RÉCAPITULATIF FINAL ──
  y = addPage('Récapitulatif général', 'a4', 'portrait');
  tocEntries.push({ label: '11. Récapitulatif général', page: pageNum });
  y = sectionTitle(doc, 'RÉCAPITULATIF GÉNÉRAL', y, THEME.primary);

  const priceC = criteria.find(c => c.auto) || criteria[0];
  const techCs = criteria.filter(c => !c.auto);

  const maxScorePrice = Number(scoringConfig?.maxScore || 50);
  const headCols = [
    'Entreprise',
    ...techCs.map(c => c.label.length > 25 ? c.label.slice(0, 25) + '...' : c.label),
    `C1 Prix\n/${maxScorePrice} pts`,
    'Prix HT',
    'Total\n/100',
    'Rang'
  ];

  const bodyRows = ranking.map((r) => [
    r.name.toUpperCase(),
    ...techCs.map(c => fmtScore(r.techScores?.[c.id] || 0)),
    fmtScore(r.priceScore || 0),
    fmt(r.price) + ' €',
    fmtScore(r.totalScore),
    `${r.rank}`,
  ]);

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
        const rank = parseInt(bodyRows[data.row.index][headCols.length - 1], 10);

        const rName = ranking[data.row.index].name;
        const originalIdx = analysisCompanies.findIndex(c => c.name === rName);
        const cStyle = getCompanyStyle(originalIdx !== -1 ? originalIdx : 0);

        if (data.column.index === 0) {
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
    },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Barres empilées (prix + technique) ──
  if (y < 297 - 60) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...VERT_FONCE);
    doc.text('VISUALISATION DES SCORES', M, y + 3);
    y += 8;
    const barMaxW = W - 80;
    ranking.forEach((r) => {
      if (y > 280) return;
      const origIdx = analysisCompanies.findIndex(c => c.name === r.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      const priceW = barMaxW * (r.priceScore || 0) / 100;
      const techW = barMaxW * techTotal / 100;

      const barH = 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...cStyle.header);
      doc.text(r.name, M, y + barH / 2 + 6.5 * 0.13);

      // Fond gris
      doc.setFillColor(235, 235, 240);
      doc.rect(55, y, barMaxW, barH, 'F');
      // Barre prix (vert papyrus)
      if (priceW > 2) {
        doc.setFillColor(...VERT_PAPYRUS);
        doc.rect(55, y, priceW, barH, 'F');
        if (priceW > 12) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
          doc.text(fmtScore(r.priceScore || 0), 55 + priceW / 2, y + barH / 2 + 0.8, { align: 'center' });
        }
      }
      // Barre technique (bleu)
      if (techW > 2) {
        doc.setFillColor(59, 130, 246);
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

  // ── Avertissement OAB si applicable ──
  const allTotals = ranking.map(r => r.price).filter(p => p > 0);
  const oabThreshold = calculateOABThreshold(allTotals);
  const oabCompanies = ranking.filter(r => r.price > 0 && r.price < oabThreshold);
  if (oabCompanies.length > 0) {
    if (y > 260) { y = addPage('Récapitulatif général', 'a4', 'portrait'); }
    doc.setFillColor(255, 237, 213);
    doc.roundedRect(M, y, W - 2 * M, 22, 3, 3, 'F');
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(M, y, W - 2 * M, 22, 3, 3, 'S');
    doc.setTextColor(180, 83, 9);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OFFRE(S) ANORMALEMENT BASSE(S) DÉTECTÉE(S)', W / 2, y + 6, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    const oabNames = oabCompanies.map(r => r.name).join(', ');
    doc.text(`${oabNames} — Seuil OAB : ${fmt(oabThreshold)} € HT (méthode Double Moyenne)`, W / 2, y + 12, { align: 'center' });
    doc.text('Conformément aux articles L2152-5 et R2152-3 du CCP, le pouvoir adjudicateur doit demander des précisions', W / 2, y + 17, { align: 'center' });
    doc.text('sur le prix proposé avant tout rejet éventuel de l\'offre (CE, 1er mars 2012, n°354159).', W / 2, y + 21, { align: 'center' });
    y += 28;
  }

  // ── Recommandation conforme CCP ──
  const winner = ranking[0];
  if (winner) {
    if (y > 265) { y = addPage('Récapitulatif général', 'a4', 'portrait'); }
    doc.setFillColor(...THEME.primary);
    doc.roundedRect(M, y, W - 2 * M, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Au regard des critères d'attribution définis dans les documents de consultation,`, W / 2, y + 6, { align: 'center' });
    doc.text(`l'offre de l'entreprise ${winner.name.toUpperCase()} est l'offre économiquement la plus avantageuse.`, W / 2, y + 12, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Score : ${fmtScore(winner.totalScore)} / 100  —  Montant : ${fmt(winner.price)} € HT  —  ${fmt(winner.price * 1.2)} € TTC`, W / 2, y + 18, { align: 'center' });
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

  const safeName = (consultation?.objet || project?.name || 'RAO').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  doc.save(`RAO_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
