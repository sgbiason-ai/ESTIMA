import { stripHtml } from '../formatObsText';
import { simplifyGpsTrace } from '../gpsSimplify';

const normalizeText = (value) => stripHtml(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

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
    const images = (Array.isArray(observation?.images) ? observation.images : [])
      .filter((image) => !!getReserveImageSrc(image))
      .map((image) => (typeof image === 'object' && image ? { ...image } : image));

    return {
      id: `visite_${visit.id || 'sans-id'}_${observation?.id || index + 1}`,
      numero: String(index + 1),
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
