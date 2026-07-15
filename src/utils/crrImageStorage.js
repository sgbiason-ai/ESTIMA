// src/utils/crrImageStorage.js
//
// Upload et suppression des photos d'observations CRC vers Firebase Storage.
// Arborescence : companies/{companyId}/crr/{crrId}/{obsId}/{ts}_{rand}.jpg
//
// Le format retourne reste compatible avec le code existant qui lit img.src :
//   { src: <downloadURL>, path: <storagePath>, lat?, lng? }
// On garde donc le nom "src" (pas "url") pour zero refactor cote lecture.

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

// ── Upload d'une nouvelle photo (depuis un File input) ─────────────────────
/**
 * Compresse puis upload une photo sur Firebase Storage.
 * @param {File} file - fichier image selectionne ou capture
 * @param {{companyId: string, crrId: string, obsId: string}} ctx
 * @returns {Promise<{src: string, path: string, lat?: number, lng?: number}>}
 */
export const uploadCrrImage = async (file, { companyId, crrId, obsId, withGps }) => {
  if (!companyId || !crrId || !obsId) {
    throw new Error('uploadCrrImage : companyId, crrId et obsId requis');
  }

  // 1. Compression + capture GPS.
  // Par defaut : GPS uniquement si capture fraiche (camera, lastModified < 10s)
  // Surcharge possible via withGps=true/false pour un caller qui connait le contexte.
  const isFresh = (Date.now() - file.lastModified) < 10000;
  const gpsEnabled = withGps === undefined ? isFresh : !!withGps;
  const compressed = await compressImage(file, 600, 0.5, { withGps: gpsEnabled });
  const dataSrc = typeof compressed === 'string' ? compressed : compressed.src;
  const lat = typeof compressed === 'object' ? compressed.lat : undefined;
  const lng = typeof compressed === 'object' ? compressed.lng : undefined;

  // 2. Upload
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `companies/${companyId}/crr/${crrId}/${obsId}/${ts}_${rand}.jpg`;
  const blob = dataUrlToBlob(dataSrc);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  const out = { src: url, path };
  if (lat != null && lng != null) { out.lat = lat; out.lng = lng; }
  return out;
};

// ── Upload d'un dataURL base64 existant (migration lazy) ───────────────────
/**
 * Upload un dataURL deja compresse (ex: ancienne image stockee en base64 dans
 * le doc Firestore) vers Storage. Conserve les metadonnees GPS si presentes.
 */
export const uploadCrrDataUrl = async (dataUrl, { companyId, crrId, obsId, lat, lng }) => {
  if (!companyId || !crrId || !obsId) {
    throw new Error('uploadCrrDataUrl : companyId, crrId et obsId requis');
  }
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `companies/${companyId}/crr/${crrId}/${obsId}/${ts}_${rand}.jpg`;
  const blob = dataUrlToBlob(dataUrl);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  const out = { src: url, path };
  if (lat != null && lng != null) { out.lat = lat; out.lng = lng; }
  return out;
};

// ── Suppression d'une photo Storage ────────────────────────────────────────
/**
 * Supprime une image de Storage si elle a un "path" Storage.
 * No-op pour les anciennes images stockees en base64 (pas de path).
 */
export const deleteCrrImage = async (img) => {
  const path = typeof img === 'object' && img ? img.path : null;
  if (!path) return; // ancienne image base64, rien a faire
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    // La photo a peut-etre deja ete supprimee cote Storage — on log mais on ne throw pas
    console.warn('[CRC] Suppression Storage echouee pour', path, ':', err?.code || err?.message);
  }
};
