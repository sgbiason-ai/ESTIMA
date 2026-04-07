import React from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';

export default function DocAdminListView({ fiches, loading, onSelect, onRefresh, isLandscape }) {
  return (
    <div className="pb-2">
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-lg font-bold text-gray-900">{fiches.length}</div>
          <div className="text-xs text-gray-500 font-semibold">Fiches</div>
        </div>
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-lg font-bold text-gray-900">{fiches.filter(f => f.hasExe1).length}</div>
          <div className="text-xs text-gray-500 font-semibold">Avec OS</div>
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

      {!loading && fiches.length > 0 && (
        <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
          {fiches.map(f => (
            <button key={f.id} onClick={() => onSelect(f)}
              className={`block p-3.5 bg-white rounded-xl border border-gray-200 text-left transition hover:shadow-md active:scale-[0.98] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="file" size={18} color="#e11d48" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 leading-tight truncate">{f.nom}</div>
                  {f.pouvoirAdj && <div className="text-xs text-gray-500 font-medium mt-0.5 truncate">{f.pouvoirAdj}</div>}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 font-semibold">
                    {f.nbLots > 0 && <span>{f.nbLots} lot{f.nbLots > 1 ? 's' : ''}</span>}
                    {f.nbLots > 0 && f.updatedAt && <span className="text-gray-300">·</span>}
                    {f.updatedAt && <span>{dateFr(f.updatedAt)}</span>}
                    <span className="ml-auto"><Icon name="chevron" size={14} color="#d1d5db" /></span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && fiches.length === 0 && (
        <div className="text-center py-10 text-gray-500 text-sm font-medium">Aucune fiche marché</div>
      )}
    </div>
  );
}
