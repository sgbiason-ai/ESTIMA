// Tests pour src/utils/devisMoeCalculations.js
import { describe, it, expect } from 'vitest';
import {
  pct, honPhasePct, honPhaseTemps, newSousTache, totalRep, fmt, fmtE,
  isNestedTemps, getAssigneeKeys, tacheBudgetByAssignee, tacheTotalBudget,
  phaseBudgetByAssignee, grandTotalByAssignee, phaseHoursByAssignee,
  grandHoursByAssignee, getAssigneeName, calcHonByAssignee,
} from '../utils/devisMoeCalculations';

// ─── pct ────────────────────────────────────────────────────────────────────

describe('pct', () => {
  it('calcule pourcentage honoraires sur montant travaux', () => {
    expect(pct({ montantTravauxHT: '100000' }, '12')).toBe(12000);
  });

  it('gere les valeurs nulles', () => {
    expect(pct({}, '10')).toBe(0);
    expect(pct({ montantTravauxHT: '50000' }, '')).toBe(0);
    expect(pct({ montantTravauxHT: '50000' }, null)).toBe(0);
  });

  it('gere les strings numeriques', () => {
    expect(pct({ montantTravauxHT: '200000' }, '8.5')).toBeCloseTo(17000);
  });
});

// ─── honPhasePct ────────────────────────────────────────────────────────────

describe('honPhasePct', () => {
  const repartition = [
    { phaseId: 'avp', pourcentage: '30' },
    { phaseId: 'pro', pourcentage: '25' },
  ];

  it('calcule honoraires phase en mode pourcentage', () => {
    expect(honPhasePct(10000, repartition, 'avp')).toBe(3000);
    expect(honPhasePct(10000, repartition, 'pro')).toBe(2500);
  });

  it('retourne 0 pour phase inconnue', () => {
    expect(honPhasePct(10000, repartition, 'xxx')).toBe(0);
  });

  it('gere repartition null', () => {
    expect(honPhasePct(10000, null, 'avp')).toBe(0);
  });
});

// ─── honPhaseTemps ──────────────────────────────────────────────────────────

describe('honPhaseTemps', () => {
  const categories = [
    { id: 'cdp', tauxHoraire: '95' },
    { id: 'ing', tauxHoraire: '75' },
  ];

  it('calcule en format ancien (temps direct)', () => {
    const lot = {
      phasesTemps: [{ phaseId: 'avp', temps: { cdp: '10', ing: '20' } }],
    };
    // 10*95 + 20*75 = 950 + 1500 = 2450
    expect(honPhaseTemps(lot, 'avp', categories)).toBe(2450);
  });

  it('calcule en format nouveau (sousTaches)', () => {
    const lot = {
      phasesTemps: [{
        phaseId: 'avp',
        sousTaches: [
          { temps: { cdp: '5', ing: '10' } },
          { temps: { cdp: '3', ing: '7' } },
        ],
      }],
    };
    // (5*95 + 10*75) + (3*95 + 7*75) = (475+750) + (285+525) = 1225 + 810 = 2035
    expect(honPhaseTemps(lot, 'avp', categories)).toBe(2035);
  });

  it('retourne 0 pour phase absente', () => {
    expect(honPhaseTemps({ phasesTemps: [] }, 'pro', categories)).toBe(0);
  });

  it('gere categories null', () => {
    const lot = { phasesTemps: [{ phaseId: 'avp', temps: { cdp: '10' } }] };
    expect(honPhaseTemps(lot, 'avp', null)).toBe(0);
  });
});

// ─── newSousTache ───────────────────────────────────────────────────────────

describe('newSousTache', () => {
  it('cree une sous-tache avec temps vides par categorie', () => {
    const cats = [{ id: 'cdp' }, { id: 'ing' }];
    const st = newSousTache(cats);
    expect(st.id).toBeTruthy();
    expect(st.description).toBe('');
    expect(st.temps).toEqual({ cdp: '', ing: '' });
  });

  it('gere categories null', () => {
    const st = newSousTache(null);
    expect(st.temps).toEqual({});
  });
});

// ─── totalRep ───────────────────────────────────────────────────────────────

describe('totalRep', () => {
  it('somme les pourcentages', () => {
    expect(totalRep([
      { pourcentage: '30' },
      { pourcentage: '25' },
      { pourcentage: '45' },
    ])).toBe(100);
  });

  it('gere les valeurs vides', () => {
    expect(totalRep([{ pourcentage: '' }, { pourcentage: '50' }])).toBe(50);
  });

  it('gere null', () => {
    expect(totalRep(null)).toBe(0);
  });
});

// ─── fmt / fmtE ─────────────────────────────────────────────────────────────

describe('fmt', () => {
  it('formate un nombre en francais sans decimales', () => {
    const result = fmt(12345);
    // Vérifie que les chiffres sont présents (le séparateur peut varier)
    expect(result.replace(/\s/g, '')).toBe('12345');
  });

  it('gere 0 et null', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(null)).toBe('0');
  });
});

describe('fmtE', () => {
  it('formate un prix', () => {
    const result = fmtE(1234.5);
    expect(result).toBeTruthy();
  });
});

// ─── isNestedTemps ──────────────────────────────────────────────────────────

describe('isNestedTemps', () => {
  it('detecte le format flat (cles = categoryIds)', () => {
    expect(isNestedTemps({ cdp: '10', ing: '5' }, ['cdp', 'ing'])).toBe(false);
  });

  it('detecte le format nested (cles = assigneeIds)', () => {
    expect(isNestedTemps({ mandataire: { cdp: '10' } }, ['cdp', 'ing'])).toBe(true);
  });

  it('retourne false pour null/vide', () => {
    expect(isNestedTemps(null, ['cdp'])).toBe(false);
    expect(isNestedTemps({}, ['cdp'])).toBe(false);
  });
});

// ─── getAssigneeKeys ────────────────────────────────────────────────────────

describe('getAssigneeKeys', () => {
  it('retourne mandataire seul si pas de cotraitants', () => {
    expect(getAssigneeKeys({})).toEqual(['mandataire']);
  });

  it('retourne mandataire + cotraitants', () => {
    const draft = { cotraitants: [{ id: 'cot1' }, { id: 'cot2' }] };
    expect(getAssigneeKeys(draft)).toEqual(['mandataire', 'cot1', 'cot2']);
  });
});

// ─── tacheBudgetByAssignee ──────────────────────────────────────────────────

describe('tacheBudgetByAssignee', () => {
  const cats = [{ id: 'cdp', tauxHoraire: 100 }, { id: 'ing', tauxHoraire: 80 }];
  const keys = ['mandataire'];

  it('calcule budget flat', () => {
    const tache = { temps: { cdp: '10', ing: '5' } };
    const result = tacheBudgetByAssignee(tache, cats, keys);
    // 10*100 + 5*80 = 1400
    expect(result.mandataire).toBe(1400);
  });

  it('calcule budget nested multi-assignee', () => {
    const tache = {
      temps: {
        mandataire: { cdp: '8', ing: '4' },
        cot1: { cdp: '2', ing: '6' },
      },
    };
    const keysMulti = ['mandataire', 'cot1'];
    const result = tacheBudgetByAssignee(tache, cats, keysMulti);
    // mandataire: 8*100 + 4*80 = 1120
    expect(result.mandataire).toBe(1120);
    // cot1: 2*100 + 6*80 = 680
    expect(result.cot1).toBe(680);
  });
});

// ─── tacheTotalBudget ───────────────────────────────────────────────────────

describe('tacheTotalBudget', () => {
  it('somme tous les assignees', () => {
    const tache = {
      temps: {
        mandataire: { cdp: '10' },
        cot1: { cdp: '5' },
      },
    };
    const cats = [{ id: 'cdp', tauxHoraire: 100 }];
    const keys = ['mandataire', 'cot1'];
    // 10*100 + 5*100 = 1500
    expect(tacheTotalBudget(tache, cats, keys)).toBe(1500);
  });
});

// ─── phaseBudgetByAssignee ──────────────────────────────────────────────────

describe('phaseBudgetByAssignee', () => {
  it('filtre par phaseId et somme', () => {
    const taches = [
      { phaseId: 'avp', temps: { cdp: '10' } },
      { phaseId: 'pro', temps: { cdp: '5' } },
      { phaseId: 'avp', temps: { cdp: '3' } },
    ];
    const cats = [{ id: 'cdp', tauxHoraire: 100 }];
    const keys = ['mandataire'];
    const result = phaseBudgetByAssignee(taches, 'avp', cats, keys);
    // (10 + 3) * 100 = 1300
    expect(result.mandataire).toBe(1300);
  });

  it('gere taches null', () => {
    const result = phaseBudgetByAssignee(null, 'avp', [], ['mandataire']);
    expect(result.mandataire).toBe(0);
  });
});

// ─── grandTotalByAssignee ───────────────────────────────────────────────────

describe('grandTotalByAssignee', () => {
  it('somme toutes les taches', () => {
    const taches = [
      { phaseId: 'avp', temps: { cdp: '10' } },
      { phaseId: 'pro', temps: { cdp: '5' } },
    ];
    const cats = [{ id: 'cdp', tauxHoraire: 100 }];
    const keys = ['mandataire'];
    const result = grandTotalByAssignee(taches, cats, keys);
    expect(result.mandataire).toBe(1500);
  });
});

// ─── phaseHoursByAssignee ───────────────────────────────────────────────────

describe('phaseHoursByAssignee', () => {
  it('totalise les heures par categorie et assignee', () => {
    const taches = [
      { phaseId: 'avp', temps: { cdp: '10', ing: '5' } },
      { phaseId: 'avp', temps: { cdp: '3', ing: '2' } },
    ];
    const cats = [{ id: 'cdp', tauxHoraire: 100 }, { id: 'ing', tauxHoraire: 80 }];
    const keys = ['mandataire'];
    const result = phaseHoursByAssignee(taches, 'avp', cats, keys);
    expect(result.mandataire.cdp).toBe(13);
    expect(result.mandataire.ing).toBe(7);
  });
});

// ─── grandHoursByAssignee ───────────────────────────────────────────────────

describe('grandHoursByAssignee', () => {
  it('totalise toutes les heures', () => {
    const taches = [
      { phaseId: 'avp', temps: { cdp: '10' } },
      { phaseId: 'pro', temps: { cdp: '7' } },
    ];
    const cats = [{ id: 'cdp', tauxHoraire: 100 }];
    const keys = ['mandataire'];
    const result = grandHoursByAssignee(taches, cats, keys);
    expect(result.mandataire.cdp).toBe(17);
  });
});

// ─── getAssigneeName ────────────────────────────────────────────────────────

describe('getAssigneeName', () => {
  it('retourne le nom du mandataire', () => {
    expect(getAssigneeName('mandataire', { mandataire: { nom: 'Bureau X' } })).toBe('Bureau X');
  });

  it('retourne Mandataire par defaut', () => {
    expect(getAssigneeName('mandataire', {})).toBe('Mandataire');
  });

  it('retourne le nom du cotraitant', () => {
    const draft = { cotraitants: [{ id: 'cot1', nom: 'Sous-traitant A' }] };
    expect(getAssigneeName('cot1', draft)).toBe('Sous-traitant A');
  });

  it('retourne Co-traitant si pas trouve', () => {
    expect(getAssigneeName('cot99', { cotraitants: [] })).toBe('Co-traitant');
  });
});

// ─── calcHonByAssignee ──────────────────────────────────────────────────────

describe('calcHonByAssignee', () => {
  it('ventile honoraires par assignee en mode pourcentage', () => {
    const draft = {
      methode: 'pourcentage',
      tauxHonorairesGlobal: '10',
      phases: [{ id: 'avp', actif: true }],
      categories: [{ id: 'cdp', tauxHoraire: 95 }],
      lots: [
        {
          montantTravauxHT: '100000',
          assigneA: 'mandataire',
          repartitionPhases: [{ phaseId: 'avp', pourcentage: '100' }],
          phasesTemps: [],
        },
      ],
    };
    const result = calcHonByAssignee(draft);
    expect(result.mandataire).toBeDefined();
    expect(result.mandataire.totalTravauxHT).toBe(100000);
    expect(result.mandataire.totalHonHT).toBe(10000); // 10% de 100000
    expect(result.mandataire.phases.avp).toBe(10000); // 100% sur AVP
  });

  it('ventile par cotraitant', () => {
    const draft = {
      methode: 'pourcentage',
      tauxHonorairesGlobal: '12',
      phases: [{ id: 'avp', actif: true }],
      categories: [],
      lots: [
        {
          montantTravauxHT: '50000',
          assigneA: 'mandataire',
          repartitionPhases: [{ phaseId: 'avp', pourcentage: '100' }],
          phasesTemps: [],
        },
        {
          montantTravauxHT: '30000',
          assigneA: 'cot1',
          repartitionPhases: [{ phaseId: 'avp', pourcentage: '100' }],
          phasesTemps: [],
        },
      ],
    };
    const result = calcHonByAssignee(draft);
    expect(result.mandataire.totalHonHT).toBe(6000); // 12% de 50000
    expect(result.cot1.totalHonHT).toBe(3600); // 12% de 30000
  });

  it('gere lots vides', () => {
    const result = calcHonByAssignee({ lots: [], phases: [], categories: [] });
    expect(Object.keys(result)).toHaveLength(0);
  });
});
