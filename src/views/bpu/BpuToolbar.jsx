import React from 'react';
import { FileDown, FileText, Loader2, ArrowUpDown, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonContainer, RibbonHeader, RibbonSpacer } from '../../components/common/RibbonParts';
import HelpButton from '../../components/help/HelpButton';

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
  pdfProgress,
  sortedCatalogLength,
  onDownloadWord,
  onDownloadPdf,
  audit,
  showAudit,
  onToggleAudit,
  onShowHelp,
}) => (
  <div className="font-[system-ui,'Segoe_UI',sans-serif] select-none sticky top-0 z-50 print:hidden">

    {/* ═══════ BARRE TITRE ═══════ */}
    <RibbonHeader
      title={`Aperçu BPU — ${pages.length} page${pages.length > 1 ? 's' : ''}`}
      rightContent={
        overrideCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-600">{overrideCount} modif.</span>
            <button
              onClick={onResetAllOverrides}
              className="text-[10px] font-bold text-red-400 hover:text-red-600 underline"
            >
              Réinitialiser
            </button>
          </div>
        )
      }
    />

    {/* ═══════ CONTENU DU RIBBON ═══════ */}
    <RibbonContainer>

      {/* ── Zoom ── */}
      <RibbonGroup label="Zoom">
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={onZoomOut}
            disabled={zoom === ZOOM_STEPS[0]}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Dézoomer"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={onZoomReset}
            className="px-2.5 py-1 text-[10px] font-black text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors min-w-[46px] text-center tabular-nums"
            title="Réinitialiser le zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoomer"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </RibbonGroup>

      {/* ── Options ── */}
      <RibbonGroup label="Options">
        {bpuConfig?.numberingMode === 'manual' && (
          <RibbonBtnLarge
            icon={ArrowUpDown}
            label={forceManualSort ? 'Tri: N°' : 'Tri: Visuel'}
            onClick={onToggleSort}
            active={forceManualSort}
            accent="text-blue-500"
          />
        )}
        <RibbonBtnLarge
          icon={RefreshCw}
          label={<>Audit{audit?.stats?.errors > 0 && <span className="ml-0.5 text-[9px] opacity-70">({audit.stats.errors})</span>}</>}
          onClick={onToggleAudit}
          active={showAudit}
          accent={audit?.stats?.errors > 0 ? 'text-amber-500' : 'text-emerald-500'}
          title="Vérifier la cohérence avec la base BPU"
        />
      </RibbonGroup>

      <RibbonSpacer />

      {/* ── Export ── */}
      <RibbonGroup label="Export" noBorder>
        <RibbonBtnLarge
          icon={FileText}
          label={isGeneratingWord ? 'Word...' : 'Word'}
          onClick={onDownloadWord}
          disabled={isGeneratingWord || sortedCatalogLength === 0}
          accent="text-blue-500"
        />
        <RibbonBtnLarge
          icon={FileDown}
          label={isGeneratingPdf ? (pdfProgress?.total ? `PDF ${pdfProgress.current}/${pdfProgress.total}` : 'PDF...') : 'PDF'}
          onClick={onDownloadPdf}
          disabled={isGeneratingPdf || pages.length === 0}
          accent="text-red-500"
        />
      </RibbonGroup>

      {/* ── Aide ── */}
      <div className="flex items-center px-3">
        <HelpButton onClick={onShowHelp} variant="ribbon" />
      </div>

    </RibbonContainer>
  </div>
);

export default BpuToolbar;
