import { saveAs } from "file-saver";
import { DEFAULT_BRANDING } from "../data/branding";
import { buildCoverPageElements } from "./wordCoverPage";
import { appendEstimaWordCredit } from "./estimaWordCredit";
import { renderForExport } from "./docContent";

let Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Header, Footer, PageNumber, TableOfContents, PageBreak, ImageRun,
    Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
    TableLayoutType, ShadingType, Tab;

const ensureDocx = async () => {
  if (Document) return;
  const docx = await import("docx");
  ({ Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
     Header, Footer, PageNumber, TableOfContents, PageBreak, ImageRun,
     Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
     TableLayoutType, ShadingType, Tab } = docx);
};

// Largeur utile A4 en DXA (twips) : 11906 - marges gauche/droite 1134 chacune.
const TABLE_WIDTH_DXA = 9638;

// Calcule des largeurs de colonnes en DXA, proportionnelles au contenu le plus
// long de chaque colonne (avec plancher), pour éviter l'auto-layout Word qui
// écrase les colonnes. La somme vaut exactement TABLE_WIDTH_DXA.
const computeColumnWidths = (rows, maxCols) => {
  const colChars = new Array(maxCols).fill(0);
  rows.forEach((tr) => {
    Array.from(tr.querySelectorAll("td, th")).forEach((cell, i) => {
      if (i < maxCols) {
        const len = (cell.textContent || "").trim().length;
        if (len > colChars[i]) colChars[i] = len;
      }
    });
  });
  const weights = colChars.map((c) => Math.max(c, 3));
  const total = weights.reduce((a, b) => a + b, 0) || maxCols;
  const MIN = Math.floor(TABLE_WIDTH_DXA * 0.12);
  let widths = weights.map((w) => Math.max(MIN, Math.round((TABLE_WIDTH_DXA * w) / total)));
  // Renormalise pour que la somme = TABLE_WIDTH_DXA
  const sum = widths.reduce((a, b) => a + b, 0);
  widths = widths.map((w) => Math.round((w * TABLE_WIDTH_DXA) / sum));
  widths[widths.length - 1] += TABLE_WIDTH_DXA - widths.reduce((a, b) => a + b, 0);
  return widths;
};

// --- UTILITAIRES ---
const cleanColor = (hex) => hex ? hex.replace(/^#/, "").toUpperCase() : "000000";

const sanitizeText = (str) => {
  if (str === null || str === undefined) return "";
  // eslint-disable-next-line no-control-regex -- strip caracteres de controle invalides en XML
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/\u200B/g, ""); 
};

const base64DataURLToUint8Array = (dataURL) => {
  const base64Regex = /^data:image\/(png|jpg|jpeg);base64,/i;
  if (!base64Regex.test(dataURL)) return null;
  const base64 = dataURL.replace(base64Regex, "");
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const detectImageType = (bytes) => {
  if (!bytes || bytes.length < 8) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
};

// Détecte une surbrillance (background) dans un attribut style inline.
const HIGHLIGHT_RE = /background(-color)?\s*:/i;

// Parcourt récursivement un nœud DOM et produit des TextRun en conservant
// le formatage inline (gras, italique, souligné, surbrillance).
const inlineRuns = (node, baseFmt = {}) => {
  const runs = [];
  const walk = (n, f) => {
    (n.childNodes ? Array.from(n.childNodes) : []).forEach((child) => {
      if (child.nodeType === 3) {
        const t = sanitizeText(child.textContent).replace(/\s+/g, " ");
        if (t && t !== " ") {
          runs.push(new TextRun({
            text: t,
            bold: f.bold || undefined,
            italics: f.italics || undefined,
            underline: f.underline ? { type: "single" } : undefined,
            highlight: f.highlight || undefined,
            color: f.color || undefined,
            size: f.size,
          }));
        }
      } else if (child.nodeType === 1) {
        const tag = child.nodeName;
        if (tag === "BR") { runs.push(new TextRun({ text: "", break: 1, size: f.size })); return; }
        const nf = { ...f };
        if (tag === "STRONG" || tag === "B") nf.bold = true;
        if (tag === "EM" || tag === "I") nf.italics = true;
        if (tag === "U") nf.underline = true;
        const style = child.getAttribute ? child.getAttribute("style") : null;
        if (style && HIGHLIGHT_RE.test(style)) nf.highlight = "yellow";
        walk(child, nf);
      }
    });
  };
  walk(node, baseFmt);
  return runs;
};

const getCellParagraphs = (htmlContent, isHeader, color) => {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = String(htmlContent || "");
  const size = isHeader ? 22 : 20;
  const fmt = { bold: isHeader, size, color: isHeader ? color : undefined };
  const align = isHeader ? AlignmentType.CENTER : AlignmentType.LEFT;

  const makePara = (runs) => new Paragraph({
    children: runs.length ? runs : [new TextRun({ text: " ", size, color: fmt.color })],
    alignment: align,
    spacing: { after: 0 },
  });

  // Un paragraphe Word par bloc de niveau "paragraphe", sinon contenu inline direct.
  const blocks = Array.from(tempDiv.children).filter((el) => /^(P|DIV|LI)$/.test(el.nodeName));
  if (blocks.length > 0) {
    return blocks.map((b) => makePara(inlineRuns(b, fmt)));
  }
  return [makePara(inlineRuns(tempDiv, fmt))];
};

// --- PARSING HTML VERS DOCX ---
const parseHtmlToDocx = (htmlContent, branding = DEFAULT_BRANDING) => {
  if (!htmlContent) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
  const nodes = Array.from(doc.body.firstChild.childNodes);
  const docxElements = [];

  nodes.forEach((node) => {
    const nodeName = node.nodeName;

    if (["P", "DIV", "#text", "H4", "H5", "H6"].includes(nodeName)) {
      const text = node.textContent?.trim();
      const img = node.querySelector ? node.querySelector("img") : null;

      if (img) {
        const src = img.getAttribute("src");
        if (src && src.startsWith("data:image") && !(/^data:image\/svg/i.test(src))) {
            const bytes = base64DataURLToUint8Array(src);
            const type = detectImageType(bytes);
            if (bytes && type) {
              docxElements.push(new Paragraph({ children: [new ImageRun({ data: bytes, type, transformation: { width: 400, height: 300 } })], spacing: { after: 200 } }));
            }
        }
      } else if (text) {
        // Conserve le formatage inline (gras, italique, souligné, surbrillance).
        const runs = nodeName === "#text"
          ? [new TextRun({ text: sanitizeText(text) })]
          : inlineRuns(node);
        docxElements.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text: sanitizeText(text) })], style: "Normal", spacing: { after: 120 } }));
      }
    }
    else if (nodeName === "UL" || nodeName === "OL") {
      Array.from(node.querySelectorAll("li")).forEach((li) => {
        const runs = inlineRuns(li);
        docxElements.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text: sanitizeText(li.textContent) })], bullet: { level: 0 }, style: "Normal", spacing: { after: 60 } }));
      });
    }
    else if (nodeName === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr")).filter(tr => tr.querySelectorAll("td, th").length > 0);
      let maxCols = 0;
      rows.forEach((r) => (maxCols = Math.max(maxCols, r.querySelectorAll("td, th").length)));
      maxCols = maxCols || 1;
      const columnWidths = computeColumnWidths(rows, maxCols);
      const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
      const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
      const headerFill = cleanColor(branding?.colors?.primary || "1E3A5F"); // en-tête couleur charte
      const zebraFill = "F4F6F8"; // ligne paire : fond très léger

      let bodyRowIdx = -1;
      const docxRows = rows.map((tr) => {
        const cells = Array.from(tr.querySelectorAll("td, th"));
        const isHeaderRow = cells.length > 0 && cells.every((c) => c.nodeName === "TH");
        if (!isHeaderRow) bodyRowIdx++;
        const zebra = !isHeaderRow && bodyRowIdx % 2 === 1;
        return new TableRow({
          tableHeader: isHeaderRow,
          children: cells.map((td, i) => {
            const isHeader = td.nodeName === "TH";
            const fill = isHeader ? headerFill : (zebra ? zebraFill : undefined);
            return new TableCell({
              children: getCellParagraphs(td.innerHTML, isHeader, "FFFFFF"),
              width: { size: columnWidths[Math.min(i, maxCols - 1)], type: WidthType.DXA },
              shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
              verticalAlign: isHeader ? VerticalAlign.CENTER : VerticalAlign.TOP,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              borders: cellBorders,
            });
          }),
        });
      });

      if (docxRows.length > 0) {
        docxElements.push(new Table({
          rows: docxRows,
          width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
          columnWidths,
          layout: TableLayoutType.FIXED,
          borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder, insideHorizontal: cellBorder, insideVertical: cellBorder },
        }));
        docxElements.push(new Paragraph({ children: [new TextRun(" ")], spacing: { after: 200 } }));
      }
    }
  });
  return docxElements;
};

// --- CONFIGURATION DES STYLES ---
const createDocStyles = (branding) => ({
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title1, bold: true, color: cleanColor(branding.colors.heading1 || branding.colors.primary), allCaps: true }, paragraph: { spacing: { before: 480, after: 240 }, keepNext: true, outlineLevel: 0, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title2, bold: true, color: cleanColor(branding.colors.heading2 || branding.colors.secondary) }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title3, bold: true, color: cleanColor(branding.colors.heading3 || '#444444'), italics: true }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title4, bold: true, color: "000000" }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 3, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading5", name: "Heading 5", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title5, bold: false, underline: { type: "single" }, color: "000000" }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, outlineLevel: 4, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Normal", name: "Normal", run: { font: branding.fonts.main, size: branding.sizes.body, color: cleanColor(branding.colors.text) }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, after: 120 } } },
  ],
});

// --- EXPORT PRINCIPAL RC ---
export const generateWordRC = async (selectedNodes, variables, masterData, branding = DEFAULT_BRANDING, docType = 'RC') => {
  await ensureDocx();
  const HEADER_LABELS = {
    RC:   "RÈGLEMENT DE LA CONSULTATION",
    CCTP: "CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES",
    CCAP: "CAHIER DES CLAUSES ADMINISTRATIVES PARTICULIÈRES",
  };
  const headerLabel = HEADER_LABELS[docType] || HEADER_LABELS.RC;
  // ── Section 1 : page de garde PNG (rendu canvas identique au PDF) ──────────
  const coverElements = await buildCoverPageElements(docType, variables, branding);

  // ── Section 2 : contenu principal ─────────────────────────────────────────
  const docChildren = [];

  // --- SOMMAIRE ---
  docChildren.push(
    new Paragraph({ text: "SOMMAIRE", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
    new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-5" }),
    new Paragraph({ children: [new PageBreak()] })
  );

  const processNodes = (nodes, parentPrefix = "") => {
    let counter = 0;
    nodes.forEach((node) => {
      if (!selectedNodes.has(node.id)) return;
      counter++;
      const currentNumber = parentPrefix ? `${parentPrefix}.${counter}` : `${counter}`;

      let hLevel = HeadingLevel.HEADING_1; let titleColor = cleanColor(branding.colors.heading1 || branding.colors.primary); let fontSize = branding.sizes.title1; let isCaps = true; let isBold = true; let isItalic = false; let isUnderline = false;

      if (node.level === 2) { hLevel = HeadingLevel.HEADING_2; titleColor = cleanColor(branding.colors.heading2 || branding.colors.secondary); fontSize = branding.sizes.title2; isCaps = false; }
      else if (node.level === 3) { hLevel = HeadingLevel.HEADING_3; titleColor = cleanColor(branding.colors.heading3 || '#444444'); fontSize = branding.sizes.title3; isCaps = false; isItalic = true; }
      else if (node.level === 4) { hLevel = HeadingLevel.HEADING_4; titleColor = "000000"; fontSize = branding.sizes.title4 || branding.sizes.body; isCaps = false; }
      else if (node.level >= 5) { hLevel = HeadingLevel.HEADING_5; titleColor = "000000"; fontSize = branding.sizes.title5 || branding.sizes.body; isCaps = false; isBold = false; isUnderline = true; }

      if (node.level === 1 && docChildren.length > 5) docChildren.push(new Paragraph({ children: [new PageBreak()] }));

      docChildren.push(
        new Paragraph({
          heading: hLevel,
          // Filet de séparation sous les titres de niveau 1 (allure document pro)
          border: node.level === 1
            ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: cleanColor(branding.colors.primary), space: 4 } }
            : undefined,
          children: [
            new TextRun({ text: sanitizeText(`${currentNumber}.`), color: titleColor, font: branding.fonts.headings, size: fontSize, bold: isBold, italics: isItalic, underline: isUnderline ? { type: "single" } : undefined, allCaps: isCaps }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: sanitizeText(node.title || "Titre"), color: titleColor, font: branding.fonts.headings, size: fontSize, bold: isBold, italics: isItalic, underline: isUnderline ? { type: "single" } : undefined, allCaps: isCaps }),
          ],
        })
      );

      if (node.content) {
        // Pipeline partagé : retrait notes éditeur (mode final) + sections
        // conditionnelles {{#var}} + substitution des variables.
        const text = renderForExport(node.content, variables);
        docChildren.push(...parseHtmlToDocx(text, branding));
      }

      if (node.children) processNodes(node.children, currentNumber);
    });
  };

  processNodes(masterData);

  // --- EN-TÊTE ---
  const headerLeftCell = new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ children: [ new TextRun({ text: sanitizeText(variables.name ? variables.name.toUpperCase() : "PROJET"), bold: true, color: cleanColor(branding.colors.primary), font: branding.fonts.main, size: 18 }) ], spacing: { after: 0 } }), new Paragraph({ children: [ new TextRun({ text: sanitizeText(variables.client || "Maître d'Ouvrage"), color: "666666", font: branding.fonts.main, size: 14 }) ], spacing: { after: 100 } }) ], });
  const headerCenterCell = new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: headerLabel, bold: true, color: cleanColor(branding.colors.subtle), font: branding.fonts.main, size: 20 }) ], spacing: { after: 100 } }) ], });
  const headerRightChildren = [];
  if (branding.logo) { const logoBytes = base64DataURLToUint8Array(branding.logo); if (logoBytes) { const logoType = detectImageType(logoBytes) || "png"; headerRightChildren.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: logoType, data: logoBytes, transformation: { width: 80, height: 50 } })], spacing: { after: 100 } })); } else { headerRightChildren.push(new Paragraph({ children: [new TextRun(" ")] })); } } else { headerRightChildren.push(new Paragraph({ children: [new TextRun(" ")] })); }
  const headerRightCell = new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: headerRightChildren, });
  const headerTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [ new TableRow({ children: [headerLeftCell, headerCenterCell, headerRightCell] }) ] });

  // --- PIED DE PAGE ---
  const footerTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [ new TableRow({ children: [ new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ children: [new TextRun({ text: sanitizeText(variables.code || "Ref"), size: 16, color: "888888" })] })] }), new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: "Page ", size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }), new TextRun({ text: " / ", size: 16, color: "888888" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888" }) ] }) ] }), new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: new Date().toLocaleDateString("fr-FR"), size: 16, color: "888888" })] })] }), ] }) ] });

  appendEstimaWordCredit(docChildren);

  const doc = new Document({
    // Word propose de mettre à jour les champs à l'ouverture ; « Oui » remplit
    // le SOMMAIRE (TOC) avec pagination — désormais effectif grâce à
    // l'outlineLevel des styles de titres (sinon la table restait vide).
    features: { updateFields: true },
    styles: createDocStyles(branding),
    sections: [
      // ── Section 1 : page de garde pleine page, sans header/footer ──────────
      {
        properties: {
          page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } },
        },
        children: coverElements,
      },
      // ── Section 2 : contenu avec header/footer ─────────────────────────────
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        headers: { default: new Header({ children: [headerTable, new Paragraph({ children: [new TextRun(" ")], spacing: { after: 200 } })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun(" ")], spacing: { before: 200 } }), footerTable, new Paragraph({ children: [new TextRun(" ")] })] }) },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${docType}_${sanitizeText(variables.code || "Projet")}_${dateStr}.docx`);
};