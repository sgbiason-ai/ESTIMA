// src/App.jsx
import React, { useState } from 'react';

// ─── HOOKS ────────────────────────────────────────────────────────────────────
import { useAppAuth }       from './hooks/useAppAuth';
import { useDatabase }      from './hooks/useDatabase';
import { useProjectManager } from './hooks/useProjectManager';
import { useLocalMode }     from './hooks/useLocalMode';
import { useAppResources }  from './hooks/useAppResources';
import { useAppModals }     from './hooks/useAppModals';
import { usePresence }      from './hooks/usePresence';
import { useIsMobile }      from './hooks/useIsMobile';
import { useProjectArchives } from './hooks/useProjectArchives';

// ─── COMPOSANTS GLOBAUX ───────────────────────────────────────────────────────
import Sidebar              from './components/common/Sidebar';
import DeleteModal          from './components/common/DeleteModal';
import DraggableCalculator  from './components/common/DraggableCalculator';
import AddBpuModal          from './components/database/AddBpuModal';
import EditBpuModal         from './components/database/EditBpuModal';
import CalculationModal     from './components/modals/CalculationModal';
import ProjectDetailsModal  from './components/modals/ProjectDetailsModal';

// ─── VUES ─────────────────────────────────────────────────────────────────────
import LoginView            from './views/LoginView';
import ProjectManagerView   from './views/projectManager/ProjectManagerView';
import ProjectView          from './views/ProjectView';
import DatabaseView         from './views/DatabaseView';
import PriceAnalysisView    from './views/PriceAnalysisView';
import CctpGeneratorView    from './views/CctpGeneratorView';
import RcGeneratorView      from './views/RcGeneratorView';
import BpuExportView        from './views/bpu/BpuExportView';
import SettingsView         from './views/SettingsView';
import BrandingView         from './views/BrandingView';
import AdminView            from './views/AdminView';

// ─── VUE MOBILE ───────────────────────────────────────────────────────────────
import MobileApp            from './components/mobile/MobileApp';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const removeAccents = (str) =>
  str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {

  // ── 0. Détection mobile ───────────────────────────────────────────────────
  const isMobile = useIsMobile(768);

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const { user, companyId, isAdmin, authLoading, handleLogout } = useAppAuth();

  // ── Gardes d'auth (communs mobile + desktop) ──────────────────────────────

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#040a0e] text-white">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginView />;

  if (!companyId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#040a0e] text-white flex-col gap-4">
        <div className="text-2xl font-bold text-slate-300">Compte non configuré</div>
        <p className="text-slate-500 text-sm max-w-sm text-center">
          Votre compte n'est pas encore associé à une entreprise.
          Contactez l'administrateur de l'application.
        </p>
        <button
          onClick={handleLogout}
          className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  // ── MOBILE → rendu simplifié ──────────────────────────────────────────────
  if (isMobile) {
    return <MobileApp user={user} companyId={companyId} onLogout={handleLogout} />;
  }

  // ── DESKTOP → rendu complet (inchangé) ────────────────────────────────────
  return <DesktopApp user={user} companyId={companyId} isAdmin={isAdmin} handleLogout={handleLogout} />;
}

// ─── DESKTOP APP (tout le code actuel, extrait dans un composant) ────────────
function DesktopApp({ user, companyId, isAdmin, handleLogout }) {

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
  const [activeTab,      setActiveTab]      = useState('projects_manager');
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
    <div className="flex h-screen bg-[#040a0e] text-slate-300 font-sans overflow-hidden relative">

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
      />

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {db.isLoading && !localMode.isLocalMode ? (
          <div className="flex-1 flex items-center justify-center text-white gap-3">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Chargement Cloud...</span>
          </div>
        ) : (
          <>
            {activeTab === 'projects_manager' && (
              <ProjectManagerView
                project={project}
                setProject={setProject}
                resetProject={resetProject}
                masterBranding={resources.masterBranding}
                setActiveTab={setActiveTab}
                onSaveProject={handleSaveProject}
                bpuConfig={bpuConfig}
                clientPercent={clientPercent}
                setBpuConfig={setBpuConfig}
                setClientPercent={setClientPercent}
                companyId={companyId}
                currentUserUid={user?.uid}
              />
            )}

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
                masterBranding={resources.masterBranding}
                onSaveMasterBranding={resources.handleSaveMasterBranding}
              />
            )}

            {activeTab === 'branding' && (
              <BrandingView
                masterBranding={resources.masterBranding}
                onSaveMasterBranding={resources.handleSaveMasterBranding}
                project={project}
              />
            )}

            {activeTab === 'admin' && isAdmin && (
              <AdminView currentUserEmail={user.email} />
            )}
          </>
        )}
      </div>
    </div>
  );
}