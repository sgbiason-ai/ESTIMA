// src/utils/tp/tpBaremeTypeXlsx.js
// ESTIMA TP — import / export d'un barème PAR TYPE.
//   • Export par type   → 1 fichier .xlsx, 1 onglet (colonnes propres au poste).
//   • « Tout exporter »  → 1 fichier .xlsx, 1 onglet par poste.
//   • Import             → lit TOUS les onglets reconnus (1 ou plusieurs), fusion sans doublon.
// Pensé pour le round-trip : exporter → éditer dans Excel → réimporter (voir useTpResources.mergeResources).
//
// Détection du type à l'import : nom d'onglet (Matériel, Main d'œuvre, …), puis nom de
// fichier en secours, puis signature de colonnes pour le seul cas non ambigu (Transport).
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from '../fileSaver';
import { stampExcelCredit, ESTIMA_CREDIT } from '../estimaCredit';
import { POSTES, ressourceDailyCost } from './tpPriceCompute';

const EUR = '# ##0.00 "€"';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Nom d'onglet ↔ catégorie. Le nom d'onglet sert de marqueur de type au réimport.
const SHEET_BY_CAT = {
  materiel: 'Matériel',
  mo: "Main d'œuvre",
  fourniture: 'Fournitures',
  soustraitance: 'Sous-traitance',
  transport: 'Transport',
};

// Libellé ASCII propre pour le nom de fichier (sert aussi au secours de détection).
const FILE_LABEL_BY_CAT = {
  materiel: 'Materiel', mo: 'Main-doeuvre', fourniture: 'Fournitures',
  soustraitance: 'Sous-traitance', transport: 'Transport',
};

// Schéma de colonnes par catégorie. `key` = champ ressource lu/écrit ;
// `calc` = colonne calculée (écrite à l'export, IGNORÉE à l'import) ; `num`/`upper` = format.
const SCHEMAS = {
  materiel: [
    { header: 'Désignation', key: 'designation' },
    { header: 'Unité', key: 'unit', upper: true },
    { header: 'Personnel', key: 'puJour', num: true },
    { header: 'Amortissement', key: 'amort', num: true },
    { header: 'Entretien', key: 'entret', num: true },
    { header: 'Consommable', key: 'cons', num: true },
    { header: 'Location', key: 'loc', num: true },
    { header: 'PU/jour (calculé)', calc: (r) => ressourceDailyCost(r), num: true },
  ],
  fourniture: [
    { header: 'Désignation', key: 'designation' },
    { header: 'Unité', key: 'unit', upper: true },
    { header: 'PU barème', key: 'puBareme', num: true },
  ],
  transport: [
    { header: 'Désignation', key: 'designation' },
    { header: 'Unité', key: 'unit', upper: true },
    { header: 'Contenance / voyage', key: 'contenance', num: true },
    { header: 'Coût journalier', key: 'coutJour', num: true },
  ],
};
SCHEMAS.mo = SCHEMAS.materiel;            // mêmes colonnes que Matériel
SCHEMAS.soustraitance = SCHEMAS.fourniture; // mêmes colonnes que Fournitures

const removeAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const sanitize = (s) => String(s || '').replace(/[^a-z0-9_-]/gi, '_');
const CAT_BY_SHEET = Object.fromEntries(
  Object.entries(SHEET_BY_CAT).map(([cat, label]) => [removeAccents(label), cat])
);

// Ressource « vierge » (tous les champs à 0) — découplé du hook pour éviter une dépendance circulaire.
const blankResource = (category) => ({
  category, designation: '', unit: '',
  puJour: 0, amort: 0, entret: 0, cons: 0, loc: 0, puBareme: 0, contenance: 0, coutJour: 0,
});

function getCellValue(cell) {
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('result' in val) return val.result;
    if ('text' in val) return val.text;
    if ('richText' in val) return val.richText?.map(r => r.text).join('') ?? '';
  }
  return val;
}
const getNum = (cell) => { const n = Number(getCellValue(cell)); return Number.isFinite(n) ? n : 0; };

export const isValidCategory = (cat) => Boolean(SCHEMAS[cat]);

// ─── EXPORT ─────────────────────────────────────────────────────────────────
// Ajoute au classeur un onglet pour `category` (en-tête stylé + lignes). Retourne le nb de lignes.
function addCategorySheet(wb, category, resources) {
  const schema = SCHEMAS[category];
  if (!schema) throw new Error(`Catégorie inconnue : ${category}`);

  const list = (resources || [])
    .filter(r => r.category === category)
    .sort((a, b) => (a.designation || '').localeCompare(b.designation || '', 'fr'));

  const ws = wb.addWorksheet(SHEET_BY_CAT[category], { views: [{ state: 'frozen', ySplit: 1 }] });

  const head = ws.addRow(schema.map(c => c.header));
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } }; // orange-600
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  list.forEach(r => {
    const row = ws.addRow(schema.map(c => {
      if (c.calc) return c.calc(r);
      if (c.num) return Number(r[c.key] || 0);
      return r[c.key] ?? '';
    }));
    schema.forEach((c, i) => { if (c.num) row.getCell(i + 1).numFmt = EUR; });
  });

  ws.columns.forEach((c, i) => { c.width = i === 0 ? 44 : 16; });
  return list.length;
}

/** Construit le Blob .xlsx d'UN type (sans le sauvegarder). Testable hors navigateur. */
export async function buildBaremeTypeBlob(category, resources) {
  if (!SCHEMAS[category]) throw new Error(`Catégorie inconnue : ${category}`);
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ESTIMA TP';
  const count = addCategorySheet(wb, category, resources);
  stampExcelCredit(wb);
  const buffer = await wb.xlsx.writeBuffer();
  return { blob: new Blob([buffer], { type: XLSX_MIME }), count };
}

/** Construit le Blob .xlsx de TOUS les types (un onglet par poste). Testable hors navigateur. */
export async function buildBaremeAllBlob(resources) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ESTIMA TP';
  let count = 0;
  POSTES.forEach(cat => { count += addCategorySheet(wb, cat, resources); });
  stampExcelCredit(wb);
  const buffer = await wb.xlsx.writeBuffer();
  return { blob: new Blob([buffer], { type: XLSX_MIME }), count };
}

/** Génère et télécharge un .xlsx pour UN type. Retourne le nombre de lignes exportées. */
export async function exportBaremeType(category, resources, { companyName } = {}) {
  const { blob, count } = await buildBaremeTypeBlob(category, resources);
  const cn = companyName ? `_${sanitize(companyName)}` : '';
  const name = `Bareme_${FILE_LABEL_BY_CAT[category]}${cn}.xlsx`;
  await saveFileWithPicker(blob, name, FILE_TYPES.excel, PICKER_IDS.exportExcel);
  return count;
}

/** Génère et télécharge un .xlsx complet (tous les postes). Retourne le nombre total de lignes. */
export async function exportBaremeAll(resources, { companyName } = {}) {
  const { blob, count } = await buildBaremeAllBlob(resources);
  const cn = companyName ? `_${sanitize(companyName)}` : '';
  const name = `Bareme_complet${cn}.xlsx`;
  await saveFileWithPicker(blob, name, FILE_TYPES.excel, PICKER_IDS.exportExcel);
  return count;
}

// ─── IMPORT ─────────────────────────────────────────────────────────────────
function detectCategory(ws, fileName) {
  // 1) Nom d'onglet (cas normal d'un fichier exporté par l'app)
  const bySheet = CAT_BY_SHEET[removeAccents(ws.name)];
  if (bySheet) return bySheet;
  // 2) Nom de fichier (ex. « Bareme_Materiel.xlsx »)
  const fn = removeAccents(fileName || '');
  for (const [cat, label] of Object.entries(SHEET_BY_CAT)) {
    if (fn.includes(removeAccents(label)) || fn.includes(removeAccents(FILE_LABEL_BY_CAT[cat])) || fn.includes(cat)) return cat;
  }
  // 3) Signature de colonnes — seul Transport est non ambigu (Matériel↔MO et Fournit.↔S-trait. partagent leurs colonnes)
  const headers = [];
  ws.getRow(1).eachCell(c => headers.push(removeAccents(getCellValue(c))));
  if (headers.some(h => h.includes('contenance') || h.includes('cout journalier'))) return 'transport';
  return null;
}

// Lit les lignes d'un onglet selon le schéma de sa catégorie.
function parseSheet(ws, category) {
  const schema = SCHEMAS[category];
  const out = [];
  ws.eachRow((row, rn) => {
    if (rn === 1) return; // en-tête
    const designation = String(getCellValue(row.getCell(1))).trim(); // colonne 1 = Désignation
    if (!designation || designation === ESTIMA_CREDIT) return;
    const r = blankResource(category);
    schema.forEach((c, i) => {
      if (c.calc || !c.key) return;          // colonne calculée → ignorée
      const cell = row.getCell(i + 1);
      if (c.num) r[c.key] = getNum(cell);
      else {
        let v = String(getCellValue(cell)).trim();
        if (c.upper) v = v.toUpperCase();
        r[c.key] = v;
      }
    });
    out.push(r);
  });
  return out;
}

/**
 * Lit un fichier .xlsx « barème » : parcourt TOUS les onglets reconnus (1 type ou complet).
 * @returns {{ resources: object[], categories: string[], error?: string }}
 */
export async function parseBaremeTypeXlsx(file) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  if (!wb.worksheets.length) return { resources: [], categories: [], error: 'Fichier vide ou illisible.' };

  const resources = [];
  const categories = [];
  wb.worksheets.forEach(ws => {
    const category = detectCategory(ws, file.name);
    if (!category) return;
    if (!categories.includes(category)) categories.push(category);
    resources.push(...parseSheet(ws, category));
  });

  if (!categories.length) {
    return {
      resources: [], categories: [],
      error: "Type non reconnu. Conservez le nom d'onglet d'origine (Matériel, Main d'œuvre, Fournitures, Sous-traitance, Transport) ou exportez d'abord un modèle.",
    };
  }
  return { resources, categories };
}
