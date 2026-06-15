// src/components/BpuSidebar.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Package, PanelLeftClose, Search, Filter, Boxes, ChevronDown } from 'lucide-react';
import { formatPrice, cleanText, normalizeUnitSymbol, sanitizeHtml } from '../utils/helpers';
import { buildBlocSubChapter, blocUnitPrice, getBlocArticles, getBlocKind, isBlocRef } from '../utils/blocPricing';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';

// Nombre max de composants listés dans l'aperçu d'un bloc (au-delà : « +N autres »).
const BLOC_PREVIEW_MAX = 8;

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
  addItemToProject,
  blocs = [],
  allBpu = [],
  tranches = [],
  onInsertLines
}) => {
  const { success, error } = useToast();
  const { choose } = useDialog();
  // Ces états ne vivent désormais QUE dans la sidebar, ce qui allège ProjectView !
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tooltipState, setTooltipState] = useState({ visible: false, type: 'article', item: null, bloc: null, style: {} });
  const [blocsOpen, setBlocsOpen] = useState(true);
  const [blocKindFilter, setBlocKindFilter] = useState('all'); // 'all' | 'formula' | 'aggregate'
  const tooltipTimer = useRef(null);

  // Césure Articles / Blocs redimensionnable : poignée à glisser, hauteur mémorisée (localStorage).
  const sidebarRef = useRef(null);
  const [blocsHeight, setBlocsHeight] = useState(() => {
    const v = Number(localStorage.getItem('estima_bpu_blocs_height'));
    return Number.isFinite(v) && v >= 120 ? v : 240;
  });
  const blocsHeightRef = useRef(blocsHeight);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    const onMove = (ev) => {
      const rect = sidebarRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const max = Math.max(160, rect.height - 240);          // garde de la place pour les Articles
      const h = Math.max(120, Math.min(rect.bottom - clientY, max));
      blocsHeightRef.current = h;
      setBlocsHeight(h);
    };
    const onUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      try { localStorage.setItem('estima_bpu_blocs_height', String(Math.round(blocsHeightRef.current))); } catch { /* quota / mode privé */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, []);

  // Résolution des articles d'un bloc depuis le BPU complet (ou la liste filtrée en repli).
  const bpuById = useMemo(() => {
    const map = {};
    const source = (allBpu && allBpu.length) ? allBpu : filteredBpu;
    (source || []).forEach(i => { map[String(i.id)] = i; });
    return map;
  }, [allBpu, filteredBpu]);

  // Lookup bloc par id → résolution des sous-blocs imbriqués à l'insertion (templates).
  const blocsByIdMap = useMemo(() => {
    const m = {};
    (blocs || []).forEach(b => { m[String(b.id)] = b; });
    return m;
  }, [blocs]);

  // La recherche du volet filtre aussi les blocs : par nom OU par article contenu (accent-insensible).
  const blocsToShow = useMemo(() => {
    const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const q = norm(bpuSearch).trim();
    let list = blocs;
    if (blocKindFilter !== 'all') list = list.filter(b => getBlocKind(b) === blocKindFilter);
    if (!q) return list;
    return list.filter(b => {
      if (norm(b.name).includes(q)) return true;
      return getBlocArticles(b).some(a => norm(cleanText(bpuById[String(a.id)]?.designation || '')).includes(q));
    });
  }, [blocs, bpuSearch, bpuById, blocKindFilter]);

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

  // Position du tooltip (article ou bloc) : à droite de la carte, ancré en haut ou
  // en bas selon la moitié d'écran survolée. rect lu de façon synchrone au survol.
  const tooltipStyleFor = (el) => {
    const rect = el.getBoundingClientRect();
    const wh = window.innerHeight;
    const bottomHalf = rect.top > wh / 2;
    return {
      position: 'fixed',
      left: `${rect.right + 10}px`,
      top: bottomHalf ? 'auto' : `${rect.top}px`,
      bottom: bottomHalf ? `${wh - rect.bottom}px` : 'auto',
    };
  };

  const handleBpuHover = (e, item) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const style = tooltipStyleFor(e.currentTarget);
    tooltipTimer.current = setTimeout(() => {
      setTooltipState({ visible: true, type: 'article', item, bloc: null, style });
    }, 1000);
  };

  // Aperçu d'un bloc : en-tête (type + unité + nom + nb) puis la liste de ses
  // composants (désignation + unité). Les sous-blocs sont marqués « (bloc) », les
  // références non résolues signalées. Liste tronquée au-delà de BLOC_PREVIEW_MAX.
  const handleBlocHover = (e, bloc) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const style = tooltipStyleFor(e.currentTarget);
    const comps = getBlocArticles(bloc);
    const lines = comps.map((c) => {
      if (isBlocRef(c)) {
        const child = blocsByIdMap[String(c.id)];
        return child
          ? { label: child.name || 'Bloc', unit: child.unit ? normalizeUnitSymbol(child.unit) : '', isBloc: true }
          : { label: 'Bloc introuvable', missing: true };
      }
      const art = bpuById[String(c.id)];
      return art
        ? { label: cleanText(art.designation) || '—', unit: normalizeUnitSymbol(art.unit) }
        : { label: 'Article introuvable', missing: true };
    });
    const blocData = {
      name: bloc.name || 'Bloc',
      isAgg: getBlocKind(bloc) === 'aggregate',
      unit: bloc.unit ? normalizeUnitSymbol(bloc.unit) : '',
      count: comps.length,
      lines,
    };
    tooltipTimer.current = setTimeout(() => {
      setTooltipState({ visible: true, type: 'bloc', item: null, bloc: blocData, style });
    }, 1000);
  };

  const handleBpuLeave = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipState(prev => ({ ...prev, visible: false }));
  };

  // Ref vers le dernier addItemToProject pour que handleSelect reste stable
  // (sinon le memo custom de BpuItemCard fige le onClick avec une closure stale)
  const addItemToProjectRef = useRef(addItemToProject);
  useEffect(() => { addItemToProjectRef.current = addItemToProject; }, [addItemToProject]);

  const handleSelect = useCallback((item) => {
    const cleanItem = { ...item, uid: item.id || item.uid };
    addItemToProjectRef.current(cleanItem);
  }, []);

  // Insère un bloc dans le chapitre sélectionné : 1 ligne pilote "surface" +
  // N composants (prix figés) dont la quantité est une formule =({pilote})×facteur.
  const onInsertLinesRef = useRef(onInsertLines);
  useEffect(() => { onInsertLinesRef.current = onInsertLines; }, [onInsertLines]);

  // Insère le nœud bloc déjà construit, au niveau demandé, avec un toast explicite.
  const placeBloc = useCallback((bloc, node, added, missing, atTopLevel) => {
    // Contrat onInsertLines = (lines, opts) ; le parent injecte la sélection courante
    // (sous-chapitre → chapitre sélectionné). atTopLevel = true → chapitre de 1er niveau.
    onInsertLinesRef.current?.([node], { atTopLevel });
    const place = atTopLevel ? 'chapitre de 1er niveau' : 'sous-chapitre';
    const isAgg = getBlocKind(bloc) === 'aggregate';
    const tail = isAgg ? ' Saisissez les quantités sur chaque ligne.' : " Saisissez la surface sur l'en-tête.";
    success(`Bloc « ${bloc.name} » inséré : ${place} + ${added} article${added > 1 ? 's' : ''}${missing ? ` (${missing} introuvable${missing > 1 ? 's' : ''})` : ''}.${tail}`);
  }, [success]);

  const handleInsertBloc = useCallback(async (bloc) => {
    const { node, added, missing } = buildBlocSubChapter(bloc, bpuById, tranches, blocsByIdMap);
    if (added === 0) {
      error(`Bloc « ${bloc.name} » : aucun article disponible.`);
      return;
    }
    if (getBlocKind(bloc) === 'aggregate') {
      // Agrégat : pas de pilote → chapitre OU sous-chapitre, au choix de l'utilisateur.
      const dest = await choose(
        `Où insérer l'agrégat « ${bloc.name} » (${added} article${added > 1 ? 's' : ''}) ?`,
        [
          { key: 'top', label: 'Chapitre de 1er niveau', description: 'Un chapitre à part entière, en bas de l’estimation.' },
          { key: 'sub', label: 'Sous-chapitre du chapitre courant', description: 'Imbriqué dans le chapitre actuellement sélectionné.' },
        ],
        { title: 'Insérer l’agrégat' }
      );
      if (!dest) return; // annulé
      placeBloc(bloc, node, added, missing, dest === 'top');
    } else {
      // Bloc calculé : toujours un sous-chapitre (porte la surface pilote).
      placeBloc(bloc, node, added, missing, false);
    }
  }, [bpuById, blocsByIdMap, tranches, error, choose, placeBloc]);

  if (!showBpu) return null;

  return (
    <div ref={sidebarRef} className="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl">
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
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
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

      {/* Poignée de redimensionnement de la césure Articles / Blocs (zone Blocs dépliée) */}
      {blocsOpen && (
        <div
          onMouseDown={startResize}
          onTouchStart={startResize}
          title="Glisser pour redimensionner Articles / Blocs"
          className={`shrink-0 h-2 flex items-center justify-center cursor-row-resize group ${isResizing ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}
        >
          <div className={`h-0.5 w-10 rounded-full transition-colors ${isResizing ? 'bg-emerald-500' : 'bg-slate-300 group-hover:bg-emerald-400'}`} />
        </div>
      )}

      {/* ── Zone Blocs (bas du volet, repliable, hauteur ajustable) ── */}
      <div
        className="border-t border-slate-200 bg-white flex flex-col shrink-0 min-h-0"
        style={blocsOpen ? { height: blocsHeight } : undefined}
      >
        <button
          onClick={() => setBlocsOpen(o => !o)}
          className="shrink-0 w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
            <Boxes size={14} /> Blocs
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{(bpuSearch.trim() || blocKindFilter !== 'all') ? `${blocsToShow.length}/${blocs.length}` : blocs.length}</span>
          </span>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${blocsOpen ? 'rotate-180' : ''}`} />
        </button>

        {blocsOpen && (
          <div className="flex-1 min-h-0 overflow-y-auto p-2 pt-0 space-y-1.5 bg-slate-50/50">
            {blocs.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 text-[10px] italic leading-relaxed">
                Aucun bloc.<br />Créez-en dans la <span className="font-bold text-slate-500">Bibliothèque</span>.
              </div>
            ) : (
              <>
              {/* Filtre sticky : type de bloc (Tous / Calculé / Agrégat) */}
              <div className="sticky top-0 z-10 -mx-2 px-2 py-1.5 bg-slate-100/95 backdrop-blur border-b border-slate-200">
                <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg">
                  {[
                    { key: 'all', label: 'Tous', color: 'text-slate-800' },
                    { key: 'formula', label: 'Calculé', color: 'text-indigo-700' },
                    { key: 'aggregate', label: 'Agrégat', color: 'text-amber-700' },
                  ].map(opt => {
                    const active = blocKindFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setBlocKindFilter(opt.key)}
                        className={`flex-1 text-[9px] font-black uppercase tracking-wide py-1 rounded-md transition-colors ${active ? `bg-white shadow-sm ${opt.color}` : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {blocsToShow.length === 0 ? (
                <div className="px-3 py-4 text-center text-slate-400 text-[10px] italic leading-relaxed">
                  Aucun bloc{blocKindFilter === 'formula' ? ' calculé' : blocKindFilter === 'aggregate' ? ' agrégat' : ''}{bpuSearch.trim() ? <> pour <span className="font-bold text-slate-500">« {bpuSearch.trim()} »</span></> : ' à afficher'}.
                </div>
              ) : (
                [...blocsToShow].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr')).map(bloc => {
                const count = getBlocArticles(bloc).length;
                const isAgg = getBlocKind(bloc) === 'aggregate';
                const u = bloc.unit ? normalizeUnitSymbol(bloc.unit) : '';
                // Classes littérales (Tailwind JIT ne détecte pas les noms construits dynamiquement).
                const C = isAgg
                  ? { card: 'hover:border-amber-400 hover:bg-amber-50/50', icon: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200', name: 'group-hover:text-amber-800', badge: 'bg-amber-500 text-white' }
                  : { card: 'hover:border-indigo-400 hover:bg-indigo-50/50', icon: 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200', name: 'group-hover:text-indigo-800', badge: 'bg-indigo-600 text-white' };
                return (
                  <button
                    key={bloc.id}
                    onClick={() => handleInsertBloc(bloc)}
                    onMouseEnter={(e) => handleBlocHover(e, bloc)}
                    onMouseLeave={handleBpuLeave}
                    className={`w-full group flex items-center gap-2.5 p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98] text-left ${C.card}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${C.icon}`}>
                      <Boxes size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-bold text-slate-700 uppercase leading-snug line-clamp-2 transition-colors ${C.name}`}>{bloc.name}</p>
                        <span className={`shrink-0 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${C.badge}`}>{isAgg ? 'Agrégat' : 'Calculé'}</span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                        {count} art.{isAgg ? '' : ` · ${formatPrice(blocUnitPrice(bloc, bpuById))}${u ? `/${u}` : ''}`}
                        {' · '}<span className="text-slate-500">{isAgg ? 'chapitre / sous-chap.' : 'sous-chapitre'}</span>
                      </p>
                    </div>
                  </button>
                );
              })
              )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tooltip rendu via portal pour passer au-dessus du sticky header.
          Style Estima (Apple light) : carte blanche, coins arrondis, ombre douce.
          Deux variantes : article (désignation + description) ou bloc (contenu). */}
      {tooltipState.visible && createPortal(
        <div className="z-tooltip w-72 p-3 bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-200/60 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-2 pointer-events-none" style={tooltipState.style}>
          <div className={`absolute -left-1.5 w-3.5 h-3.5 bg-white transform rotate-45 border-l border-b border-gray-200/60 ${tooltipState.style.bottom !== 'auto' ? 'bottom-4' : 'top-4'}`} />
          {tooltipState.type === 'bloc' && tooltipState.bloc ? (
            <>
              <div className="shrink-0 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${tooltipState.bloc.isAgg ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {tooltipState.bloc.isAgg ? 'Agrégat' : 'Calculé'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Bloc</span>
                {tooltipState.bloc.unit && <span className="ml-auto text-[10px] font-mono font-bold text-gray-400">{tooltipState.bloc.unit}</span>}
              </div>
              <div className="text-xs font-bold uppercase leading-snug text-gray-900">{tooltipState.bloc.name}</div>
              <div className="text-[10px] text-gray-400 -mt-1">{tooltipState.bloc.count} article{tooltipState.bloc.count > 1 ? 's' : ''}</div>
              {tooltipState.bloc.lines.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {tooltipState.bloc.lines.slice(0, BLOC_PREVIEW_MAX).map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className={`truncate ${l.missing ? 'text-amber-600 italic' : 'text-gray-700'}`}>• {l.label}{l.isBloc ? ' (bloc)' : ''}</span>
                      {l.unit && <span className="shrink-0 font-mono font-bold text-gray-400 uppercase">{l.unit}</span>}
                    </div>
                  ))}
                  {tooltipState.bloc.lines.length > BLOC_PREVIEW_MAX && (
                    <div className="text-[10px] text-gray-400 italic pt-0.5">… +{tooltipState.bloc.lines.length - BLOC_PREVIEW_MAX} autre{tooltipState.bloc.lines.length - BLOC_PREVIEW_MAX > 1 ? 's' : ''}</div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 italic">Bloc vide</div>
              )}
              <div className="shrink-0 text-[9px] text-gray-400 border-t border-gray-100 pt-1.5 mt-0.5">
                {tooltipState.bloc.isAgg ? 'Insertion : chapitre ou sous-chapitre' : 'Insertion : sous-chapitre (porte la surface)'}
              </div>
            </>
          ) : tooltipState.item ? (
            <>
              <div className="shrink-0 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Article</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Bibliothèque</span>
              </div>
              <div className="text-xs font-bold text-gray-900" dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltipState.item.designation || '') }} />
              <div className={`text-[10px] text-gray-500 ${tooltipState.item.description ? '' : 'hidden'}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltipState.item.description || '') }} />
            </>
          ) : null}
        </div>,
        document.body
      )}
    </div>
  );
};

export default BpuSidebar;
