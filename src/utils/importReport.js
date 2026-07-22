// src/utils/importReport.js
//
// Rapport d'import d'une offre entreprise : rend VISIBLES les anomalies qui ne
// partaient jusqu'ici qu'en console.warn — un article laissé à 0 € n'apparaissait
// dans aucun toast ni panneau, seul l'écart AE (indirect) trahissait le problème.
//
// Deux listes :
//   - zeroPriceItems : articles de la tranche active restés SANS prix après ce
//     fichier (ils comptent 0 € dans l'analyse → total d'offre minoré). Les
//     articles hors tranche (qté MOE nulle) sont exclus : un prix absent y est
//     normal. Chaque article porte son n° de prix via buildRefMap — la même
//     numérotation que le DQE envoyé aux entreprises.
//   - unmatched : lignes du fichier qu'aucun article n'a reçues (désignation et
//     n° de prix inconnus du DQE).
//
// Pure : aucune dépendance React, testable telle quelle.

import { buildRefMap } from './projectCalculations';

const round6 = (n) => Math.round(Number(n || 0) * 1e6) / 1e6;

/**
 * @param {Object} p
 * @param {Object} p.project          { chapters } — pour la numérotation buildRefMap
 * @param {Object} [p.bpuConfig]      mode de numérotation du projet
 * @param {Array}  p.chaptersData     chapitres aplatis ({ items }) de la tranche active
 * @param {Object} p.importedOffers   itemId → PU importé depuis CE fichier
 * @param {Map|Object} p.moeQtyMap    itemId → quantité MOE de la tranche active
 * @param {Array}  [p.unmatchedDetails] lignes non rattachées ({ sheet, row, ref, designation })
 * @param {Object} [p.stats]          compteurs ({ totalRows, matchCount, refMatchedRows, ... })
 * @returns {{ zeroPriceItems, unmatched, stats, hasAnomalies }}
 */
export function buildOfferImportReport({
  project,
  bpuConfig,
  chaptersData,
  importedOffers,
  moeQtyMap,
  unmatchedDetails,
  stats,
}) {
  const refMap = buildRefMap(project?.chapters || [], bpuConfig || {});

  const zeroPriceItems = [];
  (chaptersData || []).forEach(chap => {
    (chap.items || []).forEach(item => {
      if (Number(importedOffers?.[item.id] ?? 0) > 0) return;
      const moeQty = round6(moeQtyMap?.get?.(String(item.id)) ?? moeQtyMap?.[item.id] ?? 0);
      if (moeQty <= 0) return; // hors tranche active : prix absent = normal
      zeroPriceItems.push({
        itemId: item.id,
        ref: refMap.get(item.id) || '',
        designation: item.designation || '',
        unit: item.unit || '',
        moeQty,
      });
    });
  });

  const unmatched = unmatchedDetails || [];
  return {
    zeroPriceItems,
    unmatched,
    stats: stats || {},
    hasAnomalies: zeroPriceItems.length > 0 || unmatched.length > 0,
  };
}
