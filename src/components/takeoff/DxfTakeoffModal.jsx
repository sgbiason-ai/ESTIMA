import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle, FileUp, Layers3, LockKeyhole, Power, Ruler, X,
} from 'lucide-react';
import DxfViewerPanel from './DxfViewerPanel';
import DxfMappingPanel from './DxfMappingPanel';
import { buildMeasurementRows } from '../../utils/takeoff/dxfTakeoff';
import { flattenProjectItems } from '../../utils/takeoff/applyTakeoff';
import {
  loadDxfSession, saveDxfFile, clearDxfSession,
} from '../../utils/takeoff/dxfPersistence';
import { useTakeoffAssociations, dxfFileKey } from '../../hooks/useTakeoffAssociations';
import { confirm, toast } from '../../utils/globalUI';

export default function DxfTakeoffModal({
  project, companyId, activeTrancheId, onApply, onClose, visible = true, onUnload,
}) {
  const projectId = project?.id;
  const inputRef = useRef(null);
  const mainRef = useRef(null);
  const skipFileSaveRef = useRef(false);
  const restoredKeyRef = useRef(null);
  const skipCloudSaveRef = useRef(false);
  const { associations, saveAssociations } = useTakeoffAssociations(companyId, projectId);
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [viewerLayers, setViewerLayers] = useState([]);
  const [mappings, setMappings] = useState({});
  const [scaleToMeters, setScaleToMeters] = useState(1);
  const [isolatedLayer, setIsolatedLayer] = useState('');
  const [pick, setPick] = useState({ layer: '', nonce: 0 });
  const [applyMode, setApplyMode] = useState('replace');
  const [loadError, setLoadError] = useState('');
  const [rightWidth, setRightWidth] = useState(440);

  const projectItems = useMemo(() => flattenProjectItems(project?.chapters), [project?.chapters]);
  const rows = useMemo(() => buildMeasurementRows(summary, scaleToMeters), [summary, scaleToMeters]);
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const selectedMappings = useMemo(() => Object.entries(mappings).flatMap(([rowId, mapping]) => {
    const row = rowMap.get(rowId);
    const coefficient = Number(mapping?.coefficient ?? 1);
    if (!row || !mapping?.itemId || !Number.isFinite(coefficient) || coefficient < 0) return [];
    return [{
      rowId,
      layer: row.layer,
      metric: row.metric,
      itemId: mapping.itemId,
      coefficient,
      appliedQuantity: Math.round(row.quantity * coefficient * 1000) / 1000,
    }];
  }), [mappings, rowMap]);

  const hasTranches = (project?.tranches || []).length > 0;
  const targetTrancheId = hasTranches && activeTrancheId !== 'global' ? activeTrancheId : null;
  const trancheMissing = hasTranches && !targetTrancheId;
  const dxfKey = dxfFileKey(file);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.dxf')) {
      toast.error('Sélectionnez un fichier au format .dxf');
      return;
    }
    setFile(selectedFile);
    setSummary(null);
    setViewerLayers([]);
    setMappings({});
    setIsolatedLayer('');
    setLoadError('');
  };

  const handleLoaded = useCallback((nextSummary, layers) => {
    setSummary(nextSummary);
    setViewerLayers(layers);
    setScaleToMeters(Number(nextSummary?.metadata?.detectedScaleToMeters) || 1);
    setLoadError('');
  }, []);

  const handleError = useCallback((message) => setLoadError(message), []);

  // Séparateur redimensionnable entre l'aperçu (gauche) et la liste (droite).
  const startResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightWidth;
    const container = mainRef.current;
    const maxWidth = Math.max(320, (container ? container.clientWidth : 1400) - 380);
    const onMove = (moveEvent) => {
      const next = startWidth - (moveEvent.clientX - startX);
      setRightWidth(Math.min(Math.max(320, next), maxWidth));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Clic sur un objet de l'aperçu : isole son calque (vide = affiche tout) et cible la liste
  const handlePickLayer = useCallback((layer) => {
    setIsolatedLayer(layer || '');
    if (layer) setPick((previous) => ({ layer, nonce: previous.nonce + 1 }));
  }, []);

  // Rechargement du FICHIER au montage (IndexedDB local → réouverture instantanée + F5).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadDxfSession(projectId);
      if (cancelled || !saved?.file) return;
      skipFileSaveRef.current = true;
      setFile(saved.file);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Persistance du fichier : une écriture par changement de fichier (pas à chaque édition).
  useEffect(() => {
    if (!projectId) return;
    if (skipFileSaveRef.current) { skipFileSaveRef.current = false; return; }
    if (file) saveDxfFile(projectId, file.name, file);
  }, [file, projectId]);

  // Restaure les associations CLOUD rattachées à CE fichier (une fois par fichier), dès que
  // le plan est analysé et le doc cloud lu. Recharger le même DXF = retrouver son travail.
  useEffect(() => {
    if (!dxfKey || !summary || associations === null) return;
    if (restoredKeyRef.current === dxfKey) return;
    restoredKeyRef.current = dxfKey;
    const saved = associations[dxfKey];
    if (saved) {
      skipCloudSaveRef.current = true;
      if (saved.mappings) setMappings(saved.mappings);
      if (saved.scaleToMeters) setScaleToMeters(saved.scaleToMeters);
      if (saved.applyMode) setApplyMode(saved.applyMode);
    }
  }, [dxfKey, summary, associations]);

  // Sauvegarde CLOUD des associations (débounce), uniquement après restauration pour ce
  // fichier → ne jamais écraser le cloud avec un état vide au chargement.
  useEffect(() => {
    if (!dxfKey || restoredKeyRef.current !== dxfKey) return undefined;
    if (skipCloudSaveRef.current) { skipCloudSaveRef.current = false; return undefined; }
    const timer = setTimeout(() => {
      saveAssociations(dxfKey, { mappings, scaleToMeters, applyMode });
    }, 1000);
    return () => clearTimeout(timer);
  }, [dxfKey, mappings, scaleToMeters, applyMode, saveAssociations]);

  const handleUnload = () => {
    clearDxfSession(projectId);
    onUnload?.();
  };

  const handleApply = async () => {
    if (selectedMappings.length === 0) {
      toast.warning('Associez au moins un métré à un article du projet.');
      return;
    }
    if (trancheMissing) {
      toast.warning('Sélectionnez une tranche dans l’Estimation avant d’appliquer le métré.');
      return;
    }

    const targetIds = new Set(selectedMappings.map((mapping) => String(mapping.itemId)));
    const formulaCount = projectItems.filter((item) => targetIds.has(String(item.id)) && (
      targetTrancheId ? item.quantitiesFormula?.[targetTrancheId] : item.formula
    )).length;
    const warning = formulaCount > 0
      ? ` ${formulaCount} formule(s) de quantité seront remplacées.`
      : '';
    const ok = await confirm(
      `Appliquer ${selectedMappings.length} association(s) au projet ?${warning}`,
      { title: 'Appliquer le métré DXF', confirmLabel: 'Appliquer', cancelLabel: 'Annuler' },
    );
    if (!ok) return;

    onApply(selectedMappings, {
      fileName: file?.name,
      mode: applyMode,
      trancheId: targetTrancheId,
      sourceSize: file?.size,
      viewerLayerCount: viewerLayers.length,
    });
    toast.success('Les quantités du métré DXF ont été appliquées et sauvegardées.');
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-modal flex ${visible ? '' : 'invisible pointer-events-none'}`} role="dialog" aria-modal="true" aria-label="Métré DXF">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-5 py-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Ruler size={21} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Métré DXF</h2>
                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">POC</span>
              </div>
              <p className="truncate text-xs text-gray-500">{file?.name || 'Import local — aucune donnée envoyée à un service CAO externe'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700 lg:inline-flex">
              <LockKeyhole size={13} /> Traitement local
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-700"
            >
              <FileUp size={15} /> {file ? 'Changer de DXF' : 'Ouvrir un DXF'}
            </button>
            {file && (
              <button
                type="button"
                onClick={handleUnload}
                title="Décharger le DXF de la mémoire (les associations restent enregistrées et reviendront en rechargeant ce fichier)"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                <Power size={15} /> Décharger
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fermer">
              <X size={20} />
            </button>
            <input ref={inputRef} type="file" accept=".dxf" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
          </div>
        </header>

        {file?.size > 75 * 1024 * 1024 && !loadError && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[11px] text-amber-800">
            <AlertTriangle size={14} /> Plan volumineux ({Math.round(file.size / 1024 / 1024)} Mo) : utilisez de préférence un ordinateur avec au moins 8 Go de RAM.
          </div>
        )}

        <main ref={mainRef} className="flex flex-1 min-h-0">
          <div className="min-w-0 flex-1">
            <DxfViewerPanel file={file} isolatedLayer={isolatedLayer} onLoaded={handleLoaded} onError={handleError} onPickLayer={handlePickLayer} />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startResize}
            title="Glisser pour redimensionner"
            className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400"
          />
          <div className="min-h-0 shrink-0" style={{ width: `${rightWidth}px` }}>
            <DxfMappingPanel
              summary={summary}
              projectItems={projectItems}
              mappings={mappings}
              onMappingsChange={setMappings}
              scaleToMeters={scaleToMeters}
              onScaleChange={setScaleToMeters}
              isolatedLayer={isolatedLayer}
              onIsolateLayer={setIsolatedLayer}
              pick={pick}
            />
          </div>
        </main>

        {/* pr-20 : dégage le coin bas-droite occupé par le FAB feedback (z-9998, fixe viewport) */}
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 py-3 pl-5 pr-20">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl bg-gray-200/70 p-0.5">
              <button type="button" onClick={() => setApplyMode('replace')} className={`rounded-[10px] px-3 py-1.5 text-[11px] font-semibold ${applyMode === 'replace' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Remplacer</button>
              <button type="button" onClick={() => setApplyMode('add')} className={`rounded-[10px] px-3 py-1.5 text-[11px] font-semibold ${applyMode === 'add' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Ajouter</button>
            </div>
            <span className="text-[11px] text-gray-500">
              {selectedMappings.length} association(s) prête(s)
              {targetTrancheId && ` · ${project.tranches.find((tranche) => tranche.id === targetTrancheId)?.name || targetTrancheId}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {trancheMissing && <span className="text-[10px] font-semibold text-amber-700">Sélectionnez une tranche dans l’Estimation</span>}
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200">Annuler</button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!summary}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Layers3 size={15} /> Appliquer au DQE
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

DxfTakeoffModal.propTypes = {
  project: PropTypes.object.isRequired,
  companyId: PropTypes.string,
  activeTrancheId: PropTypes.string,
  onApply: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  visible: PropTypes.bool,
  onUnload: PropTypes.func,
};
