// src/components/mobile/MobileLifecycle.jsx
// Frise « Cycle de vie » mobile (lecture seule) : phases passées / courante / à venir.
// Affiche pour chaque phase franchie l'indice figé, le montant et la date.

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
      <div className="flex flex-col">
        {phases.map((phase, i) => {
          const done = currentIndex >= 0 && i < currentIndex;
          const current = i === currentIndex;
          const color = DOT[phaseColorFor(phase.code, i)] || DOT.slate;
          const arch = lastArchiveOf(phase.code);
          const ms = milestoneTo(phase.code);
          const last = i === phases.length - 1;

          return (
            <div key={phase.id} className="flex gap-3">
              {/* Colonne pastille + ligne verticale */}
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: done || current ? color : '#fff',
                    border: done || current ? 'none' : '2px solid #e5e7eb',
                  }}
                >
                  {done ? <Icon name="check" size={14} color="#fff" />
                    : <span className={`text-[11px] font-black ${current ? 'text-white' : 'text-gray-300'}`}>{i + 1}</span>}
                </div>
                {!last && <div className="w-0.5 flex-1 my-0.5" style={{ backgroundColor: done ? color : '#e5e7eb', minHeight: 18 }} />}
              </div>

              {/* Infos phase */}
              <div className={`flex-1 min-w-0 ${last ? '' : 'pb-3'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[14px] font-bold ${current ? 'text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                    {phase.code}
                  </span>
                  {current && <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-900 text-white">En cours</span>}
                  {done && arch && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-gray-500">
                      <Icon name="lock" size={9} color="#9ca3af" /> {arch.label}
                    </span>
                  )}
                </div>
                {phase.label && <div className="text-[11px] text-gray-400 truncate">{phase.label}</div>}
                {done && arch && (
                  <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                    <span className="font-mono font-bold text-gray-700">{fmt(arch.totalHT)}</span>
                    {ms && <span className="text-gray-400">· {dateFr(ms.at)}</span>}
                  </div>
                )}
              </div>
            </div>
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
