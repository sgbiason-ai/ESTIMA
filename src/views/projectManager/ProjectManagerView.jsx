import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { HelpCircle, PlusCircle, Clock, Cloud, RefreshCw, Trash2, ArrowUpDown, Search, LayoutGrid, List } from 'lucide-react';
import { buildFolderColorMap } from './folderColors';
import { toast, confirm } from '../../utils/globalUI';
import { generateId } from '../../utils/helpers';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

import { usePresenceReader }     from '../../hooks/usePresence';
import { usePmLocalHistory }     from './hooks/usePmLocalHistory';
import { usePmCloudProjects }    from './hooks/usePmCloudProjects';
import { usePmFolders }          from './hooks/usePmFolders';

import HelpPanel         from '../../components/help/HelpPanel';
import MoveFolderModal   from './MoveFolderModal';
import PmLeftColumn      from './PmLeftColumn';
import PmFolderSidebar   from './PmFolderSidebar';
import PmProjectGrid     from './PmProjectGrid';
import ProjectDetailsModal from '../../components/modals/ProjectDetailsModal';
import PmLocalHistory    from './PmLocalHistory';
import LinkedLibraryModal from '../../components/modals/LinkedLibraryModal';
import { getActiveLocalLibrary, backupActiveLocalLibrary, setActiveLocalLibrary, librariesMatch, compareProjectVsLibrary, deactivateLocalLibrary } from '../../utils/localLibrary';

const ProjectManagerView = ({
  project, setProject, onSaveProject,
  bpuConfig, clientPercent, setBpuConfig, setClientPercent,
  companyId, currentUserUid, onNavigateModule, setActiveTab,
  masterBranding = null,
}) => {
  const [historyTab, setHistoryTab] = useState('cloud');
  const [showHelp,   setShowHelp]   = useState(false);
  const [sortBy,     setSortBy]     = useState('date');
  const [search,     setSearch]     = useState('');
  const [viewMode,   setViewMode]   = useState('grid');
  const [detailsProject, setDetailsProject] = useState(null);
  const [linkedCrcMap, setLinkedCrcMap] = useState({});
  const [raoProjectIds, setRaoProjectIds] = useState(new Set());
  // Modale de gestion de la bibliothèque locale liée à un projet
  // pendingOpen = { proj, mode: 'load' | 'openInEstima' } | null
  const [pendingOpen, setPendingOpen] = useState(null);
  const [libModalCurrent, setLibModalCurrent] = useState(null);

  // Charger les CRC liés + projets avec RAO
  useEffect(() => {
    if (!companyId) return;
    // CRC liés
    getDocs(collection(db, 'companies', companyId, 'crr'))
      .then(snap => {
        const map = {};
        snap.forEach(d => {
          const data = d.data();
          if (data.linkedProjectId) {
            const nom = data.crrConfig?.chantierInfo?.nom || 'CR';
            if (!map[data.linkedProjectId]) map[data.linkedProjectId] = [];
            map[data.linkedProjectId].push(nom);
          }
        });
        setLinkedCrcMap(map);
      })
      .catch(() => {});
  }, [companyId]);

  const local = usePmLocalHistory({ project, setProject, bpuConfig, clientPercent, setBpuConfig, setClientPercent, companyId });
  const cloud = usePmCloudProjects({
    companyId, historyTab, project, setProject,
    bpuConfig, setBpuConfig, clientPercent, setClientPercent,
    onSaveProject, addToHistory: local.addToHistory,
  });
  const fm = usePmFolders({ companyId, cloudProjects: cloud.cloudProjects, setCloudProjects: cloud.setCloudProjects, project, setProject });
  const { presenceByProject } = usePresenceReader({ companyId, currentUserId: currentUserUid });

  // RAO : détecter les projets ayant une analyse de prix.
  // Priorité au flag dénormalisé `hasRao` (écrit par usePriceAnalysis) → 0 lecture.
  // Fallback `getDoc` sur analysis/data uniquement pour les projets non encore
  // migrés (flag absent), une seule fois par session (raoCheckedRef).
  const raoCheckedRef = useRef(new Set());
  useEffect(() => {
    if (!companyId || cloud.cloudProjects.length === 0) return;
    const flagged = cloud.cloudProjects.filter(p => p.hasRao === true).map(p => p.id);
    const toCheck = cloud.cloudProjects.filter(p => p.hasRao === undefined && !raoCheckedRef.current.has(p.id));
    if (toCheck.length === 0) {
      if (flagged.length) setRaoProjectIds(prev => new Set([...prev, ...flagged]));
      return;
    }
    (async () => {
      const found = new Set(flagged);
      await Promise.all(toCheck.map(async (proj) => {
        raoCheckedRef.current.add(proj.id);
        try {
          const snap = await getDoc(doc(db, 'companies', companyId, 'projects', proj.id, 'analysis', 'data'));
          if (snap.exists() && snap.data()?.companies?.length > 0) found.add(proj.id);
        } catch { /* ignore */ }
      }));
      setRaoProjectIds(prev => new Set([...prev, ...found]));
    })();
  }, [companyId, cloud.cloudProjects]);

  const removeAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sortedProjects = [...fm.filteredProjects]
    .filter(p => {
      if (!search.trim()) return true;
      const q = removeAccents(search);
      return removeAccents(p.name).includes(q)
          || removeAccents(p.code).includes(q)
          || removeAccents(p.location).includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0);
      if (sortBy === 'code') return (a.code || '').localeCompare(b.code || '', 'fr', { numeric: true });
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'fr');
      return 0;
    });

  const folderColorMap = useMemo(() => buildFolderColorMap(fm.folders), [fm.folders]);

  // ── Bibliothèque locale liée au projet ───────────────────────────────────
  // Décide si on doit afficher la modale avant d'ouvrir l'affaire.
  // Si le projet a un linkedLibrary qui diffère de la biblio active → modale.
  // Sinon → ouverture directe via le mode demandé ('load' | 'openInEstima').
  const executeOpen = async (proj, mode, { silent = false } = {}) => {
    if (mode === 'openInEstima') {
      const ok = await cloud.handleLoadCloudProject(proj, { silent: true });
      if (!ok) return;
      if (currentUserUid && proj?.id) {
        try {
          await setDoc(
            doc(db, 'users', currentUserUid, 'preferences', 'modules'),
            { estima: proj.id, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch (e) {
          console.warn('[ProjectManagerView] Persistance pref estima échouée:', e?.message);
        }
      }
      onNavigateModule?.('estima');
    } else {
      // En mode 'load' silent (sortie de la modale linkedLibrary), on saute la confirmation
      // "Ouvrir X ?" — l'utilisateur a déjà manifesté son intention via la modale précédente.
      await cloud.handleLoadCloudProject(proj, { silent });
    }
  };

  const handleProjectIntent = async (proj, mode, { silent = false } = {}) => {
    // 1. Récupérer la biblio active : mode local OU base Cloud
    let activeLibrary = getActiveLocalLibrary();
    if (!activeLibrary && companyId) {
      try {
        const bpuSnap = await getDocs(collection(db, 'companies', companyId, 'bpu'));
        const items = bpuSnap.docs.map(d => d.data());
        activeLibrary = { id: null, name: 'Base Cloud', importedAt: null, bpu: items, categories: [], isCloud: true };
      } catch (e) {
        console.warn('[handleProjectIntent] Chargement base Cloud échoué:', e?.message);
      }
    }

    // 2. Comparer items du projet vs biblio active
    const comparison = activeLibrary
      ? compareProjectVsLibrary(proj, activeLibrary.bpu || [])
      : { hasDifferences: false, itemsChecked: 0, missingIds: [], divergentPrices: [] };

    // 3. Cas linkedLibrary explicite (snapshot dans le projet, différent de l'actif)
    const linked = proj?.linkedLibrary;
    const linkedDiffers = linked && Array.isArray(linked.bpu) && linked.bpu.length > 0
      && !(activeLibrary && librariesMatch(activeLibrary, linked));

    // Seuls une biblio liée différente OU des items manquants ouvrent la modale.
    // Un simple écart de prix unitaire (divergentPrices) ne la déclenche plus —
    // il reste affiché en info dans la modale si celle-ci s'ouvre pour une autre raison.
    if (linkedDiffers || comparison.missingIds.length > 0) {
      setPendingOpen({ proj, mode, comparison });
      setLibModalCurrent(activeLibrary);
      return;
    }
    executeOpen(proj, mode, { silent });
  };

  const handleLibLoadLinked = () => {
    if (!pendingOpen) return;
    const { proj, mode } = pendingOpen;
    try {
      backupActiveLocalLibrary();
      setActiveLocalLibrary(proj.linkedLibrary);
      toast.success(`Bibliothèque « ${proj.linkedLibrary.name || 'liée'} » activée.`);
    } catch (e) {
      toast.error('Impossible d\'activer la bibliothèque liée.');
      console.error('[LinkedLibrary] activation:', e);
      return;
    }
    setPendingOpen(null);
    setLibModalCurrent(null);
    executeOpen(proj, mode, { silent: true });
  };

  const handleLibKeepCurrent = () => {
    if (!pendingOpen) return;
    const { proj, mode } = pendingOpen;
    setPendingOpen(null);
    setLibModalCurrent(null);
    executeOpen(proj, mode, { silent: true });
  };

  const handleLibUseCloud = () => {
    if (!pendingOpen) return;
    const { proj, mode } = pendingOpen;
    try {
      // Sauvegarder l'éventuelle biblio locale active avant de la désactiver
      backupActiveLocalLibrary();
      deactivateLocalLibrary();
      toast.success('Base BPU Firebase activée.');
    } catch (e) {
      console.warn('[LinkedLibrary] désactivation locale échouée:', e?.message);
    }
    setPendingOpen(null);
    setLibModalCurrent(null);
    executeOpen(proj, mode, { silent: true });
  };

  const handleLibImportOther = (lib, meta) => {
    if (!pendingOpen) return;
    const { proj, mode } = pendingOpen;
    try {
      backupActiveLocalLibrary();
      const id = lib.id || `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setActiveLocalLibrary({
        id,
        name: lib.name || meta?.name || 'Bibliothèque importée',
        importedAt: new Date().toISOString(),
        bpu: lib.bpu || [],
        categories: lib.categories || [],
      });
      toast.success('Bibliothèque importée et activée.');
    } catch (e) {
      toast.error('Import JSON invalide.');
      console.error('[LinkedLibrary] import:', e);
      return;
    }
    setPendingOpen(null);
    setLibModalCurrent(null);
    executeOpen(proj, mode, { silent: true });
  };

  const handleLibClose = () => {
    setPendingOpen(null);
    setLibModalCurrent(null);
  };

  // ── Fiche projet (info modale) ──
  const handleSaveDetails = useCallback(async (details) => {
    if (!detailsProject || !companyId) return;
    try {
      // Nettoyer les undefined (Firestore les rejette)
      const clean = JSON.parse(JSON.stringify(details));
      const ref = doc(db, 'companies', companyId, 'projects', detailsProject.id);
      await setDoc(ref, clean, { merge: true });
      cloud.setCloudProjects(prev => prev.map(p => p.id === detailsProject.id ? { ...p, ...clean } : p));
      setDetailsProject(null);
      toast.success('Fiche projet sauvegardée.');
    } catch (e) {
      console.error('[ProjectManager] Erreur sauvegarde fiche:', e);
      toast.error('Impossible de sauvegarder la fiche projet.');
    }
  }, [detailsProject, companyId, cloud]);

  const lastSaved = project?.lastSaved ? new Date(project.lastSaved).toLocaleString('fr-FR') : null;

  return (
    <div className="h-screen w-full bg-[#f5f5f7] overflow-hidden flex flex-col text-gray-900 select-none"
      >

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="projectManager" />
      <ProjectDetailsModal
        isOpen={!!detailsProject}
        onClose={() => setDetailsProject(null)}
        project={detailsProject || {}}
        onSave={handleSaveDetails}
        branding={masterBranding}
      />
      {fm.movingProject && (
        <MoveFolderModal
          project={fm.movingProject}
          folders={fm.folders}
          onMove={fm.handleMoveProject}
          onClose={() => fm.setMovingProject(null)}
        />
      )}
      <LinkedLibraryModal
        isOpen={!!pendingOpen}
        projectName={pendingOpen?.proj?.name}
        linkedLibrary={pendingOpen?.proj?.linkedLibrary}
        currentLibrary={libModalCurrent}
        comparison={pendingOpen?.comparison}
        onLoadLinked={handleLibLoadLinked}
        onUseCloudBase={handleLibUseCloud}
        onKeepCurrent={handleLibKeepCurrent}
        onImportOther={handleLibImportOther}
        onClose={handleLibClose}
      />


      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <PmLeftColumn
        project={project} lastSaved={lastSaved}
        cloudSaving={cloud.cloudSaving} cloudSaved={cloud.cloudSaved}
        onCloudSave={cloud.handleCloudSave} onExport={local.handleExport}
        onImportClick={() => local.fileInputRef.current?.click()} onClone={local.handleClone}
        fileInputRef={local.fileInputRef} onImportChange={local.handleImport}
        onNewProject={async () => {
          const ok = await confirm('Créer un nouveau projet ?');
          if (!ok) return;
          const newProject = {
            id: generateId(),
            name: '',
            chapters: [{ id: 'c1', title: 'TRAVAUX PREPARATOIRES', children: [], type: 'chapter', isOption: false }],
            tranches: [],
            sourceIds: [],
          };
          try {
            await onSaveProject(newProject);
            setProject(newProject);
            cloud.setCloudProjects(prev => [{ ...newProject, lastSaved: new Date().toISOString() }, ...prev]);
            toast.success('Nouveau projet créé.');
            if (setActiveTab) setActiveTab();
          } catch (e) {
            console.error('[ProjectManager] Erreur création projet:', e);
            toast.error('Impossible de créer le projet.');
          }
        }}
        onShowHelp={() => setShowHelp(true)}
      />

      {/* ── Content bar ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Filters bar */}
          <div className="flex-none px-8 py-3 bg-white/60 backdrop-blur-sm border-b border-gray-200/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Mes Projets</h3>

              {historyTab === 'cloud' && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Nom, n° ou lieu…"
                    className="pl-7 pr-3 py-1.5 bg-gray-100 border border-gray-200/60 hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl text-xs text-gray-700 placeholder-gray-400 outline-none transition-all w-44 focus:w-56"
                    style={{ transition: 'width 0.2s ease, border-color 0.15s' }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">×</button>
                  )}
                </div>
              )}

              {historyTab === 'cloud' && cloud.cloudProjects.length > 0 && (
                <span className="bg-gray-100 text-gray-500 border border-gray-200/60 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {fm.filteredProjects.length}
                  {fm.selectedFolderId !== '__all__' && <span className="text-gray-300"> / {cloud.cloudProjects.length}</span>}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex p-0.5 bg-gray-100 border border-gray-200/60 rounded-xl">
                <button
                  onClick={() => setHistoryTab('cloud')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    historyTab === 'cloud' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Cloud size={14} /> Cloud
                </button>
                <button
                  onClick={() => setHistoryTab('local')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    historyTab === 'local' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Clock size={14} /> Local
                </button>
              </div>

              {historyTab === 'cloud' && cloud.cloudProjects.length > 0 && (
                <>
                  <div className="h-5 w-px bg-gray-200/60" />
                  <div className="flex items-center gap-0.5 bg-gray-100 border border-gray-200/60 rounded-xl p-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider px-2">
                      <ArrowUpDown size={10} /> Tri
                    </span>
                    {[{ id: 'date', label: 'Date' }, { id: 'code', label: 'N°' }, { id: 'name', label: 'Nom' }].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSortBy(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          sortBy === opt.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="h-5 w-px bg-gray-200/60" />
                  <div className="flex items-center bg-gray-100 border border-gray-200/60 rounded-xl p-0.5">
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Vue en dalles"
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      title="Vue en liste"
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <List size={14} />
                    </button>
                  </div>
                </>
              )}

              <div className="h-5 w-px bg-gray-200/60" />

              {historyTab === 'cloud' && (
                <button
                  onClick={cloud.loadCloudProjects}
                  disabled={cloud.cloudLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  <RefreshCw size={14} className={cloud.cloudLoading ? 'animate-spin' : ''} /> Actualiser
                </button>
              )}
              {historyTab === 'local' && local.recentProjects.length > 0 && (
                <button
                  onClick={local.clearHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 size={14} /> Vider
                </button>
              )}
            </div>
          </div>

          {/* Cloud tab */}
          {historyTab === 'cloud' && (
            <div className="flex-1 flex min-h-0">
              <PmFolderSidebar
                folders={fm.folders}
                colorMap={folderColorMap}
                onProjectDrop={(targetFolderId, projectId) => fm.handleMoveProject(projectId, targetFolderId)}
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
              <div className="flex-1 overflow-y-auto p-6">
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
                  folderColorMap={folderColorMap}
                  presenceByProject={presenceByProject}
                  deletingId={cloud.deletingId}
                  onLoadProject={(proj) => handleProjectIntent(proj, 'load', { silent: true })}
                  onOpenInEstima={(proj) => handleProjectIntent(proj, 'openInEstima')}
                  onDeleteProject={cloud.handleDeleteCloudProject}
                  onDuplicateProject={cloud.handleDuplicateCloudProject}
                  onMoveProject={fm.setMovingProject}
                  onRestoreSnapshot={cloud.handleRestoreSnapshot}
                  onInfoProject={setDetailsProject}
                  linkedCrcMap={linkedCrcMap}
                  raoProjectIds={raoProjectIds}
                  onNavigateModule={onNavigateModule}
                />
              </div>
            </div>
          )}

          {/* Local tab */}
          {historyTab === 'local' && (
            <div className="flex-1 overflow-y-auto p-6">
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
