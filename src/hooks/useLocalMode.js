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
  id: 'bpu_local_id',
  name: 'bpu_local_name',
  importedAt: 'bpu_local_imported_at',
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
  // Métadonnées de la biblio (permettent à un projet de garder un lien vers sa biblio source)
  const [localLibraryId, setLocalLibraryId] = useState(null);
  const [localLibraryName, setLocalLibraryName] = useState('');
  const [localLibraryImportedAt, setLocalLibraryImportedAt] = useState(null);

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
      setLocalLibraryId(localStorage.getItem(STORAGE_KEYS.id) || null);
      setLocalLibraryName(localStorage.getItem(STORAGE_KEYS.name) || '');
      setLocalLibraryImportedAt(localStorage.getItem(STORAGE_KEYS.importedAt) || null);
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
        if (localLibraryId) localStorage.setItem(STORAGE_KEYS.id, localLibraryId);
        else localStorage.removeItem(STORAGE_KEYS.id);
        if (localLibraryName) localStorage.setItem(STORAGE_KEYS.name, localLibraryName);
        else localStorage.removeItem(STORAGE_KEYS.name);
        if (localLibraryImportedAt) localStorage.setItem(STORAGE_KEYS.importedAt, localLibraryImportedAt);
        else localStorage.removeItem(STORAGE_KEYS.importedAt);
      } else {
        localStorage.setItem(STORAGE_KEYS.active, 'false');
      }
    } catch {
      // Quota dépassé → silencieux
    }
  }, [localBpu, localCategories, isLocalMode, localLibraryId, localLibraryName, localLibraryImportedAt]);

  // ─── IMPORTATION D'UN FICHIER LOCAL ──────────────────────────────────────

  const handleLocalImport = (json, meta = {}) => {
    if (!json?.bpu) return;
    setLocalBpu(json.bpu);
    setLocalCategories(json.categories || []);
    // Métadonnées : priorité au JSON, sinon meta (filename), sinon valeurs auto
    const id = json.id || meta.id || `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const name = json.name || meta.name || 'Bibliothèque locale';
    const importedAt = new Date().toISOString();
    setLocalLibraryId(id);
    setLocalLibraryName(name);
    setLocalLibraryImportedAt(importedAt);
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
      localStorage.removeItem(STORAGE_KEYS.id);
      localStorage.removeItem(STORAGE_KEYS.name);
      localStorage.removeItem(STORAGE_KEYS.importedAt);
      localStorage.setItem(STORAGE_KEYS.active, 'false');
    } catch { /* silencieux */ }

    setLocalBpu([]);
    setLocalCategories([]);
    setLocalLibraryId(null);
    setLocalLibraryName('');
    setLocalLibraryImportedAt(null);
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
    localLibraryId,
    localLibraryName,
    localLibraryImportedAt,

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
