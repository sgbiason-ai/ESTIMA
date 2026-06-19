// src/App.jsx
import React, { useState, useEffect, Suspense } from 'react';
import lazyWithReload from './utils/lazyWithReload';
import ErrorBoundary from './components/common/ErrorBoundary';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db as fireDb } from './firebase';

// ─── HOOKS ────────────────────────────────────────────────────────────────────
import { useAppAuth }       from './hooks/useAppAuth';
import { useDatabase }      from './hooks/useDatabase';
import { useProjectManager } from './hooks/useProjectManager';
import { useLocalMode }     from './hooks/useLocalMode';
import { useAppResources }  from './hooks/useAppResources';
import { useAppModals }     from './hooks/useAppModals';
import { usePresence, useCoEditors } from './hooks/usePresence';
import CoEditBanner        from './components/common/CoEditBanner';
import { useDeviceMode }    from './hooks/useDeviceMode';
import { useIsTesla }       from './hooks/useIsTesla';
import { useProjectArchives } from './hooks/useProjectArchives';
import { useProjectUndo }     from './hooks/useProjectUndo';

// ─── COMPOSANTS GLOBAUX (toujours chargés) ───────────────────────────────────
import Sidebar              from './components/common/Sidebar';
import DeleteModal          from './components/common/DeleteModal';
import MultiDeleteModal     from './components/common/MultiDeleteModal';
import DraggableCalculator  from './components/common/DraggableCalculator';
import AddBpuModal          from './components/database/AddBpuModal';
import EditBpuModal         from './components/database/EditBpuModal';
import CalculationModal     from './components/modals/CalculationModal';
import ProjectDetailsModal  from './components/modals/ProjectDetailsModal';
import HelpButton           from './components/help/HelpButton';
import HelpPanel            from './components/help/HelpPanel';

// ─── VUES (chargement auth / critique — statique) ────────────────────────────
import LoginView            from './views/LoginView';
import LegalView            from './views/LegalView';
import ModuleHubView        from './views/ModuleHubView';
import FeedbackWidget       from './components/feedback/FeedbackWidget';

// ─── VUES (lazy-loaded — code-splitting par module) ──────────────────────────
const ProjectManagerView = lazyWithReload(() => import('./views/projectManager/ProjectManagerView'));
const ProjectView        = lazyWithReload(() => import('./views/ProjectView'));
const EstimRapideView    = lazyWithReload(() => import('./views/estimRapide/EstimRapideView'));
const GedView            = lazyWithReload(() => import('./views/ged/GedView'));
const DatabaseView       = lazyWithReload(() => import('./views/DatabaseView'));
const PriceAnalysisView  = lazyWithReload(() => import('./views/PriceAnalysisView'));
const CctpGeneratorView  = lazyWithReload(() => import('./views/CctpGeneratorView'));
const RcGeneratorView    = lazyWithReload(() => import('./views/RcGeneratorView'));
const CcapGeneratorView  = lazyWithReload(() => import('./views/CcapGeneratorView'));
const BpuExportView      = lazyWithReload(() => import('./views/bpu/BpuExportView'));
const SettingsView       = lazyWithReload(() => import('./views/SettingsView'));
const BrandingView       = lazyWithReload(() => import('./views/BrandingView'));
const AdminView          = lazyWithReload(() => import('./views/AdminView'));
const RaoAnalysisView    = lazyWithReload(() => import('./views/RaoAnalysisView'));
const CrcView            = lazyWithReload(() => import('./views/crc/CrcView'));
const DocAdminView       = lazyWithReload(() => import('./views/DocAdminView'));
const SiteVisitsView     = lazyWithReload(() => import('./views/SiteVisitsView'));
const TeslaModeView      = lazyWithReload(() => import('./views/TeslaModeView'));
const DevisMoeView       = lazyWithReload(() => import('./views/devisMoe/DevisMoeView'));
const ExpenseNotesView   = lazyWithReload(() => import('./views/expenseNotes/ExpenseNotesView'));
const AccountSection     = lazyWithReload(() => import('./components/settings/AccountSection'));
const SmtpSection        = lazyWithReload(() => import('./components/settings/SmtpSection'));

// ─── VUE MOBILE (lazy — chargée seulement sur mobile) ────────────────────────
const MobileApp          = lazyWithReload(() => import('./components/mobile/MobileApp'));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const removeAccents = (str) =>
  str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

/** Fallback de chargement pour React.lazy / Suspense */
const LazyFallback = () => (
  <div className="flex h-screen items-center justify-center bg-[#f5f5f7]">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Wrapper Suspense + ErrorBoundary par module : un crash dans une vue lazy
 *  reste contenu (fallback light + Sentry) au lieu de faire tomber toute l'app. */
const Lazy = ({ children }) => (
  <ErrorBoundary variant="inline">
    <Suspense fallback={<LazyFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {

  // ── 0. Détection device / layout / Tesla ──────────────────────────────────
  const { isTablet, layoutMode, forceLayout } = useDeviceMode();
  const isMobile = layoutMode === 'mobile';
  const isTesla = useIsTesla();

  // ── 0b. Page légale (accessible sans auth) ────────────────────────────────
  const [showLegal, setShowLegal] = useState(false);

  // ── 0c. Module actif (null = Hub) ─────────────────────────────────────────
  const [activeModule, setActiveModule] = useState(null);

  // ── 0d. Feedback "Copié" pour l'identifiant (écran compte non rattaché) ────
  const [idCopied, setIdCopied] = useState(false);

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const { user, companyId, isAdmin, userModules, userMobileModules, authLoading, handleLogout } = useAppAuth();

  // Helper : un user a-t-il accès à ce module ?
  // - 'admin' → toujours gated par isAdmin
  // - userModules défini → source de vérité (override les flags legacy)
  // - userModules absent → fallback legacy : devis_moe et expense_notes restent admin_only
  const LEGACY_ADMIN_ONLY = ['devis_moe', 'expense_notes'];
  const hasModuleAccess = (modId) => {
    if (modId === 'admin') return isAdmin;
    if (Array.isArray(userModules)) return userModules.includes(modId);
    if (LEGACY_ADMIN_ONLY.includes(modId)) return isAdmin;
    return true;
  };

  // ── Masquer le splash HTML une fois l'auth résolu ─────────────────────────
  React.useEffect(() => {
    if (!authLoading) {
      const splash = document.getElementById('splash');
      if (splash) {
        splash.style.opacity = '0';
        splash.style.transition = 'opacity 0.3s';
        setTimeout(() => { splash.style.display = 'none'; }, 300);
      }
    }
  }, [authLoading]);

  // ── Bouton flottant "Passer en mobile" pour tablette en mode desktop ──────
  React.useEffect(() => {
    if (!isTablet || isMobile) return;
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Passer en vue mobile');
    btn.title = 'Passer en vue mobile (tablette)';
    btn.style.cssText = [
      'position:fixed', 'bottom:1rem', 'right:1rem', 'z-index:9999',
      'width:48px', 'height:48px', 'border-radius:9999px',
      'background:rgba(255,255,255,0.92)', 'backdrop-filter:blur(12px)',
      'border:1px solid rgba(0,0,0,0.08)',
      'box-shadow:0 4px 16px rgba(0,0,0,0.12)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'cursor:pointer', 'transition:transform 0.15s ease, box-shadow 0.15s ease',
    ].join(';');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.08)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
    btn.onclick = () => forceLayout('mobile');
    document.body.appendChild(btn);
    return () => { if (btn.parentNode) btn.parentNode.removeChild(btn); };
  }, [isTablet, isMobile, forceLayout]);

  // ── Page légale (rendue avant les gardes d'auth) ──────────────────────────
  if (showLegal) {
    return <LegalView onBack={() => setShowLegal(false)} />;
  }

  // ── Gardes d'auth (communs mobile + desktop) ──────────────────────────────

  if (authLoading) {
    return null; // Le splash HTML est encore visible — pas besoin de doublon React
  }

  if (!user) return <LoginView onShowLegal={() => setShowLegal(true)} />;

  if (!companyId) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 px-6" style={{ background: '#f5f5f7' }}>
        <div className="text-2xl font-bold text-gray-900">Compte non rattaché</div>
        <p className="text-gray-500 text-sm max-w-md text-center">
          Votre compte n'est pas encore associé à une entreprise.
          Communiquez les informations ci-dessous à l'administrateur de l'application pour qu'il vous donne accès.
        </p>
        <div className="w-full max-w-md rounded-2xl border border-gray-200/70 bg-white p-4 text-left space-y-3">
          {user.email && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold shrink-0">Email</span>
              <span className="text-sm text-gray-800 truncate">{user.email}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold shrink-0">Identifiant</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(user.uid); setIdCopied(true); setTimeout(() => setIdCopied(false), 1500); }}
              className="flex items-center gap-2 min-w-0 text-xs font-mono text-gray-700 hover:text-gray-900 transition-colors"
              title="Copier l'identifiant"
            >
              <span className="truncate">{user.uid}</span>
              <span className="shrink-0 text-[10px] font-sans font-semibold text-blue-500">{idCopied ? 'Copié ✓' : 'Copier'}</span>
            </button>
          </div>
        </div>
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
      <Lazy>
        <MobileApp
          user={user}
          companyId={companyId}
          userModules={userModules}
          userMobileModules={userMobileModules}
          onLogout={handleLogout}
          isTablet={isTablet}
          onSwitchToDesktop={() => forceLayout('desktop')}
        />
      </Lazy>
    );
  }

  // ── DESKTOP → Hub de modules ou module actif ──────────────────────────────

  const handleBackToHub = () => setActiveModule(null);

  const renderDesktop = () => {
  // Hub de sélection des modules
  if (!activeModule) {
    return (
      <ModuleHubView
        isAdmin={isAdmin}
        userEmail={user.email}
        userModules={userModules}
        onSelectModule={setActiveModule}
        onLogout={handleLogout}
        onSwitchToMobile={() => forceLayout('mobile')}
      />
    );
  }

  // Garde générique : si l'utilisateur n'a pas accès au module choisi
  // (ex : restriction désactivée à chaud par le super-admin), retour au hub.
  if (!hasModuleAccess(activeModule)) {
    setActiveModule(null);
    return null;
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
          onOpenEstima={() => {
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
          onNavigateModule={setActiveModule}
        />
      </Lazy>
    );
  }

  // Module : Estimation Rapide (esquisse / avant-projet)
  if (activeModule === 'estim_rapide') {
    return (
      <Lazy>
        <EstimRapideView user={user} companyId={companyId} onBackToHub={handleBackToHub} onNavigateModule={setActiveModule} />
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
    return <Lazy><CrcView onBackToHub={handleBackToHub} user={user} companyId={companyId} onNavigateModule={setActiveModule} /></Lazy>;
  }

  // Module : Document Administratif
  if (activeModule === 'doc_admin') {
    return <Lazy><DocAdminView onBackToHub={handleBackToHub} user={user} companyId={companyId} /></Lazy>;
  }

  // Module : Devis MOE — accès via permissions par module (matrice super-admin)
  if (activeModule === 'devis_moe') {
    return <Lazy><DevisMoeView onBackToHub={handleBackToHub} user={user} companyId={companyId} /></Lazy>;
  }

  // Module : Notes de Frais Kilometriques — accès via permissions par module
  if (activeModule === 'expense_notes') {
    return <Lazy><ExpenseNotesModule onBackToHub={handleBackToHub} user={user} companyId={companyId} /></Lazy>;
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
          >
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
      userModules={userModules}
      onSelectModule={setActiveModule}
      onLogout={handleLogout}
      onSwitchToMobile={() => forceLayout('mobile')}
    />
  );
  };

  return (
    <>
      {renderDesktop()}
      <FeedbackWidget
        user={user}
        companyId={companyId}
        activeModule={activeModule}
        isTablet={isTablet}
      />
    </>
  );
}

// ─── MODULE GESTION DE PROJETS (autonome, hors ESTIMA) ──────────────────────
function ProjectManagerModule({ user, companyId, onBackToHub, onOpenEstima, onNavigateModule }) {
  const { project, setProject, handleSaveProject, resetProject } = useProjectManager(user, companyId);
  const resources = useAppResources(user, companyId);
  const [bpuConfig, setBpuConfig] = useState({ numberingMode: 'auto' });
  const [clientPercent, setClientPercent] = useState(10);

  // Persistance bpuConfig dans le projet (Firestore)
  useEffect(() => {
    if (project?.bpuConfig) setBpuConfig(project.bpuConfig);
  }, [project?.id]);

  useEffect(() => {
    setProject(prev => {
      if (JSON.stringify(prev?.bpuConfig) === JSON.stringify(bpuConfig)) return prev;
      return { ...prev, bpuConfig };
    });
  }, [bpuConfig, setProject]);

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      >
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
function DesktopApp({ user, companyId, isAdmin, handleLogout, onBackToHub, onNavigateModule }) {

  // ── 2. Base de données Cloud ────────────────────────────────────────────────
  const db = useDatabase(user, companyId);

  // ── 3. Gestion projet ───────────────────────────────────────────────────────
  const {
    project, setProject,
    handleSaveProject, updateProjectName,
    addChapter, addSubChapter, addItemToProject, addItemsToProject,
    updateProjectItem, handleDragEnd,
  } = useProjectManager(user, companyId);

  // ── 3b. Archives projet (versions figées — consultées via la vue GED) ─────
  const {
    archives, createArchive, deleteArchive,
  } = useProjectArchives(user, companyId, project);

  // ── 3c. Undo (annuler la dernière action sur Estima) ─────────────────────
  const { undo: undoProject, canUndo: canUndoProject, reset: resetUndoHistory } = useProjectUndo(project, setProject);

  // Reset historique quand le projet change (ouverture/nouveau projet)
  useEffect(() => {
    resetUndoHistory();
  }, [project?.id, resetUndoHistory]);

  // Raccourci clavier Ctrl+Z (hors champs de saisie où l'undo natif s'applique)
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.shiftKey) return;
      if (e.key !== 'z' && e.key !== 'Z') return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
      if (!canUndoProject) return;
      e.preventDefault();
      undoProject();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoProject, canUndoProject]);

  // ── 4. Ressources partagées (branding, CCTP, RC) ────────────────────────────
  const resources = useAppResources(user, companyId);

  // ── 5. Mode local / cloud ───────────────────────────────────────────────────
  const localMode = useLocalMode({
    cloudBpu:        db.bpu,
    cloudCategories: db.categories,
    addToBpu:        db.addToBpu,
    deleteFromBpu:   db.deleteFromBpu,
    updateBpuItem:   db.updateBpuItem,
    clearObservedPrices: db.clearObservedPrices,
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

  // ── 6b. Persistance bpuConfig dans le projet (Firestore) ───────────────────
  useEffect(() => {
    if (project?.bpuConfig) setBpuConfig(project.bpuConfig);
  }, [project?.id]);

  useEffect(() => {
    setProject(prev => {
      if (JSON.stringify(prev?.bpuConfig) === JSON.stringify(bpuConfig)) return prev;
      return { ...prev, bpuConfig };
    });
  }, [bpuConfig, setProject]);

  // ── 7. Présence temps réel ──────────────────────────────────────────────────
  usePresence({
    user,
    companyId,
    projectId:   project?.id,
    projectName: project?.name,
    activeTab,
    entityType:  project?.id ? 'estima' : null,
    entityId:    project?.id || null,
    entityName:  project?.name || null,
  });

  // Co-éditeurs du même projet (bannière d'alerte d'écrasement)
  const coEditors = useCoEditors({
    companyId,
    currentUserId: user?.uid,
    entityType: 'estima',
    entityId: project?.id || null,
  });

  // ── 8. Modales ──────────────────────────────────────────────────────────────
  const modals = useAppModals({
    project, setProject,
    clientPercent, setClientPercent,
    setViewMode, handleSaveProject,
  });

  // Cible d'insertion effective : la cible persistante (dernier chapitre/sous-chapitre
  // sélectionné) si elle existe encore dans l'arbre, sinon repli sur le 1er chapitre.
  // Utilisée par TOUTES les insertions (article libre, bibliothèque, bloc) et par
  // l'indicateur visuel « Insertion ici ».
  const insertParentId = React.useMemo(() => {
    const chapters = project?.chapters || [];
    if (chapters.length === 0) return null;
    const targetId = modals.insertTargetId;
    if (targetId) {
      let exists = false;
      const walk = (nodes) => nodes.forEach((n) => {
        if (!n) return;
        if (n.type !== 'item' && String(n.id) === String(targetId)) exists = true;
        if (n.children) walk(n.children);
      });
      walk(chapters);
      if (exists) return targetId;
    }
    return chapters[0].id;
  }, [project, modals.insertTargetId]);

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
      >

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
        defaultThreshold={Number(project?.clientQtyThreshold ?? 20)}
        defaultPercent={Number(project?.clientPercent ?? clientPercent ?? 10)}
      />

      <ProjectDetailsModal
        isOpen={modals.isProjectModalOpen}
        onClose={modals.closeProjectModal}
        project={project || {}}
        onSave={modals.handleSaveProjectDetails}
        branding={resources.masterBranding}
      />

      <DeleteModal
        show={modals.deleteModal.show}
        onClose={modals.closeDeleteModal}
        onConfirm={modals.confirmDelete}
      />

      <MultiDeleteModal
        show={modals.multiDeleteModal.show}
        items={modals.multiDeleteModal.items}
        onClose={modals.closeMultiDeleteModal}
        onConfirm={modals.confirmMultiDelete}
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
        onBackToWorkspace={onNavigateModule ? () => onNavigateModule('projects_manager') : undefined}
      />

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <CoEditBanner editors={coEditors} />
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
                addItemToProject={(item) => addItemToProject(item, insertParentId, null)}
                addItemsToProject={(lines, opts) => addItemsToProject(lines, { type: 'subchapter', id: insertParentId }, opts)}
                selection={modals.selection}
                setSelection={modals.setSelection}
                insertTargetId={insertParentId}
                multiSelection={modals.multiSelection}
                toggleMultiSelection={modals.toggleMultiSelection}
                clearMultiSelection={modals.clearMultiSelection}
                openMultiDeleteModal={modals.openMultiDeleteModal}
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
                onAddToBpu={localMode.handleAddToBpu}
                onUpdateBpuItem={localMode.handleUpdateBpuItem}
                blocs={db.blocs}
                companyId={companyId}
                onLoadCloudProject={(proj) => {
                  setProject(proj);
                  if (user?.uid && proj?.id) {
                    setDoc(
                      doc(fireDb, 'users', user.uid, 'preferences', 'modules'),
                      { estima: proj.id, updatedAt: serverTimestamp() },
                      { merge: true }
                    ).catch(() => {});
                  }
                }}
                onUndo={undoProject}
                canUndo={canUndoProject}
                archives={archives}
                onOpenGed={() => setActiveTab('ged')}
              />
            )}

            {activeTab === 'ged' && (
              <GedView
                project={project}
                archives={archives}
                onCreateArchive={createArchive}
                onDeleteArchive={deleteArchive}
                onUpdateProject={(data) => { setProject(data); handleSaveProject(data); }}
                masterBranding={resources.masterBranding}
              />
            )}

            {activeTab === 'database' && (
              <DatabaseView
                key={localMode.isLocalMode ? 'local-mode' : db.databaseVersion}
                isLocalMode={localMode.isLocalMode}
                onExitLocalMode={localMode.handleExitLocalMode}
                onFullResetLocal={localMode.handleFullResetLocal}
                localLibraryName={localMode.localLibraryName}
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
                blocs={db.blocs}
                addBloc={db.addBloc}
                updateBloc={db.updateBloc}
                deleteBloc={db.deleteBloc}
                onClearObservedPrices={localMode.handleClearObservedPrices}
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
                companyId={companyId}
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
                companyId={companyId}
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

            {activeTab === 'ccap' && (
              <CcapGeneratorView
                project={project}
                companyId={companyId}
                masterCcap={resources.masterCcap || []}
                onSaveMasterCcap={resources.handleSaveMasterCcap || (() => {})}
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
                handleImportDatabase={db.handleImportDatabase}
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
    </div>
  );
}

// ─── MODULE NOTES DE FRAIS (autonome) ───────────────────────────────────────
function ExpenseNotesModule({ user, companyId, onBackToHub }) {
  const resources = useAppResources(user, companyId);
  return <ExpenseNotesView onBackToHub={onBackToHub} user={user} companyId={companyId} masterBranding={resources.masterBranding} />;
}

// ─── MODULE IDENTITÉ & CHARTE GRAPHIQUE (autonome, hors ESTIMA) ────────────
function BrandingModule({ user, companyId, onBackToHub }) {
  const resources = useAppResources(user, companyId);

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      >
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
      >
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
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      >
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="rgpd" />
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <span className="text-[10px] font-bold uppercase tracking-widest">← Hub</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <h1 className="font-bold text-lg text-gray-900 tracking-tight">Mon Compte & Données Personnelles</h1>
        <div className="flex-1" />
        <HelpButton onClick={() => setShowHelp(true)} />
      </header>
      <div className="flex-1 overflow-y-auto p-8 bg-[#f5f5f7]">
        <div className="max-w-3xl mx-auto space-y-8">
          <SmtpSection user={user} />
          <AccountSection user={user} companyId={companyId} />
        </div>
      </div>
    </div>
  );
}