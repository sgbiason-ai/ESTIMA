// src/utils/docAdmin/annexeReserves.js
// Module partagé pour générer l'annexe des réserves (PDF + DOCX)
// Utilisé par EXE4, EXE5, EXE6

import { formatDateLocale } from '../dateHelpers';
import { fitTextToWidth } from '../pdf/pdfSharedHelpers';

const formatDate = (s) => formatDateLocale(s);

/**
 * Charge une image et retourne ses dimensions
 */
const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ img, width: img.naturalWidth, height: img.naturalHeight });
  img.onerror = () => resolve(null);
  img.src = src;
});

/**
 * Génère l'annexe des réserves en PDF (nouvelle page)
 */
export const generateAnnexeReservesPdf = async (pdf, data, exeLabel, fiche) => {
  const reserves = (data.reserves || []).filter(r => r.designation);
  if (reserves.length === 0) return;

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 20, mR = 20, cW = pageW - mL - mR;
  const GRAY = [217, 217, 217], BLACK = [0, 0, 0];

  // Nouvelle page
  pdf.addPage();
  let y = 18;

  const checkPage = (n = 20) => { if (y + n > pageH - 20) { pdf.addPage(); y = 18; } };

  // Titre
  pdf.setFillColor(...GRAY); pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4);
  pdf.rect(mL, y, cW, 10, 'FD');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...BLACK);
  pdf.text(`ANNEXE - Liste des réserves (${exeLabel})`, mL + 3, y + 7);
  y += 14;

  // Sous-titre
  const D = fiche?.sectionD || {};
  if (D.objet) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(fitTextToWidth(pdf, `Marché : ${D.objet}`, cW - 4), mL, y);
    y += 6;
  }
  if (data.dateOPR) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Date des OPR : ${formatDate(data.dateOPR)}`, mL, y);
    y += 8;
  }

  // Tableau des réserves (sans localisation)
  const colWidths = [12, cW - 12 - 40, 40]; // N°, Designation, Date limite de levée
  const headerLabels = ['N\u00B0', 'Désignation de la réserve', 'Date limite\nde levée'];
  const rowH = 8;
  const headerH = 10;

  checkPage(headerH + 10);

  // Header du tableau — reset explicite des couleurs (après autoTable)
  let xPos = mL;
  headerLabels.forEach((h, i) => {
    pdf.setFillColor(217, 217, 217);       // gris clair — reset à chaque cellule
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.rect(xPos, y, colWidths[i], headerH, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(0, 0, 0);
    const lines = pdf.splitTextToSize(h, colWidths[i] - 4);
    lines.forEach((line, li) => {
      pdf.text(line, xPos + 2, y + 4.5 + li * 3.5);
    });
    xPos += colWidths[i];
  });
  y += headerH;

  // Lignes du tableau
  for (const r of reserves) {
    const row = [r.numero || '', r.designation || '', r.delaiLevee ? formatDate(r.delaiLevee) : ''];
    checkPage(rowH + 4);
    xPos = mL;

    pdf.setFontSize(8);
    const maxLines = Math.max(1, ...row.map((cell, i) => pdf.splitTextToSize(cell, colWidths[i] - 4).length));
    const currentRowH = Math.max(rowH, maxLines * 4.5 + 3);

    row.forEach((cell, i) => {
      pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.2);
      pdf.rect(xPos, y, colWidths[i], currentRowH);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
      const lines = pdf.splitTextToSize(cell, colWidths[i] - 4);
      lines.forEach((line, li) => {
        pdf.text(line, xPos + 2, y + 4 + li * 4.5);
      });
      xPos += colWidths[i];
    });
    y += currentRowH;

    // Image de la réserve (sous la ligne du tableau)
    if (r.image) {
      const imgData = await loadImage(r.image);
      if (imgData) {
        const maxImgW = cW - 20;
        const maxImgH = 60;
        const ratio = Math.min(maxImgW / imgData.width, maxImgH / imgData.height, 1);
        const imgW = imgData.width * ratio;
        const imgH = imgData.height * ratio;

        checkPage(imgH + 12);
        y += 2;
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(100, 100, 100);
        pdf.text(`Photo réserve n° ${r.numero} :`, mL + 2, y + 3);
        y += 5;

        try {
          pdf.addImage(r.image, 'JPEG', mL + 2, y, imgW, imgH);
        } catch {
          try { pdf.addImage(r.image, 'PNG', mL + 2, y, imgW, imgH); } catch { /* skip */ }
        }
        y += imgH + 4;
      }
    }
  }

  // Observations
  y += 4;
  if (data.observationsReserves) {
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); pdf.setTextColor(...BLACK);
    const lines = pdf.splitTextToSize(`Observations : ${data.observationsReserves}`, cW);
    lines.forEach(line => {
      checkPage(6);
      pdf.text(line, mL, y);
      y += 5;
    });
  }
};

/**
 * Génère les children DOCX pour l'annexe des réserves (saut de page + tableau + images)
 */
export const generateAnnexeReservesDocx = async (data, exeLabel, fiche) => {
  const reserves = (data.reserves || []).filter(r => r.designation);
  if (reserves.length === 0) return [];

  const {
    Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    ShadingType, VerticalAlign, PageBreak, ImageRun,
  } = await import('docx');

  const FONT = 'Arial';
  const SN = 20, SS = 18, ST = 22;
  const BT = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
  const SG = { type: ShadingType.SOLID, color: 'D9D9D9' };

  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120 }, alignment: o.alignment || AlignmentType.LEFT, ...o });

  const children = [];
  const D = fiche?.sectionD || {};

  // Saut de page
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Titre annexe
  children.push(new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: [para([text(`ANNEXE - Liste des réserves (${exeLabel})`, { bold: true, size: ST })], { after: 0 })],
      shading: SG, borders: { top: BT, bottom: BT, left: BT, right: BT },
      verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Sous-titre
  if (D.objet) children.push(para([text(`Marché : ${D.objet}`, { size: SS })], { after: 40 }));
  if (data.dateOPR) children.push(para([text(`Date des OPR : ${formatDate(data.dateOPR)}`, { size: SS })], { after: 80 }));

  // Tableau (sans localisation)
  const headerCells = ['N°', 'Désignation de la réserve', 'Date limite de levée'].map(label =>
    new TableCell({
      children: [para([text(label, { bold: true, size: SS })], { after: 0, alignment: AlignmentType.CENTER })],
      shading: SG,
      borders: { top: BT, bottom: BT, left: BT, right: BT },
      verticalAlign: VerticalAlign.CENTER,
    })
  );

  const bodyRows = reserves.map(r => new TableRow({
    children: [
      r.numero || '',
      r.designation || '',
      r.delaiLevee ? formatDate(r.delaiLevee) : '',
    ].map((v, i) => new TableCell({
      children: [para([text(v, { size: SS })], { after: 0, alignment: i === 0 || i === 2 ? AlignmentType.CENTER : AlignmentType.LEFT })],
      borders: { top: BT, bottom: BT, left: BT, right: BT },
      verticalAlign: VerticalAlign.CENTER,
    })),
  }));

  children.push(new Table({
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Images des réserves
  for (const r of reserves) {
    if (!r.image) continue;

    children.push(para([text(`Photo réserve n° ${r.numero} :`, { size: SS, italics: true })], { after: 60 }));

    try {
      // Extraire les données binaires du base64
      const base64Data = r.image.split(',')[1];
      const mimeMatch = r.image.match(/data:image\/(\w+);/);
      const ext = mimeMatch ? mimeMatch[1] : 'png';

      // Convertir base64 en Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Obtenir les dimensions
      const imgInfo = await loadImage(r.image);
      if (imgInfo) {
        const maxW = 500; // ~13cm en EMU / points
        const maxH = 300;
        const ratio = Math.min(maxW / imgInfo.width, maxH / imgInfo.height, 1);
        const w = Math.round(imgInfo.width * ratio);
        const h = Math.round(imgInfo.height * ratio);

        children.push(new Paragraph({
          children: [new ImageRun({
            data: bytes,
            transformation: { width: w, height: h },
            type: ext === 'png' ? 'png' : 'jpg',
          })],
          spacing: { after: 200 },
        }));
      }
    } catch {
      children.push(para([text(`[Image non disponible pour la réserve n° ${r.numero}]`, { size: SS, italics: true })], { after: 80 }));
    }
  }

  // Observations
  if (data.observationsReserves) {
    children.push(para([text(`Observations : ${data.observationsReserves}`, { size: SS, italics: true })], { after: 80 }));
  }

  return children;
};
