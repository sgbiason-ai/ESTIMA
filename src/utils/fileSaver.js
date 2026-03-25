/**
 * fileSaver.js
 * Utilitaire de sauvegarde/ouverture de fichiers.
 *
 * Utilise la File System Access API (Chrome/Edge) avec le paramètre `id`
 * qui isole la mémoire du dernier dossier par contexte d'utilisation.
 * Chaque `id` différent = dernier chemin mémorisé indépendamment.
 *
 * IDs utilisés dans l'app :
 *   'affaire-save'  → Sauvegarder une affaire (.json)
 *   'affaire-open'  → Ouvrir une affaire (.json)
 *   'export-pdf'    → Exporter en PDF
 *   'export-excel'  → Exporter en Excel
 *
 * Fallback transparent vers download classique pour Firefox/Safari.
 *
 * MODE PARTAGE (mobile) :
 *   Quand activé via setShareMode(true), saveFileWithPicker utilise
 *   navigator.share() au lieu de sauvegarder — ouvre le menu natif
 *   de partage (WhatsApp, Gmail, Outlook, etc.)
 */

const isFileSystemAccessSupported = () =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window;

const isOpenFilePickerSupported = () =>
  typeof window !== 'undefined' && 'showOpenFilePicker' in window;

// ─── MODE PARTAGE (MOBILE) ──────────────────────────────────────────────────

let _shareMode = false;

/**
 * Active/désactive le mode partage natif.
 * Quand activé, saveFileWithPicker partage le fichier au lieu de le sauvegarder.
 */
export const setShareMode = (enabled) => { _shareMode = enabled; };

/**
 * Vérifie si le navigateur supporte le partage de fichiers.
 */
export const canNativeShare = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function';

/**
 * Partage un fichier via la Web Share API (menu natif du téléphone).
 * @param {Blob}   blob     - Contenu du fichier
 * @param {string} filename - Nom du fichier (avec extension)
 * @param {string} title    - Titre affiché dans le menu de partage
 * @returns {Promise<boolean>} - true si partagé, false si annulé/non supporté
 */
export const shareFile = async (blob, filename, title = 'EstimaVRD') => {
  if (!canNativeShare()) return false;

  try {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

    if (!navigator.canShare({ files: [file] })) {
      console.warn('[Share] Le navigateur ne peut pas partager ce type de fichier.');
      return false;
    }

    await navigator.share({
      title,
      files: [file],
    });
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false; // L'utilisateur a annulé
    console.warn('[Share] Erreur partage natif:', err);
    return false;
  }
};

// ─── SAUVEGARDE ──────────────────────────────────────────────────────────────

/**
 * @param {Blob}   blob          - Contenu à sauvegarder
 * @param {string} suggestedName - Nom de fichier proposé
 * @param {Array}  types         - Types MIME (format File System Access API)
 * @param {string} id            - Identifiant du contexte (mémorise le dossier séparément)
 * @returns {Promise<boolean>}   - true si sauvegardé, false si annulé
 */
export const saveFileWithPicker = async (blob, suggestedName, types, id) => {

  // ── Mode partage : utilise le menu natif du téléphone ──
  if (_shareMode) {
    const shared = await shareFile(blob, suggestedName);
    if (shared) return true;
    // Si le partage échoue ou n'est pas supporté, fallback vers download
    console.warn('[Share] Fallback vers download classique.');
  }

  if (isFileSystemAccessSupported()) {
    try {
      const handle = await window.showSaveFilePicker({
        id,
        suggestedName,
        types,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      console.warn('showSaveFilePicker error, falling back:', err);
    }
  }

  // ── Fallback : download classique ──
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

// ─── OUVERTURE ───────────────────────────────────────────────────────────────

/**
 * @param {Array}  types - Types acceptés (format File System Access API)
 * @param {string} id    - Identifiant du contexte (mémorise le dossier séparément)
 * @returns {Promise<File|null>}
 */
export const openFileWithPicker = async (types, id) => {
  if (isOpenFilePickerSupported()) {
    try {
      const [handle] = await window.showOpenFilePicker({
        id,
        types,
        multiple: false,
      });
      return await handle.getFile();
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.warn('showOpenFilePicker error, falling back:', err);
    }
  }
  return null;
};

// ─── IDs DE CONTEXTE ─────────────────────────────────────────────────────────
// Chaque ID retient son propre dernier dossier dans le navigateur.

export const PICKER_IDS = {
  affaireSave:  'affaire-save',
  affaireOpen:  'affaire-open',
  exportPdf:    'export-pdf',
  exportExcel:  'export-excel',
};

// ─── TYPES MIME ──────────────────────────────────────────────────────────────

export const FILE_TYPES = {
  json: [{
    description: 'Fichier Affaire',
    accept: { 'application/json': ['.json'] },
  }],
  pdf: [{
    description: 'Document PDF',
    accept: { 'application/pdf': ['.pdf'] },
  }],
  excel: [{
    description: 'Classeur Excel',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
  }],
};