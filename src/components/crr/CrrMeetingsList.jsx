// src/components/crr/CrrMeetingsList.jsx
import React from 'react';
import { Plus, Trash2, FileText, ChevronRight, Calendar, Hash, Settings, X, GripVertical, Building2 } from 'lucide-react';
import { MEETING_TYPES } from '../../data/crrData';
import { confirm } from '../../utils/globalUI';
import { formatDateFr } from '../../utils/dateHelpers';

const CrrMeetingsList = ({
  meetings,
  activeMeetingId,
  setActiveMeetingId,
  createMeeting,
  deleteMeeting,
  saveStatus,
}) => {
  const formatDate = formatDateFr;

  const getMeetingLabel = (meeting) => {
    const typeObj = MEETING_TYPES.find((t) => t.value === meeting.type);
    return typeObj ? typeObj.label : 'Reunion';
  };

  const handleDelete = async (e, meetingId) => {
    e.stopPropagation();
    const ok = await confirm('Supprimer ce compte rendu ?', { title: 'Suppression', danger: true });
    if (ok) deleteMeeting(meetingId);
  };

  const saveIndicator = {
    saved: { color: 'text-emerald-400', label: 'Sauvegarde' },
    saving: { color: 'text-blue-400 animate-pulse', label: 'Sauvegarde...' },
    waiting: { color: 'text-amber-400', label: 'En attente...' },
    error: { color: 'text-red-400', label: 'Erreur' },
  };
  const si = saveIndicator[saveStatus] || saveIndicator.saved;

  return (
    <div className="w-72 min-w-[288px] bg-slate-900 border-r border-slate-700/50 flex flex-col h-full">
      {/* En-tete */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-emerald-400" />
            Comptes Rendus
          </h2>
          <span className={`text-[10px] ${si.color}`}>{si.label}</span>
        </div>

        <button
          onClick={createMeeting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all text-sm font-medium border border-emerald-500/30"
        >
          <Plus size={14} />
          Nouvelle reunion
        </button>
      </div>

      {/* Liste des reunions */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {meetings.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-8 px-4">
            Aucun compte rendu.
            <br />
            Cliquez sur "Nouvelle reunion" pour commencer.
          </div>
        )}

        {[...meetings].reverse().map((meeting) => {
          const isActive = meeting.id === activeMeetingId;
          return (
            <button
              key={meeting.id}
              onClick={() => setActiveMeetingId(meeting.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group relative ${
                isActive
                  ? 'bg-emerald-500/20 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/30 text-emerald-300'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}
                  >
                    {meeting.number}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-medium truncate ${
                        isActive ? 'text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {getMeetingLabel(meeting)}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar size={9} />
                      {formatDate(meeting.date)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(e, meeting.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Indicateur observations en cours */}
              {meeting.observations?.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 ml-9">
                  {(() => {
                    const open = meeting.observations.filter((o) => o.status === 'open').length;
                    const prog = meeting.observations.filter((o) => o.status === 'in_progress').length;
                    const done = meeting.observations.filter((o) => o.status === 'done').length;
                    return (
                      <>
                        {open > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                            {open} ouv.
                          </span>
                        )}
                        {prog > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            {prog} enc.
                          </span>
                        )}
                        {done > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {done} fait
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Indicateur de sauvegarde en bas */}
      <div className="p-3 border-t border-slate-700/50">
        <div className={`text-center text-[10px] ${si.color}`}>{si.label}</div>
      </div>
    </div>
  );
};

export default CrrMeetingsList;
