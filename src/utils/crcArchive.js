// src/utils/crcArchive.js
// Import/Export d'une affaire CRC complete au format .crcestima (JSON).

const FORMAT = 'crcestima';
const VERSION = 1;

// ── EXPORT ──────────────────────────────────────────────────────────────────

/**
 * Construit le contenu JSON d'un fichier .crcestima a partir d'un document CRC.
 * @param {object} crrDoc - Le document Firestore complet (crrConfig + crrMeetings)
 * @param {string} userEmail - Email de l'utilisateur qui exporte
 * @returns {{ blob: Blob, filename: string }}
 */
export const exportCrcArchive = (crrDoc, userEmail) => {
  const archive = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: userEmail || '',
    data: {
      crrConfig: crrDoc.crrConfig || {},
      crrMeetings: crrDoc.crrMeetings || [],
    },
  };

  const json = JSON.stringify(archive, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Nom du fichier base sur le nom du chantier
  const nom = (crrDoc.crrConfig?.chantierInfo?.nom || 'CHANTIER')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 40)
    .toUpperCase();
  const date = new Date().toISOString().split('T')[0];
  const filename = `${nom}_${date}.crcestima`;

  return { blob, filename };
};

// ── IMPORT ──────────────────────────────────────────────────────────────────

/**
 * Parse et valide un fichier .crcestima.
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

    const summary = {
      chantierName: crrConfig.chantierInfo?.nom || 'Sans nom',
      meetingCount: meetings.length,
      observationCount: totalObs,
      imageCount: totalImages,
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
