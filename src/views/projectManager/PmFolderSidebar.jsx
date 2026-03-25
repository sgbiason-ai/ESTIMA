import React from 'react';
import {
  FolderPlus, RefreshCw, Layers, Folder,
  FolderOpen as FolderOpenIcon,
  ChevronRight, ChevronDown, Edit2, Trash2,
} from 'lucide-react';

/**
 * PmFolderSidebar
 * Panneau gauche de l'onglet Cloud : arbre des dossiers avec CRUD inline.
 */
const PmFolderSidebar = ({
  folders,
  foldersLoading,
  selectedFolderId,
  setSelectedFolderId,
  expandedFolders,
  creatingFolder,
  setCreatingFolder,
  newFolderName,
  setNewFolderName,
  editingFolder,
  setEditingFolder,
  cloudProjects,
  rootFolders,
  getSubfolders,
  toggleExpand,
  handleCreateFolder,
  handleRenameFolder,
  handleDeleteFolder,
}) => {

  // ── Ligne de dossier récursive ─────────────────────────────────────────────
  const FolderRow = ({ folder, depth = 0 }) => {
    const subs         = getSubfolders(folder.id);
    const hasSubs      = subs.length > 0;
    const isExpanded   = expandedFolders.has(folder.id);
    const isSelected   = selectedFolderId === folder.id;
    const projectCount = cloudProjects.filter(p => p.folderId === folder.id).length;
    const isEditing    = editingFolder?.id === folder.id;

    return (
      <div>
        <div
          onClick={() => setSelectedFolderId(folder.id)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
            isSelected ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {/* Toggle expand */}
          <button
            onClick={e => hasSubs ? toggleExpand(folder.id, e) : e.stopPropagation()}
            className={`shrink-0 transition-colors ${hasSubs ? 'text-slate-400 hover:text-slate-200' : 'text-transparent'}`}
          >
            {hasSubs
              ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
              : <ChevronRight size={12} />}
          </button>

          {/* Icône dossier */}
          {isSelected
            ? <FolderOpenIcon size={14} className="text-emerald-400 shrink-0" />
            : <Folder size={14} className="text-slate-400 shrink-0 group-hover:text-slate-300" />}

          {/* Nom / input renommage */}
          {isEditing ? (
            <input
              autoFocus
              value={editingFolder.name}
              onChange={e => setEditingFolder(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setEditingFolder(null); }}
              onBlur={handleRenameFolder}
              onClick={e => e.stopPropagation()}
              className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-xs font-medium">{folder.name}</span>
          )}

          {/* Badge compteur */}
          {projectCount > 0 && !isEditing && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">
              {projectCount}
            </span>
          )}

          {/* Actions (au survol) */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setCreatingFolder({ parentId: folder.id }); setNewFolderName(''); }}
                title="Créer un sous-dossier"
                className="p-0.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700"
              >
                <FolderPlus size={11} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); }}
                title="Renommer"
                className="p-0.5 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-700"
              >
                <Edit2 size={11} />
              </button>
              <button
                onClick={e => handleDeleteFolder(folder.id, e)}
                title="Supprimer"
                className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Input création sous-dossier inline */}
        {creatingFolder?.parentId === folder.id && (
          <div className="flex items-center gap-1.5 px-3 py-1" style={{ paddingLeft: `${12 + (depth + 1) * 16 + 14}px` }}>
            <Folder size={12} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(null); }}
              onBlur={() => { if (newFolderName.trim()) handleCreateFolder(); else setCreatingFolder(null); }}
              placeholder="Nom du sous-dossier…"
              className="flex-1 min-w-0 bg-slate-700 border border-emerald-500/50 rounded px-1.5 py-0.5 text-xs text-slate-100 outline-none placeholder-slate-500"
            />
          </div>
        )}

        {/* Sous-dossiers */}
        {hasSubs && isExpanded && subs.map(sf => (
          <FolderRow key={sf.id} folder={sf} depth={depth + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="w-52 shrink-0 border-r border-slate-800 bg-slate-900/30 flex flex-col overflow-hidden">

      {/* Header sidebar */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800 shrink-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dossiers</span>
        <button
          onClick={() => { setCreatingFolder({ parentId: null }); setNewFolderName(''); }}
          title="Nouveau dossier"
          className="p-1 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">

        {/* Tous les projets */}
        <button
          onClick={() => setSelectedFolderId('__all__')}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedFolderId === '__all__'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Layers size={13} className="shrink-0" />
          <span className="flex-1 text-left">Tous les projets</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500">
            {cloudProjects.length}
          </span>
        </button>

        {/* Sans dossier */}
        <button
          onClick={() => setSelectedFolderId(null)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedFolderId === null
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Folder size={13} className="shrink-0 opacity-40" />
          <span className="flex-1 text-left italic">Sans dossier</span>
          {cloudProjects.filter(p => !p.folderId).length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500">
              {cloudProjects.filter(p => !p.folderId).length}
            </span>
          )}
        </button>

        {folders.length > 0 && <div className="h-px bg-slate-800 my-2 mx-1" />}

        {/* Chargement */}
        {foldersLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
            <RefreshCw size={12} className="animate-spin" /> Chargement…
          </div>
        )}

        {/* Input création dossier racine */}
        {creatingFolder?.parentId === null && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Folder size={13} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(null); }}
              onBlur={() => { if (newFolderName.trim()) handleCreateFolder(); else setCreatingFolder(null); }}
              placeholder="Nom du dossier…"
              className="flex-1 min-w-0 bg-slate-700 border border-emerald-500/50 rounded px-1.5 py-0.5 text-xs text-slate-100 outline-none placeholder-slate-500"
            />
          </div>
        )}

        {/* Arbre */}
        {rootFolders.map(f => <FolderRow key={f.id} folder={f} />)}

        {/* Empty state */}
        {!foldersLoading && folders.length === 0 && creatingFolder === null && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-slate-600 leading-relaxed">Aucun dossier.<br />Clique sur + pour en créer un.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PmFolderSidebar;
