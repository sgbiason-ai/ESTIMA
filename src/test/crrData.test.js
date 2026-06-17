// Tests pour src/data/crrData.js
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CATEGORIES, MEETING_TYPES, PRESENCE_OPTIONS, OBSERVATION_STATUSES,
  LEGAL_TEXT, GROUP_COLORS, getGroupColor, abbreviateGroup,
  DEFAULT_PARTICIPANT_GROUPS, generateCrrId, createEmptyMeeting, createEmptyObservation,
  generateObsKey, defaultCategoryCode, formatObsNumber, computeObsStats, obsDisplayNumber,
} from '../data/crrData';

// ─── Constantes ─────────────────────────────────────────────────────────────

describe('Constantes CRR', () => {
  it('DEFAULT_CATEGORIES contient des categories', () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThan(0);
    expect(DEFAULT_CATEGORIES).toContain('Administratif');
    expect(DEFAULT_CATEGORIES).toContain('Travaux');
  });

  it('MEETING_TYPES contient preparation et chantier', () => {
    const values = MEETING_TYPES.map(t => t.value);
    expect(values).toContain('preparation');
    expect(values).toContain('chantier');
  });

  it('PRESENCE_OPTIONS contient 4 statuts', () => {
    expect(PRESENCE_OPTIONS).toHaveLength(4);
    const values = PRESENCE_OPTIONS.map(p => p.value);
    expect(values).toEqual(['present', 'excused', 'absent', 'not_summoned']);
  });

  it('OBSERVATION_STATUSES contient 4 statuts', () => {
    expect(OBSERVATION_STATUSES).toHaveLength(4);
    expect(OBSERVATION_STATUSES.map(s => s.value)).toEqual(['empty', 'open', 'in_progress', 'done']);
  });

  it('LEGAL_TEXT est un texte non vide', () => {
    expect(LEGAL_TEXT.length).toBeGreaterThan(100);
    expect(LEGAL_TEXT).toContain('48 heures');
  });

  it('GROUP_COLORS contient 8 palettes avec rgb', () => {
    expect(GROUP_COLORS).toHaveLength(8);
    GROUP_COLORS.forEach(color => {
      expect(color.rgb).toHaveLength(3);
      expect(color.rgbBg).toHaveLength(3);
      expect(color.bg).toMatch(/^bg-/);
      expect(color.text).toMatch(/^text-/);
    });
  });

  it('DEFAULT_PARTICIPANT_GROUPS contient 5 groupes', () => {
    expect(DEFAULT_PARTICIPANT_GROUPS).toHaveLength(5);
    const ids = DEFAULT_PARTICIPANT_GROUPS.map(g => g.id);
    expect(ids).toContain('g_moa');
    expect(ids).toContain('g_moe');
    expect(ids).toContain('g_ent');
  });
});

// ─── getGroupColor ──────────────────────────────────────────────────────────

describe('getGroupColor', () => {
  it('retourne la couleur par index', () => {
    expect(getGroupColor(0)).toBe(GROUP_COLORS[0]);
    expect(getGroupColor(3)).toBe(GROUP_COLORS[3]);
  });

  it('boucle cycliquement au-dela de 8', () => {
    expect(getGroupColor(8)).toBe(GROUP_COLORS[0]);
    expect(getGroupColor(10)).toBe(GROUP_COLORS[2]);
    expect(getGroupColor(16)).toBe(GROUP_COLORS[0]);
  });
});

// ─── abbreviateGroup ────────────────────────────────────────────────────────

describe('abbreviateGroup', () => {
  it('retourne les abbreviations du dictionnaire', () => {
    expect(abbreviateGroup("Maître d'ouvrage")).toBe('MOA');
    expect(abbreviateGroup("Maître d'oeuvre")).toBe('MOE');
    expect(abbreviateGroup('Entreprises')).toBe('ENT');
    expect(abbreviateGroup('Concessionnaires')).toBe('CONC');
  });

  it('normalise les accents pour le dictionnaire', () => {
    expect(abbreviateGroup("Maitrise d'ouvrage")).toBe('MOA');
    expect(abbreviateGroup("Maitrise d'oeuvre")).toBe('MOE');
  });

  it('garde les noms courts tels quels (maj)', () => {
    expect(abbreviateGroup('SPS')).toBe('SPS');
    expect(abbreviateGroup('OPC')).toBe('OPC');
    expect(abbreviateGroup('AB')).toBe('AB');
  });

  it('utilise les initiales pour les noms multi-mots', () => {
    expect(abbreviateGroup('IMS Networks')).toBe('IN');
    expect(abbreviateGroup('Bureau Etudes Techniques')).toBe('BET');
  });

  it('tronque a 5 caracteres en dernier recours', () => {
    expect(abbreviateGroup('Hydraulique')).toBe('HYDRA');
  });

  it('retourne vide pour nom vide/null', () => {
    expect(abbreviateGroup('')).toBe('');
    expect(abbreviateGroup(null)).toBe('');
    expect(abbreviateGroup(undefined)).toBe('');
  });
});

// ─── generateCrrId ──────────────────────────────────────────────────────────

describe('generateCrrId', () => {
  it('commence par crr_', () => {
    expect(generateCrrId()).toMatch(/^crr_/);
  });

  it('genere des IDs uniques', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateCrrId()));
    expect(ids.size).toBe(50);
  });
});

// ─── createEmptyMeeting ─────────────────────────────────────────────────────

describe('createEmptyMeeting', () => {
  it('cree une reunion avec le bon numero', () => {
    const m = createEmptyMeeting(5);
    expect(m.number).toBe(5);
    expect(m.type).toBe('preparation');
    expect(m.id).toMatch(/^crr_/);
  });

  it('initialise une date ISO valide', () => {
    const m = createEmptyMeeting(1);
    expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('initialise les collections vides', () => {
    const m = createEmptyMeeting(1);
    expect(m.attendance).toEqual({});
    expect(m.diffusion).toEqual({});
    expect(m.observations).toEqual([]);
  });

  it('a un nextMeeting vide', () => {
    const m = createEmptyMeeting(1);
    expect(m.nextMeeting).toEqual({ lieu: '', heure: '', date: '' });
  });
});

// ─── createEmptyObservation ─────────────────────────────────────────────────

describe('createEmptyObservation', () => {
  it('cree une observation avec la bonne categorie', () => {
    const obs = createEmptyObservation('Travaux');
    expect(obs.category).toBe('Travaux');
    expect(obs.status).toBe('empty');
    expect(obs.id).toMatch(/^obs_/);
  });

  it('initialise les champs vides', () => {
    const obs = createEmptyObservation('Admin');
    expect(obs.emitter).toBe('');
    expect(obs.text).toBe('');
    expect(obs.actionBy).toBe('');
    expect(obs.actionDeadline).toBe('');
    expect(obs.images).toEqual([]);
    expect(obs.originMeetingNumber).toBeNull();
  });

  it('a une date ISO valide', () => {
    const obs = createEmptyObservation('Test');
    expect(obs.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('porte une identite stable obsKey et un seq null (attribue plus tard)', () => {
    const obs = createEmptyObservation('Travaux');
    expect(obs.obsKey).toMatch(/^k_/);
    expect(obs.seq).toBeNull();
  });
});

// ─── Numerotation stable (helpers) ──────────────────────────────────────────

describe('generateObsKey', () => {
  it('commence par k_ et est unique', () => {
    expect(generateObsKey()).toMatch(/^k_/);
    const keys = new Set(Array.from({ length: 50 }, () => generateObsKey()));
    expect(keys.size).toBe(50);
  });
});

describe('defaultCategoryCode', () => {
  it('majuscule le premier mot, sans accents ni ponctuation', () => {
    expect(defaultCategoryCode('Travaux')).toBe('TRAVAUX');
    expect(defaultCategoryCode('Planning - DESC')).toBe('PLANNING');
    expect(defaultCategoryCode('Réseaux')).toBe('RESEAUX');
  });

  it('tronque a 10 caracteres et gere le vide', () => {
    expect(defaultCategoryCode('Administratif')).toBe('ADMINISTRA');
    expect(defaultCategoryCode('')).toBe('OBS');
    expect(defaultCategoryCode(null)).toBe('OBS');
  });
});

describe('formatObsNumber', () => {
  it('formate code + seq avec padding', () => {
    expect(formatObsNumber('CHANTIER', 4)).toBe('CHANTIER.04');
    expect(formatObsNumber('TRAVAUX', 12)).toBe('TRAVAUX.12');
  });

  it('retourne vide si pas de seq, fallback OBS', () => {
    expect(formatObsNumber('CHANTIER', null)).toBe('');
    expect(formatObsNumber('', 3)).toBe('OBS.03');
  });
});

describe('computeObsStats', () => {
  it('total = ouvertes + en cours + faites (empty exclues)', () => {
    const obs = [
      { status: 'open' }, { status: 'open' },
      { status: 'in_progress' },
      { status: 'done' }, { status: 'done' }, { status: 'done' },
      { status: 'empty' }, // non classee → exclue du total
    ];
    const s = computeObsStats(obs);
    expect(s).toEqual({ open: 2, inProgress: 1, done: 3, total: 6 });
    // L'invariant clé : plus de "18 pour 17"
    expect(s.total).toBe(s.open + s.inProgress + s.done);
  });

  it('gere la liste vide / absente', () => {
    expect(computeObsStats([])).toEqual({ open: 0, inProgress: 0, done: 0, total: 0 });
    expect(computeObsStats()).toEqual({ open: 0, inProgress: 0, done: 0, total: 0 });
  });
});

describe('obsDisplayNumber', () => {
  it('utilise le code custom de la categorie si defini', () => {
    expect(obsDisplayNumber({ category: 'Travaux', seq: 4 }, { Travaux: 'CHANTIER' })).toBe('CHANTIER.04');
  });

  it('retombe sur le code par defaut sinon', () => {
    expect(obsDisplayNumber({ category: 'Travaux', seq: 4 }, {})).toBe('TRAVAUX.04');
  });

  it('retourne vide sans seq ou sans obs', () => {
    expect(obsDisplayNumber({ category: 'Travaux', seq: null }, {})).toBe('');
    expect(obsDisplayNumber(null, {})).toBe('');
  });
});
