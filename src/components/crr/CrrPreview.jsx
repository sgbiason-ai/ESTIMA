// src/components/crr/CrrPreview.jsx
//
// Apercu du compte rendu fidele au rendu PDF moderne.

import React from 'react';
import { MEETING_TYPES, OBSERVATION_STATUSES, GROUP_COLORS, abbreviateGroup, computeObsStats, obsDisplayNumber, obsAge } from '../../data/crrData';
import { renderFormattedText } from '../../utils/formatObsText.jsx';
import { formatDateFr, formatDateLong } from '../../utils/dateHelpers';
import { lightenHex } from '../../utils/colorHelpers';
import { groupColorIndexMap, groupBadgeNameMap } from '../../utils/crrParticipantTree';

const CAT_COLORS = [
  { r: 40, g: 110, b: 85 },   // emerald
  { r: 37, g: 99, b: 175 },   // blue
  { r: 124, g: 58, b: 170 },  // purple
  { r: 210, g: 120, b: 20 },  // orange
  { r: 71, g: 85, b: 105 },   // slate (ex-rouge : reserve aux alertes)
  { r: 170, g: 140, b: 20 },  // amber
];

const rgb = (c) => `rgb(${c.r},${c.g},${c.b})`;
const rgbLight = (c, f = 0.88) =>
  `rgb(${Math.round(c.r + (255 - c.r) * f)},${Math.round(c.g + (255 - c.g) * f)},${Math.round(c.b + (255 - c.b) * f)})`;

const flattenContacts = (group) => [
  ...(group.contacts || []),
  ...(group.subGroups || []).flatMap((sg) => sg.contacts || []),
];

const CrrPreview = ({ meeting, crrConfig, projectName, branding, sortDate, sortCat }) => {
  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Selectionnez ou creez un compte rendu pour voir l'apercu
      </div>
    );
  }

  // Map nom (groupe OU sous-groupe) → index couleur pour les pastilles
  const groupIndexMap = groupColorIndexMap(crrConfig.participantGroups);
  const badgeNameMap = groupBadgeNameMap(crrConfig.participantGroups);

  // Rendre les pastilles pour un champ emitter/actionBy (valeur = "MOE, Entreprises")
  const renderBadges = (val) => {
    if (!val) return null;
    const names = val.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <div className="flex flex-col gap-0.5 items-center">
        {names.map((name) => {
          const idx = groupIndexMap[name] ?? 0;
          const c = GROUP_COLORS[idx % GROUP_COLORS.length];
          const abbr = abbreviateGroup(badgeNameMap[name] || name);
          return (
            <span key={name} className="inline-flex items-center justify-center gap-0.5 rounded-full px-1 py-px text-[7px] font-bold leading-none whitespace-nowrap"
              style={{ minWidth: '40px', backgroundColor: `rgb(${c.rgbBg.join(',')})`, color: `rgb(${c.rgb.join(',')})`, border: `0.5px solid rgb(${c.rgb.map((v) => Math.min(255, v + 60)).join(',')})` }}>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: `rgb(${c.rgb.join(',')})` }} />
              {abbr}
            </span>
          );
        })}
      </div>
    );
  };

  const primary = branding?.colors?.primary || '#286E55';
  const secondary = branding?.colors?.secondary || '#32B482';


  const formatDate = formatDateFr;

  const typeLabel = MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  const showLegalText = meeting.type === 'chantier' && !!crrConfig.legalText;
  const groups = crrConfig.participantGroups || [];
  const rawCategories = crrConfig.categories || [];
  const categories = sortCat
    ? [...rawCategories].sort((a, b) => sortCat === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    : rawCategories;
  const observations = meeting.observations || [];
  // Colonne POUR LE masquee si aucune echeance → la largeur va a OBSERVATIONS
  const hasDeadline = observations.some((o) => (o.actionDeadline || '').trim());
  const pdfProjectName = (projectName || 'NOM DU PROJET').toUpperCase();
  const allContacts = groups.flatMap(flattenContacts);
  const hasParticipantLabel = allContacts.some((contact) => (contact.subLabel || '').trim());
  const hasParticipantCpr = allContacts.some((contact) => contact.cpr);
  const participantColumnCount = 6 + (hasParticipantLabel ? 1 : 0) + (hasParticipantCpr ? 1 : 0);
  const participantWidths = {
    role: '16.5%',
    badge: '7.6%',
    label: hasParticipantLabel ? '10.9%' : '0%',
    email: '24%',
    cpr: hasParticipantCpr ? '4.4%' : '0%',
    pres: '4.4%',
    diff: '4.4%',
  };
  const fixedParticipantWidth =
    16.5 + 7.6 + (hasParticipantLabel ? 10.9 : 0) + 24 + (hasParticipantCpr ? 4.4 : 0) + 4.4 + 4.4;
  participantWidths.contact = `${Math.max(24, 100 - fixedParticipantWidth)}%`;
  const logoEntries = [
    crrConfig.chantierInfo?.communeLogo && { src: crrConfig.chantierInfo.communeLogo, alt: 'Logo commune' },
    crrConfig.chantierInfo?.communeLogo2 && { src: crrConfig.chantierInfo.communeLogo2, alt: 'Logo MOA 2' },
    crrConfig.chantierInfo?.cotraitantLogo && { src: crrConfig.chantierInfo.cotraitantLogo, alt: 'Logo cotraitant' },
    branding?.logo && { src: branding.logo, alt: 'Logo MOE' },
  ].filter(Boolean);

  // Stats — total = ouvertes + en cours + faites (obs 'empty' exclues). Source unique.
  const { total: totalObs, open: openObs, inProgress: progObs, done: doneObs } = computeObsStats(observations);

  return (
    <div className="bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.06),0_24px_48px_rgba(0,0,0,0.06)] rounded-sm max-w-[800px] mx-auto my-6 text-[11px] leading-snug relative overflow-hidden transition-all duration-500 ease-out" style={{ color: '#282828' }}>

      {/* Bande laterale gauche decorative */}
      <div className="absolute left-0 top-0 w-[5px] h-[60%] rounded-r-sm" style={{ backgroundColor: primary }} />
      <div className="absolute left-0 top-[60%] w-[5px] h-[40%] rounded-r-sm" style={{ backgroundColor: secondary }} />

      {/* Bande accent en haut */}
      <div className="h-2 w-full" style={{ backgroundColor: primary }} />

      {/* ── EN-TETE ── */}
      <div className="mx-6 mt-5">
        <div className="rounded-lg relative overflow-hidden flex items-center justify-between px-5 py-4" style={{ backgroundColor: lightenHex(primary, 0.92) }}>
          {/* Filet colore gauche */}
          <div className="absolute left-0 top-0 w-[5px] h-full rounded-r" style={{ backgroundColor: primary }} />

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
              {typeLabel.toUpperCase()}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black" style={{ color: primary }}>
                N° {meeting.number}
              </span>
              <span className="text-xs" style={{ color: '#64748b' }}>
                - {formatDate(meeting.date)}
              </span>
            </div>
          </div>

          {logoEntries.length > 0 && (
            <div className="ml-4 flex max-w-[330px] shrink-0 items-center gap-4 rounded-md bg-white px-4 py-2">
              {logoEntries.map((logo) => (
                <img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  className="max-h-12 max-w-[82px] object-contain"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nom du projet */}
      <div className="text-center mt-5 px-6">
        <div className="inline-block max-w-full">
          <div className="text-xl font-black tracking-wide uppercase break-words" style={{ color: primary }}>
            {pdfProjectName}
          </div>
          <div className="mt-2 h-[2px] rounded-full" style={{ backgroundColor: secondary }} />
        </div>
      </div>

      {/* ── PROCHAINE REUNION ── */}
      {(meeting.nextMeeting?.lieu || meeting.nextMeeting?.date) && (
        <div className="mx-6 mt-5">
          <div className="rounded-lg relative overflow-hidden px-5 py-3" style={{ backgroundColor: 'rgb(255,245,230)' }}>
            <div className="absolute left-0 top-0 w-[5px] h-full rounded-r" style={{ backgroundColor: 'rgb(230,130,20)' }} />
            <div className="text-[10px] font-bold uppercase" style={{ color: 'rgb(180,90,10)' }}>
              PROCHAINE REUNION
            </div>
            <div className="text-sm font-bold mt-0.5" style={{ color: 'rgb(200,80,10)' }}>
              {[
                meeting.nextMeeting.lieu,
                meeting.nextMeeting.heure && `a ${meeting.nextMeeting.heure}`,
                meeting.nextMeeting.date && `le ${formatDateLong(meeting.nextMeeting.date)}`,
              ].filter(Boolean).join('  --  ')}
            </div>
          </div>
        </div>
      )}

      {/* ── PARTICIPANTS ── */}
      <div className="mx-6 mt-5">
        {/* Bandeau titre */}
        <div className="rounded-lg px-4 py-2 flex items-center justify-between" style={{ backgroundColor: primary }}>
          <span className="text-white font-bold text-xs tracking-wide">PARTICIPANTS</span>
        </div>

        {/* Tableau */}
        <table className="w-full text-[10px] border-collapse mt-0" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: participantWidths.role }} />
            <col style={{ width: participantWidths.badge }} />
            {hasParticipantLabel && <col style={{ width: participantWidths.label }} />}
            <col style={{ width: participantWidths.contact }} />
            <col style={{ width: participantWidths.email }} />
            {hasParticipantCpr && <col style={{ width: participantWidths.cpr }} />}
            <col style={{ width: participantWidths.pres }} />
            <col style={{ width: participantWidths.diff }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: lightenHex(primary, 0.78) }}>
              <th className="text-center px-2 py-1 border border-slate-200 font-bold" style={{ color: primary }}>ROLE / INTERVENANT</th>
              <th className="text-center px-1 py-1 border border-slate-200 font-bold" style={{ color: primary }}></th>
              {hasParticipantLabel && (
                <th className="text-center px-2 py-1 border border-slate-200 font-bold" style={{ color: primary }}>LABEL</th>
              )}
              <th className="text-center px-2 py-1 border border-slate-200 font-bold" style={{ color: primary }}>CONTACT</th>
              <th className="text-center px-2 py-1 border border-slate-200 font-bold" style={{ color: primary }}>EMAIL</th>
              {hasParticipantCpr && (
                <th className="text-center px-0.5 py-1 border border-slate-200 font-bold text-[7px]" style={{ color: primary }}>CPR</th>
              )}
              <th className="text-center px-0.5 py-1 border border-slate-200 font-bold text-[7px]" style={{ color: primary }}>PRES.</th>
              <th className="text-center px-0.5 py-1 border border-slate-200 font-bold text-[7px]" style={{ color: primary }}>DIFF.</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => {
              const gc = GROUP_COLORS[gi % GROUP_COLORS.length];
              const rgbStr = `rgb(${gc.rgb.join(',')})`;
              const rgbBgStr = `rgb(${gc.rgbBg.join(',')})`;
              const roleColor = `rgb(${gc.rgb.map((v) => Math.round(v * 0.75)).join(',')})`;
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
              return (
              <React.Fragment key={group.id}>
                {rows.length === 0 && (
                  <tr style={{ backgroundColor: lightenHex(primary, 0.96) }}>
                    <td className="px-2 py-1.5 font-bold border border-slate-200" colSpan={participantColumnCount} style={{ color: primary }}>
                      {group.name}{group.subLabel ? ` : ${group.subLabel}` : ''}
                    </td>
                  </tr>
                )}
                {rows.map((row, ri) => {
                  // Col ROLE : rowSpan sur TOUT le groupe, fond couleur du groupe
                  const roleCell = ri === 0 && (
                    <td className="px-2 py-0.5 border border-slate-200 align-middle font-bold text-[10px] leading-tight" rowSpan={rows.length}
                      style={{ backgroundColor: rgbBgStr, color: roleColor }}>
                      {group.name}
                      {group.subLabel && <div className="text-[9px] font-normal text-slate-500">{group.subLabel}</div>}
                    </td>
                  );

                  // Bandeau sous-groupe : nom + compteur, aligne a gauche (plus de pastille propre)
                  if (row.type === 'sub') {
                    const n = (row.sg.contacts || []).length;
                    return (
                      <tr key={`sub-${row.sg.id}`}>
                        {roleCell}
                        <td colSpan={participantColumnCount - 1} className="px-2 py-1 border border-slate-200 font-bold text-[9px] text-left"
                          style={{ backgroundColor: rgbBgStr, color: rgbStr }}>
                          {row.sg.name}{n > 0 ? ` (${n})` : ''}
                        </td>
                      </tr>
                    );
                  }

                  const contact = row.contact;
                  const att = meeting.attendance?.[contact.id] || 'absent';
                  const diff = meeting.diffusion?.[contact.id] || false;
                  // Pastille PAR LABEL : abrev. du label, couleur du groupe, fusionnee sur le bloc
                  const pastilleCell = row.blockStart && (
                    <td className="text-center border border-slate-200 align-middle" rowSpan={row.blockSpan}
                      style={{ backgroundColor: rgbBgStr }}>
                      <span className="inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold"
                        style={{ minWidth: '34px', backgroundColor: 'white', color: rgbStr }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rgbStr }} />
                        {abbreviateGroup(contact.badgeName || (contact.subLabel || '').trim() || group.name)}
                      </span>
                    </td>
                  );
                  return (
                    <tr key={contact.id} style={{ backgroundColor: gi % 2 === 0 ? 'white' : 'rgb(250,252,254)' }}>
                      {roleCell}
                      {pastilleCell}
                      {hasParticipantLabel && (
                        <td className="px-2 py-0.5 border border-slate-200 text-[9px] text-slate-500">{contact.subLabel || ''}</td>
                      )}
                      <td className="px-2 py-0.5 border border-slate-200 leading-tight">
                        <div>{contact.name}</div>
                        {contact.fonction && <div className="text-[8px] text-slate-400">{contact.fonction}</div>}
                      </td>
                      <td className="px-2 py-0.5 border border-slate-200 leading-tight">
                        <div className="text-blue-600 text-[9px]">{contact.email}</div>
                        {contact.phone && <div className="text-[8px] text-slate-400">{contact.phone}</div>}
                      </td>
                      {hasParticipantCpr && (
                        <td className="text-center border border-slate-200">
                          {contact.cpr && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: `${primary}22`, color: primary }}>C</span>
                          )}
                        </td>
                      )}
                      <td className="text-center border border-slate-200 font-bold text-[9px]">
                        {att === 'absent' ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: 'rgb(239,68,68)', color: 'white' }}>A</span>
                        ) : (
                          <span style={{ color: att === 'present' ? 'rgb(22,130,76)' : att === 'excused' ? 'rgb(71,85,105)' : 'rgb(168,85,247)' }}>
                            {att === 'present' ? 'P' : att === 'excused' ? 'E' : 'NC'}
                          </span>
                        )}
                      </td>
                      <td className="text-center border border-slate-200">
                        {diff && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: 'rgb(230,242,255)', color: 'rgb(30,90,170)' }}>D</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {gi < groups.length - 1 && (
                  <tr aria-hidden="true">
                    <td colSpan={participantColumnCount} style={{ height: '5px', border: 'none', padding: 0 }} />
                  </tr>
                )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="text-[8px] italic mt-1" style={{ color: '#94a3b8' }}>
          P : Présent &nbsp;|&nbsp; E : Excusé &nbsp;|&nbsp; A : Absent &nbsp;|&nbsp; NC : Non convoqué
          {hasParticipantCpr && <>&nbsp;|&nbsp; C : CPR</>}
          &nbsp;|&nbsp; D : Diffusion
        </p>
      </div>

      {/* ── TEXTE LEGAL ── */}
      {showLegalText && (
        <div className="mx-6 mt-4">
          <div className="rounded-lg border px-4 py-3" style={{ backgroundColor: 'rgb(248,249,252)', borderColor: 'rgb(210,218,226)' }}>
            <p className="text-[9px] italic leading-relaxed" style={{ color: '#64748b' }}>
              {crrConfig.legalText}
            </p>
          </div>
        </div>
      )}

      {/* ── OBSERVATIONS ── */}
      <div className="mx-6 mt-5">
        {/* Bandeau principal avec stats */}
        <div className="rounded-lg px-4 py-3 flex items-center justify-between" style={{ backgroundColor: primary }}>
          <span className="text-white font-bold text-sm tracking-wide">OBSERVATIONS</span>
          <span className="text-[10px] font-normal" style={{ color: 'rgb(220,240,230)' }}>
            {totalObs} obs.  |  {openObs} ouvertes  |  {progObs} en cours  |  {doneObs} faites
          </span>
        </div>

        {/* En-tete colonnes — table-layout fixed + colgroup partage avec le corps
            pour garantir l'alignement parfait des colonnes (header vs lignes) */}
        <table className="w-full text-[10px] border-collapse mt-0" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            {hasDeadline && <col style={{ width: '11%' }} />}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: lightenHex(primary, 0.78) }}>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>EMETTEUR</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>DATE</th>
              <th className="text-left px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>OBSERVATIONS</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>STATUT</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>PAR</th>
              {hasDeadline && <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>POUR LE</th>}
            </tr>
          </thead>
        </table>

        {/* Categories */}
        {categories.map((cat, ci) => {
          const rawCatObs = observations.filter((o) => o.category === cat);
          const dateDir = sortDate?.[cat];
          const catObs = dateDir
            ? [...rawCatObs].sort((a, b) => { const da = a.date || ''; const db = b.date || ''; return dateDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da); })
            : rawCatObs;
          const catColor = CAT_COLORS[ci % CAT_COLORS.length];

          return (
            <div key={cat} className="mt-1">
              {/* Bandeau categorie */}
              <div
                className="rounded relative overflow-hidden px-4 py-1.5 flex items-center justify-between"
                style={{ backgroundColor: rgbLight(catColor, 0.88) }}
              >
                <div className="absolute left-0 top-0 w-[4px] h-full rounded-r" style={{ backgroundColor: rgb(catColor) }} />
                <span className="text-[10px] font-bold uppercase ml-2" style={{ color: rgb(catColor) }}>
                  {cat}
                </span>
                <span className="text-[9px]" style={{ color: rgbLight(catColor, 0.3) }}>
                  {catObs.length} observation{catObs.length > 1 ? 's' : ''}
                </span>
              </div>

              {catObs.length === 0 ? (
                <div className="text-center text-slate-400 text-[9px] py-3 italic">
                  Aucune observation
                </div>
              ) : (
                <table className="w-full text-[10px] border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
                    <col />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '13%' }} />
                    {hasDeadline && <col style={{ width: '11%' }} />}
                  </colgroup>
                  <tbody>
                    {catObs.map((obs, oi) => {
                      const isDone = obs.status === 'done';
                      const isProgress = obs.status === 'in_progress';
                      const isEmpty = obs.status === 'empty';
                      const images = obs.images || [];
                      const obsNum = obsDisplayNumber(obs, crrConfig.categoryCodes);

                      const rowBg = isDone
                        ? 'rgb(232,250,240)'
                        : isProgress
                        ? 'rgb(230,242,255)'
                        : oi % 2 === 1 ? 'rgb(250,252,254)' : 'white';

                      return (
                        <tr key={obs.id} style={{ backgroundColor: rowBg }}>
                          <td className="px-1 py-1.5 border border-slate-200 w-[11%] align-middle">
                            {renderBadges(obs.emitter)}
                          </td>
                          <td className="text-center px-2 py-1.5 border border-slate-200 w-[10%] align-middle" style={{ color: '#64748b' }}>
                            <span className={obs.date && meeting.date && obs.date !== meeting.date ? 'font-bold text-slate-800' : ''}>
                              {formatDate(obs.date)}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 border border-slate-200 whitespace-pre-wrap break-words align-top text-[11px] leading-snug" style={{
                            color: isDone ? 'rgb(22,120,70)' : isProgress ? 'rgb(30,90,170)' : '#282828',
                            wordBreak: 'break-word',
                          }}>
                            {obsNum && (
                              <span className="font-bold mr-1.5" style={{ color: rgb(catColor) }}>{obsNum}</span>
                            )}
                            {renderFormattedText(obs.text)}
                            {obsAge(obs, meeting.number) >= 1 && (
                              <span className="text-slate-400 ml-1.5 text-[9px] italic">depuis CR n°{obs.originMeetingNumber}</span>
                            )}
                            {/* Images — rendu fidèle au PDF : ratio préservé (pas de
                                recadrage), 1 photo pleine largeur centrée, sinon 2 par
                                ligne. Hauteurs max calquées sur le PDF (70 mm / 50 mm). */}
                            {images.length > 0 && (
                              <div className={`mt-2 grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {images.map((img, idx) => {
                                  const imgSrc = typeof img === 'string' ? img : img.src;
                                  const lat = typeof img === 'object' ? img.lat : null;
                                  const lng = typeof img === 'object' ? img.lng : null;
                                  const hasGps = lat != null && lng != null;
                                  return (
                                    <div key={idx} className="flex flex-col items-center">
                                      <img src={imgSrc} alt="" loading="lazy"
                                        className="rounded border border-gray-200"
                                        style={{ maxWidth: '100%', maxHeight: images.length === 1 ? '280px' : '200px', width: 'auto', height: 'auto', objectFit: 'contain' }} />
                                      {hasGps && (
                                        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                                          className="text-[8px] italic text-blue-600 hover:underline mt-0.5 block text-center">
                                          Localisation
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="text-center px-1 py-1.5 border border-slate-200 w-[10%] align-middle">
                            {isDone && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold leading-none" style={{ backgroundColor: 'rgb(212,240,224)', color: 'rgb(22,120,70)' }}>FAIT</span>
                            )}
                            {isProgress && (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none" style={{ backgroundColor: 'rgb(210,230,255)', color: 'rgb(30,90,170)' }}>En cours</span>
                            )}
                            {!isDone && !isProgress && !isEmpty && (
                              <span className="text-[9px] font-normal leading-none" style={{ color: 'rgb(120,128,140)' }}>Ouvert</span>
                            )}
                          </td>
                          <td className="px-1 py-1.5 border border-slate-200 w-[13%] align-middle">
                            {renderBadges(obs.actionBy)}
                          </td>
                          {hasDeadline && (
                            <td className="text-center px-2 py-1.5 border border-slate-200 w-[11%] align-middle" style={{ color: '#64748b' }}>
                              {formatDate(obs.actionDeadline)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* ── PIED DE PAGE ── */}
      <div className="mx-6 mt-6 mb-4 pt-3 border-t flex items-center justify-between text-[9px]" style={{ borderColor: 'rgb(210,218,226)' }}>
        {branding?.companyName && (
          <span className="font-bold" style={{ color: primary }}>{branding.companyName}</span>
        )}
        <span style={{ color: '#64748b' }}>{pdfProjectName}</span>
        <span>
          <span style={{ color: '#64748b' }}>Edite le {new Date().toLocaleDateString('fr-FR')} · </span>
          <span className="font-bold" style={{ color: '#282828' }}>Page 1/1</span>
        </span>
      </div>
    </div>
  );
};

export default CrrPreview;
