// src/utils/excelGenerator.js
import ExcelJS from 'exceljs';
import { getItemRefMap, cleanText, normalizeUnitSymbol } from './helpers';
import { roundEuro } from './financeFormat';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from './fileSaver';

// ─── HELPERS IMAGE ────────────────────────────────────────────────────────────

// Charge un logo depuis une data URL base64 ou une URL fichier → ArrayBuffer
const fetchImageAsBuffer = async (source) => {
  try {
    if (!source) return null;
    if (source.startsWith('data:')) {
      // Conversion base64 → ArrayBuffer
      const base64 = source.split(',')[1];
      const binary = atob(base64);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
      return buffer;
    }
    // URL fichier (ex: /logo.jpg)
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blob.arrayBuffer();
  } catch {
    return null;
  }
};

const getExtFromSource = (source) => {
  if (!source) return 'jpeg';
  if (source.startsWith('data:image/png')) return 'png';
  if (source.startsWith('data:')) return 'jpeg';
  return source.split('.').pop().toLowerCase() === 'jpg' ? 'jpeg' : 'png';
};

const getImageDimensions = (buffer) => {
  return new Promise((resolve) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// ─── FONCTION PRINCIPALE ──────────────────────────────────────────────────────

export const generateProfessionalExcel = async (project, clientQtyMaps, type = 'ESTIMATION', bpuConfig = {}, options = {}, branding = null) => {
  const { selectedExports = ['global'], includeSummary = false, includePM = true, tranches = [] } = options;
  const workbook = new ExcelJS.Workbook();

  let projectRefMap = new Map();
  try { if (project?.chapters) projectRefMap = getItemRefMap(project); } catch { /* ignore */ }

  const getTrancheName = (id) => id === 'global' ? 'GLOBAL' : tranches.find(t => t.id === id)?.name || id;

  // ── STYLES ──
  const fonts = {
    base: { name: 'Aptos', size: 10, color: { argb: 'FF000000' } },
    bold: { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF000000' } },
    header: { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    title: { name: 'Aptos', size: 14, bold: true, color: { argb: 'FF022C22' } },
    subTitle: { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF065F46' } },
    info: { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF6B7280' } },
    total: { name: 'Aptos', size: 12, bold: true, color: { argb: 'FF000000' } },
    totalPse: { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFB45309' } },
    chapterTitle: { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    subTotalMain: { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF000000' } },
    subTotalSub: { name: 'Aptos', size: 9, italic: true, color: { argb: 'FF6B7280' } },
    optionTitle: { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFB45309' } },
    pmStyle: { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF9CA3AF' } }
  };

  const fills = {
    header: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF022C22' } },
    chapter: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
    subChapter: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } },
    subTotalMain: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
    subTotalSub: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } },
    total: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
    totalPse: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
  };

  const borders = {
    thin: { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } },
    dotted: { bottom: { style: 'dotted', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
  };

  // ── CHARGEMENT LOGOS ──
  // Logo MOE : priorité à branding.logo, fallback /logo.jpg
  const moeSource = branding?.logo || '/logo.jpg';
  const moeBuffer = await fetchImageAsBuffer(moeSource);
  let moeLogoId = null; let moeDims = null;
  if (moeBuffer) {
    moeLogoId = workbook.addImage({ buffer: moeBuffer, extension: getExtFromSource(moeSource) });
    moeDims = await getImageDimensions(moeBuffer);
  }

  // Logo client : stocké en base64 dans project.clientLogo
  let clientLogoId = null; let clientDims = null;
  if (project.clientLogo) {
    const clientBuffer = await fetchImageAsBuffer(project.clientLogo);
    if (clientBuffer) {
      clientLogoId = workbook.addImage({ buffer: clientBuffer, extension: getExtFromSource(project.clientLogo) });
      clientDims = await getImageDimensions(clientBuffer);
    }
  }

  // ── RÉCAPITULATIF (création de l'onglet en 1er, rempli après les feuilles détail) ──
  // On crée la feuille maintenant pour qu'elle reste en tête de classeur, mais on
  // ne remplit le corps qu'APRÈS avoir construit les feuilles détail : le récap
  // référence alors les sous-totaux de chaque tranche via des formules inter-feuilles
  // (valable DQE comme ESTIMATION → se recalcule quand les P.U. sont saisis).
  let summarySheet = null;
  const summaryRefs = {}; // { [expId]: { sheetName, totalRow, chapters: { [chapIdx]: 'Fxx' } } }
  if (includeSummary && selectedExports.length > 0) {
    summarySheet = workbook.addWorksheet('RÉCAPITULATIF', { views: [{ showGridLines: false }] });
    const headers = ['DÉSIGNATION', ...selectedExports.map(getTrancheName)];
    summarySheet.columns = [{ key: 'desc', width: 50 }, ...selectedExports.map(() => ({ width: 18 }))];
    summarySheet.addRow(['RÉCAPITULATIF FINANCIER']).font = fonts.title;
    summarySheet.addRow([]);
    const headerRow = summarySheet.addRow(headers);
    headerRow.eachCell(cell => { cell.font = fonts.header; cell.fill = fills.header; cell.alignment = { horizontal: 'center' }; });
  }

  // ── TRAITEMENT NŒUDS ──
  const processNodes = (nodes, ws, qtyMap, level = 0, mode = 'base', parentIsOption = false, subTotalCollector = null, _includePM = true) => {
    if (!nodes) return;
    nodes.forEach((node, index) => {
      const isEffectiveOption = parentIsOption || !!node.isOption;
      if (mode === 'base' && isEffectiveOption) return;
      if (mode === 'option' && !isEffectiveOption && node.type === 'item') return;

      if (node.children && node.children.length > 0) {
        const hasContent = (n, pOpt) => {
          const effOpt = pOpt || !!n.isOption;
          if (n.type === 'item') {
            const isVisible = mode === 'base' ? !effOpt : effOpt;
            if (!isVisible) return false;
            if (!_includePM) {
              const mk = String(n.id);
              let q = parseFloat(n.qty || 0);
              if (qtyMap?.has(mk)) q = Number(qtyMap.get(mk));
              if (isNaN(q)) q = 0;
              if (q === 0) return false;
            }
            return true;
          }
          if (n.children) {
            if (mode === 'base' && effOpt) return false;
            return n.children.some(c => hasContent(c, effOpt));
          }
          return false;
        };
        if (!hasContent(node, parentIsOption)) return;
        const chapNum = level === 0 ? (index + 1).toString() : '';
        const titleStr = (node.title || node.designation || '').toUpperCase();
        const rowHeader = ws.addRow([chapNum, titleStr, '', '', '', '']);
        // Appliquer la couleur cellule par cellule (A→F) pour ne pas déborder hors du tableau
        const headerFont = level === 0 ? fonts.chapterTitle : { ...fonts.bold, size: 9, color: { argb: 'FF4B5563' } };
        const headerFill = level === 0 ? fills.chapter : fills.subChapter;
        for (let c = 1; c <= 6; c++) {
          const cell = rowHeader.getCell(c);
          cell.font = headerFont; cell.fill = headerFill; cell.border = borders.thin;
        }
        if (level === 0) rowHeader.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        else rowHeader.getCell(2).alignment = { horizontal: 'left', indent: 2 };
        const startChildRow = ws.lastRow.number + 1;
        processNodes(node.children, ws, qtyMap, level + 1, mode, isEffectiveOption, null, _includePM);
        const endChildRow = ws.lastRow.number;
        if (endChildRow >= startChildRow) {
          const formula = `SUBTOTAL(9, F${startChildRow}:F${endChildRow})`;
          // Calculer le total réel pour décider si on affiche la ligne
          let childTotal = 0;
          for (let r = startChildRow; r <= endChildRow; r++) {
            const cell = ws.getRow(r).getCell(6);
            if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
              childTotal += Number(cell.value.result) || 0;
            } else if (typeof cell.value === 'number') {
              childTotal += cell.value;
            }
          }
          // En DQE les P.U. sont vides → childTotal vaut toujours 0, mais on veut
          // quand même les lignes de sous-total (formules SUBTOTAL live, calculées
          // dès que le candidat saisit les prix). On les force donc pour le DQE.
          if (childTotal !== 0 || type === 'DQE') {
            const rowTotal = ws.addRow(['', `SOUS-TOTAL ${titleStr}`, '', '', '', { formula }]);
            // On mémorise l'index du chapitre (= index niveau 0) pour pouvoir
            // référencer ce sous-total depuis le récapitulatif (formule inter-feuilles).
            if (level === 0 && subTotalCollector) subTotalCollector.push({ ref: `F${rowTotal.number}`, chapterIndex: index });
            // Couleur cellule par cellule (A→F) pour rester dans les limites du tableau
            const totalFont = level === 0 ? fonts.subTotalMain : fonts.subTotalSub;
            const totalFill = level === 0 ? fills.subTotalMain : fills.subTotalSub;
            for (let c = 1; c <= 6; c++) {
              const cell = rowTotal.getCell(c);
              cell.font = totalFont; cell.fill = totalFill; cell.border = borders.thin;
            }
            rowTotal.getCell(2).alignment = { horizontal: 'right' };
            rowTotal.getCell(6).numFmt = '#,##0.00 €';
          }
        }
      } else if (node.type === 'item') {
        const key = (node.designation || "").trim().toUpperCase();
        let reference = bpuConfig?.numberingMode === 'manual' && node.bpuNum ? String(node.bpuNum).trim() : projectRefMap.get(key) || '';
        const mapKey = String(node.id);
        let qty = parseFloat(node.qty || 0);
        if (qtyMap?.has(mapKey)) qty = Number(qtyMap.get(mapKey));
        qty = Math.round(qty * 100) / 100;
        if (isNaN(qty)) qty = 0;
        const price = parseFloat(node.price || 0);
        const isPM = qty === 0;
        // Ignorer les lignes PM si _includePM est false
        if (!_includePM && isPM) return;
        const isDQE = type === 'DQE';
        const displayQty = isPM ? 'PM' : qty;
        const displayPrice = isDQE ? '' : price;
        const rowItem = ws.addRow([reference, cleanText(node.designation), normalizeUnitSymbol(node.unit), displayQty, displayPrice, '']);
        const currentRowNum = rowItem.number;
        const totalCell = rowItem.getCell(6);
        if (isPM) {
          rowItem.getCell(4).font = fonts.pmStyle;
          totalCell.value = isDQE ? '' : 'PM';
          if (!isDQE) { totalCell.font = fonts.pmStyle; totalCell.alignment = { horizontal: 'right' }; }
        } else {
          // Arrondi à la ligne (ROUND) pour coïncider au centime avec le PDF (audit F3).
          totalCell.value = isDQE
            ? { formula: `IF(E${currentRowNum}="","",ROUND(D${currentRowNum}*E${currentRowNum},2))` }
            : { formula: `ROUND(D${currentRowNum}*E${currentRowNum},2)`, result: roundEuro(qty * price) };
          totalCell.numFmt = '#,##0.00 €';
        }
        rowItem.getCell(1).alignment = { horizontal: 'center' };
        rowItem.getCell(5).numFmt = '#,##0.00 €';
        rowItem.eachCell(cell => cell.border = borders.dotted);
      }
    });
  };

  const addTotalRow = (ws, label, formulaStr, isGreen, isPse = false) => {
    const row = ws.addRow(['', '', '', '', label, { formula: formulaStr }]);
    const valCell = row.getCell(6);
    valCell.numFmt = '#,##0.00 €'; valCell.alignment = { horizontal: 'right' };
    row.getCell(5).alignment = { horizontal: 'right' };
    if (isPse) { row.font = fonts.totalPse; valCell.fill = fills.totalPse; }
    else if (isGreen) { row.font = fonts.total; valCell.fill = fills.total; }
    else { row.font = fonts.bold; }
    return row.number;
  };

  // ── FEUILLES DÉTAILLÉES ──
  selectedExports.forEach((expId) => {
    const trancheName = getTrancheName(expId);
    const safeSheetName = trancheName.substring(0, 31).replace(/[\\/?*[\]]/g, '');
    const worksheet = workbook.addWorksheet(safeSheetName, { views: [{ showGridLines: false }] });
    const currentQtyMap = new Map(Object.entries(clientQtyMaps[expId] || {}));

    worksheet.columns = [
      { key: 'num', width: 10 }, { key: 'desc', width: 65 }, { key: 'unit', width: 8 },
      { key: 'qty', width: 12 }, { key: 'price', width: 15 }, { key: 'total', width: 18 }
    ];

    // Lignes d'en-tête (hauteur pour les logos)
    [1, 2, 3].forEach(i => worksheet.getRow(i).height = 28);

    // Titre & type
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = ` ${project.name || 'PROJET SANS NOM'} - ${trancheName}`;
    titleCell.font = fonts.title; titleCell.alignment = { horizontal: 'center', vertical: 'bottom' };

    worksheet.mergeCells('A2:D2');
    const typeCell = worksheet.getCell('A2');
    typeCell.value = ` ${type === 'DQE' ? 'DÉTAIL QUANTITATIF ESTIMATIF' : 'ESTIMATION CONFIDENTIELLE'}`;
    typeCell.font = fonts.subTitle; typeCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A3:D3');
    const dateCell = worksheet.getCell('A3');
    dateCell.value = `DATE : ${new Date().toLocaleDateString('fr-FR')}`;
    dateCell.font = fonts.info; dateCell.alignment = { horizontal: 'center', vertical: 'top' };

    // ── LOGOS (bandeau haut-droit) ──
    // Le titre est fusionné sur A1:D1 → on réserve les colonnes E et F aux logos
    // pour éviter tout chevauchement : MOA (client) dans la colonne E, MOE dans
    // la colonne F (la plus à droite). Largeurs plafonnées à la largeur de leur
    // colonne respective afin qu'ils ne se recouvrent jamais.
    // ── LOGO CLIENT (MOA) — colonne E ──
    if (clientLogoId !== null && clientDims) {
      const ratio = Math.min(100 / clientDims.width, 70 / clientDims.height);
      worksheet.addImage(clientLogoId, {
        tl: { col: 4.05, row: 0.2 },
        ext: { width: clientDims.width * ratio, height: clientDims.height * ratio }
      });
    }

    // ── LOGO MOE — colonne F (coin haut-droit) ──
    if (moeLogoId !== null && moeDims) {
      const ratio = Math.min(120 / moeDims.width, 75 / moeDims.height);
      worksheet.addImage(moeLogoId, {
        tl: { col: 5.0, row: 0.2 },
        ext: { width: moeDims.width * ratio, height: moeDims.height * ratio }
      });
    }

    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['N°', 'DÉSIGNATION', 'U', 'QTÉ', 'P.U. (HT)', 'TOTAL (HT)']);
    headerRow.height = 25;
    headerRow.eachCell(cell => {
      cell.font = fonts.header; cell.fill = fills.header;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borders.thin;
    });

    const mainSubTotalsRefs = [];
    if (project.chapters) processNodes(project.chapters, worksheet, currentQtyMap, 0, 'base', false, mainSubTotalsRefs, includePM);

    worksheet.addRow([]);
    const totalBaseFormula = mainSubTotalsRefs.length > 0 ? mainSubTotalsRefs.map(r => r.ref).join('+') : "0";
    const rowTotalHT = addTotalRow(worksheet, 'TOTAL GÉNÉRAL HT (Hors PSE)', totalBaseFormula, false);
    // TTC = HT + TVA (et non HT × 1.2 recalculé) pour garantir HT + TVA = TTC (audit F1).
    const rowTotalTVA = addTotalRow(worksheet, 'TVA (20%)', `ROUND(F${rowTotalHT}*0.2,2)`, false);
    addTotalRow(worksheet, 'TOTAL GÉNÉRAL TTC', `F${rowTotalHT}+F${rowTotalTVA}`, true);

    // Mémorise les références (feuille + ligne) pour alimenter le récapitulatif.
    if (summarySheet) {
      summaryRefs[expId] = {
        sheetName: safeSheetName,
        totalRow: rowTotalHT,
        chapters: Object.fromEntries(mainSubTotalsRefs.map(r => [r.chapterIndex, r.ref])),
      };
    }

    if (project.chapters) {
      project.chapters.forEach((chap, idx) => {
        let isPseBlock = false; let pseTitle = ""; const pseSubTotalsRefs = [];
        if (chap.isOption) { isPseBlock = true; pseTitle = `PSE n°${idx + 1} : ${chap.title.toUpperCase()}`; }
        else {
          const hasSubOptions = (n) => { if (n.isOption) return true; if (n.type === 'item') return !!n.isOption; if (n.children) return n.children.some(hasSubOptions); return false; };
          if (hasSubOptions(chap)) { isPseBlock = true; pseTitle = `PSE SUR ${chap.title.toUpperCase()}`; }
        }
        if (isPseBlock) {
          worksheet.addRow([]); worksheet.addRow([]);
          const headerPse = worksheet.addRow(['', pseTitle, '', '', '', '']);
          headerPse.font = fonts.optionTitle;
          const startPseRow = worksheet.lastRow.number + 1;
          processNodes([chap], worksheet, currentQtyMap, 0, 'option', false, pseSubTotalsRefs, includePM);
          const endPseRow = worksheet.lastRow.number;
          if (endPseRow >= startPseRow && pseSubTotalsRefs.length > 0) {
            const pseTotalFormula = pseSubTotalsRefs.map(r => r.ref).join('+');
            worksheet.addRow([]);
            const rowPseHT = addTotalRow(worksheet, `TOTAL HT (${pseTitle})`, pseTotalFormula, false, true);
            const rowPseTVA = addTotalRow(worksheet, `TVA (20%)`, `ROUND(F${rowPseHT}*0.2,2)`, false, true);
            addTotalRow(worksheet, `TOTAL TTC (${pseTitle})`, `F${rowPseHT}+F${rowPseTVA}`, false, true);
          }
        }
      });
    }
  });

  // ── REMPLISSAGE DU RÉCAPITULATIF (après les feuilles détail) ──
  // Chaque cellule référence le sous-total du chapitre dans la feuille de la
  // tranche concernée ; le total général pointe sur la ligne « TOTAL GÉNÉRAL HT »
  // de chaque tranche. Formules valables pour DQE comme ESTIMATION.
  if (summarySheet && project.chapters) {
    const quote = (sheet) => `'${String(sheet).replace(/'/g, "''")}'`;
    project.chapters.forEach((chap, chapIdx) => {
      const rowData = [(chap.title || chap.designation || '').toUpperCase()];
      let hasAny = false;
      selectedExports.forEach((expId) => {
        const ref = summaryRefs[expId]?.chapters?.[chapIdx];
        if (ref) { rowData.push({ formula: `${quote(summaryRefs[expId].sheetName)}!${ref}` }); hasAny = true; }
        else rowData.push('');
      });
      if (!hasAny) return; // chapitre sans sous-total dans aucune tranche (ex. PSE) → masqué
      const row = summarySheet.addRow(rowData);
      row.getCell(1).font = fonts.bold;
      for (let i = 2; i <= rowData.length; i++) row.getCell(i).numFmt = '#,##0.00 €';
    });
    summarySheet.addRow([]);
    const footData = ['TOTAL GÉNÉRAL HT'];
    selectedExports.forEach((expId) => {
      const tr = summaryRefs[expId];
      footData.push(tr ? { formula: `${quote(tr.sheetName)}!F${tr.totalRow}` } : '');
    });
    const footRow = summarySheet.addRow(footData);
    footRow.getCell(1).font = fonts.total;
    for (let i = 2; i <= footData.length; i++) {
      const cell = footRow.getCell(i); cell.numFmt = '#,##0.00 €'; cell.font = fonts.total; cell.fill = fills.total;
    }
  }

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const safeName = (project.name || 'Projet').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').replace(/_+/g, '_');
  await saveFileWithPicker(blob, `${safeName}_${type}.xlsx`, FILE_TYPES.excel, PICKER_IDS.exportExcel);
};