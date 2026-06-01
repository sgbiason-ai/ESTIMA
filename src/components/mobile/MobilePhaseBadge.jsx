// src/components/mobile/MobilePhaseBadge.jsx
// Badge compact de la phase courante d'un projet (mobile, lecture seule).
// Réutilise le modèle de phases unifié (phaseModel) — couleur par phase.

import React from 'react';
import PropTypes from 'prop-types';
import { getCurrentPhase, phaseColorFor, getProjectPhases } from '../../utils/phaseModel';

export default function MobilePhaseBadge({ project, size = 'sm' }) {
  const phase = getCurrentPhase(project);
  if (!phase) return null;
  const phases = getProjectPhases(project);
  const idx = phases.findIndex((p) => p.id === phase.id);
  const color = phaseColorFor(phase.code, idx >= 0 ? idx : 0);

  // Classes opaques (haute lisibilité chantier) par couleur.
  const MAP = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    teal: 'bg-teal-100 text-teal-700 border-teal-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const cls = MAP[color] || MAP.slate;
  const pad = size === 'lg' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[9px]';

  return (
    <span className={`inline-flex items-center font-black uppercase tracking-wide rounded-md border ${cls} ${pad}`} title={phase.label || phase.code}>
      {phase.code}
    </span>
  );
}

MobilePhaseBadge.propTypes = {
  project: PropTypes.object,
  size: PropTypes.oneOf(['sm', 'lg']),
};
