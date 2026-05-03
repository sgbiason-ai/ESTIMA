// src/utils/pdf/pdfExpenseNotesGenerator.js
// Generation du PDF "Note de frais kilometriques" mensuelle.
// Aligne sur l'UI ecran : trajets groupes par date, badges motif colores,
// marquage weekend / jour ferie sur les en-tetes de groupe.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildTheme } from './buildTheme';
import { loadImage } from './pdfSharedHelpers';
import { getMotifColor } from '../motifColors';
import { getHolidayLabel, getWeekendName } from '../frenchHolidays';

// Nettoyage caracteres non-WinAnsi (helvetica jsPDF)
const clean = (s) => String(s || '')
  .replace(/[  ​ ]/g, ' ')
  .replace(/[‘’′]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...');

const formatEur = (n) =>
  clean(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0));

const formatKm = (n) => clean(`${(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`);

const formatDateLong = (iso) => {
  if (!iso) return 'Sans date';
  const date = new Date(iso + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return iso;
  // jsPDF helvetica = WinAnsi, donc clean pour eviter les surprises
  return clean(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date));
};

const formatTrajet = (trip) => {
  const parts = [trip.departure || '?'];
  for (const w of trip.waypoints || []) {
    if (w?.label) parts.push(w.label);
  }
  parts.push(trip.arrival || '?');
  let s = parts.join(' -> ');
  // Annotation A/R
  if (trip.roundTrip) {
    s += (trip.waypoints?.length > 0) ? '  (+ retour direct)' : '  (A/R)';
  }
  return clean(s);
};

// Couleur de fond du group header selon le type de jour
//  - férié : rose pâle    (rose-50)
//  - weekend : ambre pâle (amber-50)
//  - normal : neutre (theme.tableBg)
const groupHeaderBg = (dateStr, theme) => {
  if (getHolidayLabel(dateStr)) return [255, 241, 242];   // rose-50
  if (getWeekendName(dateStr)) return [255, 251, 235];     // amber-50
  return theme.tableBg;
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
 * @param {object} opts.branding
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

  // Logo a gauche si dispo
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
  doc.text(clean(`${ratePerKm.toFixed(3)} EUR/km`), baremeX, y + 17);
  doc.setTextColor(...theme.text);

  // Utilisateur (si fourni)
  if (userName) {
    doc.setFontSize(8);
    doc.setTextColor(...theme.lightText);
    doc.text(clean(`Beneficiaire : ${userName}`), margin + 3, y + 21);
  }

  // ── Tableau des trajets, groupé par date ───────────────────────────────────
  // 4 colonnes : Motif | Trajet | KM | Montant
  // Date dans les headers de groupe (avec weekend/ferie eventuel)

  // Tri + groupement par date ISO
  const groupedByDate = (() => {
    const sorted = [...tripsWithAmount].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const map = new Map();
    for (const t of sorted) {
      const d = t.date || '';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(t);
    }
    return [...map.entries()];
  })();

  const body = [];
  for (const [dateStr, dateTrips] of groupedByDate) {
    const holiday = getHolidayLabel(dateStr);
    const weekend = !holiday ? getWeekendName(dateStr) : null;
    const dateKm = dateTrips.reduce((s, t) => s + (t.effectiveKm || 0), 0);
    const dateAmount = dateTrips.reduce((s, t) => s + (t.amount || 0), 0);

    // Label : "Lundi 4 mai" + tag eventuel
    let label = formatDateLong(dateStr);
    if (holiday) label += ` - Ferie : ${clean(holiday)}`;
    else if (weekend) label += ` - ${weekend}`;

    const headerBg = groupHeaderBg(dateStr, theme);
    const headerText = holiday ? [136, 19, 55] : weekend ? [146, 64, 14] : theme.text; // rose-900 / amber-900 / default

    // Group header row : date plus grande et plus marquee que les badges motif
    // pour que le repere temporel domine visuellement.
    const headerStyle = {
      fillColor: headerBg,
      fontStyle: 'bold',
      fontSize: 11,
      textColor: headerText,
      cellPadding: { top: 3.5, right: 2.5, bottom: 3.5, left: 2.5 },
      minCellHeight: 9,
    };
    body.push([
      {
        content: label,
        colSpan: 2,
        styles: headerStyle,
      },
      {
        content: formatKm(dateKm),
        styles: { ...headerStyle, halign: 'right' },
      },
      {
        content: formatEur(dateAmount),
        styles: { ...headerStyle, halign: 'right' },
      },
    ]);

    // Trip rows pour cette date
    for (const t of dateTrips) {
      const motif = (t.motif || '').trim();
      const motifColor = motif ? getMotifColor(motif).pdf : null;
      body.push([
        {
          content: motif || '-',
          styles: motifColor
            ? { fillColor: motifColor.bg, textColor: motifColor.text, fontStyle: 'bold', fontSize: 8 }
            : { fontSize: 8, textColor: [156, 163, 175] /* gray-400 */ },
        },
        clean(formatTrajet(t)),
        formatKm(t.effectiveKm),
        formatEur(t.amount),
      ]);
    }
  }

  autoTable(doc, {
    startY: y + 28,
    head: [['Motif', 'Trajet', 'KM', 'Montant']],
    body,
    foot: [
      [
        { content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
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
    columnStyles: {
      0: { cellWidth: 40 },           // Motif
      1: { cellWidth: 'auto' },       // Trajet
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
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
