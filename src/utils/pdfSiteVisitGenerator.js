// src/utils/pdfSiteVisitGenerator.js
// Generateur PDF moderne pour les visites de site — rapport terrain diffusable.
// Inclut : page de garde branding, vue aerienne, fiches observations.

import jsPDF from 'jspdf';
import { buildTheme } from './pdf/buildTheme';
import { loadImage, formatDateFr, formatDateLong, lightenRgb, loadLogos, fitTextToWidth, drawCoverPage as drawSharedCoverPage } from './pdf/pdfSharedHelpers';
import { stampPdfCredit } from './estimaCredit';
import { usesPapyrusCover } from './coverPageTemplate';
import { PDF_MAP_VIEWS, DEFAULT_PDF_VIEWS, buildTileUrl, lat2tileY, lng2tileX, latLng2px } from './ignTiles';

const PW = 210, PH = 297;
const M = { top: 18, left: 15, right: 15, bottom: 18 };
const CW = PW - M.left - M.right;

// Vignettes cartographiques des observations (colonne de droite, en mm).
// Vue simple = un carré 55x55 ; vue double = deux bandeaux 55x27 EMPILÉS —
// deux carrés côte à côte tombaient à 26 mm de large, illisibles à l'impression.
const OBS_MAP_W = 55;
const OBS_MAP_GUTTER = 3;
const OBS_MAP_H_DUAL = 27;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const stripHtml = (str) => (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const fmtDist = (m) => {
  if (!m || m <= 0) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
};

const countPhotos = (observations) =>
  (observations || []).reduce((acc, obs) => acc + (obs.images || []).length, 0);

// ─── DESSIN EN-TETE (pages 2+) ───────────────────────────────────────────────

// Dimensions lues sur la page COURANTE (doc.internal.pageSize) : les pages de
// plans annotés peuvent être en paysage, les constantes PW/PH ne suffisent plus.
const drawHeader = (doc, THEME, visitName, date, logoMoe) => {
  const pw = doc.internal.pageSize.getWidth();

  // Bande fine en haut
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, pw, 3, 'F');

  // Logo petit
  if (logoMoe) {
    const aspect = logoMoe.width / logoMoe.height;
    const h = 8;
    const w = Math.min(h * aspect, 25);
    doc.addImage(logoMoe, 'JPEG', M.left, 5, w, h);
  }

  // Nom visite + date
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.text);
  doc.text(fitTextToWidth(doc, visitName || 'Visite de Site', pw * 0.6), pw / 2, 10, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...THEME.lightText);
  doc.text(date ? formatDateLong(date) : '', pw - M.right, 10, { align: 'right' });

  // Ligne separatrice
  doc.setDrawColor(...THEME.borders);
  doc.line(M.left, 15, pw - M.right, 15);
};

// ─── DESSIN PIED DE PAGE ──────────────────────────────────────────────────────

const drawFooter = (doc, THEME, pageNum, totalPages, branding) => {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const cw = pw - M.left - M.right;
  const y = ph - 10;
  doc.setDrawColor(...THEME.borders);
  doc.line(M.left, y - 2, pw - M.right, y - 2);

  // Coordonnees entreprise
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...THEME.lightText);
  const footer = [branding?.companyName, branding?.phone, branding?.email].filter(Boolean).join(' • ');
  if (footer) doc.text(fitTextToWidth(doc, footer, cw / 2), M.left, y + 1);

  // Numero de page
  doc.text(`${pageNum} / ${totalPages}`, pw - M.right, y + 1, { align: 'right' });
};

// ─── PAGE DE GARDE ────────────────────────────────────────────────────────────

const drawCoverPage = (doc, visit, THEME, logoMoe, branding) => {
  // Bande couleur en haut
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, PW, 8, 'F');

  // Bande laterale gauche
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 5, PH, 'F');

  // Logo
  let logoBottom = 35;
  if (logoMoe) {
    const aspect = logoMoe.width / logoMoe.height;
    const h = 20;
    const w = Math.min(h * aspect, 50);
    doc.addImage(logoMoe, 'JPEG', M.left + 8, 18, w, h);
    logoBottom = 18 + h + 10;
  }

  // Label document
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text('RAPPORT DE', PW - M.right, 22, { align: 'right' });
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...THEME.primary);
  doc.text('VISITE DE CHANTIER', PW - M.right, 32, { align: 'right' });

  // Ligne accent
  const lineY = Math.max(logoBottom, 48);
  doc.setDrawColor(...THEME.primary);
  doc.setLineWidth(0.8);
  doc.line(M.left + 8, lineY, PW - M.right, lineY);
  doc.setLineWidth(0.2);

  // Nom de la visite
  let y = lineY + 18;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...THEME.text);
  const titleLines = doc.splitTextToSize(visit.nom || 'Visite de Site', CW - 15);
  doc.text(titleLines, M.left + 8, y);
  y += titleLines.length * 10 + 8;

  // Infos projet
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...THEME.lightText);
  if (visit.lieu) { doc.text(fitTextToWidth(doc, visit.lieu, CW - 16), M.left + 8, y); y += 6; }
  if (visit.client) { doc.text(fitTextToWidth(doc, `Client : ${visit.client}`, CW - 16), M.left + 8, y); y += 6; }
  if (visit.date) { doc.text(formatDateLong(visit.date), M.left + 8, y); y += 6; }

  // Bloc stats
  y += 12;
  const observations = visit.observations || [];
  const tracking = visit.gpsTracking || {};
  const nbObs = observations.length;
  const nbPhotos = countPhotos(observations);
  const dist = tracking.distance ? `${fmtDist(tracking.distance)} ±${Math.round(0.05 * tracking.distance)}m` : '';
  const nbPts = (tracking.coordinates || []).length;

  doc.setFillColor(...lightenRgb(THEME.primary, 0.92));
  doc.roundedRect(M.left + 8, y, CW - 15, 30, 3, 3, 'F');

  const stats = [
    { val: String(nbObs), label: 'Observations' },
    { val: String(nbPhotos), label: 'Photos' },
    ...(dist ? [{ val: dist, label: 'Distance' }] : []),
    ...(nbPts > 0 ? [{ val: String(nbPts), label: 'Points GPS' }] : []),
  ];

  const colW = (CW - 15) / stats.length;
  stats.forEach((s, i) => {
    const cx = M.left + 8 + colW * i + colW / 2;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...THEME.primary);
    doc.text(s.val, cx, y + 14, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...THEME.lightText);
    doc.text(s.label, cx, y + 22, { align: 'center' });
  });

  // Coordonnees en bas de page
  const footerY = PH - 30;
  doc.setDrawColor(...THEME.borders);
  doc.line(M.left + 8, footerY, PW - M.right, footerY);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.primary);
  if (branding?.companyName) doc.text(fitTextToWidth(doc, branding.companyName, CW - 16), M.left + 8, footerY + 8);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...THEME.lightText);
  const contactLines = [branding?.address, [branding?.phone, branding?.email].filter(Boolean).join(' • '), branding?.website].filter(Boolean);
  contactLines.forEach((line, i) => {
    doc.text(fitTextToWidth(doc, line, CW - 16), M.left + 8, footerY + 14 + i * 4);
  });

  // Date export
  doc.setFontSize(7);
  doc.text(`Edité le ${new Date().toLocaleDateString('fr-FR')}`, PW - M.right, footerY + 8, { align: 'right' });
};

// ─── TUILES SATELLITE (slippy tiles comme Leaflet) ────────────────────────────

// Maths slippy tiles : lat2tileY / lng2tileX / latLng2px viennent d'ignTiles.js

const fetchTileAsImg = async (url, maxAttempts = 3, timeoutMs = 5000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const dataUrl = await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(blob); });
      return await loadImage(dataUrl);
    } catch {
      clearTimeout(timer);
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  return null;
};

// Assemble une pile de calques WMTS sur un canvas de tuiles : les calques sont
// dessines l'un apres l'autre (fond puis surcouches, ex. cadastre sur le plan),
// les tuiles d'un meme calque en parallele. Les tuiles absentes sont ignorees.
const drawTileStack = async (ctx, stack, zoom, tileXmin, tileXmax, tileYmin, tileYmax) => {
  for (const layerKey of stack) {
    const jobs = [];
    for (let ty = tileYmin; ty <= tileYmax; ty++) {
      for (let tx = tileXmin; tx <= tileXmax; tx++) {
        const url = buildTileUrl(layerKey, zoom, tx, ty);
        if (!url) continue;
        const dx = (tx - tileXmin) * 256;
        const dy = (ty - tileYmin) * 256;
        jobs.push(fetchTileAsImg(url).then(img => { if (img) ctx.drawImage(img, dx, dy, 256, 256); }));
      }
    }
    await Promise.all(jobs);
  }
};

// Resout une cle de vue vers sa definition (fallback sur le rendu historique).
const resolveView = (viewKey, fallbackKey) => PDF_MAP_VIEWS[viewKey] || PDF_MAP_VIEWS[fallbackKey];

// ─── GENERATION CARTE SATELLITE (Canvas natif + tuiles) ──────────────────────

// IGN Itinéraires (libre, France) — remplace OSRM demo, avec retry
const fetchIgnRoutePdf = async (from, to, retries = 2) => {
  const url = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}&profile=car&optimization=fastest&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const geom = data?.geometry;
        if (geom?.coordinates?.length >= 2) return geom.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
      }
    } catch { /* retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
};

const buildMapCanvas = async (visit, THEME, viewKey = DEFAULT_PDF_VIEWS.overview) => {
  const tracking = visit.gpsTracking || {};
  const coordinates = tracking.coordinates || [];
  const observations = visit.observations || [];

  // Collecter les segments mesurés
  const segments = observations.filter(obs => obs.segmentFrom && obs.segmentTo);

  const hasLocatedObservation = observations.some(obs => (
    (obs.pointLocation?.lat != null && obs.pointLocation?.lng != null)
    || (obs.images || []).some(img => typeof img === 'object' && img?.lat != null && img?.lng != null)
  ));
  if (coordinates.length === 0 && segments.length === 0 && !hasLocatedObservation) return null;

  // Collecter tous les points (GPS + observations + segments)
  const allPoints = coordinates.filter(c => !c.break).map(c => ({ lat: c.lat, lng: c.lng }));
  segments.forEach(seg => {
    allPoints.push({ lat: seg.segmentFrom.lat, lng: seg.segmentFrom.lng });
    allPoints.push({ lat: seg.segmentTo.lat, lng: seg.segmentTo.lng });
  });
  const obsPositions = [];
  observations.forEach((obs, idx) => {
    let lat = null, lng = null;
    if (obs.pointLocation?.lat != null && obs.pointLocation?.lng != null) {
      lat = obs.pointLocation.lat;
      lng = obs.pointLocation.lng;
    } else if (obs.segmentFrom && obs.segmentTo) {
      lat = (obs.segmentFrom.lat + obs.segmentTo.lat) / 2;
      lng = (obs.segmentFrom.lng + obs.segmentTo.lng) / 2;
    }
    if (lat == null) {
      for (const img of (obs.images || [])) {
        if (typeof img === 'object' && img.lat != null) { lat = img.lat; lng = img.lng; break; }
      }
    }
    if (lat == null) {
      const realCoords = coordinates.filter(c => !c.break);
      if (realCoords.length > 0) {
        const pos = Math.min(Math.floor((idx / Math.max(observations.length, 1)) * realCoords.length), realCoords.length - 1);
        lat = realCoords[pos].lat;
        lng = realCoords[pos].lng;
      }
    }
    if (lat != null) {
      allPoints.push({ lat, lng });
      obsPositions.push({ lat, lng, number: obs.mapNumber || idx + 1 });
    }
  });

  // Calculer les bounds avec marge
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  allPoints.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });
  const padLat = (maxLat - minLat) * 0.15 || 0.001;
  const padLng = (maxLng - minLng) * 0.15 || 0.001;
  minLat -= padLat; maxLat += padLat;
  minLng -= padLng; maxLng += padLng;

  // Determiner le zoom optimal
  let zoom = 18;
  for (let z = 18; z >= 1; z--) {
    const x1 = lng2tileX(minLng, z), x2 = lng2tileX(maxLng, z);
    const y1 = lat2tileY(maxLat, z), y2 = lat2tileY(minLat, z);
    const tilesX = x2 - x1 + 1, tilesY = y2 - y1 + 1;
    if (tilesX * tilesY <= 30) { zoom = z; break; } // max 30 tuiles
  }

  // Calculer les tuiles necessaires
  const tileXmin = lng2tileX(minLng, zoom);
  const tileXmax = lng2tileX(maxLng, zoom);
  const tileYmin = lat2tileY(maxLat, zoom); // Y inversé : maxLat = tileYmin
  const tileYmax = lat2tileY(minLat, zoom);
  const tilesW = (tileXmax - tileXmin + 1) * 256;
  const tilesH = (tileYmax - tileYmin + 1) * 256;

  // Canvas = taille des tuiles assemblees
  const canvas = document.createElement('canvas');
  canvas.width = tilesW;
  canvas.height = tilesH;
  const ctx = canvas.getContext('2d');

  // Fond gris en attendant les tuiles
  ctx.fillStyle = '#e8edf2';
  ctx.fillRect(0, 0, tilesW, tilesH);

  // Charger et assembler les tuiles IGN Géoplateforme selon la vue choisie
  const view = resolveView(viewKey, DEFAULT_PDF_VIEWS.overview);
  await drawTileStack(ctx, view.stack, zoom, tileXmin, tileXmax, tileYmin, tileYmax);

  // Offset pour convertir les coordonnees monde en coordonnees canvas
  const worldOriginX = tileXmin * 256;
  const worldOriginY = tileYmin * 256;
  const toX = (lng) => latLng2px(0, lng, zoom).x - worldOriginX;
  const toY = (lat) => latLng2px(lat, 0, zoom).y - worldOriginY;

  // Dessiner le trace GPS (segments séparés par les breaks)
  const drawGpsSegments = (points) => {
    let drawing = false;
    for (let i = 0; i < points.length; i++) {
      if (points[i].break) { if (drawing) { ctx.stroke(); drawing = false; } continue; }
      if (!drawing) { ctx.beginPath(); ctx.moveTo(toX(points[i].lng), toY(points[i].lat)); drawing = true; }
      else ctx.lineTo(toX(points[i].lng), toY(points[i].lat));
    }
    if (drawing) ctx.stroke();
  };
  if (coordinates.length > 1) {
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawGpsSegments(coordinates);

    // Ombre trace
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 6; ctx.globalCompositeOperation = 'destination-over';
    drawGpsSegments(coordinates);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Point depart (vert)
  if (coordinates.length > 0) {
    const sx = toX(coordinates[0].lng), sy = toY(coordinates[0].lat);
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  }

  // Point arrivee (rouge)
  if (coordinates.length > 1) {
    const last = coordinates[coordinates.length - 1];
    const ex = toX(last.lng), ey = toY(last.lat);
    ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  }

  // ── Segments mesurés (route stockée en Firestore, ou fallback IGN) ──
  const segmentRoutes = await Promise.all(
    segments.map(seg => {
      if (Array.isArray(seg.segmentRoute) && seg.segmentRoute.length >= 2) {
        return Promise.resolve(seg.segmentRoute);
      }
      return fetchIgnRoutePdf(seg.segmentFrom, seg.segmentTo);
    })
  );

  segments.forEach((seg, i) => {
    const route = segmentRoutes[i];
    const points = route || [seg.segmentFrom, seg.segmentTo];

    // Ombre
    ctx.beginPath();
    ctx.moveTo(toX(points[0].lng), toY(points[0].lat));
    for (let j = 1; j < points.length; j++) ctx.lineTo(toX(points[j].lng), toY(points[j].lat));
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Trait orange
    ctx.beginPath();
    ctx.moveTo(toX(points[0].lng), toY(points[0].lat));
    for (let j = 1; j < points.length; j++) ctx.lineTo(toX(points[j].lng), toY(points[j].lat));
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Points départ (vert) et arrivée (rouge) du segment
    const sx = toX(seg.segmentFrom.lng), sy = toY(seg.segmentFrom.lat);
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    const ex = toX(seg.segmentTo.lng), ey = toY(seg.segmentTo.lat);
    ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  });

  // Marqueurs observations numerotes
  const primaryHex = THEME.primary;
  const primaryCss = `rgb(${primaryHex[0]},${primaryHex[1]},${primaryHex[2]})`;
  obsPositions.forEach(obs => {
    const ox = toX(obs.lng), oy = toY(obs.lat);
    const r = 11;
    // Ombre
    ctx.beginPath(); ctx.arc(ox + 1, oy + 1, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    // Cercle
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fillStyle = primaryCss; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // Numero
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(obs.number), ox, oy);
  });

  return canvas.toDataURL('image/jpeg', 0.92);
};

/**
 * Produit uniquement la carte générale d'une visite (trace + repères numérotés).
 * Utilisé par le rapport de visite et par les annexes de réserves EXE4/EXE5.
 */
export const generateSiteVisitOverviewMap = async (visit, options = {}) => (
  buildMapCanvas(
    visit,
    { primary: options.primary || [37, 99, 235] },
    options.viewKey || DEFAULT_PDF_VIEWS.overview,
  )
);

// ─── PAGE VUE AERIENNE ────────────────────────────────────────────────────────

const drawMapPage = async (doc, mapImage, visit, THEME) => {
  // Orientation explicite : jsPDF mémorise l'orientation du dernier addPage
  // (pages de plans annotés possiblement en paysage).
  doc.addPage('a4', 'p');
  const startY = 20;

  // Titre section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...THEME.primary);
  doc.text('Vue aérienne', M.left, startY);

  // Sous-titre
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.lightText);
  doc.text('Les numéros correspondent aux observations détaillées ci-après', M.left, startY + 6);

  // Image carte
  const mapY = startY + 12;
  const mapW = CW;
  const maxMapH = PH - mapY - 40;

  if (mapImage) {
    try {
      const img = await loadImage(mapImage);
      let imgW = mapW;
      let imgH = img ? (imgW / img.width) * img.height : maxMapH * 0.8;
      if (imgH > maxMapH) { imgH = maxMapH; imgW = (imgH / img.height) * img.width; }

      // Centrer horizontalement si l'image est plus etroite
      const imgX = M.left + (mapW - imgW) / 2;

      // Cadre
      doc.setDrawColor(...THEME.borders);
      doc.setLineWidth(0.3);
      doc.roundedRect(imgX, mapY, imgW, imgH, 2, 2, 'S');
      doc.addImage(mapImage, 'JPEG', imgX + 0.5, mapY + 0.5, imgW - 1, imgH - 1);
      doc.setLineWidth(0.2);

      // Legende sous la carte
      const legendY = mapY + imgH + 6;
      const tracking = visit.gpsTracking || {};
      const dist = tracking.distance ? `${fmtDist(tracking.distance)} ±${Math.round(0.05 * tracking.distance)}m` : '';
      const nbPts = (tracking.coordinates || []).length;

      doc.setFillColor(...lightenRgb(THEME.primary, 0.94));
      doc.roundedRect(M.left, legendY, CW, 14, 2, 2, 'F');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...THEME.lightText);
      const legendItems = [];
      if (nbPts > 0) legendItems.push(`${nbPts} points GPS`);
      if (dist) legendItems.push(`Distance : ${dist}`);
      if (tracking.startTime && tracking.endTime) {
        const start = new Date(tracking.startTime);
        const end = new Date(tracking.endTime);
        const mins = Math.round((end - start) / 60000);
        if (mins > 0) legendItems.push(`Durée : ${mins} min`);
      }
      if (legendItems.length) {
        doc.text(legendItems.join('   •   '), PW / 2, legendY + 9, { align: 'center' });
      }
    } catch {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...THEME.lightText);
      doc.text('Carte non disponible', PW / 2, mapY + 40, { align: 'center' });
    }
  } else {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.lightText);
    doc.text('Aucune donnée GPS — carte non générée', PW / 2, mapY + 40, { align: 'center' });
  }
};

// ─── PAGES PLANS ANNOTÉS ─────────────────────────────────────────────────────

// Precharge les plans importes (visit.plans) en dataURL, comme preloadObsImages :
// getBlob sur plan.path via le SDK, fallback fetch de plan.src avec retry
// '?swbust=' (le SW CacheFirst peut resservir une reponse opaque). Un plan en
// echec est simplement ignore. Retourne Map<planId, { w, h, uri }>.
const preloadPlanImages = async (visit) => {
  const cache = new Map();
  const plans = visit?.plans || [];
  if (!plans.length) return cache;

  let fbGetBlob, fbRef, fbStorage;
  try {
    const fbMod = await import('firebase/storage');
    fbGetBlob = fbMod.getBlob;
    fbRef = fbMod.ref;
    fbStorage = (await import('../firebaseStorage')).storage;
  } catch { /* Firebase non disponible */ }

  const blobToDataUrl = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

  for (const plan of plans) {
    if (!plan?.id || cache.has(plan.id)) continue;
    const src = plan.src || null;

    let dataUri = null;
    if (src && src.startsWith('data:')) {
      dataUri = src;
    } else if (plan.path && fbGetBlob && fbStorage) {
      try { dataUri = await blobToDataUrl(await fbGetBlob(fbRef(fbStorage, plan.path))); } catch { /* fallback */ }
    }
    if (!dataUri && src && !src.startsWith('data:')) {
      try {
        let resp = await fetch(src);
        if (!resp.ok) resp = await fetch(src + (src.includes('?') ? '&' : '?') + 'swbust=' + Date.now());
        if (resp.ok) dataUri = await blobToDataUrl(await resp.blob());
      } catch { /* plan ignore */ }
    }
    if (dataUri) {
      const img = await loadImage(dataUri).catch(() => null);
      if (img) cache.set(plan.id, { w: img.width, h: img.height, uri: dataUri });
    }
  }
  return cache;
};

// Compose l'image d'un plan avec ses pastilles d'observation (canvas 2D), au
// style exact des marqueurs de la carte (buildMapCanvas) : cercle THEME.primary,
// lisere blanc, ombre, numero blanc gras = index de l'obs dans visit.observations
// + 1 (jamais persiste). Taille adaptee a la resolution du plan.
const buildAnnotatedPlanImage = async (plan, cached, observations, THEME) => {
  const img = await loadImage(cached.uri);
  const canvas = document.createElement('canvas');
  canvas.width = cached.w;
  canvas.height = cached.h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Diametre ~2,4 % du cote max de l'image, minimum 30 px ; ombre, lisere et
  // police croissent proportionnellement (base carte : r=11, lisere 2, 13px).
  const maxSide = Math.max(canvas.width, canvas.height);
  const r = Math.max(30, maxSide * 0.024) / 2;
  const off = Math.max(1, r / 11);
  const primaryCss = `rgb(${THEME.primary[0]},${THEME.primary[1]},${THEME.primary[2]})`;

  observations.forEach((obs, idx) => {
    const pin = obs?.planPin;
    if (!pin || pin.planId !== plan.id || pin.x == null || pin.y == null) return;
    const ox = pin.x * canvas.width;
    const oy = pin.y * canvas.height;
    // Ombre
    ctx.beginPath(); ctx.arc(ox + off, oy + off, r + off, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    // Cercle
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fillStyle = primaryCss; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, (r * 2) / 11); ctx.stroke();
    // Numero
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round((r * 13) / 11)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), ox, oy);
  });

  return canvas.toDataURL('image/jpeg', 0.92);
};

// Une page par plan importe, entre la carte pleine page et les observations.
// Orientation par plan (paysage si l'image est plus large que haute), gabarit
// calque sur drawMapPage : titre, sous-titre, image centree ratio preserve dans
// un cadre arrondi. Un plan sans pastille est inclus quand meme.
const drawAnnotatedPlanPages = async (doc, visit, planImages, THEME) => {
  const observations = visit.observations || [];

  for (const plan of (visit.plans || [])) {
    const cached = plan?.id ? planImages.get(plan.id) : null;
    if (!cached) continue; // plan non charge → ignore silencieusement

    let annotated = null;
    try { annotated = await buildAnnotatedPlanImage(plan, cached, observations, THEME); } catch { /* plan illisible */ }
    if (!annotated) continue;

    doc.addPage('a4', cached.w > cached.h ? 'l' : 'p');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const cw = pw - M.left - M.right;
    const startY = 20;

    // Titre section
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...THEME.primary);
    doc.text(fitTextToWidth(doc, `Plan annoté — ${plan.name || 'Plan'}`, cw), M.left, startY);

    // Sous-titre
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    doc.text('Les numéros renvoient aux observations · Plan sans échelle', M.left, startY + 6);

    // Image centree, ratio preserve, dans un cadre arrondi
    const imgY = startY + 12;
    const maxH = ph - imgY - 20; // reserve pied de page
    let imgW = cw;
    let imgH = (imgW / cached.w) * cached.h;
    if (imgH > maxH) { imgH = maxH; imgW = (imgH / cached.h) * cached.w; }
    const imgX = M.left + (cw - imgW) / 2;

    try {
      doc.setDrawColor(...THEME.borders);
      doc.setLineWidth(0.3);
      doc.roundedRect(imgX, imgY, imgW, imgH, 2, 2, 'S');
      doc.addImage(annotated, 'JPEG', imgX + 0.5, imgY + 0.5, imgW - 1, imgH - 1);
      doc.setLineWidth(0.2);
    } catch { /* image illisible pour jsPDF */ }
  }
};

// ─── MINI-CARTE PAR OBSERVATION ──────────────────────────────────────────────

// Retourne un tableau de vignettes (1 image, ou 2 en vue « Satellite + Plan »).
const buildObsMiniMap = async (obs, visit, THEME, obsIdx, viewKey = DEFAULT_PDF_VIEWS.obs) => {
  const tracking = visit.gpsTracking || {};
  const coordinates = tracking.coordinates || [];
  const hasSeg = obs.segmentFrom && obs.segmentTo;

  // Déterminer le centre et les points à afficher
  let centerLat, centerLng;
  const points = [];

  if (hasSeg) {
    points.push({ lat: obs.segmentFrom.lat, lng: obs.segmentFrom.lng });
    points.push({ lat: obs.segmentTo.lat, lng: obs.segmentTo.lng });
    centerLat = (obs.segmentFrom.lat + obs.segmentTo.lat) / 2;
    centerLng = (obs.segmentFrom.lng + obs.segmentTo.lng) / 2;
  } else if (obs.pointLocation?.lat != null && obs.pointLocation?.lng != null) {
    centerLat = obs.pointLocation.lat;
    centerLng = obs.pointLocation.lng;
    points.push({ lat: centerLat, lng: centerLng });
  } else {
    // Chercher position depuis photos ou tracé
    for (const img of (obs.images || [])) {
      if (typeof img === 'object' && img.lat != null) { centerLat = img.lat; centerLng = img.lng; break; }
    }
    if (centerLat == null && coordinates.length > 0) {
      const pos = Math.min(Math.floor((obsIdx / Math.max((visit.observations || []).length, 1)) * coordinates.length), coordinates.length - 1);
      centerLat = coordinates[pos].lat;
      centerLng = coordinates[pos].lng;
    }
    if (centerLat != null) points.push({ lat: centerLat, lng: centerLng });
  }

  if (points.length === 0) return null;

  // Bounds avec marge
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  points.forEach(p => { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); });

  // Ajouter des points du tracé GPS proches pour contexte
  const nearbyCoords = coordinates.filter(c => {
    if (c.break) return false;
    const dlat = Math.abs(c.lat - (minLat + maxLat) / 2);
    const dlng = Math.abs(c.lng - (minLng + maxLng) / 2);
    return dlat < 0.005 && dlng < 0.005;
  });

  nearbyCoords.forEach(c => { minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat); minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng); });

  const padLat = Math.max((maxLat - minLat) * 0.25, 0.0005);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.0005);
  minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;

  // Ratio du cadre de destination : carré en vue simple, paysage 55x27 en vue
  // double (deux vignettes empilées). Le crop doit respecter ce ratio, sinon
  // jsPDF étire l'image dans son cadre.
  const view = resolveView(viewKey, DEFAULT_PDF_VIEWS.obs);
  const isDual = !!view.dual;
  const aspect = isDual ? OBS_MAP_W / OBS_MAP_H_DUAL : 1;

  // Trouver le zoom optimal — cadre en PIXELS au ratio voulu, pas en degrés
  let zoom = 18;
  for (let z = 18; z >= 1; z--) {
    const spanX = latLng2px(0, maxLng, z).x - latLng2px(0, minLng, z).x;
    const spanY = latLng2px(minLat, 0, z).y - latLng2px(maxLat, 0, z).y;
    // Largeur qui englobe les bounds au ratio demandé (hauteur = largeur/ratio)
    const w = Math.max(spanX, spanY * aspect, 128);
    // Nombre de tuiles nécessaires pour couvrir le cadre (+2 pour marges)
    const tilesX = Math.ceil(w / 256) + 2;
    const tilesY = Math.ceil(w / aspect / 256) + 2;
    if (tilesX * tilesY <= 16) { zoom = z; break; }
  }

  // Calculer le cadre en pixels au zoom choisi
  const pxMinX = latLng2px(0, minLng, zoom).x;
  const pxMaxX = latLng2px(0, maxLng, zoom).x;
  const pxMinY = latLng2px(maxLat, 0, zoom).y;
  const pxMaxY = latLng2px(minLat, 0, zoom).y;
  const cropW = Math.max(pxMaxX - pxMinX, (pxMaxY - pxMinY) * aspect, 128);
  const cropH = cropW / aspect;
  const centerPxX = (pxMinX + pxMaxX) / 2;
  const centerPxY = (pxMinY + pxMaxY) / 2;
  const halfW = cropW / 2;
  const halfH = cropH / 2;

  // Tuiles nécessaires pour couvrir le cadre pixel (avec marge)
  const tileXmin = Math.floor((centerPxX - halfW) / 256);
  const tileXmax = Math.floor((centerPxX + halfW) / 256);
  const tileYmin = Math.floor((centerPxY - halfH) / 256);
  const tileYmax = Math.floor((centerPxY + halfH) / 256);
  const tilesW = (tileXmax - tileXmin + 1) * 256;
  const tilesH = (tileYmax - tileYmin + 1) * 256;

  // Vignette de sortie au ratio du cadre PDF (512 de large, hauteur déduite)
  const OUT_W = 512;
  const OUT_H = Math.round(OUT_W / aspect);

  // Origine du canvas tuiles en coordonnées monde
  const worldOriginX = tileXmin * 256;
  const worldOriginY = tileYmin * 256;
  const toX = (lng) => latLng2px(0, lng, zoom).x - worldOriginX;
  const toY = (lat) => latLng2px(lat, 0, zoom).y - worldOriginY;

  // Centre du crop — coordonnées dans le canvas tuiles
  const cx = centerPxX - worldOriginX;
  const cy = centerPxY - worldOriginY;

  // Fonctions de coordonnées dans le crop (échelle identique sur X et Y)
  const scale = OUT_W / cropW;
  const cToX = (lng) => (toX(lng) - (cx - halfW)) * scale;
  const cToY = (lat) => (toY(lat) - (cy - halfH)) * scale;

  // Route du segment résolue UNE fois : la vue double rend deux vignettes, il ne
  // faut pas refaire l'appel itinéraire IGN pour chacune.
  let segPts = null;
  if (hasSeg) {
    const route = Array.isArray(obs.segmentRoute) && obs.segmentRoute.length >= 2
      ? obs.segmentRoute
      : await fetchIgnRoutePdf(obs.segmentFrom, obs.segmentTo);
    segPts = route || [obs.segmentFrom, obs.segmentTo];
  }

  // Rend une vignette pour une pile de calques — cadrage identique pour toutes
  const renderCrop = async (stack) => {
    const canvas = document.createElement('canvas');
    canvas.width = tilesW;
    canvas.height = tilesH;
    const ctx = canvas.getContext('2d');

    // Fond gris clair (fallback si tuiles non chargees)
    ctx.fillStyle = '#e8edf2';
    ctx.fillRect(0, 0, tilesW, tilesH);
    await drawTileStack(ctx, stack, zoom, tileXmin, tileXmax, tileYmin, tileYmax);

    const crop = document.createElement('canvas');
    crop.width = OUT_W;
    crop.height = OUT_H;
    const cctx = crop.getContext('2d');
    // Fond gris clair pour les zones hors tuiles
    cctx.fillStyle = '#e8edf2';
    cctx.fillRect(0, 0, OUT_W, OUT_H);
    cctx.drawImage(canvas, cx - halfW, cy - halfH, cropW, cropH, 0, 0, OUT_W, OUT_H);

    // Dessiner le tracé GPS à proximité
    if (nearbyCoords.length > 1) {
      cctx.beginPath();
      cctx.moveTo(cToX(nearbyCoords[0].lng), cToY(nearbyCoords[0].lat));
      for (let i = 1; i < nearbyCoords.length; i++) cctx.lineTo(cToX(nearbyCoords[i].lng), cToY(nearbyCoords[i].lat));
      cctx.strokeStyle = 'rgba(59,130,246,0.5)';
      cctx.lineWidth = 3;
      cctx.lineJoin = 'round';
      cctx.lineCap = 'round';
      cctx.stroke();
    }

    if (hasSeg) {
      const pts = segPts;

      // Ombre
      cctx.beginPath();
      cctx.moveTo(cToX(pts[0].lng), cToY(pts[0].lat));
      for (let j = 1; j < pts.length; j++) cctx.lineTo(cToX(pts[j].lng), cToY(pts[j].lat));
      cctx.strokeStyle = 'rgba(0,0,0,0.3)';
      cctx.lineWidth = 8;
      cctx.lineJoin = 'round';
      cctx.lineCap = 'round';
      cctx.stroke();

      // Trait orange
      cctx.beginPath();
      cctx.moveTo(cToX(pts[0].lng), cToY(pts[0].lat));
      for (let j = 1; j < pts.length; j++) cctx.lineTo(cToX(pts[j].lng), cToY(pts[j].lat));
      cctx.strokeStyle = '#f97316';
      cctx.lineWidth = 5;
      cctx.lineJoin = 'round';
      cctx.lineCap = 'round';
      cctx.stroke();

      // Points départ/arrivée
      const sx = cToX(obs.segmentFrom.lng), sy = cToY(obs.segmentFrom.lat);
      cctx.beginPath(); cctx.arc(sx, sy, 8, 0, Math.PI * 2);
      cctx.fillStyle = '#22c55e'; cctx.fill();
      cctx.strokeStyle = '#fff'; cctx.lineWidth = 3; cctx.stroke();

      const ex = cToX(obs.segmentTo.lng), ey = cToY(obs.segmentTo.lat);
      cctx.beginPath(); cctx.arc(ex, ey, 8, 0, Math.PI * 2);
      cctx.fillStyle = '#ef4444'; cctx.fill();
      cctx.strokeStyle = '#fff'; cctx.lineWidth = 3; cctx.stroke();
    } else {
      // Marqueur simple
      const ox = cToX(centerLng), oy = cToY(centerLat);
      cctx.beginPath(); cctx.arc(ox + 1, oy + 1, 14, 0, Math.PI * 2);
      cctx.fillStyle = 'rgba(0,0,0,0.3)'; cctx.fill();
      cctx.beginPath(); cctx.arc(ox, oy, 13, 0, Math.PI * 2);
      cctx.fillStyle = `rgb(${THEME.primary[0]},${THEME.primary[1]},${THEME.primary[2]})`; cctx.fill();
      cctx.strokeStyle = '#fff'; cctx.lineWidth = 3; cctx.stroke();
      cctx.fillStyle = '#fff';
      cctx.font = 'bold 16px system-ui';
      cctx.textAlign = 'center';
      cctx.textBaseline = 'middle';
      cctx.fillText(String(obs.mapNumber || obsIdx + 1), ox, oy);
    }

    // Bordure arrondie
    cctx.strokeStyle = 'rgba(255,255,255,0.6)';
    cctx.lineWidth = 4;
    cctx.strokeRect(2, 2, OUT_W - 4, OUT_H - 4);

    return crop.toDataURL('image/jpeg', 0.85);
  };

  // Vue double → deux vignettes (satellite + plan) sur le même cadrage
  const stacks = view.dual || [view.stack];
  const images = await Promise.all(stacks.map(stack => renderCrop(stack)));
  return images.filter(Boolean);
};

/**
 * Produit la ou les mini-cartes d'une observation pour les annexes de réserves.
 */
export const generateSiteVisitObservationMaps = async (observation, visit, options = {}) => (
  buildObsMiniMap(
    observation,
    visit,
    { primary: options.primary || [37, 99, 235] },
    options.observationIndex || 0,
    options.viewKey || DEFAULT_PDF_VIEWS.obs,
  )
);

// ─── PAGES OBSERVATIONS ───────────────────────────────────────────────────────

// Precharge les images des observations en dataURL (jsPDF n'accepte pas une URL
// Storage distante). Les photos Storage ({ src, path }) sont recuperees via le
// SDK (getBlob), avec fallback fetch ; les anciennes base64 (string) restent telles quelles.
const preloadObsImages = async (observations) => {
  let fbGetBlob, fbRef, fbStorage;
  try {
    const fbMod = await import('firebase/storage');
    fbGetBlob = fbMod.getBlob;
    fbRef = fbMod.ref;
    fbStorage = (await import('../firebaseStorage')).storage;
  } catch { /* Firebase non disponible */ }

  const blobToDataUrl = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

  const cache = new Map();
  for (const obs of observations) {
    for (const imgEntry of (obs.images || [])) {
      const src = typeof imgEntry === 'string' ? imgEntry : imgEntry?.src;
      const path = typeof imgEntry === 'object' ? imgEntry?.path : null;
      if (!src || cache.has(src)) continue;

      let dataUri = null;
      if (src.startsWith('data:')) {
        dataUri = src;
      } else if (path && fbGetBlob) {
        try { dataUri = await blobToDataUrl(await fbGetBlob(fbRef(fbStorage, path))); } catch { /* fallback */ }
      }
      if (!dataUri && !src.startsWith('data:')) {
        try {
          // Le SW (CacheFirst photos) peut resservir une reponse opaque (status 0)
          // deposee par un <img> no-cors → ok=false ; retenter avec une URL
          // modifiee pour forcer le passage reseau en mode cors.
          let resp = await fetch(src);
          if (!resp.ok) resp = await fetch(src + (src.includes('?') ? '&' : '?') + 'swbust=' + Date.now());
          if (resp.ok) dataUri = await blobToDataUrl(await resp.blob());
        } catch { /* image ignoree */ }
      }
      if (dataUri) {
        const img = await loadImage(dataUri).catch(() => null);
        if (img) cache.set(src, { w: img.width, h: img.height, uri: dataUri });
      }
    }
  }
  return cache;
};

const drawObservations = async (doc, visit, THEME, obsViewKey = DEFAULT_PDF_VIEWS.obs) => {
  const observations = visit.observations || [];
  if (!observations.length) return;

  const imageCache = await preloadObsImages(observations);

  // Orientation explicite : ne pas hériter d'une éventuelle page plan en paysage.
  doc.addPage('a4', 'p');
  let y = 20;
  // Titre section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...THEME.primary);
  doc.text('Observations', M.left, y);
  y += 10;

  // Pré-générer toutes les mini-cartes en parallèle (1 ou 2 vignettes chacune)
  const miniMaps = await Promise.all(
    observations.map((obs, i) => buildObsMiniMap(obs, visit, THEME, i, obsViewKey).catch(() => null))
  );

  // ── Grille : 2 observations par page ──
  // Chaque page est coupée en deux slots égaux (séparateur à mi-hauteur) ; les
  // photos se réduisent pour tenir dans leur slot. Une observation dont la
  // partie incompressible ne laisse aucune place aux photos dans un demi-slot
  // (texte très long) prend la page entière.
  const BOTTOM = PH - M.bottom;
  const SLOT_GAP = 5; // demi-espace autour du séparateur central
  let pageTop = y;    // 30 sur la première page (titre de section), 20 ensuite
  let slotPos = 0;    // 0 = moitié haute, 1 = moitié basse

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    const obsNum = i + 1;
    const text = stripHtml(obs.text);
    const images = obs.images || [];
    const mapImages = miniMaps[i] || [];

    // Dimensions mini-carte — la colonne fait toujours 55 mm de large ; en vue
    // double, deux bandeaux 55x27 empilés (gouttière 3 mm), sinon un carré.
    const MAP_W = OBS_MAP_W;
    const isDualMap = mapImages.length > 1;
    const tileH = isDualMap ? OBS_MAP_H_DUAL : MAP_W;
    const MAP_H = isDualMap ? tileH * 2 + OBS_MAP_GUTTER : tileH; // hauteur du bloc
    const hasMap = mapImages.length > 0;
    const textColW = hasMap ? CW - MAP_W - 5 - 13 : CW - 13; // largeur texte réduite si carte

    // Mesurer le texte avec la police de DESSIN (9pt normal, cf. plus bas),
    // sinon le wrap est calculé à 14pt (titre « Observations ») → lignes trop
    // longues dessinées à 9pt → débordement.
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const textLines = text ? doc.splitTextToSize(text, textColW) : [];
    const textH = textLines.length * 4;
    // Photos réellement chargées : une photo Storage KO ne compte pas (elle ne
    // sera pas dessinée — inutile de réserver la place ou de forcer une page).
    const nPhotos = images.filter((im) => {
      const cached = imageCache.get(typeof im === 'string' ? im : im.src);
      return cached && cached.w && cached.h;
    }).length;
    const hasImages = nPhotos > 0;
    const hasSegment = obs.segmentFrom && obs.segmentTo;

    // ── Attribution du slot ──
    // Pleine page si : plus de 2 photos (elles gardent ainsi une taille
    // confortable au lieu d'être compressées dans un demi-slot), ou hauteur
    // incompressible (en-tête + segment + texte à gauche, mini-carte à droite)
    // ne laissant pas ~25 mm aux photos dans un demi-slot (texte très long).
    const leftH = 11 + (hasSegment ? 13 : 0) + (textLines.length ? textH + 4 : 0);
    const fixedH = Math.max(leftH, hasMap ? MAP_H + 4 : 0);
    const midY = (pageTop + BOTTOM) / 2;
    const needsFullPage = nPhotos > 2
      || fixedH + (hasImages ? 25 : 0) > midY - SLOT_GAP - pageTop;

    let slotTop, slotBottom;
    if (needsFullPage) {
      if (slotPos === 1) { doc.addPage('a4', 'p'); pageTop = 20; }
      slotTop = pageTop;
      slotBottom = BOTTOM;
    } else if (slotPos === 0) {
      slotTop = pageTop;
      slotBottom = midY - SLOT_GAP;
    } else {
      // Séparateur tracé ICI, quand la moitié basse est réellement occupée —
      // pas à la fin de l'observation du haut (une bascule pleine page de la
      // suivante laisserait un trait orphelin sur une demi-page vide).
      doc.setDrawColor(...lightenRgb(THEME.primary, 0.85));
      doc.setLineWidth(0.3);
      doc.line(M.left + 13, midY, PW - M.right, midY);
      doc.setLineWidth(0.2);
      slotTop = midY + SLOT_GAP;
      slotBottom = BOTTOM;
    }
    y = slotTop;
    const obsStartY = y;

    // ── En-tete observation ──
    const pillR = 3.5;
    const pillX = M.left + 1.5;
    const pillY = y - 0.5;
    doc.setFillColor(...THEME.primary);
    doc.roundedRect(pillX, pillY, pillR * 2, pillR * 2, pillR, pillR, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(String(obsNum), pillX + pillR, pillY + pillR + 1, { align: 'center' });

    // Titre observation
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.text);
    doc.text(`Observation ${obsNum}`, M.left + 13, y + 4.5);

    // Date
    if (obs.date) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...THEME.lightText);
      const dateX = hasMap ? M.left + 13 + textColW : PW - M.right;
      doc.text(formatDateFr(obs.date), dateX, y + 4.5, { align: 'right' });
    }

    y += 11;

    // ── Mini-carte(s) à droite (empilées en vue double) ──
    if (hasMap) {
      const mapX = PW - M.right - MAP_W;
      doc.setDrawColor(...THEME.borders);
      doc.setLineWidth(0.3);
      mapImages.forEach((img, k) => {
        const mapY = obsStartY + k * (tileH + OBS_MAP_GUTTER);
        doc.roundedRect(mapX - 0.5, mapY - 0.5, MAP_W + 1, tileH + 1, 2, 2, 'S');
        doc.addImage(img, 'JPEG', mapX, mapY, MAP_W, tileH);
      });
      doc.setLineWidth(0.2);
    }

    // ── Coordonnées segment ──
    if (obs.segmentFrom && obs.segmentTo) {
      const fmtC = (lat, lng) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const fmtD = (m) => m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);

      // Départ
      doc.setFillColor(34, 197, 94);
      doc.circle(M.left + 15, y - 0.5, 1.2, 'F');
      doc.setTextColor(100, 100, 100);
      doc.text('Départ ', M.left + 18, y);
      const depCoord = fmtC(obs.segmentFrom.lat, obs.segmentFrom.lng);
      doc.setTextColor(37, 99, 235);
      const depUrl = `https://www.google.com/maps?q=${obs.segmentFrom.lat},${obs.segmentFrom.lng}`;
      doc.textWithLink(depCoord, M.left + 30, y, { url: depUrl });
      y += 4;

      // Arrivée
      doc.setFillColor(239, 68, 68);
      doc.circle(M.left + 15, y - 0.5, 1.2, 'F');
      doc.setTextColor(100, 100, 100);
      doc.text('Arrivée ', M.left + 18, y);
      const arrCoord = fmtC(obs.segmentTo.lat, obs.segmentTo.lng);
      doc.setTextColor(37, 99, 235);
      const arrUrl = `https://www.google.com/maps?q=${obs.segmentTo.lat},${obs.segmentTo.lng}`;
      doc.textWithLink(arrCoord, M.left + 32, y, { url: arrUrl });
      y += 4;

      // Distance
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text(fmtD(obs.segmentDistance), M.left + 18, y);
      if (obs.segmentUncertainty != null) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(` ±${Math.round(obs.segmentUncertainty)}m`, M.left + 18 + doc.getTextWidth(fmtD(obs.segmentDistance)) + 1, y);
      }
      y += 5;
    }

    // ── Texte ──
    if (textLines.length > 0) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...THEME.text);
      doc.text(textLines, M.left + 13, y);
      y += textH + 4;
    }

    // S'assurer que y descend au moins en-dessous de la mini-carte
    if (hasMap) {
      y = Math.max(y, obsStartY + MAP_H + 4);
    }

    // ── Images, en rangées ──
    // Les photos verticales tiennent à 3 de front sans devenir illisibles ;
    // les horizontales à 2. Chaque rangée est mise à l'échelle sur une hauteur
    // commune pour occuper la largeur utile (des photos empilées à demi-largeur
    // gaspillaient une page entière pour 3 clichés).
    if (hasImages) {
      const GAP = 4;
      const AVAIL_W = CW - 13;
      const MAX_ROW_H = 75;

      const loaded = [];
      for (const imgData of images) {
        const imgSrc = typeof imgData === 'string' ? imgData : imgData.src;
        const cached = imageCache.get(imgSrc);
        if (!cached || !cached.w || !cached.h) continue; // image non chargee (Storage/fetch KO)
        loaded.push({ data: imgData, cached, aspect: cached.w / cached.h });
      }

      // Portrait = plus haut que large (une photo carrée reste en rangée de 2)
      const allPortrait = loaded.length > 0 && loaded.every(im => im.aspect < 0.95);
      const perRow = allPortrait ? 3 : 2;
      const cellW = (AVAIL_W - GAP * (perRow - 1)) / perRow;

      const rows = [];
      for (let k = 0; k < loaded.length; k += perRow) rows.push(loaded.slice(k, k + perRow));

      // Hauteur naturelle de chaque rangée : remplit la largeur utile, sans
      // dépasser la hauteur max ni agrandir une photo au-delà de sa taille
      // naturelle. Dernière rangée incomplète : garder le gabarit des rangées
      // au-dessus, sinon une photo esseulée s'affiche plus grande.
      const rowHeights = rows.map((row) => {
        const sumAspect = row.reduce((s, im) => s + im.aspect, 0);
        const rowW = AVAIL_W - GAP * (row.length - 1);
        let rowH = Math.min(rowW / sumAspect, MAX_ROW_H, ...row.map(im => im.cached.h * 0.264));
        if (rows.length > 1 && row.length < perRow) {
          rowH = Math.min(rowH, ...row.map(im => cellW / im.aspect));
        }
        return rowH;
      });

      // Adapter la pile de rangées à la place restante du slot : réduction
      // proportionnelle uniquement (jamais d'agrandissement).
      const fixedGaps = 7 * (rows.length - 1) + 3; // respirations + marge lien GPS
      let availH = slotBottom - y - fixedGaps;
      const sumH = rowHeights.reduce((s, h) => s + h, 0);
      let shrink = sumH > availH ? Math.max(availH, 0) / sumH : 1;

      // Pleine page saturée par un très long texte : plutôt que de réduire des
      // rangées sous le seuil de lisibilité (omission à 8 mm), les photos
      // continuent sur la page suivante — comme le faisait l'ancien flux.
      // Jamais atteint en demi-slot : une seule rangée y dispose d'au moins
      // 22 mm (réserve de 25 mm dans needsFullPage).
      if (needsFullPage && rowHeights.some(h => h * shrink < 8)) {
        doc.addPage('a4', 'p');
        pageTop = 20;
        y = 20;
        availH = BOTTOM - y - fixedGaps;
        shrink = sumH > availH ? Math.max(availH, 0) / sumH : 1;
      }

      rows.forEach((row, rowIdx) => {
        const rowH = rowHeights[rowIdx] * shrink;
        if (rowH < 8) return; // slot saturé : mieux vaut omettre qu'écraser

        // Centrer la rangée dans la colonne de contenu : une rangée incomplète
        // ou réduite n'occupe pas toute la largeur utile.
        const widths = row.map(im => rowH * im.aspect);
        const rowTotalW = widths.reduce((s, w) => s + w, 0) + GAP * (row.length - 1);
        let imgX = M.left + 13 + Math.max(0, (AVAIL_W - rowTotalW) / 2);

        row.forEach((im, colIdx) => {
          const imgW = widths[colIdx];
          try {
            doc.setDrawColor(...THEME.borders);
            doc.setLineWidth(0.2);
            doc.roundedRect(imgX - 0.5, y - 0.5, imgW + 1, rowH + 1, 1, 1, 'S');
            doc.addImage(im.cached.uri, 'JPEG', imgX, y, imgW, rowH);

            if (typeof im.data === 'object' && im.data.lat != null && im.data.lng != null) {
              doc.setFont('Helvetica', 'italic');
              doc.setFontSize(6);
              doc.setTextColor(59, 130, 246);
              const url = `https://www.google.com/maps?q=${im.data.lat},${im.data.lng}`;
              doc.textWithLink('GPS', imgX, y + rowH + 3, { url });
            }
          } catch { /* image illisible pour jsPDF */ }
          imgX += imgW + GAP;
        });

        y += rowH + 6;
        if (rowIdx < rows.length - 1) y += 1; // respiration entre rangées
      });
    }

    // ── Slot suivant : moitié basse de cette page, ou page neuve ──
    if (!needsFullPage && slotPos === 0 && i < observations.length - 1) {
      slotPos = 1;
    } else {
      slotPos = 0;
      if (i < observations.length - 1) { doc.addPage('a4', 'p'); pageTop = 20; }
    }
  }
};

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────

// options.obsMapView / options.overviewMapView : cles de PDF_MAP_VIEWS (ignTiles).
// options.includePlans : inclure les pages « Plan annoté » (defaut true, sans
// effet si la visite n'a pas de plans).
export const generateSiteVisitPdf = async (visit, options = {}) => {
  const {
    branding = null,
    obsMapView = DEFAULT_PDF_VIEWS.obs,
    overviewMapView = DEFAULT_PDF_VIEWS.overview,
    includePlans = true,
  } = options;
  const THEME = buildTheme(branding);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Charger les logos disponibles pour la couverture et les en-têtes.
  const logos = await loadLogos(branding, visit);
  const { logoMoe } = logos;

  // ── Page 1 : Couverture ──
  if (usesPapyrusCover(branding)) {
    drawSharedCoverPage(doc, {
      docType: 'RAPPORT DE VISITE DE CHANTIER',
      title: visit?.nom || 'Visite de site',
      phaseLabel: (visit?.phase || 'CHANTIER').toUpperCase(),
      clientName: visit?.client || 'Non renseigné',
      clientStreet: visit?.clientAddress || '',
      clientCityZip: [visit?.clientZip, visit?.clientCity].filter(Boolean).join(' '),
      locationRaw: visit?.lieu || 'Non renseigné',
      codeAffaire: visit?.code || visit?.projectCode || '',
      branding,
      today: visit?.date ? formatDateFr(visit.date) : new Date().toLocaleDateString('fr-FR'),
    }, THEME, logos);
  } else {
    drawCoverPage(doc, visit, THEME, logoMoe, branding);
  }

  // ── Page 2 : Vue d'ensemble (generee via Canvas + tuiles IGN) ──
  if (visit.gpsTracking?.coordinates?.length > 0) {
    const mapImage = await buildMapCanvas(visit, THEME, overviewMapView);
    if (mapImage) await drawMapPage(doc, mapImage, visit, THEME);
  }

  // ── Pages plans annotés (entre la carte et les observations) ──
  if (includePlans && (visit.plans || []).length > 0) {
    const planImages = await preloadPlanImages(visit);
    await drawAnnotatedPlanPages(doc, visit, planImages, THEME);
  }

  // ── Pages suivantes : Observations ──
  await drawObservations(doc, visit, THEME, obsMapView);

  // ── En-tetes et pieds de page (pages 2+) ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    drawHeader(doc, THEME, visit.nom, visit.date, logoMoe);
    drawFooter(doc, THEME, p, totalPages, branding);
  }

  // Telecharger
  const filename = `Visite_${(visit.nom || 'site').replace(/[^a-zA-Z0-9]/g, '_')}_${visit.date || 'nd'}.pdf`;
  stampPdfCredit(doc);
  doc.save(filename);
};
