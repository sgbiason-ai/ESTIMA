// src/utils/exportHelpers.js
// Utilitaires pour les exports CRC : nom de fichier, dossier File System Access.

// ── Sanitize filename ────────────────────────────────────────────────────────

const sanitize = (str) =>
  (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 60);

// ── Construire le nom de fichier a partir du pattern ─────────────────────────

/**
 * @param {string} pattern - ex: "CR{N}_{NOM}_{DATE}"
 * @param {object} vars - { number, projectName, date, ext }
 * @returns {string} filename avec extension
 */
export const buildExportFilename = (pattern, { number, projectName, date, ext }) => {
  if (!pattern) pattern = 'CR{N}_{NOM}_{DATE}';
  const crNum = String(number || 1).padStart(2, '0');
  const safeName = sanitize(projectName || 'PROJET').toUpperCase();
  const safeDate = date || 'ND';

  let filename = pattern
    .replace(/\{N\}/gi, crNum)
    .replace(/\{NOM\}/gi, safeName)
    .replace(/\{DATE\}/gi, safeDate)
    .replace(/\{TYPE\}/gi, ext || 'pdf');

  // Sanitize le resultat final
  filename = filename.replace(/[<>:"/\\|?*]/g, '_').replace(/_+/g, '_');

  // Ajouter l'extension si pas deja presente
  const dotExt = '.' + (ext || 'pdf');
  if (!filename.toLowerCase().endsWith(dotExt)) filename += dotExt;

  return filename;
};

// ── IndexedDB pour stocker les directory handles ─────────────────────────────

const DB_NAME = 'estimavrd-export';
const DB_VERSION = 1;
const STORE_NAME = 'dirHandles';

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/**
 * Sauvegarder un directory handle dans IndexedDB.
 * @param {string} key - identifiant unique (ex: companyId_chantierId)
 * @param {FileSystemDirectoryHandle} handle
 */
export const saveDirHandle = async (key, handle) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Charger un directory handle depuis IndexedDB.
 * @param {string} key
 * @returns {FileSystemDirectoryHandle|null}
 */
export const loadDirHandle = async (key) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
};

/**
 * Ecrire un blob dans le dossier via File System Access.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} filename
 * @param {Blob} blob
 * @returns {boolean} true si succes
 */
export const saveToDirectory = async (dirHandle, filename, blob) => {
  try {
    // Verifier/redemander la permission
    const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const req = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (req !== 'granted') return false;
    }
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch { return false; }
};

/**
 * Verifie si File System Access API est disponible.
 */
export const hasFileSystemAccess = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;
