// src/utils/excelLibraryHelper.js
// Service d'import et export Excel propre pour la bibliothèque d'articles (BPU / Catalogue)
import { cleanText } from './helpers';
import { htmlToRichBlocks } from './richText';

/**
 * Convertit le HTML riche d'Estima en tableau richText utilisable par ExcelJS
 */
function htmlToExcelRichText(html) {
  if (!html) return '';
  const blocks = htmlToRichBlocks(html);
  if (!blocks.length) return '';

  const baseFont = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F2937' } };
  const richText = [];

  blocks.forEach((b, i) => {
    if (i > 0) richText.push({ font: baseFont, text: '\n' });
    if (b.type === 'li') richText.push({ font: baseFont, text: '• ' });
    b.runs.forEach((r) => {
      richText.push({
        font: {
          ...baseFont,
          bold: !!r.bold,
          underline: !!r.underline,
          italic: !!r.italic
        },
        text: r.text || ''
      });
    });
  });

  return { richText };
}

/**
 * Reconstruit du HTML propre (balises <p>, <strong>, <em>, <u>) à partir du richText d'un fichier Excel
 */
function richTextToHtml(cell) {
  if (!cell) return null;
  const val = cell.value;
  if (val === null || val === undefined) return null;

  // Si c'est du texte brut simple sans richText
  if (typeof val === 'string') {
    if (!val.trim()) return null;
    return val
      .split('\n')
      .map(line => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join('');
  }

  // Si c'est du richText d'ExcelJS
  if (typeof val === 'object' && val.richText) {
    let html = '';
    let currentParagraph = '';

    const closeParagraph = () => {
      if (currentParagraph) {
        html += `<p>${currentParagraph}</p>`;
        currentParagraph = '';
      }
    };

    val.richText.forEach((run) => {
      const text = run.text || '';
      const font = run.font || {};

      const parts = text.split('\n');
      parts.forEach((part, index) => {
        if (index > 0) {
          closeParagraph();
        }

        if (part) {
          let escapedPart = part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          if (font.bold) escapedPart = `<strong>${escapedPart}</strong>`;
          if (font.italic) escapedPart = `<em>${escapedPart}</em>`;
          if (font.underline) escapedPart = `<u>${escapedPart}</u>`;
          currentParagraph += escapedPart;
        }
      });
    });

    closeParagraph();
    return html || null;
  }

  return String(val).trim() ? `<p>${String(val).trim()}</p>` : null;
}

/**
 * Exporte la bibliothèque d'articles BPU au format Excel (.xlsx) propre
 */
export async function exportLibraryToExcel(bpu, categories, activeDbName = "base_locale") {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Bibliothèque');

  // En-têtes de colonnes
  ws.columns = [
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Désignation', key: 'designation', width: 45 },
    { header: 'Unité', key: 'unit', width: 10 },
    { header: 'Prix Catalogue (€)', key: 'price', width: 18 },
    { header: 'Dossier / Catégorie', key: 'category', width: 25 },
    { header: 'Description (Stylisée)', key: 'description', width: 50 },
    { header: 'Référence CCTP', key: 'cctpRef', width: 20 },
    { header: 'Label CCTP', key: 'cctpLabel', width: 20 },
    { header: 'Prix Observé (€)', key: 'observedPrice', width: 18 }
  ];

  // Styling des en-têtes
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4F4F5' } // gris clair Apple-style f4f4f5
    };
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FF374151' } // gris foncé 374151
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFE2E8F0' } }
    };
  });
  
  // Alignement spécifique de l'en-tête de désignation et description à gauche
  headerRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

  // Dictionnaire des catégories pour retrouver le nom à partir de l'ID
  const catMap = new Map(categories.map(c => [String(c.id), c.name]));

  // Remplissage des données
  bpu.forEach((item) => {
    // Résolution de la catégorie/dossier
    let categoryName = '';
    const catIds = (item.categoryIds || (item.categoryId ? [item.categoryId] : [])).map(String);
    if (catIds.length > 0) {
      categoryName = catIds.map(id => catMap.get(id) || id).join(', ');
    }

    // Réf CCTP
    const cctpRef = item.cctpRefs ? item.cctpRefs.join(', ') : (item.cctpRef || '');

    // Conversion de la description HTML riche en richText pour Excel
    const richDesc = htmlToExcelRichText(item.description);

    const row = ws.addRow({
      code: item.code || '',
      designation: item.designation || '',
      unit: item.unit || '',
      price: item.price ? Number(item.price) : 0,
      category: categoryName,
      description: '', // Écrit manuellement ci-dessous pour le richText
      cctpRef: cctpRef,
      cctpLabel: item.cctpLabel || '',
      observedPrice: item.observedPrice ? Number(item.observedPrice) : ''
    });

    row.height = 36; // Un peu plus grand pour supporter le multi-lignes sans gêne
    
    // Assigner le richText à la colonne description
    if (richDesc) {
      row.getCell(6).value = richDesc;
    }

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F2937' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } }
      };

      // Formats spécifiques
      if (colNumber === 1 || colNumber === 3) {
        // Code et Unité centrés
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 4 || colNumber === 9) {
        // Prix catalogue et prix observé à droite au format monétaire
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (cell.value !== '' && cell.value !== 0) {
          cell.numFmt = '#,##0.00" €"';
        }
      }
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const fileSaver = await import('file-saver');
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  fileSaver.saveAs(blob, `export_bibliotheque_${cleanText(activeDbName).replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Analyse et parse un fichier Excel (.xlsx) pour importer des articles dans la bibliothèque
 */
export async function parseLibraryExcel(file) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0]; // Prend la première feuille
  if (!ws) throw new Error("Aucune feuille trouvée dans le fichier Excel.");

  const bpu = [];
  const categoriesMap = new Map(); // Pour éviter de dupliquer les dossiers : nom -> ID
  const categoriesList = [];

  // Helper pour obtenir la valeur textuelle d'une cellule
  const getVal = (cell) => {
    if (!cell) return '';
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if ('result' in val) return String(val.result ?? '');
      if ('text' in val) return String(val.text ?? '');
      if ('richText' in val) return val.richText?.map(r => r.text).join('') ?? '';
    }
    return String(val);
  };

  const getNum = (cell) => {
    const v = getVal(cell);
    if (!v) return 0;
    // Nettoyage monétaire
    const cleanVal = v.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const n = Number(cleanVal);
    return Number.isFinite(n) ? n : 0;
  };

  // Identification des colonnes via la première ligne (les en-têtes)
  let colIndex = {
    code: -1,
    designation: -1,
    unit: -1,
    price: -1,
    category: -1,
    description: -1,
    cctpRef: -1,
    cctpLabel: -1,
    observedPrice: -1
  };

  const firstRow = ws.getRow(1);
  firstRow.eachCell((cell, colNum) => {
    const text = getVal(cell).toLowerCase().trim();
    if (text.includes('code')) colIndex.code = colNum;
    else if (text.includes('désignation') || text.includes('designation') || text.includes('libellé') || text.includes('libelle') || text.includes('article') || text.includes('nom')) colIndex.designation = colNum;
    else if (text.includes('unité') || text.includes('unite') || text.includes(' u ')) colIndex.unit = colNum;
    else if (text.includes('prix') && (text.includes('cat') || text.includes('unitaire') || !text.includes('obs'))) colIndex.price = colNum;
    else if (text.includes('dossier') || text.includes('catégorie') || text.includes('categorie') || text.includes('groupe')) colIndex.category = colNum;
    else if (text.includes('description') || text.includes('details') || text.includes('détails')) colIndex.description = colNum;
    else if (text.includes('cctp') && (text.includes('réf') || text.includes('ref') || text.includes('chapitre') || text.includes('code'))) colIndex.cctpRef = colNum;
    else if (text.includes('cctp') && text.includes('label')) colIndex.cctpLabel = colNum;
    else if (text.includes('observé') || text.includes('observe') || text.includes('réel') || text.includes('reel')) colIndex.observedPrice = colNum;
  });

  // Fallback si non détecté (ordre standard de notre export)
  if (colIndex.designation === -1) colIndex.designation = 2;
  if (colIndex.code === -1) colIndex.code = 1;
  if (colIndex.unit === -1) colIndex.unit = 3;
  if (colIndex.price === -1) colIndex.price = 4;
  if (colIndex.category === -1) colIndex.category = 5;
  if (colIndex.description === -1) colIndex.description = 6;
  if (colIndex.cctpRef === -1) colIndex.cctpRef = 7;
  if (colIndex.cctpLabel === -1) colIndex.cctpLabel = 8;
  if (colIndex.observedPrice === -1) colIndex.observedPrice = 9;

  // Liste des couleurs pour les dossiers créés
  const CAT_FALLBACK = ['#3b82f6','#f59e0b','#8b5cf6','#10b981','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#92400e','#0ea5e9','#d946ef','#64748b','#059669'];
  let colorIdx = 0;

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // Sauter l'en-tête

    const designation = getVal(row.getCell(colIndex.designation)).trim();
    if (!designation) return; // Ligne vide

    const code = getVal(row.getCell(colIndex.code)).trim();
    const unit = getVal(row.getCell(colIndex.unit)).trim();
    const price = getNum(row.getCell(colIndex.price));
    const catStr = getVal(row.getCell(colIndex.category)).trim();
    
    // Lecture de la description en tant que texte riche reconstitué
    const descriptionHtml = richTextToHtml(row.getCell(colIndex.description));
    
    const cctpRefStr = getVal(row.getCell(colIndex.cctpRef)).trim();
    const cctpLabel = getVal(row.getCell(colIndex.cctpLabel)).trim();
    const observedPrice = getNum(row.getCell(colIndex.observedPrice));

    // Gestion du dossier / catégorie
    const categoryIds = [];
    if (catStr) {
      // Tolérance multi-dossiers séparés par des virgules
      const names = catStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      names.forEach(name => {
        if (!categoriesMap.has(name)) {
          const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const color = CAT_FALLBACK[colorIdx % CAT_FALLBACK.length];
          colorIdx++;
          const newCat = { id, name, color };
          categoriesMap.set(name, id);
          categoriesList.push(newCat);
        }
        categoryIds.push(categoriesMap.get(name));
      });
    }

    // Traitement CCTP Réf
    let cctpRef = null;
    let cctpRefs = null;
    if (cctpRefStr) {
      const refs = cctpRefStr.split(',').map(s => s.trim()).filter(Boolean);
      if (refs.length > 1) {
        cctpRefs = refs;
      } else if (refs.length === 1) {
        cctpRef = refs[0];
      }
    }

    const item = {
      id: `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      code,
      designation,
      unit: unit || 'U',
      price,
      categoryIds,
      categoryId: categoryIds[0] || null, // Rétrocompatibilité
      description: descriptionHtml,
      cctpRef,
      cctpRefs,
      cctpLabel: cctpLabel || null,
      observedPrice: observedPrice || null
    };

    bpu.push(item);
  });

  return { bpu, categories: categoriesList };
}
