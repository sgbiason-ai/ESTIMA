// src/components/crr/CrrHeader.jsx
import React from 'react';
import { Calendar, MapPin, Clock, Hash } from 'lucide-react';
import { MEETING_TYPES } from '../../data/crrData';

const CrrHeader = ({
  meeting,
  projectName,
  updateMeetingField,
  updateNextMeeting,
}) => {
  if (!meeting) return null;

  const typeObj = MEETING_TYPES.find((t) => t.value === meeting.type);

  return (
    <div className="space-y-4">
      {/* Bandeau titre */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            {/* Type de reunion */}
            <select
              value={meeting.type}
              onChange={(e) => updateMeetingField('type', e.target.value)}
              className="bg-white/20 backdrop-blur text-white text-lg font-bold rounded-lg px-3 py-1.5 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-800"
            >
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Numero */}
            <div className="flex items-center gap-2">
              <Hash size={16} className="text-white/70" />
              <span className="text-white/70 text-sm">n°</span>
              <input
                type="number"
                min="1"
                value={meeting.number}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v > 0) updateMeetingField('number', v);
                }}
                className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5 text-2xl font-black border border-white/30 text-white text-center w-20 focus:outline-none focus:ring-2 focus:ring-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-white/70" />
            <span className="text-white/70 text-sm">Date :</span>
            <input
              type="date"
              value={meeting.date}
              onChange={(e) => updateMeetingField('date', e.target.value)}
              className="bg-white/20 backdrop-blur text-white rounded-lg px-3 py-1.5 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
            />
          </div>
        </div>

        {/* Nom du projet */}
        <div className="mt-3 text-center">
          <span className="text-xl font-black tracking-wide uppercase opacity-90">
            {projectName || 'NOM DU PROJET'}
          </span>
        </div>
      </div>

      {/* Prochaine reunion */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-red-500" />
          PROCHAINE REUNION
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-medium mb-1 block">
              <MapPin size={10} className="inline mr-1" />
              Lieu
            </label>
            <input
              type="text"
              value={meeting.nextMeeting?.lieu || ''}
              onChange={(e) => updateNextMeeting('lieu', e.target.value)}
              placeholder="Lieu de la prochaine reunion"
              spellCheck
              lang="fr"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-slate-800"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium mb-1 block">
              <Clock size={10} className="inline mr-1" />
              Heure
            </label>
            <input
              type="text"
              value={meeting.nextMeeting?.heure || ''}
              onChange={(e) => updateNextMeeting('heure', e.target.value)}
              placeholder="14h00"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-slate-800"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium mb-1 block">
              <Calendar size={10} className="inline mr-1" />
              Date
            </label>
            <input
              type="date"
              value={meeting.nextMeeting?.date || ''}
              onChange={(e) => updateNextMeeting('date', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-red-600 font-bold"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrrHeader;
