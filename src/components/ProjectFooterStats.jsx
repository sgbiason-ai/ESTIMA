// src/components/ProjectFooterStats.jsx
import React from 'react';
import { Split } from 'lucide-react';
import { formatPrice } from '../utils/helpers';

const ProjectFooterStats = ({
  totalBase,
  totalOption,
  currentMode,
  theme
}) => {
  return (
    <div className="flex justify-end mt-8 mb-20">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 w-96">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total HT (Base)</span>
            <span className={`text-sm font-black font-mono ${theme.textMain}`}>{formatPrice(totalBase)}</span>
          </div>
          {totalOption > 0 && (
            <div className="flex justify-between items-center mb-1 pb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 italic"><Split size={10} /> Total PSE (Prestations Supplémentaires Éventuelles)</span>
              <span className="text-xs font-bold font-mono text-slate-400 italic">{formatPrice(totalOption)}</span>
            </div>
          )}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">TVA (20%)</span><span className="text-sm font-bold text-slate-500 font-mono">{formatPrice(totalBase * 0.2)}</span></div>
        <div className="flex justify-between items-center mb-6"><span className={`text-sm font-black uppercase tracking-widest ${currentMode === 'client' ? 'text-indigo-700' : 'text-emerald-700'}`}>Total TTC</span><span className={`text-xl font-black font-mono px-3 py-1 rounded-lg ${currentMode === 'client' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-600'}`}>{formatPrice(totalBase * 1.2)}</span></div>
      </div>
    </div>
  );
};

export default ProjectFooterStats;