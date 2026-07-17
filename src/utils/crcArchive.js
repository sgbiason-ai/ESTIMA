// src/utils/crcArchive.js
// Import/Export d'une affaire CRC complete au format .crcestima (JSON).
//
// v2 (2026-05) : l'export est devenu autosuffisant — les images Storage sont
// telechargees et embarquees en base64 dans le JSON. Cela rend les fichiers
// .crcestima portables : un export -> delete -> import re-cree l'affaire
// avec toutes ses photos, sans dependre du bucket Storage. Compat v1 (URLs
// only) conservee en import.

const FORMAT = 'crcestima';
const VERSION = 2;

// Helper : Blob -> dataURL base64
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
  reader.readAsDataURL(blob);
});

// Helper : telecharge une URL Storage et la convertit en base64
const fetchToDataUrl = async (url) => {
  // Le SW (CacheFirst photos) peut resservir une reponse opaque (status 0)
  // deposee par un <img> no-cors → ok=false ; retenter avec une URL
  // modifiee pour forcer le passage reseau en mode cors.
  let resp = await fetch(url);
  if (!resp.ok) resp = await fetch(url + (url.includes('?') ? '&' : '?') + 'swbust=' + Date.now());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return blobToDataUrl(blob);
};

// ── EXPORT ──────────────────────────────────────────────────────────────────

/**
 * Construit le contenu JSON d'un fichier .crcestima a partir d'un document CRC.
 * Telecharge les images Storage et les embarque en base64 -> archive autosuffisante.
 *
 * @param {object} crrDoc - Le document Firestore complet (crrConfig + crrMeetings)
 * @param {string} userEmail - Email de l'utilisateur qui exporte
 * @param {object} [opts]
 * @param {(p:{done:number,total:number,failed:number}) => void} [opts.onProgress]
 * @returns {Promise<{ blob: Blob, filename: string, stats: {total:number, embedded:number, failed:number} }>}
 */
export const exportCrcArchive = async (crrDoc, userEmail, opts = {}) => {
  const { onProgress } = opts;

  // 1. Recense toutes les images a telecharger (URLs http(s))
  const meetings = crrDoc.crrMeetings || [];
  const imageRefs = []; // [{ mIdx, oIdx, iIdx, url }]
  meetings.forEach((m, mIdx) => {
    (m.observations || []).forEach((obs, oIdx) => {
      (obs.images || []).forEach((img, iIdx) => {
        if (img && typeof img === 'object' && typeof img.src === 'string'
            && /^https?:\/\//i.test(img.src)) {
          imageRefs.push({ mIdx, oIdx, iIdx, url: img.src });
        } else if (typeof img === 'string' && /^https?:\/\//i.test(img)) {
          imageRefs.push({ mIdx, oIdx, iIdx, url: img });
        }
        // Les images deja en base64 sont laissees telles quelles (deja autosuffisantes)
      });
    });
  });

  // 2. Telecharge en parallele (pool de 6) avec progression
  const total = imageRefs.length;
  let done = 0;
  let failed = 0;
  const cache = new Map(); // deduplique si meme URL utilisee plusieurs fois
  onProgress?.({ done, total, failed });

  const downloadOne = async (ref) => {
    try {
      let dataUrl = cache.get(ref.url);
      if (!dataUrl) {
        dataUrl = await fetchToDataUrl(ref.url);
        cache.set(ref.url, dataUrl);
      }
      ref.dataUrl = dataUrl;
    } catch (err) {
      ref.error = err?.message || String(err);
      failed += 1;
    } finally {
      done += 1;
      onProgress?.({ done, total, failed });
    }
  };

  const POOL = 6;
  for (let i = 0; i < imageRefs.length; i += POOL) {
    await Promise.all(imageRefs.slice(i, i + POOL).map(downloadOne));
  }

  // 3. Reconstruit crrMeetings avec les images embarquees
  const enriched = meetings.map((m, mIdx) => {
    if (!m.observations?.length) return m;
    return {
      ...m,
      observations: m.observations.map((obs, oIdx) => {
        if (!obs.images?.length) return obs;
        return {
          ...obs,
          images: obs.images.map((img, iIdx) => {
            const ref = imageRefs.find(r => r.mIdx === mIdx && r.oIdx === oIdx && r.iIdx === iIdx);
            if (!ref || !ref.dataUrl) return img; // pas de ref ou download fail -> on laisse l'original
            if (typeof img === 'string') return ref.dataUrl;
            return { ...img, src: ref.dataUrl };
          }),
        };
      }),
    };
  });

  const archive = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: userEmail || '',
    data: {
      crrConfig: crrDoc.crrConfig || {},
      crrMeetings: enriched,
    },
  };

  const json = JSON.stringify(archive, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Nom du fichier base sur le nom du chantier
  const nom = (crrDoc.crrConfig?.chantierInfo?.nom || 'CHANTIER')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 40)
    .toUpperCase();
  const date = new Date().toISOString().split('T')[0];
  const filename = `${nom}_${date}.crcestima`;

  return {
    blob,
    filename,
    stats: { total, embedded: total - failed, failed },
  };
};

// ── IMPORT ──────────────────────────────────────────────────────────────────

/**
 * Parse et valide un fichier .crcestima.
 * Compat v1 (URLs only) et v2 (images embarquees base64).
 *
 * @param {File} file - Fichier selectionne par l'utilisateur
 * @returns {Promise<{ valid: boolean, data?: object, summary?: object, error?: string }>}
 */
export const importCrcArchive = async (file) => {
  try {
    const text = await file.text();
    const archive = JSON.parse(text);

    // Validation format
    if (archive.format !== FORMAT) {
      return { valid: false, error: 'Format de fichier invalide. Attendu : .crcestima' };
    }
    if (!archive.version || archive.version > VERSION) {
      return { valid: false, error: `Version ${archive.version} non supportee (max: ${VERSION})` };
    }
    if (!archive.data) {
      return { valid: false, error: 'Donnees manquantes dans le fichier.' };
    }

    const { crrConfig, crrMeetings } = archive.data;
    if (!crrConfig) {
      return { valid: false, error: 'Configuration du chantier manquante.' };
    }

    // Calculer le resume
    const meetings = crrMeetings || [];
    const totalObs = meetings.reduce((sum, m) => sum + (m.observations?.length || 0), 0);
    const totalImages = meetings.reduce((sum, m) =>
      sum + (m.observations || []).reduce((s, o) => s + (o.images?.length || 0), 0), 0);

    // Compte les images embarquees (base64) vs externes (URLs)
    let embeddedImages = 0;
    meetings.forEach((m) => (m.observations || []).forEach((o) => (o.images || []).forEach((img) => {
      const src = typeof img === 'string' ? img : img?.src;
      if (typeof src === 'string' && src.startsWith('data:image/')) embeddedImages += 1;
    })));

    const summary = {
      chantierName: crrConfig.chantierInfo?.nom || 'Sans nom',
      meetingCount: meetings.length,
      observationCount: totalObs,
      imageCount: totalImages,
      embeddedImages,
      version: archive.version,
      exportedAt: archive.exportedAt,
      exportedBy: archive.exportedBy,
      categories: crrConfig.categories?.length || 0,
      participantGroups: crrConfig.participantGroups?.length || 0,
    };

    return { valid: true, data: archive.data, summary };
  } catch (e) {
    return { valid: false, error: `Erreur de lecture : ${e.message}` };
  }
};
