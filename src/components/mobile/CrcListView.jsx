import React from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';

export default function CrcListView({ chantiers, loading, onSelect, onRefresh, isLandscape }) {
  return (
    <div className="pb-2">
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200/60 text-center">
          <div className="text-lg font-bold text-gray-900">{chantiers.length}</div>
          <div className="text-xs text-gray-400 font-medium">Chantiers</div>
        </div>
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200/60 text-center">
          <div className="text-lg font-bold text-gray-900">{chantiers.reduce((s, c) => s + c.meetingCount, 0)}</div>
          <div className="text-xs text-gray-400 font-medium">Réunions</div>
        </div>
        <button onClick={onRefresh} className="bg-white rounded-xl p-3 border border-gray-200/60 flex items-center justify-center hover:bg-gray-50 transition active:scale-[0.97]">
          <Icon name="refresh" size={18} color="#3b82f6" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {!loading && chantiers.length > 0 && (
      <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
      {chantiers.map(ch => (
        <button key={ch.id} onClick={() => onSelect(ch)}
          className={`block p-3.5 bg-white rounded-xl border border-gray-200/60 text-left transition hover:shadow-md active:scale-[0.98] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="file" size={18} color="#d97706" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{ch.name}</div>
              {ch.lieu && <div className="text-xs text-gray-400 font-medium mt-0.5 truncate">{ch.lieu}</div>}
              <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 font-medium">
                <span>{ch.meetingCount} réunion{ch.meetingCount > 1 ? 's' : ''}</span>
                {ch.lastMeetingDate && (<><span className="text-gray-300">·</span><span>Dernière : {dateFr(ch.lastMeetingDate)}</span></>)}
                <span className="ml-auto"><Icon name="chevron" size={14} color="#d1d5db" /></span>
              </div>
            </div>
          </div>
        </button>
      ))}
      </div>
      )}

      {!loading && chantiers.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">Aucun compte rendu de chantier</div>
      )}
    </div>
  );
}
