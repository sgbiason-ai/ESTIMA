// src/components/crr/CrrPreview.jsx
//
// Apercu du compte rendu fidele au rendu PDF moderne.

import React from 'react';
import { MEETING_TYPES, OBSERVATION_STATUSES, GROUP_COLORS, abbreviateGroup } from '../../data/crrData';
import { renderFormattedText } from '../../utils/formatObsText.jsx';
import { formatDateFr, formatDateLong } from '../../utils/dateHelpers';
import { lightenHex } from '../../utils/colorHelpers';

const CAT_COLORS = [
  { r: 40, g: 110, b: 85 },   // emerald
  { r: 37, g: 99, b: 175 },   // blue
  { r: 124, g: 58, b: 170 },  // purple
  { r: 210, g: 120, b: 20 },  // orange
  { r: 190, g: 50, b: 50 },   // red
  { r: 170, g: 140, b: 20 },  // amber
];

const rgb = (c) => `rgb(${c.r},${c.g},${c.b})`;
const rgbLight = (c, f = 0.88) =>
  `rgb(${Math.round(c.r + (255 - c.r) * f)},${Math.round(c.g + (255 - c.g) * f)},${Math.round(c.b + (255 - c.b) * f)})`;

const CrrPreview = ({ meeting, crrConfig, projectName, branding, sortDate, sortCat }) => {
  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Selectionnez ou creez un compte rendu pour voir l'apercu
      </div>
    );
  }

  // Map nom de groupe → index pour les couleurs des pastilles
  const groupIndexMap = {};
  (crrConfig.participantGroups || []).forEach((g, i) => { groupIndexMap[g.name] = i; });

  // Rendre les pastilles pour un champ emitter/actionBy (valeur = "MOE, Entreprises")
  const renderBadges = (val) => {
    if (!val) return null;
    const names = val.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <div className="flex flex-col gap-0.5 items-center">
        {names.map((name) => {
          const idx = groupIndexMap[name] ?? 0;
          const c = GROUP_COLORS[idx % GROUP_COLORS.length];
          const abbr = abbreviateGroup(name);
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
  const groups = crrConfig.participantGroups || [];
  const rawCategories = crrConfig.categories || [];
  const categories = sortCat
    ? [...rawCategories].sort((a, b) => sortCat === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    : rawCategories;
  const observations = meeting.observations || [];
  const pdfProjectName = (projectName || 'NOM DU PROJET').toUpperCase();

  // Stats
  const totalObs = observations.length;
  const openObs = observations.filter(o => o.status === 'open').length;
  const progObs = observations.filter(o => o.status === 'in_progress').length;
  const doneObs = observations.filter(o => o.status === 'done').length;

  return (
    <div className="bg-white shadow-lg max-w-[800px] mx-auto my-4 text-[11px] leading-snug relative overflow-hidden" style={{ color: '#282828' }}>

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
            <div className="text-3xl font-black mt-1" style={{ color: primary }}>
              N° {meeting.number}
            </div>
            <div className="text-xs mt-1" style={{ color: '#64748b' }}>
              Date : {formatDate(meeting.date)}
            </div>
          </div>

          {/* Logo commune — centré */}
          {crrConfig.chantierInfo?.communeLogo && (
            <img
              src={crrConfig.chantierInfo.communeLogo}
              alt="Logo commune"
              className="h-14 object-contain"
            />
          )}

          {/* Logo MOE — droite */}
          {branding?.logo && (
            <img
              src={branding.logo}
              alt="Logo MOE"
              className="h-12 object-contain"
            />
          )}
        </div>
      </div>

      {/* Nom du projet */}
      <div className="text-center mt-5 px-6">
        <div className="text-xl font-black tracking-wide uppercase" style={{ color: primary }}>
          {pdfProjectName}
        </div>
        <div className="mx-auto mt-2 h-[2px] rounded-full" style={{ backgroundColor: secondary, width: '60%' }} />
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
        <table className="w-full text-[10px] border-collapse mt-0">
          <thead>
            <tr style={{ backgroundColor: lightenHex(primary, 0.78) }}>
              <th className="text-center px-1 py-2 border border-slate-200 font-bold w-10" style={{ color: primary }}></th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary, width: '18%' }}>ROLE / INTERVENANT</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary, width: '13%' }}>LABEL</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary, width: '15%' }}>CONTACT</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary, width: '24%' }}>EMAIL</th>
              <th className="text-center px-1 py-2 border border-slate-200 font-bold w-10" style={{ color: primary }}>CPR</th>
              <th className="text-center px-1 py-2 border border-slate-200 font-bold w-12" style={{ color: primary }}>PRES.</th>
              <th className="text-center px-1 py-2 border border-slate-200 font-bold w-12" style={{ color: primary }}>DIFF.</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => (
              <React.Fragment key={group.id}>
                {group.contacts.length === 0 && (
                  <tr style={{ backgroundColor: lightenHex(primary, 0.96) }}>
                    <td className="px-2 py-1.5 font-bold border border-slate-200" colSpan={8} style={{ color: primary }}>
                      {group.name}{group.subLabel ? ` : ${group.subLabel}` : ''}
                    </td>
                  </tr>
                )}
                {group.contacts.map((contact, ci) => {
                  const att = meeting.attendance?.[contact.id] || 'absent';
                  const diff = meeting.diffusion?.[contact.id] || false;
                  return (
                    <tr key={contact.id} style={{ backgroundColor: gi % 2 === 0 ? 'white' : 'rgb(250,252,254)' }}>
                      {ci === 0 && (
                        <>
                          <td
                            className="text-center border border-slate-200 align-middle"
                            rowSpan={group.contacts.length}
                          >
                            {(() => {
                              const gc = GROUP_COLORS[gi % GROUP_COLORS.length];
                              const abbr = abbreviateGroup(group.name);
                              return (
                                <span
                                  className="inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold"
                                  style={{ minWidth: '40px', backgroundColor: `rgb(${gc.rgbBg.join(',')})`, color: `rgb(${gc.rgb.join(',')})` }}
                                >
                                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(${gc.rgb.join(',')})` }} />
                                  {abbr}
                                </span>
                              );
                            })()}
                          </td>
                          <td
                            className="px-2 py-1.5 border border-slate-200 align-middle font-bold text-[10px]"
                            rowSpan={group.contacts.length}
                          >
                            {group.name}
                            {group.subLabel && <div className="text-[9px] font-normal text-slate-500">{group.subLabel}</div>}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 border border-slate-200 text-[9px] text-slate-500">{contact.subLabel || ''}</td>
                      <td className="px-2 py-1.5 border border-slate-200">{contact.name}</td>
                      <td className="px-2 py-1.5 border border-slate-200">
                        <div className="text-blue-600 text-[9px]">{contact.email}</div>
                        {contact.phone && <div className="text-[8px] text-slate-400">{contact.phone}</div>}
                      </td>
                      <td className="text-center border border-slate-200">
                        {contact.cpr && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: `${primary}22`, color: primary }}>C</span>
                        )}
                      </td>
                      <td className="text-center border border-slate-200 font-bold text-[9px]" style={{
                        color: att === 'present' ? 'rgb(22,130,76)' : att === 'excused' ? 'rgb(180,120,20)' : att === 'not_summoned' ? 'rgb(168,85,247)' : 'rgb(160,170,180)',
                      }}>
                        {att === 'present' ? 'P' : att === 'excused' ? 'E' : att === 'not_summoned' ? 'NC' : 'A'}
                      </td>
                      <td className="text-center border border-slate-200">
                        {diff && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: 'rgb(230,242,255)', color: 'rgb(30,90,170)' }}>D</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <p className="text-[8px] italic mt-1" style={{ color: '#94a3b8' }}>
          P : Présent &nbsp;|&nbsp; E : Excusé &nbsp;|&nbsp; A : Absent &nbsp;|&nbsp; NC : Non convoqué &nbsp;|&nbsp; C : CPR &nbsp;|&nbsp; D : Diffusion
        </p>
      </div>

      {/* ── TEXTE LEGAL ── */}
      {crrConfig.legalText && (
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
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: lightenHex(primary, 0.78) }}>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>EMETTEUR</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>DATE</th>
              <th className="text-left px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>OBSERVATIONS</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>STATUT</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>PAR</th>
              <th className="text-center px-2 py-2 border border-slate-200 font-bold" style={{ color: primary }}>POUR LE</th>
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
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <tbody>
                    {catObs.map((obs, oi) => {
                      const isDone = obs.status === 'done';
                      const isProgress = obs.status === 'in_progress';
                      const isEmpty = obs.status === 'empty';
                      const images = obs.images || [];

                      const rowBg = isDone
                        ? 'rgb(232,250,240)'
                        : isProgress
                        ? 'rgb(230,242,255)'
                        : oi % 2 === 1 ? 'rgb(250,252,254)' : 'white';

                      return (
                        <tr key={obs.id} style={{ backgroundColor: rowBg }}>
                          <td className="px-1 py-1.5 border border-slate-200 w-[11%] align-top">
                            {renderBadges(obs.emitter)}
                          </td>
                          <td className="text-center px-2 py-1.5 border border-slate-200 w-[10%] align-top" style={{ color: '#64748b' }}>
                            {formatDate(obs.date)}
                          </td>
                          <td className="px-2 py-1.5 border border-slate-200 whitespace-pre-wrap break-words align-top" style={{
                            color: isDone ? 'rgb(22,120,70)' : isProgress ? 'rgb(30,90,170)' : '#282828',
                            wordBreak: 'break-word',
                          }}>
                            {renderFormattedText(obs.text)}
                            {obs.originMeetingNumber && (
                              <span className="text-slate-400 ml-1">(Report CR n{obs.originMeetingNumber})</span>
                            )}
                            {/* Images */}
                            {images.length > 0 && (
                              <div className={`flex flex-wrap gap-1.5 mt-2`} style={{ maxWidth: images.length === 1 ? '100%' : '50%' }}>
                                {images.map((img, idx) => {
                                  const imgSrc = typeof img === 'string' ? img : img.src;
                                  const lat = typeof img === 'object' ? img.lat : null;
                                  const lng = typeof img === 'object' ? img.lng : null;
                                  const hasGps = lat != null && lng != null;
                                  return (
                                    <div key={idx} className="flex flex-col">
                                      <img src={imgSrc} alt="" loading="lazy"
                                        className="rounded border border-gray-200 object-cover"
                                        style={images.length === 1 ? { width: '100%', height: 'auto' } : { width: 'calc(50% - 3px)', minWidth: 60, maxHeight: '80px' }} />
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
                              <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: 'rgb(212,240,224)', color: 'rgb(22,120,70)' }}>FAIT</span>
                            )}
                            {isProgress && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: 'rgb(210,230,255)', color: 'rgb(30,90,170)' }}>En cours</span>
                            )}
                            {!isDone && !isProgress && !isEmpty && (
                              <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: 'rgb(245,227,210)', color: 'rgb(190,110,20)' }}>Ouvert</span>
                            )}
                          </td>
                          <td className="px-1 py-1.5 border border-slate-200 w-[13%] align-top">
                            {renderBadges(obs.actionBy)}
                          </td>
                          <td className="text-center px-2 py-1.5 border border-slate-200 w-[11%] align-top" style={{ color: '#64748b' }}>
                            {formatDate(obs.actionDeadline)}
                          </td>
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
        <span style={{ color: '#64748b' }}>{pdfProjectName}  --  Apercu</span>
        <span style={{ color: '#64748b' }}>Edite le {new Date().toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  );
};

export default CrrPreview;
