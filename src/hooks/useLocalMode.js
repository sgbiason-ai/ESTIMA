// src/hooks/useLocalMode.js
/**
 * Gère la bascule entre mode Cloud (Firebase) et mode Local (localStorage).
 * Expose des handlers BPU unifiés qui se dirigent automatiquement
 * vers la bonne source de données selon le mode actif.
 */
import { useState, useEffect } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { generateId } from '../utils/helpers';

const STORAGE_KEYS = {
  active: 'bpu_local_active',
  data: 'bpu_local_data',
  categories: 'bpu_local_categories',
};

export const useLocalMode = ({
  cloudBpu,
  cloudCategories,
  addToBpu,
  deleteFromBpu,
  updateBpuItem,
  addCategory,
  deleteCategory: cloudDeleteCategory,
  renameCategory: cloudRenameCategory,
  setCategories: setCloudCategories,
  setActiveTab,
}) => {
  const { confirm } = useDialog();

  const [isLocalMode, setIsLocalMode] = useState(false);
  const [localBpu, setLocalBpu] = useState([]);
  const [localCategories, setLocalCategories] = useState([]);

  // ─── RESTAURATION SESSION AU DÉMARRAGE ───────────────────────────────────

  useEffect(() => {
    try {
      const isActive = localStorage.getItem(STORAGE_KEYS.active) === 'true';
      if (!isActive) return;

      const savedBpu = localStorage.getItem(STORAGE_KEYS.data);
      const savedCats = localStorage.getItem(STORAGE_KEYS.categories);
      if (!savedBpu) return;

      setLocalBpu(JSON.parse(savedBpu));
      setLocalCategories(savedCats ? JSON.parse(savedCats) : []);
      setIsLocalMode(true);
    } catch {
      // Données corrompues → on ignore silencieusement
    }
  }, []);

  // ─── PERSISTANCE AUTOMATIQUE ──────────────────────────────────────────────

  useEffect(() => {
    try {
      if (isLocalMode) {
        localStorage.setItem(STORAGE_KEYS.active, 'true');
        localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(localBpu));
        localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(localCategories));
      } else {
        localStorage.setItem(STORAGE_KEYS.active, 'false');
      }
    } catch {
      // Quota dépassé → silencieux
    }
  }, [localBpu, localCategories, isLocalMode]);

  // ─── IMPORTATION D'UN FICHIER LOCAL ──────────────────────────────────────

  const handleLocalImport = (json) => {
    if (!json?.bpu) return;
    setLocalBpu(json.bpu);
    setLocalCategories(json.categories || []);
    setIsLocalMode(true);
    setActiveTab('database');
  };

  // ─── SORTIE DU MODE LOCAL ─────────────────────────────────────────────────

  const handleExitLocalMode = async () => {
    const ok = await confirm(
      "Quitter le mode local ? Votre base reste sauvegardée dans ce navigateur et sera restaurée si vous revenez.",
      { title: "Quitter le mode local", confirmLabel: "Quitter" }
    );
    if (ok) setIsLocalMode(false);
  };

  // ─── SUPPRESSION DÉFINITIVE DE LA BASE LOCALE ─────────────────────────────

  const handleFullResetLocal = async () => {
    const ok = await confirm(
      "Supprimer définitivement la base locale stockée dans ce navigateur ? Cette action est irréversible.",
      { title: "Supprimer la base locale", danger: true, confirmLabel: "Supprimer définitivement" }
    );
    if (!ok) return;

    try {
      localStorage.removeItem(STORAGE_KEYS.data);
      localStorage.removeItem(STORAGE_KEYS.categories);
      localStorage.setItem(STORAGE_KEYS.active, 'false');
    } catch { /* silencieux */ }

    setLocalBpu([]);
    setLocalCategories([]);
    setIsLocalMode(false);
  };

  // ─── SÉLECTION DES DONNÉES ACTIVES ───────────────────────────────────────

  const currentBpu = isLocalMode ? localBpu : cloudBpu;
  const currentCategories = isLocalMode ? localCategories : cloudCategories;

  // ─── HANDLERS BPU UNIFIÉS ────────────────────────────────────────────────

  const handleAddToBpu = (item) => {
    if (isLocalMode) {
      setLocalBpu(prev => [...prev, { ...item, id: item.id || generateId() }]);
    } else {
      addToBpu(item);
    }
  };

  const handleDeleteFromBpu = (id) => {
    if (isLocalMode) {
      setLocalBpu(prev => prev.filter(i => i.id !== id));
    } else {
      deleteFromBpu(id);
    }
  };

  const handleUpdateBpuItem = (id, fields) => {
    if (isLocalMode) {
      setLocalBpu(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i));
    } else {
      updateBpuItem(id, fields);
    }
  };

  // ─── HANDLERS CATÉGORIES UNIFIÉS ──────────────────────────────────────────

  const handleAddCategory = (name) => {
    if (isLocalMode) {
      setLocalCategories(prev => [...prev, { id: generateId(), name: name.toUpperCase() }]);
    } else {
      addCategory(name);
    }
  };

  const handleDeleteCategory = (id) => {
    if (isLocalMode) {
      setLocalCategories(prev => prev.filter(c => c.id !== id));
    } else {
      cloudDeleteCategory(id);
    }
  };

  const handleRenameCategory = (id, name) => {
    if (isLocalMode) {
      setLocalCategories(prev => prev.map(c => c.id === id ? { ...c, name: name.toUpperCase() } : c));
    } else {
      cloudRenameCategory(id, name);
    }
  };

  const handleReorderCategories = (newOrder) => {
    if (isLocalMode) {
      setLocalCategories(newOrder);
    } else {
      setCloudCategories(newOrder);
    }
  };

  return {
    // État
    isLocalMode,
    currentBpu,
    currentCategories,

    // Actions mode local
    handleLocalImport,
    handleExitLocalMode,
    handleFullResetLocal,

    // Handlers unifiés
    handleAddToBpu,
    handleDeleteFromBpu,
    handleUpdateBpuItem,
    handleAddCategory,
    handleDeleteCategory,
    handleRenameCategory,
    handleReorderCategories,
  };
};
