import React, { useState, useMemo } from 'react';
import {
  Crosshair, Search, X, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, RotateCcw, Check, AlertTriangle,
} from 'lucide-react';

// Panneau « Apprentissage devis ↔ CCTP » : sélection d'un article du devis pour
// voir/ajuster les chapitres qu'il déclenche. Remplace l'ancien <select> par une
// liste recherchable + filtres, avec repères visuels (appris, sans cible,
// compteur, n° BPU) et une carte contextuelle (navigation ‹ ›, reset).
const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'unlearned', label: 'Non appris' },
  { key: 'notarget', label: 'Sans cible' },
];

const CctpFocusPanel = ({
  articleStats = [],
  focusArticleId,
  setFocusArticleId,
  onResetArticle,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const learnedCount = useMemo(
    () => articleStats.filter((a) => a.isLearned).length,
    [articleStats]
  );
  const noTargetCount = useMemo(
    () => articleStats.filter((a) => a.targetCount === 0).length,
    [articleStats]
  );

  const focusArticle = useMemo(
    () => articleStats.find((a) => a.id === focusArticleId) || null,
    [articleStats, focusArticleId]
  );
  const focusIndex = focusArticle
    ? articleStats.findIndex((a) => a.id === focusArticle.id)
    : -1;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articleStats.filter((a) => {
      if (filter === 'unlearned' && a.isLearned) return false;
      if (filter === 'notarget' && a.targetCount !== 0) return false;
      if (!q) return true;
      return (
        a.designation.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        String(a.bpuNum).toLowerCase().includes(q)
      );
    });
  }, [articleStats, query, filter]);

  const pickArticle = (id) => {
    setFocusArticleId?.(id);
    setOpen(false);
  };

  // Navigation ‹ › dans l'ordre du devis.
  const goRelative = (delta) => {
    const next = articleStats[focusIndex + delta];
    if (next) setFocusArticleId?.(next.id);
  };

  return (
    <div className="border-b border-slate-200 bg-amber-50/40 shrink-0">
      {/* En-tête cliquable */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-50/70 transition-colors"
        title="Apprentissage : associer les articles du devis aux chapitres CCTP"
      >
        <Crosshair size={13} className={`shrink-0 ${focusArticleId ? 'text-amber-600' : 'text-slate-400'}`} />
        <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">
          {focusArticle ? `Focus : ${focusArticle.designation}` : 'Apprentissage devis ↔ CCTP'}
        </span>
        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0" title="Articles avec une correction mémorisée">
          {learnedCount}/{articleStats.length} appris
        </span>
        {open
          ? <ChevronUp size={13} className="text-slate-400 shrink-0" />
          : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
      </button>

      {/* Carte contextuelle de l'article focalisé */}
      {focusArticle && (
        <div className="px-3 pb-2">
          <div className="rounded-xl bg-white border border-amber-200 p-2 shadow-sm">
            <div className="flex items-start gap-2">
              {focusArticle.bpuNum && (
                <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-500 px-1 py-0.5 rounded shrink-0 mt-0.5">
                  {focusArticle.bpuNum}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-slate-800 leading-snug">{focusArticle.designation}</div>
                {focusArticle.description && (
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{focusArticle.description}</div>
                )}
              </div>
              <button onClick={() => setFocusArticleId?.(null)} className="p-1 rounded hover:bg-amber-100 text-amber-600 shrink-0" title="Quitter le focus">
                <X size={13} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${focusArticle.targetCount === 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}
                title="Chapitres CCTP déclenchés par cet article"
              >
                {focusArticle.targetCount} chapitre{focusArticle.targetCount > 1 ? 's' : ''}
              </span>
              {focusArticle.isLearned && (
                <button
                  onClick={onResetArticle}
                  className="flex items-center gap-1 text-[9px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                  title="Effacer l'apprentissage mémorisé pour cet article"
                >
                  <RotateCcw size={11} /> Réinitialiser
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => goRelative(-1)}
                disabled={focusIndex <= 0}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Article précédent"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[9px] text-slate-400 tabular-nums">{focusIndex + 1}/{articleStats.length}</span>
              <button
                onClick={() => goRelative(1)}
                disabled={focusIndex >= articleStats.length - 1}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Article suivant"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-amber-700 mt-1 leading-tight px-0.5">
            Surlignés dans l'arbre = déclenchés par cet article. Cochez/décochez : la correspondance est mémorisée et rejouée à chaque AUTO.
          </p>
        </div>
      )}

      {/* Sélecteur d'article : recherche + filtres + liste */}
      {open && (
        <div className="px-3 pb-2">
          <div className="relative mb-1.5">
            <Search className="absolute left-2 top-1.5 text-slate-400" size={13} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un article…"
              className="w-full pl-7 pr-7 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-300"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600" title="Effacer">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 mb-1.5">
            {FILTERS.map((f) => {
              const count = f.key === 'unlearned'
                ? articleStats.length - learnedCount
                : f.key === 'notarget'
                  ? noTargetCount
                  : articleStats.length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    filter === f.key
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label} {count}
                </button>
              );
            })}
          </div>

          <ul className="max-h-56 overflow-y-auto custom-scrollbar rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-[10px] text-slate-400 text-center">Aucun article</li>
            )}
            {filtered.map((a) => {
              const active = a.id === focusArticleId;
              return (
                <li
                  key={a.id}
                  onClick={() => pickArticle(a.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    active ? 'bg-amber-100' : 'hover:bg-amber-50'
                  }`}
                  title={a.designation}
                >
                  {a.isLearned
                    ? <Check size={12} className="text-emerald-500 shrink-0" />
                    : <span className="w-3 shrink-0" />}
                  {a.bpuNum && (
                    <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0">{a.bpuNum}</span>
                  )}
                  <span className="text-[11px] text-slate-700 truncate flex-1">{a.designation}</span>
                  {a.targetCount === 0 ? (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500 shrink-0" title="Aucun chapitre déclenché — à corriger">
                      <AlertTriangle size={10} /> 0
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded shrink-0" title="Chapitres déclenchés">
                      {a.targetCount}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Légende des pastilles de provenance (arbre) — visible hors focus */}
      {!focusArticle && (
        <div className="flex items-center gap-3 px-3 pb-2 text-[9px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> certain</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> déduit</span>
        </div>
      )}
    </div>
  );
};

export default CctpFocusPanel;
