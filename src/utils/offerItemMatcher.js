// src/utils/offerItemMatcher.js
//
// Résolution « ligne d'un fichier offre » → « article du DQE MOE ».
//
// Un DQE réutilise volontairement le même prix dans plusieurs sous-chapitres
// avec des quantités différentes (numérotation « prix uniques », cf. le refMap
// de useProjectCalculations) : « GNT 0/80 » peut apparaître 3 fois sous le même
// n° P.22. Une Map<désignation, itemId> ne retient alors qu'une occurrence :
//   - les autres articles restent à 0 € (montant de l'offre sous-évalué) ;
//   - la quantité lue sur la 1re ligne est comparée à la quantité MOE d'un
//     AUTRE article → fausse divergence → offre auto-classée « irrégulière »
//     au titre du CCP L2152-2.
//
// Stratégie : chaque désignation porte la LISTE de ses articles dans l'ordre du
// document ; chaque ligne du fichier consomme le prochain article encore libre.
// Sur un aller-retour du gabarit exporté par Estima, l'ordre est identique donc
// la correspondance est exacte. Garde-fou : si la quantité de la ligne
// correspond exactement à celle d'un candidat libre, ce candidat l'emporte sur
// le candidat positionnel — l'entreprise a pu réordonner des lignes.
//
// Les normalisations sont injectées par l'appelant : elles vivent déjà dans
// usePriceAnalysis et sont partagées telles quelles par les deux imports.

import { findBestPrefixMatch } from './analysisCompute';

const round6 = (n) => Math.round(Number(n || 0) * 1e6) / 1e6;

/**
 * @param {Object}   p
 * @param {Array}    p.chaptersData   chapitres aplatis ({ items: [...] }), ordre document
 * @param {Object}   p.project        { chapters } — pour le fallback par n° de prix
 * @param {Map|Object} p.moeQtyMap    itemId → quantité MOE de la tranche active
 * @param {Function} p.normalizeDesignation
 * @param {Function} p.normalizeRef
 */
export function createOfferItemMatcher({
  chaptersData,
  project,
  moeQtyMap,
  normalizeDesignation,
  normalizeRef,
}) {
  // désignation normalisée → [itemId, ...] dans l'ordre du document
  const candidates = new Map();
  const itemIdToDesignation = new Map();
  const itemIdToUnit = new Map();
  // Map<désignation, itemId> à valeur simple, requise par findBestPrefixMatch
  const prefixMap = new Map();

  (chaptersData || []).forEach(chap => {
    (chap.items || []).forEach(item => {
      if (!item.designation) return;
      const key = normalizeDesignation(item.designation);
      if (!candidates.has(key)) candidates.set(key, []);
      candidates.get(key).push(item.id);
      itemIdToDesignation.set(item.id, item.designation);
      itemIdToUnit.set(item.id, item.unit || '');
      if (!prefixMap.has(key)) prefixMap.set(key, item.id);
    });
  });

  // Fallback par n° de prix, en DEUX passes : les références réellement saisies
  // (bpuNum) d'abord, la numérotation automatique ensuite.
  //
  // En une seule passe, le « P.43 » automatique du 43e article s'enregistre
  // avant que le traversal n'atteigne le véritable article P.43 — décalé plus
  // loin dès qu'un prix est réutilisé, la numérotation « prix uniques » ne
  // réincrémentant pas sur un doublon. Le vrai P.43 trouve alors sa clé prise et
  // devient inatteignable : une ligne dont la désignation a été retouchée par
  // l'entreprise est rattachée au mauvais article (constaté sur un DQE PDF où
  // « CANALISATION EU » avait été saisi « CANALISATION EP »).
  const projectRefMap = new Map();
  if (project?.chapters) {
    const ordered = [];
    const traverse = (items) => {
      if (!items) return;
      items.forEach(item => {
        if (item.type === 'item') ordered.push(item);
        if (item.children?.length > 0) traverse(item.children);
      });
    };
    project.chapters.forEach(chap => { if (chap.children) traverse(chap.children); });

    ordered.forEach(item => {
      const bpuRef = item.bpuNum ? normalizeRef(item.bpuNum) : null;
      if (bpuRef && !projectRefMap.has(bpuRef)) projectRefMap.set(bpuRef, item.id);
    });
    // L'export numérote « P.1 »… sans zéro de tête ; des fichiers plus anciens
    // portent « P.01 ». normalizeRef retirant le point, on enregistre les deux
    // formes — sans jamais écraser une référence saisie.
    ordered.forEach((item, i) => {
      const n = i + 1;
      [`P.${n}`, `P.${String(n).padStart(2, '0')}`].forEach(raw => {
        const key = normalizeRef(raw);
        if (!projectRefMap.has(key)) projectRefMap.set(key, item.id);
      });
    });
  }

  const moeQtyOf = (itemId) =>
    round6(moeQtyMap?.get?.(String(itemId)) ?? moeQtyMap?.[itemId] ?? 0);

  const used = new Set();

  const pickByDesignation = (key, offerQty, consume) => {
    const list = candidates.get(key);
    if (!list?.length) return null;
    // Rang de mise en forme : il ne consomme pas d'occurrence. Comportement
    // historique conservé (« dernier gagne »), son prix nul sera écrasé par la
    // vraie ligne article qui suit.
    if (!consume) return list[list.length - 1];

    const free = list.filter(id => !used.has(id));
    // Plus de candidat libre : le fichier contient plus de lignes que le DQE
    // pour cette désignation → on retombe sur le comportement historique.
    if (free.length === 0) return list[list.length - 1];

    let chosen = free[0];
    if (free.length > 1 && offerQty > 0) {
      const exact = free.find(id => moeQtyOf(id) === round6(offerQty));
      if (exact) chosen = exact;
    }
    used.add(chosen);
    return chosen;
  };

  return {
    itemIdToDesignation,
    itemIdToUnit,
    projectRefMap,

    /**
     * @param {Object}  row
     * @param {string}  row.designationNorm  désignation déjà normalisée
     * @param {string}  [row.refRaw]         contenu brut de la colonne n° de prix
     * @param {number}  [row.qty]            quantité lue dans le fichier offre
     * @param {boolean} [row.consume]        false pour un rang de mise en forme
     * @returns {{ itemId: string|null, via: 'designation'|'ref'|'prefix'|null }}
     */
    resolve({ designationNorm, refRaw = '', qty = 0, consume = true }) {
      const byDesignation = pickByDesignation(designationNorm, qty, consume);
      if (byDesignation) return { itemId: byDesignation, via: 'designation' };

      const refNorm = normalizeRef(refRaw);
      if (refNorm && projectRefMap.has(refNorm)) {
        return { itemId: projectRefMap.get(refNorm), via: 'ref' };
      }

      const candidate = findBestPrefixMatch(designationNorm, prefixMap);
      if (candidate) return { itemId: candidate, via: 'prefix' };

      return { itemId: null, via: null };
    },
  };
}
