import React, { useState, useRef, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  Search, Plus, Trash2, Folder, FolderOpen, LayoutGrid, FileText, 
  Edit2, GripVertical, Download, Upload, Check, X, MoreVertical, 
  Calendar, Copy, ArrowDownAZ, ArrowUpAZ, ArrowUp, ArrowDown, Euro, Hash, Coins,
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
  isSuperAdmin = false,
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
  const [selectedCatId, setSelectedCatId] = useState(() => {
    return localStorage.getItem('estima_selected_bpu_filter') || null;
  });

  useEffect(() => {
    if (selectedCatId) {
      localStorage.setItem('estima_selected_bpu_filter', selectedCatId);
    } else {
      localStorage.removeItem('estima_selected_bpu_filter');
    }
  }, [selectedCatId]);

  const toggleCategoryFilter = (catId) => {
    setSelectedCatId(prev => prev === catId ? null : catId);
  };
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); 
  const [showHelp, setShowHelp] = useState(false); 
  const [isRefreshing, setIsRefreshing] = useState(false); // État pour l'animation du bouton
  const { confirm } = useDialog();
  
  const { error: toastError, info: toastInfo, success: toastSuccess } = useToast();

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
    
    const cleanRefs = refs.map(r => {
      let s = String(r);
      if (s.startsWith('imported_')) s = s.substring('imported_'.length);
      if (s.startsWith('custom_')) s = s.substring('custom_'.length);
      return s;
    }).filter(Boolean);
    
    if (cleanRefs.length > 0) {
      return cleanRefs.map(r => {
        if (r.length > 15 && !r.includes('.')) return 'CCTP Lié';
        return `Chapitre ${r}`;
      }).join(', ');
    }
    return 'CCTP Lié';
  };

  // --- État pour la modale de modification du lien CCTP ---
  const [cctpLinkModal, setCctpLinkModal] = useState({ isOpen: false, item: null, refValue: '', labelValue: '' });
  const [priceHistoryItem, setPriceHistoryItem] = useState(null); // item pour modale historique prix
  const [confirmDeleteHistIdx, setConfirmDeleteHistIdx] = useState(null); // index (original) de la remontée en attente de confirmation

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isShiftPressed, setIsShiftPressed] = useState(false);
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
      if (selectedCatId === 'zeroprice') return !item.price || Number(item.price) === 0;
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

  // --- Statistiques de la bibliothèque (Bento) ---
  const stats = useMemo(() => {
    const total = fullBpu.length;
    const value = fullBpu.reduce((acc, i) => acc + (i.price || 0), 0);
    const withCctp = fullBpu.filter(item => item.cctpRef || (item.cctpRefs && item.cctpRefs.length > 0)).length;
    const cctpPct = total > 0 ? Math.round((withCctp / total) * 100) : 0;
    const observed = fullBpu.filter(i => i.observedPrice).length;
    return { total, value, cctpPct, observed };
  }, [fullBpu]);

  // --- Configuration de la virtualisation ---
  const rowVirtualizer = useVirtualizer({
    count: itemsToDisplay.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92, // Hauteur moyenne d'un élément + l'espacement (gap)
    overscan: 10, // Nombre d'éléments pré-chargés hors-champ pour la fluidité
  });

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

    // onUpdateItem attend (id, champs partiels) : on construit un patch.
    // Les champs vidés sont mis à null (un merge ne peut pas supprimer par omission).
    const fields = {};
    if (refs.length > 1) {
        fields.cctpRefs = refs;
        fields.cctpRef = null;
    } else if (refs.length === 1) {
        fields.cctpRef = refs[0];
        fields.cctpRefs = null;
    } else {
        fields.cctpRef = null;
        fields.cctpRefs = null;
    }
    fields.cctpLabel = labelValue.trim() ? labelValue.trim() : null;

    if (onUpdateItem && item) onUpdateItem(item.id, fields);
    setCctpLinkModal({ isOpen: false, item: null, refValue: '', labelValue: '' });
  };
  // ----------------------------------------------------

  const renderPriceTrend = (item, isLarge = false) => {
    if (!item.observedPrice || !item.price) return null;
    const diff = ((item.observedPrice - item.price) / item.price) * 100;
    const sizeClass = isLarge ? 'text-[11px] px-2 py-0.5 rounded-lg' : 'text-[9px] px-1 rounded';
    const iconSize = isLarge ? 12 : 10;
    
    if (Math.abs(diff) < 2) {
      return (
        <span 
          className={`font-bold text-slate-400 bg-slate-100 ${sizeClass}`} 
          title={`Prix réel: ${formatPrice(item.observedPrice)} €`}
        >
          Aligné
        </span>
      );
    }
    
    return (
        <div 
          className={`flex items-center gap-0.5 font-bold cursor-help ${sizeClass} ${diff > 0 ? 'text-red-600 bg-red-50 border border-red-100' : 'text-emerald-600 bg-emerald-50 border border-emerald-100'}`}
          title={`Prix réel observé: ${formatPrice(item.observedPrice)} €`}
        >
            {diff > 0 ? <TrendingUp size={iconSize} /> : <TrendingDown size={iconSize} />}
            {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
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
      bpu: fullBpu
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); 
    link.href = url; 
    link.download = `sauvegarde_bpu_${cleanText(activeDbName).replace(/\s+/g,'_')}.json`; 
    link.click();
  };

  const handleExportExcel = async () => {
    try {
      const { exportLibraryToExcel } = await import('../utils/excelLibraryHelper');
      await exportLibraryToExcel(fullBpu, categories, isLocalMode ? (localLibraryName || "base_locale") : "complet");
      toastSuccess("Export Excel généré avec succès.");
    } catch (err) {
      console.error(err);
      toastError("Erreur lors de la génération de l'export Excel.");
    }
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
    <div className="flex-1 flex h-full bg-[#f5f5f7] overflow-hidden relative font-sans text-slate-900">
      
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

      <input type="file" ref={fileInputRef} onChange={async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const isXlsx = file.name.endsWith('.xlsx');
          const fileName = file.name.replace(/\.(json|xlsx)$/i, '');
          
          if (isXlsx) {
              try {
                  const { parseLibraryExcel } = await import('../utils/excelLibraryHelper');
                  const result = await parseLibraryExcel(file);
                  onImportData(result, { name: fileName });
                  toastSuccess("Importation Excel réussie.");
              } catch (err) {
                  console.error(err);
                  toastError(err.message || "Erreur lors de l'importation Excel.");
              }
          } else {
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
          }
          e.target.value = '';
      }} className="hidden" accept=".json,.xlsx" />
      
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="database" />

      <DragDropContext onDragEnd={handleDragEnd}>
          {mode === 'articles' && (
          <div className="w-80 bg-white/85 backdrop-blur-xl border-r border-gray-200/60 flex flex-col shrink-0 z-30">
            <div className="p-5 border-b border-gray-200/40 bg-gray-50/40">

              <h3 className="font-bold text-[10px] uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2 select-none"><Folder size={13} strokeWidth={2} className="text-gray-400" /> Dossiers</h3>
              {!isCreatingCat ? (
                <button onClick={() => setIsCreatingCat(true)} className={`w-full flex items-center justify-center gap-2 bg-white border border-gray-200/80 hover:border-emerald-500 text-gray-700 hover:text-emerald-600 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 ${isLocalMode ? 'hover:border-amber-500 hover:text-amber-600' : ''}`}><Plus size={14} strokeWidth={1.5} /> Nouveau Dossier</button>
              ) : (
                <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                    <input autoFocus type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (addCategory(newCatName), setNewCatName(""), setIsCreatingCat(false))} placeholder="Nom..." className={`flex-1 min-w-0 py-1.5 px-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 ${isLocalMode ? 'focus:ring-amber-500/10 focus:border-amber-500' : ''}`} />
                    <button onClick={() => (addCategory(newCatName), setNewCatName(""), setIsCreatingCat(false))} className={`p-2 text-white rounded-xl active:scale-95 transition-all ${isLocalMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}><Check size={14} /></button>
                    <button onClick={() => setIsCreatingCat(false)} className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 active:scale-95 transition-all"><X size={14} /></button>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div onClick={() => setSelectedCatId(null)} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${selectedCatId === null ? (isLocalMode ? 'bg-amber-600 text-white shadow-sm font-bold' : 'bg-emerald-600 text-white shadow-sm font-bold') : 'text-gray-700 hover:bg-gray-100/70'}`}><div className="w-4"></div><LayoutGrid size={16} strokeWidth={1.5} /><span className="text-xs font-bold tracking-tight">Tous les articles</span><span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedCatId === null ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{filteredBpu.length}</span></div>
              
              <Droppable droppableId="categories-list" type="CATEGORY">
                {(providedDropCat) => (
                    <div ref={providedDropCat.innerRef} {...providedDropCat.droppableProps} className="space-y-0.5">
                        {(() => {
                            const CAT_FALLBACK = ['#3b82f6','#f59e0b','#8b5cf6','#10b981','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#92400e','#0ea5e9','#d946ef','#64748b','#059669'];
                            const isValidHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c);
                            const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
                            const usedColors = new Set(sorted.filter(c => isValidHex(c.color)).map(c => c.color));
                            const available = CAT_FALLBACK.filter(c => !usedColors.has(c));
                            let fbIdx = 0;
                            return sorted.map((cat, index) => {
                            const catColor = (cat.color && isValidHex(cat.color)) ? cat.color : (fbIdx < available.length ? available[fbIdx++] : CAT_FALLBACK[(fbIdx++) % CAT_FALLBACK.length]);
                            const isSelected = selectedCatId === cat.id;
                            return (
                            <Draggable key={cat.id} draggableId={cat.id} index={index} isDragDisabled={isLocalMode}>
                                {(provided, snapshot) => (
                                    <Droppable droppableId={`folder-${cat.id}`} type="ITEM">
                                        {(providedDrop, snapshotDrop) => (
                                            <div
                                                ref={(el) => { provided.innerRef(el); providedDrop.innerRef(el); }}
                                                {...provided.draggableProps} {...provided.dragHandleProps} {...providedDrop.droppableProps}
                                                onClick={() => toggleCategoryFilter(cat.id)}
                                                className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 border border-transparent
                                                    ${snapshot.isDragging ? 'shadow-lg scale-102 bg-white z-50 border-gray-200' : ''}
                                                    ${snapshotDrop.isDraggingOver ? 'scale-[1.02] shadow-sm' : ''}`}
                                                style={{
                                                    backgroundColor: snapshotDrop.isDraggingOver ? catColor + '20'
                                                        : isSelected ? catColor + '10'
                                                        : 'transparent',
                                                    borderLeft: `3px solid ${isSelected || snapshotDrop.isDraggingOver ? catColor : 'transparent'}`,
                                                    ...((isSelected || snapshotDrop.isDraggingOver) ? { color: catColor } : {})
                                                }}
                                            >
                                                <div className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical size={13} /></div>
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected || snapshotDrop.isDraggingOver ? catColor + '20' : catColor + '10' }}>
                                                    {snapshotDrop.isDraggingOver || isSelected
                                                        ? <FolderOpen size={15} style={{ color: catColor }} strokeWidth={1.5} />
                                                        : <Folder size={15} style={{ color: catColor }} strokeWidth={1.5} />
                                                    }
                                                </div>
                                                <span className="text-xs truncate font-semibold flex-1" style={{ color: isSelected || snapshotDrop.isDraggingOver ? catColor : '#374151' }}>{cat.name}</span>
                                                <span className="text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-lg shrink-0 transition-colors" style={{ color: catColor, backgroundColor: catColor + '15' }}>{fullBpu.filter(i => { const ids = (i.categoryIds || (i.categoryId ? [i.categoryId] : [])).map(String); return ids.includes(String(cat.id)); }).length}</span>
                                                {providedDrop.placeholder}
                                                {isSelected && !snapshotDrop.isDraggingOver && (
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button onClick={(e) => { e.stopPropagation(); const newName = prompt("Nouveau nom :", cat.name); if(newName) renameCategory(cat.id, newName); }} className="p-1 hover:bg-white rounded-lg text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={12} /></button>
                                                        <button onClick={async (e) => { e.stopPropagation(); const ok = await confirm("Supprimer ce dossier ?", { danger: true }); if(ok) deleteCategory(cat.id); }} className="p-1 hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
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
                        onClick={() => toggleCategoryFilter('uncategorized')}
                        className={`flex items-center gap-3 px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
                            ${snapshot.isDraggingOver ? 'bg-blue-50 border-blue-200 scale-[1.01] shadow-sm' : ''}
                            ${!snapshot.isDraggingOver && selectedCatId === 'uncategorized' ? 'bg-gray-100 text-gray-800 font-bold' : 'text-gray-500 hover:bg-gray-100/70'}`}
                    >
                        <div className="w-4"></div>
                        {snapshot.isDraggingOver ? <FolderOpen size={15} className="text-blue-600" strokeWidth={1.5} /> : <Folder size={15} strokeWidth={1.5} />}
                        <span className={`text-xs ${snapshot.isDraggingOver ? 'text-blue-700 font-semibold' : 'font-medium'}`}>Non classés</span>
                        {snapshot.isDraggingOver
                            ? <span className="ml-auto text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-lg">Déposer</span>
                            : <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-lg">{fullBpu.filter(i => { const ids = i.categoryIds || (i.categoryId ? [i.categoryId] : []); return ids.length === 0; }).length}</span>
                        }
                        {provided.placeholder}
                    </div>
                )}
              </Droppable>
              <div onClick={() => toggleCategoryFilter('nodescription')} className={`flex items-center gap-3 px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 ${selectedCatId === 'nodescription' ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-500 hover:bg-gray-100/70'}`}><div className="w-4"></div><FileWarning size={15} strokeWidth={1.5} className="text-red-500" /><span className="text-xs font-medium">Sans description</span><span className="ml-auto text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-lg">{fullBpu.filter(i => !i.description || i.description.trim() === '' || i.description === '<p><br></p>').length}</span></div>
              <div onClick={() => toggleCategoryFilter('observed')} className={`flex items-center gap-3 px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 ${selectedCatId === 'observed' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-100/70'}`}><div className="w-4"></div><TrendingUp size={15} strokeWidth={1.5} className="text-blue-500" /><span className="text-xs font-medium">Prix observés</span><span className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-lg">{fullBpu.filter(i => i.observedPrice).length}</span></div>
              <div onClick={() => toggleCategoryFilter('zeroprice')} className={`flex items-center gap-3 px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 ${selectedCatId === 'zeroprice' ? 'bg-amber-50 text-amber-700 font-bold' : 'text-gray-500 hover:bg-gray-100/70'}`}><div className="w-4"></div><Coins size={15} strokeWidth={1.5} className="text-amber-500" /><span className="text-xs font-medium">Prix à 0</span><span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-lg">{fullBpu.filter(i => !i.price || Number(i.price) === 0).length}</span></div>
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

            <div className="bg-white px-6 py-3.5 border-b border-gray-200/60 flex items-center justify-between shadow-sm z-30 relative">
                <div className="flex items-center gap-6">
                    {/* Toggle Articles / Blocs */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-2xl shrink-0">
                        <button onClick={() => setMode('articles')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${mode === 'articles' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutList size={17} strokeWidth={1.5} /> Articles</button>
                        <button onClick={() => setMode('blocs')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${mode === 'blocs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Boxes size={17} strokeWidth={1.5} /> Blocs</button>
                    </div>

                    {/* Source de données (Cloud / Local) — visible dans les deux modes */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setSourceMenuOpen(o => !o)}
                            title="Source de données"
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${isLocalMode ? 'bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-100/70' : 'bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-100/70'}`}
                        >
                            {isLocalMode ? <Monitor size={15} strokeWidth={1.5} /> : <Cloud size={15} strokeWidth={1.5} />}
                            <span className="max-w-[160px] truncate normal-case tracking-normal font-bold">{isLocalMode ? (localLibraryName || 'Travail Local') : 'Cloud Sync'}</span>
                            <ChevronDown size={13} className={`transition-transform ${sourceMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {sourceMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setSourceMenuOpen(false)} />
                            <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200/60 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Source de données</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    {/* Cloud Sync */}
                                    <button
                                        onClick={() => { if (isLocalMode) onExitLocalMode?.(); setSourceMenuOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${!isLocalMode ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${!isLocalMode ? 'bg-blue-100/80 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><Cloud size={15} strokeWidth={1.5} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800">Cloud Sync</p>
                                            <p className="text-[10px] text-gray-400">Bibliothèque partagée</p>
                                        </div>
                                        {!isLocalMode && <Check size={15} className="text-blue-600 shrink-0" strokeWidth={2} />}
                                    </button>
                                    {/* Base externe locale (active uniquement) */}
                                    {isLocalMode && (
                                      <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50/60">
                                          <div className="p-1.5 rounded-lg bg-amber-100/80 text-amber-600"><Monitor size={15} strokeWidth={1.5} /></div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-xs font-bold text-amber-800 truncate">{localLibraryName || 'Travail Local'}</p>
                                              <p className="text-[10px] text-amber-500">Base externe (locale)</p>
                                          </div>
                                          <Check size={15} className="text-amber-600 shrink-0" strokeWidth={2} />
                                      </div>
                                    )}
                                </div>
                                <div className="p-2 border-t border-gray-100 space-y-0.5">
                                    <button onClick={() => { fileInputRef.current?.click(); setSourceMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"><Upload size={14} className="text-gray-400" strokeWidth={1.5} /> Importer base (.xlsx, .json)…</button>
                                    <button onClick={() => { handleExportExcel(); setSourceMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"><Download size={14} className="text-blue-500" strokeWidth={1.5} /> Exporter vers Excel (.xlsx)</button>
                                    <button onClick={() => { handleExport(); setSourceMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"><Download size={14} className="text-gray-400" strokeWidth={1.5} /> Sauvegarde complète (.json)</button>
                                    {isLocalMode && (
                                      <button
                                          onClick={async () => { setSourceMenuOpen(false); const ok = await confirm('Voulez-vous vraiment vider totalement la base locale ? Cette action est irréversible.', { title: 'Vider la base', danger: true }); if (ok) onFullResetLocal?.(); }}
                                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} strokeWidth={1.5} /> Vider la base locale</button>
                                    )}
                                </div>
                            </div>
                          </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* BOUTON RAFRAICHIR AJOUTÉ ICI */}
                    {!isLocalMode && (
                      <button 
                        onClick={handleForceRefresh} 
                        disabled={isRefreshing}
                        title="Actualiser depuis le serveur"
                        className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 rounded-xl border border-emerald-200/40 transition-all disabled:opacity-50 active:scale-95"
                      >
                        <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                        <span>Actualiser</span>
                      </button>
                    )}
                    {isSuperAdmin && onClearObservedPrices && (
                      <button
                        onClick={async () => {
                          const count = fullBpu.filter(i => i.observedPrice).length;
                          if (count === 0) { toastInfo("Aucun prix observé à supprimer."); return; }
                          const ok = await confirm(`Supprimer les prix observés de ${count} article(s) ? Cette action est irréversible.`, { title: 'RAZ Prix Observés', danger: true, confirmLabel: 'Tout supprimer' });
                          if (ok) await onClearObservedPrices();
                        }}
                        title="Action Administrateur : Réinitialiser tous les prix observés"
                        className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 rounded-xl border border-red-200/40 transition-all active:scale-95"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                        <span>RAZ Prix Obs.</span>
                      </button>
                    )}
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50 rounded-xl border border-blue-200/40 transition-all active:scale-95"><HelpCircle size={13} strokeWidth={1.5} /> Aide</button>
                </div>
            </div>

            {mode === 'articles' && (<>
            <header className="bg-white px-6 py-4 border-b border-gray-200/60 flex justify-between items-center z-20 relative gap-6">
              <div className="relative w-80 shrink-0">
                  <Search className="absolute left-3.5 top-2.5 text-gray-400" size={15} strokeWidth={1.5} />
                  <input type="text" className={`w-full pl-10 pr-4 py-2 bg-gray-100/70 border border-gray-200/50 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 transition-all ${isLocalMode ? 'focus:border-amber-400 focus:ring-amber-100' : 'focus:border-blue-400 focus:ring-blue-100'}`} placeholder="Rechercher un article..." value={bpuSearch} onChange={(e) => setBpuSearch(e.target.value)} />
              </div>

              {/* Bento miniatures au milieu */}
              <div className="hidden lg:flex items-center gap-4 select-none">
                {/* Stat 1 : Total Articles */}
                <div className="bg-gray-50 border border-gray-200/40 rounded-[14px] px-3.5 py-1.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Hash size={14} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[8px] font-bold uppercase text-gray-400 tracking-wider leading-none">Total Articles</span>
                    <span className="block text-xs font-bold text-gray-800 tracking-tight mt-0.5 leading-none">{stats.total}</span>
                  </div>
                </div>

                {/* Stat 2 : Couverture CCTP */}
                <div className="bg-gray-50 border border-gray-200/40 rounded-[14px] px-3.5 py-1.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <BookOpen size={14} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[8px] font-bold uppercase text-gray-400 tracking-wider leading-none">Couverture CCTP</span>
                    <span className="block text-xs font-bold text-gray-800 tracking-tight mt-0.5 leading-none">{stats.cctpPct}%</span>
                  </div>
                </div>

                {/* Stat 3 : Prix Observés */}
                <div className="bg-gray-50 border border-gray-200/40 rounded-[14px] px-3.5 py-1.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={14} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[8px] font-bold uppercase text-gray-400 tracking-wider leading-none">Prix Observés</span>
                    <span className="block text-xs font-bold text-gray-800 tracking-tight mt-0.5 leading-none">{stats.observed}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button onClick={() => setShowAddBpuModal(true)} className={`${isLocalMode ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'} text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all`}><Plus size={14} strokeWidth={1.5} /> Créer Article</button>
              </div>
            </header>

            <div className="flex items-center gap-3 px-6 py-2 bg-white border-b border-gray-200/60 sticky top-0 z-10 shadow-sm/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 select-none">Trier par</span>
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl shrink-0">
                    <button
                        onClick={() => handleSort('designation')}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${sortConfig.key === 'designation' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Nom
                        {sortConfig.key === 'designation' && (sortConfig.direction === 'asc' ? <ArrowDownAZ size={13} strokeWidth={1.5} /> : <ArrowUpAZ size={13} strokeWidth={1.5} />)}
                    </button>
                    <button
                        onClick={() => handleSort('cctp')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${sortConfig.key === 'cctp' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <BookOpen size={13} strokeWidth={1.5} /> CCTP
                        {sortConfig.key === 'cctp' && (sortConfig.direction === 'asc' ? <ArrowUp size={13} strokeWidth={1.5} /> : <ArrowDown size={13} strokeWidth={1.5} />)}
                    </button>
                    {bpuConfig?.numberingMode === 'manual' && (
                        <button
                            onClick={() => handleSort('bpuNum')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${sortConfig.key === 'bpuNum' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            N°
                            {sortConfig.key === 'bpuNum' && (sortConfig.direction === 'asc' ? <ArrowUp size={13} strokeWidth={1.5} /> : <ArrowDown size={13} strokeWidth={1.5} />)}
                        </button>
                    )}
                    <button
                        onClick={() => handleSort('price')}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${sortConfig.key === 'price' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Euro size={13} strokeWidth={1.5} /> Prix
                        {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? <ArrowUp size={13} strokeWidth={1.5} /> : <ArrowDown size={13} strokeWidth={1.5} />)}
                    </button>
                </div>
                {sortConfig.key && (
                    <button
                        onClick={() => setSortConfig({ key: null, direction: 'asc' })}
                        title="Annuler le tri"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 active:scale-95"
                    >
                        <X size={12} strokeWidth={1.5} /> Réinit.
                    </button>
                )}
            </div>

            <div ref={parentRef} className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f5f5f7] pb-32">


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
                                            paddingBottom: '16px'
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
                                                    className={`relative group flex items-center gap-4 px-6 py-5 rounded-2xl border transition-all duration-200 h-full ${selectedIds.has(item.id) ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-100/50' : 'bg-white border-gray-200/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:-translate-y-0.5'} ${snapshot.isDragging ? 'border-blue-400 shadow-2xl scale-[1.02] z-50 ring-4 ring-blue-100 bg-white' : ''} ${!selectedIds.has(item.id) && (isLocalMode ? 'hover:border-amber-300' : 'hover:border-emerald-300')}`}
                                                    style={{ ...providedDrag.draggableProps.style }}
                                                >
                                                    <div className="cursor-pointer text-gray-300 hover:text-blue-500 transition-colors">{selectedIds.has(item.id) ? <CheckSquare size={19} className="text-blue-500 animate-in zoom-in-75 duration-100" strokeWidth={2} /> : <Square size={19} className="text-gray-300 group-hover:text-gray-400" strokeWidth={1.5} />}</div>
                                                    <div className="text-gray-200 group-hover:text-gray-300 cursor-grab shrink-0"><GripVertical size={15} strokeWidth={1.5} /></div>
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-gray-400 transition-all ${selectedIds.has(item.id) ? 'bg-blue-100/50 text-blue-500' : isLocalMode ? 'bg-amber-50/40 text-amber-500 group-hover:bg-amber-50/70' : 'bg-emerald-50/40 text-emerald-500 group-hover:bg-emerald-50/70'}`}><FileText size={18} strokeWidth={1.5} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {(bpuConfig?.numberingMode === 'manual' || item.bpuNum) && (
                                                                <span className="text-[10px] font-bold text-white bg-gray-800 px-2 py-0.5 rounded-lg shadow-sm font-mono select-all">
                                                                    {item.bpuNum || "#"}
                                                                </span>
                                                            )}
                                                            <h4 className="font-bold text-[13px] text-gray-800 uppercase truncate tracking-tight select-all">{cleanText(item.designation)}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-1.5">
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-widest ${isLocalMode ? 'text-amber-600 bg-amber-50 border-amber-100/50' : 'text-emerald-600 bg-emerald-50 border-emerald-100/50'}`}>{normalizeUnitSymbol(item.unit)}</span>
                                                            
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
                                                                            className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-widest cursor-pointer transition-all hover:opacity-80"
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
                                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg border tracking-wide text-blue-600 bg-blue-50 border-blue-200/50 hover:bg-blue-100/70 transition-colors max-w-[200px] shadow-sm shrink-0"
                                                                    title={`CCTP : ${resolveCctpLabel(item)}`}
                                                                >
                                                                    <BookOpen size={10} className="shrink-0" strokeWidth={1.5} />
                                                                    <span className="truncate">{resolveCctpLabel(item)}</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditCctpLink(item); }}
                                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-dashed uppercase tracking-widest text-gray-400 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                                                    title="Lier au CCTP"
                                                                >
                                                                    <BookOpen size={10} strokeWidth={1.5} /> + CCTP
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 pr-2 shrink-0 select-none">
                                                        {item.observedPrice && (
                                                            <div className="shrink-0 flex items-center justify-end">
                                                                {renderPriceTrend(item, true)}
                                                            </div>
                                                        )}
                                                        <div className="text-right min-w-[100px]">
                                                            <span className="block font-black text-sm text-gray-900 tracking-tight">{formatPrice(item.price)} €</span>
                                                            <span className="block text-[8px] uppercase font-bold text-gray-400 tracking-wider">Catalogue</span>
                                                            {item.observedPrice && (
                                                                <div className="flex justify-end mt-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setPriceHistoryItem(item); }}
                                                                        className="flex items-center gap-1 font-bold text-[9px] text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 px-1.5 py-0.5 rounded-lg border border-transparent hover:border-blue-100 transition-all cursor-pointer"
                                                                        title={`Prix réel moyen: ${formatPrice(item.observedPrice)} € — Cliquez pour voir l'historique`}
                                                                    >
                                                                        <History size={9} strokeWidth={1.5} />
                                                                        Réel: {formatPrice(item.observedPrice)} €
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); deleteFromBpu(item.id); }} 
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                                        >
                                                            <Trash2 size={16} strokeWidth={1.5} />
                                                        </button>
                                                    </div>
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
  isSuperAdmin: PropTypes.bool,
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