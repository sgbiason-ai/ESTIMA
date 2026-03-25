import React, { useState, useMemo } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, X, AlertCircle, FileWarning, DollarSign, Ruler, PenLine, DatabaseBackup } from 'lucide-react';

const ISSUE_ICONS = {
  missing: <AlertCircle size={13} className="text-red-400 shrink-0" />,
  no_description: <FileWarning size={13} className="text-amber-400 shrink-0" />,
  price_diff: <DollarSign size={13} className="text-blue-400 shrink-0" />,
  unit_diff: <Ruler size={13} className="text-purple-400 shrink-0" />,
  desc_diff: <DatabaseBackup size={13} className="text-cyan-400 shrink-0" />,
  override: <PenLine size={13} className="text-amber-400 shrink-0" />,
};

const ISSUE_COLORS = {
  missing: 'text-red-300',
  no_description: 'text-amber-300',
  price_diff: 'text-blue-300',
  unit_diff: 'text-purple-300',
  desc_diff: 'text-cyan-300',
  override: 'text-amber-300',
};

const FILTER_DEFS = [
  { type: 'no_description', statKey: 'noDescription', icon: <FileWarning size={10} />, label: 'sans description',
    base: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
    active: 'bg-amber-500/30 border-amber-400 text-amber-300 ring-1 ring-amber-400/50' },
  { type: 'price_diff', statKey: 'priceDiff', icon: <DollarSign size={10} />, label: 'prix modifiés',
    base: 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20',
    active: 'bg-blue-500/30 border-blue-400 text-blue-300 ring-1 ring-blue-400/50' },
  { type: 'unit_diff', statKey: 'unitDiff', icon: <Ruler size={10} />, label: 'unités modifiées',
    base: 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20',
    active: 'bg-purple-500/30 border-purple-400 text-purple-300 ring-1 ring-purple-400/50' },
  { type: 'desc_diff', statKey: 'descDiff', icon: <DatabaseBackup size={10} />, label: 'desc. modifiées',
    base: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20',
    active: 'bg-cyan-500/30 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/50' },
  { type: 'override', statKey: 'overrides', icon: <PenLine size={10} />, label: 'surchargés',
    base: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
    active: 'bg-amber-500/30 border-amber-400 text-amber-300 ring-1 ring-amber-400/50' },
  { type: 'missing', statKey: 'missing', icon: <AlertCircle size={10} />, label: 'absents BPU',
    base: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20',
    active: 'bg-red-500/30 border-red-400 text-red-300 ring-1 ring-red-400/50' },
];

const scrollToItem = (itemId) => {
  const el = document.querySelector(`[data-bpu-item-id="${itemId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50');
    setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-50'), 2000);
  }
};

const BpuAuditPanel = ({ audit, onClose, onSyncDescriptions }) => {
  const [activeFilter, setActiveFilter] = useState(null);

  const filteredIssues = useMemo(() => {
    if (!audit?.issues) return [];
    if (!activeFilter) return audit.issues;
    return audit.issues.filter(item => item.issues.some(i => i.type === activeFilter));
  }, [audit?.issues, activeFilter]);

  const toggleFilter = (type) => {
    setActiveFilter(prev => prev === type ? null : type);
  };

  if (!audit) return null;

  return (
    <div className="w-[340px] bg-slate-900 border-l border-slate-700 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          {audit.stats.errors > 0
            ? <AlertTriangle size={15} className="text-amber-400" />
            : <CheckCircle2 size={15} className="text-emerald-400" />
          }
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            Audit — {audit.stats.total} articles
          </span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700">
          <X size={14} />
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-1.5 p-2.5 border-b border-slate-700/50">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5 text-center">
          <div className="text-base font-black text-emerald-400">{audit.stats.ok}</div>
          <div className="text-[8px] font-bold text-emerald-400/70 uppercase">Conformes</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 text-center">
          <div className="text-base font-black text-amber-400">{audit.stats.errors}</div>
          <div className="text-[8px] font-bold text-amber-400/70 uppercase">Alertes</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-1.5 text-center">
          <div className="text-base font-black text-red-400">{audit.stats.missing}</div>
          <div className="text-[8px] font-bold text-red-400/70 uppercase">Absents</div>
        </div>
      </div>

      {/* Filtres par type */}
      <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-slate-700/50">
        {FILTER_DEFS.map(f => {
          const count = audit.stats[f.statKey];
          if (!count) return null;
          const isActive = activeFilter === f.type;
          return (
            <button
              key={f.type}
              onClick={() => toggleFilter(f.type)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer border ${
                isActive ? f.active : f.base
              }`}
            >
              {f.icon} {count} {f.label}
            </button>
          );
        })}
        {activeFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-[8px] font-bold text-slate-300 hover:bg-slate-600 transition-all"
          >
            <X size={8} /> Tous
          </button>
        )}
        {audit.stats.errors === 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-bold text-emerald-400">
            <CheckCircle2 size={10} /> Tout est conforme
          </span>
        )}
      </div>

      {/* Liste des problèmes */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredIssues.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToItem(item.id)}
            className="w-full text-left bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 hover:bg-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded tabular-nums">{item.ref}</span>
              <span className="text-[10px] font-bold text-slate-200 truncate group-hover:text-white">{item.designation}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(activeFilter ? item.issues.filter(i => i.type === activeFilter) : item.issues).map((issue, idx) => (
                <div key={idx} className="flex items-center gap-1.5 pl-1">
                  {ISSUE_ICONS[issue.type]}
                  <span className={`text-[9px] font-medium ${ISSUE_COLORS[issue.type]}`}>{issue.label}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
        {filteredIssues.length === 0 && audit.stats.errors > 0 && (
          <div className="p-4 text-center text-slate-500 text-[10px] italic">Aucun résultat pour ce filtre</div>
        )}
      </div>

      {/* Bouton de synchronisation */}
      <div className="p-2.5 border-t border-slate-700 bg-slate-800/30">
        <button
          onClick={onSyncDescriptions}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          <RefreshCw size={12} />
          Synchroniser les descriptions
        </button>
      </div>
    </div>
  );
};

export default BpuAuditPanel;
