// src/tests/normalizeProject.test.js
import { describe, it, expect } from 'vitest';
import {
  normalizeProject,
  defaultProject,
  CURRENT_SCHEMA_VERSION,
} from '../utils/normalizeProject';

// ─────────────────────────────────────────────────────────────────────────────
// normalizeProject — champs de base
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeProject — champs de base', () => {
  it('retourne un projet par défaut si raw est null', () => {
    const p = normalizeProject(null);
    expect(p).toBeDefined();
    expect(Array.isArray(p.chapters)).toBe(true);
    expect(Array.isArray(p.tranches)).toBe(true);
  });

  it('conserve les champs présents', () => {
    const p = normalizeProject({
      id: 'proj_1',
      name: 'MON PROJET',
      client: 'Mairie de Test',
    });
    expect(p.id).toBe('proj_1');
    expect(p.name).toBe('MON PROJET');
    expect(p.client).toBe('Mairie de Test');
  });

  it('initialise les champs manquants avec leurs valeurs par défaut', () => {
    const p = normalizeProject({ id: 'x', name: 'test' });
    expect(p.tranches).toEqual([]);
    expect(p.sourceIds).toEqual([]);
    expect(p.clientPercent).toBe(10);
    expect(p.tauxTVA).toBe(20);
    expect(p.subtitle1).toBe('');
    expect(p.subtitle2).toBe('');
    expect(p.showSignatures).toBe(false);
    expect(p.hasPSE).toBe(false);
    expect(p.marketType).toBe('Public');
    expect(p.phase).toBe('DCE');
  });

  it('initialise scoringConfig avec les valeurs par défaut', () => {
    const p = normalizeProject({});
    expect(p.scoringConfig).toEqual({ maxScore: 40, mode: 'f1' });
  });

  it('conserve un scoringConfig existant', () => {
    const p = normalizeProject({ scoringConfig: { maxScore: 60, mode: 'f3' } });
    expect(p.scoringConfig).toEqual({ maxScore: 60, mode: 'f3' });
  });

  it('conserve un taux de TVA personnalisé (taux réduit)', () => {
    expect(normalizeProject({ tauxTVA: 5.5 }).tauxTVA).toBe(5.5);
    expect(normalizeProject({ tauxTVA: 0 }).tauxTVA).toBe(0);
  });

  it('initialise rao avec les champs attendus', () => {
    const p = normalizeProject({});
    expect(p.rao).toBeDefined();
    expect(p.rao.raoTrancheId).toBe('global');
    expect(p.rao.includedOptions).toEqual({});
    expect(p.rao.companies).toEqual({});
    expect(Array.isArray(p.rao.criteria)).toBe(true);
  });

  it('conserve le rao existant', () => {
    const p = normalizeProject({
      rao: {
        raoTrancheId: 't1',
        includedOptions: { chap1: true },
        consultation: { objet: 'Travaux VRD' },
      },
    });
    expect(p.rao.raoTrancheId).toBe('t1');
    expect(p.rao.includedOptions).toEqual({ chap1: true });
    expect(p.rao.consultation.objet).toBe('Travaux VRD');
  });

  it('initialise analysis.companies comme tableau vide', () => {
    const p = normalizeProject({});
    expect(p.analysis.companies).toEqual([]);
  });

  it('conserve analysis.companies si présent', () => {
    const companies = [{ id: 'c1', name: 'DUPONT TP', offers: {} }];
    const p = normalizeProject({ analysis: { companies } });
    expect(p.analysis.companies).toHaveLength(1);
    expect(p.analysis.companies[0].name).toBe('DUPONT TP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeProject — arbre de chapitres
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeProject — normalisation des chapitres', () => {
  it('normalise un chapitre avec ses champs par défaut', () => {
    const p = normalizeProject({
      chapters: [{ id: 'c1', title: 'VRD', children: [] }],
    });
    expect(p.chapters[0].isOption).toBe(false);
    expect(p.chapters[0].type).toBe('chapter');
  });

  it('normalise un article avec ses champs par défaut', () => {
    const p = normalizeProject({
      chapters: [{
        id: 'c1', title: 'VRD', type: 'chapter', isOption: false,
        children: [{
          id: 'i1', type: 'item', designation: 'Béton', unit: 'm3', price: 150,
        }],
      }],
    });
    const item = p.chapters[0].children[0];
    expect(item.qty).toBe(0);
    expect(item.formula).toBe('');
    expect(item.quantities).toEqual({});
    expect(item.quantitiesFormula).toEqual({});
    expect(item.isFixed).toBe(false);
    expect(item.bpuNum).toBe('');
  });

  it('ignore les nœuds null ou invalides', () => {
    const p = normalizeProject({
      chapters: [
        null,
        { id: 'c1', title: 'Valide', type: 'chapter', isOption: false, children: [] },
        undefined,
      ],
    });
    expect(p.chapters).toHaveLength(1);
    expect(p.chapters[0].id).toBe('c1');
  });

  it('normalise récursivement les sous-chapitres', () => {
    const p = normalizeProject({
      chapters: [{
        id: 'c1', title: 'Parent', type: 'chapter', isOption: false,
        children: [{
          id: 'sub1', title: 'Enfant', type: 'chapter',
          children: [{ id: 'i1', type: 'item', designation: 'Art', unit: 'ml', price: 50 }],
        }],
      }],
    });
    const sub = p.chapters[0].children[0];
    expect(sub.isOption).toBe(false);
    expect(sub.children[0].qty).toBe(0);
  });

  it('préserve les quantités et formules existantes', () => {
    const p = normalizeProject({
      chapters: [{
        id: 'c1', title: 'VRD', type: 'chapter', isOption: false,
        children: [{
          id: 'i1', type: 'item', designation: 'Béton', unit: 'm3', price: 150,
          qty: 42, formula: '=10*4+2',
          quantities: { t1: 20, t2: 22 },
          quantitiesFormula: { t1: '=10*2', t2: '' },
        }],
      }],
    });
    const item = p.chapters[0].children[0];
    expect(item.qty).toBe(42);
    expect(item.formula).toBe('=10*4+2');
    expect(item.quantities).toEqual({ t1: 20, t2: 22 });
  });

  it('préserve un sous-chapitre BLOC (unité, surface, quantités) + le facteur des composants', () => {
    const p = normalizeProject({
      chapters: [{
        id: 'c1', title: 'VRD', type: 'chapter', isOption: false,
        children: [{
          id: 'bloc1', title: 'Voirie légère', type: 'chapter', isBloc: true,
          unit: 'm²', qty: 350, quantities: { t1: 250, t2: 100 },
          children: [{
            id: 'i1', type: 'item', designation: 'GNT 0/80', unit: 't', price: 12,
            formula: '={bloc1}*0.6', blocFactor: 0.6,
          }],
        }],
      }],
    });
    const bloc = p.chapters[0].children[0];
    expect(bloc.isBloc).toBe(true);
    expect(bloc.unit).toBe('m²');
    expect(bloc.qty).toBe(350);
    expect(bloc.quantities).toEqual({ t1: 250, t2: 100 });
    expect(bloc.children[0].blocFactor).toBe(0.6);
    expect(bloc.children[0].formula).toBe('={bloc1}*0.6');
  });

  it('un chapitre normal ne reçoit pas de champs bloc', () => {
    const p = normalizeProject({
      chapters: [{ id: 'c1', title: 'VRD', type: 'chapter', children: [] }],
    });
    expect(p.chapters[0].isBloc).toBeUndefined();
    expect(p.chapters[0].unit).toBeUndefined();
    expect(p.chapters[0].qty).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeProject — migrations versionnées
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeProject — migrations', () => {
  it('applique les migrations sur un projet legacy (v0)', () => {
    const legacy = {
      id: 'old',
      name: 'ANCIEN PROJET',
      chapters: [],
      // pas de schemaVersion, pas de tranches, pas de scoringConfig
    };
    const p = normalizeProject(legacy);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.tranches).toEqual([]);
    expect(p.scoringConfig).toBeDefined();
    expect(p.rao.raoTrancheId).toBe('global');
  });

  it('ne ré-applique pas les migrations sur un projet à jour', () => {
    const current = normalizeProject({ id: 'x', name: 'test' });
    expect(current.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const reNormalized = normalizeProject(current);
    expect(reNormalized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('CURRENT_SCHEMA_VERSION est un nombre positif', () => {
    expect(typeof CURRENT_SCHEMA_VERSION).toBe('number');
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// defaultProject
// ─────────────────────────────────────────────────────────────────────────────
describe('defaultProject', () => {
  it('retourne un projet complet avec un chapitre par défaut', () => {
    const p = defaultProject();
    expect(p.chapters.length).toBeGreaterThan(0);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('applique les overrides', () => {
    const p = defaultProject({ id: 'custom_id', name: 'CUSTOM' });
    expect(p.id).toBe('custom_id');
    expect(p.name).toBe('CUSTOM');
  });

  it('contient schemaVersion courant', () => {
    const p = defaultProject();
    // __isNew est un flag interne non persisté dans le schéma normalisé —
    // il est passé en override mais filtré par normalizeProject volontairement.
    // On vérifie à la place que le projet est bien à jour schema.
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.id).toBeDefined();
  });
});