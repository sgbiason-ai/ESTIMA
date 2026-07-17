import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle, CircleDot, Crosshair, Eye, Hash, Loader2, MousePointer2, Spline, Square, X,
} from 'lucide-react';
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LineBasicMaterial, LineSegments,
  Mesh, MeshBasicMaterial, Points, PointsMaterial, Scene, Vector3,
} from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
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
import {
  buildEntityGrid, buildHighlightBuffers, collectEntityBounds, hitTestEntities,
} from './dxfEntityPicking';
import { DXF_TYPE_LABELS, entityLookup } from '../../utils/takeoff/dxfTakeoff';

// Rayon de capture du clic/survol, en pixels écran (converti en unités monde selon le zoom)
const PICK_TOLERANCE_PX = 12;

const PHASE_LABELS = {
  fetch: 'Lecture du fichier',
  parse: 'Analyse des entités',
  prepare: 'Préparation du plan',
  font: 'Chargement des textes',
  layouts: 'Préparation des présentations',
};

const formatMeasure = (value) => Number(value || 0).toLocaleString('fr-FR', {
  maximumFractionDigits: 2,
});

// Modes de sélection d'éléments, alignés sur les métriques du métré (cf. METRIC_LABELS).
const SELECTION_MODES = [
  { key: 'length', label: 'Linéaire', Icon: Spline, title: 'Mesurer des longueurs élément par élément (clic sur le tracé)' },
  { key: 'area', label: 'Surfaces', Icon: Square, title: 'Mesurer des surfaces fermées (clic sur le contour ou à l’intérieur)' },
  { key: 'count', label: 'Comptage', Icon: CircleDot, title: 'Compter des éléments : blocs, points, cercles' },
];

// Remplace intégralement la géométrie d'un objet de surlignage (pas de fuite GPU).
function applyOverlayPositions(object, positions) {
  object.geometry.dispose();
  object.geometry = new BufferGeometry();
  object.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  object.visible = positions.length > 0;
}

function applyWideOverlayPositions(object, positions) {
  object.geometry.dispose();
  object.geometry = new LineSegmentsGeometry();
  if (positions.length > 0) object.geometry.setPositions(Array.from(positions));
  object.visible = positions.length > 0;
}

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
  selectionMode = '', onSelectionModeChange = () => {}, highlightedEntityIds = [],
  measuredEntityGroups = [],
  onPickEntity = () => {}, selectionSummary = null, onCreateSelectionRow = () => {},
  onClearSelection = () => {}, focusEntities = null, scaleToMeters = 1,
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
  const entityIndexRef = useRef(null);
  const entityGridRef = useRef(null);
  const overlayRef = useRef(null);
  const fillCanvasRef = useRef(null);
  // Miroir des ids surlignés pour le hit-test (évite de ré-abonner les listeners à chaque clic)
  const highlightedIdsRef = useRef(highlightedEntityIds);
  highlightedIdsRef.current = highlightedEntityIds;
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paperLoading, setPaperLoading] = useState(false);
  const [error, setError] = useState('');
  const [layouts, setLayouts] = useState([]);
  const [activeLayoutId, setActiveLayoutId] = useState('model');
  const [isPanning, setIsPanning] = useState(false);
  const [hover, setHover] = useState(null);
  const [hideFills, setHideFills] = useState(true);
  // 'ok' = sélection possible · 'skipped' = plan trop volumineux · 'none' = rien à sélectionner
  const [selectionAvailability, setSelectionAvailability] = useState('none');
  // Métriques réellement présentes dans l'index → n'afficher que les modes utiles
  const [metricAvailability, setMetricAvailability] = useState({ length: false, area: false, count: false });

  const activeLayout = useMemo(
    () => layouts.find((layout) => layout.id === activeLayoutId) || null,
    [activeLayoutId, layouts],
  );

  const renderMeasuredFills = useCallback((viewer) => {
    const canvas = fillCanvasRef.current;
    const container = modelContainerRef.current;
    const index = entityIndexRef.current;
    const camera = viewer?.GetCamera?.();
    const viewerOrigin = viewer?.GetOrigin?.();
    if (!canvas || !container) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (activeLayout || !index || !camera || !viewerOrigin) return;

    const lookup = entityLookup(index);
    if (!lookup) return;
    const shiftX = index.origin.x - (viewerOrigin.x || 0);
    const shiftY = index.origin.y - (viewerOrigin.y || 0);
    const point = new Vector3();
    const toCanvas = (pair) => {
      point.set(index.points[pair * 2] + shiftX, index.points[pair * 2 + 1] + shiftY, 0);
      point.project(camera);
      return { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height };
    };

    context.save();
    context.globalAlpha = 0.25;
    for (const group of measuredEntityGroups || []) {
      context.fillStyle = group.color;
      for (const entityId of group.entityIds || []) {
        const rank = lookup.get(entityId);
        if (rank == null || index.areas[rank] <= 0) continue;
        const start = index.pointOffsets[rank];
        const end = index.pointOffsets[rank + 1];
        if (end - start < 4) continue;
        context.beginPath();
        const first = toCanvas(start);
        context.moveTo(first.x, first.y);
        for (let pair = start + 1; pair < end; pair += 1) {
          const current = toCanvas(pair);
          context.lineTo(current.x, current.y);
        }
        context.closePath();
        context.fill('evenodd');
      }
    }
    context.restore();
  }, [activeLayout, measuredEntityGroups]);

  const renderActive = useCallback(() => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer?.GetOrigin()) return;
    if (activeLayout) {
      renderLayoutViewports(
        modelViewer,
        paperViewerRef.current,
        activeLayout,
        isolatedLayer,
        hideFills,
      );
    } else {
      renderModelView(modelViewer, isolatedLayer, hideFills);
      const overlay = overlayRef.current;
      const renderer = modelViewer.GetRenderer?.();
      const camera = modelViewer.GetCamera?.();
      if (overlay?.fillScene && overlay?.strokeScene && renderer && camera) {
        // dxf-viewer trie/dessine ses propres lots avec un pipeline non conventionnel.
        // Les overlays sont donc rendus explicitement après le plan : aplats puis contours.
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.resetState();
        renderer.render(overlay.strokeScene, camera);
        renderer.resetState();
        renderer.autoClear = autoClear;
      }
      renderMeasuredFills(modelViewer);
    }
  }, [activeLayout, isolatedLayer, hideFills, renderMeasuredFills]);

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
    const handleViewChanged = () => requestAnimationFrame(() => renderActiveRef.current?.());
    modelViewer.Subscribe('resized', handleResize);
    modelViewer.Subscribe('viewChanged', handleViewChanged);
    paperViewer.Subscribe('resized', handleResize);
    modelViewerRef.current = modelViewer;
    paperViewerRef.current = paperViewer;

    return () => {
      modelViewer.Unsubscribe('resized', handleResize);
      modelViewer.Unsubscribe('viewChanged', handleViewChanged);
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
      entityIndexRef.current = null;
      entityGridRef.current = null;
      setSelectionAvailability('none');
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
        const entityIndex = takeoffSummary?.entityIndex || null;
        entityIndexRef.current = entityIndex?.ids ? entityIndex : null;
        setSelectionAvailability(() => {
          if (entityIndex?.ids) return 'ok';
          return entityIndex?.skipped ? 'skipped' : 'none';
        });
        const available = { length: false, area: false, count: false };
        if (entityIndex?.ids) {
          for (let rank = 0; rank < entityIndex.count; rank += 1) {
            if (entityIndex.lengths[rank] > 0) available.length = true;
            if (entityIndex.areas[rank] > 0) available.area = true;
            if (entityIndex.counts[rank] > 0) available.count = true;
            if (available.length && available.area && available.count) break;
          }
        }
        setMetricAvailability(available);
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

  // La sélection d'élément n'existe qu'en vue Modèle : quitter le mode en présentation.
  useEffect(() => {
    if (activeLayout && selectionMode) onSelectionModeChange('');
  }, [activeLayout, selectionMode, onSelectionModeChange]);

  useEffect(() => {
    if (!selectionMode) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onSelectionModeChange('');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectionMode, onSelectionModeChange]);

  // Surlignage des entités (sélection en orange, survol en bleu) par-dessus le plan.
  useEffect(() => {
    const viewer = modelViewerRef.current;
    const scene = viewer?.GetScene?.();
    const origin = viewer?.GetOrigin?.();
    if (!viewer || !scene || !origin || loading) return;

    let overlay = overlayRef.current;
    if (overlay && (!overlay.fillScene || !overlay.strokeScene)) {
      for (const object of [overlay.line, overlay.marker, overlay.hoverLine, overlay.hoverMarker]) {
        object?.parent?.remove(object);
        object?.geometry?.dispose();
        object?.material?.dispose();
      }
      for (const objects of overlay.measurements?.values?.() || []) {
        for (const object of [objects.line, objects.marker, objects.fill]) {
          object?.parent?.remove(object);
          object?.geometry?.dispose();
          object?.material?.dispose();
        }
      }
      overlay = null;
      overlayRef.current = null;
    }
    if (!overlay) {
      const make = (Ctor, material) => {
        const object = new Ctor(new BufferGeometry(), material);
        object.frustumCulled = false;
        object.renderOrder = 50;
        object.visible = false;
        return object;
      };
      overlay = {
        fillScene: new Scene(),
        strokeScene: new Scene(),
        measurements: new Map(),
        line: make(LineSegments, new LineBasicMaterial({ color: 0xf97316, depthTest: false })),
        marker: make(Points, new PointsMaterial({
          color: 0xf97316, size: 9, sizeAttenuation: false, depthTest: false,
        })),
        hoverLine: make(LineSegments, new LineBasicMaterial({ color: 0x2563eb, depthTest: false })),
        hoverMarker: make(Points, new PointsMaterial({
          color: 0x2563eb, size: 9, sizeAttenuation: false, depthTest: false,
        })),
      };
      overlayRef.current = overlay;
    }
    for (const object of [overlay.line, overlay.marker, overlay.hoverLine, overlay.hoverMarker]) {
      if (object.parent !== overlay.strokeScene) overlay.strokeScene.add(object);
    }

    const index = entityIndexRef.current;
    const emptyBuffers = {
      linePositions: new Float32Array(0),
      fillPositions: new Float32Array(0),
      markerPositions: new Float32Array(0),
    };
    const activeMeasurementIds = new Set();
    for (const group of measuredEntityGroups || []) {
      activeMeasurementIds.add(group.id);
      let objects = overlay.measurements.get(group.id);
      // Une recharge du DXF vide la scène Three.js sans vider nos refs. De même, Fast Refresh
      // peut conserver un ancien overlay créé avant l'ajout du remplissage. Dans les deux cas,
      // on recrée/rattache explicitement les trois objets du métré.
      if (objects && !objects.fill) {
        for (const object of [objects.line, objects.marker]) {
          object.parent?.remove(object);
          object.geometry.dispose();
          object.material.dispose();
        }
        overlay.measurements.delete(group.id);
        objects = null;
      }
      if (!objects) {
        const line = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({
          color: group.color,
          linewidth: 4,
          depthTest: false,
          transparent: true,
          opacity: 0.9,
        }));
        const marker = new Points(new BufferGeometry(), new PointsMaterial({
          color: group.color, size: 11, sizeAttenuation: false, depthTest: false,
        }));
        const fill = new Mesh(new BufferGeometry(), new MeshBasicMaterial({
          color: group.color,
          transparent: true,
          opacity: 0.25,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        }));
        for (const object of [fill, line, marker]) {
          object.frustumCulled = false;
          object.renderOrder = object === fill ? 44 : 45;
          object.visible = false;
        }
        overlay.fillScene.add(fill);
        overlay.strokeScene.add(line, marker);
        objects = { line, marker, fill };
        overlay.measurements.set(group.id, objects);
      }
      if (objects.fill.parent !== overlay.fillScene) overlay.fillScene.add(objects.fill);
      if (objects.line.parent !== overlay.strokeScene) overlay.strokeScene.add(objects.line);
      if (objects.marker.parent !== overlay.strokeScene) overlay.strokeScene.add(objects.marker);
      objects.line.material.color.set(group.color);
      objects.marker.material.color.set(group.color);
      objects.fill.material.color.set(group.color);
      objects.line.material.resolution.set(
        modelContainerRef.current?.clientWidth || 1,
        modelContainerRef.current?.clientHeight || 1,
      );
      const measuredIds = index && !activeLayout ? group.entityIds || [] : [];
      const measuredBuffers = index ? buildHighlightBuffers(index, measuredIds, origin) : emptyBuffers;
      applyWideOverlayPositions(objects.line, measuredBuffers.linePositions);
      applyOverlayPositions(objects.fill, measuredBuffers.fillPositions);
      applyOverlayPositions(objects.marker, measuredBuffers.markerPositions);
    }
    for (const [groupId, objects] of overlay.measurements) {
      if (activeMeasurementIds.has(groupId)) continue;
      objects.line.visible = false;
      objects.marker.visible = false;
      objects.fill.visible = false;
    }

    const selectedIds = index && !activeLayout ? highlightedEntityIds || [] : [];
    const selectedBuffers = index ? buildHighlightBuffers(index, selectedIds, origin) : emptyBuffers;
    applyOverlayPositions(overlay.line, selectedBuffers.linePositions);
    applyOverlayPositions(overlay.marker, selectedBuffers.markerPositions);

    const hoverIds = index && !activeLayout && hover?.kind === 'entity' ? [index.ids[hover.rank]] : [];
    const hoverBuffers = index ? buildHighlightBuffers(index, hoverIds, origin) : emptyBuffers;
    applyOverlayPositions(overlay.hoverLine, hoverBuffers.linePositions);
    applyOverlayPositions(overlay.hoverMarker, hoverBuffers.markerPositions);

    requestAnimationFrame(renderActive);
  }, [highlightedEntityIds, measuredEntityGroups, hover, activeLayout, loading, renderActive]);

  useEffect(() => () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    for (const object of [overlay.line, overlay.marker, overlay.hoverLine, overlay.hoverMarker]) {
      object.parent?.remove(object);
      object.geometry.dispose();
      object.material.dispose();
    }
    for (const objects of overlay.measurements.values()) {
      for (const object of [objects.line, objects.marker, objects.fill]) {
        object.parent?.remove(object);
        object.geometry.dispose();
        object.material.dispose();
      }
    }
    overlayRef.current = null;
  }, []);

  useEffect(() => {
    const container = modelContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const measurements = overlayRef.current?.measurements;
      if (!measurements) return;
      for (const objects of measurements.values()) {
        objects.line.material.resolution.set(container.clientWidth || 1, container.clientHeight || 1);
      }
      requestAnimationFrame(renderActive);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderActive]);

  // Œil d'une sélection dans la liste : recadrer la vue Modèle sur ses éléments.
  useEffect(() => {
    if (!focusEntities?.nonce || !(focusEntities.ids || []).length) return;
    const viewer = modelViewerRef.current;
    const index = entityIndexRef.current;
    if (!viewer?.GetOrigin?.() || !index) return;
    const bounds = collectEntityBounds(index, focusEntities.ids);
    if (!bounds) return;
    setActiveLayoutId('model');
    const pad = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1) * 0.25;
    fitViewer(viewer, {
      minX: bounds.minX - pad,
      maxX: bounds.maxX + pad,
      minY: bounds.minY - pad,
      maxY: bounds.maxY + pad,
    }, 0.1);
    requestAnimationFrame(() => renderActiveRef.current?.());
  }, [focusEntities]);

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

    // Hit-test de l'index d'entités : curseur → monde (caméra ortho) → repère de l'index.
    const hitEntity = (clientX, clientY) => {
      const index = entityIndexRef.current;
      if (!index) return -1;
      const camera = modelViewer.GetCamera();
      const origin = modelViewer.GetOrigin();
      const rect = canvas.getBoundingClientRect();
      if (!camera || !origin || rect.width <= 0 || rect.height <= 0) return -1;
      const cameraBounds = getCameraBounds(camera);
      const worldPerPixel = (cameraBounds.maxX - cameraBounds.minX) / rect.width;
      if (!Number.isFinite(worldPerPixel) || worldPerPixel <= 0) return -1;
      const x = cameraBounds.minX + (clientX - rect.left) * worldPerPixel
        + origin.x - index.origin.x;
      const y = cameraBounds.maxY - (clientY - rect.top)
        * ((cameraBounds.maxY - cameraBounds.minY) / rect.height)
        + origin.y - index.origin.y;
      if (!entityGridRef.current) entityGridRef.current = buildEntityGrid(index);
      const lookup = entityLookup(index);
      const selectedRanks = new Set();
      for (const id of highlightedIdsRef.current || []) {
        const rank = lookup.get(id);
        if (rank != null) selectedRanks.add(rank);
      }
      return hitTestEntities(
        index,
        entityGridRef.current,
        x,
        y,
        PICK_TOLERANCE_PX * worldPerPixel,
        isolatedLayer,
        selectedRanks,
        selectionMode, // '' | 'length' | 'area' | 'count' → restreint la visée à la métrique
      );
    };

    const runHover = () => {
      frame = null;
      if (!pending) return;
      let found = null;
      if (selectionMode) {
        const rank = hitEntity(pending.x, pending.y);
        if (rank >= 0) {
          const rect = canvas.getBoundingClientRect();
          found = {
            kind: 'entity', rank, px: pending.x - rect.left, py: pending.y - rect.top,
          };
        }
      } else if (!heavyScene) {
        const picked = pickAt(pending.x, pending.y, true, false);
        if (picked) found = { kind: 'layer', ...picked };
      }
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
      // Un tap au doigt « bouge » naturellement de quelques pixels : seuil élargi en tactile.
      if (moved > (event.pointerType === 'touch' ? 12 : 4)) return; // déplacement, pas un clic
      if (selectionMode) {
        const rank = hitEntity(event.clientX, event.clientY);
        const index = entityIndexRef.current;
        if (rank >= 0 && index) onPickEntity(index.ids[rank]);
        return; // un clic dans le vide ne vide PAS la sélection (fausse manip fréquente)
      }
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
  }, [activeLayout, loading, paperLoading, onPickLayer, selectionMode, isolatedLayer, onPickEntity]);

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

  // Info-bulle d'une entité survolée : type + mesures exactes (échelle utilisateur).
  const entityHoverLabel = (rank) => {
    const index = entityIndexRef.current;
    if (!index) return '';
    const scale = Math.max(1e-9, Number(scaleToMeters) || 1);
    const parts = [];
    if (index.lengths[rank] > 1e-9) parts.push(`${formatMeasure(index.lengths[rank] * scale)} ml`);
    if (index.areas[rank] > 1e-9) parts.push(`${formatMeasure(index.areas[rank] * scale * scale)} m²`);
    if (index.counts[rank] > 0) parts.push(`${formatMeasure(index.counts[rank])} u`);
    const typeName = index.typeNames[index.typeCodes[rank]];
    const selected = (highlightedEntityIds || []).includes(index.ids[rank]);
    return `${DXF_TYPE_LABELS[typeName] || typeName}${parts.length ? ` — ${parts.join(' · ')}` : ''}${selected ? ' · sélectionné' : ''}`;
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden border-r border-gray-200 bg-slate-50">
      <div data-dxf-layer="paper" className="absolute inset-0 invisible">
        <div ref={paperContainerRef} className="h-full min-h-0 w-full pointer-events-none" />
      </div>
      <div data-dxf-layer="model" className={`absolute inset-0 z-[1] ${activeLayout ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}>
        <div ref={modelContainerRef} className="h-full min-h-0 w-full" />
      </div>
      <canvas ref={fillCanvasRef} className="pointer-events-none absolute inset-0 z-[2] h-full w-full" aria-hidden="true" />

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
          <button
            type="button"
            onClick={() => setHideFills((value) => !value)}
            title={hideFills ? 'Afficher les hachures / aplats' : 'Masquer les hachures / aplats'}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur ${hideFills ? 'border-gray-200 bg-white/90 text-gray-400 hover:bg-white' : 'border-blue-200 bg-blue-50/95 text-blue-700'}`}
          >
            <Hash size={15} /> Hachures
          </button>
          {!activeLayout && selectionAvailability === 'skipped' && (
            <span
              title="Plan trop volumineux pour la sélection d’élément"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-300 shadow-sm backdrop-blur"
            >
              <MousePointer2 size={15} /> Sélection
            </span>
          )}
          {!activeLayout && selectionAvailability === 'ok' && (
            <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 bg-white/90 shadow-sm backdrop-blur">
              {SELECTION_MODES.filter((mode) => metricAvailability[mode.key]).map((mode) => {
                const active = selectionMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => onSelectionModeChange(active ? '' : mode.key)}
                    title={mode.title}
                    className={`inline-flex items-center gap-1.5 border-l border-gray-200 px-3 py-2 text-xs font-semibold first:border-l-0 ${active ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <mode.Icon size={15} /> {mode.label}
                  </button>
                );
              })}
            </div>
          )}
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
              className={`pointer-events-none absolute z-30 max-w-[280px] -translate-y-full truncate rounded-lg px-2 py-1 text-[11px] font-semibold text-white shadow-lg ${hover.kind === 'entity' ? 'bg-orange-600' : 'bg-blue-600'}`}
              style={{ left: hover.px + 12, top: hover.py }}
            >
              {hover.kind === 'entity' ? entityHoverLabel(hover.rank) : hover.layer}
            </div>
          )}
          {selectionMode && !activeLayout && (
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
              <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${selectionSummary?.editing ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700'}`}>
                  {selectionSummary?.editing ? 'Modification' : (SELECTION_MODES.find((mode) => mode.key === selectionMode)?.label || 'Sélection')}
                </span>
                {selectionSummary?.entityCount > 0 ? (
                  <>
                    <span className="text-xs font-bold text-gray-900">
                      {selectionSummary.entityCount} élément{selectionSummary.entityCount > 1 ? 's' : ''}
                    </span>
                    {selectionSummary.text && (
                      <span className="text-xs font-bold text-orange-600">{selectionSummary.text}</span>
                    )}
                    <button
                      type="button"
                      onClick={onCreateSelectionRow}
                      className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      {selectionSummary?.editing ? 'Enregistrer' : 'Ajouter au métré'}
                    </button>
                    <button
                      type="button"
                      onClick={onClearSelection}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100"
                    >
                      Vider
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">
                    {selectionSummary?.editing
                      ? 'Cliquez pour ajouter/retirer des éléments (Enregistrer indisponible si vide)'
                      : 'Cliquez sur les éléments du plan à mesurer'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSelectionModeChange('')}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label={selectionSummary?.editing ? 'Annuler la modification' : 'Quitter le mode sélection'}
                  title={selectionSummary?.editing ? 'Annuler la modification (la ligne garde sa valeur)' : 'Quitter'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-gray-900/85 px-3 py-1.5 text-[10px] text-white backdrop-blur">
            {(() => {
              if (activeLayout) return 'Molette : zoom · Clic milieu : déplacer · Présentation en lecture seule';
              if (selectionMode) return 'Molette : zoom · Clic : sélectionner / désélectionner un élément · Échap : quitter';
              return 'Molette : zoom · Clic : isoler le calque · Survol : nom du calque';
            })()}
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
  selectionMode: PropTypes.oneOf(['', 'length', 'area', 'count']),
  onSelectionModeChange: PropTypes.func,
  highlightedEntityIds: PropTypes.arrayOf(PropTypes.string),
  measuredEntityGroups: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    entityIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  })),
  onPickEntity: PropTypes.func,
  selectionSummary: PropTypes.shape({ entityCount: PropTypes.number, text: PropTypes.string, editing: PropTypes.bool }),
  onCreateSelectionRow: PropTypes.func,
  onClearSelection: PropTypes.func,
  focusEntities: PropTypes.shape({ ids: PropTypes.array, nonce: PropTypes.number }),
  scaleToMeters: PropTypes.number,
};
