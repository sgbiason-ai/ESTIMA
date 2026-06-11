import React from 'react';
import { Database, ArrowRight, Clock } from 'lucide-react';

/**
 * PmLocalHistory
 * Grille des projets récents stockés en localStorage.
 */
const PmLocalHistory = ({ recentProjects, onLoadFromHistory }) => {

  if (recentProjects.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2">
        <Database size={32} className="text-slate-400" />
      </div>
      <p className="text-base font-medium text-slate-300">Aucun historique local</p>
      <p className="text-sm text-center max-w-sm">
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
            onClick={() => onLoadFromHistory(item.id)}
            className="group relative cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 rounded-xl p-5 transition-all duration-200 flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="font-semibold text-base leading-snug text-slate-100 group-hover:text-white flex-1">
                {item.name}
              </h4>
              <ArrowRight size={16} className="text-slate-600 group-hover:text-slate-400 transform translate-x-1 group-hover:translate-x-0 transition-all" />
            </div>

            <div className="flex items-center gap-3 mb-5 min-h-[24px]">
              {extraInfo?.code && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  N° {extraInfo.code}
                </span>
              )}
              {extraInfo?.location && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="text-slate-500">📍</span> {extraInfo.location}
                </span>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-400" title={`${dateStr} à ${timeStr}`}>
                <Clock size={14} className={isToday ? 'text-blue-400' : 'text-slate-500'} />
                <span className={isToday ? 'text-slate-300 font-medium' : ''}>{isToday ? "Aujourd'hui" : dateStr}</span>
              </div>
              <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                <strong>{item.chapterCount}</strong> chapitres
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PmLocalHistory;
