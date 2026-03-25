import React from 'react';
import { FileDown, FileText, Loader2, ArrowUpDown, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

const ZOOM_STEPS = [0.5, 0.6, 0.75, 0.85, 1, 1.25, 1.5, 1.75, 2];

const BpuToolbar = ({
  pages,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  overrideCount,
  onResetAllOverrides,
  bpuConfig,
  forceManualSort,
  onToggleSort,
  isGeneratingWord,
  isGeneratingPdf,
  sortedCatalogLength,
  onDownloadWord,
  onDownloadPdf,
  audit,
  showAudit,
  onToggleAudit,
}) => (
  <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-lg print:hidden sticky top-0 z-50 h-[50px]">
    {/* Compteur de pages */}
    <h2 className="font-bold uppercase text-xs flex items-center gap-2">
      <span className="bg-emerald-600 px-2 py-0.5 rounded text-[10px]">Aperçu A4</span>
      {pages.length} Page{pages.length > 1 ? 's' : ''} générée{pages.length > 1 ? 's' : ''}
    </h2>

    <div className="flex items-center gap-3">
      {/* Contrôles de zoom */}
      <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={onZoomOut}
          disabled={zoom === ZOOM_STEPS[0]}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Dézoomer"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={onZoomReset}
          className="px-2.5 py-1 text-[10px] font-black text-slate-300 hover:text-white hover:bg-slate-700 transition-colors min-w-[46px] text-center tabular-nums"
          title="Réinitialiser le zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoomer"
        >
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Badge modifications */}
      {overrideCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold uppercase">
            {overrideCount} modification{overrideCount > 1 ? 's' : ''}
          </span>
          <button
            onClick={onResetAllOverrides}
            className="px-2.5 py-1 bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-500/50 rounded text-[10px] font-bold uppercase transition-all"
            title="Réinitialiser toutes les modifications"
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Tri manuel (mode numérotation manuelle uniquement) */}
      {bpuConfig?.numberingMode === 'manual' && (
        <button
          onClick={onToggleSort}
          className={`px-3 py-1.5 rounded font-bold text-xs uppercase flex items-center gap-2 transition-all ${
            forceManualSort ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          <ArrowUpDown size={14} />
          {forceManualSort ? 'Tri: Numérique' : 'Tri: Visuel'}
        </button>
      )}

      {/* Bouton Audit */}
      <button
        onClick={onToggleAudit}
        className={`relative px-3 py-1.5 rounded font-bold text-xs uppercase flex items-center gap-2 transition-all border ${
          showAudit
            ? 'bg-slate-700 text-white border-slate-500'
            : audit?.stats?.errors > 0
              ? 'bg-amber-600/20 text-amber-400 border-amber-500/40 hover:bg-amber-600/30'
              : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
        }`}
        title="Vérifier la cohérence avec la base BPU"
      >
        <RefreshCw size={14} />
        Audit
        {audit?.stats?.errors > 0 && (
          <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
            {audit.stats.errors}
          </span>
        )}
      </button>

      {/* Export Word */}
      <button
        onClick={onDownloadWord}
        disabled={isGeneratingWord || sortedCatalogLength === 0}
        className={`bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-md hover:scale-105 active:scale-95 ${
          isGeneratingWord || sortedCatalogLength === 0 ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {isGeneratingWord
          ? <><Loader2 size={16} className="animate-spin" /> Word...</>
          : <><FileText size={16} /> Word (.docx)</>}
      </button>

      {/* Export PDF */}
      <button
        onClick={onDownloadPdf}
        disabled={isGeneratingPdf || pages.length === 0}
        className={`bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-md hover:scale-105 active:scale-95 ${
          isGeneratingPdf || pages.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {isGeneratingPdf
          ? <><Loader2 size={16} className="animate-spin" /> Génération...</>
          : <><FileDown size={16} /> PDF Officiel</>}
      </button>
    </div>
  </div>
);

export default BpuToolbar;
