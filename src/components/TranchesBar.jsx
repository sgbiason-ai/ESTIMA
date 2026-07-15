// src/components/TranchesBar.jsx
import React from 'react';
import { Layers, XCircle, PlusCircle } from 'lucide-react';
import { EditableTitle } from './ProjectUI'; // Assure-toi que le chemin est correct selon ton arborescence

const TranchesBar = ({
  hasTranches,
  isReadOnly,
  activeTrancheId,
  setActiveTrancheId,
  tranches,
  updateProjectItem,
  removeTranche,
  addTranche,
  theme
}) => {
  // Si on est en mode lecture seule et qu'il n'y a pas de tranches, on n'affiche rien
  if (!hasTranches && isReadOnly) return null;

  return (
    <div className={`px-6 flex items-center gap-2 border-b border-gray-200/60 overflow-x-auto ${theme.bg} z-10`}>
      {/* Onglet Global */}
      <button
        onClick={() => setActiveTrancheId('global')}
        className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-colors shrink-0 ${
          activeTrancheId === 'global' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-black/5'
        }`}
      >
        <Layers size={14} /> Global
      </button>

      {/* Boucle sur les tranches existantes */}
      {tranches.map((t) => (
        <div key={t.id} className="relative group flex items-center shrink-0">
          <div
            onClick={() => setActiveTrancheId(t.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer pr-10 ${
              activeTrancheId === t.id ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-black/5'
            }`}
          >
            <EditableTitle 
              value={t.name}
              onSave={(val) => updateProjectItem('root', 'root', 'tranche_rename', { id: t.id, name: val })}
              disabled={isReadOnly}
              cursor="cursor-pointer"
              className={`bg-transparent hover:bg-black/5 rounded px-1 -ml-1 ${activeTrancheId === t.id ? 'text-blue-700' : 'text-slate-400'}`}
            />
          </div>
          {!isReadOnly && (
            <button 
              onClick={(e) => removeTranche(t.id, e)} 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10" 
              title="Supprimer"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      ))}

      {/* Bouton d'ajout de tranche */}
      {!isReadOnly && (
        <button 
          onClick={addTranche} 
          className="flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-bold uppercase ml-2" 
          title="Ajouter"
        >
          <PlusCircle size={14} /> {hasTranches ? 'Ajouter' : 'Créer des Tranches'}
        </button>
      )}
    </div>
  );
};

export default TranchesBar;