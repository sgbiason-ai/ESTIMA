// src/components/ProjectFooterStats.jsx
import React from 'react';
import { formatPrice } from '../utils/helpers';

// Grille commune à l'en-tête et à toutes les lignes → colonnes parfaitement alignées.
const GRID = 'grid grid-cols-[1fr_9rem_9rem] gap-x-3 items-center';

const ProjectFooterStats = ({
  totalBase,
  currentMode,
  theme,
  projectStats,
  showRendu = false,
}) => {
  // ── Mode comparatif : deux colonnes alignées (Étude / Rendu) HT · TVA · TTC ──
  if (showRendu && projectStats) {
    const studyHT = projectStats.study?.base || 0;
    const clientHT = projectStats.client?.base || 0;
    const rows = [
      { label: 'Total HT',   s: studyHT,       c: clientHT,       strong: false },
      { label: 'TVA (20%)',  s: studyHT * 0.2, c: clientHT * 0.2, strong: false },
      { label: 'Total TTC',  s: studyHT * 1.2, c: clientHT * 1.2, strong: true  },
    ];
    return (
      <div className="flex justify-end mt-8 mb-20">
        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 w-[34rem]">
          {/* En-tête des colonnes */}
          <div className={`${GRID} pb-2 mb-2 border-b border-gray-100`}>
            <span />
            <span className="text-right text-[10px] font-black uppercase tracking-widest text-emerald-600">Étude</span>
            <span className="text-right text-[10px] font-black uppercase tracking-widest text-indigo-600">Rendu</span>
          </div>

          {rows.map((r) => (
            <div
              key={r.label}
              className={`${GRID} ${r.strong ? 'mt-2 pt-2 border-t border-gray-100' : 'mb-1'}`}
            >
              <span className={`text-xs uppercase tracking-widest ${r.strong ? 'font-black text-gray-700' : 'font-bold text-gray-400'}`}>
                {r.label}
              </span>
              <span className={`text-right font-mono tabular-nums ${r.strong ? 'text-base font-black text-emerald-700' : 'text-sm font-bold text-gray-600'}`}>
                {formatPrice(r.s)}
              </span>
              <span className={`text-right font-mono tabular-nums ${r.strong ? 'text-base font-black text-indigo-700' : 'text-sm font-bold text-gray-600'}`}>
                {formatPrice(r.c)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Mode simple : une colonne (mode courant) — comportement d'origine ──
  return (
    <div className="flex justify-end mt-8 mb-20">
      <div className="bg-white rounded-2xl border border-gray-200/60 p-6 w-96">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total HT (Base)</span>
            <span className={`text-sm font-black font-mono ${theme.textMain}`}>{formatPrice(totalBase)}</span>
          </div>
          {/* Pas de total général PSE : les PSE sont indépendantes (parfois exclusives),
              chacune porte son propre total dans le tableau. */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">TVA (20%)</span><span className="text-sm font-bold text-gray-500 font-mono">{formatPrice(totalBase * 0.2)}</span></div>
        <div className="flex justify-between items-center mb-6"><span className={`text-sm font-black uppercase tracking-widest ${currentMode === 'client' ? 'text-indigo-700' : 'text-emerald-700'}`}>Total TTC</span><span className={`text-xl font-black font-mono px-3 py-1 rounded-lg ${currentMode === 'client' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-600'}`}>{formatPrice(totalBase * 1.2)}</span></div>
      </div>
    </div>
  );
};

export default ProjectFooterStats;
