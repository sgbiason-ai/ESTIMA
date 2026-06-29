// src/utils/estimaWordCredit.js
// Mention produit « Édité avec ESTIMA VRD » pour les exports Word (docx).
// Isolé de estimaCredit.js car importe la dépendance « docx » (lourde) :
// seuls les générateurs Word la tirent. Voir estimaCredit.js pour PDF/Excel.

import { Paragraph, TextRun, AlignmentType } from 'docx';
import { ESTIMA_CREDIT, isEstimaCreditEnabled } from './estimaCredit';

export { ESTIMA_CREDIT, isEstimaCreditEnabled };

/**
 * Renvoie un paragraphe docx discret (centré, gris clair, italique) à pousser
 * en fin de corps de document (dernière page).
 * @returns {Paragraph}
 */
export const estimaWordCreditParagraph = () =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240 },
    children: [
      new TextRun({ text: ESTIMA_CREDIT, italics: true, size: 14, color: 'AAAAAA' }),
    ],
  });

/**
 * Pousse le paragraphe de crédit en fin de tableau `children` UNIQUEMENT si la
 * mention est activée dans le branding. No-op sinon. Centralise la condition
 * pour tous les générateurs Word.
 * @param {Array} children - tableau d'éléments docx d'une section
 */
export const appendEstimaWordCredit = (children) => {
  if (!isEstimaCreditEnabled() || !Array.isArray(children)) return;
  children.push(estimaWordCreditParagraph());
};
