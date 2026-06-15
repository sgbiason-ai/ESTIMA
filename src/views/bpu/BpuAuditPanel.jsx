import React, { useState, useMemo } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, X, AlertCircle, FileWarning, DollarSign, Ruler, PenLine, DatabaseBackup, RotateCcw } from 'lucide-react';

const ISSUE_ICONS = {
  missing: <AlertCircle size={13} className="text-red-500 shrink-0" />,
  no_description: <FileWarning size={13} className="text-amber-600 shrink-0" />,
  price_diff: <DollarSign size={13} className="text-blue-600 shrink-0" />,
  unit_diff: <Ruler size={13} className="text-purple-600 shrink-0" />,
  desc_diff: <DatabaseBackup size={13} className="text-cyan-600 shrink-0" />,
  override: <PenLine size={13} className="text-amber-600 shrink-0" />,
};

const ISSUE_COLORS = {
  missing: 'text-red-600',
  no_description: 'text-amber-700',
  price_diff: 'text-blue-700',
  unit_diff: 'text-purple-700',
  desc_diff: 'text-cyan-700',
  override: 'text-amber-700',
};

const RESTORABLE_TYPES = new Set(['price_diff', 'unit_diff', 'desc_diff', 'override']);

const FILTER_DEFS = [
  { type: 'no_description', statKey: 'noDescription', icon: <FileWarning size={10} />, label: 'sans description',
    base: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    active: 'bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-200' },
  { type: 'price_diff', statKey: 'priceDiff', icon: <DollarSign size={10} />, label: 'prix modifiés',
    base: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
    active: 'bg-blue-100 border-blue-300 text-blue-800 ring-1 ring-blue-200' },
  { type: 'unit_diff', statKey: 'unitDiff', icon: <Ruler size={10} />, label: 'unités modifiées',
    base: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
    active: 'bg-purple-100 border-purple-300 text-purple-800 ring-1 ring-purple-200' },
  { type: 'desc_diff', statKey: 'descDiff', icon: <DatabaseBackup size={10} />, label: 'desc. modifiées',
    base: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
    active: 'bg-cyan-100 border-cyan-300 text-cyan-800 ring-1 ring-cyan-200' },
  { type: 'override', statKey: 'overrides', icon: <PenLine size={10} />, label: 'surchargés',
    base: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    active: 'bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-200' },
  { type: 'missing', statKey: 'missing', icon: <AlertCircle size={10} />, label: 'absents BPU',
    base: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100',
    active: 'bg-red-100 border-red-300 text-red-700 ring-1 ring-red-200' },
];

const scrollToItem = (itemId) => {
  const el = document.querySelector(`[data-bpu-item-id="${itemId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50');
    setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-50'), 2000);
  }
};

const BpuAuditPanel = ({ audit, onClose, onSyncDescriptions, onRestoreIssues }) => {
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmBatch, setConfirmBatch] = useState(null); // null | { count, issues }

  const filteredIssues = useMemo(() => {
    if (!audit?.issues) return [];
    if (!activeFilter) return audit.issues;
    return audit.issues.filter(item => item.issues.some(i => i.type === activeFilter));
  }, [audit?.issues, activeFilter]);

  const itemsRestorable = useMemo(() => {
    return filteredIssues.filter(it =>
      it.issues.some(i => RESTORABLE_TYPES.has(i.type))
    );
  }, [filteredIssues]);

  const toggleFilter = (type) => {
    setActiveFilter(prev => prev === type ? null : type);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(itemsRestorable.map(it => it.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Construit la liste d'issues à restaurer pour un set d'items, optionnellement filtrée par type
  const buildRestoreList = (itemIds, restrictType = null) => {
    const list = [];
    audit.issues.forEach(it => {
      if (!itemIds.has(it.id)) return;
      it.issues.forEach(issue => {
        if (!RESTORABLE_TYPES.has(issue.type)) return;
        if (restrictType && issue.type !== restrictType) return;
        list.push({ itemId: it.id, type: issue.type, dbValue: issue.dbValue });
      });
    });
    return list;
  };

  // Restauration d'une issue précise (un seul champ d'un seul article) — pas de confirmation
  const handleRestoreSingleIssue = (itemId, issue) => {
    if (!onRestoreIssues || !RESTORABLE_TYPES.has(issue.type)) return;
    onRestoreIssues([{ itemId, type: issue.type, dbValue: issue.dbValue }]);
  };

  // Restauration de toutes les issues d'un seul article — pas de confirmation
  const handleRestoreOneItem = (item) => {
    if (!onRestoreIssues) return;
    const list = item.issues
      .filter(i => RESTORABLE_TYPES.has(i.type))
      .map(i => ({ itemId: item.id, type: i.type, dbValue: i.dbValue }));
    if (list.length === 0) return;
    onRestoreIssues(list);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  // Restauration de la sélection — confirmation modale si N>1
  const handleRestoreSelection = () => {
    if (!onRestoreIssues || selectedIds.size === 0) return;
    const list = buildRestoreList(selectedIds);
    if (list.length === 0) return;
    if (selectedIds.size === 1) {
      onRestoreIssues(list);
      clearSelection();
    } else {
      setConfirmBatch({ count: selectedIds.size, list });
    }
  };

  const confirmAndExecute = () => {
    if (!confirmBatch) return;
    onRestoreIssues(confirmBatch.list);
    setConfirmBatch(null);
    clearSelection();
  };

  if (!audit) return null;

  const hasSelection = selectedIds.size > 0;
  const allVisibleSelected = itemsRestorable.length > 0 && itemsRestorable.every(it => selectedIds.has(it.id));

  return (
    <div className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col shrink-0 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {audit.stats.errors > 0
            ? <AlertTriangle size={15} className="text-amber-600" />
            : <CheckCircle2 size={15} className="text-emerald-600" />
          }
          <span className="text-[10px] font-bold text-gray-900 uppercase tracking-wider">
            Audit — {audit.stats.total} articles
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors p-1 rounded hover:bg-gray-100">
          <X size={14} />
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-1.5 p-2.5 border-b border-gray-200/60">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center">
          <div className="text-base font-black text-emerald-600">{audit.stats.ok}</div>
          <div className="text-[8px] font-bold text-emerald-700 uppercase">Conformes</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-center">
          <div className="text-base font-black text-amber-600">{audit.stats.errors}</div>
          <div className="text-[8px] font-bold text-amber-700 uppercase">Alertes</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-1.5 text-center">
          <div className="text-base font-black text-red-500">{audit.stats.missing}</div>
          <div className="text-[8px] font-bold text-red-600 uppercase">Absents</div>
        </div>
      </div>

      {/* Filtres par type */}
      <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-gray-200/60">
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
            className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 border border-gray-200/60 rounded text-[8px] font-bold text-gray-600 hover:bg-gray-200 transition-all"
          >
            <X size={8} /> Tous
          </button>
        )}
        {audit.stats.errors === 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[8px] font-bold text-emerald-600">
            <CheckCircle2 size={10} /> Tout est conforme
          </span>
        )}
      </div>

      {/* Bouton "tout sélectionner" / "désélectionner" */}
      {itemsRestorable.length > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-200/60 bg-gray-50">
          <button
            onClick={allVisibleSelected ? clearSelection : selectAllVisible}
            className="text-[9px] font-bold text-gray-600 hover:text-gray-900 uppercase tracking-wide transition-colors"
          >
            {allVisibleSelected ? 'Tout désélectionner' : `Tout sélectionner (${itemsRestorable.length})`}
          </button>
          {hasSelection && (
            <span className="text-[9px] font-bold text-emerald-600">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Liste des problèmes */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredIssues.map((item) => {
          const restorableInItem = item.issues.filter(i => RESTORABLE_TYPES.has(i.type));
          const canRestore = restorableInItem.length > 0;
          const isSelected = selectedIds.has(item.id);
          const visibleIssues = activeFilter ? item.issues.filter(i => i.type === activeFilter) : item.issues;

          return (
            <div
              key={item.id}
              className={`relative bg-white border rounded-lg p-2 transition-all group ${
                isSelected ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50' : 'border-gray-200/60 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-1.5 mb-0.5">
                {canRestore && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-0.5 w-3 h-3 rounded border-gray-300 bg-white text-emerald-600 focus:ring-emerald-200 cursor-pointer shrink-0"
                  />
                )}
                {!canRestore && <span className="w-3 shrink-0" />}
                <button
                  onClick={() => scrollToItem(item.id)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                >
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums shrink-0">{item.ref}</span>
                  <span className="text-[10px] font-bold text-gray-800 truncate group-hover:text-gray-900">{item.designation}</span>
                </button>
                {canRestore && onRestoreIssues && (
                  <button
                    onClick={() => handleRestoreOneItem(item)}
                    title={`Restaurer tout (${restorableInItem.length} champ${restorableInItem.length > 1 ? 's' : ''})`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 shrink-0"
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5 pl-4">
                {visibleIssues.map((issue, idx) => {
                  const restorable = RESTORABLE_TYPES.has(issue.type);
                  return (
                    <div key={idx} className="flex items-center gap-1.5 pl-1 group/issue">
                      {ISSUE_ICONS[issue.type]}
                      <span className={`text-[9px] font-medium ${ISSUE_COLORS[issue.type]} flex-1 min-w-0 truncate`}>{issue.label}</span>
                      {restorable && onRestoreIssues && (
                        <button
                          onClick={() => handleRestoreSingleIssue(item.id, issue)}
                          title="Restaurer ce champ depuis la base BPU"
                          className="opacity-0 group-hover/issue:opacity-100 transition-opacity p-0.5 rounded hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 shrink-0"
                        >
                          <RotateCcw size={9} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredIssues.length === 0 && audit.stats.errors > 0 && (
          <div className="p-4 text-center text-gray-400 text-[10px] italic">Aucun résultat pour ce filtre</div>
        )}
      </div>

      {/* Footer dynamique : barre d'action sélection OU sync descriptions */}
      {hasSelection ? (
        <div className="p-2.5 border-t border-gray-200/60 bg-emerald-50 flex items-center gap-2">
          <button
            onClick={handleRestoreSelection}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <RotateCcw size={12} />
            Restaurer ({selectedIds.size})
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all"
          >
            Annuler
          </button>
        </div>
      ) : (
        <div className="p-2.5 border-t border-gray-200/60 bg-gray-50">
          <button
            onClick={onSyncDescriptions}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <RefreshCw size={12} />
            Synchroniser les descriptions
          </button>
        </div>
      )}

      {/* Modal de confirmation pour restauration multi */}
      {confirmBatch && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-3">
          <div className="bg-white border border-gray-200/60 rounded-2xl shadow-2xl p-4 w-full max-w-[300px]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[11px] font-bold text-gray-900">Confirmer la restauration ?</h3>
                <p className="text-[9px] text-gray-500 mt-0.5">
                  {confirmBatch.count} articles • {confirmBatch.list.length} champ{confirmBatch.list.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
              Les valeurs locales seront remplacées par celles de la base BPU.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBatch(null)}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmAndExecute}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BpuAuditPanel;
