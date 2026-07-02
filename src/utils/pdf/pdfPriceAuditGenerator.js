// src/utils/pdf/pdfPriceAuditGenerator.js
// PDF « Audit des prix » — comparaison prix projet vs bibliothèque (BPU).
// Fidèle à l'écran (PriceAuditModal) : mêmes lignes (filtre + recherche actifs),
// groupées par chapitre, avec stats globales et impact total des écarts.
// A4 paysage. Colonne « Prix observé » (remontées RAO) incluse si renseignée.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildTheme } from './buildTheme';
import { loadLogos, renderLogo, drawMoeFooter, sanitizeFilename, fitTextToWidth } from './pdfSharedHelpers';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from '../fileSaver';

// Espaces spéciaux fr-FR (NBSP, NNBSP…) → espace simple, sinon jsPDF les rend mal.
const clean = (s) => String(s ?? '').replace(/[\u00A0\u2009\u202F\u200B\u2060\u3000]/g, ' ');

const formatEur = (n) =>
  clean(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)) + ' €';

const FILTER_LABELS = {
  all: 'Tous les articles',
  match: 'Conformes uniquement',
  diff: 'Écarts uniquement',
  missing: 'Absents de la bibliothèque',
};

const STATUS_LABELS = { match: 'Conforme', diff: 'Écart', missing: 'Absent BPU' };

// Couleurs de statut/écart — parité avec l'écran (amber/red/emerald/violet Tailwind).
const COLORS = {
  red:     [220, 38, 38],
  emerald: [5, 150, 105],
  amber:   [217, 119, 6],
  violet:  [109, 40, 217],
  amberBg: [255, 251, 235],
};

/**
 * @param {object} opts
 * @param {object} opts.project        - projet (name, phases…)
 * @param {Array}  opts.rows           - lignes affichées à l'écran (déjà filtrées/cherchées)
 * @param {object} opts.stats          - { total, match, diff, missing } sur TOUT l'audit
 * @param {number} opts.totalImpact    - somme des écarts de P.U. (tout l'audit)
 * @param {string} opts.filterMode     - 'all' | 'match' | 'diff' | 'missing'
 * @param {string} opts.search         - recherche active (contexte imprimé si non vide)
 * @param {object} [opts.branding]     - masterBranding (thème + logos + pied de page)
 */
export async function generatePriceAuditPdf({ project, rows, stats, totalImpact, filterMode, search, branding }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const THEME = buildTheme(branding);
  const today = new Date().toLocaleDateString('fr-FR');
  const pageWidth = doc.internal.pageSize.width;
  const margin = 12;

  const { logoMoe } = await loadLogos(branding, project);

  // Colonne « Prix observé » seulement si au moins une ligne en porte un.
  const hasObserved = rows.some(r => r.observedPrice !== null && r.observedPrice !== undefined);

  // ── En-tête de page (répété via didDrawPage) ──
  const drawHeader = () => {
    doc.setFillColor(...THEME.primary);
    doc.rect(0, 0, pageWidth, 3, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...THEME.primary);
    doc.text('AUDIT DES PRIX', margin, 13);
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    doc.setFont('Helvetica', 'normal');
    doc.text(fitTextToWidth(doc, clean(`${project?.name || 'Projet'} — prix projet vs bibliothèque (BPU)`), pageWidth - 2 * margin - 45), margin, 18.5);
    if (logoMoe) renderLogo(doc, logoMoe, pageWidth - margin - 38, 6, 38, 13);
  };
  drawHeader();

  // ── Contexte : filtre + recherche (le PDF reflète l'affichage) ──
  const contextParts = [FILTER_LABELS[filterMode] || FILTER_LABELS.all];
  if (search?.trim()) contextParts.push(`recherche « ${search.trim()} »`);
  contextParts.push(`${rows.length} ligne${rows.length > 1 ? 's' : ''}`);

  doc.setFontSize(7.5);
  doc.setTextColor(...THEME.lightText);
  doc.text(clean(`Contenu : ${contextParts.join(' · ')} — édité le ${today}`), margin, 24.5);

  // ── Bandeau stats (sur l'audit complet) ──
  const statCells = [
    { label: 'Articles audités', value: String(stats.total), color: THEME.text },
    { label: 'Conformes', value: String(stats.match), color: COLORS.emerald },
    { label: 'Écarts', value: String(stats.diff), color: COLORS.amber },
    { label: 'Absents BPU', value: String(stats.missing), color: COLORS.red },
    {
      label: 'Impact des écarts (P.U.)',
      value: stats.diff > 0 ? `${totalImpact > 0 ? '+' : ''}${formatEur(totalImpact)}` : '—',
      color: totalImpact > 0 ? COLORS.red : totalImpact < 0 ? COLORS.emerald : THEME.lightText,
    },
  ];
  const statW = (pageWidth - 2 * margin - 4 * 3) / 5;
  let statX = margin;
  statCells.forEach(({ label, value, color }) => {
    doc.setFillColor(...THEME.lightBg);
    doc.setDrawColor(...THEME.borders);
    doc.roundedRect(statX, 27.5, statW, 13, 1.5, 1.5, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...color);
    doc.text(clean(value), statX + 3, 34);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...THEME.lightText);
    doc.text(clean(label.toUpperCase()), statX + 3, 38.5);
    statX += statW + 3;
  });

  // ── Corps : lignes groupées par chapitre (même ordre qu'à l'écran) ──
  const grouped = new Map();
  rows.forEach(item => {
    const key = item.path.join(' › ') || 'Racine';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  const body = [];
  const rowMeta = []; // aligné sur body : type + statut pour le styling
  const colCount = hasObserved ? 7 : 6;
  grouped.forEach((items, chapterKey) => {
    body.push([{ content: clean(chapterKey.toUpperCase()), colSpan: colCount }]);
    rowMeta.push({ type: 'chapter' });
    items.forEach(item => {
      const ecart = item.diff === null ? '—'
        : `${item.diff > 0 ? '+' : ''}${formatEur(item.diff)}${item.pctDiff !== null && item.pctDiff !== 0 ? ` (${item.pctDiff > 0 ? '+' : ''}${item.pctDiff.toFixed(1)}%)` : ''}`;
      const observed = item.observedPrice !== null && item.observedPrice !== undefined
        ? `${formatEur(item.observedPrice)}${item.obsPctDiff !== null ? ` (${item.obsPctDiff > 0 ? '+' : ''}${item.obsPctDiff.toFixed(1)}%)` : ''}`
        : '—';
      const row = [
        clean(item.designation),
        clean(item.unit),
        formatEur(item.projectPrice),
        item.bpuPrice !== null ? formatEur(item.bpuPrice) : '—',
      ];
      if (hasObserved) row.push(observed);
      row.push(ecart, STATUS_LABELS[item.status] || '');
      body.push(row);
      rowMeta.push({ type: 'item', status: item.status, diff: item.diff, obsPctDiff: item.obsPctDiff });
    });
  });

  const head = [[
    'Désignation', 'U', 'Prix projet', 'Prix BPU',
    ...(hasObserved ? ['Prix observé (RAO)'] : []),
    'Écart', 'Statut',
  ]];

  autoTable(doc, {
    startY: 44,
    margin: { left: margin, right: margin, top: 22 },
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'Helvetica', fontSize: 7.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      textColor: THEME.text, lineColor: THEME.borders, lineWidth: 0.15, overflow: 'linebreak',
    },
    headStyles: { fillColor: THEME.tableHeader, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    columnStyles: hasObserved ? {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' },
      5: { cellWidth: 34, halign: 'right' },
      6: { cellWidth: 20, halign: 'center' },
    } : {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 36, halign: 'right' },
      5: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const meta = rowMeta[data.row.index];
      if (!meta) return;
      if (meta.type === 'chapter') {
        data.cell.styles.fillColor = THEME.chapterBg;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
        data.cell.styles.textColor = THEME.primary;
        return;
      }
      if (meta.status === 'diff') data.cell.styles.fillColor = COLORS.amberBg;
      const ecartCol = hasObserved ? 5 : 4;
      const statusCol = hasObserved ? 6 : 5;
      if (data.column.index === ecartCol && meta.diff !== null) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = meta.diff > 0 ? COLORS.red : meta.diff < 0 ? COLORS.emerald : THEME.lightText;
      }
      if (hasObserved && data.column.index === 4 && data.cell.raw !== '—') {
        data.cell.styles.textColor = COLORS.violet;
      }
      if (data.column.index === statusCol) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 6.5;
        data.cell.styles.textColor =
          meta.status === 'match' ? COLORS.emerald :
          meta.status === 'diff' ? COLORS.amber : COLORS.red;
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader();
    },
  });

  // ── Pied de page MOE + pagination sur chaque page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawMoeFooter(doc, branding, THEME, today);
    doc.setFontSize(7);
    doc.setTextColor(...THEME.lightText);
    doc.text(`Page ${p} / ${totalPages}`, pageWidth / 2, doc.internal.pageSize.height - 6, { align: 'center' });
  }

  const fileName = `Audit_Prix_${sanitizeFilename(project?.name || 'Projet')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  await saveFileWithPicker(doc.output('blob'), fileName, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
}
