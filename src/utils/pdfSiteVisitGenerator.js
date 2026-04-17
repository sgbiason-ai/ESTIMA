// src/utils/pdfSiteVisitGenerator.js
// Generateur PDF moderne pour les visites de site — rapport terrain diffusable.
// Inclut : page de garde branding, vue aerienne, fiches observations.

import jsPDF from 'jspdf';
import { buildTheme } from './pdf/buildTheme';
import { loadImage, formatDateFr, formatDateLong, lightenRgb, hexToRgbArray, loadLogos } from './pdf/pdfSharedHelpers';

const PW = 210, PH = 297;
const M = { top: 18, left: 15, right: 15, bottom: 18 };
const CW = PW - M.left - M.right;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const stripHtml = (str) => (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const fmtDist = (m) => {
  if (!m || m <= 0) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
};

const countPhotos = (observations) =>
  (observations || []).reduce((acc, obs) => acc + (obs.images || []).length, 0);

// ─── DESSIN EN-TETE (pages 2+) ───────────────────────────────────────────────

const drawHeader = (doc, THEME, visitName, date, logoMoe) => {
  // Bande fine en haut
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, PW, 3, 'F');

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
  doc.text(visitName || 'Visite de Site', PW / 2, 10, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...THEME.lightText);
  doc.text(date ? formatDateLong(date) : '', PW - M.right, 10, { align: 'right' });

  // Ligne separatrice
  doc.setDrawColor(...THEME.borders);
  doc.line(M.left, 15, PW - M.right, 15);
};

// ─── DESSIN PIED DE PAGE ──────────────────────────────────────────────────────

const drawFooter = (doc, THEME, pageNum, totalPages, branding) => {
  const y = PH - 10;
  doc.setDrawColor(...THEME.borders);
  doc.line(M.left, y - 2, PW - M.right, y - 2);

  // Coordonnees entreprise
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...THEME.lightText);
  const footer = [branding?.companyName, branding?.phone, branding?.email].filter(Boolean).join(' • ');
  if (footer) doc.text(footer, M.left, y + 1);

  // Numero de page
  doc.text(`${pageNum} / ${totalPages}`, PW - M.right, y + 1, { align: 'right' });
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
  if (visit.lieu) { doc.text(visit.lieu, M.left + 8, y); y += 6; }
  if (visit.client) { doc.text(`Client : ${visit.client}`, M.left + 8, y); y += 6; }
  if (visit.date) { doc.text(formatDateLong(visit.date), M.left + 8, y); y += 6; }

  // Bloc stats
  y += 12;
  const observations = visit.observations || [];
  const tracking = visit.gpsTracking || {};
  const nbObs = observations.length;
  const nbPhotos = countPhotos(observations);
  const dist = fmtDist(tracking.distance);
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
  if (branding?.companyName) doc.text(branding.companyName, M.left + 8, footerY + 8);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...THEME.lightText);
  const contactLines = [branding?.address, [branding?.phone, branding?.email].filter(Boolean).join(' • '), branding?.website].filter(Boolean);
  contactLines.forEach((line, i) => {
    doc.text(line, M.left + 8, footerY + 14 + i * 4);
  });

  // Date export
  doc.setFontSize(7);
  doc.text(`Edité le ${new Date().toLocaleDateString('fr-FR')}`, PW - M.right, footerY + 8, { align: 'right' });
};

// ─── TUILES SATELLITE (slippy tiles comme Leaflet) ────────────────────────────

const deg2rad = (d) => d * Math.PI / 180;
const lat2tileY = (lat, z) => Math.floor((1 - Math.log(Math.tan(deg2rad(lat)) + 1 / Math.cos(deg2rad(lat))) / Math.PI) / 2 * (1 << z));
const lng2tileX = (lng, z) => Math.floor((lng + 180) / 360 * (1 << z));
const tileX2lng = (x, z) => x / (1 << z) * 360 - 180;
const tileY2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (1 << z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

// Convertit lat/lng vers pixel dans le systeme de tuiles mondial
const latLng2px = (lat, lng, z) => {
  const n = 1 << z;
  const x = ((lng + 180) / 360) * n * 256;
  const latRad = deg2rad(lat);
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
  return { x, y };
};

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

// ─── GENERATION CARTE SATELLITE (Canvas natif + tuiles) ──────────────────────

// IGN Itinéraires (libre, France) — remplace OSRM demo
const fetchIgnRoutePdf = async (from, to) => {
  try {
    const url = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}&profile=car&optimization=fastest&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const geom = data?.geometry;
    if (!geom?.coordinates?.length) return null;
    return geom.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
  } catch { return null; }
};

const buildMapCanvas = async (visit, THEME) => {
  const tracking = visit.gpsTracking || {};
  const coordinates = tracking.coordinates || [];
  const observations = visit.observations || [];

  // Collecter les segments mesurés
  const segments = observations.filter(obs => obs.segmentFrom && obs.segmentTo);

  if (coordinates.length === 0 && segments.length === 0) return null;

  // Collecter tous les points (GPS + observations + segments)
  const allPoints = coordinates.filter(c => !c.break).map(c => ({ lat: c.lat, lng: c.lng }));
  segments.forEach(seg => {
    allPoints.push({ lat: seg.segmentFrom.lat, lng: seg.segmentFrom.lng });
    allPoints.push({ lat: seg.segmentTo.lat, lng: seg.segmentTo.lng });
  });
  const obsPositions = [];
  observations.forEach((obs, idx) => {
    let lat = null, lng = null;
    if (obs.segmentFrom && obs.segmentTo) {
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
      obsPositions.push({ lat, lng, number: idx + 1 });
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

  // Charger et assembler les tuiles satellite IGN Géoplateforme (ORTHOPHOTOS)
  const tilePromises = [];
  for (let ty = tileYmin; ty <= tileYmax; ty++) {
    for (let tx = tileXmin; tx <= tileXmax; tx++) {
      const url = `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${zoom}&TILEROW=${ty}&TILECOL=${tx}&FORMAT=image/jpeg`;
      const dx = (tx - tileXmin) * 256;
      const dy = (ty - tileYmin) * 256;
      tilePromises.push(fetchTileAsImg(url).then(img => { if (img) ctx.drawImage(img, dx, dy, 256, 256); }));
    }
  }
  await Promise.all(tilePromises);

  // Offset pour convertir les coordonnees monde en coordonnees canvas
  const worldOriginX = tileXmin * 256;
  const worldOriginY = tileYmin * 256;
  const toX = (lng) => latLng2px(0, lng, zoom).x - worldOriginX;
  const toY = (lat) => latLng2px(lat, 0, zoom).y - worldOriginY;

  // Dessiner le trace GPS (segments séparés par les breaks)
  const drawGpsSegments = (points, style, width) => {
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

// ─── PAGE VUE AERIENNE ────────────────────────────────────────────────────────

const drawMapPage = async (doc, mapImage, visit, THEME) => {
  doc.addPage();
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
      const dist = fmtDist(tracking.distance);
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
    } catch (e) {
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

// ─── MINI-CARTE PAR OBSERVATION ──────────────────────────────────────────────

const buildObsMiniMap = async (obs, visit, THEME, obsIdx) => {
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

  // Trouver le zoom optimal — on cherche un carré en PIXELS, pas en degrés
  let zoom = 18;
  for (let z = 18; z >= 1; z--) {
    const pxMinX = latLng2px(0, minLng, z).x;
    const pxMaxX = latLng2px(0, maxLng, z).x;
    const pxMinY = latLng2px(maxLat, 0, z).y;
    const pxMaxY = latLng2px(minLat, 0, z).y;
    const spanPx = Math.max(pxMaxX - pxMinX, pxMaxY - pxMinY, 128);
    // Nombre de tuiles nécessaires pour couvrir le carré pixel
    const tilesNeeded = Math.ceil(spanPx / 256) + 2; // +2 pour marges
    if (tilesNeeded * tilesNeeded <= 16) { zoom = z; break; }
  }

  // Calculer le carré en pixels au zoom choisi
  const pxMinX = latLng2px(0, minLng, zoom).x;
  const pxMaxX = latLng2px(0, maxLng, zoom).x;
  const pxMinY = latLng2px(maxLat, 0, zoom).y;
  const pxMaxY = latLng2px(minLat, 0, zoom).y;
  const cropSpan = Math.max(pxMaxX - pxMinX, pxMaxY - pxMinY, 128);
  const centerPxX = (pxMinX + pxMaxX) / 2;
  const centerPxY = (pxMinY + pxMaxY) / 2;
  const half = cropSpan / 2;

  // Tuiles nécessaires pour couvrir le carré pixel (avec marge)
  const sqLeft = centerPxX - half;
  const sqTop = centerPxY - half;
  const sqRight = centerPxX + half;
  const sqBottom = centerPxY + half;

  const tileXmin = Math.floor(sqLeft / 256);
  const tileXmax = Math.floor(sqRight / 256);
  const tileYmin = Math.floor(sqTop / 256);
  const tileYmax = Math.floor(sqBottom / 256);
  const tilesW = (tileXmax - tileXmin + 1) * 256;
  const tilesH = (tileYmax - tileYmin + 1) * 256;

  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = tilesW;
  canvas.height = tilesH;
  const ctx = canvas.getContext('2d');

  // Fond gris clair (fallback si tuiles non chargees)
  ctx.fillStyle = '#e8edf2';
  ctx.fillRect(0, 0, tilesW, tilesH);

  // Charger tuiles IGN PlanIGNv2 (Géoplateforme — libre, CORS OK)
  const tilePromises = [];
  for (let ty = tileYmin; ty <= tileYmax; ty++) {
    for (let tx = tileXmin; tx <= tileXmax; tx++) {
      const url = `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${zoom}&TILEROW=${ty}&TILECOL=${tx}&FORMAT=image/png`;
      const dx = (tx - tileXmin) * 256;
      const dy = (ty - tileYmin) * 256;
      tilePromises.push(fetchTileAsImg(url).then(img => { if (img) ctx.drawImage(img, dx, dy, 256, 256); }));
    }
  }
  await Promise.all(tilePromises);

  // Origine du canvas tuiles en coordonnées monde
  const worldOriginX = tileXmin * 256;
  const worldOriginY = tileYmin * 256;
  const toX = (lng) => latLng2px(0, lng, zoom).x - worldOriginX;
  const toY = (lat) => latLng2px(lat, 0, zoom).y - worldOriginY;

  // Crop carré — coordonnées dans le canvas tuiles
  const cx = centerPxX - worldOriginX;
  const cy = centerPxY - worldOriginY;

  const crop = document.createElement('canvas');
  crop.width = SIZE;
  crop.height = SIZE;
  const cctx = crop.getContext('2d');
  // Fond gris clair pour les zones hors tuiles
  cctx.fillStyle = '#e8edf2';
  cctx.fillRect(0, 0, SIZE, SIZE);
  cctx.drawImage(canvas, cx - half, cy - half, cropSpan, cropSpan, 0, 0, SIZE, SIZE);

  // Fonctions de coordonnées dans le crop
  const scale = SIZE / cropSpan;
  const cToX = (lng) => (toX(lng) - (cx - half)) * scale;
  const cToY = (lat) => (toY(lat) - (cy - half)) * scale;

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
    // Route stockée ou fallback IGN
    const route = Array.isArray(obs.segmentRoute) && obs.segmentRoute.length >= 2
      ? obs.segmentRoute
      : await fetchIgnRoutePdf(obs.segmentFrom, obs.segmentTo);
    const pts = route || [obs.segmentFrom, obs.segmentTo];

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
    cctx.fillText(String(obsIdx + 1), ox, oy);
  }

  // Bordure arrondie
  cctx.strokeStyle = 'rgba(255,255,255,0.6)';
  cctx.lineWidth = 4;
  cctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);

  return crop.toDataURL('image/jpeg', 0.85);
};

// ─── PAGES OBSERVATIONS ───────────────────────────────────────────────────────

const drawObservations = async (doc, visit, THEME) => {
  const observations = visit.observations || [];
  if (!observations.length) return;

  doc.addPage();
  let y = 20;
  let pageStarted = true;

  // Titre section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...THEME.primary);
  doc.text('Observations', M.left, y);
  y += 10;

  // Pré-générer toutes les mini-cartes en parallèle
  const miniMaps = await Promise.all(
    observations.map((obs, i) => buildObsMiniMap(obs, visit, THEME, i).catch(() => null))
  );

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    const obsNum = i + 1;
    const text = stripHtml(obs.text);
    const images = obs.images || [];
    const miniMap = miniMaps[i];

    // Dimensions mini-carte
    const MAP_W = 55; // largeur mini-carte en mm
    const MAP_H = 55;
    const hasMap = !!miniMap;
    const textColW = hasMap ? CW - MAP_W - 5 - 13 : CW - 13; // largeur texte réduite si carte

    // Estimer la hauteur nécessaire
    const textLines = text ? doc.splitTextToSize(text, textColW) : [];
    const textH = textLines.length * 4;
    const hasImages = images.length > 0;
    const hasSegment = obs.segmentFrom && obs.segmentTo;
    const leftH = 16 + (hasSegment ? 15 : 0) + textH + 6;
    const estimatedH = Math.max(leftH, hasMap ? MAP_H + 10 : 0) + (hasImages ? 85 : 0) + 10;

    // Saut de page si pas assez de place
    if (y + estimatedH > PH - M.bottom && !pageStarted) {
      doc.addPage();
      y = 20;
      pageStarted = true;
    }

    pageStarted = false;
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

    // ── Mini-carte à droite ──
    if (hasMap) {
      const mapX = PW - M.right - MAP_W;
      const mapY = obsStartY;
      doc.setDrawColor(...THEME.borders);
      doc.setLineWidth(0.3);
      doc.roundedRect(mapX - 0.5, mapY - 0.5, MAP_W + 1, MAP_H + 1, 2, 2, 'S');
      doc.addImage(miniMap, 'JPEG', mapX, mapY, MAP_W, MAP_H);
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

    // ── Images (grandes, cote a cote si 2+) ──
    if (hasImages) {
      const maxImgW = images.length === 1 ? CW - 13 : (CW - 13 - 4) / 2;
      const maxImgH = 75;
      let imgX = M.left + 13;

      for (let j = 0; j < images.length; j++) {
        const imgData = images[j];
        const imgSrc = typeof imgData === 'string' ? imgData : imgData.src;

        try {
          const loaded = await loadImage(imgSrc);
          if (!loaded) continue;

          const aspect = loaded.width / loaded.height;
          let imgW = Math.min(maxImgW, loaded.width * 0.264);
          let imgH = imgW / aspect;
          if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * aspect; }
          if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / aspect; }

          if (y + imgH + 5 > PH - M.bottom) {
            doc.addPage();
            y = 20;
            imgX = M.left + 13;
          }

          doc.setDrawColor(...THEME.borders);
          doc.setLineWidth(0.2);
          doc.roundedRect(imgX - 0.5, y - 0.5, imgW + 1, imgH + 1, 1, 1, 'S');
          doc.addImage(imgSrc, 'JPEG', imgX, y, imgW, imgH);

          if (typeof imgData === 'object' && imgData.lat != null && imgData.lng != null) {
            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(6);
            doc.setTextColor(59, 130, 246);
            const url = `https://www.google.com/maps?q=${imgData.lat},${imgData.lng}`;
            doc.textWithLink('GPS', imgX, y + imgH + 3, { url });
          }

          if (images.length <= 2 && j === 0 && images.length > 1) {
            imgX += imgW + 4;
          } else {
            y += imgH + 6;
            imgX = M.left + 13;
          }
        } catch { /* image non chargee */ }
      }

      if (images.length === 2) {
        y += maxImgH + 6;
      }
    }

    // ── Separateur ──
    if (i < observations.length - 1) {
      doc.setDrawColor(...lightenRgb(THEME.primary, 0.85));
      doc.setLineWidth(0.3);
      doc.line(M.left + 13, y, PW - M.right, y);
      doc.setLineWidth(0.2);
      y += 8;
    }
  }
};

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────

export const generateSiteVisitPdf = async (visit, options = {}) => {
  const { branding = null } = options;
  const THEME = buildTheme(branding);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Charger logo
  const { logoMoe } = await loadLogos(branding, {});

  // ── Page 1 : Couverture ──
  drawCoverPage(doc, visit, THEME, logoMoe, branding);

  // ── Page 2 : Vue aerienne (generee via Canvas + tuiles ArcGIS) ──
  if (visit.gpsTracking?.coordinates?.length > 0) {
    const mapImage = await buildMapCanvas(visit, THEME);
    if (mapImage) await drawMapPage(doc, mapImage, visit, THEME);
  }

  // ── Pages 3+ : Observations ──
  await drawObservations(doc, visit, THEME);

  // ── En-tetes et pieds de page (pages 2+) ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    drawHeader(doc, THEME, visit.nom, visit.date, logoMoe);
    drawFooter(doc, THEME, p, totalPages, branding);
  }

  // Telecharger
  const filename = `Visite_${(visit.nom || 'site').replace(/[^a-zA-Z0-9]/g, '_')}_${visit.date || 'nd'}.pdf`;
  doc.save(filename);
};
