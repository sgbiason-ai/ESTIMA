// src/components/modals/PriceAuditModal.jsx
import React, { useMemo, useState } from 'react';
import {
  X, Search, AlertTriangle, CheckCircle2, ArrowRightLeft,
  RotateCcw, RefreshCw, Filter, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, Info
} from 'lucide-react';
import { formatPrice } from '../../utils/helpers';

/* ════════════════════════════════════════════════════════════════
   Modale d'audit des prix — Compare projet vs BPU (base de données)
   Possibilité de rétablir un ou tous les prix depuis la BPU.
   ════════════════════════════════════════════════════════════════ */

const PriceAuditModal = ({ show, onClose, project, allBpuItems, onRestorePrice, onRestoreAllPrices }) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'diff' | 'missing' | 'match'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false);

  // ── Aplatir tous les items du projet avec leur chemin ──
  const auditData = useMemo(() => {
    if (!project?.chapters || !allBpuItems?.length) return [];

    const bpuMap = new Map();
    allBpuItems.forEach(b => {
      bpuMap.set(String(b.id), b);
      if (b.uid) bpuMap.set(String(b.uid), b);
    });

    const results = [];
    const walk = (nodes, path = []) => {
      (nodes || []).forEach(node => {
        if (node.type === 'item') {
          const uid = String(node.uid || '');
          const bpuItem = bpuMap.get(uid);
          const projectPrice = Number(node.price) || 0;
          const bpuPrice = bpuItem ? (Number(bpuItem.price) || 0) : null;
          const diff = bpuPrice !== null ? projectPrice - bpuPrice : null;
          const pctDiff = bpuPrice && bpuPrice !== 0 ? ((diff / bpuPrice) * 100) : null;

          let status = 'missing'; // pas trouvé dans la BPU
          if (bpuPrice !== null) {
            status = Math.abs(diff) < 0.005 ? 'match' : 'diff';
          }

          results.push({
            id: node.id,
            uid,
            designation: node.designation || '(sans nom)',
            unit: node.unit || '',
            projectPrice,
            bpuPrice,
            diff,
            pctDiff,
            status,
            path,
            bpuDesignation: bpuItem?.designation || null,
          });
        }
        if (node.children) {
          const label = node.title || node.designation || 'Chapitre';
          walk(node.children, [...path, label]);
        }
      });
    };
    walk(project.chapters);
    return results;
  }, [project, allBpuItems]);

  // ── Filtrage ──
  const filtered = useMemo(() => {
    let list = auditData;
    if (filterMode !== 'all') list = list.filter(r => r.status === filterMode);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.designation.toLowerCase().includes(q) ||
        r.path.some(p => p.toLowerCase().includes(q))
      );
    }
    return list;
  }, [auditData, filterMode, search]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total: auditData.length,
    match: auditData.filter(r => r.status === 'match').length,
    diff: auditData.filter(r => r.status === 'diff').length,
    missing: auditData.filter(r => r.status === 'missing').length,
  }), [auditData]);

  const diffItems = auditData.filter(r => r.status === 'diff');
  const totalImpact = diffItems.reduce((sum, r) => sum + (r.diff || 0), 0);

  // ── Grouper par chapitre ──
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(item => {
      const key = item.path.join(' › ') || 'Racine';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [filtered]);

  // ── Toggle sélection ──
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllDiffs = () => {
    setSelectedIds(new Set(diffItems.map(r => r.id)));
  };

  const handleRestoreSelected = () => {
    if (!onRestorePrice) return;
    const items = auditData.filter(r => selectedIds.has(r.id) && r.status === 'diff');
    items.forEach(item => {
      onRestorePrice(item.id, item.bpuPrice);
    });
    setSelectedIds(new Set());
  };

  const handleRestoreAll = () => {
    if (onRestoreAllPrices) {
      const restorations = diffItems.map(r => ({ id: r.id, price: r.bpuPrice }));
      onRestoreAllPrices(restorations);
    } else if (onRestorePrice) {
      diffItems.forEach(item => onRestorePrice(item.id, item.bpuPrice));
    }
    setConfirmRestoreAll(false);
    setSelectedIds(new Set());
  };

  const toggleChapter = (key) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Au premier rendu, tout ouvrir
  useMemo(() => {
    setExpandedChapters(new Set(grouped.keys()));
  }, [grouped.size]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[1050px] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">

        {/* ══ HEADER ══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <ArrowRightLeft size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Audit des prix</h2>
              <p className="text-[10.5px] text-slate-500">Comparaison prix projet vs base de données (BPU)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ══ STATS CARDS ══ */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Articles', value: stats.total, icon: Info, color: 'slate', filter: 'all' },
              { label: 'Conformes', value: stats.match, icon: CheckCircle2, color: 'emerald', filter: 'match' },
              { label: 'Écarts', value: stats.diff, icon: AlertTriangle, color: 'amber', filter: 'diff' },
              { label: 'Absents BPU', value: stats.missing, icon: Search, color: 'red', filter: 'missing' },
            ].map(({ label, value, icon: Icon, color, filter }) => (
              <button
                key={filter}
                onClick={() => setFilterMode(filterMode === filter ? 'all' : filter)}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-all
                  ${filterMode === filter
                    ? `bg-${color}-50 border-${color}-300 ring-2 ring-${color}-200/50`
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }
                `}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                  ${filterMode === filter ? `bg-${color}-500 text-white` : `bg-${color}-100 text-${color}-600`}
                `}>
                  <Icon size={16} />
                </div>
                <div className="text-left">
                  <div className={`text-lg font-bold leading-none ${filterMode === filter ? `text-${color}-700` : 'text-slate-800'}`}>{value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Impact total */}
          {stats.diff > 0 && (
            <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-lg border ${
              totalImpact > 0 ? 'bg-red-50 border-red-200' : totalImpact < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                {totalImpact > 0 ? <TrendingUp size={14} className="text-red-500" /> :
                 totalImpact < 0 ? <TrendingDown size={14} className="text-emerald-500" /> :
                 <Minus size={14} className="text-slate-400" />}
                <span className="text-[11px] font-medium text-slate-600">
                  Impact total des écarts (prix unitaires) :
                </span>
                <span className={`text-[12px] font-bold ${
                  totalImpact > 0 ? 'text-red-600' : totalImpact < 0 ? 'text-emerald-600' : 'text-slate-600'
                }`}>
                  {totalImpact > 0 ? '+' : ''}{formatPrice(totalImpact)}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">{stats.diff} article{stats.diff > 1 ? 's' : ''} concerné{stats.diff > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* ══ SEARCH + ACTIONS ══ */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un article..."
              className="w-full pl-9 pr-3 py-2 text-[11px] rounded-lg border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
            />
          </div>

          {stats.diff > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllDiffs}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <Filter size={12} />
                Tout sélectionner ({stats.diff})
              </button>

              {selectedIds.size > 0 && (
                <button
                  onClick={handleRestoreSelected}
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <RotateCcw size={12} />
                  Rétablir ({selectedIds.size})
                </button>
              )}

              <button
                onClick={() => setConfirmRestoreAll(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
              >
                <RefreshCw size={12} />
                Tout rétablir
              </button>
            </div>
          )}
        </div>

        {/* ══ TABLEAU ══ */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <CheckCircle2 size={40} strokeWidth={1} className="mb-3 text-emerald-300" />
              <p className="text-sm font-medium">
                {filterMode === 'diff' ? 'Aucun écart de prix détecté' :
                 filterMode === 'missing' ? 'Tous les articles sont dans la BPU' :
                 filterMode === 'match' ? 'Aucun article conforme trouvé' :
                 'Aucun article trouvé'}
              </p>
              <p className="text-[11px] mt-1">Tous les prix du projet correspondent à la base de données</p>
            </div>
          ) : (
            <div className="text-[11px]">
              {/* En-tête du tableau */}
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_60px_110px_110px_100px_80px_44px] gap-2 px-6 py-2 bg-slate-100 border-b border-slate-200 font-bold text-[10px] uppercase tracking-wider text-slate-500">
                <span>Désignation</span>
                <span className="text-center">Unité</span>
                <span className="text-right">Prix projet</span>
                <span className="text-right">Prix BPU</span>
                <span className="text-right">Écart</span>
                <span className="text-center">Statut</span>
                <span></span>
              </div>

              {/* Corps groupé par chapitre */}
              {[...grouped.entries()].map(([chapterKey, items]) => {
                const isExpanded = expandedChapters.has(chapterKey);
                const chapterDiffs = items.filter(i => i.status === 'diff').length;
                return (
                  <div key={chapterKey}>
                    {/* Header chapitre */}
                    <button
                      onClick={() => toggleChapter(chapterKey)}
                      className="w-full flex items-center gap-2 px-6 py-2 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                      <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">{chapterKey}</span>
                      <span className="text-[9px] text-slate-400 font-medium">{items.length} article{items.length > 1 ? 's' : ''}</span>
                      {chapterDiffs > 0 && (
                        <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">{chapterDiffs} écart{chapterDiffs > 1 ? 's' : ''}</span>
                      )}
                    </button>

                    {/* Items */}
                    {isExpanded && items.map(item => (
                      <div
                        key={item.id}
                        className={`
                          grid grid-cols-[1fr_60px_110px_110px_100px_80px_44px] gap-2 px-6 py-2 border-b border-slate-50
                          transition-colors
                          ${item.status === 'diff' ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50/50'}
                          ${selectedIds.has(item.id) ? 'ring-1 ring-inset ring-emerald-400 bg-emerald-50/30' : ''}
                        `}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.status === 'diff' && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                            />
                          )}
                          <span className="truncate font-medium text-slate-700">{item.designation}</span>
                        </div>

                        <span className="text-center text-slate-500 font-mono text-[10px]">{item.unit}</span>

                        <span className="text-right font-mono font-semibold text-slate-800">{formatPrice(item.projectPrice)}</span>

                        <span className={`text-right font-mono font-semibold ${item.bpuPrice !== null ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                          {item.bpuPrice !== null ? formatPrice(item.bpuPrice) : '—'}
                        </span>

                        <span className={`text-right font-mono font-bold ${
                          item.diff === null ? 'text-slate-300' :
                          item.diff > 0 ? 'text-red-600' :
                          item.diff < 0 ? 'text-emerald-600' :
                          'text-slate-400'
                        }`}>
                          {item.diff === null ? '—' :
                           item.diff === 0 ? '0,00' :
                           `${item.diff > 0 ? '+' : ''}${formatPrice(item.diff)}`
                          }
                          {item.pctDiff !== null && item.pctDiff !== 0 && (
                            <span className="text-[9px] ml-0.5 opacity-70">
                              ({item.pctDiff > 0 ? '+' : ''}{item.pctDiff.toFixed(1)}%)
                            </span>
                          )}
                        </span>

                        <div className="flex items-center justify-center">
                          {item.status === 'match' && (
                            <span className="flex items-center gap-1 text-emerald-600 text-[9px] font-bold">
                              <CheckCircle2 size={13} />
                            </span>
                          )}
                          {item.status === 'diff' && (
                            <span className="flex items-center gap-1 text-amber-600 text-[9px] font-bold">
                              <AlertTriangle size={13} />
                            </span>
                          )}
                          {item.status === 'missing' && (
                            <span className="text-red-400 text-[9px] font-medium italic">Absent</span>
                          )}
                        </div>

                        <div className="flex items-center justify-center">
                          {item.status === 'diff' && onRestorePrice && (
                            <button
                              onClick={() => onRestorePrice(item.id, item.bpuPrice)}
                              title={`Rétablir à ${formatPrice(item.bpuPrice)}`}
                              className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══ FOOTER ══ */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400">
            {filtered.length} article{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
            {selectedIds.size > 0 && (
              <span className="ml-2 text-emerald-600 font-bold">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            Fermer
          </button>
        </div>

        {/* ── Confirm restore all ── */}
        {confirmRestoreAll && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-xl">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[420px] border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <RefreshCw size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Rétablir tous les prix ?</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {stats.diff} article{stats.diff > 1 ? 's' : ''} seront mis à jour avec les prix de la BPU.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <strong className="text-amber-700">Attention :</strong> Cette action modifiera les prix uniquement dans le projet. La base de données BPU ne sera pas affectée.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmRestoreAll(false)}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRestoreAll}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceAuditModal;
