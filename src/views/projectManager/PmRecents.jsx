import React from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { NEUTRAL_COLOR } from './folderColors';
import { formatRelativeDate } from './relativeDate';

/**
 * PmRecents — bandeau des affaires récemment sauvegardées.
 * Affiché en tête de la vue « Tous » (sans recherche ni filtre).
 * Clic sur une tuile → ouvre le panneau de détails (onOpen).
 */
const PmRecents = ({ projects, folderColorMap = {}, onOpen, activeId }) => {
  if (!projects?.length) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        <Clock size={12} /> Récemment ouverts
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {projects.map(proj => {
          const fc = proj.folderId ? (folderColorMap[proj.folderId] || NEUTRAL_COLOR) : NEUTRAL_COLOR;
          const isActive = proj.id === activeId;
          return (
            <button
              key={proj.id}
              onClick={() => onOpen?.(proj)}
              title={`${proj.name || 'Projet sans nom'} — voir les détails`}
              className={`group relative text-left bg-white border rounded-2xl p-3 pl-4 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                isActive ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200/60 hover:border-gray-300'
              }`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${fc.stripe}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold text-gray-900 truncate flex-1">{proj.name || 'Projet sans nom'}</div>
                <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
                {proj.code && <span className="font-medium text-gray-600">N° {proj.code}</span>}
                <span className="truncate">{formatRelativeDate(proj.lastSaved)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PmRecents;
