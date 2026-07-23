import { formatDateLocale } from '../dateHelpers';
import { fitTextToWidth } from '../pdf/pdfSharedHelpers';
import { getReserveControlImages, getReserveImages } from './siteVisitReserves';
import { loadReserveImage } from './annexeReserves';

export const LEVEE_STATUS = {
  levee: { label: 'Levée', color: [5, 150, 105], hex: '059669' },
  maintenue: { label: 'Maintenue', color: [220, 38, 38], hex: 'DC2626' },
  partiellement_levee: { label: 'Partiellement levée', color: [217, 119, 6], hex: 'D97706' },
  a_qualifier: { label: 'À qualifier', color: [100, 116, 139], hex: '64748B' },
};

export const getLeveeStatus = (value) => LEVEE_STATUS[value] || LEVEE_STATUS.a_qualifier;

export const getLeveeAnnexReserves = (data) => (
  (data?.reserves || []).filter((reserve) => reserve?.designation)
);

const formatDate = (value) => formatDateLocale(value, { fallback: '-' });

const drawPdfHeader = (pdf, title, subtitle = '') => {
  const pageW = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(15, 23, 42);
  pdf.rect(16, 14, pageW - 32, 17, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title, 20, 21);
  if (subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(fitTextToWidth(pdf, subtitle, pageW - 42), 20, 27);
  }
  pdf.setTextColor(15, 23, 42);
};

const drawPdfTextBox = (pdf, x, y, width, title, value, tint = [248, 250, 252]) => {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const lines = pdf.splitTextToSize(value || 'Non renseigné', width - 8);
  const height = Math.max(23, 13 + lines.length * 4);
  pdf.setFillColor(...tint);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(x, y, width, height, 2, 2, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(71, 85, 105);
  pdf.text(title.toUpperCase(), x + 4, y + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text(lines, x + 4, y + 12);
  return height;
};

const drawPdfPhoto = (pdf, image, x, y, cellW, maxH) => {
  if (!image) return;
  const ratio = Math.min((cellW - 4) / image.width, (maxH - 4) / image.height, 1);
  const width = image.width * ratio;
  const height = image.height * ratio;
  try {
    pdf.addImage(
      image.dataUrl,
      image.format,
      x + (cellW - width) / 2,
      y + (maxH - height) / 2,
      width,
      height,
    );
  } catch { /* photo indisponible */ }
};

/**
 * Ajoute l'annexe comparative à la suite d'un PDF EXE8 ou EXE9.
 */
export const generateAnnexeLeveeReservesPdf = async (pdf, data, exeLabel, fiche) => {
  const reserves = getLeveeAnnexReserves(data);
  if (reserves.length === 0) return;

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 16;
  const contentW = pageW - 32;
  const imageCache = new Map();
  const initialVisit = data.reserveSourceVisit;
  const controlVisit = data.reserveControlSourceVisit;

  pdf.addPage();
  drawPdfHeader(
    pdf,
    `ANNEXE COMPARATIVE - LEVÉE DES RÉSERVES (${exeLabel})`,
    fiche?.sectionD?.objet || fiche?.nom || '',
  );
  let y = 39;

  const sourceLines = [
    `Visite initiale : ${initialVisit?.nom || 'réserves saisies manuellement'}${initialVisit?.date ? ` - ${formatDate(initialVisit.date)}` : ''}`,
    `Visite de contrôle : ${controlVisit?.nom || 'non sélectionnée'}${controlVisit?.date ? ` - ${formatDate(controlVisit.date)}` : ''}`,
  ];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  sourceLines.forEach((line) => {
    pdf.text(fitTextToWidth(pdf, line, contentW), mL, y);
    y += 5;
  });
  y += 3;

  const widths = [15, 58, 74, contentW - 147];
  const headers = ['Repère', 'Réserve initiale', 'Constat de contrôle', 'Statut'];
  let x = mL;
  headers.forEach((header, index) => {
    pdf.setFillColor(226, 232, 240);
    pdf.setDrawColor(148, 163, 184);
    pdf.rect(x, y, widths[index], 9, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(15, 23, 42);
    pdf.text(header, x + 2, y + 5.5);
    x += widths[index];
  });
  y += 9;

  for (const reserve of reserves) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const cells = [
      String(reserve.numero || ''),
      reserve.designation || '',
      reserve.controlText || 'Aucun constat associé',
      getLeveeStatus(reserve.leveeStatus).label,
    ];
    const lines = cells.map((cell, index) => pdf.splitTextToSize(cell, widths[index] - 4));
    const rowH = Math.max(10, ...lines.map((cellLines) => cellLines.length * 3.5 + 4));
    if (y + rowH > pageH - 18) {
      pdf.addPage();
      drawPdfHeader(pdf, `SYNTHÈSE DES RÉSERVES (${exeLabel})`, fiche?.nom || '');
      y = 37;
    }
    x = mL;
    lines.forEach((cellLines, index) => {
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(x, y, widths[index], rowH);
      pdf.setFont('helvetica', index === 0 || index === 3 ? 'bold' : 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...(index === 3 ? getLeveeStatus(reserve.leveeStatus).color : [15, 23, 42]));
      pdf.text(cellLines, x + 2, y + 4.5);
      x += widths[index];
    });
    y += rowH;
  }

  for (const reserve of reserves) {
    const beforePhotos = (await Promise.all(
      getReserveImages(reserve).map((entry) => loadReserveImage(entry, imageCache)),
    )).filter(Boolean);
    const afterPhotos = (await Promise.all(
      getReserveControlImages(reserve, controlVisit).map((entry) => loadReserveImage(entry, imageCache)),
    )).filter(Boolean);

    pdf.addPage();
    const status = getLeveeStatus(reserve.leveeStatus);
    drawPdfHeader(
      pdf,
      `RÉSERVE N° ${reserve.numero || '-'} - ${status.label.toUpperCase()}`,
      `Repère observation ${reserve.numero || '-'} · ${exeLabel}`,
    );
    pdf.setFillColor(...status.color);
    pdf.roundedRect(pageW - 61, 18, 41, 8, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    pdf.text(status.label, pageW - 40.5, 23.3, { align: 'center' });

    const gap = 6;
    const colW = (contentW - gap) / 2;
    const initialBoxH = drawPdfTextBox(pdf, mL, 38, colW, 'Réserve initiale', reserve.designation);
    const controlBoxH = drawPdfTextBox(pdf, mL + colW + gap, 38, colW, 'Constat de contrôle', reserve.controlText);
    y = 38 + Math.max(initialBoxH, controlBoxH) + 8;

    const maxRows = Math.max(beforePhotos.length, afterPhotos.length, 1);
    for (let index = 0; index < maxRows; index++) {
      if (y + 61 > pageH - 16) {
        pdf.addPage();
        drawPdfHeader(pdf, `RÉSERVE N° ${reserve.numero || '-'} - SUITE`, status.label);
        y = 38;
      }
      ['PHOTOS AVANT', 'PHOTOS APRÈS'].forEach((label, column) => {
        const cellX = mL + column * (colW + gap);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(cellX, y, colW, 57, 2, 2, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(71, 85, 105);
        pdf.text(label, cellX + 4, y + 6);
      });
      drawPdfPhoto(pdf, beforePhotos[index], mL, y + 7, colW, 48);
      drawPdfPhoto(pdf, afterPhotos[index], mL + colW + gap, y + 7, colW, 48);
      if (!beforePhotos[index]) {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
        pdf.text('Aucune photo', mL + colW / 2, y + 32, { align: 'center' });
      }
      if (!afterPhotos[index]) {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
        pdf.text('Aucune photo', mL + colW + gap + colW / 2, y + 32, { align: 'center' });
      }
      y += 62;
    }
  }
};

const buildDocxImageParagraphs = async (entries, imageCache, docx) => {
  const { Paragraph, TextRun, ImageRun, AlignmentType } = docx;
  const loaded = (await Promise.all(
    (entries || []).map((entry) => loadReserveImage(entry, imageCache)),
  )).filter((image) => image?.bytes);
  if (loaded.length === 0) {
    return [new Paragraph({
      children: [new TextRun({
        text: 'Aucune photo',
        font: 'Arial',
        size: 18,
        italics: true,
        color: '94A3B8',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })];
  }
  return loaded.map((image) => {
    const ratio = Math.min(250 / image.width, 180 / image.height, 1);
    return new Paragraph({
      children: [new ImageRun({
        data: image.bytes,
        transformation: {
          width: Math.round(image.width * ratio),
          height: Math.round(image.height * ratio),
        },
        type: image.docxType,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    });
  });
};

/**
 * Retourne les blocs DOCX de l'annexe comparative EXE8 / EXE9.
 */
export const generateAnnexeLeveeReservesDocx = async (data, exeLabel, fiche) => {
  const reserves = getLeveeAnnexReserves(data);
  if (reserves.length === 0) return [];

  const docx = await import('docx');
  const {
    Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
    WidthType, BorderStyle, ShadingType, VerticalAlign, PageBreak,
  } = docx;
  const FONT = 'Arial';
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const text = (value, options = {}) => new TextRun({
    text: String(value || ''),
    font: FONT,
    size: options.size || 18,
    bold: options.bold || false,
    color: options.color,
    italics: options.italics || false,
  });
  const para = (children, options = {}) => new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { after: options.after ?? 80 },
  });
  const cell = (children, options = {}) => new TableCell({
    children: Array.isArray(children) ? children : [children],
    borders,
    shading: options.shading ? { type: ShadingType.SOLID, color: options.shading } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
  });

  const children = [new Paragraph({ children: [new PageBreak()] })];
  children.push(para([text(`ANNEXE COMPARATIVE - LEVÉE DES RÉSERVES (${exeLabel})`, { bold: true, size: 24 })], { after: 80 }));
  if (fiche?.sectionD?.objet) children.push(para([text(`Marché : ${fiche.sectionD.objet}`)], { after: 40 }));
  children.push(para([text(`Visite initiale : ${data.reserveSourceVisit?.nom || 'réserves saisies manuellement'}${data.reserveSourceVisit?.date ? ` - ${formatDate(data.reserveSourceVisit.date)}` : ''}`)], { after: 30 }));
  children.push(para([text(`Visite de contrôle : ${data.reserveControlSourceVisit?.nom || 'non sélectionnée'}${data.reserveControlSourceVisit?.date ? ` - ${formatDate(data.reserveControlSourceVisit.date)}` : ''}`)], { after: 100 }));

  const summaryHeader = ['Repère', 'Réserve initiale', 'Constat de contrôle', 'Statut']
    .map((label, index) => cell(
      para([text(label, { bold: true })], { alignment: AlignmentType.CENTER, after: 0 }),
      { shading: 'E2E8F0', width: [10, 32, 40, 18][index] },
    ));
  const summaryRows = reserves.map((reserve) => new TableRow({
    children: [
      reserve.numero,
      reserve.designation,
      reserve.controlText || 'Aucun constat associé',
      getLeveeStatus(reserve.leveeStatus).label,
    ].map((value, index) => cell(
      para([text(value, {
        bold: index === 0 || index === 3,
        color: index === 3 ? getLeveeStatus(reserve.leveeStatus).hex : undefined,
      })], { alignment: index === 0 || index === 3 ? AlignmentType.CENTER : AlignmentType.LEFT, after: 0 }),
      { width: [10, 32, 40, 18][index] },
    )),
  }));
  children.push(new Table({
    rows: [new TableRow({ children: summaryHeader }), ...summaryRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  const imageCache = new Map();
  for (const reserve of reserves) {
    const status = getLeveeStatus(reserve.leveeStatus);
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(para([
      text(`RÉSERVE N° ${reserve.numero || '-'} - `, { bold: true, size: 24 }),
      text(status.label.toUpperCase(), { bold: true, size: 24, color: status.hex }),
    ], { after: 100 }));
    children.push(new Table({
      rows: [new TableRow({
        children: [
          cell([
            para([text('RÉSERVE INITIALE', { bold: true, color: '475569' })], { after: 50 }),
            para([text(reserve.designation || 'Non renseigné')], { after: 0 }),
          ], { shading: 'F8FAFC', width: 50 }),
          cell([
            para([text('CONSTAT DE CONTRÔLE', { bold: true, color: '475569' })], { after: 50 }),
            para([text(reserve.controlText || 'Non renseigné')], { after: 0 }),
          ], { shading: 'F8FAFC', width: 50 }),
        ],
      })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
    children.push(para([text('PHOTOS AVANT / APRÈS', { bold: true, color: '475569' })], { after: 50 }));

    const beforeParagraphs = await buildDocxImageParagraphs(getReserveImages(reserve), imageCache, docx);
    const afterParagraphs = await buildDocxImageParagraphs(
      getReserveControlImages(reserve, data.reserveControlSourceVisit),
      imageCache,
      docx,
    );
    children.push(new Table({
      rows: [new TableRow({
        children: [
          cell([para([text('AVANT', { bold: true })], { alignment: AlignmentType.CENTER, after: 60 }), ...beforeParagraphs], { width: 50 }),
          cell([para([text('APRÈS', { bold: true })], { alignment: AlignmentType.CENTER, after: 60 }), ...afterParagraphs], { width: 50 }),
        ],
      })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }

  return children;
};
