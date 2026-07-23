// src/utils/docAdmin/annexeReserves.js
// Module partagé pour générer l'annexe des réserves (PDF + DOCX)
// Utilisé par EXE4, EXE5, EXE6

import { formatDateLocale } from '../dateHelpers';
import { fitTextToWidth } from '../pdf/pdfSharedHelpers';
import { getReserveImages, getReserveImageSrc } from './siteVisitReserves';

const formatDate = (s) => formatDateLocale(s);

/**
 * Charge une image et retourne ses dimensions
 */
const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ img, width: img.naturalWidth, height: img.naturalHeight });
  img.onerror = () => resolve(null);
  img.src = src;
});

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(blob);
});

const dataUrlToBytes = (dataUrl) => {
  const base64Data = dataUrl?.split(',')[1];
  if (!base64Data) return null;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export const loadReserveImage = async (entry, cache) => {
  const src = getReserveImageSrc(entry);
  if (!src) return null;
  if (cache.has(src)) return cache.get(src);

  let dataUrl = src.startsWith('data:') ? src : null;
  const path = typeof entry === 'object' ? entry?.path : null;

  if (!dataUrl && path) {
    try {
      const [{ getBlob, ref }, { storage }] = await Promise.all([
        import('firebase/storage'),
        import('../../firebaseStorage'),
      ]);
      dataUrl = await blobToDataUrl(await getBlob(ref(storage, path)));
    } catch { /* fallback HTTP ci-dessous */ }
  }

  if (!dataUrl) {
    try {
      let response = await fetch(src);
      if (!response.ok) {
        const separator = src.includes('?') ? '&' : '?';
        response = await fetch(`${src}${separator}swbust=${Date.now()}`);
      }
      if (response.ok) dataUrl = await blobToDataUrl(await response.blob());
    } catch { /* image indisponible */ }
  }

  if (!dataUrl) return null;
  const imageInfo = await loadImage(dataUrl);
  if (!imageInfo) return null;

  const mime = dataUrl.match(/^data:image\/([^;,]+)/i)?.[1]?.toLowerCase() || 'jpeg';
  const result = {
    dataUrl,
    bytes: dataUrlToBytes(dataUrl),
    img: imageInfo.img,
    width: imageInfo.width,
    height: imageInfo.height,
    format: mime === 'png' ? 'PNG' : 'JPEG',
    docxType: mime === 'png' ? 'png' : 'jpg',
  };
  cache.set(src, result);
  return result;
};

const buildVisitMap = async (source, reserves) => {
  if (!source?.mapVisit) return null;
  try {
    const { generateSiteVisitOverviewMap } = await import('../pdfSiteVisitGenerator');
    const observationsById = new Map(
      (source.mapVisit.observations || []).map((observation) => [observation.id, observation]),
    );
    const mappedObservations = (reserves || [])
      .filter((reserve) => reserve.sourceObservationId && observationsById.has(reserve.sourceObservationId))
      .map((reserve, index) => ({
        ...observationsById.get(reserve.sourceObservationId),
        mapNumber: reserve.numero || index + 1,
      }));
    return await generateSiteVisitOverviewMap({
      ...source.mapVisit,
      observations: mappedObservations,
    });
  } catch {
    return null;
  }
};

export const normalizeReservePdfMode = (mode) => (mode === 'compact' ? 'compact' : 'detailed');

export const countReservePhotos = (reserves) => (
  (reserves || []).reduce((total, reserve) => total + getReserveImages(reserve).length, 0)
);

export const buildReservePhotoRows = (photos) => {
  const rows = [];
  for (let index = 0; index < photos.length;) {
    const current = photos[index];
    const next = photos[index + 1];
    const currentLandscape = current?.image && current.image.width / current.image.height >= 0.85;
    const nextLandscape = next?.image && next.image.width / next.image.height >= 0.85;
    if (currentLandscape && nextLandscape) {
      rows.push([current, next]);
      index += 2;
    } else {
      rows.push([current]);
      index += 1;
    }
  }
  return rows;
};

const optimizePdfPhoto = (image) => {
  if (!image?.img || typeof document === 'undefined') return image;
  const maxPixels = 1800;
  const scale = Math.min(maxPixels / image.width, maxPixels / image.height, 1);
  if (scale >= 1) return image;
  try {
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image.img, 0, 0, width, height);
    return {
      ...image,
      dataUrl: canvas.toDataURL('image/jpeg', 0.82),
      width,
      height,
      format: 'JPEG',
    };
  } catch {
    return image;
  }
};

const loadReservePhotos = async (reserve, imageCache) => Promise.all(
  getReserveImages(reserve).map(async (entry, index) => ({
    entry,
    photoIndex: index,
    image: optimizePdfPhoto(await loadReserveImage(entry, imageCache)),
  })),
);

const buildReserveMiniMaps = async (source, reserves) => {
  if (!source?.mapVisit) return reserves.map(() => []);
  try {
    const { generateSiteVisitObservationMaps } = await import('../pdfSiteVisitGenerator');
    const sourceObservations = source.mapVisit.observations || [];
    const observationsById = new Map(sourceObservations.map((observation, index) => [observation.id, { observation, index }]));
    const results = reserves.map(() => []);

    // Trois rendus simultanés au maximum pour ne pas saturer les tuiles cartographiques.
    for (let start = 0; start < reserves.length; start += 3) {
      const batch = reserves.slice(start, start + 3);
      const rendered = await Promise.all(batch.map(async (reserve) => {
        const match = observationsById.get(reserve.sourceObservationId);
        if (!match) return [];
        const observation = { ...match.observation, mapNumber: reserve.numero };
        return await generateSiteVisitObservationMaps(observation, source.mapVisit, {
          observationIndex: match.index,
          primary: [37, 99, 235],
        }) || [];
      }));
      rendered.forEach((maps, index) => { results[start + index] = maps; });
    }
    return results;
  } catch {
    return reserves.map(() => []);
  }
};

const reserveHasGps = (source, reserve) => {
  const observation = source?.mapVisit?.observations?.find((item) => item.id === reserve.sourceObservationId);
  return Boolean(
    observation?.pointLocation?.lat != null
    || (observation?.segmentFrom && observation?.segmentTo)
    || (observation?.images || []).some((image) => typeof image === 'object' && image?.lat != null),
  );
};

const formatReservePhotoRef = (reserveNumber, photoNumber) => {
  const reserveRef = String(reserveNumber || '').trim() || '?';
  return `R${reserveRef}-P${String(photoNumber + 1).padStart(2, '0')}`;
};

// L'EXE6 conserve volontairement l'annexe historique : la refonte demandée
// concerne uniquement les exports PDF EXE4 et EXE5.
const generateLegacyAnnexeReservesPdf = async (pdf, data, exeLabel, fiche, reserves) => {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 20, mR = 20, cW = pageW - mL - mR;
  const GRAY = [217, 217, 217], BLACK = [0, 0, 0];
  const imageCache = new Map();

  pdf.addPage();
  let y = 18;
  const checkPage = (needed = 20) => {
    if (y + needed > pageH - 20) {
      pdf.addPage();
      y = 18;
    }
  };

  pdf.setFillColor(...GRAY); pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4);
  pdf.rect(mL, y, cW, 10, 'FD');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...BLACK);
  pdf.text(`ANNEXE - Liste des réserves (${exeLabel})`, mL + 3, y + 7);
  y += 14;

  const D = fiche?.sectionD || {};
  if (D.objet) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(fitTextToWidth(pdf, `Marché : ${D.objet}`, cW - 4), mL, y);
    y += 6;
  }
  if (data.dateOPR) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Date des OPR : ${formatDate(data.dateOPR)}`, mL, y);
    y += 8;
  }

  const colWidths = [12, cW - 12 - 40, 40];
  const headerLabels = ['N\u00B0', 'Désignation de la réserve', 'Date limite\nde levée'];
  const rowH = 8;
  const headerH = 10;
  checkPage(headerH + 10);

  let xPos = mL;
  headerLabels.forEach((label, index) => {
    pdf.setFillColor(...GRAY); pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.3);
    pdf.rect(xPos, y, colWidths[index], headerH, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
    const lines = pdf.splitTextToSize(label, colWidths[index] - 4);
    lines.forEach((line, lineIndex) => pdf.text(line, xPos + 2, y + 4.5 + lineIndex * 3.5));
    xPos += colWidths[index];
  });
  y += headerH;

  for (const reserve of reserves) {
    const row = [
      reserve.numero || '',
      reserve.designation || '',
      reserve.delaiLevee ? formatDate(reserve.delaiLevee) : '',
    ];
    checkPage(rowH + 4);
    xPos = mL;
    pdf.setFontSize(8);
    const maxLines = Math.max(1, ...row.map((cell, index) => pdf.splitTextToSize(cell, colWidths[index] - 4).length));
    const currentRowH = Math.max(rowH, maxLines * 4.5 + 3);

    row.forEach((cell, index) => {
      pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.2);
      pdf.rect(xPos, y, colWidths[index], currentRowH);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
      const lines = pdf.splitTextToSize(cell, colWidths[index] - 4);
      lines.forEach((line, lineIndex) => pdf.text(line, xPos + 2, y + 4 + lineIndex * 4.5));
      xPos += colWidths[index];
    });
    y += currentRowH;

    const loadedImages = (await Promise.all(
      getReserveImages(reserve).map((entry) => loadReserveImage(entry, imageCache)),
    )).filter(Boolean);
    if (loadedImages.length === 0) continue;

    checkPage(18);
    y += 3;
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(100, 100, 100);
    pdf.text(`Photos réserve n° ${reserve.numero} :`, mL + 2, y + 3);
    y += 6;

    const gap = 5;
    const cellW = (cW - gap) / 2;
    for (let imageIndex = 0; imageIndex < loadedImages.length; imageIndex += 2) {
      const rowImages = loadedImages.slice(imageIndex, imageIndex + 2).map((image) => {
        const ratio = Math.min(cellW / image.width, 55 / image.height, 1);
        return { ...image, drawW: image.width * ratio, drawH: image.height * ratio };
      });
      const imageRowHeight = Math.max(...rowImages.map((image) => image.drawH));
      checkPage(imageRowHeight + 7);
      rowImages.forEach((image, rowImageIndex) => {
        const cellX = mL + rowImageIndex * (cellW + gap);
        const imageX = cellX + (cellW - image.drawW) / 2;
        try { pdf.addImage(image.dataUrl, image.format, imageX, y, image.drawW, image.drawH); } catch { /* image ignorée */ }
      });
      y += imageRowHeight + 5;
    }
  }

  y += 4;
  if (data.observationsReserves) {
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); pdf.setTextColor(...BLACK);
    const lines = pdf.splitTextToSize(`Observations : ${data.observationsReserves}`, cW);
    lines.forEach((line) => {
      checkPage(6);
      pdf.text(line, mL, y);
      y += 5;
    });
  }
};

/**
 * Génère l'annexe des réserves en PDF (nouvelle page)
 */
export const generateAnnexeReservesPdf = async (pdf, data, exeLabel, fiche) => {
  const reserves = (data.reserves || []).filter(r => r.designation);
  if (reserves.length === 0) return;
  const enhanced = ['EXE4', 'EXE5'].includes(exeLabel);
  if (!enhanced) {
    await generateLegacyAnnexeReservesPdf(pdf, data, exeLabel, fiche, reserves);
    return;
  }

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mL = 16, mR = 16, cW = pageW - mL - mR;
  const TOP = 16, BOTTOM = 18;
  const BLACK = [15, 23, 42];
  const MUTED = [100, 116, 139];
  const BORDER = [203, 213, 225];
  const SOFT = [241, 245, 249];
  const ACCENT = [37, 99, 235];
  const RED = [220, 38, 38];
  const mode = normalizeReservePdfMode(data.reservePdfMode);
  const source = data.reserveSourceVisit || null;
  const D = fiche?.sectionD || {};
  const imageCache = new Map();
  const mapImage = await buildVisitMap(source, reserves);
  const totalPhotos = countReservePhotos(reserves);
  const annexStartPage = pdf.internal.getNumberOfPages() + 1;
  let y = TOP;

  const addPage = () => {
    pdf.addPage();
    y = TOP;
  };

  const drawPageHeader = (title, subtitle = '') => {
    pdf.setFillColor(...BLACK);
    pdf.roundedRect(mL, y, cW, 15, 2.5, 2.5, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(255, 255, 255);
    pdf.text(title, mL + 5, y + 6.2);
    if (subtitle) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(203, 213, 225);
      pdf.text(fitTextToWidth(pdf, subtitle, cW - 38), mL + 5, y + 11.5);
    }
    pdf.setFillColor(...ACCENT);
    pdf.roundedRect(pageW - mR - 27, y + 3, 22, 9, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(255, 255, 255);
    pdf.text(exeLabel, pageW - mR - 16, y + 8.8, { align: 'center' });
    y += 21;
  };

  const drawStats = (items) => {
    const gap = 3;
    const width = (cW - gap * (items.length - 1)) / items.length;
    items.forEach((item, index) => {
      const x = mL + index * (width + gap);
      pdf.setFillColor(...SOFT); pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.25);
      pdf.roundedRect(x, y, width, 16, 2, 2, 'FD');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...BLACK);
      pdf.text(String(item.value), x + width / 2, y + 7, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...MUTED);
      pdf.text(item.label.toUpperCase(), x + width / 2, y + 12.5, { align: 'center' });
    });
    y += 21;
  };

  const sourceLabel = source
    ? [source.nom, source.date ? `du ${formatDate(source.date)}` : '', source.lieu].filter(Boolean).join(' - ')
    : '';

  const drawPlanPage = async () => {
    addPage();
    drawPageHeader('ANNEXE DES RESERVES - PLAN DE REPERAGE', sourceLabel ? `Visite source : ${sourceLabel}` : 'Repérage issu de la visite de site');
    drawStats([
      { value: reserves.length, label: 'Réserves' },
      { value: totalPhotos, label: 'Photos' },
      { value: source?.date ? formatDate(source.date) : '-', label: 'Date de visite' },
    ]);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...MUTED);
    pdf.text('Les repères du plan portent les mêmes numéros que le tableau et les fiches détaillées.', mL, y);
    y += 6;

    const mapInfo = mapImage ? await loadImage(mapImage) : null;
    const availableH = pageH - BOTTOM - y;
    pdf.setFillColor(248, 250, 252); pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.35);
    pdf.roundedRect(mL, y, cW, availableH, 3, 3, 'FD');
    if (mapInfo) {
      const ratio = Math.min((cW - 2) / mapInfo.width, (availableH - 2) / mapInfo.height);
      const mapW = mapInfo.width * ratio;
      const mapH = mapInfo.height * ratio;
      const mapX = mL + (cW - mapW) / 2;
      const mapY = y + (availableH - mapH) / 2;
      pdf.addImage(mapImage, 'JPEG', mapX, mapY, mapW, mapH);
    } else {
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(10); pdf.setTextColor(...MUTED);
      pdf.text('Trace GPS non disponible pour cette visite.', pageW / 2, y + availableH / 2, { align: 'center' });
    }
  };

  const colWidths = [13, cW - 13 - 35 - 18, 35, 18];
  const headerLabels = ['N°', 'Désignation de la réserve', 'Date limite de levée', 'Photos'];
  const drawTableHeader = () => {
    let x = mL;
    headerLabels.forEach((label, index) => {
      pdf.setFillColor(...BLACK); pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.25);
      pdf.rect(x, y, colWidths[index], 10, 'FD');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255);
      const lines = pdf.splitTextToSize(label, colWidths[index] - 3);
      lines.forEach((line, lineIndex) => pdf.text(line, x + colWidths[index] / 2, y + 4.2 + lineIndex * 3.2, { align: 'center' }));
      x += colWidths[index];
    });
    y += 10;
  };

  const beginSummaryPage = (continued = false) => {
    addPage();
    drawPageHeader(
      continued ? 'ANNEXE DES RESERVES - SYNTHESE (SUITE)' : 'ANNEXE DES RESERVES - SYNTHESE',
      D.objet ? `Marché : ${D.objet}` : 'Tableau récapitulatif',
    );
    if (!continued) {
      const meta = [
        data.dateOPR ? `Date des OPR : ${formatDate(data.dateOPR)}` : '',
        sourceLabel ? `Visite source : ${sourceLabel}` : '',
        `Mode : ${mode === 'compact' ? 'compact' : 'détaillé'}`,
      ].filter(Boolean);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...MUTED);
      meta.forEach((line) => {
        const lines = pdf.splitTextToSize(line, cW);
        pdf.text(lines, mL, y);
        y += lines.length * 4 + 1;
      });
      y += 2;
    }
    drawTableHeader();
  };

  if (source) await drawPlanPage();
  beginSummaryPage(false);

  reserves.forEach((reserve, reserveIndex) => {
    const cells = [
      String(reserve.numero || ''),
      reserve.designation || '',
      reserve.delaiLevee ? formatDate(reserve.delaiLevee) : '-',
      String(getReserveImages(reserve).length),
    ];
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    const cellLines = cells.map((cell, index) => pdf.splitTextToSize(cell, colWidths[index] - 4));
    const rowHeight = Math.max(10, ...cellLines.map((lines) => lines.length * 4 + 4));
    if (y + rowHeight > pageH - BOTTOM) beginSummaryPage(true);

    let x = mL;
    cells.forEach((cell, index) => {
      if (reserveIndex % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(x, y, colWidths[index], rowHeight, 'F');
      }
      pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.2);
      pdf.rect(x, y, colWidths[index], rowHeight);
      pdf.setFont('helvetica', index === 0 ? 'bold' : 'normal'); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
      const align = index === 0 || index >= 2 ? 'center' : 'left';
      const textX = align === 'center' ? x + colWidths[index] / 2 : x + 2;
      cellLines[index].forEach((line, lineIndex) => pdf.text(line, textX, y + 5 + lineIndex * 4, { align }));
      x += colWidths[index];
    });
    y += rowHeight;
  });

  if (data.observationsReserves) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    const observationLines = pdf.splitTextToSize(data.observationsReserves, cW - 8);
    const observationHeight = observationLines.length * 4 + 14;
    if (y + observationHeight > pageH - BOTTOM) beginSummaryPage(true);
    y += 5;
    pdf.setFillColor(255, 251, 235); pdf.setDrawColor(245, 158, 11); pdf.setLineWidth(0.3);
    pdf.roundedRect(mL, y, cW, observationHeight, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(146, 64, 14);
    pdf.text('OBSERVATIONS GENERALES', mL + 4, y + 6);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
    pdf.text(observationLines, mL + 4, y + 11);
    y += observationHeight;
  }

  const drawPhotoPlaceholder = (x, top, width, height, reference) => {
    pdf.setFillColor(254, 242, 242); pdf.setDrawColor(...RED); pdf.setLineWidth(0.3);
    pdf.roundedRect(x, top, width, height, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...RED);
    pdf.text(reference, x + width / 2, top + height / 2 - 2, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
    pdf.text('Photo indisponible lors de l’export', x + width / 2, top + height / 2 + 3, { align: 'center' });
  };

  const drawPhotoCell = (photo, reserve, x, top, width, maxImageHeight, forceHeight = null) => {
    const reference = formatReservePhotoRef(reserve.numero, photo.photoIndex);
    if (!photo.image) {
      const placeholderH = forceHeight || 34;
      drawPhotoPlaceholder(x, top, width, placeholderH, reference);
      return placeholderH + 6;
    }
    const ratio = Math.min((width - 2) / photo.image.width, maxImageHeight / photo.image.height);
    const drawW = photo.image.width * ratio;
    const drawH = photo.image.height * ratio;
    const imageX = x + (width - drawW) / 2;
    const imageY = top + (forceHeight ? (forceHeight - drawH) / 2 : 0);
    pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.25);
    pdf.roundedRect(imageX - 0.5, imageY - 0.5, drawW + 1, drawH + 1, 1.5, 1.5, 'S');
    try {
      pdf.addImage(photo.image.dataUrl, photo.image.format, imageX, imageY, drawW, drawH, undefined, 'MEDIUM');
    } catch {
      drawPhotoPlaceholder(x, top, width, forceHeight || Math.max(34, drawH), reference);
      return (forceHeight || Math.max(34, drawH)) + 6;
    }
    const captionY = top + (forceHeight || drawH) + 4;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(...BLACK);
    pdf.text(reference, x + width / 2, captionY, { align: 'center' });
    const entry = photo.entry;
    if (typeof entry === 'object' && entry?.lat != null && entry?.lng != null) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(...ACCENT);
      const gpsLabel = `${Number(entry.lat).toFixed(5)}, ${Number(entry.lng).toFixed(5)}`;
      pdf.textWithLink(gpsLabel, x + width / 2, captionY + 3.5, {
        align: 'center',
        url: `https://www.google.com/maps?q=${entry.lat},${entry.lng}`,
      });
      return (forceHeight || drawH) + 10;
    }
    return (forceHeight || drawH) + 6;
  };

  const drawReserveIdentity = (reserve, reserveIndex, miniMap, continued = false) => {
    const mapSize = miniMap ? 48 : 0;
    const textX = mL + 24;
    const textWidth = cW - 24 - (mapSize ? mapSize + 6 : 0);
    pdf.setFillColor(...ACCENT);
    pdf.circle(mL + 9, y + 9, 8, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(255, 255, 255);
    pdf.text(String(reserve.numero || reserveIndex + 1), mL + 9, y + 12, { align: 'center' });

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...BLACK);
    pdf.text(continued ? `Réserve n° ${reserve.numero} - suite` : `Réserve n° ${reserve.numero}`, textX, y + 5);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    const designationLines = pdf.splitTextToSize(reserve.designation, textWidth);
    pdf.text(designationLines, textX, y + 11);
    const textBottom = y + 11 + designationLines.length * 4.2;

    if (miniMap) {
      const mapX = pageW - mR - mapSize;
      pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.3);
      pdf.roundedRect(mapX - 0.5, y - 0.5, mapSize + 1, mapSize + 1, 2, 2, 'S');
      try { pdf.addImage(miniMap, 'JPEG', mapX, y, mapSize, mapSize); } catch { /* carte locale facultative */ }
    }
    y = Math.max(textBottom + 3, miniMap ? y + mapSize + 3 : textBottom + 3);

    const stats = [
      { label: 'DATE LIMITE DE LEVEE', value: reserve.delaiLevee ? formatDate(reserve.delaiLevee) : 'Non renseignée' },
      { label: 'PHOTOS', value: String(getReserveImages(reserve).length) },
      { label: 'REPERE GPS', value: reserveHasGps(source, reserve) ? 'Disponible' : 'Non disponible' },
    ];
    const gap = 3;
    const width = (cW - gap * 2) / 3;
    stats.forEach((stat, index) => {
      const x = mL + index * (width + gap);
      pdf.setFillColor(...SOFT); pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.2);
      pdf.roundedRect(x, y, width, 13, 1.5, 1.5, 'FD');
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.8); pdf.setTextColor(...MUTED);
      pdf.text(stat.label, x + 3, y + 4.5);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
      pdf.text(fitTextToWidth(pdf, stat.value, width - 6), x + 3, y + 9.8);
    });
    y += 19;
  };

  const beginReservePage = (reserve, reserveIndex, miniMap, continued = false) => {
    addPage();
    drawPageHeader(
      continued ? `FICHE RESERVE N° ${reserve.numero} - SUITE` : `FICHE RESERVE N° ${reserve.numero}`,
      D.objet ? `Marché : ${D.objet}` : 'Détail de la réserve',
    );
    drawReserveIdentity(reserve, reserveIndex, continued ? null : miniMap, continued);
  };

  const drawDetailedPhotos = async () => {
    const miniMaps = await buildReserveMiniMaps(source, reserves);
    let openNoPhotoPage = false;

    for (let reserveIndex = 0; reserveIndex < reserves.length; reserveIndex++) {
      const reserve = reserves[reserveIndex];
      const photos = await loadReservePhotos(reserve, imageCache);
      const miniMap = miniMaps[reserveIndex]?.[0] || null;

      if (photos.length === 0) {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
        const designationLines = pdf.splitTextToSize(reserve.designation, cW - 30);
        const estimatedHeight = Math.max(miniMap ? 82 : 46, designationLines.length * 4.2 + 43);
        if (!openNoPhotoPage || y + estimatedHeight > pageH - BOTTOM) {
          addPage();
          drawPageHeader('FICHES RESERVES SANS PHOTO', D.objet ? `Marché : ${D.objet}` : 'Réserves sans illustration associée');
          openNoPhotoPage = true;
        }
        drawReserveIdentity(reserve, reserveIndex, miniMap, false);
        pdf.setFillColor(248, 250, 252); pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.25);
        pdf.roundedRect(mL, y, cW, 12, 2, 2, 'FD');
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(...MUTED);
        pdf.text('Aucune photo associée à cette réserve.', pageW / 2, y + 7.5, { align: 'center' });
        y += 20;
        continue;
      }

      openNoPhotoPage = false;
      beginReservePage(reserve, reserveIndex, miniMap, false);
      const rows = buildReservePhotoRows(photos);
      for (const row of rows) {
        const gap = 5;
        const cellWidth = row.length === 2 ? (cW - gap) / 2 : cW;
        const singlePortrait = row.length === 1 && row[0]?.image && row[0].image.width / row[0].image.height < 0.85;
        const maxImageHeight = row.length === 2 ? 75 : singlePortrait ? 128 : 105;
        const heights = row.map((photo) => {
          if (!photo.image) return 40;
          const maxWidth = singlePortrait ? Math.min(100, cellWidth) : cellWidth;
          const ratio = Math.min((maxWidth - 2) / photo.image.width, maxImageHeight / photo.image.height);
          return photo.image.height * ratio + 10;
        });
        const rowHeight = Math.max(...heights);
        if (y + rowHeight > pageH - BOTTOM) beginReservePage(reserve, reserveIndex, null, true);

        row.forEach((photo, photoIndex) => {
          const width = singlePortrait ? Math.min(100, cellWidth) : cellWidth;
          const xBase = row.length === 2 ? mL + photoIndex * (cellWidth + gap) : mL + (cW - width) / 2;
          drawPhotoCell(photo, reserve, xBase, y, width, maxImageHeight, Math.max(30, rowHeight - 10));
        });
        y += rowHeight + 5;
      }
    }
  };

  const drawCompactPhotos = async () => {
    let sheetOpen = false;
    const compactRowHeight = (row, cellWidth, maxHeight) => Math.max(...row.map((photo) => {
      if (!photo.image) return 40;
      const ratio = Math.min((cellWidth - 2) / photo.image.width, maxHeight / photo.image.height);
      return photo.image.height * ratio + 10;
    }));
    const beginSheet = (reserve = null, continued = false) => {
      addPage();
      drawPageHeader(
        continued ? 'PLANCHES PHOTOGRAPHIQUES - SUITE' : 'PLANCHES PHOTOGRAPHIQUES',
        D.objet ? `Marché : ${D.objet}` : 'Photographies des réserves',
      );
      if (reserve) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...BLACK);
        pdf.text(`Réserve n° ${reserve.numero}${continued ? ' - suite' : ''}`, mL, y);
        y += 7;
      }
      sheetOpen = true;
    };

    for (const reserve of reserves) {
      const photos = await loadReservePhotos(reserve, imageCache);
      if (photos.length === 0) continue;
      const gap = 5;
      const cellWidth = (cW - gap) / 2;
      const maxHeight = 62;
      const firstRowHeight = compactRowHeight(photos.slice(0, 2), cellWidth, maxHeight);
      if (!sheetOpen || y + 17 + firstRowHeight > pageH - BOTTOM) beginSheet();
      pdf.setFillColor(...SOFT); pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.25);
      pdf.roundedRect(mL, y, cW, 12, 2, 2, 'FD');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...BLACK);
      pdf.text(`Réserve n° ${reserve.numero}`, mL + 4, y + 5);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...MUTED);
      pdf.text(fitTextToWidth(pdf, reserve.designation, cW - 8), mL + 4, y + 9.5);
      y += 17;

      for (let index = 0; index < photos.length; index += 2) {
        const row = photos.slice(index, index + 2);
        const rowHeight = compactRowHeight(row, cellWidth, maxHeight);
        if (y + rowHeight > pageH - BOTTOM) beginSheet(reserve, true);
        row.forEach((photo, photoIndex) => {
          drawPhotoCell(photo, reserve, mL + photoIndex * (cellWidth + gap), y, cellWidth, maxHeight, Math.max(30, rowHeight - 10));
        });
        y += rowHeight + 5;
      }
      y += 4;
    }
  };

  if (mode === 'detailed') await drawDetailedPhotos();
  else await drawCompactPhotos();

  const annexEndPage = pdf.internal.getNumberOfPages();
  const annexPageCount = annexEndPage - annexStartPage + 1;
  for (let pageNumber = annexStartPage; pageNumber <= annexEndPage; pageNumber++) {
    pdf.setPage(pageNumber);
    const localPage = pageNumber - annexStartPage + 1;
    pdf.setDrawColor(...BORDER); pdf.setLineWidth(0.25);
    pdf.line(mL, pageH - 12, pageW - mR, pageH - 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...MUTED);
    const footerLabel = D.objet ? `${exeLabel} - Annexe des réserves - ${D.objet}` : `${exeLabel} - Annexe des réserves`;
    pdf.text(fitTextToWidth(pdf, footerLabel, cW - 35), mL, pageH - 7.5);
    pdf.text(`Page ${localPage} / ${annexPageCount}`, pageW - mR, pageH - 7.5, { align: 'right' });
  }
};

/**
 * Génère les children DOCX pour l'annexe des réserves (saut de page + tableau + images)
 */
export const generateAnnexeReservesDocx = async (data, exeLabel, fiche) => {
  const reserves = (data.reserves || []).filter(r => r.designation);
  if (reserves.length === 0) return [];

  const {
    Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    ShadingType, VerticalAlign, PageBreak, ImageRun,
  } = await import('docx');

  const FONT = 'Arial';
  const SN = 20, SS = 18, ST = 22;
  const BT = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
  const SG = { type: ShadingType.SOLID, color: 'D9D9D9' };

  const text = (c, o = {}) => new TextRun({ text: c, font: FONT, size: o.size || SN, bold: o.bold || false, italics: o.italics || false, ...o });
  const para = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [ch], spacing: { after: o.after ?? 120 }, alignment: o.alignment || AlignmentType.LEFT, ...o });

  const children = [];
  const D = fiche?.sectionD || {};
  const source = ['EXE4', 'EXE5'].includes(exeLabel) ? data.reserveSourceVisit || null : null;
  const imageCache = new Map();
  const mapImage = await buildVisitMap(source, reserves);

  // Saut de page
  children.push(new Paragraph({ children: [new PageBreak()] }));

  if (mapImage) {
    children.push(new Table({
      rows: [new TableRow({ children: [new TableCell({
        children: [para([text(`ANNEXE - Plan de repérage des réserves (${exeLabel})`, { bold: true, size: ST })], { after: 0 })],
        shading: SG, borders: { top: BT, bottom: BT, left: BT, right: BT },
        verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE },
      })] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    const sourceParts = [source?.nom, source?.date ? `du ${formatDate(source.date)}` : '', source?.lieu]
      .filter(Boolean);
    if (sourceParts.length) {
      children.push(para([text(`Visite source : ${sourceParts.join(' - ')}`, { size: SS })], { after: 60 }));
    }
    children.push(para([text('Les numéros du plan correspondent aux réserves détaillées dans les pages suivantes.', { size: SS, italics: true })], { after: 100 }));

    const mapInfo = await loadReserveImage(mapImage, imageCache);
    if (mapInfo?.bytes) {
      const ratio = Math.min(600 / mapInfo.width, 720 / mapInfo.height, 1);
      children.push(new Paragraph({
        children: [new ImageRun({
          data: mapInfo.bytes,
          transformation: {
            width: Math.round(mapInfo.width * ratio),
            height: Math.round(mapInfo.height * ratio),
          },
          type: mapInfo.docxType,
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      }));
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Titre annexe
  children.push(new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: [para([text(`ANNEXE - Liste des réserves (${exeLabel})`, { bold: true, size: ST })], { after: 0 })],
      shading: SG, borders: { top: BT, bottom: BT, left: BT, right: BT },
      verticalAlign: VerticalAlign.CENTER, width: { size: 100, type: WidthType.PERCENTAGE },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Sous-titre
  if (D.objet) children.push(para([text(`Marché : ${D.objet}`, { size: SS })], { after: 40 }));
  if (data.dateOPR) children.push(para([text(`Date des OPR : ${formatDate(data.dateOPR)}`, { size: SS })], { after: 80 }));
  if (source) {
    const sourceParts = [source.nom, source.date ? `du ${formatDate(source.date)}` : '', source.lieu]
      .filter(Boolean);
    children.push(para([text(`Visite source : ${sourceParts.join(' - ')}`, { size: SS })], { after: 80 }));
  }

  // Tableau (sans localisation)
  const headerCells = ['N°', 'Désignation de la réserve', 'Date limite de levée'].map(label =>
    new TableCell({
      children: [para([text(label, { bold: true, size: SS })], { after: 0, alignment: AlignmentType.CENTER })],
      shading: SG,
      borders: { top: BT, bottom: BT, left: BT, right: BT },
      verticalAlign: VerticalAlign.CENTER,
    })
  );

  const bodyRows = reserves.map(r => new TableRow({
    children: [
      r.numero || '',
      r.designation || '',
      r.delaiLevee ? formatDate(r.delaiLevee) : '',
    ].map((v, i) => new TableCell({
      children: [para([text(v, { size: SS })], { after: 0, alignment: i === 0 || i === 2 ? AlignmentType.CENTER : AlignmentType.LEFT })],
      borders: { top: BT, bottom: BT, left: BT, right: BT },
      verticalAlign: VerticalAlign.CENTER,
    })),
  }));

  children.push(new Table({
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Images des réserves
  for (const r of reserves) {
    const loadedImages = (await Promise.all(
      getReserveImages(r).map((entry) => loadReserveImage(entry, imageCache)),
    )).filter((image) => image?.bytes);
    if (loadedImages.length === 0) continue;

    children.push(para([text(`Photos réserve n° ${r.numero} :`, { size: SS, italics: true })], { after: 60 }));

    try {
      for (const image of loadedImages) {
        const ratio = Math.min(500 / image.width, 300 / image.height, 1);
        children.push(new Paragraph({
          children: [new ImageRun({
            data: image.bytes,
            transformation: {
              width: Math.round(image.width * ratio),
              height: Math.round(image.height * ratio),
            },
            type: image.docxType,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        }));
      }
    } catch {
      children.push(para([text(`[Image non disponible pour la réserve n° ${r.numero}]`, { size: SS, italics: true })], { after: 80 }));
    }
  }

  // Observations
  if (data.observationsReserves) {
    children.push(para([text(`Observations : ${data.observationsReserves}`, { size: SS, italics: true })], { after: 80 }));
  }

  return children;
};
