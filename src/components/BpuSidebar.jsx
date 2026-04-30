// src/components/BpuSidebar.jsx
import React, { useState, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Package, PanelLeftClose, Search, Filter } from 'lucide-react';
import { formatPrice, cleanText, normalizeUnitSymbol, sanitizeHtml } from '../utils/helpers';

// ── Carte article BPU memoisee ─────────────────────────────────────────────
// Un changement de bpuSearch / selectedCategory provoque un nouveau filtrage,
// mais les items dont la reference n'a pas change ne re-render pas grace au memo.
// Comparateur custom : ignore onSelect/onHover/onLeave (refs instables, semantique stable).
const BpuItemCard = memo(({ item, numberingManual, onSelect, onHover, onLeave }) => {
  return (
    <div
      onClick={() => onSelect(item)}
      onMouseEnter={(e) => onHover(e, item)}
      onMouseLeave={onLeave}
      className="group relative flex items-start justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-emerald-400 hover:shadow-md hover:bg-emerald-50/30 cursor-pointer transition-all duration-200 active:scale-[0.98]"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex-1 min-w-0 pr-2 pl-1.5">
        {numberingManual && item.bpuNum && (
          <div className="mb-1">
            <span className="text-[8px] font-black text-white bg-blue-600 px-1 py-px rounded-sm shadow-sm">{item.bpuNum}</span>
          </div>
        )}
        <p className="text-[10px] font-bold text-slate-700 uppercase leading-snug group-hover:text-emerald-800 line-clamp-2 transition-colors">
          {cleanText(item.designation)}
        </p>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1">
        <span className="text-[10px] font-black text-emerald-700 font-mono bg-emerald-100/50 border border-emerald-100 px-2 py-0.5 rounded shadow-sm group-hover:bg-emerald-200 group-hover:text-emerald-900 transition-colors">
          {formatPrice(item.price)}
        </span>
        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">{normalizeUnitSymbol(item.unit)}</span>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.item === next.item && prev.numberingManual === next.numberingManual;
});

const BpuSidebar = ({
  showBpu,
  setShowBpu,
  bpuSearch,
  setBpuSearch,
  filteredBpu,
  categories,
  bpuConfig,
  addItemToProject
}) => {
  // Ces états ne vivent désormais QUE dans la sidebar, ce qui allège ProjectView !
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tooltipState, setTooltipState] = useState({ visible: false, item: null, style: {} });
  const tooltipTimer = useRef(null);

  // Le calcul des items filtrés est déplacé ici
  const sidebarItems = useMemo(() => {
    let items = filteredBpu;
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized') {
        items = items.filter(item => {
          const ids = item.categoryIds || (item.categoryId ? [item.categoryId] : []);
          return ids.length === 0;
        });
      } else {
        items = items.filter(item => {
          const ids = (item.categoryIds || (item.categoryId ? [item.categoryId] : [])).map(String);
          return ids.includes(String(selectedCategory));
        });
      }
    }
    if (bpuConfig?.numberingMode === 'manual') {
      return items.filter(item => item.bpuNum && item.bpuNum.toString().trim() !== "");
    }
    return items;
  }, [filteredBpu, bpuConfig, selectedCategory]);

  const numberingManual = bpuConfig?.numberingMode === 'manual';

  const handleBpuHover = (e, item) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const isBottomHalf = rect.top > windowHeight / 2;
    tooltipTimer.current = setTimeout(() => {
      setTooltipState({
        visible: true, item: item,
        style: { position: 'fixed', left: `${rect.right + 10}px`, top: isBottomHalf ? 'auto' : `${rect.top}px`, bottom: isBottomHalf ? `${windowHeight - rect.bottom}px` : 'auto' }
      });
    }, 1000);
  };

  const handleBpuLeave = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipState(prev => ({ ...prev, visible: false }));
  };

  const handleSelect = (item) => {
    const cleanItem = { ...item, uid: item.id || item.uid };
    addItemToProject(cleanItem);
  };

  if (!showBpu) return null;

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl">
      <header className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest">
            <Package size={14} className="text-emerald-600" /> Bibliothèque
          </h3>
          <button onClick={() => setShowBpu(false)} className="text-slate-400 hover:text-slate-600">
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500 transition-all font-medium"
            value={bpuSearch}
            onChange={(e) => setBpuSearch(e.target.value)}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-2.5 text-slate-400" size={12} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none focus:border-emerald-500 appearance-none cursor-pointer hover:bg-slate-50 transition-colors uppercase tracking-wide"
            >
              <option value="all">Toutes catégories</option>
              <option value="uncategorized">Non classés</option>
              {[...(categories || [])].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
        {sidebarItems.map((item) => (
          <BpuItemCard
            key={item.id}
            item={item}
            numberingManual={numberingManual}
            onSelect={handleSelect}
            onHover={handleBpuHover}
            onLeave={handleBpuLeave}
          />
        ))}
        {sidebarItems.length === 0 && filteredBpu.length > 0 && (
          <div className="p-4 text-center text-slate-400 text-[10px] italic">Aucun article trouvé avec les filtres actuels.</div>
        )}
      </div>

      {/* Tooltip rendu via portal pour passer au-dessus du sticky header */}
      {tooltipState.visible && tooltipState.item && createPortal(
        <div className="z-tooltip w-72 p-3 bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-600 animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-2 pointer-events-none" style={tooltipState.style}>
          <div className={`absolute -left-2 w-4 h-4 bg-slate-800 transform rotate-45 border-l border-b border-slate-600 ${tooltipState.style.bottom !== 'auto' ? 'bottom-4' : 'top-4'}`} />
          <div className="shrink-0 font-bold text-xs text-emerald-400 uppercase tracking-wider border-b border-slate-600 pb-2">Article Bibliothèque</div>
          <div className="text-xs font-bold" dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltipState.item.designation || '') }} />
          <div className={`text-[10px] text-slate-400 ${tooltipState.item.description ? '' : 'hidden'}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltipState.item.description || '') }} />
        </div>,
        document.body
      )}
    </div>
  );
};

export default BpuSidebar;
