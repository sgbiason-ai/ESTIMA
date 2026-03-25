// src/utils/excelGenerator.js
import ExcelJS from 'exceljs';
import { getItemRefMap, cleanText, normalizeUnitSymbol } from './helpers';
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
  try { if (project?.chapters) projectRefMap = getItemRefMap(project); } catch (e) {}

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

  // ── CALCUL RÉCAPITULATIF ──
  const calcNodeTotal = (nodes, mode, qtyMap, isParentOption = false) => {
    let total = 0;
    nodes.forEach(n => {
      const isEffectiveOption = isParentOption || !!n.isOption;
      if (mode === 'base' && isEffectiveOption) return;
      if (mode === 'option' && !isEffectiveOption && n.type === 'item') return;
      if (n.type === 'item') {
        const mapKey = String(n.id);
        const rawQty = qtyMap.has(mapKey) ? Number(qtyMap.get(mapKey)) : (Number(n.qty) || 0);
        const qty = Math.round(rawQty * 100) / 100;
        total += Math.round(qty * Number(n.price || 0) * 100) / 100;
      } else if (n.children) {
        total += calcNodeTotal(n.children, mode, qtyMap, isEffectiveOption);
      }
    });
    return total;
  };

  // ── RÉCAPITULATIF ──
  if (includeSummary && selectedExports.length > 0) {
    const summarySheet = workbook.addWorksheet('RÉCAPITULATIF', { views: [{ showGridLines: false }] });
    const headers = ['DÉSIGNATION', ...selectedExports.map(getTrancheName)];
    summarySheet.columns = [{ key: 'desc', width: 50 }, ...selectedExports.map(() => ({ width: 18 }))];
    summarySheet.addRow(['RÉCAPITULATIF FINANCIER']).font = fonts.title;
    summarySheet.addRow([]);
    const headerRow = summarySheet.addRow(headers);
    headerRow.eachCell(cell => { cell.font = fonts.header; cell.fill = fills.header; cell.alignment = { horizontal: 'center' }; });

    const totals = new Array(selectedExports.length).fill(0);
    if (project.chapters) {
      project.chapters.forEach(chap => {
        const rowData = [(chap.title || chap.designation || '').toUpperCase()];
        let chapHasValue = false;
        selectedExports.forEach((expId, idx) => {
          const map = new Map(Object.entries(clientQtyMaps[expId] || {}));
          const val = calcNodeTotal([chap], 'base', map);
          rowData.push(type === 'DQE' ? '' : val);
          totals[idx] += val;
          if (val !== 0) chapHasValue = true;
        });
        // Ne pas afficher la ligne si tous les totaux sont à 0
        if (!chapHasValue && type !== 'DQE') return;
        const row = summarySheet.addRow(rowData);
        row.getCell(1).font = fonts.bold;
        for (let i = 2; i <= rowData.length; i++) row.getCell(i).numFmt = '#,##0.00 €';
      });
    }
    summarySheet.addRow([]);
    const footRow = summarySheet.addRow(['TOTAL GÉNÉRAL HT', ...totals.map(t => type === 'DQE' ? '' : t)]);
    footRow.getCell(1).font = fonts.total;
    for (let i = 2; i <= footRow.values.length - 1; i++) {
      const cell = footRow.getCell(i); cell.numFmt = '#,##0.00 €'; cell.font = fonts.total; cell.fill = fills.total;
    }
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
        if (level === 0) {
          rowHeader.font = fonts.chapterTitle; rowHeader.fill = fills.chapter;
          rowHeader.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          rowHeader.font = { ...fonts.bold, size: 9, color: { argb: 'FF4B5563' } };
          rowHeader.fill = fills.subChapter; rowHeader.getCell(2).alignment = { horizontal: 'left', indent: 2 };
        }
        rowHeader.eachCell(cell => cell.border = borders.thin);
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
          if (childTotal !== 0) {
            const rowTotal = ws.addRow(['', `SOUS-TOTAL ${titleStr}`, '', '', '', { formula }]);
            if (level === 0 && subTotalCollector) subTotalCollector.push(`F${rowTotal.number}`);
            rowTotal.font = level === 0 ? fonts.subTotalMain : fonts.subTotalSub;
            rowTotal.fill = level === 0 ? fills.subTotalMain : fills.subTotalSub;
            rowTotal.getCell(2).alignment = { horizontal: 'right' };
            rowTotal.getCell(6).numFmt = '#,##0.00 €';
            rowTotal.eachCell(cell => cell.border = borders.thin);
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
          totalCell.value = isDQE
            ? { formula: `IF(E${currentRowNum}="","",D${currentRowNum}*E${currentRowNum})` }
            : { formula: `D${currentRowNum}*E${currentRowNum}`, result: qty * price };
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

    // ── LOGO MOE (en haut à droite) ──
    if (moeLogoId !== null && moeDims) {
      const ratio = Math.min(150 / moeDims.width, 80 / moeDims.height);
      worksheet.addImage(moeLogoId, {
        tl: { col: 4.5, row: 0.2 },
        ext: { width: moeDims.width * ratio, height: moeDims.height * ratio }
      });
    }

    // ── LOGO CLIENT (à gauche du logo MOE, ou col 3.5) ──
    if (clientLogoId !== null && clientDims) {
      const ratio = Math.min(120 / clientDims.width, 72 / clientDims.height);
      worksheet.addImage(clientLogoId, {
        tl: { col: 3.2, row: 0.2 },
        ext: { width: clientDims.width * ratio, height: clientDims.height * ratio }
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
    const totalBaseFormula = mainSubTotalsRefs.length > 0 ? mainSubTotalsRefs.join('+') : "0";
    const rowTotalHT = addTotalRow(worksheet, 'TOTAL GÉNÉRAL HT (Hors PSE)', totalBaseFormula, false);
    addTotalRow(worksheet, 'TVA (20%)', `F${rowTotalHT}*0.2`, false);
    addTotalRow(worksheet, 'TOTAL GÉNÉRAL TTC', `F${rowTotalHT}*1.2`, true);

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
            const pseTotalFormula = pseSubTotalsRefs.join('+');
            worksheet.addRow([]);
            const rowPseHT = addTotalRow(worksheet, `TOTAL HT (${pseTitle})`, pseTotalFormula, false, true);
            addTotalRow(worksheet, `TVA (20%)`, `F${rowPseHT}*0.2`, false, true);
            addTotalRow(worksheet, `TOTAL TTC (${pseTitle})`, `F${rowPseHT}*1.2`, false, true);
          }
        }
      });
    }
  });

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const safeName = (project.name || 'Projet').replace(/[^a-z0-9_\-]/gi, '_');
  await saveFileWithPicker(blob, `${safeName}_${type}.xlsx`, FILE_TYPES.excel, PICKER_IDS.exportExcel);
};