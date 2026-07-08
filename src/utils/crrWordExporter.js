// src/utils/crrWordExporter.js
//
// Export Word (.doc) d'un Compte Rendu de Reunion.
// Genere un document HTML avec styles inline que Word ouvre nativement.

import { MEETING_TYPES, GROUP_COLORS, abbreviateGroup, computeObsStats, obsDisplayNumber, obsAge } from '../data/crrData';
import { obsTextToHtml } from './formatObsText.jsx';
import { ESTIMA_CREDIT, isEstimaCreditEnabled } from './estimaCredit';
import { groupColorIndexMap, groupBadgeNameMap } from './crrParticipantTree';

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
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .substring(0, 60);
};

const statusLabel = (s) =>
  s === 'done' ? 'FAIT' : s === 'in_progress' ? 'En cours' : s === 'empty' ? '' : 'Ouvert';

// Teintes de statut alignees sur les pastilles du PDF (pdfCrrGenerator.js)
const statusColor = (s) =>
  s === 'done' ? '#0f6437' : s === 'in_progress' ? '#144696' : '#be6e14';

const statusBg = (s) =>
  s === 'done' ? '#b4e6c8' : s === 'in_progress' ? '#b9d7fa' : '#fff7e6';

const rgb = (values) => `rgb(${values.join(',')})`;

const darken = (values, factor = 0.75) => values.map((v) => Math.round(v * factor));

const lighten = (values, factor = 0.88) => values.map((v) => Math.round(v + (255 - v) * factor));

// Couleurs tournantes par categorie — identiques au PDF (pdfCrrGenerator.js)
const CAT_COLORS = [
  [40, 110, 85],   // emerald (primary)
  [37, 99, 175],   // blue
  [124, 58, 170],  // purple
  [210, 120, 20],  // orange
  [71, 85, 105],   // slate
  [170, 140, 20],  // amber
];

const parseBadgeNames = (value) =>
  (value || '').split(',').map((s) => s.trim()).filter(Boolean);

const flattenContacts = (group) => [
  ...(group.contacts || []),
  ...(group.subGroups || []).flatMap((sg) => sg.contacts || []),
];

const renderGroupBadges = (value, groupIndexMap, badgeNameMap) => {
  const names = parseBadgeNames(value);
  if (names.length === 0) return '';

  return names.map((name) => {
    const idx = groupIndexMap[name] ?? 0;
    const c = GROUP_COLORS[idx % GROUP_COLORS.length];
    const abbr = abbreviateGroup(badgeNameMap?.[name] || name);
    return `<span style="display:inline-block;min-width:28px;margin:1px 0;padding:1px 5px;border-radius:7px;background:${rgb(c.rgbBg)};color:${rgb(c.rgb)};font-size:6pt;font-weight:bold;white-space:nowrap"><span style="font-size:6pt;color:${rgb(c.rgb)}">&#9679;</span>&nbsp;${abbr}</span>`;
  }).join('<br>');
};

const renderStatus = (status) => {
  if (status === 'empty') return '';
  if (status === 'done' || status === 'in_progress') {
    return `<span class="status-badge" style="background:${statusBg(status)};color:${statusColor(status)}">${statusLabel(status)}</span>`;
  }
  return '<span style="font-size:8pt;color:#78808c">Ouvert</span>';
};

export const generateWordCrr = (meeting, crrConfig, projectName = '', branding = {}, options = {}) => {
  if (!meeting) return;

  const primary = branding?.colors?.primary || '#286E55';
  const typeLabel = MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  const showLegalText = meeting.type === 'chantier' && !!crrConfig.legalText;
  const pdfProjectName = (projectName || 'PROJET').toUpperCase();
  const groups = crrConfig.participantGroups || [];
  const { sortDate, sortCat } = options || {};
  const rawCategories = crrConfig.categories || [];
  const categories = sortCat
    ? [...rawCategories].sort((a, b) => sortCat === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    : rawCategories;
  const observations = meeting.observations || [];
  const groupIndexMap = groupColorIndexMap(groups);
  const badgeNameMap = groupBadgeNameMap(groups);
  const participantContacts = groups.flatMap(flattenContacts);
  const hasLabel = participantContacts.some((c) => (c.subLabel || '').trim());
  const hasCpr = participantContacts.some((c) => c.cpr);
  const partColCount = 6 + (hasLabel ? 1 : 0) + (hasCpr ? 1 : 0);
  const hasDeadline = observations.some((o) => (o.actionDeadline || '').trim());

  // ── Construction du HTML ──
  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0.7cm 1cm; mso-header-margin: 0.3cm; mso-footer-margin: 0.3cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #282828; margin: 0; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #d2dae2; padding: 4px 6px; font-size: 9pt; word-break: break-word; overflow-wrap: anywhere; }
  th { background-color: #e8f5ee; color: ${primary}; font-weight: bold; text-align: center; font-size: 8pt; }
  .header { background-color: #f0f7f3; padding: 12px 16px; border-left: 4px solid ${primary}; margin-bottom: 8px; }
  .project { text-align: center; font-size: 16pt; font-weight: bold; color: ${primary}; margin: 16px 0 8px; }
  .separator { border: none; border-top: 2px solid ${primary}; width: 60%; margin: 4px auto 16px; }
  .next-meeting { background-color: #fff5e6; border-left: 4px solid #e68214; padding: 8px 14px; margin: 10px 0; border-radius: 4px; }
  .section-title { background-color: ${primary}; color: white; padding: 6px 14px; font-weight: bold; font-size: 10pt; margin: 14px 0 0; border-radius: 4px; }
  .cat-banner { background-color: #e8f5ee; border-left: 4px solid ${primary}; padding: 4px 12px; font-weight: bold; color: ${primary}; margin: 8px 0 2px; border-radius: 4px; }
  .status-badge { padding: 2px 7px; border-radius: 7px; font-size: 8pt; font-weight: bold; }
  .legal { background-color: #f8f9fc; border: 1px solid #d2dae2; padding: 8px 12px; font-size: 7pt; font-style: italic; color: #64748b; margin: 10px 0; border-radius: 4px; }
  .footer { border-top: 1px solid #d2dae2; padding-top: 8px; margin-top: 20px; font-size: 8pt; color: #64748b; }
  .present { background-color: #e8faf0; }
  .excused { background-color: #fff7e6; }
  .done-row { background-color: #edfcf4; }
  .progress-row { background-color: #ebf5ff; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .obs-img { max-width: 100%; height: auto; margin: 4px 2px 0 0; }
  .obs-text { font-size: 10.5pt; line-height: 1.25; }
  .logo-band { float: right; background: #ffffff; border-radius: 4px; padding: 6px 10px; text-align: right; }
  .logo-band img { height: 28px; width: auto; max-width: 100px; margin-left: 10px; vertical-align: middle; }
</style>
</head>
<body>`;

  // En-tete
  const logos = [
    crrConfig.chantierInfo?.communeLogo,
    crrConfig.chantierInfo?.communeLogo2,
    crrConfig.chantierInfo?.cotraitantLogo,
    branding?.logo,
  ].filter(Boolean);
  html += `
<div class="header">
  ${logos.length > 0 ? `<div class="logo-band">${logos.map((src) => `<img src="${src}" height="28" alt="" style="height:28px;width:auto;max-width:100px;vertical-align:middle">`).join('')}</div>` : ''}
  <div style="font-size: 8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">${typeLabel.toUpperCase()}</div>
  <div style="margin-top: 3px;"><span style="font-size: 16pt; font-weight: bold; color: ${primary};">N&deg; ${meeting.number}</span> <span style="font-size: 10pt; color: #94a3b8;">&mdash;&nbsp;${formatDate(meeting.date)}</span></div>
  <div style="clear:both"></div>
</div>
<div class="project">${pdfProjectName}</div>
<hr class="separator">`;

  // Prochaine reunion
  if (meeting.nextMeeting?.date || meeting.nextMeeting?.lieu) {
    const parts = [];
    if (meeting.nextMeeting.lieu) parts.push(meeting.nextMeeting.lieu);
    if (meeting.nextMeeting.heure) parts.push(`a ${meeting.nextMeeting.heure}`);
    if (meeting.nextMeeting.date) parts.push(`le ${formatDateLong(meeting.nextMeeting.date)}`);
    html += `
<div class="next-meeting">
  <div style="font-size: 8pt; font-weight: bold; color: #b45a0a;">PROCHAINE REUNION</div>
  <div style="font-size: 10pt; font-weight: bold; color: #c8500a;">${parts.join('  --  ')}</div>
</div>`;
  }

  // Participants
  html += `<div class="section-title">PARTICIPANTS</div>`;
  html += `<table><thead><tr>
    <th style="width:18%">ROLE / INTERVENANT</th>
    <th style="width:6%"></th>
    ${hasLabel ? '<th style="width:11%">LABEL</th>' : ''}
    <th style="width:30%">CONTACT</th>
    <th style="width:25%">EMAIL</th>
    ${hasCpr ? '<th style="width:4%">CPR</th>' : ''}
    <th style="width:4.5%">PRES.</th>
    <th style="width:4.5%">DIFF.</th>
  </tr></thead><tbody>`;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const rowBg = gi % 2 === 0 ? '#ffffff' : '#fafcfe';
    const gc = GROUP_COLORS[gi % GROUP_COLORS.length];
    // Lignes du groupe : contacts directs, puis bandeau + contacts par sous-groupe
    const rows = [
      ...(group.contacts || []).map((c) => ({ type: 'contact', contact: c })),
      ...(group.subGroups || []).flatMap((sg) => [
        { type: 'sub', sg },
        ...(sg.contacts || []).map((c) => ({ type: 'contact', contact: c })),
      ]),
    ];
    // Blocs de label : contacts consecutifs de meme label → 1 pastille fusionnee
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.type !== 'contact') continue;
      const prev = rows[i - 1];
      const same = prev && prev.type === 'contact' && (prev.contact.subLabel || '') === (r.contact.subLabel || '');
      if (!same) {
        r.blockStart = true;
        let span = 1;
        for (let j = i + 1; j < rows.length; j++) {
          const nx = rows[j];
          if (nx.type === 'contact' && (nx.contact.subLabel || '') === (r.contact.subLabel || '')) span++;
          else break;
        }
        r.blockSpan = span;
      }
    }
    if (rows.length === 0) {
      html += `<tr style="background:#f8fafb"><td colspan="${partColCount}" style="font-weight:bold;color:${primary}">${group.name}${group.subLabel ? ` : ${group.subLabel}` : ''}</td></tr>`;
    } else {
      rows.forEach((row, ri) => {
        html += `<tr style="background-color:${rowBg}">`;
        if (ri === 0) {
          // Case ROLE/INTERVENANT teintee a la couleur du groupe (rowSpan groupe)
          const roleTxt = rgb(darken(gc.rgb));
          html += `<td rowspan="${rows.length}" style="font-weight:bold;vertical-align:middle;background:${rgb(gc.rgbBg)};color:${roleTxt}">${group.name}${group.subLabel ? `<br><span style="font-size:8pt;color:#64748b">${group.subLabel}</span>` : ''}</td>`;
        }
        // Bandeau sous-groupe : nom + compteur (plus de pastille propre → la
        // pastille par label des contacts en-dessous porte l'abreviation)
        if (row.type === 'sub') {
          const n = (row.sg.contacts || []).length;
          html += `<td colspan="${partColCount - 1}" style="background:${rgb(gc.rgbBg)};color:${rgb(gc.rgb)};font-weight:bold;font-size:8pt;padding-left:8px;text-align:left">${row.sg.name}${n > 0 ? ` (${n})` : ''}</td>`;
          html += `</tr>`;
          return;
        }
        const contact = row.contact;
        // Pastille PAR LABEL (abrev.), couleur du groupe, fusionnee sur le bloc
        if (row.blockStart) {
          const abbr = abbreviateGroup(contact.badgeName || (contact.subLabel || '').trim() || group.name);
          html += `<td rowspan="${row.blockSpan}" style="text-align:center;vertical-align:middle;background:${rgb(gc.rgbBg)}"><span style="display:inline-block;background:#ffffff;color:${rgb(gc.rgb)};border-radius:6px;padding:1px 5px;font-size:6pt;font-weight:bold;white-space:nowrap"><span style="font-size:6pt;color:${rgb(gc.rgb)}">&#9679;</span>&nbsp;${abbr}</span></td>`;
        }
        const att = meeting.attendance?.[contact.id] || 'absent';
        const diff = meeting.diffusion?.[contact.id] || false;
        if (hasLabel) html += `<td style="font-size:8pt;color:#64748b">${contact.subLabel || ''}</td>`;
        html += `<td>${contact.name || ''}${contact.fonction ? `<br><span style="font-size:8pt;color:#64748b">${contact.fonction}</span>` : ''}</td>`;
        html += `<td style="color:#1e50a0;font-size:8pt">${contact.email || ''}${contact.phone ? `<br><span style="color:#94a3b8;font-size:7pt">${contact.phone}</span>` : ''}</td>`;
        if (hasCpr) html += `<td style="text-align:center">${contact.cpr ? `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7pt;font-weight:bold;background:${primary}22;color:${primary}">C</span>` : ''}</td>`;
        // Pastilles uniformes pour les 4 etats (aligne sur le PDF)
        const presPill = ({
          present:      { l: 'P',  txt: '#16824c', bg: '#d4f0e0' },
          excused:      { l: 'E',  txt: '#475569', bg: '#e2e8f0' },
          absent:       { l: 'A',  txt: '#ffffff', bg: '#dc2626' },
          not_summoned: { l: 'NC', txt: '#6b21a8', bg: '#f3e8ff' },
        })[att] || { l: 'A', txt: '#ffffff', bg: '#dc2626' };
        const presCell = `<span style="display:inline-block;min-width:12px;padding:1px 5px;border-radius:7px;font-size:8pt;font-weight:bold;background:${presPill.bg};color:${presPill.txt}">${presPill.l}</span>`;
        html += `<td style="text-align:center">${presCell}</td>`;
        html += `<td style="text-align:center">${diff ? '<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7pt;font-weight:bold;background:#e6f2ff;color:#1e5aaa">D</span>' : ''}</td>`;
        html += `</tr>`;
      });
    }
    // Fine ligne d'espacement entre deux groupes
    if (gi < groups.length - 1) {
      html += `<tr><td colspan="${partColCount}" style="border:none;padding:0;line-height:5px;font-size:5px">&nbsp;</td></tr>`;
    }
  }
  html += `</tbody></table>`;
  html += `<div style="font-size:7pt;font-style:italic;color:#94a3b8;margin:3px 0 8px">P : Présent &nbsp;|&nbsp; E : Excusé &nbsp;|&nbsp; A : Absent &nbsp;|&nbsp; NC : Non convoqué${hasCpr ? ' &nbsp;|&nbsp; C : CPR' : ''} &nbsp;|&nbsp; D : Diffusion</div>`;

  // Texte legal
  if (showLegalText) {
    html += `<div class="legal">${crrConfig.legalText}</div>`;
  }

  // Observations — total = ouvertes + en cours + faites (obs 'empty' exclues). Source unique.
  const { total: totalObs, open: openObs, inProgress: progObs, done: doneObs } = computeObsStats(observations);

  html += `<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
    <span>OBSERVATIONS</span>
    <span style="font-size:8pt;font-weight:normal;opacity:0.8">${totalObs} obs. | ${openObs} ouvertes | ${progObs} en cours | ${doneObs} faites</span>
  </div>`;

  // En-tete colonnes
  html += `<table><thead><tr>
    <th style="width:11%">EMETTEUR</th>
    <th style="width:10%">DATE</th>
    <th>OBSERVATIONS</th>
    <th style="width:10%">STATUT</th>
    <th style="width:13%">PAR</th>
    ${hasDeadline ? '<th style="width:11%">POUR LE</th>' : ''}
  </tr></thead></table>`;

  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci];
    const rawCatObs = observations.filter((o) => o.category === cat);
    const dateDir = sortDate?.[cat];
    const catObs = dateDir
      ? [...rawCatObs].sort((a, b) => { const da = a.date || ''; const db = b.date || ''; return dateDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da); })
      : rawCatObs;
    const catColor = CAT_COLORS[ci % CAT_COLORS.length];
    const catRgb = rgb(catColor);
    const catBgRgb = rgb(lighten(catColor));
    html += `<div class="cat-banner" style="background:${catBgRgb};border-left-color:${catRgb};color:${catRgb}">${cat.toUpperCase()} <span style="float:right;font-weight:normal;font-size:8pt">${catObs.length} observation${catObs.length > 1 ? 's' : ''}</span></div>`;

    if (catObs.length === 0) {
      html += `<div style="text-align:center;color:#94a3b8;font-style:italic;padding:6px;font-size:8pt">Aucune observation</div>`;
      continue;
    }

    html += `<table><tbody>`;
    for (const obs of catObs) {
      const rowClass = obs.status === 'done' ? 'done-row' : obs.status === 'in_progress' ? 'progress-row' : '';
      const images = obs.images || [];
      let imgHtml = '';
      if (images.length > 0) {
        // Largeur fixe (px) : Word ignore les max-width CSS et affiche les images
        // a leur resolution native → on impose une largeur via l'attribut HTML.
        // 1 image = plus large ; 2+ images = plus etroit pour tenir cote a cote.
        const imgW = images.length === 1 ? 230 : 150;
        imgHtml = '<br>' + images.map((entry) => {
          const src = typeof entry === 'string' ? entry : entry.src;
          const gps = typeof entry === 'object' && entry.lat != null && entry.lng != null
            ? `<br><span style="font-size:7pt;color:#64748b">GPS : ${Number(entry.lat).toFixed(6)}, ${Number(entry.lng).toFixed(6)}</span>`
            : '';
          return src ? `<img src="${src}" width="${imgW}" class="obs-img" style="width:${imgW}px;height:auto">${gps}` : '';
        }).join('');
      }
      const obsNum = obsDisplayNumber(obs, crrConfig.categoryCodes);
      const age = obsAge(obs, meeting.number);
      const numHtml = obsNum
        ? `<div style="font-size:7pt;font-weight:bold;color:${catRgb};margin-bottom:3px">${obsNum}${age >= 1 ? ` <span style="font-weight:normal;font-style:italic;color:#94a3b8">depuis CR n&deg;${obs.originMeetingNumber ?? (meeting.number - age)}</span>` : ''}</div>`
        : '';
      const dateStyle = obs.date && meeting.date && obs.date !== meeting.date
        ? 'color:#1f2937;font-weight:bold'
        : 'color:#64748b';

      html += `<tr class="${rowClass}">`;
      html += `<td style="width:11%;text-align:center;vertical-align:middle">${renderGroupBadges(obs.emitter, groupIndexMap, badgeNameMap)}</td>`;
      html += `<td style="width:10%;text-align:center;vertical-align:middle;${dateStyle}">${formatDate(obs.date)}</td>`;
      html += `<td class="obs-text">${numHtml}${obsTextToHtml(obs.text)}${imgHtml}</td>`;
      html += `<td style="width:10%;text-align:center;vertical-align:middle">${renderStatus(obs.status)}</td>`;
      html += `<td style="width:13%;text-align:center;vertical-align:middle">${renderGroupBadges(obs.actionBy, groupIndexMap, badgeNameMap)}</td>`;
      if (hasDeadline) html += `<td style="width:11%;text-align:center;vertical-align:middle;color:#64748b">${formatDate(obs.actionDeadline)}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  }

  // Footer
  html += `
<div class="footer" style="display:flex;justify-content:space-between">
  <span style="font-weight:bold;color:${primary}">${branding?.companyName || ''}</span>
  <span>${pdfProjectName}</span>
  <span>Edite le ${new Date().toLocaleDateString('fr-FR')}</span>
</div>
${isEstimaCreditEnabled() ? `<div style="text-align:center;color:#aaaaaa;font-size:9px;font-style:italic;margin-top:6px">${ESTIMA_CREDIT}</div>` : ''}
</body></html>`;

  // Telechargement
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });

  // Nom de fichier : priorite au parametre options.filename
  let filename;
  if (options.filename) {
    filename = options.filename;
  } else {
    const safeName = sanitizeFilename(projectName || 'PROJET').toUpperCase();
    const crNum = String(meeting.number).padStart(2, '0');
    filename = `CR_${crNum}_${safeName}_${meeting.date || 'ND'}.doc`;
  }

  // Si returnBlob, on rend le blob a l'appelant (qui gere download + archive)
  if (options.returnBlob) {
    return { blob, filename };
  }

  // Sinon comportement legacy : essayer dossier puis fallback download
  if (options.dirHandle && options.saveToDirectory) {
    options.saveToDirectory(options.dirHandle, filename, blob).then((saved) => {
      if (!saved) fallbackDownload(blob, filename);
    }).catch(() => fallbackDownload(blob, filename));
    return;
  }

  fallbackDownload(blob, filename);
};

const fallbackDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
