import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PHASE_DEFS,
  buildPhases,
  getProjectPhases,
  getCurrentPhase,
  getCurrentPhaseIndex,
  getNextPhase,
  phaseColorFor,
  canRemovePhase,
  validatePhases,
} from '../utils/phaseModel';

describe('buildPhases', () => {
  it('génère des phases {id, code, label} à partir du défaut', () => {
    const phases = buildPhases();
    expect(phases).toHaveLength(DEFAULT_PHASE_DEFS.length);
    phases.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.code).toBeTruthy();
      expect(p.label).toBeTruthy();
    });
  });

  it('normalise le code en majuscules et conserve l\'id fourni', () => {
    const phases = buildPhases([{ id: 'x1', code: 'apd', label: 'Avant-Projet Définitif' }]);
    expect(phases[0]).toEqual({ id: 'x1', code: 'APD', label: 'Avant-Projet Définitif' });
  });

  it('génère des id uniques', () => {
    const phases = buildPhases([{ code: 'A' }, { code: 'B' }, { code: 'C' }]);
    const ids = new Set(phases.map((p) => p.id));
    expect(ids.size).toBe(3);
  });
});

describe('getProjectPhases', () => {
  it('retourne les phases du projet si présentes', () => {
    const project = { phases: [{ id: 'p1', code: 'DCE', label: 'Consultation' }] };
    expect(getProjectPhases(project)).toHaveLength(1);
  });

  it('retombe sur le standard si absentes (rétrocompat)', () => {
    expect(getProjectPhases({})).toHaveLength(DEFAULT_PHASE_DEFS.length);
    expect(getProjectPhases({ phases: [] })).toHaveLength(DEFAULT_PHASE_DEFS.length);
  });
});

describe('getCurrentPhase', () => {
  const phases = [
    { id: 'p1', code: 'AVP', label: 'Avant-Projet' },
    { id: 'p2', code: 'DCE', label: 'Consultation' },
  ];

  it('résout par id stable', () => {
    expect(getCurrentPhase({ phases, phase: 'p2' }).code).toBe('DCE');
  });

  it('résout par code (ancien format)', () => {
    expect(getCurrentPhase({ phases, phase: 'AVP' }).id).toBe('p1');
  });

  it('retombe sur la première phase si référence inconnue', () => {
    expect(getCurrentPhase({ phases, phase: 'ZZZ' }).id).toBe('p1');
  });

  it('fonctionne sur un projet legacy sans phases (phase=code standard)', () => {
    expect(getCurrentPhase({ phase: 'DCE' }).code).toBe('DCE');
  });
});

describe('getCurrentPhaseIndex / getNextPhase', () => {
  const phases = [
    { id: 'p1', code: 'ESQ', label: 'Esquisse' },
    { id: 'p2', code: 'DCE', label: 'Consultation' },
    { id: 'p3', code: 'EXE', label: 'Exécution' },
  ];

  it('index courant correct', () => {
    expect(getCurrentPhaseIndex({ phases, phase: 'p2' })).toBe(1);
  });

  it('phase suivante en linéaire', () => {
    expect(getNextPhase({ phases, phase: 'p1' }).code).toBe('DCE');
    expect(getNextPhase({ phases, phase: 'p2' }).code).toBe('EXE');
  });

  it('null si déjà à la dernière phase', () => {
    expect(getNextPhase({ phases, phase: 'p3' })).toBeNull();
  });
});

describe('phaseColorFor', () => {
  it('couleur dédiée pour un code connu', () => {
    expect(phaseColorFor('DCE')).toBe('emerald');
    expect(phaseColorFor('EXE')).toBe('red');
  });

  it('couleur par rotation pour un code inconnu', () => {
    const c0 = phaseColorFor('CUSTOM', 0);
    const c1 = phaseColorFor('CUSTOM2', 1);
    expect(c0).toBeTruthy();
    expect(c0).not.toBe(c1);
  });
});

describe('canRemovePhase', () => {
  const phase = { id: 'p1', code: 'DCE', label: 'Consultation' };

  it('autorise si aucune archive ne référence le code', () => {
    expect(canRemovePhase(phase, [{ phase: 'EXE' }])).toBe(true);
    expect(canRemovePhase(phase, [])).toBe(true);
  });

  it('interdit si une version figée référence le code', () => {
    expect(canRemovePhase(phase, [{ phase: 'DCE' }])).toBe(false);
  });
});

describe('validatePhases', () => {
  it('ok pour une liste valide', () => {
    expect(validatePhases([{ code: 'DCE' }, { code: 'EXE' }])).toEqual({ ok: true, error: null });
  });

  it('refuse une liste vide', () => {
    expect(validatePhases([]).ok).toBe(false);
  });

  it('refuse un code vide', () => {
    expect(validatePhases([{ code: 'DCE' }, { code: '' }]).ok).toBe(false);
  });

  it('refuse les doublons de code', () => {
    const res = validatePhases([{ code: 'DCE' }, { code: 'dce' }]);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/double/i);
  });
});
