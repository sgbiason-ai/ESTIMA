// src/test/estimRapideToProject.test.js
import { describe, it, expect } from 'vitest';
import { estimateToProject } from '../utils/estimRapideToProject';

const poste = (id, qty, ratio, { label = '', unit = 'u', formula } = {}) => ({ id, label, unit, qty, ratio, formula });
const est = (lots, extra = {}) => ({ id: 'E1', name: 'Mon estimation', client: 'Mairie', location: 'Albi', lots, ...extra });

// idFactory déterministe pour les tests
const counter = () => { let n = 0; return () => `gen${++n}`; };

describe('estimateToProject', () => {
  it('mappe lots→chapitres et postes→articles', () => {
    const p = estimateToProject(
      est([{ id: 'L1', key: 'voirie', label: 'Voirie', postes: [poste('p1', 100, 45, { label: 'Chaussée', unit: 'm²' })] }]),
      { idFactory: counter() }
    );
    expect(p.chapters).toHaveLength(1);
    const chap = p.chapters[0];
    expect(chap).toMatchObject({ id: 'L1', type: 'chapter', title: 'VOIRIE', isOption: false });
    expect(chap.children[0]).toMatchObject({ id: 'p1', type: 'item', designation: 'Chaussée', unit: 'm²', qty: 100, price: 45 });
  });

  it('reporte les métadonnées', () => {
    const p = estimateToProject(est([]), { idFactory: counter() });
    expect(p).toMatchObject({ name: 'Mon estimation', client: 'Mairie', location: 'Albi', convertedFromEstimate: 'E1', tranches: [] });
  });

  it('résout les formules et les conserve sur l\'article (id réutilisé)', () => {
    const p = estimateToProject(
      est([{ id: 'L1', key: 'k', label: 'Lot', postes: [
        poste('b', 10, 5),
        poste('a', 0, 5, { formula: '={b}*2' }),
      ] }]),
      { idFactory: counter() }
    );
    const items = p.chapters[0].children;
    const a = items.find(i => i.id === 'a');
    expect(a.qty).toBe(20);          // formule résolue
    expect(a.formula).toBe('={b}*2'); // formule conservée → réf {b} = item id 'b'
    expect(items.find(i => i.id === 'b').qty).toBe(10);
  });

  it('ajoute un chapitre Aléas quand activé', () => {
    const p = estimateToProject(
      est([{ id: 'L1', key: 'k', label: 'Lot', postes: [poste('p1', 10, 100)] }], { aleas: { enabled: true, percent: 10 } }),
      { idFactory: counter() }
    );
    expect(p.chapters).toHaveLength(2);
    const aleasChap = p.chapters[1];
    expect(aleasChap.title).toBe('ALÉAS / IMPRÉVUS');
    expect(aleasChap.children[0]).toMatchObject({ unit: 'forfait', qty: 1, price: 100 }); // 10% de 1000
  });

  it('pas de chapitre Aléas quand désactivé', () => {
    const p = estimateToProject(
      est([{ id: 'L1', key: 'k', label: 'Lot', postes: [poste('p1', 10, 100)] }], { aleas: { enabled: false, percent: 10 } }),
      { idFactory: counter() }
    );
    expect(p.chapters).toHaveLength(1);
  });

  it('le nom peut être surchargé', () => {
    const p = estimateToProject(est([]), { name: 'Projet X', idFactory: counter() });
    expect(p.name).toBe('Projet X');
  });
});
