// src/views/estimRapide/EstimRapideList.jsx
// Liste des estimations rapides enregistrées (landing du module) — look ESTIMA.
import React, { useState, useMemo } from 'react';
import { Plus, Search, Copy, Trash2, FileText, Zap, Building2, MapPin } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';
import { estimateTotalHT } from '../../utils/estimRapideCalc';

export default function EstimRapideList({ estimates, isLoading, onOpen, onNew, onDuplicate, onDelete }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return estimates;
    return estimates.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.client || '').toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q)
    );
  }, [estimates, search]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Estimations rapides</h2>
            <p className="text-sm text-slate-500 mt-0.5">Chiffrage d'enveloppe par grands lots VRD</p>
          </div>
          <button onClick={onNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all">
            <Plus size={17} /> Nouvelle estimation
          </button>
        </div>

        {/* Recherche */}
        <div className="relative mb-5 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-2xl bg-white border border-slate-200 mb-3">
              <Zap size={28} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <p className="text-slate-600 font-medium">{search ? 'Aucun résultat' : 'Aucune estimation'}</p>
            {!search && <p className="text-sm text-slate-400 mt-1">Créez votre première estimation rapide.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(est => {
              const total = estimateTotalHT(est);
              const lotsCount = (est.lots || []).length;
              return (
                <div key={est.id} onClick={() => onOpen(est.id)}
                  className="group relative bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-emerald-50"><FileText size={18} className="text-emerald-600" strokeWidth={1.5} /></div>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); onDuplicate(est.id); }} title="Dupliquer"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Copy size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(est.id); }} title="Supprimer"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 truncate">{est.name || 'Sans titre'}</h3>
                  <div className="mt-1.5 space-y-1 text-[12px] text-slate-500 min-h-[1rem]">
                    {est.client && <p className="flex items-center gap-1.5 truncate"><Building2 size={12} className="shrink-0" />{est.client}</p>}
                    {est.location && <p className="flex items-center gap-1.5 truncate"><MapPin size={12} className="shrink-0" />{est.location}</p>}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lotsCount} lot{lotsCount > 1 ? 's' : ''}</span>
                    <span className="text-lg font-black font-mono text-emerald-700">{formatPrice(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
