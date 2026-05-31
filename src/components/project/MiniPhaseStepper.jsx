// src/components/project/MiniPhaseStepper.jsx
// Mini-stepper compact des phases pour l'en-tête du projet.
// Affiche les phases en pastilles, met en avant la phase courante + l'indice
// de la dernière version figée. Cliquable → ouvre la GED « Documents émis ».

import React from 'react';
import PropTypes from 'prop-types';
import { FileStack, Check } from 'lucide-react';
import { getProjectPhases, getCurrentPhaseIndex, phaseColorFor, styleForColor } from '../../utils/phaseModel';

const MiniPhaseStepper = ({ project, archives = [], onClick }) => {
  const phases = getProjectPhases(project);
  const currentIndex = getCurrentPhaseIndex(project);
  const currentPhase = phases[currentIndex] || phases[0] || null;

  // Dernière version figée de la phase courante (indice affiché).
  const lastArchive = currentPhase
    ? (archives || [])
        .filter((a) => a.phase === currentPhase.code)
        .sort((a, b) => (b.index || 0) - (a.index || 0))[0] || null
    : null;

  const indice = lastArchive ? (lastArchive.label.split('-')[1] || lastArchive.label) : null;

  return (
    <button
      onClick={onClick}
      title={lastArchive
        ? `Phase ${currentPhase?.code} · dernière version émise ${lastArchive.label} — Ouvrir les documents émis`
        : `Phase ${currentPhase?.code || '—'} · aucune version figée — Ouvrir les documents émis`}
      className="group flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
    >
      {/* Pastilles de phases */}
      <div className="flex items-center gap-1">
        {phases.map((p, i) => {
          const done = currentIndex >= 0 && i < currentIndex;
          const current = i === currentIndex;
          const st = styleForColor(phaseColorFor(p.code, i));
          return (
            <span
              key={p.id}
              className={`flex items-center justify-center rounded-full transition-all
                ${current ? `${st.bg} w-4 h-4 text-white` : done ? `${st.bg} w-2.5 h-2.5` : 'bg-slate-300 w-1.5 h-1.5'}`}
            >
              {current && <Check size={9} strokeWidth={3} className="opacity-0" />}
            </span>
          );
        })}
      </div>

      {/* Code phase courante + indice */}
      <span className="text-[9px] font-bold text-slate-600 tracking-wide ml-0.5">{currentPhase?.code || '—'}</span>
      {indice ? (
        <span className="text-[9px] font-bold px-1 py-px rounded bg-indigo-100 text-indigo-700 tracking-wide">Ind. {indice}</span>
      ) : (
        <span className="text-[9px] font-medium text-slate-400 tracking-wide">non figé</span>
      )}
      <FileStack size={11} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
    </button>
  );
};

MiniPhaseStepper.propTypes = {
  project: PropTypes.object,
  archives: PropTypes.array,
  onClick: PropTypes.func,
};

export default MiniPhaseStepper;
