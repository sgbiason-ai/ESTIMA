// src/utils/coverPageCanvas.js
//
// ─────────────────────────────────────────────────────────────────────────────
// Reproduit fidèlement la fonction drawCoverPage de pdfGenerator.js
// en utilisant l'API Canvas 2D du navigateur.
//
// Résultat : PNG haute résolution (A4 à 5 px/mm ≈ 150 DPI) retourné
// sous forme de data-URL, prêt à être inséré comme ImageRun dans docx-js.
//
// Aucune dépendance supplémentaire — uniquement le Canvas natif.
// ─────────────────────────────────────────────────────────────────────────────

// ─── CONSTANTES A4 ────────────────────────────────────────────────────────────
const PW = 210;   // largeur  A4 en mm (même que jsPDF par défaut)
const PH = 297;   // hauteur  A4 en mm
const S  = 5;     // pixels par mm → canvas 1050 × 1485 px

// ─── CONVERSIONS ──────────────────────────────────────────────────────────────
const px  = (mm) => mm * S;
// jsPDF setFontSize est en pt : 1 pt = 0.352778 mm
const ptpx = (pt) => pt * S * 0.352778;

import { loadImage as sharedLoadImage } from './pdf/pdfSharedHelpers';
import { buildTheme } from './pdf/buildTheme';
import { getCurrentPhaseCode } from './phaseModel';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;

// Tronque `text` avec « … » pour tenir dans maxWidthPx (unités du contexte canvas),
// à la police COURANTE de ctx. Renvoie la chaîne ajustée (ne dessine rien).
function fitCanvasText(ctx, text, maxWidthPx) {
  const s = String(text ?? '');
  if (!s || !(maxWidthPx > 0) || ctx.measureText(s).width <= maxWidthPx) return s;
  const ell = '…';
  const ellW = ctx.measureText(ell).width;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(s.slice(0, mid)).width + ellW <= maxWidthPx) lo = mid; else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + ell;
}

// Equivalent de jsPDF.splitTextToSize
// ctx doit avoir la bonne police active avant l'appel
const splitTextToSize = (ctx, text, maxWidthMm) => {
  const maxPx = px(maxWidthMm);
  const words = String(text).split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxPx && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const roundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const loadImage = sharedLoadImage;

// ─── RENDU PRINCIPAL ──────────────────────────────────────────────────────────
/**
 * Reproduit drawCoverPage (pdfGenerator.js) sur un canvas HTML.
 * @param {object} project  – objet projet (mêmes champs que ProjectDetailsModal)
 * @param {string} docLabel – libellé du type de document (ex: "C.C.T.P.")
 * @param {object} branding – objet branding
 * @returns {Promise<string>} data-URL PNG haute résolution
 */
export const buildCoverPageCanvas = async (project, docLabel, branding = null, themeOverrides = {}) => {
  const THEME = buildTheme(branding, themeOverrides);

  const canvas = document.createElement('canvas');
  canvas.width  = px(PW);
  canvas.height = px(PH);
  const ctx = canvas.getContext('2d');

  // ── Fond blanc ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Données projet ──────────────────────────────────────────────────────────
  const phaseLabel   = getCurrentPhaseCode(project).toUpperCase();
  const clientName   = project.client    || 'Non renseigné';
  const clientStreet = (project.clientAddress || '').trim();
  const clientCityZip = [project.clientZip, project.clientCity].filter(Boolean).join(' ').trim();
  const locationRaw  = project.location  || 'Non renseignée';
  const codeAffaire  = project.code      || 'Non défini';
  const subtitle1    = (project.subtitle1 || '').trim();
  const subtitle2    = (project.subtitle2 || '').trim();
  const showSignatures = project.showSignatures === true;
  const signatories  = project.signatories || ['', '', '', ''];
  const today        = new Date().toLocaleDateString('fr-FR');

  // ── Chargement logos ────────────────────────────────────────────────────────
  const moeLogoSrc = branding?.logo || null;
  const coTraitantSrcs = Array.isArray(project.coTraitantLogos) ? project.coTraitantLogos.filter(Boolean) : [];
  const [logoMoe, logoClient, ...logoCoTraitants] = await Promise.all([
    loadImage(moeLogoSrc),
    loadImage(project.clientLogo || null),
    ...coTraitantSrcs.map(loadImage),
  ]);

  // ── 1. Bande de couleur gauche ──────────────────────────────────────────────
  ctx.fillStyle = rgb(THEME.primary);
  ctx.fillRect(0, 0, px(6), canvas.height);

  // ── 2. Logos ────────────────────────────────────────────────────────────────
  // Dessine un logo dans une zone (x, y, maxW, maxH) en mm, centré verticalement.
  const drawLogoAt = (img, x, y, maxW, maxH) => {
    if (!img) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    let lw = maxW; let lh = lw / ratio;
    if (lh > maxH) { lh = maxH; lw = lh * ratio; }
    const yPos = y + (maxH - lh) / 2;
    ctx.drawImage(img, px(x), px(yPos), px(lw), px(lh));
  };
  // MOE en haut à gauche + co-traitants (groupement) empilés dessous
  let leftY = 18;
  if (logoMoe) { drawLogoAt(logoMoe, 18, leftY, 45, 25); leftY += 25 + 3; }
  logoCoTraitants.forEach((img) => { if (img) { drawLogoAt(img, 18, leftY, 45, 18); leftY += 18 + 3; } });
  // Logo client à droite
  if (logoClient) {
    const ratio = logoClient.naturalWidth / logoClient.naturalHeight;
    let lw = 45; let lh = lw / ratio;
    if (lh > 25) { lh = 25; lw = lh * ratio; }
    drawLogoAt(logoClient, PW - 18 - lw, 18, lw, 25);
  }

  // ── 3. Type de document (droite) ─ zone vide tolérée → cover générique ─────
  if (docLabel) {
    ctx.font = `bold ${ptpx(10)}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = rgb(THEME.lightText);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(docLabel.toUpperCase(), px(PW - 18), px(52));

    ctx.strokeStyle = rgb(THEME.borders);
    ctx.lineWidth   = px(0.5);
    ctx.beginPath();
    ctx.moveTo(px(PW - 95), px(57));
    ctx.lineTo(px(PW - 18), px(57));
    ctx.stroke();
  }

  // ── 4. Titre projet ─────────────────────────────────────────────────────────
  const titleFontSize = ptpx(32);
  ctx.font = `bold ${titleFontSize}px Helvetica, Arial, sans-serif`;
  const title      = (project?.name || 'NOM DU PROJET').toUpperCase();
  const splitTitle = splitTextToSize(ctx, title, PW - 40);

  ctx.fillStyle  = rgb(THEME.primary);
  ctx.textAlign  = 'left';
  splitTitle.forEach((line, i) => {
    ctx.fillText(line, px(18), px(100) + i * titleFontSize * 1.2);
  });

  const titleHeightPx = splitTitle.length * titleFontSize * 1.2;
  const titleHeightMm = titleHeightPx / S;   // reconversion pour l'arithmétique mm

  // Ligne accent
  ctx.strokeStyle = rgb(THEME.accent);
  ctx.lineWidth   = px(1.5);
  ctx.beginPath();
  ctx.moveTo(px(18), px(100 + titleHeightMm + 4));
  ctx.lineTo(px(60), px(100 + titleHeightMm + 4));
  ctx.stroke();

  // Sous-titres
  let subtitleOffsetMm = 0;
  const subtitleFontSize = ptpx(13);
  ctx.font      = `normal ${subtitleFontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.lightText);
  ctx.textAlign = 'left';
  if (subtitle1) {
    subtitleOffsetMm += 10;
    ctx.fillText(subtitle1.toUpperCase(), px(18), px(100 + titleHeightMm + 4 + subtitleOffsetMm));
  }
  if (subtitle2) {
    subtitleOffsetMm += 7;
    ctx.font = `normal ${ptpx(11)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(subtitle2.toUpperCase(), px(18), px(100 + titleHeightMm + 4 + subtitleOffsetMm));
  }

  // Bloc infos projet (décalé si sous-titres présents)
  const blockY = 125 + titleHeightMm + subtitleOffsetMm;
  ctx.fillStyle = rgb(THEME.secondary);
  roundedRect(ctx, px(18), px(blockY), px(PW - 36), px(65), px(3));
  ctx.fill();

  const col1X  = 28;
  const col2X  = PW / 2 + 10;
  const startY = blockY + 15;

  // — Col 1 : MOA & lieu ——————————————————————————————————————────————————
  ctx.font = `bold ${ptpx(8)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.lightText);
  ctx.textAlign = 'left';
  ctx.fillText("MAÎTRE D'OUVRAGE", px(col1X), px(startY));

  ctx.font = `normal ${ptpx(11)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.text);
  const splitClient = splitTextToSize(ctx, clientName.toUpperCase(), PW / 2 - 40);
  splitClient.forEach((line, i) => {
    ctx.fillText(line, px(col1X), px(startY + 6) + i * ptpx(11) * 1.3);
  });
  let currentY = startY + 6 + splitClient.length * 5;

  ctx.font = `normal ${ptpx(9)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = `rgb(100,116,139)`;
  if (clientStreet) {
    const splitStreet = splitTextToSize(ctx, clientStreet.toUpperCase(), PW / 2 - 40);
    splitStreet.forEach((line, i) => {
      ctx.fillText(line, px(col1X), px(currentY) + i * ptpx(9) * 1.3);
    });
    currentY += splitStreet.length * 5;
  }
  if (clientCityZip) {
    const splitCityZip = splitTextToSize(ctx, clientCityZip.toUpperCase(), PW / 2 - 40);
    splitCityZip.forEach((line, i) => {
      ctx.fillText(line, px(col1X), px(currentY) + i * ptpx(9) * 1.3);
    });
    currentY += splitCityZip.length * 5;
  }

  currentY += 8;
  ctx.font = `bold ${ptpx(8)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.lightText);
  ctx.fillText('LIEU DE RÉALISATION', px(col1X), px(currentY));

  ctx.font = `normal ${ptpx(11)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.text);
  const splitLoc = splitTextToSize(ctx, locationRaw.toUpperCase(), PW / 2 - 40);
  splitLoc.forEach((line, i) => {
    ctx.fillText(line, px(col1X), px(currentY + 6) + i * ptpx(11) * 1.3);
  });

  // — Col 2 : Phase & code ————————————————————————————————————————————————
  ctx.font = `bold ${ptpx(8)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.lightText);
  ctx.textAlign = 'left';
  ctx.fillText('PHASE DU PROJET', px(col2X), px(startY));

  // Badge phase (fond primary, texte blanc)
  ctx.fillStyle = rgb(THEME.primary);
  roundedRect(ctx, px(col2X), px(startY + 3), px(28), px(6), px(1.5));
  ctx.fill();

  ctx.font = `bold ${ptpx(9)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(phaseLabel, px(col2X + 14), px(startY + 7.5));

  let rightY = startY + 22;
  ctx.font = `bold ${ptpx(8)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.lightText);
  ctx.textAlign = 'left';
  ctx.fillText('RÉFÉRENCE PROJET (CODE AFFAIRE)', px(col2X), px(rightY));

  ctx.font = `normal ${ptpx(11)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = rgb(THEME.text);
  ctx.fillText(codeAffaire.toUpperCase(), px(col2X), px(rightY + 6));

  // ── 5b. Cases tampon / signature ──────────────────────────────────────────
  // Espace disponible : entre blockY+65 et le footer (~footerTopY)
  const footerTopY = branding?.companyName ? PH - 28 : PH - 20;
  const sigZoneTop    = blockY + 65 + 6;   // 6mm de marge sous le bloc infos
  const sigZoneBottom = footerTopY - 6;    // 6mm au-dessus du footer
  const sigZoneH      = sigZoneBottom - sigZoneTop;

  if (showSignatures && sigZoneH > 25) {
    const margin = 18;
    const gap    = 4;
    const n      = 4;
    const boxW   = (PW - margin * 2 - gap * (n - 1)) / n;

    for (let i = 0; i < n; i++) {
      const bx = margin + i * (boxW + gap);
      const by = sigZoneTop;
      const bh = sigZoneH;

      // Contour de la case (arrondi léger, trait fin couleur primary)
      ctx.strokeStyle = rgb(THEME.primary);
      ctx.lineWidth   = px(0.4);
      roundedRect(ctx, px(bx), px(by), px(boxW), px(bh), px(2));
      ctx.stroke();

      // Fond très léger
      ctx.fillStyle = rgb(THEME.secondary);
      roundedRect(ctx, px(bx), px(by), px(boxW), px(bh), px(2));
      ctx.fill();

      // Bandeau titre en haut (fond primary, texte blanc)
      const labelH = 8; // mm
      ctx.fillStyle = rgb(THEME.primary);
      // Arrondi seulement en haut
      ctx.beginPath();
      const r = px(2);
      ctx.moveTo(px(bx) + r, px(by));
      ctx.lineTo(px(bx + boxW) - r, px(by));
      ctx.quadraticCurveTo(px(bx + boxW), px(by), px(bx + boxW), px(by) + r);
      ctx.lineTo(px(bx + boxW), px(by + labelH));
      ctx.lineTo(px(bx), px(by + labelH));
      ctx.lineTo(px(bx), px(by) + r);
      ctx.quadraticCurveTo(px(bx), px(by), px(bx) + r, px(by));
      ctx.closePath();
      ctx.fill();

      // Nom du signataire (ou placeholder)
      const sigName = (signatories[i] || [`Le Maître d'Ouvrage`, `Le Maître d'Œuvre`, `L'Entreprise`, `Le Bureau de Contrôle`][i]).trim();
      ctx.font      = `bold ${ptpx(7)}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sigName.toUpperCase(), px(bx + boxW / 2), px(by + labelH / 2));

      // Ligne "Lu et approuvé" en bas de la case
      const luY = by + bh - 10;
      ctx.strokeStyle = rgb(THEME.borders);
      ctx.lineWidth   = px(0.3);
      ctx.beginPath();
      ctx.moveTo(px(bx + 3), px(luY));
      ctx.lineTo(px(bx + boxW - 3), px(luY));
      ctx.stroke();

      ctx.font      = `normal ${ptpx(6)}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = rgb(THEME.lightText);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Lu et approuvé — Signature', px(bx + boxW / 2), px(by + bh - 4));
    }
  }

  // ── 6. Pied de page MOE ─────────────────────────────────────────────────────
  if (branding?.companyName) {
    const footerY = PH - 20;

    ctx.strokeStyle = rgb(THEME.borders);
    ctx.lineWidth   = px(0.3);
    ctx.beginPath();
    ctx.moveTo(px(18), px(footerY - 8));
    ctx.lineTo(px(PW - 18), px(footerY - 8));
    ctx.stroke();

    ctx.font = `bold ${ptpx(7)}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = rgb(THEME.primary);
    ctx.textAlign = 'left';
    ctx.fillText(fitCanvasText(ctx, branding.companyName.toUpperCase(), px((PW - 36) / 2 - 4)), px(18), px(footerY - 3));

    if (branding.tagline) {
      ctx.font = `normal ${ptpx(6)}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = rgb(THEME.lightText);
      ctx.fillText(branding.tagline, px(18), px(footerY + 2));
    }

    const contactParts = [branding.address, branding.phone, branding.email, branding.website].filter(Boolean);
    if (contactParts.length > 0) {
      ctx.font = `normal ${ptpx(6)}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = rgb(THEME.lightText);
      ctx.textAlign = 'right';
      ctx.fillText(fitCanvasText(ctx, contactParts.join('  ·  '), px((PW - 36) / 2 - 4)), px(PW - 18), px(footerY - 3));
    }

    ctx.font = `normal ${ptpx(6)}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = rgb(THEME.lightText);
    ctx.textAlign = 'right';
    ctx.fillText(`Édité le ${today}`, px(PW - 18), px(footerY + 2));
  } else {
    ctx.font = `normal ${ptpx(8)}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = rgb(THEME.lightText);
    ctx.textAlign = 'right';
    ctx.fillText(`Édité le ${today}`, px(PW - 18), px(PH - 12));
  }

  return canvas.toDataURL('image/png');
};