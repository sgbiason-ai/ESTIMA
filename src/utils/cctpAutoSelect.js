// src/utils/cctpAutoSelect.js
//
// Moteur d'auto-sélection des chapitres CCTP — PUR (sans React), donc testable.
//
// Principe : relier chaque ligne de devis à des CHAPITRES de CCTP, via des
// CONCEPTS métier VRD (cf. VRD_CONCEPTS dans cctpData.js). Contrairement à
// l'ancienne approche (targetIds positionnels codés en dur, résolus par id
// littéral → morts sur tout CCTP importé), la résolution se fait par les MOTS
// DES TITRES de chapitre, donc fonctionne à l'identique sur :
//   - le CCTP maître (ids « 4.2 »),
//   - un CCTP importé PDF/Word (ids « pdf_… » / « imported_… », titres nettoyés).
//
// L'index est doublement clé (id littéral ET numéro positionnel calculé), ce qui
// réactive aussi les targetIds/cctpRefs « 4.2 » sur un arbre bien structuré.
//
// Chaque sélection porte une PROVENANCE (pourquoi le chapitre est coché), et les
// corrections manuelles mémorisées (learnedLinks) priment sur la déduction.

// ─── Normalisation ───────────────────────────────────────────────────────────
export const normalizeText = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/['’]/g, ' ')                            // apostrophes → espace
    .replace(/[-_/.,;:()]/g, ' ')                      // ponctuation → espace
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (textNorm) => textNorm.split(' ').filter(Boolean);

// Distance d'édition ≤ 1 (substitution/insertion/suppression) — anti-coquille OCR.
export const within1 = (a, b) => {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // substitution
  if (la < lb) return a.slice(i) === b.slice(i + 1);        // insertion dans b
  return a.slice(i + 1) === b.slice(i);                     // suppression dans b
};

// Un terme (déjà normalisé) est-il présent dans un texte ?
//  - expression multi-mots → sous-chaîne
//  - mot court (≤3) → mot entier (frontière) pour éviter le bruit (t1, gnt…)
//  - mot ≥5 → exact OU fuzzy ≤1 (coquilles OCR)
const matchesTerm = (textNorm, textWords, term) => {
  if (!term) return false;
  if (term.includes(' ')) return textNorm.includes(term);
  if (term.length <= 3) return new RegExp(`\\b${term}\\b`).test(textNorm);
  if (textWords.has(term)) return true;
  if (textNorm.includes(term)) return true; // sous-chaîne (ex « enrobe » ⊂ « enrobement »)
  if (term.length >= 5) {
    for (const w of textWords) if (w.length >= 5 && within1(w, term)) return true;
  }
  return false;
};

const scoreTerms = (textNorm, textWords, terms) => {
  let s = 0;
  for (const t of terms) if (matchesTerm(textNorm, textWords, normalizeText(t))) s++;
  return s;
};

// ─── Index de l'arbre (id littéral + numéro positionnel) ─────────────────────
export const buildIndex = (cctpData) => {
  const byKey = new Map();   // id littéral OU numéro positionnel → entry
  const flat = [];           // pour le scoring par titre

  const walk = (nodes, parentPrefix, parentPath) => {
    nodes.forEach((node, i) => {
      const number = parentPrefix ? `${parentPrefix}.${i + 1}` : `${i + 1}`;
      const path = [...parentPath, node.id];
      const titleNorm = normalizeText(node.title || '');
      const entry = {
        node,
        path,
        number,
        level: node.level ?? path.length,
        titleNorm,
        titleWords: new Set(tokenize(titleNorm)),
      };
      byKey.set(String(node.id), entry);
      if (!byKey.has(number)) byKey.set(number, entry); // n'écrase pas un id littéral homonyme
      flat.push(entry);
      if (node.children && node.children.length) walk(node.children, number, path);
    });
  };
  walk(cctpData || [], '', []);
  return { byKey, flat };
};

// ─── Signature d'un article (pour l'apprentissage) ───────────────────────────
export const articleSignature = (item) => {
  const base = normalizeText(item?.designation || '');
  const ref = item?.bpuNum || item?.bpuUid || item?.uid || '';
  return `${base}|${ref}`;
};

const STOP_WORDS = new Set([
  'travaux', 'travail', 'route', 'rue', 'place', 'centre', 'commune', 'ville',
  'amenagement', 'amenagements', 'projet', 'operation', 'operations', 'divers',
  'general', 'generale', 'generaux', 'generales', 'realisation', 'mise', 'oeuvre',
  'fourniture', 'pose', 'compris', 'toutes', 'sujetions', 'avenue', 'chemin', 'impasse',
]);

// ─── Calcul principal ────────────────────────────────────────────────────────
/**
 * @returns {{ selectedIds:Set, expandedIds:Set, provenance:Map<id,{sources:string[],confidence:'sure'|'devine'}> }}
 */
export const computeAutoSelection = ({ cctpData, project, taxonomy = [], learnedLinks = [], articleOnly = false }) => {
  const { byKey, flat } = buildIndex(cctpData || []);
  const selection = new Set();
  const expanded = new Set();
  const provSources = new Map(); // id → Set(sources)

  const addSource = (id, source) => {
    if (!provSources.has(id)) provSources.set(id, new Set());
    provSources.get(id).add(source);
  };

  // Coche un nœud (par id littéral OU numéro positionnel) + son chemin + ses descendants.
  const selectNode = (ref, source) => {
    const entry = byKey.get(String(ref).trim());
    if (!entry) return false;
    entry.path.forEach((pid) => { selection.add(pid); expanded.add(pid); });
    const down = (node) => {
      selection.add(node.id);
      addSource(node.id, source);
      node.children?.forEach(down);
    };
    down(entry.node);
    return true;
  };

  // Résout une liste de mots-clés de TITRE → meilleurs chapitres, puis coche.
  const selectByTitle = (terms, source, { minLevel = 2, minScore = 1 } = {}) => {
    if (!terms || !terms.length) return;
    const scored = [];
    for (const e of flat) {
      if (e.level < minLevel) continue;
      const s = scoreTerms(e.titleNorm, e.titleWords, terms);
      if (s > 0) scored.push({ e, s });
    }
    if (!scored.length) return;
    const maxScore = Math.max(...scored.map((x) => x.s));
    const floor = Math.max(minScore, maxScore);
    scored.filter((x) => x.s >= floor).forEach((x) => selectNode(x.e.node.id, source));
  };

  // Les passes globales (obligatoires, contexte, sismique) sont sautées en mode
  // articleOnly (utilisé par le « focus article » : on ne veut que ce que CET
  // article déclenche).
  if (!articleOnly) {
    // ── 1. Chapitres obligatoires (par titre, niveau 1+) ──
    [
      ['objet'],
      ['generalites', 'generalite', 'dispositions generales', 'prescriptions generales'],
      ['consistance des travaux', 'description des travaux', 'consistance'],
    ].forEach((terms) => selectByTitle(terms, 'obligatoire', { minLevel: 1, minScore: 1 }));

    // ── 2. Contexte projet (mots du nom/description, hors stop-words) ──
    const ctxText = normalizeText(`${project?.projectDescription || ''} ${project?.name || ''}`);
    const ctxTerms = [...new Set(tokenize(ctxText).filter((w) => w.length > 5 && !STOP_WORDS.has(w)))];
    if (ctxTerms.length) selectByTitle(ctxTerms, 'contexte', { minLevel: 2, minScore: 2 });

    // ── 3. Règle métier sismique par département ──
    const dpt = parseInt(project?.department, 10);
    const ZONES_SISMIQUES = [4, 5, 6, 9, 11, 13, 38, 64, 65, 66, 73, 74, 83, 971, 972, 973, 974];
    if (ZONES_SISMIQUES.includes(dpt)) {
      selectByTitle(['sismique', 'parasismique', 'eurocode 8'], 'sismique', { minLevel: 2 });
    }
  }

  // ── 4. Par article du devis ──
  const items = [];
  const extract = (nodes) => nodes?.forEach((n) => {
    if (n.type === 'item' || n.price !== undefined) items.push(n);
    if (n.children) extract(n.children);
  });
  extract(project?.chapters || []);

  // Index des liens appris par signature.
  const learnedBySig = new Map();
  (learnedLinks || []).forEach((l) => {
    if (!l || !l.sig) return;
    learnedBySig.set(l.sig, l);
  });
  // Un retrait appris ne doit annuler QUE les chapitres ajoutés par l'article qui
  // l'a appris — jamais ceux déjà présents (autre article, passe obligatoire…) ni
  // une source forte. D'où le snapshot `before` par article + le scoping ci-dessous.
  const STRONG = new Set(['explicite', 'obligatoire', 'appris']);

  items.forEach((item) => {
    const before = new Set(selection); // état avant cet article (appartient à d'autres)
    const text = normalizeText(`${item.designation || ''} ${item.description || ''}`);
    const words = new Set(tokenize(text));
    const learned = learnedBySig.get(articleSignature(item));

    // 4.a Liens explicites cctpRefs (id littéral OU numéro positionnel)
    const refs = item.cctpRefs || (item.cctpRef ? [item.cctpRef] : []);
    refs.forEach((ref) => selectNode(ref, 'explicite'));

    // 4.b Apprentissage : ajouts mémorisés pour cet article
    if (learned) (learned.add || []).forEach((id) => selectNode(id, 'appris'));

    // 4.c Concepts VRD (par mots du devis → résolus par mots des titres)
    let conceptHit = false;
    for (const c of taxonomy) {
      const blocked = (c.mustNotContain || []).some((b) => matchesTerm(text, words, normalizeText(b)));
      if (blocked) continue;
      const score = scoreTerms(text, words, c.devisKeywords || []);
      if (score < 1) continue;
      conceptHit = true;
      selectByTitle(c.titleSynonyms || [], 'concept', { minLevel: 2, minScore: 1 });
      (c.targetIds || []).forEach((id) => selectNode(id, 'concept')); // bonus si arbre canonique
    }

    // 4.d Correspondance directe titre ↔ désignation (si rien d'autre n'a accroché)
    if (refs.length === 0 && !conceptHit) {
      const dterms = [...new Set(tokenize(normalizeText(item.designation || ''))
        .filter((w) => w.length > 4 && !STOP_WORDS.has(w)))];
      if (dterms.length) selectByTitle(dterms, 'titre', { minLevel: 2, minScore: 2 });
    }

    // 4.e Retraits appris — uniquement les nœuds que CET article vient d'ajouter
    if (learned && learned.remove && learned.remove.length) {
      const removeIfOwn = (nid) => {
        if (before.has(nid)) return;                              // appartient à un autre article / passe
        const s = provSources.get(nid);
        if (s && [...s].some((x) => STRONG.has(x))) return;       // jamais une source forte (ex. cctpRef du même article)
        selection.delete(nid);
        provSources.delete(nid);
      };
      learned.remove.forEach((id) => {
        const entry = byKey.get(String(id));
        if (!entry) { removeIfOwn(id); return; }
        const down = (node) => { removeIfOwn(node.id); node.children?.forEach(down); };
        down(entry.node);
      });
    }
  });

  // ── Provenance finale + confiance ──
  const provenance = new Map();
  const SURE = new Set(['explicite', 'appris', 'obligatoire']);
  for (const [id, set] of provSources) {
    if (!selection.has(id)) continue;
    const sources = [...set];
    provenance.set(id, { sources, confidence: sources.some((s) => SURE.has(s)) ? 'sure' : 'devine' });
  }

  return { selectedIds: selection, expandedIds: expanded, provenance };
};
