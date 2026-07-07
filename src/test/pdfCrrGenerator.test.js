// Test de fumee pour src/utils/pdfCrrGenerator.js
// Exerce reellement le chemin de rendu (autoTable + calque texte formate) afin
// de garder un garde-fou apres le fix "double rendu" (cellText='' si formate).
import { describe, it, expect } from 'vitest';
import { generatePdfCrr } from '../utils/pdfCrrGenerator';

const meeting = {
  id: 'm1', number: 3, type: 'chantier', date: '2026-06-17',
  nextMeeting: {}, attendance: {}, diffusion: {},
  observations: [
    // Texte MIS EN FORME → rendu par le calque (cellText='' cote autoTable)
    {
      id: 'o1', obsKey: 'k1', seq: 4, category: 'Travaux', status: 'open',
      emitter: 'MOE', actionBy: 'Entreprises', actionDeadline: '2026-06-24',
      originMeetingNumber: 1, date: '2026-06-01',
      text: '<b>Reprise enrobe</b><ul><li>rive nord</li><li>rive sud</li></ul>',
      images: [],
    },
    // Texte BRUT → rendu directement par autoTable (pas de calque)
    {
      id: 'o2', obsKey: 'k2', seq: 5, category: 'Travaux', status: 'done',
      emitter: '', actionBy: '', actionDeadline: '',
      originMeetingNumber: 3, date: '2026-06-17',
      text: 'Texte simple sans mise en forme', images: [],
    },
  ],
};

const crrConfig = {
  participantGroups: [
    { id: 'g_moe', name: 'MOE', contacts: [] },
    { id: 'g_ent', name: 'Entreprises', contacts: [] },
  ],
  categories: ['Travaux'],
  categoryCodes: { Travaux: 'CHANTIER' },
  legalText: 'Texte legal de test.',
  chantierInfo: {},
};

const branding = { companyName: 'Test SARL', fonts: {}, colors: {} };

describe('generatePdfCrr (fumee)', () => {
  it('produit un blob PDF non vide (texte formate + texte brut, sans planter)', async () => {
    const res = await generatePdfCrr(meeting, crrConfig, 'Projet Test', branding, { returnBlob: true });
    expect(res).toBeTruthy();
    expect(res.blob).toBeInstanceOf(Blob);
    expect(res.blob.size).toBeGreaterThan(800);
    expect(res.filename).toMatch(/\.pdf$/);
  });

  it('rend les sous-groupes (bandeau + contacts, rowSpan mixte) sans planter', async () => {
    const cfg = {
      ...crrConfig,
      participantGroups: [
        // Groupe avec contacts directs ET sous-groupes (cas le plus complexe)
        {
          id: 'g_ent', name: 'Entreprises', subLabel: '',
          contacts: [{ id: 'c0', name: 'DIRECT Marc', fonction: 'Coordinateur', email: 'm@e.fr', phone: '', cpr: true }],
          subGroups: [
            {
              id: 's1', name: 'Lot 1 VRD',
              contacts: [
                { id: 'c1', name: 'DUPONT Jean', fonction: 'Conducteur de travaux', email: 'j@e.fr', phone: '0611', cpr: false },
                { id: 'c2', name: 'MARTIN Paul', fonction: '', email: 'p@e.fr', phone: '', cpr: false },
              ],
            },
            { id: 's2', name: 'Lot 2 Espaces verts', contacts: [] },
          ],
        },
        // Groupe SANS sous-groupes (retro-compat : pas de champ subGroups)
        { id: 'g_moe', name: 'MOE', contacts: [{ id: 'c3', name: 'BER Luc', email: 'l@m.fr', cpr: false }] },
        // Titre TRES long → doit revenir a la ligne dans la colonne role (30 mm)
        {
          id: 'g_long',
          name: "Maitrise d'ouvrage deleguee de la communaute de communes du Grand Bassin Sud-Ouest",
          subLabel: 'Direction des services techniques et de l amenagement du territoire',
          contacts: [{ id: 'c4', name: 'VERYLONGSURNAME Jean-Christophe', fonction: 'Directeur general adjoint des services techniques', email: 'jc@x.fr', phone: '0611', cpr: true }],
        },
        // Groupe vide
        { id: 'g_sps', name: 'SPS', contacts: [] },
      ],
    };
    const m = { ...meeting, attendance: { c1: 'present' }, diffusion: { c2: true } };
    const res = await generatePdfCrr(m, cfg, 'Projet Sous-Groupes', branding, { returnBlob: true });
    expect(res.blob).toBeInstanceOf(Blob);
    expect(res.blob.size).toBeGreaterThan(800);
  });
});
