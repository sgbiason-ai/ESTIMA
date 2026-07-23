import { describe, expect, it } from 'vitest';
import {
  buildMobileDocAdminExportContext,
  getMobileDocAdminExportTargets,
} from '../utils/docAdmin/mobileExportContext';

const ficheAllotie = {
  nom: 'Marché voirie',
  sectionB: {
    mandataire: { nomCommercial: 'Mandataire global' },
    groupesAttributaires: [
      {
        groupeId: 'g1',
        entreprise: { nomCommercial: 'Routes SA', siret: '111' },
        lotIndices: [0, 2],
      },
      {
        groupeId: 'g2',
        entreprise: { denominationSociale: 'Éclairage SRL' },
        lotIndices: [1],
      },
    ],
  },
  sectionD: {
    objet: 'Travaux',
    lots: [
      { numero: '1', designation: 'Voirie' },
      { numero: '2', designation: 'Éclairage' },
      { numero: '3', designation: 'Signalisation' },
    ],
  },
  exeParEntreprise: {
    g1: { exe1: [{ numeroOrdreService: '1' }], reception: { dateOPR: '2026-07-01' } },
    g2: { exe1: [{ numeroOrdreService: '2' }], reception: {} },
  },
};

describe('contexte des exports administratifs mobiles', () => {
  it('liste chaque attributaire avec ses lots', () => {
    const targets = getMobileDocAdminExportTargets(ficheAllotie);

    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({
      groupeId: 'g1',
      name: 'Routes SA',
      lotLabels: ['Lot 1 — Voirie', 'Lot 3 — Signalisation'],
    });
    expect(targets[1].lotLabels).toEqual(['Lot 2 — Éclairage']);
  });

  it('construit une fiche limitée à l’attributaire sélectionné', () => {
    const context = buildMobileDocAdminExportContext(ficheAllotie, 'g2');

    expect(context.fiche.sectionB.mandataire).toEqual({
      denominationSociale: 'Éclairage SRL',
    });
    expect(context.fiche.sectionB.groupesAttributaires).toBeUndefined();
    expect(context.fiche.sectionD.lots).toEqual([
      { numero: '2', designation: 'Éclairage' },
    ]);
    expect(context.fiche.exe1).toEqual([{ numeroOrdreService: '2' }]);
  });

  it('conserve le fonctionnement racine d’un marché non alloti', () => {
    const fiche = {
      sectionB: { mandataire: { nomCommercial: 'Entreprise seule' } },
      sectionD: { lots: [] },
      exe1: [{ numeroOrdreService: '1' }],
      reception: { dateOPR: '2026-07-01' },
    };

    expect(getMobileDocAdminExportTargets(fiche)).toHaveLength(1);
    const context = buildMobileDocAdminExportContext(fiche, '_root');
    expect(context.fiche).toBe(fiche);
    expect(context.data.exe1).toHaveLength(1);
  });

  it('refuse un attributaire inconnu', () => {
    expect(() => buildMobileDocAdminExportContext(ficheAllotie, 'absent'))
      .toThrow('Attributaire introuvable');
  });
});
