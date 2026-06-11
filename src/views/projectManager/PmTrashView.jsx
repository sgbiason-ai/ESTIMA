import React from 'react';
import { Trash2, RotateCcw, FlameKindling, Clock } from 'lucide-react';
import { formatRelativeDate } from './relativeDate';
import { TRASH_TTL_DAYS } from './hooks/usePmCloudProjects';

const daysLeft = (deletedAt) => {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(TRASH_TTL_DAYS - elapsed));
};

/**
 * PmTrashView — corbeille des affaires (soft delete).
 * Restauration 1 clic ou suppression définitive ; purge auto à 30 jours.
 */
const PmTrashView = ({ projects, deletingId, onRestore, onPurge, onEmptyTrash, onBack }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Corbeille</h3>
          <span className="text-xs text-gray-500">{projects.length} affaire{projects.length > 1 ? 's' : ''}</span>
        </div>
        {projects.length > 0 && (
          <button onClick={onEmptyTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
            <FlameKindling size={14} /> Vider la corbeille
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
            <Trash2 size={32} className="text-gray-300" />
          </div>
          <p className="text-base font-medium text-gray-600">La corbeille est vide</p>
          <p className="text-sm text-center max-w-sm text-gray-400">Les affaires supprimées arrivent ici et sont définitivement effacées après {TRASH_TTL_DAYS} jours.</p>
          <button onClick={onBack} className="text-xs text-blue-500 hover:text-blue-600 transition-colors">&larr; Retour aux projets</button>
        </div>
      ) : (
        <div className="flex flex-col gap-0 border border-gray-200/60 rounded-2xl overflow-hidden bg-white">
          {projects.map(proj => {
            const left = daysLeft(proj.deletedAt);
            const isBusy = deletingId === proj.id;
            return (
              <div key={proj.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{proj.name || 'Projet sans nom'}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                    {proj.code && <span className="font-medium">N° {proj.code}</span>}
                    <span className="flex items-center gap-1"><Clock size={10} /> supprimée {formatRelativeDate(proj.deletedAt)}</span>
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  left <= 3 ? 'bg-red-50 text-red-500 border border-red-200/60' : 'bg-gray-100 text-gray-500'
                }`}>
                  {left === 0 ? 'purge imminente' : `${left} j restant${left > 1 ? 's' : ''}`}
                </span>
                <button onClick={() => onRestore(proj)} disabled={isBusy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/60 hover:bg-emerald-100 transition-colors disabled:opacity-50 shrink-0">
                  <RotateCcw size={13} /> Restaurer
                </button>
                <button onClick={() => onPurge(proj)} disabled={isBusy}
                  title="Supprimer définitivement" aria-label="Supprimer définitivement"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PmTrashView;
