// src/test/crrImagePaths.test.js
//
// Garde-fou contre la perte de photos observee en prod (2026-07-21) : une
// observation reportee d'un CR au suivant partage la MEME entree image, donc
// le meme fichier Storage. Supprimer l'observation cote CR recent effacait le
// blob et cassait la photo des CR anterieurs (URL 404 dans le document).
import { describe, it, expect } from 'vitest';
import { collectStoragePaths } from '../utils/crrImageStorage';

const img = (path) => ({ src: `https://firebasestorage/x/${path}`, path });

describe('collectStoragePaths', () => {
  it('recense les paths Storage de toutes les reunions', () => {
    const meetings = [
      { id: 'm1', observations: [{ id: 'o1', images: [img('a.jpg'), img('b.jpg')] }] },
      { id: 'm2', observations: [{ id: 'o2', images: [img('c.jpg')] }] },
    ];
    expect(collectStoragePaths(meetings)).toEqual(new Set(['a.jpg', 'b.jpg', 'c.jpg']));
  });

  it('dedoublonne un path partage par deux CR (observation reportee)', () => {
    const shared = img('partagee.jpg');
    const meetings = [
      { id: 'm1', observations: [{ id: 'o1', images: [shared] }] },
      { id: 'm2', observations: [{ id: 'o1bis', images: [shared] }] },
    ];
    expect(collectStoragePaths(meetings)).toEqual(new Set(['partagee.jpg']));
  });

  it('un path encore reference apres suppression d\'un CR est protege', () => {
    const shared = img('partagee.jpg');
    const meetings = [
      { id: 'm1', observations: [{ id: 'o1', images: [shared, img('propre-m1.jpg')] }] },
      { id: 'm2', observations: [{ id: 'o2', images: [shared] }] },
    ];
    // Etat APRES suppression du CR m1 : m2 reference encore la photo partagee.
    const apres = meetings.filter((m) => m.id !== 'm2');
    const restants = collectStoragePaths(apres);
    expect(restants.has('partagee.jpg')).toBe(true);   // ne doit PAS etre purgee
    expect(restants.has('propre-m1.jpg')).toBe(true);
  });

  it('ignore le base64 (string ou objet sans path) et les entrees vides', () => {
    const meetings = [
      {
        id: 'm1',
        observations: [
          { id: 'o1', images: ['data:image/jpeg;base64,AAA', { src: 'data:image/png;base64,BBB' }, null] },
          { id: 'o2' },
          { id: 'o3', images: [] },
        ],
      },
      { id: 'm2' },
    ];
    expect(collectStoragePaths(meetings)).toEqual(new Set());
  });

  it('tolere les entrees nulles', () => {
    expect(collectStoragePaths(null)).toEqual(new Set());
    expect(collectStoragePaths([])).toEqual(new Set());
  });
});
