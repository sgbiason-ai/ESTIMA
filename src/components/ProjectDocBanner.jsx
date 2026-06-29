// src/components/ProjectDocBanner.jsx
// Récap de totaux affiché en pied du tableau d'estimation, dans les deux vues.
// - Montants à valoir : HT · TVA · TTC (taux = tauxTVA du projet)
// - En vue Comparaison : rappel du HT d'étude + écart à valoir.
import React from 'react';
import { formatPrice } from '../utils/helpers';

const ProjectDocBanner = ({ projectStats, tableView = 'comparison', tvaRate = 20 }) => {
  const isRendu = tableView === 'rendu';

  const studyHT = projectStats?.study?.base || 0;
  const clientHT = projectStats?.client?.base || 0;
  const rate = Number(tvaRate) / 100;
  const tva = clientHT * rate;
  const ttc = clientHT * (1 + rate);

  const ecart = clientHT - studyHT;
  const pct = studyHT !== 0 ? (ecart / studyHT) * 100 : (clientHT > 0 ? 100 : 0);

  return (
    <div className="flex justify-end">
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm px-6 py-5 w-96">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Montant à valoir
        </div>

        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total HT</span>
          <span className="text-sm font-black font-mono text-gray-900 tabular-nums">{formatPrice(clientHT)}</span>
        </div>

        <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">TVA ({tvaRate}%)</span>
          <span className="text-sm font-bold text-gray-500 font-mono tabular-nums">{formatPrice(tva)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className={`text-sm font-black uppercase tracking-widest ${isRendu ? 'text-indigo-700' : 'text-emerald-700'}`}>Total TTC</span>
          <span
            className={`text-xl font-black font-mono tabular-nums px-3 py-1 rounded-lg ${
              isRendu ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {formatPrice(ttc)}
          </span>
        </div>

        {/* Rappel étude + écart à valoir (vue Comparaison uniquement) */}
        {!isRendu && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
            <span className="text-gray-400 uppercase tracking-widest font-bold">Étude HT</span>
            <span className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-600 tabular-nums">{formatPrice(studyHT)}</span>
              <span className={`font-mono font-bold tabular-nums ${ecart >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                {ecart >= 0 ? '+' : ''}{formatPrice(ecart)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDocBanner;
