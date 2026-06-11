import React, { useState, useEffect } from 'react';
import { X, MoveRight, Layers, CheckCircle2 } from 'lucide-react';
import { NEUTRAL_COLOR } from './folderColors';

const MoveFolderModal = ({ project, folders, onMove, onClose, colorMap = {} }) => {
  const [selectedId, setSelectedId] = useState(project?.folderId ?? '__none__');

  const rootFolders  = folders.filter(f => !f.parentId);
  const getSubfolders = (parentId) => folders.filter(f => f.parentId === parentId);

  // Fermeture par Échap
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = () => {
    onMove(project.id, selectedId === '__none__' ? null : selectedId);
  };

  const FolderOption = ({ folder, depth = 0 }) => {
    const subs = getSubfolders(folder.id);
    const fc = colorMap[folder.id] || NEUTRAL_COLOR;
    const isSelected = selectedId === folder.id;
    return (
      <>
        <button
          onClick={() => setSelectedId(folder.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left border ${
            isSelected
              ? 'bg-blue-50 text-blue-700 border-blue-200/60'
              : 'text-gray-600 hover:bg-gray-50 border-transparent'
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${fc.dot}`} />
          <span className="truncate">{folder.name}</span>
          {isSelected && <CheckCircle2 size={14} className="ml-auto shrink-0 text-blue-600" />}
        </button>
        {subs.map(sf => <FolderOption key={sf.id} folder={sf} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200/60 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0">
              <MoveRight size={16} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-semibold text-sm">Déplacer l'affaire</p>
              <p className="text-gray-500 text-xs truncate">{project?.name || 'Sans nom'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Liste dossiers */}
        <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
          {/* Option : sans dossier */}
          <button
            onClick={() => setSelectedId('__none__')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left border ${
              selectedId === '__none__'
                ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                : 'text-gray-500 hover:bg-gray-50 border-transparent'
            }`}
          >
            <Layers size={14} className="shrink-0" />
            <span className="italic">Sans dossier (racine)</span>
            {selectedId === '__none__' && <CheckCircle2 size={14} className="ml-auto shrink-0 text-blue-600" />}
          </button>

          {folders.length === 0 && (
            <p className="text-gray-400 text-xs text-center py-4">Aucun dossier créé.<br />Créez des dossiers depuis le panneau de gauche.</p>
          )}

          {rootFolders.map(f => <FolderOption key={f.id} folder={f} />)}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
            Annuler
          </button>
          <button onClick={handleConfirm} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-sm active:scale-[0.97]">
            Déplacer
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveFolderModal;
