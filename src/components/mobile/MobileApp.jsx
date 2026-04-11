// src/components/mobile/MobileApp.jsx
//
// Vue mobile PWA d'EstimaVRD — consultation + exports.
// Se branche sur les mêmes données Firestore que le desktop.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useMobileProjects }      from '../../hooks/useMobileProjects';
import { useMobileFichesMarche } from '../../hooks/useMobileFichesMarche';
import { useDatabase }            from '../../hooks/useDatabase';
import { useAppResources }        from '../../hooks/useAppResources';
import { useProjectCalculations } from '../../hooks/useProjectCalculations';
import { useProjectTranches }     from '../../hooks/useProjectTranches';

// ─── GENERATORS (chargés dynamiquement pour ne pas alourdir le bundle mobile) ─
const loadExcelGenerator    = () => import('../../utils/excelGenerator');
const loadPdfGenerator      = () => import('../../utils/pdfGenerator');
const loadPdfCctpRc         = () => import('../../utils/pdfCctpRcGenerator');
const loadAnalysisPdf       = () => import('../../utils/pdfAnalysisGenerator');
const loadRaoPdf            = () => import('../../utils/pdfRaoGenerator');

// ─── PARTAGE NATIF ──────────────────────────────────────────────────────────
import { setShareMode } from '../../utils/fileSaver';

// ─── COMPOSANTS MOBILE ──────────────────────────────────────────────────────
import MobileStyles    from './MobileStyles';
import MobileHubView   from './MobileHubView';
import Icon            from './Icon';
import ProjectsList    from './ProjectsList';
import ProjectDetail   from './ProjectDetail';
import BPUView         from './BPUView';
import DQEView         from './DQEView';
import TranchesView    from './TranchesView';
import RAOView         from './RAOView';
import ExportsView     from './ExportsView';
import PlansListView   from './PlansListView';
import CrcListView     from './CrcListView';
import CrcDetailView   from './CrcDetailView';
import MoeListView     from './MoeListView';
import MoeDetailView   from './MoeDetailView';
import DocAdminListView   from './DocAdminListView';
import DocAdminDetailView from './DocAdminDetailView';
import SiteVisitListView    from './SiteVisitListView';
import SiteVisitDetailView  from './SiteVisitDetailView';
import PdfReaderView        from './PdfReaderView';
import { useMobileCrc }       from '../../hooks/useMobileCrc';
import { useMobileDevisMoe } from '../../hooks/useMobileDevisMoe';
import { useMobileSiteVisits } from '../../hooks/useMobileSiteVisits';
import { useCrrManager }     from '../../hooks/useCrrManager';
import { useOrientation }   from '../../hooks/useOrientation';

// ─── MAIN MOBILE APP ────────────────────────────────────────────────────────
export default function MobileApp({ user, companyId, onLogout }) {
  const { isLandscape } = useOrientation();

  // ── Données ──
  const { projects, folders, isLoading: projectsLoading, refetch, loadProject } = useMobileProjects(user, companyId);
  const { chantiers: crcChantiers, isLoading: crcLoading, refetch: crcRefetch, loadChantier, saveChantier } = useMobileCrc(user, companyId);
  const { devisList: moeDevisList, isLoading: moeLoading, refetch: moeRefetch, loadDevis: loadMoeDevis } = useMobileDevisMoe(user, companyId);
  const { fiches: adminFiches, isLoading: adminLoading, refetch: adminRefetch, loadFiche } = useMobileFichesMarche(user, companyId);
  const { visits: siteVisits, isLoading: visitsLoading, refetch: visitsRefetch, loadVisit, saveVisit, createVisit, deleteVisit } = useMobileSiteVisits(user, companyId);
  const dbHook = useDatabase(user, companyId);
  const resources = useAppResources(user, companyId);

  // ── Navigation ──
  const [activeModule, setActiveModule]       = useState(null); // null = hub
  const [selectedProject, setSelectedProject] = useState(null);
  const [fullProject, setFullProject]         = useState(null);
  const [subView, setSubView]                 = useState(null);
  const [searchTerm, setSearchTerm]           = useState('');
  const [projectLoading, setProjectLoading]   = useState(false);
  const [selectedChantier, setSelectedChantier] = useState(null);
  const [fullChantier, setFullChantier]       = useState(null);
  const [chantierLoading, setChantierLoading] = useState(false);
  const [selectedVisit, setSelectedVisit]     = useState(null);
  const [fullVisit, setFullVisit]             = useState(null);
  const [visitLoading, setVisitLoading]       = useState(false);
  const [selectedMoeDevis, setSelectedMoeDevis] = useState(null);
  const [fullMoeDevis, setFullMoeDevis]       = useState(null);
  const [moeDevisLoading, setMoeDevisLoading] = useState(false);
  const [selectedFiche, setSelectedFiche]     = useState(null);
  const [fullFiche, setFullFiche]             = useState(null);
  const [ficheLoading, setFicheLoading]       = useState(false);
  const [toast, setToast]                     = useState(null);

  // ── Hooks métier (activés quand un projet est chargé) ──
  const dummyUpdate = useCallback(() => {}, []);
  const tranchesHook = useProjectTranches(fullProject, dummyUpdate);
  const calcHook = useProjectCalculations({
    project: fullProject,
    clientPercent: fullProject?.clientPercent || 10,
    hasTranches: tranchesHook.hasTranches,
    tranches: tranchesHook.tranches,
    activeTrancheId: tranchesHook.activeTrancheId,
    currentMode: 'client',
    bpuConfig: { numberingMode: fullProject?.bpuConfig?.numberingMode || 'auto' },
  });

  // ── CRR Manager (édition CRC mobile) ──
  const handleSaveCrrDoc = useCallback(async (data) => {
    if (!selectedChantier?.id) return;
    try {
      await saveChantier(selectedChantier.id, data);
    } catch (err) {
      console.error('[Mobile] Erreur sauvegarde CRC:', err);
    }
  }, [selectedChantier, saveChantier]);

  const crrManager = useCrrManager({
    project: fullChantier,
    onUpdateProject: setFullChantier,
    onSaveProject: handleSaveCrrDoc,
    masterBranding: resources.masterBranding,
  });

  // ── Charger le BPU pour les descriptions ──
  useEffect(() => { dbHook.loadBpu(); }, []);

  // ── Charger un projet complet ──
  const handleSelectProject = useCallback(async (proj) => {
    setSelectedProject(proj);
    setSubView(null);
    setProjectLoading(true);
    const data = await loadProject(proj.id);
    setFullProject(data);
    setProjectLoading(false);
  }, [loadProject]);

  const handleSelectChantier = useCallback(async (ch) => {
    setSelectedChantier(ch);
    setChantierLoading(true);
    const data = await loadChantier(ch.id);
    setFullChantier(data);
    setChantierLoading(false);
  }, [loadChantier]);

  const handleSelectMoeDevis = useCallback(async (d) => {
    setSelectedMoeDevis(d);
    setMoeDevisLoading(true);
    const data = await loadMoeDevis(d.id);
    setFullMoeDevis(data);
    setMoeDevisLoading(false);
  }, [loadMoeDevis]);

  const handleSelectFiche = useCallback(async (f) => {
    setSelectedFiche(f);
    setFicheLoading(true);
    const data = await loadFiche(f.id);
    setFullFiche(data);
    setFicheLoading(false);
  }, [loadFiche]);

  const handleSelectVisit = useCallback(async (v) => {
    setSelectedVisit(v);
    setVisitLoading(true);
    const data = await loadVisit(v.id);
    setFullVisit(data);
    setVisitLoading(false);
  }, [loadVisit]);

  const handleCreateVisit = useCallback(async () => {
    const visit = await createVisit();
    if (visit) {
      setSelectedVisit(visit);
      setFullVisit(visit);
      visitsRefetch();
    }
  }, [createVisit, visitsRefetch]);

  const goBack = useCallback(async () => {
    if (subView) { setSubView(null); }
    else if (selectedProject) {
      setSelectedProject(null);
      setFullProject(null);
    } else if (selectedChantier) {
      // Confirmation avant de quitter un CR en cours
      const { confirm } = await import('../../utils/globalUI');
      const ok = await confirm('Quitter le compte rendu ? Les modifications sont sauvegardées automatiquement.', { title: 'Retour' });
      if (!ok) return;
      setSelectedChantier(null);
      setFullChantier(null);
    } else if (selectedMoeDevis) {
      setSelectedMoeDevis(null);
      setFullMoeDevis(null);
    } else if (selectedFiche) {
      setSelectedFiche(null);
      setFullFiche(null);
    } else if (selectedVisit) {
      // Confirmation avant de quitter une visite en cours
      const { confirm } = await import('../../utils/globalUI');
      const ok = await confirm('Quitter la visite ? Les modifications sont sauvegardées automatiquement.', { title: 'Retour' });
      if (!ok) return;
      setSelectedVisit(null);
      setFullVisit(null);
    } else if (activeModule) {
      setActiveModule(null);
    }
  }, [subView, selectedProject, selectedChantier, selectedMoeDevis, selectedFiche, selectedVisit, activeModule]);

  const triggerToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  // ── Export handler (share = true → partage natif, false → téléchargement) ──
  const handleExport = useCallback(async (exportType, share = false) => {
    if (!fullProject) return;
    const branding = resources.masterBranding;
    const bpuCfg = { numberingMode: fullProject?.bpuConfig?.numberingMode || 'auto' };
    const tranchesList = tranchesHook.tranches;
    const trancheIds = tranchesHook.hasTranches ? tranchesList.map(t => t.id) : ['global'];

    try {
      setToast(share ? `Partage ${exportType}…` : `Export ${exportType}…`);
      setShareMode(share);

      switch (exportType) {
        case 'BPU': {
          const { generateProfessionalExcel } = await loadExcelGenerator();
          await generateProfessionalExcel(fullProject, calcHook.clientQtyMaps, 'BPU', bpuCfg, {
            selectedExports: ['global'],
            tranches: tranchesList,
          }, branding);
          break;
        }
        case 'DQE': {
          const { generateProfessionalExcel } = await loadExcelGenerator();
          await generateProfessionalExcel(fullProject, calcHook.clientQtyMaps, 'ESTIMATION', bpuCfg, {
            selectedExports: trancheIds,
            includeSummary: tranchesHook.hasTranches,
            tranches: tranchesList,
          }, branding);
          break;
        }
        case 'Estim': {
          const { generateProfessionalPDF } = await loadPdfGenerator();
          await generateProfessionalPDF(fullProject, calcHook.clientQtyMaps, 'ESTIMATION', bpuCfg, {
            selectedExports: trancheIds,
            includeSummary: tranchesHook.hasTranches,
            tranches: tranchesList,
          }, branding);
          break;
        }
        case 'CCTP': {
          const { generatePdfCctpRc } = await loadPdfCctpRc();
          const tree = resources.masterCctp || [];
          const allIds = [];
          const collectIds = (nodes) => nodes.forEach(n => { allIds.push(n.id); if (n.children) collectIds(n.children); });
          collectIds(tree);
          await generatePdfCctpRc('CCTP', allIds, tree, {}, fullProject, branding);
          break;
        }
        case 'RC': {
          const { generatePdfCctpRc } = await loadPdfCctpRc();
          const tree = resources.masterRc || [];
          const allIds = [];
          const collectIds = (nodes) => nodes.forEach(n => { allIds.push(n.id); if (n.children) collectIds(n.children); });
          collectIds(tree);
          await generatePdfCctpRc('RC', allIds, tree, {}, fullProject, branding);
          break;
        }
        case 'Analyse': {
          const { generateAnalysisPDF } = await loadAnalysisPdf();
          const analysis = fullProject.analysis || {};
          const companies = analysis.companies || [];
          if (companies.length === 0) { setToast('Aucune analyse disponible'); return; }
          await generateAnalysisPDF({
            project: fullProject,
            companies,
            chaptersData: analysis.chaptersData || [],
            stats: analysis.stats || {},
            bpuRefMap: calcHook.refMap,
            activeTrancheId: tranchesHook.activeTrancheId || 'global',
            tranches: tranchesList,
            analysisMode: analysis.analysisMode || 'global',
            scoringConfig: fullProject.scoringConfig || null,
            branding,
          });
          break;
        }
        case 'RAO': {
          const { generateRaoPDF } = await loadRaoPdf();
          const analysis = fullProject.analysis || {};
          if (!analysis.companies?.length) { setToast('Aucune analyse disponible'); return; }
          await generateRaoPDF({
            project: fullProject,
            consultation: fullProject.consultation || {},
            criteria: fullProject.criteria || [],
            rao: analysis.rao || {},
            analysisCompanies: analysis.companies || [],
            scores: analysis.scores || {},
            ranking: analysis.ranking || [],
            branding,
            analysisStats: analysis.stats || {},
            chaptersData: analysis.chaptersData || [],
            bpuRefMap: calcHook.refMap,
            activeTrancheId: tranchesHook.activeTrancheId || 'global',
            tranches: tranchesList,
            analysisMode: analysis.analysisMode || 'global',
            scoringConfig: fullProject.scoringConfig || null,
          });
          break;
        }
        default:
          setToast(`Export ${exportType} non disponible`);
          return;
      }

      setToast(`${exportType} ${share ? 'partagé' : 'exporté'} ✓`);
      setTimeout(() => setToast(null), 2400);
    } catch (err) {
      console.error(`[Mobile] Erreur export ${exportType}:`, err);
      setToast(`Erreur export ${exportType}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setShareMode(false);
    }
  }, [fullProject, calcHook, tranchesHook, resources]);

  const currentTitle = useMemo(() => {
    if (subView === 'bpu') return 'Bordereau des Prix';
    if (subView === 'dqe') return 'DQE par Tranche';
    if (subView === 'tranches') return 'Récap. par Tranche';
    if (subView === 'rao') return 'Analyse des Offres';
    if (subView === 'plans') return 'Plans';
    if (subView === 'exports') return 'Exports';
    if (selectedProject) return selectedProject.name;
    if (selectedChantier) {
      const lieu = fullChantier?.crrConfig?.chantierInfo?.lieu;
      return `Compte Rendu${lieu ? ` — ${lieu}` : ''}`;
    }
    if (selectedMoeDevis) return selectedMoeDevis.nom;
    if (selectedFiche) return selectedFiche.nom;
    if (selectedVisit) return fullVisit?.nom || 'Visite de Site';
    if (activeModule === 'projects') return 'Mes Projets & RAO';
    if (activeModule === 'crc') return 'Comptes Rendus';
    if (activeModule === 'moe') return 'Devis MOE';
    if (activeModule === 'doc_admin') return 'Documents Admin';
    if (activeModule === 'site_visits') return 'Visites de Site';
    if (activeModule === 'pdf_reader') return 'Lecteur PDF';
    if (activeModule === 'exports') return 'Exports Rapides';
    if (activeModule === 'rao') return 'Mes Projets & RAO';
    return null;
  }, [subView, selectedProject, selectedChantier, fullChantier, selectedFiche, selectedMoeDevis, selectedVisit, fullVisit, activeModule]);

  // ── Sélection module depuis le hub ──
  const handleSelectModule = useCallback((moduleId) => {
    setActiveModule(moduleId);
    setSelectedProject(null);
    setFullProject(null);
    setSelectedChantier(null);
    setFullChantier(null);
    setSelectedMoeDevis(null);
    setFullMoeDevis(null);
    setSelectedFiche(null);
    setFullFiche(null);
    setSelectedVisit(null);
    setFullVisit(null);
    setSubView(null);
    setSearchTerm('');
  }, []);

  // ── BPU map pour descriptions ──
  const bpuDescMap = useMemo(() => {
    const map = {};
    (dbHook.bpu || []).forEach(item => {
      if (item.designation) map[item.designation.trim().toUpperCase()] = item;
    });
    return map;
  }, [dbHook.bpu]);

  return (
    <div className={`flex flex-col h-dvh bg-[#f5f5f7] font-sans ${isLandscape ? 'w-full' : 'max-w-md mx-auto'}`}
      style={{ height: '100dvh', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
      <MobileStyles />
      {/* ── Header (masqué sur le hub — il a son propre header) ── */}
      {activeModule && (
        <header className={`flex items-center justify-between px-3 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 text-gray-900 sticky top-0 z-20 ${isLandscape ? 'py-1' : 'py-3'}`}>
          <button onClick={goBack} className="p-2.5 rounded-xl hover:bg-gray-100 transition">
            <Icon name="back" size={22} color="#6b7280" />
          </button>
          <div className="flex-1 text-center overflow-hidden">
            {currentTitle && (
              <span className="text-[15px] font-semibold text-gray-900 truncate max-w-[260px] inline-block">
                {currentTitle}
              </span>
            )}
          </div>
          <div className="w-10" />
        </header>
      )}

      {/* ── Content ── */}
      <main className={`flex-1 overflow-y-auto ${isLandscape ? 'pb-2' : 'pb-2'}`}>
        {/* Hub (écran d'accueil) */}
        {!activeModule && (
          <MobileHubView
            userEmail={user?.email}
            onSelectModule={handleSelectModule}
            onLogout={onLogout}
            isLandscape={isLandscape}
          />
        )}

        {/* Module Projets — liste */}
        {activeModule === 'projects' && !selectedProject && (
          <ProjectsList
            projects={projects}
            folders={folders}
            loading={projectsLoading}
            search={searchTerm}
            onSearch={setSearchTerm}
            onSelect={handleSelectProject}
            onRefresh={refetch}
            isLandscape={isLandscape}
          />
        )}
        {selectedProject && !subView && (
          projectLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullProject ? (
            <ProjectDetail
              project={fullProject}
              calcHook={calcHook}
              onNavigate={setSubView}
              onExport={handleExport}
              isLandscape={isLandscape}
            />
          ) : null
        )}
        {subView === 'bpu' && fullProject && (
          <BPUView
            project={fullProject}
            bpuDescMap={bpuDescMap}
            refMap={calcHook.refMap}
            search={searchTerm}
            onSearch={setSearchTerm}
          />
        )}
        {subView === 'dqe' && fullProject && (
          <DQEView
            project={fullProject}
            calcHook={calcHook}
            tranchesHook={tranchesHook}
          />
        )}
        {subView === 'tranches' && fullProject && (
          <TranchesView
            project={fullProject}
            calcHook={calcHook}
            tranchesHook={tranchesHook}
          />
        )}
        {subView === 'rao' && fullProject && (
          <RAOView project={fullProject} companyId={companyId} calcHook={calcHook} />
        )}
        {subView === 'plans' && fullProject && (
          <PlansListView project={fullProject} />
        )}
        {subView === 'exports' && (
          <ExportsView onExport={handleExport} />
        )}

        {/* Module CRC — liste chantiers */}
        {activeModule === 'crc' && !selectedChantier && (
          <CrcListView
            chantiers={crcChantiers}
            loading={crcLoading}
            onSelect={handleSelectChantier}
            onRefresh={crcRefetch}
            isLandscape={isLandscape}
          />
        )}
        {activeModule === 'crc' && selectedChantier && (
          chantierLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullChantier ? (
            <CrcDetailView chantier={fullChantier} branding={resources.masterBranding} onToast={triggerToast} manager={crrManager} isLandscape={isLandscape} />
          ) : null
        )}

        {/* Module MOE — liste devis */}
        {activeModule === 'moe' && !selectedMoeDevis && (
          <MoeListView
            devisList={moeDevisList}
            loading={moeLoading}
            onSelect={handleSelectMoeDevis}
            onRefresh={moeRefetch}
            isLandscape={isLandscape}
          />
        )}
        {activeModule === 'moe' && selectedMoeDevis && (
          moeDevisLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullMoeDevis ? (
            <MoeDetailView devis={fullMoeDevis} />
          ) : null
        )}

        {/* Module Documents Admin — liste fiches marché */}
        {activeModule === 'doc_admin' && !selectedFiche && (
          <DocAdminListView
            fiches={adminFiches}
            loading={adminLoading}
            onSelect={handleSelectFiche}
            onRefresh={adminRefetch}
            isLandscape={isLandscape}
          />
        )}
        {activeModule === 'doc_admin' && selectedFiche && (
          ficheLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullFiche ? (
            <DocAdminDetailView fiche={fullFiche} branding={resources.masterBranding} onToast={triggerToast} isLandscape={isLandscape} />
          ) : null
        )}

        {/* Module Visites de Site — liste */}
        {activeModule === 'site_visits' && !selectedVisit && (
          <SiteVisitListView
            visits={siteVisits}
            loading={visitsLoading}
            onSelect={handleSelectVisit}
            onCreate={handleCreateVisit}
            onDelete={deleteVisit}
            onRefresh={visitsRefetch}
            isLandscape={isLandscape}
          />
        )}
        {activeModule === 'site_visits' && selectedVisit && (
          visitLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullVisit ? (
            <SiteVisitDetailView visit={fullVisit} onSave={saveVisit} onToast={triggerToast} isLandscape={isLandscape} />
          ) : null
        )}

        {/* Module RAO supprimé — intégré dans Mes Projets (subView === 'rao') */}

        {/* Module Lecteur PDF */}
        {activeModule === 'pdf_reader' && (
          <PdfReaderView onToast={triggerToast} />
        )}

        {/* Module Exports rapides (depuis le hub, sans projet) */}
        {activeModule === 'exports' && !selectedProject && (
          <div className="px-4 py-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Icon name="download" size={28} color="#9ca3af" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Exports Rapides</h2>
              <p className="text-sm text-gray-400 max-w-[260px] leading-relaxed mb-6">
                Sélectionnez d'abord un projet depuis <strong className="text-gray-700">Mes Projets</strong> pour accéder aux exports.
              </p>
              <button
                onClick={() => handleSelectModule('projects')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium transition active:scale-[0.97]"
              >
                <Icon name="folder" size={16} color="#fff" />
                Ouvrir Mes Projets
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-2xl text-sm font-medium shadow-xl z-50">
          <Icon name="check" size={16} color="#fff" />
          {toast}
        </div>
      )}
    </div>
  );
}
