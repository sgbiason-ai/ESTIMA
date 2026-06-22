// src/utils/tp/tpBaremeImport.js
// ESTIMA TP — import d'un barème Excel dans la bibliothèque de ressources.
// Colonnes attendues : Type | CODE | Libellé | U | A | E | I | Personnel | Location
//                      | Total | Fourniture | Sous traitance | Qté transportée
// Mapping Type → catégorie : FOU→fourniture, ST→soustraitance, MA/LOC→matériel, MO→mo.
// (Le CODE n'est pas importé : bibliothèque « sans code ».)

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

const baseResource = (designation, unit) => ({
  designation, unit: unit || 'U',
  puJour: 0, amort: 0, entret: 0, cons: 0, loc: 0, epaisseur: 0, densite: 0, puBareme: 0,
});

export async function parseBaremeExcel(file) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet('Bareme') || wb.worksheets[0];
  if (!ws) return { resources: [], counts: {}, skipped: 0 };

  const resources = [];
  const counts = {};
  let skipped = 0;

  ws.eachRow((row, rn) => {
    if (rn === 1) return; // en-tête
    const type = String(getCellValue(row.getCell(1))).trim().toUpperCase();
    const designation = String(getCellValue(row.getCell(3))).trim();
    if (!type || !designation) return;
    const unit = String(getCellValue(row.getCell(4))).trim();
    const base = baseResource(designation, unit);

    let r;
    switch (type) {
      case 'FOU':
        r = { ...base, category: 'fourniture', puBareme: getNum(row.getCell(11)) }; break;
      case 'ST':
        r = { ...base, category: 'soustraitance', puBareme: getNum(row.getCell(12)) }; break;
      case 'MA':
      case 'LOC':
        r = { ...base, category: 'materiel', amort: getNum(row.getCell(5)), entret: getNum(row.getCell(6)), cons: getNum(row.getCell(7)), puJour: getNum(row.getCell(8)), loc: getNum(row.getCell(9)) }; break;
      case 'MO':
        r = { ...base, category: 'mo', amort: getNum(row.getCell(5)), entret: getNum(row.getCell(6)), cons: getNum(row.getCell(7)), puJour: getNum(row.getCell(8)), loc: getNum(row.getCell(9)) }; break;
      default:
        skipped++; return;
    }
    resources.push(r);
    counts[type] = (counts[type] || 0) + 1;
  });

  return { resources, counts, skipped };
}
