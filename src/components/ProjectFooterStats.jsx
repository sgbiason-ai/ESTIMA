// src/components/ProjectFooterStats.jsx
import React from 'react';
import { formatPrice } from '../utils/helpers';

const ProjectFooterStats = ({
  totalBase,
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
          {/* Pas de total général PSE : les PSE sont indépendantes (parfois exclusives),
              chacune porte son propre total dans le tableau. */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">TVA (20%)</span><span className="text-sm font-bold text-slate-500 font-mono">{formatPrice(totalBase * 0.2)}</span></div>
        <div className="flex justify-between items-center mb-6"><span className={`text-sm font-black uppercase tracking-widest ${currentMode === 'client' ? 'text-indigo-700' : 'text-emerald-700'}`}>Total TTC</span><span className={`text-xl font-black font-mono px-3 py-1 rounded-lg ${currentMode === 'client' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-600'}`}>{formatPrice(totalBase * 1.2)}</span></div>
      </div>
    </div>
  );
};

export default ProjectFooterStats;