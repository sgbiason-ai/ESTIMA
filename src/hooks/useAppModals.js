// src/hooks/useAppModals.js
/**
 * Centralise tous les états et handlers de modales de l'application.
 * Allège considérablement App.jsx.
 */
import { useState } from 'react';

export const useAppModals = ({ project, setProject, clientPercent, setClientPercent, setViewMode, handleSaveProject }) => {

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

      // 3. Suppression d'un Article (Niveau 3)
      if (target.type === 'item') {
        return {
          ...prev,
          chapters: currentChapters.map(chapter => ({
            ...chapter,
            children: (chapter.children || []).map(sub => ({
              ...sub,
              children: (sub.children || []).filter(item => String(item.id) !== targetIdStr)
            }))
          }))
        };
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
    let fixedTotal = 0;

    const analyzeRecursive = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'item') {
          const q = Number(node.qty || 0);
          const amt = q * Number(node.price || 0);
          totalStudy += amt;
          if (q <= 20) fixedTotal += amt;
        } else if (node.children) {
          analyzeRecursive(node.children);
        }
      });
    };

    analyzeRecursive(project.chapters);
    setCalcModal({ show: true, analysis: { totalStudy, fixedTotal } });
  };

  const closeCalcModal = () => setCalcModal({ show: false, analysis: null });

  const applyVentilation = (percent) => {
    setClientPercent(percent);
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
    // Import
    importWarnings, setImportWarnings,
  };
};