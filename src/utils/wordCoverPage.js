// src/utils/wordCoverPage.js
//
// ─────────────────────────────────────────────────────────────────────────────
// Génère la page de garde Word en rendant le PNG identique à la page de garde
// PDF (via coverPageCanvas.js) et en l'insérant comme image pleine page.
//
// La section Word dédiée à la couverture utilise des marges nulles pour que
// l'image A4 occupe exactement toute la page.
// ─────────────────────────────────────────────────────────────────────────────

import { buildCoverPageCanvas } from "./coverPageCanvas";

const cleanColor = (hex) => (hex ? String(hex).replace(/^#/, "").toUpperCase() : "1E3A5F");

// Page de garde native (texte) — fallback si le rendu canvas échoue.
// Garantit un document jamais blanc en première page.
const buildNativeCover = async (docLabel, variables = {}, branding = {}) => {
  const { Paragraph, TextRun, AlignmentType } = await import("docx");
  const primary = cleanColor(branding?.colors?.primary);
  const fontH = branding?.fonts?.headings || "Arial";
  const fontB = branding?.fonts?.main || "Arial";
  const line = (text, opts = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: opts.before ?? 120, after: opts.after ?? 120 },
      children: [new TextRun({ text: text || "", font: opts.font || fontB, size: opts.size || 24, bold: opts.bold, color: opts.color })],
    });
  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    line(docLabel, { font: fontH, size: 28, bold: true, color: "808080" }),
    line((variables.name || "PROJET").toUpperCase(), { font: fontH, size: 52, bold: true, color: primary, before: 400, after: 400 }),
    line(variables.client || "", { size: 26, bold: true }),
    line([variables.clientZip, variables.clientCity].filter(Boolean).join(" "), { size: 22, color: "666666" }),
    line(variables.location ? `Lieu : ${variables.location}` : "", { size: 22, color: "666666", before: 240 }),
    line(variables.code ? `Référence : ${variables.code}` : "", { size: 22, color: "666666" }),
    line(`Phase : ${variables.phase || "DCE"}`, { size: 22, color: "666666" }),
  ];
};

const base64DataURLToUint8Array = (dataURL) => {
  if (!dataURL) return null;
  const base64Regex = /^data:image\/(png|jpg|jpeg);base64,/i;
  if (!base64Regex.test(dataURL)) return null;
  const base64 = dataURL.replace(base64Regex, "");
  try {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++)
      bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
};

/**
 * Génère le tableau d'éléments docx pour la page de garde.
 * La fonction est async car elle utilise le rendu canvas (chargement des logos).
 *
 * @param {"CCTP"|"RC"} docType
 * @param {object}      variables  – champs du projet (= ProjectDetailsModal)
 * @param {object}      branding
 * @returns {Promise<Paragraph[]>}
 */
export const buildCoverPageElements = async (docType, variables, branding) => {
  const { Paragraph, ImageRun } = await import("docx");
  const docLabel =
    docType === "CCTP"
      ? "CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES"
      : docType === "CCAP"
        ? "CAHIER DES CLAUSES ADMINISTRATIVES PARTICULIÈRES"
        : "RÈGLEMENT DE LA CONSULTATION";

  // Rendu canvas → PNG data URL. Peut échouer (canvas « tainté » par un logo
  // chargé en cross-origin, police absente…) : on ne renvoie alors JAMAIS une
  // page blanche, mais une page de garde native (texte) lisible et embarquée.
  let bytes = null;
  try {
    const dataUrl = await buildCoverPageCanvas(variables, docLabel, branding);
    bytes = base64DataURLToUint8Array(dataUrl);
  } catch {
    bytes = null;
  }

  if (!bytes) {
    return buildNativeCover(docLabel, variables, branding);
  }

  // A4 affiché pleine page :
  // marges section = 0 → largeur utile = 11 906 DXA = 8,27" = 794 px @ 96 dpi
  // hauteur correspondante (ratio A4) = 794 × 297/210 = 1 123 px
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: bytes,
          transformation: { width: 794, height: 1123 },
          altText: {
            title: "Page de garde",
            description: "Page de garde du document",
            name: "cover",
          },
        }),
      ],
      spacing: { before: 0, after: 0 },
    }),
  ];
};