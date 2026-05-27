import React from 'react';
import {
  Upload, Save, FolderOpen, Copy, CheckCheck, RefreshCw, Cpu, Cloud, CheckCircle2, FileText, Layers, PlusCircle, HelpCircle
} from 'lucide-react';
import { APP_VERSION } from '../../data/changelog';

const RibbonGroup = ({ label, children, noBorder }) => (
  <div className="flex flex-col h-full relative">
    <div className="flex items-center justify-center gap-1.5 px-4 flex-1 py-1">
      {children}
    </div>
    <div className="text-center pb-1 px-2">
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest select-none whitespace-nowrap leading-none">
        {label}
      </span>
    </div>
    {!noBorder && (
      <div className="absolute right-0 top-2 bottom-2 w-px bg-gray-200/60" />
    )}
  </div>
);

const RibbonBtnLarge = ({ icon: Icon, label, onClick, title, active, accent, disabled, loading }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className={`
      group flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-xl min-w-[72px]
      transition-all duration-150
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
      ${active
        ? 'bg-blue-50 border border-blue-200/60 shadow-sm'
        : 'border border-transparent hover:bg-gray-100 hover:border-gray-200/60'
      }
    `}
  >
    <div className={`transition-colors ${accent || 'text-gray-400'} ${!disabled && !active ? 'group-hover:text-gray-700' : ''}`}>
      <Icon size={22} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} />
    </div>
    <span className={`text-[10px] leading-tight text-center font-semibold transition-colors
      ${active ? 'text-blue-600' : 'text-gray-400'}
      ${!disabled && !active ? 'group-hover:text-gray-700' : ''}
    `}>
      {label}
    </span>
  </button>
);

const RibbonBtnSmall = ({ icon: Icon, label, onClick, title, active, accent, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className={`
      group flex items-center gap-2 px-3 py-1.5 rounded-lg w-full
      transition-all duration-150
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
      ${active
        ? 'bg-blue-50 border border-blue-200/60'
        : 'border border-transparent hover:bg-gray-100 hover:border-gray-200/60'
      }
    `}
  >
    <div className={`transition-colors shrink-0 ${accent || 'text-gray-400'} ${!disabled && !active ? 'group-hover:text-gray-700' : ''}`}>
      <Icon size={14} strokeWidth={2} />
    </div>
    {label && (
      <span className={`text-[11px] leading-none whitespace-nowrap font-medium transition-colors
        ${active ? 'text-blue-600' : 'text-gray-400'}
        ${!disabled && !active ? 'group-hover:text-gray-700' : ''}
      `}>
        {label}
      </span>
    )}
  </button>
);

/**
 * PmLeftColumn — Ribbon Apple-style (fond clair, même structure)
 */
const PmLeftColumn = ({
  project, chapCount, itemCount, lastSaved,
  cloudSaving, cloudSaved,
  onCloudSave, onExport, onImportClick, onClone,
  fileInputRef, onImportChange, onNewProject, onShowHelp,
}) => (
  <div className="flex-none flex items-stretch bg-white/80 backdrop-blur-xl border-b border-gray-200/60 h-[88px] select-none z-20 overflow-x-auto"
    >

    {/* ── App Branding ── */}
    <div className="flex flex-col justify-center px-6 border-r border-gray-200/60 bg-gray-50/50 min-w-[180px]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-sm">
          <Layers size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-black text-gray-900 uppercase tracking-wider leading-none">Workspace</h1>
          <p className="text-[9px] text-gray-400 font-medium mt-1">Estima Suite</p>
        </div>
      </div>
    </div>

    {/* ── Session en cours ── */}
    <div className="flex flex-col justify-center px-6 border-r border-gray-200/60 min-w-[240px] max-w-[320px]">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Session en cours</p>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">
          <CheckCircle2 size={10} /> Actif
        </span>
        <span className="text-sm font-bold text-gray-900 truncate flex-1" title={project?.name || 'Nouveau Projet'}>
          {project?.name || 'Nouveau Projet'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-medium text-gray-400">
        <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded"><Layers size={10} /> {chapCount} chapitres</span>
        <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded"><FileText size={10} /> {itemCount} éléments</span>
        {lastSaved && (
          <span className="flex items-center gap-1 text-gray-300 ml-auto" title={`Dernière sauvegarde : ${lastSaved}`}>
            <Cloud size={10} /> Sync
          </span>
        )}
      </div>
    </div>

    {/* ── Général ── */}
    <RibbonGroup label="Général">
      <RibbonBtnLarge icon={PlusCircle} label="Nouveau" onClick={onNewProject} accent="text-blue-500" />
      <RibbonBtnLarge icon={HelpCircle} label="Guide" onClick={onShowHelp} accent="text-gray-500" />
    </RibbonGroup>

    {/* ── Actions Cloud ── */}
    <RibbonGroup label="Cloud">
      <RibbonBtnLarge
        icon={cloudSaving ? RefreshCw : cloudSaved ? CheckCheck : Upload}
        label={cloudSaving ? 'Sauvegarde...' : cloudSaved ? 'Sauvegardé' : 'Sauvegarder'}
        onClick={onCloudSave}
        disabled={cloudSaving}
        active={cloudSaved}
        accent={cloudSaved ? 'text-emerald-500' : 'text-blue-500'}
        loading={cloudSaving}
      />
    </RibbonGroup>

    {/* ── Actions Fichier ── */}
    <RibbonGroup label="Local & Fichier">
      <div className="flex flex-col gap-0.5 justify-center">
        <RibbonBtnSmall icon={FolderOpen} label="Ouvrir JSON" onClick={onImportClick} accent="text-amber-500" />
        <input type="file" ref={fileInputRef} onChange={onImportChange} accept=".json" className="hidden" />
        <RibbonBtnSmall icon={Save} label="Exporter JSON" onClick={onExport} accent="text-blue-500" />
      </div>
      <div className="flex flex-col gap-0.5 justify-center">
        <RibbonBtnSmall icon={Copy} label="Dupliquer le projet" onClick={onClone} accent="text-violet-500" />
      </div>
    </RibbonGroup>

    <div className="flex-1 min-w-[16px]" />

    {/* ── Status ── */}
    <div className="flex flex-col justify-center items-end px-6 border-l border-gray-200/60 text-right bg-gray-50/50 min-w-[160px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Connecté</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded" title="Version installée d'EstimaVRD">
        <Cpu size={10} /> v{APP_VERSION}
      </div>
    </div>
  </div>
);

export default PmLeftColumn;
