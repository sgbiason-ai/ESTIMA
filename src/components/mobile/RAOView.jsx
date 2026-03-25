import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { fmtShort } from './formatters';

export default function RAOView({ project, refMap }) {
  const [showDetail, setShowDetail] = useState(false);
  const analysis = project.analysis || {};
  const companies = analysis.companies || [];

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Icon name="chart" size={40} color="#475569" />
        <span className="mt-3 text-sm">Aucune analyse des offres</span>
      </div>
    );
  }

  const classement = useMemo(() => {
    return [...companies]
      .map(c => ({
        nom: c.name || c.nom || '?',
        total: Number(c.total || c.montantTotal || 0),
      }))
      .sort((a, b) => a.total - b.total)
      .map((c, i) => ({ ...c, rang: i + 1 }));
  }, [companies]);

  return (
    <div className="py-2">
      <div className="px-4 mb-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Classement des offres
        </div>
        {classement.map((ent, i) => (
          <div key={ent.nom}
            className={`flex items-center gap-2.5 p-3 bg-white/5 rounded-xl mb-1.5 border ${i === 0 ? 'border-l-emerald-500 border-l-[3px]' : 'border-white/10'}`}>
            <div className="w-7 h-7 flex items-center justify-center">
              {i === 0 ? <Icon name="trophy" size={16} color="#eab308" /> :
                <span className="text-sm font-extrabold text-slate-400">{ent.rang}</span>}
            </div>
            <span className="flex-1 text-sm font-bold text-slate-200">{ent.nom}</span>
            <span className={`text-sm font-extrabold ${i === 0 ? 'text-emerald-400' : 'text-slate-700'}`}>
              {fmtShort(ent.total)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 mb-2">
        <button onClick={() => setShowDetail(!showDetail)}
          className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-[13px] font-bold text-emerald-400">
          {showDetail ? 'Masquer le détail' : 'Voir le détail des prix'}
        </button>
      </div>

      {showDetail && (
        <div className="px-4 text-center text-xs text-slate-400 py-6">
          Le détail complet des prix est disponible dans l'export Excel « Analyse ».
        </div>
      )}
    </div>
  );
}
