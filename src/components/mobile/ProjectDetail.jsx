import React from 'react';
import Icon from './Icon';
import { fmt, dateFr } from './formatters';
import { flattenItems } from './helpers';

export default function ProjectDetail({ project, projectMeta, calcHook, onNavigate, onNavigateModule, isLandscape }) {
  const totalClient = calcHook.projectStats?.client?.base + calcHook.projectStats?.client?.option || 0;
  const totalStudy  = calcHook.projectStats?.study?.base + calcHook.projectStats?.study?.option || 0;
  const nbTranches  = (project.tranches || []).length;
  const nbChapters  = (project.chapters || []).length;
  const nbItems     = flattenItems(project.chapters).length;
  const analysisCompanies = project.analysis?.companies || [];
  const hasRAO      = analysisCompanies.length > 0 || (project.rao && Object.keys(project.rao).length > 0);

  const menuItems = [
    { key: 'dqe', icon: 'euro', label: 'DQE par Tranche', desc: 'Détail quantitatif estimatif' },
    { key: 'bpu', icon: 'list', label: 'Bordereau des Prix', desc: `${nbItems} articles avec descriptions` },
    { key: 'tranches', icon: 'grid', label: 'Récap. par Tranche', desc: `${nbTranches || 1} tranche${nbTranches > 1 ? 's' : ''} · ${nbChapters} chapitres` },
    ...(hasRAO ? [{ key: 'rao', icon: 'chart', label: 'Analyse des Offres', desc: `${analysisCompanies.length} entreprise${analysisCompanies.length !== 1 ? 's' : ''}` }] : []),
    ...((project.sharepointPlans?.length > 0 || project.sharepointUrl) ? [{ key: 'plans', icon: 'map', label: 'Plans', desc: `${project.sharepointPlans?.length || 1} dossier${(project.sharepointPlans?.length || 1) > 1 ? 's' : ''} SharePoint` }] : []),
    ...(projectMeta?.hasCrc ? [{ key: 'crc', icon: 'clipboard', label: 'Comptes Rendus', desc: `${projectMeta.crcCount} CR lié${projectMeta.crcCount > 1 ? 's' : ''} à cette affaire` }] : []),
    { key: 'exports', icon: 'download', label: 'Exports', desc: 'PDF, Excel, partage' },
  ];

  return (
    <div className="py-1">
      {/* Summary */}
      <div className="mx-4 mt-2 mb-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          {project.client && <span className="text-xs text-gray-700 font-semibold">{project.client}</span>}
          <span className="text-xs text-gray-600">{dateFr(project.lastSaved)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] text-gray-700 font-bold uppercase tracking-wide">Étude</div>
            <div className="text-xl font-bold text-gray-900">{fmt(totalStudy)}</div>
          </div>
          {totalStudy > 0 && totalClient !== totalStudy && (
            <div className="text-center">
              <div className={`text-xs font-bold ${totalClient >= totalStudy ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalClient >= totalStudy ? '+' : ''}{((totalClient - totalStudy) / totalStudy * 100).toFixed(1)}%
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[10px] text-gray-700 font-bold uppercase tracking-wide">Client</div>
            <div className="text-xl font-bold text-blue-600">{fmt(totalClient)}</div>
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-700 font-medium">
          <span>{nbTranches || 'Aucune'} tranche{nbTranches > 1 ? 's' : ''}</span>
          <span>{nbItems} articles</span>
          {project.hasPSE && <span className="text-amber-600 font-bold">PSE</span>}
        </div>
      </div>

      {/* Menu */}
      <div className={`px-4 ${isLandscape ? 'grid grid-cols-2 gap-2' : ''}`}>
        {menuItems.map(item => (
          <button key={item.key} onClick={() => item.key === 'crc' ? onNavigateModule?.(projectMeta, 'crc') : onNavigate(item.key)}
            className="flex items-center gap-3 w-full py-3.5 border-b border-gray-100 text-left transition hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98]">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.key === 'crc' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
              <Icon name={item.icon} size={20} color={item.key === 'crc' ? '#059669' : '#2563eb'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-700 mt-0.5">{item.desc}</div>
            </div>
            <Icon name="chevron" size={16} color="#d1d5db" />
          </button>
        ))}
      </div>
    </div>
  );
}
