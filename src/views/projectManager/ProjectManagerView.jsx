import React, { useState } from 'react';
import { Layers, HelpCircle, PlusCircle, Clock, Cloud, RefreshCw, Trash2, ArrowUpDown, Search, LayoutGrid, List } from 'lucide-react';
import { confirm } from '../../utils/globalUI';

import { usePresenceReader }     from '../../hooks/usePresence';
import { usePmLocalHistory }     from './hooks/usePmLocalHistory';
import { usePmCloudProjects }    from './hooks/usePmCloudProjects';
import { usePmFolders }          from './hooks/usePmFolders';

import HelpPanel         from './HelpPanel';
import MoveFolderModal   from './MoveFolderModal';
import PmLeftColumn      from './PmLeftColumn';
import PmFolderSidebar   from './PmFolderSidebar';
import PmProjectGrid     from './PmProjectGrid';
import PmLocalHistory    from './PmLocalHistory';

const ProjectManagerView = ({
  project,
  setProject,
  resetProject,
  onSaveProject,
  bpuConfig,
  clientPercent,
  setBpuConfig,
  setClientPercent,
  companyId,
  currentUserUid,
}) => {
  const [historyTab, setHistoryTab] = useState('cloud');
  const [showHelp,   setShowHelp]   = useState(false);
  const [sortBy,     setSortBy]     = useState('date'); // 'date' | 'code' | 'name'
  const [search,     setSearch]     = useState('');
  const [viewMode,   setViewMode]   = useState('grid'); // 'grid' | 'list'

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const local = usePmLocalHistory({ project, setProject, bpuConfig, clientPercent, setBpuConfig, setClientPercent });

  const cloud = usePmCloudProjects({
    companyId, historyTab,
    project, setProject,
    bpuConfig, setBpuConfig,
    clientPercent, setClientPercent,
    onSaveProject,
    addToHistory: local.addToHistory,
  });

  const fm = usePmFolders({
    companyId,
    cloudProjects: cloud.cloudProjects,
    setCloudProjects: cloud.setCloudProjects,
    project, setProject,
  });

  const { presenceByProject } = usePresenceReader({ companyId, currentUserId: currentUserUid });

  // ── Tri des projets ──────────────────────────────────────────────────────────
  const removeAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const sortedProjects = [...fm.filteredProjects]
    .filter(p => !search.trim() || removeAccents(p.name).includes(removeAccents(search)))
    .sort((a, b) => {
    if (sortBy === 'date') return new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0);
    if (sortBy === 'code') return (a.code || '').localeCompare(b.code || '', 'fr', { numeric: true });
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'fr');
    return 0;
  });

  // ── Données d'affichage ────────────────────────────────────────────────────
  const chapCount = (project?.chapters || []).length;
  const itemCount = (project?.chapters || []).reduce((acc, c) => {
    return acc + (c.children || c.items || c.rows || []).length;
  }, 0);
  const lastSaved = project?.lastSaved
    ? new Date(project.lastSaved).toLocaleString('fr-FR')
    : null;

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-slate-950 overflow-hidden flex flex-col font-sans text-slate-300 select-none">

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {fm.movingProject && (
        <MoveFolderModal
          project={fm.movingProject}
          folders={fm.folders}
          onMove={fm.handleMoveProject}
          onClose={() => fm.setMovingProject(null)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Layers size={16} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Gestion de Projet</h2>
            <p className="text-xs text-slate-500 font-medium">Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2">
            {lastSaved && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={14} />
                <span>Sauvegardé le {lastSaved}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Connecté</span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg text-sm font-medium transition-colors"
          >
            <HelpCircle size={16} /> Guide
          </button>
          <button
            onClick={async () => { const ok = await confirm('Créer un nouveau projet ?'); if (ok) resetProject(); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            <PlusCircle size={16} /> Nouveau projet
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Col gauche */}
        <PmLeftColumn
          project={project}
          chapCount={chapCount}
          itemCount={itemCount}
          lastSaved={lastSaved}
          cloudSaving={cloud.cloudSaving}
          cloudSaved={cloud.cloudSaved}
          onCloudSave={cloud.handleCloudSave}
          onExport={local.handleExport}
          onImportClick={() => local.fileInputRef.current?.click()}
          onClone={local.handleClone}
          fileInputRef={local.fileInputRef}
          onImportChange={local.handleImport}
        />

        {/* Col droite */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-950">

          {/* Header col droite */}
          <div className="flex-none px-8 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-100">Mes Projets</h3>
              {historyTab === 'cloud' && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors w-44 focus:w-56"
                    style={{ transition: 'width 0.2s ease, border-color 0.15s' }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              {historyTab === 'cloud' && cloud.cloudProjects.length > 0 && (
                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {fm.filteredProjects.length}
                  {fm.selectedFolderId !== '__all__' && (
                    <span className="text-slate-500"> / {cloud.cloudProjects.length}</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Onglets */}
              <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-lg">
                <button
                  onClick={() => setHistoryTab('cloud')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    historyTab === 'cloud' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Cloud size={16} /> Cloud
                </button>
                <button
                  onClick={() => setHistoryTab('local')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    historyTab === 'local' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Clock size={16} /> Local
                </button>
              </div>


              {/* Tri — visible uniquement sur l'onglet Cloud */}
              {historyTab === 'cloud' && cloud.cloudProjects.length > 0 && (
                <>
                  <div className="h-6 w-px bg-slate-800" />
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold uppercase tracking-wider px-2">
                      <ArrowUpDown size={11} /> Tri
                    </span>
                    {[
                      { id: 'date', label: 'Date' },
                      { id: 'code', label: 'N°' },
                      { id: 'name', label: 'Nom' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSortBy(opt.id)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          sortBy === opt.id
                            ? 'bg-slate-700 text-slate-100 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Toggle vue grille / liste */}
              {historyTab === 'cloud' && cloud.cloudProjects.length > 0 && (
                <>
                  <div className="h-6 w-px bg-slate-800" />
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Vue en dalles"
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-slate-700 text-slate-100 shadow-sm'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      title="Vue en liste"
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-slate-700 text-slate-100 shadow-sm'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <List size={14} />
                    </button>
                  </div>
                </>
              )}

              <div className="h-6 w-px bg-slate-800" />

              {historyTab === 'cloud' && (
                <button
                  onClick={cloud.loadCloudProjects}
                  disabled={cloud.cloudLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw size={16} className={cloud.cloudLoading ? 'animate-spin' : ''} /> Actualiser
                </button>
              )}
              {historyTab === 'local' && local.recentProjects.length > 0 && (
                <button
                  onClick={local.clearHistory}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={16} /> Vider l'historique
                </button>
              )}
            </div>
          </div>

          {/* Onglet Cloud */}
          {historyTab === 'cloud' && (
            <div className="flex-1 flex min-h-0">
              <PmFolderSidebar
                folders={fm.folders}
                foldersLoading={fm.foldersLoading}
                selectedFolderId={fm.selectedFolderId}
                setSelectedFolderId={fm.setSelectedFolderId}
                expandedFolders={fm.expandedFolders}
                creatingFolder={fm.creatingFolder}
                setCreatingFolder={fm.setCreatingFolder}
                newFolderName={fm.newFolderName}
                setNewFolderName={fm.setNewFolderName}
                editingFolder={fm.editingFolder}
                setEditingFolder={fm.setEditingFolder}
                cloudProjects={cloud.cloudProjects}
                rootFolders={fm.rootFolders}
                getSubfolders={fm.getSubfolders}
                toggleExpand={fm.toggleExpand}
                handleCreateFolder={fm.handleCreateFolder}
                handleRenameFolder={fm.handleRenameFolder}
                handleDeleteFolder={fm.handleDeleteFolder}
              />
              <div className="flex-1 overflow-y-auto p-8">
                <PmProjectGrid
                  viewMode={viewMode}
                  cloudLoading={cloud.cloudLoading}
                  cloudError={cloud.cloudError}
                  cloudProjects={cloud.cloudProjects}
                  filteredProjects={sortedProjects}
                  selectedFolderId={fm.selectedFolderId}
                  setSelectedFolderId={fm.setSelectedFolderId}
                  project={project}
                  folders={fm.folders}
                  presenceByProject={presenceByProject}
                  deletingId={cloud.deletingId}
                  onLoadProject={cloud.handleLoadCloudProject}
                  onDeleteProject={cloud.handleDeleteCloudProject}
                  onMoveProject={fm.setMovingProject}
                  onRestoreSnapshot={cloud.handleRestoreSnapshot}
                />
              </div>
            </div>
          )}

          {/* Onglet Local */}
          {historyTab === 'local' && (
            <div className="flex-1 overflow-y-auto p-8">
              <PmLocalHistory
                recentProjects={local.recentProjects}
                onLoadFromHistory={local.loadFromHistory}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManagerView;