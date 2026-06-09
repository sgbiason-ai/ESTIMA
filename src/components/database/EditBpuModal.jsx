import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Edit2, Hash, BookOpen, Search, Folder, Check, ChevronDown, Maximize2, Minimize2, Trash2, Library, Plus, RefreshCw, History, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import RichTextEditor from '../common/RichTextEditor';
import CctpSelectorModal from '../modals/CctpSelectorModal'; 

const EditBpuModal = ({ item, onClose, onUpdate, units, categories = [], bpuConfig, existingItems = [], masterCctp = [], projectOnly = false, onSaveToLibrary = null, libraryItems = [] }) => {
  const [formData, setFormData] = useState({
    designation: '', description: '', unit: '', price: 0, bpuNum: '', categoryIds: [], cctpRefs: [] // cctpRefs tableau
  });

  const [displayPrice, setDisplayPrice] = useState('');
  const [error, setError] = useState("");
  const [showCctpSelector, setShowCctpSelector] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showLibMenu, setShowLibMenu] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const catDropdownRef = useRef(null);
  const libMenuRef = useRef(null);

  // L'article est-il lié à un prix de la bibliothèque ? (sinon "Mettre à jour la source" est impossible)
  const isLinkedToLibrary = Boolean(item?.uid);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target)) {
        setShowCatSelector(false);
      }
    };
    if (showCatSelector) {
        document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCatSelector]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (libMenuRef.current && !libMenuRef.current.contains(event.target)) {
        setShowLibMenu(false);
      }
    };
    if (showLibMenu) {
        document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLibMenu]);

  const getCctpTitle = (id) => {
    if (!id || !masterCctp) return "";
    let title = "";
    const traverse = (nodes) => {
        for (const node of nodes) {
            if (node.id === id) { title = node.title; return; }
            if (node.children) traverse(node.children);
        }
    };
    traverse(masterCctp);
    return title;
  };

  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
        designation: item.designation || '',
        description: item.description || '',
        unit: item.unit || 'u',
        price: item.price || 0,
        bpuNum: item.bpuNum || '',
        // Migration tableau
        cctpRefs: item.cctpRefs || (item.cctpRef ? [item.cctpRef] : []),
        categoryIds: item.categoryIds || (item.categoryId ? [item.categoryId] : [])
      });
      setDisplayPrice(formatPrice(item.price || 0));
    }
    setShowCatSelector(false);
    setShowLibMenu(false);
    setError("");
  }, [item]);

  const formatPrice = (value) => {
    if (value === '' || value === undefined || isNaN(value)) return '';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true 
    }).format(value);
  };

  const handlePriceChange = (e) => {
    const val = e.target.value;
    setDisplayPrice(val);
    const cleanVal = val.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
    const numVal = parseFloat(cleanVal);
    setFormData(prev => ({ ...prev, price: isNaN(numVal) ? 0 : numVal }));
  };

  const handlePriceBlur = () => setDisplayPrice(formatPrice(formData.price));
  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleCategory = (catId) => {
    setFormData(prev => {
        const currentIds = prev.categoryIds || [];
        if (currentIds.includes(catId)) return { ...prev, categoryIds: currentIds.filter(id => id !== catId) };
        else return { ...prev, categoryIds: [...currentIds, catId] };
    });
  };

  // Ajout CCTP
  const addCctpRef = (id) => {
      if (!id) return;
      setFormData(prev => {
          const currentRefs = prev.cctpRefs || [];
          if (currentRefs.includes(id)) return prev; 
          return { ...prev, cctpRefs: [...currentRefs, id] };
      });
  };

  const removeCctpRef = (id, e) => {
      e.stopPropagation();
      setFormData(prev => ({
          ...prev, 
          cctpRefs: (prev.cctpRefs || []).filter(ref => ref !== id)
      }));
  };

  // Construit un article "propre" pour la bibliothèque (sans les champs propres au projet :
  // id, uid, quantity, children… présents dans formData mais à ne PAS pousser dans le BPU).
  const buildLibraryPayload = () => ({
    designation: (formData.designation || '').toUpperCase(),
    description: formData.description || '',
    unit: formData.unit || 'u',
    price: Number(formData.price) || 0,
    bpuNum: formData.bpuNum?.trim() || "",
    cctpRefs: formData.cctpRefs || [],
    cctpRef: null,
    categoryIds: formData.categoryIds || [],
    categoryId: null,
  });

  // Enregistrer dans la bibliothèque : 'new' = prix nouveau, 'update' = écraser l'article source lié.
  const handleSaveToLibrary = (mode) => {
    setError("");
    setShowLibMenu(false);
    if (!formData.designation || !formData.designation.trim()) {
      setError("La désignation est obligatoire pour enregistrer dans la bibliothèque.");
      return;
    }
    if (mode === 'new' && bpuConfig?.numberingMode === 'manual') {
      const num = formData.bpuNum?.trim();
      if (num && (libraryItems || []).some(i => i.bpuNum === num)) {
        setError(`Le numéro "${num}" est déjà utilisé dans la bibliothèque.`);
        return;
      }
    }
    onSaveToLibrary?.({ mode, data: buildLibraryPayload() });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (bpuConfig?.numberingMode === 'manual') {
        const num = formData.bpuNum?.trim();
        if (num) {
            const duplicate = existingItems.find(i => i.bpuNum === num && i.id !== item.id);
            if (duplicate) { setError(`Le numéro "${num}" est déjà utilisé`); return; }
        }
    }
    onUpdate({
        ...formData,
        designation: formData.designation.toUpperCase(),
        bpuNum: formData.bpuNum?.trim() || "",
        cctpRefs: formData.cctpRefs || [],
        cctpRef: null,
        categoryIds: formData.categoryIds || [],
        categoryId: null 
    });
  };

  if (!item) return null;

  // Prix réel observé (remontées RAO) porté par l'article. Écart % du P.U. saisi vs ce prix réel
  // (>0 = prix saisi au-dessus du réel → rouge ; <0 = en-dessous → vert ; |%| < 2 → aligné).
  const observedPrice = item?.observedPrice != null ? (Number(item.observedPrice) || 0) : null;
  const obsPct = (observedPrice && observedPrice !== 0)
    ? (((Number(formData.price) || 0) - observedPrice) / observedPrice) * 100
    : null;

  const inputClass = `w-full bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm transition-all ${
    isFullScreen ? 'px-3 py-1.5 text-xs h-8' : 'px-4 py-3 text-sm'
  }`;
  const labelClass = `block font-black text-emerald-700 uppercase tracking-widest cursor-pointer ${
    isFullScreen ? 'text-[9px] mb-0.5' : 'text-[10px] mb-2'
  }`;
  const selectorBaseClass = `w-full bg-white border rounded-lg flex items-center justify-between cursor-pointer transition-all group ${
      isFullScreen ? 'px-2 py-1.5 min-h-[32px]' : 'px-4 py-2 min-h-[46px]'
  }`;

  return (
    <div className={`fixed inset-0 z-modal flex items-center justify-center bg-slate-900/80 backdrop-blur-sm ${isFullScreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col relative transition-all duration-300 ${isFullScreen ? 'h-full rounded-none' : 'max-w-7xl h-[90vh] rounded-xl'}`}>
        
        <CctpSelectorModal 
            isOpen={showCctpSelector}
            onClose={() => setShowCctpSelector(false)}
            masterCctp={masterCctp}
            currentRef=""
            onSelect={addCctpRef}
        />

        <header className={`bg-slate-900 px-6 flex justify-between items-center text-white shrink-0 shadow-md transition-all duration-300 ${isFullScreen ? 'py-2 h-10' : 'py-4'}`}>
          <div className="flex items-center gap-3">
            <Edit2 size={isFullScreen ? 14 : 18} className={projectOnly ? 'text-amber-400' : 'text-emerald-400'} />
            <h3 className={`font-black uppercase tracking-[0.2em] text-white ${isFullScreen ? 'text-[10px]' : 'text-xs'}`}>
              {projectOnly ? 'Modifier dans le projet' : 'Édition Grand Format'}
            </h3>
            {projectOnly && !isFullScreen && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Projet uniquement
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-slate-300 hover:text-white">
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-full transition-colors"><X size={isFullScreen ? 18 : 24} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50">
          {projectOnly && (
            <div className="relative z-30 px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-800 font-medium flex-1">
                Les modifications s'appliquent <strong>uniquement à cet article dans le projet en cours</strong>. La base de prix unitaires (BPU) ne sera pas modifiée.
              </p>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isFixed: !prev.isFixed }))}
                title="Forfait : montant fixe, non soumis à l'arrondi automatique des quantités"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors shadow-sm whitespace-nowrap shrink-0 ${
                  formData.isFixed
                    ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                    : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400'
                }`}
              >
                <Lock size={12} /> Forfait {formData.isFixed ? '· activé' : ''}
              </button>
              {onSaveToLibrary && (
                <div className="relative shrink-0" ref={libMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowLibMenu(v => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 hover:border-amber-400 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <Library size={13} /> Enregistrer dans la bibliothèque <ChevronDown size={12} className={`transition-transform ${showLibMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showLibMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-modal ring-4 ring-black/5 animate-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => handleSaveToLibrary('new')}
                        className="w-full flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-emerald-50 text-left transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5"><Plus size={15} className="text-emerald-600" /></div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-800">Créer un prix nouveau</div>
                          <div className="text-[10px] text-slate-500 leading-tight">Ajoute un nouvel article à la bibliothèque (et lie cette ligne au nouveau prix).</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={!isLinkedToLibrary}
                        onClick={() => isLinkedToLibrary && handleSaveToLibrary('update')}
                        className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors ${isLinkedToLibrary ? 'hover:bg-blue-50' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5"><RefreshCw size={14} className="text-blue-600" /></div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-800">Mettre à jour l'article source</div>
                          <div className="text-[10px] text-slate-500 leading-tight">{isLinkedToLibrary ? "Écrase le prix et le descriptif de l'article lié dans la bibliothèque." : "Cette ligne n'est liée à aucun article de la bibliothèque."}</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className={`px-8 shrink-0 grid grid-cols-12 bg-white border-b border-slate-200 shadow-sm relative transition-all duration-300 ${isFullScreen ? 'py-3 gap-x-4 gap-y-2' : 'pb-6 pt-8 gap-6'}`}>
              
              {bpuConfig?.numberingMode === 'manual' && (
                  <div className="col-span-2">
                    <label className={labelClass}><Hash size={10} className="inline mr-1"/> N° Prix</label>
                    <input type="text" name="bpuNum" value={formData.bpuNum} onChange={handleChange} className={`${inputClass} border-blue-200 focus:border-blue-500 text-blue-800`} placeholder="1.1" autoFocus />
                  </div>
              )}

              <div className={bpuConfig?.numberingMode === 'manual' ? "col-span-6" : "col-span-8"}>
                <label className={labelClass}>Désignation</label>
                <input type="text" value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} className={`${inputClass} uppercase`} placeholder="NOM DE L'OUVRAGE" />
              </div>

              <div className="col-span-2">
                 <label className={labelClass}>Unité</label>
                 <select value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className={`${inputClass} cursor-pointer`}>
                   {/* Unité importée hors liste (ex. "M2", "m²", "ML") : on la conserve brute pour rester
                       fidèle au DQE, au lieu de retomber silencieusement sur la 1re option ("u - Unité"). */}
                   {formData.unit && !units.some(u => u.symbol === formData.unit) && (
                     <option value={formData.unit}>{formData.unit}</option>
                   )}
                   {units.map(u => (<option key={u.symbol} value={u.symbol}>{u.symbol} - {u.label}</option>))}
                 </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>P.U. (€)</label>
                <input type="text" inputMode="decimal" value={displayPrice} onChange={handlePriceChange} onBlur={handlePriceBlur} className={`${inputClass} font-mono text-emerald-700 text-right`} placeholder="0,00" />
                {/* Prix réel observé (remontées RAO) + écart vs le P.U. saisi */}
                {observedPrice !== null && (
                  <div className={`flex flex-wrap items-center justify-end gap-1 ${isFullScreen ? 'mt-0.5' : 'mt-1.5'}`}>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600" title="Prix réel observé (remontées RAO)">
                      <History size={10} /> Réel : {formatPrice(observedPrice)} €
                    </span>
                    {obsPct !== null && (
                      Math.abs(obsPct) < 2 ? (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded">Aligné</span>
                      ) : (
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 rounded border ${obsPct > 0 ? 'text-red-600 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                          {obsPct > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {obsPct > 0 ? '+' : ''}{obsPct.toFixed(1)}%
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* LIGNE 2 : CCTP MULTI */}
              <div className="col-span-6">
                 <label className={`block font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1 cursor-pointer ${isFullScreen ? 'text-[9px] mb-0.5' : 'text-[10px] mb-2'}`} onClick={() => setShowCctpSelector(true)}><BookOpen size={10}/> Chapitres CCTP ({formData.cctpRefs?.length || 0})</label>
                 <div onClick={() => setShowCctpSelector(true)} className={`${selectorBaseClass} border-indigo-200 hover:border-indigo-400 hover:shadow-md overflow-hidden`}>
                    <div className="flex flex-wrap gap-1 items-center flex-1 overflow-hidden pr-2">
                        {formData.cctpRefs && formData.cctpRefs.length > 0 ? (
                            formData.cctpRefs.map(refId => {
                                const isCleanId = !refId.startsWith('imported_') && !refId.startsWith('custom_');
                                return (
                                    <span key={refId} className={`inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 max-w-full ${isFullScreen ? 'py-0 text-[9px]' : 'py-0.5 text-xs'}`}>
                                        {isCleanId && <span className="font-mono font-bold opacity-70">{refId}</span>}
                                        <span className="truncate font-medium max-w-[120px]">{getCctpTitle(refId)}</span>
                                        <button onClick={(e) => removeCctpRef(refId, e)} className="hover:bg-indigo-200 rounded-full p-0.5"><X size={10}/></button>
                                    </span>
                                );
                            })
                        ) : (<span className={`text-slate-400 italic ${isFullScreen ? 'text-xs' : 'text-sm'}`}>Lier au CCTP...</span>)}
                    </div>
                    <Search size={isFullScreen ? 12 : 14} className="text-indigo-300 group-hover:text-indigo-500 shrink-0" />
                 </div>
              </div>

               <div className={`col-span-6 relative ${showCatSelector ? 'z-modal' : 'z-auto'}`} ref={catDropdownRef}>
                 <label className={labelClass} onClick={() => setShowCatSelector(!showCatSelector)}><Folder size={10} className="inline mr-1"/> Dossiers ({formData.categoryIds?.length || 0})</label>
                 <div onClick={(e) => { e.stopPropagation(); setShowCatSelector(!showCatSelector); }} className={`${selectorBaseClass} border-slate-300 hover:border-emerald-500`}>
                    <div className="flex flex-wrap gap-1 items-center flex-1 overflow-hidden pr-2">
                        {formData.categoryIds?.length > 0 ? (
                            categories.filter(c => formData.categoryIds.includes(c.id)).map(cat => (
                                <span key={cat.id} className={`font-bold bg-slate-100 text-slate-600 rounded truncate ${isFullScreen ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'}`}>{cat.name}</span>
                            ))
                        ) : (<span className={`text-slate-400 italic ${isFullScreen ? 'text-xs' : 'text-xs'}`}>Aucun dossier...</span>)}
                    </div>
                    <ChevronDown size={isFullScreen ? 12 : 14} className="text-slate-400" />
                 </div>
                 {showCatSelector && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-60 overflow-y-auto p-2 animate-in zoom-in-95 duration-100 w-64 ring-4 ring-black/5" onClick={(e) => e.stopPropagation()}>
                        {categories.map(cat => (
                            <div key={cat.id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCategory(cat.id); }} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.categoryIds.includes(cat.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                    {formData.categoryIds.includes(cat.id) && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-xs font-bold text-slate-700 uppercase truncate select-none">{cat.name}</span>
                            </div>
                        ))}
                    </div>
                 )}
              </div>
            </div>

            {error && <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded flex items-center gap-2 animate-pulse"><X size={14}/> {error}</div>}

            <div className="flex-1 p-8 pt-6 flex flex-col min-h-0">
              <label className={`${labelClass} mb-3`}>Contenu Technique & Spécifications</label>
              <div className="flex-1 flex flex-col min-h-0 shadow-sm rounded-lg overflow-hidden border border-slate-300">
                <RichTextEditor key={item.id} value={formData.description || ""} onChange={(html) => setFormData({...formData, description: html})} placeholder="Détaillez ici les prestations techniques..." />
              </div>
            </div>

          </form>
        </div>

        <footer className={`flex justify-end gap-4 border-t border-slate-200 bg-white shrink-0 z-20 transition-all duration-300 ${isFullScreen ? 'p-3' : 'p-6'}`}>
          <button type="button" onClick={onClose} className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors">Annuler</button>
          <button onClick={handleSubmit} className={`text-white px-8 py-3 rounded-lg text-[11px] font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95 ${projectOnly ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <Save size={16} /> {projectOnly ? 'Appliquer au projet' : 'Enregistrer les modifications'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default EditBpuModal;