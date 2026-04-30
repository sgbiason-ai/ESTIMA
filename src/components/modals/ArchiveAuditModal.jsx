// src/components/modals/ArchiveAuditModal.jsx
import React, { useState, useMemo } from 'react';
import { X, BarChart3, ArrowRight, TrendingUp, TrendingDown, Minus, Plus, Trash2, ChevronDown } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';

const PHASE_COLORS = {
  ESQ: 'text-purple-700 bg-purple-50 border-purple-200',
  AVP: 'text-amber-700 bg-amber-50 border-amber-200',
  PRO: 'text-blue-700 bg-blue-50 border-blue-200',
  DCE: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  EXE: 'text-red-700 bg-red-50 border-red-200',
};

// ─── Utilitaires d'analyse ──────────────────────────────────────────
const analyzeChapters = (chapters) => {
  const result = { chapters: [], items: [], totalHT: 0, itemCount: 0 };

  const walk = (nodes, path = '') => {
    (nodes || []).forEach(node => {
      if (node.type === 'item') {
        const amount = (Number(node.qty) || 0) * (Number(node.price) || 0);
        result.items.push({
          id: node.id,
          uid: node.uid || node.bpuNum || '',
          designation: node.designation || '',
          qty: Number(node.qty) || 0,
          price: Number(node.price) || 0,
          amount,
          path,
          isOption: !!node.isOption,
        });
        if (!node.isOption) {
          result.totalHT += amount;
          result.itemCount++;
        }
      } else {
        const chapterTotal = computeChapterTotal(node);
        result.chapters.push({
          id: node.id,
          title: node.title || 'Sans titre',
          total: chapterTotal,
          itemCount: countChapterItems(node),
          path,
        });
        walk(node.children, path ? `${path} > ${node.title}` : node.title);
      }
    });
  };

  walk(chapters);
  return result;
};

const computeChapterTotal = (node) => {
  let total = 0;
  const walk = (nodes) => {
    (nodes || []).forEach(n => {
      if (n.type === 'item' && !n.isOption) {
        total += (Number(n.qty) || 0) * (Number(n.price) || 0);
      }
      if (n.children) walk(n.children);
    });
  };
  walk(node.children);
  return total;
};

const countChapterItems = (node) => {
  let count = 0;
  const walk = (nodes) => {
    (nodes || []).forEach(n => {
      if (n.type === 'item') count++;
      if (n.children) walk(n.children);
    });
  };
  walk(node.children);
  return count;
};

// ─── Composant principal ────────────────────────────────────────────
const ArchiveAuditModal = ({ show, onClose, sourceArchive, archives, currentProject }) => {
  const [compareTarget, setCompareTarget] = useState('current'); // 'current' ou un archiveId
  const [activeTab, setActiveTab] = useState('summary');

  // Options de comparaison
  const compareOptions = useMemo(() => {
    const opts = [{ value: 'current', label: 'Version actuelle' }];
    (archives || []).forEach(a => {
      if (a.id !== sourceArchive?.id) {
        opts.push({ value: a.id, label: a.label });
      }
    });
    return opts;
  }, [archives, sourceArchive]);

  // Données à comparer
  const sourceData = useMemo(() => {
    if (!sourceArchive?.projectSnapshot) return null;
    return analyzeChapters(sourceArchive.projectSnapshot.chapters);
  }, [sourceArchive]);

  const targetData = useMemo(() => {
    if (compareTarget === 'current') {
      return currentProject ? analyzeChapters(currentProject.chapters) : null;
    }
    const targetArchive = archives?.find(a => a.id === compareTarget);
    return targetArchive?.projectSnapshot ? analyzeChapters(targetArchive.projectSnapshot.chapters) : null;
  }, [compareTarget, archives, currentProject]);

  const targetLabel = useMemo(() => {
    if (compareTarget === 'current') return 'Version actuelle';
    return archives?.find(a => a.id === compareTarget)?.label || '?';
  }, [compareTarget, archives]);

  // Diff articles
  const itemDiff = useMemo(() => {
    if (!sourceData || !targetData) return { added: [], removed: [], changed: [] };

    const sourceMap = new Map(sourceData.items.map(i => [i.uid || i.id, i]));
    const targetMap = new Map(targetData.items.map(i => [i.uid || i.id, i]));

    const added = [];
    const removed = [];
    const changed = [];

    targetMap.forEach((tItem, key) => {
      const sItem = sourceMap.get(key);
      if (!sItem) {
        added.push(tItem);
      } else if (sItem.qty !== tItem.qty || sItem.price !== tItem.price) {
        changed.push({ source: sItem, target: tItem, diff: tItem.amount - sItem.amount });
      }
    });

    sourceMap.forEach((sItem, key) => {
      if (!targetMap.has(key)) removed.push(sItem);
    });

    return { added, removed, changed };
  }, [sourceData, targetData]);

  if (!show || !sourceArchive) return null;

  const totalDiff = (targetData?.totalHT || 0) - (sourceData?.totalHT || 0);
  const totalDiffPct = sourceData?.totalHT ? ((totalDiff / sourceData.totalHT) * 100) : 0;

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BarChart3 size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Audit comparatif</h2>
              <p className="text-[11px] text-slate-500">Comparer les versions du projet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Sélecteurs */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${PHASE_COLORS[sourceArchive.phase] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
              {sourceArchive.label}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(sourceArchive.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>

          <ArrowRight size={16} className="text-slate-300 shrink-0" />

          <div className="relative">
            <select
              value={compareTarget}
              onChange={e => setCompareTarget(e.target.value)}
              className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-1.5 pr-7 appearance-none cursor-pointer hover:border-slate-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
            >
              {compareOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-slate-200 bg-white">
          {[
            { id: 'summary', label: 'Synthèse' },
            { id: 'chapters', label: 'Chapitres' },
            { id: 'items', label: 'Articles' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-[11px] font-semibold transition-colors relative
                ${activeTab === tab.id
                  ? 'text-indigo-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Synthèse ── */}
          {activeTab === 'summary' && sourceData && targetData && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <KpiCard
                  label="Total HT"
                  source={formatPrice(sourceData.totalHT)}
                  target={formatPrice(targetData.totalHT)}
                  diff={totalDiff}
                  diffPct={totalDiffPct}
                />
                <KpiCard
                  label="Articles"
                  source={sourceData.itemCount}
                  target={targetData.itemCount}
                  diff={targetData.itemCount - sourceData.itemCount}
                  isCount
                />
                <KpiCard
                  label="Chapitres"
                  source={sourceData.chapters.length}
                  target={targetData.chapters.length}
                  diff={targetData.chapters.length - sourceData.chapters.length}
                  isCount
                />
              </div>

              {/* Résumé des mouvements */}
              <div className="grid grid-cols-3 gap-4">
                <MovementCard icon={Plus} label="Ajoutés" count={itemDiff.added.length} color="emerald" />
                <MovementCard icon={Trash2} label="Supprimés" count={itemDiff.removed.length} color="red" />
                <MovementCard icon={TrendingUp} label="Modifiés" count={itemDiff.changed.length} color="amber" />
              </div>
            </div>
          )}

          {/* ── Chapitres ── */}
          {activeTab === 'chapters' && sourceData && targetData && (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <span>Chapitre</span>
                <span className="text-right">{sourceArchive.label}</span>
                <span className="text-right">{targetLabel}</span>
                <span className="text-right">Ecart</span>
              </div>
              {mergeChapters(sourceData.chapters, targetData.chapters).map((row, i) => {
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

          {/* ── Articles ── */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              {itemDiff.added.length > 0 && (
                <ItemSection title="Articles ajoutés" items={itemDiff.added} color="emerald" icon={Plus} />
              )}
              {itemDiff.removed.length > 0 && (
                <ItemSection title="Articles supprimés" items={itemDiff.removed} color="red" icon={Trash2} />
              )}
              {itemDiff.changed.length > 0 && (
                <div>
                  <SectionHeader title="Articles modifiés" count={itemDiff.changed.length} color="amber" icon={TrendingUp} />
                  <div className="space-y-0.5">
                    {itemDiff.changed.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_70px] gap-2 px-3 py-1.5 text-[11px] border-b border-slate-50 hover:bg-slate-50">
                        <span className="truncate text-slate-700">{c.source.designation}</span>
                        <span className="text-right font-mono text-slate-400">Q: {c.source.qty} → {c.target.qty}</span>
                        <span className="text-right font-mono text-slate-400">P: {formatPrice(c.source.price)}</span>
                        <span className="text-right font-mono text-slate-400">→ {formatPrice(c.target.price)}</span>
                        <DiffBadge value={c.diff} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {itemDiff.added.length === 0 && itemDiff.removed.length === 0 && itemDiff.changed.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Aucune différence détectée sur les articles
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sous-composants ────────────────────────────────────────────────

const KpiCard = ({ label, source, target, diff, diffPct, isCount }) => (
  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>
    <div className="flex items-end justify-between">
      <div>
        <div className="text-[10px] text-slate-400 mb-0.5">Avant</div>
        <div className="text-lg font-bold text-slate-700 font-mono">{source}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-slate-400 mb-0.5">Après</div>
        <div className="text-lg font-bold text-slate-700 font-mono">{target}</div>
      </div>
    </div>
    <div className="mt-2 pt-2 border-t border-slate-200">
      <span className={`text-[11px] font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
        {diff > 0 ? '+' : ''}{isCount ? diff : formatPrice(diff)}
        {diffPct !== undefined && diff !== 0 && (
          <span className="ml-1 font-normal">({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)</span>
        )}
      </span>
    </div>
  </div>
);

const MovementCard = ({ icon: Icon, label, count, color }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-${color}-50 border-${color}-100`}>
    <Icon size={16} className={`text-${color}-500`} />
    <div>
      <div className={`text-xl font-bold text-${color}-700 font-mono`}>{count}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
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
        <div key={i} className="grid grid-cols-[1fr_60px_80px_80px] gap-2 px-3 py-1.5 text-[11px] border-b border-slate-50 hover:bg-slate-50">
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

// ─── Fusion des chapitres pour comparaison ──────────────────────────
const mergeChapters = (sourceChapters, targetChapters) => {
  const map = new Map();
  (sourceChapters || []).forEach(c => map.set(c.title, { title: c.title, source: c, target: null }));
  (targetChapters || []).forEach(c => {
    if (map.has(c.title)) {
      map.get(c.title).target = c;
    } else {
      map.set(c.title, { title: c.title, source: null, target: c });
    }
  });
  return Array.from(map.values());
};

export default ArchiveAuditModal;
