import React, { useState } from 'react';
import {
  PanelLeft, Receipt, HardHat, UserCheck, ArrowLeftRight,
  FileSpreadsheet, FileText, Calculator, Plus, Loader2,
  CheckCircle2, CloudOff, FileSignature, Bookmark, ListOrdered, Hash,
  FolderOpen, Save, Upload, Eye, Pencil, PlusCircle,
  BarChart3, Download, Info, Table2, FileOutput,
  Cloud, PanelLeftOpen, FileDown, ShieldCheck, ClipboardCheck, Undo2, ScanSearch, HelpCircle, FilePlus
} from 'lucide-react';

import { RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonContainer, RibbonSpacer } from './common/RibbonParts';
import MiniPhaseStepper from './project/MiniPhaseStepper';

/* ════════════════════════════════════════════════════════════════════
   OFFICE RIBBON — Composant principal
   ════════════════════════════════════════════════════════════════════ */

const ProjectToolbar = ({
  project,
  saveStatus,
  onSaveProject,
  isReadOnly,
  showBpu,
  setShowBpu,
  currentMode,
  setViewMode,
  showComparison,
  setShowComparison,
  onExport,
  onOpenCalculation,
  onOpenDetails,
  onAddChapter,
  onAddFreeItem,
  bpuConfig,
  setBpuConfig,
  onSaveAffaire,
  onOpenAffaire,
  onNewProject,
  onOpenCloudProject,
  onOpenPriceAudit,
  onOpenPriceCheck,
  priceCheckCount = 0,
  onOpenBpuAudit,
  bpuAuditActive = false,
  onUndo,
  canUndo = false,
  archives = [],
  onOpenGed,
  onShowHelp,
}) => {
  const [activeTab, setActiveTab] = useState('accueil');

  const isAutoNumbering = bpuConfig?.numberingMode !== 'manual';

  const toggleNumberingMode = () => {
    if (typeof setBpuConfig !== 'function') return;
    setBpuConfig(prev => ({
      ...(prev || {}),
      numberingMode: isAutoNumbering ? 'manual' : 'auto'
    }));
  };

  const tabs = [
    { id: 'accueil', label: 'Accueil' },
  ];

  // ── Indicateur de sauvegarde ──
  const SaveIndicator = () => {
    if (isReadOnly) return null;
    const configs = {
      saving:  { icon: Loader2, text: 'Enregistrement...', cls: 'text-blue-500', spin: true },
      saved:   { icon: CheckCircle2, text: 'Enregistr\u00e9', cls: 'text-emerald-500' },
      waiting: { icon: null, text: 'Non enregistr\u00e9', cls: 'text-amber-500', dot: true },
      error:   { icon: CloudOff, text: 'Erreur', cls: 'text-red-500', click: onSaveProject },
    };
    const cfg = configs[saveStatus];
    if (!cfg) return null;
    return (
      <div className={`flex items-center gap-1 text-[10px] font-normal ${cfg.cls} ${cfg.click ? 'cursor-pointer hover:underline' : ''}`} onClick={cfg.click}>
        {cfg.dot && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {cfg.icon && <cfg.icon size={11} className={cfg.spin ? 'animate-spin' : ''} />}
        <span>{cfg.text}</span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-20 font-[system-ui,'Segoe_UI',sans-serif] select-none">

      {/* ═══════ BARRE D'ONGLETS ═══════ */}
      <div className="flex items-center h-[30px] px-1 bg-white border-b border-slate-200">
        {/* Onglets à gauche */}
        <div className="flex items-end h-full">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-5 pb-0 pt-1.5 text-[11.5px] font-normal transition-colors rounded-t
                  ${isActive
                    ? 'text-slate-700 bg-[#f3f3f3] border border-slate-200 border-b-[#f3f3f3] -mb-px z-10'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
                  }
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Nom + mini-stepper phases (cliquable → GED) centré */}
        <div className="flex-1 flex items-center justify-center gap-2.5">
          <span className="text-[11.5px] font-semibold text-slate-700 tracking-wide truncate max-w-[300px]">
            {project?.name || 'Projet sans nom'}
          </span>
          <MiniPhaseStepper project={project} archives={archives} onClick={onOpenGed} />
        </div>

        {/* Indicateur de sauvegarde + Aide à droite */}
        <div className="flex items-center gap-1 pr-2">
          <SaveIndicator />
          {onShowHelp && (
            <button
              onClick={onShowHelp}
              title="Aide du module Estimation"
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <HelpCircle size={15} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* ═══════ CONTENU DU RIBBON (adaptatif : compact puis 2 lignes) ═══════ */}
      <RibbonContainer>

        {/* ── Tab Accueil ── */}
        {activeTab === 'accueil' && (
          <>
            {/* ─── ZONE GAUCHE ─── */}

            {/* Panneau BPU */}
            {!isReadOnly && (
              <RibbonGroup label="Panneau">
                <RibbonBtnLarge
                  icon={PanelLeft}
                  label={showBpu ? 'Fermer' : 'BPU'}
                  onClick={() => setShowBpu(!showBpu)}
                  active={showBpu}
                  accent="text-indigo-500"
                />
              </RibbonGroup>
            )}

            {/* Fichier */}
            {!isReadOnly && (
              <RibbonGroup label="Fichier">
                <RibbonBtnLarge
                  icon={PlusCircle}
                  label="Nouveau"
                  onClick={onNewProject}
                  accent="text-emerald-500"
                  title="Créer un nouveau projet"
                />
                <div className="flex flex-col gap-[3px] justify-center">
                  <RibbonBtnSmall icon={Cloud}  label="Ouvrir Cloud" onClick={onOpenCloudProject} title="Ouvrir un projet depuis le Cloud" accent="text-sky-500" />
                  <RibbonBtnSmall icon={Upload} label="Sauver Cloud" onClick={onSaveProject}      title="Sauvegarder sur le Cloud"          accent="text-blue-500" />
                </div>
                <div className="flex flex-col gap-[3px] justify-center">
                  <RibbonBtnSmall icon={FolderOpen} label="Ouvrir JSON"      onClick={onOpenAffaire} title="Charger une affaire (.json)"      accent="text-amber-500" />
                  <RibbonBtnSmall icon={Save}       label="Enregistrer JSON" onClick={onSaveAffaire} title="Sauvegarder l'affaire (.json)"    accent="text-slate-500" />
                </div>
              </RibbonGroup>
            )}

            {/* Projet */}
            {!isReadOnly && (
              <RibbonGroup label="Projet">
                <RibbonBtnLarge
                  icon={Info}
                  label="Infos"
                  onClick={onOpenDetails}
                  accent="text-slate-500"
                  title="Fiche Projet"
                />
              </RibbonGroup>
            )}

            {/* Outils */}
            <RibbonGroup label="Outils">
              {!isReadOnly && onUndo && (
                <RibbonBtnLarge
                  icon={Undo2}
                  label="Annuler"
                  onClick={onUndo}
                  disabled={!canUndo}
                  accent={canUndo ? 'text-slate-700' : 'text-slate-300'}
                  title={canUndo ? 'Annuler la dernière action (Ctrl+Z)' : 'Aucune action à annuler'}
                />
              )}
              <RibbonBtnLarge
                icon={Calculator}
                label="% à valoir"
                onClick={onOpenCalculation}
                accent="text-teal-500"
                title="% pour Qtées à valoir"
              />
              {!isReadOnly && (
                <RibbonBtnLarge
                  icon={ShieldCheck}
                  label="Audit prix"
                  onClick={onOpenPriceAudit}
                  accent="text-amber-500"
                  title="Auditer les prix du projet vs la base BPU"
                />
              )}
              {!isReadOnly && onOpenPriceCheck && (
                <RibbonBtnLarge
                  icon={ScanSearch}
                  label={'Vérif. n° prix'}
                  onClick={onOpenPriceCheck}
                  accent={priceCheckCount > 0 ? 'text-red-500' : 'text-violet-500'}
                  badge={priceCheckCount}
                  title={priceCheckCount > 0
                    ? `${priceCheckCount} anomalie(s) de numérotation détectée(s) — cliquez pour le détail`
                    : "Vérifier l'unicité des numéros de prix (même libellé et même unité partout)"}
                />
              )}
              {!isReadOnly && currentMode === 'study' && onOpenBpuAudit && (
                <RibbonBtnLarge
                  icon={ClipboardCheck}
                  label="Audit bordereau"
                  onClick={onOpenBpuAudit}
                  active={bpuAuditActive}
                  accent="text-cyan-500"
                  title="Auditer le bordereau (prix, unités, désignations, descriptions) vs la base BPU"
                />
              )}
              {!isReadOnly && currentMode === 'study' && (
                <RibbonBtnLarge
                  icon={isAutoNumbering ? ListOrdered : Hash}
                  label={isAutoNumbering ? 'Auto N\u00b0' : 'Manuel'}
                  onClick={toggleNumberingMode}
                  active={!isAutoNumbering}
                  accent="text-slate-500"
                  title={`Numérotation : ${isAutoNumbering ? 'Automatique' : 'Manuelle'}`}
                />
              )}
            </RibbonGroup>

            {/* ─── SPACER GAUCHE ─── */}
            <RibbonSpacer />


            {/* ─── TOGGLE CENTRAL ─── */}
            <div className="flex flex-col items-center justify-center shrink-0 px-3">
              <div className="relative flex items-center bg-slate-200/80 rounded-lg p-[3px] shadow-inner">
                <div className={`absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-md shadow-md transition-all duration-250 ease-out
                  ${currentMode === 'study'
                    ? 'left-[3px] bg-gradient-to-b from-emerald-500 to-emerald-600'
                    : 'left-[calc(50%)] bg-gradient-to-b from-indigo-500 to-indigo-600'
                  }`}
                />
                <button
                  onClick={() => setViewMode('study')}
                  title="Mode Étude (Édition)"
                  className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors duration-200
                    ${currentMode === 'study' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Pencil size={15} strokeWidth={currentMode === 'study' ? 2.2 : 1.6} />
                  Étude
                </button>
                <button
                  onClick={() => setViewMode('client')}
                  title="Mode Rendu (Lecture Seule)"
                  className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors duration-200
                    ${currentMode === 'client' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Eye size={15} strokeWidth={currentMode === 'client' ? 2.2 : 1.6} />
                  Rendu
                </button>
              </div>
              <span className="text-[9px] text-slate-400 font-normal tracking-wide mt-0.5 select-none">Affichage</span>
            </div>

            {/* ─── SPACER DROIT ─── */}
            <RibbonSpacer />

            {/* ─── ZONE DROITE ─── */}

            {/* Analyse (mode client) */}
            {currentMode === 'client' && (
              <RibbonGroup label="Comparer">
                <RibbonBtnLarge
                  icon={BarChart3}
                  label={'\u00c9carts'}
                  onClick={() => setShowComparison(!showComparison)}
                  active={showComparison}
                  accent="text-amber-500"
                  title="Voir les écarts comparatifs"
                />
              </RibbonGroup>
            )}

            {/* Exports rapides (mode client) */}
            {currentMode === 'client' && (
              <RibbonGroup label="Export rapide" noBorder>
                <div className="flex flex-col gap-[3px] justify-center">
                  <RibbonBtnSmall icon={FileText} label="PDF DQE" onClick={() => onExport('pdf', 'DQE')} accent="text-red-500" />
                  <RibbonBtnSmall icon={FileText} label="PDF Estim." onClick={() => onExport('pdf', 'ESTIMATION')} accent="text-red-500" />
                </div>
                <div className="flex flex-col gap-[3px] justify-center">
                  <RibbonBtnSmall icon={Table2} label="Excel DQE" onClick={() => onExport('excel', 'DQE')} accent="text-emerald-600" />
                  <RibbonBtnSmall icon={Table2} label="Excel Estim." onClick={() => onExport('excel', 'ESTIMATION')} accent="text-emerald-600" />
                </div>
              </RibbonGroup>
            )}

            {/* Ajouter Chapitre / Article libre (tout à droite, mode étude) */}
            {!isReadOnly && currentMode === 'study' && (
              <RibbonGroup label="Nouveau" noBorder>
                <RibbonBtnLarge
                  icon={PlusCircle}
                  label="Chapitre"
                  onClick={onAddChapter}
                  accent="text-emerald-500"
                  title="Ajouter un nouveau chapitre"
                />
                {onAddFreeItem && (
                  <RibbonBtnLarge
                    icon={FilePlus}
                    label="Article libre"
                    onClick={onAddFreeItem}
                    accent="text-blue-500"
                    title="Ajouter un article libre à remplir directement (hors bibliothèque BPU)"
                  />
                )}
              </RibbonGroup>
            )}
          </>
        )}

      </RibbonContainer>
    </header>
  );
};

export default ProjectToolbar;
