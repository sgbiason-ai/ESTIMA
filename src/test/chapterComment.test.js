// Commentaires de chapitre/sous-chapitre (Estimation) — tests de fumée.
// Vérifie que le champ `comment` survit à la normalisation, apparaît dans le
// PDF (ligne COMMENT sous le titre) et dans l'Excel (ligne fusionnée B→F).
import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';

let capturedBlob = null;
vi.mock('../utils/fileSaver', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    saveFileWithPicker: vi.fn(async (blob) => { capturedBlob = blob; }),
  };
});

import { normalizeProject } from '../utils/normalizeProject';
import { generateProfessionalPDF } from '../utils/pdfGenerator';
import { generateProfessionalExcel } from '../utils/excelGenerator';

const project = {
  id: 'p1', name: 'Projet Test Commentaires',
  chapters: [
    {
      id: 'c1', type: 'chapter', title: 'TERRASSEMENTS', isOption: false,
      comment: 'ZZCOMMENTRACINE hors emprise voirie',
      children: [
        { id: 'i1', type: 'item', designation: 'Déblais', unit: 'm3', qty: 10, price: 12 },
        {
          id: 'sc1', type: 'subChapter', title: 'FOUILLES', isOption: false,
          comment: 'ZZCOMMENTSOUSCHAP y compris blindage',
          children: [
            { id: 'i2', type: 'item', designation: 'Fouille en tranchée', unit: 'ml', qty: 5, price: 20 },
          ],
        },
      ],
    },
  ],
};

describe('commentaires de chapitre (fumée)', () => {
  it('normalizeProject conserve le champ comment (chapitre + sous-chapitre)', () => {
    const norm = normalizeProject(project);
    expect(norm.chapters[0].comment).toBe('ZZCOMMENTRACINE hors emprise voirie');
    const sub = norm.chapters[0].children.find(n => n.id === 'sc1');
    expect(sub.comment).toBe('ZZCOMMENTSOUSCHAP y compris blindage');
    // Sans commentaire : pas de champ parasite
    const bare = normalizeProject({ ...project, chapters: [{ id: 'c2', type: 'chapter', title: 'X', children: [] }] });
    expect('comment' in bare.chapters[0]).toBe(false);
  });

  it('le PDF contient les commentaires sous les titres de chapitre', async () => {
    const res = await generateProfessionalPDF(
      project,
      { global: { i1: 10, i2: 5 } },
      'ESTIMATION',
      {},
      { includeCover: false, previewOnly: true, selectedExports: ['global'] },
      null
    );
    expect(res.blob).toBeInstanceOf(Blob);
    expect(res.blob.size).toBeGreaterThan(800);
    // Flux jsPDF non compressés : le texte est lisible dans les octets du PDF.
    const raw = new TextDecoder('latin1').decode(await res.blob.arrayBuffer());
    expect(raw).toContain('ZZCOMMENTRACINE');
    expect(raw).toContain('ZZCOMMENTSOUSCHAP');
  });

  it("l'Excel contient une ligne commentaire fusionnée sous chaque titre", async () => {
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
    capturedBlob = null;
    await generateProfessionalExcel(
      project,
      { global: { i1: 10, i2: 5 } },
      'ESTIMATION',
      {},
      { selectedExports: ['global'] },
      null
    );
    expect(capturedBlob).toBeInstanceOf(Blob);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await capturedBlob.arrayBuffer());
    const texts = [];
    wb.eachSheet(ws => ws.eachRow(row => {
      const v = row.getCell(2).value;
      if (typeof v === 'string') texts.push(v);
    }));
    expect(texts.some(t => t.includes('ZZCOMMENTRACINE'))).toBe(true);
    expect(texts.some(t => t.includes('ZZCOMMENTSOUSCHAP'))).toBe(true);
  });
});
