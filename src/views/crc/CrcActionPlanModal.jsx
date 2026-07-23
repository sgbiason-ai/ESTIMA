// src/views/crc/CrcActionPlanModal.jsx
//
// Plan d'actions transversal : toutes les actions datees (« POUR LE ») non
// soldees du dernier CR de chaque chantier EN COURS, en un seul echeancier
// (sections En retard / Sous 7 jours / Plus tard) filtrable par chantier et
// par responsable (pastilles PAR). Clic sur une ligne → ouvre l'affaire.
//
// Aucune lecture Firestore : s'appuie sur les chantiers deja charges par CrcView.

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, AlertCircle, FolderOpen, Filter } from 'lucide-react';
import {
  buildActionRows, collectResponsables, filterRows,
  SECTION_ORDER, SECTION_LABELS,
} from '../../utils/crcActionPlan';
import { OBSERVATION_STATUSES } from '../../data/crrData';

// "mer. 29 juil." — jour de semaine inclus : c'est un echeancier
const formatDeadline = (isoDate) => {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const opts = d.getFullYear() === now.getFullYear()
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', opts);
  } catch { return ''; }
};

const SECTION_STYLES = {
  overdue: 'bg-red-50 text-red-700 border-red-200',
  week: 'bg-amber-50 text-amber-700 border-amber-200',
  later: 'bg-gray-50 text-gray-500 border-gray-200',
};

const StatusChip = ({ status }) => {
  const st = OBSERVATION_STATUSES.find((s) => s.value === status);
  if (!st) return null;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${st.bg} ${st.color}`}>
      {st.label}
    </span>
  );
};

const ParBadges = ({ value }) => {
  const names = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {names.map((n) => (
        <span key={n} className="px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200/60 text-[10px] font-medium text-gray-600 whitespace-nowrap">
          {n}
        </span>
      ))}
    </span>
  );
};

export default function CrcActionPlanModal({ isOpen, onClose, chantiers, onOpenChantier }) {
  const [filterChantier, setFilterChantier] = useState('');
  const [filterResp, setFilterResp] = useState('');

  // Recalcule a chaque ouverture (les chantiers peuvent avoir change)
  const allRows = useMemo(
    () => (isOpen ? buildActionRows(chantiers) : []),
    [isOpen, chantiers]
  );

  const responsables = useMemo(() => collectResponsables(allRows), [allRows]);

  // Options du filtre chantier : uniquement ceux qui ont des actions
  const chantierOptions = useMemo(() => {
    const seen = new Map();
    for (const r of allRows) if (!seen.has(r.chantierId)) seen.set(r.chantierId, r.chantierNom);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [allRows]);

  const rows = useMemo(
    () => filterRows(allRows, { chantierId: filterChantier || null, responsable: filterResp || null }),
    [allRows, filterChantier, filterResp]
  );

  const overdueCount = useMemo(() => rows.filter((r) => r.section === 'overdue').length, [rows]);

  // Reinitialiser les filtres a l'ouverture ; ESC pour fermer
  useEffect(() => {
    if (!isOpen) return;
    setFilterChantier('');
    setFilterResp('');
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = SECTION_ORDER
    .map((s) => ({ id: s, rows: rows.filter((r) => r.section === s) }))
    .filter((s) => s.rows.length > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="bg-[#f5f5f7] rounded-3xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-4 flex items-center gap-4 flex-wrap">
          <CalendarClock size={18} className="text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Plan d'actions</h2>
          <div className="text-xs text-gray-400">
            {rows.length} action{rows.length > 1 ? 's' : ''}
            {(filterChantier || filterResp) && ` (filtrées sur ${allRows.length})`}
          </div>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
              <AlertCircle size={10} />
              {overdueCount} en retard
            </span>
          )}
          <div className="flex-1" />

          {/* Filtres */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-gray-400" />
            <select
              value={filterChantier}
              onChange={(e) => setFilterChantier(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 border border-gray-200/60 text-xs focus:outline-none focus:border-blue-400 max-w-[200px]"
            >
              <option value="">Tous les chantiers</option>
              {chantierOptions.map(([id, nom]) => (
                <option key={id} value={id}>{nom}</option>
              ))}
            </select>
            <select
              value={filterResp}
              onChange={(e) => setFilterResp(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 border border-gray-200/60 text-xs focus:outline-none focus:border-blue-400 max-w-[170px]"
            >
              <option value="">Tous les responsables</option>
              {responsables.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
            title="Fermer (Echap)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-y-auto p-6">
          {rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
              <CalendarClock size={48} strokeWidth={1.5} className="mb-3 opacity-50" />
              <p className="text-sm">
                {allRows.length === 0
                  ? 'Aucune action datée à venir sur les chantiers en cours.'
                  : 'Aucune action ne correspond à ces filtres.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-200/60">
                    <th className="px-4 py-2.5 font-semibold w-[110px]">Pour le</th>
                    <th className="px-3 py-2.5 font-semibold w-[80px]">N°</th>
                    <th className="px-3 py-2.5 font-semibold w-[180px]">Chantier</th>
                    <th className="px-3 py-2.5 font-semibold">Observation</th>
                    <th className="px-3 py-2.5 font-semibold w-[150px]">Par</th>
                    <th className="px-4 py-2.5 font-semibold w-[90px]">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section) => (
                    <React.Fragment key={section.id}>
                      <tr>
                        <td colSpan={6} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide border-y ${SECTION_STYLES[section.id]}`}>
                          {SECTION_LABELS[section.id]} · {section.rows.length}
                        </td>
                      </tr>
                      {section.rows.map((r) => (
                        <tr
                          key={r.key}
                          onClick={() => onOpenChantier(r.chantierId)}
                          className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          title={`Ouvrir « ${r.chantierNom} » (CR n°${r.meetingNumber})`}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className={`font-semibold ${r.section === 'overdue' ? 'text-red-700' : 'text-gray-800'}`}>
                              {formatDeadline(r.deadline)}
                            </div>
                            {r.section === 'overdue' && (
                              <div className="text-[10px] text-red-500">
                                {r.daysLate} j de retard
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500 whitespace-nowrap">{r.number || '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                              <FolderOpen size={11} className="shrink-0 text-gray-300" />
                              <span className="truncate max-w-[150px]">{r.chantierNom}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">
                            <span className="line-clamp-2">{r.text || <span className="text-gray-300">(sans texte)</span>}</span>
                          </td>
                          <td className="px-3 py-2.5"><ParBadges value={r.actionBy} /></td>
                          <td className="px-4 py-2.5"><StatusChip status={r.status} /></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
