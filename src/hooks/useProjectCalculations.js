// src/hooks/useProjectCalculations.js
import { useMemo, useEffect } from 'react';

// --- ÉVALUATEUR DE FORMULES ---
// Remplace les {id} par les valeurs du qtyMap et évalue l'expression mathématique.
// Supporte : +, -, *, /, ( )
// Résout une formule qui peut contenir :
//   - {itemId}         → format stocké par la barre de formule après conversion
//   - [Désignation]    → format lisible (si la conversion n'a pas pu trouver l'id)
const evaluateFormula = (formulaStr, qtyMap, nameMap = {}) => {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) return null;
  try {
    let expr = formulaStr.substring(1).trim();

    // 1) Remplace les {id} par leur valeur numérique
    expr = expr.replace(/\{([^}]+)\}/g, (_, id) => {
      const val = qtyMap?.[id];
      const num = Number(val);
      return (val !== undefined && val !== null && !isNaN(num)) ? num : 0;
    });

    // 2) Remplace les [Nom d'article] par leur valeur (fallback si {id} n'a pas été résolu)
    expr = expr.replace(/\[([^\]]+)\]/g, (_, name) => {
      // Cherche en ignorant la casse et les espaces superflus
      const key = Object.keys(nameMap).find(
        k => k.trim().toLowerCase() === name.trim().toLowerCase()
      );
      const val = key !== undefined ? nameMap[key] : undefined;
      const num = Number(val);
      return (val !== undefined && val !== null && !isNaN(num)) ? num : 0;
    });

    // 3) Sécurité : uniquement chiffres et opérateurs mathématiques
    if (!/^[\d\s+\-*/().e]+$/i.test(expr)) return null;

    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)();
    return isFinite(result) ? result : 0;
  } catch {
    return null;
  }
};

export const useProjectCalculations = ({
  project,
  clientPercent,
  hasTranches,
  tranches,
  activeTrancheId,
  currentMode,
  bpuConfig
}) => {
  // --- CALCUL DU POURCENTAGE CLIENT ---
  const effectiveClientPercent = project?.clientPercent !== undefined 
      ? Number(project.clientPercent) 
      : (clientPercent !== undefined ? Number(clientPercent) : 10);
  
  // --- CALCUL DES MAPS (QUANTITÉS) ---
  const { studyQtyMaps, clientQtyMaps } = useMemo(() => {
    const sMaps = {};
    const cMaps = {};
    const trancheIds = hasTranches ? tranches.map(t => t.id) : [];
    const getItems = (chapters) => {
      const items = [];
      const traverse = (nodes) => {
        nodes.forEach(n => {
          if (n.type === 'item') items.push(n);
          else if (n.children) traverse(n.children);
        });
      };
      traverse(chapters || []);
      return items;
    };
    const allItems = getItems(project?.chapters);
    const calculateMapsForContext = (tid = null) => {
      const sMap = {};
      const cMap = {};
      const coeff = 1 + (effectiveClientPercent / 100);

      // --- PASSE 1 : valeurs brutes (non-formule) ---
      allItems.forEach(item => {
        if (!item.id) return;
        const rawVal = tid
          ? item.quantities?.[tid]
          : item.qty;
        // Si c'est une formule, on initialise à 0 provisoirement
        const isFormula = typeof rawVal === 'string' && rawVal.startsWith('=');
        sMap[item.id] = isFormula ? 0 : Number(rawVal || 0);
      });

      // --- PASSE 2 : résolution des formules (jusqu'à 5 itérations pour les dépendances chaînées) ---
      for (let pass = 0; pass < 5; pass++) {
        let changed = false;
        // Construit un map désignation → quantité pour le fallback [Nom]
        const nameMap = {};
        allItems.forEach(item => {
          if (item.id && item.designation) nameMap[item.designation] = sMap[item.id] ?? 0;
        });
        allItems.forEach(item => {
          if (!item.id) return;
          const rawVal = tid ? item.quantities?.[tid] : item.qty;
          if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
            const resolved = evaluateFormula(rawVal, sMap, nameMap);
            if (resolved !== null) {
              let rounded = resolved;
              if (!item.isFixed && (resolved <= -20 || resolved >= 20)) {
                rounded = resolved > 0 ? Math.ceil(resolved) : Math.floor(resolved);
              }
              if (rounded !== sMap[item.id]) {
                sMap[item.id] = rounded;
                changed = true;
              }
            }
          }
        });
        if (!changed) break;
      }

      // --- CALCUL DES QUANTITÉS CLIENT ---
      allItems.forEach(item => {
        if (!item.id) return;
        const baseQty = sMap[item.id] ?? 0;
        if (item.isFixed || (baseQty > -20 && baseQty < 20)) {
          cMap[item.id] = baseQty;
        } else {
          const val = baseQty * coeff;
          cMap[item.id] = val > 0 ? Math.ceil(val) : Math.floor(val);
        }
      });

      return { sMap, cMap };
    };
    if (!hasTranches) {
      const { sMap, cMap } = calculateMapsForContext();
      sMaps.global = sMap;
      cMaps.global = cMap;
    } else {
      trancheIds.forEach(tid => {
        const { sMap, cMap } = calculateMapsForContext(tid);
        sMaps[tid] = sMap;
        cMaps[tid] = cMap;
      });
      const sGlobal = {};
      const cGlobal = {};
      allItems.forEach(item => {
        if (item.id) {
          sGlobal[item.id] = trancheIds.reduce((sum, tid) => sum + (sMaps[tid][item.id] || 0), 0);
          cGlobal[item.id] = trancheIds.reduce((sum, tid) => sum + (cMaps[tid][item.id] || 0), 0);
        }
      });
      sMaps.global = sGlobal;
      cMaps.global = cGlobal;
    }
    return { studyQtyMaps: sMaps, clientQtyMaps: cMaps };
  }, [project, hasTranches, tranches, effectiveClientPercent]);

  const clientQtyMap = useMemo(() => {
    const data = clientQtyMaps[activeTrancheId || 'global'] || {};
    return new Map(Object.entries(data));
  }, [clientQtyMaps, activeTrancheId]);

  // --- PROJECTION DES DONNÉES (ARBRE DU PROJET) ---
  const displayProject = useMemo(() => {
    if (!project || !project.chapters) return { ...project, chapters: [] };
    const processNode = (node) => {
        if (!node) return null;
        if (node.type === 'item') {
            // ✅ On lit TOUJOURS depuis studyQtyMaps (qui résout les formules)
            // plutôt que de relire node.qty / node.quantities directement
            const sMap = studyQtyMaps[activeTrancheId || 'global'];
            const studyQty = sMap ? (sMap[node.id] ?? 0) : 0;

            let displayQty = studyQty;
            let clientVal = studyQty;
            const mapVal = clientQtyMap.get(String(node.id));
            if (mapVal !== undefined) {
                clientVal = mapVal;
                if (currentMode === 'client') {
                    displayQty = mapVal;
                }
            }
            return { 
                ...node, 
                qty: displayQty,
                studyQty: studyQty,
                clientQty: clientVal,
                _delta: clientVal - studyQty 
            };
        } else if (node.children) {
            return { ...node, children: node.children.map(processNode).filter(Boolean) };
        }
        return node;
    };
    return { ...project, chapters: project.chapters.map(processNode).filter(Boolean) };
  }, [project, activeTrancheId, hasTranches, currentMode, clientQtyMap, studyQtyMaps]);

  // --- NUMÉROTATION ---
  const refMap = useMemo(() => {
      const map = new Map();
      const registry = new Map();
      let counter = 1;
      const buildKey = (node) => {
        if (node?.uid) return `UID:${String(node.uid)}`;
        const d = (node?.designation || "").trim().toUpperCase();
        const u = (node?.unit || "").trim().toUpperCase();
        const p = Number(node?.price || 0);
        return `FALLBACK:${d}|${u}|${p}`;
      };
      const traverse = (nodes) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((node) => {
          if (!node) return;
          if (node.type === "item") {
            let refLabel = "";
            if (bpuConfig?.numberingMode === "manual" && node.bpuNum) {
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
            if (node.designation) map.set(node.designation.trim().toUpperCase(), refLabel);
            if (node.uid) map.set(node.uid, refLabel);
            map.set(node.id, refLabel);
          }
          if (node.children) traverse(node.children);
        });
      };
      traverse(displayProject?.chapters || []);
      return map;
    }, [displayProject, bpuConfig]);

  // --- SAUVEGARDE DES RENDUS QUANTITÉS ---
  useEffect(() => {
    if (!project?.id) return;
    localStorage.setItem(
      `render_qty_maps_${project.id}`,
      JSON.stringify({
        study: studyQtyMaps,
        client: clientQtyMaps,
        lastMode: currentMode,
        activeTrancheId,
        updatedAt: Date.now()
      })
    );
    window.dispatchEvent(new CustomEvent('render_qty_updated', { detail: { projectId: project.id } }));
  }, [project?.id, studyQtyMaps, clientQtyMaps, currentMode, activeTrancheId]);

  // --- STATISTIQUES ---
  const projectStats = useMemo(() => {
    if (!displayProject || !displayProject.chapters) return { study: { base: 0, option: 0, chapters: {} }, client: { base: 0, option: 0, chapters: {} } };
    const processMode = (isClientMode) => {
        let globalBase = 0;
        let globalOption = 0;
        const chapterStats = {};
        displayProject.chapters.forEach(chap => {
            const calcNode = (node, parentIsOption) => {
                let b = 0;
                let o = 0;
                const isEffectiveOption = parentIsOption || !!node.isOption;
                if (node.type === 'item') {
                    let q = 0;
                    if (isClientMode) {
                         q = clientQtyMap.get(String(node.id)) || 0;
                    } else {
                        // ✅ Toujours lire depuis studyQtyMaps (résout les formules, y compris tranches)
                        const sVal = studyQtyMaps[activeTrancheId || 'global'];
                        q = sVal ? (sVal[node.id] ?? 0) : 0;
                    }
                    const p = Number(node.price || 0);
                    const lineTotal = q * p;
                    if (isEffectiveOption) o += lineTotal; else b += lineTotal;
                } else if (node.children) {
                    node.children.forEach(child => {
                        const { base, option } = calcNode(child, isEffectiveOption);
                        b += base;
                        o += option;
                    });
                }
                return { base: b, option: o };
            };
            const { base, option } = calcNode(chap, false);
            chapterStats[chap.id] = base + option; 
            globalBase += base;
            globalOption += option;
        });
        return { base: globalBase, option: globalOption, chapters: chapterStats };
    };
    return { study: processMode(false), client: processMode(true) };
  }, [displayProject, clientQtyMap, studyQtyMaps, hasTranches, activeTrancheId]);

  const currentStats = currentMode === 'client' ? projectStats.client : projectStats.study;
  const totalBase = currentStats.base;
  const totalOption = currentStats.option;

  // On retourne toutes les variables utiles au composant principal
  return {
    studyQtyMaps,
    clientQtyMap,
    clientQtyMaps,
    displayProject,
    refMap,
    projectStats,
    currentStats,
    totalBase,
    totalOption
  };
};