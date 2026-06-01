// src/views/ged/auditExport.js
// Export de l'audit comparatif entre deux versions (Excel + PDF).
// Générateurs chargés dynamiquement (code-splitting), comme les autres exports.

import { formatPrice } from '../../utils/helpers';

const fmt = (n) => formatPrice(n);
const safe = (s) => String(s || '').replace(/[^a-z0-9_-]/gi, '_');

// ─── Export Excel ────────────────────────────────────────────────────
export const exportAuditExcel = async ({ cmp, sourceLabel, targetLabel, projectName }) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EstimaVRD';

  // Feuille 1 — Synthèse
  const s = wb.addWorksheet('Synthèse');
  s.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }];
  s.addRow([`Audit comparatif — ${projectName || ''}`]);
  s.addRow([`${sourceLabel}  →  ${targetLabel}`]);
  s.addRow([]);
  s.addRow(['Indicateur', sourceLabel, targetLabel, 'Écart']);
  s.addRow(['Total HT', cmp.source.totalHT, cmp.target.totalHT, cmp.totalDiff]);
  s.addRow(['Articles', cmp.source.itemCount, cmp.target.itemCount, cmp.target.itemCount - cmp.source.itemCount]);
  s.addRow(['Chapitres', cmp.source.chapters.length, cmp.target.chapters.length, cmp.target.chapters.length - cmp.source.chapters.length]);
  s.addRow([]);
  s.addRow(['Décomposition de l\'écart total']);
  s.addRow(['Total départ', cmp.waterfall.start]);
  s.addRow(['Articles ajoutés', cmp.waterfall.added]);
  s.addRow(['Articles supprimés', cmp.waterfall.removed]);
  s.addRow(['Effet quantité', cmp.waterfall.qtyEffect]);
  s.addRow(['Effet prix', cmp.waterfall.priceEffect]);
  s.addRow(['Total arrivée', cmp.waterfall.end]);
  s.getRow(1).font = { bold: true, size: 14 };
  s.getRow(4).font = { bold: true };
  s.getRow(9).font = { bold: true };

  // Feuille 2 — Articles modifiés
  const m = wb.addWorksheet('Modifiés');
  m.columns = [
    { header: 'Désignation', width: 40 },
    { header: 'Qté source', width: 12 },
    { header: 'Qté cible', width: 12 },
    { header: 'PU source', width: 14 },
    { header: 'PU cible', width: 14 },
    { header: 'Effet qté', width: 14 },
    { header: 'Effet prix', width: 14 },
    { header: 'Écart total', width: 14 },
  ];
  m.getRow(1).font = { bold: true };
  cmp.items.changedByImpact.forEach((c) => {
    m.addRow([c.source.designation, c.source.qty, c.target.qty, c.source.price, c.target.price, c.qtyEffect, c.priceEffect, c.diff]);
  });

  // Feuille 3 — Ajoutés / Supprimés
  const a = wb.addWorksheet('Ajoutés-Supprimés');
  a.columns = [{ header: 'Mouvement', width: 14 }, { header: 'Désignation', width: 40 }, { header: 'Qté', width: 10 }, { header: 'PU', width: 14 }, { header: 'Montant', width: 14 }];
  a.getRow(1).font = { bold: true };
  cmp.items.added.forEach((i) => a.addRow(['Ajouté', i.designation, i.qty, i.price, i.amount]));
  cmp.items.removed.forEach((i) => a.addRow(['Supprimé', i.designation, i.qty, i.price, i.amount]));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const { saveFileWithPicker, FILE_TYPES, PICKER_IDS } = await import('../../utils/fileSaver');
  await saveFileWithPicker(blob, `Audit_${safe(sourceLabel)}_${safe(targetLabel)}.xlsx`, FILE_TYPES.excel, PICKER_IDS.exportExcel);
};

// ─── Export PDF (synthèse + articles modifiés) ───────────────────────
export const exportAuditPdf = async ({ cmp, sourceLabel, targetLabel, projectName }) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(14); doc.setFont('Helvetica', 'bold');
  doc.text('Audit comparatif', 14, 18);
  doc.setFontSize(10); doc.setFont('Helvetica', 'normal');
  doc.text(`${projectName || ''}`, 14, 25);
  doc.text(`${sourceLabel}  →  ${targetLabel}   ·   ${today}`, 14, 31);

  autoTable(doc, {
    startY: 38,
    head: [['Indicateur', sourceLabel, targetLabel, 'Écart']],
    body: [
      ['Total HT', fmt(cmp.source.totalHT), fmt(cmp.target.totalHT), fmt(cmp.totalDiff)],
      ['Articles', cmp.source.itemCount, cmp.target.itemCount, cmp.target.itemCount - cmp.source.itemCount],
      ['Chapitres', cmp.source.chapters.length, cmp.target.chapters.length, cmp.target.chapters.length - cmp.source.chapters.length],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Décomposition de l\'écart', 'Montant']],
    body: [
      ['Total départ', fmt(cmp.waterfall.start)],
      ['+ Articles ajoutés', fmt(cmp.waterfall.added)],
      ['− Articles supprimés', fmt(cmp.waterfall.removed)],
      ['± Effet quantité', fmt(cmp.waterfall.qtyEffect)],
      ['± Effet prix', fmt(cmp.waterfall.priceEffect)],
      ['= Total arrivée', fmt(cmp.waterfall.end)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  if (cmp.items.changedByImpact.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [['Article modifié', 'Qté', 'PU', 'Effet qté', 'Effet prix', 'Écart']],
      body: cmp.items.changedByImpact.map((c) => [
        c.source.designation,
        `${c.source.qty} → ${c.target.qty}`,
        `${fmt(c.source.price)} → ${fmt(c.target.price)}`,
        fmt(c.qtyEffect),
        fmt(c.priceEffect),
        fmt(c.diff),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [217, 119, 6] },
      columnStyles: { 0: { cellWidth: 60 } },
    });
  }

  const blob = doc.output('blob');
  const { saveFileWithPicker, FILE_TYPES, PICKER_IDS } = await import('../../utils/fileSaver');
  await saveFileWithPicker(blob, `Audit_${safe(sourceLabel)}_${safe(targetLabel)}.pdf`, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
};
