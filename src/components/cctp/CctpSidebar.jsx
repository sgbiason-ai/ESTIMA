import React from 'react';
import {
  Search, X, Minimize2, Maximize2, RefreshCw, CheckSquare,
  Plus, Crosshair,
  ChevronRight, ChevronDown, Square, Edit3, Trash2, Star
} from 'lucide-react';

const CctpSidebar = ({
  searchQuery, setSearchQuery,
  collapseAll, expandAll, selectAll, deselectAll, autoSelectChapters,
  filteredCctpData, cctpDataLength,
  addChapter,
  expandedIds, selectedIds, activeNodeId,
  toggleExpand, toggleSelection, openEditor, deleteNode,
  isFavorite, toggleFavorite, favoritesCount = 0, onOpenFavorites,
  provenance, devisItems = [], focusArticleId, setFocusArticleId, focusTargets, onLearnToggle,
}) => {

  const renderTree = (nodes, parentPrefix = "") => (
    <div className="pl-4 ml-1">
      {nodes.map((node, index) => {
        const currentNumber = parentPrefix ? `${parentPrefix}.${index + 1}` : `${index + 1}`;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedIds.has(node.id);
        const isActive = node.id === activeNodeId;
        const prov = provenance?.get?.(node.id);
        const isFocusTarget = focusTargets?.has?.(node.id);
        const inFocus = !!focusArticleId;

        return (
          <div key={node.id} id={`tree-node-${node.id}`} className="my-1">
            <div className={`
              flex items-center gap-2 p-1.5 rounded-lg transition-all group relative duration-200
              ${isActive ? 'bg-blue-100 border-l-4 border-blue-600 shadow-sm' : 'hover:bg-slate-50 border-l-4 border-transparent'}
              ${isFocusTarget ? 'ring-2 ring-amber-300 ring-inset' : ''}
            `}>
              <div
                className={`p-0.5 rounded hover:bg-slate-200 text-slate-400 cursor-pointer transition-colors ${hasChildren ? '' : 'invisible'}`}
                onClick={(e) => hasChildren && toggleExpand(node.id, e)}
                title={isExpanded ? 'Réduire' : 'Développer'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              <div
                className="cursor-pointer p-0.5"
                onClick={(e) => { e.stopPropagation(); inFocus ? onLearnToggle?.(node.id) : toggleSelection(node.id); }}
                title={inFocus
                  ? (isSelected ? 'Dissocier de l’article focalisé (mémorisé)' : 'Associer à l’article focalisé (mémorisé)')
                  : (isSelected ? 'Désélectionner ce chapitre (et ses enfants)' : 'Sélectionner ce chapitre (et ses enfants)')}
              >
                {isSelected
                  ? <CheckSquare size={16} className={`shrink-0 ${inFocus ? 'text-amber-600' : 'text-indigo-600'}`} />
                  : <Square size={16} className="text-slate-300 hover:text-slate-400 shrink-0" />
                }
              </div>

              <div
                className="flex-1 cursor-pointer truncate flex items-center gap-2"
                onClick={() => openEditor(node)}
                title="Éditer le contenu de ce chapitre"
              >
                {isSelected && prov && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${prov.confidence === 'sure' ? 'bg-blue-500' : 'bg-violet-400'}`}
                    title={`Coché automatiquement — ${prov.confidence === 'sure' ? 'certain' : 'déduit'} (${prov.sources.join(', ')})`}
                  />
                )}
                <span className={`font-mono text-[9px] font-bold opacity-70 px-1 py-0.5 rounded ${isActive ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'}`}>
                  {currentNumber}
                </span>
                <span className={`text-xs truncate ${isActive ? 'font-bold text-blue-900' : (isSelected ? 'font-medium text-slate-800' : 'text-slate-500')}`}>
                  {node.title}
                </span>
                <Edit3 size={10} className={`${isActive ? 'text-blue-400' : 'text-slate-300'} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 px-1 rounded shadow-sm absolute right-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite?.(node); }}
                  title={isFavorite?.(node.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  className={`p-1 rounded-md transition-colors ${
                    isFavorite?.(node.id)
                      ? 'text-amber-400 hover:bg-amber-50'
                      : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'
                  }`}
                >
                  <Star size={12} className={isFavorite?.(node.id) ? 'fill-amber-400' : 'fill-none'} />
                </button>
                {node.level < 5 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); addChapter(node.id); }}
                    className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-md"
                    title="Ajouter un sous-chapitre"
                  >
                    <Plus size={12} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                  className="p-1 hover:bg-red-100 text-red-500 rounded-md"
                  title="Supprimer ce chapitre"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {hasChildren && isExpanded && (
              <div className="border-l border-slate-200 ml-[11px]">
                {renderTree(node.children, currentNumber)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-1/3 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">

      {/* ═══ EN-TÊTE SIDEBAR ═══ */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f3f3f3] border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <button onClick={() => addChapter()} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] transition-all" title="Ajouter un nouveau chapitre">
            <Plus size={16} strokeWidth={1.6} className="text-emerald-600" />
            <span className="text-[11px] text-slate-600">Chapitre</span>
          </button>
        </div>
        <button
          onClick={onOpenFavorites}
          className="relative p-1.5 rounded hover:bg-[#dce6f0] border border-transparent hover:border-[#c4d5e8] transition-all"
          title="Voir les clauses favorites"
        >
          <Star size={16} strokeWidth={1.6} className={`text-amber-500 ${favoritesCount > 0 ? 'fill-amber-400' : 'fill-none'}`} />
          {favoritesCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
              {favoritesCount > 9 ? '9+' : favoritesCount}
            </span>
          )}
        </button>
      </div>

      {/* ═══ BARRE DE RECHERCHE + CONTRÔLES ARBRE ═══ */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Rechercher un chapitre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
            title="Filtrer les chapitres par mot-clé"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              title="Effacer la recherche"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button onClick={collapseAll} className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded shadow-sm" title="Tout réduire">
              <Minimize2 size={14} />
            </button>
            <button onClick={expandAll} className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded shadow-sm" title="Tout développer">
              <Maximize2 size={14} />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1 self-center"></div>
            <button onClick={selectAll} className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded shadow-sm" title="Tout sélectionner (cocher tous les chapitres)">
              <CheckSquare size={14} />
            </button>
            <button onClick={deselectAll} className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded shadow-sm" title="Tout désélectionner (décocher tous les chapitres)">
              <Square size={14} />
            </button>
            <button
              onClick={autoSelectChapters}
              className="px-2 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded shadow-sm text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ml-2"
              title="Sélection automatique des chapitres selon les articles du devis"
            >
              <RefreshCw size={12} /> Auto
            </button>
          </div>
          <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded" title="Chapitres filtrés / total">
            {filteredCctpData.length} / {cctpDataLength}
          </div>
        </div>
      </div>

      {/* ═══ FOCUS ARTICLE (apprentissage) ═══ */}
      {devisItems.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-200 bg-amber-50/40 shrink-0">
          <div className="flex items-center gap-2">
            <Crosshair size={13} className={`shrink-0 ${focusArticleId ? 'text-amber-600' : 'text-slate-400'}`} />
            <select
              value={focusArticleId || ''}
              onChange={(e) => setFocusArticleId?.(e.target.value || null)}
              className="flex-1 min-w-0 text-[11px] bg-white border border-amber-200/80 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-100"
              title="Focaliser un article du devis pour voir/ajuster les chapitres qu'il déclenche"
            >
              <option value="">Focus article… (apprentissage)</option>
              {devisItems.map((it) => (
                <option key={it.id} value={it.id}>{(it.designation || 'Article sans nom').slice(0, 70)}</option>
              ))}
            </select>
            {focusArticleId && (
              <button onClick={() => setFocusArticleId?.(null)} className="p-1 rounded hover:bg-amber-100 text-amber-600 shrink-0" title="Quitter le focus">
                <X size={14} />
              </button>
            )}
          </div>
          {focusArticleId ? (
            <p className="text-[10px] text-amber-700 mt-1 leading-tight">
              Chapitres surlignés = déclenchés par cet article. Cochez/décochez : la correspondance est mémorisée et rejouée à chaque AUTO.
            </p>
          ) : (
            <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> certain</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> déduit</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ ARBRE ═══ */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
        {renderTree(filteredCctpData)}
      </div>
    </div>
  );
};

export default CctpSidebar;
