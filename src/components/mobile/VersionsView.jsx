// src/components/mobile/VersionsView.jsx
// Sous-vue mobile « Documents émis » : liste en lecture seule des versions
// figées (archives) d'un projet. Groupées par phase, indice + date + montant.

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { fmt, dateFr } from './formatters';
import { getProjectPhases, phaseColorFor } from '../../utils/phaseModel';

const BADGE = {
  purple: 'bg-purple-100 text-purple-700', amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700', emerald: 'bg-emerald-100 text-emerald-700',
  teal: 'bg-teal-100 text-teal-700', red: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-700', rose: 'bg-rose-100 text-rose-700',
  cyan: 'bg-cyan-100 text-cyan-700', indigo: 'bg-indigo-100 text-indigo-700',
  slate: 'bg-slate-100 text-slate-600',
};

export default function VersionsView({ project, archives = [], loading }) {
  const phases = getProjectPhases(project);
  const phaseOrder = phases.map((p) => p.code);

  // Regroupe par phase (ordre des phases du projet, puis legacy), tri par indice desc.
  const grouped = useMemo(() => {
    const map = {};
    (archives || []).forEach((a) => {
      (map[a.phase] = map[a.phase] || []).push(a);
    });
    Object.values(map).forEach((l) => l.sort((a, b) => (b.index || 0) - (a.index || 0)));
    const keys = [...phaseOrder.filter((c) => map[c]), ...Object.keys(map).filter((c) => !phaseOrder.includes(c))];
    return keys.map((code) => ({ code, items: map[code] }));
  }, [archives, phaseOrder]);

  const colorOf = (code) => {
    const idx = phaseOrder.indexOf(code);
    return BADGE[phaseColorFor(code, idx >= 0 ? idx : 0)] || BADGE.slate;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Chargement…</span>
      </div>
    );
  }

  if (!archives.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3 px-8 text-center">
        <Icon name="layers" size={40} color="#d1d5db" />
        <p className="text-[14px] font-medium text-gray-500">Aucun document émis</p>
        <p className="text-[12px] text-gray-400">Les versions figées de l'étude de prix apparaîtront ici (création depuis l'ordinateur).</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {grouped.map(({ code, items }) => (
        <div key={code} className="mb-4">
          <div className="flex items-center gap-2 px-4 mb-1.5">
            <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${colorOf(code)}`}>{code}</span>
            <span className="text-[11px] text-gray-400">{items.length} version{items.length > 1 ? 's' : ''}</span>
          </div>
          {items.map((a) => (
            <div key={a.id} className="mx-4 mb-2 p-3.5 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg ${colorOf(code)}`}>{a.label}</span>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 uppercase tracking-wide">
                    <Icon name="lock" size={9} color="#f59e0b" /> Figée
                  </span>
                </div>
                <span className="text-[15px] font-bold text-gray-900 font-mono">{fmt(a.totalHT)}</span>
              </div>
              {(a.subject || a.recipient) && (
                <div className="text-[12px] text-gray-700 mb-1">
                  {a.subject && <span className="font-medium">{a.subject}</span>}
                  {a.recipient && <span className="text-gray-400">{a.subject ? ' · ' : ''}{a.recipient}</span>}
                </div>
              )}
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span>{dateFr(a.createdAt)}</span>
                <span>· {a.itemsCount} art.</span>
                {a.status === 'brouillon'
                  ? <span className="ml-auto text-amber-600 font-bold uppercase text-[9px]">Brouillon</span>
                  : <span className="ml-auto text-emerald-600 font-bold uppercase text-[9px]">Émis</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

VersionsView.propTypes = {
  project: PropTypes.object,
  archives: PropTypes.array,
  loading: PropTypes.bool,
};
