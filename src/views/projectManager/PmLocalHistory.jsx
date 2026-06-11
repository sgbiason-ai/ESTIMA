import React from 'react';
import { Database, ArrowRight, Clock } from 'lucide-react';
import { formatRelativeDate } from './relativeDate';

/**
 * PmLocalHistory
 * Grille des projets récents stockés en localStorage.
 */
const PmLocalHistory = ({ recentProjects, onLoadFromHistory }) => {

  if (recentProjects.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
        <Database size={32} className="text-gray-300" />
      </div>
      <p className="text-base font-medium text-gray-600">Aucun historique local</p>
      <p className="text-sm text-center max-w-sm text-gray-400">
        Les projets ouverts ou sauvegardés localement apparaîtront automatiquement ici.
      </p>
    </div>
  );

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
      {recentProjects.map((item) => {
        const date    = new Date(item.lastModified);
        const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const isToday = new Date().toDateString() === date.toDateString();

        // code/location sont stockés dans l'index depuis la v2.5 ; fallback sur le
        // backup complet uniquement pour les entrées antérieures (legacy)
        let extraInfo = (item.code !== undefined || item.location !== undefined)
          ? { code: item.code, location: item.location }
          : null;
        if (!extraInfo) {
          try {
            const raw  = localStorage.getItem(`project_backup_${item.id}`);
            const full = raw ? JSON.parse(raw) : null;
            if (full?.code || full?.location) extraInfo = { code: full.code, location: full.location };
          } catch { /* ignore */ }
        }

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onLoadFromHistory(item.id); }}
            onClick={() => onLoadFromHistory(item.id)}
            className="group relative cursor-pointer bg-white border border-gray-200/60 hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5 rounded-2xl p-5 transition-all duration-200 flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="font-semibold text-base leading-snug text-gray-900 flex-1">
                {item.name}
              </h4>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transform translate-x-1 group-hover:translate-x-0 transition-all shrink-0" />
            </div>

            <div className="flex items-center gap-3 mb-5 min-h-[24px]">
              {extraInfo?.code && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200/60">
                  N° {extraInfo.code}
                </span>
              )}
              {extraInfo?.location && (
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-gray-400">📍</span> {extraInfo.location}
                </span>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-500" title={`${dateStr} à ${timeStr}`}>
                <Clock size={14} className={isToday ? 'text-emerald-500' : 'text-gray-300'} />
                <span className={isToday ? 'text-gray-700 font-medium' : ''}>{formatRelativeDate(date)}</span>
              </div>
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                <strong className="text-gray-700">{item.chapterCount}</strong> chapitres
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PmLocalHistory;
