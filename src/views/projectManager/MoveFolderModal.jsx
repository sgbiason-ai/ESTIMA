import React, { useState } from 'react';
import { X, MoveRight, Folder, Layers, CheckCircle2 } from 'lucide-react';

const MoveFolderModal = ({ project, folders, onMove, onClose }) => {
  const [selectedId, setSelectedId] = useState(project?.folderId ?? '__none__');

  const rootFolders  = folders.filter(f => !f.parentId);
  const getSubfolders = (parentId) => folders.filter(f => f.parentId === parentId);

  const handleConfirm = () => {
    onMove(project.id, selectedId === '__none__' ? null : selectedId);
  };

  const FolderOption = ({ folder, depth = 0 }) => {
    const subs = getSubfolders(folder.id);
    return (
      <>
        <button
          onClick={() => setSelectedId(folder.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
            selectedId === folder.id
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : 'text-slate-300 hover:bg-slate-700 border border-transparent'
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <Folder size={14} className={selectedId === folder.id ? 'text-emerald-400' : 'text-slate-400'} />
          <span>{folder.name}</span>
          {selectedId === folder.id && <CheckCircle2 size={13} className="ml-auto text-emerald-400" />}
        </button>
        {subs.map(sf => <FolderOption key={sf.id} folder={sf} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <MoveRight size={16} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-100 font-semibold text-sm">Déplacer l'affaire</p>
              <p className="text-slate-400 text-xs truncate max-w-[200px]">{project?.name || 'Sans nom'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Liste dossiers */}
        <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
          {/* Option : sans dossier */}
          <button
            onClick={() => setSelectedId('__none__')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              selectedId === '__none__'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                : 'text-slate-400 hover:bg-slate-700 border border-transparent'
            }`}
          >
            <Layers size={14} />
            <span>Sans dossier (racine)</span>
            {selectedId === '__none__' && <CheckCircle2 size={13} className="ml-auto text-emerald-400" />}
          </button>

          {folders.length === 0 && (
            <p className="text-slate-500 text-xs text-center py-4">Aucun dossier créé.<br />Crée des dossiers depuis le panneau de gauche.</p>
          )}

          {rootFolders.map(f => <FolderOption key={f.id} folder={f} />)}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700">
            Annuler
          </button>
          <button onClick={handleConfirm} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm">
            Déplacer
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveFolderModal;
