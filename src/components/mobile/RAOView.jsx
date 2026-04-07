import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { fmtShort } from './formatters';

export default function RAOView({ project, refMap }) {
  const [showDetail, setShowDetail] = useState(false);
  const analysis = project.analysis || {};
  const companies = analysis.companies || [];

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-700">
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
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
          Classement des offres
        </div>
        {classement.map((ent, i) => (
          <div key={ent.nom}
            className={`flex items-center gap-2.5 p-3 bg-white rounded-xl mb-1.5 border ${i === 0 ? 'border-l-emerald-500 border-l-[3px]' : 'border-gray-200'}`}>
            <div className="w-7 h-7 flex items-center justify-center">
              {i === 0 ? <Icon name="trophy" size={16} color="#eab308" /> :
                <span className="text-sm font-extrabold text-gray-600">{ent.rang}</span>}
            </div>
            <span className="flex-1 text-sm font-bold text-gray-900">{ent.nom}</span>
            <span className={`text-sm font-extrabold ${i === 0 ? 'text-blue-600' : 'text-gray-700'}`}>
              {fmtShort(ent.total)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 mb-2">
        <button onClick={() => setShowDetail(!showDetail)}
          className="w-full py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] font-bold text-blue-600">
          {showDetail ? 'Masquer le détail' : 'Voir le détail des prix'}
        </button>
      </div>

      {showDetail && (
        <div className="px-4 text-center text-xs text-gray-600 py-6">
          Le détail complet des prix est disponible dans l'export Excel « Analyse ».
        </div>
      )}
    </div>
  );
}
