import { saveAs } from "file-saver";
import { DEFAULT_BRANDING } from "../data/branding";
import { buildCoverPageElements } from "./wordCoverPage";

let Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Header, Footer, PageNumber, TableOfContents, PageBreak, ImageRun,
    Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign;

const ensureDocx = async () => {
  if (Document) return;
  const docx = await import("docx");
  ({ Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
     Header, Footer, PageNumber, TableOfContents, PageBreak, ImageRun,
     Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } = docx);
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

const getCellParagraphs = (htmlContent, isHeader) => {
  const raw = String(htmlContent || "");
  const normalized = raw.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<\/div\s*>/gi, "\n").replace(/<\/li\s*>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<\/tr\s*>/gi, "\n").replace(/<\/h[1-6]\s*>/gi, "\n");
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = normalized;
  const text = sanitizeText(tempDiv.textContent || tempDiv.innerText || "").replace(/\u00A0/g, " ").replace(/\r/g, "").trim();
  const lines = text.split("\n").map((l) => l.replace(/\s{2,}/g, " ").trim()).filter((l) => l.length > 0);

  if (lines.length === 0) return [new Paragraph({ children: [new TextRun({ text: " " })] })];

  return lines.map((line) => new Paragraph({
        children: [new TextRun({ text: line, bold: isHeader, size: isHeader ? 22 : 20 })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      })
  );
};

// --- PARSING HTML VERS DOCX ---
const parseHtmlToDocx = (htmlContent) => {
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
        docxElements.push(new Paragraph({ children: [new TextRun({ text: sanitizeText(text) })], style: "Normal", spacing: { after: 120 } }));
      }
    }
    else if (nodeName === "UL" || nodeName === "OL") {
      Array.from(node.querySelectorAll("li")).forEach((li) => {
        docxElements.push(new Paragraph({ children: [new TextRun({ text: sanitizeText(li.textContent) })], bullet: { level: 0 }, style: "Normal", spacing: { after: 60 } }));
      });
    }
    else if (nodeName === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr")).filter(tr => tr.querySelectorAll("td, th").length > 0);
      let maxCols = 0;
      rows.forEach((r) => (maxCols = Math.max(maxCols, r.querySelectorAll("td, th").length)));
      const colWidth = Math.floor(100 / (maxCols || 1));

      const docxRows = rows.map((tr) => {
        return new TableRow({
          children: Array.from(tr.querySelectorAll("td, th")).map((td) => {
            const isHeader = td.nodeName === "TH";
            return new TableCell({
              children: getCellParagraphs(td.innerHTML, isHeader),
              width: { size: colWidth, type: WidthType.PERCENTAGE },
              shading: isHeader ? { fill: "F0F0F0" } : undefined,
              verticalAlign: VerticalAlign.CENTER,
              borders: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, left: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, right: { style: BorderStyle.SINGLE, size: 4, color: "000000" } },
            });
          }),
        });
      });

      if (docxRows.length > 0) {
        docxElements.push(new Table({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, left: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, right: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" } } }));
        docxElements.push(new Paragraph({ children: [new TextRun(" ")], spacing: { after: 200 } }));
      }
    }
  });
  return docxElements;
};

// --- CONFIGURATION DES STYLES ---
const createDocStyles = (branding) => ({
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title1, bold: true, color: cleanColor(branding.colors.heading1 || branding.colors.primary), allCaps: true }, paragraph: { spacing: { before: 480, after: 240 }, keepNext: true, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title2, bold: true, color: cleanColor(branding.colors.heading2 || branding.colors.secondary) }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title3, bold: true, color: cleanColor(branding.colors.heading3 || '#444444'), italics: true }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title4, bold: true, color: "000000" }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Heading5", name: "Heading 5", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: branding.fonts.headings, size: branding.sizes.title5, bold: false, underline: { type: "single" }, color: "000000" }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, tabStops: [{ type: "left", position: 900 }] } },
    { id: "Normal", name: "Normal", run: { font: branding.fonts.main, size: branding.sizes.body, color: cleanColor(branding.colors.text) }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, after: 120 } } },
  ],
});

// --- EXPORT PRINCIPAL RC ---
export const generateWordRC = async (selectedNodes, variables, masterData, branding = DEFAULT_BRANDING) => {
  await ensureDocx();
  // ── Section 1 : page de garde PNG (rendu canvas identique au PDF) ──────────
  const coverElements = await buildCoverPageElements("RC", variables, branding);

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
          children: [
            new TextRun({ text: sanitizeText(`${currentNumber}.`), color: titleColor, font: branding.fonts.headings, size: fontSize, bold: isBold, italics: isItalic, underline: isUnderline ? { type: "single" } : undefined, allCaps: isCaps }),
            new TextRun({ text: "    " }), 
            new TextRun({ text: sanitizeText(node.title || "Titre"), color: titleColor, font: branding.fonts.headings, size: fontSize, bold: isBold, italics: isItalic, underline: isUnderline ? { type: "single" } : undefined, allCaps: isCaps }),
          ],
        })
      );

      if (node.content) {
        let text = String(node.content || "");
        Object.keys(variables).forEach((key) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          text = text.replace(regex, String(variables[key] || ""));
        });
        docChildren.push(...parseHtmlToDocx(text));
      }

      if (node.children) processNodes(node.children, currentNumber);
    });
  };

  processNodes(masterData);

  // --- EN-TÊTE ---
  const headerLeftCell = new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ children: [ new TextRun({ text: sanitizeText(variables.name ? variables.name.toUpperCase() : "PROJET"), bold: true, color: cleanColor(branding.colors.primary), font: branding.fonts.main, size: 18 }) ], spacing: { after: 0 } }), new Paragraph({ children: [ new TextRun({ text: sanitizeText(variables.client || "Maître d'Ouvrage"), color: "666666", font: branding.fonts.main, size: 14 }) ], spacing: { after: 100 } }) ], });
  const headerCenterCell = new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: "RÈGLEMENT DE LA CONSULTATION", bold: true, color: cleanColor(branding.colors.subtle), font: branding.fonts.main, size: 20 }) ], spacing: { after: 100 } }) ], });
  const headerRightChildren = [];
  if (branding.logo) { const logoBytes = base64DataURLToUint8Array(branding.logo); if (logoBytes) { headerRightChildren.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: logoBytes, transformation: { width: 80, height: 50 } })], spacing: { after: 100 } })); } else { headerRightChildren.push(new Paragraph({ children: [new TextRun(" ")] })); } } else { headerRightChildren.push(new Paragraph({ children: [new TextRun(" ")] })); }
  const headerRightCell = new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: headerRightChildren, });
  const headerTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [ new TableRow({ children: [headerLeftCell, headerCenterCell, headerRightCell] }) ] });

  // --- PIED DE PAGE ---
  const footerTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "E0E0E0" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [ new TableRow({ children: [ new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ children: [new TextRun({ text: sanitizeText(variables.code || "Ref"), size: 16, color: "888888" })] })] }), new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: "Page ", size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }), new TextRun({ text: " / ", size: 16, color: "888888" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888" }) ] }) ] }), new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: new Date().toLocaleDateString("fr-FR"), size: 16, color: "888888" })] })] }), ] }) ] });

  const doc = new Document({
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
  saveAs(blob, `RC_${sanitizeText(variables.code || "Projet")}_${dateStr}.docx`);
};