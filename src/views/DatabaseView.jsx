import React, { useState, useRef, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  Search, Plus, Trash2, Folder, FolderOpen, LayoutGrid, FileText, 
  Edit2, GripVertical, Download, Upload, Check, X, MoreVertical, 
  Calendar, Copy, ArrowDownAZ, ArrowUpAZ, ArrowUp, ArrowDown, Euro, Hash,
  FileWarning, CheckSquare, Square, FolderInput, TrendingUp, TrendingDown,
  Info, History, BarChart2, RefreshCw, BookOpen, Cloud, Monitor, AlertCircle,
  HelpCircle, AlignLeft, Boxes, LayoutList, ChevronDown, Briefcase
} from 'lucide-react';
import { formatPrice, cleanText, normalizeUnitSymbol } from '../utils/helpers';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import HelpPanel from '../components/help/HelpPanel';
import BlocsPanel from './database/BlocsPanel';

const DatabaseView = ({ 
  filteredBpu,      
  fullBpu,          
  setShowAddBpuModal, 
  onEditItem, 
  deleteFromBpu,
  categories,
  addCategory,
  deleteCategory,
  renameCategory,
  reorderCategories,
  assignCategoryToItem,
  onImportData,
  onReorderItems,
  units,
  onUpdateItem,
  isLocalMode = false,
  onExitLocalMode = null,
  onFullResetLocal = null,
  onForceRefresh = null,
  localLibraryName = null,
  isAdmin = false,
  onClearObservedPrices = null,
  bpuSearch,
  setBpuSearch,
  bpuConfig,
  masterCctp = [],
  blocs = [],
  addBloc,
  updateBloc,
  deleteBloc
}) => {
  const [mode, setMode] = useState('articles'); // 'articles' | 'blocs'
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false); // popover source de données
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); 
  const [showHelp, setShowHelp] = useState(false); 
  const [isRefreshing, setIsRefreshing] = useState(false); // État pour l'animation du bouton
  const { confirm } = useDialog();
  
  const { error: toastError, info: toastInfo } = useToast();

  // --- Lookup CCTP : id → titre ---
  const cctpTitleMap = useMemo(() => {
    const map = {};
    const walk = (nodes) => {
      (nodes || []).forEach(n => {
        if (n.id && n.title) map[String(n.id)] = n.title;
        if (n.children) walk(n.children);
      });
    };
    walk(masterCctp);
    return map;
  }, [masterCctp]);

  const resolveCctpLabel = (item) => {
    if (item.cctpLabel) return item.cctpLabel;
    const refs = item.cctpRefs || (item.cctpRef ? [item.cctpRef] : []);
    const titles = refs.map(r => cctpTitleMap[String(r)]).filter(Boolean);
    if (titles.length > 0) return titles.join(', ');
    return refs.join(', ') || 'CCTP Lié';
  };

  // --- État pour la modale de modification du lien CCTP ---
  const [cctpLinkModal, setCctpLinkModal] = useState({ isOpen: false, item: null, refValue: '', labelValue: '' });
  const [priceHistoryItem, setPriceHistoryItem] = useState(null); // item pour modale historique prix
  const [confirmDeleteHistIdx, setConfirmDeleteHistIdx] = useState(null); // index (original) de la remontée en attente de confirmation

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [observatory, setObservatory] = useState({});
  const lastSelectedId = useRef(null);
  const fileInputRef = useRef(null);
  const parentRef = useRef(null);

  const itemsToDisplay = useMemo(() => {
    let result = filteredBpu.filter(item => {
      const itemCatIds = item.categoryIds || (item.categoryId ? [item.categoryId] : []);
      if (!selectedCatId) return true;
      if (selectedCatId === 'uncategorized') return itemCatIds.length === 0;
      if (selectedCatId === 'nodescription') return !item.description || item.description.trim() === '' || item.description === '<p><br></p>';
      if (selectedCatId === 'observed') return !!item.observedPrice;
      return itemCatIds.map(String).includes(String(selectedCatId));
    });

    if (sortConfig.key) {
        result.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            
            if (sortConfig.key === 'price') {
                valA = Number(valA) || 0; valB = Number(valB) || 0;
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            if (sortConfig.key === 'designation') {
                valA = (valA || "").toString().toLowerCase(); valB = (valB || "").toString().toLowerCase();
                return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (sortConfig.key === 'cctp') {
                const hasA = !!(a.cctpRef || (a.cctpRefs && a.cctpRefs.length > 0));
                const hasB = !!(b.cctpRef || (b.cctpRefs && b.cctpRefs.length > 0));
                if (hasA !== hasB) return sortConfig.direction === 'asc' ? (hasB ? 1 : -1) : (hasA ? 1 : -1);
                if (hasA && hasB) {
                    const titleA = resolveCctpLabel(a).toLowerCase();
                    const titleB = resolveCctpLabel(b).toLowerCase();
                    return sortConfig.direction === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
                }
                return 0;
            }
            if (sortConfig.key === 'bpuNum') {
                return sortConfig.direction === 'asc' 
                    ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
                    : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
            }
            return 0;
        });
    }
    return result;
  }, [filteredBpu, selectedCatId, sortConfig]);

  // --- Configuration de la virtualisation ---
  const rowVirtualizer = useVirtualizer({
    count: itemsToDisplay.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 85, // Hauteur moyenne d'un élément + l'espacement (gap)
    overscan: 10, // Nombre d'éléments pré-chargés hors-champ pour la fluidité
  });

  useEffect(() => {
    const savedObs = localStorage.getItem('global_price_observatory');
    if (savedObs) setObservatory(JSON.parse(savedObs));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => { if(e.key === 'Shift') setIsShiftPressed(true); };
    const handleKeyUp = (e) => { if(e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- NOUVELLES FONCTIONS : Gestion des liens CCTP ---
  const handleEditCctpLink = (item) => {
    const currentRef = item.cctpRefs ? item.cctpRefs.join(', ') : (item.cctpRef || '');
    const currentLabel = item.cctpLabel || resolveCctpLabel(item);
    setCctpLinkModal({ isOpen: true, item, refValue: currentRef, labelValue: currentLabel === 'CCTP Lié' ? '' : currentLabel });
  };

  const saveCctpLink = () => {
    const { item, refValue, labelValue } = cctpLinkModal;
    const refs = refValue.split(',').map(s => s.trim()).filter(Boolean);
    const updatedItem = { ...item };

    if (refs.length > 1) {
        updatedItem.cctpRefs = refs;
        delete updatedItem.cctpRef;
    } else if (refs.length === 1) {
        updatedItem.cctpRef = refs[0];
        delete updatedItem.cctpRefs;
    } else {
        delete updatedItem.cctpRef;
        delete updatedItem.cctpRefs;
    }

    if (labelValue.trim()) {
        updatedItem.cctpLabel = labelValue.trim();
    } else {
        delete updatedItem.cctpLabel;
    }

    if (onUpdateItem) onUpdateItem(updatedItem);
    setCctpLinkModal({ isOpen: false, item: null, refValue: '', labelValue: '' });
  };
  // ----------------------------------------------------

  const renderPriceTrend = (item) => {
    if (!item.observedPrice || !item.price) return null;
    const diff = ((item.observedPrice - item.price) / item.price) * 100;
    if (Math.abs(diff) < 2) return <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded" title={`Prix réel: ${formatPrice(item.observedPrice)}`}>Aligné</span>;
    return (
        <div 
          className={`flex items-center gap-0.5 text-[9px] font-bold px-1 rounded cursor-help ${diff > 0 ? 'text-red-600 bg-red-50 border border-red-100' : 'text-emerald-600 bg-emerald-50 border border-emerald-100'}`}
          title={`Prix réel observé: ${formatPrice(item.observedPrice)}`}
        >
            {diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(diff).toFixed(0)}%
        </div>
    );
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') {
        setSortConfig({ key: null, direction: 'asc' });
        return;
    }
    setSortConfig({ key, direction });
  };

  const handleForceRefresh = async () => {
    if (!onForceRefresh) return;
    setIsRefreshing(true);
    await onForceRefresh();
    // Petit délai visuel pour que l'utilisateur voie l'action
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Réinitialise la confirmation inline quand on change d'article / ferme la modale
  useEffect(() => { setConfirmDeleteHistIdx(null); }, [priceHistoryItem?.id]);

  // Supprime une remontée de prix de l'historique et recalcule la moyenne observée
  const handleDeleteHistoryEntry = (origIdx) => {
    const item = priceHistoryItem;
    if (!item) return;
    const history = [...(item.priceHistory || [])];
    history.splice(origIdx, 1);
    if (history.length === 0) {
      // Plus aucune remontée : l'article n'est plus « observé »
      onUpdateItem?.(item.id, { observedPrice: null, priceHistory: [] });
      setPriceHistoryItem(null);
      toastInfo("Dernière remontée supprimée — l'article n'a plus de prix observé.");
    } else {
      const avgAll = Math.round(history.reduce((s, h) => s + (h.price || 0), 0) / history.length * 100) / 100;
      onUpdateItem?.(item.id, { observedPrice: avgAll, priceHistory: history });
      setPriceHistoryItem({ ...item, observedPrice: avgAll, priceHistory: history });
      toastInfo("Remontée supprimée.");
    }
    setConfirmDeleteHistIdx(null);
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else {
        newSelection.add(id);
        if (isShiftPressed && lastSelectedId.current) {
            const indexStart = itemsToDisplay.findIndex(i => i.id === lastSelectedId.current);
            const indexEnd = itemsToDisplay.findIndex(i => i.id === id);
            if (indexStart !== -1 && indexEnd !== -1) {
                const [start, end] = [Math.min(indexStart, indexEnd), Math.max(indexStart, indexEnd)];
                for (let i = start; i <= end; i++) newSelection.add(itemsToDisplay[i].id);
            }
        }
    }
    lastSelectedId.current = id;
    setSelectedIds(newSelection);
  };

  const handleExport = () => {
    const activeDbName = isLocalMode ? (localLibraryName || "base_locale") : "complet";
    const dataToExport = {
      version: "1.3",
      timestamp: new Date().toISOString(),
      meta: { activeDbName, isLocal: isLocalMode },
      units,
      categories,
      bpu: fullBpu,
      observatory
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); 
    link.href = url; 
    link.download = `sauvegarde_bpu_${cleanText(activeDbName).replace(/\s+/g,'_')}.json`; 
    link.click();
  };

  // Réordonnancement des articles d'un bloc : délégué à BlocsPanel (qui détient le brouillon),
  // car hello-pangea n'autorise qu'un seul DragDropContext (celui-ci).
  const blocDragEndRef = useRef(null);

  const handleDragEnd = (result) => {
    const { source, destination, type, draggableId } = result;
    if (!destination) return;
    if (type === 'BLOC_ARTICLE') { blocDragEndRef.current?.(result); return; }
    if (destination.index === source.index && destination.droppableId === source.droppableId) return;
    if (type === 'CATEGORY') {
        const newCategories = Array.from(categories); const [moved] = newCategories.splice(source.index, 1); newCategories.splice(destination.index, 0, moved);
        if (reorderCategories) reorderCategories(newCategories);
    }
    if (type === 'ITEM') {
        if (destination.droppableId.startsWith('folder-')) {
            const rawCatId = destination.droppableId.replace('folder-', '');
            const finalCatId = rawCatId === 'uncategorized' ? null : rawCatId;
            if (assignCategoryToItem) assignCategoryToItem(draggableId, finalCatId);
        } else if (destination.droppableId === 'bpu-items-list' && onReorderItems) {
            onReorderItems(source.index, destination.index, itemsToDisplay);
        }
    }
  };

  return (
    <div className="flex-1 flex h-full bg-slate-50 overflow-hidden relative font-sans text-slate-900">
      
      {/* MODALE DE LIEN CCTP */}
      {cctpLinkModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-modal flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><BookOpen size={18} /></div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Lien CCTP</h3>
                            <p className="text-[10px] text-slate-500 truncate w-64">{cctpLinkModal.item?.designation}</p>
                        </div>
                    </div>
                    <button onClick={() => setCctpLinkModal({ isOpen: false, item: null, refValue: '' })} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Titre du chapitre CCTP</label>
                        <input
                            type="text"
                            autoFocus
                            value={cctpLinkModal.labelValue}
                            onChange={(e) => setCctpLinkModal(prev => ({ ...prev, labelValue: e.target.value }))}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-700 transition-colors"
                            placeholder="Ex: Terrassements généraux"
                            onKeyDown={(e) => e.key === 'Enter' && saveCctpLink()}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">ID(s) du chapitre CCTP</label>
                        <input
                            type="text"
                            value={cctpLinkModal.refValue}
                            onChange={(e) => setCctpLinkModal(prev => ({ ...prev, refValue: e.target.value }))}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white outline-none text-xs text-slate-500 transition-colors"
                            placeholder="Ex: 3.1.2 ou imported_12345"
                            onKeyDown={(e) => e.key === 'Enter' && saveCctpLink()}
                        />
                        <p className="text-[10px] text-slate-400 italic mt-1">Pour lier plusieurs chapitres, séparez les identifiants par une virgule</p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <button onClick={() => setCctpLinkModal({ isOpen: false, item: null, refValue: '' })} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
                    <button onClick={saveCctpLink} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-colors">Enregistrer</button>
                </div>
            </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;
          // Nom de la biblio par défaut = nom du fichier sans extension
          const fileName = file.name.replace(/\.json$/i, '');
          const reader = new FileReader();
          reader.onload = (ev) => {
              try {
                  const json = JSON.parse(ev.target.result);
                  if (Array.isArray(json)) {
                    onImportData({ bpu: json }, { name: fileName });
                  } else {
                    onImportData(json, { name: fileName });
                  }
              } catch { toastError("Fichier JSON invalide."); }
          };
          reader.readAsText(file);
      }} className="hidden" accept=".json" />
      
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="database" />

      <DragDropContext onDragEnd={handleDragEnd}>
          {mode === 'articles' && (
          <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-30">
            <div className="p-4 border-b border-slate-100 bg-slate-50">

              <h3 className="font-black text-xs uppercase text-slate-500 tracking-widest mb-3 flex items-center gap-2"><Folder size={14} /> Dossiers</h3>
              {!isCreatingCat ? (
                <button onClick={() => setIsCreatingCat(true)} className={`w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-600 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-sm active:scale-95 ${isLocalMode ? 'hover:border-amber-500 hover:text-amber-600' : ''}`}><Plus size={14} /> Nouveau Dossier</button>
              ) : (
                <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                    <input autoFocus type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (addCategory(newCatName), setNewCatName(""), setIsCreatingCat(false))} placeholder="Nom..." className={`flex-1 min-w-0 py-1.5 px-2 text-xs border rounded focus:outline-none ${isLocalMode ? 'border-amber-500' : 'border-emerald-500'}`} />
                    <button onClick={() => (addCategory(newCatName), setNewCatName(""), setIsCreatingCat(false))} className={`p-1.5 text-white rounded ${isLocalMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}><Check size={14} /></button>
                    <button onClick={() => setIsCreatingCat(false)} className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"><X size={14} /></button>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div onClick={() => setSelectedCatId(null)} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedCatId === null ? (isLocalMode ? 'bg-amber-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md') : 'text-slate-700 hover:bg-slate-100'}`}><div className="w-4"></div><LayoutGrid size={16} /><span className="text-xs font-bold uppercase tracking-tight">Tous les articles</span><span className="ml-auto text-[10px] opacity-70 bg-black/10 px-1.5 rounded-full">{filteredBpu.length}</span></div>
              
              <Droppable droppableId="categories-list" type="CATEGORY">
                {(providedDropCat) => (
                    <div ref={providedDropCat.innerRef} {...providedDropCat.droppableProps}>
                        {(() => {
                            const CAT_FALLBACK = ['#3b82f6','#f59e0b','#8b5cf6','#10b981','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#92400e','#0ea5e9','#d946ef','#64748b','#059669'];
                            const isValidHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c);
                            const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
                            const usedColors = new Set(sorted.filter(c => isValidHex(c.color)).map(c => c.color));
                            const available = CAT_FALLBACK.filter(c => !usedColors.has(c));
                            let fbIdx = 0;
                            return sorted.map((cat, index) => {
                            const catColor = (cat.color && isValidHex(cat.color)) ? cat.color : (fbIdx < available.length ? available[fbIdx++] : CAT_FALLBACK[(fbIdx++) % CAT_FALLBACK.length]);
                            return (
                            <Draggable key={cat.id} draggableId={cat.id} index={index} isDragDisabled={isLocalMode}>
                                {(provided, snapshot) => (
                                    <Droppable droppableId={`folder-${cat.id}`} type="ITEM">
                                        {(providedDrop, snapshotDrop) => (
                                            <div
                                                ref={(el) => { provided.innerRef(el); providedDrop.innerRef(el); }}
                                                {...provided.draggableProps} {...provided.dragHandleProps} {...providedDrop.droppableProps}
                                                onClick={() => setSelectedCatId(cat.id)}
                                                className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150
                                                    ${snapshot.isDragging ? 'shadow-xl scale-105 z-50' : ''}
                                                    ${snapshotDrop.isDraggingOver ? 'scale-[1.03] shadow-lg ring-2' : ''}`}
                                                style={{
                                                    backgroundColor: snapshotDrop.isDraggingOver ? catColor + '40'
                                                        : selectedCatId === cat.id ? catColor + '30'
                                                        : catColor + '18',
                                                    borderLeft: `4px solid ${selectedCatId === cat.id || snapshotDrop.isDraggingOver ? catColor : catColor + '90'}`,
                                                    ...(snapshotDrop.isDraggingOver ? { ringColor: catColor, boxShadow: `0 4px 16px ${catColor}40` } : {})
                                                }}
                                            >
                                                <div className="text-slate-300 group-hover:text-slate-400"><GripVertical size={13} /></div>
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: catColor + '30' }}>
                                                    {snapshotDrop.isDraggingOver || selectedCatId === cat.id
                                                        ? <FolderOpen size={16} style={{ color: catColor }} />
                                                        : <Folder size={16} style={{ color: catColor }} />
                                                    }
                                                </div>
                                                <span className="text-[11px] truncate font-bold" style={{ color: selectedCatId === cat.id || snapshotDrop.isDraggingOver ? catColor : '#334155' }}>{cat.name}</span>
                                                <span className="ml-auto text-[10px] font-black min-w-[22px] h-[22px] flex items-center justify-center rounded-full shrink-0" style={{ color: '#fff', backgroundColor: catColor }}>{fullBpu.filter(i => { const ids = (i.categoryIds || (i.categoryId ? [i.categoryId] : [])).map(String); return ids.includes(String(cat.id)); }).length}</span>
                                                {providedDrop.placeholder}
                                                {selectedCatId === cat.id && !snapshotDrop.isDraggingOver && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); const newName = prompt("Nouveau nom :", cat.name); if(newName) renameCategory(cat.id, newName); }} className="p-1 hover:bg-white rounded text-slate-400 hover:text-blue-500"><Edit2 size={12} /></button>
                                                        <button onClick={async (e) => { e.stopPropagation(); const ok = await confirm("Supprimer ce dossier ?", { danger: true }); if(ok) deleteCategory(cat.id); }} className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                )}
                            </Draggable>
                            );
                        });
                        })()}
                        {providedDropCat.placeholder}
                    </div>
                )}
              </Droppable>

              <Droppable droppableId="folder-uncategorized" type="ITEM">
                {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                        onClick={() => setSelectedCatId('uncategorized')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150
                            ${snapshot.isDraggingOver ? 'bg-blue-100 ring-2 ring-blue-400 scale-[1.02] shadow-md' : ''}
                            ${!snapshot.isDraggingOver && selectedCatId === 'uncategorized' ? 'bg-slate-200 text-slate-800 font-bold' : ''}
                            ${!snapshot.isDraggingOver && selectedCatId !== 'uncategorized' ? 'text-slate-500 hover:bg-slate-100' : ''}`}
                    >
                        <div className="w-4"></div>
                        {snapshot.isDraggingOver ? <FolderOpen size={16} className="text-blue-600" /> : <Folder size={16} />}
                        <span className={`text-xs italic ${snapshot.isDraggingOver ? 'text-blue-700 font-bold not-italic' : ''}`}>Non classés</span>
                        {snapshot.isDraggingOver
                            ? <span className="ml-auto text-[9px] font-bold text-blue-600 bg-blue-200 px-1.5 py-0.5 rounded-full">Non classés</span>
                            : <span className="ml-auto text-[10px] bg-slate-200 px-1.5 rounded-full">{fullBpu.filter(i => { const ids = i.categoryIds || (i.categoryId ? [i.categoryId] : []); return ids.length === 0; }).length}</span>
                        }
                        {provided.placeholder}
                    </div>
                )}
              </Droppable>
              <div onClick={() => setSelectedCatId('nodescription')} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedCatId === 'nodescription' ? 'bg-red-50 text-red-800 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}><div className="w-4"></div><FileWarning size={16} /><span className="text-xs italic">Sans description</span><span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 rounded-full">{fullBpu.filter(i => !i.description || i.description.trim() === '' || i.description === '<p><br></p>').length}</span></div>
              <div onClick={() => setSelectedCatId('observed')} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedCatId === 'observed' ? 'bg-blue-50 text-blue-800 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}><div className="w-4"></div><TrendingUp size={16} /><span className="text-xs italic">Prix observés</span><span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded-full">{fullBpu.filter(i => i.observedPrice).length}</span></div>
            </div>
          </div>
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            
            {isLocalMode && (
                <div className="bg-amber-500 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest z-50 shadow-md">
                    <AlertCircle size={14} /> Mode Local : Travail hors-ligne (Sauvegarde dans le navigateur)
                    <button onClick={onFullResetLocal} className="ml-4 underline opacity-80 hover:opacity-100">Réinitialiser le cache</button>
                </div>
            )}

            <div className="bg-white px-6 py-2 border-b border-slate-100 flex items-center justify-between shadow-sm z-30 relative">
                <div className="flex items-center gap-6">
                    {/* Toggle Articles / Blocs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl shadow-inner shrink-0">
                        <button onClick={() => setMode('articles')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all active:scale-95 ${mode === 'articles' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={18} /> Articles</button>
                        <button onClick={() => setMode('blocs')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all active:scale-95 ${mode === 'blocs' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Boxes size={18} /> Blocs</button>
                    </div>

                    {/* Source de données (Cloud / Local) — visible dans les deux modes */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setSourceMenuOpen(o => !o)}
                            title="Source de données"
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-all active:scale-95 ${isLocalMode ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                        >
                            {isLocalMode ? <Monitor size={16} /> : <Cloud size={16} />}
                            <span className="max-w-[160px] truncate normal-case tracking-normal font-bold">{isLocalMode ? (localLibraryName || 'Travail Local') : 'Cloud Sync'}</span>
                            <ChevronDown size={14} className={`transition-transform ${sourceMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {sourceMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setSourceMenuOpen(false)} />
                            <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source de données</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    {/* Cloud Sync */}
                                    <button
                                        onClick={() => { if (isLocalMode) onExitLocalMode?.(); setSourceMenuOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${!isLocalMode ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${!isLocalMode ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}><Cloud size={16} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800">Cloud Sync</p>
                                            <p className="text-[10px] text-slate-400">Bibliothèque partagée</p>
                                        </div>
                                        {!isLocalMode && <Check size={16} className="text-blue-600 shrink-0" />}
                                    </button>
                                    {/* Base externe locale (active uniquement) */}
                                    {isLocalMode && (
                                      <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50">
                                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600"><Monitor size={16} /></div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-xs font-bold text-amber-800 truncate">{localLibraryName || 'Travail Local'}</p>
                                              <p className="text-[10px] text-amber-500">Base externe (locale)</p>
                                          </div>
                                          <Check size={16} className="text-amber-600 shrink-0" />
                                      </div>
                                    )}
                                </div>
                                <div className="p-2 border-t border-slate-100 space-y-1">
                                    <button onClick={() => { fileInputRef.current?.click(); setSourceMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"><Upload size={14} className="text-slate-400" /> Charger une base externe…</button>
                                    <button onClick={() => { handleExport(); setSourceMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"><Download size={14} className="text-slate-400" /> Sauvegarder (backup)</button>
                                    {isLocalMode && (
                                      <button
                                          onClick={async () => { setSourceMenuOpen(false); const ok = await confirm('Voulez-vous vraiment vider totalement la base locale ? Cette action est irréversible.', { title: 'Vider la base', danger: true }); if (ok) onFullResetLocal?.(); }}
                                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /> Vider la base locale</button>
                                    )}
                                </div>
                            </div>
                          </>
                        )}
                    </div>

                    {mode === 'articles' && (
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isLocalMode ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}><BarChart2 size={16} /></div>
                        <div>
                            <p className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Valeur Catalogue</p>
                            <p className="text-xs font-bold text-slate-700">{formatPrice(itemsToDisplay.reduce((acc, i) => acc + (i.price || 0), 0))}</p>
                        </div>
                    </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    {/* BOUTON RAFRAICHIR AJOUTÉ ICI */}
                    {!isLocalMode && (
                      <button 
                        onClick={handleForceRefresh} 
                        disabled={isRefreshing}
                        title="Actualiser depuis le serveur"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-100 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                        <span>Actualiser</span>
                      </button>
                    )}
                    {isAdmin && onClearObservedPrices && (
                      <button
                        onClick={async () => {
                          const count = fullBpu.filter(i => i.observedPrice).length;
                          if (count === 0) { toastInfo("Aucun prix observé à supprimer."); return; }
                          const ok = await confirm(`Supprimer les prix observés de ${count} article(s) ? Cette action est irréversible.`, { title: 'RAZ Prix Observés', danger: true, confirmLabel: 'Tout supprimer' });
                          if (ok) await onClearObservedPrices();
                        }}
                        title="Action Administrateur : Réinitialiser tous les prix observés"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 rounded-lg border border-red-100 transition-all"
                      >
                        <Trash2 size={14} />
                        <span>RAZ Prix Obs.</span>
                      </button>
                    )}
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100 transition-all"><HelpCircle size={14} /> Aide</button>
                </div>
            </div>

            {mode === 'articles' && (<>
            <header className="bg-white p-4 border-b border-slate-200 flex justify-between items-center z-20 relative">
              <div className="relative flex-1 mr-4 flex items-center gap-4">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input type="text" className={`w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white transition-all shadow-inner ${isLocalMode ? 'focus:border-amber-500' : 'focus:border-emerald-500'}`} placeholder="Rechercher..." value={bpuSearch} onChange={(e) => setBpuSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddBpuModal(true)} className={`${isLocalMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-md active:scale-95 transition-all`}><Plus size={14} /> Créer Article</button>
              </div>
            </header>

            <div className="flex items-center gap-3 px-6 py-2.5 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Trier par</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
                    <button
                        onClick={() => handleSort('designation')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${sortConfig.key === 'designation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Nom
                        {sortConfig.key === 'designation' && (sortConfig.direction === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpAZ size={13} />)}
                    </button>
                    <button
                        onClick={() => handleSort('cctp')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${sortConfig.key === 'cctp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <BookOpen size={13} /> CCTP
                        {sortConfig.key === 'cctp' && (sortConfig.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                    </button>
                    {bpuConfig?.numberingMode === 'manual' && (
                        <button
                            onClick={() => handleSort('bpuNum')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${sortConfig.key === 'bpuNum' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            N°
                            {sortConfig.key === 'bpuNum' && (sortConfig.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                        </button>
                    )}
                    <button
                        onClick={() => handleSort('price')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${sortConfig.key === 'price' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Euro size={13} /> Prix
                        {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                    </button>
                </div>
                {sortConfig.key && (
                    <button
                        onClick={() => setSortConfig({ key: null, direction: 'asc' })}
                        title="Annuler le tri"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    >
                        <X size={12} /> Réinit.
                    </button>
                )}
            </div>

            <div ref={parentRef} className="flex-1 overflow-y-auto p-4 bg-slate-50 pb-32">
                <Droppable droppableId="bpu-items-list" type="ITEM" isDropDisabled={bpuSearch.length > 0 || sortConfig.key !== null}>
                    {(provided) => (
                        <div 
                            ref={provided.innerRef} 
                            {...provided.droppableProps}
                            className="max-w-5xl mx-auto relative"
                            style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%' }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const item = itemsToDisplay[virtualRow.index];
                                const hasCctp = item.cctpRef || (item.cctpRefs && item.cctpRefs.length > 0);

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            position: 'absolute',
                                            top: `${virtualRow.start}px`,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            paddingBottom: '12px' // Équivalent de ton ancien gap-3
                                        }}
                                    >
                                        <Draggable key={item.id} draggableId={String(item.id)} index={virtualRow.index} isDragDisabled={sortConfig.key !== null}>
                                            {(providedDrag, snapshot) => (
                                                <div 
                                                    ref={providedDrag.innerRef} 
                                                    {...providedDrag.draggableProps} 
                                                    {...providedDrag.dragHandleProps} 
                                                    onDoubleClick={() => onEditItem(item)} 
                                                    onClick={() => toggleSelection(item.id)} 
                                                    className={`relative group flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 h-full ${selectedIds.has(item.id) ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100' : 'bg-white border-slate-200 hover:shadow-lg'} ${snapshot.isDragging ? 'border-blue-500 shadow-2xl scale-[1.03] z-50 ring-4 ring-blue-100 bg-white' : ''} ${!selectedIds.has(item.id) && (isLocalMode ? 'hover:border-amber-300' : 'hover:border-emerald-300')}`}
                                                    style={{ ...providedDrag.draggableProps.style }}
                                                >
                                                    <div className="cursor-pointer text-slate-300 hover:text-blue-500 transition-colors">{selectedIds.has(item.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}</div>
                                                    <div className="text-slate-300 group-hover:text-slate-400 cursor-grab"><GripVertical size={16} /></div>
                                                    <div className={`w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 text-slate-400 group-hover:bg-slate-100 transition-colors ${isLocalMode ? 'group-hover:text-amber-500' : 'group-hover:text-emerald-500'}`}><FileText size={20} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {(bpuConfig?.numberingMode === 'manual' || item.bpuNum) && (
                                                                <span className="text-[10px] font-black text-white bg-slate-900 px-1.5 py-0.5 rounded shadow-sm">
                                                                    {item.bpuNum || "#"}
                                                                </span>
                                                            )}
                                                            <h4 className="font-bold text-xs text-slate-800 uppercase truncate tracking-tight">{cleanText(item.designation)}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-1.5">
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${isLocalMode ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>{normalizeUnitSymbol(item.unit)}</span>
                                                            
                                                            {/* --- BADGES CATÉGORIE --- */}
                                                            {(() => {
                                                                const CAT_FALLBACK = ['#3b82f6','#f59e0b','#8b5cf6','#10b981','#f43f5e','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#e11d48'];
                                                                const itemCatIds = item.categoryIds || (item.categoryId ? [item.categoryId] : []);
                                                                const itemCats = (categories || []).filter(c => itemCatIds.map(String).includes(String(c.id)));
                                                                return itemCats.map(cat => {
                                                                    const catIdx = (categories || []).findIndex(c => c.id === cat.id);
                                                                    const color = cat.color || CAT_FALLBACK[catIdx % CAT_FALLBACK.length] || '#64748b';
                                                                    return (
                                                                        <span
                                                                            key={cat.id}
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedCatId(cat.id); }}
                                                                            className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-lg border uppercase tracking-widest cursor-pointer transition-colors hover:opacity-80"
                                                                            style={{ color, backgroundColor: color + '20', borderColor: color + '50' }}
                                                                            title={`Filtrer par : ${cat.name}`}
                                                                        >
                                                                            <Folder size={9} />
                                                                            {cat.name}
                                                                        </span>
                                                                    );
                                                                });
                                                            })()}

                                                            {/* --- BADGE CCTP AJOUTÉ ICI --- */}
                                                            {hasCctp ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditCctpLink(item); }}
                                                                    className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border tracking-wide text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors shadow-sm max-w-[200px]"
                                                                    title={`CCTP : ${resolveCctpLabel(item)}`}
                                                                >
                                                                    <BookOpen size={10} className="shrink-0" />
                                                                    <span className="truncate">{resolveCctpLabel(item)}</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditCctpLink(item); }}
                                                                    className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border border-dashed uppercase tracking-widest text-slate-400 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Lier au CCTP"
                                                                >
                                                                    <BookOpen size={10} /> + CCTP
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right min-w-[100px] pr-2">
                                                        <span className="block font-black text-sm text-slate-900">{formatPrice(item.price)}</span>
                                                        <span className="block text-[8px] uppercase font-black text-slate-400 tracking-tighter">Prix Catalogue</span>
                                                        {item.observedPrice && (
                                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setPriceHistoryItem(item); }}
                                                                    className="flex items-center gap-1 font-bold text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors cursor-pointer"
                                                                    title={`Prix réel: ${formatPrice(item.observedPrice)} — Cliquez pour voir l'historique`}
                                                                >
                                                                    <History size={9} />
                                                                    Réel: {formatPrice(item.observedPrice)}
                                                                </button>
                                                                {renderPriceTrend(item)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); deleteFromBpu(item.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button></div>
                                                </div>
                                            )}
                                        </Draggable>
                                    </div>
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </div>
            </>)}

            {mode === 'blocs' && (
              <BlocsPanel
                blocs={blocs}
                fullBpu={fullBpu}
                units={units}
                addBloc={addBloc}
                updateBloc={updateBloc}
                deleteBloc={deleteBloc}
                dragEndRef={blocDragEndRef}
              />
            )}
          </div>
      </DragDropContext>

      {/* ── Modale historique des prix ── */}
      {priceHistoryItem && (() => {
        const history = priceHistoryItem.priceHistory || [];
        const hasHistory = history.length > 0;
        const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        return (
          <div className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4" onClick={() => setPriceHistoryItem(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0"><History size={20} className="text-blue-600" /></div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-gray-900">Historique des prix observés</h3>
                    <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide truncate">{cleanText(priceHistoryItem.designation)}</p>
                  </div>
                </div>
                <button onClick={() => setPriceHistoryItem(null)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"><X size={18} /></button>
              </div>

              {/* Résumé — 3 cartes */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-3 shrink-0">
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Prix catalogue</span>
                  <span className="block text-lg font-black text-gray-900">{formatPrice(priceHistoryItem.price)}</span>
                </div>
                <div className="bg-white rounded-xl border border-blue-100 px-4 py-3">
                  <span className="text-[10px] text-blue-500 uppercase font-bold tracking-wide">Moyenne observée</span>
                  <span className="block text-lg font-black text-blue-600">{formatPrice(priceHistoryItem.observedPrice)}</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Écart</span>
                  {priceHistoryItem.price > 0 && priceHistoryItem.observedPrice > 0 ? (() => {
                    const diff = ((priceHistoryItem.observedPrice - priceHistoryItem.price) / priceHistoryItem.price) * 100;
                    return <span className={`block text-lg font-black ${diff > 2 ? 'text-red-600' : diff < -2 ? 'text-emerald-600' : 'text-gray-500'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>;
                  })() : <span className="block text-lg font-black text-gray-300">—</span>}
                </div>
              </div>

              {/* Tableau */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {!hasHistory ? (
                  <div className="text-center py-12 text-gray-400">
                    <BarChart2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucun historique disponible</p>
                    <p className="text-[11px] text-gray-300 mt-1">Les prochaines remontées de prix seront enregistrées ici</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-[10px] uppercase font-black tracking-wider text-gray-400">
                        <th className="px-6 py-2.5 bg-gray-50 border-b border-gray-200">Prix</th>
                        <th className="px-3 py-2.5 bg-gray-50 border-b border-gray-200">Affaire</th>
                        <th className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-right">Quantité</th>
                        <th className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-center">Offres</th>
                        <th className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-right" title="Date d'ouverture des plis (RAO), sinon date de remise de l'offre">Date</th>
                        <th className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map((h, i) => {
                        const isLatest = i === 0;
                        const origIdx = history.length - 1 - i;
                        const pendingDelete = confirmDeleteHistIdx === origIdx;
                        if (pendingDelete) {
                          return (
                            <tr key={origIdx} className="bg-red-50 border-t border-red-100">
                              <td colSpan={5} className="px-6 py-3 text-xs font-bold text-red-600">Supprimer cette remontée ? La moyenne sera recalculée.</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => handleDeleteHistoryEntry(origIdx)} title="Confirmer la suppression" className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"><Check size={14} /></button>
                                  <button onClick={() => setConfirmDeleteHistIdx(null)} title="Annuler" className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"><X size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={origIdx} className={`group border-t border-gray-100 transition-colors ${isLatest ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-sm ${isLatest ? 'text-blue-700' : 'text-gray-800'}`}>{formatPrice(h.price)}</span>
                                {isLatest && <span className="text-[8px] font-black uppercase tracking-wider text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Récent</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3 max-w-[220px]">
                              {h.project ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 min-w-0 max-w-full" title={h.project}>
                                  <Briefcase size={12} className="shrink-0 text-gray-400" />
                                  <span className="truncate font-medium">{h.project}</span>
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap text-xs font-semibold text-gray-700">
                              {h.qty != null && h.qty !== '' ? <>{Number(h.qty).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}<span className="text-gray-400 font-normal">{h.unit ? ` ${h.unit}` : ''}</span></> : <span className="text-gray-300 font-normal">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap text-xs text-gray-500">
                              {h.count > 0 ? h.count : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-400">{fmtD(h.date)}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => setConfirmDeleteHistIdx(origIdx)} title="Supprimer cette remontée" className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-60 group-hover:opacity-100"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-gray-400">{hasHistory ? `${history.length} remontée${history.length > 1 ? 's' : ''}` : ''}</span>
                <button onClick={() => setPriceHistoryItem(null)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors">Fermer</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

DatabaseView.propTypes = {
  filteredBpu: PropTypes.array,
  fullBpu: PropTypes.array,
  setShowAddBpuModal: PropTypes.func.isRequired,
  onEditItem: PropTypes.func.isRequired,
  deleteFromBpu: PropTypes.func.isRequired,
  categories: PropTypes.array,
  addCategory: PropTypes.func,
  deleteCategory: PropTypes.func,
  renameCategory: PropTypes.func,
  reorderCategories: PropTypes.func,
  assignCategoryToItem: PropTypes.func,
  onImportData: PropTypes.func,
  onReorderItems: PropTypes.func,
  units: PropTypes.array,
  onUpdateItem: PropTypes.func.isRequired,
  setItemToDuplicate: PropTypes.func,
  isLocalMode: PropTypes.bool,
  onExitLocalMode: PropTypes.func,
  onFullResetLocal: PropTypes.func,
  onForceRefresh: PropTypes.func,
  localLibraryName: PropTypes.string,
  isAdmin: PropTypes.bool,
  onClearObservedPrices: PropTypes.func,
  bpuSearch: PropTypes.string,
  setBpuSearch: PropTypes.func.isRequired,
  bpuConfig: PropTypes.object,
  masterCctp: PropTypes.array,
  blocs: PropTypes.array,
  addBloc: PropTypes.func,
  updateBloc: PropTypes.func,
  deleteBloc: PropTypes.func,
};

export default DatabaseView;