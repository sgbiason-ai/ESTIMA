import React from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { formatPrice } from '../../utils/helpers';

const methodLabel = (m) => m === 'temps_passe' ? 'Temps passé' : 'Pourcentage';

export default function MoeListView({ devisList, loading, onSelect, onRefresh, isLandscape }) {
  return (
    <div className="pb-2">
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-xl font-bold text-gray-900">{devisList.length}</div>
          <div className="text-[13px] text-gray-500 font-semibold">Devis</div>
        </div>
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-xl font-bold text-gray-900">{formatPrice(devisList.reduce((s, d) => s + d.totalHT, 0))}</div>
          <div className="text-[13px] text-gray-500 font-semibold">Total HT</div>
        </div>
        <button onClick={onRefresh} className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition active:scale-[0.97]">
          <Icon name="refresh" size={18} color="#3b82f6" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Chargement…</span>
        </div>
      )}

      {!loading && devisList.length > 0 && (
      <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
      {devisList.map(d => (
        <button key={d.id} onClick={() => onSelect(d)}
          className={`block p-4 bg-white rounded-xl border border-gray-200 text-left transition hover:shadow-md active:scale-[0.98] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="euro" size={18} color="#4f46e5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-gray-900 leading-tight truncate">{d.nom}</div>
              {d.client && <div className="text-[13px] text-gray-500 font-medium mt-0.5 truncate">{d.client}</div>}
              <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-500 font-semibold">
                <span className="px-1.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {methodLabel(d.methode)}
                </span>
                <span className="text-gray-900 font-bold">{formatPrice(d.totalHT)}</span>
                {d.dateDevis && (<><span className="text-gray-300">·</span><span>{dateFr(d.dateDevis)}</span></>)}
                <span className="ml-auto"><Icon name="chevron" size={14} color="#d1d5db" /></span>
              </div>
            </div>
          </div>
        </button>
      ))}
      </div>
      )}

      {!loading && devisList.length === 0 && (
        <div className="text-center py-10 text-gray-500 text-sm font-medium">Aucun devis MOE</div>
      )}
    </div>
  );
}
