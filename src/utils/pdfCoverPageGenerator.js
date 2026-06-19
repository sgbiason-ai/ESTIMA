// src/utils/pdfCoverPageGenerator.js
// Génère un PDF A4 contenant uniquement la page de garde du projet.
// Pas de mention CCTP / RC / DQE : la zone "type de document" est volontairement vide.

import jsPDF from 'jspdf';
import { saveFileWithPicker, FILE_TYPES, PICKER_IDS } from './fileSaver';
import { sanitizeFilename, loadLogos, drawCoverPage } from './pdf/pdfSharedHelpers';
import { buildTheme } from './pdf/buildTheme';
import { getCurrentPhaseCode } from './phaseModel';

export const generateCoverPagePDF = async (project, branding = null) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-FR');
  const THEME = buildTheme(branding);
  const { logoMoe, logoClient, logoCoTraitants } = await loadLogos(branding, project);

  drawCoverPage(doc, {
    docType: '', // page de garde générique
    title: project?.name,
    subtitle1: (project?.subtitle1 || '').trim(),
    subtitle2: (project?.subtitle2 || '').trim(),
    phaseLabel: getCurrentPhaseCode(project).toUpperCase(),
    clientName: project?.client || 'Non renseigné',
    clientStreet: (project?.clientAddress || '').trim(),
    clientCityZip: [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: project?.location || 'Non renseignée',
    codeAffaire: project?.code || 'Non défini',
    showSignatures: project?.showSignatures === true,
    signatories: project?.signatories || ['', '', '', ''],
    branding,
    today,
  }, THEME, { logoMoe, logoClient, logoCoTraitants });

  const fileName = `Page_de_garde_${sanitizeFilename(project?.name || 'projet')}.pdf`;
  const blob = doc.output('blob');
  await saveFileWithPicker(blob, fileName, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
};
