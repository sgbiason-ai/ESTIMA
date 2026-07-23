// src/utils/gpsSimplify.js
// Simplification Douglas-Peucker pour traces GPS.
// Reduit le nombre de points en gardant les virages significatifs.

export const GPS_TRACK_CONFIG = Object.freeze({
  maxAccuracy: 15,
  maxSpeedKmh: 15,
  minDistance: 2.5,
  simplifyTolerance: 2,
  smoothingAlpha: 0.65,
});

const EARTH_RADIUS = 6371000;
const toRad = (value) => (value * Math.PI) / 180;

function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

function timestampMs(point) {
  const value = typeof point?.timestamp === 'number' ? point.timestamp : Date.parse(point?.timestamp || '');
  return Number.isFinite(value) ? value : null;
}

const isBreak = (point) => point?.break === true || point?._break === true;
const isCoordinate = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Processeur temps reel partage par desktop, mobile et Tesla.
 * Rejette les fixes imprecis/irrealistes, filtre la pointe mediane sur 3 fixes,
 * puis lisse et espace les positions acceptees.
 */
export function createGpsFixProcessor(initialCoords = [], options = {}) {
  const config = { ...GPS_TRACK_CONFIG, ...options };
  const seed = initialCoords.filter(point => isCoordinate(point) && !isBreak(point)).slice(-3);
  let rawWindow = [...seed];
  let lastRaw = seed.at(-1) || null;
  let lastAccepted = seed.at(-1) || null;

  return {
    push(point) {
      if (!isCoordinate(point)) return null;
      if (Number.isFinite(point.accuracy) && point.accuracy > config.maxAccuracy) return null;

      if (isBreak(point)) {
        rawWindow = [point];
        lastRaw = point;
        lastAccepted = null;
      } else if (lastRaw) {
        const previousAt = timestampMs(lastRaw);
        const currentAt = timestampMs(point);
        if (previousAt != null && currentAt != null && currentAt > previousAt) {
          const speedKmh = (distanceMeters(lastRaw, point) / ((currentAt - previousAt) / 1000)) * 3.6;
          if (speedKmh > config.maxSpeedKmh) return null;
        }
      }

      rawWindow = [...rawWindow.slice(-2), point];
      lastRaw = point;
      const candidate = rawWindow.length === 3 ? {
        ...point,
        lat: median(rawWindow.map(item => item.lat)),
        lng: median(rawWindow.map(item => item.lng)),
      } : point;

      if (lastAccepted && distanceMeters(lastAccepted, candidate) < config.minDistance) return null;

      const smoothed = lastAccepted ? {
        ...candidate,
        lat: lastAccepted.lat + config.smoothingAlpha * (candidate.lat - lastAccepted.lat),
        lng: lastAccepted.lng + config.smoothingAlpha * (candidate.lng - lastAccepted.lng),
      } : candidate;

      lastAccepted = smoothed;
      return smoothed;
    },
  };
}

/**
 * Distance perpendiculaire d'un point a un segment (en metres).
 * Utilise la formule cross-track distance sur une sphere.
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLatPS = toRad(point.lat - lineStart.lat);
  const dLngPS = toRad(point.lng - lineStart.lng);
  const dLatES = toRad(lineEnd.lat - lineStart.lat);
  const dLngES = toRad(lineEnd.lng - lineStart.lng);

  // Distance point -> start
  const a1 = Math.sin(dLatPS / 2) ** 2 + Math.cos(toRad(lineStart.lat)) * Math.cos(toRad(point.lat)) * Math.sin(dLngPS / 2) ** 2;
  const distPS = 2 * R * Math.asin(Math.sqrt(a1));

  // Distance end -> start
  const a2 = Math.sin(dLatES / 2) ** 2 + Math.cos(toRad(lineStart.lat)) * Math.cos(toRad(lineEnd.lat)) * Math.sin(dLngES / 2) ** 2;
  const distES = 2 * R * Math.asin(Math.sqrt(a2));

  if (distES < 0.1) return distPS; // segment degenere

  // Bearing start -> end
  const y1 = Math.sin(toRad(lineEnd.lng - lineStart.lng)) * Math.cos(toRad(lineEnd.lat));
  const x1 = Math.cos(toRad(lineStart.lat)) * Math.sin(toRad(lineEnd.lat))
    - Math.sin(toRad(lineStart.lat)) * Math.cos(toRad(lineEnd.lat)) * Math.cos(toRad(lineEnd.lng - lineStart.lng));
  const bearingSE = Math.atan2(y1, x1);

  // Bearing start -> point
  const y2 = Math.sin(toRad(point.lng - lineStart.lng)) * Math.cos(toRad(point.lat));
  const x2 = Math.cos(toRad(lineStart.lat)) * Math.sin(toRad(point.lat))
    - Math.sin(toRad(lineStart.lat)) * Math.cos(toRad(point.lat)) * Math.cos(toRad(point.lng - lineStart.lng));
  const bearingSP = Math.atan2(y2, x2);

  // Cross-track distance
  const crossTrack = Math.abs(Math.asin(Math.sin(distPS / R) * Math.sin(bearingSP - bearingSE)) * R);

  return crossTrack;
}

/**
 * Douglas-Peucker recursif (segment continu, sans gestion des breaks).
 */
function dpSimplify(coords, epsilon) {
  if (!coords || coords.length <= 2) return coords;

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < coords.length - 1; i++) {
    const dist = perpendicularDistance(coords[i], coords[0], coords[coords.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = dpSimplify(coords.slice(0, maxIdx + 1), epsilon);
    const right = dpSimplify(coords.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [coords[0], coords[coords.length - 1]];
}

/**
 * Douglas-Peucker : simplifie un trace GPS.
 * Respecte les marqueurs _break (coupures entre sessions) :
 * chaque segment est simplifie independamment pour ne jamais
 * relier les points d'arret et de reprise.
 *
 * @param {Array<{lat, lng, ...}>} coords - Points GPS avec au minimum lat/lng
 * @param {number} epsilon - Tolerance en metres (defaut 5m)
 * @returns {Array} Points simplifies (meme structure, breaks preserves)
 */
export function simplifyGpsTrace(coords, epsilon = 5) {
  if (!coords || coords.length <= 2) return coords;

  // Decouper aux points _break, simplifier chaque segment independamment
  const segments = [];
  let current = [];
  for (const coord of coords) {
    if (coord._break && current.length > 0) {
      segments.push(current);
      current = [coord]; // le point _break demarre le nouveau segment
    } else {
      current.push(coord);
    }
  }
  if (current.length > 0) segments.push(current);

  // Simplifier chaque segment, puis rejoindre
  return segments.flatMap(seg => dpSimplify(seg, epsilon));
}

function removeTriangleOutliers(points) {
  if (points.length < 3) return points;
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const previous = points[index - 1];
    const next = points[index + 1];
    const before = distanceMeters(previous, point);
    const after = distanceMeters(point, next);
    const direct = distanceMeters(previous, next);
    return !(Math.min(before, after) > 8 && before + after > Math.max(25, direct * 4));
  });
}

function cleanSegment(segment, config) {
  const accurate = segment.filter(point => isCoordinate(point)
    && (!Number.isFinite(point.accuracy) || point.accuracy <= config.maxAccuracy));
  if (accurate.length <= 2) return accurate;

  const plausible = [];
  for (const point of accurate) {
    const previous = plausible.at(-1);
    if (previous) {
      const previousAt = timestampMs(previous);
      const currentAt = timestampMs(point);
      if (previousAt != null && currentAt != null && currentAt > previousAt) {
        const speedKmh = (distanceMeters(previous, point) / ((currentAt - previousAt) / 1000)) * 3.6;
        if (speedKmh > config.maxSpeedKmh) continue;
      }
    }
    plausible.push(point);
  }

  const withoutSpikes = removeTriangleOutliers(removeTriangleOutliers(plausible));

  // Filtre médian + lissage exponentiel : retire les pics et lisse la courbe.
  // Ces deux passes ne sont PAS idempotentes — réappliquées sur une trace déjà
  // lissée, elles rabotent les virages à chaque passage. C'est pourquoi le
  // nettoyage manuel (« Nettoyer ») ne s'applique plus qu'une seule fois par
  // trace (verrou gpsTracking.cleanedAt côté appelant), au lieu de restreindre
  // le lissage lui-même.
  const smoothed = withoutSpikes.map((point, index, list) => {
    if (index === 0 || index === list.length - 1) return point;
    const window = [list[index - 1], point, list[index + 1]];
    return { ...point, lat: median(window.map(item => item.lat)), lng: median(window.map(item => item.lng)) };
  }).map((point, index, list) => index === 0 ? point : ({
    ...point,
    lat: list[index - 1].lat + config.smoothingAlpha * (point.lat - list[index - 1].lat),
    lng: list[index - 1].lng + config.smoothingAlpha * (point.lng - list[index - 1].lng),
  }));

  const spaced = [];
  for (let index = 0; index < smoothed.length; index++) {
    const point = smoothed[index];
    const isLast = index === smoothed.length - 1;
    if (spaced.length === 0 || isLast || distanceMeters(spaced.at(-1), point) >= config.minDistance) spaced.push(point);
  }
  return dpSimplify(spaced, config.simplifyTolerance);
}

/** Nettoie une trace existante sans relier les coupures entre sessions. */
export function cleanGpsTrace(coords, options = {}) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const config = { ...GPS_TRACK_CONFIG, ...options };
  const result = [];
  let segment = [];

  const flush = () => {
    if (segment.length) result.push(...cleanSegment(segment, config));
    segment = [];
  };

  for (const point of coords) {
    if (isBreak(point)) {
      flush();
      result.push(point);
    } else {
      segment.push(point);
    }
  }
  flush();
  return result;
}
