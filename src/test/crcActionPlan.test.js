// Tests pour src/utils/crcActionPlan.js
import { describe, it, expect } from 'vitest';
import {
  buildActionRows,
  classifyDeadline,
  collectResponsables,
  filterRows,
  diffDays,
  setObsStatusInLastMeeting,
} from '../utils/crcActionPlan';

const TODAY = '2026-07-23';

// Chantier minimal : 2 CR, le dernier porte les observations courantes
const chantier = (id, nom, lastObservations, extra = {}) => ({
  id,
  crrConfig: { chantierInfo: { nom }, categoryCodes: { Travaux: 'TRX' } },
  crrMeetings: [
    { id: 'm1', number: 1, observations: [{ id: 'old', actionDeadline: '2026-01-01', status: 'open' }] },
    { id: 'm2', number: 2, observations: lastObservations },
  ],
  ...extra,
});

const obs = (id, deadline, status = 'open', patch = {}) => ({
  id, seq: 1, category: 'Travaux', text: `obs ${id}`,
  actionBy: 'MOE', actionDeadline: deadline, status, ...patch,
});

describe('classifyDeadline', () => {
  it('passe = en retard, 7 jours glissants = week, au-dela = later', () => {
    expect(classifyDeadline('2026-07-22', TODAY)).toBe('overdue');
    expect(classifyDeadline('2026-07-23', TODAY)).toBe('week'); // aujourd'hui
    expect(classifyDeadline('2026-07-30', TODAY)).toBe('week'); // J+7 inclus
    expect(classifyDeadline('2026-07-31', TODAY)).toBe('later');
  });
});

describe('buildActionRows', () => {
  it('ne lit que le dernier CR (les obs reportees ne doublonnent pas)', () => {
    const rows = buildActionRows([chantier('c1', 'A', [obs('o1', '2026-08-01')])], TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].obsId).toBe('o1');
    expect(rows[0].meetingNumber).toBe(2);
  });

  it('exclut les obs soldees, sans date, et les chantiers archives ou sans CR', () => {
    const rows = buildActionRows([
      chantier('c1', 'A', [
        obs('done', '2026-08-01', 'done'),
        obs('nodate', '', 'open'),
        obs('ok', '2026-08-01', 'in_progress'),
      ]),
      chantier('c2', 'B', [obs('x', '2026-08-01')], { archivedAt: '2026-07-01T00:00:00.000Z' }),
      { id: 'c3', crrConfig: { chantierInfo: { nom: 'C' } }, crrMeetings: [] },
    ], TODAY);
    expect(rows.map((r) => r.obsId)).toEqual(['ok']);
  });

  it('trie par echeance croissante, retards en tete, et calcule daysLate', () => {
    const rows = buildActionRows([
      chantier('c1', 'A', [obs('later', '2026-09-01'), obs('late', '2026-07-20')]),
    ], TODAY);
    expect(rows.map((r) => r.obsId)).toEqual(['late', 'later']);
    expect(rows[0].section).toBe('overdue');
    expect(rows[0].daysLate).toBe(3);
    expect(diffDays('2026-07-23', '2026-07-20')).toBe(-3);
  });

  it('resout le numero via les codes categorie du chantier', () => {
    const rows = buildActionRows([chantier('c1', 'A', [obs('o1', '2026-08-01')])], TODAY);
    expect(rows[0].number).toBe('TRX.01');
  });
});

describe('filtres', () => {
  const rows = buildActionRows([
    chantier('c1', 'A', [obs('o1', '2026-08-01', 'open', { actionBy: 'MOE, Entreprises' })]),
    chantier('c2', 'B', [obs('o2', '2026-08-02', 'open', { actionBy: 'Entreprises' })]),
  ], TODAY);

  it('collectResponsables eclate les pastilles multi-noms', () => {
    expect(collectResponsables(rows)).toEqual(['Entreprises', 'MOE']);
  });

  it('filterRows croise chantier et responsable', () => {
    expect(filterRows(rows, { responsable: 'MOE' }).map((r) => r.obsId)).toEqual(['o1']);
    expect(filterRows(rows, { chantierId: 'c2' }).map((r) => r.obsId)).toEqual(['o2']);
    expect(filterRows(rows, { chantierId: 'c2', responsable: 'MOE' })).toHaveLength(0);
  });
});

describe('setObsStatusInLastMeeting', () => {
  const base = () => chantier('c1', 'A', [obs('o1', '2026-08-01'), obs('o2', '2026-08-02')]);

  it('ne modifie que le dernier CR, sans muter l entree', () => {
    const c = base();
    const next = setObsStatusInLastMeeting(c, 'o1', 'done');
    expect(next[1].observations[0].status).toBe('done');
    expect(next[1].observations[1].status).toBe('open');
    // CR anterieur intact (deja diffuse) + pas de mutation en place
    expect(next[0]).toBe(c.crrMeetings[0]);
    expect(c.crrMeetings[1].observations[0].status).toBe('open');
  });

  it('renvoie null quand il n y a rien a ecrire', () => {
    expect(setObsStatusInLastMeeting(base(), 'inconnue', 'done')).toBeNull();
    expect(setObsStatusInLastMeeting(base(), 'o1', 'open')).toBeNull();
    expect(setObsStatusInLastMeeting({ crrMeetings: [] }, 'o1', 'done')).toBeNull();
    expect(setObsStatusInLastMeeting(null, 'o1', 'done')).toBeNull();
  });

  it('une action soldee sort du plan', () => {
    const c = base();
    c.crrMeetings = setObsStatusInLastMeeting(c, 'o1', 'done');
    expect(buildActionRows([c], TODAY).map((r) => r.obsId)).toEqual(['o2']);
  });

  it('expose ownerId sur les lignes (droit de solder)', () => {
    const rows = buildActionRows([chantier('c1', 'A', [obs('o1', '2026-08-01')], { ownerId: 'u1' })], TODAY);
    expect(rows[0].ownerId).toBe('u1');
  });
});
