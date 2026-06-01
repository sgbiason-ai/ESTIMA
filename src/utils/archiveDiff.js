// src/utils/archiveDiff.js
//
// Moteur de comparaison (diff) entre deux versions d'estimation.
// Fonctions PURES — aucune dépendance React/Firebase — testées via archiveDiff.test.js.
//
// Une « version » est un snapshot de projet : { chapters: [...] }.
// On compare deux snapshots (ou un snapshot vs le projet courant) pour produire :
//   - les totaux et compteurs de chaque côté
//   - le diff article par article (ajoutés / supprimés / modifiés)
//   - le diff chapitre par chapitre (écart de montant)

// ─── Totaux unitaires ────────────────────────────────────────────────
// Total HT d'un chapitre (récursif, options exclues du total).
export const computeChapterTotal = (node) => {
  let total = 0;
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'item' && !n.isOption) {
        total += (Number(n.qty) || 0) * (Number(n.price) || 0);
      }
      if (n.children) walk(n.children);
    });
  };
  walk(node.children);
  return total;
};

// Nombre d'articles d'un chapitre (récursif, options incluses).
export const countChapterItems = (node) => {
  let count = 0;
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'item') count++;
      if (n.children) walk(n.children);
    });
  };
  walk(node.children);
  return count;
};

// ─── Total d'un chapitre avec quantités résolues (tranche) ───────────
const chapterTotalWithQty = (node, qtyOf) => {
  let total = 0;
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'item' && !n.isOption) total += qtyOf(n) * (Number(n.price) || 0);
      if (n.children) walk(n.children);
    });
  };
  walk(node.children);
  return total;
};

// ─── Analyse d'un snapshot ───────────────────────────────────────────
// Aplatit l'arbre du projet en listes exploitables pour la comparaison.
// qtyMap (optionnel) : { [itemId]: qty } — quantités résolues d'une tranche.
//   Si absent, on lit node.qty (mode global / sans tranche).
// Retourne { chapters, items, totalHT, itemCount }.
export const analyzeChapters = (chapters, qtyMap = null) => {
  const result = { chapters: [], items: [], totalHT: 0, itemCount: 0 };
  const qtyOf = (node) => (qtyMap ? Number(qtyMap[node.id] || 0) : Number(node.qty) || 0);

  const walk = (nodes, path = '') => {
    (nodes || []).forEach((node) => {
      if (node.type === 'item') {
        const qty = qtyOf(node);
        const amount = qty * (Number(node.price) || 0);
        result.items.push({
          id: node.id,
          uid: node.uid || node.bpuNum || '',
          designation: node.designation || '',
          unit: node.unit || '',
          qty,
          price: Number(node.price) || 0,
          amount,
          path,
          isOption: !!node.isOption,
        });
        if (!node.isOption) {
          result.totalHT += amount;
          result.itemCount++;
        }
      } else {
        result.chapters.push({
          id: node.id,
          title: node.title || 'Sans titre',
          total: chapterTotalWithQty(node, qtyOf),
          itemCount: countChapterItems(node),
          path,
        });
        walk(node.children, path ? `${path} > ${node.title}` : node.title);
      }
    });
  };

  walk(chapters);
  return result;
};

// ─── Clé d'appariement d'un article entre deux versions ──────────────
// Priorité au uid (identifiant BPU stable), repli sur l'id de ligne.
const itemKey = (item) => item.uid || item.id;

// ─── Diff article par article ────────────────────────────────────────
// sourceData / targetData : sorties de analyzeChapters().
// Retourne { added, removed, changed } où :
//   added   = présents dans target, absents de source
//   removed = présents dans source, absents de target
//   changed = présents des deux côtés mais qty ou price différents
//             → { source, target, diff: target.amount - source.amount }
export const computeItemDiff = (sourceData, targetData) => {
  if (!sourceData || !targetData) return { added: [], removed: [], changed: [] };

  const sourceMap = new Map(sourceData.items.map((i) => [itemKey(i), i]));
  const targetMap = new Map(targetData.items.map((i) => [itemKey(i), i]));

  const added = [];
  const removed = [];
  const changed = [];

  targetMap.forEach((tItem, key) => {
    const sItem = sourceMap.get(key);
    if (!sItem) {
      added.push(tItem);
    } else if (sItem.qty !== tItem.qty || sItem.price !== tItem.price) {
      // Décomposition de l'écart (analyse de variance) :
      //   effet quantité = Δqté × prix_source
      //   effet prix     = Δprix × qté_cible
      //   qtyEffect + priceEffect = écart total (exact).
      const qtyEffect = (tItem.qty - sItem.qty) * sItem.price;
      const priceEffect = (tItem.price - sItem.price) * tItem.qty;
      changed.push({
        source: sItem,
        target: tItem,
        diff: tItem.amount - sItem.amount,
        qtyEffect,
        priceEffect,
        qtyChanged: sItem.qty !== tItem.qty,
        priceChanged: sItem.price !== tItem.price,
      });
    }
  });

  sourceMap.forEach((sItem, key) => {
    if (!targetMap.has(key)) removed.push(sItem);
  });

  return { added, removed, changed };
};

// ─── Fusion des chapitres pour comparaison côte à côte ───────────────
// Apparie par titre. Retourne [{ title, source, target }] (source/target
// peuvent être null si le chapitre n'existe que d'un côté).
export const mergeChapters = (sourceChapters, targetChapters) => {
  const map = new Map();
  (sourceChapters || []).forEach((c) => map.set(c.title, { title: c.title, source: c, target: null }));
  (targetChapters || []).forEach((c) => {
    if (map.has(c.title)) {
      map.get(c.title).target = c;
    } else {
      map.set(c.title, { title: c.title, source: null, target: c });
    }
  });
  return Array.from(map.values());
};

// ─── Synthèse complète d'une comparaison ─────────────────────────────
// Point d'entrée haut niveau : prend deux jeux de chapitres bruts et
// retourne tout ce qu'il faut pour afficher un audit.
// opts.sourceQtyMap / opts.targetQtyMap : quantités résolues d'une tranche
//   (pour comparer tranche par tranche ; sinon lecture de node.qty / global).
export const buildComparison = (sourceChapters, targetChapters, opts = {}) => {
  const source = analyzeChapters(sourceChapters, opts.sourceQtyMap || null);
  const target = analyzeChapters(targetChapters, opts.targetQtyMap || null);
  const items = computeItemDiff(source, target);
  const chapters = mergeChapters(source.chapters, target.chapters);
  const totalDiff = target.totalHT - source.totalHT;
  const totalDiffPct = source.totalHT ? (totalDiff / source.totalHT) * 100 : 0;

  // Contribution de chaque type de mouvement à l'écart total (waterfall).
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const addedTotal = sum(items.added.filter((i) => !i.isOption), (i) => i.amount);
  const removedTotal = -sum(items.removed.filter((i) => !i.isOption), (i) => i.amount);
  const changedTotal = sum(items.changed.filter((c) => !c.target.isOption), (c) => c.diff);
  const qtyEffectTotal = sum(items.changed.filter((c) => !c.target.isOption), (c) => c.qtyEffect);
  const priceEffectTotal = sum(items.changed.filter((c) => !c.target.isOption), (c) => c.priceEffect);

  // Articles modifiés triés par impact absolu décroissant (plus gros postes en tête).
  const changedByImpact = [...items.changed].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const waterfall = {
    start: source.totalHT,
    added: addedTotal,
    removed: removedTotal,
    changed: changedTotal,
    qtyEffect: qtyEffectTotal,
    priceEffect: priceEffectTotal,
    end: target.totalHT,
  };

  return {
    source,
    target,
    items: { ...items, changedByImpact },
    chapters,
    totalDiff,
    totalDiffPct,
    waterfall,
    hasChanges:
      items.added.length > 0 || items.removed.length > 0 || items.changed.length > 0,
  };
};
