// src/utils/ccapExport.js
// Export Word du CCAP — réutilise le générateur RC (même mise en page),
// en passant le type de document "CCAP" (libellé de page de garde + nom de fichier).
import { generateWordRC } from './rcExport';

export const generateWordCCAP = (selectedNodes, variables, masterData, branding) =>
  generateWordRC(selectedNodes, variables, masterData, branding, 'CCAP');
