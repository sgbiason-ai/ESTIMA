// src/utils/gpsSimplify.js
// Simplification Douglas-Peucker pour traces GPS.
// Reduit le nombre de points en gardant les virages significatifs.

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
 * Douglas-Peucker : simplifie un trace GPS.
 * @param {Array<{lat, lng, ...}>} coords - Points GPS avec au minimum lat/lng
 * @param {number} epsilon - Tolerance en metres (defaut 5m)
 * @returns {Array} Points simplifies (meme structure, premier et dernier toujours gardes)
 */
export function simplifyGpsTrace(coords, epsilon = 5) {
  if (!coords || coords.length <= 2) return coords;

  // Trouver le point le plus eloigne du segment start-end
  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < coords.length - 1; i++) {
    const dist = perpendicularDistance(coords[i], coords[0], coords[coords.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // Si le point le plus eloigne depasse epsilon, on divise et on recurse
  if (maxDist > epsilon) {
    const left = simplifyGpsTrace(coords.slice(0, maxIdx + 1), epsilon);
    const right = simplifyGpsTrace(coords.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  // Sinon on garde seulement les extremites
  return [coords[0], coords[coords.length - 1]];
}
