// src/utils/pdfCrrGenerator.js
//
// Export PDF d'un Compte Rendu de Réunion — version moderne & pro.
// Mise en page soignée avec bandes décoratives, couleurs de statut,
// bandeaux de catégorie et pied de page 3 colonnes.
//
// NOTE : jsPDF + Helvetica supporte les accents latins (WinAnsiEncoding).
// Seuls les glyphes hors Latin-1 (emoji, CJK, etc.) ne sont pas supportés.

import jsPDF from 'jspdf';
import { stampPdfCredit } from './estimaCredit';
import autoTable from 'jspdf-autotable';
import { DEFAULT_BRANDING } from '../data/branding';
import { MEETING_TYPES, GROUP_COLORS, abbreviateGroup, computeObsStats, obsDisplayNumber, obsAge } from '../data/crrData';
import { parseObsHtml, stripHtml } from './formatObsText.jsx';
import { flattenGroupContacts, groupColorIndexMap, groupBadgeNameMap } from './crrParticipantTree';
import { lightenRgb, darkenRgb, loadImage, formatDateFr, formatDateLong, sanitizeFilename, loadLogos, fitTextToWidth } from './pdf/pdfSharedHelpers';
import { buildTheme as _buildTheme } from './pdf/buildTheme';

// ─── HELPERS ────────────────────────────────────────────────────────────────

const CRR_OVERRIDES = {
  borders:     [210, 218, 226],
  presentBg:   [232, 250, 240],
  presentTxt:  [22, 130, 76],
  excusedBg:   [241, 245, 249],
  excusedTxt:  [71, 85, 105],
  absentTxt:   [180, 180, 190],
  doneBg:      [232, 250, 240],
  doneTxt:     [22, 120, 70],
  progressBg:  [230, 242, 255],
  progressTxt: [30, 90, 170],
  openBg:      [255, 247, 230],
  openTxt:     [146, 64, 14],
};

const buildTheme = (branding) => _buildTheme(branding, CRR_OVERRIDES);

// Couleurs tournantes pour les categories
const CAT_COLORS = [
  [40, 110, 85],   // emerald (primary)
  [37, 99, 175],   // blue
  [124, 58, 170],  // purple
  [210, 120, 20],  // orange
  [71, 85, 105],   // slate (ex-rouge : reserve aux alertes, pas aux categories)
  [170, 140, 20],  // amber
];

// ─── CONSTANTES ─────────────────────────────────────────────────────────────

const M = { top: 20, bottom: 18, left: 14, right: 12 };
const PH = 297;
const PW = 210;
const CW = PW - M.left - M.right;
const STRIPE_W = 1.5;
// Hauteur reservee (mm) en haut de la cellule observation pour la ligne de
// numero "CHANTIER.04" (dessine en gras, au-dessus du texte).
const NUM_BAND = 3.0;

// ─── PAGES ──────────────────────────────────────────────────────────────────

const ensureSpace = (doc, cursor, need) => {
  if (cursor.y + need > PH - M.bottom) {
    doc.addPage();
    cursor.y = M.top;
  }
};

// Dessine la bande decorative a gauche sur toutes les pages.
// Primaire sur TOUTE la hauteur puis accent par-dessus le dernier tiers :
// garantit une bande continue sans raccord (pas de segment manquant).
const drawPageDecor = (doc, theme) => {
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFillColor(...theme.primary);
    doc.rect(0, 0, STRIPE_W, PH, 'F');
    doc.setFillColor(...theme.accent);
    doc.rect(0, PH * 0.6, STRIPE_W, PH * 0.4, 'F');
  }
};

// ─── ROUNDED RECT ───────────────────────────────────────────────────────────

const roundedRect = (doc, x, y, w, h, r, style) => {
  r = Math.min(r, h / 2, w / 2);
  doc.roundedRect(x, y, w, h, r, r, style);
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
  doc.text(text, cell.x + cell.width / 2, by + badgeH / 2, { align: 'center', baseline: 'middle' });
};

// Badge lettre arrondi (P, E, A, NC, D, C) centre dans la cellule.
// Largeur adaptative : « NC » tient dans sa pastille comme les lettres seules.
const drawBadgeLabel = (doc, cell, letter, txtColor, bgColor, font) => {
  doc.setFont(font, 'bold');
  doc.setFontSize(6);
  const bw = Math.max(5, doc.getTextWidth(letter) + 2.4);
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
const BADGE_W = 9;     // largeur fixe (mm) pour aligner toutes les pastilles

// Calcule la hauteur necessaire pour N pastilles
const badgesHeight = (n) => n > 0 ? n * BADGE_H + (n - 1) * BADGE_GAP + BADGE_PAD * 2 : 0;

// Parse un champ "MOA, Entreprises" en tableau de noms
const parseBadgeNames = (value) =>
  (value || '').split(',').map((s) => s.trim()).filter(Boolean);

// Dessine des pastilles de groupes (emetteur/actionBy) dans une cellule PDF
const drawGroupBadges = (doc, cell, value, groupIndexMap, badgeNameMap, font) => {
  const names = parseBadgeNames(value);
  if (names.length === 0) return;

  const totalH = names.length * BADGE_H + (names.length - 1) * BADGE_GAP;
  let startY = cell.y + Math.max(BADGE_PAD, (cell.height - totalH) / 2);

  names.forEach((name) => {
    // Ne pas dessiner en dehors de la cellule
    if (startY + BADGE_H > cell.y + cell.height) return;

    const idx = groupIndexMap[name] ?? 0;
    const c = GROUP_COLORS[idx % GROUP_COLORS.length];
    const abbr = abbreviateGroup(badgeNameMap?.[name] || name);

    doc.setFont(font, 'bold');
    doc.setFontSize(5);
    const badgeW = Math.min(BADGE_W, cell.width - 1);
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

  // Map nom (groupe OU sous-groupe) → index couleur pour les pastilles
  const groupIndexMap = groupColorIndexMap(crrConfig.participantGroups);
  const badgeNameMap = groupBadgeNameMap(crrConfig.participantGroups);

  const typeLabel = MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  const showLegalText = meeting.type === 'chantier' && !!crrConfig.legalText;
  const pdfProjectName = (projectName || 'PROJET').toUpperCase();

  // Logos
  const { logoMoe } = await loadLogos(branding, {});
  const logoCommune = crrConfig.chantierInfo?.communeLogo
    ? await loadImage(crrConfig.chantierInfo.communeLogo).catch(() => null)
    : null;
  const logoCommune2 = crrConfig.chantierInfo?.communeLogo2
    ? await loadImage(crrConfig.chantierInfo.communeLogo2).catch(() => null)
    : null;
  const logoCotraitant = crrConfig.chantierInfo?.cotraitantLogo
    ? await loadImage(crrConfig.chantierInfo.cotraitantLogo).catch(() => null)
    : null;

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

  // Rangee de logos UNIFIEE, alignee a droite du cartouche : hauteur commune,
  // espacement constant, ordre protocolaire MOA (commune) → cotraitant → MOE,
  // le tout pose sur une bande blanche unique (fini les cadres depareilles).
  {
    const LOGO_H = 13;
    const LOGO_GAP = 6;
    let entries = [logoCommune, logoCommune2, logoCotraitant, logoMoe]
      .filter(Boolean)
      .map((img) => {
        const r = img.width / img.height;
        let h = LOGO_H, w = h * r;
        if (w > 30) { w = 30; h = w / r; } // logo tres large : plafonner
        return { img, w, h };
      });
    if (entries.length) {
      let totalW = entries.reduce((s, e) => s + e.w, 0) + LOGO_GAP * (entries.length - 1);
      // Laisser ~78mm au bloc texte a gauche : retrecir la rangee si besoin
      const maxRow = PW - M.right - 4 - (M.left + 78) - 8;
      if (totalW > maxRow) {
        const k = maxRow / totalW;
        entries = entries.map((e) => ({ img: e.img, w: e.w * k, h: e.h * k }));
        totalW = maxRow;
      }
      const bandH = LOGO_H + 4;
      const bandW = totalW + 8;
      const bx = PW - M.right - 4 - bandW;
      const by = cursor.y + (28 - bandH) / 2;
      doc.setFillColor(255, 255, 255);
      roundedRect(doc, bx, by, bandW, bandH, 1.5, 'F');
      let lx = bx + 4;
      for (const e of entries) {
        doc.addImage(e.img, 'JPEG', lx, cursor.y + (28 - e.h) / 2, e.w, e.h);
        lx += e.w + LOGO_GAP;
      }
    }
  }

  // Hierarchie inversee : le type/N°/date ne sont que des METADONNEES,
  // le titre du projet (plus bas) est l'element dominant de la page.
  doc.setFont(fontH, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.lightText);
  doc.text(typeLabel.toUpperCase(), M.left + 6, cursor.y + 9);

  doc.setFontSize(15);
  doc.setTextColor(...THEME.primary);
  const numTxt = `N° ${meeting.number}`;
  doc.text(numTxt, M.left + 6, cursor.y + 17.5);
  const numW = doc.getTextWidth(numTxt);
  doc.setFont(fontB, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text(`—  ${formatDateFr(meeting.date)}`, M.left + 9 + numW, cursor.y + 17.5);

  cursor.y += 31;

  // Nom du projet — element dominant (16pt)
  doc.setFont(fontH, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...THEME.primary);
  const titleLines = doc.splitTextToSize(pdfProjectName, CW - 16);
  const titleLineHeight = 6.2;
  doc.text(titleLines, PW / 2, cursor.y + 5, { align: 'center', lineHeightFactor: 1.1 });

  // Ligne decorative sous le titre
  const titleW = Math.min(
    Math.max(...titleLines.map((line) => doc.getTextWidth(line))),
    CW - 20
  );
  const lineX = (PW - titleW) / 2;
  const titleLineY = cursor.y + 5 + (titleLines.length - 1) * titleLineHeight;
  doc.setDrawColor(...THEME.accent);
  doc.setLineWidth(0.5);
  doc.line(lineX, titleLineY + 3, lineX + titleW, titleLineY + 3);

  cursor.y += 14 + (titleLines.length - 1) * titleLineHeight;

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
    doc.text(fitTextToWidth(doc, parts.join('  --  '), CW - 10), M.left + 5, cursor.y + 8.5);

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

  // (Legende retiree du bandeau PARTICIPANTS)

  cursor.y += 10;

  // Construire les donnees du tableau participants.
  // Ordre par groupe : contacts directs, puis chaque sous-groupe (bandeau
  // indente « » Nom (n) » aux couleurs du groupe parent + ses contacts).
  const participantRows = [];
  const groups = crrConfig.participantGroups || [];

  for (let gi = 0; gi < groups.length; gi++) {
    // Fine ligne d'espacement entre deux groupes (invisible, sans bordure)
    if (gi > 0) participantRows.push({ isSpacer: true, groupIdx: `__sp${gi}__` });

    const group = groups[gi];
    const subGroups = group.subGroups || [];
    const roleLabel = `${group.name}${group.subLabel ? ` : ${group.subLabel}` : ''}`;

    if (flattenGroupContacts(group).length === 0 && subGroups.length === 0) {
      participantRows.push({
        role: roleLabel,
        subLabel: '', contact: '', email: '', cpr: false, att: 'absent', diff: false,
        isGroupHeader: true, groupName: group.name, groupIdx: gi,
      });
      continue;
    }

    let firstRowOfGroup = true;
    const pushContact = (contact) => {
      const att = meeting.attendance?.[contact.id] || 'absent';
      const diff = meeting.diffusion?.[contact.id] || false;
      participantRows.push({
        role: firstRowOfGroup ? roleLabel : '',
        subLabel: contact.subLabel || '',
        // Une pastille par label (abrev.) ; fallback sur le groupe si pas de label
        pastilleLabel: contact.badgeName || (contact.subLabel || '').trim() || group.name,
        contact: (contact.name || '') + (contact.fonction ? '\n' + contact.fonction : ''),
        email: (contact.email || '') + (contact.phone ? '\n' + contact.phone : ''),
        cpr: !!contact.cpr,
        att,
        diff,
        isContact: true,
        isGroupHeader: false,
        groupName: firstRowOfGroup ? group.name : '',
        groupIdx: gi,
      });
      firstRowOfGroup = false;
    };

    (group.contacts || []).forEach((c) => pushContact(c));
    for (const sg of subGroups) {
      const n = (sg.contacts || []).length;
      participantRows.push({
        role: firstRowOfGroup ? roleLabel : '',
        subGroupLabel: `${sg.name}${n > 0 ? ` (${n})` : ''}`,
        sgName: sg.name,
        cpr: false, att: 'absent', diff: false,
        isGroupHeader: false, isSubGroupHeader: true,
        groupName: firstRowOfGroup ? group.name : '',
        groupIdx: gi,
      });
      firstRowOfGroup = false;
      (sg.contacts || []).forEach((c) => pushContact(c));
    }
  }

  // Blocs de label : chaque suite de contacts consecutifs du meme groupe et du
  // meme label reçoit UNE pastille fusionnee (rowSpan). Un bandeau/header casse
  // le bloc. On marque le 1er contact du bloc + sa hauteur (nb de lignes).
  for (let i = 0; i < participantRows.length; i++) {
    const r = participantRows[i];
    if (!r.isContact) continue;
    const prev = participantRows[i - 1];
    const sameBlock = prev && prev.isContact && prev.groupIdx === r.groupIdx && (prev.subLabel || '') === (r.subLabel || '');
    if (!sameBlock) {
      r.labelBlockStart = true;
      let span = 1;
      for (let j = i + 1; j < participantRows.length; j++) {
        const nx = participantRows[j];
        if (nx.isContact && nx.groupIdx === r.groupIdx && (nx.subLabel || '') === (r.subLabel || '')) span++;
        else break;
      }
      r.labelBlockSpan = span;
    }
  }

  // Colonnes conditionnelles : LABEL et CPR ne s'impriment que s'ils portent
  // au moins une information sur ce CR (une colonne vide mine la credibilite).
  const hasLabel = participantRows.some((r) => r.isContact && r.subLabel);
  const hasCpr = participantRows.some((r) => r.cpr);
  // Ordre demande : ROLE | pastille(label) | LABEL | CONTACT | EMAIL | [CPR] | PRES | DIFF
  const FIXED = 30 + 14 + (hasLabel ? 20 : 0) + 44 + (hasCpr ? 8 : 0) + 8 + 8;
  const partColDefs = [
    { key: 'role', w: 30, style: { fontStyle: 'bold', fontSize: 6.5 } },
    { key: 'pastille', w: 14, style: { halign: 'center' } },
    ...(hasLabel ? [{ key: 'label', w: 20, style: { fontSize: 6.5, textColor: [100, 116, 139] } }] : []),
    { key: 'contact', w: CW - FIXED, style: {} },
    { key: 'email', w: 44, style: { textColor: [75, 85, 99], fontSize: 6.5 } },
    ...(hasCpr ? [{ key: 'cpr', w: 8, style: { halign: 'center' } }] : []),
    { key: 'pres', w: 8, style: { halign: 'center' } },
    { key: 'diff', w: 8, style: { halign: 'center' } },
  ];
  const partColKeys = partColDefs.map((c) => c.key);
  const partHead = [
    'ROLE / INTERVENANT', '',
    ...(hasLabel ? ['LABEL'] : []),
    'CONTACT', 'EMAIL',
    ...(hasCpr ? ['CPR'] : []),
    'PRES.', 'DIFF.',
  ];

  // Corps : col 0 (ROLE) rowSpan par GROUPE ; col 1 (pastille) rowSpan par BLOC
  // de label ; bandeau sous-groupe = colSpan sur toutes les colonnes sauf ROLE.
  const partBody = [];
  const nCols = partColKeys.length;
  for (let i = 0; i < participantRows.length; i++) {
    const r = participantRows[i];
    if (r.isSpacer) {
      partBody.push([{ content: '', colSpan: nCols, styles: { fillColor: [255, 255, 255], lineWidth: 0, minCellHeight: 1.6, cellPadding: 0 } }]);
      continue;
    }
    if (r.isGroupHeader) {
      partBody.push([r.role, ...Array(nCols - 1).fill('')]);
      continue;
    }

    const isFirstOfGroup = (i === 0 || participantRows[i - 1].groupIdx !== r.groupIdx || participantRows[i - 1].isGroupHeader);
    const cells = [];
    if (isFirstOfGroup) {
      let span = 1;
      for (let j = i + 1; j < participantRows.length && !participantRows[j].isGroupHeader && participantRows[j].groupIdx === r.groupIdx; j++) span++;
      cells.push({ content: r.role, rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 6.5, overflow: 'linebreak' } });
    }

    if (r.isSubGroupHeader) {
      // Bandeau : toutes les colonnes a droite de ROLE (pastille incluse)
      cells.push({
        content: r.subGroupLabel,
        colSpan: nCols - 1,
        styles: { fontStyle: 'bold', fontSize: 6, halign: 'left', cellPadding: { top: 1, bottom: 1, left: 7, right: 1.5 } },
      });
    } else {
      // Contact : pastille (rowSpan bloc) uniquement en tete de bloc, puis data
      if (r.labelBlockStart) {
        cells.push({ content: '', rowSpan: r.labelBlockSpan, styles: { valign: 'middle' } });
      }
      cells.push(
        ...(hasLabel ? [r.subLabel] : []),
        r.contact, r.email,
        ...(hasCpr ? [''] : []),
        '', '',
      );
    }
    partBody.push(cells);
  }

  autoTable(doc, {
    startY: cursor.y,
    margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
    tableWidth: CW,
    head: [partHead],
    body: partBody,
    theme: 'grid',
    styles: {
      font: fontB,
      fontSize: 7,
      cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 1.5 },
      overflow: 'linebreak',
      textColor: THEME.text,
      lineColor: THEME.borders,
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: lightenRgb(THEME.primary, 0.78),
      textColor: darkenRgb(THEME.primary, 0.1),
      fontStyle: 'bold',
      font: fontH,
      halign: 'center',
      fontSize: 6.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
    },
    columnStyles: Object.fromEntries(
      partColDefs.map((c, i) => [i, { cellWidth: c.w, ...c.style }])
    ),
    didParseCell: (data) => {
      // En-tetes CPR/PRES/DIFF : police reduite pour tenir dans les colonnes minimales
      if (data.section === 'head' && ['cpr', 'pres', 'diff'].includes(partColKeys[data.column.index])) {
        data.cell.styles.fontSize = 5;
        data.cell.styles.cellPadding = { top: 1.6, bottom: 1.6, left: 0.5, right: 0.5 };
      }
      if (data.section === 'body') {
        const row = participantRows[data.row.index];
        if (!row) return;
        if (row.isSpacer) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.lineWidth = 0;
          return;
        }
        if (row.isGroupHeader) {
          data.cell.styles.fillColor = THEME.lightBg;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = THEME.primary;
          return;
        }
        // Bandeau sous-groupe : fond/texte aux couleurs du groupe parent
        // (col 1+ ; la col 0 ROLE est couverte par le rowSpan de groupe)
        if (row.isSubGroupHeader && data.column.index >= 1) {
          const c = GROUP_COLORS[row.groupIdx % GROUP_COLORS.length];
          data.cell.styles.fillColor = c.rgbBg;
          data.cell.styles.textColor = darkenRgb(c.rgb, 0.25);
          return;
        }
        // Cols 0-1 (ROLE + pastille label, fond couleur du groupe)
        if (data.column.index <= 1) {
          const c = GROUP_COLORS[row.groupIdx % GROUP_COLORS.length];
          data.cell.styles.fillColor = c.rgbBg;
          if (data.column.index === 0) data.cell.styles.textColor = darkenRgb(c.rgb, 0.25);
          return;
        }
        // Alternance par groupe (pair = blanc, impair = gris clair)
        data.cell.styles.fillColor = row.groupIdx % 2 === 0 ? [255, 255, 255] : [250, 252, 254];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const row = participantRows[data.row.index];
      if (!row || row.isSpacer) return;

      if (row.isGroupHeader) return;

      // Pastille PAR LABEL (col 1) : abreviation du label, couleur du groupe
      // parent, fond blanc. Dessinee en tete de bloc (cellule rowSpan).
      if (partColKeys[data.column.index] === 'pastille' && row.isContact) {
        const c = GROUP_COLORS[row.groupIdx % GROUP_COLORS.length];
        const abbr = abbreviateGroup(row.pastilleLabel || '');
        doc.setFont(fontH, 'bold');
        doc.setFontSize(4.5);
        const bw = Math.min(BADGE_W, data.cell.width - 1);
        const bh = 3;
        const bx = data.cell.x + (data.cell.width - bw) / 2;
        const by = data.cell.y + (data.cell.height - bh) / 2;
        doc.setFillColor(255, 255, 255);
        roundedRect(doc, bx, by, bw, bh, 1, 'F');
        doc.setFillColor(...c.rgb);
        doc.circle(bx + 1.5, by + bh / 2, 0.6, 'F');
        doc.setTextColor(...c.rgb);
        doc.text(abbr, bx + 2.8, by + 2.2);
      }

      // Bandeau sous-groupe : plus de pastille propre (la pastille par label des
      // contacts en-dessous porte deja l'abreviation → evite le doublon)
      if (row.isSubGroupHeader) return;

      const colKey = partColKeys[data.column.index];

      // CPR badge (colonne presente uniquement si au moins un CPR coche)
      if (colKey === 'cpr' && row.cpr) {
        drawBadgeLabel(doc, data.cell, 'C', THEME.primary, lightenRgb(THEME.primary, 0.82), fontH);
      }
      // Presence : traitement UNIFIE — pastille pour les 4 etats (lisible N&B,
      // l'Absent reste le seul fond plein pour marquer l'alerte).
      if (colKey === 'pres') {
        const presPill = {
          present:      { l: 'P',  txt: [22, 130, 76],   bg: [212, 240, 224] },
          excused:      { l: 'E',  txt: [71, 85, 105],   bg: [226, 232, 240] },
          absent:       { l: 'A',  txt: [255, 255, 255], bg: [220, 38, 38] },
          not_summoned: { l: 'NC', txt: [107, 33, 168],  bg: [243, 232, 255] },
        };
        const p = presPill[row.att] || presPill.absent;
        drawBadgeLabel(doc, data.cell, p.l, p.txt, p.bg, fontH);
      }
      // Diffusion badge
      if (colKey === 'diff' && row.diff) {
        drawBadgeLabel(doc, data.cell, 'D', [30, 90, 170], [230, 242, 255], fontH);
      }
    },
  });

  cursor.y = doc.lastAutoTable.finalY + 2;

  // Legende presence / diffusion — construite d'apres les colonnes reellement
  // affichees (pas de code orphelin si CPR est masquee)
  doc.setFont(fontB, 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...THEME.lightText);
  const legendParts = ['P : Présent', 'E : Excusé', 'A : Absent', 'NC : Non convoqué'];
  if (hasCpr) legendParts.push('C : CPR');
  legendParts.push('D : Diffusion');
  doc.text(legendParts.join('  |  '), M.left, cursor.y);
  cursor.y += 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. TEXTE LEGAL
  // ═══════════════════════════════════════════════════════════════════════════

  if (showLegalText) {
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

  // Saut de page apres la liste des intervenants
  doc.addPage();
  cursor.y = M.top;

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const rawCategories = crrConfig.categories || [];
  const { sortDate, sortCat } = options || {};
  const categories = sortCat
    ? [...rawCategories].sort((a, b) => sortCat === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    : rawCategories;
  const observations = meeting.observations || [];

  // Statistiques
  // Compteur d'en-tete : total = ouvertes + en cours + faites (obs 'empty'
  // exclues → corrige l'incoherence "18 pour 17 classees"). Source unique.
  const { total: totalObs, open: openObs, inProgress: progObs, done: doneObs } = computeObsStats(observations);
  const statsText = `${totalObs} obs.  |  ${openObs} ouvertes  |  ${progObs} en cours  |  ${doneObs} faites`;

  // Colonne POUR LE conditionnelle : masquee si aucune observation ne porte
  // d'echeance sur ce CR → sa largeur est reversee a la colonne OBSERVATIONS.
  const hasDeadline = observations.some((o) => (o.actionDeadline || '').trim());
  const DEADLINE_W = 16;

  // Largeurs colonnes observations (partagees : header manuel ET corps autoTable)
  const OBS_COL_W = CW - 20 - 18 - 14 - 18 - (hasDeadline ? DEADLINE_W : 0);
  const OBS_COL_W_ARR = [20, 18, OBS_COL_W, 14, 18, ...(hasDeadline ? [DEADLINE_W] : [])];
  const OBS_HEAD_LABELS = ['EMETTEUR', 'DATE', 'OBSERVATIONS', 'STATUT', 'PAR', ...(hasDeadline ? ['POUR LE'] : [])];
  const HEAD_H = 6.5;

  // Bandeau principal OBSERVATIONS + stats (repete en haut de chaque page)
  const drawObsBanner = () => {
    doc.setFillColor(...THEME.primary);
    roundedRect(doc, M.left, cursor.y, CW, 10, 1.5, 'F');
    doc.setFont(fontH, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('OBSERVATIONS', M.left + 5, cursor.y + 7);
    doc.setFont(fontB, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(220, 240, 230);
    doc.text(statsText, PW - M.right - 5, cursor.y + 7, { align: 'right' });
    cursor.y += 13;
  };

  // Ligne de colonnes (EMETTEUR DATE ...), memes largeurs que le corps.
  // Fonds D'ABORD puis textes : en jsPDF doc.text peint avec la couleur de remplissage,
  // l'intercaler entre deux rect contaminerait la couleur des cellules suivantes.
  const drawObsColHeader = () => {
    doc.setFillColor(...lightenRgb(THEME.primary, 0.78));
    doc.setDrawColor(...THEME.borders);
    doc.setLineWidth(0.12);
    const bounds = [];
    let hx = M.left;
    OBS_COL_W_ARR.forEach((w) => { doc.rect(hx, cursor.y, w, HEAD_H, 'FD'); bounds.push([hx, w]); hx += w; });
    doc.setFont(fontH, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...darkenRgb(THEME.primary, 0.1));
    OBS_HEAD_LABELS.forEach((label, i) => {
      const [bx, w] = bounds[i];
      doc.text(label, bx + w / 2, cursor.y + HEAD_H / 2, { align: 'center', baseline: 'middle' });
    });
    cursor.y += HEAD_H;
  };

  const drawObsHeader = () => { drawObsBanner(); drawObsColHeader(); };
  // Saut de page DANS la section observations : repete bandeau + colonnes
  const obsPageBreak = () => { doc.addPage(); cursor.y = M.top; drawObsHeader(); };

  // En-tete initial
  ensureSpace(doc, cursor, 20);
  drawObsHeader();

  // Precharger toutes les images des observations (supporte string ou { src, lat, lng })
  // Les URLs Firebase Storage doivent etre converties en data URL pour jsPDF.
  // Import dynamique Firebase SDK (ne pas casser le lazy-load du module).
  let fbGetBlob, fbRef, fbStorage;
  try {
    const fbMod = await import('firebase/storage');
    fbGetBlob = fbMod.getBlob;
    fbRef = fbMod.ref;
    fbStorage = (await import('../firebase')).storage;
  } catch { /* Firebase non disponible */ }

  const imageCache = new Map();
  const imageGps = new Map();
  for (const obs of observations) {
    for (const imgEntry of (obs.images || [])) {
      const src = typeof imgEntry === 'string' ? imgEntry : imgEntry.src;
      const path = typeof imgEntry === 'object' ? imgEntry.path : null;
      if (!imageCache.has(src) && src) {
        let dataUri = null;

        if (src.startsWith('data:')) {
          dataUri = src;
        } else if (path && fbGetBlob) {
          try {
            const blob = await fbGetBlob(fbRef(fbStorage, path));
            dataUri = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          } catch { /* fallback fetch ci-dessous */ }
        }

        if (!dataUri && !src.startsWith('data:')) {
          try {
            const resp = await fetch(src);
            if (resp.ok) {
              const blob = await resp.blob();
              dataUri = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
              });
            }
          } catch { /* image ignoree */ }
        }

        if (dataUri) {
          const img = await loadImage(dataUri).catch(() => null);
          if (img) imageCache.set(src, { w: img.width, h: img.height, uri: dataUri });
        }
      }
      if (typeof imgEntry === 'object' && imgEntry.lat != null && imgEntry.lng != null) {
        imageGps.set(src, { lat: imgEntry.lat, lng: imgEntry.lng });
      }
    }
  }

  const IMG_ROW_H = 25; // mm par rangee d'images

  // Style d'en-tete (conserve pour le corps autoTable, showHead never)
  const obsHeadStyles = {
    fillColor: lightenRgb(THEME.primary, 0.78),
    textColor: darkenRgb(THEME.primary, 0.1),
    fontStyle: 'bold',
    font: fontH,
    halign: 'center',
    fontSize: 7,
  };
  // Largeurs fixes des colonnes du corps (identiques au header manuel OBS_COL_W_ARR)
  const OBS_COL_STYLES = {
    0: { cellWidth: 20 },
    1: { cellWidth: 18 },
    2: { cellWidth: OBS_COL_W },
    3: { cellWidth: 14 },
    4: { cellWidth: 18 },
    ...(hasDeadline ? { 5: { cellWidth: DEADLINE_W } } : {}),
  };

  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci];
    const rawCatObs = observations.filter((o) => o.category === cat);
    const dateDir = sortDate?.[cat];
    const catObs = dateDir
      ? [...rawCatObs].sort((a, b) => { const da = a.date || ''; const db = b.date || ''; return dateDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da); })
      : rawCatObs;
    const catColor = CAT_COLORS[ci % CAT_COLORS.length];

    // Nouvelle page si le bandeau categorie ne tient pas -> repete bandeau + colonnes obs
    if (cursor.y + 14 > PH - M.bottom) obsPageBreak();

    // Bandeau categorie avec pastille coloree
    doc.setFillColor(...lightenRgb(catColor, 0.88));
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
    doc.setTextColor(...lightenRgb(catColor, 0.3));
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

    // Un autoTable par observation pour garantir que texte + images
    // ne sont jamais séparés par un saut de page.
    const pageBottom = PH - M.bottom;

    catObs.forEach((obs) => {
      let rawText = obs.text || '';
      const obsNum = obsDisplayNumber(obs, crrConfig.categoryCodes);
      // Report CR nXX uniquement dans l'aperçu, pas dans le PDF
      const plainText = stripHtml(rawText);
      // Texte mis en forme (gras/puces/souligne/fluo) → rendu par le calque
      // (didDrawCell). Dans ce cas on NE donne PAS le texte brut a autoTable :
      // sinon autoTable l'imprime ET le calque le redessine = double rendu.
      // La hauteur reste garantie par minCellHeight (didParseCell). hasFormatting
      // est calcule UNE fois ici et partage via meta → zero divergence brut/calque.
      let hasFormatting = false;
      try {
        const segs = parseObsHtml(rawText);
        hasFormatting = segs.some(s => s.bold || s.underline || s.strike || s.highlight || s.indent || s.bullet);
      } catch { hasFormatting = false; }
      const cellText = hasFormatting ? '' : plainText;
      const imgs = (obs.images || []).map(e => typeof e === 'string' ? e : e.src).filter(u => imageCache.has(u));

      const obsBody = [];
      const obsRowMeta = [];

      obsBody.push(['', formatDateFr(obs.date), cellText, '', '', ...(hasDeadline ? [formatDateFr(obs.actionDeadline)] : [])]);
      obsRowMeta.push({ obs, type: 'text', rawText, hasFormatting, emitter: obs.emitter || '', actionBy: obs.actionBy || '' });

      if (imgs.length > 0) {
        obsBody.push(['', '', '', '', '', ...(hasDeadline ? [''] : [])]);
        obsRowMeta.push({ obs, type: 'images', imgs });
      }

      // Mesurer la hauteur réelle du texte via jsPDF splitTextToSize
      doc.setFont(fontB, 'normal');
      doc.setFontSize(6.5);
      const obsColUsable = OBS_COL_W - 3.5; // padding left+right
      const splitLines = doc.splitTextToSize(plainText, obsColUsable);
      // Hauteur de ligne jsPDF : fontSize(pt) / 72 * 25.4 * lineHeightFactor(1.15) ≈ 2.63mm
      const lineH = (6.5 / 72) * 25.4 * 1.15;
      // cellPadding top:2 + bottom:2 = 4mm + marge securite (+ bande numero)
      const textH = Math.max(12, splitLines.length * lineH + 6) + (obsNum ? NUM_BAND : 0);
      let imgH = 0;
      if (imgs.length === 1) {
        const cached = imageCache.get(imgs[0]);
        if (cached) {
          const w = OBS_COL_W - 4;
          imgH = Math.min(w / (cached.w / cached.h) + 4, 70);
        }
      } else if (imgs.length > 1) {
        const slotW = (OBS_COL_W - 6) / 2;
        for (let i = 0; i < imgs.length; i += 2) {
          let rh = IMG_ROW_H;
          for (let j = 0; j < 2 && i + j < imgs.length; j++) {
            const c = imageCache.get(imgs[i + j]);
            if (c) rh = Math.max(rh, Math.min(slotW / (c.w / c.h) + 2, 50));
          }
          imgH += rh;
        }
        imgH += 2;
      }
      const estH = textH + imgH;

      // Saut de page si l'observation ne rentre pas -> repete bandeau + colonnes obs
      if (cursor.y + estH > pageBottom && cursor.y > M.top + 20) {
        obsPageBreak();
      }

    autoTable(doc, {
      startY: cursor.y,
      margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
      tableWidth: CW,
      rowPageBreak: 'auto',
      head: [],
      showHead: 'never',
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
        0: { cellWidth: OBS_COL_STYLES[0].cellWidth, halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: catColor },
        1: { cellWidth: OBS_COL_STYLES[1].cellWidth, halign: 'center', valign: 'middle', textColor: THEME.lightText },
        2: { cellWidth: OBS_COL_STYLES[2].cellWidth },
        3: { cellWidth: OBS_COL_STYLES[3].cellWidth, halign: 'center', valign: 'middle' },
        4: { cellWidth: OBS_COL_STYLES[4].cellWidth, halign: 'center', valign: 'middle', fontStyle: 'bold' },
        ...(hasDeadline ? { 5: { cellWidth: OBS_COL_STYLES[5].cellWidth, halign: 'center', valign: 'middle', textColor: THEME.lightText } } : {}),
      },
      alternateRowStyles: {
        fillColor: [250, 252, 254],
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const meta = obsRowMeta[data.row.index];
        if (!meta) return;
        const obs = meta.obs;

        // Date : grise quand elle egale la date de la reunion (valeur constante,
        // pas une donnee) ; noire et grasse quand l'observation vient d'un CR
        // anterieur → le contraste redevient un signal.
        if (meta.type === 'text' && data.column.index === 1 && obs.date && meeting.date && obs.date !== meeting.date) {
          data.cell.styles.textColor = THEME.text;
          data.cell.styles.fontStyle = 'bold';
        }

        // Reserve une bande haute dans la cellule observation pour le numero.
        // Fait AVANT la mesure de hauteur du texte formate (qui relit padTop).
        if (meta.type === 'text' && data.column.index === 2 && obsNum) {
          const pad = data.cell.styles.cellPadding;
          const base = (pad && typeof pad === 'object')
            ? pad
            : { top: pad ?? 2, right: pad ?? 1.5, bottom: pad ?? 2, left: pad ?? 2 };
          data.cell.styles.cellPadding = { ...base, top: (base.top ?? 2) + NUM_BAND };
        }

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

        // Hauteur minimale pour texte formate (gras/puces = plus de lignes)
        if (meta.type === 'text' && data.column.index === 2 && meta.hasFormatting) {
          try {
            const segments = parseObsHtml(meta.rawText);
            {
              const colW = data.cell.width || OBS_COL_W;
              const pad = data.cell.styles.cellPadding;
              const padL = (typeof pad === 'object' ? pad.left : pad) || 2;
              const padR = (typeof pad === 'object' ? pad.right : pad) || 1.5;
              const maxW = colW - padL - padR;
              const fontSize = data.cell.styles.fontSize || 6.5;
              const fLineH = fontSize * 0.45;
              doc.setFont(fontB, 'normal');
              doc.setFontSize(fontSize);
              const bulletIndent = doc.getTextWidth('• ');
              let curX = 0;
              let lineCount = 1;
              let activeIndent = 0;
              for (const seg of segments) {
                doc.setFont(fontB, seg.bold ? 'bold' : 'normal');
                doc.setFontSize(fontSize);
                if (seg.bullet) {
                  activeIndent = bulletIndent;
                } else if (seg.indent > 0) {
                  activeIndent = seg.indent * bulletIndent;
                }
                const lineMaxW = maxW - activeIndent;
                const sLines = seg.text.split('\n');
                for (let li = 0; li < sLines.length; li++) {
                  if (li > 0) { curX = 0; lineCount++; }
                  const words = sLines[li].split(/(\s+)/);
                  for (const word of words) {
                    if (!word) continue;
                    const ww = doc.getTextWidth(word);
                    if (curX + ww > lineMaxW && word.trim()) { curX = 0; lineCount++; }
                    curX += ww;
                  }
                }
                if (!seg.indent && !seg.bullet) activeIndent = 0;
              }
              const padT = (typeof pad === 'object' ? pad.top : pad) || 2;
              const padB = (typeof pad === 'object' ? pad.bottom : pad) || 2;
              const formattedH = lineCount * fLineH + padT + padB + fontSize * 0.3;
              data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight || 0, formattedH);
            }
          } catch { /* fallback : autoTable calcule seul */ }
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

        // Ligne images : hauteur pour contenir les photos
        if (meta.type === 'images') {
          const { imgs } = meta;
          if (imgs.length === 1) {
            const cached = imageCache.get(imgs[0]);
            if (cached) {
              const colW = data.cell.width || 80;
              const imgW = colW - 4;
              const imgH = imgW / (cached.w / cached.h);
              data.cell.styles.minCellHeight = Math.min(imgH + 4, 70);
            } else {
              data.cell.styles.minCellHeight = IMG_ROW_H;
            }
          } else {
            const colW = data.cell.width || 80;
            const slotW = (colW - 6) / 2;
            // Calculer la hauteur max par rangée de 2
            let totalH = 0;
            for (let i = 0; i < imgs.length; i += 2) {
              let rowH = IMG_ROW_H;
              for (let j = 0; j < 2 && i + j < imgs.length; j++) {
                const c = imageCache.get(imgs[i + j]);
                if (c) {
                  const h = slotW / (c.w / c.h);
                  rowH = Math.max(rowH, Math.min(h + 2, 50));
                }
              }
              totalH += rowH;
            }
            data.cell.styles.minCellHeight = totalH + 2;
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const meta = obsRowMeta[data.row.index];
        if (!meta) return;

        // Fusionner visuellement ligne texte et ligne images (effacer bordure entre)
        const getFill = (obs) =>
          obs.status === 'done' ? THEME.doneBg
          : obs.status === 'in_progress' ? THEME.progressBg
          : (data.row.index % 2 === 0 ? [255, 255, 255] : [250, 252, 254]);

        if (meta.type === 'text') {
          const nextMeta = obsRowMeta[data.row.index + 1];
          if (nextMeta?.type === 'images') {
            const fill = getFill(meta.obs);
            doc.setFillColor(...fill);
            doc.rect(data.cell.x + 0.06, data.cell.y + data.cell.height - 0.12, data.cell.width - 0.12, 0.24, 'F');
          }
        }
        if (meta.type === 'images') {
          const fill = getFill(meta.obs);
          doc.setFillColor(...fill);
          doc.rect(data.cell.x + 0.06, data.cell.y - 0.12, data.cell.width - 0.12, 0.24, 'F');
        }

        // Dessiner les images dans la colonne observations
        if (meta.type === 'images' && data.column.index === 2) {
          const { imgs } = meta;
          const colW = data.cell.width;
          const cellTop = data.cell.y;
          const cellBottom = data.cell.y + data.cell.height;

          // Lien "Localisation" sous une image si GPS disponible
          const addGpsLink = (src, x, y, w) => {
            const gps = imageGps.get(src);
            if (!gps) return 0;
            const url = `https://www.google.com/maps?q=${gps.lat},${gps.lng}`;
            doc.setFont(fontB, 'italic');
            doc.setFontSize(5.5);
            doc.setTextColor(59, 130, 246);
            const label = 'Localisation';
            const tw = doc.getTextWidth(label);
            doc.textWithLink(label, x + (w - tw) / 2, y, { url });
            doc.setTextColor(...THEME.text);
            return 3;
          };

          if (imgs.length === 1) {
            const cached = imageCache.get(imgs[0]);
            if (cached) {
              const aspect = cached.w / cached.h;
              let imgW = colW - 4;
              let imgH = imgW / aspect;
              const maxH = cellBottom - cellTop - 5;
              if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect; }
              const imgX = data.cell.x + (colW - imgW) / 2;
              const imgY = cellTop + (cellBottom - cellTop - imgH - 4) / 2;
              try { doc.addImage(cached.uri, 'JPEG', imgX, imgY, imgW, imgH); } catch { /* ignore */ }
              addGpsLink(imgs[0], imgX, imgY + imgH + 2, imgW);
            }
          } else {
            const slotW = (colW - 6) / 2;
            let drawY = cellTop + 1;
            for (let i = 0; i < imgs.length; i += 2) {
              let rowH = IMG_ROW_H;
              const pair = [];
              for (let j = 0; j < 2 && i + j < imgs.length; j++) {
                const cached = imageCache.get(imgs[i + j]);
                if (!cached) continue;
                const aspect = cached.w / cached.h;
                let iW = slotW;
                let iH = iW / aspect;
                if (iH > 50) { iH = 50; iW = iH * aspect; }
                pair.push({ cached, imgW: iW, imgH: iH, src: imgs[i + j] });
                rowH = Math.max(rowH, iH + 5);
              }
              pair.forEach((p, j) => {
                const imgX = data.cell.x + 2 + j * (slotW + 2);
                const imgY = drawY + (rowH - p.imgH - 3) / 2;
                if (imgY + p.imgH <= cellBottom + 0.5) {
                  try { doc.addImage(p.cached.uri, 'JPEG', imgX, imgY, p.imgW, p.imgH); } catch { /* ignore */ }
                  addGpsLink(p.src, imgX, imgY + p.imgH + 1.5, p.imgW);
                }
              });
              drawY += rowH;
            }
          }
        }

        // Texte formate (gras, souligne, fluo) dans colonne observation (col 2)
        if (meta.type === 'text' && data.column.index === 2 && meta.hasFormatting) {
          try {
            const segments = parseObsHtml(meta.rawText);
            {
              // autoTable n'a rien imprime dans cette cellule (cellText='') : le
              // calque dessine le texte une seule fois, sans effacement prealable.
              const c = data.cell;
              const pad = c.styles.cellPadding;
              const padL = (typeof pad === 'object' ? pad.left : pad) || 2;
              const padT = (typeof pad === 'object' ? pad.top : pad) || 2;
              const padR = (typeof pad === 'object' ? pad.right : pad) || 1.5;
              const maxW = c.width - padL - padR;
              const fontSize = c.styles.fontSize || 6.5;
              const lineH = fontSize * 0.45;
              // Mesurer la largeur réelle de "• " pour aligner le retrait
              doc.setFont(fontB, 'normal');
              doc.setFontSize(fontSize);
              const bulletIndent = doc.getTextWidth('• ');
              let curX = c.x + padL;
              let curY = c.y + padT + fontSize * 0.3;
              const txtColor = Array.isArray(c.styles.textColor) ? c.styles.textColor : THEME.text;
              const cellBottom = c.y + c.height - 1;
              let overflow = false;
              let activeIndent = 0; // retrait actif pour lignes wrappées

              for (const seg of segments) {
                if (overflow) break;
                const style = seg.bold ? 'bold' : 'normal';
                doc.setFont(fontB, style);
                doc.setFontSize(fontSize);
                doc.setTextColor(...txtColor);

                // Mettre à jour le retrait actif
                // bullet "• " → se place à gauche (pas d'indent), active le retrait pour la suite
                // indent > 0 = contenu d'un <li> → wrapping indenté
                if (seg.bullet) {
                  // Le bullet s'aligne toujours à gauche
                  activeIndent = bulletIndent;
                  curX = c.x + padL;
                } else if (seg.indent > 0) {
                  activeIndent = seg.indent * bulletIndent;
                }

                // Decouper le segment en lignes puis en mots pour le word-wrap
                const lines = seg.text.split('\n');
                for (let li = 0; li < lines.length; li++) {
                  if (overflow) break;
                  if (li > 0) { curX = c.x + padL + activeIndent; curY += lineH; }
                  const words = lines[li].split(/(\s+)/);
                  for (const word of words) {
                    const ww = doc.getTextWidth(word);
                    if (curX + ww > c.x + padL + maxW && word.trim()) {
                      curX = c.x + padL + activeIndent;
                      curY += lineH;
                    }
                    if (curY > cellBottom) { overflow = true; break; }

                    if (seg.highlight) {
                      doc.setFillColor(253, 230, 138); // amber-200
                      doc.rect(curX, curY - fontSize * 0.28, ww, fontSize * 0.38, 'F');
                    }
                    doc.text(word, curX, curY);
                    if (seg.underline) {
                      doc.setDrawColor(...txtColor);
                      doc.setLineWidth(0.15);
                      doc.line(curX, curY + 0.5, curX + ww, curY + 0.5);
                    }
                    if (seg.strike) {
                      doc.setDrawColor(...txtColor);
                      doc.setLineWidth(0.15);
                      doc.line(curX, curY - 0.7, curX + ww, curY - 0.7);
                    }
                    curX += ww;
                  }
                }
                // Quand on sort d'un segment non-indenté, reset le retrait
                if (!seg.indent && !seg.bullet) activeIndent = 0;
              }
            }
          } catch { /* fallback: autoTable texte brut deja dessine */ }
        }

        // Numero stable de l'observation (CHANTIER.04), en gras dans la bande
        // haute reservee — dessine APRES le texte formate (jamais efface).
        if (meta.type === 'text' && data.column.index === 2 && obsNum) {
          doc.setFont(fontH, 'bold');
          doc.setFontSize(6);
          doc.setTextColor(...catColor);
          doc.text(obsNum, data.cell.x + 2, data.cell.y + 3);
          // Age (depuis CR n°X) a droite de la bande haute — discret, factuel.
          const age = obsAge(obs, meeting.number);
          if (age >= 1) {
            doc.setFont(fontB, 'italic');
            doc.setFontSize(5);
            doc.setTextColor(...THEME.lightText);
            doc.text(`depuis CR n°${obs.originMeetingNumber}`, data.cell.x + data.cell.width - 2, data.cell.y + 3, { align: 'right' });
          }
          doc.setTextColor(...THEME.text);
        }

        // Pastilles groupes emetteur (col 0) et actionBy (col 4)
        if (meta.type === 'text' && data.column.index === 0) {
          drawGroupBadges(doc, data.cell, meta.emitter, groupIndexMap, badgeNameMap, fontH);
        }
        if (meta.type === 'text' && data.column.index === 4) {
          drawGroupBadges(doc, data.cell, meta.actionBy, groupIndexMap, badgeNameMap, fontH);
        }

        // Badge statut (lignes texte uniquement)
        if (meta.type === 'text' && data.column.index === 3) {
          const obs = meta.obs;
          if (obs.status === 'done') {
            drawBadge(doc, data.cell, 'FAIT', [180, 230, 200], [15, 100, 55], fontH);
          } else if (obs.status === 'in_progress') {
            drawBadge(doc, data.cell, 'En cours', [185, 215, 250], [20, 70, 150], fontH);
          } else if (obs.status !== 'empty') {
            // Etat par defaut : encre minimale (texte gris sans pastille) —
            // la couleur signale ce qui a change (En cours / FAIT), pas la norme
            doc.setFont(fontB, 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(120, 128, 140);
            doc.text('Ouvert', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
          }
        }
      },
      didDrawPage: () => { cursor.y = M.top; },
    });

    cursor.y = doc.lastAutoTable.finalY;
    }); // fin forEach obs

    cursor.y += 3;
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
      doc.text(fitTextToWidth(doc, branding.companyName, CW / 2 - 5), M.left, footY + 1);
    }

    // Centre : titre du projet seul (tronque a la largeur disponible)
    doc.setFont(fontB, 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...THEME.lightText);
    doc.text(fitTextToWidth(doc, pdfProjectName, CW - 76), PW / 2, footY + 1, { align: 'center' });

    // Droite : pagination en gras (la ou l'oeil la cherche) + date d'edition discrete
    doc.setFont(fontH, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...THEME.text);
    const pageTxt = `Page ${p}/${totalPages}`;
    const pageW = doc.getTextWidth(pageTxt);
    doc.text(pageTxt, PW - M.right, footY + 1, { align: 'right' });
    doc.setFont(fontB, 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...THEME.lightText);
    doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}  ·`, PW - M.right - pageW - 2, footY + 1, { align: 'right' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SAUVEGARDE
  // ═══════════════════════════════════════════════════════════════════════════

  // Nom de fichier : priorite au parametre options.filename, sinon pattern par defaut
  let filename;
  if (options?.filename) {
    filename = options.filename;
  } else {
    const safeName = sanitizeFilename(projectName || 'PROJET').toUpperCase();
    const crNum = String(meeting.number).padStart(2, '0');
    filename = `CR_${crNum}_${safeName}_${meeting.date || 'ND'}.pdf`;
  }

  stampPdfCredit(doc);

  // Si returnBlob, retourner le blob + filename sans telecharger
  if (options?.returnBlob) {
    const blob = doc.output('blob');
    return { blob, filename };
  }

  doc.save(filename);
};
