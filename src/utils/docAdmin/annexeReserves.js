// src/utils/docAdmin/annexeReserves.js
// Module partagé pour générer l'annexe des réserves (PDF + DOCX)
// Utilisé par EXE4, EXE5, EXE6

import { formatDateLocale } from '../dateHelpers';
import { fitTextToWidth } from '../pdf/pdfSharedHelpers';
import { getReserveImages, getReserveImageSrc } from './siteVisitReserves';

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

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(blob);
});

const dataUrlToBytes = (dataUrl) => {
  const base64Data = dataUrl?.split(',')[1];
  if (!base64Data) return null;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const loadReserveImage = async (entry, cache) => {
  const src = getReserveImageSrc(entry);
  if (!src) return null;
  if (cache.has(src)) return cache.get(src);

  let dataUrl = src.startsWith('data:') ? src : null;
  const path = typeof entry === 'object' ? entry?.path : null;

  if (!dataUrl && path) {
    try {
      const [{ getBlob, ref }, { storage }] = await Promise.all([
        import('firebase/storage'),
        import('../../firebaseStorage'),
      ]);
      dataUrl = await blobToDataUrl(await getBlob(ref(storage, path)));
    } catch { /* fallback HTTP ci-dessous */ }
  }

  if (!dataUrl) {
    try {
      let response = await fetch(src);
      if (!response.ok) {
        const separator = src.includes('?') ? '&' : '?';
        response = await fetch(`${src}${separator}swbust=${Date.now()}`);
      }
      if (response.ok) dataUrl = await blobToDataUrl(await response.blob());
    } catch { /* image indisponible */ }
  }

  if (!dataUrl) return null;
  const imageInfo = await loadImage(dataUrl);
  if (!imageInfo) return null;

  const mime = dataUrl.match(/^data:image\/([^;,]+)/i)?.[1]?.toLowerCase() || 'jpeg';
  const result = {
    dataUrl,
    bytes: dataUrlToBytes(dataUrl),
    width: imageInfo.width,
    height: imageInfo.height,
    format: mime === 'png' ? 'PNG' : 'JPEG',
    docxType: mime === 'png' ? 'png' : 'jpg',
  };
  cache.set(src, result);
  return result;
};

const buildVisitMap = async (source, reserves) => {
  if (!source?.mapVisit) return null;
  try {
    const { generateSiteVisitOverviewMap } = await import('../pdfSiteVisitGenerator');
    const observationsById = new Map(
      (source.mapVisit.observations || []).map((observation) => [observation.id, observation]),
    );
    const mappedObservations = (reserves || [])
      .filter((reserve) => reserve.sourceObservationId && observationsById.has(reserve.sourceObservationId))
      .map((reserve, index) => ({
        ...observationsById.get(reserve.sourceObservationId),
        mapNumber: reserve.numero || index + 1,
      }));
    return await generateSiteVisitOverviewMap({
      ...source.mapVisit,
      observations: mappedObservations,
    });
  } catch {
    return null;
  }
};

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
  const source = ['EXE4', 'EXE5'].includes(exeLabel) ? data.reserveSourceVisit || null : null;
  const imageCache = new Map();
  const mapImage = await buildVisitMap(source, reserves);

  if (mapImage) {
    pdf.addPage();
    let mapY = 18;
    pdf.setFillColor(...GRAY); pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4);
    pdf.rect(mL, mapY, cW, 10, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...BLACK);
    pdf.text(`ANNEXE - Plan de repérage des réserves (${exeLabel})`, mL + 3, mapY + 7);
    mapY += 15;

    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(70, 70, 70);
    const sourceParts = [source?.nom, source?.date ? `du ${formatDate(source.date)}` : '', source?.lieu]
      .filter(Boolean);
    if (sourceParts.length) {
      pdf.text(fitTextToWidth(pdf, `Visite source : ${sourceParts.join(' - ')}`, cW), mL, mapY);
      mapY += 6;
    }
    pdf.text('Les numéros du plan correspondent aux réserves détaillées dans les pages suivantes.', mL, mapY);
    mapY += 6;

    const mapInfo = await loadImage(mapImage);
    if (mapInfo) {
      const maxMapH = pageH - mapY - 25;
      const ratio = Math.min(cW / mapInfo.width, maxMapH / mapInfo.height);
      const mapW = mapInfo.width * ratio;
      const mapH = mapInfo.height * ratio;
      const mapX = mL + (cW - mapW) / 2;
      pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.3);
      pdf.roundedRect(mapX, mapY, mapW, mapH, 2, 2, 'S');
      pdf.addImage(mapImage, 'JPEG', mapX + 0.5, mapY + 0.5, mapW - 1, mapH - 1);
    }
  }

  // Page de la liste des réserves
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
  if (source) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(70, 70, 70);
    const sourceParts = [source.nom, source.date ? `du ${formatDate(source.date)}` : '', source.lieu]
      .filter(Boolean);
    const lines = pdf.splitTextToSize(`Visite source : ${sourceParts.join(' - ')}`, cW);
    lines.forEach((line) => { pdf.text(line, mL, y); y += 4.5; });
    y += 3;
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

    // Toutes les photos de la réserve, deux par ligne.
    const loadedImages = (await Promise.all(
      getReserveImages(r).map((entry) => loadReserveImage(entry, imageCache)),
    )).filter(Boolean);

    if (loadedImages.length > 0) {
      checkPage(18);
      y += 3;
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(100, 100, 100);
      pdf.text(`Photos réserve n° ${r.numero} :`, mL + 2, y + 3);
      y += 6;

      const gap = 5;
      const cellW = (cW - gap) / 2;
      for (let index = 0; index < loadedImages.length; index += 2) {
        const rowImages = loadedImages.slice(index, index + 2).map((image) => {
          const ratio = Math.min(cellW / image.width, 55 / image.height, 1);
          return { ...image, drawW: image.width * ratio, drawH: image.height * ratio };
        });
        const rowHeight = Math.max(...rowImages.map((image) => image.drawH));
        checkPage(rowHeight + 7);
        rowImages.forEach((image, imageIndex) => {
          const cellX = mL + imageIndex * (cellW + gap);
          const imageX = cellX + (cellW - image.drawW) / 2;
          try {
            pdf.addImage(image.dataUrl, image.format, imageX, y, image.drawW, image.drawH);
          } catch { /* image ignorée */ }
        });
        y += rowHeight + 5;
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
  const source = ['EXE4', 'EXE5'].includes(exeLabel) ? data.reserveSourceVisit || null : null;
  const imageCache = new Map();
  const mapImage = await buildVisitMap(source, reserves);

  // Saut de page
  children.push(new Paragraph({ children: [new PageBreak()] }));

  if (mapImage) {
    children.push(new Table({
      rows: [new TableRow({ children: [new TableCell({
        children: [para([text(`ANNEXE - Plan de repérage des réserves (${exeLabel})`, { bold: true, size: ST })], { after: 0 })],
        shading: SG, borders: { top: BT, bottom: BT, left: BT, right: BT },
        verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE },
      })] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    const sourceParts = [source?.nom, source?.date ? `du ${formatDate(source.date)}` : '', source?.lieu]
      .filter(Boolean);
    if (sourceParts.length) {
      children.push(para([text(`Visite source : ${sourceParts.join(' - ')}`, { size: SS })], { after: 60 }));
    }
    children.push(para([text('Les numéros du plan correspondent aux réserves détaillées dans les pages suivantes.', { size: SS, italics: true })], { after: 100 }));

    const mapInfo = await loadReserveImage(mapImage, imageCache);
    if (mapInfo?.bytes) {
      const ratio = Math.min(600 / mapInfo.width, 720 / mapInfo.height, 1);
      children.push(new Paragraph({
        children: [new ImageRun({
          data: mapInfo.bytes,
          transformation: {
            width: Math.round(mapInfo.width * ratio),
            height: Math.round(mapInfo.height * ratio),
          },
          type: mapInfo.docxType,
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      }));
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

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
  if (source) {
    const sourceParts = [source.nom, source.date ? `du ${formatDate(source.date)}` : '', source.lieu]
      .filter(Boolean);
    children.push(para([text(`Visite source : ${sourceParts.join(' - ')}`, { size: SS })], { after: 80 }));
  }

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
    const loadedImages = (await Promise.all(
      getReserveImages(r).map((entry) => loadReserveImage(entry, imageCache)),
    )).filter((image) => image?.bytes);
    if (loadedImages.length === 0) continue;

    children.push(para([text(`Photos réserve n° ${r.numero} :`, { size: SS, italics: true })], { after: 60 }));

    try {
      for (const image of loadedImages) {
        const ratio = Math.min(500 / image.width, 300 / image.height, 1);
        children.push(new Paragraph({
          children: [new ImageRun({
            data: image.bytes,
            transformation: {
              width: Math.round(image.width * ratio),
              height: Math.round(image.height * ratio),
            },
            type: image.docxType,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
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
