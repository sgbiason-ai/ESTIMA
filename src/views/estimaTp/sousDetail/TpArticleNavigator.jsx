// src/views/estimaTp/sousDetail/TpArticleNavigator.jsx
// ESTIMA TP — navigateur compact d'articles du sous-détail (remplace la barre d'onglets,
// ingérable au-delà de ~20 articles). Une seule ligne : Précédent/Suivant, un combobox
// cherchable (liste groupée par chapitre, pastille « chiffré »), et un compteur d'avancement.
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Search, Check } from 'lucide-react';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function TpArticleNavigator({ articles, currentId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'done' | 'todo'
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const idx = Math.max(0, articles.findIndex(a => a.id === currentId));
  const current = articles[idx] || null;
  const total = articles.length;
  const chiffres = useMemo(() => articles.filter(a => a.hasDetail).length, [articles]);

  // Fermeture au clic extérieur + Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  // À l'ouverture : reset recherche + focus.
  useEffect(() => { if (open) { setSearch(''); const t = setTimeout(() => inputRef.current?.focus(), 0); return () => clearTimeout(t); } }, [open]);

  // Liste filtrée (statut + recherche), groupée par chapitre (ordre d'origine préservé).
  const groups = useMemo(() => {
    const q = norm(search);
    let l = articles;
    if (statusFilter === 'done') l = l.filter(a => a.hasDetail);
    else if (statusFilter === 'todo') l = l.filter(a => !a.hasDetail);
    if (q) l = l.filter(a => norm(a.num).includes(q) || norm(a.designation).includes(q));
    const map = new Map();
    l.forEach(a => {
      const key = a.chapterTitle || 'Sans chapitre';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()];
  }, [articles, search, statusFilter]);

  const firstMatch = groups[0]?.[1]?.[0] || null;
  const go = (i) => { const a = articles[i]; if (a) onSelect(a.id); };
  const select = (id) => { onSelect(id); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
      {/* Précédent / Suivant */}
      <button onClick={() => go(idx - 1)} disabled={idx <= 0} title="Article précédent"
        className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
        <ChevronLeft size={16} />
      </button>
      <button onClick={() => go(idx + 1)} disabled={idx >= total - 1} title="Article suivant"
        className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
        <ChevronRight size={16} />
      </button>

      {/* Combobox : article courant (clic → liste cherchable) */}
      <button onClick={() => setOpen(o => !o)} title="Choisir un article"
        className="min-w-0 flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-left">
        <span className="shrink-0 w-3.5 flex items-center justify-center" title={current?.hasDetail ? 'Chiffré' : 'Non chiffré'}>
          {current?.hasDetail
            ? <Check size={13} className="text-emerald-500" />
            : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
        </span>
        <span className="shrink-0 text-[10px] font-mono font-bold text-orange-600">{current?.num || '—'}</span>
        <span className="min-w-0 flex-1 text-xs font-semibold text-slate-800 truncate">{current?.designation || 'Sélectionnez un article'}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Compteur d'avancement */}
      <span className="shrink-0 text-[11px] font-semibold text-slate-400 tabular-nums whitespace-nowrap">
        {total ? idx + 1 : 0} / {total} · <span className="text-emerald-600">{chiffres} chiffré{chiffres > 1 ? 's' : ''}</span>
      </span>

      {/* Liste déroulante cherchable, groupée par chapitre */}
      {open && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && firstMatch) select(firstMatch.id); }}
                placeholder="Rechercher (n° ou désignation)…"
                className="w-full pl-8 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-400 focus:bg-white" />
            </div>
            {/* Filtre par statut de chiffrage */}
            <div className="mt-2 flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {[
                { k: 'all', label: 'Toutes', n: total },
                { k: 'done', label: 'Chiffrées', n: chiffres },
                { k: 'todo', label: 'Non chiffrées', n: total - chiffres },
              ].map(o => {
                const on = statusFilter === o.k;
                return (
                  <button key={o.k} onClick={() => setStatusFilter(o.k)}
                    className={`flex-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${on ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    {o.label} <span className={on ? 'text-orange-600' : 'text-slate-400'}>{o.n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] italic text-slate-400">Aucun article ne correspond.</p>
            ) : groups.map(([chapter, items]) => (
              <div key={chapter} className="mb-1">
                <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">{chapter || 'Sans chapitre'}</div>
                {items.map(a => {
                  const active = a.id === currentId;
                  return (
                    <button key={a.id} onClick={() => select(a.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${active ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                      <span className="shrink-0 w-3.5 flex items-center justify-center" title={a.hasDetail ? 'Chiffré' : 'Non chiffré'}>
                        {a.hasDetail
                          ? <Check size={13} className="text-emerald-500" />
                          : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                      </span>
                      <span className={`shrink-0 text-[10px] font-mono font-bold ${active ? 'text-orange-600' : 'text-slate-400'}`}>{a.num}</span>
                      <span className="min-w-0 flex-1 text-xs text-slate-700 truncate">{a.designation}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
