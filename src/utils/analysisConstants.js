// src/utils/analysisConstants.js

export const COMPANY_STYLES = [
  { name: 'Blue',    header: [30, 58, 138],    bg: [239, 246, 255], border: [191, 219, 254] }, // bg-blue-900 / bg-blue-50
  { name: 'Emerald', header: [6, 78, 59],      bg: [236, 253, 245], border: [167, 243, 208] }, // bg-emerald-900 / bg-emerald-50
  { name: 'Amber',   header: [180, 83, 9],     bg: [255, 251, 235], border: [253, 230, 138] }, // bg-amber-700 / bg-amber-50
  { name: 'Purple',  header: [88, 28, 135],    bg: [250, 245, 255], border: [233, 213, 255] }, // bg-purple-900 / bg-purple-50
];

export const SCORING_METHODS = [
  { id: 'f1', label: 'Formule 1 : Linéaire', math: 'N × (Pmin / P)' },
  { id: 'f2', label: 'Formule 2 : Quadratique', math: 'N × (Pmin / P)²' },
  { id: 'f3', label: 'Formule 3 : Cubique', math: 'N × (Pmin / P)³' },
  { id: 'f4', label: 'Formule 4 : Écart Relatif', math: 'N × (1 - (P - Pmin)/Pmin)' },
  { id: 'f5', label: 'Formule 5 : Amortie', math: 'N × (1 - (P - Pmin)/Pmoy)' },
  { id: 'f6', label: 'Formule 6 : Mixte', math: 'Si P<Moy: Racine / Si P>Moy: Carré' },
];