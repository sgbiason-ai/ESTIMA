// src/utils/takeoff/pdfTakeoffPlanGenerator.js
// « Plan des métrés » (PDF) : couverture branding + page « Vue d'ensemble » (plan global
// cadré sur les sélections colorées + légende couleur + tableau détaillé) + une page « zoom »
// par sélection. Les images du plan sont capturées côté viewer (DxfViewerPanel.captureFrames).
// Plan SANS ÉCHELLE : illustration cadrée sur les éléments mesurés, pas un plan coté.
// Texte WinAnsi-safe (jsPDF Helvetica = CP1252) : pas de « → », « − »… (cf. pièges PDF).

import {
  cleanText, loadLogos, drawCoverPage, formatNumberFr,
} from '../pdf/pdfSharedHelpers';
import { buildTheme } from '../pdf/buildTheme';
import { getCurrentPhaseCode } from '../phaseModel';
import { stampPdfCredit } from '../estimaCredit';
import { METRIC_LABELS } from './dxfTakeoff';
import { TAKEOFF_TABLE_HEAD, formatRow } from './pdfTakeoffGenerator';

const M = 12;
const safeName = (name) => String(name || 'projet').replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'projet';

const hexToRgb = (hex) => {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const int = parseInt(full, 16);
  if (!Number.isFinite(int)) return [148, 163, 184];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

// « Longueur — 123,45 ml » à partir de la ligne de métré d'une sélection.
const metricText = (row) => {
  if (!row) return 'Non mesuré';
  const info = METRIC_LABELS[row.metric] || { label: '', unit: row.unit || '' };
  return `${info.label} — ${formatNumberFr(row.quantity)} ${row.unit || info.unit}`.trim();
};

// Ligne de tableau détaillée (7 colonnes, identique à la Feuille de métré) pour une sélection.
const tableRowFor = ({ row, mapping, article }) => {
  const cells = formatRow({
    layer: row?.layer,
    metric: row?.metric,
    measuredQty: row?.quantity,
    article,
    coefficient: mapping?.coefficient,
    geo: mapping,
  });
  if (!mapping?.itemId) cells[3] = '(non associé au DQE)';
  return cells;
};

// Colonnes du tableau détaillé, calées pour une page paysage (usableW ≈ 273 mm).
const TABLE_COLUMN_STYLES = {
  0: { cellWidth: 42 },
  1: { cellWidth: 20 },
  2: { cellWidth: 26, halign: 'right' },
  3: { cellWidth: 'auto' },
  4: { cellWidth: 14, halign: 'right' },
  5: { cellWidth: 34 },
  6: { cellWidth: 28, halign: 'right' },
};

// Place une image en préservant son ratio, centrée dans la boîte, avec un cadre léger.
function placeImage(doc, theme, image, x, y, maxW, maxH) {
  if (!image?.dataUrl || !image.width || !image.height) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Aperçu du plan indisponible.', x + maxW / 2, y + 15, { align: 'center' });
    return { height: 30 };
  }
  const ratio = image.width / image.height;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  const cx = x + (maxW - w) / 2;
  doc.addImage(image.dataUrl, 'PNG', cx, y, w, h);
  doc.setDrawColor(...(theme.borders || [210, 210, 210]));
  doc.setLineWidth(0.3);
  doc.rect(cx, y, w, h, 'S');
  return { x: cx, y, width: w, height: h };
}

// Légende couleur (2 colonnes) : puce + libellé + métrique/quantité. Renvoie le y de fin.
function drawLegend(doc, entries, x, y, totalW) {
  if (!entries.length) return y;
  const colW = totalW / 2;
  const rowH = 6;
  entries.forEach((entry, index) => {
    const col = index % 2;
    const line = Math.floor(index / 2);
    const cellX = x + col * colW;
    const cellY = y + line * rowH;
    doc.setFillColor(...hexToRgb(entry.color));
    doc.roundedRect(cellX, cellY, 4, 4, 0.6, 0.6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const label = cleanText(entry.label || '');
    const truncated = doc.splitTextToSize(label, colW * 0.55)[0] || '';
    doc.text(truncated, cellX + 6, cellY + 3.2);
    const labelW = doc.getTextWidth(truncated);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text(`  ·  ${cleanText(entry.detail || '')}`, cellX + 6 + labelW, cellY + 3.2);
  });
  return y + Math.ceil(entries.length / 2) * rowH;
}

/**
 * @param {object} params
 * @param {object} params.project
 * @param {object} params.branding
 * @param {string} params.fileName - nom du fichier DXF
 * @param {string} params.trancheName - tranche cible (ou « Global »)
 * @param {{dataUrl:string,width:number,height:number}|null} params.overviewImage
 * @param {Array<{color:string,label:string,row:object,mapping:object,article:object,image:object}>} params.entries
 */
export async function generateMeasurePlanPdf({
  project, branding, fileName, trancheName, overviewImage, entries = [],
}) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const THEME = buildTheme(branding);
  const logos = await loadLogos(branding, project);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('fr-FR');

  const rows = entries.map((entry) => ({ ...entry, tableRow: tableRowFor(entry) }));

  drawCoverPage(doc, {
    docType: 'PLAN DES MÉTRÉS DXF',
    title: project?.name || 'Projet',
    subtitle1: fileName || 'Plan DXF',
    subtitle2: trancheName ? `Tranche : ${trancheName}` : '',
    phaseLabel: (getCurrentPhaseCode(project) || '').toUpperCase(),
    clientName: project?.client || 'Non renseigné',
    clientStreet: (project?.clientAddress || '').trim(),
    clientCityZip: [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: project?.location || 'Non renseignée',
    codeAffaire: project?.code || 'Non défini',
    showSignatures: false,
    branding,
    today,
  }, THEME, logos);

  const PW = 297;
  const usableW = PW - M * 2;

  // ── Page « Vue d'ensemble » (paysage) ──
  doc.addPage('a4', 'landscape');
  let y = 14;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...(THEME.primary || [0, 0, 0]));
  doc.text('Vue d’ensemble des métrés', M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Plan sans échelle · cadré sur les éléments mesurés · ${today}`, M, y + 4.5);
  y += 9;

  const overviewBox = placeImage(doc, THEME, overviewImage, M, y, usableW, 96);
  y += overviewBox.height + 5;

  y = drawLegend(
    doc,
    rows.map((entry) => ({ color: entry.color, label: entry.label, detail: metricText(entry.row) })),
    M,
    y,
    usableW,
  ) + 3;

  autoTable(doc, {
    startY: y,
    head: [TAKEOFF_TABLE_HEAD],
    body: rows.map((entry) => entry.tableRow),
    styles: {
      font: 'Helvetica', fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak',
    },
    headStyles: {
      fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5,
    },
    columnStyles: TABLE_COLUMN_STYLES,
    alternateRowStyles: { fillColor: THEME.tableAlt || [245, 245, 245] },
    margin: { left: M, right: M },
  });

  // ── Une page « zoom » par sélection ──
  rows.forEach((entry) => {
    doc.addPage('a4', 'landscape');
    let py = 14;
    doc.setFillColor(...hexToRgb(entry.color));
    doc.roundedRect(M, py - 4, 5, 5, 0.8, 0.8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text(cleanText(entry.label), M + 8, py);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(metricText(entry.row), M + 8, py + 5);
    py += 10;

    const box = placeImage(doc, THEME, entry.image, M, py, usableW, 120);
    py += box.height + 5;

    autoTable(doc, {
      startY: py,
      head: [TAKEOFF_TABLE_HEAD],
      body: [entry.tableRow],
      styles: {
        font: 'Helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak',
      },
      headStyles: {
        fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8,
      },
      columnStyles: TABLE_COLUMN_STYLES,
      margin: { left: M, right: M },
    });
  });

  stampPdfCredit(doc);
  doc.save(`Plan_metres_${safeName(project?.name)}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
