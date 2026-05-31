// src/views/ged/gedConstants.js
// Constantes partagées de la GED (Gestion Électronique des Documents émis).
//
// Les phases sont désormais propres à chaque affaire (voir utils/phaseModel.js).
// Ce fichier conserve des helpers de compatibilité basés sur les codes de phase
// standard, utilisés là où on n'a qu'un code (ex: badge d'une archive).

import { DEFAULT_PHASE_DEFS, phaseColorFor, styleForColor } from '../../utils/phaseModel';

// Liste des codes de phase standard (rétrocompat ; ordre chronologique).
export const PHASES = DEFAULT_PHASE_DEFS.map((d) => d.code);

// Style d'un code de phase standard (couleur dédiée si connu, rotation sinon).
export const getPhaseStyle = (phase) => {
  const idx = PHASES.indexOf(phase);
  return styleForColor(phaseColorFor(phase, idx >= 0 ? idx : 0));
};

// Format date FR long (ex: "lundi 28 mai 2026 à 14:32").
export const formatDateLong = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Format date FR court (ex: "28 mai 2026").
export const formatDateShort = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
