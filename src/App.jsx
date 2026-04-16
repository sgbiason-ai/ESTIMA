// src/App.jsx
import React, { useState, lazy, Suspense } from 'react';

// ─── HOOKS ────────────────────────────────────────────────────────────────────
import { useAppAuth }       from './hooks/useAppAuth';
import { useDatabase }      from './hooks/useDatabase';
import { useProjectManager } from './hooks/useProjectManager';
import { useLocalMode }     from './hooks/useLocalMode';
import { useAppResources }  from './hooks/useAppResources';
import { useAppModals }     from './hooks/useAppModals';
import { usePresence }      from './hooks/usePresence';
import { useIsMobile }      from './hooks/useIsMobile';
import { useIsTesla }       from './hooks/useIsTesla';
import { useProjectArchives } from './hooks/useProjectArchives';

// ─── COMPOSANTS GLOBAUX (toujours chargés) ───────────────────────────────────
import Sidebar              from './components/common/Sidebar';
import DeleteModal          from './components/common/DeleteModal';
import DraggableCalculator  from './components/common/DraggableCalculator';
import AddBpuModal          from './components/database/AddBpuModal';
import EditBpuModal         from './components/database/EditBpuModal';
import CalculationModal     from './components/modals/CalculationModal';
import ProjectDetailsModal  from './components/modals/ProjectDetailsModal';

// ─── VUES (chargement auth / critique — statique) ────────────────────────────
import LoginView            from './views/LoginView';
import LegalView            from './views/LegalView';
import ModuleHubView        from './views/ModuleHubView';

// ─── VUES (lazy-loaded — code-splitting par module) ──────────────────────────
const ProjectManagerView = lazy(() => import('./views/projectManager/ProjectManagerView'));
const ProjectView        = lazy(() => import('./views/ProjectView'));
const DatabaseView       = lazy(() => import('./views/DatabaseView'));
const PriceAnalysisView  = lazy(() => import('./views/PriceAnalysisView'));
const CctpGeneratorView  = lazy(() => import('./views/CctpGeneratorView'));
const RcGeneratorView    = lazy(() => import('./views/RcGeneratorView'));
const BpuExportView      = lazy(() => import('./views/bpu/BpuExportView'));
const SettingsView       = lazy(() => import('./views/SettingsView'));
const BrandingView       = lazy(() => import('./views/BrandingView'));
const AdminView          = lazy(() => import('./views/AdminView'));
const RaoAnalysisView    = lazy(() => import('./views/RaoAnalysisView'));
const CrcView            = lazy(() => import('./views/crc/CrcView'));
const DocAdminView       = lazy(() => import('./views/DocAdminView'));
const SiteVisitsView     = lazy(() => import('./views/SiteVisitsView'));
const TeslaModeView      = lazy(() => import('./views/TeslaModeView'));
const DevisMoeView       = lazy(() => import('./views/devisMoe/DevisMoeView'));
const AccountSection     = lazy(() => import('./components/settings/AccountSection'));

// ─── VUE MOBILE (lazy — chargée seulement sur mobile) ────────────────────────
const MobileApp          = lazy(() => import('./components/mobile/MobileApp'));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const removeAccents = (str) =>
  str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

/** Fallback de chargement pour React.lazy / Suspense */
const LazyFallback = () => (
  <div className="flex h-screen items-center justify-center bg-[#f5f5f7]">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Wrapper Suspense pour les composants lazy-loaded */
const Lazy = ({ children }) => <Suspense fallback={<LazyFallback />}>{children}</Suspense>;

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {

  // ── 0. Détection mobile / Tesla ────────────────────────────────────────────
  const isMobile = useIsMobile(768);
  const isTesla = useIsTesla();

  // ── 0b. Page légale (accessible sans auth) ────────────────────────────────
  const [showLegal, setShowLegal] = useState(false);

  // ── 0c. Module actif (null = Hub) ─────────────────────────────────────────
  const [activeModule, setActiveModule] = useState(null);

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const { user, companyId, isAdmin, authLoading, handleLogout } = useAppAuth();

  // ── Page légale (rendue avant les gardes d'auth) ──────────────────────────
  if (showLegal) {
    return <LegalView onBack={() => setShowLegal(false)} />;
  }

  // ── Gardes d'auth (communs mobile + desktop) ──────────────────────────────

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f7]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginView onShowLegal={() => setShowLegal(true)} />;

  if (!companyId) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4" style={{ background: '#f5f5f7' }}>
        <div className="text-2xl font-bold text-gray-900">Compte non configuré</div>
        <p className="text-gray-500 text-sm max-w-sm text-center">
          Votre compte n'est pas encore associé à une entreprise.
          Contactez l'administrateur de l'application.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-2 rounded-xl text-sm font-medium transition-colors"
          style={isTesla
            ? { background: '#1e2028', color: '#ef4444', border: '1px solid #38434d' }
            : { background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  // ── MOBILE → rendu simplifié ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <MobileApp user={user} companyId={companyId} onLogout={handleLogout} />
      </Suspense>
    );
  }

  // ── DESKTOP → Hub de modules ou module actif ──────────────────────────────

  const handleBackToHub = () => setActiveModule(null);

  // Hub de sélection des modules
  if (!activeModule) {
    return (
      <ModuleHubView
        isAdmin={isAdmin}
        userEmail={user.email}
        onSelectModule={setActiveModule}
        onLogout={handleLogout}
      />
    );
  }

  // Module : Gestion de Projets (autonome)
  if (activeModule === 'projects_manager') {
    return (
      <Lazy>
        <ProjectManagerModule
          user={user}
          companyId={companyId}
          onBackToHub={handleBackToHub}
          onNavigateModule={setActiveModule}
          onOpenEstima={(project) => {
            setActiveModule('estima');
          }}
        />
      </Lazy>
    );
  }

  // Module : ESTIMA VRD (app complète avec sidebar)
  if (activeModule === 'estima') {
    return (
      <Lazy>
        <DesktopApp
          user={user}
          companyId={companyId}
          isAdmin={isAdmin}
          handleLogout={handleLogout}
          onBackToHub={handleBackToHub}
        />
      </Lazy>
    );
  }

  // Module : RAO & Analyse des Prix
  if (activeModule === 'rao_analysis') {
    return (
      <Lazy>
        <RaoAnalysisView user={user} companyId={companyId} onBackToHub={handleBackToHub} />
      </Lazy>
    );
  }

  // Module : Compte Rendu de Chantier
  if (activeModule === 'crc') {
    return <Lazy><CrcView onBackToHub={handleBackToHub} user={user} companyId={companyId} /></Lazy>;
  }

  // Module : Document Administratif
  if (activeModule === 'doc_admin') {
    return <Lazy><DocAdminView onBackToHub={handleBackToHub} user={user} companyId={companyId} /></Lazy>;
  }

  // Module : Devis MOE
  if (activeModule === 'devis_moe') {
    if (!isAdmin) { setActiveModule(null); return null; }
    return <Lazy><DevisMoeView onBackToHub={handleBackToHub} user={user} companyId={companyId} /></Lazy>;
  }

  // Module : Identité & Charte Graphique
  if (activeModule === 'branding') {
    return <Lazy><BrandingModule user={user} companyId={companyId} onBackToHub={handleBackToHub} /></Lazy>;
  }

  // Module : Mon Compte & RGPD
  if (activeModule === 'rgpd') {
    return <Lazy><RgpdModule user={user} companyId={companyId} onBackToHub={handleBackToHub} /></Lazy>;
  }

  // Module : Visites de Site (Tesla = mode carte plein écran, desktop = lecture classique)
  if (activeModule === 'site_visits') {
    if (isTesla) {
      return <Lazy><TeslaModeView user={user} companyId={companyId} onExit={handleBackToHub} /></Lazy>;
    }
    return <Lazy><SiteVisitsModule user={user} companyId={companyId} onBackToHub={handleBackToHub} /></Lazy>;
  }

  // Module : Administration (réservé aux admins)
  if (activeModule === 'admin') {
    if (!isAdmin) { setActiveModule(null); return null; }
    return (
      <Lazy>
        <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
          <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
            <button
              onClick={handleBackToHub}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
            </button>
            <div className="h-5 w-px bg-gray-200/60" />
            <h1 className="font-bold text-lg text-gray-900 tracking-tight">Administration</h1>
          </header>
          <div className="flex-1 overflow-hidden">
            <AdminView currentUserEmail={user.email} />
          </div>
        </div>
      </Lazy>
    );
  }

  // Fallback → Hub
  return (
    <ModuleHubView
      isAdmin={isAdmin}
      userEmail={user.email}
      onSelectModule={setActiveModule}
      onLogout={handleLogout}
    />
  );
}

// ─── MODULE GESTION DE PROJETS (autonome, hors ESTIMA) ──────────────────────
function ProjectManagerModule({ user, companyId, onBackToHub, onOpenEstima, onNavigateModule }) {
  const { project, setProject, handleSaveProject, resetProject } = useProjectManager(user, companyId);
  const resources = useAppResources(user, companyId);
  const [bpuConfig, setBpuConfig] = useState({ numberingMode: 'auto' });
  const [clientPercent, setClientPercent] = useState(10);

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <h1 className="font-bold text-lg text-gray-900 tracking-tight">Gestion de Projets</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <ProjectManagerView
          project={project}
          setProject={setProject}
          resetProject={resetProject}
          masterBranding={resources.masterBranding}
          setActiveTab={() => onOpenEstima && onOpenEstima(project)}
          onSaveProject={handleSaveProject}
          bpuConfig={bpuConfig}
          clientPercent={clientPercent}
          setBpuConfig={setBpuConfig}
          setClientPercent={setClientPercent}
          companyId={companyId}
          currentUserUid={user?.uid}
          onNavigateModule={onNavigateModule}
        />
      </div>
    </div>
  );
}

// ─── DESKTOP APP (tout le code actuel, extrait dans un composant) ────────────
function DesktopApp({ user, companyId, isAdmin, handleLogout, onBackToHub }) {

  // ── 2. Base de données Cloud ────────────────────────────────────────────────
  const db = useDatabase(user, companyId);

  // ── 3. Gestion projet ───────────────────────────────────────────────────────
  const {
    project, setProject,
    handleSaveProject, resetProject, updateProjectName,
    addChapter, addSubChapter, addItemToProject,
    updateProjectItem, handleDragEnd,
  } = useProjectManager(user, companyId);

  // ── 3b. Archives projet ───────────────────────────────────────────────────
  const {
    archives, activeArchive,
    createArchive, deleteArchive, viewArchive, closeArchive,
  } = useProjectArchives(user, companyId, project);

  // ── 4. Ressources partagées (branding, CCTP, RC) ────────────────────────────
  const resources = useAppResources(user, companyId);

  // ── 5. Mode local / cloud ───────────────────────────────────────────────────
  const localMode = useLocalMode({
    cloudBpu:        db.bpu,
    cloudCategories: db.categories,
    addToBpu:        db.addToBpu,
    deleteFromBpu:   db.deleteFromBpu,
    updateBpuItem:   db.updateBpuItem,
    addCategory:     db.addCategory,
    deleteCategory:  db.deleteCategory,
    renameCategory:  db.renameCategory,
    setCategories:   db.setCategories,
    setActiveTab:    (tab) => setActiveTab(tab),
  });

  // ── 6. États UI ─────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('project');
  const [saveStatus,     setSaveStatus]     = useState('saved');
  const [viewMode,       setViewMode]       = useState('study');
  const [bpuSearch,      setBpuSearch]      = useState('');
  const [showBpu,        setShowBpu]        = useState(true);
  const [bpuConfig,      setBpuConfig]      = useState({ numberingMode: 'auto' });
  const [clientPercent,  setClientPercent]  = useState(10);

  // ── 7. Présence temps réel ──────────────────────────────────────────────────
  usePresence({
    user,
    companyId,
    projectId:   project?.id,
    projectName: project?.name,
    activeTab,
  });

  // ── 8. Modales ──────────────────────────────────────────────────────────────
  const modals = useAppModals({
    project, setProject,
    clientPercent, setClientPercent,
    setViewMode, handleSaveProject,
  });

  // ── Recherche BPU ────────────────────────────────────────────────────────────
  const filteredBpuToDisplay = localMode.currentBpu.filter((item) => {
    const term = removeAccents(bpuSearch);
    return (
      removeAccents(item.designation).includes(term) ||
      removeAccents(item.bpuNum?.toString() || '').includes(term)
    );
  });

  // ── Chargement BPU à la demande ──────────────────────────────────────────────
  React.useEffect(() => {
    const needsBpu =
      !localMode.isLocalMode &&
      (activeTab === 'database' ||
       activeTab === 'bpu_export' ||
       activeTab === 'settings' ||
       (activeTab === 'project' && showBpu));
    if (needsBpu) db.loadBpu();
  }, [activeTab, showBpu, localMode.isLocalMode]);

  // ── Render desktop ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#f5f5f7] text-gray-900 font-sans overflow-hidden relative"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

      {/* ── Calculatrice flottante ─────────────────────────────────────────── */}
      <DraggableCalculator
        isOpen={modals.showFloatingCalculator}
        onClose={() => modals.setShowFloatingCalculator(false)}
      />

      {/* ── Modales globales ──────────────────────────────────────────────── */}
      <AddBpuModal
        isOpen={modals.showAddBpuModal}
        onClose={modals.closeAddBpuModal}
        onAdd={localMode.handleAddToBpu}
        units={db.units}
        categories={localMode.currentCategories}
        bpuConfig={bpuConfig}
        existingItems={localMode.currentBpu}
        duplicateItem={modals.itemToDuplicate}
        masterCctp={resources.masterCctp}
      />

      {modals.editTarget && (
        <EditBpuModal
          item={modals.editTarget}
          onClose={() => modals.setEditTarget(null)}
          onUpdate={(fields) => {
            localMode.handleUpdateBpuItem(modals.editTarget.id, fields);
            modals.setEditTarget(null);
          }}
          units={db.units}
          categories={localMode.currentCategories}
          bpuConfig={bpuConfig}
          existingItems={localMode.currentBpu}
          masterCctp={resources.masterCctp}
        />
      )}

      <CalculationModal
        show={modals.calcModal.show}
        analysis={modals.calcModal.analysis}
        onClose={modals.closeCalcModal}
        onConfirm={modals.applyVentilation}
      />

      <ProjectDetailsModal
        isOpen={modals.isProjectModalOpen}
        onClose={modals.closeProjectModal}
        project={project || {}}
        onSave={modals.handleSaveProjectDetails}
      />

      <DeleteModal
        show={modals.deleteModal.show}
        onClose={modals.closeDeleteModal}
        onConfirm={modals.confirmDelete}
      />

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        userEmail={user.email}
        onOpenCalculator={() => modals.setShowFloatingCalculator(true)}
        isAdmin={isAdmin}
        saveStatus={saveStatus}
        projectName={project?.name || ''}
        onBackToHub={onBackToHub}
      />

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {db.isLoading && !localMode.isLocalMode ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Chargement Cloud...</span>
          </div>
        ) : (
          <Suspense fallback={<LazyFallback />}>
            {activeTab === 'project' && (
              <ProjectView
                project={project}
                showBpu={showBpu}
                setShowBpu={setShowBpu}
                bpuSearch={bpuSearch}
                setBpuSearch={setBpuSearch}
                filteredBpu={filteredBpuToDisplay}
                categories={localMode.currentCategories}
                addItemToProject={(item) => addItemToProject(item, null, modals.selection)}
                selection={modals.selection}
                setSelection={modals.setSelection}
                updateProjectItem={updateProjectItem}
                setModal={modals.openDeleteModal}
                addChapter={addChapter}
                addSubChapter={addSubChapter}
                updateProjectName={updateProjectName}
                onDragEnd={handleDragEnd}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onOpenCalculation={modals.openCalcModal}
                clientPercent={clientPercent}
                bpuConfig={bpuConfig}
                setBpuConfig={setBpuConfig}
                onSaveProject={handleSaveProject}
                onSaveStatusChange={setSaveStatus}
                onReplaceProject={(data) => { setProject(data); handleSaveProject(data); }}
                masterBranding={resources.masterBranding}
                units={db.units}
                masterCctp={resources.masterCctp}
                allBpuItems={localMode.currentBpu}
                companyId={companyId}
                onLoadCloudProject={(proj) => {
                  setProject(proj);
                  if (companyId && proj.id) {
                    localStorage.setItem(`last_active_project_id__${companyId}`, proj.id);
                  }
                }}
                archives={archives}
                activeArchive={activeArchive}
                onCreateArchive={createArchive}
                onDeleteArchive={deleteArchive}
                onViewArchive={viewArchive}
                onCloseArchive={closeArchive}
              />
            )}

            {activeTab === 'database' && (
              <DatabaseView
                key={localMode.isLocalMode ? 'local-mode' : db.databaseVersion}
                isLocalMode={localMode.isLocalMode}
                onExitLocalMode={localMode.handleExitLocalMode}
                onFullResetLocal={localMode.handleFullResetLocal}
                filteredBpu={filteredBpuToDisplay}
                fullBpu={localMode.currentBpu}
                onImportData={localMode.handleLocalImport}
                bpuSearch={bpuSearch}
                setBpuSearch={setBpuSearch}
                setShowAddBpuModal={() => modals.openAddBpuModal()}
                onEditItem={modals.setEditTarget}
                deleteFromBpu={localMode.handleDeleteFromBpu}
                units={db.units}
                categories={localMode.currentCategories}
                addCategory={localMode.handleAddCategory}
                deleteCategory={localMode.handleDeleteCategory}
                renameCategory={localMode.handleRenameCategory}
                reorderCategories={localMode.handleReorderCategories}
                assignCategoryToItem={db.assignCategoryToItem}
                onReorderItems={() => {}}
                bpuConfig={bpuConfig}
                onUpdateItem={localMode.handleUpdateBpuItem}
                setItemToDuplicate={(item) => modals.openAddBpuModal(item)}
                isAdmin={isAdmin}
                onForceRefresh={db.forceRefresh}
                masterCctp={resources.masterCctp}
                onClearObservedPrices={async () => {
                  const items = localMode.currentBpu.filter(i => i.observedPrice);
                  if (items.length === 0) return;
                  for (const item of items) {
                    await localMode.handleUpdateBpuItem(item.id, { observedPrice: null });
                  }
                }}
              />
            )}

            {activeTab === 'price_analysis' && (
              <PriceAnalysisView
                project={project}
                companyId={companyId}
                setProject={setProject}
                bpuConfig={bpuConfig}
                clientPercent={clientPercent}
                masterBranding={resources.masterBranding}
                bpu={localMode.currentBpu}
                updateBpuItem={localMode.handleUpdateBpuItem}
              />
            )}

            {activeTab === 'cctp' && (
              <CctpGeneratorView
                project={project}
                masterCctp={resources.masterCctp}
                onSaveMasterCctp={resources.handleSaveMasterCctp}
                masterBranding={resources.masterBranding}
                onSaveMasterBranding={resources.handleSaveMasterBranding}
                onEditProject={modals.openProjectModal}
                onUpdateProject={setProject}
                onSaveProject={handleSaveProject}
                onEditBranding={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'rc' && (
              <RcGeneratorView
                project={project}
                masterRc={resources.masterRc || []}
                onSaveMasterRc={resources.handleSaveMasterRc || (() => {})}
                masterBranding={resources.masterBranding}
                onSaveMasterBranding={resources.handleSaveMasterBranding}
                onEditProject={modals.openProjectModal}
                onUpdateProject={setProject}
                onSaveProject={handleSaveProject}
                onEditBranding={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'bpu_export' && (
              <BpuExportView
                project={project}
                setProject={setProject}
                units={db.units}
                articlesDb={localMode.currentBpu}
                bpuConfig={bpuConfig}
                masterBranding={resources.masterBranding}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                units={db.units}
                saveUnit={db.saveUnit}
                deleteUnit={db.deleteUnit}
                importFromExcel={db.importFromExcel}
                clearBpu={db.clearBpu}
                bpuConfig={bpuConfig}
                setBpuConfig={setBpuConfig}
                isLoading={db.isLoading}
                importWarnings={modals.importWarnings}
                setImportWarnings={modals.setImportWarnings}
              />
            )}

            {activeTab === 'branding' && (
              <BrandingView
                masterBranding={resources.masterBranding}
                onSaveMasterBranding={resources.handleSaveMasterBranding}
                project={project}
              />
            )}

            {/* Admin est maintenant accessible depuis le Hub */}
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── MODULE IDENTITÉ & CHARTE GRAPHIQUE (autonome, hors ESTIMA) ────────────
function BrandingModule({ user, companyId, onBackToHub }) {
  const resources = useAppResources(user, companyId);

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <h1 className="font-bold text-lg text-gray-900 tracking-tight">Identité & Charte Graphique</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <BrandingView
          masterBranding={resources.masterBranding}
          onSaveMasterBranding={resources.handleSaveMasterBranding}
          project={null}
        />
      </div>
    </div>
  );
}

// ─── MODULE VISITES DE SITE (autonome, hors ESTIMA) ─────────────────────────
function SiteVisitsModule({ user, companyId, onBackToHub }) {
  const resources = useAppResources(user, companyId);
  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <h1 className="font-bold text-lg text-gray-900 tracking-tight">Visites de Site</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <SiteVisitsView companyId={companyId} masterBranding={resources.masterBranding} />
      </div>
    </div>
  );
}

// ─── MODULE MON COMPTE & RGPD (autonome, hors ESTIMA) ──────────────────────
function RgpdModule({ user, companyId, onBackToHub }) {
  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <h1 className="font-bold text-lg text-gray-900 tracking-tight">Mon Compte & Données Personnelles</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-8 bg-[#f5f5f7]">
        <div className="max-w-3xl mx-auto">
          <AccountSection user={user} companyId={companyId} />
        </div>
      </div>
    </div>
  );
}