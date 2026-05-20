// src/views/RaoView.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileDown, Loader2, Users, Save, CheckCircle2,
  ScrollText, FileSignature
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as fireDb } from '../firebase';
import { useRao } from '../hooks/useRao';
import { useRaoCompletion } from '../hooks/useRaoCompletion';
import { toast } from '../utils/globalUI';

// Imports de l'UI et des Onglets
import TabConsultation from '../components/rao/tabs/TabConsultation';
import TabAdministrative from '../components/rao/tabs/TabAdministrative';
import TabTechnique from '../components/rao/tabs/TabTechnique';
import TabNegociation from '../components/rao/tabs/TabNegociation';
import TabRecap from '../components/rao/tabs/TabRecap';
import TabDepouillement from '../components/rao/tabs/TabDepouillement';
import DepouillementModal from '../components/rao/DepouillementModal';
import ProjectDetailsModal from '../components/modals/ProjectDetailsModal';
// RaoStepper retiré : le stepper est désormais intégré au RibbonContainer (style Office)
import PreExportChecklistModal from '../components/rao/PreExportChecklistModal';

// La navigation entre onglets est désormais assurée par RaoStepper —
// les boutons d'onglets du ribbon ont été supprimés pour gagner en hauteur.

// HelpPanel/HelpButton supprimés ici : l'aide est centralisée dans RaoAnalysisView
// (bouton AIDE en haut à droite, contextuel selon le sous-onglet actif).
import { RibbonContainer, RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonSpacer } from '../components/common/RibbonParts';
import { FileText, ScrollText as ScrollIcon, CheckSquare, Brain, MessageSquare, BarChart2, CheckCircle2 as CheckIcon, Download, FileUp } from 'lucide-react';

const RAO_STEPS = [
  { id: 'consultation',  label: 'Consultation',   icon: FileText },
  { id: 'depouillement', label: 'Dépouillement',  icon: ScrollIcon },
  { id: 'admin',         label: 'Administratif',  icon: CheckSquare },
  { id: 'technique',     label: 'Technique',      icon: Brain },
  { id: 'negociation',   label: 'Négociation',    icon: MessageSquare, optional: true },
  { id: 'recap',         label: 'Récap',          icon: BarChart2 },
];

const RaoView = ({
  project,
  setProject,
  companyId,
  analysisCompanies = [],
  analysisStats = null,
  scoringConfig = null,
  masterBranding = null,
  chaptersData = [],
  bpuRefMap = new Map(),
  activeTrancheId = 'global',
  tranches = [],
  analysisMode = 'standard',
  onImportVariant = null,
  onRemoveVariant = null,
  onToggleVariantRetained = null,
  onUpdateVariantJustification = null,
  onApplyDepouillement = null,
  onImportOffer = null,
  onImportPdfOffer = null,
  handleSaveProject = null,
  onExportJson = null,
  onImportJson = null,
}) => {
  const [activeTab, setActiveTab] = useState('depouillement');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [preExportOpen, setPreExportOpen] = useState(false);
  // showHelp / setShowHelp supprimés : l'aide est gérée par RaoAnalysisView
  // État de la modale Dépouillement
  const [depouillementOpen, setDepouillementOpen] = useState(false);
  // Trace si la modale a déjà été présentée pour éviter la réouverture en boucle
  const autoOpenedRef = useRef(false);
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

  const rao = useRao(project, setProject, analysisCompanies, analysisStats, scoringConfig, tranches);

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
    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'rao', 'data');
    getDoc(docRef).then(snap => {
      if (snap.exists() && snap.data().rao) {
        skipNextAutoSaveRef.current = true; // évite de re-sauver les données qu'on vient de charger
        setProject(prev => ({ ...prev, rao: snap.data().rao }));
      }
    }).catch(e => console.error('[RAO] Erreur chargement:', e));
  }, [projectId, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde RAO dans Firestore (utilisée par auto-save + bouton manuel)
  const saveRaoToFirestore = useCallback((silent = false) => {
    if (!projectId || !companyId) return Promise.resolve();
    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'rao', 'data');
    const payload = { rao: project?.rao || {}, lastSaved: new Date().toISOString() };
    return setDoc(docRef, payload)
      .then(() => {
        setLastSaved(new Date());
        if (!silent) toast.success('Rapport RAO sauvegardé.');
      })
      .catch(e => {
        console.error('[RAO] Erreur sauvegarde:', e);
        if (!silent) toast.error('Erreur de sauvegarde.');
      });
  }, [projectId, companyId, project?.rao]);

  // ─── AUTO-SAVE — déclenché 1.5s après toute modification de project.rao ──
  // Couvre : auto-flag irregulière à l'import, dépouillement, pièces admin/offre
  // réordonnées par drag&drop, critères, technique, négociation.
  const raoRef = useRef(project?.rao);
  useEffect(() => { raoRef.current = project?.rao; }, [project?.rao]);

  useEffect(() => {
    if (!projectId || !companyId) return;
    if (!project?.rao) return;
    // Skipper l'auto-save juste après chargement Firestore
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    const handle = setTimeout(() => {
      saveRaoToFirestore(true); // silent : pas de toast pour l'auto-save
    }, 1500);
    return () => clearTimeout(handle);
  }, [project?.rao, projectId, companyId, saveRaoToFirestore]);

  const ranking = rao.getRanking();
  const companyNames = analysisCompanies.map(c => c.name);

  // ─── État de complétion du RAO (alimente stepper + badges + checklist) ───
  const completion = useRaoCompletion({
    rao: project?.rao,
    consultation: rao.consultation,
    criteria: rao.criteria,
    analysisCompanies,
    companiesData: project?.rao?.companies || {},
    scoringConfig,
  });

  // Auto-ouverture de la modale Dépouillement si aucune entreprise saisie
  // (une seule fois par session, ne se réouvre pas après fermeture)
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!onApplyDepouillement) return;
    if (analysisCompanies.length === 0) {
      autoOpenedRef.current = true;
      setDepouillementOpen(true);
    } else {
      autoOpenedRef.current = true; // déjà des entreprises → ne pas auto-ouvrir plus tard
    }
  }, [analysisCompanies.length, onApplyDepouillement]);

  // Sync selectedCompany avec la liste des entreprises
  useEffect(() => {
    if (companyNames.length > 0 && (!selectedCompany || !companyNames.includes(selectedCompany))) {
      setSelectedCompany(companyNames[0]);
    }
  }, [companyNames.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

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
        branding: masterBranding,
        analysisStats: rao.raoAnalysisStats,
        chaptersData,
        bpuRefMap,
        activeTrancheId: rao.raoTrancheId,
        tranches,
        raoTrancheName: rao.hasTranches
          ? (rao.raoTrancheId === 'global' ? 'Global (toutes tranches)' : (tranches.find(t => t.id === rao.raoTrancheId)?.name || rao.raoTrancheId))
          : null,
        analysisMode,
        scoringConfig,
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

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">

      {/* ═══════ RIBBON RAO — style Office (cohérent avec les autres modules) ═══════ */}
      <RibbonContainer>
        {/* Groupe Étapes — chaque step est un RibbonBtnLarge avec son état */}
        <RibbonGroup label="Étapes">
          {RAO_STEPS.map(step => {
            const state = completion.tabStates[step.id];
            const ratio = state?.ratio;
            const isDone = state?.done;
            const isOptional = state?.optional;
            const hasWarn = state?.items?.some(it => it.warn);
            // accent : ordre = optional > active > done > warn
            const accent = isOptional
              ? 'text-slate-300'
              : activeTab === step.id
                ? 'text-emerald-600'
                : isDone
                  ? 'text-emerald-500'
                  : hasWarn
                    ? 'text-amber-500'
                    : 'text-slate-500';
            return (
              <RibbonBtnLarge
                key={step.id}
                icon={isDone && !isOptional ? CheckIcon : step.icon}
                label={
                  <span className="flex flex-col items-center leading-none gap-0.5">
                    <span>{step.label}</span>
                    {ratio && (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${isOptional ? 'bg-slate-100 text-slate-500' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ratio}
                      </span>
                    )}
                  </span>
                }
                onClick={() => setActiveTab(step.id)}
                active={activeTab === step.id}
                accent={accent}
                title={`${step.label} — ${isDone ? 'Complet' : hasWarn ? 'À compléter' : isOptional ? 'Optionnel' : 'Vide'}`}
              />
            );
          })}
        </RibbonGroup>

        {/* Groupe Fiche affaire */}
        <RibbonGroup label="Affaire">
          <RibbonBtnLarge
            icon={FileSignature}
            label="Fiche affaire"
            onClick={() => setDetailsOpen(true)}
            accent="text-purple-500"
            title="Éditer les informations du projet (client, MOE, lieu, dates…)"
          />
        </RibbonGroup>

        {/* Avancement global */}
        <RibbonGroup label="Avancement">
          <div className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-w-[88px]">
            <div className={`text-lg font-black leading-none ${completion.overallProgress === 100 ? 'text-emerald-600' : completion.overallProgress >= 50 ? 'text-amber-600' : 'text-slate-600'}`}>
              {completion.overallProgress}<span className="text-xs font-normal text-slate-400 ml-0.5">%</span>
            </div>
            <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${completion.overallProgress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`}
                style={{ width: `${completion.overallProgress}%` }}
              />
            </div>
            {completion.overallProgress === 100 && (
              <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-700 leading-none">
                <CheckCircle2 size={9} strokeWidth={3} /> PRÊT
              </span>
            )}
          </div>
        </RibbonGroup>

        {/* Indicateur entreprises */}
        <RibbonGroup label="Entreprises">
          <div className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-w-[60px]">
            <Users size={20} strokeWidth={1.6} className={companyNames.length === 0 ? 'text-amber-500' : 'text-slate-500'} />
            <div className={`text-base font-black leading-none ${companyNames.length === 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {companyNames.length}
            </div>
          </div>
        </RibbonGroup>

        <RibbonSpacer />

        {/* Sauvegarde */}
        <RibbonGroup label="Sauvegarde">
          <RibbonBtnLarge
            icon={lastSaved ? CheckCircle2 : Save}
            label={lastSaved ? 'Sauvegardé' : 'Sauvegarder'}
            onClick={saveRaoToFirestore}
            accent={lastSaved ? 'text-emerald-500' : 'text-blue-500'}
            title="Sauvegarder le rapport dans Firestore"
          />
        </RibbonGroup>

        {/* Export — PDF RAO + Export/Import JSON (même groupe, comme dans Analyse financière) */}
        <RibbonGroup label="Export" noBorder>
          <RibbonBtnLarge
            icon={isExporting ? Loader2 : FileDown}
            label="PDF RAO"
            onClick={() => setPreExportOpen(true)}
            disabled={isExporting}
            accent={completion.isReadyForExport ? 'text-emerald-600' : 'text-red-500'}
            title={completion.isReadyForExport ? 'Exporter le rapport (toutes sections complètes)' : 'Vérifier la complétude avant export'}
          />
          {(onExportJson || onImportJson) && (
            <div className="flex flex-col gap-[3px] justify-center">
              {onExportJson && (
                <RibbonBtnSmall
                  icon={Download}
                  label="Export JSON"
                  onClick={onExportJson}
                  accent="text-amber-600"
                  title="Exporter l'analyse en JSON (backup)"
                  disabled={(analysisCompanies || []).length === 0}
                />
              )}
              {onImportJson && (
                <>
                  <RibbonBtnSmall
                    icon={FileUp}
                    label="Import JSON"
                    onClick={() => jsonInputRef.current?.click()}
                    accent="text-amber-600"
                    title="Restaurer une analyse depuis un fichier JSON"
                  />
                  <input
                    type="file"
                    ref={jsonInputRef}
                    accept=".json"
                    onChange={(e) => { onImportJson(e); e.target.value = ''; }}
                    className="hidden"
                  />
                </>
              )}
            </div>
          )}
        </RibbonGroup>
      </RibbonContainer>

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

      {/* Modale checklist pré-export PDF */}
      <PreExportChecklistModal
        open={preExportOpen}
        preExportChecks={completion.preExportChecks}
        isReadyForExport={completion.isReadyForExport}
        isExporting={isExporting}
        onCancel={() => setPreExportOpen(false)}
        onNavigate={(tabId) => setActiveTab(tabId)}
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

      <div className={`flex-1 relative ${activeTab === 'admin' || activeTab === 'technique' || activeTab === 'negociation' || activeTab === 'depouillement' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
        <div className={activeTab === 'admin' || activeTab === 'technique' || activeTab === 'negociation' || activeTab === 'depouillement' ? 'h-full' : ''}>
          {activeTab === 'depouillement' && (
            <TabDepouillement
              consultation={rao.consultation}
              analysisCompanies={analysisCompanies}
              onReopenDepouillement={() => setDepouillementOpen(true)}
              onImportOffer={onImportOffer}
              onImportPdfOffer={onImportPdfOffer}
              onImportVariant={onImportVariant}
              onGoToTechnique={(name) => { setSelectedCompany(name); setActiveTab('technique'); }}
              onGoToAdmin={(name) => { setSelectedCompany(name); setActiveTab('admin'); }}
              companiesData={project?.rao?.companies || {}}
              criteria={rao.criteria}
            />
          )}
          {activeTab === 'consultation' && (
            <TabConsultation consultation={rao.consultation} updateConsultation={rao.updateConsultation} criteria={rao.criteria} updateCriteria={rao.updateCriteria} addCriterion={rao.addCriterion} removeCriterion={rao.removeCriterion} addSubCriterion={rao.addSubCriterion} removeSubCriterion={rao.removeSubCriterion} updateSubCriterion={rao.updateSubCriterion} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} tranches={rao.tranches} raoTrancheId={rao.raoTrancheId} setRaoTrancheId={rao.setRaoTrancheId} />
          )}
          {activeTab === 'admin' && (
            <TabAdministrative companyNames={companyNames} companiesData={project?.rao?.companies || {}} updateAdminPiece={rao.updateAdminPiece} updateAdminField={rao.updateAdminField} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} adminPieces={rao.adminPieces} offerPieces={rao.offerPieces} setAdminPieces={rao.setAdminPieces} setOfferPieces={rao.setOfferPieces} analysisCompanies={analysisCompanies} consultation={rao.consultation} onImportVariant={onImportVariant} onRemoveVariant={onRemoveVariant} onToggleVariantRetained={onToggleVariantRetained} missing={completion.tabStates.admin?.missing || []} />
          )}
          {activeTab === 'technique' && (
            <TabTechnique companyNames={companyNames} companiesData={project?.rao?.companies || {}} criteria={rao.criteria} updateTechnical={rao.updateTechnical} analysisStats={rao.raoAnalysisStats} scoringConfig={scoringConfig} analysisCompanies={analysisCompanies} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} onUpdateVariantJustification={onUpdateVariantJustification} missing={completion.tabStates.technique?.missing || []} />
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
            />
          )}
          {activeTab === 'recap' && (
            <TabRecap criteria={rao.criteria} ranking={ranking} companyNames={companyNames} onExportPDF={handleExportPDF} isExporting={isExporting} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} raoTrancheId={rao.raoTrancheId} tranches={rao.tranches} analysisCompanies={analysisCompanies} optionChapters={rao.optionChapters} includedOptions={rao.includedOptions} />
          )}
        </div>
      </div>
    </div>
  );
};

export default RaoView;