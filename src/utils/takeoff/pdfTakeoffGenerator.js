// src/utils/takeoff/pdfTakeoffGenerator.js
// Feuille de métré DXF (PDF) : page de garde branding + tableau détaillé par section
// (une section = un import / une tranche) : calque · type · quantité mesurée · article ·
// coefficient · conversion (épaisseur/densité/largeur) · quantité appliquée.
// Texte WinAnsi-safe (jsPDF Helvetica = CP1252) : pas de « → », « − »… (cf. pièges PDF).

import {
  cleanText, loadLogos, drawCoverPage, formatNumberFr,
} from '../pdf/pdfSharedHelpers';
import { buildTheme } from '../pdf/buildTheme';
import { getCurrentPhaseCode } from '../phaseModel';
import { stampPdfCredit } from '../estimaCredit';
import { METRIC_LABELS } from './dxfTakeoff';
import { flattenProjectItems, takeoffGeoSpec, takeoffConversionFactor } from './applyTakeoff';

const M = 15;
const fmtQty = (n) => formatNumberFr(n);

const positive = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : null; };

// N'affiche QUE les paramètres réellement renseignés (> 0) → pas de « ép 0 · d 0 » trompeur
// pour les anciens imports où la géométrie n'était pas encore mémorisée.
function conversionText(spec, geo) {
  if (!spec) return '-';
  const parts = [];
  if (spec.needsLargeur && positive(geo?.largeur) != null) parts.push(`larg ${positive(geo.largeur)}`);
  if (spec.needsEpaisseur && positive(geo?.epaisseur) != null) parts.push(`ép ${positive(geo.epaisseur)}`);
  if (spec.needsDensity && positive(geo?.densite) != null) parts.push(`d ${positive(geo.densite)}`);
  if (positive(geo?.perte) != null) parts.push(`perte ${positive(geo.perte)}%`);
  return parts.length ? parts.join(' · ') : '-';
}

// Construit une ligne de tableau [calque, type, qté mesurée, article, coef, conversion, qté appliquée].
function formatRow({
  layer, metric, measuredQty, article, coefficient, geo, appliedQty,
}) {
  const metricInfo = METRIC_LABELS[metric] || { label: metric, unit: '' };
  const articleUnit = article?.unit || '';
  const spec = article ? takeoffGeoSpec(metricInfo.unit, articleUnit) : null;
  const needs = !!(spec && (spec.needsLargeur || spec.needsEpaisseur || spec.needsDensity));
  const conv = article ? takeoffConversionFactor(metricInfo.unit, articleUnit, geo || {}) : 1;
  const coef = Number.isFinite(Number(coefficient)) ? Number(coefficient) : 1;
  const applied = appliedQty != null ? Number(appliedQty) : Number(measuredQty || 0) * coef * conv;
  // Quantité mesurée : valeur stockée, sinon rétro-calculée depuis l'appliquée quand c'est possible
  // (anciens imports sans mesuré : mesuré = appliqué / (coef × conversion)).
  let measured = positive(measuredQty);
  if (measured == null && appliedQty != null && coef > 0 && conv > 0) measured = Number(appliedQty) / (coef * conv);
  const targetUnit = needs ? articleUnit : metricInfo.unit;
  return [
    cleanText(layer || ''),
    metricInfo.label,
    measured != null ? `${fmtQty(measured)} ${metricInfo.unit}` : '-',
    article ? `${cleanText(article.designation)} [${articleUnit || '-'}]` : '(article introuvable)',
    coef === 1 ? '1' : fmtQty(coef),
    needs ? conversionText(spec, geo) : '-',
    `${fmtQty(applied)} ${targetUnit}`,
  ];
}

const safeName = (name) => String(name || 'projet').replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'projet';

/**
 * @param {object} params
 * @param {object} params.project
 * @param {object} params.branding
 * @param {string} params.subtitle - sous-titre du document (ex. « Métré courant »)
 * @param {Array<{ heading: string, subheading?: string, rows: string[][] }>} params.sections
 *   rows = [calque, type, qté mesurée, article, coef, conversion, qté appliquée] (déjà formatés)
 */
export async function generateTakeoffPdf({
  project, branding, subtitle = '', sections = [],
}) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const THEME = buildTheme(branding);
  const { logoMoe, logoClient, logoCoTraitants } = await loadLogos(branding, project);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('fr-FR');

  drawCoverPage(doc, {
    docType: 'FEUILLE DE MÉTRÉ DXF',
    title: project?.name || 'Projet',
    subtitle1: subtitle,
    phaseLabel: (getCurrentPhaseCode(project) || '').toUpperCase(),
    clientName: project?.client || 'Non renseigné',
    clientStreet: (project?.clientAddress || '').trim(),
    clientCityZip: [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: project?.location || 'Non renseignée',
    codeAffaire: project?.code || 'Non défini',
    showSignatures: false,
    branding,
    today,
  }, THEME, { logoMoe, logoClient, logoCoTraitants });

  doc.addPage();
  let y = 20;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...(THEME.primary || [0, 0, 0]));
  doc.text('Feuille de métré DXF', M, y);
  y += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Généré le ${today}`, M, y + 3);
  y += 10;

  if (sections.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune association de métré à documenter.', M, y);
  }

  sections.forEach((section) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(cleanText(section.heading || 'Métré'), M, y);
    y += 4.5;
    if (section.subheading) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(cleanText(section.subheading), M, y);
      y += 4;
    }

    autoTable(doc, {
      startY: y,
      head: [['Calque', 'Type', 'Qté mesurée', 'Article', 'Coef.', 'Conversion', 'Qté appliquée']],
      body: section.rows,
      styles: {
        font: 'Helvetica', fontSize: 7.5, cellPadding: 2, overflow: 'linebreak',
      },
      headStyles: {
        fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 33 },
        1: { cellWidth: 16 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 12, halign: 'right' },
        5: { cellWidth: 26 },
        6: { cellWidth: 24, halign: 'right' },
      },
      alternateRowStyles: { fillColor: THEME.tableAlt || [245, 245, 245] },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  stampPdfCredit(doc);
  doc.save(`Metre_DXF_${safeName(project?.name)}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** PDF du métré COURANT (associations en cours dans la fenêtre). */
export async function generateCurrentTakeoffPdf({
  project, branding, mappings, rows, projectItems, fileName, trancheName,
}) {
  const rowMap = new Map((rows || []).map((r) => [r.id, r]));
  const items = projectItems || [];
  const body = Object.entries(mappings || {})
    .filter(([, mapping]) => mapping?.itemId)
    .map(([rowId, mapping]) => {
      const row = rowMap.get(rowId);
      if (!row) return null;
      const article = items.find((i) => String(i.id) === String(mapping.itemId));
      return formatRow({
        layer: row.layer, metric: row.metric, measuredQty: row.quantity, article, coefficient: mapping.coefficient, geo: mapping,
      });
    })
    .filter(Boolean);
  await generateTakeoffPdf({
    project,
    branding,
    subtitle: 'Métré courant',
    sections: [{ heading: fileName || 'Plan DXF', subheading: trancheName || 'Global', rows: body }],
  });
}

/**
 * PDF de l'HISTORIQUE des imports DXF. Les anciens imports ne mémorisaient pas la surface
 * mesurée ni la géométrie de conversion ; on les COMPLÈTE depuis le DXF actuellement chargé
 * quand le fichier correspond (currentFile/currentRows/currentMappings).
 */
export async function generateHistoryTakeoffPdf({
  project, branding, currentFile, currentRows = [], currentMappings = {},
}) {
  const byId = new Map(flattenProjectItems(project?.chapters).map((i) => [String(i.id), i]));
  const trancheName = new Map((project?.tranches || []).map((t) => [t.id, t.name]));
  const measuredByRow = new Map((currentRows || []).map((r) => [r.id, r.quantity]));
  const firstOf = (...vals) => vals.find((v) => v != null && v !== '');

  const sections = (project?.takeoffImports || []).slice().reverse().map((imp) => {
    const dateStr = imp.importedAt ? new Date(imp.importedAt).toLocaleDateString('fr-FR') : '';
    const tName = imp.trancheId && imp.trancheId !== 'global' ? (trancheName.get(imp.trancheId) || imp.trancheId) : 'Global';
    const modeStr = imp.mode === 'add' ? 'ajout' : 'remplacement';
    const sameFile = currentFile && imp.fileName === currentFile;
    return {
      heading: imp.fileName || 'Plan DXF',
      subheading: `${tName} · ${dateStr} · ${modeStr}`,
      rows: (imp.mappings || []).map((mp) => {
        const rowId = `${mp.layer}::${mp.metric}`;
        const cur = sameFile ? currentMappings[rowId] : null;
        const measured = firstOf(mp.measuredQuantity, sameFile ? measuredByRow.get(rowId) : null);
        const geo = {
          largeur: firstOf(mp.largeur, cur?.largeur),
          epaisseur: firstOf(mp.epaisseur, cur?.epaisseur),
          densite: firstOf(mp.densite, cur?.densite),
          perte: firstOf(mp.perte, cur?.perte),
        };
        return formatRow({
          layer: mp.layer, metric: mp.metric, measuredQty: measured, article: byId.get(String(mp.itemId)), coefficient: mp.coefficient, geo, appliedQty: mp.quantity,
        });
      }),
    };
  });
  await generateTakeoffPdf({
    project, branding, subtitle: 'Historique des imports', sections,
  });
}
