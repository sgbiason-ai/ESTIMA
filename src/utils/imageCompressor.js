// src/utils/imageCompressor.js
//
// Compresse une image et capture la géolocalisation du navigateur.
// Retourne { src, lat, lng } si GPS disponible, sinon juste la string src.
//
// v2 : génération d'une miniature instantanée (placeholder) puis compression
// finale en arrière-plan pour un affichage rapide sur le terrain.

// ── GPS (non-bloquant, timeout court, réutilise position récente) ──────────
const getCurrentGps = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 30000, enableHighAccuracy: false }
    );
  });

// ── Cache GPS : on lance une seule requête partagée par toutes les photos ──
let _gpsCache = null;
let _gpsCacheTime = 0;
const getSharedGps = () => {
  const now = Date.now();
  // Réutiliser le cache pendant 30 secondes
  if (_gpsCache && (now - _gpsCacheTime) < 30000) return _gpsCache;
  _gpsCache = getCurrentGps();
  _gpsCacheTime = now;
  return _gpsCache;
};

// ── Compression canvas rapide ──────────────────────────────────────────────
const resizeToCanvas = (img, maxW, quality) => {
  const ratio = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
};

// ── Lecture fichier → Image (réutilisable) ─────────────────────────────────
const fileToImage = (file) =>
  new Promise((resolve, reject) => {
    // Utiliser createObjectURL pour éviter la copie base64 complète
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });

// ── API principale : compression avec placeholder instantané ───────────────

/**
 * Compresse une image avec placeholder instantané.
 * Retourne { src, lat, lng, _placeholder } ou string src.
 *
 * Le _placeholder est un dataURL très léger (200px) pour affichage immédiat.
 * La src finale (800px) est la version haute qualité.
 */
export const compressImage = async (file, maxW = 800, quality = 0.7, { withGps = true } = {}) => {
  // Lancer GPS en parallèle uniquement pour les photos prises à la caméra
  const gpsPromise = withGps ? getSharedGps() : Promise.resolve(null);

  const img = await fileToImage(file);

  // Compression finale directe (pas de placeholder séparé)
  const src = resizeToCanvas(img, maxW, quality);
  const gps = await gpsPromise;
  return gps ? { src, lat: gps.lat, lng: gps.lng } : src;
};

/**
 * Compresse une image en 2 phases :
 * Phase 1 (instantanée) : miniature 200px, qualité 0.3 → affichage immédiat
 * Phase 2 (arrière-plan) : image 800px, qualité 0.7 → remplacement silencieux
 *
 * @param {File} file
 * @param {Function} onPlaceholder - callback(placeholderResult) appelé immédiatement
 * @param {Function} onFinal - callback(finalResult) appelé quand la compression est finie
 */
export const compressImageProgressive = async (file, onPlaceholder, onFinal, { withGps = true } = {}) => {
  const gpsPromise = withGps ? getSharedGps() : Promise.resolve(null);

  const img = await fileToImage(file);

  // Phase 1 : miniature instantanée (très rapide)
  const thumbSrc = resizeToCanvas(img, 200, 0.3);
  // On envoie le placeholder immédiatement sans attendre le GPS
  if (onPlaceholder) onPlaceholder(thumbSrc);

  // Phase 2 : compression finale + GPS
  const src = resizeToCanvas(img, 800, 0.7);
  const gps = await gpsPromise;
  const result = gps ? { src, lat: gps.lat, lng: gps.lng } : src;
  if (onFinal) onFinal(result);
  return result;
};
