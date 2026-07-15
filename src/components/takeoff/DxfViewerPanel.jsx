import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle, Crosshair, Eye, Loader2, MousePointer2, X,
} from 'lucide-react';
import { Color, Vector3 } from 'three';
import { DxfViewer } from 'dxf-viewer';
import dxfFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import {
  createMemorySceneWorker,
  getCameraBounds,
  panViewByPixels,
  renderLayoutViewports,
  renderModelView,
  zoomViewAtCanvasPoint,
} from './dxfLayoutRendering';

// Rayon de capture du clic/survol, en pixels écran (converti en unités monde selon le zoom)
const PICK_TOLERANCE_PX = 12;

const PHASE_LABELS = {
  fetch: 'Lecture du fichier',
  parse: 'Analyse des entités',
  prepare: 'Préparation du plan',
  font: 'Chargement des textes',
  layouts: 'Préparation des présentations',
};

function fitViewer(viewer, bounds, padding = 0.06) {
  const origin = viewer?.GetOrigin();
  if (!viewer || !bounds || !origin) return;
  viewer.FitView(
    bounds.minX - origin.x,
    bounds.maxX - origin.x,
    bounds.minY - origin.y,
    bounds.maxY - origin.y,
    padding,
  );
}

export default function DxfViewerPanel({
  file, isolatedLayer, onLoaded, onError, onPickLayer,
}) {
  const modelContainerRef = useRef(null);
  const paperContainerRef = useRef(null);
  const modelViewerRef = useRef(null);
  const paperViewerRef = useRef(null);
  const layersRef = useRef([]);
  const fitBoundsRef = useRef(null);
  const renderActiveRef = useRef(null);
  const paperLoadSequenceRef = useRef(0);
  const presentationFitWidthRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paperLoading, setPaperLoading] = useState(false);
  const [error, setError] = useState('');
  const [layouts, setLayouts] = useState([]);
  const [activeLayoutId, setActiveLayoutId] = useState('model');
  const [isPanning, setIsPanning] = useState(false);
  const [hover, setHover] = useState(null);

  const activeLayout = useMemo(
    () => layouts.find((layout) => layout.id === activeLayoutId) || null,
    [activeLayoutId, layouts],
  );

  const renderActive = useCallback(() => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer?.GetOrigin()) return;
    if (activeLayout) {
      renderLayoutViewports(
        modelViewer,
        paperViewerRef.current,
        activeLayout,
        isolatedLayer,
      );
    } else {
      renderModelView(modelViewer, isolatedLayer);
    }
  }, [activeLayout, isolatedLayer]);

  useEffect(() => {
    renderActiveRef.current = renderActive;
  }, [renderActive]);

  useEffect(() => {
    if (!modelContainerRef.current || !paperContainerRef.current) return undefined;
    const paperViewer = new DxfViewer(paperContainerRef.current, {
      autoResize: true,
      clearColor: new Color(0xf8fafc),
      clearAlpha: 1,
      antialias: true,
      colorCorrection: true,
      blackWhiteInversion: true,
      retainParsedDxf: false,
      sceneOptions: { suppressPaperSpace: false },
    });
    const modelViewer = new DxfViewer(modelContainerRef.current, {
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
    const handleResize = () => requestAnimationFrame(() => renderActiveRef.current?.());
    modelViewer.Subscribe('resized', handleResize);
    paperViewer.Subscribe('resized', handleResize);
    modelViewerRef.current = modelViewer;
    paperViewerRef.current = paperViewer;

    return () => {
      modelViewer.Unsubscribe('resized', handleResize);
      paperViewer.Unsubscribe('resized', handleResize);
      modelViewer.Destroy();
      paperViewer.Destroy();
      modelViewerRef.current = null;
      paperViewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer || !file) return undefined;
    const objectUrl = URL.createObjectURL(file);
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setPaperLoading(false);
      setError('');
      setLayouts([]);
      setActiveLayoutId('model');
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
        // Tampon du calque sur chaque objet rendu → picking au clic/survol (vue Modèle)
        for (const [name, layer] of viewer.layers || []) {
          for (const object of layer.objects || []) {
            if (object.userData) object.userData.dxfLayer = name;
          }
        }
        const takeoffSummary = viewer.GetDxf?.() || null;
        fitBoundsRef.current = takeoffSummary?.metadata?.fitBounds || viewer.GetBounds();
        fitViewer(viewer, fitBoundsRef.current, 0.08);
        layersRef.current = layers;
        setLayouts(takeoffSummary?.layouts || []);
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
      paperLoadSequenceRef.current += 1;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, onError, onLoaded]);

  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    const paperViewer = paperViewerRef.current;
    if (!modelViewer || !paperViewer || loading) return undefined;

    if (!activeLayout) {
      setPaperLoading(false);
      requestAnimationFrame(renderActive);
      return undefined;
    }

    const sequence = paperLoadSequenceRef.current + 1;
    paperLoadSequenceRef.current = sequence;
    let cancelled = false;
    const loadPaper = async () => {
      setPaperLoading(true);
      try {
        await paperViewer.Load({
          url: `memory:${activeLayout.id}`,
          workerFactory: () => createMemorySceneWorker(activeLayout.paperScene),
        });
        if (cancelled || paperLoadSequenceRef.current !== sequence) return;
        fitViewer(paperViewer, activeLayout.paperBounds || paperViewer.GetBounds(), 0.06);
        const fittedBounds = getCameraBounds(paperViewer.GetCamera());
        presentationFitWidthRef.current = fittedBounds.maxX - fittedBounds.minX;
        paperViewer.Render();
        requestAnimationFrame(renderActive);
      } catch (paperError) {
        if (!cancelled) {
          const message = paperError instanceof Error ? paperError.message : String(paperError);
          setError(`Présentation impossible à afficher : ${message}`);
        }
      } finally {
        if (!cancelled && paperLoadSequenceRef.current === sequence) setPaperLoading(false);
      }
    };
    loadPaper();

    return () => {
      cancelled = true;
    };
  }, [activeLayout, loading, renderActive]);

  useEffect(() => {
    if (loading || paperLoading) return;
    requestAnimationFrame(renderActive);
  }, [isolatedLayer, loading, paperLoading, renderActive]);

  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    const paperViewer = paperViewerRef.current;
    const canvas = modelViewer?.GetCanvas();
    if (!modelViewer || !paperViewer || !canvas || !activeLayout || paperLoading) {
      if (modelViewer?.controls) modelViewer.controls.enabled = true;
      return undefined;
    }

    if (modelViewer.controls) modelViewer.controls.enabled = false;
    let drag = null;
    const draw = () => requestAnimationFrame(() => renderActiveRef.current?.());
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const camera = paperViewer.GetCamera();
      const rect = canvas.getBoundingClientRect();
      const currentBounds = getCameraBounds(camera);
      const fitWidth = presentationFitWidthRef.current
        || (currentBounds.maxX - currentBounds.minX);
      const view = zoomViewAtCanvasPoint(
        currentBounds,
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        rect.width,
        rect.height,
        Math.exp(event.deltaY * 0.0015),
        fitWidth * 0.02,
        fitWidth * 20,
      );
      if (!view) return;
      paperViewer.SetView(view.center, view.width);
      draw();
    };
    const handlePointerDown = (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        bounds: getCameraBounds(paperViewer.GetCamera()),
      };
      canvas.setPointerCapture?.(event.pointerId);
      setIsPanning(true);
    };
    const handlePointerMove = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const view = panViewByPixels(
        drag.bounds,
        event.clientX - drag.startX,
        event.clientY - drag.startY,
        rect.width,
        rect.height,
      );
      if (!view) return;
      paperViewer.SetView(view.center, view.width);
      draw();
    };
    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      canvas.releasePointerCapture?.(event.pointerId);
      drag = null;
      setIsPanning(false);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', finishDrag);
      canvas.removeEventListener('pointercancel', finishDrag);
      if (modelViewer.controls) modelViewer.controls.enabled = true;
      setIsPanning(false);
    };
  }, [activeLayout, paperLoading]);

  // Clic pour isoler le calque + survol du nom (vue Modèle uniquement)
  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    const canvas = modelViewer?.GetCanvas();
    if (!modelViewer || !canvas || activeLayout || loading || paperLoading) {
      setHover(null);
      return undefined;
    }

    let frame = null;
    let pending = null;
    let down = null;
    const scratch = new Vector3();

    // Coût d'une recherche écran complète : au survol on l'évite si la scène est lourde
    let lineVertexTotal = 0;
    for (const obj of modelViewer.GetScene().children) {
      if ((obj.type === 'LineSegments' || obj.type === 'Points') && !obj.geometry?.isInstancedBufferGeometry) {
        lineVertexTotal += obj.geometry?.attributes?.position?.count || 0;
      }
    }
    const heavyScene = lineVertexTotal > 120000;

    const distSegPx = (px, py, ax, ay, bx, by) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const qx = ax + t * dx;
      const qy = ay + t * dy;
      return Math.hypot(px - qx, py - qy);
    };

    const pointInTri = (px, py, ax, ay, bx, by, cx, cy) => {
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx)
        || !Number.isFinite(by) || !Number.isFinite(cx) || !Number.isFinite(cy)) return false;
      const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
      const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
      const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(hasNeg && hasPos);
    };

    // Picking 100 % projection écran (le raycaster de Three.js ne capte pas les traits de
    // dxf-viewer et déclenche computeBoundingSphere sur des positions NaN → warnings en boucle).
    // Lignes/points = distance au segment ; surfaces pleines = point-dans-triangle.
    // Blocs instanciés et triangles NaN ignorés.
    const pickAt = (clientX, clientY, doLines, doMeshes) => {
      const camera = modelViewer.GetCamera();
      const scene = modelViewer.GetScene();
      if (!camera || !scene) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      const toPxX = (v) => (v * 0.5 + 0.5) * width;
      const toPxY = (v) => (-v * 0.5 + 0.5) * height;

      if (doLines) {
        let bestLayer = null;
        let bestDist = PICK_TOLERANCE_PX;
        for (const obj of scene.children) {
          if (!obj.visible) continue;
          const geo = obj.geometry;
          const pos = geo?.attributes?.position;
          const layer = obj.userData?.dxfLayer;
          if (!pos || !layer || geo.isInstancedBufferGeometry) continue;
          const isLine = obj.type === 'LineSegments';
          const isPoints = obj.type === 'Points';
          if (!isLine && !isPoints) continue;
          const idx = geo.index;
          if (isLine) {
            const count = idx ? idx.count : pos.count;
            for (let i = 0; i + 1 < count; i += 2) {
              const i0 = idx ? idx.getX(i) : i;
              const i1 = idx ? idx.getX(i + 1) : i + 1;
              scratch.set(pos.getX(i0), pos.getY(i0), 0).project(camera);
              const ax = toPxX(scratch.x);
              const ay = toPxY(scratch.y);
              scratch.set(pos.getX(i1), pos.getY(i1), 0).project(camera);
              const d = distSegPx(px, py, ax, ay, toPxX(scratch.x), toPxY(scratch.y));
              if (d < bestDist) { bestDist = d; bestLayer = layer; }
            }
          } else {
            for (let i = 0; i < pos.count; i += 1) {
              scratch.set(pos.getX(i), pos.getY(i), 0).project(camera);
              const d = Math.hypot(px - toPxX(scratch.x), py - toPxY(scratch.y));
              if (d < bestDist) { bestDist = d; bestLayer = layer; }
            }
          }
        }
        if (bestLayer) return { layer: bestLayer, px, py };
      }

      if (doMeshes) {
        for (const obj of scene.children) {
          if (!obj.visible || obj.type !== 'Mesh') continue;
          const geo = obj.geometry;
          const pos = geo?.attributes?.position;
          const layer = obj.userData?.dxfLayer;
          if (!pos || !layer || geo.isInstancedBufferGeometry) continue;
          const idx = geo.index;
          const count = idx ? idx.count : pos.count;
          for (let i = 0; i + 2 < count; i += 3) {
            const i0 = idx ? idx.getX(i) : i;
            const i1 = idx ? idx.getX(i + 1) : i + 1;
            const i2 = idx ? idx.getX(i + 2) : i + 2;
            scratch.set(pos.getX(i0), pos.getY(i0), 0).project(camera);
            const ax = toPxX(scratch.x);
            const ay = toPxY(scratch.y);
            scratch.set(pos.getX(i1), pos.getY(i1), 0).project(camera);
            const bx = toPxX(scratch.x);
            const by = toPxY(scratch.y);
            scratch.set(pos.getX(i2), pos.getY(i2), 0).project(camera);
            if (pointInTri(px, py, ax, ay, bx, by, toPxX(scratch.x), toPxY(scratch.y))) {
              return { layer, px, py };
            }
          }
        }
      }
      return null;
    };

    const runHover = () => {
      frame = null;
      if (!pending) return;
      const found = pickAt(pending.x, pending.y, !heavyScene, false);
      pending = null;
      setHover(found);
      canvas.style.cursor = found ? 'pointer' : 'crosshair';
    };

    const handleMove = (event) => {
      pending = { x: event.clientX, y: event.clientY };
      if (frame == null) frame = requestAnimationFrame(runHover);
    };
    const handleLeave = () => {
      pending = null;
      setHover(null);
      canvas.style.cursor = '';
    };
    const handleDown = (event) => {
      if (event.button === 0) down = { x: event.clientX, y: event.clientY };
    };
    const handleUp = (event) => {
      if (event.button !== 0 || !down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      if (moved > 4) return; // c'était un déplacement, pas un clic
      const found = pickAt(event.clientX, event.clientY, true, true);
      onPickLayer(found ? found.layer : '');
    };

    canvas.addEventListener('pointermove', handleMove);
    canvas.addEventListener('pointerleave', handleLeave);
    canvas.addEventListener('pointerdown', handleDown);
    canvas.addEventListener('pointerup', handleUp);
    canvas.style.cursor = 'crosshair';
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerleave', handleLeave);
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.style.cursor = '';
      setHover(null);
    };
  }, [activeLayout, loading, paperLoading, onPickLayer]);

  const fitDrawing = () => {
    if (activeLayout) {
      const paperViewer = paperViewerRef.current;
      fitViewer(paperViewer, activeLayout.paperBounds || paperViewer?.GetBounds(), 0.06);
      const fittedBounds = getCameraBounds(paperViewer.GetCamera());
      presentationFitWidthRef.current = fittedBounds.maxX - fittedBounds.minX;
      paperViewer?.Render();
      requestAnimationFrame(renderActive);
      return;
    }
    fitViewer(modelViewerRef.current, fitBoundsRef.current || modelViewerRef.current?.GetBounds(), 0.04);
  };

  const percent = progress?.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : null;
  return (
    <div className="relative h-full min-h-0 overflow-hidden border-r border-gray-200 bg-slate-50">
      <div data-dxf-layer="paper" className="absolute inset-0 invisible">
        <div ref={paperContainerRef} className="h-full min-h-0 w-full pointer-events-none" />
      </div>
      <div data-dxf-layer="model" className={`absolute inset-0 z-[1] ${activeLayout ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}>
        <div ref={modelContainerRef} className="h-full min-h-0 w-full" />
      </div>

      {!file && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center text-slate-400 pointer-events-none">
          <MousePointer2 size={38} strokeWidth={1.2} />
          <p className="mt-3 text-sm font-semibold text-slate-600">Sélectionnez un fichier DXF</p>
          <p className="mt-1 text-xs">Le plan sera traité localement dans le navigateur.</p>
        </div>
      )}

      {(loading || paperLoading) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {paperLoading ? `Ouverture de « ${activeLayout?.name} »` : (PHASE_LABELS[progress?.phase] || 'Analyse du DXF')}
                </p>
                <p className="text-xs text-gray-500">Les gros plans peuvent demander plusieurs minutes.</p>
              </div>
            </div>
            {!paperLoading && (
              <>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full bg-blue-600 transition-all ${percent == null ? 'w-1/3 animate-pulse' : ''}`}
                    style={percent == null ? undefined : { width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-right text-[11px] font-medium text-gray-500">
                  {percent == null ? 'Traitement…' : `${percent} %`}
                </p>
              </>
            )}
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
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fitDrawing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          >
            <Crosshair size={15} /> Cadrer
          </button>
          {isolatedLayer && (
            <button
              type="button"
              onClick={() => onPickLayer('')}
              title="Afficher tous les calques"
              className="inline-flex max-w-[360px] items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/95 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Eye size={15} className="shrink-0" />
              <span className="truncate">{isolatedLayer}</span>
              <X size={15} className="shrink-0" />
            </button>
          )}
          {activeLayout?.simplified && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs font-semibold text-amber-700">
              <AlertTriangle size={14} /> Aperçu simplifié
            </span>
          )}
        </div>
      )}


      {file && !loading && !error && (
        <>
          {hover && !activeLayout && (
            <div
              className="pointer-events-none absolute z-30 max-w-[280px] -translate-y-full truncate rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
              style={{ left: hover.px + 12, top: hover.py }}
            >
              {hover.layer}
            </div>
          )}
          <div className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-gray-900/85 px-3 py-1.5 text-[10px] text-white backdrop-blur">
            {activeLayout ? 'Molette : zoom · Clic milieu : déplacer · Présentation en lecture seule' : 'Molette : zoom · Clic : isoler le calque · Survol : nom du calque'}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white/95 px-2 py-2 backdrop-blur-xl">
            <div className="flex gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveLayoutId('model')}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${activeLayoutId === 'model' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Modèle
              </button>
              {layouts.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setActiveLayoutId(layout.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${activeLayoutId === layout.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  title={layout.name}
                >
                  {layout.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

DxfViewerPanel.propTypes = {
  file: PropTypes.instanceOf(File),
  isolatedLayer: PropTypes.string,
  onLoaded: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  onPickLayer: PropTypes.func.isRequired,
};
