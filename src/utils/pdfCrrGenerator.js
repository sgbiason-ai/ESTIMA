// src/utils/pdfCrrGenerator.js
//
// Export PDF d'un Compte Rendu de Réunion — version moderne & pro.
// Mise en page soignée avec bandes décoratives, couleurs de statut,
// bandeaux de catégorie et pied de page 3 colonnes.
//
// NOTE : jsPDF + Helvetica supporte les accents latins (WinAnsiEncoding).
// Seuls les glyphes hors Latin-1 (emoji, CJK, etc.) ne sont pas supportés.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_BRANDING } from '../data/branding';
import { MEETING_TYPES, GROUP_COLORS, abbreviateGroup } from '../data/crrData';

// ─── HELPERS ────────────────────────────────────────────────────────────────

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const c = hex.replace('#', '');
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
};

const lighten = (rgb, f = 0.85) => rgb.map((c) => Math.round(c + (255 - c) * f));
const darken  = (rgb, f = 0.15) => rgb.map((c) => Math.round(c * (1 - f)));

const buildTheme = (branding) => {
  const p  = hexToRgb(branding?.colors?.primary)   || [40, 110, 85];
  const a  = hexToRgb(branding?.colors?.secondary)  || [50, 180, 130];
  const t  = hexToRgb(branding?.colors?.text)        || [40, 40, 40];
  const lt = hexToRgb(branding?.colors?.subtle)      || [100, 116, 139];
  return {
    primary: p, accent: a, text: t, lightText: lt,
    headerBg:   lighten(p, 0.92),
    categoryBg: lighten(p, 0.82),
    tableBg:    lighten(p, 0.88),
    borders:    [210, 218, 226],
    lightBg:    lighten(p, 0.96),
    presentBg:  [232, 250, 240],
    presentTxt: [22, 130, 76],
    excusedBg:  [255, 247, 230],
    excusedTxt: [180, 120, 20],
    absentTxt:  [180, 180, 190],
    doneBg:     [232, 250, 240],
    doneTxt:    [22, 120, 70],
    progressBg: [230, 242, 255],
    progressTxt:[30, 90, 170],
    openBg:     [255, 247, 230],
    openTxt:    [190, 110, 20],
  };
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const formatDateLong = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return formatDate(dateStr); }
};

const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return 'Document';
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .substring(0, 40);
};

const loadImage = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// Couleurs tournantes pour les categories
const CAT_COLORS = [
  [40, 110, 85],   // emerald (primary)
  [37, 99, 175],   // blue
  [124, 58, 170],  // purple
  [210, 120, 20],  // orange
  [190, 50, 50],   // red
  [170, 140, 20],  // amber
];

// ─── CONSTANTES ─────────────────────────────────────────────────────────────

const M = { top: 20, bottom: 18, left: 14, right: 12 };
const PH = 297;
const PW = 210;
const CW = PW - M.left - M.right;
const STRIPE_W = 1.5;

// ─── PAGES ──────────────────────────────────────────────────────────────────

const ensureSpace = (doc, cursor, need) => {
  if (cursor.y + need > PH - M.bottom) {
    doc.addPage();
    cursor.y = M.top;
  }
};

// Dessine la bande decorative a gauche sur toutes les pages
const drawPageDecor = (doc, theme) => {
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFillColor(...theme.primary);
    doc.rect(0, 0, STRIPE_W, PH * 0.6, 'F');
    doc.setFillColor(...theme.accent);
    doc.rect(0, PH * 0.6, STRIPE_W, PH * 0.4, 'F');
  }
};

// ─── ROUNDED RECT ───────────────────────────────────────────────────────────

const roundedRect = (doc, x, y, w, h, r, style) => {
  r = Math.min(r, h / 2, w / 2);
  doc.roundedRect(x, y, w, h, r, r, style);
};

// Dessine un petit cercle rempli (pastille) au centre de la cellule
const drawDot = (doc, cell, color, radius = 1.2) => {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  doc.setFillColor(...color);
  doc.circle(cx, cy, radius, 'F');
};

// Dessine un badge arrondi avec texte au centre de la cellule
const drawBadge = (doc, cell, text, bgColor, txtColor, font) => {
  const textW = doc.getTextWidth(text);
  const badgeW = textW + 4;
  const badgeH = 4;
  const bx = cell.x + (cell.width - badgeW) / 2;
  const by = cell.y + (cell.height - badgeH) / 2;
  doc.setFillColor(...bgColor);
  roundedRect(doc, bx, by, badgeW, badgeH, 1.2, 'F');
  doc.setFont(font, 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...txtColor);
  doc.text(text, cell.x + cell.width / 2, by + 3, { align: 'center' });
};

// Badge lettre arrondi (P, E, A, D, C) centre dans la cellule
const drawBadgeLabel = (doc, cell, letter, txtColor, bgColor, font) => {
  const bw = 5;
  const bh = 3.5;
  const bx = cell.x + (cell.width - bw) / 2;
  const by = cell.y + (cell.height - bh) / 2;
  doc.setFillColor(...bgColor);
  roundedRect(doc, bx, by, bw, bh, 1, 'F');
  doc.setFont(font, 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...txtColor);
  doc.text(letter, bx + bw / 2, by + 2.6, { align: 'center' });
};

// Constantes pastilles PDF
const BADGE_H = 3.2;
const BADGE_GAP = 0.8;
const BADGE_PAD = 1.5; // padding vertical dans la cellule

// Calcule la hauteur necessaire pour N pastilles
const badgesHeight = (n) => n > 0 ? n * BADGE_H + (n - 1) * BADGE_GAP + BADGE_PAD * 2 : 0;

// Parse un champ "MOA, Entreprises" en tableau de noms
const parseBadgeNames = (value) =>
  (value || '').split(',').map((s) => s.trim()).filter(Boolean);

// Dessine des pastilles de groupes (emetteur/actionBy) dans une cellule PDF
const drawGroupBadges = (doc, cell, value, groupIndexMap, font) => {
  const names = parseBadgeNames(value);
  if (names.length === 0) return;

  const totalH = names.length * BADGE_H + (names.length - 1) * BADGE_GAP;
  let startY = cell.y + Math.max(BADGE_PAD, (cell.height - totalH) / 2);

  names.forEach((name) => {
    // Ne pas dessiner en dehors de la cellule
    if (startY + BADGE_H > cell.y + cell.height) return;

    const idx = groupIndexMap[name] ?? 0;
    const c = GROUP_COLORS[idx % GROUP_COLORS.length];
    const abbr = abbreviateGroup(name);

    doc.setFont(font, 'bold');
    doc.setFontSize(5);
    const textW = doc.getTextWidth(abbr);
    const badgeW = Math.min(textW + 5, cell.width - 1);
    const bx = cell.x + (cell.width - badgeW) / 2;

    // Fond du badge
    doc.setFillColor(...c.rgbBg);
    roundedRect(doc, bx, startY, badgeW, BADGE_H, 1, 'F');

    // Point de couleur
    doc.setFillColor(...c.rgb);
    doc.circle(bx + 1.8, startY + BADGE_H / 2, 0.7, 'F');

    // Texte
    doc.setTextColor(...c.rgb);
    doc.text(abbr, bx + 3.2, startY + 2.4);

    startY += BADGE_H + BADGE_GAP;
  });
};

// ─── EXPORT PRINCIPAL ───────────────────────────────────────────────────────

export const generatePdfCrr = async (meeting, crrConfig, projectName = '', branding = DEFAULT_BRANDING, options) => {
  if (!meeting) return;

  const THEME = buildTheme(branding);
  const fontH = branding?.fonts?.headings || 'Helvetica';
  const fontB = branding?.fonts?.main || 'Helvetica';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cursor = { y: M.top };

  // Map nom de groupe → index pour couleurs pastilles
  const groupIndexMap = {};
  (crrConfig.participantGroups || []).forEach((g, i) => { groupIndexMap[g.name] = i; });

  const typeLabel = MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  const pdfProjectName = (projectName || 'PROJET').toUpperCase();

  // Logo
  const logoMoe = await loadImage(branding?.logo || '/logo.jpg').catch(() => null);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. EN-TETE
  // ═══════════════════════════════════════════════════════════════════════════

  // Bande d'accent en haut de page
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, PW, 3, 'F');

  // Fond header
  doc.setFillColor(...THEME.headerBg);
  roundedRect(doc, M.left, cursor.y, CW, 28, 2, 'F');

  // Filet colore a gauche du header
  doc.setFillColor(...THEME.primary);
  roundedRect(doc, M.left, cursor.y, 1.5, 28, 0.75, 'F');

  // Logo en haut a droite
  if (logoMoe) {
    const mxW = 30, mxH = 14, r = logoMoe.width / logoMoe.height;
    let w = mxW, h = w / r;
    if (h > mxH) { h = mxH; w = h * r; }
    doc.addImage(logoMoe, 'JPEG', PW - M.right - w - 4, cursor.y + 2, w, h);
  }

  // Type de reunion + numero
  doc.setFont(fontH, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...THEME.lightText);
  doc.text(typeLabel.toUpperCase(), M.left + 6, cursor.y + 7);

  doc.setFontSize(22);
  doc.setTextColor(...THEME.primary);
  doc.text(`N° ${meeting.number}`, M.left + 6, cursor.y + 16);

  // Date
  doc.setFont(fontB, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text(`Date : ${formatDate(meeting.date)}`, M.left + 6, cursor.y + 22);

  cursor.y += 31;

  // Nom du projet
  doc.setFont(fontH, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...THEME.primary);
  doc.text(pdfProjectName, PW / 2, cursor.y + 5, { align: 'center' });

  // Ligne decorative sous le titre
  const titleW = Math.min(doc.getTextWidth(pdfProjectName), CW - 20);
  const lineX = (PW - titleW) / 2;
  doc.setDrawColor(...THEME.accent);
  doc.setLineWidth(0.5);
  doc.line(lineX, cursor.y + 8, lineX + titleW, cursor.y + 8);

  cursor.y += 14;

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PROCHAINE REUNION
  // ═══════════════════════════════════════════════════════════════════════════

  if (meeting.nextMeeting?.date || meeting.nextMeeting?.lieu) {
    doc.setFillColor(255, 245, 230);
    roundedRect(doc, M.left, cursor.y, CW, 10, 1.5, 'F');

    // Pastille coloree a gauche
    doc.setFillColor(230, 130, 20);
    roundedRect(doc, M.left, cursor.y, 1.5, 10, 0.75, 'F');

    doc.setFont(fontH, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 90, 10);
    doc.text('PROCHAINE RÉUNION', M.left + 5, cursor.y + 4.5);

    const parts = [];
    if (meeting.nextMeeting.lieu) parts.push(meeting.nextMeeting.lieu);
    if (meeting.nextMeeting.heure) parts.push(`a ${meeting.nextMeeting.heure}`);
    if (meeting.nextMeeting.date) parts.push(`le ${formatDateLong(meeting.nextMeeting.date)}`);

    doc.setFont(fontB, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 80, 10);
    doc.text(parts.join('  --  '), M.left + 5, cursor.y + 8.5);

    cursor.y += 13;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PARTICIPANTS
  // ═══════════════════════════════════════════════════════════════════════════

  cursor.y += 2;

  // Bandeau titre section
  doc.setFillColor(...THEME.primary);
  roundedRect(doc, M.left, cursor.y, CW, 8, 1.5, 'F');
  doc.setFont(fontH, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('PARTICIPANTS', M.left + 5, cursor.y + 5.5);

  // Legende a droite du bandeau
  const legendY = cursor.y + 2;
  const legendItems = [
    { label: 'Present', bg: THEME.presentBg, txt: THEME.presentTxt },
    { label: 'Excuse',  bg: THEME.excusedBg, txt: THEME.excusedTxt },
  ];
  let lx = PW - M.right - 5;
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const item = legendItems[i];
    doc.setFont(fontB, 'bold');
    doc.setFontSize(5.5);
    const tw = doc.getTextWidth(item.label) + 3;
    lx -= tw + 2;
    doc.setFillColor(...item.bg);
    roundedRect(doc, lx, legendY, tw + 2, 4, 1, 'F');
    doc.setTextColor(...item.txt);
    doc.text(item.label, lx + 1.5, legendY + 3);
  }

  cursor.y += 10;

  // Construire les donnees du tableau participants
  const participantRows = [];
  const groups = crrConfig.participantGroups || [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (group.contacts.length === 0) {
      participantRows.push({
        role: `${group.name}${group.subLabel ? ` : ${group.subLabel}` : ''}`,
        subLabel: '', contact: '', email: '', cpr: false, att: 'absent', diff: false,
        isGroupHeader: true, groupName: group.name, groupIdx: gi,
      });
    } else {
      group.contacts.forEach((contact, ci) => {
        const att = meeting.attendance?.[contact.id] || 'absent';
        const diff = meeting.diffusion?.[contact.id] || false;
        participantRows.push({
          role: ci === 0
            ? `${group.name}${group.subLabel ? ` : ${group.subLabel}` : ''}`
            : '',
          subLabel: contact.subLabel || '',
          contact: contact.name || '',
          email: (contact.email || '') + (contact.phone ? '\n' + contact.phone : ''),
          cpr: !!contact.cpr,
          att,
          diff,
          isGroupHeader: false,
          groupName: ci === 0 ? group.name : '',
          groupIdx: gi,
        });
      });
    }
  }

  // Corps du tableau : col 0 (pastille) et col 1 (role) avec rowSpan par groupe
  const partBody = [];
  for (let i = 0; i < participantRows.length; i++) {
    const r = participantRows[i];
    if (r.isGroupHeader) {
      partBody.push([
        '', r.role, r.subLabel, r.contact, r.email, '', '', '',
      ]);
    } else {
      const isFirstOfGroup = (i === 0 || participantRows[i - 1].groupIdx !== r.groupIdx || participantRows[i - 1].isGroupHeader);
      if (isFirstOfGroup) {
        let span = 1;
        for (let j = i + 1; j < participantRows.length && !participantRows[j].isGroupHeader && participantRows[j].groupIdx === r.groupIdx; j++) span++;
        const badgeCell = { content: '', rowSpan: span, styles: { valign: 'middle' } };
        const roleCell = { content: r.role, rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 6.5 } };
        partBody.push([
          badgeCell, roleCell, r.subLabel, r.contact, r.email, '', '', '',
        ]);
      } else {
        // Lignes absorbees : pas de col 0 ni col 1 (couvertes par rowSpan)
        partBody.push([
          r.subLabel, r.contact, r.email, '', '', '',
        ]);
      }
    }
  }

  autoTable(doc, {
    startY: cursor.y,
    margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
    tableWidth: CW,
    head: [['', 'ROLE / INTERVENANT', 'LABEL', 'CONTACT', 'EMAIL', 'CPR', 'PRES.', 'DIFF.']],
    body: partBody,
    theme: 'grid',
    styles: {
      font: fontB,
      fontSize: 7,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 1.5 },
      overflow: 'linebreak',
      textColor: THEME.text,
      lineColor: THEME.borders,
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: lighten(THEME.primary, 0.78),
      textColor: darken(THEME.primary, 0.1),
      fontStyle: 'bold',
      font: fontH,
      halign: 'center',
      fontSize: 6.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 },
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 30, fontStyle: 'bold', fontSize: 6.5 },
      2: { cellWidth: 22, fontSize: 6.5, textColor: [100, 116, 139] },
      3: { cellWidth: 28 },
      4: { cellWidth: 44, textColor: [30, 80, 160], fontSize: 6.5 },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 15, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = participantRows[data.row.index];
        if (!row) return;
        if (row.isGroupHeader) {
          data.cell.styles.fillColor = THEME.lightBg;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = THEME.primary;
          return;
        }
        // Alternance par groupe (pair = blanc, impair = gris clair)
        data.cell.styles.fillColor = row.groupIdx % 2 === 0 ? [255, 255, 255] : [250, 252, 254];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const row = participantRows[data.row.index];
      if (!row) return;

      // Col 0 : pastille coloree du groupe
      if (data.column.index === 0 && row.groupName) {
        const gIdx = row.groupIdx;
        const c = GROUP_COLORS[gIdx % GROUP_COLORS.length];
        const abbr = abbreviateGroup(row.groupName);

        doc.setFont(fontH, 'bold');
        doc.setFontSize(4.5);
        const tw = doc.getTextWidth(abbr);
        const bw = Math.min(tw + 4, data.cell.width - 1);
        const bh = 3;
        const bx = data.cell.x + (data.cell.width - bw) / 2;
        const by = data.cell.y + (data.cell.height - bh) / 2;

        doc.setFillColor(...c.rgbBg);
        roundedRect(doc, bx, by, bw, bh, 1, 'F');
        doc.setFillColor(...c.rgb);
        doc.circle(bx + 1.5, by + bh / 2, 0.6, 'F');
        doc.setTextColor(...c.rgb);
        doc.text(abbr, bx + 2.8, by + 2.2);
      }

      if (row.isGroupHeader) return;

      // Col 5 : CPR badge
      if (data.column.index === 5) {
        if (row.cpr) {
          drawBadgeLabel(doc, data.cell, 'C', THEME.primary, lighten(THEME.primary, 0.82), fontH);
        }
      }
      // Col 6 : Presence — lettre seule (legende en bas du tableau)
      if (data.column.index === 6) {
        const presMap = { present: 'P', excused: 'E', not_summoned: 'NC', absent: 'A' };
        const letter = presMap[row.att] || 'A';
        const colorMap = { present: THEME.presentTxt, excused: THEME.excusedTxt, not_summoned: [168, 85, 247], absent: [160, 170, 180] };
        doc.setFont(fontH, 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...(colorMap[row.att] || colorMap.absent));
        doc.text(letter, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
      }
      // Col 7 : Diffusion badge
      if (data.column.index === 7) {
        if (row.diff) {
          drawBadgeLabel(doc, data.cell, 'D', [30, 90, 170], [230, 242, 255], fontH);
        }
      }
    },
  });

  cursor.y = doc.lastAutoTable.finalY + 2;

  // Legende presence / diffusion (italique, discret)
  doc.setFont(fontB, 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...THEME.lightText);
  doc.text('P : Présent  |  E : Excusé  |  A : Absent  |  NC : Non convoqué  |  C : CPR  |  D : Diffusion', M.left, cursor.y);
  cursor.y += 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. TEXTE LEGAL
  // ═══════════════════════════════════════════════════════════════════════════

  if (crrConfig.legalText) {
    ensureSpace(doc, cursor, 16);

    doc.setFont(fontB, 'italic');
    doc.setFontSize(5.5);
    const legalLines = doc.splitTextToSize(crrConfig.legalText, CW - 10);
    const legalH = legalLines.length * 2.5 + 4;

    doc.setFillColor(248, 249, 252);
    doc.setDrawColor(...THEME.borders);
    doc.setLineWidth(0.15);
    roundedRect(doc, M.left, cursor.y, CW, legalH, 1.5, 'FD');

    doc.setTextColor(...THEME.lightText);
    doc.text(legalLines, M.left + 5, cursor.y + 3.5);
    cursor.y += legalH + 4;
  }

  // Encadre "Observations sur le compte rendu" avant saut de page
  const obsNoticeText = 'OBSERVATIONS SUR LE COMPTE-RENDU : Il est rappelé aux entreprises que les observations portées sur les comptes rendus ne sont que la confirmation des ordres donnés soit au cours de visites de chantier, soit au cours des rendez-vous de chantier et qu\'il leur appartient de les appliquer immédiatement. La date de réception du présent compte rendu ne peut en aucun cas être une excuse aux retards apportés dans la réalisation des travaux. Le présent compte rendu est considéré comme définitivement approuvé s\'il n\'a fait l\'objet d\'observations écrites dans un délai qui expire 48 heures après la date de diffusion.';

  doc.setFont(fontB, 'normal');
  doc.setFontSize(6.5);
  const noticeLines = doc.splitTextToSize(obsNoticeText, CW - 8);
  const noticeH = noticeLines.length * 3 + 6;

  ensureSpace(doc, cursor, noticeH);

  // Fond + bordure
  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(253, 186, 116); // amber-300
  doc.setLineWidth(0.2);
  roundedRect(doc, M.left, cursor.y, CW, noticeH, 1.5, 'FD');

  // Texte
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text(noticeLines, M.left + 4, cursor.y + 4);
  cursor.y += noticeH + 4;

  // Saut de page apres la liste des intervenants
  doc.addPage();
  cursor.y = M.top;

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const categories = crrConfig.categories || [];
  const observations = meeting.observations || [];

  // Statistiques
  const totalObs = observations.length;
  const openObs  = observations.filter(o => o.status === 'open').length;
  const progObs  = observations.filter(o => o.status === 'in_progress').length;
  const doneObs  = observations.filter(o => o.status === 'done').length;

  // Bandeau principal OBSERVATIONS avec stats
  ensureSpace(doc, cursor, 20);

  doc.setFillColor(...THEME.primary);
  roundedRect(doc, M.left, cursor.y, CW, 10, 1.5, 'F');

  doc.setFont(fontH, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('OBSERVATIONS', M.left + 5, cursor.y + 7);

  // Stats a droite
  const statsText = `${totalObs} obs.  |  ${openObs} ouvertes  |  ${progObs} en cours  |  ${doneObs} faites`;
  doc.setFont(fontB, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(220, 240, 230);
  doc.text(statsText, PW - M.right - 5, cursor.y + 7, { align: 'right' });

  cursor.y += 13;

  // Precharger toutes les images des observations
  const imageCache = new Map();
  for (const obs of observations) {
    for (const uri of (obs.images || [])) {
      if (!imageCache.has(uri)) {
        const img = await loadImage(uri).catch(() => null);
        if (img) imageCache.set(uri, { w: img.width, h: img.height, uri });
      }
    }
  }

  const IMG_ROW_H = 30; // mm par rangee d'images
  const OBS_COL_W = CW - 20 - 18 - 18 - 24 - 20; // largeur auto de la colonne obs

  // Par categorie
  const OBS_HEAD = [['EMETTEUR', 'DATE', 'OBSERVATIONS', 'STATUT', 'PAR', 'POUR LE']];
  const obsHeadStyles = {
    fillColor: lighten(THEME.primary, 0.78),
    textColor: darken(THEME.primary, 0.1),
    fontStyle: 'bold',
    font: fontH,
    halign: 'center',
    fontSize: 7,
  };
  const OBS_COL_STYLES = {
    0: { cellWidth: 20 },
    1: { cellWidth: 18 },
    2: {},
    3: { cellWidth: 18 },
    4: { cellWidth: 24 },
    5: { cellWidth: 20 },
  };
  let isFirstObsTable = true;
  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci];
    const catObs = observations.filter((o) => o.category === cat);
    const catColor = CAT_COLORS[ci % CAT_COLORS.length];

    ensureSpace(doc, cursor, 14);

    // Bandeau categorie avec pastille coloree
    doc.setFillColor(...lighten(catColor, 0.88));
    roundedRect(doc, M.left, cursor.y, CW, 7, 1, 'F');

    // Pastille laterale
    doc.setFillColor(...catColor);
    roundedRect(doc, M.left, cursor.y, 1.5, 7, 0.75, 'F');

    doc.setFont(fontH, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...catColor);
    doc.text(cat.toUpperCase(), M.left + 5, cursor.y + 5);

    // Compteur a droite
    const catCount = catObs.length;
    doc.setFont(fontB, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...lighten(catColor, 0.3));
    doc.text(`${catCount} observation${catCount > 1 ? 's' : ''}`, PW - M.right - 4, cursor.y + 5, { align: 'right' });

    cursor.y += 9;

    if (catObs.length === 0) {
      doc.setFont(fontB, 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(...THEME.lightText);
      doc.text('Aucune observation', PW / 2, cursor.y + 1, { align: 'center' });
      cursor.y += 5;
      continue;
    }

    // Tableau observations — lignes texte + lignes images separees
    // Les images sont dans des lignes dediees pour que autoTable gere
    // correctement la hauteur et les sauts de page.
    const obsBody = [];
    const obsRowMeta = []; // { obs, type: 'text'|'images', imgs? }

    catObs.forEach((obs) => {
      let text = obs.text || '';
      if (obs.originMeetingNumber) text += ` (Report CR n${obs.originMeetingNumber})`;

      // Ligne texte — emitter et actionBy sont dessines en pastilles via didDrawCell
      obsBody.push([
        '',
        formatDate(obs.date),
        text,
        '', // STATUT — badge dessine par didDrawCell
        '',
        formatDate(obs.actionDeadline),
      ]);
      obsRowMeta.push({ obs, type: 'text', emitter: obs.emitter || '', actionBy: obs.actionBy || '' });

      // Ligne images si necessaire (ligne separee pour gerer les sauts de page)
      const imgs = (obs.images || []).filter(u => imageCache.has(u));
      if (imgs.length > 0) {
        obsBody.push(['', '', '', '', '', '']);
        obsRowMeta.push({ obs, type: 'images', imgs });
      }
    });

    autoTable(doc, {
      startY: cursor.y,
      margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
      tableWidth: CW,
      head: isFirstObsTable ? OBS_HEAD : [],
      showHead: isFirstObsTable ? 'firstPage' : 'never',
      body: obsBody,
      theme: 'grid',
      styles: {
        font: fontB,
        fontSize: 6.5,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 1.5 },
        overflow: 'linebreak',
        textColor: THEME.text,
        lineColor: THEME.borders,
        lineWidth: 0.12,
        valign: 'top',
      },
      headStyles: obsHeadStyles,
      columnStyles: {
        0: { cellWidth: OBS_COL_STYLES[0].cellWidth, halign: 'center', fontStyle: 'bold', textColor: catColor },
        1: { cellWidth: OBS_COL_STYLES[1].cellWidth, halign: 'center', textColor: THEME.lightText },
        2: {},
        3: { cellWidth: OBS_COL_STYLES[3].cellWidth, halign: 'center' },
        4: { cellWidth: OBS_COL_STYLES[4].cellWidth, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: OBS_COL_STYLES[5].cellWidth, halign: 'center', textColor: THEME.lightText },
      },
      alternateRowStyles: {
        fillColor: [250, 252, 254],
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const meta = obsRowMeta[data.row.index];
        if (!meta) return;
        const obs = meta.obs;

        // Hauteur minimale pour les pastilles emetteur/actionBy
        if (meta.type === 'text') {
          const emitterCount = parseBadgeNames(meta.emitter).length;
          const actionCount = parseBadgeNames(meta.actionBy).length;
          const maxBadges = Math.max(emitterCount, actionCount);
          if (maxBadges > 0) {
            const needed = badgesHeight(maxBadges);
            data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight || 0, needed);
          }
        }

        // Fond colore selon statut (texte ET images)
        if (obs.status === 'done') {
          data.cell.styles.fillColor = THEME.doneBg;
          if (meta.type === 'text' && data.column.index === 2) data.cell.styles.textColor = THEME.doneTxt;
        } else if (obs.status === 'in_progress') {
          data.cell.styles.fillColor = THEME.progressBg;
          if (meta.type === 'text' && data.column.index === 2) data.cell.styles.textColor = THEME.progressTxt;
        } else {
          if (meta.type === 'text' && data.column.index === 2) data.cell.styles.textColor = THEME.text;
        }

        // Ligne images : hauteur minimale pour contenir les images
        if (meta.type === 'images') {
          if (meta.imgs.length === 1) {
            // Image unique : hauteur basee sur le ratio reel de l'image
            const cached = imageCache.get(meta.imgs[0]);
            if (cached) {
              const colW = data.cell.width || 80;
              const imgW = colW - 3;
              const imgH = imgW / (cached.w / cached.h);
              data.cell.styles.minCellHeight = Math.min(imgH + 3, 80); // max 80mm
            } else {
              data.cell.styles.minCellHeight = IMG_ROW_H;
            }
          } else {
            const imgRows = Math.ceil(meta.imgs.length / 2);
            data.cell.styles.minCellHeight = imgRows * IMG_ROW_H;
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const meta = obsRowMeta[data.row.index];
        if (!meta) return;

        // Effacer la bordure horizontale entre ligne texte et ligne images
        // pour qu'elles apparaissent comme une seule ligne
        const getFill = (obs) =>
          obs.status === 'done' ? THEME.doneBg
          : obs.status === 'in_progress' ? THEME.progressBg
          : (data.row.index % 2 === 0 ? [255, 255, 255] : [250, 252, 254]);

        if (meta.type === 'text') {
          const nextMeta = obsRowMeta[data.row.index + 1];
          if (nextMeta?.type === 'images') {
            // Effacer la bordure basse de la ligne texte
            const fill = getFill(meta.obs);
            doc.setFillColor(...fill);
            doc.rect(data.cell.x + 0.06, data.cell.y + data.cell.height - 0.12, data.cell.width - 0.12, 0.24, 'F');
          }
        }
        if (meta.type === 'images') {
          // Effacer la bordure haute de la ligne images
          const fill = getFill(meta.obs);
          doc.setFillColor(...fill);
          doc.rect(data.cell.x + 0.06, data.cell.y - 0.12, data.cell.width - 0.12, 0.24, 'F');
        }

        // Dessiner les images dans la colonne observations (lignes images uniquement)
        if (meta.type === 'images' && data.column.index === 2) {
          const { imgs } = meta;
          const colW = data.cell.width;
          const cellTop = data.cell.y;
          const cellBottom = data.cell.y + data.cell.height;
          const maxCellH = cellBottom - cellTop;

          if (imgs.length === 1) {
            // Image unique : pleine largeur de la colonne
            const cached = imageCache.get(imgs[0]);
            if (cached) {
              const aspect = cached.w / cached.h;
              let imgW = colW - 3;
              let imgH = imgW / aspect;
              // Limiter a la hauteur disponible dans la cellule
              if (imgH > maxCellH - 2) {
                imgH = maxCellH - 2;
                imgW = imgH * aspect;
              }
              const imgX = data.cell.x + (colW - imgW) / 2;
              const imgY = cellTop + (maxCellH - imgH) / 2;
              try {
                doc.addImage(cached.uri, 'JPEG', imgX, imgY, imgW, imgH);
              } catch { /* image invalide */ }
            }
          } else {
            // Plusieurs images : 2 par ligne
            const slotW = (colW - 3) / 2;
            for (let i = 0; i < imgs.length; i++) {
              const cached = imageCache.get(imgs[i]);
              if (!cached) continue;
              const imgRow = Math.floor(i / 2);
              const col = i % 2;
              const aspect = cached.w / cached.h;

              let imgW = slotW;
              let imgH = imgW / aspect;
              if (imgH > IMG_ROW_H - 2) {
                imgH = IMG_ROW_H - 2;
                imgW = imgH * aspect;
              }

              const imgX = data.cell.x + 1.5 + col * (slotW + 1);
              const imgY = cellTop + 1 + imgRow * IMG_ROW_H;

              if (imgY >= cellTop - 0.5 && imgY + imgH <= cellBottom + 0.5) {
                try {
                  doc.addImage(cached.uri, 'JPEG', imgX, imgY, imgW, imgH);
                } catch { /* image invalide */ }
              }
            }
          }
        }

        // Pastilles groupes emetteur (col 0) et actionBy (col 4)
        if (meta.type === 'text' && data.column.index === 0) {
          drawGroupBadges(doc, data.cell, meta.emitter, groupIndexMap, fontH);
        }
        if (meta.type === 'text' && data.column.index === 4) {
          drawGroupBadges(doc, data.cell, meta.actionBy, groupIndexMap, fontH);
        }

        // Badge statut (lignes texte uniquement)
        if (meta.type === 'text' && data.column.index === 3) {
          const obs = meta.obs;
          if (obs.status === 'done') {
            drawBadge(doc, data.cell, 'FAIT', THEME.doneBg.map(c => Math.max(0, c - 20)), THEME.doneTxt, fontH);
          } else if (obs.status === 'in_progress') {
            drawBadge(doc, data.cell, 'En cours', THEME.progressBg.map(c => Math.max(0, c - 20)), THEME.progressTxt, fontH);
          } else {
            drawBadge(doc, data.cell, 'Ouvert', THEME.openBg.map(c => Math.max(0, c - 20)), THEME.openTxt, fontH);
          }
        }
      },
      didDrawPage: () => { cursor.y = M.top; },
    });

    isFirstObsTable = false;
    cursor.y = doc.lastAutoTable.finalY + 3;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. DECORATION : bande laterale toutes pages
  // ═══════════════════════════════════════════════════════════════════════════

  drawPageDecor(doc, THEME);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PIED DE PAGE (toutes les pages)
  // ═══════════════════════════════════════════════════════════════════════════

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    const footY = PH - M.bottom + 4;

    // Ligne fine
    doc.setDrawColor(...THEME.borders);
    doc.setLineWidth(0.2);
    doc.line(M.left, footY - 2, PW - M.right, footY - 2);

    // Colonne gauche : nom societe
    if (branding?.companyName) {
      doc.setFont(fontH, 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...THEME.primary);
      doc.text(branding.companyName, M.left, footY + 1);
    }

    // Centre : projet + pagination
    doc.setFont(fontB, 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...THEME.lightText);
    doc.text(`${pdfProjectName}  --  Page ${p}/${totalPages}`, PW / 2, footY + 1, { align: 'center' });

    // Droite : date d'edition
    doc.text(
      `Édité le ${new Date().toLocaleDateString('fr-FR')}`,
      PW - M.right,
      footY + 1,
      { align: 'right' },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SAUVEGARDE
  // ═══════════════════════════════════════════════════════════════════════════

  const safeName = sanitizeFilename(projectName || 'PROJET').toUpperCase();
  const crNum = String(meeting.number).padStart(2, '0');
  const filename = `CR_${crNum}_${safeName}_${meeting.date || 'ND'}.pdf`;

  // Si returnBlob, retourner le blob + filename sans telecharger
  if (options?.returnBlob) {
    const blob = doc.output('blob');
    return { blob, filename };
  }

  doc.save(filename);
};
