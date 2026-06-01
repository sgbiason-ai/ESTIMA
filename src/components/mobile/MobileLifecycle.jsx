// src/components/mobile/MobileLifecycle.jsx
// Frise « Cycle de vie » mobile (lecture seule) : stepper HORIZONTAL scrollable.
// Phases passées (✓ + indice + montant) · courante (pleine) · à venir (grisées).

import React from 'react';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { fmt, dateFr } from './formatters';
import { getProjectPhases, getCurrentPhaseIndex, phaseColorFor } from '../../utils/phaseModel';

const DOT = {
  purple: '#a855f7', amber: '#f59e0b', blue: '#3b82f6', emerald: '#10b981',
  teal: '#14b8a6', red: '#ef4444', violet: '#8b5cf6', rose: '#f43f5e',
  cyan: '#06b6d4', indigo: '#6366f1', slate: '#94a3b8',
};

export default function MobileLifecycle({ project, archives = [] }) {
  const phases = getProjectPhases(project);
  if (!phases.length) return null;
  const currentIndex = getCurrentPhaseIndex(project);
  const phaseLog = project?.phaseLog || [];

  const lastArchiveOf = (code) =>
    (archives || []).filter((a) => a.phase === code).sort((a, b) => (b.index || 0) - (a.index || 0))[0] || null;
  const milestoneTo = (code) => phaseLog.find((l) => l.to === code) || null;

  return (
    <div className="mx-4 mt-2 mb-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Cycle de vie</div>

      {/* Frise horizontale scrollable */}
      <div className="flex items-start overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {phases.map((phase, i) => {
          const done = currentIndex >= 0 && i < currentIndex;
          const current = i === currentIndex;
          const color = DOT[phaseColorFor(phase.code, i)] || DOT.slate;
          const arch = lastArchiveOf(phase.code);
          const ms = milestoneTo(phase.code);
          const last = i === phases.length - 1;

          return (
            <React.Fragment key={phase.id}>
              <div className="flex flex-col items-center shrink-0" style={{ minWidth: 76, maxWidth: 96 }}>
                {/* Pastille */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: done || current ? color : '#fff',
                    border: done || current ? 'none' : '2px solid #e5e7eb',
                    boxShadow: current ? `0 0 0 3px ${color}33` : 'none',
                  }}
                >
                  {done ? <Icon name="check" size={15} color="#fff" />
                    : <span className={`text-[12px] font-black ${current ? 'text-white' : 'text-gray-300'}`}>{i + 1}</span>}
                </div>

                {/* Code phase */}
                <span className={`mt-1.5 text-[12px] font-bold ${current ? 'text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                  {phase.code}
                </span>

                {/* Badge état / indice */}
                {current && (
                  <span className="mt-0.5 text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-900 text-white">En cours</span>
                )}
                {done && arch && (
                  <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-bold text-gray-500">
                    <Icon name="lock" size={8} color="#9ca3af" />{arch.label}
                  </span>
                )}

                {/* Montant + date (phases franchies) */}
                {done && arch && (
                  <span className="text-[9px] font-mono font-bold text-gray-700">{fmt(arch.totalHT)}</span>
                )}
                {done && ms && (
                  <span className="text-[8px] text-gray-400">{dateFr(ms.at)}</span>
                )}
              </div>

              {/* Connecteur horizontal */}
              {!last && (
                <div className="flex items-center shrink-0 pt-4" style={{ width: 16 }}>
                  <div className="h-0.5 w-full rounded" style={{ backgroundColor: i < currentIndex ? color : '#e5e7eb' }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

MobileLifecycle.propTypes = {
  project: PropTypes.object,
  archives: PropTypes.array,
};
