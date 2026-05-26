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
const loadAnalysisExcel     = () => import('../../utils/excelAnalysisGenerator');
const loadRaoPdf            = () => import('../../utils/pdfRaoGenerator');
const loadCoverPagePdf      = () => import('../../utils/pdfCoverPageGenerator');
const loadNegoLetterPdf     = () => import('../../utils/pdf/pdfNegoLetterGenerator');

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
import { useRobustSave, loadDraft, clearDraft } from '../../hooks/useRobustSave';
import { useNegoTemplate }  from '../../hooks/useNegoTemplate';
import { computeChaptersData, computeAnalysisStats } from '../../utils/analysisCompute';

// ─── SPLIT-VIEW HELPER (tablette paysage) ───────────────────────────────────
const SplitView = ({ List, Detail, hasSelection, loading, emptyIcon = 'list', emptyLabel = 'Sélectionnez un élément à gauche' }) => (
  <div className="flex h-full gap-3 px-3 py-3">
    <div className="w-[360px] shrink-0 overflow-y-auto bg-white rounded-2xl border border-gray-200/60 shadow-sm">
      {List}
    </div>
    <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-200/60 shadow-sm">
      {!hasSelection ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-10">
          <Icon name={emptyIcon} size={48} color="#d1d5db" />
          <p className="text-sm font-medium">{emptyLabel}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      ) : Detail}
    </div>
  </div>
);

// ─── MAIN MOBILE APP ────────────────────────────────────────────────────────
export default function MobileApp({ user, companyId, userModules = null, userMobileModules = null, onLogout, isTablet = false, onSwitchToDesktop = null }) {
  const { isLandscape } = useOrientation();

  // ── Données ──
  const { projects, folders, isLoading: projectsLoading, refetch, loadProject } = useMobileProjects(user, companyId);
  const { chantiers: crcChantiers, isLoading: crcLoading, refetch: crcRefetch, loadChantier, saveChantier } = useMobileCrc(user, companyId);
  const { devisList: moeDevisList, isLoading: moeLoading, refetch: moeRefetch, loadDevis: loadMoeDevis } = useMobileDevisMoe(user, companyId);
  const { fiches: adminFiches, isLoading: adminLoading, refetch: adminRefetch, loadFiche } = useMobileFichesMarche(user, companyId);
  const { visits: siteVisits, isLoading: visitsLoading, refetch: visitsRefetch, loadVisit, saveVisit, createVisit, deleteVisit } = useMobileSiteVisits(user, companyId);
  const dbHook = useDatabase(user, companyId);
  const resources = useAppResources(user, companyId);
  // Template lettre négo (user pref Firestore) — null = fallback dans le générateur
  const { template: negoTemplate } = useNegoTemplate(null);

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

  // ── Sauvegarde robuste pour visites de site ──
  const siteVisitSaveFn = useCallback(async (data) => {
    if (!data?.id) return;
    await saveVisit(data.id, data);
  }, [saveVisit]);
  const { saveStatus: svSaveStatus, triggerSave: svTriggerSave } = useRobustSave({
    saveFn: siteVisitSaveFn,
    draftKey: selectedVisit?.id ? `draft_sv_${selectedVisit.id}` : null,
    debounceMs: 1500,
  });
  const handleSiteVisitSave = useCallback((id, data) => svTriggerSave(data), [svTriggerSave]);

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
      throw err;
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
    // Vérifier si un brouillon local plus récent existe (sauvegarde interrompue)
    const draft = loadDraft(`draft_crr_${ch.id}`);
    const draftAt = draft?._draftAt || 0;
    const firestoreAt = data?.lastSaved ? new Date(data.lastSaved).getTime() : 0;
    if (draft && draftAt > firestoreAt) {
      const { _draftAt, ...cleanDraft } = draft;
      setFullChantier(cleanDraft);
      setToast('Brouillon CRC local restauré');
      setTimeout(() => setToast(null), 2400);
      clearDraft(`draft_crr_${ch.id}`);
    } else {
      setFullChantier(data);
      if (draft) clearDraft(`draft_crr_${ch.id}`);
    }
    setChantierLoading(false);
  }, [loadChantier]);

  // Ouvre un projet puis navigue directement vers un sous-module (rao) ou module (crc)
  const handleSelectProjectAndNavigate = useCallback(async (proj, target) => {
    if (target === 'rao') {
      // RAO = sous-vue du projet
      setSelectedProject(proj);
      setSubView('rao');
      setProjectLoading(true);
      const data = await loadProject(proj.id);
      setFullProject(data);
      setProjectLoading(false);
    } else if (target === 'crc') {
      // CRC = module séparé, on cherche le(s) chantier(s) lié(s) au projet
      setActiveModule('crc');
      setSelectedProject(null);
      setFullProject(null);
      setSubView(null);
      // Trouver les chantiers liés à ce projet
      const linked = crcChantiers.filter(ch => ch.linkedProjectId === proj.id);
      if (linked.length === 1) {
        // Un seul CRC lié → ouvrir directement
        handleSelectChantier(linked[0]);
      } else {
        // Plusieurs ou aucun → afficher la liste CRC
        setSelectedChantier(null);
        setFullChantier(null);
      }
    }
  }, [loadProject, crcChantiers, handleSelectChantier]);

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
    // Vérifier si un brouillon local plus récent existe (sauvegarde interrompue)
    const draft = loadDraft(`draft_sv_${v.id}`);
    const svDraftAt = draft?._draftAt || 0;
    const svFirestoreAt = data?.lastSaved ? new Date(data.lastSaved).getTime() : 0;
    if (draft && svDraftAt > svFirestoreAt) {
      const { _draftAt, ...cleanDraft } = draft;
      setFullVisit(cleanDraft);
      setToast('Brouillon local restauré');
      setTimeout(() => setToast(null), 2400);
      clearDraft(`draft_sv_${v.id}`);
    } else {
      setFullVisit(data);
      if (draft) clearDraft(`draft_sv_${v.id}`);
    }
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
  const handleExport = useCallback(async (exportType, share = false, opts = {}) => {
    if (!fullProject) return;
    const branding = resources.masterBranding;
    const bpuCfg = { numberingMode: fullProject?.bpuConfig?.numberingMode || 'auto' };
    const tranchesList = tranchesHook.tranches;
    const trancheIds = tranchesHook.hasTranches ? tranchesList.map(t => t.id) : ['global'];

    // chaptersData + stats sont des calculs derives (non stockes en Firestore) :
    // on les recalcule a la demande pour les exports analyse/RAO
    const analysisData = fullProject.analysis || {};
    const analysisCompanies = analysisData.companies || [];
    const activeTrancheId = tranchesHook.activeTrancheId || 'global';
    const currentQtyMap = calcHook.clientQtyMaps?.[activeTrancheId] || {};
    const computedChapters = (exportType === 'Analyse' || exportType === 'AnalyseExcel'
                              || exportType === 'RAO' || exportType === 'NegoLetter')
      ? computeChaptersData(fullProject, analysisCompanies, currentQtyMap)
      : [];
    const computedStats = (exportType === 'Analyse' || exportType === 'AnalyseExcel'
                           || exportType === 'RAO')
      ? computeAnalysisStats(computedChapters, analysisCompanies, fullProject.scoringConfig)
      : null;

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
          if (analysisCompanies.length === 0) { setToast('Aucune analyse disponible'); return; }
          await generateAnalysisPDF({
            project: fullProject,
            companies: analysisCompanies,
            chaptersData: computedChapters,
            stats: computedStats,
            bpuRefMap: calcHook.refMap,
            activeTrancheId,
            tranches: tranchesList,
            analysisMode: analysisData.analysisMode || 'global',
            scoringConfig: fullProject.scoringConfig || null,
            branding,
          });
          break;
        }
        case 'RAO': {
          const { generateRaoPDF } = await loadRaoPdf();
          if (analysisCompanies.length === 0) { setToast('Aucune analyse disponible'); return; }
          await generateRaoPDF({
            project: fullProject,
            consultation: fullProject.consultation || {},
            criteria: fullProject.criteria || [],
            rao: fullProject.rao || {},
            analysisCompanies,
            scores: analysisData.scores || {},
            ranking: analysisData.ranking || [],
            branding,
            analysisStats: computedStats,
            chaptersData: computedChapters,
            bpuRefMap: calcHook.refMap,
            activeTrancheId,
            tranches: tranchesList,
            analysisMode: analysisData.analysisMode || 'global',
            scoringConfig: fullProject.scoringConfig || null,
          });
          break;
        }
        case 'CoverPage': {
          const { generateCoverPagePDF } = await loadCoverPagePdf();
          await generateCoverPagePDF(fullProject, branding);
          break;
        }
        case 'AnalyseExcel': {
          const { generateAnalysisExcel } = await loadAnalysisExcel();
          if (analysisCompanies.length === 0) { setToast('Aucune analyse disponible'); return; }
          await generateAnalysisExcel({
            project: fullProject,
            companies: analysisCompanies,
            chaptersData: computedChapters,
            stats: computedStats,
            scoringConfig: fullProject.scoringConfig || null,
            bpuRefMap: calcHook.refMap,
            activeTrancheId,
            tranches: tranchesList,
            branding,
            clientQtyMaps: calcHook.clientQtyMaps,
          });
          break;
        }
        case 'NegoLetter': {
          const { generateNegoLetterPDF } = await loadNegoLetterPdf();
          if (analysisCompanies.length === 0) { setToast('Aucune analyse disponible'); return; }
          const companyName = opts.companyName || analysisCompanies[0]?.name;
          if (!companyName) { setToast('Entreprise introuvable'); return; }
          const companiesData = fullProject.rao?.companies || {};
          const nego = companiesData[companyName]?.negotiation || {};
          const consultation = fullProject.consultation || {};
          const raoLetterConfig = fullProject.rao?.letterConfig || {};
          const letterConfig = {
            signatoryName: raoLetterConfig.signatoryName ?? consultation.client ?? '',
            city:          raoLetterConfig.city          ?? consultation.lieu   ?? '',
            deadline:          nego.deadline          || '',
            adresseEntreprise: nego.adresseEntreprise || '',
            adresseExpediteur: '',
          };
          await generateNegoLetterPDF({
            companyName,
            questions: nego.questions || '',
            letterConfig,
            consultation,
            branding,
            project: fullProject,
            masterTemplate: negoTemplate,
            analysisCompanies,
            chaptersData: computedChapters,
            bpuRefMap: calcHook.refMap,
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
  }, [fullProject, calcHook, tranchesHook, resources, negoTemplate]);

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

  // Container adaptatif :
  //  - Phone  : max-w-md portrait / w-full landscape (inchangé)
  //  - Tablet : max-w-2xl portrait (~672px) / max-w-6xl landscape (~1152px)
  //    => plus de surface utile, supporte hub 2/3 cols et split-view
  const containerWidth = isTablet
    ? (isLandscape ? 'max-w-6xl mx-auto' : 'max-w-2xl mx-auto')
    : (isLandscape ? 'w-full' : 'max-w-md mx-auto');

  return (
    <div className={`flex flex-col h-dvh bg-[#f5f5f7] font-sans ${containerWidth}`}
      style={{ height: '100dvh' }}>
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
            userModules={userModules}
            userMobileModules={userMobileModules}
            onSelectModule={handleSelectModule}
            onLogout={onLogout}
            isLandscape={isLandscape}
            isTablet={isTablet}
            onSwitchToDesktop={onSwitchToDesktop}
          />
        )}

        {/* Module Projets — liste / détail (split-view sur tablette paysage) */}
        {activeModule === 'projects' && !subView && (
          isTablet && isLandscape ? (
            // ── Split-view tablette paysage ──
            <div className="flex h-full gap-3 px-3 py-3">
              <div className="w-[360px] shrink-0 overflow-y-auto bg-white rounded-2xl border border-gray-200/60 shadow-sm">
                <ProjectsList
                  projects={projects}
                  folders={folders}
                  loading={projectsLoading}
                  search={searchTerm}
                  onSearch={setSearchTerm}
                  onSelect={handleSelectProject}
                  onSelectAndNavigate={handleSelectProjectAndNavigate}
                  onRefresh={refetch}
                  isLandscape={false}
                  selectedId={selectedProject?.id}
                />
              </div>
              <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-200/60 shadow-sm">
                {!selectedProject ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-10">
                    <Icon name="folder" size={48} color="#d1d5db" />
                    <p className="text-sm font-medium">Sélectionnez un projet à gauche</p>
                  </div>
                ) : projectLoading ? (
                  <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Chargement…</span>
                  </div>
                ) : fullProject ? (
                  <ProjectDetail
                    project={fullProject}
                    projectMeta={selectedProject}
                    calcHook={calcHook}
                    onNavigate={setSubView}
                    onNavigateModule={handleSelectProjectAndNavigate}
                    onExport={handleExport}
                    isLandscape={isLandscape}
                  />
                ) : null}
              </div>
            </div>
          ) : !selectedProject ? (
            // ── Liste seule (phone ou portrait) ──
            <ProjectsList
              projects={projects}
              folders={folders}
              loading={projectsLoading}
              search={searchTerm}
              onSearch={setSearchTerm}
              onSelect={handleSelectProject}
              onSelectAndNavigate={handleSelectProjectAndNavigate}
              onRefresh={refetch}
              isLandscape={isLandscape}
            />
          ) : projectLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullProject ? (
            <ProjectDetail
              project={fullProject}
              projectMeta={selectedProject}
              calcHook={calcHook}
              onNavigate={setSubView}
              onNavigateModule={handleSelectProjectAndNavigate}
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
          <ExportsView
            onExport={handleExport}
            companies={fullProject?.analysis?.companies || []}
          />
        )}

        {/* Module CRC — split-view sur tablette paysage */}
        {activeModule === 'crc' && (
          isTablet && isLandscape ? (
            <SplitView
              List={<CrcListView chantiers={crcChantiers} loading={crcLoading} onSelect={handleSelectChantier} onRefresh={crcRefetch} isLandscape={false} />}
              Detail={fullChantier && <CrcDetailView chantier={fullChantier} branding={resources.masterBranding} onToast={triggerToast} manager={crrManager} isLandscape={isLandscape} companyId={companyId} />}
              hasSelection={!!selectedChantier}
              loading={chantierLoading}
              emptyIcon="clipboard"
              emptyLabel="Sélectionnez un chantier à gauche"
            />
          ) : !selectedChantier ? (
            <CrcListView chantiers={crcChantiers} loading={crcLoading} onSelect={handleSelectChantier} onRefresh={crcRefetch} isLandscape={isLandscape} />
          ) : chantierLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullChantier ? (
            <CrcDetailView chantier={fullChantier} branding={resources.masterBranding} onToast={triggerToast} manager={crrManager} isLandscape={isLandscape} companyId={companyId} />
          ) : null
        )}

        {/* Module MOE — split-view sur tablette paysage */}
        {activeModule === 'moe' && (
          isTablet && isLandscape ? (
            <SplitView
              List={<MoeListView devisList={moeDevisList} loading={moeLoading} onSelect={handleSelectMoeDevis} onRefresh={moeRefetch} isLandscape={false} />}
              Detail={fullMoeDevis && <MoeDetailView devis={fullMoeDevis} />}
              hasSelection={!!selectedMoeDevis}
              loading={moeDevisLoading}
              emptyIcon="euro"
              emptyLabel="Sélectionnez un devis MOE à gauche"
            />
          ) : !selectedMoeDevis ? (
            <MoeListView devisList={moeDevisList} loading={moeLoading} onSelect={handleSelectMoeDevis} onRefresh={moeRefetch} isLandscape={isLandscape} />
          ) : moeDevisLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullMoeDevis ? (
            <MoeDetailView devis={fullMoeDevis} />
          ) : null
        )}

        {/* Module Documents Admin — split-view sur tablette paysage */}
        {activeModule === 'doc_admin' && (
          isTablet && isLandscape ? (
            <SplitView
              List={<DocAdminListView fiches={adminFiches} loading={adminLoading} onSelect={handleSelectFiche} onRefresh={adminRefetch} isLandscape={false} />}
              Detail={fullFiche && <DocAdminDetailView fiche={fullFiche} branding={resources.masterBranding} onToast={triggerToast} isLandscape={isLandscape} />}
              hasSelection={!!selectedFiche}
              loading={ficheLoading}
              emptyIcon="file"
              emptyLabel="Sélectionnez une fiche à gauche"
            />
          ) : !selectedFiche ? (
            <DocAdminListView fiches={adminFiches} loading={adminLoading} onSelect={handleSelectFiche} onRefresh={adminRefetch} isLandscape={isLandscape} />
          ) : ficheLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullFiche ? (
            <DocAdminDetailView fiche={fullFiche} branding={resources.masterBranding} onToast={triggerToast} isLandscape={isLandscape} />
          ) : null
        )}

        {/* Module Visites de Site — split-view sur tablette paysage */}
        {activeModule === 'site_visits' && (
          isTablet && isLandscape ? (
            <SplitView
              List={<SiteVisitListView visits={siteVisits} loading={visitsLoading} onSelect={handleSelectVisit} onCreate={handleCreateVisit} onDelete={deleteVisit} onRefresh={visitsRefetch} isLandscape={false} />}
              Detail={fullVisit && <SiteVisitDetailView visit={fullVisit} onSave={handleSiteVisitSave} saveStatus={svSaveStatus} onToast={triggerToast} isLandscape={isLandscape} branding={resources.masterBranding} />}
              hasSelection={!!selectedVisit}
              loading={visitLoading}
              emptyIcon="camera"
              emptyLabel="Sélectionnez une visite à gauche"
            />
          ) : !selectedVisit ? (
            <SiteVisitListView visits={siteVisits} loading={visitsLoading} onSelect={handleSelectVisit} onCreate={handleCreateVisit} onDelete={deleteVisit} onRefresh={visitsRefetch} isLandscape={isLandscape} />
          ) : visitLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : fullVisit ? (
            <SiteVisitDetailView visit={fullVisit} onSave={handleSiteVisitSave} saveStatus={svSaveStatus} onToast={triggerToast} isLandscape={isLandscape} branding={resources.masterBranding} />
          ) : null
        )}

        {/* Module RAO supprimé — intégré dans Mes Projets (subView === 'rao') */}

        {/* Module Lecteur PDF */}
        {activeModule === 'pdf_reader' && (
          <PdfReaderView onToast={triggerToast} userId={user?.uid} />
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
