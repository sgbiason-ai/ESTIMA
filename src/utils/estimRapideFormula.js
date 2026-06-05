// src/utils/estimRapideFormula.js
//
// Couche « formules » du module Estimation Rapide.
// Réutilise le moteur pur d'ESTIMA (evaluateFormula → safeEvalMathExpr).
//
// Stockage interne d'une formule : "={id}*2" (référence par poste.id → robuste
// au renommage). Affichage lisible : "=[Désignation]*2" (dialecte ESTIMA).
// Les références pointant 1:1 sur poste.id, le bug des labels en double (P.x
// partagés) n'existe pas ici.
import { evaluateFormula } from './projectCalculations';

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Vrai si la valeur est une formule (chaîne commençant par '='). */
export const isFormula = (v) => typeof v === 'string' && v.trim().startsWith('=');

/** Normalise les décimales françaises : 0,3 → 0.3 (uniquement entre chiffres). */
export const normalizeFormula = (f) =>
  (isFormula(f) ? f.replace(/(\d)\s*,\s*(\d)/g, '$1.$2') : f);

/**
 * Liste à plat des postes avec leur libellé d'affichage
 * (désignation, ou repli « P{n} » si vide).
 */
export const flattenPostes = (estimate) => {
  const out = [];
  let n = 1;
  (estimate?.lots || []).forEach((lot) => {
    (lot?.postes || []).forEach((poste) => {
      const label = poste.label && poste.label.trim() ? poste.label.trim() : `P${n}`;
      out.push({ poste, lotId: lot.id, label, ordinal: n });
      n += 1;
    });
  });
  return out;
};

/** Index de références : { flat, idToLabel:Map, nameToId:Map }. */
export const buildRefIndex = (estimate) => {
  const flat = flattenPostes(estimate);
  const idToLabel = new Map();
  const nameToId = new Map(); // libellé minuscule → id (dernier gagne, cf. ESTIMA)
  flat.forEach(({ poste, label }) => {
    idToLabel.set(poste.id, label);
    nameToId.set(label.trim().toLowerCase(), poste.id);
  });
  return { flat, idToLabel, nameToId };
};

/** Formule stockée ({id}) → affichage lisible ([Désignation]). */
export const formulaToDisplay = (raw, idToLabel) => {
  if (!isFormula(raw)) return raw || '';
  return raw.replace(/\{([^}]+)\}/g, (m, id) => {
    const label = idToLabel.get(id);
    return label ? `[${label}]` : m;
  });
};

/**
 * Affichage ([Désignation]) → stockage ({id}).
 * `sessionMap` (libellé → id, alimentée au clic) prioritaire pour lever
 * l'ambiguïté des désignations en double ; repli sur `nameToId`.
 */
export const displayToFormula = (display, nameToId, sessionMap = null) => {
  if (!isFormula(display)) return display || '';
  return display.replace(/\[([^\]]+)\]/g, (m, name) => {
    const id = (sessionMap && sessionMap.get(name)) ?? nameToId.get(name.trim().toLowerCase());
    return id ? `{${id}}` : m;
  });
};

/**
 * Résout les formules des postes en quantités (pur, jusqu'à 5 passes pour les
 * dépendances chaînées). Ne mute pas l'entrée.
 * @returns {{ estimate, changed: boolean }}
 */
export const resolveEstimate = (estimate) => {
  const flat = flattenPostes(estimate);
  if (flat.length === 0) return { estimate, changed: false };

  const qtyById = {};
  flat.forEach(({ poste }) => { qtyById[poste.id] = toNum(poste.qty); });

  const MAX_PASSES = 5;
  let dirty = true;
  let pass = 0;
  while (dirty && pass < MAX_PASSES) {
    dirty = false;
    pass += 1;
    const nameMap = {};
    flat.forEach(({ poste, label }) => { nameMap[label] = qtyById[poste.id]; });
    flat.forEach(({ poste }) => {
      if (!isFormula(poste.formula)) return;
      const val = evaluateFormula(normalizeFormula(poste.formula), qtyById, nameMap);
      if (val !== null && val !== qtyById[poste.id]) {
        qtyById[poste.id] = val;
        dirty = true;
      }
    });
  }

  let changed = false;
  const lots = (estimate.lots || []).map((lot) => ({
    ...lot,
    postes: (lot.postes || []).map((p) => {
      if (isFormula(p.formula)) {
        const nq = qtyById[p.id];
        if (nq !== p.qty) { changed = true; return { ...p, qty: nq }; }
      }
      return p;
    }),
  }));
  return { estimate: changed ? { ...estimate, lots } : estimate, changed };
};
