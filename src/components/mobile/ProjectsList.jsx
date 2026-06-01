import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import MobilePhaseBadge from './MobilePhaseBadge';

export default function ProjectsList({ projects, folders, loading, search, onSearch, onSelect, onSelectAndNavigate, onRefresh, isLandscape, selectedId = null }) {
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState(null); // null | 'rao' | 'crc'

  const subFolders = useMemo(() =>
    (folders || []).filter(f => (f.parentId || null) === currentFolderId),
  [folders, currentFolderId]);

  const currentProjects = useMemo(() => {
    const term = search.toLowerCase();
    let list;
    if (term) list = projects.filter(p => p.name.toLowerCase().includes(term) || (p.client || '').toLowerCase().includes(term));
    else if (showAll) list = projects;
    else list = projects.filter(p => (p.folderId || null) === currentFolderId);
    if (filter === 'rao') return list.filter(p => p.hasRao);
    if (filter === 'crc') return list.filter(p => p.hasCrc);
    return list;
  }, [projects, search, currentFolderId, showAll, filter]);

  const countInFolder = (folderId) => {
    const directCount = projects.filter(p => p.folderId === folderId).length;
    const childFolders = (folders || []).filter(f => f.parentId === folderId);
    return directCount + childFolders.reduce((sum, cf) => sum + countInFolder(cf.id), 0);
  };

  const breadcrumb = useMemo(() => {
    const path = [];
    let id = currentFolderId;
    while (id) {
      const f = (folders || []).find(fo => fo.id === id);
      if (!f) break;
      path.unshift(f);
      id = f.parentId || null;
    }
    return path;
  }, [folders, currentFolderId]);

  return (
    <div className="pb-2">
      {/* Sticky: Search + Stats */}
      <div className="sticky top-0 z-10 bg-[#f5f5f7]/90 backdrop-blur-xl pb-2">
      {/* Search */}
      <div className="flex items-center gap-2 mx-4 mt-3 mb-2 px-3.5 py-2.5 bg-white rounded-xl border border-gray-200">
        <Icon name="search" size={18} color="#9ca3af" />
        <input
          type="text" placeholder="Rechercher un projet…"
          value={search} onChange={(e) => onSearch(e.target.value)}
          className="flex-1 border-none outline-none text-[15px] bg-transparent text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* Stats + actions */}
      <div className="flex items-center gap-2 px-4 py-1">
        {/* Infos projets */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[14px] font-bold text-gray-900">{projects.length} projets</span>
          {projects.filter(p => p.hasRao).length > 0 && (
            <button
              onClick={() => setFilter(prev => prev === 'rao' ? null : 'rao')}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border transition active:scale-[0.95] ${
                filter === 'rao'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-blue-50 text-blue-600 border-blue-200/60'
              }`}
            >{projects.filter(p => p.hasRao).length} RAO</button>
          )}
          {projects.filter(p => p.hasCrc).length > 0 && (
            <button
              onClick={() => setFilter(prev => prev === 'crc' ? null : 'crc')}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border transition active:scale-[0.95] ${
                filter === 'crc'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
              }`}
            >{projects.filter(p => p.hasCrc).length} CR</button>
          )}
        </div>
        {/* Toggle tout voir */}
        <button
          onClick={() => { setShowAll(prev => !prev); setCurrentFolderId(null); }}
          className={`px-3 py-2 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] shrink-0 ${
            showAll
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-200 text-blue-600'
          }`}
        >
          {showAll ? '✕ Dossiers' : 'Tout voir'}
        </button>
        {/* Refresh */}
        <button onClick={onRefresh} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center active:scale-[0.97] transition shrink-0">
          <Icon name="refresh" size={16} color="#3b82f6" />
        </button>
      </div>
      </div>

      {/* Breadcrumb */}
      {!search && !showAll && currentFolderId !== null && (
        <div className="flex items-center gap-1.5 px-4 mb-3 overflow-x-auto">
          <button onClick={() => setCurrentFolderId(null)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-[14px] font-semibold text-blue-600 whitespace-nowrap shrink-0 active:bg-gray-50 transition">
            <Icon name="back" size={14} color="#2563eb" />
            Racine
          </button>
          {breadcrumb.map((f, i) => (
            <React.Fragment key={f.id}>
              <Icon name="chevron" size={12} color="#9ca3af" />
              {i < breadcrumb.length - 1 ? (
                <button onClick={() => setCurrentFolderId(f.id)} className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-[14px] font-semibold text-blue-600 whitespace-nowrap shrink-0 active:bg-gray-50 transition">{f.name}</button>
              ) : (
                <span className="px-3 py-2 rounded-xl bg-gray-900 text-white text-[14px] font-semibold whitespace-nowrap shrink-0">{f.name}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {/* Folders */}
      {!loading && !search && !showAll && subFolders.map(folder => {
        const count = countInFolder(folder.id);
        return (
          <button key={folder.id}
            onClick={() => setCurrentFolderId(folder.id)}
            className="flex items-center gap-3 w-[calc(100%-2rem)] mx-4 mb-1.5 p-3 bg-white rounded-xl border border-gray-200/60 text-left transition hover:shadow-md active:scale-[0.98]">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-900 truncate">{folder.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{count} projet{count > 1 ? 's' : ''}</div>
            </div>
            <Icon name="chevron" size={14} color="#d1d5db" />
          </button>
        );
      })}

      {!loading && !search && !showAll && subFolders.length > 0 && currentProjects.length > 0 && (
        <div className="h-px bg-gray-200/60 mx-6 my-2" />
      )}

      {/* Projects */}
      {!loading && currentProjects.length > 0 && (
      <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
      {currentProjects.map((p) => (
        <div key={p.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(p)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p); } }}
          className={`block p-4 rounded-xl border text-left transition hover:shadow-md active:scale-[0.98] cursor-pointer ${
            selectedId === p.id
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
              : 'bg-white border-gray-200/60'
          } ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{p.name}</div>
              {p.client && <div className="text-[13px] text-gray-400 font-medium mt-0.5">{p.client}</div>}
            </div>
            <MobilePhaseBadge project={p} />
          </div>
          <div className="flex items-center gap-2 mt-2 text-[13px] text-gray-400 font-medium">
            <span>{p.chaptersCount} chap.</span>
            <span className="text-gray-300">·</span>
            <span>{p.itemsCount} articles</span>
            {p.tranches.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span>{p.tranches.length} tr.</span>
              </>
            )}
            {p.hasRao && (
              <button
                onClick={(e) => { e.stopPropagation(); onSelectAndNavigate?.(p, 'rao'); }}
                className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/60 text-[9px] font-black rounded-md uppercase tracking-wide active:bg-blue-100 transition"
              >RAO</button>
            )}
            {p.hasCrc && (
              <button
                onClick={(e) => { e.stopPropagation(); onSelectAndNavigate?.(p, 'crc'); }}
                className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-[9px] font-black rounded-md uppercase tracking-wide active:bg-emerald-100 transition"
              >{p.crcCount} CR</button>
            )}
            <span className="ml-auto text-xs text-gray-300">{dateFr(p.lastSaved)}</span>
            <Icon name="chevron" size={14} color="#d1d5db" />
          </div>
        </div>
      ))}
      </div>
      )}

      {!loading && currentProjects.length === 0 && subFolders.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          {search ? 'Aucun projet trouvé' : 'Ce dossier est vide'}
        </div>
      )}
    </div>
  );
}
