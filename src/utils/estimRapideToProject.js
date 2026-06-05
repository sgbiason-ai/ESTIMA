// src/utils/estimRapideToProject.js
//
// Passerelle Estimation Rapide → projet ESTIMA détaillé.
// Mapper pur : chaque grand lot devient un chapitre, chaque poste un article.
// On réutilise `poste.id` comme `item.id` → les formules ({posteId}) restent
// valides côté ESTIMA (références par id), donc le calcul est préservé.
import { generateId } from './helpers';
import { resolveEstimate } from './estimRapideFormula';
import { aleasAmount } from './estimRapideCalc';

const toNum = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
const isFormula = (v) => typeof v === 'string' && v.trim().startsWith('=');

/**
 * Construit un objet projet ESTIMA à partir d'une estimation rapide.
 * @param {object} estimateInput - estimation rapide ({ lots, aleas, ... })
 * @param {object} [opts]
 * @param {string} [opts.name] - nom du projet (défaut : nom de l'estimation)
 * @param {function} [opts.idFactory] - générateur d'id (injectable pour les tests)
 * @returns {object} projet { id, name, chapters, tranches, sourceIds, ... }
 */
export const estimateToProject = (estimateInput, { name, idFactory = generateId } = {}) => {
  const estimate = resolveEstimate(estimateInput).estimate; // quantités résolues

  const chapters = (estimate.lots || []).map((lot) => ({
    id: lot.id,
    type: 'chapter',
    title: (lot.label || 'Lot').toUpperCase(),
    isOption: false,
    children: (lot.postes || []).map((poste) => ({
      id: poste.id,
      type: 'item',
      designation: poste.label || '',
      unit: poste.unit || 'u',
      qty: toNum(poste.qty),
      price: toNum(poste.ratio),
      ...(isFormula(poste.formula) ? { formula: poste.formula } : {}),
    })),
  }));

  // Aléas → chapitre dédié (préserve le total final)
  const aleas = aleasAmount(estimate);
  if (aleas > 0) {
    chapters.push({
      id: idFactory(),
      type: 'chapter',
      title: 'ALÉAS / IMPRÉVUS',
      isOption: false,
      children: [{
        id: idFactory(),
        type: 'item',
        designation: `Aléas et imprévus (${toNum(estimate.aleas?.percent)} %)`,
        unit: 'forfait',
        qty: 1,
        price: Math.round(aleas * 100) / 100,
      }],
    });
  }

  return {
    id: idFactory(),
    name: name || estimate.name || 'Projet converti',
    client: estimate.client || '',
    location: estimate.location || '',
    chapters,
    tranches: [],
    sourceIds: [],
    convertedFromEstimate: estimate.id || null,
  };
};
