// src/utils/siteVisitImageStorage.js
//
// Upload et suppression des photos d'observations de VISITES DE SITE vers
// Firebase Storage. Meme principe que crrImageStorage.js (deja en prod pour le CRC).
// Arborescence : companies/{companyId}/site_visits/{visitId}/{obsId}/{ts}_{rand}.jpg
//
// Le format retourne reste compatible avec le code de lecture existant (img.src) :
//   { src: <downloadURL>, path: <storagePath>, lat?, lng? }
// On garde le nom "src" (pas "url") pour zero refactor cote affichage.
//
// Les anciennes photos en base64 (string) restent lues telles quelles : pas de
// migration, juste une coexistence (string base64 OU objet { src, path }).

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseStorage';
import { compressImage } from './imageCompressor';

// ── Convertit un dataURL base64 en Blob (pour uploadBytes) ─────────────────
const dataUrlToBlob = (dataUrl) => {
  const match = dataUrl.match(/^data:([^;,]+)(?:;base64)?,(.*)$/);
  if (!match) throw new Error('dataUrl invalide');
  const mime = match[1] || 'image/jpeg';
  const bytes = atob(match[2]);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

const createStoragePath = ({ companyId, visitId, obsId }) => {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `companies/${companyId}/site_visits/${visitId}/${obsId}/${ts}_${rand}.jpg`;
};

const uploadBlobWithTimeout = async (blob, path) => {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('Délai d’envoi photo dépassé'));
    }, 20000);
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

// ── Upload d'une nouvelle photo (depuis un File input) ─────────────────────
/**
 * Compresse puis upload une photo sur Firebase Storage.
 * @param {File} file - fichier image selectionne ou capture
 * @param {{companyId: string, visitId: string, obsId: string, withGps?: boolean}} ctx
 * @returns {Promise<{src: string, path: string, lat?: number, lng?: number}>}
 */
export const uploadSiteVisitImage = async (file, { companyId, visitId, obsId, withGps }) => {
  if (!companyId || !visitId || !obsId) {
    throw new Error('uploadSiteVisitImage : companyId, visitId et obsId requis');
  }

  // 1. Compression + capture GPS.
  // Par defaut : GPS uniquement si capture fraiche (camera, lastModified < 10s).
  const isFresh = (Date.now() - file.lastModified) < 10000;
  const gpsEnabled = withGps === undefined ? isFresh : !!withGps;
  const compressed = await compressImage(file, 800, 0.7, { withGps: gpsEnabled });
  const dataSrc = typeof compressed === 'string' ? compressed : compressed.src;
  const lat = typeof compressed === 'object' ? compressed.lat : undefined;
  const lng = typeof compressed === 'object' ? compressed.lng : undefined;

  // 2. Upload
  const path = createStoragePath({ companyId, visitId, obsId });
  const blob = dataUrlToBlob(dataSrc);
  const localFallback = { src: dataSrc, pendingStorage: true };
  if (lat != null && lng != null) {
    localFallback.lat = lat;
    localFallback.lng = lng;
  }

  // Sur chantier, conserver la photo dans le brouillon même sans réseau.
  // Elle reste affichable et exportable ; une future édition pourra la
  // resynchroniser vers Storage.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return localFallback;
  }

  try {
    const url = await uploadBlobWithTimeout(blob, path);
    const out = { src: url, path };
    if (lat != null && lng != null) { out.lat = lat; out.lng = lng; }
    return out;
  } catch (error) {
    console.warn('[Visite] Photo conservée localement, envoi Storage différé :', error?.code || error?.message);
    return localFallback;
  }
};

/**
 * Retente l'envoi d'une photo conservée en base64 après une coupure réseau.
 * En cas de nouvel échec, retourne l'objet local inchangé.
 */
export const syncPendingSiteVisitImage = async (img, { companyId, visitId, obsId }) => {
  if (!img?.pendingStorage || typeof img.src !== 'string' || !img.src.startsWith('data:image/')) return img;
  if (!companyId || !visitId || !obsId || (typeof navigator !== 'undefined' && navigator.onLine === false)) return img;

  const path = createStoragePath({ companyId, visitId, obsId });
  try {
    const url = await uploadBlobWithTimeout(dataUrlToBlob(img.src), path);
    const synced = { src: url, path };
    if (img.lat != null && img.lng != null) {
      synced.lat = img.lat;
      synced.lng = img.lng;
    }
    return synced;
  } catch (error) {
    console.warn('[Visite] Resynchronisation photo différée :', error?.code || error?.message);
    return img;
  }
};

// ── Suppression d'une photo Storage ────────────────────────────────────────
/**
 * Supprime une image de Storage si elle a un "path" Storage.
 * No-op pour les anciennes images stockees en base64 (pas de path).
 */
export const deleteSiteVisitImage = async (img) => {
  const path = typeof img === 'object' && img ? img.path : null;
  if (!path) return; // ancienne image base64 (string), rien a faire
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    console.warn('[Visite] Suppression Storage echouee pour', path, ':', err?.code || err?.message);
  }
};
