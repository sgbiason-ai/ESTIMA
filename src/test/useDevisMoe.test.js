// Tests pour les fonctions pures exportées de src/hooks/useDevisMoe.js
import { describe, it, expect } from 'vitest';
import {
  PHASES_LOI_MOP, TACHE_TEMPLATES, COTRAITANT_COLORS, MANDATAIRE_COLOR,
  getCategoriesForAssignee, buildCategoriesMap, buildLotPhases,
  createEmptyCotraitant, createEmptyTache, createEmptyLot,
} from '../hooks/useDevisMoe';

// ─── Constantes ─────────────────────────────────────────────────────────────

describe('Constantes Devis MOE', () => {
  it('PHASES_LOI_MOP contient 8 phases', () => {
    expect(PHASES_LOI_MOP).toHaveLength(8);
    const codes = PHASES_LOI_MOP.map(p => p.code);
    expect(codes).toContain('ESQ');
    expect(codes).toContain('AVP');
    expect(codes).toContain('PRO');
    expect(codes).toContain('ACT');
    expect(codes).toContain('VISA');
    expect(codes).toContain('DET');
    expect(codes).toContain('AOR');
    expect(codes).toContain('OPC');
  });

  it('chaque phase a id, code, label, actif', () => {
    PHASES_LOI_MOP.forEach(p => {
      expect(p.id).toBeTruthy();
      expect(p.code).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(typeof p.actif).toBe('boolean');
    });
  });

  it('TACHE_TEMPLATES a des templates valides', () => {
    expect(TACHE_TEMPLATES.length).toBeGreaterThan(10);
    TACHE_TEMPLATES.forEach(t => {
      expect(t.label).toBeTruthy();
      expect(Array.isArray(t.phases)).toBe(true);
    });
  });

  it('les phases des templates existent dans PHASES_LOI_MOP', () => {
    const validIds = new Set(PHASES_LOI_MOP.map(p => p.id));
    TACHE_TEMPLATES.forEach(t => {
      t.phases.forEach(phaseId => {
        expect(validIds.has(phaseId)).toBe(true);
      });
    });
  });

  it('COTRAITANT_COLORS a 3 couleurs', () => {
    expect(COTRAITANT_COLORS).toHaveLength(3);
    COTRAITANT_COLORS.forEach(c => {
      expect(c.bg).toBeTruthy();
      expect(c.text).toBeTruthy();
    });
  });

  it('MANDATAIRE_COLOR a une couleur valide', () => {
    expect(MANDATAIRE_COLOR.bg).toBeTruthy();
    expect(MANDATAIRE_COLOR.dot).toBeTruthy();
  });
});

// ─── getCategoriesForAssignee ───────────────────────────────────────────────

describe('getCategoriesForAssignee', () => {
  it('retourne les categories par membre si disponibles', () => {
    const draft = {
      categoriesParMembre: {
        mandataire: [{ id: 'x', label: 'Custom', tauxHoraire: 100 }],
      },
      categories: [{ id: 'cdp', label: 'Chef de projet', tauxHoraire: 95 }],
    };
    const result = getCategoriesForAssignee(draft, 'mandataire');
    expect(result[0].label).toBe('Custom');
  });

  it('fallback sur categories globales si pas de par-membre', () => {
    const draft = {
      categories: [{ id: 'cdp', label: 'Chef de projet', tauxHoraire: 95 }],
    };
    const result = getCategoriesForAssignee(draft, 'mandataire');
    expect(result[0].label).toBe('Chef de projet');
  });

  it('retourne les categories par defaut si rien', () => {
    const result = getCategoriesForAssignee({}, 'mandataire');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe('cdp');
  });
});

// ─── buildCategoriesMap ─────────────────────────────────────────────────────

describe('buildCategoriesMap', () => {
  it('construit la map mandataire + cotraitants', () => {
    const draft = {
      cotraitants: [{ id: 'cot1' }, { id: 'cot2' }],
      categories: [{ id: 'cdp', label: 'CDP', tauxHoraire: 95 }],
    };
    const map = buildCategoriesMap(draft);
    expect(map.mandataire).toBeDefined();
    expect(map.cot1).toBeDefined();
    expect(map.cot2).toBeDefined();
  });

  it('gere un draft sans cotraitants', () => {
    const draft = { categories: [{ id: 'cdp', label: 'CDP', tauxHoraire: 95 }] };
    const map = buildCategoriesMap(draft);
    expect(Object.keys(map)).toEqual(['mandataire']);
  });
});

// ─── buildLotPhases ─────────────────────────────────────────────────────────

describe('buildLotPhases', () => {
  const phases = [
    { id: 'avp', actif: true },
    { id: 'pro', actif: true },
    { id: 'esq', actif: false },
  ];
  const categories = [{ id: 'cdp' }, { id: 'ing' }];

  it('ne prend que les phases actives', () => {
    const result = buildLotPhases(phases, categories);
    expect(result.repartitionPhases).toHaveLength(2);
    expect(result.repartitionPhases.map(r => r.phaseId)).toEqual(['avp', 'pro']);
  });

  it('initialise les pourcentages a vide', () => {
    const result = buildLotPhases(phases, categories);
    result.repartitionPhases.forEach(r => {
      expect(r.pourcentage).toBe('');
    });
  });

  it('initialise phasesTemps avec les categories', () => {
    const result = buildLotPhases(phases, categories);
    expect(result.phasesTemps).toHaveLength(2);
    result.phasesTemps.forEach(pt => {
      expect(pt.temps).toHaveProperty('cdp');
      expect(pt.temps).toHaveProperty('ing');
      expect(pt.temps.cdp).toBe('');
    });
  });
});

// ─── createEmptyCotraitant ──────────────────────────────────────────────────

describe('createEmptyCotraitant', () => {
  it('cree un cotraitant avec un ID unique', () => {
    const c = createEmptyCotraitant();
    expect(c.id).toBeTruthy();
    expect(c.nom).toBe('');
    expect(c.email).toBe('');
    expect(c.siret).toBe('');
  });

  it('genere des IDs uniques', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createEmptyCotraitant().id));
    expect(ids.size).toBe(20);
  });
});

// ─── createEmptyTache ───────────────────────────────────────────────────────

describe('createEmptyTache', () => {
  it('cree une tache avec phase et label', () => {
    const t = createEmptyTache('avp', 'Ma tache');
    expect(t.phaseId).toBe('avp');
    expect(t.label).toBe('Ma tache');
    expect(t.id).toBeTruthy();
  });

  it('format flat si pas d\'assigneeKeys', () => {
    const t = createEmptyTache('pro');
    expect(t.temps).toEqual({});
  });

  it('format nested si assigneeKeys fourni', () => {
    const t = createEmptyTache('pro', 'Test', ['mandataire', 'cot1']);
    expect(t.temps).toHaveProperty('mandataire');
    expect(t.temps).toHaveProperty('cot1');
  });
});

// ─── createEmptyLot ─────────────────────────────────────────────────────────

describe('createEmptyLot', () => {
  const phases = [{ id: 'avp', actif: true }, { id: 'esq', actif: false }];
  const cats = [{ id: 'cdp' }];

  it('cree un lot avec le bon numero', () => {
    const lot = createEmptyLot(1, phases, cats);
    expect(lot.numero).toBe('1');
    expect(lot.designation).toBe('');
    expect(lot.assigneA).toBe('mandataire');
  });

  it('initialise les phases du lot', () => {
    const lot = createEmptyLot(1, phases, cats);
    expect(lot.repartitionPhases).toHaveLength(1); // seule avp est actif
    expect(lot.phasesTemps).toHaveLength(1);
  });
});
