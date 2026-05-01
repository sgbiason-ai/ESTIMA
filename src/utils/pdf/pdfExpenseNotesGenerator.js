// src/utils/pdf/pdfExpenseNotesGenerator.js
// Generation du PDF "Note de frais kilometriques" mensuelle.
// Utilise le branding centralise (logo, couleurs primaires, identite societe).

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildTheme } from './buildTheme';
import { loadImage } from './pdfSharedHelpers';

// Nettoyage caracteres non-WinAnsi (helvetica jsPDF)
const clean = (s) => String(s || '')
  .replace(/[  ​ ]/g, ' ')
  .replace(/[‘’′]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...');

const formatEur = (n) =>
  clean(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0));

const formatKm = (n) => clean(`${(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`);

const formatDateShort = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const formatTrajet = (trip) => {
  const parts = [trip.departure || '?'];
  for (const w of trip.waypoints || []) {
    if (w?.label) parts.push(w.label);
  }
  parts.push(trip.arrival || '?');
  return parts.join(' -> ') + (trip.roundTrip ? '  (A/R)' : '');
};

/**
 * @param {object} opts
 * @param {string} opts.monthLabel
 * @param {object} opts.vehicle
 * @param {Array}  opts.tripsWithAmount
 * @param {number} opts.totalKm
 * @param {number} opts.totalAmount
 * @param {string} opts.trancheLabel
 * @param {number} opts.ratePerKm
 * @param {boolean} opts.forcedTranche
 * @param {object} opts.branding   — branding resolu (useBranding)
 * @param {string} opts.userName
 */
export async function generateExpenseNotesPdf(opts) {
  const {
    monthLabel,
    vehicle,
    tripsWithAmount,
    totalKm,
    totalAmount,
    trancheLabel,
    ratePerKm,
    forcedTranche,
    branding = {},
    userName,
  } = opts;

  const theme = buildTheme(branding);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ── Bandeau d'en-tete couleur primaire ─────────────────────────────────────
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, pageW, 28, 'F');

  // Logo à gauche si dispo
  let titleX = margin;
  if (branding.logo) {
    try {
      const img = await loadImage(branding.logo);
      if (img) {
        const maxLogoH = 18;
        const ratio = img.width / img.height;
        const logoH = maxLogoH;
        const logoW = Math.min(40, logoH * ratio);
        doc.addImage(img, 'PNG', margin, 5, logoW, logoH);
        titleX = margin + logoW + 6;
      }
    } catch { /* ignore */ }
  }

  // Titre + société
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255);
  doc.text('Note de frais kilometriques', titleX, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(monthLabel, titleX, 19);

  // Identité société (à droite)
  if (branding.companyName) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(clean(branding.companyName), pageW - margin, 10, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const right = [];
    if (branding.address) right.push(branding.address);
    const cityLine = [branding.zip, branding.city].filter(Boolean).join(' ');
    if (cityLine) right.push(cityLine);
    if (branding.phone) right.push(branding.phone);
    let ry = 14;
    for (const line of right.slice(0, 3)) {
      doc.text(clean(line), pageW - margin, ry, { align: 'right' });
      ry += 3.5;
    }
  }

  // ── Bloc vehicule + bareme ─────────────────────────────────────────────────
  doc.setTextColor(...theme.text);
  let y = 36;
  doc.setFillColor(...theme.lightBg);
  doc.setDrawColor(...theme.borders);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'FD');

  // Vehicule (gauche)
  doc.setFontSize(7);
  doc.setTextColor(...theme.lightText);
  doc.text('VEHICULE', margin + 3, y + 5);
  doc.setTextColor(...theme.text);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(clean(vehicle.label || '-'), margin + 3, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...theme.lightText);
  const subParts = [];
  if (vehicle.puissanceLabel) subParts.push(vehicle.puissanceLabel);
  if (vehicle.plateNumber) subParts.push(vehicle.plateNumber);
  if (vehicle.isElectric) subParts.push('Electrique +20%');
  doc.text(clean(subParts.join('  ·  ')), margin + 3, y + 16);

  // Bareme (droite)
  const baremeX = pageW - margin - 70;
  doc.setFontSize(7);
  doc.text('BAREME APPLIQUE', baremeX, y + 5);
  doc.setTextColor(...theme.text);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(clean(trancheLabel + (forcedTranche ? ' (forcee)' : '')), baremeX, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...theme.primary);
  doc.text(clean(`${ratePerKm.toFixed(3)} €/km`), baremeX, y + 17);
  doc.setTextColor(...theme.text);

  // Utilisateur (si fourni)
  if (userName) {
    doc.setFontSize(8);
    doc.setTextColor(...theme.lightText);
    doc.text(clean(`Beneficiaire : ${userName}`), margin + 3, y + 21);
  }

  // ── Tableau des trajets ────────────────────────────────────────────────────
  const body = tripsWithAmount.map((t) => [
    formatDateShort(t.date),
    clean(t.motif || ''),
    clean(formatTrajet(t)),
    formatKm(t.effectiveKm),
    formatEur(t.amount),
  ]);

  autoTable(doc, {
    startY: y + 28,
    head: [['Date', 'Motif', 'Trajet', 'KM', 'Montant']],
    body,
    foot: [
      [
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatKm(totalKm), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatEur(totalAmount), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
    ],
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: theme.borders,
      lineWidth: 0.2,
      textColor: theme.text,
    },
    headStyles: {
      fillColor: theme.primary,
      textColor: theme.white,
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: theme.tableBg,
      textColor: theme.text,
    },
    alternateRowStyles: {
      fillColor: theme.lightBg,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 35 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  // ── Pied de page ───────────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 8;

  // Note infobulle
  if (finalY < pageH - 25) {
    doc.setFillColor(...theme.lightBg);
    doc.setDrawColor(...theme.borders);
    doc.roundedRect(margin, finalY, pageW - margin * 2, 12, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...theme.lightText);
    const note = `Bareme kilometrique fiscal francais ${forcedTranche ? '(tranche forcee)' : '(tranche selon cumul)'}${vehicle.isElectric ? ' avec bonus +20% vehicule electrique' : ''}.`;
    doc.text(clean(note), margin + 3, finalY + 5);
    if (branding.tagline) {
      doc.text(clean(branding.tagline), margin + 3, finalY + 9);
    }
  }

  // Footer date
  doc.setFontSize(7.5);
  doc.setTextColor(...theme.lightText);
  doc.text(
    clean(`Document genere le ${new Date().toLocaleDateString('fr-FR')} - EstimaVRD`),
    pageW / 2,
    pageH - 8,
    { align: 'center' }
  );

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  const fileName = `note-frais-${monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(fileName);
}
