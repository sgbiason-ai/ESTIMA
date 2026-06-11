import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Cloud, Clock, RefreshCw, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutGrid, List, BarChart3, ClipboardList, X, ChevronDown, Check,
} from 'lucide-react';
import { NEUTRAL_COLOR } from './folderColors';
import { PROJECT_STATUSES, getStatusInfo } from './pmMeta';

const SORT_OPTIONS = [
  { id: 'date', label: 'Date de sauvegarde' },
  { id: 'name', label: 'Nom' },
  { id: 'code', label: 'N° d\'affaire' },
  { id: 'location', label: 'Lieu' },
  { id: 'folder', label: 'Dossier' },
  { id: 'amount', label: 'Montant HT' },
];

/**
 * PmCommandBar — en-tête 2 lignes de pilotage du Workspace.
 * Ligne 1 : titre + compteur exact + onglets Cloud/Local + actualiser.
 * Ligne 2 (Cloud) : recherche « / », chips de filtre amovibles, tri + sens, vue.
 */
const PmCommandBar = ({
  historyTab, setHistoryTab,
  count, total,
  search, setSearch, searchRef,
  filters, setFilters,
  activeFolder, onClearFolder,
  sortBy, sortDir, onSort, onToggleDir,
  viewMode, setViewMode,
  cloudLoading, onRefresh,
  localCount, onClearLocal,
  trashCount = 0,
}) => {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const sortMenuRef = useRef(null);
  const statusMenuRef = useRef(null);

  useEffect(() => {
    if (!sortMenuOpen && !statusMenuOpen) return undefined;
    const onDown = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setSortMenuOpen(false);
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setStatusMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setSortMenuOpen(false); setStatusMenuOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [sortMenuOpen, statusMenuOpen]);

  const activeStatus = getStatusInfo(filters.status);

  const sortLabel = SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Trier';
  const fc = activeFolder?.color || NEUTRAL_COLOR;

  return (
    // z-10 obligatoire : le backdrop-blur crée un stacking context — sans z-index,
    // le conteneur relative du contenu passe au-dessus et masque les dropdowns
    // (statut, tri). Reste sous la toolbar (z-20) pour ne pas couvrir son menu Fichier.
    <div className="relative z-10 flex-none px-6 sm:px-8 pt-3 pb-2.5 bg-white/60 backdrop-blur-sm border-b border-gray-200/50 space-y-2.5">

      {/* ── Ligne 1 : titre + onglets ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 shrink-0">Mes Projets</h3>
          {historyTab === 'cloud' && total > 0 && (
            <span className="text-xs text-gray-500 shrink-0">
              {count === total ? `${total} affaire${total > 1 ? 's' : ''}` : `${count} sur ${total}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex p-0.5 bg-gray-100 border border-gray-200/60 rounded-xl">
            <button onClick={() => setHistoryTab('cloud')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                historyTab === 'cloud' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Cloud size={14} /> Cloud
            </button>
            <button onClick={() => setHistoryTab('local')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                historyTab === 'local' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Clock size={14} /> Local
            </button>
          </div>

          {historyTab === 'cloud' && (
            <button onClick={onRefresh} disabled={cloudLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <RefreshCw size={14} className={cloudLoading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Actualiser</span>
            </button>
          )}
          {historyTab === 'local' && localCount > 0 && (
            <button onClick={onClearLocal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all">
              <Trash2 size={14} /> <span className="hidden sm:inline">Vider</span>
            </button>
          )}

          {/* Corbeille */}
          <button onClick={() => setHistoryTab(historyTab === 'trash' ? 'cloud' : 'trash')}
            title="Corbeille"
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              historyTab === 'trash' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
            <Trash2 size={14} /> <span className="hidden md:inline">Corbeille</span>
            {trashCount > 0 && historyTab !== 'trash' && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">{trashCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Ligne 2 : barre de commande (Cloud) ── */}
      {historyTab === 'cloud' && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Recherche */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une affaire…"
              className="w-full pl-9 pr-12 py-1.5 bg-gray-100 border border-gray-200/60 hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl text-xs text-gray-700 placeholder-gray-400 outline-none transition-all"
            />
            {search ? (
              <button onClick={() => setSearch('')} aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 bg-white border border-gray-200/60 rounded px-1.5 py-0.5 pointer-events-none">/</kbd>
            )}
          </div>

          {/* Chips de filtre */}
          {activeFolder && (
            <button onClick={onClearFolder}
              className="flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-xl text-xs font-medium bg-white border border-gray-200/60 text-gray-700 hover:bg-gray-50 transition-all">
              <span className={`w-2 h-2 rounded-full ${fc.dot}`} />
              <span className="truncate max-w-[140px]">{activeFolder.name}</span>
              <X size={12} className="text-gray-400" />
            </button>
          )}
          <button onClick={() => setFilters(f => ({ ...f, rao: !f.rao }))}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filters.rao ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-white text-gray-500 border-gray-200/60 hover:bg-gray-50'}`}>
            <BarChart3 size={13} /> RAO {filters.rao && <X size={12} />}
          </button>
          <button onClick={() => setFilters(f => ({ ...f, crc: !f.crc }))}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filters.crc ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60' : 'bg-white text-gray-500 border-gray-200/60 hover:bg-gray-50'}`}>
            <ClipboardList size={13} /> CR {filters.crc && <X size={12} />}
          </button>

          {/* Filtre statut */}
          <div className="relative" ref={statusMenuRef}>
            <button onClick={() => setStatusMenuOpen(o => !o)}
              aria-haspopup="menu" aria-expanded={statusMenuOpen}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activeStatus ? activeStatus.badge : 'bg-white text-gray-500 border-gray-200/60 hover:bg-gray-50'}`}>
              {activeStatus ? (
                <><span className={`w-2 h-2 rounded-full ${activeStatus.dot}`} /> {activeStatus.label}</>
              ) : 'Statut'}
              <ChevronDown size={12} className={`transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-lg border border-gray-200/70 p-1.5 z-50">
                <button onClick={() => { setFilters(f => ({ ...f, status: null })); setStatusMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                    !filters.status ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`}>
                  <span className="flex-1">Tous les statuts</span>
                  {!filters.status && <Check size={13} className="text-blue-600" />}
                </button>
                {PROJECT_STATUSES.map(s => (
                  <button key={s.id}
                    onClick={() => { setFilters(f => ({ ...f, status: f.status === s.id ? null : s.id })); setStatusMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      filters.status === s.id ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className="flex-1">{s.label}</span>
                    {filters.status === s.id && <Check size={13} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Tri */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center bg-gray-100 border border-gray-200/60 rounded-xl">
              <button onClick={() => setSortMenuOpen(o => !o)}
                className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowUpDown size={13} /> <span className="hidden sm:inline">{sortLabel}</span>
                <ChevronDown size={12} className={`transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={onToggleDir} title={sortDir === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
                aria-label={sortDir === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
                className="px-2 py-1.5 border-l border-gray-200/60 text-gray-500 hover:text-gray-900 transition-colors">
                {sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              </button>
            </div>
            {sortMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-lg border border-gray-200/70 p-1.5 z-50">
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.id}
                    onClick={() => { onSort(opt.id); setSortMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      sortBy === opt.id ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <span className="flex-1">{opt.label}</span>
                    {sortBy === opt.id && <Check size={13} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vue */}
          <div className="flex items-center bg-gray-100 border border-gray-200/60 rounded-xl p-0.5">
            <button onClick={() => setViewMode('list')} title="Vue en liste" aria-label="Vue en liste"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <List size={14} />
            </button>
            <button onClick={() => setViewMode('grid')} title="Vue en dalles" aria-label="Vue en dalles"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PmCommandBar;
