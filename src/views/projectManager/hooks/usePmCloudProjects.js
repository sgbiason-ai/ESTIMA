import { useState, useCallback, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc as fsDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast, confirm } from '../../../utils/globalUI';

/**
 * usePmCloudProjects
 * Gère la liste des projets Cloud (chargement, ouverture, suppression, sauvegarde).
 *
 * @param {object} params
 * @param {string}   params.companyId
 * @param {string}   params.historyTab      - onglet actif ('cloud' | 'local')
 * @param {object}   params.project         - projet actif
 * @param {Function} params.setProject
 * @param {object}   params.bpuConfig
 * @param {Function} params.setBpuConfig
 * @param {number}   params.clientPercent
 * @param {Function} params.setClientPercent
 * @param {Function} params.onSaveProject   - callback de sauvegarde cloud (depuis App)
 * @param {Function} params.addToHistory    - depuis usePmLocalHistory
 */
export const usePmCloudProjects = ({
  companyId,
  historyTab,
  project,
  setProject,
  bpuConfig,
  setBpuConfig,
  clientPercent,
  setClientPercent,
  onSaveProject,
  addToHistory,
}) => {
  const [cloudProjects, setCloudProjects] = useState([]);
  const [cloudLoading,  setCloudLoading]  = useState(false);
  const [cloudError,    setCloudError]    = useState(null);
  const [deletingId,    setDeletingId]    = useState(null);
  const [cloudSaving,   setCloudSaving]   = useState(false);
  const [cloudSaved,    setCloudSaved]    = useState(false);

  // ── Chargement liste cloud ─────────────────────────────────────────────────
  const loadCloudProjects = useCallback(async () => {
    if (!companyId) return;
    setCloudLoading(true);
    setCloudError(null);
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'projects'));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));
      setCloudProjects(list);
    } catch {
      setCloudError('Impossible de charger les projets.');
    } finally {
      setCloudLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (historyTab === 'cloud') loadCloudProjects();
  }, [historyTab, loadCloudProjects]);

  // ── Ouvrir un projet cloud ─────────────────────────────────────────────────
  const handleLoadCloudProject = async (proj) => {
    const ok = await confirm(`Ouvrir "${proj.name || 'Sans nom'}" ?`);
    if (!ok) return;
    setProject(proj);
    // Persister l'ID du projet actif pour que les autres modules (ESTIMA VRD)
    // chargent le bon projet via useProjectManager
    if (companyId && proj.id) {
      localStorage.setItem(`last_active_project_id__${companyId}`, proj.id);
    }
    addToHistory(proj);
    if (proj.priceAnalysisData && proj.id) {
      localStorage.setItem(`price_analysis_data_${proj.id}`, JSON.stringify(proj.priceAnalysisData));
    }
    if (proj.__bpuConfig    && typeof setBpuConfig      === 'function') setBpuConfig(proj.__bpuConfig);
    if (proj.__clientPercent !== undefined && typeof setClientPercent === 'function') setClientPercent(proj.__clientPercent);
  };

  // ── Supprimer un projet cloud ──────────────────────────────────────────────
  const handleDeleteCloudProject = async (proj, e) => {
    e.stopPropagation();
    const ok2 = await confirm(`Supprimer définitivement "${proj.name || 'Sans nom'}" du cloud ?`, { danger: true });
    if (!ok2) return;
    setDeletingId(proj.id);
    try {
      await deleteDoc(fsDoc(db, 'companies', companyId, 'projects', proj.id));
      setCloudProjects(prev => prev.filter(p => p.id !== proj.id));
    } catch {
      toast.error('Erreur lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Sauvegarde cloud ───────────────────────────────────────────────────────
  const handleCloudSave = async () => {
    if (!project || !onSaveProject) return;
    setCloudSaving(true);
    try {
      const analysisKey  = `price_analysis_data_${project.id}`;
      const analysisData = localStorage.getItem(analysisKey)
        ? JSON.parse(localStorage.getItem(analysisKey))
        : [];
      const now = new Date().toISOString();

      // Historique des sauvegardes — stocké en localStorage pour être
      // immédiatement disponible sans dépendre du retour Firestore.
      const historyKey   = `save_history_${project.id}`;
      const snapshotsKey = `save_snapshots_${project.id}`;

      const prevHistory = (() => {
        try { return JSON.parse(localStorage.getItem(historyKey) || '[]'); }
        catch { return []; }
      })();
      const prevSnapshots = (() => {
        try { return JSON.parse(localStorage.getItem(snapshotsKey) || '[]'); }
        catch { return []; }
      })();

      const saveHistory = [now, ...prevHistory].slice(0, 3);
      try { localStorage.setItem(historyKey, JSON.stringify(saveHistory)); } catch { /* quota */ }

      // Snapshot complet sans priceAnalysisData (déjà stocké séparément)
      // Try-catch : si localStorage est plein, on continue la sauvegarde cloud
      const snapshot = { savedAt: now, project: { ...project, priceAnalysisData: undefined } };
      const snapshotSize = new Blob([JSON.stringify(snapshot)]).size;
      const snapshots = [snapshot, ...prevSnapshots].slice(0, 3);
      try {
        localStorage.setItem(snapshotsKey, JSON.stringify(snapshots));
      } catch {
        const usedKB = Object.keys(localStorage).reduce((t, k) => t + ((localStorage.getItem(k) || '').length * 2), 0) / 1024;
        console.warn(`[LocalStorage] Quota dépassé — snapshot: ${(snapshotSize / 1024).toFixed(0)} KB, localStorage utilisé: ${usedKB.toFixed(0)} KB`);
        // Top 5 clés les plus lourdes
        const sizes = Object.keys(localStorage).map(k => ({ key: k, kb: ((localStorage.getItem(k) || '').length * 2 / 1024).toFixed(0) }))
          .sort((a, b) => b.kb - a.kb).slice(0, 5);
        console.table(sizes);
        // Fallback : 1 seul snapshot
        try { localStorage.setItem(snapshotsKey, JSON.stringify([snapshot])); }
        catch { localStorage.removeItem(snapshotsKey); }
      }

      const updatedProject = {
        ...project,
        priceAnalysisData: analysisData,
        lastSaved: now,
        saveHistory,
      };

      await onSaveProject(updatedProject);

      // Mettre à jour le projet actif ET la liste cloud
      setProject(updatedProject);
      setCloudProjects(prev => {
        const exists = prev.some(p => p.id === updatedProject.id);
        return exists
          ? prev.map(p => p.id === updatedProject.id ? updatedProject : p)
          : [updatedProject, ...prev];
      });

      addToHistory(updatedProject);
      setCloudSaved(true);
      setTimeout(() => setCloudSaved(false), 3000);
    } catch (e) {
      console.error('Erreur sauvegarde cloud :', e);
      toast.error('Sauvegarde Cloud impossible. Vos données locales sont intactes — réessayez dans quelques instants.');
    } finally {
      setCloudSaving(false);
    }
  };

  // ── Restaurer un snapshot ────────────────────────────────────────────────────
  const handleRestoreSnapshot = async (projectId, savedAt) => {
    const ok3 = await confirm(`Restaurer la version du ${new Date(savedAt).toLocaleString('fr-FR')} ?\nLe projet actuel sera remplacé — pensez à sauvegarder d'abord.`, { danger: true });
    if (!ok3) return;
    try {
      const snapshotsKey = `save_snapshots_${projectId}`;
      const snapshots = JSON.parse(localStorage.getItem(snapshotsKey) || '[]');
      const snap = snapshots.find(s => s.savedAt === savedAt);
      if (!snap) { toast.error('Snapshot introuvable.'); return; }

      // Restaurer les données d'analyse si disponibles
      const analysisKey = `price_analysis_data_${projectId}`;
      const restored = { ...snap.project };
      const existingAnalysis = localStorage.getItem(analysisKey);
      if (existingAnalysis) restored.priceAnalysisData = JSON.parse(existingAnalysis);

      setProject(restored);
      toast.success(`Projet restauré à la version du ${new Date(savedAt).toLocaleString('fr-FR')}. N'oubliez pas de faire un Cloud Save pour valider.`);
    } catch (e) {
      console.error('Erreur restauration', e);
      toast.error('Erreur lors de la restauration.');
    }
  };

  return {
    cloudProjects,
    setCloudProjects,
    cloudLoading,
    cloudError,
    deletingId,
    cloudSaving,
    cloudSaved,
    loadCloudProjects,
    handleRestoreSnapshot,
    handleLoadCloudProject,
    handleDeleteCloudProject,
    handleCloudSave,
  };
};