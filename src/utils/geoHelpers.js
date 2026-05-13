// src/utils/geoHelpers.js
// Helpers géo & formatage partagés — SiteVisitsView, TeslaModeView, GpsMapView, etc.
// Centralise haversine, formatage distance/durée/coordonnées, incertitude, géolocalisation, routage IGN.

// ─── Distance & Géométrie ────────────────────────────────────────────────────

/** Distance haversine en mètres entre deux points {lat, lng} */
export const haversine = (a, b) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * Distance totale le long d'un tableau de coordonnées.
 * Les points avec `break` ou `_break` (marqueurs de saut entre segments) sont ignorés.
 */
export const totalDistance = (coords) => {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    if (coords[i].break || coords[i]._break || coords[i - 1].break || coords[i - 1]._break) continue;
    d += haversine(coords[i - 1], coords[i]);
  }
  return d;
};

/** Découpe un tableau de coordonnées avec des {break:true} en segments continus [[lat,lng], …] */
export const splitTraceSegments = (coords) => {
  const segs = [];
  let cur = [];
  for (const c of coords) {
    if (c.break) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    } else {
      cur.push([c.lat, c.lng]);
    }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
};

// ─── Formatage ───────────────────────────────────────────────────────────────

/** Couleur selon la précision GPS (vert / orange / rouge) */
export const accuracyColor = (acc) => acc <= 5 ? '#22c55e' : acc <= 15 ? '#f59e0b' : '#ef4444';

/** Durée lisible (ex: "2h05" ou "3min 12s") */
export const fmtDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m}min ${String(s % 60).padStart(2, '0')}s`;
};

/** Date formatée fr-FR (ex: "12 mai 2026") */
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

/** Distance formatée (m ou km) */
export const fmtDist = (m) => m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

/** Incertitude formatée (±Xm ou ±X.Xkm) */
export const fmtUncertainty = (u) => u == null ? '' : u < 1000 ? `±${Math.round(u)}m` : `±${(u / 1000).toFixed(1)}km`;

/** Coordonnées formatées (lat, lng à 4 décimales) */
export const fmtCoord = (lat, lng) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

// ─── Incertitude & Géolocalisation ───────────────────────────────────────────

/**
 * Incertitude distance adaptée à la source (propagation quadratique, ~1σ).
 * accuracy navigateur = écart-type position ≈ 68% de confiance.
 * @param {'ign'|'trace'|'haversine'} source - Méthode de mesure
 * @param {number} accA - Précision GPS point A (m)
 * @param {number} accB - Précision GPS point B (m)
 * @param {number} distance - Distance mesurée (m)
 */
export const computeUncertainty = (source, accA, accB, distance) => {
  const sigEndpoints2 = (accA || 0) ** 2 + (accB || 0) ** 2;
  if (source === 'ign') {
    const routingErr = 0.02 * distance; // ~2% erreur routage/carte
    return Math.round(Math.sqrt(sigEndpoints2 + routingErr ** 2));
  }
  if (source === 'trace') {
    const jitterErr = 0.05 * distance; // ~5% biais cumul jitter GPS
    return Math.round(Math.sqrt(sigEndpoints2 + jitterErr ** 2));
  }
  // haversine (vol d'oiseau) : seuls les 2 fixes comptent
  return Math.round(Math.sqrt(sigEndpoints2));
};

/** Wrapper Promise autour de navigator.geolocation.getCurrentPosition */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non disponible'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

// ─── Routage IGN ─────────────────────────────────────────────────────────────

/**
 * Routing IGN Itinéraires (libre, France) — remplace OSRM demo, avec retry.
 * @returns {{ coordinates: [lat,lng][], distance: number } | null}
 */
export async function fetchIgnRoute(from, to, retries = 2) {
  const url = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}&profile=car&optimization=fastest&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const geom = data?.geometry;
        if (geom?.coordinates?.length >= 2) {
          return { coordinates: geom.coordinates.map(c => [c[1], c[0]]), distance: Number(data.distance) || 0 };
        }
      }
    } catch { /* retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
}
