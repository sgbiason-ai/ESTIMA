// src/views/ged/GedCompareModal.jsx
// Modal d'audit comparatif entre deux versions.
// Toute la logique de diff vient de utils/archiveDiff.js (testée). Ce composant
// est purement présentation : sélecteur de cible + 3 onglets (Synthèse / Chapitres / Articles).

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { X, BarChart3, ArrowRight, TrendingUp, Plus, Trash2, ChevronDown } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';
import { buildComparison } from '../../utils/archiveDiff';
import { getPhaseStyle, formatDateShort } from './gedConstants';

const GedCompareModal = ({ show, onClose, sourceArchive, archives, currentProject }) => {
  const [compareTarget, setCompareTarget] = useState('current'); // 'current' ou archiveId
  const [activeTab, setActiveTab] = useState('summary');

  const compareOptions = useMemo(() => {
    const opts = [{ value: 'current', label: 'Version de travail actuelle' }];
    (archives || []).forEach((a) => {
      if (a.id !== sourceArchive?.id) opts.push({ value: a.id, label: a.label });
    });
    return opts;
  }, [archives, sourceArchive]);

  const targetChapters = useMemo(() => {
    if (compareTarget === 'current') return currentProject?.chapters || [];
    return archives?.find((a) => a.id === compareTarget)?.projectSnapshot?.chapters || [];
  }, [compareTarget, archives, currentProject]);

  const targetLabel = useMemo(() => {
    if (compareTarget === 'current') return 'Travail actuel';
    return archives?.find((a) => a.id === compareTarget)?.label || '?';
  }, [compareTarget, archives]);

  const cmp = useMemo(() => {
    if (!sourceArchive?.projectSnapshot) return null;
    return buildComparison(sourceArchive.projectSnapshot.chapters, targetChapters);
  }, [sourceArchive, targetChapters]);

  if (!show || !sourceArchive || !cmp) return null;

  const sStyle = getPhaseStyle(sourceArchive.phase);
  const { source, target, items, chapters, totalDiff, totalDiffPct } = cmp;

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[920px] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl"><BarChart3 size={20} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Audit comparatif</h2>
              <p className="text-[11px] text-slate-500">Comparer deux versions de l'étude de prix</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        {/* Sélecteurs */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${sStyle.light} ${sStyle.text} ${sStyle.border}`}>{sourceArchive.label}</span>
            <span className="text-[10px] text-slate-400">{formatDateShort(sourceArchive.createdAt)}</span>
          </div>
          <ArrowRight size={16} className="text-slate-300 shrink-0" />
          <div className="relative">
            <select
              value={compareTarget}
              onChange={(e) => setCompareTarget(e.target.value)}
              className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 appearance-none cursor-pointer hover:border-slate-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
            >
              {compareOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-slate-200 shrink-0">
          {[
            { id: 'summary', label: 'Synthèse' },
            { id: 'chapters', label: 'Chapitres' },
            { id: 'items', label: 'Articles' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-[11px] font-semibold transition-colors relative ${activeTab === tab.id ? 'text-indigo-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">

          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Total HT" source={formatPrice(source.totalHT)} target={formatPrice(target.totalHT)} diff={totalDiff} diffPct={totalDiffPct} />
                <KpiCard label="Articles" source={source.itemCount} target={target.itemCount} diff={target.itemCount - source.itemCount} isCount />
                <KpiCard label="Chapitres" source={source.chapters.length} target={target.chapters.length} diff={target.chapters.length - source.chapters.length} isCount />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <MovementCard icon={Plus} label="Ajoutés" count={items.added.length} color="emerald" />
                <MovementCard icon={Trash2} label="Supprimés" count={items.removed.length} color="red" />
                <MovementCard icon={TrendingUp} label="Modifiés" count={items.changed.length} color="amber" />
              </div>
            </div>
          )}

          {activeTab === 'chapters' && (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <span>Chapitre</span>
                <span className="text-right">{sourceArchive.label}</span>
                <span className="text-right">{targetLabel}</span>
                <span className="text-right">Écart</span>
              </div>
              {chapters.map((row, i) => {
                const diff = (row.target?.total || 0) - (row.source?.total || 0);
                return (
                  <div key={i} className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-2 text-[11px] border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <span className="font-medium text-slate-700 truncate">{row.title}</span>
                    <span className="text-right font-mono text-slate-500">{row.source ? formatPrice(row.source.total) : '—'}</span>
                    <span className="text-right font-mono text-slate-500">{row.target ? formatPrice(row.target.total) : '—'}</span>
                    <DiffBadge value={diff} />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-4">
              {items.added.length > 0 && <ItemSection title="Articles ajoutés" items={items.added} color="emerald" icon={Plus} />}
              {items.removed.length > 0 && <ItemSection title="Articles supprimés" items={items.removed} color="red" icon={Trash2} />}
              {items.changed.length > 0 && (
                <div>
                  <SectionHeader title="Articles modifiés" count={items.changed.length} color="amber" icon={TrendingUp} />
                  <div className="space-y-0.5">
                    {items.changed.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_90px_80px_80px_70px] gap-2 px-3 py-1.5 text-[11px] border-b border-slate-50 hover:bg-slate-50">
                        <span className="truncate text-slate-700">{c.source.designation}</span>
                        <span className="text-right font-mono text-slate-400">Q: {c.source.qty} → {c.target.qty}</span>
                        <span className="text-right font-mono text-slate-400">{formatPrice(c.source.price)}</span>
                        <span className="text-right font-mono text-slate-400">→ {formatPrice(c.target.price)}</span>
                        <DiffBadge value={c.diff} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!cmp.hasChanges && (
                <div className="text-center py-12 text-slate-400 text-sm">Aucune différence détectée sur les articles</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sous-composants ─────────────────────────────────────────────────
const KpiCard = ({ label, source, target, diff, diffPct, isCount }) => (
  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>
    <div className="flex items-end justify-between">
      <div><div className="text-[10px] text-slate-400 mb-0.5">Source</div><div className="text-lg font-bold text-slate-700 font-mono">{source}</div></div>
      <div className="text-right"><div className="text-[10px] text-slate-400 mb-0.5">Cible</div><div className="text-lg font-bold text-slate-700 font-mono">{target}</div></div>
    </div>
    <div className="mt-2 pt-2 border-t border-slate-200">
      <span className={`text-[11px] font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
        {diff > 0 ? '+' : ''}{isCount ? diff : formatPrice(diff)}
        {diffPct !== undefined && diff !== 0 && <span className="ml-1 font-normal">({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)</span>}
      </span>
    </div>
  </div>
);

const MovementCard = ({ icon: Icon, label, count, color }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-${color}-50 border-${color}-100`}>
    <Icon size={16} className={`text-${color}-500`} />
    <div><div className={`text-xl font-bold text-${color}-700 font-mono`}>{count}</div><div className="text-[10px] text-slate-500">{label}</div></div>
  </div>
);

const SectionHeader = ({ title, count, color, icon: Icon }) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon size={14} className={`text-${color}-500`} />
    <span className="text-[11px] font-bold text-slate-700">{title}</span>
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-${color}-50 text-${color}-600`}>{count}</span>
  </div>
);

const ItemSection = ({ title, items, color, icon }) => (
  <div>
    <SectionHeader title={title} count={items.length} color={color} icon={icon} />
    <div className="space-y-0.5">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_80px_80px] gap-2 px-3 py-1.5 text-[11px] border-b border-slate-50 hover:bg-slate-50">
          <span className="truncate text-slate-700">{item.designation}</span>
          <span className="text-right font-mono text-slate-400">{item.qty} {item.unit}</span>
          <span className="text-right font-mono text-slate-400">{formatPrice(item.price)}</span>
          <span className="text-right font-mono font-bold text-slate-600">{formatPrice(item.amount)}</span>
        </div>
      ))}
    </div>
  </div>
);

const DiffBadge = ({ value }) => {
  if (Math.abs(value) < 0.01) return <span className="text-right text-[10px] text-slate-300 font-mono">—</span>;
  return (
    <span className={`text-right text-[10px] font-bold font-mono ${value > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {value > 0 ? '+' : ''}{formatPrice(value)}
    </span>
  );
};

KpiCard.propTypes = { label: PropTypes.string, source: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), target: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), diff: PropTypes.number, diffPct: PropTypes.number, isCount: PropTypes.bool };
MovementCard.propTypes = { icon: PropTypes.elementType, label: PropTypes.string, count: PropTypes.number, color: PropTypes.string };
SectionHeader.propTypes = { title: PropTypes.string, count: PropTypes.number, color: PropTypes.string, icon: PropTypes.elementType };
ItemSection.propTypes = { title: PropTypes.string, items: PropTypes.array, color: PropTypes.string, icon: PropTypes.elementType };
DiffBadge.propTypes = { value: PropTypes.number };

GedCompareModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  sourceArchive: PropTypes.object,
  archives: PropTypes.array,
  currentProject: PropTypes.object,
};

export default GedCompareModal;
