// src/utils/parseDqeExcel.js
//
// Parser intelligent pour fichiers DQE Excel.
// Détecte automatiquement les colonnes (Ref, Désignation, Unité, Qté, PU)
// et regroupe les articles sous leurs chapitres.

import { generateId } from './helpers';

// ─── PATTERNS DE DÉTECTION DES COLONNES ──────────────────────────────────────

const COLUMN_PATTERNS = {
  ref:         /^(ref|r[eé]f[eé]rence|n[°o]|n[°o]\s*prix|num[eé]ro|n[°o]\s*art|code|rep[eè]re|poste)$/i,
  designation: /^(d[eé]signation|libell[eé]|description|intitul[eé]|ouvrage|prestation|nature)$/i,
  unit:        /^(unit[eé]|u\.?$)$/i,
  qty:         /^(quantit[eé]s?|qt[eé]?|qte|q\.?|nb|nombre|vol)$/i,
  price:       /^(p\.?\s*u\.?|prix\s*unit|prix|pu\s*ht|montant\s*unit|taux)$/i,
};

const SKIP_ROW_PATTERN = /^(sous\s*total|total|s\/?total)/i;

function normalizeHeader(val) {
  return (val ?? '').toString().trim().replace(/\s+/g, ' ');
}

function safeGetCell(row, colIndex) {
  if (!colIndex) return null;
  try { return row.getCell(colIndex); } catch { return null; }
}

function detectHeaderRow(worksheet, maxRows = 20) {
  for (let rowNum = 1; rowNum <= Math.min(maxRows, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    let matches = 0;
    let hasDesignation = false;

    for (let col = 1; col <= Math.min(20, row.cellCount + 1); col++) {
      const raw = normalizeHeader(row.getCell(col).value ?? row.getCell(col).text);
      if (!raw) continue;
      if (COLUMN_PATTERNS.designation.test(raw)) { hasDesignation = true; matches++; }
      else if (COLUMN_PATTERNS.unit.test(raw)) matches++;
      else if (COLUMN_PATTERNS.qty.test(raw)) matches++;
      else if (COLUMN_PATTERNS.price.test(raw)) matches++;
      else if (COLUMN_PATTERNS.ref.test(raw)) matches++;
    }

    if (hasDesignation && matches >= 2) {
      return rowNum;
    }
  }
  return null;
}

function mapColumns(worksheet, headerRowNum) {
  const row = worksheet.getRow(headerRowNum);
  const mapping = { ref: null, designation: null, unit: null, qty: null, price: null };

  for (let col = 1; col <= Math.min(20, row.cellCount + 1); col++) {
    const raw = normalizeHeader(row.getCell(col).value ?? row.getCell(col).text);
    if (!raw) continue;
    for (const [key, pattern] of Object.entries(COLUMN_PATTERNS)) {
      if (!mapping[key] && pattern.test(raw)) {
        mapping[key] = col;
        break;
      }
    }
  }

  return mapping;
}

function getCellValue(cell) {
  if (!cell) return '';
  let val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('result' in val) return val.result;
    if ('text' in val) return val.text;
    if ('richText' in val) return val.richText?.map(r => r.text).join('') ?? '';
  }
  return val;
}

function getCellNumber(cell) {
  const val = getCellValue(cell);
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function isChapterRow(row, colMap) {
  const desig = String(getCellValue(safeGetCell(row, colMap.designation))).trim();
  if (!desig) return false;

  if (SKIP_ROW_PATTERN.test(desig)) return false;

  const ref   = String(getCellValue(safeGetCell(row, colMap.ref))).trim();
  const unit  = String(getCellValue(safeGetCell(row, colMap.unit))).trim();
  const qty   = getCellNumber(safeGetCell(row, colMap.qty));
  const price = getCellNumber(safeGetCell(row, colMap.price));

  const hasNoData = !unit && qty === 0 && price === 0;
  if (!hasNoData) return false;

  // Pas de ref + pas de données = chapitre
  if (!ref) return true;

  // Tout en majuscules (heuristique supplémentaire)
  if (desig === desig.toUpperCase() && desig.length > 3) return true;

  return false;
}

/**
 * Détermine le niveau d'un chapitre/sous-chapitre via sa numérotation.
 * @returns {0 | 1} 0 = chapitre, 1 = sous-chapitre
 *
 * Heuristique :
 * - Ref avec ≥1 point ("1.1", "2.3.4") → sous-chapitre
 * - Ref simple ("1", "A", "I") OU pas de ref → chapitre
 * - Désignation en majuscules sans ref → chapitre
 * - Désignation casse mixte sans ref → sous-chapitre (si parent existe)
 */
function getChapterLevel(row, colMap, hasParentChapter) {
  const ref   = String(getCellValue(safeGetCell(row, colMap.ref))).trim();
  const desig = String(getCellValue(safeGetCell(row, colMap.designation))).trim();

  if (ref) {
    // "1.1", "2.3.1" → sous-chapitre (au moins un point entre chiffres)
    if (/\d+\.\d+/.test(ref)) return 1;
    return 0;
  }

  // Pas de ref : ALL CAPS = chapitre, mixed case = sous-chapitre (si parent existe)
  const isAllCaps = desig === desig.toUpperCase() && desig.length > 3;
  if (isAllCaps) return 0;
  return hasParentChapter ? 1 : 0;
}

// ─── PARSER PRINCIPAL ────────────────────────────────────────────────────────

export async function parseDqeExcel(file) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const results = { chapters: [], warnings: [], stats: { totalItems: 0, totalChapters: 0, sheets: 0 } };

  workbook.eachSheet((worksheet) => {
    const headerRowNum = detectHeaderRow(worksheet);
    if (!headerRowNum) return;

    const colMap = mapColumns(worksheet, headerRowNum);
    if (!colMap.designation) return;

    results.stats.sheets++;
    let currentChapter = null;
    let currentSubChapter = null;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNum) return;

      const desig = String(getCellValue(safeGetCell(row, colMap.designation))).trim();
      if (!desig) return;

      // Ignorer les lignes de sous-total / total
      if (SKIP_ROW_PATTERN.test(desig)) return;

      if (isChapterRow(row, colMap)) {
        const level = getChapterLevel(row, colMap, !!currentChapter);

        if (level === 0) {
          // Chapitre racine
          currentChapter = {
            id: generateId(),
            type: 'chapter',
            title: desig.toUpperCase(),
            isOption: false,
            children: [],
          };
          currentSubChapter = null;
          results.chapters.push(currentChapter);
          results.stats.totalChapters++;
        } else {
          // Sous-chapitre — créer un chapitre parent si nécessaire
          if (!currentChapter) {
            currentChapter = {
              id: generateId(),
              type: 'chapter',
              title: 'ARTICLES IMPORTÉS',
              isOption: false,
              children: [],
            };
            results.chapters.push(currentChapter);
            results.stats.totalChapters++;
          }
          currentSubChapter = {
            id: generateId(),
            type: 'chapter',
            title: desig,
            isOption: false,
            children: [],
          };
          currentChapter.children.push(currentSubChapter);
          results.stats.totalSubChapters = (results.stats.totalSubChapters || 0) + 1;
        }
        return;
      }

      if (!currentChapter) {
        currentChapter = {
          id: generateId(),
          type: 'chapter',
          title: 'ARTICLES IMPORTÉS',
          isOption: false,
          children: [],
        };
        results.chapters.push(currentChapter);
        results.stats.totalChapters++;
      }

      const ref   = colMap.ref   ? String(getCellValue(safeGetCell(row, colMap.ref))).trim() : '';
      const unit  = colMap.unit  ? String(getCellValue(safeGetCell(row, colMap.unit))).trim() : '';
      const qty   = colMap.qty   ? getCellNumber(safeGetCell(row, colMap.qty)) : 0;
      const price = colMap.price ? getCellNumber(safeGetCell(row, colMap.price)) : 0;

      const item = {
        type: 'item',
        id: `line_${generateId()}`,
        uid: '',
        designation: desig,
        unit,
        price,
        qty,
        formula: '',
        quantities: {},
        quantitiesFormula: {},
        bpuNum: ref,
        isFixed: false,
      };

      // Placer l'item dans le sous-chapitre actif (si présent), sinon dans le chapitre
      (currentSubChapter || currentChapter).children.push(item);

      results.stats.totalItems++;
    });
  });

  if (results.chapters.length === 0) {
    results.warnings.push('Aucun onglet avec un format DQE reconnu.');
  }

  return results;
}
