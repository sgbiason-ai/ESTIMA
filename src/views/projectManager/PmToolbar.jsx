import React, { useState, useRef, useEffect } from 'react';
import {
  Layers, PlusCircle, HelpCircle, Upload, RefreshCw, CheckCheck,
  FolderOpen, Save, Copy, ChevronDown, CheckCircle2,
} from 'lucide-react';
import { APP_VERSION } from '../../data/changelog';
import { formatRelativeDate } from './relativeDate';

const MenuItem = ({ icon: Icon, accent, label, hint, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors text-left"
  >
    <Icon size={14} strokeWidth={2} className={`shrink-0 ${accent}`} />
    <span className="flex-1">{label}</span>
    {hint && <span className="text-[10px] text-gray-400 font-mono">{hint}</span>}
  </button>
);

/**
 * PmToolbar — barre d'outils du Workspace (remplace l'ancien ribbon 80px).
 * Entièrement fluide : le nom de l'affaire tronque (flex-1 min-w-0), les libellés
 * se replient en icônes sous md/sm — plus aucune largeur fixe qui déborde.
 */
const PmToolbar = ({
  project, lastSavedIso,
  cloudSaving, cloudSaved,
  onCloudSave, onExport, onImportClick, onClone,
  fileInputRef, onImportChange, onNewProject, onShowHelp,
  creatingProject = false,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef(null);

  // Fermeture du menu Fichier : clic extérieur + Échap
  useEffect(() => {
    if (!fileMenuOpen) return undefined;
    const onDown = (e) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target)) setFileMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setFileMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [fileMenuOpen]);

  const savedDate = lastSavedIso ? new Date(lastSavedIso) : null;
  const savedRelative = savedDate ? formatRelativeDate(savedDate) : '';
  const savedFull = savedDate ? savedDate.toLocaleString('fr-FR') : '';

  return (
    <div className="flex-none flex items-center gap-2 sm:gap-3 px-4 sm:px-6 h-14 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 z-20 select-none">

      {/* ── Branding ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-sm">
          <Layers size={15} className="text-white" />
        </div>
        <span className="hidden md:block text-sm font-black text-gray-900 uppercase tracking-wider leading-none">Workspace</span>
      </div>

      <div className="hidden sm:block h-6 w-px bg-gray-200/60 shrink-0" />

      {/* ── Session en cours (flexible, tronque) ── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="hidden sm:flex items-center gap-1 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60 shrink-0">
          <CheckCircle2 size={10} /> Actif
        </span>
        <span className="text-sm font-semibold text-gray-900 truncate" title={project?.name || 'Nouveau Projet'}>
          {project?.name || 'Nouveau Projet'}
        </span>
        {savedRelative && (
          <span className="hidden lg:block text-xs text-gray-500 whitespace-nowrap shrink-0" title={`Dernière sauvegarde : ${savedFull}`}>
            · Sauvegardé {savedRelative}
          </span>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

        <button
          onClick={onNewProject}
          disabled={creatingProject}
          title="Créer une nouvelle affaire"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 border border-gray-200/60 hover:bg-gray-100 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {creatingProject
            ? <RefreshCw size={14} className="animate-spin text-blue-600" />
            : <PlusCircle size={14} className="text-blue-600" />}
          <span className="hidden md:inline">{creatingProject ? 'Création…' : 'Nouvelle affaire'}</span>
        </button>

        <button
          onClick={onCloudSave}
          disabled={cloudSaving}
          title="Sauvegarder l'affaire en cours sur le Cloud"
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm active:scale-[0.97] transition-all disabled:opacity-70 ${
            cloudSaved
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
          }`}
        >
          {cloudSaving
            ? <RefreshCw size={14} className="animate-spin" />
            : cloudSaved ? <CheckCheck size={14} /> : <Upload size={14} />}
          <span className="hidden sm:inline">
            {cloudSaving ? 'Sauvegarde…' : cloudSaved ? 'Sauvegardé' : 'Sauvegarder'}
          </span>
        </button>

        {/* Menu Fichier */}
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => setFileMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={fileMenuOpen}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              fileMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Fichier
            <ChevronDown size={13} className={`transition-transform duration-200 ${fileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {fileMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-lg border border-gray-200/70 p-1.5 z-50">
              <MenuItem icon={FolderOpen} accent="text-amber-500" label="Importer un projet…" hint=".json"
                onClick={() => { setFileMenuOpen(false); onImportClick(); }} />
              <MenuItem icon={Save} accent="text-blue-500" label="Exporter une copie" hint=".json"
                onClick={() => { setFileMenuOpen(false); onExport(); }} />
              <div className="h-px bg-gray-100 my-1 mx-2" />
              <MenuItem icon={Copy} accent="text-violet-500" label="Dupliquer la session"
                onClick={() => { setFileMenuOpen(false); onClone(); }} />
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={onImportChange} accept=".json" className="hidden" />
        </div>

        <button
          onClick={onShowHelp}
          title="Guide du module"
          aria-label="Guide du module"
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
        >
          <HelpCircle size={16} strokeWidth={1.5} />
        </button>

        <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-lg"
          title="EstimaVRD — connecté au Cloud">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
};

export default PmToolbar;
