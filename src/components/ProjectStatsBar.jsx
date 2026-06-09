// src/components/ProjectStatsBar.jsx
import React from 'react';
import { ArrowDownNarrowWide } from 'lucide-react';
import { formatPrice } from '../utils/helpers';

const ProjectStatsBar = ({
  projectStats,
  bpuConfig,
  isReadOnly,
  handleAutoSort
}) => {
  return (
    <div className="bg-slate-900 text-white px-6 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest border-b border-slate-800 shrink-0 shadow-inner">
       <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
              <span className="text-slate-500">Étude HT:</span>
              <span className="text-emerald-400 font-mono text-xs">{formatPrice(projectStats.study.base)}</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
              <span className="text-slate-500">Rendu HT:</span>
              <span className="text-indigo-400 font-mono text-xs">{formatPrice(projectStats.client.base)}</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
              <span className="text-slate-500">Avaloir Global:</span>
              <span className="text-amber-400 font-mono text-xs">
              {(() => {
                  const base = projectStats.study.base;
                  const current = projectStats.client.base;
                  const ecart = current - base;
                  const pctStr = base === 0 ? '0.00%' : `${ecart > 0 ? '+' : ''}${((ecart / base) * 100).toFixed(2)}%`;
                  const ecartStr = `${ecart > 0 ? '+' : ''}${formatPrice(ecart)} HT`;
                  return `${pctStr} · ${ecartStr}`;
              })()}
              </span>
          </div>
       </div>

       {/* BOUTON DE TRI VISIBLE UNIQUEMENT EN MODE MANUEL */}
       {bpuConfig?.numberingMode === 'manual' && !isReadOnly && (
         <button 
           onClick={handleAutoSort}
           className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
           title="Trier tous les chapitres et articles par numéro BPU croissant"
         >
           <ArrowDownNarrowWide size={12} />
           <span>Trier par N°</span>
         </button>
       )}
    </div>
  );
};

export default ProjectStatsBar;