import React, { useState } from 'react';
import {
  PanelLeft, Receipt, HardHat, UserCheck, ArrowLeftRight,
  FileSpreadsheet, FileText, Calculator, Plus, Loader2,
  CheckCircle2, CloudOff, FileSignature, Bookmark, ListOrdered, Hash,
  FolderOpen, Save, Upload, Eye, Pencil, PlusCircle,
  BarChart3, Download, Info, Table2, FileOutput,
  Cloud, PanelLeftOpen, FileDown, Archive, ShieldCheck
} from 'lucide-react';

import { formatPrice } from '../utils/helpers';
import { RibbonGroup, RibbonBtnLarge, RibbonBtnSmall } from './common/RibbonParts';

/* ════════════════════════════════════════════════════════════════════
   OFFICE RIBBON — Composant principal
   ════════════════════════════════════════════════════════════════════ */

const ProjectToolbar = ({
  project,
  updateProjectName,
  saveStatus,
  onSaveProject,
  isReadOnly,
  showBpu,
  setShowBpu,
  currentMode,
  setViewMode,
  showComparison,
  setShowComparison,
  totalBase,
  activeTrancheId,
  onExport,
  onOpenCalculation,
  onOpenDetails,
  onAddChapter,
  bpuConfig,
  setBpuConfig,
  onSaveAffaire,
  onOpenAffaire,
  onNewProject,
  onOpenCloudProject,
  onArchive,
  archiveCount = 0,
  onOpenArchiveManager,
  onOpenPriceAudit,
}) => {
  const [activeTab, setActiveTab] = useState('accueil');

  const currentPhase = project?.phase || 'DCE';
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

        {/* Nom + phase centré */}
        <div className="flex-1 flex items-center justify-center gap-2.5">
          <span className="text-[11.5px] font-semibold text-slate-700 tracking-wide truncate max-w-[300px]">
            {project?.name || 'Projet sans nom'}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 tracking-wide border border-slate-200">
            {currentPhase}
          </span>
        </div>

        {/* Indicateur de sauvegarde à droite */}
        <div className="flex items-center pr-2">
          <SaveIndicator />
        </div>
      </div>

      {/* ═══════ CONTENU DU RIBBON ═══════ */}
      <div className="flex items-stretch bg-[#f3f3f3] border-b border-slate-200 min-h-[78px]">

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
                  <RibbonBtnSmall icon={FolderOpen} label="Ouvrir" onClick={onOpenAffaire} title="Charger une affaire (.json)" accent="text-amber-500" />
                  <RibbonBtnSmall icon={Save} label="Enregistrer" onClick={onSaveAffaire} title="Sauvegarder l'affaire (.json)" accent="text-blue-500" />
                  <RibbonBtnSmall icon={Cloud} label="Ouvrir Cloud" onClick={onOpenCloudProject} title="Ouvrir un projet depuis le Cloud" accent="text-sky-500" />
                </div>
                <RibbonBtnLarge
                  icon={Upload}
                  label="Cloud"
                  onClick={onSaveProject}
                  accent="text-blue-500"
                  title="Sauvegarder sur le Cloud"
                />
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
            <div className="flex-1 min-w-[16px]" />


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
            <div className="flex-1 min-w-[16px]" />

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

            {/* Archives */}
            <RibbonGroup label="Archives">
              {currentMode === 'client' && onArchive && (
                <RibbonBtnLarge
                  icon={Archive}
                  label="Figer"
                  onClick={onArchive}
                  accent="text-indigo-500"
                  title="Archiver cette version"
                />
              )}
              <RibbonBtnLarge
                icon={Eye}
                label={archiveCount > 0 ? `Gérer (${archiveCount})` : 'Gérer'}
                onClick={onOpenArchiveManager}
                accent="text-slate-500"
                title="Ouvrir le gestionnaire d'archives"
              />
            </RibbonGroup>

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

            {/* Ajouter Chapitre (tout à droite, mode étude) */}
            {!isReadOnly && currentMode === 'study' && (
              <RibbonGroup label="Nouveau" noBorder>
                <RibbonBtnLarge
                  icon={PlusCircle}
                  label="Chapitre"
                  onClick={onAddChapter}
                  accent="text-emerald-500"
                  title="Ajouter un nouveau chapitre"
                />
              </RibbonGroup>
            )}
          </>
        )}

      </div>
    </header>
  );
};

export default ProjectToolbar;
