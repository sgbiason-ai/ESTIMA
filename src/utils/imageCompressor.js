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

// ── Extraction GPS depuis EXIF JPEG (sans dépendance externe) ─────────────
const extractExifGps = (file) =>
  new Promise((resolve) => {
    if (!file || !file.type?.startsWith('image/jpeg')) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const view = new DataView(reader.result);
        // Vérifier signature JPEG
        if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
        let offset = 2;
        while (offset < view.byteLength - 1) {
          const marker = view.getUint16(offset);
          if (marker === 0xFFE1) { // APP1 = EXIF
            const exifGps = parseExifGps(view, offset + 4);
            resolve(exifGps);
            return;
          }
          if ((marker & 0xFF00) !== 0xFF00) break;
          offset += 2 + view.getUint16(offset + 2);
        }
        resolve(null);
      } catch { resolve(null); }
    };
    reader.onerror = () => resolve(null);
    // Lire seulement les premiers 128 Ko (suffisant pour EXIF)
    reader.readAsArrayBuffer(file.slice(0, 131072));
  });

const parseExifGps = (view, exifStart) => {
  try {
    // Vérifier "Exif\0\0"
    const exifHeader = String.fromCharCode(
      view.getUint8(exifStart), view.getUint8(exifStart + 1),
      view.getUint8(exifStart + 2), view.getUint8(exifStart + 3)
    );
    if (exifHeader !== 'Exif') return null;

    const tiffStart = exifStart + 6;
    const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
    const g16 = (o) => view.getUint16(tiffStart + o, !bigEndian);
    const g32 = (o) => view.getUint32(tiffStart + o, !bigEndian);

    // Chercher IFD0 → tag 0x8825 (GPS IFD pointer)
    let ifdOffset = g32(4);
    const ifdCount = g16(ifdOffset);
    let gpsIfdOffset = null;

    for (let i = 0; i < ifdCount; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (g16(entryOffset) === 0x8825) {
        gpsIfdOffset = g32(entryOffset + 8);
        break;
      }
    }
    if (gpsIfdOffset === null) return null;

    // Parser les tags GPS
    const gpsCount = g16(gpsIfdOffset);
    const gpsTags = {};
    for (let i = 0; i < gpsCount; i++) {
      const entry = gpsIfdOffset + 2 + i * 12;
      const tag = g16(entry);
      const type = g16(entry + 2);
      const count = g32(entry + 4);
      const valOffset = g32(entry + 8);

      if (type === 2 && count <= 2) {
        // ASCII (LatRef / LngRef)
        gpsTags[tag] = String.fromCharCode(view.getUint8(tiffStart + entry + 8));
      } else if (type === 5 && count === 3) {
        // 3 RATIONAL = degrés, minutes, secondes
        const rats = [];
        for (let r = 0; r < 3; r++) {
          const num = g32(valOffset + r * 8);
          const den = g32(valOffset + r * 8 + 4);
          rats.push(den ? num / den : 0);
        }
        gpsTags[tag] = rats[0] + rats[1] / 60 + rats[2] / 3600;
      }
    }

    // Tags: 1=LatRef, 2=Lat, 3=LngRef, 4=Lng
    if (gpsTags[2] != null && gpsTags[4] != null) {
      const lat = gpsTags[1] === 'S' ? -gpsTags[2] : gpsTags[2];
      const lng = gpsTags[3] === 'W' ? -gpsTags[4] : gpsTags[4];
      if (lat !== 0 || lng !== 0) return { lat, lng };
    }
    return null;
  } catch { return null; }
};

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
  // 1. Toujours tenter l'extraction EXIF (gratuit, pas de permission)
  const exifPromise = extractExifGps(file);
  // 2. GPS navigateur uniquement si capture fraîche (caméra)
  const browserGpsPromise = withGps ? getSharedGps() : Promise.resolve(null);

  const img = await fileToImage(file);
  const src = resizeToCanvas(img, maxW, quality);

  // Priorité EXIF > GPS navigateur
  const exifGps = await exifPromise;
  const gps = exifGps || (await browserGpsPromise);
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
  const exifPromise = extractExifGps(file);
  const browserGpsPromise = withGps ? getSharedGps() : Promise.resolve(null);

  const img = await fileToImage(file);

  // Phase 1 : miniature instantanée (très rapide)
  const thumbSrc = resizeToCanvas(img, 200, 0.3);
  if (onPlaceholder) onPlaceholder(thumbSrc);

  // Phase 2 : compression finale + GPS (priorité EXIF)
  const src = resizeToCanvas(img, 800, 0.7);
  const exifGps = await exifPromise;
  const gps = exifGps || (await browserGpsPromise);
  const result = gps ? { src, lat: gps.lat, lng: gps.lng } : src;
  if (onFinal) onFinal(result);
  return result;
};
