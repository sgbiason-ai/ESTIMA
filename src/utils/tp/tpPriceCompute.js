// src/utils/tp/tpPriceCompute.js
// ESTIMA TP — moteur de calcul du sous-détail de prix (source unique, testée).
// Méthode du fichier « Sous-détail » : déboursé sec décomposé en 5 postes
// (Matériel, Main d'œuvre, Fourniture, Sous-traitance, Transport), piloté par
// rendement + durée, puis coefficient de vente par poste → prix de vente unitaire.
import { generateId } from '../helpers';

export const POSTES = ['materiel', 'mo', 'fourniture', 'soustraitance', 'transport'];

export const POSTE_LABELS = {
  materiel: 'Matériel',
  mo: 'Main d\'œuvre',
  fourniture: 'Fournitures',
  soustraitance: 'Sous-traitance',
  transport: 'Transport',
};

export const DEFAULT_COEF = 1.15;

export const defaultCoefficients = () => ({
  materiel: DEFAULT_COEF, mo: DEFAULT_COEF, fourniture: DEFAULT_COEF,
  soustraitance: DEFAULT_COEF, transport: DEFAULT_COEF,
});

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ─── Fabriques de lignes ──────────────────────────────────────────────────────
// Matériel / Main d'œuvre : même structure (part personnel + part matériel/véhicule
// décomposée en amortissement / entretien / consommable / location).
export const newRessourceLine = (over = {}) => ({
  id: `tpr_${generateId()}`, code: '', nombre: 1, designation: '', unit: 'J',
  puJour: 0, amort: 0, entret: 0, cons: 0, loc: 0, ...over,
});

// Fourniture : quantité pilotée par épaisseur × densité (ou directe), PU barème/forcé.
export const newFournitureLine = (over = {}) => ({
  id: `tpf_${generateId()}`, code: '', designation: '', unit: 'T',
  epaisseur: 0, densite: 0, qte: 0, puBareme: 0, puForce: 0, ...over,
});

export const newSousTraitanceLine = (over = {}) => ({
  id: `tps_${generateId()}`, code: '', designation: '', unit: 'U',
  qte: 0, puBareme: 0, puForce: 0, ...over,
});

// Transport : contenance par voyage + voyages/jour + coût journalier du camion.
// La quantité à transporter peut être convertie via épaisseur × densité.
export const newTransportLine = (over = {}) => ({
  id: `tpt_${generateId()}`, designation: '', unit: 'T',
  epaisseur: 0, densite: 0, contenance: 0, voyagesParJour: 0, coutJour: 0, ...over,
});

export const emptyDetail = () => ({
  rendement: 0, duree: 1, dureeForced: false,
  materiel: [], mo: [], fourniture: [], soustraitance: [], transport: [],
  pvForce: null,
});

// ─── Coûts par ligne ──────────────────────────────────────────────────────────
// Durée effective d'une ligne : sa durée propre si renseignée, sinon la durée
// TOTALE du chantier (= quantité / rendement). La durée est donc affichée et
// modifiable par ligne mais pré-remplie avec la valeur calculée.
// Durée forcée UNIQUEMENT si le flag `dureeForced` de la ligne est vrai ;
// sinon on prend la durée totale calculée. (Un `duree` résiduel sans flag est
// ignoré → les lignes suivent la durée calculée par défaut.)
export const lineDuree = (line, fallback) => (line?.dureeForced ? num(line?.duree) : num(fallback));

// Coût d'une ressource (matériel ou MO) = nombre × durée × somme des composants
// (Personnel + A + E + I + Location). Tout est imputé au poste de la ligne.
export function ressourceCosts(line, fallbackDuree) {
  const base = num(line.nombre) * lineDuree(line, fallbackDuree);
  return r2(base * (num(line.puJour) + num(line.amort) + num(line.entret) + num(line.cons) + num(line.loc)));
}

/** Quantité d'une fourniture : épaisseur × densité × quantité d'ouvrage, sinon qté directe. */
export function fournitureQty(line, qteOuvrage) {
  const ep = num(line.epaisseur), de = num(line.densite);
  if (ep > 0 && de > 0) return r2(num(qteOuvrage) * ep * de);
  return num(line.qte);
}

export const fournitureCost = (line, qteOuvrage) => {
  const pu = num(line.puForce) > 0 ? num(line.puForce) : num(line.puBareme);
  return r2(fournitureQty(line, qteOuvrage) * pu);
};

const sameUnit = (a, b) => !!a && !!b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

/** Quantité d'une sous-traitance : quantité de la tâche si l'unité est la même
 *  que l'ouvrage, sinon quantité saisie. */
export function sousTraitanceQty(line, qteOuvrage, articleUnit) {
  if (sameUnit(line?.unit, articleUnit)) return num(qteOuvrage);
  return num(line?.qte);
}

export const sousTraitanceCost = (line, qteOuvrage, articleUnit) => {
  const pu = num(line.puForce) > 0 ? num(line.puForce) : num(line.puBareme);
  return r2(sousTraitanceQty(line, qteOuvrage, articleUnit) * pu);
};

/** Quantité à transporter : quantité d'ouvrage × épaisseur × densité, sinon quantité d'ouvrage. */
export function transportQty(line, qteOuvrage) {
  const ep = num(line?.epaisseur), de = num(line?.densite);
  if (ep > 0 && de > 0) return r2(num(qteOuvrage) * ep * de);
  return num(qteOuvrage);
}

// Camions-jours nécessaires = quantité à transporter / (contenance × voyages par jour).
const camionsJours = (line, qteOuvrage) => {
  const perDay = num(line?.contenance) * num(line?.voyagesParJour);
  return perDay > 0 ? num(transportQty(line, qteOuvrage)) / perDay : 0;
};

/** Nombre de camions nécessaires en parallèle (camions-jours / durée). */
export const transportCamions = (line, qteOuvrage, duree) => {
  const cj = camionsJours(line, qteOuvrage);
  return r2(num(duree) > 0 ? cj / num(duree) : cj);
};

/** Coût transport = camions-jours × coût journalier du camion. */
export const transportCost = (line, qteOuvrage) => r2(camionsJours(line, qteOuvrage) * num(line?.coutJour));

// ─── Calcul complet d'un sous-détail ──────────────────────────────────────────
/**
 * @param {object} detail  sous-détail (emptyDetail())
 * @param {number} qteOuvrage  quantité de l'article au bordereau
 * @param {object} coef  coefficients de vente par poste
 * @returns totaux secs par poste, déboursé, PU sec, PV par poste, PV unitaire, PU retenu
 */
export function computeDetail(detail, qteOuvrage, coef = defaultCoefficients(), articleUnit = '') {
  const d = detail || emptyDetail();
  const qte = num(qteOuvrage);
  const duree = effectiveDuree(d, qte); // durée totale = quantité / rendement (ou forcée)
  const sec = { materiel: 0, mo: 0, fourniture: 0, soustraitance: 0, transport: 0 };

  (d.materiel || []).forEach(l => { sec.materiel += ressourceCosts(l, duree); });
  (d.mo || []).forEach(l => { sec.mo += ressourceCosts(l, duree); });
  (d.fourniture || []).forEach(l => { sec.fourniture += fournitureCost(l, qte); });
  (d.soustraitance || []).forEach(l => { sec.soustraitance += sousTraitanceCost(l, qte, articleUnit); });
  (d.transport || []).forEach(l => { sec.transport += transportCost(l, qte); });

  POSTES.forEach(p => { sec[p] = r2(sec[p]); });

  const deboursecSec = r2(POSTES.reduce((s, p) => s + sec[p], 0));
  const puSec = qte > 0 ? r2(deboursecSec / qte) : 0;

  const pvParPoste = {};
  POSTES.forEach(p => { pvParPoste[p] = r2(sec[p] * num(coef?.[p] ?? DEFAULT_COEF)); });
  const pvTotalTache = r2(POSTES.reduce((s, p) => s + pvParPoste[p], 0));
  const puVente = qte > 0 ? r2(pvTotalTache / qte) : 0;

  const puRetenu = d.pvForce != null && d.pvForce !== '' ? r2(d.pvForce) : puVente;
  const totalVente = r2(puRetenu * qte);

  // Ratios de répartition du déboursé sec (part de chaque poste)
  const ratios = {};
  POSTES.forEach(p => { ratios[p] = deboursecSec > 0 ? r2(sec[p] / deboursecSec) : 0; });

  return { sec, deboursecSec, puSec, pvParPoste, pvTotalTache, puVente, puRetenu, totalVente, ratios, qte, duree };
}

/** Durée totale = quantité / rendement (liée au rendement, éditable des deux côtés). */
export function effectiveDuree(detail, qteOuvrage) {
  const r = num(detail?.rendement);
  return r > 0 ? r2(num(qteOuvrage) / r) : 0;
}

/** Rendement déduit d'une durée saisie : quantité / durée. */
export const rendementFromDuree = (qteOuvrage, duree) => {
  const d = num(duree);
  return d > 0 ? r2(num(qteOuvrage) / d) : 0;
};
