// src/utils/pdf/pdfSharedHelpers.js
// Helpers partagés entre tous les générateurs PDF (jsPDF)
// Centralise : conversion couleurs, chargement images, formatage dates

import { usesPapyrusCover } from '../coverPageTemplate';

// ─── COULEURS ──────────────────────────────────────────────────────────────

/** Convertit un hex (#RRGGBB) en tableau [R, G, B]. Retourne null si invalide. */
export const hexToRgbArray = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
};

/** Eclaircit un tableau RGB par un facteur (0..1). */
export const lightenRgb = (rgb, f = 0.85) => rgb.map((c) => Math.round(c + (255 - c) * f));

/** Assombrit un tableau RGB par un facteur (0..1). */
export const darkenRgb = (rgb, f = 0.15) => rgb.map((c) => Math.round(c * (1 - f)));

// ─── IMAGES ────────────────────────────────────────────────────────────────

/** Charge une image (URL ou data:) et retourne un HTMLImageElement ou null. */
export const loadImage = (source) =>
  new Promise((resolve) => {
    if (!source) return resolve(null);
    const img = new Image();
    if (!source.startsWith('data:')) img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = source;
  });

// ─── FORMATAGE ─────────────────────────────────────────────────────────────

/** Formate une date YYYY-MM-DD en DD/MM/YYYY. */
export const formatDateFr = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

/** Formate une date YYYY-MM-DD en format long français (ex: "lundi 4 avril 2026"). */
export const formatDateLong = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return formatDateFr(dateStr); }
};

/** Nettoie un nom de fichier (retire accents, garde espaces comme _, caracteres speciaux retirés). */
export const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return 'Document';
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // é→e, è→e, à→a, etc.
    .replace(/\s+/g, '_')                               // espaces → _
    .replace(/[^a-zA-Z0-9_-]/g, '')                    // retire les caractères spéciaux
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .substring(0, 60);
};

/** Retire les retours a la ligne et trim. */
export const cleanText = (str) => typeof str === 'string' ? str.replace(/[\r\n]+/g, ' ').trim() : '';

/**
 * Formate un nombre avec locale FR (ex: 1 234,56).
 * Separateur des milliers = espace INSECABLE (U+00A0) pour empecher jsPDF/autoTable
 * de wrapper au milieu du nombre quand une cellule est etroite (bug « 23 » retour
 * ligne « 075,00 » dans les tableaux de prix). WinAnsi-safe (0xA0 CP1252).
 */
export const formatNumberFr = (value) => {
  if (value === undefined || value === null || value === '' || isNaN(Number(value))) return '-';
  const num = Number(value);
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
};

// ─── LOGOS ─────────────────────────────────────────────────────────────────

/** Détecte si une source d'image est un SVG (data URL ou extension). */
const isSvgSource = (source) => {
  if (!source || typeof source !== 'string') return false;
  return /^data:image\/svg/i.test(source) || /\.svg(\?|#|$)/i.test(source);
};

/**
 * Rasterise une image SVG (HTMLImageElement) vers un PNG raster compatible jsPDF.
 * jsPDF.addImage ne supporte pas le SVG nativement — on convertit via canvas.
 * Fond blanc forcé pour rester compatible avec le format JPEG utilisé par renderLogo.
 */
const rasterizeSvgToPng = (img) => new Promise((resolve) => {
  const targetW = 1024;
  const naturalRatio = (img.naturalWidth && img.naturalHeight)
    ? img.naturalWidth / img.naturalHeight
    : 1;
  const w = targetW;
  const h = Math.max(1, Math.round(targetW / naturalRatio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const out = new Image();
  out.onload = () => resolve(out);
  out.onerror = () => resolve(img);
  out.src = canvas.toDataURL('image/png');
});

/**
 * Charge une image en la rasterisant si c'est un SVG (compatibilité jsPDF).
 *
 * EXPORTÉ : tout logo destiné à un PDF doit passer par ici, jamais par
 * `loadImage` brut. jsPDF.addImage ne sait pas rendre un SVG — l'image se
 * charge (elle s'affiche donc parfaitement dans l'app) mais le PDF sort
 * SANS le logo, sans la moindre erreur. Piège rencontré sur les logos
 * commune / co-traitant du CRC.
 */
export const loadImageForPdf = async (source) => {
  if (!source) return null;
  const img = await loadImage(source);
  if (!img) return null;
  if (isSvgSource(source)) return rasterizeSvgToPng(img);
  return img;
};

/**
 * Charge le logo MOE + logo client + logos co-traitants (groupement) en parallèle.
 * Retourne { logoMoe, logoClient, logoCoTraitants: HTMLImageElement[] }.
 */
export const loadLogos = async (branding, project) => {
  const coSrcs = Array.isArray(project?.coTraitantLogos) ? project.coTraitantLogos.filter(Boolean) : [];
  const [logoMoe, logoClient, ...coLogos] = await Promise.all([
    loadImageForPdf(branding?.logo || '/logo.jpg').catch(() => null),
    project?.clientLogo ? loadImageForPdf(project.clientLogo).catch(() => null) : Promise.resolve(null),
    ...coSrcs.map((src) => loadImageForPdf(src).catch(() => null)),
  ]);
  return { logoMoe, logoClient, logoCoTraitants: coLogos.filter(Boolean) };
};

/**
 * Rend un logo dans le doc jsPDF en respectant les dimensions max + ratio.
 * Centré verticalement dans la zone maxH.
 * @returns {{ w: number, h: number }} dimensions effectives
 */
export const renderLogo = (doc, logo, x, y, maxW, maxH) => {
  if (!logo) return { w: 0, h: 0 };
  const ratio = logo.width / logo.height;
  let w = maxW; let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  const yPos = y + (maxH - h) / 2;
  doc.addImage(logo, 'JPEG', x, yPos, w, h);
  return { w, h };
};

// ─── ÉLÉMENTS VISUELS PARTAGÉS ────────────────────────────────────────────

/**
 * Dessine les 4 cases tampon/signature sur la page de garde.
 * @param {object} doc - instance jsPDF
 * @param {object} theme - objet THEME (primary, secondary, borders, lightText)
 * @param {object} opts - { signatories: string[], zoneTop, zoneHeight, margin? }
 */
export const drawSignatureBoxes = (doc, theme, { signatories = [], zoneTop, zoneHeight, margin = 18 }) => {
  const pageWidth = doc.internal.pageSize.width;
  if (zoneHeight < 25) return;

  const gap = 4;
  const n = 4;
  const boxW = (pageWidth - margin * 2 - gap * (n - 1)) / n;
  const labelH = 8;
  const defaults = ['Le Maître d\'Ouvrage', 'Le Maître d\'Œuvre', 'L\'Entreprise', 'Le Bureau de Contrôle'];

  for (let i = 0; i < n; i++) {
    const bx = margin + i * (boxW + gap);
    const by = zoneTop;

    // Fond + contour
    doc.setFillColor(...theme.secondary);
    doc.roundedRect(bx, by, boxW, zoneHeight, 2, 2, 'F');
    doc.setDrawColor(...theme.primary);
    doc.setLineWidth(0.4);
    doc.roundedRect(bx, by, boxW, zoneHeight, 2, 2, 'S');

    // Bandeau titre
    doc.setFillColor(...theme.primary);
    doc.roundedRect(bx, by, boxW, labelH, 2, 2, 'F');
    doc.rect(bx, by + labelH / 2, boxW, labelH / 2, 'F');

    const sigName = (signatories[i] || defaults[i]).trim();
    doc.setFontSize(7); doc.setFont('Helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(sigName.toUpperCase(), bx + boxW / 2, by + labelH / 2 + 1.5, { align: 'center' });

    // Ligne + label "Lu et approuvé"
    const luY = by + zoneHeight - 10;
    doc.setDrawColor(...theme.borders);
    doc.setLineWidth(0.3);
    doc.line(bx + 3, luY, bx + boxW - 3, luY);

    doc.setFontSize(6); doc.setFont('Helvetica', 'normal'); doc.setTextColor(...theme.lightText);
    doc.text('Lu et approuvé — Signature', bx + boxW / 2, by + zoneHeight - 4, { align: 'center' });
  }
};

// ─── TEXTE ─────────────────────────────────────────────────────────────────

/**
 * Tronque `text` avec une ellipse « … » pour qu'il tienne dans `maxWidth` (mm) à la
 * police/taille COURANTE du doc. Ne dessine rien — renvoie la chaîne ajustée.
 * À utiliser sur les chaînes DYNAMIQUES dessinées en UNE seule ligne (pieds de page,
 * en-têtes, noms d'entreprise/projet, adresses) afin d'éviter tout débordement
 * horizontal hors page, sans modifier la mise en page verticale.
 * IMPORTANT : appeler APRÈS setFont/setFontSize (la mesure dépend de la police active).
 * @param {object} doc - instance jsPDF
 * @param {string} text - chaîne à ajuster
 * @param {number} maxWidth - largeur max en mm
 * @returns {string} la chaîne, tronquée avec « … » si nécessaire
 */
export const fitTextToWidth = (doc, text, maxWidth) => {
  const s = String(text ?? '');
  if (!s || !(maxWidth > 0)) return s;
  if (doc.getTextWidth(s) <= maxWidth) return s;
  const ell = '…';
  const ellW = doc.getTextWidth(ell);
  if (ellW >= maxWidth) return ell;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const w = doc.getTextWidth(s.slice(0, mid)) + ellW;
    if (w <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + ell;
};

/**
 * Dessine le pied de page MOE (infos société) ou fallback date simple.
 * @param {object} doc - instance jsPDF
 * @param {object} branding - objet branding (companyName, tagline, address, phone, email, website)
 * @param {object} theme - objet THEME
 * @param {string} today - date formatée
 */
export const drawMoeFooter = (doc, branding, theme, today) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  if (branding?.companyName) {
    const footerY = pageHeight - 20;
    // Nom (gauche) et contact (droite) partagent la même ligne → demi-largeur chacun,
    // tronqués avec « … » pour ne pas se chevaucher ni déborder de la page.
    const halfW = (pageWidth - 36) / 2 - 4;

    doc.setDrawColor(...theme.borders);
    doc.setLineWidth(0.3);
    doc.line(18, footerY - 8, pageWidth - 18, footerY - 8);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...theme.primary);
    doc.text(fitTextToWidth(doc, branding.companyName.toUpperCase(), halfW), 18, footerY - 3);

    if (branding.tagline) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...theme.lightText);
      doc.text(fitTextToWidth(doc, branding.tagline, halfW), 18, footerY + 2);
    }

    const contactParts = [branding.address, branding.phone, branding.email, branding.website].filter(Boolean);
    if (contactParts.length > 0) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...theme.lightText);
      doc.text(fitTextToWidth(doc, contactParts.join('  ·  '), halfW), pageWidth - 18, footerY - 3, { align: 'right' });
    }

    doc.setFontSize(6);
    doc.text(`Édité le ${today}`, pageWidth - 18, footerY + 2, { align: 'right' });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...theme.lightText);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Édité le ${today}`, pageWidth - 18, pageHeight - 12, { align: 'right' });
  }
};

/**
 * Dessine la page de garde complète (bande gauche, logos, titre, infos projet,
 * signatures, pied de page MOE).
 *
 * @param {object} doc - instance jsPDF
 * @param {object} config - données de la page de garde
 * @param {string} config.docType - label document ("ESTIMATION CONFIDENTIELLE DES TRAVAUX", etc.)
 * @param {string} config.title - titre projet
 * @param {string} [config.subtitle1] - sous-titre 1
 * @param {string} [config.subtitle2] - sous-titre 2
 * @param {string} config.phaseLabel - phase (DCE, PRO, etc.)
 * @param {string} config.clientName
 * @param {string} [config.clientStreet]
 * @param {string} [config.clientCityZip]
 * @param {string} config.locationRaw
 * @param {string} config.codeAffaire
 * @param {boolean} [config.showSignatures=true]
 * @param {string[]} [config.signatories]
 * @param {object} [config.branding]
 * @param {string} config.today
 * @param {Array<{rows: Array<{label: string, value: string, col?: number}>}>} [config.extraBlocks]
 *   Blocs info supplémentaires (ex: RAO procédure/lot/dates). Chaque bloc est un roundedRect.
 * @param {object} theme - objet THEME
 * @param {{ logoMoe: HTMLImageElement|null, logoClient: HTMLImageElement|null }} logos
 * @returns {{ blockEndY: number }} position Y après le dernier bloc, pour continuer le contenu
 */
const drawPapyrusCoverPage = (doc, config, theme, logos) => {
  const pageWidth = doc.internal.pageSize.width;
  const {
    docType = '', title: rawTitle, subtitle1 = '', subtitle2 = '', phaseLabel = '',
    clientName = '', clientStreet = '', clientCityZip = '', locationRaw = '',
    codeAffaire = '', documentNumber = '', scale = '', branding, today,
    extraBlocks = [],
  } = config;
  const { logoMoe, logoClient, logoCoTraitants = [] } = logos;
  const margin = 6;

  // Identité du maître d'ouvrage, calée comme le cartouche de référence.
  if (logoClient) renderLogo(doc, logoClient, margin, 6, 30, 32);
  const moaX = logoClient ? 41 : margin + 2;
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0, 0, 0);
  doc.text(fitTextToWidth(doc, (clientName || "MAÎTRE D'OUVRAGE").toUpperCase(), pageWidth - moaX - margin), moaX, 17);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
  const moaLines = [clientStreet, clientCityZip].filter(Boolean);
  moaLines.forEach((line, index) => doc.text(fitTextToWidth(doc, line, pageWidth - moaX - margin), moaX, 24 + index * 6));

  // Titre de l'opération au centre de la page.
  const titleParts = [rawTitle || 'NOM DU PROJET', subtitle1, subtitle2].filter(Boolean).join('\n').toUpperCase();
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(titleParts, pageWidth - 70);
  const titleStartY = 105 - ((titleLines.length - 1) * 5);
  doc.text(titleLines, pageWidth / 2, titleStartY, { align: 'center' });
  if (locationRaw) {
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
    doc.text(fitTextToWidth(doc, locationRaw.toUpperCase(), pageWidth - 70), pageWidth / 2, titleStartY + titleLines.length * 9 + 3, { align: 'center' });
  }

  // Bandeau document et cartouches verticaux Phase / N° / Échelle.
  const bandX = 5;
  const bandY = 151;
  const cardsW = 32;
  const cardsX = pageWidth - 15 - cardsW; // Alignement droit à X = 195 (les cases vont de 163 à 195)
  const bandW = pageWidth - 10; // Traverse toute la page de 5 à 205 (déborde à droite des cases)
  const bandH = 60;
  doc.setFillColor(222, 222, 222);
  doc.rect(bandX, bandY, bandW, bandH, 'F');
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(18); doc.setTextColor(0, 0, 0);
  const documentLines = doc.splitTextToSize((docType || 'DOCUMENT DE MARCHÉ').toUpperCase(), cardsX - bandX - 14);
  doc.text(documentLines, (bandX + cardsX) / 2, bandY + 31 - (documentLines.length - 1) * 4, { align: 'center' });

  const drawCard = (label, value, y, height = 23) => {
    doc.setFillColor(255, 255, 255); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.8);
    doc.rect(cardsX, y, cardsW, height, 'FD');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.text(label, cardsX + 1.5, y + 4.5);
    doc.setLineWidth(0.3);
    doc.line(cardsX, y + 6.5, cardsX + cardsW, y + 6.5); // Ligne traversante complète
    if (value) {
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(15);
      doc.text(fitTextToWidth(doc, String(value).toUpperCase(), cardsW - 4), cardsX + cardsW / 2, y + 16, { align: 'center' });
    }
  };
  drawCard('Phase:', phaseLabel, bandY - 10, 23);
  drawCard('N°:', documentNumber || codeAffaire, bandY + 20, 23);
  drawCard('Échelle:', scale, bandY + 50, 23);

  // Données complémentaires propres à certains documents (RAO notamment).
  let extraY = bandY + bandH + 8;
  extraBlocks.forEach((block) => {
    (block.rows || []).forEach((row) => {
      const x = row.col === 2 ? pageWidth / 2 + 4 : 15;
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.text(row.label, x, extraY);
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(8);
      doc.text(fitTextToWidth(doc, row.value || '—', pageWidth / 2 - 25), x, extraY + 4);
    });
    extraY += 12;
  });

  // Tableau des indices et référence affaire.
  const tableX = 15;
  const tableY = 243;
  const tableW = 130;
  const rowH = 5;
  const dateW = 22;
  const indexW = 12;
  doc.setLineWidth(0.25); doc.setDrawColor(0, 0, 0);
  for (let row = 0; row <= 7; row += 1) doc.line(tableX, tableY + row * rowH, tableX + tableW, tableY + row * rowH);
  [tableX, tableX + dateW, tableX + dateW + indexW, tableX + tableW].forEach(x => doc.line(x, tableY, x, tableY + 7 * rowH));
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7);
  doc.text('Date', tableX + dateW / 2, tableY + 3.5, { align: 'center' });
  doc.text('Indice', tableX + dateW + indexW / 2, tableY + 3.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text((today || '').toUpperCase(), tableX + 1, tableY + rowH + 3.5);
  doc.text('0', tableX + dateW + indexW / 2, tableY + rowH + 3.5, { align: 'center' });
  doc.text('Première diffusion', tableX + dateW + indexW + 2, tableY + rowH + 3.5);
  doc.setFontSize(7.5);
  doc.text(`Affaire N° : ${codeAffaire || '—'}`, tableX + tableW - 2, tableY + 7 * rowH - 1.5, { align: 'right' });

  // Identité de la maîtrise d'œuvre en bas à droite.
  const moeX = cardsX; // Parfaitement aligné sur le bord gauche des cases
  if (logoMoe) renderLogo(doc, logoMoe, moeX, 230, 32, 22);
  let coY = 255;
  logoCoTraitants.slice(0, 2).forEach((logo) => {
    if (logo) { renderLogo(doc, logo, moeX, coY, 32, 10); coY += 10; }
  });
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...(theme.text || [0, 0, 0]));
  const contactLines = [
    // branding?.companyName, // Retiré pour éviter la répétition textuelle sous le logo PAPYRUS
    branding?.address,
    [branding?.zip, branding?.city].filter(Boolean).join(' '),
    branding?.phone ? `Tél : ${branding.phone}` : '',
    branding?.email ? `Mail : ${branding.email}` : '',
    branding?.website,
  ].filter(Boolean);
  contactLines.slice(0, 6).forEach((line, index) => doc.text(fitTextToWidth(doc, line, 32), moeX, 256 + index * 4.2));

  return { blockEndY: bandY + bandH };
};

export const drawCoverPage = (doc, config, theme, logos) => {
  if (usesPapyrusCover(config?.branding)) {
    return drawPapyrusCoverPage(doc, config, theme, logos);
  }
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const {
    docType, title: rawTitle, subtitle1 = '', subtitle2 = '',
    phaseLabel, clientName, clientStreet = '', clientCityZip = '',
    locationRaw, codeAffaire,
    showSignatures = false, signatories = [],
    branding, today,
    extraBlocks = [],
    negotiationPhase = 'none',
  } = config;
  const { logoMoe, logoClient, logoCoTraitants = [] } = logos;

  // Bande gauche primary
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, 6, pageHeight, 'F');

  // Logos — MOE en haut à gauche, co-traitants (groupement) empilés dessous
  let leftLogoY = 18;
  if (logoMoe) { renderLogo(doc, logoMoe, 18, leftLogoY, 45, 25); leftLogoY += 25 + 3; }
  logoCoTraitants.forEach((logo) => {
    if (!logo) return;
    renderLogo(doc, logo, 18, leftLogoY, 45, 18);
    leftLogoY += 18 + 3;
  });
  if (logoClient) {
    const maxW = 45; const maxH = 25;
    const ratio = logoClient.width / logoClient.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    renderLogo(doc, logoClient, pageWidth - 18 - w, 18, maxW, maxH);
  }

  // Type de document (zone vide tolérée → page de garde générique)
  if (docType) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...theme.lightText);
    // Aligné à droite au-dessus d'un trait de 77 mm → borner à ~90 mm avec « … ».
    doc.text(fitTextToWidth(doc, docType, 90), pageWidth - 18, 52, { align: 'right' });
    doc.setDrawColor(...theme.borders); doc.setLineWidth(0.5);
    doc.line(pageWidth - 95, 57, pageWidth - 18, 57);
  }

  // Titre projet
  doc.setFontSize(32);
  doc.setTextColor(...theme.primary);
  const title = (rawTitle || 'NOM DU PROJET').toUpperCase();
  const splitTitle = doc.splitTextToSize(title, pageWidth - 40);
  doc.text(splitTitle, 18, 100);

  const titleHeight = splitTitle.length * 12;
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(1.5);
  doc.line(18, 100 + titleHeight + 4, 60, 100 + titleHeight + 4);

  // Sous-titres
  let subtitleOffset = 0;
  // Sous-titres : offsets verticaux FIXES → garder une seule ligne (troncature « … »)
  // pour ne pas empiéter sur le bloc d'infos qui suit.
  if (subtitle1) {
    subtitleOffset += 10;
    doc.setFontSize(13); doc.setFont('Helvetica', 'normal'); doc.setTextColor(...theme.lightText);
    doc.text(fitTextToWidth(doc, subtitle1.toUpperCase(), pageWidth - 40), 18, 100 + titleHeight + 4 + subtitleOffset);
  }
  if (subtitle2) {
    subtitleOffset += 7;
    doc.setFontSize(11); doc.setFont('Helvetica', 'normal'); doc.setTextColor(...theme.lightText);
    doc.text(fitTextToWidth(doc, subtitle2.toUpperCase(), pageWidth - 40), 18, 100 + titleHeight + 4 + subtitleOffset);
  }

  // Bloc 1 : infos MOA + phase/code
  const blockY = 125 + titleHeight + subtitleOffset;
  const blockH = 65;
  doc.setFillColor(...theme.secondary);
  doc.roundedRect(18, blockY, pageWidth - 36, blockH, 3, 3, 'F');

  const col1X = 28;
  const col2X = pageWidth / 2 + 10;
  const startY = blockY + 15;

  // Col 1 : MOA
  doc.setFontSize(8); doc.setTextColor(...theme.lightText); doc.setFont('Helvetica', 'bold');
  doc.text("MAÎTRE D'OUVRAGE", col1X, startY);
  doc.setFontSize(11); doc.setTextColor(...theme.text);
  const splitClient = doc.splitTextToSize(clientName.toUpperCase(), (pageWidth / 2) - 40);
  doc.text(splitClient, col1X, startY + 6);
  let currentY = startY + 6 + (splitClient.length * 5);
  doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont('Helvetica', 'normal');
  if (clientStreet) {
    const splitStreet = doc.splitTextToSize(clientStreet.toUpperCase(), (pageWidth / 2) - 40);
    doc.text(splitStreet, col1X, currentY);
    currentY += splitStreet.length * 5;
  }
  if (clientCityZip) {
    const splitCityZip = doc.splitTextToSize(clientCityZip.toUpperCase(), (pageWidth / 2) - 40);
    doc.text(splitCityZip, col1X, currentY);
  }
  currentY += 8;
  doc.setFontSize(8); doc.setTextColor(...theme.lightText); doc.setFont('Helvetica', 'bold');
  doc.text('LIEU DE RÉALISATION', col1X, currentY);
  doc.setFontSize(11); doc.setTextColor(...theme.text);
  const splitLoc = doc.splitTextToSize(locationRaw.toUpperCase(), (pageWidth / 2) - 40);
  doc.text(splitLoc, col1X, currentY + 6);

  // Col 2 : Phase + code
  doc.setFontSize(8); doc.setTextColor(...theme.lightText); doc.setFont('Helvetica', 'bold');
  doc.text('PHASE DU PROJET', col2X, startY);
  doc.setFontSize(9); doc.setFont('Helvetica', 'bold');
  const phasePillW = Math.max(28, doc.getTextWidth(phaseLabel) + 8);
  doc.setFillColor(...theme.primary);
  doc.roundedRect(col2X, startY + 3, phasePillW, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(phaseLabel, col2X + phasePillW / 2, startY + 7.5, { align: 'center' });

  // Badge phase de négociation (sous la pastille de phase) — ambre « AVANT » / vert « APRÈS »
  if (negotiationPhase === 'before' || negotiationPhase === 'after') {
    const negoLabel = negotiationPhase === 'after' ? 'APRÈS NÉGOCIATION' : 'AVANT NÉGOCIATION';
    const negoColor = negotiationPhase === 'after' ? [22, 163, 74] : [217, 119, 6]; // emerald-600 / amber-600
    doc.setFontSize(8); doc.setFont('Helvetica', 'bold');
    const negoPillW = Math.max(28, doc.getTextWidth(negoLabel) + 7);
    doc.setFillColor(...negoColor);
    doc.roundedRect(col2X, startY + 11, negoPillW, 5.5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(negoLabel, col2X + negoPillW / 2, startY + 14.8, { align: 'center' });
  }

  const rightY = startY + 22;
  doc.setFontSize(8); doc.setTextColor(...theme.lightText); doc.setFont('Helvetica', 'bold');
  doc.text('RÉFÉRENCE PROJET (CODE AFFAIRE)', col2X, rightY);
  doc.setFontSize(11); doc.setTextColor(...theme.text);
  doc.text(codeAffaire.toUpperCase(), col2X, rightY + 6);

  // Blocs supplémentaires (RAO: procédure, lot, dates)
  let lastBlockEndY = blockY + blockH;
  for (const block of extraBlocks) {
    const bY = lastBlockEndY + 5;
    const bH = block.height || 40;
    doc.setFillColor(...theme.secondary);
    doc.roundedRect(18, bY, pageWidth - 36, bH, 3, 3, 'F');

    let rowY = bY + 12;
    for (const row of (block.rows || [])) {
      const colX = row.col === 2 ? col2X : col1X;
      doc.setFontSize(8); doc.setTextColor(...theme.lightText); doc.setFont('Helvetica', 'bold');
      doc.text(row.label, colX, rowY);
      doc.setFontSize(10); doc.setTextColor(...theme.text); doc.setFont('Helvetica', 'normal');
      const splitVal = doc.splitTextToSize(row.value || '—', (pageWidth / 2) - 40);
      doc.text(splitVal, colX, rowY + 5);
      if (row.newLine) rowY += row.newLine;
    }
    lastBlockEndY = bY + bH;
  }

  // Signatures
  const footerTopY = branding?.companyName ? pageHeight - 28 : pageHeight - 20;
  const sigZoneTop = lastBlockEndY + 6;
  const sigZoneH = footerTopY - 6 - sigZoneTop;

  if (showSignatures && sigZoneH > 25) {
    drawSignatureBoxes(doc, theme, { signatories, zoneTop: sigZoneTop, zoneHeight: sigZoneH });
  }

  // Pied de page MOE
  drawMoeFooter(doc, branding, theme, today);

  return { blockEndY: lastBlockEndY };
};
