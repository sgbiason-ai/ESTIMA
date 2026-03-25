import React from 'react';
import {
  Upload, Save, FolderOpen, Copy, CheckCheck, RefreshCw, Cpu, Cloud, CheckCircle2,
} from 'lucide-react';

/**
 * PmLeftColumn
 * Panneau gauche : infos projet actif, mini stats, boutons d'action.
 */
const PmLeftColumn = ({
  project,
  chapCount,
  itemCount,
  lastSaved,
  cloudSaving,
  cloudSaved,
  onCloudSave,
  onExport,
  onImportClick,
  onClone,
  fileInputRef,
  onImportChange,
}) => (
  <div className="w-[300px] shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/50 overflow-hidden">

    {/* ── Session en cours ── */}
    <div className="p-6 border-b border-slate-800">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Session en cours</p>
      <h3 className="text-base font-semibold text-slate-100 leading-snug mb-2 line-clamp-2" title={project?.name || 'Nouveau Projet'}>
        {project?.name || 'Nouveau Projet'}
      </h3>
      <p className="text-xs font-mono text-slate-500 truncate mb-4">ID: {project?.id || 'Non sauvegardé'}</p>

      <div className="flex items-center gap-2 mb-5">
        <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded text-xs font-medium border border-emerald-500/20">
          <CheckCircle2 size={12} /> Actif
        </span>
        <span className="flex items-center gap-1.5 bg-slate-800 text-slate-300 px-2.5 py-1 rounded text-xs font-medium border border-slate-700">
          <Cloud size={12} /> Synchronisé
        </span>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-col items-center">
          <span className="text-xl font-semibold text-slate-100">{chapCount}</span>
          <span className="text-xs text-slate-400 font-medium mt-1">Chapitres</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-col items-center">
          <span className="text-xl font-semibold text-slate-100">{itemCount}</span>
          <span className="text-xs text-slate-400 font-medium mt-1">Éléments</span>
        </div>
      </div>
    </div>

    {/* ── Actions ── */}
    <div className="flex-1 flex flex-col gap-3 p-5 overflow-y-auto">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Actions</p>

      {/* Cloud Save */}
      <button
        onClick={onCloudSave}
        disabled={cloudSaving}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors border ${
          cloudSaved
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-emerald-600 hover:bg-emerald-500 border-transparent text-white shadow-sm'
        }`}
      >
        <div className="flex items-center justify-center shrink-0">
          {cloudSaving ? <RefreshCw size={18} className="animate-spin" />
            : cloudSaved ? <CheckCheck size={18} />
            : <Upload size={18} />}
        </div>
        <div className="text-left flex-1">
          <p>{cloudSaving ? 'Sauvegarde...' : cloudSaved ? 'Sauvegardé avec succès' : 'Sauvegarder (Cloud)'}</p>
        </div>
      </button>

      {/* Export JSON */}
      <button
        onClick={onExport}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
      >
        <Save size={18} className="text-blue-400" />
        <div className="text-left flex-1"><p>Exporter (JSON)</p></div>
      </button>

      {/* Charger JSON */}
      <button
        onClick={onImportClick}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
      >
        <FolderOpen size={18} className="text-purple-400" />
        <div className="text-left flex-1"><p>Charger (JSON)</p></div>
        <input type="file" ref={fileInputRef} onChange={onImportChange} accept=".json" className="hidden" />
      </button>

      {/* Dupliquer */}
      <button
        onClick={onClone}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
      >
        <Copy size={18} className="text-indigo-400" />
        <div className="text-left flex-1"><p>Dupliquer le projet</p></div>
      </button>
    </div>

    {/* Footer */}
    <div className="flex-none p-4 border-t border-slate-800 flex items-center justify-between text-slate-500 bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-mono">
        <Cpu size={14} />
        <span>ENGINE_V2.4.5</span>
      </div>
      <span className="text-xs font-mono">
        {(JSON.stringify(localStorage).length / 1024).toFixed(1)} KB
      </span>
    </div>
  </div>
);

export default PmLeftColumn;
