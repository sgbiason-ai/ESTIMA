// src/hooks/useProjectCalculations.js
import { useMemo, useEffect } from 'react';
import { computeQtyMaps, buildRefMap, buildDuplicateIndex } from '../utils/projectCalculations';

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

  // --- SEUIL DE MAJORATION (quantités ≤ |seuil| jamais majorées) ---
  const effectiveQtyThreshold = project?.clientQtyThreshold !== undefined
      ? Number(project.clientQtyThreshold)
      : 20;

  // --- CALCUL DES MAPS (QUANTITÉS) ---
  const { studyQtyMaps, clientQtyMaps } = useMemo(() => {
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
    // Calcul délégué à la fonction pure testée (projectCalculations.js) —
    // résolution des formules, arrondi étude au-delà du seuil, majoration client, tranches.
    return computeQtyMaps(allItems, hasTranches, tranches, effectiveClientPercent, effectiveQtyThreshold);
  }, [project, hasTranches, tranches, effectiveClientPercent, effectiveQtyThreshold]);

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
      // Mode hiérarchique (DQE « 2.1.3 ») : la fonction pure testée fait foi
      // (séquence partagée articles/sous-chapitres + unicité de prix).
      // On ajoute les alias designation/uid → numéro utilisés par l'affichage ligne.
      if (bpuConfig?.numberingMode === 'hierarchical') {
        const map = buildRefMap(displayProject?.chapters || [], bpuConfig);
        const addAliases = (nodes) => {
          if (!Array.isArray(nodes)) return;
          nodes.forEach((node) => {
            if (!node) return;
            if (node.type === 'item') {
              const ref = map.get(node.id);
              if (ref) {
                if (node.designation) map.set(node.designation.trim().toUpperCase(), ref);
                if (node.uid) map.set(node.uid, ref);
              }
            }
            if (node.children) addAliases(node.children);
          });
        };
        addAliases(displayProject?.chapters || []);
        return map;
      }

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
          } else if (node.isBloc) {
            // Sous-chapitre bloc : référencé par {blocId} dans les formules de ses
            // composants. Pas de numéro P.x — on mappe son id sur son titre lisible.
            const label = (node.title || 'BLOC').trim().toUpperCase();
            map.set(node.id, label);
          }
          if (node.children) traverse(node.children);
        });
      };
      traverse(displayProject?.chapters || []);
      return map;
    }, [displayProject, bpuConfig]);

  // --- PRIX RÉPÉTÉS (indicateur visuel tableau + bordereau) ---
  const duplicateIndex = useMemo(
    () => buildDuplicateIndex(displayProject?.chapters || []),
    [displayProject]
  );

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
    duplicateIndex,
    projectStats,
    currentStats,
    totalBase,
    totalOption
  };
};