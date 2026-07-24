// src/utils/siteVisitPlanStorage.js
//
// Gestion des PLANS annotables des visites de site (mode Annotation).
// - Import d'un PDF : chaque page choisie est rendue en JPEG haute résolution
//   via pdfjs-dist (import dynamique — pdfjs ne doit pas entrer dans le bundle
//   initial). Le PDF source n'est JAMAIS stocké.
// - Import d'une image (jpg/png) : downscale si côté max > 3000 px, puis JPEG.
// - Stockage : Firebase Storage, chemin
//   companies/{companyId}/site_visits/{visitId}/plans/{ts}_{rand}.jpg
//   (le segment "plans" joue le rôle d'obsId dans la règle Storage existante :
//   contentType image/jpeg, taille < 5 Mo — aucune modification de storage.rules).
// - Contrairement aux photos d'observation, PAS de repli base64 hors-ligne :
//   l'import de plan est une action de préparation, pas de terrain → en cas
//   d'échec on lève une erreur explicite en français.
//
// Objet plan retourné (contrat de données du doc visite, champ `plans[]`) :
//   { id, name, src (downloadURL), path (chemin Storage), width, height,
//     page (page PDF d'origine ou null), createdAt (ISO) }

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseStorage';

// ── Constantes ─────────────────────────────────────────────────────────────
const MAX_PLAN_DIM = 3000; // côté max (px) d'un plan importé
const MAX_PLAN_BYTES = 4.5 * 1024 * 1024; // marge sous la limite Storage (5 Mo)
const UPLOAD_TIMEOUT_MS = 60000; // plans plus lourds que les photos → délai large

// ── pdfjs en lazy (jamais dans le bundle initial) ──────────────────────────
let pdfjsPromise = null;
const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
};

// ── Helpers internes ───────────────────────────────────────────────────────

// Convertit un dataURL base64 en Blob (même motif que siteVisitImageStorage).
const dataUrlToBlob = (dataUrl) => {
  const match = dataUrl.match(/^data:([^;,]+)(?:;base64)?,(.*)$/);
  if (!match) throw new Error('Image du plan invalide (dataUrl illisible)');
  const mime = match[1] || 'image/jpeg';
  const bytes = atob(match[2]);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

// Charge une image depuis une source (dataURL ou object URL).
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Image du plan illisible'));
  img.src = src;
});

// Dessine une image sur un canvas fond blanc (les PNG transparents
// deviendraient noirs en JPEG sans cela) et retourne le canvas.
const drawToCanvas = (img, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
};

// Ré-encode le plan en qualité décroissante jusqu'à passer sous maxBytes.
const reencodeUnderLimit = async (dataUrl, width, height, maxBytes) => {
  const img = await loadImage(dataUrl);
  const canvas = drawToCanvas(img, width, height);
  for (const quality of [0.7, 0.6, 0.5]) {
    const candidate = dataUrlToBlob(canvas.toDataURL('image/jpeg', quality));
    if (candidate.size <= maxBytes) return candidate;
  }
  throw new Error('Plan trop volumineux : impossible de le compresser sous 4,5 Mo. Réduisez la résolution ou découpez le plan.');
};

// Upload d'un Blob avec timeout (même motif que siteVisitImageStorage).
const uploadBlobWithTimeout = async (blob, path) => {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('Délai d’envoi du plan dépassé — vérifiez votre connexion et réessayez'));
    }, UPLOAD_TIMEOUT_MS);
    uploadTask.on(
      'state_changed',
      undefined,
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
      () => {
        clearTimeout(timeoutId);
        resolve();
      }
    );
  });
  return getDownloadURL(storageRef);
};

// ── API publique ───────────────────────────────────────────────────────────

/**
 * Ouvre un PDF pour import de plans : pdfjs chargé en lazy, rendu page par
 * page en JPEG. Appeler `destroy()` une fois l'import terminé.
 * @param {File} file - fichier PDF choisi par l'utilisateur
 * @returns {Promise<{
 *   pageCount: number,
 *   renderPage: (pageNum: number, maxDim: number) => Promise<{ dataUrl: string, width: number, height: number }>,
 *   destroy: () => void,
 * }>}
 */
export async function openPdfForImport(file) {
  if (!file) throw new Error('Aucun fichier PDF fourni');
  const pdfjsLib = await loadPdfjs();

  let pdf;
  try {
    const arrayBuffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    throw new Error(`Impossible de lire ce PDF : ${err?.message || 'fichier corrompu ou protégé'}`);
  }

  return {
    pageCount: pdf.numPages,

    // Rend une page (1-indexée) en JPEG dont le côté max vaut maxDim pixels.
    renderPage: async (pageNum, maxDim = MAX_PLAN_DIM) => {
      const page = await pdf.getPage(pageNum);
      const nativeViewport = page.getViewport({ scale: 1 });
      const scale = maxDim / Math.max(nativeViewport.width, nativeViewport.height);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const quality = maxDim >= 2000 ? 0.85 : 0.8;
      return {
        dataUrl: canvas.toDataURL('image/jpeg', quality),
        width: canvas.width,
        height: canvas.height,
      };
    },

    destroy: () => {
      try { pdf.destroy(); } catch { /* déjà détruit */ }
    },
  };
}

/**
 * Upload l'image JPEG d'un plan vers Firebase Storage et retourne l'objet
 * plan complet à pousser dans `visit.plans`. Ré-encode en qualité décroissante
 * si le blob dépasse 4,5 Mo. Pas de repli hors-ligne : lève une erreur en
 * français en cas d'échec.
 * @param {{ dataUrl: string, width: number, height: number, name: string, page: number|null, companyId: string, visitId: string }} params
 * @returns {Promise<{ id: string, name: string, src: string, path: string, width: number, height: number, page: number|null, createdAt: string }>}
 */
export async function uploadPlanImage({ dataUrl, width, height, name, page, companyId, visitId }) {
  if (!companyId || !visitId) throw new Error('uploadPlanImage : companyId et visitId requis');
  if (!dataUrl) throw new Error('uploadPlanImage : image du plan manquante');

  let blob = dataUrlToBlob(dataUrl);
  if (blob.size > MAX_PLAN_BYTES) {
    blob = await reencodeUnderLimit(dataUrl, width, height, MAX_PLAN_BYTES);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Aucune connexion réseau : l’import de plan nécessite d’être en ligne');
  }

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `companies/${companyId}/site_visits/${visitId}/plans/${ts}_${rand}.jpg`;

  let src;
  try {
    src = await uploadBlobWithTimeout(blob, path);
  } catch (err) {
    throw new Error(`Échec de l’envoi du plan : ${err?.message || err?.code || 'erreur réseau'}`);
  }

  return {
    id: `plan_${ts}_${rand}`,
    name: name || 'Plan',
    src,
    path,
    width,
    height,
    page: page ?? null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Importe un plan fourni directement en image (jpg/png) : downscale si le
 * côté max dépasse 3000 px, conversion JPEG, puis upload via uploadPlanImage.
 * @param {{ file: File, companyId: string, visitId: string, name?: string }} params
 * @returns {Promise<object>} même objet plan que uploadPlanImage
 */
export async function importImagePlan({ file, companyId, visitId, name }) {
  if (!file) throw new Error('Aucun fichier image fourni');

  const objectUrl = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
  if (!maxSide) throw new Error('Image du plan vide ou illisible');
  const scale = maxSide > MAX_PLAN_DIM ? MAX_PLAN_DIM / maxSide : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = drawToCanvas(img, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const planName = name || (file.name || 'Plan').replace(/\.[^.]+$/, '');

  return uploadPlanImage({ dataUrl, width, height, name: planName, page: null, companyId, visitId });
}

/**
 * Supprime le fichier Storage d'un plan. Silencieux si le plan n'a pas de
 * path ou si le fichier n'existe plus (même motif que deleteSiteVisitImage).
 * @param {{ path?: string }|null|undefined} plan
 */
export async function deletePlan(plan) {
  const path = plan && typeof plan === 'object' ? plan.path : null;
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err?.code === 'storage/object-not-found') return; // déjà supprimé
    console.warn('[Visite] Suppression du plan Storage échouée pour', path, ':', err?.code || err?.message);
  }
}
