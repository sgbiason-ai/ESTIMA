// src/views/admin/FeedbackPanel.jsx
// Panneau super-admin : liste, filtre, classe et priorise les feedbacks utilisateurs.
// Abonnement temps réel via useFeedbackList. Réservé au super-admin (rules Firestore).

import React, { useMemo, useState } from 'react';
import {
  Inbox, Trash2, ExternalLink, Monitor, X, Search,
} from 'lucide-react';
import { confirm } from '../../utils/globalUI';
import { useFeedbackList, updateFeedback, deleteFeedback } from '../../hooks/useFeedback';
import SupportLiveBanner from '../../components/feedback/SupportLiveBanner';
import SupportViewer from '../../components/feedback/SupportViewer';
import {
  FEEDBACK_TYPES, FEEDBACK_STATUSES, FEEDBACK_PRIORITIES,
  typeMeta, statusMeta, priorityMeta,
} from '../../components/feedback/feedbackConstants';

const BADGE = {
  red:     'bg-red-100 text-red-700',
  amber:   'bg-amber-100 text-amber-700',
  blue:    'bg-blue-100 text-blue-700',
  violet:  'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  gray:    'bg-gray-100 text-gray-600',
};

const fmtDate = (ts) => {
  const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const FeedbackPanel = () => {
  const { items, loading } = useFeedbackList(true);
  const [fStatus, setFStatus] = useState('all');
  const [fType, setFType]     = useState('all');
  const [search, setSearch]   = useState('');
  const [viewShot, setViewShot] = useState(null); // dataURL en plein écran
  const [liveSession, setLiveSession] = useState(null); // session d'assistance rejointe

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (fStatus !== 'all' && (it.status || 'nouveau') !== fStatus) return false;
      if (fType !== 'all' && it.type !== fType) return false;
      if (q) {
        const hay = `${it.comment || ''} ${it.userEmail || ''} ${it.moduleLabel || ''} ${it.version || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, fStatus, fType, search]);

  const counts = useMemo(() => {
    const c = { nouveau: 0 };
    items.forEach((it) => { const s = it.status || 'nouveau'; c[s] = (c[s] || 0) + 1; });
    return c;
  }, [items]);

  const handleDelete = async (id) => {
    const ok = await confirm('Supprimer définitivement ce feedback ?', { danger: true });
    if (ok) await deleteFeedback(id);
  };

  const Select = ({ value, onChange, options, colorize }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-[11px] font-semibold rounded-lg px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 ${
        colorize ? BADGE[colorize] : 'bg-gray-100 text-gray-600'
      }`}
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Demandes d'assistance écran en direct */}
      <SupportLiveBanner enabled onJoin={setLiveSession} />

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200/60 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (commentaire, email, module, version)…"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
          className="bg-white border border-gray-200/60 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-400">
          <option value="all">Tous les statuts</option>
          {FEEDBACK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={fType} onChange={(e) => setFType(e.target.value)}
          className="bg-white border border-gray-200/60 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-400">
          <option value="all">Tous les types</option>
          {FEEDBACK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {/* En-tête compteurs */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Inbox size={14} className="text-gray-400" />
        <span className="font-semibold text-gray-700">{filtered.length}</span> feedback{filtered.length !== 1 ? 's' : ''}
        {counts.nouveau > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-md bg-blue-100 text-blue-600 font-bold">{counts.nouveau} nouveau{counts.nouveau !== 1 ? 'x' : ''}</span>
        )}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-2">
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-10">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-10">Aucun feedback.</div>
        ) : (
          filtered.map((it) => {
            const tm = typeMeta(it.type);
            const TIcon = tm.icon;
            return (
              <div key={it.id} className="bg-white border border-gray-200/60 rounded-2xl p-4">
                {/* Ligne 1 : type + meta + suppression */}
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 ${BADGE[tm.color]}`}>
                    <TIcon size={12} /> {tm.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{it.comment}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-400">
                      <span className="font-medium text-gray-600">{it.userEmail || 'anonyme'}</span>
                      <span>· {fmtDate(it.createdAt)}</span>
                      <span>· {it.moduleLabel || 'Hub'}</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">v{it.version || '?'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(it.id)}
                    title="Supprimer"
                    className="shrink-0 p-1.5 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Ligne 2 : contrôles statut/priorité + capture + contexte */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Select
                    value={it.status || 'nouveau'}
                    onChange={(v) => updateFeedback(it.id, { status: v })}
                    options={FEEDBACK_STATUSES}
                    colorize={statusMeta(it.status).color}
                  />
                  <Select
                    value={it.priority || 'moyenne'}
                    onChange={(v) => updateFeedback(it.id, { priority: v })}
                    options={FEEDBACK_PRIORITIES}
                    colorize={priorityMeta(it.priority).color}
                  />
                  {it.screenshot && (
                    <button
                      onClick={() => setViewShot(it.screenshot)}
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-all"
                    >
                      <ExternalLink size={12} /> Capture
                    </button>
                  )}
                  {it.context?.userAgent && (
                    <span
                      title={`${it.context.userAgent}\n${it.context.viewport || ''} (écran ${it.context.screen || '?'})\n${it.context.url || ''}`}
                      className="flex items-center gap-1 text-[11px] text-gray-400 px-2 py-1 cursor-help"
                    >
                      <Monitor size={12} /> {it.context.viewport || it.context.screen}
                    </span>
                  )}
                </div>

                {/* Note interne */}
                <textarea
                  defaultValue={it.adminNote || ''}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (it.adminNote || '')) updateFeedback(it.id, { adminNote: v });
                  }}
                  rows={1}
                  placeholder="Note interne (privée)…"
                  className="w-full mt-3 bg-gray-50 border border-gray-200/60 rounded-xl px-3 py-2 text-xs text-gray-700
                             placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all resize-y"
                />
              </div>
            );
          })
        )}
      </div>

      {/* Visionneuse capture plein écran */}
      {viewShot && (
        <div
          className="fixed inset-0 z-[10001] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setViewShot(null)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all">
            <X size={22} />
          </button>
          <img src={viewShot} alt="capture" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      {/* Visionneuse assistance écran en direct */}
      {liveSession && (
        <SupportViewer session={liveSession} onClose={() => setLiveSession(null)} />
      )}
    </div>
  );
};

export default FeedbackPanel;
