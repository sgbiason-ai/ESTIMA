import { stripHtml } from '../formatObsText';
import { simplifyGpsTrace } from '../gpsSimplify';

const normalizeText = (value) => stripHtml(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const cloneImages = (images) => (Array.isArray(images) ? images : [])
  .filter((image) => !!getReserveImageSrc(image))
  .map((image) => (typeof image === 'object' && image ? { ...image } : image));

export const getSiteVisitObservationNumber = (observation, index = 0) => {
  const value = observation?.numero
    ?? observation?.number
    ?? observation?.repere
    ?? observation?.observationNumber
    ?? index + 1;
  return String(value || index + 1).trim();
};

export const normalizeObservationNumber = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^OBS(?:ERVATION)?[\s._-]*/u, '')
    .replace(/\s+/g, '');
  return /^\d+$/.test(normalized) ? String(Number(normalized)) : normalized;
};

export const getReserveImageSrc = (image) => (
  typeof image === 'string' ? image : image?.src || ''
);

export const getReserveImages = (reserve) => {
  const images = Array.isArray(reserve?.images) && reserve.images.length > 0
    ? reserve.images
    : reserve?.image
      ? [reserve.image]
      : [];

  return images.filter((image) => !!getReserveImageSrc(image));
};

/**
 * Convertit l'intégralité d'une visite en annexe de réserves EXE4/EXE5.
 * Les textes sont figés au moment de l'import ; les photos conservent leurs
 * références Storage pour éviter de dépasser la limite Firestore de 1 Mo.
 */
export const siteVisitToReserves = (visit, importedAt = new Date().toISOString()) => {
  if (!visit) return { reserves: [], source: null };

  const observations = Array.isArray(visit.observations) ? visit.observations : [];
  const reserves = observations.map((observation, index) => {
    const images = cloneImages(observation?.images);

    return {
      id: `visite_${visit.id || 'sans-id'}_${observation?.id || index + 1}`,
      numero: getSiteVisitObservationNumber(observation, index),
      designation: normalizeText(observation?.text) || `Observation ${index + 1}`,
      delaiLevee: '',
      images,
      sourceObservationId: observation?.id || '',
      sourceDate: observation?.date || visit.date || '',
    };
  });

  const photoCount = reserves.reduce((total, reserve) => total + reserve.images.length, 0);
  const coordinates = Array.isArray(visit.gpsTracking?.coordinates)
    ? simplifyGpsTrace(visit.gpsTracking.coordinates, 2)
    : [];

  const mapObservations = observations.map((observation) => ({
    id: observation?.id || '',
    pointLocation: observation?.pointLocation || null,
    segmentFrom: observation?.segmentFrom || null,
    segmentTo: observation?.segmentTo || null,
    segmentRoute: Array.isArray(observation?.segmentRoute)
      ? simplifyGpsTrace(observation.segmentRoute, 2)
      : null,
    images: (observation?.images || [])
      .filter((image) => typeof image === 'object' && image?.lat != null && image?.lng != null)
      .map((image) => ({ lat: image.lat, lng: image.lng })),
  }));

  return {
    reserves,
    source: {
      id: visit.id || '',
      nom: visit.nom || 'Visite de site',
      lieu: visit.lieu || '',
      client: visit.client || '',
      date: visit.date || '',
      importedAt,
      observationCount: reserves.length,
      photoCount,
      mapVisit: {
        nom: visit.nom || 'Visite de site',
        date: visit.date || '',
        lieu: visit.lieu || '',
        gpsTracking: {
          coordinates,
          distance: visit.gpsTracking?.distance || 0,
          startTime: visit.gpsTracking?.startTime || null,
          endTime: visit.gpsTracking?.endTime || null,
        },
        observations: mapObservations,
      },
    },
  };
};

export const siteVisitToControlSource = (visit, importedAt = new Date().toISOString()) => {
  if (!visit) return null;
  const observations = (Array.isArray(visit.observations) ? visit.observations : []).map((observation, index) => ({
    id: observation?.id || `controle_${index + 1}`,
    numero: getSiteVisitObservationNumber(observation, index),
    text: normalizeText(observation?.text) || `Observation ${index + 1}`,
    images: cloneImages(observation?.images),
    date: observation?.date || visit.date || '',
  }));

  return {
    id: visit.id || '',
    nom: visit.nom || 'Visite de contrôle',
    lieu: visit.lieu || '',
    client: visit.client || '',
    date: visit.date || '',
    importedAt,
    observationCount: observations.length,
    photoCount: observations.reduce((total, observation) => total + observation.images.length, 0),
    observations,
  };
};

export const applyControlObservation = (reserve, observation) => {
  const next = { ...reserve };
  // Les photos restent stockées une seule fois dans la visite de contrôle
  // embarquée, afin de limiter la taille du document Firestore.
  delete next.controlImages;
  return {
    ...next,
    controlObservationId: observation?.id || '',
    controlObservationNumber: observation?.numero || '',
    controlText: observation?.text || '',
    controlDate: observation?.date || '',
  };
};

export const getReserveControlImages = (reserve, controlSource) => {
  if (Array.isArray(reserve?.controlImages) && reserve.controlImages.length > 0) {
    return reserve.controlImages;
  }
  return controlSource?.observations
    ?.find((observation) => observation.id === reserve?.controlObservationId)
    ?.images || [];
};

/**
 * Associe une seconde visite aux réserves initiales.
 * Le numéro d'observation constitue le repère stable ; un rapprochement manuel
 * reste possible dans le formulaire EXE8 / EXE9.
 */
export const matchControlVisitToReserves = (reserves, visit, importedAt = new Date().toISOString()) => {
  const source = siteVisitToControlSource(visit, importedAt);
  if (!source) return { reserves: reserves || [], source: null };

  const observationsByNumber = new Map(
    source.observations.map((observation) => [
      normalizeObservationNumber(observation.numero),
      observation,
    ]),
  );

  return {
    source,
    reserves: (reserves || []).map((reserve, index) => {
      const reserveNumber = reserve?.numero || String(index + 1);
      const observation = observationsByNumber.get(normalizeObservationNumber(reserveNumber));
      return applyControlObservation({
        ...reserve,
        leveeStatus: ['levee', 'maintenue', 'partiellement_levee'].includes(reserve?.leveeStatus)
          ? reserve.leveeStatus
          : 'a_qualifier',
      }, observation);
    }),
  };
};
