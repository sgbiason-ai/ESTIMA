// src/components/mobile/MoeListView.jsx
//
// Liste des devis MOE — écran de sélection mobile.

import React from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { formatPrice } from '../../utils/helpers';

const methodLabel = (m) => m === 'temps_passe' ? 'Temps passé' : 'Pourcentage';

export default function MoeListView({ devisList, loading, onSelect, onRefresh, isLandscape }) {
  return (
    <div className="pb-2">
      {/* Stats */}
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 text-center">
          <div className="text-lg font-extrabold text-slate-100">{devisList.length}</div>
          <div className="text-xs text-slate-500 font-semibold">Devis</div>
        </div>
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 text-center">
          <div className="text-lg font-extrabold text-slate-100">
            {formatPrice(devisList.reduce((s, d) => s + d.totalHT, 0))}
          </div>
          <div className="text-xs text-slate-500 font-semibold">Total HT</div>
        </div>
        <button onClick={onRefresh}
          className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
          <Icon name="refresh" size={18} color="#34d399" />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {/* Devis list */}
      {!loading && devisList.length > 0 && (
      <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
      {devisList.map(d => (
        <button key={d.id} onClick={() => onSelect(d)}
          className={`block p-3.5 bg-white/5 rounded-xl border border-white/10 text-left transition hover:shadow-md active:scale-[0.99] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="euro" size={18} color="#818cf8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-200 leading-tight truncate">{d.nom}</div>
              {d.client && <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">{d.client}</div>}
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-semibold">
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
                  {methodLabel(d.methode)}
                </span>
                <span>{formatPrice(d.totalHT)}</span>
                {d.dateDevis && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>{dateFr(d.dateDevis)}</span>
                  </>
                )}
                <span className="ml-auto">
                  <Icon name="chevron" size={14} color="#475569" />
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}
      </div>
      )}

      {/* Empty state */}
      {!loading && devisList.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">
          Aucun devis MOE
        </div>
      )}
    </div>
  );
}
