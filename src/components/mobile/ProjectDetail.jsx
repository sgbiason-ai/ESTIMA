import React from 'react';
import Icon from './Icon';
import { fmt, fmtShort, dateFr } from './formatters';
import { flattenItems } from './helpers';

export default function ProjectDetail({ project, calcHook, onNavigate, onExport, isLandscape }) {
  const totalClient = calcHook.projectStats?.client?.base + calcHook.projectStats?.client?.option || 0;
  const totalStudy  = calcHook.projectStats?.study?.base + calcHook.projectStats?.study?.option || 0;
  const nbTranches  = (project.tranches || []).length;
  const nbChapters  = (project.chapters || []).length;
  const nbItems     = flattenItems(project.chapters).length;
  const hasRAO      = project.analysis && project.analysis.companies && project.analysis.companies.length > 0;

  const menuItems = [
    { key: 'dqe', icon: 'euro', label: 'DQE par Tranche', desc: 'Détail quantitatif estimatif' },
    { key: 'bpu', icon: 'list', label: 'Bordereau des Prix', desc: `${nbItems} articles avec descriptions` },
    { key: 'tranches', icon: 'grid', label: 'Récap. par Tranche', desc: `${nbTranches || 1} tranche${nbTranches > 1 ? 's' : ''} • ${nbChapters} chapitres` },
    ...(hasRAO ? [{ key: 'rao', icon: 'chart', label: 'Analyse des Offres', desc: `${project.analysis.companies.length} entreprises` }] : []),
    { key: 'exports', icon: 'download', label: 'Exports', desc: 'PDF, Excel, partage' },
  ];

  return (
    <div className="py-1">
      {/* Summary */}
      <div className="mx-4 mt-2 mb-3 p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="flex justify-between items-center mb-2">
          {project.client && <span className="text-xs text-slate-500 font-medium">{project.client}</span>}
          <span className="text-xs text-slate-400">{dateFr(project.lastSaved)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Étude</div>
            <div className="text-lg font-extrabold text-slate-100 -tracking-wide">{fmt(totalStudy)}</div>
          </div>
          {totalStudy > 0 && totalClient !== totalStudy && (
            <div className="text-center">
              <div className={`text-xs font-bold ${totalClient >= totalStudy ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalClient >= totalStudy ? '+' : ''}{((totalClient - totalStudy) / totalStudy * 100).toFixed(1)}%
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Client</div>
            <div className="text-lg font-extrabold text-emerald-400 -tracking-wide">{fmt(totalClient)}</div>
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span>{nbTranches || 'Aucune'} tranche{nbTranches > 1 ? 's' : ''}</span>
          <span>{nbItems} articles</span>
          {project.hasPSE && <span className="text-amber-500 font-bold">PSE</span>}
        </div>
      </div>

      {/* Menu */}
      <div className={`px-4 ${isLandscape ? 'grid grid-cols-2 gap-2' : ''}`}>
        {menuItems.map(item => (
          <button key={item.key} onClick={() => onNavigate(item.key)}
            className="flex items-center gap-3 w-full py-3.5 border-b border-white/5 text-left transition hover:bg-white/5 active:bg-white/10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Icon name={item.icon} size={20} color="#34d399" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-200">{item.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
            </div>
            <Icon name="chevron" size={16} color="#475569" />
          </button>
        ))}
      </div>
    </div>
  );
}
