// src/hooks/useAppModals.js
/**
 * Centralise tous les états et handlers de modales de l'application.
 * Allège considérablement App.jsx.
 */
import { useState, useEffect } from 'react';

export const useAppModals = ({ project, setProject, setClientPercent, setViewMode }) => {

  // ─── MODAL ADD BPU ────────────────────────────────────────────────────────
  const [showAddBpuModal, setShowAddBpuModal] = useState(false);
  const [itemToDuplicate, setItemToDuplicate] = useState(null);

  const openAddBpuModal = (duplicateItem = null) => {
    setItemToDuplicate(duplicateItem);
    setShowAddBpuModal(true);
  };

  const closeAddBpuModal = () => {
    setShowAddBpuModal(false);
    setItemToDuplicate(null);
  };

  // ─── MODAL EDIT BPU ───────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState(null);

  // ─── MODAL SUPPRESSION ────────────────────────────────────────────────────
  const [deleteModal, setDeleteModal] = useState({ show: false, target: null });

  // CORRECTION ICI : On gère la "poupée russe" envoyée par ItemList.jsx
  const openDeleteModal = (payload) => {
    // Si la cible est emballée dans un objet contenant "target", on la déballe !
    const realTarget = payload && payload.target ? payload.target : payload;
    setDeleteModal({ show: true, target: realTarget });
  };
  
  const closeDeleteModal = () => setDeleteModal({ show: false, target: null });

  const confirmDelete = () => {
    const { target } = deleteModal;
    // Sécurité : si on n'a pas de cible valide, on annule.
    if (!target || !target.type) return;

    setProject(prev => {
      // Retour à l'architecture stricte à 3 niveaux : Chapitres > Sous-chapitres > Articles
      const currentChapters = prev.chapters || [];
      const targetIdStr = String(target.id);

      // 1. Suppression d'un Chapitre (Niveau 1)
      if (target.type === 'chapter') {
        return {
          ...prev,
          chapters: currentChapters.filter(c => String(c.id) !== targetIdStr)
        };
      }

      // 2. Suppression d'un Sous-chapitre (Niveau 2)
      if (target.type === 'subchapter') {
        return {
          ...prev,
          chapters: currentChapters.map(chapter => ({
            ...chapter,
            children: (chapter.children || []).filter(sub => String(sub.id) !== targetIdStr)
          }))
        };
      }

      // 3. Suppression d'un Article (peut être niveau 2 direct sous chapitre OU niveau 3 sous sous-chapitre)
      if (target.type === 'item') {
        const removeItem = (nodes) => {
          if (!Array.isArray(nodes)) return nodes;
          return nodes
            .filter(node => !(node && node.type === 'item' && String(node.id) === targetIdStr))
            .map(node => {
              if (node && node.children) return { ...node, children: removeItem(node.children) };
              return node;
            });
        };
        return { ...prev, chapters: removeItem(currentChapters) };
      }

      return prev;
    });

    closeDeleteModal();
  };

  // ─── MODAL CALCUL / VENTILATION ──────────────────────────────────────────
  const [calcModal, setCalcModal] = useState({ show: false, analysis: null });

  const openCalcModal = () => {
    if (!project?.chapters) return;

    let totalStudy = 0;
    // Lignes brutes pour la modale : la ventilation forfaits / petites quantités
    // y est recalculée en live selon le seuil choisi par l'utilisateur.
    const lines = [];

    const analyzeRecursive = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'item') {
          const q = Number(node.qty || 0);
          const amt = q * Number(node.price || 0);
          totalStudy += amt;
          lines.push({ qty: q, total: amt, fixed: !!(node.isFixed || node.qtyLocked) });
        } else if (node.children) {
          analyzeRecursive(node.children);
        }
      });
    };

    analyzeRecursive(project.chapters);
    setCalcModal({ show: true, analysis: { totalStudy, lines } });
  };

  const closeCalcModal = () => setCalcModal({ show: false, analysis: null });

  const applyVentilation = (percent, threshold) => {
    setClientPercent(percent);
    if (threshold !== undefined) setProject(prev => ({ ...prev, clientQtyThreshold: threshold }));
    closeCalcModal();
    setViewMode('client');
  };

  // ─── MODAL DÉTAILS PROJET ─────────────────────────────────────────────────
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const openProjectModal = () => setIsProjectModalOpen(true);
  const closeProjectModal = () => setIsProjectModalOpen(false);

  const handleSaveProjectDetails = (formData) => {
    setProject(prev => ({ ...prev, ...formData }));
    closeProjectModal();
  };

  // ─── CALCULATRICE FLOTTANTE ───────────────────────────────────────────────
  const [showFloatingCalculator, setShowFloatingCalculator] = useState(false);

  // ─── SÉLECTION ACTIVE (CHAPITRE / SOUS-CHAPITRE) ──────────────────────────
  const [selection, setSelection] = useState({ type: null, id: null });

  // ─── CIBLE D'INSERTION PERSISTANTE ────────────────────────────────────────
  // Dernier chapitre/sous-chapitre sélectionné : c'est là que sont insérés les
  // nouveaux articles (libre, bibliothèque, bloc). Elle NE change PAS quand on
  // sélectionne un article — uniquement au choix d'un autre chapitre/sous-chapitre.
  // Réinitialisée au changement de projet (les ids deviennent invalides).
  const [insertTargetId, setInsertTargetId] = useState(null);
  useEffect(() => {
    if (selection?.type === 'chapter' || selection?.type === 'subchapter') {
      setInsertTargetId(selection.id);
    }
  }, [selection]);
  useEffect(() => { setInsertTargetId(null); }, [project?.id]);

  // ─── MULTI-SÉLECTION D'ARTICLES (pour suppression en masse) ─────────────
  const [multiSelection, setMultiSelection] = useState(() => new Set());
  const [multiDeleteModal, setMultiDeleteModal] = useState({ show: false, items: [] });

  const toggleMultiSelection = (itemId) => {
    setMultiSelection(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const clearMultiSelection = () => setMultiSelection(new Set());

  // Réinitialise la multi-sélection au changement de projet (IDs deviennent invalides)
  useEffect(() => {
    setMultiSelection(new Set());
    setMultiDeleteModal({ show: false, items: [] });
  }, [project?.id]);

  const findItemsByIds = (chapters, idsSet) => {
    const found = [];
    const visit = (nodes) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(node => {
        if (node && node.type === 'item' && idsSet.has(node.id)) found.push(node);
        if (node && node.children) visit(node.children);
      });
    };
    visit(chapters);
    return found;
  };

  const openMultiDeleteModal = () => {
    if (multiSelection.size === 0) return;
    const items = findItemsByIds(project?.chapters || [], multiSelection);
    setMultiDeleteModal({ show: true, items });
  };

  const closeMultiDeleteModal = () => setMultiDeleteModal({ show: false, items: [] });

  const confirmMultiDelete = () => {
    const idsToRemove = new Set(multiSelection);
    if (idsToRemove.size === 0) { closeMultiDeleteModal(); return; }

    // Suppression récursive à tous les niveaux (article direct sous chapitre OU sous sous-chapitre)
    const removeFromTree = (nodes) => {
      if (!Array.isArray(nodes)) return nodes;
      return nodes
        .filter(node => !(node && node.type === 'item' && idsToRemove.has(node.id)))
        .map(node => {
          if (node && node.children) return { ...node, children: removeFromTree(node.children) };
          return node;
        });
    };

    setProject(prev => ({
      ...prev,
      chapters: removeFromTree(prev.chapters || []),
    }));

    clearMultiSelection();
    closeMultiDeleteModal();
  };

  // ─── AVERTISSEMENTS IMPORT ───────────────────────────────────────────────
  const [importWarnings, setImportWarnings] = useState([]);

  return {
    // Add BPU
    showAddBpuModal, itemToDuplicate, openAddBpuModal, closeAddBpuModal,
    // Edit BPU
    editTarget, setEditTarget,
    // Delete
    deleteModal, openDeleteModal, closeDeleteModal, confirmDelete,
    // Calcul / Ventilation
    calcModal, openCalcModal, closeCalcModal, applyVentilation,
    // Détails projet
    isProjectModalOpen, openProjectModal, closeProjectModal, handleSaveProjectDetails,
    // Calculatrice
    showFloatingCalculator, setShowFloatingCalculator,
    // Sélection
    selection, setSelection,
    // Cible d'insertion persistante (chapitre / sous-chapitre)
    insertTargetId, setInsertTargetId,
    // Multi-sélection (suppression masse)
    multiSelection, toggleMultiSelection, clearMultiSelection,
    multiDeleteModal, openMultiDeleteModal, closeMultiDeleteModal, confirmMultiDelete,
    // Import
    importWarnings, setImportWarnings,
  };
};