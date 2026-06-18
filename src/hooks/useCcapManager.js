// src/hooks/useCcapManager.js
// Gestionnaire du module CCAP (Cahier des Clauses Administratives Particulières).
// Calqué sur useRcManager, mais SANS modèle type ni critères RAO : le module
// démarre vide ; le contenu est importé (Word/PDF) ou rédigé puis sauvegardé.
import { useState, useEffect, useMemo, useRef } from 'react';
import { parseDocxToTree } from '../utils/wordImporter';
import { parsePdfToTree } from '../utils/parsePdfCctp';
import { computeDerogations } from '../utils/docContent';
import { toast, confirm } from '../utils/globalUI';
import { useRobustSave } from './useRobustSave';
import { useStableHash } from './useStableHash';

export const useCcapManager = ({
  project,
  masterCcap,
  onSaveMasterCcap,
  masterBranding,
  onUpdateProject,
  onSaveProject,
}) => {
  // --- UTILITAIRE : RÉCUPÉRER TOUS LES IDs ---
  const getAllIds = (nodes) => {
    const ids = new Set();
    const traverse = (items) => {
      if (!items) return;
      items.forEach(node => {
        ids.add(node.id);
        if (node.children) traverse(node.children);
      });
    };
    traverse(nodes);
    return ids;
  };

  // --- ETAT GLOBAL ---
  const [ccapData, setCcapData] = useState([]);
  const branding = masterBranding;

  useEffect(() => {
    if (masterCcap && masterCcap.length > 0) {
        setCcapData(JSON.parse(JSON.stringify(masterCcap)));
    }
    // Pas de modèle type : si masterCcap est vide, le module reste vide
    // (l'utilisateur importe ou rédige son CCAP).
  }, [masterCcap]);

  // --- SAUVEGARDE LIEE AU PROJET ---
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedIds, setExpandedIds] = useState(new Set());
  const isInitializedRef = useRef(null);

  // Initialisation fiable : on attend les données ET le projet
  useEffect(() => {
    if (project?.id && ccapData.length > 0) {
        if (isInitializedRef.current === project.id) return;

        const hasCloudSave = project.ccapSelectedIds !== undefined;
        const localSaveStr = localStorage.getItem(`ccap_selected_${project.id}`);
        const hasLocalSave = localSaveStr !== null;

        if (hasCloudSave) {
            setSelectedIds(new Set(project.ccapSelectedIds));
        } else if (hasLocalSave) {
            setSelectedIds(new Set(JSON.parse(localSaveStr)));
        } else {
            // NOUVEAU PROJET SANS SAUVEGARDE : ON COCHE TOUT PAR DÉFAUT
            setSelectedIds(getAllIds(ccapData));
        }

        if (project.ccapExpandedIds !== undefined) {
            setExpandedIds(new Set(project.ccapExpandedIds));
        } else {
            const expSaveStr = localStorage.getItem(`ccap_expanded_${project.id}`);
            if (expSaveStr) {
                setExpandedIds(new Set(JSON.parse(expSaveStr)));
            } else {
                const initialExpanded = new Set();
                ccapData.forEach(node => initialExpanded.add(node.id));
                setExpandedIds(initialExpanded);
            }
        }

        isInitializedRef.current = project.id;
    }
  }, [project?.id, ccapData]);

  // Synchronisation des sélections vers le projet
  useEffect(() => {
    if (isInitializedRef.current !== project?.id) return;

    const selArray = Array.from(selectedIds);
    const expArray = Array.from(expandedIds);

    if (project?.id) {
        localStorage.setItem(`ccap_selected_${project.id}`, JSON.stringify(selArray));
        localStorage.setItem(`ccap_expanded_${project.id}`, JSON.stringify(expArray));
    }

    const currentSel = project?.ccapSelectedIds;
    const currentExp = project?.ccapExpandedIds;

    if (JSON.stringify(selArray) !== JSON.stringify(currentSel) ||
        JSON.stringify(expArray) !== JSON.stringify(currentExp)) {
        if (onUpdateProject) {
            onUpdateProject({ ...project, ccapSelectedIds: selArray, ccapExpandedIds: expArray });
        }
    }
  }, [selectedIds, expandedIds, project, onUpdateProject]);

  // --- AUTOSAVE (robuste : debounce + retry + brouillon localStorage) ---
  const robustSave = useRobustSave({
    saveFn: onSaveProject,
    draftKey: project?.id ? `draft_ccap_${project.id}` : null,
    debounceMs: 2000,
  });

  const saveStatus = robustSave.saveStatus;

  const projectHash = useStableHash(project);
  const lastSavedHashRef = useRef(projectHash);
  useEffect(() => {
    if (isInitializedRef.current !== project?.id) return;
    if (projectHash === lastSavedHashRef.current) return;
    lastSavedHashRef.current = projectHash;
    robustSave.triggerSave(project);
  }, [projectHash, robustSave]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState(null);
  const isAutoScrolling = useRef(false);

  // ── VARIABLES : dérivées directement du projet (fiche projet) ───────────────
  const formatDateFR = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Les champs propres au CCAP (project.ccapVars) sont saisis via la modale
  // unifiée DocumentVariablesModal et injectés ci-dessous dans `variables`.
  const baseVariables = useMemo(() => {
    const hasPSE = (project?.chapters || []).some(c => c.isOption === true)
      ? 'comporte' : 'ne comporte pas';

    const tranchesList = project?.tranches || [];
    const trancheNames = tranchesList.length > 0
      ? '<ul>' + tranchesList.map(t => `<li>${t.name}</li>`).join('') + '</ul>'
      : '';

    return {
      name:               project?.name               || '',
      client:             project?.client             || '',
      clientAddress:      project?.clientAddress      || '',
      clientZip:          project?.clientZip          || '',
      clientCity:         project?.clientCity         || '',
      location:           project?.location           || '',
      code:               project?.code               || '',
      moe:                project?.moe                || '',
      moeAddress:         project?.moeAddress         || '',
      phase:              project?.phase              || 'DCE',
      marketType:         project?.marketType         || 'Privé',
      dateRemise:         formatDateFR(project?.dateRemise),
      timeRemise:         project?.timeRemise         || '',
      duration:           project?.duration           || '',
      prepPeriod:         project?.prepPeriod         || '',
      projectDescription: project?.projectDescription || '',
      hasPSE,
      trancheCount:       tranchesList.length > 0 ? String(tranchesList.length) : '1',
      trancheNames,
      department:         project?.department         || '',
      lotName:            project?.lotName            || '',
      spsLevel:           project?.spsLevel           || 'II',
      startDate:          project?.startDate          || '',
      validityDays:       project?.validityDays != null ? String(project.validityDays) : '120',
      platformUrl:        project?.platformUrl        || '',

      // ── Alias CCAP : placeholders du template dérivés de la fiche projet ──────
      objet_operation:     project?.projectDescription || '',
      pouvoir_adjudicateur: project?.client            || '',
      maitre_oeuvre:       project?.moe                || '',
      date_limite_offres:  formatDateFR(project?.dateRemise),
      lieu_execution:      project?.location           || '',
      categorie_sps:       project?.spsLevel           || 'II',

      // ── Champs PROPRES au CCAP (modale dédiée → project.ccapVars) ────────────
      coordonnateur_sps:                project?.ccapVars?.coordonnateur_sps                || '',
      duree_globale_mois:               project?.ccapVars?.duree_globale_mois               || '',
      duree_preparation_mois:           project?.ccapVars?.duree_preparation_mois           || '',
      duree_travaux_mois:               project?.ccapVars?.duree_travaux_mois               || '',
      index_revision:                   project?.ccapVars?.index_revision                   || '',
      seuil_debut_remboursement_avance: project?.ccapVars?.seuil_debut_remboursement_avance || '',
      voie_concernee:                   project?.ccapVars?.voie_concernee                   || '',
      station_meteo:                    project?.ccapVars?.station_meteo                    || '',
      jours_intemperies_previsibles:    project?.ccapVars?.jours_intemperies_previsibles    || '',
    };
  }, [project]);

  // {{derogations}} : liste de l'article 12 dérivée AUTOMATIQUEMENT du corps
  // (scan des « Par dérogation à l'article X du CCAG » dans les chapitres cochés).
  const derogations = useMemo(
    () => computeDerogations(ccapData, selectedIds),
    [ccapData, selectedIds]
  );

  const variables = useMemo(
    () => ({ ...baseVariables, derogations }),
    [baseVariables, derogations]
  );

  // --- RECHERCHE INTELLIGENTE (SANS ACCENTS) ---
  const removeAccents = (str) => {
    return (str || '').normalize("NFD").replace(/[̀-ͯ]/g, "");
  };

  const filteredCcapData = useMemo(() => {
    if (!searchQuery.trim()) return ccapData;

    const normalizedQuery = removeAccents(searchQuery.toLowerCase());

    const filterNodes = (nodes) => {
        return nodes.reduce((acc, node) => {
            const normalizedTitle = removeAccents((node.title || '').toLowerCase());
            const matchesTitle = normalizedTitle.includes(normalizedQuery);

            const filteredChildren = node.children ? filterNodes(node.children) : [];
            if (matchesTitle || filteredChildren.length > 0) {
                acc.push({ ...node, children: filteredChildren });
            }
            return acc;
        }, []);
    };
    return filterNodes(ccapData);
  }, [ccapData, searchQuery]);

  useEffect(() => {
      if (searchQuery.trim().length > 1) {
          const idsToExpand = new Set();
          const traverse = (nodes) => {
              nodes.forEach(node => {
                  if (node.children && node.children.length > 0) {
                      idsToExpand.add(node.id);
                      traverse(node.children);
                  }
              });
          };
          traverse(filteredCcapData);
          setExpandedIds(prev => new Set([...prev, ...idsToExpand]));
      }
  }, [filteredCcapData, searchQuery]);

  useEffect(() => {
    if (activeNodeId && !isAutoScrolling.current) {
        const treeElement = document.getElementById(`tree-node-${activeNodeId}`);
        if (treeElement) treeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeNodeId]);

  // --- UTILS ARBRE ---
  const findNodePath = (nodes, targetRef, parentPrefix = "", currentPath = []) => {
    const refStr = String(targetRef).trim();
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const currentNumber = parentPrefix ? `${parentPrefix}.${i + 1}` : `${i + 1}`;
        const newPath = [...currentPath, node.id];
        if (String(node.id) === refStr || currentNumber === refStr) return { node, path: newPath };
        if (node.children) {
            const found = findNodePath(node.children, targetRef, currentNumber, newPath);
            if (found) return found;
        }
    }
    return null;
  };

  // --- ACTIONS ---
  const toggleExpand = (id, e) => {
    e.stopPropagation();
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedIds(newSet);
  };

  const expandAll = () => {
    const allIds = new Set();
    const traverse = (nodes) => { nodes.forEach(node => { allIds.add(node.id); if (node.children) traverse(node.children); }); };
    traverse(ccapData);
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  // Coche TOUS les chapitres / décoche tout (cases à cocher de l'arbre).
  const selectAll = () => setSelectedIds(getAllIds(ccapData));
  const deselectAll = () => setSelectedIds(new Set());

  const handleExportMaster = () => {
    const blob = new Blob([JSON.stringify(ccapData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `SAUVEGARDE_CCAP_MAITRE_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await confirm("L'importation Word va REMPLACER toute la structure CCAP actuelle.\nVoulez-vous continuer ?", { title: 'Importation Word', danger: true });
    if (ok) {
      try {
        const newStructure = await parseDocxToTree(file);
        if (newStructure && newStructure.length > 0) {
          setCcapData(newStructure);
          setTimeout(() => setSelectedIds(getAllIds(newStructure)), 500);
          toast.success("Structure CCAP importée avec succès");
        } else toast.error("Erreur import : Structure vide.");
      } catch { toast.error("Erreur lors de l'importation."); }
    }
    e.target.value = null;
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await confirm("L'importation PDF va REMPLACER toute la structure CCAP actuelle.\nLe sommaire et le texte du PDF seront reconstruits par chapitre.\nVoulez-vous continuer ?", { title: 'Importation PDF', danger: true });
    if (ok) {
      toast.info("Analyse du PDF en cours…");
      try {
        const newStructure = await parsePdfToTree(file);
        if (newStructure && newStructure.length > 0) {
          setCcapData(newStructure);
          setTimeout(() => setSelectedIds(getAllIds(newStructure)), 500);
          const count = (function countNodes(nodes) {
            return nodes.reduce((acc, n) => acc + 1 + (n.children ? countNodes(n.children) : 0), 0);
          })(newStructure);
          toast.success(`Structure CCAP importée : ${count} chapitres`);
        } else {
          toast.error("Erreur import : aucune structure détectée.");
        }
      } catch (err) {
        toast.error(err?.message || "Erreur lors de l'importation du PDF.");
      }
    }
    e.target.value = null;
  };

  const scrollToPreview = (id) => {
    isAutoScrolling.current = true;
    setTimeout(() => {
        const previewElement = document.getElementById(`preview-node-${id}`);
        if (previewElement) {
            previewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const originalBg = previewElement.style.backgroundColor;
            previewElement.style.transition = 'background-color 0.5s';
            previewElement.style.backgroundColor = '#fef3c7';
            setTimeout(() => { previewElement.style.backgroundColor = originalBg || ''; isAutoScrolling.current = false; }, 800);
        } else isAutoScrolling.current = false;
    }, 150);
  };

  const handlePreviewScroll = (e) => {
      if (isAutoScrolling.current) return;
      const containerTop = e.target.getBoundingClientRect().top;
      const previewNodes = Array.from(document.querySelectorAll('[id^="preview-node-"]'));
      let closestNodeId = null; let minDistance = Infinity;
      previewNodes.forEach(node => {
          const distance = Math.abs(node.getBoundingClientRect().top - containerTop - 150);
          if (distance < minDistance) { minDistance = distance; closestNodeId = node.id.replace('preview-node-', ''); }
      });
      if (closestNodeId && closestNodeId !== activeNodeId) setActiveNodeId(closestNodeId);
  };

  const openEditor = (node) => {
    setNodeToEdit(node); setActiveNodeId(node.id); setModalOpen(true); scrollToPreview(node.id);
  };

  const handleSaveNode = (nodeId, newData) => {
    const updateRecursive = (nodes) => nodes.map(node => {
        if (node.id === nodeId) return { ...node, ...newData };
        if (node.children) return { ...node, children: updateRecursive(node.children) };
        return node;
    });
    setCcapData(updateRecursive(ccapData));
  };

  const addChapter = (parentId = null) => {
    let newLevel = 1;
    if (parentId) {
        const findLevel = (nodes, targetId) => {
            for (const node of nodes) {
                if (node.id === targetId) return node.level;
                if (node.children) { const l = findLevel(node.children, targetId); if (l) return l; }
            } return null;
        };
        const parentLevel = findLevel(ccapData, parentId);
        if (parentLevel) newLevel = parentLevel + 1;
    }
    const newNode = { id: `custom_${Date.now()}`, title: "NOUVEAU CHAPITRE", level: newLevel, content: "<p>...</p>", children: [] };
    if (!parentId) setCcapData([...ccapData, newNode]);
    else {
        const updateRecursive = (nodes) => nodes.map(node => {
            if (node.id === parentId) return { ...node, children: [...(node.children || []), newNode] };
            if (node.children) return { ...node, children: updateRecursive(node.children) };
            return node;
        });
        setCcapData(updateRecursive(ccapData));
        setExpandedIds(prev => new Set(prev).add(parentId));
    }
    openEditor(newNode);
  };

  const deleteNode = async (nodeId) => {
    const ok = await confirm("Supprimer ce chapitre ?", { danger: true });
    if (!ok) return;
    const deleteRecursive = (nodes) => nodes.filter(n => n.id !== nodeId).map(n => {
        if (n.children) return { ...n, children: deleteRecursive(n.children) }; return n;
    });
    setCcapData(deleteRecursive(ccapData));
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    const isSelecting = !newSet.has(id);

    const findNode = (nodes, targetId) => {
        for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.children) { const found = findNode(node.children, targetId); if (found) return found; }
        } return null;
    };

    const collectDescendantIds = (node, ids = []) => {
        ids.push(node.id); if (node.children) node.children.forEach(child => collectDescendantIds(child, ids)); return ids;
    };

    const targetNode = findNode(ccapData, id);
    if (targetNode) {
        collectDescendantIds(targetNode).forEach(childId => { if (isSelecting) newSet.add(childId); else newSet.delete(childId); });
    }

    if (isSelecting) {
        const result = findNodePath(ccapData, id);
        if (result) result.path.forEach(pid => newSet.add(pid));
        setActiveNodeId(id); scrollToPreview(id);
    }
    setSelectedIds(newSet);
  };

  const saveToCloud = async () => {
    const sanitizeData = (nodes) => {
        const seenIds = new Set();
        const cleanRecursive = (items) => items.map(item => {
            let newItem = { ...item };
            if (seenIds.has(newItem.id)) newItem.id = `fixed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            seenIds.add(newItem.id);
            if (newItem.children) newItem.children = cleanRecursive(newItem.children);
            return newItem;
        });
        return cleanRecursive(nodes);
    };
    const ok = await confirm("Mise à jour Cloud ?", { title: 'Mise à jour', danger: true });
    if (ok) {
        const cleanCcap = sanitizeData(ccapData);
        setCcapData(cleanCcap);
        onSaveMasterCcap(cleanCcap);
    }
  };

  return {
    ccapData, setCcapData, branding, selectedIds, expandedIds,
    activeNodeId, searchQuery, setSearchQuery, modalOpen, setModalOpen,
    nodeToEdit, variables, saveStatus, filteredCcapData,
    toggleExpand, expandAll, collapseAll, selectAll, deselectAll,
    handleExportMaster, handleFileUpload, handlePdfUpload, handlePreviewScroll,
    openEditor, handleSaveNode, addChapter, deleteNode, toggleSelection, saveToCloud,
  };
};
