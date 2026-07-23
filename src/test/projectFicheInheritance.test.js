import { describe, expect, it } from 'vitest';
import {
  durationToMonths,
  inheritFicheFromEstimaProject,
  splitMoeAddress,
} from '../utils/docAdmin/projectFicheInheritance';

const emptyFiche = () => ({
  id: 'fiche-1',
  nom: '',
  sectionA: {},
  sectionB: { mandataire: {}, cotraitants: [] },
  sectionC: {},
  sectionD: { lots: [] },
});

const project = {
  id: 'project-26',
  name: 'Aménagement du centre-bourg',
  subtitle1: 'Voirie et réseaux divers',
  projectDescription: 'Réfection complète des espaces publics.',
  client: 'Commune de Test',
  clientAddress: '1 place de la Mairie',
  clientZip: '81000',
  clientCity: 'Albi',
  moe: 'PAPYRUS',
  moeAddress: '21-23, route de la Pradine\n81500 Bannières',
  code: '26-0042',
  location: 'Centre-bourg de Test',
  prepPeriod: '1 mois',
  duration: '12 mois',
  lotName: 'VRD',
  lastSaved: '2026-07-23T08:00:00.000Z',
};

describe('héritage affaire EstimaVRD vers fiche marché', () => {
  it('reprend les champs compatibles et conserve la liaison source', () => {
    const { fiche, changes } = inheritFicheFromEstimaProject(
      emptyFiche(),
      project,
      '2026-07-23T10:00:00.000Z',
    );

    expect(fiche.nom).toBe(project.name);
    expect(fiche.sectionA).toMatchObject({
      designation: project.client,
      adresse: project.clientAddress,
      codePostal: project.clientZip,
      ville: project.clientCity,
    });
    expect(fiche.sectionC).toMatchObject({
      nomCommercial: 'PAPYRUS',
      adresse: '21-23, route de la Pradine',
      codePostal: '81500',
      ville: 'Bannières',
    });
    expect(fiche.sectionD).toMatchObject({
      referenceMarche: project.code,
      dureePeriodePreparation: '1',
      dureeExecution: '12',
      adresseExecution: project.location,
      lots: [{ numero: '1', designation: 'VRD', montantHT: '' }],
    });
    expect(fiche.sectionD.objet).toContain(project.name);
    expect(fiche.sectionD.objet).toContain(project.projectDescription);
    expect(fiche.sourceEstima).toMatchObject({
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      linkedAt: '2026-07-23T10:00:00.000Z',
      syncedAt: '2026-07-23T10:00:00.000Z',
    });
    expect(changes.some((change) => change.path === 'sectionA.designation')).toBe(true);
  });

  it('ne remplace pas une saisie par un champ source vide et préserve plusieurs lots', () => {
    const ficheInitiale = emptyFiche();
    ficheInitiale.sectionA.telephone = '05 00 00 00 00';
    ficheInitiale.sectionD.lots = [
      { numero: '1', designation: 'Terrassements', montantHT: '1000' },
      { numero: '2', designation: 'Réseaux', montantHT: '2000' },
    ];

    const { fiche } = inheritFicheFromEstimaProject(ficheInitiale, {
      ...project,
      clientAddress: '',
      lotName: 'Lot unique à ignorer',
    });

    expect(fiche.sectionA.telephone).toBe('05 00 00 00 00');
    expect(fiche.sectionD.lots).toEqual(ficheInitiale.sectionD.lots);
  });

  it('convertit les semaines en mois et sépare les adresses usuelles', () => {
    expect(durationToMonths('4 semaines')).toBe('0.92');
    expect(durationToMonths('2,5 mois')).toBe('2.5');
    expect(splitMoeAddress('10 rue des Lilas, 31000 Toulouse')).toEqual({
      adresse: '10 rue des Lilas',
      codePostal: '31000',
      ville: 'Toulouse',
    });
  });
});
