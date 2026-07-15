import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Crosshair, Eye, Loader2, MousePointer2 } from 'lucide-react';
import { Color } from 'three';
import { DxfViewer } from 'dxf-viewer';
import dxfFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';

const PHASE_LABELS = {
  fetch: 'Lecture du fichier',
  parse: 'Analyse des entités',
  prepare: 'Préparation du plan',
  font: 'Chargement des textes',
};

export default function DxfViewerPanel({ file, isolatedLayer, onLoaded, onError }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const layersRef = useRef([]);
  const fitBoundsRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const viewer = new DxfViewer(containerRef.current, {
      autoResize: true,
      clearColor: new Color(0xf8fafc),
      clearAlpha: 1,
      antialias: true,
      colorCorrection: true,
      blackWhiteInversion: true,
      retainParsedDxf: false,
      fileEncoding: 'utf-8',
      sceneOptions: { suppressPaperSpace: true },
    });
    viewerRef.current = viewer;
    return () => {
      viewer.Destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !file) return undefined;
    const objectUrl = URL.createObjectURL(file);
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setProgress({ phase: 'fetch', processed: 0, total: file.size });
      try {
        await viewer.Load({
          url: objectUrl,
          fonts: [dxfFontUrl],
          workerFactory: () => new Worker(
            new URL('../../workers/dxfTakeoff.worker.js', import.meta.url),
            { type: 'module' },
          ),
          progressCbk: (phase, processed, total) => {
            if (!cancelled) setProgress({ phase, processed, total: total || file.size });
          },
        });
        if (cancelled) return;
        const layers = Array.from(viewer.GetLayers(true));
        const takeoffSummary = viewer.GetDxf?.() || null;
        fitBoundsRef.current = takeoffSummary?.metadata?.fitBounds || viewer.GetBounds();
        const origin = viewer.GetOrigin();
        const fitBounds = fitBoundsRef.current;
        if (fitBounds && origin) {
          viewer.FitView(
            fitBounds.minX - origin.x,
            fitBounds.maxX - origin.x,
            fitBounds.minY - origin.y,
            fitBounds.maxY - origin.y,
            0.08,
          );
        }
        layersRef.current = layers;
        setProgress(null);
        onLoaded(takeoffSummary, layers);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
        onError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, onError, onLoaded]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || layersRef.current.length === 0) return;
    for (const layer of layersRef.current) {
      viewer.ShowLayer(layer.name, !isolatedLayer || layer.name === isolatedLayer);
    }
  }, [isolatedLayer]);

  const fitDrawing = () => {
    const viewer = viewerRef.current;
    const bounds = fitBoundsRef.current || viewer?.GetBounds();
    const origin = viewer?.GetOrigin();
    if (!viewer || !bounds || !origin) return;
    viewer.FitView(
      bounds.minX - origin.x,
      bounds.maxX - origin.x,
      bounds.minY - origin.y,
      bounds.maxY - origin.y,
      0.04,
    );
  };

  const percent = progress?.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : null;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-50 border-r border-gray-200">
      <div ref={containerRef} className="h-full min-h-0 w-full" />

      {!file && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
          <MousePointer2 size={38} strokeWidth={1.2} />
          <p className="mt-3 text-sm font-semibold text-slate-600">Sélectionnez un fichier DXF</p>
          <p className="mt-1 text-xs">Le plan sera traité localement dans le navigateur.</p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{PHASE_LABELS[progress?.phase] || 'Analyse du DXF'}</p>
                <p className="text-xs text-gray-500">Les gros plans peuvent demander plusieurs minutes.</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full bg-blue-600 transition-all ${percent == null ? 'w-1/3 animate-pulse' : ''}`}
                style={percent == null ? undefined : { width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-right text-[11px] font-medium text-gray-500">
              {percent == null ? 'Traitement…' : `${percent} %`}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-6 top-6 z-30 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-lg">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold">Le DXF n’a pas pu être ouvert</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        </div>
      )}

      {file && !loading && !error && (
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={fitDrawing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          >
            <Crosshair size={15} /> Cadrer
          </button>
          {isolatedLayer && (
            <span className="inline-flex max-w-[360px] items-center gap-2 truncate rounded-xl border border-blue-200 bg-blue-50/95 px-3 py-2 text-xs font-semibold text-blue-700">
              <Eye size={15} /> {isolatedLayer}
            </span>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-gray-900/85 px-3 py-1.5 text-[10px] text-white backdrop-blur">
        Molette : zoom · Clic milieu : déplacer
      </div>
    </div>
  );
}

DxfViewerPanel.propTypes = {
  file: PropTypes.instanceOf(File),
  isolatedLayer: PropTypes.string,
  onLoaded: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};
