// Tests pour src/utils/excelLibraryHelper.js — reconstitution du texte riche a l'import
//
// Regression : les runs richText stylises (gras / italique / souligne) declenchaient
// un ReferenceError (variable `escapPart` inexistante) lors de l'import d'une
// bibliotheque Excel exportee avec des descriptions Quill.
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseLibraryExcel } from '../utils/excelLibraryHelper';

const HEADERS = [
  'Code', 'Désignation', 'Unité', 'Prix Catalogue (€)', 'Dossier / Catégorie',
  'Description (Stylisée)', 'Référence CCTP', 'Label CCTP', 'Prix Observé (€)'
];

/** Construit un classeur en memoire et le passe a parseLibraryExcel */
async function parseRows(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Bibliothèque');
  ws.addRow(HEADERS);
  rows.forEach((cells) => ws.addRow(cells));

  const buffer = await wb.xlsx.writeBuffer();
  // parseLibraryExcel n'utilise que file.arrayBuffer()
  return parseLibraryExcel({ arrayBuffer: async () => buffer });
}

const richDesc = (runs) => ({ richText: runs });

describe('parseLibraryExcel — texte riche', () => {
  it('reconstitue les runs stylises sans planter (regression escapPart)', async () => {
    const { bpu } = await parseRows([
      ['P.01', 'Béton de propreté', 'm3', 120, '', richDesc([
        { font: { bold: true }, text: 'Gras' },
        { font: {}, text: ' normal ' },
        { font: { italic: true }, text: 'Italique' },
        { font: { underline: true }, text: ' Souligné' }
      ]), '', '', '']
    ]);

    expect(bpu).toHaveLength(1);
    expect(bpu[0].description).toBe(
      '<p><strong>Gras</strong> normal <em>Italique</em><u> Souligné</u></p>'
    );
  });

  it('imbrique les styles cumules sur un meme run', async () => {
    const { bpu } = await parseRows([
      ['P.02', 'Enrobé', 't', 90, '', richDesc([
        { font: { bold: true, italic: true, underline: true }, text: 'Tout' }
      ]), '', '', '']
    ]);

    expect(bpu[0].description).toBe('<p><u><em><strong>Tout</strong></em></u></p>');
  });

  it('echappe le HTML present dans le texte source', async () => {
    const { bpu } = await parseRows([
      ['P.03', 'Bordure', 'ml', 45, '', richDesc([
        { font: { bold: true }, text: 'a < b & c > d' }
      ]), '', '', '']
    ]);

    expect(bpu[0].description).toBe('<p><strong>a &lt; b &amp; c &gt; d</strong></p>');
  });

  it('decoupe les sauts de ligne en paragraphes', async () => {
    const { bpu } = await parseRows([
      ['P.04', 'Grave', 'm3', 30, '', richDesc([
        { font: { bold: true }, text: 'Ligne 1\nLigne 2' }
      ]), '', '', '']
    ]);

    expect(bpu[0].description).toBe('<p><strong>Ligne 1</strong></p><p><strong>Ligne 2</strong></p>');
  });

  it('gere le texte brut sans richText', async () => {
    const { bpu } = await parseRows([
      ['P.05', 'Fouille', 'm3', 15, '', 'Description simple', '', '', '']
    ]);

    expect(bpu[0].description).toBe('<p>Description simple</p>');
  });

  it('renvoie null si la description est vide', async () => {
    const { bpu } = await parseRows([
      ['P.06', 'Remblai', 'm3', 12, '', '', '', '', '']
    ]);

    expect(bpu[0].description).toBeNull();
  });
});
