// src/views/RaoView.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, CheckSquare, Brain, MessageSquare, BarChart2, AlertCircle,
  FileDown, Loader2, Users, Save, CheckCircle2
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as fireDb } from '../firebase';
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

import { RibbonGroup, RibbonBtnLarge } from '../components/common/RibbonParts';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

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
  analysisMode = 'standard'
}) => {
  const [activeTab, setActiveTab] = useState('consultation');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const rao = useRao(project, setProject, analysisCompanies, analysisStats, scoringConfig, tranches);

  // ─── Persistance Firestore dédiée : projects/{id}/rao/data ────────────
  const projectId = project?.id;

  // Chargement Firestore au montage (une seule fois)
  const loadedForRef = useRef(null);
  useEffect(() => {
    if (!projectId || !companyId) return;
    if (loadedForRef.current === projectId) return;
    loadedForRef.current = projectId;
    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'rao', 'data');
    getDoc(docRef).then(snap => {
      if (snap.exists() && snap.data().rao) {
        setProject(prev => ({ ...prev, rao: snap.data().rao }));
      }
    }).catch(e => console.error('[RAO] Erreur chargement:', e));
  }, [projectId, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde manuelle uniquement (pas d'auto-save)
  const saveRaoToFirestore = useCallback(() => {
    if (!projectId || !companyId) return;
    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'rao', 'data');
    const payload = { rao: project?.rao || {}, lastSaved: new Date().toISOString() };
    setDoc(docRef, payload)
      .then(() => { setLastSaved(new Date()); toast.success('Rapport RAO sauvegardé.'); })
      .catch(e => { console.error('[RAO] Erreur sauvegarde:', e); toast.error('Erreur de sauvegarde.'); });
  }, [projectId, companyId, project?.rao]);

  const ranking = rao.getRanking();
  const companyNames = analysisCompanies.map(c => c.name);

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

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="rao" />

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

          {/* Aide */}
          <div className="flex items-center px-3">
            <HelpButton onClick={() => setShowHelp(true)} variant="ribbon" />
          </div>
        </div>
      </header>

      <div className={`flex-1 relative ${activeTab === 'admin' || activeTab === 'technique' || activeTab === 'negociation' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
        <div className={activeTab === 'admin' || activeTab === 'technique' || activeTab === 'negociation' ? 'h-full' : ''}>
          {activeTab === 'consultation' && (
            <TabConsultation consultation={rao.consultation} updateConsultation={rao.updateConsultation} criteria={rao.criteria} updateCriteria={rao.updateCriteria} addCriterion={rao.addCriterion} removeCriterion={rao.removeCriterion} addSubCriterion={rao.addSubCriterion} removeSubCriterion={rao.removeSubCriterion} updateSubCriterion={rao.updateSubCriterion} scoringConfig={scoringConfig} hasTranches={rao.hasTranches} tranches={rao.tranches} raoTrancheId={rao.raoTrancheId} setRaoTrancheId={rao.setRaoTrancheId} />
          )}
          {activeTab === 'admin' && (
            <TabAdministrative companyNames={companyNames} companiesData={project?.rao?.companies || {}} updateAdminPiece={rao.updateAdminPiece} updateAdminField={rao.updateAdminField} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} adminPieces={rao.adminPieces} offerPieces={rao.offerPieces} setAdminPieces={rao.setAdminPieces} setOfferPieces={rao.setOfferPieces} />
          )}
          {activeTab === 'technique' && (
            <TabTechnique companyNames={companyNames} companiesData={project?.rao?.companies || {}} criteria={rao.criteria} updateTechnical={rao.updateTechnical} analysisStats={rao.raoAnalysisStats} scoringConfig={scoringConfig} analysisCompanies={analysisCompanies} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} />
          )}
          {activeTab === 'negociation' && (
            <TabNegociation
              companyNames={companyNames}
              companiesData={project?.rao?.companies || {}}
              updateNegotiation={rao.updateNegotiation}
              consultation={rao.consultation}
              selectedCompany={selectedCompany}
              onSelectCompany={setSelectedCompany}
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