// src/utils/projectCalculations.js
//
// Fonctions pures de calcul — aucune dépendance React ni Firebase.
// Importées par les hooks et testées via projectCalculations.test.js.


const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const keyOf = (node) => {
  const k = node?.uid ?? node?.id ?? node?.code ?? node?.ref;
  return k === undefined || k === null ? null : String(k);
};

const shouldScaleQty = (qty) => qty > 20 || qty < -20;

const roundDirectional = (v) => {
  if (v > 0) return Math.ceil(v);
  if (v < 0) return Math.floor(v);
  return 0;
};

export const calculateSafeClientQty = (rawQty, percent = 10) => {
  const qty = toNum(rawQty, 0);
  if (qty === 0) return 0;
  if (!shouldScaleQty(qty)) return qty;
  const coef = 1 + (toNum(percent, 0) / 100);
  return roundDirectional(qty * coef);
};

export const buildGlobalClientQtyMapFromStudyQty = (project, percent = 10) => {
  const map = new Map();

  if (!project?.chapters || !Array.isArray(project.chapters)) {
    return { map, coef: 1, totalInitial: 0, totalClient: 0, deltaPercent: 0 };
  }

  const coef = 1 + (toNum(percent, 0) / 100);

  let totalInitial = 0;
  let totalClient = 0;

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      if (!node) continue;

      if (node.type === "item") {
        const key = keyOf(node);
        if (!key) continue;

        const qtyStudy = toNum(node.qty, 0);
        const price = toNum(node.price, 0);

        totalInitial += qtyStudy * price;

        const qtyClient = shouldScaleQty(qtyStudy)
          ? roundDirectional(qtyStudy * coef)
          : qtyStudy;

        map.set(key, qtyClient);
        totalClient += qtyClient * price;
        continue;
      }

      if (node.children) visit(node.children);
    }
  };

  visit(project.chapters);

  const deltaPercent =
    totalInitial !== 0 ? ((totalClient - totalInitial) / totalInitial) * 100 : 0;

  return { map, coef, totalInitial, totalClient, deltaPercent };
};

export const sumNodeTotal = (node, isClientMode, clientQtyMap) => {
  if (!node) return 0;

  if (node.type === "item") {
    const qtyStudy = toNum(node.qty, 0);
    const price = toNum(node.price, 0);

    if (!isClientMode) return qtyStudy * price;

    const key = keyOf(node);
    const qtyClient =
      key && clientQtyMap?.has(key) ? toNum(clientQtyMap.get(key), qtyStudy) : qtyStudy;

    return qtyClient * price;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  let total = 0;
  for (const child of children) total += sumNodeTotal(child, isClientMode, clientQtyMap);
  return total;
};

export const formatPercent = (val) => {
  const n = toNum(val, 0);
  if (n === 0) return "0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

// ─── ÉVALUATEUR DE FORMULES ───────────────────────────────────────────────────

/**
 * Évalue une formule de type "=100+{id1}*2".
 * Supporte {itemId} et [Désignation] comme références.
 * @returns {number|null} — null si la formule est invalide ou absente
 */
export function evaluateFormula(formulaStr, qtyMap, nameMap = {}) {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) return null;
  try {
    let expr = formulaStr.substring(1).trim();

    expr = expr.replace(/\{([^}]+)\}/g, (_, id) => {
      const val = qtyMap?.[id];
      const num = Number(val);
      return (val !== undefined && val !== null && !isNaN(num)) ? num : 0;
    });

    expr = expr.replace(/\[([^\]]+)\]/g, (_, name) => {
      const key = Object.keys(nameMap).find(
        k => k.trim().toLowerCase() === name.trim().toLowerCase()
      );
      const val = key !== undefined ? nameMap[key] : undefined;
      const num = Number(val);
      return (val !== undefined && val !== null && !isNaN(num)) ? num : 0;
    });

    if (!/^[\d\s+\-*/().e]+$/i.test(expr)) return null;
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)();
    return isFinite(result) ? result : 0;
  } catch {
    return null;
  }
}

// ─── MOTEUR DE RECALCUL ───────────────────────────────────────────────────────

/**
 * Résout les formules et met à jour les quantités dans l'arbre de chapitres.
 * Itère jusqu'à 5 fois pour gérer les dépendances chaînées.
 * Fonction pure : ne mute pas l'entrée.
 */
export function recalculateProject(chapters, tranches = []) {
  const MAX_PASSES = 5;
  let current     = JSON.parse(JSON.stringify(chapters));
  let detectedIds = new Set();
  let hasChanges  = true;
  let passes      = 0;

  while (hasChanges && passes < MAX_PASSES) {
    hasChanges = false;
    passes++;

    const qtyMaps = { global: {} };
    tranches.forEach(t => { qtyMaps[t.id] = {}; });

    const extractQtys = (nodes) => {
      nodes.forEach(it => {
        if (it.type === 'item') {
          qtyMaps.global[it.id] = Number(it.qty) || 0;
          if (it.quantities) {
            Object.keys(it.quantities).forEach(tId => {
              if (!qtyMaps[tId]) qtyMaps[tId] = {};
              qtyMaps[tId][it.id] = Number(it.quantities[tId]) || 0;
            });
          }
        }
        if (it.children) extractQtys(it.children);
      });
    };
    extractQtys(current);

    const evalF = (formulaStr, contextMap) => {
      try {
        if (!formulaStr?.startsWith('=')) return null;
        let expr = formulaStr.substring(1).replace(/\{([^}]+)\}/g, (match, id) => {
          detectedIds.add(id);
          return contextMap[id] !== undefined ? contextMap[id] : 0;
        });
        const result = new Function('return ' + expr)();
        return Number.isFinite(result) ? result : 0;
      } catch { return 0; }
    };

    const hasTranches = tranches.length > 0;
    const apply = (nodes) => {
      nodes.forEach(it => {
        if (it.type === 'item') {
          let trancheSum = 0;
          if (it.quantitiesFormula) {
            if (!it.quantities) it.quantities = {};
            for (const [tId, formulaStr] of Object.entries(it.quantitiesFormula)) {
              if (formulaStr?.startsWith('=')) {
                const newVal = evalF(formulaStr, qtyMaps[tId] || {});
                if (newVal !== null && newVal !== it.quantities[tId]) {
                  it.quantities[tId] = newVal;
                  hasChanges = true;
                }
              }
              trancheSum += Number(it.quantities[tId] || 0);
            }
          }
          if (hasTranches) {
            if (it.qty !== trancheSum) { it.qty = trancheSum; hasChanges = true; }
          } else if (it.formula?.startsWith('=')) {
            const newVal = evalF(it.formula, qtyMaps.global);
            if (newVal !== null && newVal !== it.qty) { it.qty = newVal; hasChanges = true; }
          }
        }
        if (it.children) apply(it.children);
      });
    };
    apply(current);
  }

  return { updatedChapters: current, sourceIds: Array.from(detectedIds) };
}

// ─── MAPS DE QUANTITÉS ────────────────────────────────────────────────────────

/**
 * Calcule les maps de quantités étude et client pour toutes les tranches.
 */
export function computeQtyMaps(items, hasTranches, tranches, effectiveClientPercent) {
  const sMaps      = {};
  const cMaps      = {};
  const trancheIds = hasTranches ? tranches.map(t => t.id) : [];

  const calculateForContext = (tid = null) => {
    const sMap = {};
    const cMap = {};

    items.forEach(item => {
      if (!item.id) return;
      const rawVal    = tid ? item.quantities?.[tid] : item.qty;
      const isFormula = typeof rawVal === 'string' && rawVal.startsWith('=');
      sMap[item.id]   = isFormula ? 0 : Number(rawVal || 0);
    });

    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      const nameMap = {};
      items.forEach(item => {
        if (item.id && item.designation) nameMap[item.designation] = sMap[item.id] ?? 0;
      });
      items.forEach(item => {
        if (!item.id) return;
        const rawVal = tid ? item.quantities?.[tid] : item.qty;
        if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
          const resolved = evaluateFormula(rawVal, sMap, nameMap);
          if (resolved !== null && resolved !== sMap[item.id]) {
            sMap[item.id] = resolved;
            changed = true;
          }
        }
      });
      if (!changed) break;
    }

    items.forEach(item => {
      if (!item.id) return;
      const baseQty = sMap[item.id] ?? 0;
      cMap[item.id] = item.isFixed
        ? baseQty
        : calculateSafeClientQty(baseQty, effectiveClientPercent);
    });

    return { sMap, cMap };
  };

  if (!hasTranches) {
    const { sMap, cMap } = calculateForContext();
    sMaps.global = sMap;
    cMaps.global = cMap;
  } else {
    trancheIds.forEach(tid => {
      const { sMap, cMap } = calculateForContext(tid);
      sMaps[tid] = sMap;
      cMaps[tid] = cMap;
    });
    const sGlobal = {};
    const cGlobal = {};
    items.forEach(item => {
      if (item.id) {
        sGlobal[item.id] = trancheIds.reduce((s, tid) => s + (sMaps[tid][item.id] || 0), 0);
        cGlobal[item.id] = trancheIds.reduce((s, tid) => s + (cMaps[tid][item.id] || 0), 0);
      }
    });
    sMaps.global = sGlobal;
    cMaps.global = cGlobal;
  }

  return { studyQtyMaps: sMaps, clientQtyMaps: cMaps };
}

// ─── FORMULES DE NOTATION FINANCIÈRE (F1-F9) ──────────────────────────────────

/**
 * Calcule le score prix selon la formule choisie (marchés publics).
 */
export function computePriceScore(mode, N, P, Pmin, Pmax, Pmoy) {
  if (!P || P <= 0) return 0;
  let score = 0;
  switch (mode) {
    case 'f1': score = N * (Pmin / P); break;
    case 'f2': score = N * Math.pow(Pmin / P, 2); break;
    case 'f3': score = N * Math.pow(Pmin / P, 3); break;
    case 'f4': score = N * (1 - (P - Pmin) / Pmin); break;
    case 'f5': score = N * (1 - (P - Pmin) / Pmoy); break;
    case 'f6': score = P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2); break;
    case 'f7': score = Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin)); break;
    case 'f8': score = (N * Pmoy) / (Pmoy + P); break;
    case 'f9': score = N * ((2 * Pmin) / (Pmin + P)); break;
    default:   score = 0;
  }
  return Math.max(0, Math.min(N, score));
}

// ─── DÉTECTION PRIX ATYPIQUE ──────────────────────────────────────────────────

/**
 * Détermine si le PU d'une entreprise est atypique sur un article.
 * Seuils : écart > 25% de la moyenne ET impact > 2% du total entreprise.
 */
export function detectAtypicalPrice(companyPU, averagePU, activeQty, companyTotal) {
  if (!companyPU || !averagePU || !companyTotal) {
    return { isAtypical: false, direction: null, diffPct: 0 };
  }
  const diffRatio   = (companyPU - averagePU) / averagePU;
  const lineTotal   = companyPU * activeQty;
  const impactRatio = lineTotal / companyTotal;

  if (Math.abs(diffRatio) > 0.25 && impactRatio > 0.02) {
    return {
      isAtypical: true,
      direction:  diffRatio > 0 ? 'high' : 'low',
      diffPct:    Math.round(Math.abs(diffRatio) * 100),
    };
  }
  return { isAtypical: false, direction: null, diffPct: Math.round(Math.abs(diffRatio) * 100) };
}