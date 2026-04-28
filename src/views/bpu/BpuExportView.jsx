import React, { useState, useRef } from 'react';
import { resolveBranding } from './utils/bpuBrandingUtils';
import { useBpuData }        from './hooks/useBpuData';
import { useBpuPagination }  from './hooks/useBpuPagination';
import { useBpuWordExport }  from './hooks/useBpuWordExport';
import { useBpuPdfExport }   from './hooks/useBpuPdfExport';
import { useBpuAudit }       from './hooks/useBpuAudit';
import BpuCoverPage  from './BpuCoverPage';
import BpuToolbar    from './BpuToolbar';
import BpuPageView   from './BpuPageView';
import BpuAuditPanel from './BpuAuditPanel';
import HelpPanel from '../../components/help/HelpPanel';
import HelpButton from '../../components/help/HelpButton';

// Pas d'imports directs de logique ici : tout est délégué aux hooks et sous-composants.

const ZOOM_STEPS = [0.5, 0.6, 0.75, 0.85, 1, 1.25, 1.5, 1.75, 2];

const BpuExportView = ({
  project,
  setProject,
  units       = [],
  articlesDb  = [],
  bpuConfig,
  masterBranding = {},
}) => {
  const [logoError, setLogoError] = useState(false);
  const [zoom, setZoom]           = useState(1);
  const [showHelp, setShowHelp]   = useState(false);
  const measureRef = useRef(null);
  const today      = new Date().toLocaleDateString('fr-FR');

  // ── ZOOM ────────────────────────────────────────────────────────────────────
  const zoomIn    = () => setZoom((z) => ZOOM_STEPS[Math.min(ZOOM_STEPS.indexOf(z) + 1, ZOOM_STEPS.length - 1)]);
  const zoomOut   = () => setZoom((z) => ZOOM_STEPS[Math.max(ZOOM_STEPS.indexOf(z) - 1, 0)]);
  const zoomReset = () => setZoom(1);

  // ── BRANDING ─────────────────────────────────────────────────────────────────
  const branding     = resolveBranding(masterBranding);
  const resolvedLogo = branding.logo || (!logoError ? '/logo.jpg' : null);

  // ── DONNÉES MÉTIER ────────────────────────────────────────────────────────────
  const {
    forceManualSort, setForceManualSort,
    overrideCount,
    resetAllOverrides,
    saveOverride, resetOverride,
    unitResolver, sortedCatalog,
  } = useBpuData({ project, setProject, bpuConfig, units });

  // ── PAGINATION ────────────────────────────────────────────────────────────────
  const { pages } = useBpuPagination({ sortedCatalog, articlesDb, unitResolver, measureRef });

  // ── AUDIT ────────────────────────────────────────────────────────────────────
  const { audit, showAudit, setShowAudit, refresh: refreshAudit, syncDescriptions } = useBpuAudit({
    sortedCatalog, articlesDb, bpuOverrides: project?.bpuOverrides, setProject,
  });

  // ── EXPORTS ───────────────────────────────────────────────────────────────────
  const { isGeneratingWord, handleDownloadWord } = useBpuWordExport({
    project, branding, resolvedLogo, sortedCatalog, unitResolver, articlesDb,
  });
  const { isGeneratingPdf, pdfProgress, handleDownloadPdf } = useBpuPdfExport({ project, pages });

  return (
    <div className="flex flex-col bg-slate-200 h-screen w-full relative font-sans text-slate-900 overflow-hidden">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="bpu" />

      {/* Div cachée pour la mesure des hauteurs HTML (utilisée par useBpuPagination) */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute', top: 0, left: '-9999px',
          visibility: 'hidden', fontSize: '10px', lineHeight: '1.625',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      />

      {/* Page de garde cachée pour l'export PDF */}
      <BpuCoverPage
        project={project}
        branding={branding}
        resolvedLogo={resolvedLogo}
        today={today}
        onLogoError={() => setLogoError(true)}
      />

      {/* Barre d'outils supérieure */}
      <BpuToolbar
        pages={pages}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        overrideCount={overrideCount}
        onResetAllOverrides={resetAllOverrides}
        bpuConfig={bpuConfig}
        forceManualSort={forceManualSort}
        onToggleSort={() => setForceManualSort((v) => !v)}
        isGeneratingWord={isGeneratingWord}
        isGeneratingPdf={isGeneratingPdf}
        pdfProgress={pdfProgress}
        sortedCatalogLength={sortedCatalog.length}
        onDownloadWord={handleDownloadWord}
        onDownloadPdf={handleDownloadPdf}
        audit={audit}
        showAudit={showAudit}
        onToggleAudit={() => { refreshAudit(); setShowAudit(v => !v); }}
        onShowHelp={() => setShowHelp(true)}
      />

      {/* Zone principale : pages A4 + sidebar audit */}
      <div className="flex flex-1 overflow-hidden">
        <BpuPageView
          pages={pages}
          project={project}
          branding={branding}
          resolvedLogo={resolvedLogo}
          onLogoError={() => setLogoError(true)}
          zoom={zoom}
          unitResolver={unitResolver}
          setProject={setProject}
          saveOverride={saveOverride}
          resetOverride={resetOverride}
        />

        {showAudit && (
          <BpuAuditPanel
            audit={audit}
            onClose={() => setShowAudit(false)}
            onSyncDescriptions={syncDescriptions}
          />
        )}
      </div>
    </div>
  );
};

export default BpuExportView;