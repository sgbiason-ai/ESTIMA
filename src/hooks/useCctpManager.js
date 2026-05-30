// src/hooks/useCctpManager.js
import { useState, useEffect, useMemo, useRef } from 'react';
import { SMART_MAPPING } from '../data/cctpData';
import { parseDocxToTree } from '../utils/wordImporter';
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

  // ─── UTILITAIRES TEXTE ───────────────────────────────────────────────────────

  const normalizeText = (str) =>
    (str || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ').trim();

  // Optimisation de la regex avec \b au lieu de lookbehinds
  const matchesWord = (text, keyword) => {
    if (keyword.length <= 3) {
      const re = new RegExp(`\\b${keyword}\\b`, 'i');
      return re.test(text);
    }
    return text.includes(keyword);
  };

  const scoreMatch = (text, keywords) =>
    keywords.filter(k => matchesWord(text, normalizeText(k))).length;

  // ─── INDEX CCTP (construit une seule fois par cctpData) ───────────────────
  const buildCctpIndex = (nodes, path = []) => {
    const index = new Map();
    const traverse = (nodes, currentPath) => {
      nodes.forEach((node) => {
        const nodePath = [...currentPath, node.id];
        index.set(String(node.id), { node, path: nodePath });
        if (node.children) traverse(node.children, nodePath);
      });
    };
    traverse(nodes, path);
    return index;
  };

  // Recherche dans les titres, avec minLevel pour cibler les chapitres principaux (niveau 1) ou non
  const findIdsByTitleKeywords = (nodes, keywords, minLevel = 2) => {
      const matches = [];
      nodes.forEach(node => {
          const title = normalizeText(node.title || '');
          const score = scoreMatch(title, keywords);
          if (node.level >= minLevel && score > 0) matches.push({ id: node.id, score });
          if (node.children) matches.push(...findIdsByTitleKeywords(node.children, keywords, minLevel));
      });
      return matches;
  };

  // ─── AUTO-SÉLECTION CCTP ─────────────────────────────────────────────────
  const autoSelectChapters = () => {
    const newSelection = new Set(); 
    const newExpanded = new Set();

    const cctpIndex = buildCctpIndex(cctpData);

    const selectNode = (id) => {
      const entry = cctpIndex.get(String(id));
      if (!entry) return;
      entry.path.forEach(pid => { newSelection.add(pid); newExpanded.add(pid); });
      const selectDown = (node) => {
        newSelection.add(node.id);
        node.children?.forEach(selectDown);
      };
      selectDown(entry.node);
    };

    // ── -1. CHAPITRES OBLIGATOIRES DE BASE ──
    const mandatoryKeywordsGroups = [
      ['objet'], // Plus besoin de "marche" à côté
      ['generalite'],
      ['generalites'],
      ['presentation']
    ];

    mandatoryKeywordsGroups.forEach(keywords => {
      // minLevel = 1 pour forcer la recherche dans les grands titres
      const matches = findIdsByTitleKeywords(cctpData, keywords, 1);
      matches
        .filter(c => c.score >= keywords.length)
        .forEach(c => selectNode(c.id));
    });

    // ── 0. CONTEXTE GLOBAL DU PROJET ──
    const projectContextText = normalizeText(`
      ${project?.projectDescription || ''} 
      ${project?.marketType || ''}
      ${project?.name || ''}
    `);
    
    const projectKeywords = projectContextText.split(' ').filter(w => w.length > 4);
    
    if (projectKeywords.length > 0) {
      const contextMatches = findIdsByTitleKeywords(cctpData, projectKeywords);
      contextMatches
        .filter(c => c.score >= 2)
        .forEach(c => selectNode(c.id));
    }

    // ── 0.bis RÈGLES MÉTIERS STRICTES (Exemple: Sismique selon département) ──
    if (project?.department) {
      const dpt = parseInt(project.department, 10);
      const zonesSismiques = [5, 9, 38, 73, 74, 65, 66, 971, 972, 973, 974]; 
      if (zonesSismiques.includes(dpt)) {
        const sismMatches = findIdsByTitleKeywords(cctpData, ['sismique', 'eurocode', 'parasismique']);
        sismMatches.forEach(c => selectNode(c.id));
      }
    }

    // ── 1. EXTRACTION DES ARTICLES DU DEVIS ──
    const allDevisItems = [];
    const extractItems = (nodes) => {
      nodes.forEach(n => {
        if (n.type === 'item' || n.price !== undefined) allDevisItems.push(n);
        if (n.children) extractItems(n.children);
      });
    };
    if (project?.chapters) extractItems(project.chapters);

    allDevisItems.forEach(item => {
      // ── 1. Liens CCTP explicites (cctpRefs)
      const refs = item.cctpRefs || (item.cctpRef ? [item.cctpRef] : []);
      refs.forEach(refId => selectNode(refId));

      // ── 2. SMART_MAPPING avec texte normalisé + scoring
      const rawText = `${item.designation} ${item.description || ''}`;
      const text = normalizeText(rawText);

      if (SMART_MAPPING) {
        const sortedRules = [...SMART_MAPPING].sort(
          (a, b) => b.keywords.length - a.keywords.length
        );

        sortedRules.forEach(rule => {
          const blocked = (rule.mustNotContain || []).some(bad =>
            matchesWord(text, normalizeText(bad))
          );
          if (blocked) return;

          const score = scoreMatch(text, rule.keywords);
          if (score === 0) return;

          const threshold = rule.keywords.length >= 4 ? 2 : 1;
          if (score < threshold) return;

          let foundAtLeastOne = false;
          (rule.targetIds || []).forEach(targetId => {
            if (cctpIndex.has(String(targetId))) {
              selectNode(targetId);
              foundAtLeastOne = true;
            }
          });

          if (!foundAtLeastOne) {
            const candidates = findIdsByTitleKeywords(cctpData, rule.keywords);
            const maxScore = Math.max(...candidates.map(c => c.score), 0);
            candidates
              .filter(c => c.score >= maxScore)
              .forEach(c => selectNode(c.id));
          }
        });
      }

      // ── 3. Correspondance directe titre CCTP ↔ désignation article
      if (refs.length === 0) {
        const words = text.split(' ').filter(w => w.length > 4);
        if (words.length > 0) {
          const direct = findIdsByTitleKeywords(cctpData, words);
          direct
            .filter(c => c.score >= 2)
            .forEach(c => selectNode(c.id));
        }
      }
    });

    // ── 4. Sélectionne les chapitres level=1 UNIQUEMENT si des enfants ont été sélectionnés
    cctpData.forEach(node => {
      if (node.level === 1) {
        const hasSelectedChild = node.children?.some(child => newSelection.has(child.id));
        if (hasSelectedChild) {
          newSelection.add(node.id);
          newExpanded.add(node.id);
        }
      }
    });

    setSelectedIds(newSelection);
    setExpandedIds(newExpanded);
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
    handleExportMaster, handleFileUpload, handlePreviewScroll,
    openEditor, handleSaveNode, addChapter, deleteNode, toggleSelection, saveToCloud
  };
};