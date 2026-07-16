import { OrthographicCamera } from 'three';
import { HATCH_RENDER_LAYER } from '../../utils/takeoff/dxfTakeoff';

const SIGNATURE = 'DxfWorkerMsg';

export function createMemorySceneWorker(scene) {
  const listeners = { message: new Set(), error: new Set() };
  let terminated = false;

  const emit = (type, payload) => {
    for (const listener of listeners[type] || []) listener(payload);
  };

  return {
    addEventListener(type, listener) {
      listeners[type]?.add(listener);
    },
    removeEventListener(type, listener) {
      listeners[type]?.delete(listener);
    },
    postMessage(message) {
      queueMicrotask(() => {
        if (terminated) return;
        try {
          const data = message.type === 'LOAD' ? { scene, dxf: null } : null;
          emit('message', {
            data: { signature: SIGNATURE, seq: message.seq, type: message.type, data },
          });
        } catch (error) {
          emit('error', error);
        }
      });
    },
    terminate() {
      terminated = true;
      listeners.message.clear();
      listeners.error.clear();
    },
  };
}

export function getCameraBounds(camera) {
  const zoom = camera?.zoom || 1;
  return {
    minX: camera.position.x + camera.left / zoom,
    maxX: camera.position.x + camera.right / zoom,
    minY: camera.position.y + camera.bottom / zoom,
    maxY: camera.position.y + camera.top / zoom,
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function zoomViewAtCanvasPoint(
  viewBounds,
  point,
  canvasWidth,
  canvasHeight,
  factor,
  minWidth,
  maxWidth,
) {
  const currentWidth = viewBounds.maxX - viewBounds.minX;
  const currentHeight = viewBounds.maxY - viewBounds.minY;
  if (currentWidth <= 0 || currentHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return null;
  }

  const xRatio = clamp(point.x / canvasWidth, 0, 1);
  const yRatio = clamp(point.y / canvasHeight, 0, 1);
  const anchorX = viewBounds.minX + xRatio * currentWidth;
  const anchorY = viewBounds.maxY - yRatio * currentHeight;
  const width = clamp(currentWidth * factor, minWidth, maxWidth);
  const height = width / (canvasWidth / canvasHeight);

  return {
    center: {
      x: anchorX + (0.5 - xRatio) * width,
      y: anchorY + (yRatio - 0.5) * height,
    },
    width,
  };
}

export function panViewByPixels(viewBounds, deltaX, deltaY, canvasWidth, canvasHeight) {
  const width = viewBounds.maxX - viewBounds.minX;
  const height = viewBounds.maxY - viewBounds.minY;
  if (width <= 0 || height <= 0 || canvasWidth <= 0 || canvasHeight <= 0) return null;
  return {
    center: {
      x: (viewBounds.minX + viewBounds.maxX) / 2 - (deltaX / canvasWidth) * width,
      y: (viewBounds.minY + viewBounds.maxY) / 2 + (deltaY / canvasHeight) * height,
    },
    width,
  };
}

export function paperRectToCanvas(
  viewport,
  paperViewBounds,
  canvasWidth,
  canvasHeight,
  paperOrigin = { x: 0, y: 0 },
) {
  const viewWidth = paperViewBounds.maxX - paperViewBounds.minX;
  const viewHeight = paperViewBounds.maxY - paperViewBounds.minY;
  if (viewWidth <= 0 || viewHeight <= 0) return null;

  const left = viewport.paperCenter.x - paperOrigin.x - viewport.paperSize.width / 2;
  const bottom = viewport.paperCenter.y - paperOrigin.y - viewport.paperSize.height / 2;
  const x = ((left - paperViewBounds.minX) / viewWidth) * canvasWidth;
  const y = ((bottom - paperViewBounds.minY) / viewHeight) * canvasHeight;
  const width = (viewport.paperSize.width / viewWidth) * canvasWidth;
  const height = (viewport.paperSize.height / viewHeight) * canvasHeight;

  const clippedLeft = Math.max(0, x);
  const clippedBottom = Math.max(0, y);
  const clippedRight = Math.min(canvasWidth, x + width);
  const clippedTop = Math.min(canvasHeight, y + height);
  if (clippedRight <= clippedLeft || clippedTop <= clippedBottom) return null;

  return {
    viewport: {
      x,
      y,
      width,
      height,
    },
    scissor: {
      x: clippedLeft,
      y: clippedBottom,
      width: clippedRight - clippedLeft,
      height: clippedTop - clippedBottom,
    },
  };
}

function setLayerVisibility(viewer, isolatedLayer, frozenLayers = [], hideFills = false) {
  const frozen = new Set(frozenLayers);
  for (const [name, layer] of viewer.layers || []) {
    // On masque UNIQUEMENT le calque de rendu des aplats (HATCH/SOLID), pas tous les Mesh :
    // le texte est aussi rendu en Mesh et doit rester visible.
    const hidden = frozen.has(name) || (hideFills && name === HATCH_RENDER_LAYER);
    const layerVisible = (!isolatedLayer || name === isolatedLayer) && !hidden;
    for (const object of layer.objects || []) object.visible = layerVisible;
  }
}

export function renderModelView(viewer, isolatedLayer, hideFills = false) {
  const renderer = viewer?.GetRenderer();
  if (!renderer) return;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, viewer.canvasWidth, viewer.canvasHeight);
  setLayerVisibility(viewer, isolatedLayer, [], hideFills);
  viewer.Render();
}

export function renderLayoutViewports(modelViewer, paperViewer, layout, isolatedLayer, hideFills = false) {
  const renderer = modelViewer?.GetRenderer();
  const modelScene = modelViewer?.GetScene();
  const paperScene = paperViewer?.GetScene();
  const origin = modelViewer?.GetOrigin();
  const paperOrigin = paperViewer?.GetOrigin();
  const paperCamera = paperViewer?.GetCamera();
  if (!renderer || !modelScene || !paperScene || !origin || !paperOrigin || !paperCamera || !layout) return;

  const canvasWidth = modelViewer.canvasWidth;
  const canvasHeight = modelViewer.canvasHeight;
  const paperBounds = getCameraBounds(paperCamera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, canvasWidth, canvasHeight);
  renderer.setClearColor(0xf8fafc, 1);
  renderer.render(paperScene, paperCamera);
  renderer.setScissorTest(true);

  for (const viewport of layout.viewports || []) {
    const rect = paperRectToCanvas(
      viewport,
      paperBounds,
      canvasWidth,
      canvasHeight,
      paperOrigin,
    );
    if (!rect || viewport.viewHeight <= 0 || viewport.paperSize.height <= 0) continue;

    setLayerVisibility(modelViewer, isolatedLayer, viewport.frozenLayers, hideFills);
    const viewWidth = viewport.viewHeight * (viewport.paperSize.width / viewport.paperSize.height);
    const camera = new OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewport.viewHeight / 2,
      -viewport.viewHeight / 2,
      0.1,
      2,
    );
    camera.position.set(
      viewport.viewCenter.x - origin.x,
      viewport.viewCenter.y - origin.y,
      1,
    );
    camera.rotation.z = -viewport.viewTwistAngle;
    camera.updateMatrix();
    camera.updateProjectionMatrix();

    const offsetX = rect.scissor.x - rect.viewport.x;
    const offsetY = rect.viewport.y + rect.viewport.height
      - rect.scissor.y - rect.scissor.height;
    camera.setViewOffset(
      rect.viewport.width,
      rect.viewport.height,
      offsetX,
      offsetY,
      rect.scissor.width,
      rect.scissor.height,
    );

    renderer.setViewport(
      rect.scissor.x,
      rect.scissor.y,
      rect.scissor.width,
      rect.scissor.height,
    );
    renderer.setScissor(
      rect.scissor.x,
      rect.scissor.y,
      rect.scissor.width,
      rect.scissor.height,
    );
    renderer.render(modelScene, camera);
  }

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, canvasWidth, canvasHeight);
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(paperScene, paperCamera);
  renderer.autoClear = autoClear;
  setLayerVisibility(modelViewer, isolatedLayer, [], hideFills);
}
