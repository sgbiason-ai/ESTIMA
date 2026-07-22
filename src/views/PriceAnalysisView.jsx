// src/views/PriceAnalysisView.jsx
import React, { useState } from 'react';
import usePriceAnalysis from '../hooks/usePriceAnalysis';
import AnalysisToolbar from '../components/analysis/AnalysisToolbar';
import AnalysisTable from '../components/analysis/AnalysisTable';
import RaoView from './RaoView';
import OcrProgressModal from '../components/rao/OcrProgressModal';
import ImportReportModal from '../components/rao/ImportReportModal';

// MAGIE : On importe le moteur de calcul du projet !
import { useProjectCalculations } from '../hooks/useProjectCalculations';
import { getEffectiveOffers } from '../utils/analysisCompute';

const PriceAnalysisView = ({
  project, companyId, setProject, handleSaveProject = null,
  bpuConfig, clientPercent, masterBranding = null,
  bpu = [], updateBpuItem = null,
  // Contrôlés en option par le parent (RaoAnalysisView) pour que le bouton AIDE
  // en haut à droite affiche la bonne aide selon le sous-onglet actif.
  activeMainTab: activeMainTabProp,
  setActiveMainTab: setActiveMainTabProp,
}) => {
  // --- ÉTATS ---
  // Fallback local si le parent ne contrôle pas activeMainTab
  const [localActiveMainTab, setLocalActiveMainTab] = useState('rao');
  const activeMainTab = activeMainTabProp ?? localActiveMainTab;
  const setActiveMainTab = setActiveMainTabProp ?? setLocalActiveMainTab;
  const [activeTrancheId, setActiveTrancheId] = useState('global');
  const [analysisMode, setAnalysisMode] = useState('none'); // 'none', 'heatmap' ou 'oab'
  // Note : HelpPanel local supprimé — l'aide est gérée par RaoAnalysisView (bouton AIDE en haut à droite)

  const tranches = project?.tranches || [];
  const hasTranches = tranches.length > 0;

  // --- MOTEUR DE CALCUL CENTRALISÉ ---
  // On utilise EXACTEMENT le même moteur que ProjectView pour avoir les quantités du mode rendu.
  // Il résout les formules, applique le % client et gère les tranches à la perfection.
  const { clientQtyMaps, refMap: bpuRefMap } = useProjectCalculations({
    project,
    clientPercent,
    hasTranches,
    tranches,
    activeTrancheId,
    currentMode: 'client', // On force le calcul en "Mode Rendu" (Client)
    bpuConfig
  });

  // --- HOOK D'ANALYSE FINANCIÈRE ---
  // On lui passe la carte des quantités calculées (clientQtyMaps)
  const analysis = usePriceAnalysis(
    project,
    bpuConfig,
    activeTrancheId,
    clientQtyMaps,
    companyId,
    setProject
  );

  // --- EXPORTS ---
  // En phase « après négo », les générateurs lisent c.offers : on leur passe des
  // entreprises dont les offres sont déjà résolues (initial fusionné + négocié).
  const exportCompanies = () => analysis.negoActive
    ? (analysis.companies || []).map(c => ({ ...c, offers: getEffectiveOffers(c, 'nego') }))
    : analysis.companies;

  const handleExportPDF = async () => {
    try {
      const module = await import('../utils/pdfAnalysisGenerator');
      module.generateAnalysisPDF({
        project: project,
        companies: exportCompanies(),
        chaptersData: analysis.chaptersData,
        stats: analysis.stats,
        scoringConfig: analysis.scoringConfig,
        bpuRefMap,
        activeTrancheId,
        tranches,
        analysisMode,
        branding: masterBranding,
        negoActive: analysis.negoActive,
      });
    } catch (error) { console.error("Erreur PDF", error); }
  };

  const handleExportExcel = async () => {
    try {
      const module = await import('../utils/excelAnalysisGenerator');
      module.generateAnalysisExcel({
        project: project,
        companies: exportCompanies(),
        chaptersData: analysis.chaptersData,
        stats: analysis.stats,
        scoringConfig: analysis.scoringConfig,
        bpuRefMap,
        activeTrancheId,
        tranches,
        analysisMode,
        branding: masterBranding,
        clientQtyMaps,
        negoActive: analysis.negoActive,
      });
    } catch (error) { console.error("Erreur Excel", error); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">

      {/* Modale globale de progression OCR (PDF scannés) */}
      <OcrProgressModal open={!!analysis.ocrProgress} progress={analysis.ocrProgress} />

      {/* Rapport d'import : lignes non rattachées + articles restés sans prix */}
      <ImportReportModal report={analysis.importReport} onClose={analysis.clearImportReport} />

      {/* ── ONGLETS PRINCIPAUX ── */}
      {/* AIDE retirée ici : le bouton AIDE en haut à droite (RaoAnalysisView) sert d'unique point d'entrée à l'aide. */}
      <div className="shrink-0 flex items-center gap-1 px-4 pt-3 bg-white border-b border-slate-100">
        {/* Ordre : RAO (1) → Analyse financière (2)
            Les variantes sont désormais intégrées directement dans le tableau d'analyse. */}
        {[
          { id: 'rao',     label: 'Rapport RAO' },
          { id: 'analyse', label: 'Tableau des prix' },
        ].map(tab => {
          const isActive = activeMainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                isActive
                  ? 'text-emerald-700 border-emerald-500 bg-emerald-50'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Bandeau de contexte commun aux deux onglets (marché / tranche / phase) ──
          Rend visible que « Rapport RAO » et « Tableau des prix » portent sur le même dossier
          et matérialise les commutateurs globaux (tranche, phase de négociation). */}
      <div className="shrink-0 flex items-center flex-wrap gap-2 px-4 py-2 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        {project?.name && (
          <span className="text-xs font-bold text-slate-700 truncate max-w-xs" title={project.name}>
            {project.name}
          </span>
        )}
        {hasTranches && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-100">
            {activeTrancheId === 'global'
              ? 'Global — toutes tranches'
              : (tranches.find(t => t.id === activeTrancheId)?.name || activeTrancheId)}
          </span>
        )}
        {(analysis.hasNego || analysis.negoActive) && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
            analysis.negoActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            {analysis.negoActive ? 'Notation : après négociation' : 'Notation : offres initiales'}
          </span>
        )}
      </div>

      {activeMainTab === 'rao' && (
        <RaoView
          project={project}
          setProject={setProject}
          companyId={companyId}
          analysisCompanies={analysis.companies || []}
          analysisLoaded={analysis.firestoreLoaded}
          analysisStats={analysis.stats}
          analysisStatsInitial={analysis.statsInitial}
          analysisStatsNego={analysis.statsNego}
          negoActive={analysis.negoActive}
          hasNegoOffers={analysis.hasNego}
          scoringConfig={analysis.scoringConfig}
          masterBranding={masterBranding}
          chaptersData={analysis.chaptersData}
          clientQtyMaps={clientQtyMaps}
          bpuRefMap={bpuRefMap}
          activeTrancheId={activeTrancheId}
          tranches={tranches}
          analysisMode={analysisMode}
          onImportVariant={analysis.handleImportVariant}
          onRemoveVariant={analysis.removeVariant}
          onToggleVariantRetained={analysis.toggleVariantRetained}
          onUpdateVariantJustification={analysis.updateVariantJustification}
          onApplyDepouillement={analysis.applyDepouillement}
          onUpdateAeAmount={analysis.updateCompanyAeAmount}
          onUpdateVariantAeAmount={analysis.updateVariantAeAmount}
          onUpdateNegoRabais={analysis.updateCompanyNegoRabais}
          onApplyDepouillementNego={analysis.applyDepouillementNego}
          onUpdateAeAmountNego={analysis.updateCompanyAeAmountNego}
          onUpdateVariantAeAmountNego={analysis.updateVariantAeAmountNego}
          onSetNegoPhase={(active) =>
            analysis.setScoringConfig(prev => ({ ...prev, basis: active ? 'nego' : 'initial' }))
          }
          onImportOffer={(companyName, file) =>
            analysis.handleImportExcel({ target: { files: [file], value: null } }, companyName)
          }
          onImportPdfOffer={(companyName, file) =>
            analysis.handleImportPdfOffer(file, companyName)
          }
          onImportNegoOffer={(row, file) => {
            // row.kind === 'variant' → offre négociée d'une variante existante (offersNego propre à la variante)
            // row.kind === 'base'    → offre négociée de l'entreprise (offersNego de la base)
            if (row.kind === 'variant') {
              return analysis.handleImportVariant(row.companyId, file, {}, { toNego: true, variantId: row.variantId });
            }
            return /\.pdf$/i.test(file.name)
              ? analysis.handleImportPdfOffer(file, row.name, { toNego: true })
              : analysis.handleImportExcel({ target: { files: [file], value: null } }, row.name, { toNego: true });
          }}
          handleSaveProject={handleSaveProject}
          onExportJson={analysis.handleExportJson}
          onImportJson={analysis.handleImportJson}
        />
      )}

      {activeMainTab === 'analyse' && <>
      <AnalysisToolbar
        {...analysis}
        activeTrancheId={activeTrancheId}
        setActiveTrancheId={setActiveTrancheId}
        tranches={tranches}
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onAddManualCompany={analysis.handleAddManualCompany}
        onImportOffer={analysis.handleImportExcel}
        onClearAll={analysis.handleClearAll}
        lastSaved={analysis.lastSaved}
        onPushAveragesToBpu={() => analysis.handlePushAveragesToBpu(bpu, updateBpuItem)}
        averagesHorsOABCount={Object.keys(analysis.averagesHorsOAB || {}).length}
        onManualSave={analysis.handleManualSave}
        companiesCount={analysis.companies?.length || 0}
        onExportJson={analysis.handleExportJson}
        onImportJson={analysis.handleImportJson}
        negoActive={analysis.negoActive}
        hasNego={analysis.hasNego}
        onClearNego={analysis.handleClearNego}
      />

      <div className="flex-1 overflow-auto p-4 relative">
        <AnalysisTable
          {...analysis}
          project={project}
          activeTrancheId={activeTrancheId}
          analysisMode={analysisMode}
          refMap={bpuRefMap}
        />
      </div>
      </>}
    </div>
  );
};

export default PriceAnalysisView;