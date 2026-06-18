// src/hooks/useCctpManager.js
import { useState, useEffect, useMemo, useRef } from 'react';
import { VRD_CONCEPTS } from '../data/cctpData';
import { computeAutoSelection, articleSignature } from '../utils/cctpAutoSelect';
import { parseDocxToTree } from '../utils/wordImporter';
import { parsePdfToTree } from '../utils/parsePdfCctp';
import { toast, confirm } from '../utils/globalUI';
import { useRobustSave } from './useRobustSave';
import { useStableHash } from './useStableHash';

export const useCctpManager = ({
  project,
  masterCctp,
  onSaveMasterCctp,
  masterBranding,
  onUpdateProject,
  onSaveProject
}) => {
  // --- ETAT GLOBAL ---
  const [cctpData, setCctpData] = useState(
      masterCctp ? JSON.parse(JSON.stringify(masterCctp)) : []
  );

  // branding est directement masterBranding — plus de state local
  const branding = masterBranding;

  useEffect(() => {
    if (masterCctp && masterCctp.length > 0) {
        setCctpData(JSON.parse(JSON.stringify(masterCctp)));
    }
  }, [masterCctp]);

  // --- SAUVEGARDE LIEE AU PROJET ---
  const [selectedIds, setSelectedIds] = useState(() => {
    if (project?.cctpSelectedIds) return new Set(project.cctpSelectedIds);
    const saved = localStorage.getItem(`cctp_selected_${project?.id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  const [expandedIds, setExpandedIds] = useState(() => {
    if (project?.cctpExpandedIds) return new Set(project.cctpExpandedIds);
    const saved = localStorage.getItem(`cctp_expanded_${project?.id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    if (project?.id) {
        if (project.cctpSelectedIds) {
            setSelectedIds(new Set(project.cctpSelectedIds));
        } else {
            const saved = localStorage.getItem(`cctp_selected_${project.id}`);
            setSelectedIds(saved ? new Set(JSON.parse(saved)) : new Set());
        }
        
        if (project.cctpExpandedIds) {
            setExpandedIds(new Set(project.cctpExpandedIds));
        } else {
            const saved = localStorage.getItem(`cctp_expanded_${project.id}`);
            setExpandedIds(saved ? new Set(JSON.parse(saved)) : new Set());
        }
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id) {
        localStorage.setItem(`cctp_selected_${project.id}`, JSON.stringify(Array.from(selectedIds)));
        localStorage.setItem(`cctp_expanded_${project.id}`, JSON.stringify(Array.from(expandedIds)));
    }
  }, [selectedIds, expandedIds, project?.id]);

  useEffect(() => {
    const selArray = Array.from(selectedIds);
    const expArray = Array.from(expandedIds);
    const currentSel = project?.cctpSelectedIds || [];
    const currentExp = project?.cctpExpandedIds || [];
    
    if (JSON.stringify(selArray) !== JSON.stringify(currentSel) || 
        JSON.stringify(expArray) !== JSON.stringify(currentExp)) {
        if (onUpdateProject) {
            onUpdateProject({ ...project, cctpSelectedIds: selArray, cctpExpandedIds: expArray });
        }
    }
  }, [selectedIds, expandedIds]);

  // --- AUTOSAVE (robuste : debounce + retry + brouillon localStorage) ---
  const robustSave = useRobustSave({
    saveFn: onSaveProject,
    draftKey: project?.id ? `draft_cctp_${project.id}` : null,
    debounceMs: 2000,
  });

  const saveStatus = robustSave.saveStatus;

  const projectHash = useStableHash(project);
  const lastSavedHashRef = useRef(projectHash);
  useEffect(() => {
    if (projectHash === lastSavedHashRef.current) return;
    lastSavedHashRef.current = projectHash;
    robustSave.triggerSave(project);
  }, [projectHash, robustSave]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState(null);
  const [provenance, setProvenance] = useState(new Map());
  const isAutoScrolling = useRef(false);

  // ── VARIABLES : dérivées directement du projet (fiche projet) ───────────────
  const formatDateFR = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const variables = useMemo(() => {
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
    };
  }, [project]);

  useEffect(() => {
    if (cctpData.length > 0 && expandedIds.size === 0) {
        const initialExpanded = new Set();
        cctpData.forEach(node => initialExpanded.add(node.id));
        setExpandedIds(initialExpanded);
    }
  }, [cctpData]);

  // --- RECHERCHE INTELLIGENTE (SANS ACCENTS) ---
  const removeAccents = (str) => {
    return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const filteredCctpData = useMemo(() => {
    if (!searchQuery.trim()) return cctpData;
    
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
    return filterNodes(cctpData);
  }, [cctpData, searchQuery]);

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
          traverse(filteredCctpData);
          setExpandedIds(prev => new Set([...prev, ...idsToExpand]));
      }
  }, [filteredCctpData, searchQuery]);

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

  // ─── AUTO-SÉLECTION CCTP (déléguée au moteur pur cctpAutoSelect.js) ───────────
  // Fonctionne sur le CCTP maître ET sur un CCTP importé (résolution par titres +
  // index positionnel + concepts VRD), avec apprentissage des corrections.
  const autoSelectChapters = () => {
    const { selectedIds: sel, expandedIds: exp, provenance: prov } = computeAutoSelection({
      cctpData,
      project,
      taxonomy: VRD_CONCEPTS,
      learnedLinks: project?.cctpLearnedLinks || [],
    });
    setSelectedIds(sel);
    setExpandedIds(exp);
    setProvenance(prov);
  };

  useEffect(() => {
    // ⚠️ On a retiré "project.chapters.length > 0" 
    // pour permettre aux chapitres de base et au contexte de se cocher sans devis.
    if (selectedIds.size === 0 && cctpData.length > 0) {
        autoSelectChapters();
    }
  }, [project?.id, cctpData]);

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
    traverse(cctpData);
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const handleExportMaster = () => {
    const blob = new Blob([JSON.stringify(cctpData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `SAUVEGARDE_CCTP_MAITRE_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await confirm("L'importation Word va REMPLACER toute la structure CCTP actuelle.\nVoulez-vous continuer ?", { title: 'Importation Word', danger: true });
    if (ok) {
      try {
        const newStructure = await parseDocxToTree(file);
        if (newStructure && newStructure.length > 0) {
          setCctpData(newStructure);
          setTimeout(() => setSelectedIds(new Set()), 500);
          toast.success("Structure CCTP importée avec succès");
        } else toast.error("Erreur import : Structure vide.");
      } catch { toast.error("Erreur lors de l'importation."); }
    }
    e.target.value = null;
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await confirm("L'importation PDF va REMPLACER toute la structure CCTP actuelle.\nLe sommaire et le texte du PDF seront reconstruits par chapitre.\nVoulez-vous continuer ?", { title: 'Importation PDF', danger: true });
    if (ok) {
      toast.info("Analyse du PDF en cours…");
      try {
        const newStructure = await parsePdfToTree(file);
        if (newStructure && newStructure.length > 0) {
          setCctpData(newStructure);
          setTimeout(() => setSelectedIds(new Set()), 500);
          const count = (function countNodes(nodes) {
            return nodes.reduce((acc, n) => acc + 1 + (n.children ? countNodes(n.children) : 0), 0);
          })(newStructure);
          toast.success(`Structure CCTP importée : ${count} chapitres`);
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
    setCctpData(updateRecursive(cctpData));
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
        const parentLevel = findLevel(cctpData, parentId);
        if (parentLevel) newLevel = parentLevel + 1;
    }
    const newNode = { id: `custom_${Date.now()}`, title: "NOUVEAU CHAPITRE", level: newLevel, content: "<p>...</p>", children: [] };
    if (!parentId) setCctpData([...cctpData, newNode]);
    else {
        const updateRecursive = (nodes) => nodes.map(node => {
            if (node.id === parentId) return { ...node, children: [...(node.children || []), newNode] };
            if (node.children) return { ...node, children: updateRecursive(node.children) };
            return node;
        });
        setCctpData(updateRecursive(cctpData));
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
    setCctpData(deleteRecursive(cctpData));
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
    
    const targetNode = findNode(cctpData, id);
    if (targetNode) {
        collectDescendantIds(targetNode).forEach(childId => { if (isSelecting) newSet.add(childId); else newSet.delete(childId); });
    }
    
    if (isSelecting) {
        const result = findNodePath(cctpData, id);
        if (result) result.path.forEach(pid => newSet.add(pid));
        setActiveNodeId(id); scrollToPreview(id);
    }
    setSelectedIds(newSet);
  };

  // Mémorise une correction manuelle (coche/décoche) d'un chapitre pour un article,
  // afin que l'AUTO la rejoue ensuite (apprentissage par signature d'article).
  const learnLink = (article, nodeId, mode = 'add') => {
    if (!article || !nodeId || !onUpdateProject) return;
    const sig = articleSignature(article);
    const links = (project?.cctpLearnedLinks || []).map(l => ({ ...l, add: [...(l.add || [])], remove: [...(l.remove || [])] }));
    let entry = links.find(l => l.sig === sig);
    if (!entry) { entry = { sig, add: [], remove: [] }; links.push(entry); }
    const addSet = new Set(entry.add);
    const remSet = new Set(entry.remove);
    if (mode === 'add') { addSet.add(nodeId); remSet.delete(nodeId); }
    else { remSet.add(nodeId); addSet.delete(nodeId); }
    entry.add = [...addSet];
    entry.remove = [...remSet];
    onUpdateProject({ ...project, cctpLearnedLinks: links });
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
        const cleanCctp = sanitizeData(cctpData);
        setCctpData(cleanCctp);
        onSaveMasterCctp(cleanCctp);
    }
  };

  return {
    cctpData, setCctpData, branding, selectedIds, expandedIds,
    activeNodeId, searchQuery, setSearchQuery, modalOpen, setModalOpen,
    nodeToEdit, variables, saveStatus, filteredCctpData,
    autoSelectChapters, toggleExpand, expandAll, collapseAll,
    handleExportMaster, handleFileUpload, handlePdfUpload, handlePreviewScroll,
    openEditor, handleSaveNode, addChapter, deleteNode, toggleSelection, saveToCloud,
    provenance, learnLink
  };
};