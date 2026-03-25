// src/components/project/ProjectFormulaBar.jsx
import React from 'react';
import { FunctionSquare, ChevronRight, X } from 'lucide-react';

const ProjectFormulaBar = ({
  formulaBarState,
  setFormulaBarState,
  formulaMode,
  selectedItem,
  selectedFormula,
  hasSelectedFormula,
  renderFormulaReadable,
  displayToRaw,
  commitFormulaBar,
  openFormulaBar,
  closeFormulaBar,
  clearFormula,
  formulaInputRef
}) => {
  return (
    <div className={`border-y px-4 py-2 flex items-center gap-3 text-xs transition-all duration-200 ${
      formulaBarState.isEditing || formulaMode.isActive
        ? 'bg-amber-50 border-amber-200 shadow-sm'
        : 'bg-emerald-50 border-emerald-200'
    }`}>
      {/* Icône ƒ(x) — cliquable pour ouvrir l'édition */}
      <button
        onClick={formulaBarState.isEditing ? commitFormulaBar : openFormulaBar}
        title={formulaBarState.isEditing ? "Valider la formule (Entrée)" : "Éditer la formule"}
        className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md font-black text-[10px] tracking-wide transition-colors ${
          formulaBarState.isEditing
            ? 'bg-amber-300 text-amber-900 hover:bg-amber-400'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        <FunctionSquare size={13} />
        <span>ƒ(x)</span>
      </button>

      {/* Désignation de l'item sélectionné */}
      {selectedItem && (
        <>
          <span className="text-slate-500 font-semibold truncate max-w-[180px] shrink-0 text-[10px]">
            {selectedItem.designation}
          </span>
          <ChevronRight size={12} className="text-slate-300 shrink-0" />
        </>
      )}

      {/* Zone formule : INPUT si édition, sinon affichage lisible cliquable */}
      {formulaBarState.isEditing ? (
        <input
          ref={formulaInputRef}
          type="text"
          value={formulaBarState.displayValue}
          onChange={(e) => {
            const display = e.target.value;
            setFormulaBarState(prev => ({
              ...prev,
              displayValue: display,
              rawValue: displayToRaw(display),
            }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitFormulaBar(); }
            if (e.key === 'Escape') closeFormulaBar();
          }}
          placeholder="= puis cliquez un article pour l'insérer…"
          className="flex-1 font-mono text-[11px] rounded px-2 py-0.5 bg-white border border-amber-400 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
          spellCheck={false}
        />
      ) : (
        <div
          onClick={openFormulaBar}
          title="Cliquer pour éditer la formule"
          className="flex-1 font-mono text-[11px] rounded px-2 py-0.5 truncate cursor-pointer bg-white text-emerald-800 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
        >
          {hasSelectedFormula
            ? renderFormulaReadable(selectedFormula)
            : formulaMode.isActive
            ? <span className="text-amber-500 italic">Cliquez un article pour insérer une référence…</span>
            : ''
        }
        </div>
      )}

      {/* Actions */}
      {formulaBarState.isEditing ? (
        <>
          <button onClick={commitFormulaBar} className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors">
            ✓ Valider
          </button>
          {hasSelectedFormula && (
            <button onClick={clearFormula} title="Supprimer la formule" className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">
              <X size={11} /> Effacer
            </button>
          )}
          <button onClick={closeFormulaBar} className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-100 px-2 py-1 rounded-md transition-colors">
            <X size={11} /> Annuler
          </button>
        </>
      ) : (
        <>
          {hasSelectedFormula && (
            <button onClick={clearFormula} title="Supprimer la formule" className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">
              <X size={11} /> Effacer
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectFormulaBar;