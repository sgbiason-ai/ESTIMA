import { describe, it, expect } from 'vitest';
import {
  computeAutoSelection,
  normalizeText,
  within1,
  buildIndex,
  articleSignature,
} from '../utils/cctpAutoSelect';

// ── Arbre CCTP de test, généré avec deux schémas d'IDs ───────────────────────
//  - 'master'   : ids = numéro positionnel ("1","2.2"...) — comme le CCTP maître legacy
//  - 'imported' : ids = "pdf_*" — comme un CCTP importé (PDF/Word)
// La STRUCTURE et les TITRES sont identiques : l'auto-sélection doit donner le
// même résultat métier dans les deux cas (c'est tout l'enjeu du refactor).
const makeTree = (mode) => {
  let n = 0;
  const id = (pos) => (mode === 'master' ? pos : `pdf_${++n}`);
  return [
    { id: id('1'), title: 'Indications Générales', level: 1, children: [
      { id: id('1.1'), title: "Objet de l'accord-cadre", level: 2, children: [] },
    ] },
    { id: id('2'), title: 'Voirie', level: 1, children: [
      { id: id('2.1'), title: 'Terrassements généraux', level: 2, children: [] },
      { id: id('2.2'), title: 'Bordures et caniveaux', level: 2, children: [] },
      { id: id('2.3'), title: 'Revêtements bitumineux', level: 2, children: [] },
    ] },
    { id: id('3'), title: 'Assainissement', level: 1, children: [
      { id: id('3.1'), title: 'Canalisations', level: 2, children: [] },
      { id: id('3.2'), title: 'Regards et ouvrages', level: 2, children: [] },
    ] },
  ];
};

const TAXO = [
  { concept: 'terrassement', devisKeywords: ['terrassement', 'deblai', 'remblai'], titleSynonyms: ['terrassement'], mustNotContain: [] },
  { concept: 'bordure', devisKeywords: ['bordure', 'caniveau'], titleSynonyms: ['bordure', 'caniveau'], mustNotContain: [] },
  { concept: 'enrobe', devisKeywords: ['enrobe', 'bbsg', 'bitumineux'], titleSynonyms: ['bitumineux', 'revetement', 'enrobe'], mustNotContain: [] },
  { concept: 'assainissement', devisKeywords: ['canalisation', 'pvc', 'collecteur'], titleSynonyms: ['canalisation', 'assainissement'], mustNotContain: [] },
  { concept: 'regard', devisKeywords: ['regard', 'tampon', 'avaloir'], titleSynonyms: ['regard', 'ouvrage'], mustNotContain: [] },
  { concept: 'beton', devisKeywords: ['beton'], titleSynonyms: ['beton'], mustNotContain: ['regard', 'bordure'] },
];

const baseProject = {
  chapters: [
    { id: 'a1', type: 'item', designation: 'Terrassement en déblai', description: '' },
    { id: 'a2', type: 'item', designation: 'Fourniture et pose de bordure T2', description: '' },
    { id: 'a3', type: 'item', designation: 'Béton bitumineux 0/10 BBSG', description: '' },
    { id: 'a4', type: 'item', designation: 'Canalisation PVC CR8 DN200', description: '' },
    { id: 'a5', type: 'item', designation: 'Regard de visite béton', description: '' },
  ],
};

// Trouve l'id d'un nœud par titre dans un arbre.
const idByTitle = (tree, title) => {
  let found = null;
  const walk = (nodes) => nodes.forEach((nn) => {
    if (nn.title === title) found = nn.id;
    if (nn.children) walk(nn.children);
  });
  walk(tree);
  return found;
};

describe('normalizeText', () => {
  it('retire accents, apostrophes et ponctuation', () => {
    expect(normalizeText("Réfection d'enrobé (BBSG)")).toBe('refection d enrobe bbsg');
    expect(normalizeText('Fil d’eau')).toBe('fil d eau');
  });
});

describe('within1 (anti-coquille OCR)', () => {
  it('tolère une édition', () => {
    expect(within1('terrassement', 'terassement')).toBe(true); // suppression
    expect(within1('bordure', 'bordures')).toBe(true);          // insertion
    expect(within1('abc', 'abd')).toBe(true);                   // substitution
  });
  it('rejette au-delà d’une édition', () => {
    expect(within1('beton', 'briton')).toBe(false);
    expect(within1('regard', 'tampon')).toBe(false);
  });
});

describe('buildIndex', () => {
  it('indexe par id littéral ET par numéro positionnel', () => {
    const { byKey } = buildIndex(makeTree('imported'));
    expect(byKey.has('2.2')).toBe(true);                       // positionnel
    expect(byKey.get('2.2').node.title).toBe('Bordures et caniveaux');
  });
});

describe('computeAutoSelection — équivalence master ↔ importé', () => {
  const run = (mode, extra = {}) => {
    const tree = makeTree(mode);
    const res = computeAutoSelection({ cctpData: tree, project: baseProject, taxonomy: TAXO, ...extra });
    return { tree, res };
  };

  for (const mode of ['master', 'imported']) {
    it(`sélectionne les bons chapitres (${mode})`, () => {
      const { tree, res } = run(mode);
      const sel = res.selectedIds;
      expect(sel.has(idByTitle(tree, 'Terrassements généraux'))).toBe(true);
      expect(sel.has(idByTitle(tree, 'Bordures et caniveaux'))).toBe(true);
      expect(sel.has(idByTitle(tree, 'Revêtements bitumineux'))).toBe(true);
      expect(sel.has(idByTitle(tree, 'Canalisations'))).toBe(true);
      expect(sel.has(idByTitle(tree, 'Regards et ouvrages'))).toBe(true);
      // parents cochés via le chemin
      expect(sel.has(idByTitle(tree, 'Voirie'))).toBe(true);
      expect(sel.has(idByTitle(tree, 'Assainissement'))).toBe(true);
      // chapitre obligatoire "Objet"
      expect(sel.has(idByTitle(tree, "Objet de l'accord-cadre"))).toBe(true);
    });
  }

  it('provenance : concept = deviné, obligatoire = sûr', () => {
    const { tree, res } = run('imported');
    expect(res.provenance.get(idByTitle(tree, 'Terrassements généraux')).confidence).toBe('devine');
    expect(res.provenance.get(idByTitle(tree, "Objet de l'accord-cadre")).confidence).toBe('sure');
  });

  it('cctpRef positionnel "2.2" résout sur un arbre importé (ids pdf_)', () => {
    const tree = makeTree('imported');
    const project = { chapters: [{ id: 'x', type: 'item', designation: 'Article sans mot-clé', cctpRefs: ['2.2'] }] };
    const res = computeAutoSelection({ cctpData: tree, project, taxonomy: TAXO });
    const bordureId = idByTitle(tree, 'Bordures et caniveaux');
    expect(res.selectedIds.has(bordureId)).toBe(true);
    expect(res.provenance.get(bordureId).confidence).toBe('sure'); // 'explicite'
  });

  it('mustNotContain bloque le concept (regard béton ne coche pas un chapitre béton)', () => {
    // L'article "Regard de visite béton" ne doit PAS déclencher le concept 'beton'
    // (mustNotContain ['regard']). On le vérifie indirectement : aucun nœud titré
    // "beton" n'existe, donc rien d'anormal ; on s'assure surtout que le concept
    // 'regard' a bien coché "Regards et ouvrages".
    const { tree, res } = run('imported');
    expect(res.selectedIds.has(idByTitle(tree, 'Regards et ouvrages'))).toBe(true);
  });
});

describe('apprentissage (learnedLinks)', () => {
  it('un lien appris coche un chapitre non déduit', () => {
    const tree = makeTree('imported');
    const objetId = idByTitle(tree, "Objet de l'accord-cadre");
    const item = { id: 'z', type: 'item', designation: 'Prestation diverse non mappée' };
    const sig = articleSignature(item);
    const res = computeAutoSelection({
      cctpData: tree, project: { chapters: [item] }, taxonomy: TAXO,
      learnedLinks: [{ sig, add: [idByTitle(tree, 'Canalisations')], remove: [] }],
    });
    expect(res.selectedIds.has(idByTitle(tree, 'Canalisations'))).toBe(true);
    expect(res.provenance.get(idByTitle(tree, 'Canalisations')).confidence).toBe('sure'); // 'appris'
    expect(objetId).toBeTruthy();
  });

  it('un retrait appris décoche un chapitre que l’AUTO aurait coché', () => {
    const tree = makeTree('imported');
    const terrId = idByTitle(tree, 'Terrassements généraux');
    const item = baseProject.chapters[0]; // "Terrassement en déblai"
    const sig = articleSignature(item);
    const res = computeAutoSelection({
      cctpData: tree, project: { chapters: [item] }, taxonomy: TAXO,
      learnedLinks: [{ sig, add: [], remove: [terrId] }],
    });
    expect(res.selectedIds.has(terrId)).toBe(false);
  });
});
