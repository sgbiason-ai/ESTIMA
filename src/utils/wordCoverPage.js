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

  // Rendu canvas → PNG data URL
  const dataUrl = await buildCoverPageCanvas(variables, docLabel, branding);
  const bytes   = base64DataURLToUint8Array(dataUrl);

  if (!bytes) {
    // Fallback : paragraphe vide si le rendu a échoué
    return [new Paragraph({ children: [] })];
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