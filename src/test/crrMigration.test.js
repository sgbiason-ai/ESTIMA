// Tests pour src/utils/crrMigration.js — numerotation stable des observations
import { describe, it, expect } from 'vitest';
import { migrateCrrData } from '../utils/crrMigration';

describe('migrateCrrData — cas vides / no-op', () => {
  it('ne change rien sur un projet vide ou null', () => {
    expect(migrateCrrData(null).changed).toBe(false);
    expect(migrateCrrData({ id: 'p1' }).changed).toBe(false);
    expect(
      migrateCrrData({ id: 'p1', crrConfig: { categories: [] }, crrMeetings: [] }).changed
    ).toBe(false);
  });
});

describe('migrateCrrData — backfill initial', () => {
  const project = {
    id: 'p1',
    crrConfig: { categories: ['Travaux', 'Administratif'] },
    crrMeetings: [
      {
        id: 'm1', number: 1, observations: [
          { id: 'o1', category: 'Travaux', status: 'open' },
          { id: 'o2', category: 'Travaux', status: 'open' },
          { id: 'o3', category: 'Administratif', status: 'open' },
        ],
      },
    ],
  };

  it('attribue obsKey, seq par categorie et originMeetingNumber', () => {
    const r = migrateCrrData(project);
    expect(r.changed).toBe(true);
    const [a, b, c] = r.crrMeetings[0].observations;
    expect(a.obsKey).toBeTruthy();
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);        // 2e Travaux
    expect(c.seq).toBe(1);        // 1re Administratif (compteur separe)
    expect(a.originMeetingNumber).toBe(1);
  });

  it('initialise crrObsCounters et categoryCodes par defaut', () => {
    const r = migrateCrrData(project);
    expect(r.crrObsCounters).toEqual({ Travaux: 2, Administratif: 1 });
    expect(r.crrConfig.categoryCodes.Travaux).toBe('TRAVAUX');
    expect(r.crrConfig.categoryCodes.Administratif).toBe('ADMINISTRA');
  });
});

describe('migrateCrrData — chaine de report (meme identite, meme numero)', () => {
  const project = {
    id: 'p1',
    crrConfig: { categories: ['Travaux'] },
    crrMeetings: [
      { id: 'm1', number: 1, observations: [{ id: 'o1', category: 'Travaux', status: 'open' }] },
      { id: 'm2', number: 2, observations: [
        { id: 'o2', category: 'Travaux', status: 'open', originObsId: 'o1', originMeetingNumber: 1 },
      ] },
    ],
  };

  it('partage obsKey + seq entre instances reportees', () => {
    const r = migrateCrrData(project);
    const a = r.crrMeetings[0].observations[0];
    const b = r.crrMeetings[1].observations[0];
    expect(a.obsKey).toBe(b.obsKey);
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(1);                 // pas de nouveau numero au report
    expect(r.crrObsCounters.Travaux).toBe(1); // une seule obs logique comptee
    expect(b.originMeetingNumber).toBe(1);    // reunion d'emission conservee
  });
});

describe('migrateCrrData — idempotence', () => {
  const project = {
    id: 'p1',
    crrConfig: { categories: ['Travaux'] },
    crrMeetings: [
      { id: 'm1', number: 1, observations: [{ id: 'o1', category: 'Travaux', status: 'open' }] },
    ],
  };

  it('un second passage ne change rien et conserve les references', () => {
    const r1 = migrateCrrData(project);
    const migrated = {
      ...project,
      crrMeetings: r1.crrMeetings,
      crrConfig: r1.crrConfig,
      crrObsCounters: r1.crrObsCounters,
    };
    const r2 = migrateCrrData(migrated);
    expect(r2.changed).toBe(false);
    expect(r2.crrMeetings).toBe(migrated.crrMeetings);
    expect(r2.crrConfig).toBe(migrated.crrConfig);
    expect(r2.crrObsCounters).toBe(migrated.crrObsCounters);
  });
});

describe('migrateCrrData — preserve l\'existant, pas de reutilisation de seq', () => {
  const project = {
    id: 'p1',
    crrConfig: { categories: ['Travaux'], categoryCodes: { Travaux: 'CHANTIER' } },
    crrObsCounters: { Travaux: 5 },
    crrMeetings: [
      { id: 'm1', number: 3, observations: [
        { id: 'o1', category: 'Travaux', obsKey: 'kX', seq: 4, originMeetingNumber: 3, status: 'open' },
        { id: 'o2', category: 'Travaux', status: 'open' }, // nouvelle, sans seq
      ] },
    ],
  };

  it('conserve obsKey/seq/code et numerote la nouvelle au-dela du compteur', () => {
    const r = migrateCrrData(project);
    const [a, b] = r.crrMeetings[0].observations;
    expect(a.obsKey).toBe('kX');
    expect(a.seq).toBe(4);
    expect(b.seq).toBe(6);                       // 5 (compteur) + 1, pas 1..5
    expect(r.crrObsCounters.Travaux).toBe(6);
    expect(r.crrConfig.categoryCodes.Travaux).toBe('CHANTIER'); // non ecrase
  });
});
