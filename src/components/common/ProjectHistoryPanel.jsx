// src/components/common/ProjectHistoryPanel.jsx
//
// Panneau d'historique des sauvegardes d'un projet.
// Affiche les 50 dernières entrées avec : qui, quand, quoi.
//
// Usage dans ProjectView (bouton "Historique" dans la toolbar) :
//   <ProjectHistoryPanel
//     companyId={companyId}
//     projectId={project.id}
//     isOpen={showHistory}
//     onClose={() => setShowHistory(false)}
//   />

import React from 'react';
import { X, History, Clock, User, FileEdit, ChevronDown, ChevronUp } from 'lucide-react';
import { useProjectHistory } from '../../hooks/useProjectHistory';

// Libellés lisibles pour les clés de champs
const FIELD_LABELS = {
  name:          'Nom du projet',
  client:        'Client / MOA',
  chapters:      'Chapitres / articles',
  tranches:      'Tranches',
  scoringConfig: 'Config. notation',
  analysis:      'Offres entreprises',
  rao:           'Module RAO',
  branding:      'Branding',
  clientPercent: '% client',
  hasPSE:        'PSE activée',
  dateRemise:    'Date remise',
  signatories:   'Signataires',
  cctpSelectedIds: 'Sélection CCTP',
  rcSelectedIds:   'Sélection RC',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch { return iso; }
};

const FieldBadge = ({ field }) => (
  <span className="inline-block px-2 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded-md font-mono">
    {FIELD_LABELS[field] || field}
  </span>
);

const HistoryEntry = ({ entry, isFirst }) => {
  const [expanded, setExpanded] = React.useState(false);
  const fields = entry.changedFields || [];

  return (
    <div className={`border-l-2 pl-4 pb-4 ${isFirst ? 'border-emerald-500' : 'border-slate-700'}`}>
      {/* Dot sur la timeline */}
      <div className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full border-2 mt-1
        ${isFirst ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-600 border-slate-500'}`}
      />

      {/* En-tête de l'entrée */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${isFirst ? 'text-emerald-400' : 'text-slate-300'}`}>
              {isFirst ? '● Dernière version' : fmtDate(entry.savedAt)}
            </span>
            {isFirst && (
              <span className="text-[10px] text-slate-500">{fmtDate(entry.savedAt)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <User size={10} className="text-slate-500 shrink-0" />
            <span className="text-[11px] text-slate-500 truncate">{entry.savedBy || '—'}</span>
          </div>
        </div>

        {fields.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Champs modifiés */}
      {fields.length > 0 && !expanded && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {fields.slice(0, 4).map(f => <FieldBadge key={f} field={f} />)}
          {fields.length > 4 && (
            <span className="text-[10px] text-slate-500">+{fields.length - 4}</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {fields.map(f => <FieldBadge key={f} field={f} />)}
          </div>
          {entry.snapshot && (
            <div className="bg-slate-800/60 rounded-lg p-2.5 text-[11px] text-slate-400 space-y-1">
              {entry.snapshot.name && (
                <div><span className="text-slate-500">Projet :</span> {entry.snapshot.name}</div>
              )}
              {entry.snapshot.client && (
                <div><span className="text-slate-500">Client :</span> {entry.snapshot.client}</div>
              )}
              {entry.snapshot.tranches?.length > 0 && (
                <div>
                  <span className="text-slate-500">Tranches :</span>{' '}
                  {entry.snapshot.tranches.map(t => t.name || t.id).join(', ')}
                </div>
              )}
              {entry.snapshot.companiesCount > 0 && (
                <div>
                  <span className="text-slate-500">Offres :</span>{' '}
                  {entry.snapshot.companiesCount} entreprise(s)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ProjectHistoryPanel({ companyId, projectId, isOpen, onClose }) {
  const { entries, loading } = useProjectHistory(companyId, projectId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-[#0d1117] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-xl">
              <History size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Historique</h3>
              <p className="text-[10px] text-slate-500">{entries.length} sauvegarde(s)</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
              <Clock size={16} className="animate-spin" />
              Chargement…
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              <FileEdit size={32} className="mx-auto mb-3 opacity-30" />
              <p>Aucun historique disponible.</p>
              <p className="text-xs mt-1 text-slate-600">
                Les sauvegardes futures apparaîtront ici.
              </p>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="relative ml-1">
              {entries.map((entry, i) => (
                <HistoryEntry key={entry.id} entry={entry} isFirst={i === 0} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 shrink-0">
          <p className="text-[10px] text-slate-600 leading-snug">
            Conserve les 50 dernières sauvegardes.
            Pour restaurer une version, contactez l'administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}