import { describe, it, expect } from 'vitest';
import { buildOfferImportReport } from '../utils/importReport';

// Projet avec un prix réutilisé (« GNT 0/80 » ×2) : la numérotation du rapport
// doit être celle du DQE (buildRefMap, registre de prix uniques), pas un
// compteur par article.
const ITEMS = [
  { id: 'a', type: 'item', designation: 'DÉCAPAGE TERRE VÉGÉTALE', unit: 'M3', price: 0 },
  { id: 'b', type: 'item', designation: 'GNT 0/80', unit: 'M3', price: 0 },
  { id: 'c', type: 'item', designation: 'GNT 0/80', unit: 'M3', price: 0 },
  { id: 'd', type: 'item', designation: 'ENDUIT DE SCELLEMENT', unit: 'M2', price: 0 },
];
const project = { chapters: [{ id: 'ch', type: 'chapter', children: ITEMS }] };
const chaptersData = [{ id: 'ch', items: ITEMS }];
const moeQtyMap = new Map([['a', 637], ['b', 260], ['c', 15], ['d', 0]]); // d hors tranche

describe('buildOfferImportReport', () => {
  it('liste les articles de la tranche restés sans prix, avec le n° du DQE', () => {
    const r = buildOfferImportReport({
      project, bpuConfig: {}, chaptersData,
      importedOffers: { a: 5.4 },           // b et c sans prix ; d hors tranche
      moeQtyMap, unmatchedDetails: [], stats: {},
    });
    expect(r.hasAnomalies).toBe(true);
    expect(r.zeroPriceItems.map(z => z.itemId)).toEqual(['b', 'c']);
    // b et c partagent le même prix → même numéro P.2 (unicité, comme le DQE)
    expect(r.zeroPriceItems.map(z => z.ref)).toEqual(['P.2', 'P.2']);
    expect(r.zeroPriceItems[0].moeQty).toBe(260);
  });

  it('n’alerte pas sur un article hors tranche active (qté MOE nulle)', () => {
    const r = buildOfferImportReport({
      project, bpuConfig: {}, chaptersData,
      importedOffers: { a: 5.4, b: 44.8, c: 44.8 },
      moeQtyMap, unmatchedDetails: [], stats: {},
    });
    expect(r.zeroPriceItems).toEqual([]); // d (qté 0) ne doit pas apparaître
    expect(r.hasAnomalies).toBe(false);
  });

  it('un prix à 0 importé est traité comme absent', () => {
    const r = buildOfferImportReport({
      project, bpuConfig: {}, chaptersData,
      importedOffers: { a: 5.4, b: 0, c: 44.8 },
      moeQtyMap, unmatchedDetails: [], stats: {},
    });
    expect(r.zeroPriceItems.map(z => z.itemId)).toEqual(['b']);
  });

  it('relaie les lignes non rattachées et les stats', () => {
    const unmatched = [{ sheet: 'GLOBAL', row: 12, ref: 'X.9', designation: 'HORS DQE' }];
    const r = buildOfferImportReport({
      project, bpuConfig: {}, chaptersData,
      importedOffers: { a: 1, b: 2, c: 3 },
      moeQtyMap, unmatchedDetails: unmatched, stats: { totalRows: 10, matchCount: 3 },
    });
    expect(r.unmatched).toEqual(unmatched);
    expect(r.stats.totalRows).toBe(10);
    expect(r.hasAnomalies).toBe(true); // à cause de la ligne non rattachée
  });
});
