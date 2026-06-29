import { useState } from 'react';
import { toast } from '../../../utils/globalUI';
import { saveAs } from 'file-saver';
import { estimaWordCreditParagraph, isEstimaCreditEnabled } from '../../../utils/estimaWordCredit';
import { cleanText, normalizeUnitSymbol } from '../../../utils/helpers';
import { hexToDocxColor } from '../utils/bpuBrandingUtils';
import { getRawDescription, normalizeToHtml } from '../utils/bpuDescriptionUtils';
import { getCurrentPhase } from '../../../utils/phaseModel';

let Document, Packer, Paragraph, Table, TableCell, TableRow,
    WidthType, BorderStyle, TextRun, AlignmentType,
    Header, Footer, ImageRun, TableLayoutType,
    VerticalAlign, HeightRule, SimpleField;

const ensureDocx = async () => {
  if (Document) return;
  const docx = await import('docx');
  ({ Document, Packer, Paragraph, Table, TableCell, TableRow,
     WidthType, BorderStyle, TextRun, AlignmentType,
     Header, Footer, ImageRun, TableLayoutType,
     VerticalAlign, HeightRule, SimpleField } = docx);
};

const base64ToUint8Array = (dataUri) => {
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const resolveImageData = async (src) => {
  try {
    let buffer;
    if (src.startsWith('data:')) {
      buffer = base64ToUint8Array(src);
    } else {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      buffer = new Uint8Array(await resp.arrayBuffer());
    }
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    });
    if (!dims) return null;
    const MAX_W = 350, MAX_H = 250;
    let { w, h } = dims;
    if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
    if (h > MAX_H) { w = Math.round(w * MAX_H / h); h = MAX_H; }
    return { buffer, width: w, height: h };
  } catch {
    return null;
  }
};

/**
 * useBpuWordExport
 * Génère et télécharge le fichier Word (.docx) du BPU.
 *
 * @param {object} params
 * @param {object}   params.project        - données de l'affaire
 * @param {object}   params.branding       - objet branding résolu
 * @param {string|null} params.resolvedLogo - URL du logo actif
 * @param {Array}    params.sortedCatalog  - articles triés
 * @param {Function} params.unitResolver   - résolveur d'unités
 * @param {Array}    params.articlesDb     - base de données articles
 */
export const useBpuWordExport = ({
  project,
  branding,
  resolvedLogo,
  sortedCatalog,
  unitResolver,
  articlesDb,
}) => {
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const today = new Date().toLocaleDateString('fr-FR');

  // ── CONVERSION HTML → DOCX ───────────────────────────────────────────────────
  const processHtmlToDocx = async (htmlString) => {
    if (!htmlString) return [];
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    const paragraphs = [];
    const nodes = Array.from(tempDiv.childNodes);
    if (nodes.length === 0) return [];

    const imgElements = tempDiv.querySelectorAll('img');
    const imageMap = new Map();
    await Promise.all(
      Array.from(imgElements).map(async (img) => {
        const src = img.getAttribute('src');
        if (src && !imageMap.has(src)) {
          const data = await resolveImageData(src);
          if (data) imageMap.set(src, data);
        }
      })
    );

    const getRunsFromNode = (node, style = {}) => {
      if (node.nodeType === 3)
        return [new TextRun({ text: node.textContent, ...style, size: 20, font: branding.fonts.main, color: '475569' })];
      if (node.nodeType === 1) {
        if (node.tagName === 'IMG') {
          const src = node.getAttribute('src');
          const imgData = imageMap.get(src);
          if (imgData) return [new ImageRun({ data: imgData.buffer, transformation: { width: imgData.width, height: imgData.height } })];
          return [];
        }
        let newStyle = { ...style };
        if (node.tagName === 'STRONG' || node.tagName === 'B') { newStyle.bold = true; newStyle.color = '1E293B'; }
        if (node.tagName === 'EM'     || node.tagName === 'I') newStyle.italics = true;
        if (node.tagName === 'U') newStyle.underline = { type: 'single' };
        if (node.tagName === 'BR') return [new TextRun({ break: 1, font: branding.fonts.main })];
        const runs = [];
        node.childNodes.forEach((child) => runs.push(...getRunsFromNode(child, newStyle)));
        return runs;
      }
      return [];
    };

    nodes.forEach((node) => {
      if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        node.childNodes.forEach((li) => {
          if (li.nodeName === 'LI') {
            const runs = [];
            li.childNodes.forEach((child) => runs.push(...getRunsFromNode(child)));
            paragraphs.push(new Paragraph({ children: runs, bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 40 } }));
          }
        });
      } else if (node.nodeName === 'IMG') {
        const src = node.getAttribute('src');
        const imgData = imageMap.get(src);
        if (imgData) {
          paragraphs.push(new Paragraph({
            children: [new ImageRun({ data: imgData.buffer, transformation: { width: imgData.width, height: imgData.height } })],
            spacing: { after: 60 },
          }));
        }
      } else if (node.nodeName === 'P' || node.nodeName === 'DIV') {
        const runs = [];
        node.childNodes.forEach((child) => runs.push(...getRunsFromNode(child)));
        if (runs.length > 0) paragraphs.push(new Paragraph({ children: runs, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 } }));
      } else {
        const runs = getRunsFromNode(node);
        if (runs.length > 0) paragraphs.push(new Paragraph({ children: runs, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 } }));
      }
    });

    return paragraphs;
  };

  // ── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
  const handleDownloadWord = async () => {
    setIsGeneratingWord(true);
    try {
      await ensureDocx();
      const primaryColorDocx   = hexToDocxColor(branding.colors.primary);
      const secondaryColorDocx = hexToDocxColor(branding.colors.secondary);
      const headingFont = branding.fonts.headings;
      const mainFont    = branding.fonts.main;

      const logoBuffer = resolvedLogo
        ? await fetch(resolvedLogo).then((r) => r.blob()).then((b) => b.arrayBuffer()).catch(() => null)
        : null;

      // ── PAGE DE GARDE ──────────────────────────────────────────────────────
      const coverParagraphs = [
        new Paragraph({
          spacing: { before: 2000, after: 1000 },
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'BORDEREAU DES PRIX UNITAIRES', bold: true, size: 28, font: headingFont, color: hexToDocxColor(branding.colors.subtle) })],
        }),
        new Paragraph({
          spacing: { before: 1000, after: 400 },
          children: [new TextRun({ text: (project?.name || 'NOM DU PROJET').toUpperCase(), bold: true, size: 52, font: headingFont, color: primaryColorDocx })],
        }),
        new Paragraph({
          border: { bottom: { color: secondaryColorDocx, space: 1, style: BorderStyle.SINGLE, size: 24 } },
          spacing: { after: 2000 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "MAÎTRE D'OUVRAGE", bold: true, size: 20, font: headingFont, color: hexToDocxColor(branding.colors.subtle) })],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: (project?.client || 'NOM DU CLIENT').toUpperCase(), bold: true, size: 28, font: headingFont, color: hexToDocxColor(branding.colors.text) })],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: project?.clientAddress || 'Adresse du client', size: 22, font: mainFont, color: hexToDocxColor(branding.colors.subtle) })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `${project?.clientZip || ''} ${project?.clientCity || ''}`, size: 22, font: mainFont, color: hexToDocxColor(branding.colors.subtle) })],
          spacing: { after: 1000 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'LIEU DE RÉALISATION', bold: true, size: 20, font: headingFont, color: hexToDocxColor(branding.colors.subtle) })],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: (project?.location || 'VILLE, DÉPARTEMENT').toUpperCase(), bold: true, size: 28, font: headingFont, color: hexToDocxColor(branding.colors.text) })],
          spacing: { after: 2000 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'PHASE : ', bold: true, size: 22, font: headingFont, color: hexToDocxColor(branding.colors.subtle) }),
            new TextRun({ text: getCurrentPhase(project)?.code || 'DCE', bold: true, size: 24, font: headingFont, color: primaryColorDocx }),
          ],
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'CODE AFFAIRE : ', bold: true, size: 22, font: headingFont, color: hexToDocxColor(branding.colors.subtle) }),
            new TextRun({ text: project?.code || '2025-XXX', bold: true, size: 24, font: headingFont, color: hexToDocxColor(branding.colors.text) }),
          ],
        }),
      ];

      const coverSection = { properties: { type: 'nextPage' }, children: coverParagraphs };

      // ── LIGNES DU TABLEAU ─────────────────────────────────────────────────
      const tableRows = await Promise.all(sortedCatalog.map(async (item) => {
        const rawDesc      = getRawDescription(item, articlesDb);
        const htmlDesc     = normalizeToHtml(rawDesc);
        const descParagraphs = await processHtmlToDocx(htmlDesc);
        const unitLong     = unitResolver(item.unit);
        const displayNum   = item._displayNum || '';
        const prefix = ['A', 'E', 'I', 'O', 'U', 'Y'].includes(unitLong.charAt(0).toUpperCase()) ? "L'" : 'LE ';
        const unitFooterText = `${prefix}${unitLong.toUpperCase()}`;

        return new TableRow({
          cantSplit: false,
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: displayNum, bold: true, font: mainFont, size: 18, color: '475569' })], alignment: AlignmentType.CENTER })],
              width: { size: 10, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              shading: { fill: 'F1F5F9' },
              borders: { right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: cleanText(item.designation).toUpperCase(), bold: true, size: 20, font: mainFont, color: '0F172A' })], spacing: { after: 80 } }),
                ...descParagraphs,
                new Paragraph({
                  children: [
                    new TextRun({ text: '●  ', size: 14, font: mainFont, color: secondaryColorDocx }),
                    new TextRun({ text: unitFooterText, bold: true, size: 16, color: '334155', font: mainFont }),
                  ],
                  spacing: { before: 100 },
                  border: { top: { style: BorderStyle.DASH_SMALL_GAP, size: 4, color: 'CBD5E1' } },
                }),
              ],
              width: { size: 70, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 150, right: 150 },
              borders: { right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: normalizeUnitSymbol(item.unit) || '-', font: mainFont, size: 18, color: '475569', bold: true })], alignment: AlignmentType.CENTER })],
              width: { size: 10, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              shading: { fill: 'F8FAFC' },
              borders: { right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
            }),
            new TableCell({
              children: [new Paragraph({})],
              width: { size: 10, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
        });
      }));

      // ── EN-TÊTE DE COLONNE ────────────────────────────────────────────────
      const headerRow = new TableRow({
        tableHeader: true,
        height: { value: 600, rule: HeightRule.AT_LEAST },
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: primaryColorDocx }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'N° PRIX', bold: true, color: 'FFFFFF', font: mainFont, size: 18 })] })] }),
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, shading: { fill: primaryColorDocx }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DESIGNATION DES OUVRAGES', bold: true, color: 'FFFFFF', font: mainFont, size: 18 })] })] }),
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: primaryColorDocx }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'U', bold: true, color: 'FFFFFF', font: mainFont, size: 18 })] })] }),
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: primaryColorDocx }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'P.U. HT', bold: true, color: 'FFFFFF', font: mainFont, size: 18 })] })] }),
        ],
      });

      // ── EN-TÊTE DE PAGE (header Word) ─────────────────────────────────────
      const docHeader = new Header({
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 75, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: ' BORDEREAU DES PRIX UNITAIRES ', font: headingFont, color: primaryColorDocx, bold: true, size: 16 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: (project?.name || 'PROJET SANS NOM').toUpperCase(), font: headingFont, bold: true, size: 36, color: '0F172A' })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.TOP,
                    children: [
                      logoBuffer
                        ? new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: logoBuffer, transformation: { width: 120, height: 70 }, type: 'jpg' })] })
                        : new Paragraph({}),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideVertical: { style: BorderStyle.NONE } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'F1F5F9' }, verticalAlign: VerticalAlign.CENTER, width: { size: 33, type: WidthType.PERCENTAGE }, margins: { left: 150, top: 100, bottom: 100 }, children: [new Paragraph({ children: [new TextRun({ text: 'PHASE : ', font: mainFont, size: 16, color: '64748B', bold: true }), new TextRun({ text: getCurrentPhase(project)?.code || 'DCE', font: mainFont, size: 16, color: '0F172A', bold: true })] })] }),
                  new TableCell({ shading: { fill: 'F1F5F9' }, verticalAlign: VerticalAlign.CENTER, width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DATE : ', font: mainFont, size: 16, color: '64748B', bold: true }), new TextRun({ text: today, font: mainFont, size: 16, color: '0F172A', bold: true })] })] }),
                  new TableCell({ shading: { fill: 'F1F5F9' }, verticalAlign: VerticalAlign.CENTER, width: { size: 34, type: WidthType.PERCENTAGE }, margins: { right: 150 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'PAGE ', font: mainFont, size: 16, color: '64748B', bold: true }), new SimpleField('PAGE'), new TextRun({ text: ' / ', font: mainFont, size: 16, color: '64748B' }), new SimpleField('NUMPAGES')] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 400 } }),
        ],
      });

      // ── SECTION CONTENU ───────────────────────────────────────────────────
      const contentSection = {
        properties: { type: 'nextPage', page: { margin: { top: 700, right: 700, bottom: 700, left: 700 } } },
        headers: { default: docHeader },
        footers: { default: new Footer({ children: [] }) },
        children: [
          new Table({
            layout: TableLayoutType.FIXED,
            rows: [headerRow, ...tableRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
          }),
          new Paragraph({ text: '', spacing: { before: 400 } }),
          new Paragraph({ children: [new TextRun({ text: "Cachet et Signature de l'entreprise :", bold: true, font: mainFont })], spacing: { before: 800 } }),
          new Paragraph({ text: '\n\n\n\n', border: { top: { style: BorderStyle.DASHED, size: 4, color: '000000' }, bottom: { style: BorderStyle.DASHED, size: 4, color: '000000' }, left: { style: BorderStyle.DASHED, size: 4, color: '000000' }, right: { style: BorderStyle.DASHED, size: 4, color: '000000' } } }),
          ...(isEstimaCreditEnabled() ? [estimaWordCreditParagraph()] : []),
        ],
      };

      const doc = new Document({
        creator: 'EstimaVRD',
        features: { updateFields: true },
        sections: [coverSection, contentSection],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `BPU_${project?.name ? cleanText(project.name) : 'PROJET'}_${new Date().toISOString().split('T')[0]}.docx`);

    } catch (error) {
      console.error('Erreur Word:', error);
      toast.error('Impossible de générer le fichier Word : ' + error.message);
    } finally {
      setIsGeneratingWord(false);
    }
  };

  return { isGeneratingWord, handleDownloadWord };
};
