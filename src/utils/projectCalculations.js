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

// Seuil par défaut : les quantités entre -20 et 20 ne sont jamais majorées.
// Paramétrable par projet via project.clientQtyThreshold (Calculateur de Marge).
export const DEFAULT_QTY_THRESHOLD = 20;

const safeThreshold = (t) => {
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_QTY_THRESHOLD;
};

const shouldScaleQty = (qty, threshold = DEFAULT_QTY_THRESHOLD) =>
  qty > threshold || qty < -threshold;

const roundDirectional = (v) => {
  if (v > 0) return Math.ceil(v);
  if (v < 0) return Math.floor(v);
  return 0;
};

export const calculateSafeClientQty = (rawQty, percent = 10, threshold = DEFAULT_QTY_THRESHOLD) => {
  const qty = toNum(rawQty, 0);
  if (qty === 0) return 0;
  if (!shouldScaleQty(qty, safeThreshold(threshold))) return qty;
  const coef = 1 + (toNum(percent, 0) / 100);
  return roundDirectional(qty * coef);
};

export const buildGlobalClientQtyMapFromStudyQty = (project, percent = 10) => {
  const map = new Map();

  if (!project?.chapters || !Array.isArray(project.chapters)) {
    return { map, coef: 1, totalInitial: 0, totalClient: 0, deltaPercent: 0 };
  }

  const coef = 1 + (toNum(percent, 0) / 100);
  const threshold = safeThreshold(project?.clientQtyThreshold);

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

        // Forfaits (isFixed) et quantités figées (qtyLocked) : jamais majorés.
        const qtyClient = (!node.isFixed && !node.qtyLocked && shouldScaleQty(qtyStudy, threshold))
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

// ─── ÉVALUATEUR MATHÉMATIQUE SÉCURISÉ ────────────────────────────────────────

/**
 * Parse et évalue une expression mathématique de façon sécurisée.
 * Supporte : nombres (entiers, décimaux, notation scientifique),
 *            opérateurs +, -, *, /, parenthèses, et le moins unaire.
 * Retourne 0 pour : division par zéro, expression vide, expression invalide.
 *
 * Implémentation : parseur par descente récursive (aucun eval / new Function).
 */
export function safeEvalMathExpr(expr) {
  if (typeof expr !== 'string') return 0;
  const src = expr.replace(/\s+/g, '');
  if (src.length === 0) return 0;

  let pos = 0;

  const peek = () => src[pos] ?? '';
  const advance = () => src[pos++];

  // number = [0-9]+ ( '.' [0-9]* )? ( [eE] [+-]? [0-9]+ )?
  function parseNumber() {
    const start = pos;
    while (pos < src.length && (src[pos] >= '0' && src[pos] <= '9')) pos++;
    if (pos < src.length && src[pos] === '.') {
      pos++;
      while (pos < src.length && (src[pos] >= '0' && src[pos] <= '9')) pos++;
    }
    if (pos < src.length && (src[pos] === 'e' || src[pos] === 'E')) {
      pos++;
      if (pos < src.length && (src[pos] === '+' || src[pos] === '-')) pos++;
      while (pos < src.length && (src[pos] >= '0' && src[pos] <= '9')) pos++;
    }
    if (pos === start) return NaN;
    return Number(src.slice(start, pos));
  }

  // atom = number | '(' expr ')' | unary-minus atom
  function parseAtom() {
    if (peek() === '(') {
      advance(); // skip '('
      const val = parseAddSub();
      if (peek() !== ')') return NaN; // mismatched parens
      advance(); // skip ')'
      return val;
    }
    if (peek() === '-') {
      advance();
      return -parseAtom();
    }
    if (peek() === '+') {
      advance();
      return parseAtom();
    }
    return parseNumber();
  }

  // mulDiv = atom ( ('*'|'/') atom )*
  function parseMulDiv() {
    let left = parseAtom();
    while (peek() === '*' || peek() === '/') {
      const op = advance();
      const right = parseAtom();
      if (op === '*') left = left * right;
      else left = right === 0 ? 0 : left / right; // division by zero → 0
    }
    return left;
  }

  // addSub = mulDiv ( ('+'|'-') mulDiv )*
  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() === '+' || peek() === '-') {
      const op = advance();
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = parseAddSub();

  // If there are leftover characters the expression was invalid
  if (pos !== src.length) return 0;
  if (!Number.isFinite(result)) return 0;
  return result;
}

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
    const result = safeEvalMathExpr(expr);
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
        // Les items ET les sous-chapitres "bloc" exposent une quantité référençable
        // (la surface du bloc pilote les quantités de ses composants).
        if (it.type === 'item' || it.isBloc) {
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
        const result = safeEvalMathExpr(expr);
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
        } else if (it.isBloc && hasTranches) {
          // Surface globale du bloc = somme des surfaces de tranche (saisies sur l'en-tête).
          let s = 0;
          if (it.quantities) Object.values(it.quantities).forEach(v => { s += Number(v) || 0; });
          if (it.qty !== s) { it.qty = s; hasChanges = true; }
        }
        if (it.children) apply(it.children);
      });
    };
    apply(current);
  }

  return { updatedChapters: current, sourceIds: Array.from(detectedIds) };
}

// ─── NUMÉROTATION DES ARTICLES (réf BPU) ──────────────────────────────────────

/**
 * Construit la map de numérotation des articles { itemId → réf }.
 * Reproduit la logique du hook useProjectCalculations (source de vérité) :
 *   - mode 'manual' : on utilise le bpuNum saisi (repli auto si vide)
 *   - sinon (auto)  : P.1, P.2… attribué par clé (uid, sinon désignation|unité|prix),
 *                     un même article (même clé) garde le même numéro.
 * Pure : aucune dépendance React. Utilisée par le viewer de version figée pour
 * respecter le mode de numérotation tel qu'il était au moment du gel.
 */
export function buildRefMap(chapters, bpuConfig = {}) {
  const map = new Map();
  const registry = new Map();
  let counter = 1;
  const buildKey = (node) => {
    if (node?.uid) return `UID:${String(node.uid)}`;
    const d = (node?.designation || '').trim().toUpperCase();
    const u = (node?.unit || '').trim().toUpperCase();
    const p = Number(node?.price || 0);
    return `FALLBACK:${d}|${u}|${p}`;
  };
  const traverse = (nodes) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      if (!node) return;
      if (node.type === 'item') {
        let refLabel = '';
        if (bpuConfig?.numberingMode === 'manual' && node.bpuNum) {
          refLabel = String(node.bpuNum).trim();
        } else {
          const key = buildKey(node);
          if (registry.has(key)) {
            refLabel = registry.get(key);
          } else {
            refLabel = `P.${counter++}`;
            registry.set(key, refLabel);
          }
        }
        map.set(node.id, refLabel);
      }
      if (node.children) traverse(node.children);
    });
  };
  traverse(chapters || []);
  return map;
}

// ─── VÉRIFICATION D'UNICITÉ DES NUMÉROS DE PRIX ───────────────────────────────

/**
 * Vérifie la cohérence des numéros de prix sur tout le projet.
 * Règle métier : un même numéro de prix (P.xx ou n° manuel) doit porter
 * partout le même libellé (désignation) ET la même unité.
 *
 * Détecte deux familles d'anomalies :
 *   A. numberConflicts  — un même numéro porte des libellés et/ou unités divergents.
 *   B. duplicateNumbers — un même couple (libellé + unité) apparaît sous plusieurs
 *                         numéros différents (article en double non fusionné).
 *
 * Comparaison insensible à la casse et aux espaces superflus ; les valeurs
 * affichées restent les valeurs réelles saisies. Pure : aucune dépendance React.
 *
 * @returns {{ totalItems, numberConflicts[], duplicateNumbers[], ok }}
 */
export function checkPriceConsistency(chapters, bpuConfig = {}) {
  const refMap = buildRefMap(chapters, bpuConfig);

  const normD = (s) => (s || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normU = (s) => (s || '').trim().toUpperCase();

  const items = [];
  const walk = (nodes, path = []) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      if (!node) return;
      if (node.type === 'item') {
        items.push({
          id: node.id,
          ref: refMap.get(node.id) || '—',
          designation: (node.designation || '').trim(),
          unit: (node.unit || '').trim(),
          price: Number(node.price || 0),
          path: path.slice(),
        });
      }
      if (node.children) {
        const label = node.title || node.designation || 'Chapitre';
        walk(node.children, [...path, label]);
      }
    });
  };
  walk(chapters || []);

  // ── A. Même numéro → libellé / unité divergents ──
  const byRef = new Map();
  items.forEach((it) => {
    if (!byRef.has(it.ref)) byRef.set(it.ref, []);
    byRef.get(it.ref).push(it);
  });
  const numberConflicts = [];
  byRef.forEach((group, ref) => {
    if (group.length < 2) return;
    const desigSet = new Set(group.map((g) => normD(g.designation)));
    const unitSet = new Set(group.map((g) => normU(g.unit)));
    if (desigSet.size > 1 || unitSet.size > 1) {
      numberConflicts.push({
        ref,
        divergesOn: [
          desigSet.size > 1 ? 'libellé' : null,
          unitSet.size > 1 ? 'unité' : null,
        ].filter(Boolean),
        items: group,
      });
    }
  });

  // ── B. Même libellé + unité → numéros différents ──
  const byContent = new Map();
  items.forEach((it) => {
    if (!it.designation) return; // on ignore les lignes sans libellé
    const key = `${normD(it.designation)}|||${normU(it.unit)}`;
    if (!byContent.has(key)) byContent.set(key, { items: [], refs: new Set() });
    const entry = byContent.get(key);
    entry.items.push(it);
    entry.refs.add(it.ref);
  });
  const duplicateNumbers = [];
  byContent.forEach((entry) => {
    if (entry.refs.size > 1) {
      duplicateNumbers.push({
        designation: entry.items[0].designation,
        unit: entry.items[0].unit,
        refs: [...entry.refs],
        items: entry.items,
      });
    }
  });

  // ── IDs de toutes les lignes en anomalie (pastille par ligne) ──
  const flagged = new Set();
  numberConflicts.forEach((c) => c.items.forEach((it) => flagged.add(it.id)));
  duplicateNumbers.forEach((d) => d.items.forEach((it) => flagged.add(it.id)));

  return {
    totalItems: items.length,
    numberConflicts,
    duplicateNumbers,
    flaggedItemIds: [...flagged],
    anomalyCount: numberConflicts.length + duplicateNumbers.length,
    ok: numberConflicts.length === 0 && duplicateNumbers.length === 0,
  };
}

// ─── MAPS DE QUANTITÉS ────────────────────────────────────────────────────────

/**
 * Calcule les maps de quantités étude et client pour toutes les tranches.
 * @param qtyThreshold seuil au-delà duquel les quantités sont majorées (défaut 20)
 */
export function computeQtyMaps(items, hasTranches, tranches, effectiveClientPercent, qtyThreshold = DEFAULT_QTY_THRESHOLD) {
  const sMaps      = {};
  const cMaps      = {};
  const threshold  = safeThreshold(qtyThreshold);
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
          if (resolved !== null) {
            // Les qtés d'étude issues d'une formule au-delà du seuil sont arrondies
            // au plafond/plancher (forfaits et petites qtés gardent leur valeur).
            const rounded = (!item.isFixed && shouldScaleQty(resolved, threshold))
              ? roundDirectional(resolved)
              : resolved;
            if (rounded !== sMap[item.id]) {
              sMap[item.id] = rounded;
              changed = true;
            }
          }
        }
      });
      if (!changed) break;
    }

    items.forEach(item => {
      if (!item.id) return;
      const baseQty = sMap[item.id] ?? 0;
      // Forfaits (isFixed) et quantités figées (qtyLocked) : jamais majorés.
      cMap[item.id] = (item.isFixed || item.qtyLocked)
        ? baseQty
        : calculateSafeClientQty(baseQty, effectiveClientPercent, threshold);
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