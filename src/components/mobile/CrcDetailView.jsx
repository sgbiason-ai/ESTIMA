// src/components/mobile/CrcDetailView.jsx
//
// Vue détail d'un chantier CRC mobile — lecture + édition.
// Affiche : info chantier, onglets réunions, participants, observations.
// Si `manager` prop fourni → édition activée (tap observation, ajout, images).

import React, { useState, useMemo, useCallback, Suspense } from 'react';
import lazyWithReload from '../../utils/lazyWithReload';
import Icon from './Icon';
import { dateFr } from './formatters';
import { OBSERVATION_STATUSES, PRESENCE_OPTIONS, MEETING_TYPES, GROUP_COLORS, getGroupColor, abbreviateGroup, obsDisplayNumber, obsAge, obsValidation } from '../../data/crrData';
import { normalizeObsText, stripHtml } from '../../utils/formatObsText';
import { flattenGroupContacts, groupColorIndexMap, groupBadgeNameMap } from '../../utils/crrParticipantTree';
import { sanitizeHtml } from '../../utils/helpers';
// fileSaver non utilisé — export PDF direct par téléchargement
// exportHelpers chargé dynamiquement pour le code-splitting
import ImageViewerModal from './ImageViewerModal';
import SaveStatusDot from './SaveStatusDot';

const ObservationEditSheet = lazyWithReload(() => import('./ObservationEditSheet'));
import GpsTrackingSection from './GpsTrackingSection';

// ─── HELPERS ────────────────────────────────────────────────────────────────

const statusMeta = (value) =>
  OBSERVATION_STATUSES.find(s => s.value === value) || OBSERVATION_STATUSES[0];

const presenceShort = (value) => {
  const opt = PRESENCE_OPTIONS.find(p => p.value === value);
  return opt?.short || '—';
};

const presenceColor = (value) => {
  if (value === 'present') return 'text-blue-600 bg-blue-50';
  if (value === 'excused') return 'text-slate-600 bg-slate-500/15';
  if (value === 'absent') return 'text-white bg-red-500';
  return 'text-gray-700 bg-gray-500/10';
};

const meetingTypeLabel = (value) =>
  MEETING_TYPES.find(t => t.value === value)?.label || value;

const statusColorMobile = (value) => {
  if (value === 'done') return 'text-blue-600 bg-blue-50 border-blue-200';
  if (value === 'in_progress') return 'text-blue-400 bg-blue-500/15 border-blue-500/20';
  if (value === 'open') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-gray-700 bg-gray-500/10 border-gray-500/10';
};

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

export default function CrcDetailView({ chantier, branding, onToast, manager, isLandscape, companyId }) {
  const config = chantier.crrConfig || {};
  // Codes de numerotation (prefixe "CHANTIER.04") : config live du manager en
  // edition, sinon snapshot du chantier en lecture seule.
  const categoryCodes = (manager?.crrConfig || config).categoryCodes || {};
  const meetings = chantier.crrMeetings || [];
  const groups = config.participantGroups || [];
  const canEdit = !!manager;

  const [activeMeetingIdx, setActiveMeetingIdx] = useState(meetings.length > 0 ? meetings.length - 1 : 0);
  const [activeSection, setActiveSection] = useState('observations');
  const [exporting, setExporting] = useState(null);
  const [editingObs, setEditingObs] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [swiperObsIdx, setSwiperObsIdx] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { meetingIdx, x, y } // index dans allObs pour le swiper
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const meeting = meetings[activeMeetingIdx] || null;
  const chantierName = config.chantierInfo?.nom || '';

  // Sync activeMeetingId with useCrrManager when switching tabs
  const handleSelectMeeting = useCallback((idx) => {
    setActiveMeetingIdx(idx);
    if (manager && meetings[idx]) {
      manager.setActiveMeetingId(meetings[idx].id);
    }
  }, [manager, meetings]);

  const handleExportPdf = useCallback(async () => {
    if (!meeting) return;
    setExporting('pdf');
    try {
      const [{ generatePdfCrr }, { buildExportFilename }] = await Promise.all([
        import('../../utils/pdfCrrGenerator'),
        import('../../utils/exportHelpers'),
      ]);
      const exportCfg = (manager?.crrConfig || config).chantierInfo || {};
      const filename = buildExportFilename(exportCfg.exportPattern, { number: meeting.number, projectName: chantierName, date: meeting.date, ext: 'pdf' });

      // Générer le PDF en blob puis télécharger
      const pdfData = await generatePdfCrr(meeting, manager?.crrConfig || config, chantierName, branding || {}, { returnBlob: true, filename });
      if (pdfData?.blob) {
        const file = new File([pdfData.blob], filename, { type: 'application/pdf' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
        } else {
          const url = URL.createObjectURL(pdfData.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      } else {
        await generatePdfCrr(meeting, manager?.crrConfig || config, chantierName, branding || {}, { filename });
      }
      onToast?.(`CR n°${meeting.number} téléchargé`);
    } catch (err) {
      console.error('[CrcDetailView] Export PDF:', err);
      onToast?.('Erreur export PDF');
    } finally {
      setExporting(null);
    }
  }, [meeting, config, chantierName, branding, onToast, manager]);

  const handleDuplicate = useCallback((date) => {
    if (!manager || !meeting) return;
    manager.duplicateMeeting(date);
    setShowDuplicateModal(false);
    onToast?.(`CR n°${meeting.number} dupliqué`);
  }, [manager, meeting, onToast]);

  const handleDeleteMeeting = useCallback(async () => {
    if (!manager || !meeting) return;
    const { confirm } = await import('../../utils/globalUI');
    const ok = await confirm(`Supprimer le CR n°${meeting.number} ?`, { danger: true });
    if (ok) {
      manager.deleteMeeting(meeting.id);
      onToast?.(`CR n°${meeting.number} supprimé`);
    }
  }, [manager, meeting, onToast]);

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
      const [{ generatePdfCrr }, { buildMailSubject, buildMailBodyPlainText }, { buildExportFilename }] = await Promise.all([
        import('../../utils/pdfCrrGenerator'),
        import('../../utils/crrMailer'),
        import('../../utils/exportHelpers'),
      ]);
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

  // ── Liste flat de toutes les observations (pour le swiper) ──
  const allObs = useMemo(() => {
    const list = [];
    Object.entries(obsByCategory).forEach(([cat, obs]) => {
      obs.forEach(o => list.push({ ...o, _cat: cat }));
    });
    return list;
  }, [obsByCategory]);

  const handleOpenSwiper = useCallback((obs) => {
    const idx = allObs.findIndex(o => o.id === obs.id);
    if (idx >= 0) setSwiperObsIdx(idx);
  }, [allObs]);

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

  // ── Map nom (groupe OU sous-groupe) → index couleur ──
  const groupColorMap = useMemo(() => groupColorIndexMap(meetingGroups), [meetingGroups]);
  const badgeNameMap = useMemo(() => groupBadgeNameMap(meetingGroups), [meetingGroups]);

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-700 text-sm">
        Aucune réunion dans ce chantier.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Chantier info — supprimé, le nom est déjà dans le header parent ── */}

      {/* ── Meeting tabs (scroll horizontal, long-press → menu contextuel) ── */}
      <div className={`relative flex gap-1.5 px-4 overflow-x-auto scrollbar-none ${isLandscape ? 'py-1' : 'py-2'}`}>
        {meetings.map((m, idx) => {
          const isActive = idx === activeMeetingIdx;
          let pressTimer = null;
          return (
            <button key={m.id || idx}
              onClick={() => { if (!contextMenu) handleSelectMeeting(idx); }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                pressTimer = setTimeout(() => {
                  setContextMenu({ meetingIdx: idx, x: touch.clientX, y: touch.clientY });
                }, 500);
              }}
              onTouchEnd={() => clearTimeout(pressTimer)}
              onTouchMove={() => clearTimeout(pressTimer)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ meetingIdx: idx, x: e.clientX, y: e.clientY });
              }}
              className={`
                shrink-0 px-3 py-1.5 rounded-xl text-[13px] font-bold transition border select-none
                ${isActive
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200'
                }
              `}>
              CR n°{m.number}
            </button>
          );
        })}
      </div>

      {/* ── Menu contextuel (Dupliquer / Supprimer) ── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 py-1 w-48 overflow-hidden"
            style={{ top: contextMenu.y + 8, left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          >
            {canEdit && (
              <button
                onClick={() => {
                  const m = meetings[contextMenu.meetingIdx];
                  if (m) {
                    // Sélectionner le meeting puis dupliquer
                    handleSelectMeeting(contextMenu.meetingIdx);
                    const nextDate = (() => {
                      if (m.nextMeeting?.date) return m.nextMeeting.date;
                      if (!m.date) return '';
                      try { const d = new Date(m.date + 'T00:00:00'); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
                      catch { return ''; }
                    })();
                    manager.duplicateMeeting(nextDate);
                    onToast?.(`CR n°${m.number} dupliqué`);
                  }
                  setContextMenu(null);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-[13px] font-medium text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition"
              >
                <Icon name="file" size={16} color="#3b82f6" />
                Dupliquer ce CR
              </button>
            )}
            {canEdit && (
              <button
                onClick={async () => {
                  const m = meetings[contextMenu.meetingIdx];
                  setContextMenu(null);
                  if (m) {
                    const { confirm } = await import('../../utils/globalUI');
                    const ok = await confirm(`Supprimer le CR n°${m.number} ?`, { danger: true });
                    if (ok) {
                      manager.deleteMeeting(m.id);
                      onToast?.(`CR n°${m.number} supprimé`);
                    }
                  }
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-[13px] font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition"
              >
                <Icon name="trash" size={16} color="#ef4444" />
                Supprimer ce CR
              </button>
            )}
            <button
              onClick={() => setContextMenu(null)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-[12px] font-medium text-gray-400 hover:bg-gray-50 transition border-t border-gray-100"
            >
              Annuler
            </button>
          </div>
        </>
      )}

      {/* ── Meeting header ─────────────────────────────────────────────── */}
      {meeting && (
        <div className={`mx-4 bg-white rounded-xl border border-gray-200 ${isLandscape ? 'mt-0.5 mb-1 p-2' : 'mt-1 mb-2 p-3'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-gray-900">
                {meetingTypeLabel(meeting.type)} n°{meeting.number}
              </span>
              {canEdit && <SaveStatusDot status={manager.saveStatus} />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-700 mr-1">{dateFr(meeting.date)}</span>
              <button onClick={handleExportPdf} disabled={!!exporting}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                  exporting === 'pdf' ? 'bg-white border-gray-100 opacity-40' : 'bg-red-500/10 border-red-500/20 active:bg-red-500/30'
                }`}
                title="Télécharger le PDF">
                {exporting === 'pdf'
                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Icon name="download" size={14} color="#ef4444" />}
              </button>
              {canEdit && (
                <button onClick={handleSendMail} disabled={!!exporting}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                    exporting ? 'bg-white border-gray-100 opacity-40' : 'bg-blue-500/10 border-blue-500/20 active:bg-blue-500/30'
                  }`}>
                  {exporting === 'mail'
                    ? <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    : <Icon name="mail" size={14} color="#60a5fa" />}
                </button>
              )}
              {canEdit && (
                <button onClick={() => setShowDuplicateModal(true)}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center transition bg-emerald-500/10 border-emerald-500/20 active:bg-emerald-500/30"
                  title="Dupliquer ce CR">
                  <Icon name="file" size={14} color="#10b981" />
                </button>
              )}
              {canEdit && (
                <button onClick={handleDeleteMeeting}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center transition bg-red-500/10 border-red-500/20 active:bg-red-500/30"
                  title="Supprimer ce CR">
                  <Icon name="trash" size={14} color="#ef4444" />
                </button>
              )}
            </div>
          </div>
          {meeting.nextMeeting?.date && !isLandscape && (
            <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/15">
              <span className="text-[10px] font-bold text-amber-400 uppercase">Prochaine</span>
              <span className="text-xs text-gray-600">
                {dateFr(meeting.nextMeeting.date)}
                {meeting.nextMeeting.heure && ` à ${meeting.nextMeeting.heure}`}
                {meeting.nextMeeting.lieu && ` — ${meeting.nextMeeting.lieu}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Section toggle ─────────────────────────────────────────────── */}
      <div className={`flex gap-1 mx-4 p-1 bg-gray-100 rounded-2xl ${isLandscape ? 'mb-1' : 'mb-2'}`}>
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
        <SectionTab
          label="Terrain"
          active={activeSection === 'terrain'}
          onClick={() => setActiveSection('terrain')}
        />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeSection === 'observations' && meeting && (
          <ObservationsSection
            obsByCategory={obsByCategory}
            allContacts={allContacts}
            groupColorMap={groupColorMap}
            badgeNameMap={badgeNameMap}
            categoryCodes={categoryCodes}
            meetingNumber={meeting?.number}
            canEdit={canEdit}
            isLandscape={isLandscape}
            onEditObs={setEditingObs}
            onTapObs={handleOpenSwiper}
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
        {/* Terrain toujours monté (GPS en arrière-plan), masqué si pas actif */}
        <div className="h-full" style={{ display: activeSection === 'terrain' && meeting ? 'block' : 'none' }}>
          <GpsTrackingSection
            meeting={meeting}
            manager={canEdit ? manager : null}
            obsByCategory={obsByCategory}
            onToast={onToast}
          />
        </div>
      </div>

      {/* ── Image viewer modal ── */}
      {viewingImage && (
        <ImageViewerModal src={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {/* ── Observation swiper (lecture plein écran avec navigation) ── */}
      {swiperObsIdx != null && allObs[swiperObsIdx] && (
        <ObservationSwiper
          observations={allObs}
          currentIdx={swiperObsIdx}
          onChangeIdx={setSwiperObsIdx}
          onClose={() => setSwiperObsIdx(null)}
          onEdit={canEdit ? (obs) => { setSwiperObsIdx(null); setEditingObs(obs); } : null}
          allContacts={allContacts}
          groupColorMap={groupColorMap}
          badgeNameMap={badgeNameMap}
          categoryCodes={categoryCodes}
          meetingNumber={meeting?.number}
          onViewImage={setViewingImage}
        />
      )}

      {/* ── Observation edit sheet ── */}
      {canEdit && editingObs && (
        <Suspense fallback={null}>
          <ObservationEditSheet
            obs={editingObs}
            participantGroups={manager.activeParticipantGroups || groups}
            groupColorMap={groupColorMap}
            onUpdate={(obsId, patch) => {
              manager.updateObservation(obsId, patch);
              setEditingObs(prev => prev ? { ...prev, ...patch } : null);
            }}
            onDelete={(obsId) => manager.deleteObservation(obsId)}
            onClose={() => setEditingObs(null)}
            onViewImage={setViewingImage}
            companyId={companyId}
            crrId={chantier?.id}
          />
        </Suspense>
      )}

      {/* ── Modale duplication CR ── */}
      {showDuplicateModal && meeting && (
        <DuplicateModal
          meeting={meeting}
          onConfirm={handleDuplicate}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}
    </div>
  );
}

// ─── SOUS-COMPOSANTS ────────────────────────────────────────────────────────

function SectionTab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-bold rounded-xl transition ${
        active ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
      }`}>
      {label}
    </button>
  );
}

// ─── MODALE DUPLICATION ─────────────────────────────────────────────────────

function DuplicateModal({ meeting, onConfirm, onClose }) {
  const defaultDate = (() => {
    if (meeting.nextMeeting?.date) return meeting.nextMeeting.date;
    if (!meeting.date) return '';
    try {
      const d = new Date(meeting.date + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return ''; }
  })();
  const [date, setDate] = useState(defaultDate);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/3 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Icon name="file" size={16} color="#10b981" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Dupliquer le CR n°{meeting.number}</h3>
              <p className="text-[11px] text-gray-500">Observations, présences et diffusion reportées</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Date de la nouvelle réunion</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-gray-900"
            autoFocus
          />
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 active:bg-gray-200 transition">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(date)}
            disabled={!date}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 active:bg-emerald-600 disabled:opacity-40 transition shadow-sm"
          >
            Dupliquer
          </button>
        </div>
      </div>
    </>
  );
}

// ─── BADGE GROUPE COLORÉ ────────────────────────────────────────────────────

function GroupBadgeMobile({ name, badgeName, colorIndex }) {
  if (!name) return null;
  const c = getGroupColor(colorIndex ?? 0);
  const abbr = abbreviateGroup(badgeName || name);
  return (
    <span className={`inline-flex items-center justify-center rounded-full border font-bold leading-none whitespace-nowrap text-[9px] px-1.5 py-0.5 gap-1 min-w-[52px] shrink-0 ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {abbr}
    </span>
  );
}

// ─── SECTION OBSERVATIONS ───────────────────────────────────────────────────

function ObservationsSection({ obsByCategory, allContacts, groupColorMap, badgeNameMap = {}, categoryCodes = {}, meetingNumber, canEdit, isLandscape, onEditObs, onTapObs, onAddObs, onViewImage }) {
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
    return c ? c.name || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email || id : id;
  };

  const categories = Object.keys(obsByCategory);
  if (categories.length === 0) {
    return <div className="text-center py-8 text-gray-700 text-sm">Aucune observation.</div>;
  }

  return (
    <div className={isLandscape ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
      {categories.map(cat => {
        const obs = obsByCategory[cat];
        const expanded = expandedCats.has(cat);
        const doneCount = obs.filter(o => o.status === 'done').length;

        return (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Category header */}
            <button onClick={() => toggleCat(cat)}
              className="flex items-center justify-between w-full px-3 py-2.5 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-gray-900">{cat}</span>
                <span className="text-[10px] font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded">
                  {obs.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {doneCount > 0 && (
                  <span className="text-[10px] font-bold text-blue-600">{doneCount} fait</span>
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
                groupColorMap={groupColorMap}
                badgeNameMap={badgeNameMap}
                categoryCodes={categoryCodes}
                meetingNumber={meetingNumber}
                canEdit={canEdit}
                onEdit={() => onEditObs?.(o)}
                onTap={() => onTapObs?.(o)}
                onViewImage={onViewImage}
              />
            ))}

            {/* Add observation button */}
            {expanded && canEdit && (
              <button
                onClick={() => onAddObs?.(cat)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 text-blue-600 text-xs font-semibold border-t border-gray-100 hover:bg-blue-50 transition"
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

function ObservationCard({ obs, groupColorMap, badgeNameMap = {}, categoryCodes = {}, meetingNumber, canEdit, onTap, onViewImage }) {
  const st = statusMeta(obs.status);
  const text = stripHtml(obs.text);
  const images = obs.images || [];
  const num = obsDisplayNumber(obs, categoryCodes);
  const age = obsAge(obs, meetingNumber);
  const { hasIssue } = obsValidation(obs);

  return (
    <div
      className={`px-3 py-2.5 border-t bg-white active:bg-gray-50 cursor-pointer ${hasIssue ? 'border-l-2 border-l-red-400 border-t-gray-100' : 'border-gray-100'}`}
      onClick={() => onTap?.()}
    >
      {/* Status + emitter */}
      <div className="flex items-center gap-2 mb-1">
        {num && (
          <span className="text-[10px] font-bold text-slate-500 tabular-nums shrink-0" title="Numéro stable de l'observation">{num}</span>
        )}
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusColorMobile(obs.status)}`}>
          {st.label}
        </span>
        {obs.emitter && (
          <GroupBadgeMobile name={obs.emitter} badgeName={badgeNameMap[obs.emitter]} colorIndex={groupColorMap[obs.emitter]} />
        )}
        {age >= 1 && (
          <span className="text-[10px] text-gray-600 ml-auto shrink-0" title="Nombre de réunions depuis l'émission">depuis CR n°{obs.originMeetingNumber}</span>
        )}
        {canEdit && (
          <Icon name="edit" size={12} color="#475569" />
        )}
      </div>

      {/* Text */}
      {text && (
        <p className="text-[13px] text-gray-600 leading-relaxed mt-1 whitespace-pre-line line-clamp-4">
          {text}
        </p>
      )}

      {/* Footer : action by + deadline */}
      {(obs.actionBy || obs.actionDeadline) && (
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-700">
          {obs.actionBy && (
            <span className="flex items-center gap-1">
              <span className="font-semibold">Action :</span>
              <GroupBadgeMobile name={obs.actionBy} badgeName={badgeNameMap[obs.actionBy]} colorIndex={groupColorMap[obs.actionBy]} />
            </span>
          )}
          {obs.actionDeadline && (
            <span className="flex items-center gap-1">
              <span className="font-semibold">Échéance :</span> {dateFr(obs.actionDeadline)}
            </span>
          )}
        </div>
      )}

      {/* Signalement responsable manquant (obs ouverte / en cours) */}
      {hasIssue && (
        <div className="mt-1.5 text-[11px] font-semibold text-red-600">
          Responsable requis
        </div>
      )}

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
          {images.slice(0, 4).map((img, idx) => {
            const imgSrc = typeof img === 'string' ? img : img.src;
            return (
              <div
                key={idx}
                className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0"
                onClick={() => onViewImage?.(imgSrc)}
              >
                <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            );
          })}
          {images.length > 4 && (
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gray-600">+{images.length - 4}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OBSERVATION SWIPER (carrousel plein écran) ────────────────────────────

function SwiperSlide({ obs, groupColorMap, badgeNameMap = {}, categoryCodes = {}, meetingNumber, onViewImage }) {
  if (!obs) return <div className="w-full shrink-0" />;
  const st = statusMeta(obs.status);
  const text = obs.text || '';
  const images = obs.images || [];
  const num = obsDisplayNumber(obs, categoryCodes);
  const age = obsAge(obs, meetingNumber);

  return (
    <div className="px-5 py-4" style={{ scrollbarWidth: 'none', height: '100%', overflowY: 'auto' }}>
      {/* Catégorie */}
      {obs._cat && (
        <div className="mb-3 pb-2 border-b border-gray-100">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">{obs._cat}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        {num && <span className="text-[12px] font-bold text-slate-500 tabular-nums shrink-0" title="Numéro stable de l'observation">{num}</span>}
        <span className={`px-2.5 py-1 rounded-lg text-[12px] font-bold uppercase border ${statusColorMobile(obs.status)}`}>
          {st.label}
        </span>
        {obs.emitter && <GroupBadgeMobile name={obs.emitter} badgeName={badgeNameMap?.[obs.emitter]} colorIndex={groupColorMap?.[obs.emitter]} />}
        {obs.date && <span className="text-[13px] text-gray-400 ml-auto">{dateFr(obs.date)}</span>}
      </div>

      {text && (
        <div className="prose-mobile mb-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizeObsText(text)) }} />
      )}

      {images.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {images.map((img, idx) => {
            const imgSrc = typeof img === 'string' ? img : img.src;
            const lat = typeof img === 'object' ? img.lat : null;
            const lng = typeof img === 'object' ? img.lng : null;
            const hasGps = lat != null && lng != null;
            return (
              <div key={idx}>
                <img src={imgSrc} alt="" className="w-full rounded-xl border border-gray-200" loading="lazy"
                  onClick={() => onViewImage?.(imgSrc)} />
                {hasGps && (
                  <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[11px] italic text-blue-600 hover:underline mt-1 block">
                    Localisation
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(obs.actionBy || obs.actionDeadline) && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-1 mb-4">
          {obs.actionBy && <div className="text-xs text-gray-700 flex items-center gap-1"><span className="font-bold">Action par :</span> <GroupBadgeMobile name={obs.actionBy} badgeName={badgeNameMap?.[obs.actionBy]} colorIndex={groupColorMap?.[obs.actionBy]} /></div>}
          {obs.actionDeadline && <div className="text-xs text-gray-700"><span className="font-bold">Échéance :</span> {dateFr(obs.actionDeadline)}</div>}
        </div>
      )}

      {age >= 1 && (
        <div className="text-[11px] text-gray-400 italic">depuis CR n°{obs.originMeetingNumber}</div>
      )}
    </div>
  );
}

function ObservationSwiper({ observations, currentIdx, onChangeIdx, onClose, onEdit, allContacts, groupColorMap, badgeNameMap = {}, categoryCodes = {}, meetingNumber, onViewImage }) {
  const [touchStartX, setTouchStartX] = useState(null);
  const [offsetX, setOffsetX] = useState(0); // en pixels, drag en cours
  const [settling, setSettling] = useState(false); // transition retour en cours
  const containerRef = React.useRef(null);

  const canPrev = currentIdx > 0;
  const canNext = currentIdx < observations.length - 1;
  const slideW = containerRef.current?.offsetWidth || (window.innerWidth > 448 ? 448 : window.innerWidth);

  const snapTo = useCallback((dir) => {
    const next = currentIdx + dir;
    if (next < 0 || next >= observations.length) {
      // Rebond élastique
      setSettling(true);
      setOffsetX(0);
      setTimeout(() => setSettling(false), 300);
      return;
    }
    // Animer vers la slide cible puis changer l'index
    setSettling(true);
    setOffsetX(-dir * slideW);
    setTimeout(() => {
      // Changement d'index instantané + reset offset sans transition
      setSettling(false);
      setOffsetX(0);
      onChangeIdx(next);
    }, 300);
  }, [currentIdx, observations.length, onChangeIdx, slideW]);

  // Garde placé après le dernier hook (useCallback) — règle des hooks respectée.
  const obs = observations[currentIdx];
  if (!obs) return null;

  const handleTouchStart = (e) => {
    if (settling) return;
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (touchStartX == null || settling) return;
    const delta = e.touches[0].clientX - touchStartX;
    if ((!canPrev && delta > 0) || (!canNext && delta < 0)) {
      setOffsetX(delta * 0.15); // résistance forte aux bords
    } else {
      setOffsetX(delta);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX == null) return;
    setTouchStartX(null);
    const threshold = slideW * 0.2; // 20% de la largeur
    if (offsetX < -threshold && canNext) {
      snapTo(1);
    } else if (offsetX > threshold && canPrev) {
      snapTo(-1);
    } else {
      // Retour élastique
      setSettling(true);
      setOffsetX(0);
      setTimeout(() => setSettling(false), 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center pt-2 pb-2 px-4 shrink-0 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center justify-between w-full">
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
              <Icon name="close" size={18} color="#6b7280" />
            </button>
            <div className="text-center flex-1">
              <span className="text-[14px] font-bold text-gray-900">{obs._cat}</span>
              <span className="text-[10px] text-gray-400 ml-2">{currentIdx + 1} / {observations.length}</span>
            </div>
            {onEdit && (
              <button onClick={() => onEdit(obs)} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
                <Icon name="edit" size={16} color="#3b82f6" />
              </button>
            )}
          </div>

          {/* Dots indicator */}
          <div className="flex items-center gap-1 mt-2">
            {observations.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${
                i === currentIdx ? 'w-4 h-1.5 bg-gray-900' : 'w-1.5 h-1.5 bg-gray-300'
              }`} />
            ))}
          </div>
        </div>

        {/* Carousel track — 3 slides côte à côte */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-hidden"
          style={{ touchAction: 'pan-y' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex h-full"
            style={{
              transform: `translateX(calc(-${slideW}px + ${offsetX}px))`,
              transition: settling ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
              willChange: 'transform',
            }}
          >
            <div style={{ width: slideW, flexShrink: 0, height: '100%', overflowY: 'auto' }}>
              {canPrev && <SwiperSlide obs={observations[currentIdx - 1]} allContacts={allContacts} groupColorMap={groupColorMap} badgeNameMap={badgeNameMap} categoryCodes={categoryCodes} meetingNumber={meetingNumber} onViewImage={onViewImage} />}
            </div>
            <div style={{ width: slideW, flexShrink: 0, height: '100%', overflowY: 'auto' }}>
              <SwiperSlide obs={observations[currentIdx]} allContacts={allContacts} groupColorMap={groupColorMap} badgeNameMap={badgeNameMap} categoryCodes={categoryCodes} meetingNumber={meetingNumber} onViewImage={onViewImage} />
            </div>
            <div style={{ width: slideW, flexShrink: 0, height: '100%', overflowY: 'auto' }}>
              {canNext && <SwiperSlide obs={observations[currentIdx + 1]} allContacts={allContacts} groupColorMap={groupColorMap} badgeNameMap={badgeNameMap} categoryCodes={categoryCodes} meetingNumber={meetingNumber} onViewImage={onViewImage} />}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 shrink-0">
          <button onClick={() => snapTo(-1)} disabled={!canPrev || settling}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 disabled:opacity-20 active:bg-gray-200 transition">
            ← Précédente
          </button>
          <button onClick={() => snapTo(1)} disabled={!canNext || settling}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 disabled:opacity-20 active:bg-gray-200 transition">
            Suivante →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION PARTICIPANTS ───────────────────────────────────────────────────

function ParticipantsSection({ groups, attendance, diffusion, canEdit, onSetAttendance, onSetDiffusion }) {
  if (!groups || groups.length === 0) {
    return <div className="text-center py-8 text-gray-700 text-sm">Aucun participant.</div>;
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
        <div className="text-[10px] text-gray-700 text-center px-2">
          Tapez sur le badge pour changer la présence · Tapez sur Diff. pour basculer la diffusion
        </div>
      )}
      {groups.map((group, gi) => {
        const color = getGroupColor(gi);
        const contacts = flattenGroupContacts(group);
        if (contacts.length === 0) return null;

        return (
          <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <div className={`w-2.5 h-2.5 rounded-full`}
                style={{ backgroundColor: `rgb(${color.rgb.join(',')})` }} />
              <span className="text-[15px] font-bold text-gray-900">{group.name}</span>
              {group.subLabel && (
                <span className="text-[10px] text-gray-700">{group.subLabel}</span>
              )}
              <span className="ml-auto text-[10px] text-gray-700 font-bold">{contacts.length}</span>
            </div>

            {/* Contacts */}
            {contacts.map(c => {
              const pres = attendance[c.id] || 'not_summoned';
              const diff = diffusion?.[c.id] || false;
              const fullName = c.name || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email || '—';

              return (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-600 truncate">{fullName}</div>
                    {(c.fonction || c.subLabel) && (
                      <div className="text-[10px] text-gray-700 truncate">{c.fonction || c.subLabel}</div>
                    )}
                  </div>
                  {/* Diffusion toggle */}
                  {canEdit && (
                    <button
                      onClick={() => onSetDiffusion?.(c.id, !diff)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                        diff
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-white text-gray-600 border border-gray-100'
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
