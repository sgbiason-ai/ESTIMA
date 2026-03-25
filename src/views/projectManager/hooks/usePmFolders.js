import { useState, useCallback, useEffect } from 'react';
import { collection, getDocs, deleteDoc, addDoc, updateDoc, doc as fsDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast, confirm } from '../../../utils/globalUI';

/**
 * usePmFolders
 * Gère les dossiers Firebase (CRUD), l'arbre d'expansion, et le filtrage des projets.
 *
 * @param {object} params
 * @param {string}   params.companyId
 * @param {Array}    params.cloudProjects   - liste des projets cloud
 * @param {Function} params.setCloudProjects
 * @param {object}   params.project         - projet actif (pour màj folderId si déplacé)
 * @param {Function} params.setProject
 */
export const usePmFolders = ({
  companyId,
  cloudProjects,
  setCloudProjects,
  project,
  setProject,
}) => {
  const [folders,          setFolders]          = useState([]);
  const [foldersLoading,   setFoldersLoading]   = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState('__all__'); // '__all__' | null | folderId
  const [expandedFolders,  setExpandedFolders]  = useState(new Set());
  const [creatingFolder,   setCreatingFolder]   = useState(null); // null | { parentId }
  const [newFolderName,    setNewFolderName]    = useState('');
  const [editingFolder,    setEditingFolder]    = useState(null); // null | { id, name }
  const [movingProject,    setMovingProject]    = useState(null); // null | proj

  // ── Chargement ─────────────────────────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    if (!companyId) return;
    setFoldersLoading(true);
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'folders'));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setFolders(list);
    } catch (e) {
      console.error('Erreur chargement dossiers', e);
    } finally {
      setFoldersLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // ── Créer ──────────────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !companyId) return;
    try {
      const docRef = await addDoc(collection(db, 'companies', companyId, 'folders'), {
        name:      trimmed,
        parentId:  creatingFolder?.parentId ?? null,
        createdAt: new Date().toISOString(),
      });
      const newFolder = { id: docRef.id, name: trimmed, parentId: creatingFolder?.parentId ?? null };
      setFolders(prev => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      if (creatingFolder?.parentId) {
        setExpandedFolders(prev => new Set([...prev, creatingFolder.parentId]));
      }
      setCreatingFolder(null);
      setNewFolderName('');
    } catch {
      toast.error('Erreur lors de la création du dossier.');
    }
  };

  // ── Renommer ───────────────────────────────────────────────────────────────
  const handleRenameFolder = async () => {
    const trimmed = editingFolder?.name?.trim();
    if (!trimmed || !companyId || !editingFolder?.id) return;
    try {
      await updateDoc(fsDoc(db, 'companies', companyId, 'folders', editingFolder.id), { name: trimmed });
      setFolders(prev => prev.map(f => f.id === editingFolder.id ? { ...f, name: trimmed } : f));
      setEditingFolder(null);
    } catch {
      toast.error('Erreur lors du renommage.');
    }
  };

  // ── Supprimer ──────────────────────────────────────────────────────────────
  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation();
    const folder         = folders.find(f => f.id === folderId);
    const subfolderCount = folders.filter(f => f.parentId === folderId).length;
    const projectCount   = cloudProjects.filter(p => p.folderId === folderId).length;

    const msg = [
      `Supprimer le dossier "${folder?.name}" ?`,
      projectCount   > 0 ? `• ${projectCount} affaire(s) seront déplacées à la racine.`      : null,
      subfolderCount > 0 ? `• ${subfolderCount} sous-dossier(s) seront remontés à la racine.` : null,
    ].filter(Boolean).join('\n');

    const ok = await confirm(msg, { danger: true });
    if (!ok) return;

    try {
      const projectsInFolder  = cloudProjects.filter(p => p.folderId === folderId);
      const subfoldersToMove  = folders.filter(f => f.parentId === folderId);

      await Promise.all([
        ...projectsInFolder.map(p => updateDoc(fsDoc(db, 'companies', companyId, 'projects', p.id), { folderId: null })),
        ...subfoldersToMove.map(f => updateDoc(fsDoc(db, 'companies', companyId, 'folders', f.id), { parentId: null })),
        deleteDoc(fsDoc(db, 'companies', companyId, 'folders', folderId)),
      ]);

      setFolders(prev =>
        prev.filter(f => f.id !== folderId)
            .map(f => f.parentId === folderId ? { ...f, parentId: null } : f)
      );
      setCloudProjects(prev => prev.map(p => p.folderId === folderId ? { ...p, folderId: null } : p));
      if (selectedFolderId === folderId) setSelectedFolderId('__all__');
    } catch {
      toast.error('Erreur lors de la suppression du dossier.');
    }
  };

  // ── Déplacer une affaire ───────────────────────────────────────────────────
  const handleMoveProject = async (projectId, targetFolderId) => {
    if (!companyId) return;
    try {
      await updateDoc(fsDoc(db, 'companies', companyId, 'projects', projectId), {
        folderId: targetFolderId ?? null,
      });
      setCloudProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, folderId: targetFolderId ?? null } : p)
      );
      if (project?.id === projectId) {
        setProject(prev => ({ ...prev, folderId: targetFolderId ?? null }));
      }
      setMovingProject(null);
    } catch {
      toast.error("Erreur lors du déplacement de l'affaire.");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const rootFolders   = folders.filter(f => !f.parentId);
  const getSubfolders = (parentId) => folders.filter(f => f.parentId === parentId);

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  };

  const filteredProjects = cloudProjects.filter(proj => {
    if (selectedFolderId === '__all__') return true;
    if (selectedFolderId === null) return !proj.folderId;
    return proj.folderId === selectedFolderId;
  });

  return {
    // État
    folders,
    foldersLoading,
    selectedFolderId, setSelectedFolderId,
    expandedFolders,
    creatingFolder,   setCreatingFolder,
    newFolderName,    setNewFolderName,
    editingFolder,    setEditingFolder,
    movingProject,    setMovingProject,
    // Données calculées
    rootFolders,
    getSubfolders,
    filteredProjects,
    // Actions
    toggleExpand,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveProject,
  };
};
