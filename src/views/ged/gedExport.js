// src/views/ged/gedExport.js
//
// Export PDF / Excel d'une VERSION FIGÉE.
// Un snapshot n'a pas de state vivant : on reconstruit les maps de quantités
// (client) à partir de ses articles via la fonction pure computeQtyMaps —
// exactement comme le fait useProjectCalculations pour le projet courant —
// puis on appelle les mêmes générateurs que l'export projet.

import { computeQtyMaps } from '../../utils/projectCalculations';

// Aplatit l'arbre du snapshot en liste d'articles (pour la résolution des formules).
const flattenItems = (chapters) => {
  const items = [];
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'item') items.push(n);
      else if (n.children) walk(n.children);
    });
  };
  walk(chapters || []);
  return items;
};

// Construit le contexte d'export depuis un snapshot figé.
const buildExportContext = (snapshot) => {
  const tranches = snapshot?.tranches || [];
  const hasTranches = tranches.length > 0;
  const clientPercent = Number(snapshot?.clientPercent ?? 10);
  const bpuConfig = snapshot?.bpuConfig || { numberingMode: 'auto' };

  const items = flattenItems(snapshot?.chapters);
  const { clientQtyMaps } = computeQtyMaps(items, hasTranches, tranches, clientPercent);

  const projectForExport = { ...snapshot, clientLogo: snapshot?.clientLogo };

  return { tranches, hasTranches, bpuConfig, clientQtyMaps, projectForExport };
};

// Génère un aperçu PDF (retourne { blob, blobUrl, suggestedName }) — utilisé par ExportModal.
export const previewArchivePdf = async (snapshot, { type, includeCover, selectedExports, includeSummary, includePM }, branding = null) => {
  const { tranches, bpuConfig, clientQtyMaps, projectForExport } = buildExportContext(snapshot);
  const { generateProfessionalPDF } = await import('../../utils/pdfGenerator');
  return generateProfessionalPDF(
    projectForExport, clientQtyMaps, type, bpuConfig,
    { includeCover, selectedExports, includeSummary, includePM, tranches, previewOnly: true },
    branding
  );
};

// Exporte réellement le fichier (PDF ou Excel).
export const exportArchive = async (
  snapshot,
  format,
  { type, includeCover, selectedExports, includeSummary, includePM, _previewBlob, _suggestedName },
  branding = null
) => {
  const { tranches, bpuConfig, clientQtyMaps, projectForExport } = buildExportContext(snapshot);

  if (format === 'pdf') {
    if (_previewBlob && _suggestedName) {
      // L'aperçu a déjà produit le blob : on réutilise pour éviter une 2e génération.
      const { saveFileWithPicker, FILE_TYPES, PICKER_IDS } = await import('../../utils/fileSaver');
      await saveFileWithPicker(_previewBlob, _suggestedName, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
    } else {
      const { generateProfessionalPDF } = await import('../../utils/pdfGenerator');
      await generateProfessionalPDF(
        projectForExport, clientQtyMaps, type, bpuConfig,
        { includeCover, selectedExports, includeSummary, includePM, tranches },
        branding
      );
    }
  } else {
    const { generateProfessionalExcel } = await import('../../utils/excelGenerator');
    await generateProfessionalExcel(
      projectForExport, clientQtyMaps, type, bpuConfig,
      { selectedExports, includeSummary, includePM, tranches },
      branding
    );
  }
};
