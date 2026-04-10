import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';

export default function ProjectsList({ projects, folders, loading, search, onSearch, onSelect, onRefresh, isLandscape }) {
  const [currentFolderId, setCurrentFolderId] = useState(null);

  const subFolders = useMemo(() =>
    (folders || []).filter(f => (f.parentId || null) === currentFolderId),
  [folders, currentFolderId]);

  const currentProjects = useMemo(() => {
    const term = search.toLowerCase();
    if (term) return projects.filter(p => p.name.toLowerCase().includes(term) || (p.client || '').toLowerCase().includes(term));
    return projects.filter(p => (p.folderId || null) === currentFolderId);
  }, [projects, search, currentFolderId]);

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
      {/* Search */}
      <div className="flex items-center gap-2 mx-4 mt-3 mb-2 px-3.5 py-2.5 bg-white rounded-xl border border-gray-200/60">
        <Icon name="search" size={18} color="#9ca3af" />
        <input
          type="text" placeholder="Rechercher un projet…"
          value={search} onChange={(e) => onSearch(e.target.value)}
          className="flex-1 border-none outline-none text-[15px] bg-transparent text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 py-1 mb-2">
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200/60 text-center">
          <div className="text-xl font-bold text-gray-900">{projects.length}</div>
          <div className="text-[13px] text-gray-400 font-medium">Projets</div>
        </div>
        <div className="flex-1 bg-white rounded-xl p-3 border border-gray-200/60 text-center">
          <div className="text-xl font-bold text-gray-900">
            {projects.filter(p => p.tranches.length > 0).length}
          </div>
          <div className="text-[13px] text-gray-400 font-medium">Multi-tranches</div>
        </div>
        <button onClick={onRefresh} className="bg-white rounded-xl p-3 border border-gray-200/60 flex items-center justify-center hover:bg-gray-50 transition active:scale-[0.97]">
          <Icon name="refresh" size={18} color="#3b82f6" />
        </button>
      </div>

      {/* Breadcrumb */}
      {!search && currentFolderId !== null && (
        <div className="flex items-center gap-1 px-4 mb-2 overflow-x-auto">
          <button onClick={() => setCurrentFolderId(null)} className="text-xs font-medium text-blue-500 whitespace-nowrap shrink-0">
            Racine
          </button>
          {breadcrumb.map((f, i) => (
            <React.Fragment key={f.id}>
              <span className="text-gray-300 text-xs shrink-0">/</span>
              {i < breadcrumb.length - 1 ? (
                <button onClick={() => setCurrentFolderId(f.id)} className="text-xs font-medium text-blue-500 whitespace-nowrap shrink-0">{f.name}</button>
              ) : (
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap shrink-0">{f.name}</span>
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
      {!loading && !search && subFolders.map(folder => {
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

      {!loading && !search && subFolders.length > 0 && currentProjects.length > 0 && (
        <div className="h-px bg-gray-200/60 mx-6 my-2" />
      )}

      {/* Projects */}
      {!loading && currentProjects.length > 0 && (
      <div className={isLandscape ? 'grid grid-cols-2 gap-2 px-4' : 'contents'}>
      {currentProjects.map((p) => (
        <button key={p.id} onClick={() => onSelect(p)}
          className={`block p-4 bg-white rounded-xl border border-gray-200/60 text-left transition hover:shadow-md active:scale-[0.98] ${isLandscape ? '' : 'w-[calc(100%-2rem)] mx-4 mb-2'}`}>
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{p.name}</div>
              {p.client && <div className="text-[13px] text-gray-400 font-medium mt-0.5">{p.client}</div>}
            </div>
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
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-md uppercase tracking-wide">RAO</span>
            )}
            <span className="ml-auto text-xs text-gray-300">{dateFr(p.lastSaved)}</span>
            <Icon name="chevron" size={14} color="#d1d5db" />
          </div>
        </button>
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
