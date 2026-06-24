// src/views/estimaTp/bordereau/tpBordereauModel.js
// ESTIMA TP — opérations d'arbre du bordereau (forme ESTIMA : chapters/children).
// Réutilise le moteur de formules ƒ(x) d'ESTIMA (recalculateProject) et la
// numérotation (buildRefMap) — fonctions pures partagées avec le devis MOE.
import { generateId } from '../../../utils/helpers';
import { recalculateProject, buildRefMap } from '../../../utils/projectCalculations';

// Numérotation hiérarchique type bordereau (1, 1.1, 1.1.2…)
export const TP_BPU_CONFIG = { numberingMode: 'hierarchical' };

// ─── Fabriques de nœuds (mêmes champs qu'ESTIMA, sans les notions MOE) ───────
export const newItem = (over = {}) => ({
  id: `tp_it_${generateId()}`,
  type: 'item',
  designation: '',
  unit: 'U',
  qty: 0,
  price: 0,       // PU HT — manuel en Phase 1, piloté par le sous-détail en Phase 2
  formula: '',    // ƒ(x) sur la quantité (=2*3.5, =[1.2]*1.1)
  ...over,
});

export const newChapter = (title = 'NOUVEAU CHAPITRE') => ({
  id: `tp_ch_${generateId()}`, type: 'chapter', title, children: [],
});

export const newSubChapter = (title = 'NOUVEAU SOUS-CHAPITRE') => ({
  id: `tp_sc_${generateId()}`, type: 'chapter', title, children: [],
});

const clone = (x) => JSON.parse(JSON.stringify(x));

// ─── Recherche ───────────────────────────────────────────────────────────────
export function findNode(chapters, id) {
  for (const n of chapters || []) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}

/** Id du parent d'un nœud ('root' si chapitre racine, undefined si introuvable). */
export function findParentId(chapters, id) {
  const walk = (arr, parentId) => {
    for (const n of arr || []) {
      if (!n) continue;
      if (n.id === id) return parentId;
      if (n.children) { const r = walk(n.children, n.id); if (r !== undefined) return r; }
    }
    return undefined;
  };
  return walk(chapters, 'root');
}

/** Tableau d'enfants d'un parent ('root' = racine), dans l'arbre fourni (référence vivante). */
function childrenOf(chapters, parentId) {
  if (parentId === 'root') return chapters;
  const p = findNode(chapters, parentId);
  return p ? (p.children || (p.children = [])) : null;
}

// ─── Mutations immuables (renvoient un nouvel arbre recalculé) ───────────────
/** Applique un mutateur sur un clone puis relance le moteur de formules. */
export function withRecalc(chapters, mutate) {
  const draft = clone(chapters || []);
  mutate(draft);
  const { updatedChapters } = recalculateProject(draft, []);
  return updatedChapters;
}

export function addNode(chapters, parentId, node) {
  return withRecalc(chapters, (draft) => {
    const arr = childrenOf(draft, parentId);
    if (arr) arr.push(node);
  });
}

export function removeNode(chapters, id) {
  return withRecalc(chapters, (draft) => {
    const prune = (arr) => {
      const i = arr.findIndex(n => n.id === id);
      if (i !== -1) { arr.splice(i, 1); return true; }
      return arr.some(n => n.children && prune(n.children));
    };
    prune(draft);
  });
}

export function updateNode(chapters, id, patch) {
  return withRecalc(chapters, (draft) => {
    const n = findNode(draft, id);
    if (n) Object.assign(n, patch);
  });
}

/** Déplacement drag&drop : retire le nœud du parent source, l'insère chez le parent cible. */
export function moveNode(chapters, srcParentId, srcIndex, dstParentId, dstIndex) {
  return withRecalc(chapters, (draft) => {
    const srcArr = childrenOf(draft, srcParentId);
    if (!srcArr) return;
    const [moved] = srcArr.splice(srcIndex, 1);
    if (!moved) return;
    const dstArr = childrenOf(draft, dstParentId);
    if (!dstArr) { srcArr.splice(srcIndex, 0, moved); return; } // rollback
    dstArr.splice(dstIndex, 0, moved);
  });
}

// ─── Numérotation + totaux (purs) ─────────────────────────────────────────────
export const refMapOf = (chapters) => buildRefMap(chapters || [], TP_BPU_CONFIG);

/** Total d'un nœud (article = qté×PU ; chapitre = Σ enfants). */
export function nodeTotal(node) {
  if (!node) return 0;
  if (node.type === 'item') return Number(node.qty || 0) * Number(node.price || 0);
  return (node.children || []).reduce((s, c) => s + nodeTotal(c), 0);
}

/** Compte récursif d'articles sous un nœud. */
export function countItems(nodes) {
  let n = 0;
  const walk = (arr) => (arr || []).forEach(x => {
    if (!x) return;
    if (x.type === 'item') n++;
    else if (x.children) walk(x.children);
  });
  walk(nodes);
  return n;
}

/** Liste à plat des articles (pour la barre ƒ(x) : référencement par libellé). */
export function flattenItems(chapters) {
  const out = [];
  const walk = (arr) => (arr || []).forEach(n => {
    if (!n) return;
    if (n.type === 'item') out.push({ id: n.id, designation: n.designation || '' });
    if (n.children) walk(n.children);
  });
  walk(chapters);
  return out;
}

/** Total général du bordereau. */
export const grandTotal = (chapters) =>
  (chapters || []).reduce((s, c) => s + nodeTotal(c), 0);
