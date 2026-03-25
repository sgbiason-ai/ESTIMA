/**
 * shareInterceptor.js
 *
 * Intercepte TOUS les téléchargements de fichiers (blob URLs via <a>.click())
 * et les redirige vers le menu de partage natif du téléphone.
 *
 * Fonctionne avec :
 *   - saveFileWithPicker (fileSaver.js)
 *   - jsPDF doc.save()
 *   - ExcelJS workbook.xlsx.writeBuffer() → saveAs
 *   - Tout code qui crée un <a href="blob:..." download="..."> puis .click()
 *
 * Usage :
 *   import { startShareCapture, stopShareCapture } from './shareInterceptor';
 *
 *   startShareCapture();          // Active l'interception
 *   await generateSomePDF();      // Le fichier est capturé au lieu d'être téléchargé
 *   const result = await stopShareCapture();  // Partage le fichier capturé
 */

let _capturing = false;
let _capturedFile = null;
let _captureResolve = null;
const _originalClick = HTMLAnchorElement.prototype.click;

/**
 * Démarre la capture. Le prochain fichier téléchargé sera intercepté.
 */
export const startShareCapture = () => {
  _capturing = true;
  _capturedFile = null;

  HTMLAnchorElement.prototype.click = function () {
    // Si on capture ET que c'est un lien de téléchargement blob
    if (_capturing && this.download && this.href && this.href.startsWith('blob:')) {
      const filename = this.download;
      const blobUrl = this.href;

      // Récupère le blob depuis l'URL
      fetch(blobUrl)
        .then(r => r.blob())
        .then(blob => {
          _capturedFile = { blob, filename };
          URL.revokeObjectURL(blobUrl);
          if (_captureResolve) _captureResolve(_capturedFile);
        })
        .catch(() => {
          // En cas d'erreur, télécharge normalement
          _originalClick.call(this);
        });
      return;
    }

    // Sinon, comportement normal
    return _originalClick.call(this);
  };
};

/**
 * Arrête la capture et partage le fichier intercepté.
 * @returns {Promise<boolean>} true si partagé, false sinon
 */
export const stopShareCapture = () => {
  return new Promise(async (resolve) => {
    // Restaure le comportement normal
    HTMLAnchorElement.prototype.click = _originalClick;

    // Attend un petit délai si le fichier n'est pas encore capturé
    if (!_capturedFile) {
      _captureResolve = (file) => {
        _captureResolve = null;
        _capturing = false;
        shareAndResolve(file, resolve);
      };

      // Timeout de sécurité (5s)
      setTimeout(() => {
        _captureResolve = null;
        _capturing = false;
        if (!_capturedFile) {
          resolve(false);
        }
      }, 5000);
    } else {
      _capturing = false;
      await shareAndResolve(_capturedFile, resolve);
    }
  });
};

/**
 * Partage le fichier capturé via le menu natif.
 */
async function shareAndResolve(fileData, resolve) {
  if (!fileData) { resolve(false); return; }

  const { blob, filename } = fileData;
  _capturedFile = null;

  // Déterminer le type MIME
  let mimeType = blob.type || 'application/octet-stream';
  if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
  if (filename.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  try {
    const file = new File([blob], filename, { type: mimeType });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: filename,
        files: [file],
      });
      resolve(true);
    } else {
      // Fallback : télécharge normalement si le partage n'est pas supporté
      fallbackDownload(blob, filename);
      resolve(false);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // L'utilisateur a annulé le partage
      resolve(false);
    } else {
      console.warn('[Share] Erreur, fallback download:', err);
      fallbackDownload(blob, filename);
      resolve(false);
    }
  }
}

/**
 * Téléchargement classique en fallback.
 */
function fallbackDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Appel direct sans passer par le prototype overridé
  _originalClick.call(a);
  URL.revokeObjectURL(url);
}

/**
 * Vérifie si le partage de fichiers est supporté.
 */
export const canShareFiles = () => {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
};