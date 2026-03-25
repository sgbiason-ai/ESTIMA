// src/utils/pdfGenerator.js
//
// ═══════════════════════════════════════════════════════════════════
// CE QUI A CHANGÉ PAR RAPPORT À L'ORIGINAL :
//
//  1. `hexToRgbArray(hex)` — [NOUVEAU] convertit '#286E55' → [40, 110, 85]
//     jsPDF exige des tableaux RGB, pas des codes hex.
//
//  2. `buildTheme(branding)` — [NOUVEAU] construit l'objet THEME
//     depuis les couleurs du branding. Fallback sur THEME par défaut
//     si aucun branding n'est passé.
//
//  3. `drawCoverPage` — reçoit `branding` en 7ème argument.
//     Utilise les couleurs dynamiques du thème.
//     Affiche les infos MOE (nom, adresse, tél, email, site)
//     dans le pied de page si renseignées dans le branding.
//
//  4. `generateProfessionalPDF` — passe `branding` à `drawCoverPage`
//     et reconstruit le THEME dynamique pour les en-têtes de tableaux.
//
// Tout le reste est IDENTIQUE à l'original.
// ═══════════════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanText, formatPrice, getItemRefMap, normalizeUnitSymbol } from './helpers';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from './fileSaver';

// ─── THÈME PAR DÉFAUT ─────────────────────────────────────────────────────────
// Utilisé si aucun branding n'est passé en paramètre.
const DEFAULT_THEME = {
  primary:   [40, 110, 85],
  chapterBg: [200, 245, 225],
  secondary: [245, 250, 248],
  accent:    [50, 180, 130],
  pse:       [180, 83, 9],
  text:      [40, 40, 40],
  lightText: [100, 116, 139],
  borders:   [220, 235, 230],
};

// ─── [NOUVEAU] CONVERSION HEX → RGB ──────────────────────────────────────────
// jsPDF ne comprend pas les codes hexadécimaux.
// Ex : hexToRgbArray('#286E55') → [40, 110, 85]
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

// ─── [NOUVEAU] CONSTRUCTION DU THÈME DEPUIS LE BRANDING ──────────────────────
// Si branding.colors est renseigné, on génère un thème cohérent depuis ses
// couleurs. Sinon on retourne le DEFAULT_THEME inchangé.
const buildTheme = (branding) => {
  if (!branding?.colors) return DEFAULT_THEME;

  const primary   = hexToRgbArray(branding.colors.primary)   || DEFAULT_THEME.primary;
  const secondary = hexToRgbArray(branding.colors.secondary) || DEFAULT_THEME.accent;
  const textColor = hexToRgbArray(branding.colors.text)      || DEFAULT_THEME.text;
  const subtle    = hexToRgbArray(branding.colors.subtle)    || DEFAULT_THEME.lightText;

  // On génère une version très claire de la couleur primaire pour les fonds
  // en éclaircissant ses composantes (mixage avec blanc à 85%)
  const lighten = (c) => Math.round(c + (255 - c) * 0.85);
  const chapterBg = primary.map(lighten);

  // Version très claire pour les fonds de lignes alternées
  const secondaryBg = primary.map(c => Math.round(c + (255 - c) * 0.96));

  // Bordures légèrement teintées
  const borders = primary.map(c => Math.round(c + (255 - c) * 0.80));

  return {
    primary,
    chapterBg,
    secondary: secondaryBg,
    accent:    secondary,
    pse:       DEFAULT_THEME.pse,   // Orange PSE : on garde toujours la valeur par défaut
    text:      textColor,
    lightText: subtle,
    borders,
  };
};

const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return 'Document';
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-zA-Z0-9]/g, '_') 
    .replace(/_+/g, '_') 
    .replace(/^_|_$/g, '') 
    .substring(0, 40); 
};

// ─── CHARGEMENT IMAGE ─────────────────────────────────────────────────────────

const loadImage = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.src = url;
    if (!url.startsWith('data:')) img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};

const loadLogoFromSource = async (source) => {
  if (!source) return null;
  if (source.startsWith('data:')) return loadImage(source);
  return loadImage(source);
};

const cleanFormat = (num) => {
  if (num === undefined || num === null || num === '' || isNaN(num)) return "0,00";
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num).replace(/\s/g, ' ');
};

// ─── COLLECTE DES DONNÉES ─────────────────────────────────────────────────────

const collectData = (nodes, isParentOption, level, mode, projectRefMap, currentQtyMap, bpuConfig, includePM = true) => {
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
      const childData = collectData(node.children, isEffectiveOption, level + 1, mode, projectRefMap, currentQtyMap, bpuConfig, includePM);
      if (childData.rows.length > 0) {
        const titleStr = node.title ? node.title.toUpperCase() : (node.designation || '').toUpperCase();
        const displayTitle = level > 0 ? `  ${titleStr}` : titleStr;
        rows.push({ type: 'HEADER', designation: displayTitle, level });
        rows = rows.concat(childData.rows);
        rows.push({ type: 'SUBTOTAL', designation: `SOUS-TOTAL ${titleStr}`, total: childData.total, level });
        total += childData.total;
      }
    }
  });
  return { rows, total };
};

// ─── PAGE DE GARDE ────────────────────────────────────────────────────────────
// [MODIFIÉ] Reçoit `branding` en 7ème argument pour :
//   - Appliquer les couleurs dynamiques (via THEME reconstruit)
//   - Afficher les infos MOE dans le pied de page

const drawCoverPage = (doc, project, logoMoe, logoClient, type, today, branding = null) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // [MODIFIÉ] On reconstruit le thème depuis le branding si disponible
  const THEME = buildTheme(branding);

  const phaseLabel = (project.phase || 'DCE').toUpperCase();
  const clientName = project.client || 'Non renseigné';
  const clientStreet = project.clientAddress ? project.clientAddress.trim() : '';
  const clientCityZip = [project.clientZip, project.clientCity].filter(Boolean).join(' ').trim();
  const locationRaw = project.location || 'Non renseignée';
  const codeAffaire = project.code || 'Non défini';
  const subtitle1 = (project.subtitle1 || '').trim();
  const subtitle2 = (project.subtitle2 || '').trim();
  const showSignatures = project.showSignatures !== false;
  const signatories = project.signatories || ['', '', '', ''];

  // Bande de couleur gauche (couleur primaire du branding)
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, pageHeight, 'F');

  // Logos
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

  // Type de document
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...THEME.lightText);
  const docType = type === 'DQE' ? "DÉTAIL QUANTITATIF ET ESTIMATIF" : "ESTIMATION CONFIDENTIELLE DES TRAVAUX";
  doc.text(docType, pageWidth - 18, 52, { align: 'right' });
  doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.5);
  doc.line(pageWidth - 95, 57, pageWidth - 18, 57);

  // Titre projet
  doc.setFontSize(32);
  doc.setTextColor(...THEME.primary);
  const title = (project?.name || "NOM DU PROJET").toUpperCase();
  const splitTitle = doc.splitTextToSize(title, pageWidth - 40);
  doc.text(splitTitle, 18, 100);

  const titleHeight = splitTitle.length * 12;
  doc.setDrawColor(...THEME.accent);
  doc.setLineWidth(1.5);
  doc.line(18, 100 + titleHeight + 4, 60, 100 + titleHeight + 4);

  // Sous-titres
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

  // Bloc infos projet
  const blockY = 125 + titleHeight + subtitleOffset;
  doc.setFillColor(...THEME.secondary);
  doc.roundedRect(18, blockY, pageWidth - 36, 65, 3, 3, 'F');

  const col1X = 28;
  const col2X = pageWidth / 2 + 10;
  let startY = blockY + 15;

  // Colonne 1 : MOA & lieu
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("MAÎTRE D'OUVRAGE", col1X, startY);
  doc.setFontSize(11); doc.setTextColor(...THEME.text);
  const splitClient = doc.splitTextToSize(clientName.toUpperCase(), (pageWidth / 2) - 40);
  doc.text(splitClient, col1X, startY + 6);
  let currentY = startY + 6 + (splitClient.length * 5);
  doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont("Helvetica", "normal");
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
  currentY += 8;
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("LIEU DE RÉALISATION", col1X, currentY);
  doc.setFontSize(11); doc.setTextColor(...THEME.text);
  const splitLoc = doc.splitTextToSize(locationRaw.toUpperCase(), (pageWidth / 2) - 40);
  doc.text(splitLoc, col1X, currentY + 6);

  // Colonne 2 : Phase & code
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("PHASE DU PROJET", col2X, startY);
  doc.setFillColor(...THEME.primary);
  doc.roundedRect(col2X, startY + 3, 28, 6, 1.5, 1.5, 'F');
  doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont("Helvetica", "bold");
  doc.text(phaseLabel, col2X + 14, startY + 7.5, { align: 'center' });

  let rightY = startY + 22;
  doc.setFontSize(8); doc.setTextColor(...THEME.lightText); doc.setFont("Helvetica", "bold");
  doc.text("RÉFÉRENCE PROJET (CODE AFFAIRE)", col2X, rightY);
  doc.setFontSize(11); doc.setTextColor(...THEME.text);
  doc.text(codeAffaire.toUpperCase(), col2X, rightY + 6);

  // ── Cases tampon / signature ─────────────────────────────────────────────
  const footerTopY  = branding?.companyName ? pageHeight - 28 : pageHeight - 20;
  const sigZoneTop  = blockY + 65 + 6;
  const sigZoneH    = footerTopY - 6 - sigZoneTop;

  if (showSignatures && sigZoneH > 25) {
    const margin = 18;
    const gap    = 4;
    const n      = 4;
    const boxW   = (pageWidth - margin * 2 - gap * (n - 1)) / n;
    const labelH = 8;

    for (let i = 0; i < n; i++) {
      const bx = margin + i * (boxW + gap);
      const by = sigZoneTop;

      // Fond très léger
      doc.setFillColor(...THEME.secondary);
      doc.roundedRect(bx, by, boxW, sigZoneH, 2, 2, 'F');

      // Contour
      doc.setDrawColor(...THEME.primary);
      doc.setLineWidth(0.4);
      doc.roundedRect(bx, by, boxW, sigZoneH, 2, 2, 'S');

      // Bandeau titre (fond primary)
      doc.setFillColor(...THEME.primary);
      doc.roundedRect(bx, by, boxW, labelH, 2, 2, 'F');
      // Carré bas du bandeau (pour masquer les coins arrondis bas du bandeau)
      doc.rect(bx, by + labelH / 2, boxW, labelH / 2, 'F');

      // Nom signataire
      const sigName = (signatories[i] || ['Le Maître d\'Ouvrage', 'Le Maître d\'Œuvre', 'L\'Entreprise', 'Le Bureau de Contrôle'][i]).trim();
      doc.setFontSize(7); doc.setFont("Helvetica", "bold"); doc.setTextColor(255, 255, 255);
      doc.text(sigName.toUpperCase(), bx + boxW / 2, by + labelH / 2 + 1.5, { align: 'center' });

      // Ligne "Lu et approuvé" en bas
      const luY = by + sigZoneH - 10;
      doc.setDrawColor(...THEME.borders);
      doc.setLineWidth(0.3);
      doc.line(bx + 3, luY, bx + boxW - 3, luY);

      doc.setFontSize(6); doc.setFont("Helvetica", "normal"); doc.setTextColor(...THEME.lightText);
      doc.text('Lu et approuvé — Signature', bx + boxW / 2, by + sigZoneH - 4, { align: 'center' });
    }
  }

  // ── [NOUVEAU] PIED DE PAGE MOE ──────────────────────────────────────────────
  // Affiche les informations de la société MOE (depuis branding)
  // si au moins le nom de société est renseigné.
  if (branding?.companyName) {
    const footerY = pageHeight - 20;

    // Ligne de séparation fine
    doc.setDrawColor(...THEME.borders);
    doc.setLineWidth(0.3);
    doc.line(18, footerY - 8, pageWidth - 18, footerY - 8);

    // Nom société (gauche, gras, couleur primaire)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...THEME.primary);
    doc.text(branding.companyName.toUpperCase(), 18, footerY - 3);

    // Tagline si présent
    if (branding.tagline) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...THEME.lightText);
      doc.text(branding.tagline, 18, footerY + 2);
    }

    // Infos de contact (droite) : adresse · tél · email · site
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
      doc.text(contactParts.join('  ·  '), pageWidth - 18, footerY - 3, { align: 'right' });
    }

    // Date (tout à droite en bas)
    doc.setFontSize(6);
    doc.text(`Édité le ${today}`, pageWidth - 18, footerY + 2, { align: 'right' });

  } else {
    // Comportement original si pas de branding : juste la date
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    doc.setFont("Helvetica", "normal");
    doc.text(`Édité le ${today}`, pageWidth - 18, pageHeight - 12, { align: 'right' });
  }
};

// ─── FONCTION PRINCIPALE ──────────────────────────────────────────────────────

export const generateProfessionalPDF = async (project, clientQtyMaps, type = 'ESTIMATION', bpuConfig = {}, options = {}, branding = null) => {
  const { includeCover = true, selectedExports = ['global'], includeSummary = false, includePM = true, tranches = [] } = options;
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-FR');

  // [MODIFIÉ] Thème dynamique depuis le branding
  const THEME = buildTheme(branding);

  // Chargement des logos
  const moeLogoSource = branding?.logo || '/logo.jpg';
  const logoMoe = await loadLogoFromSource(moeLogoSource);
  const logoClient = project.clientLogo ? await loadImage(project.clientLogo) : null;

  const phaseLabel = (project.phase || 'PROJET').toUpperCase();
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
    drawCoverPage(doc, project, logoMoe, logoClient, type, today, branding);
  }

  let projectRefMap = new Map();
  try { if (project?.chapters) projectRefMap = getItemRefMap(project); } catch (e) {}

  const drawHeader = (data) => {
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
    doc.setFontSize(12); doc.text(titleText, centerX, 25, { align: 'center' });
    const bandY = 38; doc.setFillColor(...THEME.secondary); doc.rect(15, bandY, pageWidth - 30, 8, 'F');
    doc.setFontSize(7); doc.text(`PHASE : ${phaseLabel}  -  DATE : ${today}`, centerX, bandY + 5, { align: 'center' });
  };

  const tableConfig = {
    theme: 'grid',
    styles: { font: 'Helvetica', fontSize: 7, overflow: 'linebreak' },
    headStyles: { fillColor: THEME.primary, textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
    bodyStyles: { textColor: THEME.text, lineColor: THEME.borders },
    alternateRowStyles: { fillColor: THEME.secondary },
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
      const buildSummaryRows = (nodes, level, mode) => {
        let rows = [];
        nodes.forEach((node, nodeIdx) => {
          if (node.children) {
            const rawTitle = (node.title || node.designation || '');
            const chapPrefix = (level === 0 && mode === 'base') ? `${nodeIdx + 1}. ` : '';
            const title = (mode === 'option' && level === 0)
              ? `PSE - ${rawTitle}`.toUpperCase()
              : `${chapPrefix}${rawTitle}`.toUpperCase();
            const rowData = [];
            let hasContent = false;
            const cellTotals = [];
            summaryExports.forEach((expId) => {
              const map = new Map(Object.entries(clientQtyMaps[expId] || {}));
              const nodeData = collectData([node], false, 0, mode, projectRefMap, map, bpuConfig, includePM);
              if (nodeData.total !== 0) hasContent = true;
              cellTotals.push(nodeData.total);
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
              rows.push(...buildSummaryRows(node.children, level + 1, mode));
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
      const pseRows = buildSummaryRows(project.chapters, 0, 'option');
      if (pseRows.length > 0) {
        body.push([{ content: 'OPTIONS / PRESTATIONS SUPPLÉMENTAIRES', colSpan: summaryExports.length + 1, styles: { fillColor: [255, 245, 230], textColor: THEME.pse, fontStyle: 'bold', halign: 'center' } }]);
        body.push(...pseRows);
      }
    }

    const foot = [["TOTAL GÉNÉRAL HT (Hors PSE)", ...totals.map(t => ({ content: isDQE ? '' : cleanFormat(t) + " €", styles: { halign: 'right' } }))]];

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
      theme: 'grid', startY: 58, head, body, foot,
      headStyles: { fillColor: THEME.primary, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
      footStyles: { fillColor: THEME.secondary, textColor: 0, fontStyle: 'bold' },
      styles: { font: 'Helvetica', fontSize: 8, halign: 'right', cellPadding: { left: 2, right: 2, top: 2, bottom: 2 } },
      columnStyles: summaryColumnStyles,
      alternateRowStyles: { fillColor: THEME.secondary },
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
      project.chapters.forEach((chap, chapIndex) => {
        const chapData = collectData([chap], false, 0, 'base', projectRefMap, currentMap, bpuConfig, includePM);
        if (chapData.rows.length === 0 || (!isDQE && chapData.total === 0 && !includePM)) return;

        // ── Préfixe numéro de chapitre sur le HEADER racine et son SUBTOTAL ──
        const firstHeader = chapData.rows.find(r => r.type === 'HEADER' && r.level === 0);
        if (firstHeader) firstHeader.designation = `${chapIndex + 1}. ${firstHeader.designation.trim()}`;
        const rootSubtotal = chapData.rows.findLast(r => r.type === 'SUBTOTAL' && r.level === 0);
        if (rootSubtotal) rootSubtotal.designation = `SOUS-TOTAL ${chapIndex + 1}. ${(chap.title || '').toUpperCase()}`;

        const estimatedHeight = chapData.rows.length * 6;
        const pageBottom = doc.internal.pageSize.height - 30;
        if (currentY + estimatedHeight > pageBottom && estimatedHeight < pageBottom - 50) {
          doc.addPage(); currentY = 58;
        }

        const filteredChapRows = chapData.rows.filter(row => !(row.type === 'SUBTOTAL' && row.total === 0));

        autoTable(doc, {
          ...tableConfig,
          startY: currentY,
          head: [["N°", "DÉSIGNATION DES OUVRAGES", "U", "QTÉ", "P.U. HT", "TOTAL HT"]],
          body: filteredChapRows.map(row => {
            if (row.type === 'HEADER') return [safeRender(row.designation), '', '', '', '', ''];
            if (row.type === 'SUBTOTAL') return ['', safeRender(row.designation), '', '', '', isDQE ? '' : cleanFormat(row.total) + " €"];
            const displayQty = row.qty === 0 ? "PM" : row.qty;
            const displayPrice = isDQE ? '' : cleanFormat(row.price);
            const displayTotal = isDQE ? '' : (row.qty === 0 ? "PM" : cleanFormat(row.total));
            const displayUnit = normalizeUnitSymbol(row.unit);
            return [row.ref, safeRender(row.designation), displayUnit, displayQty, displayPrice, displayTotal];
          }),
          didParseCell: (data) => {
            if (data.section === 'body') {
              const row = filteredChapRows[data.row.index];
              if (row.type === 'HEADER') {
                data.cell.styles.halign = 'left'; data.cell.colSpan = 6; data.cell.styles.fontStyle = 'bold';
                data.cell.styles.cellPadding = { left: 5, top: 2, bottom: 2 };
                if (row.level === 0) { data.cell.styles.fillColor = THEME.chapterBg; data.cell.styles.fontSize = 8; }
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
        globalTotal += chapData.total;
      });
    }

    if (!isDQE) {
      if (currentY > doc.internal.pageSize.height - 40) {
        doc.addPage(); drawHeader(); currentY = 58;
      }
      const marginX = 10;
      const rightAlignX = doc.internal.pageSize.width - marginX;
      doc.setFontSize(9); doc.setFont("Helvetica", "bold");
      doc.text(`TOTAL GÉNÉRAL HT (Hors PSE) : ${cleanFormat(globalTotal)} €`, rightAlignX, currentY + 5, { align: 'right' });
      doc.setFont("Helvetica", "normal");
      doc.text(`T.V.A. (20%) : ${cleanFormat(globalTotal * 0.2)} €`, rightAlignX, currentY + 11, { align: 'right' });
      doc.setFontSize(11); doc.setFont("Helvetica", "bold");
      doc.text(`TOTAL GÉNÉRAL TTC : ${cleanFormat(globalTotal * 1.2)} €`, rightAlignX, currentY + 19, { align: 'right' });
    }

    // Pages PSE
    if (project.chapters) {
      let pseCounter = 1;
      project.chapters.forEach((chap, chapIndex) => {
        const pseData = collectData([chap], false, 0, 'option', projectRefMap, currentMap, bpuConfig, includePM);
        if (pseData && pseData.rows.length > 0 && (isDQE || pseData.total !== 0)) {
          doc.addPage();
          doc.setFontSize(10); doc.setTextColor(...THEME.pse); doc.setFont("Helvetica", "bold");
          doc.text(`PSE n°${pseCounter} : ${chapIndex + 1}. ${chap.title.toUpperCase()} - ${currentHeaderTrancheName}`, 14, 52);
          pseCounter++;
          // ── Préfixe numéro de chapitre sur le HEADER racine PSE ──
          const firstPseHeader = pseData.rows.find(r => r.type === 'HEADER' && r.level === 0);
          if (firstPseHeader) firstPseHeader.designation = `${chapIndex + 1}. ${firstPseHeader.designation.trim()}`;
          autoTable(doc, {
            ...tableConfig,
            startY: 58,
            head: [["N°", "DÉSIGNATION", "U", "QTÉ", "P.U. HT", "TOTAL HT"]],
            headStyles: { ...tableConfig.headStyles, fillColor: THEME.pse },
            body: (() => {
              const filteredPseRows = pseData.rows.filter(row => !(row.type === 'SUBTOTAL' && row.total === 0));
              pseData._filteredRows = filteredPseRows;
              return filteredPseRows.map(row => {
                if (row.type === 'HEADER') return [safeRender(row.designation), '', '', '', '', ''];
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
                  if (row.level === 0) data.cell.styles.fillColor = [255, 251, 235];
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
            let pY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(9);
            doc.text(`TOTAL HT PSE : ${cleanFormat(pseData.total)} €`, rightAlignX, pY, { align: 'right' });
            doc.text(`TOTAL TTC PSE : ${cleanFormat(pseData.total * 1.2)} €`, rightAlignX, pY + 8, { align: 'right' });
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

  const safeName = sanitizeFilename(project?.name || 'Projet');
  const dateStr = new Date().toISOString().slice(0, 10);
  const suggestedName = `${type}_${safeName}_${dateStr}.pdf`;
  const blob = doc.output('blob');

  if (options.previewOnly) {
    return { blobUrl: URL.createObjectURL(blob), suggestedName, blob };
  }

  await saveFileWithPicker(blob, suggestedName, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
};