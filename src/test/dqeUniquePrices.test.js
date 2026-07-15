// Export Excel DQE — option « prix uniques par numéro ».
// La 1re occurrence d'un numéro de prix est la seule cellule P.U. saisissable ;
// toute répétition (autre chapitre, autre tranche) la recopie par formule, si bien
// que l'entreprise ne peut pas saisir deux prix différents pour un même numéro.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';

let capturedBlob = null;
vi.mock('../utils/fileSaver', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    saveFileWithPicker: vi.fn(async (blob) => { capturedBlob = blob; }),
  };
});

import { generateProfessionalExcel } from '../utils/excelGenerator';

// Même désignation dans 2 chapitres → même numéro (P.01) répété sur chaque feuille.
const project = {
  id: 'p1', name: 'Projet Prix Uniques',
  chapters: [
    {
      id: 'c1', type: 'chapter', title: 'TERRASSEMENTS', isOption: false,
      children: [
        { id: 'i1', type: 'item', designation: 'Déblais', unit: 'm3', qty: 10, price: 12 },
        { id: 'i2', type: 'item', designation: 'Remblais', unit: 'm3', qty: 5, price: 20 },
      ],
    },
    {
      id: 'c2', type: 'chapter', title: 'VOIRIE', isOption: false,
      children: [
        { id: 'i3', type: 'item', designation: 'Déblais', unit: 'm3', qty: 7, price: 12 },
      ],
    },
  ],
};

const tranches = [
  { id: 't1', name: 'TRANCHE FERME' },
  { id: 't2', name: 'TRANCHE OPTIONNELLE 1' },
];
const qtyMaps = {
  t1: { i1: 10, i2: 5, i3: 7 },
  t2: { i1: 3, i2: 2, i3: 4 },
};

// Lignes d'article portant ce numéro (colonne A), repérées par leur unité en colonne C.
const findItemRows = (ws, ref) => {
  const rows = [];
  ws.eachRow((row, n) => {
    if (row.getCell(1).value === ref && row.getCell(3).value) rows.push(n);
  });
  return rows;
};

const cellFormula = (cell) => cell.formula || (cell.value && typeof cell.value === 'object' ? cell.value.formula : undefined);

const exportDqe = async ({ _qtyOverride, ...options } = {}) => {
  capturedBlob = null;
  await generateProfessionalExcel(
    project, _qtyOverride || qtyMaps, 'DQE', {},
    { selectedExports: ['t1', 't2'], tranches, ...options },
    null
  );
  expect(capturedBlob).toBeInstanceOf(Blob);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await capturedBlob.arrayBuffer());
  return wb;
};

describe('DQE Excel — prix uniques par numéro', () => {
  beforeEach(() => {
    // Env node : stub minimal de document pour cleanText (strip HTML via DOM en navigateur).
    globalThis.document = {
      createElement: () => {
        let html = '';
        return {
          set innerHTML(v) { html = v; },
          get textContent() { return html.replace(/<[^>]*>/g, ''); },
          innerText: '',
        };
      },
    };
  });

  it('lie les répétitions au prix maître, dans la feuille et entre tranches', async () => {
    const wb = await exportDqe({ uniquePrices: true, lockPrices: true });
    const ws1 = wb.getWorksheet('TRANCHE FERME');
    const ws2 = wb.getWorksheet('TRANCHE OPTIONNELLE 1');

    // Feuille 1 : P.01 apparaît 2 fois (Déblais dans 2 chapitres).
    const p01Rows = findItemRows(ws1, 'P.01');
    expect(p01Rows).toHaveLength(2);
    const [masterRow, dupRow] = p01Rows;

    // Maître : cellule vide saisissable (pas de formule, déverrouillée).
    const masterCell = ws1.getRow(masterRow).getCell(5);
    expect(cellFormula(masterCell)).toBeFalsy();
    expect(masterCell.protection?.locked).toBe(false);

    // Doublon même feuille : formule qui recopie le maître, verrouillé.
    const dupCell = ws1.getRow(dupRow).getCell(5);
    expect(cellFormula(dupCell)).toBe(`IF(E${masterRow}="","",E${masterRow})`);
    expect(dupCell.protection?.locked).not.toBe(false);

    // Feuille 2 : toutes les occurrences recopient le maître de la feuille 1.
    for (const ref of ['P.01', 'P.02']) {
      for (const rowNum of findItemRows(ws2, ref)) {
        const f = cellFormula(ws2.getRow(rowNum).getCell(5));
        expect(f).toContain("'TRANCHE FERME'!E");
      }
    }

    // Le total de la ligne liée reste une formule D×E classique (inchangé).
    const dupTotal = cellFormula(ws1.getRow(dupRow).getCell(6));
    expect(dupTotal).toBe(`IF(E${dupRow}="","",ROUND(D${dupRow}*E${dupRow},2))`);
  });

  it("sans l'option, chaque occurrence reste saisissable indépendamment", async () => {
    const wb = await exportDqe({ uniquePrices: false });
    const ws1 = wb.getWorksheet('TRANCHE FERME');
    const ws2 = wb.getWorksheet('TRANCHE OPTIONNELLE 1');
    for (const ws of [ws1, ws2]) {
      for (const rowNum of findItemRows(ws, 'P.01')) {
        expect(cellFormula(ws.getRow(rowNum).getCell(5))).toBeFalsy();
      }
    }
  });

  it('ne lie PAS deux articles différents partageant le même numéro (collision)', async () => {
    // Même désignation, unités différentes → même réf export (P.01) mais articles
    // distincts : la liaison serait un bordereau faux. Chaque ligne doit rester saisissable.
    const collisionProject = {
      id: 'p2', name: 'Projet Collision',
      chapters: [{
        id: 'c1', type: 'chapter', title: 'MATERIAUX', isOption: false,
        children: [
          { id: 'a1', type: 'item', designation: 'GNT 0/31.5', unit: 'm3', qty: 10, price: 25 },
          { id: 'a2', type: 'item', designation: 'GNT 0/31.5', unit: 'T', qty: 8, price: 12 },
        ],
      }],
    };
    capturedBlob = null;
    await generateProfessionalExcel(
      collisionProject, { t1: { a1: 10, a2: 8 } }, 'DQE', {},
      { selectedExports: ['t1'], tranches, uniquePrices: true, lockPrices: true },
      null
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await capturedBlob.arrayBuffer());
    const ws1 = wb.getWorksheet('TRANCHE FERME');
    const rows = findItemRows(ws1, 'P.01');
    expect(rows).toHaveLength(2);
    for (const rowNum of rows) {
      const cell = ws1.getRow(rowNum).getCell(5);
      expect(cellFormula(cell)).toBeFalsy();
      expect(cell.protection?.locked).toBe(false); // les 2 restent saisissables
    }
  });

  it('promeut le maître sur la ligne à quantité réelle quand la 1re occurrence est PM', async () => {
    // Article absent de la tranche 1 (qty 0 → PM) mais réel en tranche 2 : la saisie
    // doit se faire sur la vraie ligne, la ligne PM devenant une reprise en chaîne.
    const wb = await exportDqe({
      uniquePrices: true, lockPrices: true, includePM: true,
      _qtyOverride: { t1: { i1: 0, i2: 5, i3: 0 }, t2: { i1: 100, i2: 2, i3: 100 } },
    });
    const ws1 = wb.getWorksheet('TRANCHE FERME');
    const ws2 = wb.getWorksheet('TRANCHE OPTIONNELLE 1');
    const [pmRow] = findItemRows(ws1, 'P.01');           // i1 en PM sur t1
    const [realRow] = findItemRows(ws2, 'P.01');         // i1 réel sur t2 → maître promu
    const realCell = ws2.getRow(realRow).getCell(5);
    expect(cellFormula(realCell)).toBeFalsy();
    expect(realCell.protection?.locked).toBe(false);
    const pmCell = ws1.getRow(pmRow).getCell(5);
    expect(cellFormula(pmCell)).toContain("'TRANCHE OPTIONNELLE 1'!E");
    expect(pmCell.protection?.locked).not.toBe(false);
  });

  it("promeut une ligne de base face à un maître pris dans une PSE (includePM off)", async () => {
    // Base PM en tranche 1 (exclue par includePM=false) + même article dans une PSE de
    // la tranche 1 : sans promotion, le prix de la BASE (tranche 2) se saisirait dans
    // le bloc d'option. La base réelle doit reprendre la main.
    const pseProject = {
      id: 'p3', name: 'Projet PSE',
      chapters: [
        {
          id: 'c1', type: 'chapter', title: 'TERRASSEMENTS', isOption: false,
          children: [{ id: 'b1', type: 'item', designation: 'Déblais', unit: 'm3', qty: 50, price: 12 }],
        },
        {
          id: 'opt1', type: 'chapter', title: 'VARIANTE', isOption: true,
          children: [{ id: 'o1', type: 'item', designation: 'Déblais', unit: 'm3', qty: 5, price: 12 }],
        },
      ],
    };
    capturedBlob = null;
    await generateProfessionalExcel(
      pseProject, { t1: { b1: 0, o1: 5 }, t2: { b1: 50, o1: 0 } }, 'DQE', {},
      { selectedExports: ['t1', 't2'], tranches, uniquePrices: true, lockPrices: true, includePM: false },
      null
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await capturedBlob.arrayBuffer());
    const ws1 = wb.getWorksheet('TRANCHE FERME');
    const ws2 = wb.getWorksheet('TRANCHE OPTIONNELLE 1');
    const [pseRow] = findItemRows(ws1, 'P.01');          // occurrence PSE (t1)
    const [baseRow] = findItemRows(ws2, 'P.01');         // base réelle (t2) → maître promu
    const baseCell = ws2.getRow(baseRow).getCell(5);
    expect(cellFormula(baseCell)).toBeFalsy();
    expect(baseCell.protection?.locked).toBe(false);
    const pseCell = ws1.getRow(pseRow).getCell(5);
    expect(cellFormula(pseCell)).toContain("'TRANCHE OPTIONNELLE 1'!E");
    expect(pseCell.protection?.locked).not.toBe(false);
  });

  it("en ESTIMATION, l'option est sans effet (prix en valeurs)", async () => {
    capturedBlob = null;
    await generateProfessionalExcel(
      project, qtyMaps, 'ESTIMATION', {},
      { selectedExports: ['t1'], tranches, uniquePrices: true },
      null
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await capturedBlob.arrayBuffer());
    const ws1 = wb.getWorksheet('TRANCHE FERME');
    for (const rowNum of findItemRows(ws1, 'P.01')) {
      const cell = ws1.getRow(rowNum).getCell(5);
      expect(cellFormula(cell)).toBeFalsy();
      expect(cell.value).toBe(12);
    }
  });
});
