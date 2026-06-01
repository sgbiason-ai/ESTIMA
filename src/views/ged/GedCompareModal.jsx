// src/views/ged/GedCompareModal.jsx
// Modal d'audit comparatif entre deux versions.
// Toute la logique de diff vient de utils/archiveDiff.js (testée). Ce composant
// est purement présentation : sélecteur de cible + de tranche + 3 onglets
// (Synthèse / Chapitres / Articles), avec décomposition qté/prix, waterfall,
// tri par impact, recherche et export PDF/Excel.

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  X, BarChart3, ArrowRight, TrendingUp, Plus, Trash2, ChevronDown,
  FileDown, Table2, Search, Package, Tag,
} from 'lucide-react';
import { formatPrice } from '../../utils/helpers';
import { toast } from '../../utils/globalUI';
import { buildComparison } from '../../utils/archiveDiff';
import { resolveStudyQtyMaps } from './gedExport';
import { exportAuditExcel, exportAuditPdf } from './auditExport';
import { getPhaseStyle, formatDateShort } from './gedConstants';

const GedCompareModal = ({ show, onClose, sourceArchive, archives, currentProject }) => {
  const [compareTarget, setCompareTarget] = useState('current'); // 'current' ou archiveId
  const [activeTab, setActiveTab] = useState('summary');
  const [tranche, setTranche] = useState('global');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);

  const compareOptions = useMemo(() => {
    const opts = [{ value: 'current', label: 'Version de travail actuelle' }];
    (archives || []).forEach((a) => {
      if (a.id !== sourceArchive?.id) opts.push({ value: a.id, label: a.label });
    });
    return opts;
  }, [archives, sourceArchive]);

  const targetProject = useMemo(() => {
    if (compareTarget === 'current') return currentProject;
    return archives?.find((a) => a.id === compareTarget)?.projectSnapshot || null;
  }, [compareTarget, archives, currentProject]);

  const targetLabel = useMemo(() => {
    if (compareTarget === 'current') return 'Travail actuel';
    return archives?.find((a) => a.id === compareTarget)?.label || '?';
  }, [compareTarget, archives]);

  const sourceProject = sourceArchive?.projectSnapshot || null;

  // Tranches communes aux deux versions (intersection par id) pour le sélecteur.
  const tranches = useMemo(() => {
    const sT = sourceProject?.tranches || [];
    const tT = targetProject?.tranches || [];
    if (sT.length === 0 || tT.length === 0) return [];
    const tIds = new Set(tT.map((t) => t.id));
    return sT.filter((t) => tIds.has(t.id));
  }, [sourceProject, targetProject]);
  const hasTranches = tranches.length > 0;

  // Résolution des quantités selon la tranche sélectionnée.
  const cmp = useMemo(() => {
    if (!sourceProject || !targetProject) return null;
    if (tranche === 'global' || !hasTranches) {
      const sMaps = resolveStudyQtyMaps(sourceProject).studyQtyMaps;
      const tMaps = resolveStudyQtyMaps(targetProject).studyQtyMaps;
      return buildComparison(sourceProject.chapters, targetProject.chapters, {
        sourceQtyMap: sMaps.global, targetQtyMap: tMaps.global,
      });
    }
    const sMaps = resolveStudyQtyMaps(sourceProject).studyQtyMaps;
    const tMaps = resolveStudyQtyMaps(targetProject).studyQtyMaps;
    return buildComparison(sourceProject.chapters, targetProject.chapters, {
      sourceQtyMap: sMaps[tranche], targetQtyMap: tMaps[tranche],
    });
  }, [sourceProject, targetProject, tranche, hasTranches]);

  const filteredChanged = useMemo(() => {
    if (!cmp) return [];
    const q = search.trim().toLowerCase();
    if (!q) return cmp.items.changedByImpact;
    return cmp.items.changedByImpact.filter((c) => c.source.designation.toLowerCase().includes(q));
  }, [cmp, search]);

  if (!show || !sourceArchive || !cmp) return null;

  const sStyle = getPhaseStyle(sourceArchive.phase);
  const { source, target, items, chapters, totalDiff, totalDiffPct, waterfall } = cmp;

  const handleExport = async (kind) => {
    setExportMenu(false);
    setExporting(true);
    try {
      const payload = { cmp, sourceLabel: sourceArchive.label, targetLabel, projectName: currentProject?.name };
      if (kind === 'pdf') await exportAuditPdf(payload);
      else await exportAuditExcel(payload);
      toast.success('Audit exporté');
    } catch (e) {
      toast.error('Erreur export : ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[960px] max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl"><BarChart3 size={20} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Audit comparatif</h2>
              <p className="text-[11px] text-slate-500">Comparer deux versions de l'étude de prix</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export */}
            <div className="relative">
              <button onClick={() => setExportMenu((v) => !v)} disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-[11px] font-bold rounded-lg hover:bg-gray-700 transition-colors active:scale-95 disabled:opacity-50">
                <FileDown size={13} /> {exporting ? 'Export…' : 'Exporter'} <ChevronDown size={12} />
              </button>
              {exportMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50">
                  <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                    <FileDown size={14} className="text-red-500" /> Audit PDF
                  </button>
                  <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                    <Table2 size={14} className="text-emerald-600" /> Audit Excel
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
          </div>
        </div>

        {/* Sélecteurs */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${sStyle.light} ${sStyle.text} ${sStyle.border}`}>{sourceArchive.label}</span>
            <span className="text-[10px] text-slate-400">{formatDateShort(sourceArchive.createdAt)}</span>
          </div>
          <ArrowRight size={16} className="text-slate-300 shrink-0" />
          <div className="relative">
            <select value={compareTarget} onChange={(e) => setCompareTarget(e.target.value)}
              className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 appearance-none cursor-pointer hover:border-slate-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none">
              {compareOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sélecteur de tranche */}
          {hasTranches && (
            <div className="flex items-center gap-1 ml-auto bg-gray-100 p-0.5 rounded-lg">
              <TrancheTab label="Global" active={tranche === 'global'} onClick={() => setTranche('global')} />
              {tranches.map((t) => (
                <TrancheTab key={t.id} label={t.name || t.id} active={tranche === t.id} onClick={() => setTranche(t.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-slate-200 shrink-0">
          {[
            { id: 'summary', label: 'Synthèse' },
            { id: 'chapters', label: 'Chapitres' },
            { id: 'items', label: 'Articles' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-[11px] font-semibold transition-colors relative ${activeTab === tab.id ? 'text-indigo-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
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

              {/* Waterfall : d'où vient l'écart */}
              <Waterfall waterfall={waterfall} sourceLabel={sourceArchive.label} targetLabel={targetLabel} />

              <div className="grid grid-cols-3 gap-4">
                <MovementCard icon={Plus} label="Ajoutés" count={items.added.length} color="emerald" />
                <MovementCard icon={Trash2} label="Supprimés" count={items.removed.length} color="red" />
                <MovementCard icon={TrendingUp} label="Modifiés" count={items.changed.length} color="amber" />
              </div>
            </div>
          )}

          {activeTab === 'chapters' && (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_100px_100px_90px] gap-2 px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <span>Chapitre</span>
                <span className="text-right">{sourceArchive.label}</span>
                <span className="text-right">{targetLabel}</span>
                <span className="text-right">Écart</span>
              </div>
              {chapters.map((row, i) => {
                const diff = (row.target?.total || 0) - (row.source?.total || 0);
                return (
                  <div key={i} className="grid grid-cols-[1fr_100px_100px_90px] gap-2 px-3 py-2 text-[11px] border-b border-slate-50 hover:bg-slate-50 transition-colors">
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
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeader title="Articles modifiés (par impact)" count={items.changed.length} color="amber" icon={TrendingUp} />
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
                        className="pl-7 pr-3 py-1 text-[11px] bg-gray-100 border border-gray-200/60 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none w-44" />
                    </div>
                  </div>

                  {/* En-tête colonnes */}
                  <div className="grid grid-cols-[1fr_110px_110px_80px_80px_80px] gap-2 px-3 py-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <span>Désignation</span>
                    <span className="text-right">Quantité</span>
                    <span className="text-right">PU HT</span>
                    <span className="text-right">Effet qté</span>
                    <span className="text-right">Effet prix</span>
                    <span className="text-right">Écart</span>
                  </div>

                  <div className="space-y-0.5">
                    {filteredChanged.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_110px_110px_80px_80px_80px] gap-2 px-3 py-1.5 text-[11px] border-b border-slate-50 hover:bg-slate-50 items-center">
                        <span className="truncate text-slate-700" title={c.source.designation}>{c.source.designation}</span>
                        <span className={`text-right font-mono ${c.qtyChanged ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                          {c.source.qty} → {c.target.qty}
                        </span>
                        <span className={`text-right font-mono ${c.priceChanged ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                          {formatPrice(c.source.price)} → {formatPrice(c.target.price)}
                        </span>
                        <EffectBadge value={c.qtyEffect} icon={Package} />
                        <EffectBadge value={c.priceEffect} icon={Tag} />
                        <DiffBadge value={c.diff} />
                      </div>
                    ))}
                    {filteredChanged.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-[12px]">Aucun article ne correspond à « {search} »</div>
                    )}
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

// ─── Waterfall ───────────────────────────────────────────────────────
const Waterfall = ({ waterfall, sourceLabel, targetLabel }) => {
  const rows = [
    { label: `Total ${sourceLabel}`, value: waterfall.start, kind: 'base' },
    { label: 'Articles ajoutés', value: waterfall.added, kind: 'delta' },
    { label: 'Articles supprimés', value: waterfall.removed, kind: 'delta' },
    { label: 'Effet quantité', value: waterfall.qtyEffect, kind: 'delta', sub: true },
    { label: 'Effet prix', value: waterfall.priceEffect, kind: 'delta', sub: true },
    { label: `Total ${targetLabel}`, value: waterfall.end, kind: 'base' },
  ];
  const max = Math.max(waterfall.start, waterfall.end, 1);
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Décomposition de l'écart</div>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const isBase = r.kind === 'base';
          const pct = Math.min(100, (Math.abs(r.value) / max) * 100);
          return (
            <div key={i} className={`flex items-center gap-3 ${r.sub ? 'pl-4' : ''}`}>
              <span className={`text-[11px] w-40 shrink-0 ${isBase ? 'font-bold text-slate-700' : r.sub ? 'text-slate-400' : 'text-slate-600'}`}>
                {r.sub ? '↳ ' : ''}{r.label}
              </span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${isBase ? 'bg-slate-400' : r.value > 0 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-[11px] font-mono w-24 text-right shrink-0 ${isBase ? 'font-bold text-slate-700' : r.value > 0 ? 'text-emerald-600' : r.value < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {!isBase && r.value > 0 ? '+' : ''}{formatPrice(r.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Sous-composants ─────────────────────────────────────────────────
const TrancheTab = ({ label, active, onClick }) => (
  <button onClick={onClick}
    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
    {label}
  </button>
);

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

// Petit badge d'effet (qté ou prix) — gris si nul.
const EffectBadge = ({ value, icon: Icon }) => {
  if (Math.abs(value) < 0.01) return <span className="flex items-center justify-end gap-0.5 text-[10px] text-slate-300 font-mono">—</span>;
  return (
    <span className={`flex items-center justify-end gap-0.5 text-[10px] font-mono font-semibold ${value > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon size={9} className="opacity-60" />{value > 0 ? '+' : ''}{formatPrice(value)}
    </span>
  );
};

Waterfall.propTypes = { waterfall: PropTypes.object, sourceLabel: PropTypes.string, targetLabel: PropTypes.string };
TrancheTab.propTypes = { label: PropTypes.string, active: PropTypes.bool, onClick: PropTypes.func };
KpiCard.propTypes = { label: PropTypes.string, source: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), target: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), diff: PropTypes.number, diffPct: PropTypes.number, isCount: PropTypes.bool };
MovementCard.propTypes = { icon: PropTypes.elementType, label: PropTypes.string, count: PropTypes.number, color: PropTypes.string };
SectionHeader.propTypes = { title: PropTypes.string, count: PropTypes.number, color: PropTypes.string, icon: PropTypes.elementType };
ItemSection.propTypes = { title: PropTypes.string, items: PropTypes.array, color: PropTypes.string, icon: PropTypes.elementType };
DiffBadge.propTypes = { value: PropTypes.number };
EffectBadge.propTypes = { value: PropTypes.number, icon: PropTypes.elementType };

GedCompareModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  sourceArchive: PropTypes.object,
  archives: PropTypes.array,
  currentProject: PropTypes.object,
};

export default GedCompareModal;
