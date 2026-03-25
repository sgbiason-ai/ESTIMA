// src/components/mobile/MobileApp.jsx
//
// Vue mobile PWA d'EstimaVRD — consultation + exports.
// Se branche sur les mêmes données Firestore que le desktop.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useMobileProjects }      from '../../hooks/useMobileProjects';
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
import MobileStyles   from './MobileStyles';
import Icon           from './Icon';
import ProjectsList   from './ProjectsList';
import ProjectDetail  from './ProjectDetail';
import BPUView        from './BPUView';
import DQEView        from './DQEView';
import TranchesView   from './TranchesView';
import RAOView        from './RAOView';
import ExportsView    from './ExportsView';

// ─── MAIN MOBILE APP ────────────────────────────────────────────────────────
export default function MobileApp({ user, companyId, onLogout }) {
  // ── Données ──
  const { projects, folders, isLoading: projectsLoading, refetch, loadProject } = useMobileProjects(user, companyId);
  const dbHook = useDatabase(user, companyId);
  const resources = useAppResources(user, companyId);

  // ── Navigation ──
  const [selectedProject, setSelectedProject] = useState(null);
  const [fullProject, setFullProject]         = useState(null);
  const [subView, setSubView]                 = useState(null);
  const [searchTerm, setSearchTerm]           = useState('');
  const [projectLoading, setProjectLoading]   = useState(false);
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

  const goBack = useCallback(() => {
    if (subView) { setSubView(null); }
    else if (selectedProject) {
      setSelectedProject(null);
      setFullProject(null);
    }
  }, [subView, selectedProject]);

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
    if (subView === 'exports') return 'Exports';
    if (selectedProject) return selectedProject.name;
    return null;
  }, [subView, selectedProject]);

  // ── BPU map pour descriptions ──
  const bpuDescMap = useMemo(() => {
    const map = {};
    (dbHook.bpu || []).forEach(item => {
      if (item.designation) map[item.designation.trim().toUpperCase()] = item;
    });
    return map;
  }, [dbHook.bpu]);

  return (
    <div className="flex flex-col h-screen bg-[#040a0e] font-sans max-w-md mx-auto shadow-2xl">
      <MobileStyles />
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-br from-[#040a0e] to-[#0a1628] text-white sticky top-0 z-20">
        {selectedProject || subView ? (
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-white/10 transition">
            <Icon name="back" size={20} color="#fff" />
          </button>
        ) : (
          <div className="flex items-baseline pl-2">
            <span className="font-extrabold text-sm tracking-tight">ESTIMA</span>
            <span className="font-normal text-xs opacity-60 ml-0.5">VRD</span>
          </div>
        )}
        <div className="flex-1 text-center overflow-hidden">
          {currentTitle && (
            <span className="text-sm font-semibold truncate max-w-[220px] inline-block">
              {currentTitle}
            </span>
          )}
        </div>
        {!selectedProject ? (
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-white/10 transition">
            <Icon name="logout" size={18} color="#64748b" />
          </button>
        ) : <div className="w-9" />}
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto pb-20">
        {!selectedProject && (
          <ProjectsList
            projects={projects}
            folders={folders}
            loading={projectsLoading}
            search={searchTerm}
            onSearch={setSearchTerm}
            onSelect={handleSelectProject}
            onRefresh={refetch}
          />
        )}
        {selectedProject && !subView && (
          projectLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullProject ? (
            <ProjectDetail
              project={fullProject}
              calcHook={calcHook}
              onNavigate={setSubView}
              onExport={handleExport}
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
          <RAOView project={fullProject} refMap={calcHook.refMap} />
        )}
        {subView === 'exports' && (
          <ExportsView onExport={handleExport} />
        )}
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 bg-emerald-500/90 text-white rounded-xl text-sm font-semibold shadow-xl z-50 backdrop-blur">
          <Icon name="check" size={16} color="#34d399" />
          {toast}
        </div>
      )}
    </div>
  );
}
