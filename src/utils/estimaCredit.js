// src/utils/estimaCredit.js
// Mention produit discrète « Édité avec ESTIMA VRD » apposée en bas de la
// dernière page / dernière feuille de tous les exports (PDF, Excel, Word).
// Objectif : un peu de visibilité sans être ostentatoire (gris clair, petite
// taille, italique). Source unique de la formulation et des helpers PDF/Excel.
// Le helper Word (docx) vit dans estimaWordCredit.js pour éviter d'embarquer
// la dépendance « docx » dans le chemin des exports PDF/Excel.

export const ESTIMA_CREDIT = 'Édité avec ESTIMA VRD';

// État global de la mention, piloté par le branding MOE (resources/branding).
// Synchronisé depuis useAppResources à chaque évolution de masterBranding.
// Par défaut activé : la mention s'affiche tant que l'utilisateur ne l'a pas
// explicitement désactivée dans la charte graphique.
let _enabled = true;

/** Active (true / undefined) ou désactive (false) globalement la mention. */
export const setEstimaCreditEnabled = (enabled) => { _enabled = enabled !== false; };

/** True si la mention doit être apposée sur les exports. */
export const isEstimaCreditEnabled = () => _enabled;

/**
 * PDF (jsPDF) — appose la mention, centrée tout en bas de la dernière page.
 * À appeler juste avant doc.output()/doc.save().
 * @param {object} doc - instance jsPDF
 * @param {string} [label] - texte (défaut : ESTIMA_CREDIT)
 */
export const stampPdfCredit = (doc, label = ESTIMA_CREDIT) => {
  if (!_enabled || !doc?.internal) return;
  try {
    const pages = doc.internal.getNumberOfPages();
    if (pages < 1) return;
    doc.setPage(pages);
    const w = doc.internal.pageSize.width;
    const h = doc.internal.pageSize.height;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(175, 175, 175);
    doc.text(label, w / 2, h - 6, { align: 'center' });
  } catch {
    /* ne jamais bloquer un export pour la mention */
  }
};

/**
 * Excel (ExcelJS) — écrit la mention dans une cellule discrète, 2 lignes sous
 * les données de la dernière feuille du classeur.
 * À appeler juste avant workbook.xlsx.writeBuffer().
 * @param {object} workbook - instance ExcelJS.Workbook
 * @param {string} [label] - texte (défaut : ESTIMA_CREDIT)
 */
export const stampExcelCredit = (workbook, label = ESTIMA_CREDIT) => {
  if (!_enabled) return;
  try {
    const sheets = workbook?.worksheets;
    if (!sheets?.length) return;
    const ws = sheets[sheets.length - 1];
    const row = (ws.lastRow?.number || ws.rowCount || 0) + 2;
    const cell = ws.getCell(`A${row}`);
    cell.value = label;
    cell.font = { italic: true, size: 8, color: { argb: 'FFAAAAAA' } };
  } catch {
    /* ne jamais bloquer un export pour la mention */
  }
};
