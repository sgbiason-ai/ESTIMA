// src/views/ged/GedLifecycle.jsx
// Frise « Cycle de vie » de l'affaire : stepper horizontal des phases.
// Phases passées (✓ + indice figé + montant) · phase courante (pleine) · à venir (grisées).

import React from 'react';
import PropTypes from 'prop-types';
import { Check, ChevronRight, Lock } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';
import { phaseColorFor, styleForColor } from '../../utils/phaseModel';
import { formatDateShort } from './gedConstants';

const GedLifecycle = ({ phases, currentPhaseId, archives = [], phaseLog = [] }) => {
  const currentIndex = phases.findIndex((p) => p.id === currentPhaseId);

  // Dernière version figée d'un code de phase (pour montant + indice).
  const lastArchiveOf = (code) =>
    (archives || [])
      .filter((a) => a.phase === code)
      .sort((a, b) => (b.index || 0) - (a.index || 0))[0] || null;

  // Date de franchissement (entrée dans la phase suivante) depuis le journal.
  const milestoneTo = (code) => (phaseLog || []).find((l) => l.to === code) || null;

  return (
    <div className="px-6 py-4 bg-white border-b border-gray-200/60">
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cycle de vie de l'affaire</span>
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
        {phases.map((phase, i) => {
          const isDone = currentIndex >= 0 && i < currentIndex;
          const isCurrent = i === currentIndex;
          const color = phaseColorFor(phase.code, i);
          const st = styleForColor(color);
          const arch = lastArchiveOf(phase.code);
          const ms = milestoneTo(phase.code);

          return (
            <React.Fragment key={phase.id}>
              <div className="flex flex-col items-center min-w-[92px] shrink-0">
                {/* Pastille */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all
                    ${isCurrent ? `${st.bg} border-transparent text-white shadow-md ring-4 ring-offset-1 ${st.light}`
                      : isDone ? `${st.bg} border-transparent text-white`
                      : 'bg-white border-gray-200 text-gray-300'}`}
                  title={phase.label || phase.code}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : <span className="text-[11px] font-black">{i + 1}</span>}
                </div>

                {/* Code + libellé */}
                <span className={`mt-1.5 text-[11px] font-bold ${isCurrent ? st.text : isDone ? 'text-gray-700' : 'text-gray-400'}`}>
                  {phase.code}
                </span>
                <span className="text-[8.5px] text-gray-400 text-center leading-tight max-w-[88px] truncate" title={phase.label}>
                  {phase.label || ''}
                </span>

                {/* Badge état */}
                {isCurrent && (
                  <span className={`mt-1 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${st.light} ${st.text}`}>
                    En cours
                  </span>
                )}
                {isDone && arch && (
                  <span className="mt-1 flex items-center gap-0.5 text-[8px] font-bold text-gray-500">
                    <Lock size={8} /> {arch.label}
                  </span>
                )}

                {/* Montant + date (phases franchies) */}
                {isDone && arch && (
                  <span className="text-[9px] font-mono font-semibold text-gray-600">{formatPrice(arch.totalHT)}</span>
                )}
                {isDone && ms && (
                  <span className="text-[8px] text-gray-400">{formatDateShort(ms.at)}</span>
                )}
              </div>

              {/* Connecteur */}
              {i < phases.length - 1 && (
                <div className="flex items-center pt-4 shrink-0">
                  <ChevronRight size={16} className={i < currentIndex ? 'text-gray-400' : 'text-gray-200'} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

GedLifecycle.propTypes = {
  phases: PropTypes.array.isRequired,
  currentPhaseId: PropTypes.string,
  archives: PropTypes.array,
  phaseLog: PropTypes.array,
};

export default GedLifecycle;
