import React, { useMemo, useState } from 'react';
import {
  FolderPlus, RefreshCw, Layers, Folder,
  FolderOpen as FolderOpenIcon,
  ChevronRight, ChevronDown, Edit2, Trash2,
} from 'lucide-react';
import { buildFolderColorMap, NEUTRAL_COLOR } from './folderColors';

/**
 * PmFolderSidebar
 *
 * Sidebar arborescente des dossiers projets.
 *
 * @param {Function} [onProjectDrop] - Optionnel : callback (targetFolderId, projectId) appelé
 *   au drop d'un projet draggable sur un dossier (ou null pour "Sans dossier"). Active le DnD.
 */
const PmFolderSidebar = ({
  folders, foldersLoading, selectedFolderId, setSelectedFolderId,
  expandedFolders, creatingFolder, setCreatingFolder, newFolderName, setNewFolderName,
  editingFolder, setEditingFolder, cloudProjects, rootFolders, getSubfolders,
  toggleExpand, handleCreateFolder, handleRenameFolder, handleDeleteFolder,
  onProjectDrop,
}) => {

  const colorMap = useMemo(() => buildFolderColorMap(folders), [folders]);
  const dndEnabled = typeof onProjectDrop === 'function';
  // Cible de drop courante : id du dossier ou '__none__' pour "Sans dossier"
  const [dropTargetId, setDropTargetId] = useState(null);

  // Handlers DnD factorisés (s'activent uniquement si onProjectDrop fourni)
  const dndProps = (targetKey, targetFolderId) => {
    if (!dndEnabled) return {};
    return {
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropTargetId !== targetKey) setDropTargetId(targetKey);
      },
      onDragLeave: () => {
        if (dropTargetId === targetKey) setDropTargetId(null);
      },
      onDrop: (e) => {
        e.preventDefault();
        const projectId = e.dataTransfer.getData('text/plain');
        setDropTargetId(null);
        if (projectId) onProjectDrop(targetFolderId, projectId);
      },
    };
  };

  const FolderRow = ({ folder, depth = 0 }) => {
    const subs = getSubfolders(folder.id);
    const hasSubs = subs.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const projectCount = cloudProjects.filter(p => p.folderId === folder.id).length;
    const isEditing = editingFolder?.id === folder.id;
    const fc = colorMap[folder.id] || NEUTRAL_COLOR;
    const isDropTarget = dropTargetId === folder.id;

    return (
      <div>
        <div
          onClick={() => setSelectedFolderId(folder.id)}
          {...dndProps(folder.id, folder.id)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all text-sm ${
            isDropTarget ? `${fc.sidebar} ring-2 ring-blue-400 ring-offset-1` :
            isSelected ? fc.sidebar : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <button
            onClick={e => hasSubs ? toggleExpand(folder.id, e) : e.stopPropagation()}
            className={`shrink-0 transition-colors ${hasSubs ? 'text-gray-400 hover:text-gray-600' : 'text-transparent'}`}
          >
            {hasSubs ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <ChevronRight size={12} />}
          </button>

          {isSelected
            ? <FolderOpenIcon size={14} className={`${fc.sidebarIcon} shrink-0`} />
            : <Folder size={14} className="text-gray-400 shrink-0 group-hover:text-gray-500" />}

          {isEditing ? (
            <input
              autoFocus
              value={editingFolder.name}
              onChange={e => setEditingFolder(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setEditingFolder(null); }}
              onBlur={handleRenameFolder}
              onClick={e => e.stopPropagation()}
              className="flex-1 min-w-0 bg-white border border-blue-300 rounded-lg px-1.5 py-0.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-blue-100"
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-xs font-medium">{folder.name}</span>
          )}

          {projectCount > 0 && !isEditing && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? fc.badge : 'bg-gray-100 text-gray-400'}`}>
              {projectCount}
            </span>
          )}

          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={e => { e.stopPropagation(); setCreatingFolder({ parentId: folder.id }); setNewFolderName(''); }}
                title="Sous-dossier" className="p-0.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50">
                <FolderPlus size={11} />
              </button>
              <button onClick={e => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); }}
                title="Renommer" className="p-0.5 rounded text-gray-400 hover:text-amber-500 hover:bg-amber-50">
                <Edit2 size={11} />
              </button>
              <button onClick={e => handleDeleteFolder(folder.id, e)}
                title="Supprimer" className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {creatingFolder?.parentId === folder.id && (
          <div className="flex items-center gap-1.5 px-3 py-1" style={{ paddingLeft: `${12 + (depth + 1) * 16 + 14}px` }}>
            <Folder size={12} className="text-gray-400 shrink-0" />
            <input
              autoFocus value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(null); }}
              onBlur={() => { if (newFolderName.trim()) handleCreateFolder(); else setCreatingFolder(null); }}
              placeholder="Nom du sous-dossier…"
              className="flex-1 min-w-0 bg-white border border-blue-300 rounded-lg px-1.5 py-0.5 text-xs text-gray-800 outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        {hasSubs && isExpanded && subs.map(sf => <FolderRow key={sf.id} folder={sf} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div className="w-52 shrink-0 border-r border-gray-200/60 bg-gray-50/50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200/60 shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dossiers</span>
        <button
          onClick={() => { setCreatingFolder({ parentId: null }); setNewFolderName(''); }}
          title="Nouveau dossier"
          className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        <button
          onClick={() => setSelectedFolderId('__all__')}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            selectedFolderId === '__all__' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <Layers size={13} className="shrink-0" />
          <span className="flex-1 text-left">Tous les projets</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{cloudProjects.length}</span>
        </button>

        <button
          onClick={() => setSelectedFolderId(null)}
          {...dndProps('__none__', null)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            dropTargetId === '__none__' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-400 ring-offset-1' :
            selectedFolderId === null ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <Folder size={13} className="shrink-0 opacity-40" />
          <span className="flex-1 text-left italic">Sans dossier</span>
          {cloudProjects.filter(p => !p.folderId).length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
              {cloudProjects.filter(p => !p.folderId).length}
            </span>
          )}
        </button>

        {folders.length > 0 && <div className="h-px bg-gray-200/60 my-2 mx-1" />}

        {foldersLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
            <RefreshCw size={12} className="animate-spin" /> Chargement…
          </div>
        )}

        {creatingFolder?.parentId === null && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Folder size={13} className="text-gray-400 shrink-0" />
            <input
              autoFocus value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(null); }}
              onBlur={() => { if (newFolderName.trim()) handleCreateFolder(); else setCreatingFolder(null); }}
              placeholder="Nom du dossier…"
              className="flex-1 min-w-0 bg-white border border-blue-300 rounded-lg px-1.5 py-0.5 text-xs text-gray-800 outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        {rootFolders.map(f => <FolderRow key={f.id} folder={f} />)}

        {!foldersLoading && folders.length === 0 && creatingFolder === null && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">Aucun dossier.<br />Cliquez sur + pour en créer.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PmFolderSidebar;
