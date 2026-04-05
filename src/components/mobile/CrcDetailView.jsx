// src/components/mobile/CrcDetailView.jsx
//
// Vue détail d'un chantier CRC mobile — lecture + édition.
// Affiche : info chantier, onglets réunions, participants, observations.
// Si `manager` prop fourni → édition activée (tap observation, ajout, images).

import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { OBSERVATION_STATUSES, PRESENCE_OPTIONS, MEETING_TYPES, GROUP_COLORS, getGroupColor } from '../../data/crrData';
import { normalizeObsText, stripHtml } from '../../utils/formatObsText';
import { setShareMode, canNativeShare } from '../../utils/fileSaver';
import { buildExportFilename } from '../../utils/exportHelpers';
import ImageViewerModal from './ImageViewerModal';

const ObservationEditSheet = lazy(() => import('./ObservationEditSheet'));

// ─── HELPERS ────────────────────────────────────────────────────────────────

const statusMeta = (value) =>
  OBSERVATION_STATUSES.find(s => s.value === value) || OBSERVATION_STATUSES[0];

const presenceShort = (value) => {
  const opt = PRESENCE_OPTIONS.find(p => p.value === value);
  return opt?.short || '—';
};

const presenceColor = (value) => {
  if (value === 'present') return 'text-emerald-400 bg-emerald-500/15';
  if (value === 'excused') return 'text-amber-400 bg-amber-500/15';
  if (value === 'absent') return 'text-red-400 bg-red-500/15';
  return 'text-slate-500 bg-slate-500/10';
};

const meetingTypeLabel = (value) =>
  MEETING_TYPES.find(t => t.value === value)?.label || value;

const statusColorMobile = (value) => {
  if (value === 'done') return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20';
  if (value === 'in_progress') return 'text-blue-400 bg-blue-500/15 border-blue-500/20';
  if (value === 'open') return 'text-amber-400 bg-amber-500/15 border-amber-500/20';
  return 'text-slate-500 bg-slate-500/10 border-slate-500/10';
};

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

export default function CrcDetailView({ chantier, onSelectMeeting, branding, onToast, manager, isLandscape }) {
  const config = chantier.crrConfig || {};
  const meetings = chantier.crrMeetings || [];
  const groups = config.participantGroups || [];
  const canEdit = !!manager;

  const [activeMeetingIdx, setActiveMeetingIdx] = useState(meetings.length > 0 ? meetings.length - 1 : 0);
  const [activeSection, setActiveSection] = useState('observations');
  const [exporting, setExporting] = useState(null);
  const [editingObs, setEditingObs] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);

  const meeting = meetings[activeMeetingIdx] || null;
  const chantierName = config.chantierInfo?.nom || '';

  // Sync activeMeetingId with useCrrManager when switching tabs
  const handleSelectMeeting = useCallback((idx) => {
    setActiveMeetingIdx(idx);
    if (manager && meetings[idx]) {
      manager.setActiveMeetingId(meetings[idx].id);
    }
  }, [manager, meetings]);

  const handleExportPdf = useCallback(async (share = false) => {
    if (!meeting) return;
    const key = share ? 'pdf-share' : 'pdf';
    setExporting(key);
    try {
      if (share) setShareMode(true);
      const { generatePdfCrr } = await import('../../utils/pdfCrrGenerator');
      const exportCfg = (manager?.crrConfig || config).chantierInfo || {};
      const filename = buildExportFilename(exportCfg.exportPattern, { number: meeting.number, projectName: chantierName, date: meeting.date, ext: 'pdf' });
      await generatePdfCrr(meeting, manager?.crrConfig || config, chantierName, branding || {}, { filename });
      onToast?.(`CR n°${meeting.number} ${share ? 'partagé' : 'exporté'}`);
    } catch (err) {
      console.error('[CrcDetailView] Export PDF:', err);
      onToast?.('Erreur export PDF');
    } finally {
      setShareMode(false);
      setExporting(null);
    }
  }, [meeting, config, chantierName, branding, onToast, manager]);

  // ── Envoi par mail aux diffusés (même sujet/corps/destinataires que PC) ──
  const handleSendMail = useCallback(async () => {
    if (!meeting || !manager) return;
    const emails = manager.diffusionEmails || [];
    if (emails.length === 0) {
      onToast?.('Aucun destinataire avec diffusion cochée');
      return;
    }
    setExporting('mail');
    try {
      const { generatePdfCrr } = await import('../../utils/pdfCrrGenerator');
      const { buildMailSubject, buildMailBodyPlainText } = await import('../../utils/crrMailer');
      const exportCfg = (manager?.crrConfig || config).chantierInfo || {};
      const filename = buildExportFilename(exportCfg.exportPattern, { number: meeting.number, projectName: chantierName, date: meeting.date, ext: 'pdf' });
      const pdfData = await generatePdfCrr(meeting, manager.crrConfig, chantierName, branding || {}, { returnBlob: true, filename });

      const subject = buildMailSubject(meeting, chantierName);
      const body = buildMailBodyPlainText(meeting, chantierName);

      // navigator.share envoie le PDF en pièce jointe avec sujet + corps
      if (navigator.share && navigator.canShare) {
        const file = new File([pdfData.blob], filename, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          // Copier les destinataires AVANT le share (disponibles dans Outlook)
          const dest = emails.join(', ');
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(dest).catch(() => {});
          }
          onToast?.(`Destinataires copiés : ${dest}`);
          await navigator.share({ title: subject, text: body, files: [file] });
          setExporting(null);
          return;
        }
      }

      // Fallback : télécharger le PDF + ouvrir mailto (sans pièce jointe)
      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const to = emails.join(',');
      setTimeout(() => {
        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }, 500);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[CrcDetailView] Envoi mail:', err);
        onToast?.('Erreur envoi');
      }
    } finally {
      setExporting(null);
    }
  }, [meeting, manager, config, chantierName, branding, onToast]);

  // ── Observations par catégorie ──
  const obsByCategory = useMemo(() => {
    if (!meeting) return {};
    const map = {};
    (meeting.observations || []).forEach(obs => {
      const cat = obs.category || 'Divers';
      if (!map[cat]) map[cat] = [];
      map[cat].push(obs);
    });
    return map;
  }, [meeting]);

  // ── Participants avec leur groupe ──
  const meetingGroups = meeting?.participantGroups || groups;

  // ── Contacts plat avec info groupe ──
  const allContacts = useMemo(() => {
    const list = [];
    (meetingGroups || []).forEach((g, gi) => {
      (g.contacts || []).forEach(c => {
        list.push({ ...c, groupName: g.name, groupIdx: gi });
      });
    });
    return list;
  }, [meetingGroups]);

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Aucune réunion dans ce chantier.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Chantier info — supprimé, le nom est déjà dans le header parent ── */}

      {/* ── Meeting tabs (scroll horizontal) ───────────────────────────── */}
      <div className={`flex gap-1.5 px-4 overflow-x-auto scrollbar-none ${isLandscape ? 'py-1' : 'py-2'}`}>
        {meetings.map((m, idx) => {
          const isActive = idx === activeMeetingIdx;
          return (
            <button key={m.id || idx} onClick={() => handleSelectMeeting(idx)}
              className={`
                shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition
                ${isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
                }
              `}>
              CR n°{m.number}
            </button>
          );
        })}
      </div>

      {/* ── Meeting header ─────────────────────────────────────────────── */}
      {meeting && (
        <div className={`mx-4 bg-white/5 rounded-xl border border-white/10 ${isLandscape ? 'mt-0.5 mb-1 p-2' : 'mt-1 mb-2 p-3'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-400">
                {meetingTypeLabel(meeting.type)} n°{meeting.number}
              </span>
              {canEdit && manager.saveStatus && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  manager.saveStatus === 'saved' ? 'bg-emerald-500' :
                  manager.saveStatus === 'saving' || manager.saveStatus === 'waiting' ? 'bg-amber-500 animate-pulse' :
                  'bg-red-500'
                }`} title={manager.saveStatus} />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">{dateFr(meeting.date)}</span>
              <button onClick={() => handleExportPdf(false)} disabled={!!exporting}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                  exporting ? 'bg-white/5 border-white/5 opacity-40' : 'bg-red-500/10 border-red-500/20 active:bg-red-500/30'
                }`}>
                {exporting === 'pdf'
                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Icon name="download" size={14} color="#ef4444" />}
              </button>
              {canNativeShare() && (
                <button onClick={() => handleExportPdf(true)} disabled={!!exporting}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                    exporting ? 'bg-white/5 border-white/5 opacity-40' : 'bg-white/5 border-white/10 active:bg-white/10'
                  }`}>
                  {exporting === 'pdf-share'
                    ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    : <Icon name="share" size={14} color="#64748b" />}
                </button>
              )}
              {canEdit && (
                <button onClick={handleSendMail} disabled={!!exporting}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                    exporting ? 'bg-white/5 border-white/5 opacity-40' : 'bg-blue-500/10 border-blue-500/20 active:bg-blue-500/30'
                  }`}>
                  {exporting === 'mail'
                    ? <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    : <Icon name="mail" size={14} color="#60a5fa" />}
                </button>
              )}
            </div>
          </div>
          {meeting.nextMeeting?.date && !isLandscape && (
            <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/15">
              <span className="text-[10px] font-bold text-amber-400 uppercase">Prochaine</span>
              <span className="text-xs text-slate-300">
                {dateFr(meeting.nextMeeting.date)}
                {meeting.nextMeeting.heure && ` à ${meeting.nextMeeting.heure}`}
                {meeting.nextMeeting.lieu && ` — ${meeting.nextMeeting.lieu}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Section toggle ─────────────────────────────────────────────── */}
      <div className={`flex gap-1 mx-4 p-1 bg-white/5 rounded-lg ${isLandscape ? 'mb-1' : 'mb-2'}`}>
        <SectionTab
          label="Observations"
          active={activeSection === 'observations'}
          onClick={() => setActiveSection('observations')}
        />
        <SectionTab
          label="Participants"
          active={activeSection === 'participants'}
          onClick={() => setActiveSection('participants')}
        />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeSection === 'observations' && meeting && (
          <ObservationsSection
            obsByCategory={obsByCategory}
            allContacts={allContacts}
            canEdit={canEdit}
            isLandscape={isLandscape}
            onEditObs={setEditingObs}
            onAddObs={canEdit ? (cat) => {
              const newId = manager.addObservation(cat);
              const obs = (meeting.observations || []).find(o => o.id === newId);
              if (obs) setEditingObs(obs);
            } : undefined}
            onViewImage={setViewingImage}
          />
        )}
        {activeSection === 'participants' && meeting && (
          <ParticipantsSection
            groups={meetingGroups}
            attendance={meeting.attendance || {}}
            diffusion={meeting.diffusion || {}}
            canEdit={canEdit}
            onSetAttendance={canEdit ? manager.setAttendance : undefined}
            onSetDiffusion={canEdit ? manager.setDiffusion : undefined}
          />
        )}
      </div>

      {/* ── Image viewer modal ── */}
      {viewingImage && (
        <ImageViewerModal src={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {/* ── Observation edit sheet ── */}
      {canEdit && editingObs && (
        <Suspense fallback={null}>
          <ObservationEditSheet
            obs={editingObs}
            participantGroups={manager.activeParticipantGroups || groups}
            onUpdate={(obsId, patch) => {
              manager.updateObservation(obsId, patch);
              // Update local editingObs to reflect changes
              setEditingObs(prev => prev ? { ...prev, ...patch } : null);
            }}
            onDelete={(obsId) => manager.deleteObservation(obsId)}
            onClose={() => setEditingObs(null)}
            onViewImage={setViewingImage}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── SOUS-COMPOSANTS ────────────────────────────────────────────────────────

function SectionTab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
        active ? 'bg-white/10 text-slate-200' : 'text-slate-500'
      }`}>
      {label}
    </button>
  );
}

// ─── SECTION OBSERVATIONS ───────────────────────────────────────────────────

function ObservationsSection({ obsByCategory, allContacts, canEdit, isLandscape, onEditObs, onAddObs, onViewImage }) {
  const [expandedCats, setExpandedCats] = useState(() => new Set(Object.keys(obsByCategory)));

  const toggleCat = (cat) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const contactName = (id) => {
    const c = allContacts.find(c => c.id === id);
    return c ? `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email || id : id;
  };

  const categories = Object.keys(obsByCategory);
  if (categories.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">Aucune observation.</div>;
  }

  return (
    <div className={isLandscape ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
      {categories.map(cat => {
        const obs = obsByCategory[cat];
        const expanded = expandedCats.has(cat);
        const doneCount = obs.filter(o => o.status === 'done').length;

        return (
          <div key={cat} className="bg-white/[0.03] rounded-xl border border-white/10 overflow-hidden">
            {/* Category header */}
            <button onClick={() => toggleCat(cat)}
              className="flex items-center justify-between w-full px-3 py-2.5 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200">{cat}</span>
                <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                  {obs.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {doneCount > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400">{doneCount} fait</span>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>

            {/* Observations */}
            {expanded && obs.map(o => (
              <ObservationCard
                key={o.id}
                obs={o}
                contactName={contactName}
                canEdit={canEdit}
                onEdit={() => onEditObs?.(o)}
                onViewImage={onViewImage}
              />
            ))}

            {/* Add observation button */}
            {expanded && canEdit && (
              <button
                onClick={() => onAddObs?.(cat)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 text-emerald-400 text-xs font-semibold border-t border-white/5 hover:bg-emerald-500/5 transition"
              >
                <Icon name="plus" size={14} color="#34d399" />
                Ajouter
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ObservationCard({ obs, contactName, canEdit, onEdit, onViewImage }) {
  const st = statusMeta(obs.status);
  const text = stripHtml(obs.text);
  const images = obs.images || [];

  return (
    <div
      className={`px-3 py-2.5 border-t border-white/5 ${canEdit ? 'active:bg-white/[0.03] cursor-pointer' : ''}`}
      onClick={canEdit ? onEdit : undefined}
    >
      {/* Status + emitter */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusColorMobile(obs.status)}`}>
          {st.label}
        </span>
        {obs.emitter && (
          <span className="text-[11px] text-slate-400 font-medium truncate">
            {contactName(obs.emitter)}
          </span>
        )}
        {obs.originMeetingNumber && (
          <span className="text-[10px] text-slate-600 ml-auto shrink-0">CR{obs.originMeetingNumber}</span>
        )}
        {canEdit && (
          <Icon name="edit" size={12} color="#475569" />
        )}
      </div>

      {/* Text */}
      {text && (
        <p className="text-xs text-slate-300 leading-relaxed mt-1 whitespace-pre-line line-clamp-4">
          {text}
        </p>
      )}

      {/* Footer : action by + deadline */}
      {(obs.actionBy || obs.actionDeadline) && (
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
          {obs.actionBy && (
            <span className="flex items-center gap-1">
              <span className="font-semibold">Action :</span> {contactName(obs.actionBy)}
            </span>
          )}
          {obs.actionDeadline && (
            <span className="flex items-center gap-1">
              <span className="font-semibold">Échéance :</span> {dateFr(obs.actionDeadline)}
            </span>
          )}
        </div>
      )}

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
          {images.slice(0, 4).map((src, idx) => (
            <div
              key={idx}
              className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0"
              onClick={() => onViewImage?.(src)}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {images.length > 4 && (
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-slate-400">+{images.length - 4}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SECTION PARTICIPANTS ───────────────────────────────────────────────────

function ParticipantsSection({ groups, attendance, diffusion, canEdit, onSetAttendance, onSetDiffusion }) {
  if (!groups || groups.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">Aucun participant.</div>;
  }

  const PRES_CYCLE = ['present', 'excused', 'absent', 'not_summoned'];
  const cyclePresence = (contactId, current) => {
    if (!onSetAttendance) return;
    const idx = PRES_CYCLE.indexOf(current);
    const next = PRES_CYCLE[(idx + 1) % PRES_CYCLE.length];
    onSetAttendance(contactId, next);
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="text-[10px] text-slate-500 text-center px-2">
          Tapez sur le badge pour changer la présence · Tapez sur Diff. pour basculer la diffusion
        </div>
      )}
      {groups.map((group, gi) => {
        const color = getGroupColor(gi);
        const contacts = group.contacts || [];
        if (contacts.length === 0) return null;

        return (
          <div key={group.id} className="bg-white/[0.03] rounded-xl border border-white/10 overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <div className={`w-2.5 h-2.5 rounded-full`}
                style={{ backgroundColor: `rgb(${color.rgb.join(',')})` }} />
              <span className="text-sm font-bold text-slate-200">{group.name}</span>
              {group.subLabel && (
                <span className="text-[10px] text-slate-500">{group.subLabel}</span>
              )}
              <span className="ml-auto text-[10px] text-slate-500 font-bold">{contacts.length}</span>
            </div>

            {/* Contacts */}
            {contacts.map(c => {
              const pres = attendance[c.id] || 'not_summoned';
              const diff = diffusion?.[c.id] || false;
              const fullName = `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email || '—';

              return (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-300 truncate">{fullName}</div>
                    {c.fonction && (
                      <div className="text-[10px] text-slate-500 truncate">{c.fonction}</div>
                    )}
                  </div>
                  {/* Diffusion toggle */}
                  {canEdit && (
                    <button
                      onClick={() => onSetDiffusion?.(c.id, !diff)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                        diff
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-white/5 text-slate-600 border border-white/5'
                      }`}
                    >
                      Diff.
                    </button>
                  )}
                  {/* Presence badge — tap to cycle in edit mode */}
                  <button
                    onClick={canEdit ? () => cyclePresence(c.id, pres) : undefined}
                    disabled={!canEdit}
                    className={`px-2 py-0.5 rounded text-[10px] font-black transition ${presenceColor(pres)} ${
                      canEdit ? 'active:scale-95' : ''
                    }`}
                  >
                    {presenceShort(pres)}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
