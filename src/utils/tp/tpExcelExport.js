// src/utils/tp/tpExcelExport.js
// ESTIMA TP — export Excel du chiffrage : feuille « Récapitulatif » (DQE chiffré)
// + une feuille de sous-détail par article.
import ExcelJS from 'exceljs';
import { buildRefMap } from '../projectCalculations';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from '../fileSaver';
import {
  computeDetail, defaultCoefficients, POSTES, POSTE_LABELS, effectiveDuree,
  ressourceCosts, fournitureQty, fournitureCost, sousTraitanceCost, sousTraitanceQty, lineDuree,
  transportCost, transportCamions,
} from './tpPriceCompute';

const EUR = '# ##0.00 "€"';
const safeSheet = (name, used) => {
  let s = String(name || 'SD').replace(/[:\\/?*[\]]/g, '-').slice(0, 28) || 'SD';
  let n = s, i = 2;
  while (used.has(n)) { n = `${s} ${i++}`.slice(0, 31); }
  used.add(n);
  return n;
};

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

export async function generateTpExcel(study) {
  const chapters = study?.cadre?.chapters || [];
  const coef = study?.coefficients || defaultCoefficients();
  const arts = collectArticles(chapters);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ESTIMA TP';

  // ── Feuille Récapitulatif ──────────────────────────────────────────────────
  const recap = wb.addWorksheet('Récapitulatif', { views: [{ state: 'frozen', ySplit: 4 }] });
  recap.mergeCells('A1:M1');
  recap.getCell('A1').value = `ESTIMA TP — ${study?.name || 'Étude de prix'}`;
  recap.getCell('A1').font = { bold: true, size: 14 };
  recap.getCell('A2').value = [study?.reference && `Réf : ${study.reference}`, study?.maitreOuvrage && `MOA : ${study.maitreOuvrage}`].filter(Boolean).join('   ');
  recap.getCell('A2').font = { size: 10, color: { argb: 'FF6B7280' } };

  const cols = ['N°', 'Désignation', 'Qté', 'U', 'PU sec', 'Déboursé', 'PU vente', 'Total vente',
    'Matériel', 'MO', 'Fournit.', 'S-trait.', 'Transp.'];
  const head = recap.getRow(4);
  cols.forEach((c, i) => { head.getCell(i + 1).value = c; });
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.alignment = { horizontal: 'center' }; });

  const tot = { deb: 0, vente: 0, sec: { materiel: 0, mo: 0, fourniture: 0, soustraitance: 0, transport: 0 } };
  arts.forEach(({ node, num }) => {
    const qte = Number(node.qty || 0);
    const r = computeDetail(node.detail, qte, coef);
    const row = recap.addRow([
      num, node.designation || '', qte, node.unit || '', r.puSec, r.deboursecSec, r.puRetenu, r.totalVente,
      r.sec.materiel, r.sec.mo, r.sec.fourniture, r.sec.soustraitance, r.sec.transport,
    ]);
    [5, 6, 7, 8, 9, 10, 11, 12, 13].forEach(i => { row.getCell(i).numFmt = EUR; });
    tot.deb += r.deboursecSec; tot.vente += r.totalVente;
    POSTES.forEach(p => { tot.sec[p] += r.sec[p]; });
  });

  const totRow = recap.addRow(['', 'TOTAL HT', '', '', '', tot.deb, '', tot.vente,
    tot.sec.materiel, tot.sec.mo, tot.sec.fourniture, tot.sec.soustraitance, tot.sec.transport]);
  totRow.font = { bold: true };
  [6, 8, 9, 10, 11, 12, 13].forEach(i => { totRow.getCell(i).numFmt = EUR; });

  recap.columns.forEach((c, i) => { c.width = i === 1 ? 38 : (i === 0 ? 8 : 12); });

  // ── Une feuille par sous-détail ─────────────────────────────────────────────
  const used = new Set(['Récapitulatif']);
  arts.forEach(({ node, num }) => {
    if (!node.detail) return;
    const qte = Number(node.qty || 0);
    const d = node.detail;
    const r = computeDetail(d, qte, coef);
    const duree = r.duree;
    const ws = wb.addWorksheet(safeSheet(num ? `${num}` : node.designation, used));

    ws.mergeCells('A1:H1');
    ws.getCell('A1').value = `${num ? num + ' — ' : ''}${node.designation || ''}`;
    ws.getCell('A1').font = { bold: true, size: 12 };
    ws.addRow([`Quantité : ${qte} ${node.unit}`, '', `Rendement : ${d.rendement || 0}/j`, '', `Durée : ${effectiveDuree(d, qte)} j`]);
    ws.addRow([]);

    const sub = (title) => { const row = ws.addRow([title]); row.font = { bold: true, color: { argb: 'FFB45309' } }; };
    const colHead = (arr) => { const row = ws.addRow(arr); row.font = { bold: true, color: { argb: 'FF6B7280' } }; };

    // Matériel + MO + Transport (mêmes colonnes)
    [['materiel', 'MATÉRIEL'], ['mo', "MAIN D'ŒUVRE"]].forEach(([key, label]) => {
      const lines = d[key] || [];
      if (lines.length === 0) return;
      sub(label);
      colHead(['Désignation', 'Nb', 'Durée', 'Perso.', 'Amort.', 'Entret.', 'Cons.', 'Loc.', 'Total']);
      lines.forEach(l => {
        const row = ws.addRow([l.designation || '', Number(l.nombre || 0), lineDuree(l, duree), Number(l.puJour || 0),
          Number(l.amort || 0), Number(l.entret || 0), Number(l.cons || 0), Number(l.loc || 0), ressourceCosts(l, duree)]);
        [4, 5, 6, 7, 8, 9].forEach(i => { row.getCell(i).numFmt = EUR; });
      });
      ws.addRow([]);
    });

    // Fournitures
    if ((d.fourniture || []).length) {
      sub('FOURNITURES');
      colHead(['Désignation', 'U', 'Épaiss.', 'Densité', 'Qté', 'PU barème', 'PU forcé', 'Total']);
      d.fourniture.forEach(l => {
        const row = ws.addRow([l.designation || '', l.unit || '', Number(l.epaisseur || 0), Number(l.densite || 0),
          fournitureQty(l, qte), Number(l.puBareme || 0), Number(l.puForce || 0), fournitureCost(l, qte)]);
        [6, 7, 8].forEach(i => { row.getCell(i).numFmt = EUR; });
      });
      ws.addRow([]);
    }

    // Sous-traitance
    if ((d.soustraitance || []).length) {
      sub('SOUS-TRAITANCE');
      colHead(['Désignation', 'U', 'Qté', 'PU barème', 'PU forcé', 'Total']);
      d.soustraitance.forEach(l => {
        const row = ws.addRow([l.designation || '', l.unit || '', sousTraitanceQty(l, qte), Number(l.puBareme || 0), Number(l.puForce || 0), sousTraitanceCost(l, qte)]);
        [4, 5, 6].forEach(i => { row.getCell(i).numFmt = EUR; });
      });
      ws.addRow([]);
    }

    // Transport
    if ((d.transport || []).length) {
      sub('TRANSPORT');
      colHead(['Désignation', 'U', 'Épaiss.', 'Densité', 'Contenance', 'Voy./j', 'Coût/j', 'Camions', 'Total']);
      d.transport.forEach(l => {
        const row = ws.addRow([l.designation || '', l.unit || '', Number(l.epaisseur || 0), Number(l.densite || 0),
          Number(l.contenance || 0), Number(l.voyagesParJour || 0), Number(l.coutJour || 0),
          transportCamions(l, qte, duree), transportCost(l, qte)]);
        [7, 9].forEach(i => { row.getCell(i).numFmt = EUR; });
      });
      ws.addRow([]);
    }

    // Synthèse
    ws.addRow([]);
    const synth = [
      ['Déboursé sec', r.deboursecSec], ['PU sec', r.puSec],
      ...POSTES.map(p => [`  ${POSTE_LABELS[p]} (sec)`, r.sec[p]]),
      ['PU vente calculé', r.puVente], ['PU retenu', r.puRetenu], ['Total vente HT', r.totalVente],
    ];
    synth.forEach(([label, val]) => {
      const row = ws.addRow([label, '', '', '', '', '', '', val]);
      row.getCell(8).numFmt = EUR;
      if (label === 'PU retenu' || label === 'Total vente HT') row.font = { bold: true };
    });

    ws.columns.forEach((c, i) => { c.width = i === 0 ? 34 : 11; });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const safeName = (study?.name || 'etude_tp').replace(/[^a-z0-9_-]/gi, '_');
  await saveFileWithPicker(blob, `ESTIMA_TP_${safeName}.xlsx`, FILE_TYPES.excel, PICKER_IDS.exportExcel);
}
