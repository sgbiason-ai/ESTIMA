// src/utils/expenseGeo.js
// Helpers Nominatim (geocoding) + OpenRouteService (distance route).
// Services publics autorises dans la CSP de l'app.
//
// CGU :
//   - Nominatim : max 1 req/sec, User-Agent recommande, ne pas spammer
//   - OpenRouteService : 2000 req/jour sur le free tier (cle dans .env.local)
//
// Cache en memoire (par session) pour reduire les appels.

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const ORS_BASE = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const ORS_TOKEN = import.meta.env?.VITE_ORS_TOKEN || '';

// Fallback offline quand le service de routing est indispo : Haversine × facteur route.
const ROAD_FACTOR = 1.3;       // typique routes europe : route ≈ vol d'oiseau × 1.3
const AVG_SPEED_KMH = 60;       // vitesse moyenne raisonnable pour estimer la durée

const geocodeCache = new Map();
const routeCache = new Map();

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fallbackEstimate(allPoints) {
  let directKm = 0;
  for (let i = 0; i < allPoints.length - 1; i++) {
    directKm += haversineKm(
      allPoints[i].lat,
      allPoints[i].lon,
      allPoints[i + 1].lat,
      allPoints[i + 1].lon,
    );
  }
  const km = Math.round(directKm * ROAD_FACTOR * 10) / 10;
  const durationMin = Math.round((km / AVG_SPEED_KMH) * 60);
  // Trace approximatif : lignes droites entre les points (carte affichera des segments)
  const coordinates = allPoints.map((p) => [p.lat, p.lon]);
  return { km, durationMin, coordinates, estimated: true };
}

const cacheKey = (...parts) => parts.map((p) => String(p).toLowerCase().trim()).join('|');

/**
 * Recherche d'adresses via Nominatim.
 * @param {string} query - texte saisi (ex: "Toulouse", "12 rue de la rep")
 * @param {AbortSignal} signal - pour annuler la requete (debounce)
 * @returns {Promise<Array<{ label, displayName, lat, lon, id }>>}
 */
export async function searchAddresses(query, signal) {
  const q = query.trim();
  if (q.length < 3) return [];

  const key = cacheKey('search', q);
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    'accept-language': 'fr',
    countrycodes: 'fr',
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}?${params}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.map((r) => ({
      id: r.place_id,
      label: formatLabel(r),
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
    geocodeCache.set(key, results);
    return results;
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.warn('[expenseGeo] searchAddresses failed', err);
    return [];
  }
}

/**
 * Format un label compact lisible : "Mairie d'Albi, Albi (81)" plutot que le display_name complet.
 */
function formatLabel(r) {
  const a = r.address || {};
  const name = a.amenity || a.shop || a.tourism || a.building || a.road || a.suburb || '';
  const city = a.city || a.town || a.village || a.municipality || '';
  const postcode = a.postcode || '';
  const dept = postcode ? postcode.slice(0, 2) : '';

  if (name && city) {
    return dept ? `${name}, ${city} (${dept})` : `${name}, ${city}`;
  }
  if (city) {
    return dept ? `${city} (${dept})` : city;
  }
  // Fallback : 2 premiers segments du display_name
  return r.display_name.split(',').slice(0, 2).join(',').trim();
}

/**
 * Calcul de la route entre points geocodes (OpenRouteService), avec etapes intermediaires.
 * Fallback Haversine ×1.3 si la cle ORS est absente ou si l'API echoue.
 *
 * @param {{lat, lon}} from
 * @param {{lat, lon}} to
 * @param {Array<{lat, lon} | null>} waypoints  etapes intermediaires (optionnel)
 * @returns {Promise<{ km, durationMin, coordinates, estimated } | null>}
 */
export async function calculateRouteDistance(from, to, waypoints = []) {
  const allPoints = [from, ...waypoints, to].filter((p) => p?.lat != null && p?.lon != null);
  if (allPoints.length < 2) return null;

  const key = cacheKey('route', ...allPoints.flatMap((p) => [p.lat, p.lon]));
  if (routeCache.has(key)) return routeCache.get(key);

  // Pas de cle → fallback direct (utile en dev sans .env.local)
  if (!ORS_TOKEN) {
    console.warn('[expenseGeo] VITE_ORS_TOKEN absent → fallback Haversine');
    return fallbackEstimate(allPoints);
  }

  // ORS attend des coordonnees [lon, lat]
  const coordinates = allPoints.map((p) => [p.lon, p.lat]);
  try {
    const res = await fetch(ORS_BASE, {
      method: 'POST',
      headers: {
        'Authorization': ORS_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json',
      },
      body: JSON.stringify({ coordinates }),
    });
    if (!res.ok) {
      console.warn(`[expenseGeo] ORS HTTP ${res.status} → fallback Haversine ×${ROAD_FACTOR}`);
      return fallbackEstimate(allPoints);
    }
    const data = await res.json();
    const feature = data?.features?.[0];
    const summary = feature?.properties?.summary;
    if (!feature || !summary) {
      return fallbackEstimate(allPoints);
    }

    // ORS renvoie [lon, lat] : on convertit en [lat, lon] pour Leaflet
    const coords = (feature.geometry?.coordinates || []).map(([lon, lat]) => [lat, lon]);

    const result = {
      km: Math.round((summary.distance / 1000) * 10) / 10,
      durationMin: Math.round(summary.duration / 60),
      coordinates: coords,
      estimated: false,
    };
    routeCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('[expenseGeo] ORS error → fallback Haversine', err?.message || err);
    return fallbackEstimate(allPoints);
  }
}

/**
 * Format duree en "1h05" / "45 min".
 */
export function formatDuration(durationMin) {
  if (!durationMin) return '';
  if (durationMin < 60) return `${durationMin} min`;
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
