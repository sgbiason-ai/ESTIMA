import { describe, expect, it } from 'vitest';
import {
  buildRaoConsultation,
  ensureRaoCriteria,
  prepareMobileRaoExportData,
} from '../utils/mobileRaoExportData';

const project = {
  id: 'p1',
  name: 'Réfection avenue',
  client: 'Ville Exemple',
  moe: 'Papyrus',
  code: 'VRD-42',
  location: 'Centre-ville',
  dateRemise: '2026-08-15',
  chapters: [
    {
      id: 'base',
      type: 'chapter',
      title: 'Base',
      children: [
        { id: 'b1', type: 'item', designation: 'Terrassement', unit: 'm3', price: 100 },
      ],
    },
    {
      id: 'option',
      type: 'chapter',
      title: 'PSE',
      isOption: true,
      children: [
        { id: 'o1', type: 'item', designation: 'Option', unit: 'U', price: 200 },
      ],
    },
  ],
  rao: {
    raoTrancheId: 't1',
    includedOptions: { option: true },
    consultation: {
      objet: 'Objet RAO enregistré',
      lot: 'Lot 2',
      dateRemise: '2025-01-01',
    },
    criteria: [
      { id: 'prix', label: 'Prix', weight: 70, auto: true },
      { id: 'tech', label: 'Technique', weight: 30, auto: false },
    ],
    companies: {
      Alpha: {
        admin: { conclusion: 'reguliere' },
        technical: { tech: { note: 5, noteMax: 5 } },
      },
      Bravo: {
        admin: { conclusion: 'irreguliere' },
        technical: { tech: { note: 2.5, noteMax: 5 } },
      },
    },
  },
};

const analysisData = {
  scoringConfig: { maxScore: 70, mode: 'f7', basis: 'nego' },
  companies: [
    {
      id: 'a',
      name: 'Alpha',
      offers: { b1: 80, o1: 50 },
      offersNego: { b1: 70 },
      negoRabaisPct: 10,
    },
    {
      id: 'b',
      name: 'Bravo',
      offers: { b1: 90, o1: 60 },
    },
  ],
};

describe('préparation des exports RAO mobile', () => {
  it('fusionne la consultation projet/RAO avec la date projet prioritaire', () => {
    const consultation = buildRaoConsultation(project, project.rao);

    expect(consultation.objet).toBe('Objet RAO enregistré');
    expect(consultation.client).toBe('Ville Exemple');
    expect(consultation.lot).toBe('Lot 2');
    expect(consultation.dateRemise).toBe('2026-08-15');
  });

  it('réinjecte le critère prix dans une ancienne grille', () => {
    const criteria = ensureRaoCriteria([
      { id: 'tech', label: 'Technique', weight: 40, auto: false },
    ]);

    expect(criteria[0].auto).toBe(true);
    expect(criteria[1].id).toBe('tech');
  });

  it('reprend scoring, tranche, PSE, classements et négociation', () => {
    const payload = prepareMobileRaoExportData({
      project,
      analysisData,
      clientQtyMaps: {
        global: { b1: 10, o1: 1 },
        t1: { b1: 2, o1: 1 },
      },
      tranches: [{ id: 't1', name: 'Tranche ferme' }],
    });

    expect(payload.scoringConfig).toEqual(analysisData.scoringConfig);
    expect(payload.activeTrancheId).toBe('t1');
    expect(payload.raoTrancheName).toBe('Tranche ferme');
    expect(payload.negotiationPhase).toBe('after');
    expect(payload.optionChapters.map((chapter) => chapter.id)).toEqual(['option']);

    // Base négociée Alpha : 2 × 70 avec rabais 10 %, puis PSE 1 × 50 avec rabais.
    expect(payload.analysisStats.companiesTotals.a).toBeCloseTo(171);
    expect(payload.analysisStats.totalEstimation).toBe(400);
    expect(payload.ranking[0]).toMatchObject({
      name: 'Alpha',
      rank: 1,
      priceScore: 70,
      totalScore: 100,
    });
    expect(payload.rankingNego).toHaveLength(2);
    expect(payload.rankingInitial).toHaveLength(2);
    expect(payload.negoComparison).toHaveLength(2);
  });

  it('retombe sur Global si la tranche RAO enregistrée n’existe plus', () => {
    const payload = prepareMobileRaoExportData({
      project: { ...project, rao: { ...project.rao, raoTrancheId: 'supprimee' } },
      analysisData,
      clientQtyMaps: { global: { b1: 10, o1: 1 } },
      tranches: [{ id: 't1', name: 'Tranche ferme' }],
    });

    expect(payload.activeTrancheId).toBe('global');
  });
});
