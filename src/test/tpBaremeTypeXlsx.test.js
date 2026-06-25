// src/test/tpBaremeTypeXlsx.test.js
// Round-trip export → reparse du barème par type (sans navigateur).
import { describe, it, expect } from 'vitest';
import { buildBaremeTypeBlob, buildBaremeAllBlob, parseBaremeTypeXlsx } from '../utils/tp/tpBaremeTypeXlsx';

// Petit faux File à partir d'un Blob (parseBaremeTypeXlsx n'utilise que name + arrayBuffer()).
const asFile = (blob, name) => ({ name, arrayBuffer: () => blob.arrayBuffer() });

const RES = [
  { id: '1', category: 'materiel', designation: 'Pelle 20T', unit: 'J', puJour: 100, amort: 50, entret: 10, cons: 20, loc: 30 },
  { id: '2', category: 'materiel', designation: 'Compacteur', unit: 'J', puJour: 80, amort: 40, entret: 5, cons: 10, loc: 15 },
  { id: '3', category: 'mo', designation: 'Chef de chantier', unit: 'J', puJour: 300 },
  { id: '4', category: 'fourniture', designation: 'GNT 0/31.5', unit: 'T', puBareme: 18.5 },
  { id: '5', category: 'soustraitance', designation: 'Forage dirigé', unit: 'ML', puBareme: 42 },
  { id: '6', category: 'transport', designation: 'Semi 25T', unit: 'T', contenance: 25, coutJour: 650 },
];

describe('barème par type — round-trip xlsx', () => {
  it('exporte puis relit le matériel avec toutes ses colonnes', async () => {
    const { blob, count } = await buildBaremeTypeBlob('materiel', RES);
    expect(count).toBe(2); // 2 matériel (le MO n'est pas inclus)
    const { categories, resources } = await parseBaremeTypeXlsx(asFile(blob, 'Bareme_Materiel.xlsx'));
    expect(categories).toEqual(['materiel']);
    expect(resources).toHaveLength(2);
    const pelle = resources.find(r => r.designation === 'Pelle 20T');
    expect(pelle).toMatchObject({ category: 'materiel', unit: 'J', puJour: 100, amort: 50, entret: 10, cons: 20, loc: 30 });
  });

  it('détecte le type via le nom d\'onglet "Main d\'œuvre"', async () => {
    const { blob, count } = await buildBaremeTypeBlob('mo', RES);
    expect(count).toBe(1);
    const { categories, resources } = await parseBaremeTypeXlsx(asFile(blob, 'fichier-renomme.xlsx'));
    expect(categories).toEqual(['mo']);
    expect(resources[0]).toMatchObject({ designation: 'Chef de chantier', puJour: 300 });
  });

  it('exporte/relit les fournitures (PU barème)', async () => {
    const { blob, count } = await buildBaremeTypeBlob('fourniture', RES);
    expect(count).toBe(1);
    const { categories, resources } = await parseBaremeTypeXlsx(asFile(blob, 'Bareme_Fournitures.xlsx'));
    expect(categories).toEqual(['fourniture']);
    expect(resources[0]).toMatchObject({ designation: 'GNT 0/31.5', unit: 'T', puBareme: 18.5 });
  });

  it('exporte/relit le transport (contenance + coût/jour)', async () => {
    const { blob, count } = await buildBaremeTypeBlob('transport', RES);
    expect(count).toBe(1);
    const { categories, resources } = await parseBaremeTypeXlsx(asFile(blob, 'Bareme_Transport.xlsx'));
    expect(categories).toEqual(['transport']);
    expect(resources[0]).toMatchObject({ designation: 'Semi 25T', contenance: 25, coutJour: 650 });
  });

  it('« Tout exporter » : un classeur multi-onglets relu intégralement', async () => {
    const { blob, count } = await buildBaremeAllBlob(RES);
    expect(count).toBe(RES.length); // 6 ressources, tous postes confondus
    const { categories, resources } = await parseBaremeTypeXlsx(asFile(blob, 'Bareme_complet.xlsx'));
    expect(categories).toEqual(['materiel', 'mo', 'fourniture', 'soustraitance', 'transport']);
    expect(resources).toHaveLength(6);
    // chaque ressource retrouve sa catégorie via le nom d'onglet
    expect(resources.find(r => r.designation === 'Semi 25T')).toMatchObject({ category: 'transport', contenance: 25, coutJour: 650 });
    expect(resources.find(r => r.designation === 'Forage dirigé')).toMatchObject({ category: 'soustraitance', puBareme: 42 });
  });

  it('ignore la colonne calculée (PU/jour) au réimport', async () => {
    const { blob } = await buildBaremeTypeBlob('materiel', RES);
    const { resources } = await parseBaremeTypeXlsx(asFile(blob, 'Bareme_Materiel.xlsx'));
    const pelle = resources.find(r => r.designation === 'Pelle 20T');
    expect(pelle.puJourCalc).toBeUndefined();
    expect(Object.keys(pelle).sort()).toEqual(
      ['amort', 'category', 'cons', 'contenance', 'coutJour', 'designation', 'entret', 'loc', 'puBareme', 'puJour', 'unit'].sort()
    );
  });
});
