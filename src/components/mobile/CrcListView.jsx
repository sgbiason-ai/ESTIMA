import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { collectResponsables, filterRows, SECTION_ORDER, SECTION_LABELS } from '../../utils/crcActionPlan';
import { OBSERVATION_STATUSES } from '../../data/crrData';
import { normalizeObsText } from '../../utils/formatObsText';
import { sanitizeHtml } from '../../utils/helpers';

const SECTION_COLORS = {
  overdue: 'bg-red-100 text-red-700',
  week: 'bg-amber-100 text-amber-800',
  later: 'bg-gray-100 text-gray-500',
};

// ── Échéancier transversal (onglet Actions) ─────────────────────────────────
function ActionsList({ actionRows, chantiers, onSelect }) {
  const [resp, setResp] = useState('');
  const responsables = useMemo(() => collectResponsables(actionRows), [actionRows]);
  const rows = useMemo(() => filterRows(actionRows, { responsable: resp || null }), [actionRows, resp]);

  const openChantier = (row) => {
    const ch = chantiers.find((c) => c.id === row.chantierId);
    if (ch) onSelect(ch);
  };

  const sections = SECTION_ORDER
    .map((s) => ({ id: s, rows: rows.filter((r) => r.section === s) }))
    .filter((s) => s.rows.length > 0);

  if (actionRows.length === 0) {
    return <div className="text-center py-10 text-gray-400 text-sm">Aucune action datée à venir</div>;
  }

  return (
    <div>
      {/* Filtre responsable (« pour moi ou quelqu'un d'autre ») */}
      {responsables.length > 0 && (
        <select
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          className="mx-4 mb-2 w-[calc(100%-2rem)] px-3 py-2 rounded-xl bg-white border border-gray-200/60 text-[13px] font-medium text-gray-700 focus:outline-none"
        >
          <option value="">Tous les responsables</option>
          {responsables.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}

      {rows.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">Aucune action pour ce responsable</div>
      )}

      {sections.map((section) => (
        <div key={section.id}>
          <div className={`mx-4 mb-1.5 mt-2 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide inline-block ${SECTION_COLORS[section.id]}`}>
            {SECTION_LABELS[section.id]} · {section.rows.length}
          </div>
          {section.rows.map((r) => {
            const st = OBSERVATION_STATUSES.find((s) => s.value === r.status);
            return (
              <div key={r.key} role="button" tabIndex={0}
                onClick={() => openChantier(r)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChantier(r); } }}
                className="block p-3.5 bg-white rounded-xl border border-gray-200/60 w-[calc(100%-2rem)] mx-4 mb-2 transition active:scale-[0.98]"
              >
                <div className="flex items-center gap-2 text-[12px] font-semibold">
                  <span className={r.section === 'overdue' ? 'text-red-700' : 'text-gray-800'}>
                    {dateFr(r.deadline)}
                  </span>
                  {r.section === 'overdue' && (
                    <span className="text-[10px] font-bold text-red-500">{r.daysLate} j de retard</span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-gray-400">{r.number}</span>
                </div>
                {/* Texte d'observation = HTML (cf. formatObsText) : le rendre
                    brut afficherait les balises. Blocs en ligne pour tenir sur
                    2 lignes dans la carte. */}
                {r.text ? (
                  <div
                    className="text-[13px] text-gray-700 mt-1 line-clamp-2 [&_div]:inline [&_p]:inline [&_ul]:inline [&_ol]:inline [&_li]:inline [&_li]:mr-2 [&_li]:before:content-['•_'] [&_li]:before:text-gray-400 [&_br]:hidden"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizeObsText(r.text)) }}
                  />
                ) : (
                  <div className="text-[13px] text-gray-400 mt-1">(sans texte)</div>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-gray-400 truncate max-w-[45%]">{r.chantierNom}</span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    {(r.actionBy || '').split(',').map((s) => s.trim()).filter(Boolean).map((n) => (
                      <span key={n} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-gray-600">{n}</span>
                    ))}
                    {st && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${st.bg} ${st.color}`}>{st.label}</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function CrcListView({ chantiers, actionRows = [], loading, error, onSelect, onRefresh, onSetArchived, isLandscape }) {
  // 'active' | 'actions' | 'archived' — les chantiers terminés restent masqués
  // par défaut : la vue terrain n'affiche que ce sur quoi on intervient encore.
  const [view, setView] = useState('active');

  const { active, archived } = useMemo(() => {
    const a = [], ar = [];
    for (const c of chantiers) (c.archivedAt ? ar : a).push(c);
    return { active: a, archived: ar };
  }, [chantiers]);

  const overdueCount = useMemo(() => actionRows.filter((r) => r.section === 'overdue').length, [actionRows]);
  const visible = view === 'archived' ? archived : active;

  const toggleArchived = async (e, ch) => {
    e.stopPropagation();
    if (!onSetArchived) return;
    try { await onSetArchived(ch.id, !ch.archivedAt); }
    catch (err) { console.error('[Mobile CRC] Archivage échoué:', err); }
  };

  const tabs = [
    { id: 'active', label: 'En cours', count: active.length },
    { id: 'actions', label: 'Actions', count: actionRows.length, alert: overdueCount > 0 },
    ...(archived.length > 0 ? [{ id: 'archived', label: 'Terminées', count: archived.length }] : []),
  ];

  return (
    <div className="pb-2">
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200/60 text-center">
          <div className="text-xl font-bold text-gray-900">{active.length}</div>
          <div className="text-[13px] text-gray-400 font-medium">En cours</div>
        </div>
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200/60 text-center">
          <div className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdueCount}</div>
          <div className="text-[13px] text-gray-400 font-medium">En retard</div>
        </div>
        <button onClick={onRefresh} className="bg-white rounded-xl p-3 border border-gray-200/60 flex items-center justify-center hover:bg-gray-50 transition active:scale-[0.97]">
          <Icon name="refresh" size={18} color="#3b82f6" />
        </button>
      </div>

      {/* Onglets En cours / Actions / Terminées */}
      <div className="flex items-center bg-gray-100 rounded-xl p-0.5 mx-4 mb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium transition ${
              view === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
            }`}
          >
            {t.label}
            <span className={`text-[11px] font-bold ${t.alert ? 'text-red-500' : 'opacity-60'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {!loading && !error && view === 'actions' && (
        <ActionsList actionRows={actionRows} chantiers={chantiers} onSelect={onSelect} />
      )}

      {!loading && view !== 'actions' && visible.length > 0 && (
      <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
      {visible.map(ch => (
        // div + role=button : la carte contient une action (terminer/réactiver),
        // un <button> imbriqué dans un <button> serait du HTML invalide.
        <div key={ch.id} role="button" tabIndex={0}
          onClick={() => onSelect(ch)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ch); } }}
          className={`block p-4 bg-white rounded-xl border border-gray-200/60 text-left transition hover:shadow-md active:scale-[0.98] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'} ${ch.archivedAt ? 'opacity-75' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name={ch.archivedAt ? 'check' : 'file'} size={18} color="#d97706" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{ch.name}</div>
              {ch.archivedAt && <div className="inline-flex mt-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">Terminé</div>}
              {!ch.isOwner && <div className="inline-flex mt-1 ml-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase">Lecture seule</div>}
              {ch.lieu && <div className="text-[13px] text-gray-400 font-medium mt-0.5 truncate">{ch.lieu}</div>}
              <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-400 font-medium">
                <span>{ch.meetingCount} réunion{ch.meetingCount > 1 ? 's' : ''}</span>
                {ch.lastMeetingDate && (<><span className="text-gray-300">·</span><span>Dernière : {dateFr(ch.lastMeetingDate)}</span></>)}
                <span className="ml-auto flex items-center gap-1">
                  {onSetArchived && ch.isOwner && (
                    <button
                      onClick={(e) => toggleArchived(e, ch)}
                      className="p-2 -m-1 rounded-lg text-gray-300 active:bg-gray-100 transition"
                      title={ch.archivedAt ? 'Réactiver le chantier' : 'Terminer le chantier'}
                    >
                      <Icon name={ch.archivedAt ? 'refresh' : 'check'} size={16} color={ch.archivedAt ? '#3b82f6' : '#10b981'} />
                    </button>
                  )}
                  <Icon name="chevron" size={14} color="#d1d5db" />
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
      </div>
      )}

      {/* Un échec de chargement ne doit pas se confondre avec une liste vide. */}
      {!loading && error && (
        <div className="mx-4 my-3 p-4 rounded-xl bg-red-50 border border-red-200/70 text-center">
          <div className="text-sm font-semibold text-red-800">{error}</div>
          <button onClick={onRefresh} className="mt-2 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-[13px] font-medium text-red-700 hover:bg-red-50 transition active:scale-[0.97]">
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && view !== 'actions' && visible.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          {view === 'archived' ? 'Aucun chantier terminé' : 'Aucun compte rendu de chantier'}
        </div>
      )}
    </div>
  );
}
