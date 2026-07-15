// Persistance locale (IndexedDB) du métré DXF, par projet → survit au rafraîchissement.
// Deux entrées distinctes pour NE PAS réécrire le fichier (volumineux) à chaque
// modification du travail :
//   file::{projectId} → { fileName, file (Blob/File) }
//   work::{projectId} → { mappings, scaleToMeters, isolatedLayer, applyMode, savedAt }
// Tout est best-effort : en cas d'indisponibilité d'IndexedDB, on n'échoue jamais.

const DB_NAME = 'estima-dxf-takeoff';
const STORE = 'sessions';

const fileKey = (id) => `file::${id}`;
const workKey = (id) => `work::${id}`;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(key, value) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Enregistre (ou remplace) le fichier DXF du projet. */
export async function saveDxfFile(projectId, fileName, file) {
  if (!projectId || !file) return;
  try {
    await put(fileKey(projectId), { fileName, file });
  } catch { /* best effort */ }
}

/** Enregistre le travail léger (associations, échelle, calque isolé, mode). */
export async function saveDxfWork(projectId, work) {
  if (!projectId) return;
  try {
    await put(workKey(projectId), { ...work, savedAt: Date.now() });
  } catch { /* best effort */ }
}

/** Recharge la session (fichier + travail) d'un projet, ou null si aucune. */
export async function loadDxfSession(projectId) {
  if (!projectId) return null;
  try {
    const db = await openDb();
    try {
      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const fileReq = store.get(fileKey(projectId));
        const workReq = store.get(workKey(projectId));
        tx.oncomplete = () => resolve({ file: fileReq.result || null, work: workReq.result || null });
        tx.onerror = () => reject(tx.error);
      });
      if (!result.file?.file) return null;
      return { fileName: result.file.fileName || 'plan.dxf', file: result.file.file, work: result.work || {} };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Supprime la session (fichier + travail) d'un projet. */
export async function clearDxfSession(projectId) {
  if (!projectId) return;
  try {
    const db = await openDb();
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.delete(fileKey(projectId));
        store.delete(workKey(projectId));
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } finally {
      db.close();
    }
  } catch { /* ignore */ }
}
