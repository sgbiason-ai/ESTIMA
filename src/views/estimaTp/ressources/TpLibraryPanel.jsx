// src/views/estimaTp/ressources/TpLibraryPanel.jsx
// ESTIMA TP — barre latérale « Bibliothèque » du sous-détail, façon BPU ESTIMA :
// volet gauche, recherche + filtre par catégorie, cartes cliquables → insertion.
import React, { useMemo, useState, useEffect } from 'react';
import { Package, PanelLeftClose, Search, Filter, Plus } from 'lucide-react';
import { POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';

const removeAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ACCENT = {
  materiel: 'text-orange-700 bg-orange-100/60 border-orange-100', mo: 'text-blue-700 bg-blue-100/60 border-blue-100',
  fourniture: 'text-emerald-700 bg-emerald-100/60 border-emerald-100', soustraitance: 'text-violet-700 bg-violet-100/60 border-violet-100',
  transport: 'text-amber-700 bg-amber-100/60 border-amber-100',
};

const previewPU = (r) => {
  if (r.category === 'fourniture' || r.category === 'soustraitance') return r.puBareme ? `${r.puBareme} €` : '';
  const t = (Number(r.puJour) || 0) + (Number(r.amort) || 0) + (Number(r.entret) || 0) + (Number(r.cons) || 0) + (Number(r.loc) || 0);
  return t ? `${t} €/j` : '';
};

export default function TpLibraryPanel({ resources, onInsert, onClose, activeCategory = null, filterTick = 0 }) {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  // Le filtre suit le bloc cliqué dans le sous-détail (poste actif). `filterTick` force
  // la ré-application même si on re-clique le même poste (sinon l'effet ne se redéclenche pas).
  useEffect(() => { if (activeCategory) setCat(activeCategory); }, [activeCategory, filterTick]);

  const items = useMemo(() => {
    let l = cat === 'all' ? resources : resources.filter(r => r.category === cat);
    if (search.trim()) { const q = removeAccents(search); l = l.filter(r => removeAccents(r.designation).includes(q)); }
    return [...l].sort((a, b) => POSTES.indexOf(a.category) - POSTES.indexOf(b.category) || (a.designation || '').localeCompare(b.designation || '', 'fr'));
  }, [resources, cat, search]);

  return (
    <div className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm">
      <header className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest">
            <Package size={14} className="text-orange-600" /> Bibliothèque
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" title="Fermer le volet"><PanelLeftClose size={17} /></button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500 transition-all font-medium" />
        </div>
        <div className="relative mt-2">
          <Filter className="absolute left-3 top-2.5 text-slate-400" size={12} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none focus:border-orange-500 appearance-none cursor-pointer uppercase tracking-wide">
            <option value="all">Toutes catégories</option>
            {POSTES.map(p => <option key={p} value={p}>{POSTE_LABELS[p]}</option>)}
          </select>
        </div>
        {activeCategory && cat === activeCategory && (
          <p className="mt-1 text-[9px] font-semibold text-orange-600">↳ suit le bloc actif ({POSTE_LABELS[activeCategory]})</p>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] italic text-slate-400">
            {resources.length === 0 ? 'Bibliothèque vide — alimentez-la dans l\'onglet Ressources.' : 'Aucune ressource pour ce filtre.'}
          </p>
        ) : items.map(r => (
          <button key={r.id} onClick={() => onInsert(r)}
            className="group relative w-full text-left flex items-start justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-orange-400 hover:shadow-md hover:bg-orange-50/30 transition-all duration-200 active:scale-[0.98]">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex-1 min-w-0 pl-1.5">
              <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-px rounded border ${ACCENT[r.category] || ACCENT.materiel}`}>{POSTE_LABELS[r.category]}</span>
              <p className="text-[10px] font-bold text-slate-700 uppercase leading-snug line-clamp-2 mt-1 group-hover:text-orange-800">{r.designation || 'Sans nom'}</p>
            </div>
            <div className="flex flex-col items-end shrink-0 gap-1">
              {previewPU(r) && <span className="text-[10px] font-black text-orange-700 font-mono bg-orange-100/50 border border-orange-100 px-1.5 py-0.5 rounded">{previewPU(r)}</span>}
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{r.unit}</span>
              <Plus size={12} className="text-slate-300 group-hover:text-orange-500" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
