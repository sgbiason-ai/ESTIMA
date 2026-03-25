// src/components/rc/RcSidebar.jsx
import React from 'react';
import { 
  Search, X, Minimize2, Maximize2, RefreshCw, CheckSquare, 
  FileSignature, Plus, UploadCloud, Download, Cloud,
  ChevronRight, ChevronDown, Square, Edit3, Trash2, Star, FileText
} from 'lucide-react';

const RcSidebar = ({
  searchQuery, setSearchQuery,
  collapseAll, expandAll,
  saveStatus,
  filteredRcData, rcDataLength,
  onEditProject, addChapter, handleFileUpload, handleExportMaster, handleExportPdf, saveToCloud,
  expandedIds, selectedIds, activeNodeId,
  toggleExpand, toggleSelection, openEditor, deleteNode,
  isFavorite, toggleFavorite, favoritesCount = 0, onOpenFavorites,
}) => {

  const renderTree = (nodes, parentPrefix = "") => (
    <div className="pl-4 ml-1">
      {nodes.map((node, index) => {
        const currentNumber = parentPrefix ? `${parentPrefix}.${index + 1}` : `${index + 1}`;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedIds.has(node.id);
        const isActive = node.id === activeNodeId;

        return (
          <div key={node.id} id={`tree-node-${node.id}`} className="my-1">
            <div className={`
              flex items-center gap-2 p-1.5 rounded-lg transition-all group relative duration-200
              ${isActive ? 'bg-blue-100 border-l-4 border-blue-600 shadow-sm' : 'hover:bg-slate-50 border-l-4 border-transparent'} 
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
                onClick={(e) => { e.stopPropagation(); toggleSelection(node.id); }}
                title={isSelected ? 'Désélectionner ce chapitre (et ses enfants)' : 'Sélectionner ce chapitre (et ses enfants)'}
              >
                {isSelected 
                  ? <CheckSquare size={16} className="text-indigo-600 shrink-0" /> 
                  : <Square size={16} className="text-slate-300 hover:text-slate-400 shrink-0" />
                }
              </div>

              <div 
                className="flex-1 cursor-pointer truncate flex items-center gap-2"
                onClick={() => openEditor(node)}
                title="Éditer le contenu de ce chapitre"
              >
                <span className={`font-mono text-[9px] font-bold opacity-70 px-1 py-0.5 rounded ${isActive ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'}`}>
                  {currentNumber}
                </span>
                <span className={`text-xs truncate ${isActive ? 'font-bold text-blue-900' : (isSelected ? 'font-medium text-slate-800' : 'text-slate-500')}`}>
                  {node.title}
                </span>
                <Edit3 size={10} className={`${isActive ? 'text-blue-400' : 'text-slate-300'} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 px-1 rounded shadow-sm absolute right-2">
                {/* Étoile favori */}
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
      
      {/* EN-TÊTE */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 shrink-0">
          
        {/* Recherche */}
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

        {/* Barre d'outils */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-1">
            <button 
              onClick={collapseAll} 
              className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded shadow-sm" 
              title="Tout réduire"
            >
              <Minimize2 size={14} />
            </button>
            <button 
              onClick={expandAll} 
              className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded shadow-sm" 
              title="Tout développer"
            >
              <Maximize2 size={14} />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Sync Cloud...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                <CheckSquare size={10} /> À jour
              </span>
            )}
            <div 
              className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded"
              title="Chapitres filtrés / total"
            >
              {filteredRcData.length} / {rcDataLength}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="grid grid-cols-7 gap-1">
          <button 
            onClick={onEditProject} 
            className="col-span-1 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase"
            title="Modifier la fiche projet"
          >
            <FileSignature size={14} /> Projet
          </button>

          <button 
            onClick={() => addChapter()} 
            className="col-span-1 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase"
            title="Ajouter un nouveau chapitre de niveau 1 à la fin du RC"
          >
            <Plus size={14} /> Nouv.
          </button>

          <label 
            className="col-span-1 py-1.5 bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 rounded cursor-pointer flex items-center justify-center gap-1 text-[10px] font-bold uppercase"
            title="Importer un fichier Word (.docx)"
          >
            <UploadCloud size={14} /> Word
            <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
          </label>

          <button 
            onClick={handleExportMaster} 
            className="col-span-1 py-1.5 bg-white text-amber-600 hover:bg-amber-50 border border-slate-200 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase"
            title="Télécharger une sauvegarde JSON"
          >
            <Download size={14} /> Backup
          </button>

          <button
            onClick={handleExportPdf}
            className="col-span-1 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase"
            title="Exporter le RC en PDF"
          >
            <FileText size={13} /> PDF
          </button>

          <button 
            onClick={saveToCloud} 
            className="col-span-1 py-1.5 bg-slate-800 text-white hover:bg-slate-700 border border-slate-800 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase"
            title="Sauvegarder en Cloud"
          >
            <Cloud size={14} /> Cloud
          </button>

          <button
            onClick={onOpenFavorites}
            className="col-span-1 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase relative"
            title="Voir les clauses favorites"
          >
            <Star size={13} className={favoritesCount > 0 ? 'fill-amber-400' : 'fill-none'} />
            {favoritesCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {favoritesCount > 9 ? '9+' : favoritesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
        {renderTree(filteredRcData)}
      </div>
    </div>
  );
};

export default RcSidebar;