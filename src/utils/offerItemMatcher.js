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
import { buildRefMap } from './projectCalculations';

const round6 = (n) => Math.round(Number(n || 0) * 1e6) / 1e6;

/**
 * @param {Object}   p
 * @param {Array}    p.chaptersData   chapitres aplatis ({ items: [...] }), ordre document
 * @param {Object}   p.project        { chapters } — pour le fallback par n° de prix
 * @param {Object}   [p.bpuConfig]    mode de numérotation (auto / manual / hierarchical) :
 *                                    doit être celui du projet, sinon les numéros
 *                                    reconstruits ne correspondent pas au DQE envoyé
 * @param {Map|Object} p.moeQtyMap    itemId → quantité MOE de la tranche active
 * @param {Function} p.normalizeDesignation
 * @param {Function} p.normalizeRef
 */
export function createOfferItemMatcher({
  chaptersData,
  project,
  bpuConfig,
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

  // Fallback par n° de prix. La numérotation vient de buildRefMap — la MÊME
  // fonction que celle qui numérote le DQE exporté, donc les deux ne peuvent
  // plus diverger.
  //
  // Une numérotation maison « un P.n par article » est fausse : le registre de
  // prix uniques n'incrémente le compteur que sur un prix NOUVEAU, si bien qu'un
  // DQE de 79 lignes ne compte que 73 numéros. Le « P.43 » naïf tombait sur le
  // 43e article du document au lieu du véritable P.43, situé plus loin (65 des
  // 79 articles étaient mal numérotés). Une ligne dont l'entreprise a retouché
  // la désignation partait alors sur le mauvais article et le bon restait à 0 €
  // — écart de 3 405,60 € constaté en production sur une offre PDF où
  // « CANALISATION EU » avait été saisi « CANALISATION EP ».
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

    // Références réellement saisies d'abord : elles priment sur toute
    // numérotation calculée et ne doivent jamais se faire souffler leur clé.
    ordered.forEach(item => {
      const bpuRef = item.bpuNum ? normalizeRef(item.bpuNum) : null;
      if (bpuRef && !projectRefMap.has(bpuRef)) projectRefMap.set(bpuRef, item.id);
    });

    const refMap = buildRefMap(project.chapters, bpuConfig || {});
    ordered.forEach(item => {
      const ref = refMap.get(item.id);
      if (!ref) return;
      // L'export écrit « P.1 » sans zéro de tête, d'anciens fichiers « P.01 » ;
      // normalizeRef retirant le point, les deux formes doivent être connues.
      const variants = [ref];
      const m = /^P\.?(\d+)$/i.exec(String(ref).trim());
      if (m) variants.push(`P.${m[1].padStart(2, '0')}`, `P.${Number(m[1])}`);
      variants.forEach(raw => {
        const key = normalizeRef(raw);
        if (key && !projectRefMap.has(key)) projectRefMap.set(key, item.id);
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
