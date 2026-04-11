// src/views/devisMoe/DevisMoeConfigBar.jsx
// Barre de configuration collapsible — méthode, taux, phases, marge
import React, { useState } from 'react';
import { Percent, Clock, ChevronDown } from 'lucide-react';

export default function DevisMoeConfigBar({ draft, onChange, isPct, cats, activePhases, uniteTemps, setUniteTemps }) {
  const [open, setOpen] = useState(false);
  const H_PAR_JOUR = 7;

  // Resume compact
  const methodeLabel = isPct ? '%' : 'Temps passé';
  const margeLabel = draft.marge ? `${draft.marge}%` : '0%';

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Ligne resume cliquable */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-default text-left">
        <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 shrink-0">
          <span className={`px-2.5 py-1 rounded text-xs font-bold ${isPct ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
            {isPct ? <Percent size={12} className="inline" /> : <Clock size={12} className="inline" />}
            {' '}{methodeLabel}
          </span>
        </div>
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        <span className="text-xs font-bold text-slate-500 shrink-0">{activePhases.length} phases</span>
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        {isPct ? (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
            {draft.tauxHonorairesGlobal || '—'} %
          </span>
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            {cats.map(c => {
              const tj = ((parseFloat(c.tauxHoraire) || 0) * H_PAR_JOUR);
              return (
                <span key={c.id} className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                  {c.label.split(' ')[0]} <span className="font-mono">{tj ? tj.toFixed(2) : '—'}</span> €/j
                </span>
              );
            })}
          </div>
        )}
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          Marge {margeLabel}
        </span>
        <ChevronDown size={14} className={`text-slate-300 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Contenu depliable */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
          {/* Ligne 1 : Methode + Phases */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
              {[
                { v: 'pourcentage', Icon: Percent, label: '%' },
                { v: 'temps_passe', Icon: Clock,   label: 'Temps' },
              ].map(({ v, Icon, label }) => (
                <button key={v} onClick={() => onChange({ ...draft, methode: v })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-150 cursor-default ${
                    draft.methode === v
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 shrink-0" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">{activePhases.length} phases</span>
          </div>

          {/* Ligne 2 : Taux + Travaux HT + Marge */}
          <div className="flex items-center gap-3 flex-wrap">
            {isPct ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Taux</span>
                <input type="number" min="0" max="100" step="0.1"
                  className="w-16 px-2 py-1 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                  value={draft.tauxHonorairesGlobal || ''}
                  onChange={e => onChange({ ...draft, tauxHonorairesGlobal: e.target.value })}
                  placeholder="5" />
                <span className="text-[10px] text-slate-400">%</span>
              </div>
            ) : (
              <>
                {cats.map((cat, i) => {
                  const tauxH = parseFloat(cat.tauxHoraire) || 0;
                  const displayVal = uniteTemps === 'j' ? parseFloat((tauxH * H_PAR_JOUR).toFixed(2)) || '' : (tauxH ? parseFloat(tauxH.toFixed(2)) : '');
                  return (
                    <div key={cat.id} className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{cat.label.split(' ')[0]}</span>
                      <input type="number" min="0"
                        className="w-14 px-1.5 py-1 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                        value={displayVal}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          const newTauxH = isNaN(v) ? '' : String(uniteTemps === 'j' ? v / H_PAR_JOUR : v);
                          const c = [...cats]; c[i] = { ...cat, tauxHoraire: newTauxH }; onChange({ ...draft, categories: c });
                        }} />
                      <span className="text-[10px] text-slate-400">€/{uniteTemps}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 border border-slate-200 shrink-0">
                  {['h', 'j'].map(u => (
                    <button key={u} onClick={() => setUniteTemps(u)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-default ${
                        uniteTemps === u ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
                      }`}>{u}</button>
                  ))}
                </div>
              </>
            )}

            <div className="w-px h-5 bg-slate-200 shrink-0" />

            {!isPct && (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Travaux</span>
                  <input type="number" min="0"
                    className="w-24 px-2 py-1 text-right text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                    value={draft.montantTravauxGlobal || ''}
                    onChange={e => onChange({ ...draft, montantTravauxGlobal: e.target.value })}
                    placeholder="500 000" />
                  <span className="text-[10px] text-slate-400">€</span>
                </div>
                <div className="w-px h-5 bg-slate-200 shrink-0" />
              </>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Marge</span>
              <input type="number" min="0" max="100" step="0.5"
                className="w-14 px-2 py-1 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                value={draft.marge || ''}
                onChange={e => onChange({ ...draft, marge: e.target.value })}
                placeholder="0" />
              <span className="text-[10px] text-slate-400">%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
