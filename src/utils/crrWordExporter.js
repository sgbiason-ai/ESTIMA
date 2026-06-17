// src/utils/crrWordExporter.js
//
// Export Word (.doc) d'un Compte Rendu de Reunion.
// Genere un document HTML avec styles inline que Word ouvre nativement.

import { MEETING_TYPES, computeObsStats } from '../data/crrData';
import { obsTextToHtml } from './formatObsText.jsx';

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

const statusColor = (s) =>
  s === 'done' ? '#16783c' : s === 'in_progress' ? '#1e5aaa' : '#be6e14';

const statusBg = (s) =>
  s === 'done' ? '#e8faf0' : s === 'in_progress' ? '#e6f2ff' : '#fff7e6';

export const generateWordCrr = (meeting, crrConfig, projectName = '', branding = {}, options = {}) => {
  if (!meeting) return;

  const primary = branding?.colors?.primary || '#286E55';
  const typeLabel = MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  const pdfProjectName = (projectName || 'PROJET').toUpperCase();
  const groups = crrConfig.participantGroups || [];
  const { sortDate, sortCat } = options || {};
  const rawCategories = crrConfig.categories || [];
  const categories = sortCat
    ? [...rawCategories].sort((a, b) => sortCat === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    : rawCategories;
  const observations = meeting.observations || [];

  // ── Construction du HTML ──
  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #282828; margin: 40px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #d2dae2; padding: 4px 6px; font-size: 9pt; }
  th { background-color: #e8f5ee; color: ${primary}; font-weight: bold; text-align: center; font-size: 8pt; }
  .header { background-color: #f0f7f3; padding: 12px 16px; border-left: 4px solid ${primary}; margin-bottom: 8px; }
  .project { text-align: center; font-size: 16pt; font-weight: bold; color: ${primary}; margin: 16px 0 8px; }
  .separator { border: none; border-top: 2px solid ${primary}; width: 60%; margin: 4px auto 16px; }
  .next-meeting { background-color: #fff5e6; border-left: 4px solid #e68214; padding: 8px 14px; margin: 10px 0; }
  .section-title { background-color: ${primary}; color: white; padding: 6px 14px; font-weight: bold; font-size: 10pt; margin: 14px 0 0; }
  .cat-banner { background-color: #e8f5ee; border-left: 4px solid ${primary}; padding: 4px 12px; font-weight: bold; color: ${primary}; margin: 8px 0 2px; }
  .status-badge { padding: 2px 6px; border-radius: 3px; font-size: 8pt; font-weight: bold; }
  .legal { background-color: #f8f9fc; border: 1px solid #d2dae2; padding: 8px 12px; font-size: 7pt; font-style: italic; color: #64748b; margin: 10px 0; border-radius: 4px; }
  .footer { border-top: 1px solid #d2dae2; padding-top: 8px; margin-top: 20px; font-size: 8pt; color: #64748b; }
  .present { background-color: #e8faf0; }
  .excused { background-color: #fff7e6; }
  .done-row { background-color: #edfcf4; }
  .progress-row { background-color: #ebf5ff; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .obs-img { max-width: 45%; max-height: 120px; margin: 4px 2px 0 0; }
</style>
</head>
<body>`;

  // En-tete
  html += `
<div class="header">
  <div style="font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">${typeLabel.toUpperCase()}</div>
  <div style="font-size: 20pt; font-weight: bold; color: ${primary};">N ${meeting.number}</div>
  <div style="font-size: 9pt; color: #64748b;">Date : ${formatDate(meeting.date)}</div>
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
    <th style="width:20%">ROLE / INTERVENANT</th>
    <th style="width:14%">LABEL</th>
    <th style="width:16%">CONTACT</th>
    <th style="width:26%">EMAIL</th>
    <th style="width:8%">CPR</th>
    <th style="width:8%">PRES.</th>
    <th style="width:8%">DIFF.</th>
  </tr></thead><tbody>`;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const rowBg = gi % 2 === 0 ? '#ffffff' : '#fafcfe';
    if (group.contacts.length === 0) {
      html += `<tr style="background:#f8fafb"><td colspan="7" style="font-weight:bold;color:${primary}">${group.name}${group.subLabel ? ` : ${group.subLabel}` : ''}</td></tr>`;
    } else {
      group.contacts.forEach((contact, ci) => {
        const att = meeting.attendance?.[contact.id] || 'absent';
        const diff = meeting.diffusion?.[contact.id] || false;
        html += `<tr style="background-color:${rowBg}">`;
        if (ci === 0) {
          html += `<td rowspan="${group.contacts.length}" style="font-weight:bold;vertical-align:middle">${group.name}${group.subLabel ? `<br><span style="font-size:8pt;color:#64748b">${group.subLabel}</span>` : ''}</td>`;
        }
        html += `<td style="font-size:8pt;color:#64748b">${contact.subLabel || ''}</td>`;
        html += `<td>${contact.name || ''}</td>`;
        html += `<td style="color:#1e50a0;font-size:8pt">${contact.email || ''}${contact.phone ? `<br><span style="color:#94a3b8;font-size:7pt">${contact.phone}</span>` : ''}</td>`;
        html += `<td style="text-align:center">${contact.cpr ? `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7pt;font-weight:bold;background:${primary}22;color:${primary}">C</span>` : ''}</td>`;
        const presColor = att === 'present' ? '#16823c' : att === 'excused' ? '#b47814' : att === 'not_summoned' ? '#a855f7' : '#a0aab4';
        const presLetter = att === 'present' ? 'P' : att === 'excused' ? 'E' : att === 'not_summoned' ? 'NC' : 'A';
        const presCell = att === 'absent'
          ? `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:8pt;font-weight:bold;background:#dc2626;color:#ffffff">A</span>`
          : `<span style="color:${presColor}">${presLetter}</span>`;
        html += `<td style="text-align:center;font-weight:bold;font-size:8pt">${presCell}</td>`;
        html += `<td style="text-align:center">${diff ? '<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7pt;font-weight:bold;background:#e6f2ff;color:#1e5aaa">D</span>' : ''}</td>`;
        html += `</tr>`;
      });
    }
  }
  html += `</tbody></table>`;
  html += `<div style="font-size:7pt;font-style:italic;color:#94a3b8;margin:3px 0 8px">P : Présent &nbsp;|&nbsp; E : Excusé &nbsp;|&nbsp; A : Absent &nbsp;|&nbsp; NC : Non convoqué &nbsp;|&nbsp; C : CPR &nbsp;|&nbsp; D : Diffusion</div>`;

  // Texte legal
  if (crrConfig.legalText) {
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
    <th style="width:11%">POUR LE</th>
  </tr></thead></table>`;

  for (const cat of categories) {
    const rawCatObs = observations.filter((o) => o.category === cat);
    const dateDir = sortDate?.[cat];
    const catObs = dateDir
      ? [...rawCatObs].sort((a, b) => { const da = a.date || ''; const db = b.date || ''; return dateDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da); })
      : rawCatObs;
    html += `<div class="cat-banner">${cat.toUpperCase()} <span style="float:right;font-weight:normal;font-size:8pt">${catObs.length} observation${catObs.length > 1 ? 's' : ''}</span></div>`;

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
        imgHtml = '<br>' + images.map(src => `<img src="${src}" class="obs-img">`).join('');
      }

      html += `<tr class="${rowClass}">`;
      html += `<td style="width:11%;text-align:center;font-weight:bold;color:${primary}">${obs.emitter || ''}</td>`;
      html += `<td style="width:10%;text-align:center;color:#64748b">${formatDate(obs.date)}</td>`;
      html += `<td>${obsTextToHtml(obs.text)}${imgHtml}</td>`;
      html += `<td style="width:10%;text-align:center"><span class="status-badge" style="background:${statusBg(obs.status)};color:${statusColor(obs.status)}">${statusLabel(obs.status)}</span></td>`;
      html += `<td style="width:13%;text-align:center;font-weight:bold">${obs.actionBy || ''}</td>`;
      html += `<td style="width:11%;text-align:center;color:#64748b">${formatDate(obs.actionDeadline)}</td>`;
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
