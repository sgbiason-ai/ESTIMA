// src/components/modals/PriceConsistencyModal.jsx
import React, { useMemo } from 'react';
import {
  X, ScanSearch, AlertTriangle, CheckCircle2, Copy,
  CornerDownRight, ArrowRight, Info,
} from 'lucide-react';
import { checkPriceConsistency } from '../../utils/projectCalculations';

/* ════════════════════════════════════════════════════════════════
   Vérification des numéros de prix — Unicité sur tout le projet
   Règle : chaque numéro de prix doit porter le même libellé et la
   même unité partout. Signale aussi les articles identiques portant
   des numéros différents. Aucune correction automatique : on liste
   et on permet d'aller à la ligne concernée.
   ════════════════════════════════════════════════════════════════ */

const PriceConsistencyModal = ({ show, onClose, project, bpuConfig, onGoToItem }) => {
  const result = useMemo(() => {
    if (!show || !project?.chapters) {
      return { totalItems: 0, numberConflicts: [], duplicateNumbers: [], ok: true };
    }
    return checkPriceConsistency(project.chapters, bpuConfig);
  }, [show, project, bpuConfig]);

  if (!show) return null;

  const { totalItems, numberConflicts, duplicateNumbers, ok } = result;
  const anomalies = numberConflicts.length + duplicateNumbers.length;

  const goTo = (id) => {
    onClose();
    if (onGoToItem) onGoToItem(id);
  };

  const PathLabel = ({ path }) => (
    <span className="text-[10px] text-slate-400 truncate">
      {path && path.length ? path.join(' › ') : 'Racine'}
    </span>
  );

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[920px] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">

        {/* ══ HEADER ══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <ScanSearch size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Vérification des numéros de prix</h2>
              <p className="text-[10.5px] text-slate-500">Chaque numéro doit porter le même libellé et la même unité sur tout le projet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ══ STATS ══ */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Articles', value: totalItems, icon: Info, color: 'slate' },
              { label: 'Numéros incohérents', value: numberConflicts.length, icon: AlertTriangle, color: numberConflicts.length ? 'amber' : 'emerald' },
              { label: 'Articles en double', value: duplicateNumbers.length, icon: Copy, color: duplicateNumbers.length ? 'red' : 'emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-lg border bg-white border-slate-200">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-${color}-100 text-${color}-600`}>
                  <Icon size={16} />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold leading-none text-slate-800">{value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ CORPS ══ */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {ok && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <CheckCircle2 size={44} strokeWidth={1} className="mb-3 text-emerald-400" />
              <p className="text-sm font-medium text-slate-600">Tous les numéros de prix sont cohérents</p>
              <p className="text-[11px] mt-1">Chaque numéro porte un libellé et une unité uniques sur l'ensemble du projet</p>
            </div>
          )}

          {/* ── A. Numéros incohérents ── */}
          {numberConflicts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Numéros portant un libellé / une unité différents ({numberConflicts.length})
                </h3>
              </div>
              <p className="text-[10.5px] text-slate-400 mb-3">Le même numéro de prix est utilisé sur des lignes au contenu divergent. À harmoniser ou à renuméroter.</p>

              <div className="space-y-3">
                {numberConflicts.map((c) => (
                  <div key={`conf-${c.ref}`} className="rounded-lg border border-amber-200 bg-amber-50/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-100/60 border-b border-amber-200">
                      <span className="text-[11px] font-mono font-black text-amber-700 bg-white px-2 py-0.5 rounded">{c.ref}</span>
                      <span className="text-[10.5px] text-amber-700">
                        diverge sur&nbsp;: <strong>{c.divergesOn.join(' et ')}</strong> — {c.items.length} lignes
                      </span>
                    </div>
                    <div>
                      {c.items.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => goTo(it.id)}
                          className="w-full group flex items-center gap-3 px-3 py-2 border-b border-amber-100/70 last:border-0 hover:bg-white/70 transition-colors text-left"
                        >
                          <CornerDownRight size={12} className="text-amber-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11.5px] font-medium text-slate-800 truncate">{it.designation || '(sans libellé)'}</span>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{it.unit || '—'}</span>
                            </div>
                            <PathLabel path={it.path} />
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            Voir <ArrowRight size={12} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── B. Articles en double ── */}
          {duplicateNumbers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Copy size={14} className="text-red-500" />
                <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                  Articles identiques sous plusieurs numéros ({duplicateNumbers.length})
                </h3>
              </div>
              <p className="text-[10.5px] text-slate-400 mb-3">Même libellé et même unité, mais des numéros de prix différents. Doublon probable à fusionner.</p>

              <div className="space-y-3">
                {duplicateNumbers.map((d, i) => (
                  <div key={`dup-${i}`} className="rounded-lg border border-red-200 bg-red-50/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-100/50 border-b border-red-200">
                      <span className="text-[11.5px] font-medium text-slate-800 truncate flex-1">{d.designation}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded shrink-0">{d.unit || '—'}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {d.refs.map((r) => (
                          <span key={r} className="text-[10px] font-mono font-black text-red-600 bg-white px-1.5 py-0.5 rounded border border-red-200">{r}</span>
                        ))}
                      </span>
                    </div>
                    <div>
                      {d.items.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => goTo(it.id)}
                          className="w-full group flex items-center gap-3 px-3 py-2 border-b border-red-100/70 last:border-0 hover:bg-white/70 transition-colors text-left"
                        >
                          <CornerDownRight size={12} className="text-red-400 shrink-0" />
                          <span className="text-[10px] font-mono font-bold text-red-600 bg-white px-1.5 py-0.5 rounded border border-red-200 shrink-0">{it.ref}</span>
                          <PathLabel path={it.path} />
                          <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto">
                            Voir <ArrowRight size={12} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ══ FOOTER ══ */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400">
            {ok
              ? 'Aucune anomalie détectée'
              : `${anomalies} anomalie${anomalies > 1 ? 's' : ''} — cliquez une ligne pour y accéder`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceConsistencyModal;
