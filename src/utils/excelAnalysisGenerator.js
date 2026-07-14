// src/utils/excelAnalysisGenerator.js
// Génère l'analyse comparative des offres entreprises
// • Un onglet GLOBAL + un onglet par tranche
// • Formules Excel pour Total, Écart%, sous-totaux et total général
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { normalizeUnitSymbol } from './helpers';
import { stampExcelCredit } from './estimaCredit';

// ─── Constantes couleurs (identiques à AnalysisTable) ────────────────────────
const COMPANY_COLORS = [
  { header: '1E3A5F', sub: '1E40AF', light: 'DBEAFE' }, // blue
  { header: '064E3B', sub: '065F46', light: 'D1FAE5' }, // emerald
  { header: '92400E', sub: 'B45309', light: 'FEF3C7' }, // amber
  { header: '4C1D95', sub: '6D28D9', light: 'EDE9FE' }, // purple
  { header: '881337', sub: 'BE123C', light: 'FFE4E6' }, // rose
  { header: '164E63', sub: '0E7490', light: 'CFFAFE' }, // cyan
];
const cc = (i) => COMPANY_COLORS[i % COMPANY_COLORS.length];

// ─── Helpers mise en forme ────────────────────────────────────────────────────
const colLetter = (n) => {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

const applyBorder = (cell, style = 'thin') => {
  const b = { style };
  cell.border = { top: b, left: b, bottom: b, right: b };
};

const setBg = (cell, argb) =>
  (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } });

const setFont = (cell, opts) =>
  (cell.font = { name: 'Calibri', size: 10, ...opts });

const setAlign = (cell, horizontal, vertical = 'middle') =>
  (cell.alignment = { horizontal, vertical, wrapText: true });

const styleFixed = (cell, bgArgb = '334155') => {
  setBg(cell, bgArgb);
  setFont(cell, { bold: true, size: 9, color: { argb: 'FFFFFFFF' } });
  setAlign(cell, 'center', 'middle');
  applyBorder(cell);
};

// ─── Construction d'un onglet ─────────────────────────────────────────────────
//
// Colonnes :  N° | Désignation | U | Qté | PU_Est | Total_Est | [PU | Total | Éc%] × n
//
// Toutes les colonnes numériques utilisent des formules Excel :
//   Total_Est  = Qté × PU_Est
//   Total_ent  = Qté × PU_ent
//   Éc%        = (Total_ent – Total_Est) / Total_Est
//   Sous-total = SOMME(range)
//   Total gén  = SOMME(sous-totaux)

function buildSheet(wb, sheetLabel, trancheLabel, {
  project, companies, chaptersData, stats, scoringConfig, bpuRefMap, negoActive = false,
}) {
  const ws = wb.addWorksheet(sheetLabel, {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: '1E3A5F' } },
  });

  const nCo = companies.length;
  const C = { REF: 1, DESIG: 2, UNIT: 3, QTY: 4, ESTPU: 5, ESTTOTAL: 6 };
  const firstCo = 7;
  const coPer   = 3; // PU | Total | Éc%
  const lastCol  = firstCo + nCo * coPer - 1;

  // ── Largeurs ────────────────────────────────────────────────────────────
  ws.getColumn(C.REF).width    = 7;
  ws.getColumn(C.DESIG).width  = 38;
  ws.getColumn(C.UNIT).width   = 6;
  ws.getColumn(C.QTY).width    = 8;
  ws.getColumn(C.ESTPU).width  = 11;
  ws.getColumn(C.ESTTOTAL).width = 13;
  for (let i = 0; i < nCo; i++) {
    const b = firstCo + i * coPer;
    ws.getColumn(b).width     = 11;  // PU
    ws.getColumn(b + 1).width = 13;  // Total
    ws.getColumn(b + 2).width = 8;   // Éc%
  }

  // ── Ligne 1 : Titre ─────────────────────────────────────────────────────
  ws.getRow(1).height = 28;
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `ANALYSE COMPARATIVE — ${(project?.name || 'Projet').toUpperCase()} — ${trancheLabel}${negoActive ? ' — APRÈS NÉGOCIATION' : ''}`;
  setFont(titleCell, { bold: true, size: 13, color: { argb: 'FFFFFFFF' } });
  setAlign(titleCell, 'left', 'middle');
  setBg(titleCell, '1E293B');

  // ── Ligne 2 : En-têtes fixes ─────────────────────────────────────────────
  ws.getRow(2).height = 22;
  const fixedHdr = [
    [C.REF, 'N°'], [C.DESIG, 'DÉSIGNATION'], [C.UNIT, 'U'],
    [C.QTY, 'QTÉ'], [C.ESTPU, 'PU EST. (€)'], [C.ESTTOTAL, 'TOTAL EST. (€)'],
  ];
  fixedHdr.forEach(([col, lbl]) => {
    const cell = ws.getCell(2, col);
    cell.value = lbl;
    styleFixed(cell);
  });

  // En-têtes entreprises (fusionnés sur 3 colonnes)
  for (let i = 0; i < nCo; i++) {
    const b = firstCo + i * coPer;
    ws.mergeCells(2, b, 2, b + 2);
    const cell = ws.getCell(2, b);
    cell.value = companies[i].name.toUpperCase();
    setFont(cell, { bold: true, size: 9, color: { argb: 'FFFFFFFF' } });
    setAlign(cell, 'center', 'middle');
    setBg(cell, cc(i).header);
    applyBorder(cell);
  }

  // ── Ligne 3 : Sous-en-têtes ──────────────────────────────────────────────
  ws.getRow(3).height = 16;
  for (let c = C.REF; c <= C.ESTTOTAL; c++) {
    setBg(ws.getCell(3, c), '475569');
    applyBorder(ws.getCell(3, c));
  }
  for (let i = 0; i < nCo; i++) {
    const b = firstCo + i * coPer;
    ['PU (€)', 'TOTAL (€)', 'ÉC. %'].forEach((lbl, j) => {
      const cell = ws.getCell(3, b + j);
      cell.value = lbl;
      setFont(cell, { bold: true, size: 8, color: { argb: 'FFFFFFFF' } });
      setAlign(cell, j === 2 ? 'center' : 'right', 'middle');
      setBg(cell, cc(i).sub);
      applyBorder(cell);
    });
  }

  // ── Données ──────────────────────────────────────────────────────────────
  let r = 4;

  // Pour les formules SOMME du total général, on mémorise les lignes sous-total
  const subtotalRows = []; // lignes de sous-total de chapitre (col ESTTOTAL)

  chaptersData.forEach(chapter => {
    // ── Titre de chapitre
    ws.getRow(r).height = 18;
    setBg(ws.getCell(r, C.REF), 'E2E8F0');
    applyBorder(ws.getCell(r, C.REF));
    ws.mergeCells(r, C.DESIG, r, C.ESTTOTAL);
    const chapCell = ws.getCell(r, C.DESIG);
    chapCell.value = chapter.title?.toUpperCase() || '';
    setFont(chapCell, { bold: true, size: 10, color: { argb: 'FF1E293B' } });
    setAlign(chapCell, 'left', 'middle');
    setBg(chapCell, 'E2E8F0');
    applyBorder(chapCell);
    for (let i = 0; i < nCo; i++) {
      const b = firstCo + i * coPer;
      for (let j = 0; j < coPer; j++) { setBg(ws.getCell(r, b + j), 'F1F5F9'); applyBorder(ws.getCell(r, b + j)); }
    }
    r++;

    // ── Items
    const firstItemRow = r;
    chapter.items.forEach(item => {
      ws.getRow(r).height = 15;
      const refLabel = bpuRefMap?.get(item.id) || '';
      const pu_est   = Number(item.price || 0);

      // Colonnes fixes
      const setFixed = (col, val, numFmt, bold, bgArgb) => {
        const cell = ws.getCell(r, col);
        cell.value = val;
        if (numFmt) cell.numFmt = numFmt;
        setFont(cell, { size: 9, bold: !!bold });
        applyBorder(cell, 'hair');
        if (bgArgb) setBg(cell, bgArgb);
        return cell;
      };

      setFixed(C.REF, refLabel, null, false);
      setAlign(ws.getCell(r, C.REF), 'center', 'middle');
      setFont(ws.getCell(r, C.REF), { size: 8, color: { argb: 'FF64748B' } });

      setFixed(C.DESIG, item.designation || '');
      setAlign(ws.getCell(r, C.DESIG), 'left', 'middle');

      setFixed(C.UNIT, normalizeUnitSymbol(item.unit));
      setAlign(ws.getCell(r, C.UNIT), 'center', 'middle');
      setFont(ws.getCell(r, C.UNIT), { size: 8, color: { argb: 'FF64748B' } });

      // Quantité (valeur brute — source pour les formules)
      const qtyCell = ws.getCell(r, C.QTY);
      qtyCell.value = Number(item.activeQty || 0);
      qtyCell.numFmt = '#,##0.##';
      setFont(qtyCell, { size: 9 });
      setAlign(qtyCell, 'center', 'middle');
      setBg(qtyCell, 'F8FAFC');
      applyBorder(qtyCell, 'hair');

      // PU Estimation (valeur brute — source)
      const estPuCell = ws.getCell(r, C.ESTPU);
      estPuCell.value = pu_est;
      estPuCell.numFmt = '#,##0.00 "€"';
      setFont(estPuCell, { size: 9, color: { argb: 'FF475569' } });
      setAlign(estPuCell, 'right', 'middle');
      applyBorder(estPuCell, 'hair');

      // Total Estimation = formule Qté × PU_Est
      const qRef      = `${colLetter(C.QTY)}${r}`;
      const estPuRef  = `${colLetter(C.ESTPU)}${r}`;
      const estTotCell = ws.getCell(r, C.ESTTOTAL);
      estTotCell.value = { formula: `${qRef}*${estPuRef}`, result: item.activeQty * pu_est };
      estTotCell.numFmt = '#,##0.00 "€"';
      setFont(estTotCell, { bold: true, size: 9 });
      setAlign(estTotCell, 'right', 'middle');
      setBg(estTotCell, 'F8FAFC');
      applyBorder(estTotCell, 'hair');

      const estTotRef = `${colLetter(C.ESTTOTAL)}${r}`;

      // Colonnes entreprises
      for (let i = 0; i < nCo; i++) {
        const b   = firstCo + i * coPer;
        const pu  = Number(companies[i].offers?.[item.id] ?? 0);

        // PU entreprise (valeur brute)
        const puCell = ws.getCell(r, b);
        puCell.value = pu > 0 ? pu : null;
        puCell.numFmt = '#,##0.00 "€"';
        setFont(puCell, { size: 9 });
        setAlign(puCell, 'right', 'middle');
        setBg(puCell, cc(i).light);
        applyBorder(puCell, 'hair');

        const puRef  = `${colLetter(b)}${r}`;
        const totRef = `${colLetter(b + 1)}${r}`;

        // Total entreprise = formule Qté × PU_ent
        const totCell = ws.getCell(r, b + 1);
        if (pu > 0) {
          totCell.value = { formula: `${qRef}*${puRef}`, result: item.activeQty * pu };
        } else {
          totCell.value = null;
        }
        totCell.numFmt = '#,##0.00 "€"';
        setFont(totCell, { bold: pu > 0, size: 9 });
        setAlign(totCell, 'right', 'middle');
        setBg(totCell, cc(i).light);
        applyBorder(totCell, 'hair');

        // Écart% = formule (Total_ent – Total_Est) / Total_Est
        const ecCell = ws.getCell(r, b + 2);
        if (pu > 0) {
          const estVal = item.activeQty * pu_est;
          ecCell.value = { formula: `IF(${estTotRef}<>0,(${totRef}-${estTotRef})/${estTotRef},0)`, result: estVal !== 0 ? (item.activeQty * pu - estVal) / estVal : 0 };
          ecCell.numFmt = '+0.0%;-0.0%;0%';
          setFont(ecCell, { bold: true, size: 8, color: { argb: item.activeQty * pu > item.activeQty * pu_est ? 'FFDC2626' : 'FF16A34A' } });
        } else {
          ecCell.value = null;
        }
        setAlign(ecCell, 'center', 'middle');
        setBg(ecCell, cc(i).light);
        applyBorder(ecCell, 'hair');
      }

      r++;
    });

    const lastItemRow = r - 1;

    // ── Sous-total chapitre
    if (lastItemRow >= firstItemRow) {
      ws.getRow(r).height = 16;
      for (let c = C.REF; c <= lastCol; c++) {
        setBg(ws.getCell(r, c), 'CBD5E1');
        applyBorder(ws.getCell(r, c));
      }
      ws.mergeCells(r, C.REF, r, C.QTY);
      const stLabel = ws.getCell(r, C.REF);
      stLabel.value = `Sous-total ${chapter.title}`;
      setFont(stLabel, { bold: true, size: 9, italic: true });
      setAlign(stLabel, 'left', 'middle');
      setBg(stLabel, 'CBD5E1');
      applyBorder(stLabel);

      // Total est = SOMME(ESTTOTAL sur les lignes items)
      const stEstCell = ws.getCell(r, C.ESTTOTAL);
      stEstCell.value = {
        formula: `SUM(${colLetter(C.ESTTOTAL)}${firstItemRow}:${colLetter(C.ESTTOTAL)}${lastItemRow})`,
        result: chapter.items.reduce((a, it) => a + it.activeQty * (it.price || 0), 0),
      };
      stEstCell.numFmt = '#,##0.00 "€"';
      setFont(stEstCell, { bold: true, size: 9 });
      setAlign(stEstCell, 'right', 'middle');

      // Sous-totaux entreprises
      for (let i = 0; i < nCo; i++) {
        const b = firstCo + i * coPer;
        ws.mergeCells(r, b, r, b + 1);
        const totCell = ws.getCell(r, b);
        totCell.value = {
          formula: `SUM(${colLetter(b + 1)}${firstItemRow}:${colLetter(b + 1)}${lastItemRow})`,
          result: chapter.items.reduce((a, it) => a + it.activeQty * Number(companies[i].offers?.[it.id] ?? 0), 0),
        };
        totCell.numFmt = '#,##0.00 "€"';
        setFont(totCell, { bold: true, size: 9 });
        setAlign(totCell, 'right', 'middle');
        setBg(totCell, 'CBD5E1');
        applyBorder(totCell);

        const stTotRef = `${colLetter(b)}${r}`;
        const stEstRef = `${colLetter(C.ESTTOTAL)}${r}`;
        const ecCell   = ws.getCell(r, b + 2);
        ecCell.value = {
          formula: `IF(${stEstRef}<>0,(${stTotRef}-${stEstRef})/${stEstRef},0)`,
          result: 0,
        };
        ecCell.numFmt = '+0.0%;-0.0%;0%';
        setFont(ecCell, { bold: true, size: 8 });
        setAlign(ecCell, 'center', 'middle');
        setBg(ecCell, 'CBD5E1');
        applyBorder(ecCell);
      }

      // Le TOTAL GÉNÉRAL et les totaux entreprise ne comptent QUE la base de
      // notation : les chapitres option (PSE) sont affichés mais exclus de la
      // somme, en cohérence avec stats.totalEstimation / companiesTotals
      // (computeAnalysisStats ignore chap.isOption). Sinon le recalcul Excel
      // gonflerait le total au-delà de la base scorée.
      if (!chapter.isOption) subtotalRows.push(r);
      r++;
    }
  });

  // ── Total général ────────────────────────────────────────────────────────
  ws.getRow(r).height = 22;
  for (let c = C.REF; c <= lastCol; c++) {
    setBg(ws.getCell(r, c), '1E293B');
    applyBorder(ws.getCell(r, c), 'medium');
  }
  ws.mergeCells(r, C.REF, r, C.QTY);
  const totLabel = ws.getCell(r, C.REF);
  totLabel.value = 'TOTAL GÉNÉRAL HT';
  setFont(totLabel, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
  setAlign(totLabel, 'left', 'middle');
  setBg(totLabel, '1E293B');
  applyBorder(totLabel, 'medium');

  // Total est général = SOMME des sous-totaux (pas de double comptage)
  const stEstRefs = subtotalRows.map(sr => `${colLetter(C.ESTTOTAL)}${sr}`).join('+');
  const totEstCell = ws.getCell(r, C.ESTTOTAL);
  totEstCell.value = {
    formula: stEstRefs || '0',
    result: stats.totalEstimation,
  };
  totEstCell.numFmt = '#,##0.00 "€"';
  setFont(totEstCell, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
  setAlign(totEstCell, 'right', 'middle');
  setBg(totEstCell, '1E293B');
  applyBorder(totEstCell, 'medium');

  const totEstRef = `${colLetter(C.ESTTOTAL)}${r}`;

  for (let i = 0; i < nCo; i++) {
    const b = firstCo + i * coPer;
    const stCoRefs = subtotalRows.map(sr => `${colLetter(b)}${sr}`).join('+');
    ws.mergeCells(r, b, r, b + 1);
    const totCell = ws.getCell(r, b);
    totCell.value = {
      formula: stCoRefs || '0',
      // La formule somme les sous-totaux (BRUT) : le résultat en cache doit l'être aussi.
      result: stats.companiesTotalsBrut?.[companies[i].id] ?? (stats.companiesTotals[companies[i].id] || 0),
    };
    totCell.numFmt = '#,##0.00 "€"';
    setFont(totCell, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
    setAlign(totCell, 'right', 'middle');
    setBg(totCell, cc(i).header);
    applyBorder(totCell, 'medium');

    const totCoRef = `${colLetter(b)}${r}`;
    const ecCell   = ws.getCell(r, b + 2);
    ecCell.value = {
      formula: `IF(${totEstRef}<>0,(${totCoRef}-${totEstRef})/${totEstRef},0)`,
      result: 0,
    };
    ecCell.numFmt = '+0.0%;-0.0%;0%';
    setFont(ecCell, { bold: true, size: 9, color: { argb: 'FFFFFFFF' } });
    setAlign(ecCell, 'center', 'middle');
    setBg(ecCell, cc(i).header);
    applyBorder(ecCell, 'medium');
  }

  // ── Rabais commercial (phase après négo) : ligne rabais + TOTAL NET HT ──
  // Le total général ci-dessus reste BRUT (somme des sous-totaux) ; le net,
  // qui sert à la notation, est calculé par formule : brut × (1 − rabais).
  const rabaisPcts = companies.map(c => {
    if (!negoActive) return 0;
    const v = Number(c.negoRabaisPct);
    return Number.isFinite(v) && v > 0 ? Math.min(100, v) : 0;
  });
  if (rabaisPcts.some(v => v > 0)) {
    const totalRowNum = r;

    // Ligne 1 : rabais consenti (%)
    r++;
    ws.getRow(r).height = 16;
    ws.mergeCells(r, C.REF, r, C.ESTTOTAL);
    const rabaisLabel = ws.getCell(r, C.REF);
    rabaisLabel.value = 'RABAIS COMMERCIAL CONSENTI';
    setFont(rabaisLabel, { bold: true, size: 9, color: { argb: 'FF15803D' } });
    setAlign(rabaisLabel, 'right', 'middle');
    setBg(rabaisLabel, 'DCFCE7');
    applyBorder(rabaisLabel);
    for (let i = 0; i < nCo; i++) {
      const b = firstCo + i * coPer;
      ws.mergeCells(r, b, r, b + coPer - 1);
      const cell = ws.getCell(r, b);
      cell.value = rabaisPcts[i] > 0 ? -rabaisPcts[i] / 100 : '—';
      if (rabaisPcts[i] > 0) cell.numFmt = '-0.0#%';
      setFont(cell, { bold: true, size: 9, color: { argb: rabaisPcts[i] > 0 ? 'FF15803D' : 'FF94A3B8' } });
      setAlign(cell, 'center', 'middle');
      setBg(cell, 'DCFCE7');
      applyBorder(cell);
    }

    // Ligne 2 : total net HT (formule brut × (1 − rabais)) — base de la notation
    r++;
    ws.getRow(r).height = 20;
    ws.mergeCells(r, C.REF, r, C.ESTTOTAL);
    const netLabel = ws.getCell(r, C.REF);
    netLabel.value = 'TOTAL NET HT (après rabais) — base de notation';
    setFont(netLabel, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
    setAlign(netLabel, 'right', 'middle');
    setBg(netLabel, '166534');
    applyBorder(netLabel, 'medium');
    for (let i = 0; i < nCo; i++) {
      const b = firstCo + i * coPer;
      const totCoRef = `${colLetter(b)}${totalRowNum}`;
      ws.mergeCells(r, b, r, b + coPer - 1);
      const cell = ws.getCell(r, b);
      cell.value = {
        formula: rabaisPcts[i] > 0 ? `${totCoRef}*(1-${String(rabaisPcts[i] / 100).replace(',', '.')})` : totCoRef,
        result: stats.companiesTotals[companies[i].id] || 0,
      };
      cell.numFmt = '#,##0.00 "€"';
      setFont(cell, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
      setAlign(cell, 'right', 'middle');
      setBg(cell, '166534');
      applyBorder(cell, 'medium');
    }
  }

  r += 2;

  // ── Note financière ──────────────────────────────────────────────────────
  const N = Number(scoringConfig?.maxScore || 40);
  ws.getRow(r).height = 20;
  ws.mergeCells(r, C.REF, r, C.ESTTOTAL);
  const noteLabel = ws.getCell(r, C.REF);
  noteLabel.value = `Note financière / ${N}  —  formule ${(scoringConfig?.mode || 'f1').toUpperCase()}`;
  setFont(noteLabel, { bold: true, size: 9, italic: true, color: { argb: 'FFCBD5E1' } });
  setAlign(noteLabel, 'left', 'middle');
  setBg(noteLabel, '0F172A');
  applyBorder(noteLabel, 'medium');

  for (let i = 0; i < nCo; i++) {
    const b     = firstCo + i * coPer;
    const score = stats.companyScores?.[companies[i].id] ?? 0;
    ws.mergeCells(r, b, r, b + coPer - 1);
    const scoreCell = ws.getCell(r, b);
    scoreCell.value = score > 0 ? Number(score.toFixed(2)) : '-';
    setFont(scoreCell, { bold: true, size: 12, color: { argb: 'FFFFFFFF' } });
    setAlign(scoreCell, 'center', 'middle');
    setBg(scoreCell, cc(i).header);
    applyBorder(scoreCell, 'medium');
  }
}

// ─── Export principal ─────────────────────────────────────────────────────────
export async function generateAnalysisExcel({
  project,
  companies,
  chaptersData,   // données pour la tranche active (passées par PriceAnalysisView)
  stats,
  scoringConfig,
  bpuRefMap,
  tranches,
  // Pour générer tous les onglets, on a besoin des données brutes + clientQtyMaps
  clientQtyMaps = {},
  // Phase après négociation : les offres passées sont déjà résolues (fusion
  // initial + négocié) par l'appelant — ce flag ne sert qu'au libellé.
  negoActive = false,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EstimaVRD';
  wb.created = new Date();

  const hasTranches = tranches && tranches.length > 0;

  // ── Onglet GLOBAL ─────────────────────────────────────────────────────────
  buildSheet(wb, 'GLOBAL', 'GLOBAL', {
    project, companies, chaptersData, stats, scoringConfig, bpuRefMap, negoActive,
  });

  // ── Onglets par tranche ───────────────────────────────────────────────────
  if (hasTranches) {
    tranches.forEach(tranche => {
      // Recalculer chaptersData pour cette tranche depuis les données brutes du projet
      const qtyMap = clientQtyMaps?.[tranche.id] || {};

      const trancheChaptersData = (project?.chapters || []).map(chapter => {
        const items = [];
        const extract = (nodes) => {
          nodes.forEach(node => {
            if (node.type === 'item') {
              const activeQty = qtyMap[node.id] || 0;
              items.push({ ...node, activeQty, chapterId: chapter.id, chapterTitle: chapter.title });
            } else if (node.children) {
              extract(node.children);
            }
          });
        };
        extract(chapter.children || []);
        return { id: chapter.id, title: chapter.title, isOption: chapter.isOption, items };
      });

      // Recalculer stats pour cette tranche
      const trancheStats = { totalEstimation: 0, companiesTotals: {}, companiesTotalsBrut: {}, companyScores: {} };
      trancheChaptersData.forEach(chap => {
        if (chap.isOption) return;
        chap.items.forEach(item => {
          trancheStats.totalEstimation += item.activeQty * (item.price || 0);
          companies.forEach(co => {
            if (!trancheStats.companiesTotals[co.id]) trancheStats.companiesTotals[co.id] = 0;
            trancheStats.companiesTotals[co.id] += item.activeQty * Number(co.offers?.[item.id] ?? 0);
          });
        });
      });

      // Rabais commercial (phase après négo) : le rabais porte sur le Total HT,
      // il s'applique donc linéairement au total de chaque tranche.
      trancheStats.companiesTotalsBrut = { ...trancheStats.companiesTotals };
      if (negoActive) {
        companies.forEach(co => {
          const rv = Number(co.negoRabaisPct);
          const rabais = Number.isFinite(rv) && rv > 0 ? Math.min(100, rv) : 0;
          if (rabais > 0) {
            trancheStats.companiesTotals[co.id] =
              Math.round((trancheStats.companiesTotals[co.id] || 0) * (1 - rabais / 100) * 100) / 100;
          }
        });
      }

      // Scores (formule F1 simplifiée si scoringConfig non disponible)
      const totals = Object.values(trancheStats.companiesTotals).filter(t => t > 0);
      if (totals.length > 0) {
        const Pmin = Math.min(...totals);
        const Pmax = Math.max(...totals);
        const Pmoy = totals.reduce((a, b) => a + b, 0) / totals.length;
        const N    = Number(scoringConfig?.maxScore || 40);
        companies.forEach(co => {
          const P = trancheStats.companiesTotals[co.id] || 0;
          let score = 0;
          if (P > 0) {
            switch (scoringConfig?.mode) {
              case 'f1': score = N * (Pmin / P); break;
              case 'f2': score = N * Math.pow(Pmin / P, 2); break;
              case 'f3': score = N * Math.pow(Pmin / P, 3); break;
              case 'f4': score = N * (1 - (P - Pmin) / Pmin); break;
              case 'f5': score = N * (1 - (P - Pmin) / Pmoy); break;
              case 'f6': score = P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2); break;
              case 'f7': score = Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin)); break;
              case 'f8': score = (N * Pmoy) / (Pmoy + P); break;
              case 'f9': score = N * ((2 * Pmin) / (Pmin + P)); break;
              default:   score = N * (Pmin / P);
            }
          }
          trancheStats.companyScores[co.id] = Math.max(0, Math.min(N, score));
        });
      }

      const label = tranche.name?.toUpperCase() || tranche.id.toUpperCase();
      buildSheet(wb, label.slice(0, 31), label, {
        project,
        companies,
        chaptersData: trancheChaptersData,
        stats: trancheStats,
        scoringConfig,
        bpuRefMap,
        negoActive,
      });
    });
  }

  // ── Génération du fichier ─────────────────────────────────────────────────
  const projectName = (project?.name || 'projet').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').replace(/_+/g, '_');
  const date        = new Date().toISOString().slice(0, 10);
  const filename    = `ANALYSE_${projectName}_${date}.xlsx`;

  stampExcelCredit(wb);
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), filename);
}