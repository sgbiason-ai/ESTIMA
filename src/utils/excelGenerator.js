// src/utils/excelGenerator.js
import ExcelJS from 'exceljs';
import { getItemRefMap, cleanText, normalizeUnitSymbol } from './helpers';
import { roundEuro } from './financeFormat';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from './fileSaver';
import { stampExcelCredit } from './estimaCredit';
import { computePseDeltas, buildPseNumbers, collectPseRoots, collectSubstitutions, buildChapterNumberMap } from './projectCalculations';
import { htmlToPlainText, htmlToRichBlocks } from './richText';
import { buildCoverPageCanvas } from './coverPageCanvas';

// Description PSE (HTML riche) → richText ExcelJS (gras/souligné préservés, puces,
// sauts de ligne entre blocs). Retourne null si vide.
const pseDescriptionRichText = (html) => {
  const blocks = htmlToRichBlocks(html);
  if (!blocks.length) return null;
  const baseFont = { name: 'Aptos', size: 9, color: { argb: 'FF374151' } };
  const richText = [];
  blocks.forEach((b, i) => {
    if (i > 0) richText.push({ font: baseFont, text: '\n' });
    if (b.type === 'li') richText.push({ font: baseFont, text: '• ' });
    b.runs.forEach((r) => {
      richText.push({ font: { ...baseFont, bold: !!r.bold, underline: !!r.underline }, text: r.text });
    });
  });
  return richText;
};

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
  const { selectedExports = ['global'], includeSummary = false, includePM = true, tranches = [], lockPrices = false, uniquePrices = false, includeCover = false } = options;
  const workbook = new ExcelJS.Workbook();
  // Feuilles à protéger en fin de génération (option « verrouiller tout sauf les P.U. ») :
  // toutes les cellules restent verrouillées sauf les P.U. des articles, déverrouillées
  // une à une dans processNodes. La protection effective est posée après remplissage.
  const sheetsToProtect = [];

  let projectRefMap = new Map();
  try { if (project?.chapters) projectRefMap = getItemRefMap(project); } catch { /* ignore */ }
  // Numéro de chaque (sous-)chapitre, comme à l'écran — numérote les sous-chapitres des exports.
  const chapterNumMap = buildChapterNumberMap(project?.chapters || [], bpuConfig);

  // Label du total général : on ne précise « (Hors PSE) » que s'il existe des PSE.
  const hasPse = collectPseRoots(project?.chapters || []).length > 0;
  const totalHtLabel = hasPse ? 'TOTAL GÉNÉRAL HT (Hors PSE)' : 'TOTAL GÉNÉRAL HT';

  // Option « prix uniques par numéro » (DQE uniquement) : chaque numéro de prix a une
  // seule cellule P.U. saisissable (le « maître ») — toutes feuilles confondues ; les
  // répétitions (autre chapitre, autre tranche) la recopient par formule. Un numéro
  // = un prix : l'entreprise ne saisit qu'une fois. Garde-fous :
  //  - deux articles DIFFÉRENTS (désignation ou unité distincte) partageant un numéro
  //    par erreur ne sont jamais liés (chaque ligne reste saisissable, comme avant) ;
  //  - le maître privilégie une ligne de base à quantité réelle : base réelle (rang 0)
  //    > base PM (1) > PSE réelle (2) > PSE PM (3). Si une meilleure occurrence arrive
  //    plus tard, elle est promue maître et l'ancienne devient une reprise en chaîne.
  const linkDuplicates = uniquePrices && type === 'DQE';
  const priceMasters = new Map(); // référence → { sheetName, row, desigKey, unitKey, rank }
  const masterRank = (isPM, isOption) => (isOption ? 2 : 0) + (isPM ? 1 : 0);

  const getTrancheName = (id) => id === 'global' ? 'GLOBAL' : tranches.find(t => t.id === id)?.name || id;

  // ── MISE EN PAGE IMPRESSION (A4 portrait, prêt à imprimer) ──
  // Chaque feuille est calibrée pour une impression directe : ajustée à la largeur
  // d'une A4 portrait (1 page de large, hauteur libre), marges étroites, en-tête de
  // tableau répété sur chaque page, en-tête/pied de page projet + date + n° de page.
  const projectLabel = project.name || 'PROJET SANS NOM';
  const editDate = new Date().toLocaleDateString('fr-FR');
  // Échappe '&' (code réservé dans les en-têtes/pieds Excel) en le doublant.
  const xlEsc = (s) => String(s ?? '').replace(/&/g, '&&');
  const applyPrintLayout = (ws, headerRowNum, sheetLabel) => {
    ws.pageSetup = {
      paperSize: 9,                 // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,                // tout le tableau tient sur 1 page de large
      fitToHeight: 0,               // hauteur libre → autant de pages que nécessaire
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.55, bottom: 0.55, header: 0.3, footer: 0.3 },
    };
    // Répète la ligne d'en-tête du tableau en haut de chaque page imprimée.
    if (headerRowNum) ws.pageSetup.printTitlesRow = `${headerRowNum}:${headerRowNum}`;
    // ⚠️ Ordre TAILLE puis POLICE obligatoire. Excel lit un code taille « &8 » en
    // happant TOUS les chiffres qui suivent : « &8 » collé à « 29/06/2026 » est lu
    // « taille 829 » → texte géant en travers de la page. En mettant la police après
    // la taille, le texte suit le guillemet fermant " et n'est jamais happé (robuste
    // même si un projet/tranche commence par un chiffre).
    ws.headerFooter = {
      oddHeader: `&L&10&"Aptos,Bold"${xlEsc(projectLabel)}&R&9&"Aptos"${xlEsc(sheetLabel)}`,
      oddFooter: `&L&8&"Aptos"${xlEsc(editDate)}&C&8&"Aptos"Page &P / &N&R&8&"Aptos"${xlEsc(projectLabel)}`,
    };
  };

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
    totalPse: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } },
    editable: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }, // jaune clair : cellule P.U. à saisir
    linked: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } // gris clair : P.U. repris par formule (prix unique)
  };

  const borders = {
    thin: { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } },
    dotted: { bottom: { style: 'dotted', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } },
    editable: { top: { style: 'thin', color: { argb: 'FFD97706' } }, bottom: { style: 'thin', color: { argb: 'FFD97706' } }, left: { style: 'thin', color: { argb: 'FFD97706' } }, right: { style: 'thin', color: { argb: 'FFD97706' } } } // contour ambre cellule P.U.
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

  // ── PAGE DE GARDE (onglet en tête du classeur) ──
  // Réutilise la page de garde fidèle (image A4 identique au PDF/Word) : logos MOA/MOE,
  // titre, phase, code affaire, signatures… Le libellé du document suit le type d'export
  // (DQE → « D.Q.E. », estimation → « ESTIMATION »). Créée AVANT le récap et les feuilles
  // détail → premier onglet du classeur.
  if (includeCover) {
    try {
      const coverLabel = type === 'DQE' ? 'D.Q.E.' : type === 'BPU' ? 'B.P.U.' : 'ESTIMATION';
      const coverDataUrl = await buildCoverPageCanvas(project, coverLabel, branding);
      const coverBuffer = await fetchImageAsBuffer(coverDataUrl);
      if (coverBuffer) {
        const coverImgId = workbook.addImage({ buffer: coverBuffer, extension: 'png' });
        const coverSheet = workbook.addWorksheet('Page de garde', { views: [{ showGridLines: false }] });
        coverSheet.pageSetup = {
          paperSize: 9, orientation: 'portrait',
          fitToPage: true, fitToWidth: 1, fitToHeight: 1,
          horizontalCentered: true, verticalCentered: true,
          margins: { left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0 },
        };
        // Impression PLEIN PAGE : image ancrée en haut-gauche, dimensionnée à la taille
        // native du canvas (1050×1485 px = A4 à ~127 dpi), donc PLUS GRANDE qu'une A4 à
        // 96 dpi. Combinée à fitToPage 1×1 + marges nulles, Excel la réduit pour remplir
        // exactement une page A4 (même ratio A4 → aucune bande blanche ni déformation).
        // On surdimensionne volontairement : le « fit » d'Excel réduit mais n'agrandit
        // jamais — partir plus grand garantit le plein page à l'impression.
        coverSheet.addImage(coverImgId, { tl: { col: 0, row: 0 }, ext: { width: 1050, height: 1485 } });
      }
    } catch (err) {
      // Canvas indisponible (ex : environnement de test sans DOM) → on saute la page de garde.
      console.warn('Page de garde Excel ignorée :', err);
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
    summarySheet.columns = [{ key: 'desc', width: 50 }, ...selectedExports.map(() => ({ width: 20 }))];
    summarySheet.addRow(['RÉCAPITULATIF FINANCIER']).font = fonts.title;
    summarySheet.addRow([]);
    const headerRow = summarySheet.addRow(headers);
    // Hauteur + retour à la ligne : les noms de tranche longs (« Tranche OPTIONNELLE 1 »)
    // s'enroulent sur 2 lignes au lieu de déborder/se chevaucher.
    headerRow.height = 34;
    headerRow.eachCell(cell => { cell.font = fonts.header; cell.fill = fills.header; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
    // Impression prête : A4 portrait, ajusté à la largeur, en-tête répété.
    applyPrintLayout(summarySheet, headerRow.number, 'Récapitulatif');
    // Récap entièrement verrouillé (formules inter-feuilles) si l'option est active.
    if (lockPrices) sheetsToProtect.push(summarySheet);
  }

  // ── PRIX UNIQUES : reprise du maître ──
  // Réf. Excel de la cellule maître vue depuis la feuille `fromSheetName`.
  const masterCellRef = (master, fromSheetName) => master.sheetName === fromSheetName
    ? `E${master.row}`
    : `'${master.sheetName.replace(/'/g, "''")}'!E${master.row}`;
  // Transforme une cellule P.U. en « reprise du maître » : formule, fond gris, note,
  // et verrouillage (une cellule liée ne doit jamais rester saisissable). Sert aussi
  // à rétrograder un ancien maître promu (d'où la remise à plat des styles).
  const applyLinkedPrice = (cell, master, reference, fromSheetName) => {
    const ref = masterCellRef(master, fromSheetName);
    // IF(...="","",...) : tant que le maître n'est pas saisi, la cellule reste vide
    // (et le total F, qui teste E="", reste vide lui aussi).
    cell.value = { formula: `IF(${ref}="","",${ref})` };
    cell.font = fonts.info;
    cell.fill = fills.linked;
    cell.border = borders.dotted;
    if (lockPrices) cell.protection = { locked: true };
    cell.note = master.sheetName === fromSheetName
      ? `Prix n° ${reference} repris automatiquement : il se saisit une seule fois, en cellule E${master.row}.`
      : `Prix n° ${reference} repris automatiquement de la feuille « ${master.sheetName} » (cellule E${master.row}) : il se saisit une seule fois.`;
  };

  // ── TRAITEMENT NŒUDS ──
  const processNodes = (nodes, ws, qtyMap, level = 0, mode = 'base', parentIsOption = false, subTotalCollector = null, _includePM = true, cellRefMap = null) => {
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
        // Numéro identique à l'écran en mode base (sous-chapitres numérotés en colonne A) ;
        // PSE/option → repli sur l'index racine (comportement inchangé).
        const mappedNum = mode === 'base' ? chapterNumMap.get(node.id) : null;
        const chapNum = mappedNum || (level === 0 ? (index + 1).toString() : '');
        const titleStr = (node.title || node.designation || '').toUpperCase();
        const rowHeader = ws.addRow([chapNum, titleStr, '', '', '', '']);
        // Appliquer la couleur cellule par cellule (A→F) pour ne pas déborder hors du tableau
        const headerFont = level === 0 ? fonts.chapterTitle : { ...fonts.bold, size: 9, color: { argb: 'FF4B5563' } };
        const headerFill = level === 0 ? fills.chapter : fills.subChapter;
        for (let c = 1; c <= 6; c++) {
          const cell = rowHeader.getCell(c);
          cell.font = headerFont; cell.fill = headerFill; cell.border = borders.thin;
        }
        rowHeader.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        if (level > 0) rowHeader.getCell(2).alignment = { horizontal: 'left', indent: 2 };
        // Commentaire de chapitre : ligne italique fusionnée (B→F) sous le titre.
        if (node.comment) {
          const rowComment = ws.addRow(['', cleanText(node.comment), '', '', '', '']);
          ws.mergeCells(`B${rowComment.number}:F${rowComment.number}`);
          const commentCell = rowComment.getCell(2);
          commentCell.font = { name: 'Aptos', size: 9, italic: true, color: { argb: 'FF6B7280' } };
          commentCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
          for (let c = 1; c <= 6; c++) rowComment.getCell(c).border = borders.thin;
        }
        const startChildRow = ws.lastRow.number + 1;
        processNodes(node.children, ws, qtyMap, level + 1, mode, isEffectiveOption, null, _includePM, cellRefMap);
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
            const subtotalLabel = mappedNum ? `SOUS-TOTAL ${mappedNum}. ${titleStr}` : `SOUS-TOTAL ${titleStr}`;
            const rowTotal = ws.addRow(['', subtotalLabel, '', '', '', { formula }]);
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
            // Mémorise la cellule de sous-total de ce (sous-)chapitre : la formule de
            // delta d'une PSE substitution pourra référencer cette base.
            if (cellRefMap) cellRefMap.set(String(node.id), `F${rowTotal.number}`);
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
        // Prix uniques par numéro (DQE) : si ce numéro a déjà un maître, la P.U. le
        // recopie par formule — sinon cette cellule DEVIENT le maître, avec promotion
        // possible (une base à quantité réelle détrône une ligne PM ou une PSE).
        // Les articles sans numéro ne sont jamais liés ; un numéro porté par un article
        // DIFFÉRENT (désignation/unité) n'est pas lié non plus (collision de numérotation).
        let isLinkedPrice = false;
        if (linkDuplicates && reference) {
          const unitKey = normalizeUnitSymbol(node.unit) || '';
          const rank = masterRank(isPM, mode === 'option');
          const candidate = { sheetName: ws.name, row: currentRowNum, desigKey: key, unitKey, rank };
          const master = priceMasters.get(reference);
          if (!master) {
            priceMasters.set(reference, candidate);
          } else if (master.desigKey !== key || master.unitKey !== unitKey) {
            // Même numéro mais article différent : pas de liaison, la ligne reste saisissable.
          } else if (rank < master.rank) {
            // Promotion : l'ancien maître devient une reprise du nouveau ; les cellules
            // déjà liées à l'ancien suivent par formules en chaîne (E_old → E_new).
            const oldWs = workbook.getWorksheet(master.sheetName);
            if (oldWs) applyLinkedPrice(oldWs.getRow(master.row).getCell(5), candidate, reference, master.sheetName);
            priceMasters.set(reference, candidate);
          } else {
            isLinkedPrice = true;
            applyLinkedPrice(rowItem.getCell(5), master, reference, ws.name);
          }
        }
        // Option « verrouiller tout sauf les P.U. » : seule la cellule P.U. (col. E) reste
        // éditable (déverrouillée), repérée par un fond jaune + contour ambre. Posé APRÈS
        // borders.dotted pour ne pas être écrasé. La feuille est protégée en fin de génération.
        // Les P.U. repris par formule restent verrouillés : la saisie se fait sur le maître.
        if (lockPrices && !isLinkedPrice) {
          const priceCell = rowItem.getCell(5);
          priceCell.protection = { locked: false };
          priceCell.fill = fills.editable;
          priceCell.border = borders.editable;
        }
        // Mémorise la cellule total de l'article (base potentielle d'une PSE substitution).
        if (cellRefMap && !isPM) cellRefMap.set(String(node.id), `F${currentRowNum}`);
      }
    });
  };

  const addTotalRow = (ws, label, formulaStr, isGreen, isPse = false) => {
    const row = ws.addRow(['', '', '', '', '', { formula: formulaStr }]);
    const r = row.number;
    const valCell = row.getCell(6);
    valCell.numFmt = '#,##0.00 €'; valCell.alignment = { horizontal: 'right' };
    // Libellé fusionné A→E : pleine largeur, aligné à droite, jamais rogné. Sans fusion,
    // le texte aligné à droite dans la seule colonne E était tronqué car A–D (chaînes
    // vides) bloquaient le débordement à gauche (« TOTAL GÉNÉRAL HT » → « TAL GÉNÉRAL HT »).
    ws.mergeCells(`A${r}:E${r}`);
    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.alignment = { horizontal: 'right' };
    if (isPse) { row.font = fonts.totalPse; valCell.fill = fills.totalPse; }
    else if (isGreen) { row.font = fonts.total; valCell.fill = fills.total; }
    else { row.font = fonts.bold; }
    return r;
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

    // Impression prête : A4 portrait, ajusté à la largeur, en-tête de tableau répété.
    applyPrintLayout(worksheet, headerRow.number, trancheName);
    if (lockPrices) sheetsToProtect.push(worksheet);

    const mainSubTotalsRefs = [];
    // Cellule de total de chaque prestation de base (id → 'F{row}') : sert aux
    // formules de delta des PSE substitution (montant PSE − base).
    const baseCellRefs = new Map();
    if (project.chapters) processNodes(project.chapters, worksheet, currentQtyMap, 0, 'base', false, mainSubTotalsRefs, includePM, baseCellRefs);

    worksheet.addRow([]);
    const totalBaseFormula = mainSubTotalsRefs.length > 0 ? mainSubTotalsRefs.map(r => r.ref).join('+') : "0";
    // Taux de TVA configurable par projet (défaut 20 %) — audit F2.
    const tvaRatePct = Number(project?.tauxTVA ?? 20);
    const tvaRate = tvaRatePct / 100;
    const tvaLabel = `TVA (${String(tvaRatePct).replace('.', ',')}%)`;
    const rowTotalHT = addTotalRow(worksheet, totalHtLabel, totalBaseFormula, false);
    // TTC = HT + TVA (et non HT × taux recalculé) pour garantir HT + TVA = TTC (audit F1).
    const rowTotalTVA = addTotalRow(worksheet, tvaLabel, `ROUND(F${rowTotalHT}*${tvaRate},2)`, false);
    addTotalRow(worksheet, 'TOTAL GÉNÉRAL TTC', `F${rowTotalHT}+F${rowTotalTVA}`, true);

    // Mémorise les références (feuille + ligne) pour alimenter le récapitulatif.
    if (summarySheet) {
      summaryRefs[expId] = {
        sheetName: safeSheetName,
        totalRow: rowTotalHT,
        chapters: Object.fromEntries(mainSubTotalsRefs.map(r => [r.chapterIndex, r.ref])),
        pse: {}, // { [rootId]: ligne du net HT } — renseigné dans le bloc PSE ci-dessous
      };
    }

    if (project.chapters) {
      // Une page/bloc par PSE (racine option), numérotée PSE n°1, n°2… comme l'écran et le PDF.
      const getQty = (item) => {
        const k = String(item.id);
        return currentQtyMap.has(k) ? Number(currentQtyMap.get(k)) : Number(item.qty || 0);
      };
      const pseDeltas = computePseDeltas(project.chapters, getQty);
      const pseNumbers = buildPseNumbers(project.chapters);
      const pseRoots = collectPseRoots(project.chapters);
      const nodeIndex = new Map();
      (function idx(ns) { (ns || []).forEach(n => { if (n) { nodeIndex.set(n.id, n); if (n.children) idx(n.children); } }); })(project.chapters);

      pseRoots.forEach((root) => {
        const pseNo = pseNumbers.get(root.id);
        const pseTitle = `PSE n°${pseNo} : ${(root.title || '').toUpperCase()}`;
        const pseSubTotalsRefs = [];
        worksheet.addRow([]); worksheet.addRow([]);
        const headerPse = worksheet.addRow(['', pseTitle, '', '', '', '']);
        headerPse.font = fonts.optionTitle;
        // Description / justification de la PSE — rendu fidèle (gras/souligné/puces),
        // centré en hauteur dans la cellule.
        const pseDescRich = pseDescriptionRichText(root.pseDescription);
        if (pseDescRich) {
          const dRow = worksheet.addRow(['', '', '', '', '', '']);
          dRow.getCell(2).value = { richText: pseDescRich };
          dRow.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
        }
        const startPseRow = worksheet.lastRow.number + 1;
        processNodes([root], worksheet, currentQtyMap, 0, 'option', false, pseSubTotalsRefs, includePM);
        const endPseRow = worksheet.lastRow.number;
        if (endPseRow < startPseRow || pseSubTotalsRefs.length === 0) return;

        const montantFormula = pseSubTotalsRefs.map(r => r.ref).join('+'); // montant PSE plein
        const substitutions = collectSubstitutions(root, pseDeltas);
        worksheet.addRow([]);
        let netRow;

        if (substitutions.length > 0) {
          // PSE substitution : valeur = montant PSE − prestation(s) de base remplacée(s),
          // calculée PAR FORMULE (référence la cellule de la base → reste live).
          const rowMontant = addTotalRow(worksheet, 'Montant PSE HT', montantFormula, false, true);
          const dedCells = [];
          substitutions.forEach(({ info }) => {
            const baseNode = nodeIndex.get(info.baseId);
            const baseName = baseNode ? (baseNode.type === 'item' ? baseNode.designation : baseNode.title) : '';
            const baseRef = baseCellRefs.get(String(info.baseId));
            const dedFormula = baseRef ? `-${baseRef}` : `-${roundEuro(info.baseTotal)}`;
            const rowDed = addTotalRow(worksheet, `- Base remplacée : ${(baseName || '').toUpperCase()}`, dedFormula, false, true);
            dedCells.push(`F${rowDed}`);
          });
          // Net HT = montant + Σ déductions ; libellé plus-value / moins-value DYNAMIQUE (IF).
          const netFormula = `F${rowMontant}${dedCells.map(c => `+${c}`).join('')}`;
          // Libellé dynamique posé sur la cellule MAÎTRE de la fusion (col. A) — après
          // mergeCells A:E dans addTotalRow, écrire en E n'afficherait rien.
          const rowNetHT = addTotalRow(worksheet, '', netFormula, false, true);
          worksheet.getRow(rowNetHT).getCell(1).value = { formula: `IF(F${rowNetHT}>=0,"PLUS-VALUE HT PSE","MOINS-VALUE HT PSE")` };
          worksheet.getRow(rowNetHT).getCell(1).alignment = { horizontal: 'right' };
          const rowNetTTC = addTotalRow(worksheet, '', `F${rowNetHT}+ROUND(F${rowNetHT}*${tvaRate},2)`, false, true);
          worksheet.getRow(rowNetTTC).getCell(1).value = { formula: `IF(F${rowNetHT}>=0,"PLUS-VALUE TTC PSE","MOINS-VALUE TTC PSE")` };
          worksheet.getRow(rowNetTTC).getCell(1).alignment = { horizontal: 'right' };
          netRow = rowNetHT;
        } else {
          // PSE simple : total plein.
          const rowPseHT = addTotalRow(worksheet, `TOTAL HT (${pseTitle})`, montantFormula, false, true);
          const rowPseTVA = addTotalRow(worksheet, tvaLabel, `ROUND(F${rowPseHT}*${tvaRate},2)`, false, true);
          addTotalRow(worksheet, `TOTAL TTC (${pseTitle})`, `F${rowPseHT}+F${rowPseTVA}`, false, true);
          netRow = rowPseHT;
        }
        // Référence du net HT pour le récapitulatif (formule inter-feuilles).
        if (summarySheet && summaryRefs[expId]) summaryRefs[expId].pse[root.id] = netRow;
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
      const chapNo = chapterNumMap.get(chap.id);
      const rowData = [`${chapNo ? `${chapNo}. ` : ''}${(chap.title || chap.designation || '').toUpperCase()}`];
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

    // ── TOTAL GÉNÉRAL HT (Hors PSE) : juste APRÈS la base, AVANT les PSE. ──
    //    Pointe sur la ligne « TOTAL GÉNÉRAL HT » de chaque tranche (base seule).
    summarySheet.addRow([]);
    const footData = [totalHtLabel];
    selectedExports.forEach((expId) => {
      const tr = summaryRefs[expId];
      footData.push(tr ? { formula: `${quote(tr.sheetName)}!F${tr.totalRow}` } : '');
    });
    const footRow = summarySheet.addRow(footData);
    footRow.getCell(1).font = fonts.total;
    for (let i = 2; i <= footData.length; i++) {
      const cell = footRow.getCell(i); cell.numFmt = '#,##0.00 €'; cell.font = fonts.total; cell.fill = fills.total;
    }

    // ── Section PSE : chaque PSE par son numéro (net = montant ou plus/moins-value),
    //    via formule inter-feuilles. APRÈS le total général, hors total (PSE indépendantes). ──
    const pseNumbers = buildPseNumbers(project.chapters);
    const pseRoots = collectPseRoots(project.chapters)
      .filter(root => selectedExports.some(expId => summaryRefs[expId]?.pse?.[root.id]));
    if (pseRoots.length > 0) {
      summarySheet.addRow([]);
      const secRow = summarySheet.addRow(['OPTIONS / PRESTATIONS SUPPLÉMENTAIRES (PSE)', ...selectedExports.map(() => '')]);
      secRow.getCell(1).font = fonts.optionTitle; secRow.getCell(1).fill = fills.totalPse;
      pseRoots.forEach((root) => {
        const no = pseNumbers.get(root.id);
        const rowData = [`PSE n°${no} - ${(root.title || '').toUpperCase()}`];
        selectedExports.forEach((expId) => {
          const netRow = summaryRefs[expId]?.pse?.[root.id];
          rowData.push(netRow ? { formula: `${quote(summaryRefs[expId].sheetName)}!F${netRow}` } : '');
        });
        const row = summarySheet.addRow(rowData);
        row.getCell(1).font = fonts.totalPse;
        for (let i = 2; i <= rowData.length; i++) row.getCell(i).numFmt = '#,##0.00 €';
        const recapDesc = htmlToPlainText(root.pseDescription);
        if (recapDesc) {
          const dRow = summarySheet.addRow([recapDesc, ...selectedExports.map(() => '')]);
          dRow.getCell(1).font = { name: 'Aptos', size: 8, italic: true, color: { argb: 'FF6B7280' } };
          dRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
        }
      });
    }
  }

  // ── PROTECTION « tout sauf P.U. » (sans mot de passe) ──
  // Sur feuille protégée, toute cellule verrouillée (par défaut) devient non éditable ;
  // seules les P.U. d'articles, déverrouillées plus haut, restent saisissables. Sans mot
  // de passe : anti-erreur pour l'entreprise, qui peut l'ôter via Excel › Révision au besoin.
  if (lockPrices) {
    for (const ws of sheetsToProtect) {
      await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true });
    }
  }

  stampExcelCredit(workbook);
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const safeName = (project.name || 'Projet').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').replace(/_+/g, '_');
  await saveFileWithPicker(blob, `${safeName}_${type}.xlsx`, FILE_TYPES.excel, PICKER_IDS.exportExcel);
};