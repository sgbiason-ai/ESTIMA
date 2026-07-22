// src/views/RaoView.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileDown, Loader2, FileSignature,
  CheckCircle2 as CheckIcon, Download, FileUp, ChevronDown,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as fireDb } from '../firebase';
import { getCompanyRabaisPct, getVariantEffectiveTotal, variantHasNego, computePriceReference, scoreOffer } from '../utils/analysisCompute';
import { useRao } from '../hooks/useRao';
import { useRaoCompletion } from '../hooks/useRaoCompletion';
import { toast } from '../utils/globalUI';
import { useIsMobile } from '../hooks/useIsMobile';
import { flashAnchor } from '../utils/raoAnchors';
import { RAO_STEPS } from '../components/rao/RaoConstants';
import NextStepHint from '../components/rao/NextStepHint';
import SaveStatusIndicator from '../components/rao/SaveStatusIndicator';
import TabConsultation from '../components/rao/tabs/TabConsultation';
import TabAdministrative from '../components/rao/tabs/TabAdministrative';
import TabTechnique from '../components/rao/tabs/TabTechnique';
import TabNegociation from '../components/rao/tabs/TabNegociation';
import TabRecap from '../components/rao/tabs/TabRecap';
import TabDepouillement from '../components/rao/tabs/TabDepouillement';
import DepouillementModal from '../components/rao/DepouillementModal';
import DepouillementNegoModal from '../components/rao/DepouillementNegoModal';
import ProjectDetailsModal from '../components/modals/ProjectDetailsModal';
import PreExportChecklistModal from '../components/rao/PreExportChecklistModal';
import {
  RibbonContainer,
  RibbonGroup,
  RibbonBtnLarge,
  RibbonBtnSmall,
  RibbonSpacer
} from '../components/common/RibbonParts';

// Ordre canonique des étapes du RAO : source unique dans RaoConstants
// (partagée avec NextStepHint, RaoOrientationPanel et la checklist pré-export).

// Onglets « plein écran » (sidebar entreprises + scroll interne) : pas de
// scroll/padding sur le conteneur, chaque onglet gère le sien.
const FULLSCREEN_TABS = ['admin', 'technique', 'negociation', 'depouillement', 'depouillementNego', 'adminNego', 'techniqueNego'];

const RaoView = ({
  project,
  setProject,
  companyId,
  analysisCompanies = [],
  analysisLoaded = true,
  analysisStats = null,
  analysisStatsInitial = null,
  analysisStatsNego = null,
  negoActive = false,
  hasNegoOffers = false,
  scoringConfig = null,
  masterBranding = null,
  chaptersData = [],
  clientQtyMaps = {},
  bpuRefMap = new Map(),
  tranches = [],
  analysisMode = 'standard',
  onImportVariant = null,
  onRemoveVariant = null,
  onToggleVariantRetained = null,
  onUpdateVariantJustification = null,
  onApplyDepouillement = null,
  onUpdateAeAmount = null,
  onUpdateVariantAeAmount = null,
  onUpdateNegoRabais = null,
  onImportNegoOffer = null,
  onApplyDepouillementNego = null,
  onUpdateAeAmountNego = null,
  onUpdateVariantAeAmountNego = null,
  onSetNegoPhase = null,
  onImportOffer = null,
  onImportPdfOffer = null,
  handleSaveProject = null,
  onExportJson = null,
  onImportJson = null,
}) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('depouillement');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  // Le doc rao/data est chargé séparément (et en parallèle) de analysis/data :
  // ce flag évite que l'atterrissage intelligent décide sur un project.rao vide.
  const [raoLoaded, setRaoLoaded] = useState(false);
  // État de sauvegarde affiché par SaveStatusIndicator :
  // 'idle' | 'pending' (modif en attente) | 'saving' | 'saved' | 'error'.
  const [saveStatus, setSaveStatus] = useState('idle');
  const [preExportOpen, setPreExportOpen] = useState(false);
  // Inclure ou non les annexes A (formules de notation) et B (références CCP).
  // Coché par défaut : préserve le PDF actuel ; l'utilisateur décoche pour alléger.
  const [includeAnnexes, setIncludeAnnexes] = useState(true);
  // Phase de négociation à marquer sur le rapport : 'none' | 'before' | 'after'.
  // 'none' par défaut : page de garde et conclusion inchangées (marchés sans négo).
  const [negotiationPhase, setNegotiationPhase] = useState('none');
  // Format papier des annexes de prix A/B : 'a4' (compact) ou 'a3' (confort de lecture).
  // Defaut 'a4' : imprimable partout sans reglage particulier ; l'utilisateur bascule sur A3
  // quand il y a beaucoup d'entreprises/variantes pour ameliorer la lisibilite.
  const [pricesPaperSize, setPricesPaperSize] = useState('a4');
  // Si l'analyse est basculée « après négo », proposer d'office la phase 'after'
  // (l'utilisateur peut toujours la changer dans la checklist pré-export).
  useEffect(() => {
    if (negoActive) setNegotiationPhase(p => (p === 'none' ? 'after' : p));
  }, [negoActive]);
  // showHelp / setShowHelp supprimés : l'aide est gérée par RaoAnalysisView
  // État de la modale Dépouillement
  const [depouillementOpen, setDepouillementOpen] = useState(false);
  // État de la modale Dépouillement après négociation (PV des offres finales)
  const [depouillementNegoOpen, setDepouillementNegoOpen] = useState(false);
  // Atterrissage intelligent : ne recale l'onglet initial qu'une seule fois par projet.
  const landedForRef = useRef(null);
  // État de la modale Fiche affaire (identique au module ESTIMA)
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Input fichier caché pour Import JSON
  const jsonInputRef = useRef(null);

  // Sauvegarde des détails du projet — merge sur le projet + persistance Firestore
  const handleSaveProjectDetails = useCallback(async (details) => {
    if (!details || !setProject) return;
    let merged = null;
    setProject(prev => {
      if (!prev) return prev;
      merged = { ...prev, ...details };
      return merged;
    });
    // Persister immédiatement le projet (sinon le state local est mis à jour
    // mais le doc racine companies/{id}/projects/{id} ne reflète pas les changements).
    if (handleSaveProject && merged) {
      try {
        await handleSaveProject(merged);
        toast.success('Fiche affaire sauvegardée.');
      } catch (e) {
        console.error('[FicheAffaire] Erreur sauvegarde:', e);
        toast.error('Erreur lors de la sauvegarde de la fiche affaire.');
      }
    } else {
      toast.success('Fiche affaire mise à jour.');
    }
  }, [setProject, handleSaveProject]);

  // ─── Date/heure de remise : éditable dans Consultation ET Fiche affaire ──
  // Même champ du doc projet (dateRemise/timeRemise) — écriture immédiate dans
  // le state, persistance débouncée (le doc racine n'a pas d'auto-save).
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; });
  const remiseTimerRef = useRef(null);
  const handleUpdateRemise = useCallback((field, value) => {
    setProject(prev => (prev ? { ...prev, [field]: value } : prev));
    if (!handleSaveProject) return;
    clearTimeout(remiseTimerRef.current);
    remiseTimerRef.current = setTimeout(() => {
      if (projectRef.current) {
        handleSaveProject(projectRef.current).catch(e => console.error('[RAO] Sauvegarde date de remise:', e));
      }
    }, 1200);
  }, [setProject, handleSaveProject]);

  // statsByBasis : stats des deux phases pour les classements forcés par étape
  // (5 = Récap avant négo sur les offres initiales, 9 = Récap final sur les négociées).
  const rao = useRao(project, setProject, analysisCompanies, analysisStats, scoringConfig, tranches, [],
    { initial: analysisStatsInitial, nego: analysisStatsNego });

  // ─── Négociation engagée ? Déverrouille les étapes 6-9 du workflow. ──────
  // Trois portes d'entrée : marqueur explicite (bouton « Engager la négociation »
  // du Récap avant négo), prix négociés déjà importés, ou notation déjà basculée.
  const negoEngaged = rao.negoEngaged || negoActive || hasNegoOffers;

  // ─── Persistance Firestore dédiée : projects/{id}/rao/data ────────────
  const projectId = project?.id;

  // Chargement Firestore au montage (une seule fois)
  const loadedForRef = useRef(null);
  // Garde-fou pour ne pas déclencher l'auto-save juste après le chargement
  const skipNextAutoSaveRef = useRef(false);
  useEffect(() => {
    if (!projectId || !companyId) return;
    if (loadedForRef.current === projectId) return;
    loadedForRef.current = projectId;
    setRaoLoaded(false); // (re)chargement d'un projet : on attend le doc rao/data
    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'rao', 'data');
    getDoc(docRef).then(snap => {
      if (snap.exists() && snap.data().rao) {
        skipNextAutoSaveRef.current = true; // évite de re-sauver les données qu'on vient de charger
        setProject(prev => ({ ...prev, rao: snap.data().rao }));
      }
      setRaoLoaded(true); // même si le doc n'existe pas : un projet sans rao doit pouvoir atterrir
    }).catch(e => { console.error('[RAO] Erreur chargement:', e); setRaoLoaded(true); });
  }, [projectId, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde RAO dans Firestore (utilisée par auto-save + indicateur cliquable)
  const saveRaoToFirestore = useCallback((silent = false) => {
    if (!projectId || !companyId) return Promise.resolve();
    setSaveStatus('saving');
    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'rao', 'data');
    const payload = { rao: project?.rao || {}, lastSaved: new Date().toISOString() };
    return setDoc(docRef, payload)
      .then(() => {
        setLastSaved(new Date());
        setSaveStatus('saved');
        if (!silent) toast.success('Rapport RAO sauvegardé.');
      })
      .catch(e => {
        console.error('[RAO] Erreur sauvegarde:', e);
        setSaveStatus('error');
        if (!silent) toast.error('Erreur de sauvegarde.');
      });
  }, [projectId, companyId, project?.rao]);

  // ─── AUTO-SAVE — déclenché 1.5s après toute modification de project.rao ──
  // Couvre : auto-flag irregulière à l'import, dépouillement, pièces admin/offre
  // réordonnées par drag&drop, critères, technique, négociation.
  useEffect(() => {
    if (!projectId || !companyId) return;
    if (!project?.rao) return;
    // Skipper l'auto-save juste après chargement Firestore
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    // Une modification vient d'arriver : marquer « en attente » jusqu'à l'écriture.
    setSaveStatus('pending');
    const handle = setTimeout(() => {
      saveRaoToFirestore(true); // silent : pas de toast pour l'auto-save
    }, 1500);
    return () => clearTimeout(handle);
  }, [project?.rao, projectId, companyId, saveRaoToFirestore]);

  // Garde-fou de sortie : avertir si une sauvegarde est en attente/en cours.
  useEffect(() => {
    if (saveStatus !== 'pending' && saveStatus !== 'saving') return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveStatus]);

  // Classement de la phase globale (export PDF — comportement historique) +
  // classements forcés par phase pour les étapes 5 (avant négo) et 9 (final).
  const ranking = rao.getRanking();
  const rankingInitial = rao.getRanking('initial');
  const rankingNego = negoEngaged ? rao.getRanking('nego') : null;
  const companyNames = analysisCompanies.map(c => c.name);

  // ─── COMPARATIF AVANT / APRÈS NÉGOCIATION ────────────────────────────────
  // Lignes = offres de base + variantes RETENUES (mêmes offres concourantes que
  // le Récap). Montants des deux phases (hors options PSE), rabais commercial
  // global déduit des montants négo, notes prix recalculées sur la fourchette
  // complète (computePriceReference → scoreOffer, source unique).
  // Alimente le panneau Négociation, l'onglet Dépouillement (mode négo) et l'étape 7 du PDF.
  const negoComparison = useMemo(() => {
    // Visible dès que des données négo existent OU que la phase est active
    // (permet de saisir rabais / PV après négo depuis le RAO avant tout prix négocié).
    if ((!hasNegoOffers && !negoActive) || !analysisStatsInitial || !analysisStatsNego) return null;

    const rows = [];
    analysisCompanies.forEach(c => {
      const rabaisPct = getCompanyRabaisPct(c, 'nego');
      rows.push({
        kind: 'base',
        id: c.id,
        companyId: c.id,
        name: c.name,
        initialTotal: analysisStatsInitial.companiesTotals?.[c.id] || 0,
        // Total NET (rabais commercial déduit par computeAnalysisStats)
        negoTotal: analysisStatsNego.companiesTotals?.[c.id] || 0,
        negoTotalBrut: analysisStatsNego.companiesTotalsBrut?.[c.id] ?? (analysisStatsNego.companiesTotals?.[c.id] || 0),
        rabaisPct,
        negotiated: !!(c.offersNego && Object.keys(c.offersNego).length > 0) || rabaisPct > 0,
        negoImportFile: c.negoImportFile || null,
        negoImportAt: c.negoImportAt || null,
        aeAmountNego: c.aeAmountNego ?? null,
      });
      (c.variants || []).filter(v => v.retained).forEach((v, vi) => {
        rows.push({
          kind: 'variant',
          id: `${c.id}_${v.id}`,
          companyId: c.id,
          variantId: v.id,
          name: `${c.name} · ${v.label || `V${vi + 1}`}`,
          initialTotal: getVariantEffectiveTotal(c, v, 'initial'),
          negoTotal: getVariantEffectiveTotal(c, v, 'nego'),
          negoTotalBrut: Number(v.totalNego ?? v.total ?? 0),
          rabaisPct,
          negotiated: variantHasNego(v) || rabaisPct > 0,
          negoImportFile: v.negoImportFile || null,
          negoImportAt: v.negoImportAt || null,
          aeAmountNego: v.aeAmountNego ?? null,
        });
      });
    });

    const kept = rows.filter(r => r.initialTotal > 0 || r.negoTotal > 0);
    if (kept.length === 0) return null;

    // Notes prix des deux phases — toutes les offres concourent (bases +
    // variantes retenues), même méthodologie que le Récap.
    const N = Number(scoringConfig?.maxScore || 40);
    const mode = scoringConfig?.mode || 'f1';
    const refInitial = computePriceReference(kept.map(r => r.initialTotal));
    const refNego = computePriceReference(kept.map(r => r.negoTotal));
    kept.forEach(r => {
      r.delta = r.negoTotal - r.initialTotal;
      r.deltaPct = r.initialTotal > 0 ? (r.delta / r.initialTotal) * 100 : 0;
      r.scoreInitial = refInitial.Pmin > 0 ? scoreOffer(r.initialTotal, refInitial.Pmin, refInitial.Pmax, refInitial.Pmoy, N, mode) : 0;
      r.scoreNego = refNego.Pmin > 0 ? scoreOffer(r.negoTotal, refNego.Pmin, refNego.Pmax, refNego.Pmoy, N, mode) : 0;
    });

    return kept.sort((a, b) => a.negoTotal - b.negoTotal);
  }, [hasNegoOffers, negoActive, analysisStatsInitial, analysisStatsNego, analysisCompanies, scoringConfig]);

  // ─── État de complétion du RAO (alimente stepper + badges + checklist) ───
  const completion = useRaoCompletion({
    rao: project?.rao,
    consultation: rao.consultation,
    criteria: rao.criteria,
    analysisCompanies,
    companiesData: project?.rao?.companies || {},
    scoringConfig,
    negoEngaged,
  });

  // ─── Atterrissage intelligent ───────────────────────────────────────────
  // À l'ouverture d'un projet non vierge, se positionner sur la première étape
  // incomplète (au lieu de toujours « Dépouillement »). Projet vierge → on reste
  // sur « Dépouillement » qui affiche le panneau d'orientation.
  useEffect(() => {
    // Attendre les DEUX documents (analysis/data ET rao/data) : sinon completion.tabStates
    // est calculé sur un project.rao vide et l'atterrissage se verrouille sur la mauvaise étape.
    if (!analysisLoaded || !raoLoaded) return;
    if (!projectId) return;
    if (landedForRef.current === projectId) return;
    // Projet vierge : on ne verrouille pas encore (défaut « Dépouillement » +
    // panneau d'orientation) — on laisse la chance d'atterrir quand les offres
    // arriveront si le chargement Firestore précède la population des entreprises.
    if (analysisCompanies.length === 0) return;
    landedForRef.current = projectId;
    const order = negoEngaged
      ? ['consultation', 'depouillement', 'admin', 'technique', 'recap', 'depouillementNego', 'adminNego', 'techniqueNego', 'recapNego']
      : ['consultation', 'depouillement', 'admin', 'technique', 'recap'];
    const firstIncomplete = order.find(id => !completion.tabStates[id]?.done);
    if (firstIncomplete) setActiveTab(firstIncomplete);
  }, [analysisLoaded, raoLoaded, projectId, analysisCompanies.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selectedCompany avec la liste des entreprises
  useEffect(() => {
    if (companyNames.length > 0 && (!selectedCompany || !companyNames.includes(selectedCompany))) {
      setSelectedCompany(companyNames[0]);
    }
  }, [companyNames.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation « checklist → champ précis » : bascule d'onglet puis surbrillance
  // de l'ancre (l'élément peut ne pas être encore monté → flashAnchor gère les retries).
  const handleNavigateToField = useCallback((tabId, anchorId, companyName) => {
    if (companyName) setSelectedCompany(companyName);
    if (tabId) setActiveTab(tabId);
    setPreExportOpen(false);
    flashAnchor(anchorId, { delay: 250 });
  }, []);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { generateRaoPDF } = await import('../utils/pdfRaoGenerator');

      // masterBranding est déjà résolu par useBranding dans App.jsx —
      // pas besoin de fallback local (project.branding et localStorage sont
      // déjà fusionnés en amont avec la priorité correcte).
      await generateRaoPDF({
        project,
        consultation: rao.consultation,
        criteria: rao.criteria,
        rao: project?.rao || {},
        analysisCompanies,
        scores: rao.computeScores(),
        ranking,
        rankingInitial,
        rankingNego,
        branding: masterBranding,
        analysisStats: rao.raoAnalysisStats,
        analysisStatsInitial,
        chaptersData,
        clientQtyMaps,
        bpuRefMap,
        activeTrancheId: rao.raoTrancheId,
        tranches,
        raoTrancheName: rao.hasTranches
          ? (rao.raoTrancheId === 'global' ? 'Global (toutes tranches)' : (tranches.find(t => t.id === rao.raoTrancheId)?.name || rao.raoTrancheId))
          : null,
        analysisMode,
        scoringConfig,
        // Inclure les annexes A (formules) et B (références CCP) selon le choix utilisateur.
        includeAnnexes,
        // Phase de négociation : badge page de garde + adaptation de la recommandation.
        negotiationPhase,
        // Format papier du detail des prix unitaires : 'a4' | 'a3'.
        pricesPaperSize,
        // Comparatif avant/après négociation (montants + notes prix des deux phases).
        negoComparison,
        negoActive,
        // Nouvelles props pour la refonte complète du PDF
        optionChapters: rao.optionChapters,
        includedOptions: rao.includedOptions,
        adminPieces: rao.adminPieces,
        offerPieces: rao.offerPieces
      });
    } catch (e) {
      console.error('PDF RAO error:', e);
      toast.error('Erreur lors de la génération du PDF.');
    }
    finally { setIsExporting(false); }
  };

  // ─── Bouton d'étape du stepper (partagé par les deux groupes de phase) ───
  // Étapes 'apres' verrouillées tant que la négociation n'est pas engagée.
  const renderStepBtn = (step) => {
    const locked = step.phase === 'apres' && !negoEngaged;
    const state = completion.tabStates[step.id];
    const isActive = activeTab === step.id;
    const isDone = !locked && state?.done;
    const isOptional = state?.optional;
    const hasWarn = !locked && state?.items?.some(it => it.warn);
    // Priorité : verrouillé > actif > complété > alerte > optionnel neutre > à faire.
    const accent = locked ? 'text-slate-300'
      : isActive ? 'text-emerald-600'
      : isDone ? 'text-emerald-500'
      : hasWarn ? 'text-amber-500'
      : isOptional ? 'text-slate-300'
      : 'text-slate-500';
    return (
      <RibbonBtnLarge
        key={step.id}
        icon={isDone && !isOptional ? CheckIcon : step.icon}
        title={locked ? 'Étape verrouillée — engagez la négociation depuis le Récap (étape 5)' : undefined}
        label={
          <span className="flex flex-col items-center leading-none gap-0.5">
            <span>{step.num}. {step.label}</span>
            {!locked && state?.ratio && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${isOptional ? 'bg-slate-100 text-slate-500' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {state.ratio}
              </span>
            )}
          </span>
        }
        onClick={() => { if (!locked) setActiveTab(step.id); }}
        active={isActive}
        accent={accent}
        disabled={locked}
      />
    );
  };

  return (
    <div className={`flex flex-col h-full bg-[#f8fafc] overflow-hidden ${isMobile ? 'pb-16' : ''}`}>

      {/* Input JSON invisible pour import (utilisé par desktop et mobile) */}
      <input
        type="file"
        ref={jsonInputRef}
        accept=".json"
        onChange={(e) => { onImportJson?.(e); e.target.value = ''; }}
        className="hidden"
      />

      {/* ═══════ NAVIGATION : RIBBON (Desktop) ou COMPACT (Mobile) ═══════ */}
      {!isMobile ? (
        <RibbonContainer>
          <RibbonGroup label="Affaire">
            <RibbonBtnLarge
              icon={FileSignature}
              label="Fiche affaire"
              onClick={() => setDetailsOpen(true)}
              accent="text-purple-500"
            />
          </RibbonGroup>

          <RibbonGroup label="Avant négociation">
            {RAO_STEPS.filter(s => s.phase === 'avant').map(renderStepBtn)}
          </RibbonGroup>

          <RibbonGroup label="Après négociation">
            {RAO_STEPS.filter(s => s.phase === 'apres').map(renderStepBtn)}
          </RibbonGroup>

          <RibbonGroup label="Avancement">
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-w-[88px]">
              <div className={`text-lg font-black leading-none ${completion.overallProgress === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                {completion.overallProgress}<span className="text-xs font-normal text-slate-400 ml-0.5">%</span>
              </div>
              <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${completion.overallProgress}%` }} />
              </div>
            </div>
          </RibbonGroup>

          <RibbonSpacer />

          <RibbonGroup label="Sauvegarde">
            {/* Auto-save : indicateur passif, cliquable pour forcer l'enregistrement */}
            <button
              type="button"
              onClick={() => saveRaoToFirestore()}
              title="Enregistrement automatique — cliquer pour forcer la sauvegarde"
              className="rounded-xl hover:bg-gray-100 transition-colors"
            >
              <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} />
            </button>
          </RibbonGroup>

          <RibbonGroup label="Export" noBorder>
            <RibbonBtnLarge
              icon={isExporting ? Loader2 : FileDown}
              label="PDF RAO"
              onClick={() => setPreExportOpen(true)}
              disabled={isExporting}
              // Vert = prêt ; ambre = vérification recommandée (rien n'est interdit,
              // la checklist reste accessible et propose « Générer quand même »).
              accent={completion.isReadyForExport ? 'text-emerald-600' : 'text-amber-500'}
            />
            {(onExportJson || onImportJson) && (
              <div className="flex flex-col gap-[3px] justify-center">
                {onExportJson && (
                  <RibbonBtnSmall
                    icon={Download}
                    label="Export JSON"
                    onClick={onExportJson}
                    accent="text-amber-600"
                    disabled={(analysisCompanies || []).length === 0}
                  />
                )}
                {onImportJson && (
                  <RibbonBtnSmall
                    icon={FileUp}
                    label="Import JSON"
                    onClick={() => jsonInputRef.current?.click()}
                    accent="text-amber-600"
                  />
                )}
              </div>
            )}
          </RibbonGroup>
        </RibbonContainer>
      ) : (
        /* EN-TÊTE MOBILE COMPACT */
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-slate-200 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-emerald-500 transition-all" style={{ width: `${completion.overallProgress}%` }} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase">{completion.overallProgress}%</span>
            </div>
            <div className="relative mt-1">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="appearance-none bg-transparent border-none font-black text-xs uppercase tracking-widest text-emerald-600 pr-6 focus:ring-0 outline-none"
              >
                <optgroup label="Avant négociation">
                  {RAO_STEPS.filter(s => s.phase === 'avant').map(s => (
                    <option key={s.id} value={s.id}>{s.num}. {s.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Après négociation">
                  {RAO_STEPS.filter(s => s.phase === 'apres').map(s => (
                    <option key={s.id} value={s.id} disabled={!negoEngaged}>{s.num}. {s.label}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Indicateur de sauvegarde auto — cliquable pour forcer l'enregistrement */}
            <button
              onClick={() => saveRaoToFirestore()}
              title="Enregistrement automatique — cliquer pour forcer la sauvegarde"
              className="rounded-lg border border-slate-200 bg-slate-50"
            >
              <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} compact />
            </button>
            {onExportJson && (
               <button
                onClick={onExportJson}
                className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-600"
              >
                <Download size={18} />
              </button>
            )}
            {onImportJson && (
               <button
                onClick={() => jsonInputRef.current?.click()}
                className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-600"
              >
                <FileUp size={18} />
              </button>
            )}
            <button
              onClick={() => setPreExportOpen(true)}
              className="p-2 rounded-lg bg-emerald-600 text-white shadow-sm"
            >
              <FileDown size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Bandeau « Prochaine étape » — suggestion non bloquante sous le ribbon */}
      {!isMobile && (
        <NextStepHint
          steps={negoEngaged ? RAO_STEPS : RAO_STEPS.filter(s => s.phase === 'avant')}
          tabStates={completion.tabStates}
          activeTab={activeTab}
          onGoToTab={setActiveTab}
        />
      )}

      {/* Modale Dépouillement */}
      <DepouillementModal
        open={depouillementOpen}
        existingCompanies={analysisCompanies}
        existingConsultation={rao.consultation || {}}
        onConfirm={(payload) => {
          if (onApplyDepouillement) onApplyDepouillement(payload);
          setDepouillementOpen(false);
        }}
        onCancel={() => setDepouillementOpen(false)}
      />

      {/* Modale Dépouillement après négociation (PV des offres finales) */}
      <DepouillementNegoModal
        open={depouillementNegoOpen}
        companies={analysisCompanies}
        onConfirm={(entries) => {
          if (onApplyDepouillementNego) onApplyDepouillementNego(entries);
          setDepouillementNegoOpen(false);
        }}
        onCancel={() => setDepouillementNegoOpen(false)}
      />

      {/* Modale checklist pré-export PDF */}
      <PreExportChecklistModal
        open={preExportOpen}
        preExportChecks={completion.preExportChecks}
        isReadyForExport={completion.isReadyForExport}
        isExporting={isExporting}
        includeAnnexes={includeAnnexes}
        onToggleIncludeAnnexes={setIncludeAnnexes}
        negotiationPhase={negotiationPhase}
        onChangeNegotiationPhase={setNegotiationPhase}
        pricesPaperSize={pricesPaperSize}
        onChangePricesPaperSize={setPricesPaperSize}
        onCancel={() => setPreExportOpen(false)}
        onNavigate={(tabId) => { setActiveTab(tabId); setPreExportOpen(false); }}
        onNavigateToField={handleNavigateToField}
        onConfirm={async () => {
          setPreExportOpen(false);
          await handleExportPDF();
        }}
      />

      {/* Modale Fiche affaire (identique au module ESTIMA) */}
      <ProjectDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        project={project}
        onSave={handleSaveProjectDetails}
        branding={masterBranding}
      />

      <div className={`flex-1 relative ${FULLSCREEN_TABS.includes(activeTab) ? 'overflow-hidden' : `overflow-y-auto ${isMobile ? 'p-3' : 'p-6'}`}`}>
        <div className={FULLSCREEN_TABS.includes(activeTab) ? 'h-full' : ''}>
          {/* Étape 2 — Dépouillement des offres INITIALES (phase portée par le
              workflow : plus de bascule interne, toujours sur les offres initiales) */}
          {activeTab === 'depouillement' && (
            <TabDepouillement
              consultation={rao.consultation}
              analysisCompanies={analysisCompanies}
              onReopenDepouillement={() => setDepouillementOpen(true)}
              onUpdateAeAmount={onUpdateAeAmount}
              onUpdateVariantAeAmount={onUpdateVariantAeAmount}
              onImportOffer={onImportOffer}
              onImportPdfOffer={onImportPdfOffer}
              onImportVariant={onImportVariant}
              onGoToTechnique={(name) => { setSelectedCompany(name); setActiveTab('technique'); }}
              onGoToAdmin={(name) => { setSelectedCompany(name); setActiveTab('admin'); }}
              onGoToConsultation={() => setActiveTab('consultation')}
              tabStates={completion.tabStates}
              analysisStats={analysisStatsInitial || analysisStats}
              companiesData={project?.rao?.companies || {}}
              criteria={rao.criteria}
              negoActive={false}
            />
          )}
          {/* Étape 7 — Dépouillement APRÈS NÉGO (offres finales, PV, imports négociés) */}
          {activeTab === 'depouillementNego' && (
            <TabDepouillement
              consultation={rao.consultation}
              analysisCompanies={analysisCompanies}
              onUpdateAeAmount={onUpdateAeAmount}
              onUpdateVariantAeAmount={onUpdateVariantAeAmount}
              onImportVariant={onImportVariant}
              onGoToTechnique={(name) => { setSelectedCompany(name); setActiveTab('techniqueNego'); }}
              onGoToAdmin={(name) => { setSelectedCompany(name); setActiveTab('adminNego'); }}
              onGoToConsultation={() => setActiveTab('consultation')}
              tabStates={completion.tabStates}
              analysisStats={analysisStatsNego || analysisStats}
              companiesData={project?.rao?.companies || {}}
              criteria={rao.criteria}
              negoActive={true}
              negoRows={negoComparison}
              onOpenDepouillementNego={onApplyDepouillementNego ? () => setDepouillementNegoOpen(true) : null}
              onUpdateAeAmountNego={onUpdateAeAmountNego}
              onUpdateVariantAeAmountNego={onUpdateVariantAeAmountNego}
              onImportNegoOffer={onImportNegoOffer}
            />
          )}
          {activeTab === 'consultation' && (
            <TabConsultation consultation={rao.consultation} updateConsultation={rao.updateConsultation} criteria={rao.criteria} updateCriteria={rao.updateCriteria} addCriterion={rao.addCriterion} removeCriterion={rao.removeCriterion} addSubCriterion={rao.addSubCriterion} removeSubCriterion={rao.removeSubCriterion} updateSubCriterion={rao.updateSubCriterion} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} tranches={rao.tranches} raoTrancheId={rao.raoTrancheId} setRaoTrancheId={rao.setRaoTrancheId} dateRemise={project?.dateRemise || ''} timeRemise={project?.timeRemise || ''} onUpdateRemise={handleUpdateRemise} />
          )}
          {activeTab === 'admin' && (
            <TabAdministrative companyNames={companyNames} companiesData={project?.rao?.companies || {}} updateAdminPiece={rao.updateAdminPiece} updateAdminField={rao.updateAdminField} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} adminPieces={rao.adminPieces} offerPieces={rao.offerPieces} setAdminPieces={rao.setAdminPieces} setOfferPieces={rao.setOfferPieces} analysisCompanies={analysisCompanies} consultation={rao.consultation} onImportVariant={onImportVariant} onRemoveVariant={onRemoveVariant} onToggleVariantRetained={onToggleVariantRetained} onGoToDepouillement={() => setActiveTab('depouillement')} missing={completion.tabStates.admin?.missing || []} phase="initial" />
          )}
          {activeTab === 'adminNego' && (
            <TabAdministrative companyNames={companyNames} companiesData={project?.rao?.companies || {}} updateAdminPiece={rao.updateAdminPiece} updateAdminField={rao.updateAdminField} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} adminPieces={rao.adminPieces} offerPieces={rao.offerPieces} setAdminPieces={rao.setAdminPieces} setOfferPieces={rao.setOfferPieces} analysisCompanies={analysisCompanies} consultation={rao.consultation} onGoToDepouillement={() => setActiveTab('depouillement')} missing={completion.tabStates.adminNego?.missing || []} phase="nego" />
          )}
          {activeTab === 'technique' && (
            <TabTechnique companyNames={companyNames} companiesData={project?.rao?.companies || {}} criteria={rao.criteria} updateTechnical={rao.updateTechnical} analysisStats={rao.raoAnalysisStats} scoringConfig={scoringConfig} analysisCompanies={analysisCompanies} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} onUpdateVariantJustification={onUpdateVariantJustification} onGoToConsultation={() => setActiveTab('consultation')} onGoToDepouillement={() => setActiveTab('depouillement')} missing={completion.tabStates.technique?.missing || []} phase="initial" />
          )}
          {activeTab === 'techniqueNego' && (
            <TabTechnique companyNames={companyNames} companiesData={project?.rao?.companies || {}} criteria={rao.criteria} updateTechnical={(n, cid, f, v) => rao.updateTechnical(n, cid, f, v, 'nego')} analysisStats={analysisStatsNego || rao.raoAnalysisStats} scoringConfig={scoringConfig} analysisCompanies={analysisCompanies} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} onUpdateVariantJustification={onUpdateVariantJustification} onGoToConsultation={() => setActiveTab('consultation')} onGoToDepouillement={() => setActiveTab('depouillement')} missing={completion.tabStates.techniqueNego?.missing || []} phase="nego" />
          )}
          {activeTab === 'negociation' && (
            <TabNegociation
              companyNames={companyNames}
              companiesData={project?.rao?.companies || {}}
              updateNegotiation={rao.updateNegotiation}
              consultation={rao.consultation}
              selectedCompany={selectedCompany}
              onSelectCompany={setSelectedCompany}
              analysisCompanies={analysisCompanies}
              chaptersData={chaptersData}
              analysisStats={rao.raoAnalysisStats}
              bpuRefMap={bpuRefMap}
              branding={masterBranding}
              project={project}
              raoLetterConfig={rao.letterConfig}
              updateRaoLetterConfig={rao.updateLetterConfig}
              negoComparison={negoComparison}
              negoActive={negoActive}
              scoringConfig={scoringConfig}
              onUpdateNegoRabais={onUpdateNegoRabais}
              onImportNegoOffer={onImportNegoOffer}
              onSetNegoPhase={onSetNegoPhase}
              onGoToDepouillement={() => setActiveTab('depouillement')}
            />
          )}
          {activeTab === 'recap' && (
            <TabRecap criteria={rao.criteria} ranking={rankingInitial} companyNames={companyNames} onExportPDF={() => setPreExportOpen(true)} isExporting={isExporting} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} raoTrancheId={rao.raoTrancheId} tranches={rao.tranches} analysisCompanies={analysisCompanies} optionChapters={rao.optionChapters} includedOptions={rao.includedOptions} recommendation={rao.recommendation} updateRecommendation={rao.updateRecommendation} negoActive={false} phase="initial" isFinal={!negoEngaged} onEngageNego={!negoEngaged ? () => { rao.setNegoEngaged(true); setActiveTab('negociation'); } : null} onGoToFinalRecap={negoEngaged ? () => setActiveTab('recapNego') : null} />
          )}
          {activeTab === 'recapNego' && (
            <TabRecap criteria={rao.criteria} ranking={rankingNego || rankingInitial} companyNames={companyNames} onExportPDF={() => setPreExportOpen(true)} isExporting={isExporting} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} raoTrancheId={rao.raoTrancheId} tranches={rao.tranches} analysisCompanies={analysisCompanies} optionChapters={rao.optionChapters} includedOptions={rao.includedOptions} recommendation={rao.recommendation} updateRecommendation={rao.updateRecommendation} negoActive={true} phase="nego" isFinal={true} />
          )}
        </div>
      </div>
    </div>
  );
};

export default RaoView;
