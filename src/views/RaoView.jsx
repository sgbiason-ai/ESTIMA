// src/views/RaoView.jsx
import React, { useState } from 'react';
import {
  FileText, CheckSquare, Brain, MessageSquare, BarChart2, AlertCircle,
  FileDown, Loader2, Users
} from 'lucide-react';
import { useRao } from '../hooks/useRao';
import { toast } from '../utils/globalUI';

// Imports de l'UI et des Onglets
import TabConsultation from '../components/rao/tabs/TabConsultation';
import TabAdministrative from '../components/rao/tabs/TabAdministrative';
import TabTechnique from '../components/rao/tabs/TabTechnique';
import TabNegociation from '../components/rao/tabs/TabNegociation';
import TabRecap from '../components/rao/tabs/TabRecap';

const TABS = [
  { id: 'consultation', label: 'Consultation',   icon: FileText },
  { id: 'admin',        label: 'Administrative', icon: CheckSquare },
  { id: 'technique',    label: 'Technique',      icon: Brain },
  { id: 'negociation',  label: 'Négociation',    icon: MessageSquare },
  { id: 'recap',        label: 'Récapitulatif',  icon: BarChart2 },
];

/* ════════════════════════════════════════════════════════════════════
   RIBBON — Composants réutilisables (même style que ProjectToolbar)
   ════════════════════════════════════════════════════════════════════ */

const RibbonGroup = ({ label, children, noBorder }) => (
  <div className="flex flex-col h-full relative">
    <div className="flex items-center justify-center gap-1.5 px-4 flex-1 py-1">
      {children}
    </div>
    <div className="text-center pb-1 px-2">
      <span className="text-[10px] text-slate-400 font-normal tracking-wide select-none whitespace-nowrap leading-none">
        {label}
      </span>
    </div>
    {!noBorder && (
      <div className="absolute right-0 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent" />
    )}
  </div>
);

const RibbonBtnLarge = ({ icon: Icon, label, onClick, title, active, accent, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className={`
      group flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded min-w-[52px]
      transition-all duration-100
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default'}
      ${active
        ? 'bg-blue-50 border border-blue-200 shadow-sm'
        : 'border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] active:bg-[#b8cce0]'
      }
    `}
  >
    <div className={`transition-colors ${accent || 'text-slate-600'} ${!disabled && !active ? 'group-hover:text-slate-800' : ''}`}>
      <Icon size={22} strokeWidth={1.6} />
    </div>
    <span className={`text-[10.5px] leading-tight text-center font-normal transition-colors
      ${active ? 'text-blue-700 font-medium' : 'text-slate-600'}
      ${!disabled && !active ? 'group-hover:text-slate-800' : ''}
    `}>
      {label}
    </span>
  </button>
);

const RaoView = ({ 
  project, 
  setProject, 
  analysisCompanies = [], 
  analysisStats = null, 
  scoringConfig = null, 
  masterBranding = null,
  chaptersData = [],
  bpuRefMap = new Map(),
  activeTrancheId = 'global',
  tranches = [],
  analysisMode = 'standard'
}) => {
  const [activeTab, setActiveTab] = useState('consultation');
  const [isExporting, setIsExporting] = useState(false);

  const rao = useRao(project, setProject, analysisCompanies, analysisStats, scoringConfig, tranches);
  const ranking = rao.getRanking();
  const companyNames = analysisCompanies.map(c => c.name);

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
        scoringConfig
      });
    } catch (e) { 
      console.error('PDF RAO error:', e); 
      toast.error('Erreur lors de la génération du PDF.'); 
    }
    finally { setIsExporting(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">

      {/* ═══════ RIBBON RAO ═══════ */}
      <header className="shrink-0 font-[system-ui,'Segoe_UI',sans-serif] select-none z-10">

        {/* ── Barre titre ── */}
        <div className="flex items-center h-[30px] px-3 bg-white border-b border-slate-200">
          {/* Titre centré */}
          <div className="flex-1 flex items-center justify-center gap-2.5">
            <span className="text-[11.5px] font-semibold text-slate-700 tracking-wide">
              Rapport d'Analyse des Offres
            </span>
          </div>

          {/* Infos droite */}
          <div className="flex items-center gap-2 pr-2">
            {companyNames.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                <AlertCircle size={12} />
                Aucune entreprise
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                <Users size={12} className="text-slate-400" />
                {companyNames.length} entreprise{companyNames.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* ── Contenu du ribbon ── */}
        <div className="flex items-stretch bg-[#f3f3f3] border-b border-slate-200 min-h-[78px]">

          {/* Étapes */}
          <RibbonGroup label="Étapes">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const count = (tab.id === 'admin' || tab.id === 'technique' || tab.id === 'negociation') ? companyNames.length : null;
              return (
                <RibbonBtnLarge
                  key={tab.id}
                  icon={tab.icon}
                  label={
                    count > 0
                      ? <>{tab.label.length > 9 ? tab.label.slice(0, 7) + '.' : tab.label} <span className="text-[8px] opacity-60">({count})</span></>
                      : tab.label.length > 10 ? tab.label.slice(0, 8) + '.' : tab.label
                  }
                  onClick={() => setActiveTab(tab.id)}
                  active={isActive}
                  accent={isActive ? 'text-emerald-600' : 'text-slate-500'}
                  title={tab.label}
                />
              );
            })}
          </RibbonGroup>

          {/* Spacer */}
          <div className="flex-1 min-w-[16px]" />

          {/* Export */}
          <RibbonGroup label="Export" noBorder>
            <RibbonBtnLarge
              icon={isExporting ? Loader2 : FileDown}
              label="PDF RAO"
              onClick={handleExportPDF}
              disabled={isExporting}
              accent="text-red-500"
              title="Exporter le rapport en PDF"
            />
          </RibbonGroup>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 relative">
        <div>
          {activeTab === 'consultation' && (
            <TabConsultation consultation={rao.consultation} updateConsultation={rao.updateConsultation} criteria={rao.criteria} updateCriteria={rao.updateCriteria} addCriterion={rao.addCriterion} removeCriterion={rao.removeCriterion} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} tranches={rao.tranches} raoTrancheId={rao.raoTrancheId} setRaoTrancheId={rao.setRaoTrancheId} />
          )}
          {activeTab === 'admin' && (
            <TabAdministrative companyNames={companyNames} companiesData={project?.rao?.companies || {}} updateAdminPiece={rao.updateAdminPiece} updateAdminField={rao.updateAdminField} />
          )}
          {activeTab === 'technique' && (
            <TabTechnique companyNames={companyNames} companiesData={project?.rao?.companies || {}} criteria={rao.criteria} updateTechnical={rao.updateTechnical} analysisStats={rao.raoAnalysisStats} scoringConfig={scoringConfig} analysisCompanies={analysisCompanies} />
          )}
          {activeTab === 'negociation' && (
            <TabNegociation 
              companyNames={companyNames} 
              companiesData={project?.rao?.companies || {}} 
              updateNegotiation={rao.updateNegotiation}
              consultation={rao.consultation} /* <--- LA LIGNE MAGIQUE EST ICI */
            />
          )}
          {activeTab === 'recap' && (
            <TabRecap criteria={rao.criteria} ranking={ranking} companyNames={companyNames} onExportPDF={handleExportPDF} isExporting={isExporting} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} raoTrancheId={rao.raoTrancheId} tranches={rao.tranches} />
          )}
        </div>
      </div>
    </div>
  );
};

export default RaoView;