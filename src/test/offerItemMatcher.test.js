import { describe, it, expect } from 'vitest';
import { createOfferItemMatcher } from '../utils/offerItemMatcher';

// Normalisations identiques à celles de usePriceAnalysis (injectées par l'appelant)
const normalizeDesignation = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/['"]/g, '')
  .replace(/[.,;:()[\]]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();
const normalizeRef = (s) => (s || '').replace(/[\s.\-_]/g, '').toUpperCase().trim();

// DQE réel (BOUT DU PONT DE L'ARN) réduit à ses désignations répétées : le même
// prix est réutilisé dans plusieurs sous-chapitres avec des quantités
// différentes — c'est la numérotation « prix uniques ».
const ITEMS = [
  { id: 'i1', designation: 'ENDUIT DE SCELLEMENT',                     unit: 'M2', bpuNum: 'P.20', qty: 352 },
  { id: 'i2', designation: 'BÉTONS BITUMINEUX SEMI GRENU 0/10 POUR VOIRIE', unit: 'T', bpuNum: 'P.21', qty: 52 },
  { id: 'i3', designation: 'GNT 0/80',                                 unit: 'M3', bpuNum: 'P.22', qty: 260 },
  { id: 'i4', designation: 'GRAVES NON TRAITÉES 0/20 SOUS VOIRIE',     unit: 'M3', bpuNum: 'P.23', qty: 98 },
  { id: 'i5', designation: 'ENDUIT DE SCELLEMENT',                     unit: 'M2', bpuNum: 'P.20', qty: 651 },
  { id: 'i6', designation: 'BÉTONS BITUMINEUX SEMI GRENU 0/10 POUR VOIRIE', unit: 'T', bpuNum: 'P.21', qty: 96 },
  { id: 'i7', designation: 'GNT 0/80',                                 unit: 'M3', bpuNum: 'P.22', qty: 15 },
  { id: 'i8', designation: 'GRAVES NON TRAITÉES 0/20 SOUS VOIRIE',     unit: 'M3', bpuNum: 'P.23', qty: 8 },
  { id: 'i9', designation: 'GNT 0/80',                                 unit: 'M3', bpuNum: 'P.22', qty: 83 },
];

const chaptersData = [{ id: 'c1', title: 'CHAUSSÉE - TROTTOIRS', items: ITEMS }];
const project = {
  chapters: [{ id: 'c1', children: ITEMS.map(i => ({ ...i, type: 'item' })) }],
};
const moeQtyMap = new Map(ITEMS.map(i => [i.id, i.qty]));

const makeMatcher = () => createOfferItemMatcher({
  chaptersData, project, moeQtyMap, normalizeDesignation, normalizeRef,
});

// Une ligne du fichier offre telle que lue par handleImportExcel
const row = (item) => ({
  designationNorm: normalizeDesignation(item.designation),
  refRaw: item.bpuNum,
  qty: item.qty,
});

describe('createOfferItemMatcher — désignations répétées', () => {
  it('attribue une ligne distincte à chaque occurrence, dans l’ordre du document', () => {
    const m = makeMatcher();
    const resolved = ITEMS.map(it => m.resolve(row(it)).itemId);
    expect(resolved).toEqual(ITEMS.map(it => it.id));
  });

  it('ne laisse aucun article sans prix (régression : −27 007,80 € sur EIFFAGE)', () => {
    const m = makeMatcher();
    const offers = {};
    ITEMS.forEach((it, idx) => {
      const { itemId } = m.resolve(row(it));
      offers[itemId] = idx + 1; // PU factice, distinct par ligne
    });
    expect(Object.keys(offers)).toHaveLength(ITEMS.length);
    ITEMS.forEach(it => expect(offers[it.id]).toBeGreaterThan(0));
  });

  it('ne déclenche aucune divergence de quantité sur une offre conforme', () => {
    const m = makeMatcher();
    const mismatches = [];
    ITEMS.forEach(it => {
      const { itemId } = m.resolve(row(it));
      const moeQty = moeQtyMap.get(itemId);
      if (moeQty > 0 && it.qty !== moeQty) mismatches.push(itemId);
    });
    expect(mismatches).toEqual([]);
  });

  it('rattache la bonne occurrence même si l’entreprise réordonne les lignes', () => {
    const m = makeMatcher();
    // GNT 0/80 remonté dans l'ordre 15 → 83 → 260 (le DQE dit 260 → 15 → 83)
    expect(m.resolve({ designationNorm: 'GNT 0/80', refRaw: 'P.22', qty: 15 }).itemId).toBe('i7');
    expect(m.resolve({ designationNorm: 'GNT 0/80', refRaw: 'P.22', qty: 83 }).itemId).toBe('i9');
    expect(m.resolve({ designationNorm: 'GNT 0/80', refRaw: 'P.22', qty: 260 }).itemId).toBe('i3');
  });

  it('conserve la divergence de quantité quand l’entreprise modifie une quantité (CCP L2152-2)', () => {
    const m = makeMatcher();
    // 352 → 400 : aucune occurrence libre ne colle, le positionnel s'applique
    const { itemId } = m.resolve({ designationNorm: 'ENDUIT DE SCELLEMENT', refRaw: 'P.20', qty: 400 });
    expect(itemId).toBe('i1');
    expect(moeQtyMap.get(itemId)).toBe(352); // divergence bien détectable
  });

  it('un titre de chapitre homonyme ne consomme pas l’occurrence de l’article', () => {
    const m = makeMatcher();
    // Rang de mise en forme : pas de ref, ni quantité, ni prix
    const header = m.resolve({ designationNorm: 'GNT 0/80', refRaw: '', qty: 0, consume: false });
    expect(header.itemId).toBe('i9'); // comportement historique « dernier gagne »
    // Les 3 articles restent tous attribuables
    expect(m.resolve({ designationNorm: 'GNT 0/80', refRaw: 'P.22', qty: 260 }).itemId).toBe('i3');
    expect(m.resolve({ designationNorm: 'GNT 0/80', refRaw: 'P.22', qty: 15 }).itemId).toBe('i7');
    expect(m.resolve({ designationNorm: 'GNT 0/80', refRaw: 'P.22', qty: 83 }).itemId).toBe('i9');
  });

  it('retombe sur le n° de prix quand la désignation a été modifiée', () => {
    const m = makeMatcher();
    const r = m.resolve({ designationNorm: 'ENDUIT DE SCELLEMENT MODIFIE PAR L ENTREPRISE XYZ', refRaw: 'P.20', qty: 352 });
    expect(r.via).toBe('ref');
    expect(r.itemId).toBe('i1');
  });

  it('rattache le VRAI article P.xx malgré le décalage de la numérotation auto', () => {
    // La numérotation automatique ne réincrémente pas sur un prix réutilisé :
    // ITEMS[8] (9e article) porte le n° P.22. Le « P.9 » automatique attribué au
    // 9e article ne doit pas prendre la clé d'un article réellement numéroté P.9,
    // ni un P.22 automatique masquer le vrai P.22. Cas rencontré sur un DQE PDF
    // où l'entreprise avait retouché une désignation : la ligne partait alors sur
    // le mauvais article et le bon restait à 0 €.
    const m = makeMatcher();
    const r = m.resolve({ designationNorm: 'DESIGNATION RETOUCHEE PAR L ENTREPRISE', refRaw: 'P.23', qty: 98 });
    expect(r.via).toBe('ref');
    expect(m.itemIdToDesignation.get(r.itemId)).toBe('GRAVES NON TRAITÉES 0/20 SOUS VOIRIE');
  });

  it('ne rend aucun article quand la ligne est inconnue', () => {
    const m = makeMatcher();
    const r = m.resolve({ designationNorm: 'FOURNITURE DE ZEBRES DACIER', refRaw: 'Z.99', qty: 3 });
    expect(r.itemId).toBeNull();
    expect(r.via).toBeNull();
  });
});
