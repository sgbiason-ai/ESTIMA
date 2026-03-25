import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';

export default function ProjectsList({ projects, folders, loading, search, onSearch, onSelect, onRefresh }) {
  // ── Navigation dans les dossiers ──
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = racine

  // Dossiers enfants du dossier courant
  const subFolders = useMemo(() =>
    (folders || []).filter(f => (f.parentId || null) === currentFolderId),
  [folders, currentFolderId]);

  // Projets dans le dossier courant (ou tous si recherche active)
  const currentProjects = useMemo(() => {
    const term = search.toLowerCase();
    if (term) {
      // En mode recherche, chercher dans tous les projets
      return projects.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.client || '').toLowerCase().includes(term)
      );
    }
    // Sinon, filtrer par dossier courant
    return projects.filter(p => (p.folderId || null) === currentFolderId);
  }, [projects, search, currentFolderId]);

  // Nombre de projets dans un dossier (récursif)
  const countInFolder = (folderId) => {
    const directCount = projects.filter(p => p.folderId === folderId).length;
    const childFolders = (folders || []).filter(f => f.parentId === folderId);
    return directCount + childFolders.reduce((sum, cf) => sum + countInFolder(cf.id), 0);
  };

  // Breadcrumb : chemin depuis la racine
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
      <div className="flex items-center gap-2 mx-4 mt-3 mb-2 px-3.5 py-2.5 bg-white/5 rounded-xl border border-white/10">
        <Icon name="search" size={18} color="#64748b" />
        <input
          type="text" placeholder="Rechercher un projet…"
          value={search} onChange={(e) => onSearch(e.target.value)}
          className="flex-1 border-none outline-none text-sm bg-transparent text-slate-200 placeholder-slate-500"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 py-1 mb-2">
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 text-center">
          <div className="text-lg font-extrabold text-slate-100">{projects.length}</div>
          <div className="text-xs text-slate-500 font-semibold">Projets</div>
        </div>
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 text-center">
          <div className="text-lg font-extrabold text-slate-100">
            {projects.filter(p => p.tranches.length > 0).length}
          </div>
          <div className="text-xs text-slate-500 font-semibold">Multi-tranches</div>
        </div>
        <button onClick={onRefresh} className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
          <Icon name="refresh" size={18} color="#34d399" />
        </button>
      </div>

      {/* Breadcrumb */}
      {!search && currentFolderId !== null && (
        <div className="flex items-center gap-1 px-4 mb-2 overflow-x-auto">
          <button
            onClick={() => setCurrentFolderId(null)}
            className="text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0"
          >
            Racine
          </button>
          {breadcrumb.map((f, i) => (
            <React.Fragment key={f.id}>
              <span className="text-slate-600 text-xs shrink-0">/</span>
              {i < breadcrumb.length - 1 ? (
                <button
                  onClick={() => setCurrentFolderId(f.id)}
                  className="text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0"
                >
                  {f.name}
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-300 whitespace-nowrap shrink-0">{f.name}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {/* Folders */}
      {!loading && !search && subFolders.map(folder => {
        const count = countInFolder(folder.id);
        return (
          <button key={folder.id}
            onClick={() => setCurrentFolderId(folder.id)}
            className="flex items-center gap-3 w-[calc(100%-2rem)] mx-4 mb-1.5 p-3 bg-white/5 rounded-xl border border-white/10 text-left transition hover:bg-white/10 active:scale-[0.99]">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-200 truncate">{folder.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{count} projet{count > 1 ? 's' : ''}</div>
            </div>
            <Icon name="chevron" size={14} color="#475569" />
          </button>
        );
      })}

      {/* Separator between folders and projects */}
      {!loading && !search && subFolders.length > 0 && currentProjects.length > 0 && (
        <div className="h-px bg-white/5 mx-6 my-2" />
      )}

      {/* Projects */}
      {!loading && currentProjects.map((p) => (
        <button key={p.id} onClick={() => onSelect(p)}
          className="block w-[calc(100%-2rem)] mx-4 mb-2 p-3.5 bg-white/5 rounded-xl border border-white/10 text-left transition hover:shadow-md active:scale-[0.99]">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-200 leading-tight truncate">{p.name}</div>
              {p.client && <div className="text-xs text-slate-500 font-medium mt-0.5">{p.client}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-semibold">
            <span>{p.chaptersCount} chap.</span>
            <span className="opacity-40">•</span>
            <span>{p.itemsCount} articles</span>
            {p.tranches.length > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span>{p.tranches.length} tr.</span>
              </>
            )}
            <span className="ml-auto text-xs text-slate-500 font-normal">{dateFr(p.lastSaved)}</span>
            <Icon name="chevron" size={14} color="#475569" />
          </div>
        </button>
      ))}

      {/* Empty state */}
      {!loading && currentProjects.length === 0 && subFolders.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">
          {search ? 'Aucun projet trouvé' : 'Ce dossier est vide'}
        </div>
      )}
    </div>
  );
}
