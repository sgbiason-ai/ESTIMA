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

export const newTransportLine = (over = {}) => ({
  id: `tpt_${generateId()}`, code: '', designation: '', unit: 'J',
  nombre: 1, toursJour: 0, unitesJour: 0,
  puJour: 0, amort: 0, entret: 0, cons: 0, loc: 0, ...over,
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
export const lineDuree = (line, fallback) => {
  const v = line?.duree;
  return (v === null || v === undefined || v === '') ? num(fallback) : num(v);
};

// Une ressource (matériel ou MO) contribue à DEUX postes :
//   - part personnel (chauffeur / ouvrier)  → poste « mo »
//   - part matériel (machine / véhicule)    → poste « materiel »
// Coût = nombre × durée (ligne ou totale) × tarif/jour.
export function ressourceCosts(line, fallbackDuree) {
  const base = num(line.nombre) * lineDuree(line, fallbackDuree);
  const perso = base * num(line.puJour);
  const mat = base * (num(line.amort) + num(line.entret) + num(line.cons) + num(line.loc));
  return { perso: r2(perso), mat: r2(mat) };
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

export const sousTraitanceCost = (line) => {
  const pu = num(line.puForce) > 0 ? num(line.puForce) : num(line.puBareme);
  return r2(num(line.qte) * pu);
};

export const transportCost = (line, fallbackDuree) => {
  const base = num(line.nombre) * lineDuree(line, fallbackDuree);
  return r2(base * (num(line.puJour) + num(line.amort) + num(line.entret) + num(line.cons) + num(line.loc)));
};

// ─── Calcul complet d'un sous-détail ──────────────────────────────────────────
/**
 * @param {object} detail  sous-détail (emptyDetail())
 * @param {number} qteOuvrage  quantité de l'article au bordereau
 * @param {object} coef  coefficients de vente par poste
 * @returns totaux secs par poste, déboursé, PU sec, PV par poste, PV unitaire, PU retenu
 */
export function computeDetail(detail, qteOuvrage, coef = defaultCoefficients()) {
  const d = detail || emptyDetail();
  const qte = num(qteOuvrage);
  const duree = effectiveDuree(d, qte); // durée totale = quantité / rendement (ou forcée)
  const sec = { materiel: 0, mo: 0, fourniture: 0, soustraitance: 0, transport: 0 };

  (d.materiel || []).forEach(l => { const c = ressourceCosts(l, duree); sec.mo += c.perso; sec.materiel += c.mat; });
  (d.mo || []).forEach(l => { const c = ressourceCosts(l, duree); sec.mo += c.perso; sec.materiel += c.mat; });
  (d.fourniture || []).forEach(l => { sec.fourniture += fournitureCost(l, qte); });
  (d.soustraitance || []).forEach(l => { sec.soustraitance += sousTraitanceCost(l); });
  (d.transport || []).forEach(l => { sec.transport += transportCost(l, duree); });

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

/** Durée effective : forcée si dureeForced, sinon quantité / rendement. */
export function effectiveDuree(detail, qteOuvrage) {
  const d = detail || {};
  if (d.dureeForced) return num(d.duree);
  const r = num(d.rendement);
  return r > 0 ? r2(num(qteOuvrage) / r) : 0;
}
