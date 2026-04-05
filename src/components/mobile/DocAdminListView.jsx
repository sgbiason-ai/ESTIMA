// src/components/mobile/DocAdminListView.jsx
//
// Liste des fiches marche — ecran de selection mobile.

import React from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';

export default function DocAdminListView({ fiches, loading, onSelect, onRefresh, isLandscape }) {
  return (
    <div className="pb-2">
      {/* Stats */}
      <div className="flex gap-2 px-4 pt-3 pb-2 mb-1">
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 text-center">
          <div className="text-lg font-extrabold text-slate-100">{fiches.length}</div>
          <div className="text-xs text-slate-500 font-semibold">Fiches</div>
        </div>
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 text-center">
          <div className="text-lg font-extrabold text-slate-100">
            {fiches.filter(f => f.hasExe1).length}
          </div>
          <div className="text-xs text-slate-500 font-semibold">Avec OS</div>
        </div>
        <button onClick={onRefresh}
          className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
          <Icon name="refresh" size={18} color="#fb7185" />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {/* Fiche list */}
      {!loading && fiches.length > 0 && (
        <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
          {fiches.map(f => (
            <button key={f.id} onClick={() => onSelect(f)}
              className={`block p-3.5 bg-white/5 rounded-xl border border-white/10 text-left transition hover:shadow-md active:scale-[0.99] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="file" size={18} color="#fb7185" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-200 leading-tight truncate">{f.nom}</div>
                  {f.pouvoirAdj && <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">{f.pouvoirAdj}</div>}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-semibold">
                    {f.nbLots > 0 && <span>{f.nbLots} lot{f.nbLots > 1 ? 's' : ''}</span>}
                    {f.nbLots > 0 && f.updatedAt && <span className="opacity-40">•</span>}
                    {f.updatedAt && <span>{dateFr(f.updatedAt)}</span>}
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
      {!loading && fiches.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">
          Aucune fiche marché
        </div>
      )}
    </div>
  );
}
