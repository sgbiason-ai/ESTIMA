// src/views/PriceAnalysisView.jsx
import React, { useState } from 'react';
import usePriceAnalysis from '../hooks/usePriceAnalysis';
import AnalysisToolbar from '../components/analysis/AnalysisToolbar';
import AnalysisTable from '../components/analysis/AnalysisTable';
import RaoView from './RaoView';

// MAGIE : On importe le moteur de calcul du projet !
import { useProjectCalculations } from '../hooks/useProjectCalculations';

const PriceAnalysisView = ({ project, companyId, setProject, bpuConfig, clientPercent, masterBranding = null, bpu = [], updateBpuItem = null }) => {
  // --- ÉTATS ---
  const [activeMainTab, setActiveMainTab] = useState('analyse');
  const [activeTrancheId, setActiveTrancheId] = useState('global');
  const [analysisMode, setAnalysisMode] = useState('none'); // 'none', 'heatmap' ou 'oab'
  
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
    companyId
  );

  // --- EXPORTS ---
  const handleExportPDF = async () => {
    try {
      const module = await import('../utils/pdfAnalysisGenerator');
      module.generateAnalysisPDF({ 
        project: project, 
        companies: analysis.companies,
        chaptersData: analysis.chaptersData,
        stats: analysis.stats,
        scoringConfig: analysis.scoringConfig,
        bpuRefMap,
        activeTrancheId,
        tranches,
        analysisMode,
        branding: masterBranding,
      });
    } catch (error) { console.error("Erreur PDF", error); }
  };

  const handleExportExcel = async () => {
    try {
      const module = await import('../utils/excelAnalysisGenerator');
      module.generateAnalysisExcel({ 
        project: project,
        companies: analysis.companies,
        chaptersData: analysis.chaptersData,
        stats: analysis.stats,
        scoringConfig: analysis.scoringConfig,
        bpuRefMap,
        activeTrancheId,
        tranches,
        analysisMode,
        branding: masterBranding,
      });
    } catch (error) { console.error("Erreur Excel", error); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* ── ONGLETS PRINCIPAUX ── */}
      <div className="shrink-0 flex items-center gap-1 px-4 pt-3 bg-white border-b border-slate-100">
        {[
          { id: 'analyse', label: '📊 Analyse financière' },
          { id: 'rao',     label: "📋 Rapport d'analyse (RAO)" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMainTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeMainTab === tab.id
                ? 'text-emerald-700 border-emerald-500 bg-emerald-50'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeMainTab === 'rao' && (
        <RaoView
          project={project}
          setProject={setProject}
          analysisCompanies={analysis.companies || []}
          analysisStats={analysis.stats}
          scoringConfig={analysis.scoringConfig}
          masterBranding={masterBranding}
          chaptersData={analysis.chaptersData}
          bpuRefMap={bpuRefMap}
          activeTrancheId={activeTrancheId}
          tranches={tranches}
          analysisMode={analysisMode}
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
        onSaveToObservatory={analysis.handleSaveToObservatory}
        onUndoObservatory={analysis.handleUndoObservatory}
        canUndoObservatory={analysis.canUndoObservatory}
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
      />

      <div className="flex-1 overflow-auto p-4 relative">
        <AnalysisTable 
          {...analysis} 
          project={project}
          activeTrancheId={activeTrancheId}
          bpuConfig={bpuConfig} 
          analysisMode={analysisMode} 
        />
      </div>
      </>}
    </div>
  );
};

export default PriceAnalysisView;