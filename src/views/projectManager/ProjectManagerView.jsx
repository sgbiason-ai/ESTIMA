import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { buildFolderColorMap } from './folderColors';
import { toast } from '../../utils/globalUI';
import { generateId } from '../../utils/helpers';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

import { usePresenceReader }     from '../../hooks/usePresence';
import { usePmLocalHistory }     from './hooks/usePmLocalHistory';
import { usePmCloudProjects }    from './hooks/usePmCloudProjects';
import { usePmFolders }          from './hooks/usePmFolders';

import HelpPanel         from '../../components/help/HelpPanel';
import MoveFolderModal   from './MoveFolderModal';
import PmToolbar         from './PmToolbar';
import PmCommandBar      from './PmCommandBar';
import PmRecents         from './PmRecents';
import PmFolderSidebar   from './PmFolderSidebar';
import PmProjectGrid     from './PmProjectGrid';
import PmDetailsPanel    from './PmDetailsPanel';
import PmTrashView       from './PmTrashView';
import ProjectDetailsModal from '../../components/modals/ProjectDetailsModal';
import PmLocalHistory    from './PmLocalHistory';
import LinkedLibraryModal from '../../components/modals/LinkedLibraryModal';
import { getActiveLocalLibrary, backupActiveLocalLibrary, setActiveLocalLibrary, librariesMatch, compareProjectVsLibrary, deactivateLocalLibrary } from '../../utils/localLibrary';

// Préférences d'affichage persistées (onglet, tri, vue) — même pattern que estima_force_layout
const PM_PREFS_KEY = 'estima_pm_prefs';
const readPmPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PM_PREFS_KEY)) || {}; } catch { return {}; }
};

const ProjectManagerView = ({
  project, setProject, onSaveProject,
  bpuConfig, clientPercent, setBpuConfig, setClientPercent,
  companyId, currentUserUid, onNavigateModule, setActiveTab,
  masterBranding = null,
}) => {
  const SORT_KEYS = ['date', 'code', 'name', 'location', 'folder', 'amount'];
  const [historyTab, setHistoryTab] = useState(() => readPmPrefs().historyTab === 'local' ? 'local' : 'cloud');
  const [showHelp,   setShowHelp]   = useState(false);
  const [sortBy,     setSortBy]     = useState(() => SORT_KEYS.includes(readPmPrefs().sortBy) ? readPmPrefs().sortBy : 'date');
  const [sortDir,    setSortDir]    = useState(() => readPmPrefs().sortDir === 'asc' ? 'asc' : 'desc');
  const [search,     setSearch]     = useState('');
  const [filters,    setFilters]    = useState({ rao: false, crc: false, status: null });
  const [viewMode,   setViewMode]   = useState(() => readPmPrefs().viewMode === 'list' ? 'list' : 'grid');
  const [creatingProject, setCreatingProject] = useState(false);
  const searchRef = useRef(null);
  const [detailsProject, setDetailsProject] = useState(null);
  // Slide-over de détails : affaire sélectionnée (clic sur ligne/tuile)
  const [panelProject, setPanelProject] = useState(null);
  const [linkedCrcMap, setLinkedCrcMap] = useState({});
  const [raoProjectIds, setRaoProjectIds] = useState(new Set());
  // Modale de gestion de la bibliothèque locale liée à un projet
  // pendingOpen = { proj, mode: 'load' | 'openInEstima' } | null
  const [pendingOpen, setPendingOpen] = useState(null);
  const [libModalCurrent, setLibModalCurrent] = useState(null);

  // Persister les préférences d'affichage
  useEffect(() => {
    try { localStorage.setItem(PM_PREFS_KEY, JSON.stringify({ historyTab, sortBy, sortDir, viewMode })); } catch { /* ignore */ }
  }, [historyTab, sortBy, sortDir, viewMode]);

  // Raccourci « / » : focus la recherche (ignoré si on est déjà dans un champ)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (historyTab !== 'cloud') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyTab]);

  // Clic sur un en-tête de colonne (vue liste) : trie par cette clé, inverse le sens si déjà active
  const handleSort = useCallback((key) => {
    setSortBy(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      // Nouvelle colonne : sens par défaut (date = récent d'abord = desc, textes = asc)
      setSortDir(key === 'date' ? 'desc' : 'asc');
      return key;
    });
  }, []);

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

  const folderColorMap = useMemo(() => buildFolderColorMap(fm.folders), [fm.folders]);
  const folderNameOf = useCallback(
    (id) => (id ? (fm.folders.find(f => f.id === id)?.name || '') : ''),
    [fm.folders]
  );

  const removeAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sortedProjects = [...fm.filteredProjects]
    .filter(p => {
      if (search.trim()) {
        const q = removeAccents(search);
        const hit = removeAccents(p.name).includes(q)
          || removeAccents(p.code).includes(q)
          || removeAccents(p.location).includes(q);
        if (!hit) return false;
      }
      if (filters.rao && !raoProjectIds.has(p.id)) return false;
      if (filters.crc && !linkedCrcMap[p.id]) return false;
      if (filters.status && p.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let cmp = 0;
      switch (sortBy) {
        case 'date':     cmp = new Date(a.lastSaved || 0) - new Date(b.lastSaved || 0); break;
        case 'code':     cmp = (a.code || '').localeCompare(b.code || '', 'fr', { numeric: true }); break;
        case 'name':     cmp = (a.name || '').localeCompare(b.name || '', 'fr'); break;
        case 'location': cmp = (a.location || '').localeCompare(b.location || '', 'fr'); break;
        case 'folder':   cmp = folderNameOf(a.folderId).localeCompare(folderNameOf(b.folderId), 'fr'); break;
        case 'amount':   cmp = (Number(a.totalHT) || 0) - (Number(b.totalHT) || 0); break;
        default:         cmp = 0;
      }
      return cmp * dir;
    });

  // R\u00e9cents : 4 affaires les plus r\u00e9cemment sauvegard\u00e9es (toujours par date desc,
  // ind\u00e9pendamment du tri courant), affich\u00e9es seulement en vue \u00ab Tous \u00bb sans filtre.
  const recentProjects = useMemo(
    () => [...cloud.cloudProjects]
      .filter(p => p.lastSaved)
      .sort((a, b) => new Date(b.lastSaved) - new Date(a.lastSaved))
      .slice(0, 4),
    [cloud.cloudProjects]
  );
  const showRecents = fm.selectedFolderId === '__all__' && !search.trim()
    && !filters.rao && !filters.crc && !filters.status && recentProjects.length > 0;

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
      const wasActive = proj?.id === project?.id;
      const ok = await cloud.handleLoadCloudProject(proj, { silent });
      if (ok && silent && !wasActive) toast.success(`« ${proj.name || 'Sans nom'} » chargé en session.`);
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

  // ── Panneau de détails : rester synchrone avec la liste cloud ──
  // (édition rapide, fiche, actualisation → données fraîches ; suppression → fermeture)
  useEffect(() => {
    if (!panelProject) return;
    const fresh = cloud.cloudProjects.find(p => p.id === panelProject.id);
    if (!fresh) setPanelProject(null);
    else if (fresh !== panelProject) setPanelProject(fresh);
  }, [cloud.cloudProjects, panelProject]);

  // ── Édition rapide depuis le panneau (nom, n°, lieu, client) ──
  const handleSaveQuickDetails = useCallback(async (projId, partial) => {
    if (!companyId || !projId) return;
    try {
      await setDoc(doc(db, 'companies', companyId, 'projects', projId), partial, { merge: true });
      cloud.setCloudProjects(prev => prev.map(p => p.id === projId ? { ...p, ...partial } : p));
      if (project?.id === projId) setProject(prev => ({ ...prev, ...partial }));
      toast.success('Affaire mise à jour.');
    } catch (e) {
      console.error('[ProjectManager] Erreur édition rapide:', e);
      toast.error('Impossible d\'enregistrer les modifications.');
    }
  }, [companyId, cloud, project?.id, setProject]);

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

  return (
    <div className="h-screen w-full bg-[#f5f5f7] overflow-hidden flex flex-col text-gray-900"
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
          colorMap={folderColorMap}
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
      <PmToolbar
        project={project} lastSavedIso={project?.lastSaved}
        cloudSaving={cloud.cloudSaving} cloudSaved={cloud.cloudSaved}
        onCloudSave={cloud.handleCloudSave} onExport={local.handleExport}
        onImportClick={() => local.fileInputRef.current?.click()} onClone={local.handleClone}
        fileInputRef={local.fileInputRef} onImportChange={local.handleImport}
        creatingProject={creatingProject}
        onNewProject={async () => {
          if (creatingProject) return;
          setCreatingProject(true);
          const newProject = {
            id: generateId(),
            name: `Nouvelle affaire — ${new Date().toLocaleDateString('fr-FR')}`,
            chapters: [{ id: 'c1', title: 'TRAVAUX PREPARATOIRES', children: [], type: 'chapter', isOption: false }],
            tranches: [],
            sourceIds: [],
          };
          try {
            await onSaveProject(newProject);
            setProject(newProject);
            cloud.setCloudProjects(prev => [{ ...newProject, lastSaved: new Date().toISOString() }, ...prev]);
            toast.success('Nouvelle affaire créée.');
            setDetailsProject(newProject);
            if (setActiveTab) setActiveTab();
          } catch (e) {
            console.error('[ProjectManager] Erreur création projet:', e);
            toast.error('Impossible de créer le projet.');
          } finally {
            setCreatingProject(false);
          }
        }}
        onShowHelp={() => setShowHelp(true)}
      />

      {/* ── Content bar ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Barre de commande */}
          <PmCommandBar
            historyTab={historyTab} setHistoryTab={setHistoryTab}
            count={sortedProjects.length} total={cloud.cloudProjects.length}
            search={search} setSearch={setSearch} searchRef={searchRef}
            filters={filters} setFilters={setFilters}
            activeFolder={fm.selectedFolderId !== '__all__'
              ? {
                  id: fm.selectedFolderId,
                  name: fm.selectedFolderId === null ? 'Sans dossier' : folderNameOf(fm.selectedFolderId),
                  color: fm.selectedFolderId ? (folderColorMap[fm.selectedFolderId]) : null,
                }
              : null}
            onClearFolder={() => fm.setSelectedFolderId('__all__')}
            sortBy={sortBy} sortDir={sortDir}
            onSort={handleSort}
            onToggleDir={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            viewMode={viewMode} setViewMode={setViewMode}
            cloudLoading={cloud.cloudLoading} onRefresh={cloud.loadCloudProjects}
            localCount={local.recentProjects.length} onClearLocal={local.clearHistory}
            trashCount={cloud.trashedProjects.length}
          />

          {/* Cloud tab */}
          {historyTab === 'cloud' && (
            <div className="flex-1 flex min-h-0 relative">
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
                handleSetFolderColor={fm.handleSetFolderColor}
                handleDeleteFolder={fm.handleDeleteFolder}
              />
              <div className="flex-1 overflow-y-auto p-6">
                {showRecents && (
                  <PmRecents
                    projects={recentProjects}
                    folderColorMap={folderColorMap}
                    activeId={project?.id}
                    onOpen={setPanelProject}
                  />
                )}
                <PmProjectGrid
                  viewMode={viewMode}
                  cloudLoading={cloud.cloudLoading}
                  cloudError={cloud.cloudError}
                  cloudProjects={cloud.cloudProjects}
                  filteredProjects={sortedProjects}
                  searchQuery={search}
                  onClearSearch={() => setSearch('')}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  selectedFolderId={fm.selectedFolderId}
                  setSelectedFolderId={fm.setSelectedFolderId}
                  project={project}
                  folders={fm.folders}
                  folderColorMap={folderColorMap}
                  presenceByProject={presenceByProject}
                  deletingId={cloud.deletingId}
                  selectedId={panelProject?.id}
                  onSelectProject={setPanelProject}
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

              {/* Slide-over de détails */}
              {panelProject && (
                <PmDetailsPanel
                  proj={panelProject}
                  isSessionActive={panelProject.id === project?.id}
                  folders={fm.folders}
                  folderColorMap={folderColorMap}
                  presence={presenceByProject[panelProject.id] || []}
                  linkedCrcNames={linkedCrcMap[panelProject.id] || null}
                  hasRao={raoProjectIds.has(panelProject.id)}
                  deletingId={cloud.deletingId}
                  onClose={() => setPanelProject(null)}
                  onOpenInEstima={(proj) => handleProjectIntent(proj, 'openInEstima')}
                  onLoadSession={(proj) => handleProjectIntent(proj, 'load', { silent: true })}
                  onOpenFullDetails={setDetailsProject}
                  onDuplicate={cloud.handleDuplicateCloudProject}
                  onMove={fm.setMovingProject}
                  onDelete={cloud.handleDeleteCloudProject}
                  onRestore={cloud.handleRestoreSnapshot}
                  onSaveQuick={handleSaveQuickDetails}
                  onNavigateModule={onNavigateModule}
                />
              )}
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

          {/* Corbeille */}
          {historyTab === 'trash' && (
            <PmTrashView
              projects={cloud.trashedProjects}
              deletingId={cloud.deletingId}
              onRestore={cloud.handleRestoreFromTrash}
              onPurge={cloud.handlePurgeProject}
              onEmptyTrash={cloud.handleEmptyTrash}
              onBack={() => setHistoryTab('cloud')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManagerView;
