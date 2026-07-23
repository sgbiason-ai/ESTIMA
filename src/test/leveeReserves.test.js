import { describe, expect, it } from 'vitest';
import {
  applyControlObservation,
  getReserveControlImages,
  matchControlVisitToReserves,
  normalizeObservationNumber,
} from '../utils/docAdmin/siteVisitReserves';
import {
  getLeveeAnnexReserves,
  getLeveeStatus,
} from '../utils/docAdmin/annexeLeveeReserves';

describe('rapprochement des réserves EXE8 / EXE9', () => {
  it('rapproche automatiquement les observations par numéro repère', () => {
    const reserves = [
      { id: 'r1', numero: '01', designation: 'Reprendre le joint', images: ['avant.jpg'] },
      { id: 'r2', numero: '2', designation: 'Nettoyer le regard', images: [] },
    ];
    const visit = {
      id: 'controle-1',
      nom: 'Contrôle de levée',
      date: '2026-07-23',
      observations: [
        { id: 'c2', numero: '2', text: '<p>Nettoyage réalisé</p>', images: ['apres-2.jpg'] },
        { id: 'c1', numero: '1', text: '<p>Joint repris</p>', images: ['apres-1.jpg'] },
      ],
    };

    const result = matchControlVisitToReserves(reserves, visit, '2026-07-23T10:00:00.000Z');

    expect(result.source.nom).toBe('Contrôle de levée');
    expect(result.reserves[0]).toMatchObject({
      controlObservationId: 'c1',
      controlObservationNumber: '1',
      controlText: 'Joint repris',
      leveeStatus: 'a_qualifier',
    });
    expect(result.reserves[1].controlObservationId).toBe('c2');
    expect(getReserveControlImages(result.reserves[1], result.source)).toEqual(['apres-2.jpg']);
  });

  it('préserve un statut déjà qualifié lors du remplacement de la visite', () => {
    const result = matchControlVisitToReserves(
      [{ numero: 'OBS-3', designation: 'Réserve', leveeStatus: 'partiellement_levee' }],
      { observations: [{ id: 'c3', repere: '3', text: 'Contrôle partiel' }] },
    );

    expect(normalizeObservationNumber('OBS-03')).toBe('3');
    expect(result.reserves[0].leveeStatus).toBe('partiellement_levee');
    expect(result.reserves[0].controlObservationId).toBe('c3');
  });

  it('permet de corriger manuellement l’association', () => {
    const reserve = applyControlObservation(
      { numero: '4', designation: 'Réserve' },
      { id: 'controle-7', numero: '7', text: 'Constat corrigé', images: ['photo.jpg'] },
    );

    expect(reserve).toMatchObject({
      controlObservationId: 'controle-7',
      controlObservationNumber: '7',
      controlText: 'Constat corrigé',
    });
  });
});

describe('annexe comparative de levée', () => {
  it('ignore les lignes vides et traduit les trois statuts', () => {
    const reserves = getLeveeAnnexReserves({
      reserves: [{ designation: '' }, { designation: 'Réserve suivie' }],
    });

    expect(reserves).toHaveLength(1);
    expect(getLeveeStatus('levee').label).toBe('Levée');
    expect(getLeveeStatus('maintenue').label).toBe('Maintenue');
    expect(getLeveeStatus('partiellement_levee').label).toBe('Partiellement levée');
  });
});
