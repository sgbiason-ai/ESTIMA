// src/components/common/FavoritesPanel.jsx
import React, { useState, useMemo } from 'react';
import { Star, X, Search, ChevronRight, FileText, BookOpen, Trash2, PlusCircle, Clock } from 'lucide-react';

// ─── Prévisualisation HTML sécurisée ──────────────────────────────────────────
const HtmlPreview = ({ html }) => {
  if (!html) return <p className="text-xs text-slate-400 italic">Aucun contenu</p>;
  return (
    <div
      className="text-xs text-slate-600 leading-relaxed line-clamp-3 fav-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ─── Badge type ───────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
    type === 'cctp'
      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
      : 'bg-violet-100 text-violet-700 border border-violet-200'
  }`}>
    {type === 'cctp' ? <FileText size={8} /> : <BookOpen size={8} />}
    {type.toUpperCase()}
  </span>
);

// ─── Carte d'un favori ────────────────────────────────────────────────────────
const FavoriteCard = ({ fav, onInsert, onRemove, isExpanded, onToggleExpand }) => {
  const date = new Date(fav.addedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  return (
    <div className={`group bg-white rounded-xl border transition-all duration-200 ${
      isExpanded ? 'border-amber-300 shadow-md shadow-amber-50' : 'border-slate-200 hover:border-amber-200 hover:shadow-sm'
    }`}>
      {/* En-tête de la carte */}
      <div
        className="flex items-start gap-2.5 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Icône étoile */}
        <div className="shrink-0 mt-0.5">
          <Star size={13} className="fill-amber-400 text-amber-400" />
        </div>

        {/* Titre + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <TypeBadge type={fav.type} />
            <span className="flex items-center gap-1 text-[9px] text-slate-400">
              <Clock size={8} /> {date}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-700 leading-tight line-clamp-2">
            {fav.title}
          </p>
        </div>

        {/* Flèche expand */}
        <ChevronRight
          size={14}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Contenu déplié */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-100">
          <div className="mt-2.5 p-2.5 bg-slate-50 rounded-lg">
            <HtmlPreview html={fav.content} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-2.5">
            {onInsert && (
              <button
                onClick={(e) => { e.stopPropagation(); onInsert(fav); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <PlusCircle size={12} /> Insérer dans le document
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(fav.id); }}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 text-xs font-bold rounded-lg transition-colors border border-red-100"
              title="Retirer des favoris"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PANNEAU PRINCIPAL ────────────────────────────────────────────────────────
const FavoritesPanel = ({
  isOpen,
  onClose,
  favorites = [],          // tous les favoris (CCTP + RC)
  onInsert,                // (fav) => void — insère la clause dans le doc courant
  onRemove,                // (favoriteId) => void
  activeType = null,       // 'cctp' | 'rc' | null — filtre actif par défaut
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(activeType || 'all');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    return favorites.filter(f => {
      const matchType = typeFilter === 'all' || f.type === typeFilter;
      const matchSearch = !search.trim() ||
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        f.content?.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [favorites, typeFilter, search]);

  const cctpCount = favorites.filter(f => f.type === 'cctp').length;
  const rcCount   = favorites.filter(f => f.type === 'rc').length;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay sombre */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panneau latéral droit */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[380px] flex flex-col bg-white shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-250">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-gradient-to-br from-amber-50 to-amber-100/60 border-b border-amber-200 px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-400 p-1.5 rounded-lg">
                <Star size={16} className="fill-white text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide leading-none">
                  Clauses favorites
                </h2>
                <p className="text-[10px] text-amber-700 mt-0.5 font-medium">
                  {favorites.length} clause{favorites.length !== 1 ? 's' : ''} enregistrée{favorites.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white/80 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Filtres type */}
          <div className="flex gap-1.5">
            {[
              { key: 'all',  label: `Tout (${favorites.length})` },
              { key: 'cctp', label: `CCTP (${cctpCount})` },
              { key: 'rc',   label: `RC (${rcCount})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  typeFilter === key
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white/70 text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Recherche ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-2.5 border-b border-slate-100">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans les favoris..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Liste des favoris ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Star size={24} className="text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">
                  {search ? 'Aucun résultat' : 'Aucun favori'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                  {search
                    ? `Aucune clause ne correspond à "${search}"`
                    : 'Marquez des clauses avec ⭐ depuis la sidebar pour les retrouver ici'}
                </p>
              </div>
            </div>
          ) : (
            filtered.map(fav => (
              <FavoriteCard
                key={fav.id}
                fav={fav}
                onInsert={onInsert}
                onRemove={onRemove}
                isExpanded={expandedId === fav.id}
                onToggleExpand={() => setExpandedId(prev => prev === fav.id ? null : fav.id)}
              />
            ))
          )}
        </div>

        {/* ── Footer info ────────────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="shrink-0 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[10px] text-slate-400 text-center">
              {filtered.length} favori{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
              {search && ` · filtrés sur "${search}"`}
            </p>
          </div>
        )}
      </div>

      {/* CSS pour la prévisualisation HTML inline */}
      <style>{`
        .fav-preview p { margin: 0 0 4px 0; }
        .fav-preview ul, .fav-preview ol { margin: 0; padding-left: 16px; }
        .fav-preview li { margin-bottom: 2px; }
        .fav-preview table { font-size: 10px; border-collapse: collapse; }
        .fav-preview td, .fav-preview th { border: 1px solid #e2e8f0; padding: 2px 4px; }
      `}</style>
    </>
  );
};

export default FavoritesPanel;