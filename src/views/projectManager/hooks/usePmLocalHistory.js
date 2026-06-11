import { useState, useEffect, useRef } from 'react';
import { generateId } from '../../../utils/helpers';
import { toast, confirm } from '../../../utils/globalUI';

/**
 * usePmLocalHistory
 * Gère l'historique local (localStorage), l'export/import JSON et la duplication.
 */
export const usePmLocalHistory = ({
  project,
  setProject,
  bpuConfig,
  clientPercent,
  setBpuConfig,
  setClientPercent,
  companyId,
}) => {
  const [recentProjects, setRecentProjects] = useState([]);
  const fileInputRef = useRef(null);

  // Charger l'historique au montage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('project_history_index');
      if (raw) setRecentProjects(JSON.parse(raw));
    } catch (e) { console.error(e); }
  }, []);

  // ── Ajouter au localStorage ────────────────────────────────────────────────
  const addToHistory = (proj) => {
    if (!proj || !proj.id) return;
    try {
      const current = [...recentProjects];
      const updated = current.filter(p => p.id !== proj.id);
      updated.unshift({
        id:           proj.id,
        name:         proj.name || 'Sans nom',
        code:         proj.code || '',
        location:     proj.location || '',
        lastModified: new Date().toISOString(),
        chapterCount: (proj.chapters || []).length,
      });
      const trimmed = updated.slice(0, 10);
      localStorage.setItem('project_history_index', JSON.stringify(trimmed));
      localStorage.setItem(`project_backup_${proj.id}`, JSON.stringify(proj));
      setRecentProjects(trimmed);
    } catch (e) { console.warn(e); }
  };

  // ── Charger depuis l'historique ────────────────────────────────────────────
  const loadFromHistory = async (projectId) => {
    const ok = await confirm('Charger ce projet ?');
    if (!ok) return;
    try {
      const raw = localStorage.getItem(`project_backup_${projectId}`);
      if (raw) {
        const loaded = JSON.parse(raw);
        setProject(loaded);
        // Persister l'ID pour que ESTIMA VRD charge le bon projet
        if (companyId && loaded.id) {
          localStorage.setItem(`last_active_project_id__${companyId}`, loaded.id);
        }
        addToHistory(loaded);
      } else {
        toast.error('Projet introuvable dans le cache.');
      }
    } catch { toast.error('Erreur chargement.'); }
  };

  // ── Vider l'historique ─────────────────────────────────────────────────────
  const clearHistory = async () => {
    const ok = await confirm("Effacer l'historique ?", { danger: true });
    if (!ok) return;
    localStorage.removeItem('project_history_index');
    setRecentProjects([]);
  };

  // ── Export JSON ────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!project) return;
    const analysisKey  = `price_analysis_data_${project.id}`;
    const analysisData = localStorage.getItem(analysisKey)
      ? JSON.parse(localStorage.getItem(analysisKey))
      : [];
    const payload = {
      ...project,
      __priceAnalysisBackup: analysisData,
      __bpuConfig:           bpuConfig || {},
      __clientPercent:       clientPercent ?? 10,
      __exportedAt:          new Date().toISOString(),
    };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    link.download = `PROJET_${(project.name || 'Untitled').replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Import JSON ────────────────────────────────────────────────────────────
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        if (imported.__priceAnalysisBackup) {
          localStorage.setItem(`price_analysis_data_${imported.id}`, JSON.stringify(imported.__priceAnalysisBackup));
          delete imported.__priceAnalysisBackup;
        }
        if (imported.priceAnalysisData) {
          localStorage.setItem(`price_analysis_data_${imported.id}`, JSON.stringify(imported.priceAnalysisData));
        }

        const restoredBpuConfig     = imported.__bpuConfig     || null;
        const restoredClientPercent = imported.__clientPercent ?? null;
        delete imported.__bpuConfig;
        delete imported.__clientPercent;
        delete imported.__exportedAt;

        if (imported.chapters) {
          // Toujours générer un nouvel ID pour éviter d'écraser un projet
          // existant dans le cloud lors de la sauvegarde
          const oldId = imported.id;
          const newId = generateId();
          imported.id = newId;
          imported.__isNew = true;

          // Migrer les données d'analyse vers le nouvel ID
          const analysisData = localStorage.getItem(`price_analysis_data_${oldId}`);
          if (analysisData) {
            localStorage.setItem(`price_analysis_data_${newId}`, analysisData);
          }

          setProject(imported);
          if (companyId && imported.id) {
            localStorage.setItem(`last_active_project_id__${companyId}`, imported.id);
          }
          addToHistory(imported);
          if (restoredBpuConfig     && typeof setBpuConfig      === 'function') setBpuConfig(restoredBpuConfig);
          if (restoredClientPercent !== null && typeof setClientPercent === 'function') setClientPercent(restoredClientPercent);
        }
      } catch { toast.error('Fichier invalide.'); }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  // ── Duplication ────────────────────────────────────────────────────────────
  const handleClone = async () => {
    if (!project) return;
    const ok = await confirm(`Voulez-vous créer une copie de "${project.name}" ?`);
    if (!ok) return;
    try {
      const clone  = JSON.parse(JSON.stringify(project));
      const newId  = `clone_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      clone.id     = newId;
      clone.name   = `${clone.name} (Copie)`;
      const existing = localStorage.getItem(`price_analysis_data_${project.id}`);
      if (existing) localStorage.setItem(`price_analysis_data_${newId}`, existing);
      setProject(clone);
      if (companyId && clone.id) {
        localStorage.setItem(`last_active_project_id__${companyId}`, clone.id);
      }
      addToHistory(clone);
    } catch (e) {
      console.error('Erreur clonage', e);
      toast.error('Erreur lors de la duplication du projet.');
    }
  };

  return {
    recentProjects,
    fileInputRef,
    addToHistory,
    loadFromHistory,
    clearHistory,
    handleExport,
    handleImport,
    handleClone,
  };
};
