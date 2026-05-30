// src/components/ArchiveBar.jsx
import React, { useState } from 'react';
import { Archive, Eye, X, ChevronDown, ChevronUp, Clock, FileText, BarChart3 } from 'lucide-react';
import { formatPrice } from '../utils/helpers';

const PHASE_COLORS = {
  ESQ: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400' },
  AVP: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  PRO: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  DCE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  EXE: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-400' },
};

const ArchiveBar = ({ archives, activeArchive, onViewArchive, onCloseArchive, onOpenAudit }) => {
  const [expanded, setExpanded] = useState(false);

  if (!archives || archives.length === 0) return null;

  // Grouper par phase
  const grouped = {};
  archives.forEach(a => {
    if (!grouped[a.phase]) grouped[a.phase] = [];
    grouped[a.phase].push(a);
  });

  const phaseOrder = ['ESQ', 'AVP', 'PRO', 'DCE', 'EXE'];
  const sortedPhases = phaseOrder.filter(p => grouped[p]);

  return (
    <div className="bg-white border-b border-slate-200 select-none">
      {/* Bandeau archive active */}
      {activeArchive && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <Archive size={15} className="text-amber-600 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
              Visualisation archive
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${PHASE_COLORS[activeArchive.phase]?.bg || 'bg-slate-100'} ${PHASE_COLORS[activeArchive.phase]?.text || 'text-slate-600'} ${PHASE_COLORS[activeArchive.phase]?.border || 'border-slate-200'} border`}>
              {activeArchive.label}
            </span>
            <span className="text-[10px] text-amber-600 truncate">
              {activeArchive.projectName} — {formatPrice(activeArchive.totalHT)} HT
            </span>
            <span className="text-[10px] text-amber-500">
              {new Date(activeArchive.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <button
            onClick={onOpenAudit}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors active:scale-95"
          >
            <BarChart3 size={13} />
            Audit
          </button>
          <button
            onClick={onCloseArchive}
            className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors"
            title="Fermer l'archive"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barre des archives */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Archive size={13} className="text-slate-400 shrink-0" />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Archives ({archives.length})
        </span>

        {/* Aperçu compact (quand replié) */}
        {!expanded && (
          <div className="flex items-center gap-1.5 ml-2 overflow-hidden">
            {sortedPhases.map(phase => {
              const c = PHASE_COLORS[phase] || PHASE_COLORS.DCE;
              return (
                <span key={phase} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text} ${c.border} border`}>
                  {phase} ({grouped[phase].length})
                </span>
              );
            })}
          </div>
        )}

        <div className="ml-auto">
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </div>

      {/* Liste dépliée */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {sortedPhases.map(phase => {
            const c = PHASE_COLORS[phase] || PHASE_COLORS.DCE;
            return (
              <div key={phase}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{phase}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-4">
                  {grouped[phase]
                    .sort((a, b) => a.index - b.index)
                    .map(archive => {
                      const isActive = activeArchive?.id === archive.id;
                      return (
                        <button
                          key={archive.id}
                          onClick={(e) => { e.stopPropagation(); onViewArchive(archive); }}
                          className={`
                            group flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left transition-all
                            ${isActive
                              ? `${c.bg} ${c.border} ${c.text} shadow-sm`
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm'
                            }
                          `}
                          title={`${archive.label} — ${new Date(archive.createdAt).toLocaleString('fr-FR')}\nPar: ${archive.createdBy}\n${archive.itemsCount} articles — ${formatPrice(archive.totalHT)} HT`}
                        >
                          <span className={`text-[11px] font-bold ${isActive ? c.text : 'text-slate-700'}`}>
                            {archive.label}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {formatPrice(archive.totalHT)}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {new Date(archive.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                          <Eye size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ArchiveBar;
