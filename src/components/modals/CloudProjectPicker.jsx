// src/components/modals/CloudProjectPicker.jsx
//
// Modal grille Bento pour ouvrir un projet Cloud depuis ESTIMA.
// Reprend l'arborescence complète des dossiers du module Gestion de Projets :
// sidebar dossiers (CRUD + sous-dossiers), filtrage, déplacement de projet.
// Cartes : nom + n°, client, date dernière sauvegarde, total HT, suppression.

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Search, FolderOpen, Cloud, Clock, Trash2, RefreshCw,
  CloudOff, Building2, Coins, MoveRight,
} from 'lucide-react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { confirm } from '../../utils/globalUI';
import { buildFolderColorMap, NEUTRAL_COLOR } from '../../views/projectManager/folderColors';
import { usePmFolders } from '../../views/projectManager/hooks/usePmFolders';
import PmFolderSidebar from '../../views/projectManager/PmFolderSidebar';
import MoveFolderModal from '../../views/projectManager/MoveFolderModal';

// Format date FR : "Aujourd'hui HH:mm" / "14 avr" / "14 avr 2025"
const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `Aujourd'hui ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const opts = d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', opts);
  } catch { return ''; }
};

// Total HT du projet : somme qty × price sur tous les items (récursif)
const computeTotalHT = (proj) => {
  if (!proj?.chapters) return 0;
  let total = 0;
  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node) continue;
      if (node.type === 'item') {
        total += (Number(node.qty) || 0) * (Number(node.price) || 0);
      }
      if (node.children) visit(node.children);
    }
  };
  visit(proj.chapters);
  return total;
};

const formatPrice = (n) => {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
};

const removeAccents = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CloudProjectPicker = ({
  companyId,
  currentProjectId,
  project,        // projet Estima actif (optionnel, pour màj folderId si déplacé)
  setProject,     // setter projet actif (optionnel)
  onSelect,
  onClose,
}) => {
  const [cloudProjects, setCloudProjects] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [search, setSearch]               = useState('');
  const [deletingId, setDeletingId]       = useState(null);

  // Hook gestion dossiers (réutilisé tel quel depuis ProjectManager)
  const folderState = usePmFolders({
    companyId,
    cloudProjects,
    setCloudProjects,
    project: project || null,
    setProject: setProject || (() => {}),
  });

  const {
    folders, foldersLoading,
    selectedFolderId, setSelectedFolderId,
    expandedFolders,
    creatingFolder, setCreatingFolder,
    newFolderName, setNewFolderName,
    editingFolder, setEditingFolder,
    movingProject, setMovingProject,
    rootFolders, getSubfolders,
    filteredProjects,
    toggleExpand,
    handleCreateFolder, handleRenameFolder, handleDeleteFolder,
    handleMoveProject,
  } = folderState;

  // ESC pour fermer (sauf si une modale enfant est ouverte)
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      if (movingProject || creatingFolder || editingFolder) return; // laisse l'enfant gérer
      onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, movingProject, creatingFolder, editingFolder]);

  // Charger projets cloud
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, 'companies', companyId, 'projects'));
        if (cancelled) return;
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));
        setCloudProjects(list);
      } catch {
        if (!cancelled) setError('Impossible de charger les projets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const folderColorMap = useMemo(() => buildFolderColorMap(folders), [folders]);

  // Recherche texte appliquée APRÈS le filtre dossier (filteredProjects)
  const visibleProjects = useMemo(() => {
    const q = removeAccents(search.trim());
    if (!q) return filteredProjects;
    return filteredProjects.filter(p =>
      removeAccents(p.name || '').includes(q) ||
      removeAccents(p.client || '').includes(q) ||
      removeAccents(p.code || '').includes(q) ||
      removeAccents(p.location || '').includes(q)
    );
  }, [filteredProjects, search]);

  const handleDelete = async (e, proj) => {
    e.stopPropagation();
    if (proj.id === currentProjectId) return; // garde-fou
    const ok = await confirm(
      `Supprimer le projet "${proj.name || 'Sans nom'}" ? Cette action est irréversible.`,
      { danger: true, title: 'Supprimer le projet', confirmLabel: 'Supprimer' }
    );
    if (!ok) return;
    setDeletingId(proj.id);
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'projects', proj.id));
      setCloudProjects(prev => prev.filter(p => p.id !== proj.id));
    } catch (err) {
      console.error('[CloudProjectPicker] Suppression échouée:', err);
      setError('Suppression échouée.');
    } finally {
      setDeletingId(null);
    }
  };

  // Libellé du filtre actif (pour le compteur header)
  const folderLabel = useMemo(() => {
    if (selectedFolderId === '__all__') return 'Tous';
    if (selectedFolderId === null) return 'Sans dossier';
    return folders.find(f => f.id === selectedFolderId)?.name || '';
  }, [selectedFolderId, folders]);

  return createPortal(
    <div
      className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}

    >
      <div
        className="bg-[#f5f5f7] rounded-3xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-4 flex items-center gap-4">
          <Cloud size={18} className="text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Ouvrir un projet Cloud</h2>
          <div className="text-xs text-gray-400">
            {visibleProjects.length} {visibleProjects.length > 1 ? 'projets' : 'projet'}
            {selectedFolderId !== '__all__' && ` · ${folderLabel}`}
            {search && ` · "${search}"`}
          </div>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher nom, client, n°..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 border border-gray-200/60 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
            title="Fermer (Échap)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body : sidebar dossiers + grille */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar dossiers (réutilise PmFolderSidebar, DnD activé) */}
          <PmFolderSidebar
            folders={folders}
            foldersLoading={foldersLoading}
            selectedFolderId={selectedFolderId}
            setSelectedFolderId={setSelectedFolderId}
            expandedFolders={expandedFolders}
            creatingFolder={creatingFolder}
            setCreatingFolder={setCreatingFolder}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            editingFolder={editingFolder}
            setEditingFolder={setEditingFolder}
            cloudProjects={cloudProjects}
            rootFolders={rootFolders}
            getSubfolders={getSubfolders}
            toggleExpand={toggleExpand}
            handleCreateFolder={handleCreateFolder}
            handleRenameFolder={handleRenameFolder}
            handleDeleteFolder={handleDeleteFolder}
            onProjectDrop={(targetFolderId, projectId) => handleMoveProject(projectId, targetFolderId)}
          />

          {/* Grille de projets */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="h-full flex items-center justify-center gap-2 text-gray-400">
                <RefreshCw size={18} className="animate-spin" />
                <span className="text-sm">Chargement...</span>
              </div>
            )}

            {error && !loading && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-red-400 py-20">
                <CloudOff size={32} />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && visibleProjects.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <FolderOpen size={48} strokeWidth={1.5} className="mb-3 opacity-50" />
                <p className="text-sm">
                  {cloudProjects.length === 0
                    ? 'Aucun projet sur le Cloud.'
                    : 'Aucun projet dans cette sélection.'}
                </p>
              </div>
            )}

            {!loading && !error && visibleProjects.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleProjects.map((proj) => {
                  const isActive   = proj.id === currentProjectId;
                  const fc         = proj.folderId ? (folderColorMap[proj.folderId] || NEUTRAL_COLOR) : NEUTRAL_COLOR;
                  const totalHT    = computeTotalHT(proj);
                  const totalStr   = formatPrice(totalHT);
                  const isDeleting = deletingId === proj.id;

                  return (
                    <div
                      key={proj.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', proj.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => { if (!isActive) { onSelect(proj); onClose(); } }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isActive) {
                          e.preventDefault();
                          onSelect(proj); onClose();
                        }
                      }}
                      className={`group relative bg-white rounded-2xl border-2 p-5 transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-grab active:cursor-grabbing ${
                        isActive
                          ? `${fc.cardActive}`
                          : `${fc.card} ${fc.cardHover} hover:shadow-lg hover:-translate-y-0.5`
                      } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {/* Bande couleur à gauche (couleur du dossier) */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${fc.stripe}`} />

                      {/* Actions au hover : Déplacer (toujours), Supprimer (sauf projet actif) */}
                      <div className="absolute top-3 right-3 flex items-center gap-0.5 z-10">
                        {isActive && (
                          <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold mr-1 ${fc.badge}`}>
                            ACTIF
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setMovingProject(proj); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                          title="Déplacer dans un dossier"
                        >
                          <MoveRight size={14} />
                        </button>
                        {!isActive && (
                          <button
                            onClick={(e) => handleDelete(e, proj)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            title="Supprimer le projet"
                          >
                            {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>

                      {/* Nom + code (titre complet, wrap multiline) */}
                      <div className="pl-2 mb-3 pr-16">
                        <div className={`font-semibold text-sm leading-snug break-words ${isActive ? fc.accent : 'text-gray-900'}`}>
                          {proj.name || 'Projet sans nom'}
                        </div>
                        {proj.code && (
                          <div className="text-[11px] text-gray-400 mt-0.5 font-mono">{proj.code}</div>
                        )}
                      </div>

                      {/* Client */}
                      {proj.client && (
                        <div className="pl-2 flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
                          <Building2 size={12} strokeWidth={1.75} className="shrink-0" />
                          <span className="truncate">{proj.client}</span>
                        </div>
                      )}

                      {/* Date + total HT */}
                      <div className="pl-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mt-2">
                        {proj.lastSaved && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} strokeWidth={1.75} className="shrink-0" />
                            <span>{formatDate(proj.lastSaved)}</span>
                          </div>
                        )}
                        {totalStr && (
                          <>
                            {proj.lastSaved && <span className="text-gray-300">·</span>}
                            <div className="flex items-center gap-1 font-semibold text-gray-700">
                              <Coins size={12} strokeWidth={1.75} className="shrink-0" />
                              <span>{totalStr}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal déplacement projet (au-dessus, z-[9999]) */}
      {movingProject && (
        <MoveFolderModal
          project={movingProject}
          folders={folders}
          onMove={handleMoveProject}
          onClose={() => setMovingProject(null)}
        />
      )}
    </div>,
    document.body
  );
};

export default CloudProjectPicker;
