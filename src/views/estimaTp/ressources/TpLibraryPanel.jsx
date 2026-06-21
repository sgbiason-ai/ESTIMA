// src/views/estimaTp/ressources/TpLibraryPanel.jsx
// ESTIMA TP — volet latéral « Bibliothèque » dans le sous-détail (façon BPU ESTIMA) :
// filtre par catégorie + recherche, clic sur une ressource → insertion d'une ligne.
import React, { useMemo, useState } from 'react';
import { X, Search, BookOpen, Plus } from 'lucide-react';
import { POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';

const removeAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const previewPU = (r) => {
  if (r.category === 'fourniture' || r.category === 'soustraitance') return r.puBareme ? `${r.puBareme} €` : '';
  const tot = (Number(r.puJour) || 0) + (Number(r.amort) || 0) + (Number(r.entret) || 0) + (Number(r.cons) || 0) + (Number(r.loc) || 0);
  return tot ? `${tot} €/j` : '';
};

export default function TpLibraryPanel({ resources, onInsert, onClose }) {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = cat === 'all' ? resources : resources.filter(r => r.category === cat);
    if (search.trim()) {
      const q = removeAccents(search);
      list = list.filter(r => removeAccents(r.designation).includes(q) || removeAccents(r.code).includes(q));
    }
    return list;
  }, [resources, cat, search]);

  return (
    <div className="w-72 shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <BookOpen size={16} className="text-orange-600" />
        <span className="text-sm font-bold text-slate-900 flex-1">Bibliothèque</span>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={15} /></button>
      </div>

      <div className="p-2 border-b border-slate-100 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-8 pr-2 py-1.5 bg-slate-100 border border-slate-200/60 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400" />
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>Tout</Chip>
          {POSTES.map(p => <Chip key={p} active={cat === p} onClick={() => setCat(p)}>{POSTE_LABELS[p]}</Chip>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            {resources.length === 0 ? 'Bibliothèque vide — alimentez-la dans l\'onglet Ressources.' : 'Aucune ressource pour ce filtre.'}
          </p>
        ) : filtered.map(r => (
          <button key={r.id} onClick={() => onInsert(r)}
            className="w-full text-left px-3 py-2 border-b border-slate-50 hover:bg-orange-50 group transition-colors">
            <div className="flex items-center gap-2">
              {r.code && <span className="text-[9px] font-mono font-bold px-1 rounded bg-slate-100 text-slate-500">{r.code}</span>}
              <span className="flex-1 text-xs font-semibold text-slate-800 truncate">{r.designation || 'Sans nom'}</span>
              <Plus size={13} className="text-slate-300 group-hover:text-orange-500 shrink-0" />
            </div>
            <div className="flex items-center justify-between mt-0.5 pl-0.5">
              <span className="text-[10px] text-slate-400">{POSTE_LABELS[r.category]} · {r.unit}</span>
              <span className="text-[10px] font-mono font-bold text-slate-600">{previewPU(r)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${active ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
      {children}
    </button>
  );
}
