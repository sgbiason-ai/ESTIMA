// src/utils/tp/tpPdfExport.js
// ESTIMA TP — export PDF du chiffrage : bordereau chiffré (DQE) + sous-détails par article.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildRefMap } from '../projectCalculations';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from '../fileSaver';
import {
  computeDetail, defaultCoefficients, POSTES, POSTE_LABELS, effectiveDuree,
  ressourceCosts, fournitureQty, fournitureCost, sousTraitanceCost,
} from './tpPriceCompute';

const e2 = (n) => `${(Number(n || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const HEAD = { fillColor: [17, 24, 39], textColor: 255, fontSize: 7.5, fontStyle: 'bold' };
const ORANGE = [234, 88, 12];

function collectArticles(chapters) {
  const refMap = buildRefMap(chapters || [], { numberingMode: 'hierarchical' });
  const arts = [];
  const walk = (nodes) => (nodes || []).forEach(n => {
    if (!n) return;
    if (n.type === 'item') arts.push({ node: n, num: refMap.get(n.id) || '' });
    if (n.children) walk(n.children);
  });
  walk(chapters);
  return arts;
}

export async function generateTpPdf(study) {
  const chapters = study?.cadre?.chapters || [];
  const coef = study?.coefficients || defaultCoefficients();
  const arts = collectArticles(chapters);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // ── En-tête ─────────────────────────────────────────────────────────────────
  doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(...ORANGE);
  doc.text('ESTIMA TP', 14, 16);
  doc.setTextColor(17, 24, 39); doc.setFontSize(13);
  doc.text(study?.name || 'Étude de prix', 14, 23);
  doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
  const meta = [study?.reference && `Réf : ${study.reference}`, study?.maitreOuvrage && `Maître d'ouvrage : ${study.maitreOuvrage}`].filter(Boolean).join('     ');
  if (meta) doc.text(meta, 14, 29);

  // ── Bordereau chiffré (récap) ────────────────────────────────────────────────
  const tot = { deb: 0, vente: 0 };
  const body = arts.map(({ node, num }) => {
    const qte = Number(node.qty || 0);
    const r = computeDetail(node.detail, qte, coef);
    tot.deb += r.deboursecSec; tot.vente += r.totalVente;
    return [num, node.designation || '', qte.toLocaleString('fr-FR'), node.unit || '', e2(r.puSec), e2(r.puRetenu), e2(r.totalVente)];
  });
  autoTable(doc, {
    startY: 34,
    head: [['N°', 'Désignation', 'Qté', 'U', 'PU sec', 'PU vente', 'Total vente']],
    body,
    foot: [['', 'TOTAL HT', '', '', e2(tot.deb), '', e2(tot.vente)]],
    headStyles: HEAD,
    footStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 14 }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // ── Sous-détails ─────────────────────────────────────────────────────────────
  arts.filter(a => a.node.detail).forEach(({ node, num }) => {
    const qte = Number(node.qty || 0);
    const d = node.detail;
    const r = computeDetail(d, qte, coef);
    doc.addPage();
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(17, 24, 39);
    doc.text(`${num ? num + ' — ' : ''}${node.designation || ''}`, 14, 16);
    doc.setFontSize(8.5); doc.setFont(undefined, 'normal'); doc.setTextColor(107, 114, 128);
    doc.text(`Quantité : ${qte} ${node.unit}     Rendement : ${d.rendement || 0}/j     Durée : ${effectiveDuree(d, qte)} j`, 14, 22);

    let y = 27;
    const res = (key, label) => {
      const lines = d[key] || [];
      if (!lines.length) return;
      autoTable(doc, {
        startY: y,
        head: [[label, 'Nb', 'Durée', 'PU/J', 'Amort.', 'Entret.', 'Cons.', 'Loc.', 'Total']],
        body: lines.map(l => { const c = ressourceCosts(l); return [l.designation || '', l.nombre, l.duree, e2(l.puJour), e2(l.amort), e2(l.entret), e2(l.cons), e2(l.loc), e2(c.perso + c.mat)]; }),
        headStyles: { ...HEAD, fillColor: ORANGE }, bodyStyles: { fontSize: 7 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 3;
    };
    res('materiel', 'Matériel'); res('mo', "Main d'œuvre"); res('transport', 'Transport');

    if ((d.fourniture || []).length) {
      autoTable(doc, {
        startY: y,
        head: [['Fournitures', 'U', 'Épaiss.', 'Densité', 'Qté', 'PU barème', 'PU forcé', 'Total']],
        body: d.fourniture.map(l => [l.designation || '', l.unit || '', l.epaisseur || '', l.densite || '', fournitureQty(l, qte).toLocaleString('fr-FR'), e2(l.puBareme), l.puForce ? e2(l.puForce) : '—', e2(fournitureCost(l, qte))]),
        headStyles: { ...HEAD, fillColor: [16, 185, 129] }, bodyStyles: { fontSize: 7 },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 3;
    }
    if ((d.soustraitance || []).length) {
      autoTable(doc, {
        startY: y,
        head: [['Sous-traitance', 'U', 'Qté', 'PU barème', 'PU forcé', 'Total']],
        body: d.soustraitance.map(l => [l.designation || '', l.unit || '', l.qte || '', e2(l.puBareme), l.puForce ? e2(l.puForce) : '—', e2(sousTraitanceCost(l))]),
        headStyles: { ...HEAD, fillColor: [124, 58, 237] }, bodyStyles: { fontSize: 7 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 3;
    }

    // Synthèse
    autoTable(doc, {
      startY: y + 2,
      body: [
        ['Déboursé sec', e2(r.deboursecSec)],
        ['PU sec', `${e2(r.puSec)} /${node.unit}`],
        ['PU vente calculé', `${e2(r.puVente)} /${node.unit}`],
        ['PU retenu', `${e2(r.puRetenu)} /${node.unit}`],
        ['Total vente HT', e2(r.totalVente)],
      ],
      theme: 'plain', bodyStyles: { fontSize: 8.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { halign: 'right' } },
      margin: { left: W - 110, right: 14 },
    });
  });

  const safeName = (study?.name || 'etude_tp').replace(/[^a-z0-9_-]/gi, '_');
  await saveFileWithPicker(doc.output('blob'), `ESTIMA_TP_${safeName}.pdf`, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
}
