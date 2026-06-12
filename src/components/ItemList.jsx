// src/components/ItemList.jsx
import React, { useContext, memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd'; 
import { GripVertical, Layers, Trash2, Plus, ShieldCheck, AlertCircle, AlertTriangle, FunctionSquare, Check, Boxes, Pencil, Target, Lock, Unlock, ChevronDown, ChevronRight, Link2 } from 'lucide-react';

import { ProjectContext } from '../context/ProjectContext';
import { EditableTitle, FormattedInput, OptionToggle } from './ProjectUI';
import { formatPrice, cleanText, normalizeUnitSymbol } from '../utils/helpers';
import { safeEvalMathExpr } from '../utils/projectCalculations';

// --------------------
// FORMULA INPUT — calculatrice PM + formules style Excel
// --------------------
const FormulaInput = ({ value, formula, formulaMode, setFormulaMode, onCommit, disabled, className, placeholder, refMap, sourceItemId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef(null);
  const inputValueRef = useRef(String(value));
  const savedCursorPos = useRef(null); // Position curseur sauvegardée avant blur
  // Mémorise l'id EXACT de chaque ligne cliquée pour cette session d'édition.
  // Indispensable car un même article en double (même uid BPU) partage le même
  // label P.x : reverseRefMap ne garderait qu'un seul id et la formule pointerait
  // vers la mauvaise instance (souvent vide → résultat 0).
  const sessionRefMap = useRef(new Map());

  // Map inverse label → id (node.id) pour ré-encoder la formule au commit.
  // refMap insère dans l'ordre {designation → label, uid → label, id → label}.
  // recalculateProject travaille avec contextMap[node.id], donc on veut le DERNIER set (id).
  // On ne fait pas de check `!m.has` pour laisser l'écrasement aller jusqu'au id.
  const reverseRefMap = useMemo(() => {
    const m = new Map();
    if (!refMap) return m;
    refMap.forEach((label, key) => {
      if (label) m.set(label, key); // l'overwrite final = la clé node.id (insérée en dernier dans refMap)
    });
    return m;
  }, [refMap]);

  // {uid} → {P.01} pour l'affichage utilisateur
  const uidToLabel = useCallback((s) => {
    if (!s || !refMap) return s;
    return String(s).replace(/\{([^}]+)\}/g, (match, id) => {
      const lbl = refMap.get(id) || refMap.get(String(id));
      return lbl ? `{${lbl}}` : match;
    });
  }, [refMap]);

  // {P.01} → {uid} pour le stockage interne (recalculateProject travaille en uid)
  const labelToUid = useCallback((s) => {
    if (!s) return s;
    return String(s).replace(/\{([^}]+)\}/g, (match, label) => {
      // Priorité à l'id exact mémorisé pour cette session (lève l'ambiguïté des doublons),
      // sinon repli sur la map inverse globale (référence saisie/collée à la main).
      const uid = sessionRefMap.current.get(label) ?? reverseRefMap.get(label);
      return uid ? `{${uid}}` : match;
    });
  }, [reverseRefMap]);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(value);
      inputValueRef.current = String(value);
    }
  }, [value, isEditing]);

  // --- Insertion d'une référence à la position du curseur ---
  const handleInsertRef = useCallback((refId) => {
    // Insérer directement le label lisible si dispo (sinon fallback sur l'uid brut)
    const label = refMap?.get(refId) || refMap?.get(String(refId)) || refId;
    // Mémorise la ligne EXACTE cliquée pour ce label (préservé au commit même en cas de doublon).
    sessionRefMap.current.set(String(label), refId);
    const ref = `{${label}}`;
    const currentVal = inputValueRef.current;
    // On préfère la position sauvegardée (avant que le focus parte vers l'autre ligne)
    const pos = savedCursorPos.current ?? currentVal.length;
    const newVal = currentVal.substring(0, pos) + ref + currentVal.substring(pos);

    setInputValue(newVal);
    inputValueRef.current = newVal;
    savedCursorPos.current = pos + ref.length; // curseur après la ref
    setFormulaMode({ isActive: true, onInsert: handleInsertRef, sourceItemId });

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(savedCursorPos.current, savedCursorPos.current);
      }
    }, 0);
  }, [refMap]); // eslint-disable-line

  // --- Focus ---
  const handleFocus = () => {
    if (disabled) return;
    setIsEditing(true);
    // Si on est déjà en mode formule (ex: on vient d'insérer une ref via clic),
    // on ne réinitialise PAS l'input — la formule en cours doit être conservée.
    if (formulaMode?.isActive) return;
    // Pré-remplit la session avec les ids déjà référencés : un aller-retour d'édition
    // (P.x affiché → id stocké) doit conserver l'instance d'origine, pas la re-deviner.
    if (formula && refMap) {
      String(formula).replace(/\{([^}]+)\}/g, (m, id) => {
        const lbl = refMap.get(id) || refMap.get(String(id));
        if (lbl) sessionRefMap.current.set(String(lbl), id);
        return m;
      });
    }
    // Afficher les références sous leur forme lisible (P.01) plutôt que l'uid interne
    const displayVal = formula ? uidToLabel(formula) : (Number(value) === 0 ? '' : String(value));
    setInputValue(displayVal);
    inputValueRef.current = displayVal;
    if (displayVal.startsWith('=')) {
      setFormulaMode({ isActive: true, onInsert: handleInsertRef, sourceItemId });
    }
  };

  // --- Changement ---
  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    inputValueRef.current = val;
    if (val.startsWith('=')) {
      setFormulaMode({ isActive: true, onInsert: handleInsertRef, sourceItemId });
    } else {
      setFormulaMode({ isActive: false, onInsert: null });
    }
  };

  // --- Calculatrice simple ---
  const calculate = (expression) => {
    try {
      const sanitized = String(expression).replace(/,/g, '.').trim();
      if (!sanitized) return 0;
      if (!/^[0-9+\-*/().\s]*$/.test(sanitized)) return 0;
      const result = safeEvalMathExpr(sanitized);
      if (isNaN(result) || !isFinite(result)) return 0;
      return Math.round(result * 100) / 100;
    } catch { return 0; }
  };

  // --- Blur / validation ---
  const handleBlur = () => {
    setIsEditing(false);
    if (formulaMode?.isActive) {
      setFormulaMode({ isActive: false, onInsert: null });
    }
    const textVal = String(inputValue).trim();
    if (textVal === '') { onCommit(0); setInputValue(0); return; }
    if (textVal.startsWith('=')) {
      // Ré-encoder les labels lisibles ({P.01}) en uid pour que recalculateProject puisse résoudre
      onCommit(labelToUid(textVal));
    } else {
      const calculated = calculate(textVal);
      onCommit(calculated);
      setInputValue(calculated);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      if (formula) { setInputValue(value); inputValueRef.current = String(value); }
      setFormulaMode({ isActive: false, onInsert: null });
      inputRef.current?.blur();
    }
  };

  // --- Affichage ---
  const getDisplayValue = () => {
    if (isEditing) return inputValue;
    const num = Number(inputValue);
    if (num === 0 && !formula) return 'PM';
    if (!isNaN(num) && inputValue !== '') return Number.isInteger(num) ? String(num) : num.toFixed(2);
    return inputValue;
  };

  const hasFormula = !!(formula && formula.startsWith('='));
  const isPM = !isEditing && Number(inputValue) === 0 && !formula;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={`${isPM ? `${className} italic text-slate-400 font-medium` : className}
          ${hasFormula && !isEditing ? '!bg-emerald-50 !border-emerald-300 !text-emerald-800' : ''}
          ${isEditing && inputValue.toString().startsWith('=') ? '!border-amber-400 !bg-amber-50' : ''}
          transition-colors duration-150`}
        value={getDisplayValue()}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyUp={(e) => { savedCursorPos.current = e.currentTarget.selectionStart; }}
        onClick={(e) => { savedCursorPos.current = e.currentTarget.selectionStart; }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        title={hasFormula ? uidToLabel(formula) : undefined}
      />
      {/* Badge ƒ sur les cellules avec formule */}
      {hasFormula && !isEditing && (
        <span className="absolute left-0.5 top-0 text-[7px] text-emerald-500 font-black pointer-events-none leading-tight">ƒ</span>
      )}
    </div>
  );
};

// --------------------
// HELPERS
// --------------------
const sumNodeTotal = (node, isClientMode, clientQtyMap) => {
  if (node.type === 'item') {
    let q = Number(node.qty || 0);
    if (isClientMode && clientQtyMap?.has(String(node.id))) {
      q = Number(clientQtyMap.get(String(node.id)) || 0);
    }
    return q * Number(node.price || 0);
  }
  if (node.children) {
    return node.children.reduce((acc, child) => acc + sumNodeTotal(child, isClientMode, clientQtyMap), 0);
  }
  return 0;
};

const formatPercent = (val) => {
  if (!isFinite(val)) return '0%';
  return `${val > 0 ? '+' : ''}${val.toFixed(0)}%`;
};

// --------------------
// ITEM ROW
// --------------------
const ItemRow = memo(
  ({
    el,
    index,
    parentId,
    level,
    isSelected,
    isReadOnly,
    isGlobalMode,
    viewMode,
    showComparison,
    clientQtyMap,
    refMap,
    bpuConfig,
    onUpdate,
    onSelect,
    stableKey,
    formulaMode,
    setFormulaMode,
    activeTrancheId,
    sourceIds,
    allItems,
    onEditItem,
    isMultiSelected,
    hasMultiSelection,
    onToggleMultiSelection,
    priceIssue,
    dupInfo,
    onRevealItem,
  }) => {
    const draggableId = `item:${stableKey}`;

    // ── Prix répété : indicateur sur les occurrences suivantes (pas la 1ʳᵉ) ──
    const isRepeatedPrice = !!dupInfo && dupInfo.index > 0;
    const nextDupId = dupInfo ? dupInfo.ids[(dupInfo.index + 1) % dupInfo.count] : null;
    const dupTooltip = dupInfo
      ? `Prix répété — utilisé ${dupInfo.count} fois :\n${dupInfo.labels
          .map((l, i) => `${i + 1}. ${l}${i === 0 ? ' (1ʳᵉ occurrence)' : ''}${i === dupInfo.index ? ' ← ici' : ''}`)
          .join('\n')}\nCliquer : aller à l'occurrence suivante`
      : '';

    const qtyStudy = el.studyQty !== undefined ? Number(el.studyQty) : Number(el.qty || 0);
    const qtyClient = clientQtyMap?.has(String(el.id)) 
        ? Number(clientQtyMap.get(String(el.id)) || 0) 
        : qtyStudy;

    const displayedQty = viewMode === 'client' ? qtyClient : qtyStudy;
    const qtyFieldToUpdate = 'qty';

    // Quantité figée : jamais majorée en mode rendu (indépendant du forfait isFixed).
    const isQtyLocked = !!el.qtyLocked;

    const currentFormula = (activeTrancheId && activeTrancheId !== 'global') 
        ? el.quantitiesFormula?.[activeTrancheId] 
        : el.formula;

    const hasFormula = !!(currentFormula && currentFormula.startsWith('='));
    const isSource = sourceIds?.includes(el.id);

    const [localPrice, setLocalPrice] = useState(el.price);
    useEffect(() => setLocalPrice(el.price), [el.price]);

    // Article libre (hors BPU) : désignation + unité éditables directement dans la ligne.
    const isFree = !!el.isFree && !el.uid;
    const [localDesignation, setLocalDesignation] = useState(el.designation || '');
    useEffect(() => setLocalDesignation(el.designation || ''), [el.designation]);
    const [localUnit, setLocalUnit] = useState(el.unit || '');
    useEffect(() => setLocalUnit(el.unit || ''), [el.unit]);

    const commitDesignation = () => {
      const v = String(localDesignation).toUpperCase();
      if (v !== String(el.designation || '')) onUpdate(parentId, el.id, 'designation', v);
    };
    const commitUnit = () => {
      const v = String(localUnit).trim().toUpperCase();
      if (v !== String(el.unit || '')) onUpdate(parentId, el.id, 'unit', v);
    };

    const commitPrice = () => {
      const currentVal = Number(localPrice);
      const dbVal = Number(el.price);
      if (currentVal !== dbVal) onUpdate(parentId, el.id, 'price', currentVal);
    };

    const handlePriceKeyDown = (e) => {
      if (e.key === 'Enter') e.currentTarget.blur();
    };

    const price = Number(el.price || 0);
    const lineTotal = displayedQty * price;

    let diffTotal = 0, diffQty = 0, diffPercent = 0;
    if (showComparison && isReadOnly) {
      const totalStudy = qtyStudy * price;
      const totalClient = qtyClient * price;
      diffTotal = totalClient - totalStudy;
      diffQty = qtyClient - qtyStudy;
      diffPercent = qtyStudy > 0 ? (diffQty / qtyStudy) * 100 : (diffQty > 0 ? 100 : 0);
    }

    const isPM = displayedQty === 0;

    // --- Traduction de la formule pour l'infobulle ---
    const renderFormulaReadable = (formulaStr) => {
      if (!formulaStr) return '';
      return formulaStr.replace(/\{([^}]+)\}/g, (match, id) => {
        const item = allItems?.find(it => it.id === id);
        // On tronque légèrement si le nom est trop long pour éviter une énorme infobulle
        return item ? `[${item.designation.length > 30 ? item.designation.substring(0, 30) + '...' : item.designation}]` : match;
      });
    };

    // --- Recherche des articles qui utilisent CET article ---
    let usedInNames = [];
    if (isSource && allItems) {
        const searchStr = `{${el.id}}`;
        allItems.forEach(item => {
            const itemFormula = (activeTrancheId && activeTrancheId !== 'global') 
                ? item.quantitiesFormula?.[activeTrancheId] 
                : item.formula;
            if (itemFormula && itemFormula.includes(searchStr)) {
                usedInNames.push(item.designation);
            }
        });
    }
    
    // Le texte de l'infobulle bleue (point source)
    const sourceTooltipText = usedInNames.length > 0
        ? `Cette quantité est utilisée dans :\n- ${usedInNames.join('\n- ')}`
        : "Cette ligne est utilisée dans une formule";

    return (
      <Draggable draggableId={draggableId} index={index} isDragDisabled={isReadOnly}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            id={`estima-item-${el.id}`}
            className={`group flex items-center border-b border-slate-100 py-1 outline-none transition-colors
              ${isMultiSelected ? 'bg-red-50/60 ring-1 ring-inset ring-red-200' : isSelected ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : 'bg-white'}
              ${hasFormula && !isSelected && !isMultiSelected ? 'bg-emerald-50/30' : ''}
              ${isSource && !isSelected && !isMultiSelected ? 'bg-blue-50/30' : ''}
              ${formulaMode?.isActive && formulaMode.sourceItemId !== el.id ? 'cursor-crosshair hover:bg-amber-50 hover:ring-1 hover:ring-inset hover:ring-amber-300' : (formulaMode?.isActive ? '' : 'cursor-default hover:bg-emerald-50')}
              ${snapshot.isDragging ? 'shadow-lg z-50 rotate-1 scale-[1.01]' : ''}`}
            onClick={(e) => {
              if (formulaMode?.isActive) return;
              e.stopPropagation();
              onSelect({ type: 'item', id: el.id, parentId });
            }}
            onDoubleClick={(e) => {
              if (formulaMode?.isActive || isReadOnly) return;
              e.stopPropagation();
              onEditItem?.(el);
            }}
            onMouseDown={(e) => {
              // En mode formule, on déclenche l'insertion via clic — sauf si c'est la ligne en cours d'édition
              // (sinon on créerait une référence circulaire et on perdrait le focus de l'input)
              if (formulaMode?.isActive && formulaMode.onInsert && formulaMode.sourceItemId !== el.id) {
                e.preventDefault();
                e.stopPropagation();
                formulaMode.onInsert(el.id);
              }
            }}
          >
            {/* Checkbox multi-sélection (colonne dédiée, séparée du drag handle) */}
            <div className="w-6 flex justify-center shrink-0">
              {!isReadOnly && onToggleMultiSelection && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleMultiSelection(el.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={isMultiSelected ? 'Désélectionner' : 'Sélectionner pour suppression'}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer
                    ${isMultiSelected
                      ? 'bg-red-500 border-red-500 text-white opacity-100'
                      : hasMultiSelection
                        ? 'bg-white border-slate-300 hover:border-red-400 opacity-100'
                        : 'bg-white border-slate-300 hover:border-red-400 opacity-0 group-hover:opacity-100'
                    }`}
                >
                  {isMultiSelected && <Check size={11} strokeWidth={3} />}
                </button>
              )}
            </div>

            <div
              {...provided.dragHandleProps}
              className={`w-8 flex justify-center shrink-0 p-1 ${
                isReadOnly ? 'opacity-0 pointer-events-none' : 'text-slate-300 hover:text-emerald-500 cursor-grab active:cursor-grabbing'
              }`}
            >
              {!isReadOnly && <GripVertical size={14} />}
            </div>

            {/* Numéro / Ref */}
            <div className="w-16 flex items-center justify-center gap-1 shrink-0">
              {priceIssue && (
                <span
                  title="Incohérence de numéro de prix : ce numéro porte un libellé / une unité différent ailleurs, ou cet article existe sous un autre numéro. Voir « Vérif. n° prix »."
                  className="shrink-0 text-amber-500"
                >
                  <AlertTriangle size={12} strokeWidth={2.2} />
                </span>
              )}
              {isRepeatedPrice && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRevealItem?.(nextDupId); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={dupTooltip}
                  className="shrink-0 text-violet-500 hover:text-violet-700 transition-colors cursor-pointer"
                >
                  <Link2 size={11} strokeWidth={2.5} />
                </button>
              )}
              {bpuConfig?.numberingMode === 'manual' ? (
                el.bpuNum ? (
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 rounded">{el.bpuNum}</span>
                ) : (
                  <div className="flex items-center justify-center w-5 h-5 bg-red-100 rounded text-red-500" title="Numéro manquant">
                    <AlertCircle size={12} />
                  </div>
                )
              ) : (
                <span
                  className={`text-[10px] font-mono font-bold ${isRepeatedPrice ? 'text-violet-600' : 'text-emerald-600'}`}
                  title={isRepeatedPrice ? dupTooltip : undefined}
                >
                  {refMap.get(String(el.uid)) || refMap.get(el.id) || 'P.--'}
                </span>
              )}
            </div>

            {/* Désignation */}
            <div className="flex-1 px-2 flex items-center gap-2 min-w-0" style={{ paddingLeft: `${level * 20 + 8}px` }}>
              {isFree && !isReadOnly ? (
                <>
                  <span
                    className="shrink-0 text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded"
                    title="Article libre (non lié à la bibliothèque BPU)"
                  >
                    Libre
                  </span>
                  <input
                    type="text"
                    value={localDesignation}
                    onChange={(e) => setLocalDesignation(e.target.value)}
                    onBlur={commitDesignation}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Désignation libre…"
                    className="flex-1 min-w-0 text-[11px] font-semibold text-slate-800 uppercase leading-tight bg-white border border-blue-300 focus:border-blue-500 rounded px-1.5 py-0.5 outline-none shadow-sm placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditItem?.(el); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Édition avancée (description, CCTP, forfait, enregistrer en bibliothèque)"
                    className="shrink-0 text-slate-300 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                </>
              ) : (
                <div className="text-[11px] font-semibold text-slate-700 uppercase leading-tight truncate">
                  {cleanText(el.designation)}
                </div>
              )}
            </div>

            {/* Indicateurs formule / source — colonne fixe alignée */}
            <div className="w-10 flex items-center justify-center gap-1 shrink-0">
              {hasFormula && (
                <span title={`Formule : ${renderFormulaReadable(currentFormula)}`} className="shrink-0 flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-600 cursor-help">
                  <FunctionSquare size={14} />
                </span>
              )}
              {isSource && (
                <span title={sourceTooltipText} className="shrink-0 w-3 h-3 rounded-full bg-blue-400 ring-2 ring-blue-100 cursor-help" />
              )}
            </div>

            {/* Unité */}
            <div className="w-16 flex justify-center shrink-0 px-1">
              {isFree && !isReadOnly ? (
                <input
                  type="text"
                  value={localUnit}
                  onChange={(e) => setLocalUnit(e.target.value)}
                  onBlur={commitUnit}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="U"
                  className="w-full text-center text-[9px] font-bold text-emerald-700 uppercase bg-white border border-emerald-300 focus:border-emerald-500 rounded px-1 py-0.5 outline-none shadow-sm placeholder:text-slate-300"
                />
              ) : (
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                  {normalizeUnitSymbol(el.unit)}
                </span>
              )}
            </div>

            {/* Quantité + FormulaInput */}
            <div className="relative w-24 px-2 shrink-0 flex flex-col justify-center">
              {/* Cadenas : fige la quantité (non majorée en mode rendu) */}
              {(isQtyLocked || (!isReadOnly && !isGlobalMode)) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isReadOnly) return;
                    onUpdate(parentId, el.id, 'qtyLocked', !isQtyLocked);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title={isQtyLocked
                    ? 'Quantité figée : non majorée en mode rendu (cliquer pour libérer)'
                    : 'Figer la quantité : ne sera pas majorée en mode rendu'}
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center transition-opacity
                    ${isQtyLocked
                      ? `opacity-100 ${viewMode === 'client' ? 'text-indigo-500' : 'text-slate-500'} ${isReadOnly ? 'cursor-default' : 'hover:text-slate-700'}`
                      : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-600'}`}
                >
                  {isQtyLocked ? <Lock size={11} strokeWidth={2.5} /> : <Unlock size={11} strokeWidth={2} />}
                </button>
              )}
              {showComparison && isReadOnly && diffQty !== 0 ? (
                <div className="text-right flex flex-col items-end leading-none">
                  <span className="text-xs font-black text-indigo-700">{qtyClient}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-medium text-slate-400 line-through decoration-slate-300">({qtyStudy})</span>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-0.5 rounded">{formatPercent(diffPercent)}</span>
                  </div>
                </div>
              ) : (
                <FormulaInput
                  value={displayedQty}
                  formula={currentFormula}
                  formulaMode={formulaMode}
                  setFormulaMode={setFormulaMode}
                  refMap={refMap}
                  sourceItemId={el.id}
                  onCommit={(val) => onUpdate(parentId, el.id, qtyFieldToUpdate, val)}
                  disabled={isReadOnly || isGlobalMode} 
                  className={`w-full border rounded py-0.5 px-1 text-right text-xs font-mono font-black outline-none transition-all
                    ${
                      isReadOnly
                        ? 'bg-transparent border-transparent text-slate-800'
                        : isGlobalMode
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                        : viewMode === 'client'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-300 focus:border-emerald-500 text-black shadow-sm'
                    }`}
                  placeholder=""
                />
              )}
            </div>

            {/* Prix */}
            <div className="w-32 px-2 shrink-0">
              <div className="relative flex items-center">
                <FormattedInput
                  value={localPrice}
                  onChange={(val) => setLocalPrice(val)}
                  onBlur={commitPrice}
                  onKeyDown={handlePriceKeyDown}
                  disabled={isReadOnly}
                  className={`w-full rounded py-0.5 px-1 pr-4 text-right text-xs font-mono font-bold outline-none transition-colors
                    ${
                      isReadOnly
                        ? 'bg-transparent border-transparent text-emerald-700'
                        : 'bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white text-emerald-700'
                    }`}
                />
                <span className="absolute right-1.5 text-[10px] text-emerald-300 font-black pointer-events-none">€</span>
              </div>
            </div>

            {/* Total ligne */}
            <div className="w-28 text-right px-3 shrink-0 flex flex-col justify-center items-end h-full">
              {showComparison && isReadOnly ? (
                <>
                  <span className="text-[11px] font-mono font-black text-slate-900">{isPM ? 'PM' : formatPrice(lineTotal)}</span>
                  {diffTotal > 0 && (
                    <span className="text-[9px] font-bold px-1 rounded-sm bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                      <ShieldCheck size={8} /> +{formatPrice(diffTotal)}
                    </span>
                  )}
                </>
              ) : (
                <span className={`text-[11px] font-mono font-black ${isPM ? 'italic text-slate-400 font-medium' : 'text-slate-900'}`}>
                  {isPM ? 'PM' : formatPrice(lineTotal)}
                </span>
              )}
            </div>

            {/* Spacer (suppression via multi-selection checkbox a gauche) */}
            <div className="w-10 shrink-0" />
          </div>
        )}
      </Draggable>
    );
  }
);

// --------------------
// SUBCHAPTER ROW
// --------------------

// Nombre d'articles descendants (tous niveaux) — affiché quand le sous-chapitre est replié.
const countTreeItems = (nodes) => {
  let n = 0;
  const walk = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(x => {
      if (!x) return;
      if (x.type === 'item') n++;
      else if (x.children) walk(x.children);
    });
  };
  walk(nodes);
  return n;
};

// Fond des sous-chapitres dégradé selon la profondeur : niveau 1 le plus sombre,
// puis de plus en plus clair — la hiérarchie se lit à la couleur.
const DEPTH_BG = [
  'bg-slate-200/70 border border-slate-300 shadow-sm',
  'bg-slate-100 border border-slate-200 shadow-sm',
  'bg-slate-50 border border-slate-200 shadow-sm',
];

const SubChapterRow = memo(({ el, index, parentId, level, isSelected, isReadOnly, viewMode, clientQtyMap, bpuConfig, onUpdate, onSelect, onModal, stableKey, activeTrancheId, isGlobalMode, insertTargetId, treeNumber, collapsed, onToggleCollapse }) => {
  const draggableId = `chapter:${stableKey}`;
  const total = sumNodeTotal(el, viewMode === 'client', clientQtyMap);
  const depthBg = DEPTH_BG[Math.min(level, DEPTH_BG.length - 1)];
  const nbLines = collapsed ? countTreeItems(el.children) : 0;

  // ── Bloc (ouvrage composite) : en-tête porteur d'une surface (Qté + unité) ──
  const isBloc = !!el.isBloc;
  const isTrancheView = activeTrancheId && activeTrancheId !== 'global';
  const surfaceVal = isTrancheView ? Number(el.quantities?.[activeTrancheId] || 0) : Number(el.qty || 0);
  const surfaceDisabled = isReadOnly || isGlobalMode;
  // Libellé de la quantité pilote selon l'unité du bloc (m²→surface, ml→longueur, m³→volume).
  const pilotLabel = (() => {
    const u = normalizeUnitSymbol(el.unit);
    if (u === 'ML') return 'longueur';
    if (u === 'M3') return 'volume';
    if (u === 'M2') return 'surface';
    return 'quantité';
  })();
  const [surfaceInput, setSurfaceInput] = useState(String(surfaceVal || ''));
  useEffect(() => { setSurfaceInput(surfaceVal ? String(surfaceVal) : ''); }, [surfaceVal]);
  const commitSurface = () => {
    const n = Number(String(surfaceInput).replace(',', '.')) || 0;
    if (n === surfaceVal) return;
    if (isTrancheView) onUpdate(parentId, el.id, 'qty_tranche', { trancheId: activeTrancheId, value: n, clearAllFormulas: true });
    else onUpdate(parentId, el.id, 'qty', n);
  };
  // PU moyen du bloc = Σ(prix composant × facteur) → prix dans l'unité du bloc.
  // Calculé depuis les facteurs mémorisés (stable même à surface nulle) ;
  // repli sur total/surface si les composants n'ont pas de facteur (anciens blocs).
  const blocPuMoyen = (() => {
    if (!isBloc) return 0;
    const children = el.children || [];
    const withFactor = children.filter(c => c && c.blocFactor != null);
    if (withFactor.length) return withFactor.reduce((s, c) => s + (Number(c.price) || 0) * (Number(c.blocFactor) || 0), 0);
    return surfaceVal > 0 ? total / surfaceVal : 0;
  })();

  return (
    <Draggable draggableId={draggableId} index={index} isDragDisabled={isReadOnly}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-subchapter-id={String(el.id)}
          className={`flex flex-col border-b border-slate-200 rounded-lg mb-2 mt-2 overflow-hidden transition-all ${
            snapshot.isDragging ? 'shadow-xl bg-white z-50' : ''
          } ${el.id === insertTargetId ? 'outline outline-2 outline-blue-500 -outline-offset-2' : 'outline-none'} ${el.isOption ? 'bg-slate-50 border-dashed border-slate-300' : depthBg}`}
        >
          {/* Droppable étendu : englobe header + enfants pour que hello-pangea-dnd détecte le sous-chapitre */}
          {/* comme cible dès le survol du header (items s'écartent + surbrillance native). */}
          <Droppable droppableId={String(el.id)} type="ITEM" isDropDisabled={isReadOnly}>
            {(providedDrop, snapshotDrop) => (
              <div
                ref={providedDrop.innerRef}
                {...providedDrop.droppableProps}
                className={`flex flex-col transition-colors ${
                  snapshotDrop.isDraggingOver ? 'ring-2 ring-emerald-300 bg-emerald-50/40' : ''
                }`}
              >
                <div
                  className={`flex items-center py-2 ${isSelected ? 'bg-emerald-100' : 'hover:bg-black/5'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ type: 'subchapter', id: el.id });
                  }}
                >
                  {/* Corbeille a gauche (aligne avec la checkbox des items) */}
                  <div className="w-6 flex justify-center shrink-0">
                    {!isReadOnly && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onModal({ show: true, target: { type: 'subchapter', id: el.id, parentId } }); }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Supprimer le sous-chapitre"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div
                    {...provided.dragHandleProps}
                    className={`w-8 flex justify-center shrink-0 p-1 ${isReadOnly ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-emerald-600 cursor-grab active:cursor-grabbing'}`}
                  >
                    {!isReadOnly && <GripVertical size={14} />}
                  </div>

                  <div className="w-16 text-[10px] font-mono font-black text-slate-600 shrink-0 text-center tracking-tight" title="Numéro hiérarchique">{treeNumber || '-'}</div>

                  <div className="flex-1 px-2 flex items-center gap-2" style={{ paddingLeft: `${level * 20 + 8}px` }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(el.id); }}
                      className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-800 hover:bg-black/10 transition-colors"
                      title={collapsed ? 'Déplier le sous-chapitre' : 'Replier le sous-chapitre'}
                    >
                      {collapsed ? <ChevronRight size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
                    </button>
                    {isBloc
                      ? <Boxes size={14} className="shrink-0 text-indigo-600" />
                      : <Layers size={14} className={`shrink-0 ${el.isOption ? 'text-slate-400' : 'text-emerald-600'}`} />}
                    <EditableTitle
                      value={el.title}
                      onSave={(val) => onUpdate(parentId, el.id, 'title', val)}
                      disabled={isReadOnly}
                      className="text-[11px] font-black uppercase text-slate-800 tracking-wider truncate hover:bg-white/50 px-1 rounded"
                    />
                    {isBloc && (
                      <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">Bloc</span>
                    )}
                    <OptionToggle
                      isOption={!!el.isOption}
                      onClick={() => onUpdate(parentId, el.id, 'isOption', !el.isOption)}
                      disabled={isReadOnly}
                    />
                    {collapsed && (
                      <span className="shrink-0 text-[9px] font-bold text-slate-500 bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded-full">
                        {nbLines} ligne{nbLines > 1 ? 's' : ''}
                      </span>
                    )}
                    {!isReadOnly && el.id === insertTargetId && (
                      <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[8px] font-black uppercase tracking-wider shadow-sm" title="Les nouveaux articles (libre ou bibliothèque) seront insérés dans ce sous-chapitre">
                        <Target size={9} /> Insertion ici
                      </span>
                    )}
                  </div>

                  {isBloc ? (
                    <>
                      {/* Colonnes alignées sur la grille article : (indic) · unité · surface · PU moyen · total */}
                      <div className="w-10 shrink-0" />
                      <div className="w-16 flex justify-center shrink-0">
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{normalizeUnitSymbol(el.unit)}</span>
                      </div>
                      <div
                        className="w-24 px-2 shrink-0 flex items-center"
                        onClick={(e) => e.stopPropagation()}
                        title={isGlobalMode ? `Sélectionnez une tranche pour saisir la ${pilotLabel}` : `${pilotLabel.charAt(0).toUpperCase()}${pilotLabel.slice(1)} du bloc — pilote les quantités des composants`}
                      >
                        <input
                          type="text"
                          inputMode="decimal"
                          value={surfaceInput}
                          disabled={surfaceDisabled}
                          onChange={(e) => setSurfaceInput(e.target.value)}
                          onBlur={commitSurface}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          placeholder={pilotLabel}
                          className={`w-full text-right text-xs font-mono font-black rounded py-0.5 px-1.5 outline-none transition-colors border ${
                            surfaceDisabled
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-white border-indigo-300 focus:border-indigo-500 text-indigo-800 shadow-sm'
                          }`}
                        />
                      </div>
                      <div className="w-32 px-2 shrink-0 text-right leading-none" title="PU moyen du bloc (Σ prix × facteur)">
                        <span className="text-[11px] font-mono font-black text-indigo-700">{formatPrice(blocPuMoyen)}</span>
                        <span className="block text-[8px] font-bold text-indigo-400 uppercase tracking-tight">/{normalizeUnitSymbol(el.unit)} moy.</span>
                      </div>
                      <div className={`w-28 text-right px-3 text-[11px] font-mono font-black ${el.isOption ? 'text-slate-500 line-through' : 'text-indigo-800'}`}>
                        {formatPrice(total)}
                      </div>
                      <div className="w-10 shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className={`w-28 text-right px-3 text-[11px] font-mono font-black ${el.isOption ? 'text-slate-500 line-through' : 'text-emerald-800'}`}>
                        {formatPrice(total)}
                      </div>
                      <div className="w-10 shrink-0">{null}</div>
                    </>
                  )}
                </div>

                {collapsed ? (
                  <div className="ml-4">{providedDrop.placeholder}</div>
                ) : (
                  <div className={`pl-4 border-l ml-4 min-h-[40px] ${el.isOption ? 'border-slate-300 opacity-70' : 'border-slate-300'}`}>
                    <ItemList items={el.children} parentId={el.id} level={level + 1} bpuConfig={bpuConfig} parentNumber={treeNumber} />
                    {providedDrop.placeholder}
                    {(!el.children || el.children.length === 0) && (
                      <div className={snapshotDrop.isDraggingOver ? 'h-8 flex items-center text-[9px] italic pl-2 text-emerald-500 font-semibold' : 'h-8 flex items-center text-[9px] italic pl-2 text-slate-400'}>
                        {snapshotDrop.isDraggingOver ? 'Déposer ici ↓' : (!isReadOnly ? 'Glisser ici...': '')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
});

// --------------------
// ITEMLIST (ORCHESTRATEUR)
// --------------------
const ItemList = ({ items, parentId, level = 0, bpuConfig, parentNumber = '' }) => {
  const {
    selection, setSelection, updateProjectItem, setModal, addSubChapter,
    refMap, viewMode, showComparison, clientQtyMap, isGlobalMode,
    formulaMode, setFormulaMode, activeTrancheId, sourceIds, allItems,
    onEditItem,
    multiSelection, toggleMultiSelection,
    priceIssueIds,
    insertTargetId,
    collapsedIds, toggleCollapsed,
    duplicateIndex, revealAndFlashItem,
  } = useContext(ProjectContext);

  const hasMultiSelection = multiSelection && multiSelection.size > 0;

  if (!items || !Array.isArray(items)) return null;

  const isReadOnly = viewMode === 'client';

  const seen = new Map();
  const makeStableKey = (id, index) => {
    const base = String(id ?? `missing_id_${index}`);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}__dup${count}`;
  };

  // Numérotation hiérarchique : seuls les sous-chapitres comptent (les articles
  // gardent leur référence P.x). Chapitre « 2 » → sous-chapitres « 2.1 », « 2.2 »…
  let subCounter = 0;

  return items.map((el, index) => {
    if (!el) return null;
    const stableKey = makeStableKey(el.id, index);
    const isSelected = selection?.id === el.id;

    if (el.type === 'item') {
      return (
        <ItemRow
          key={stableKey}
          stableKey={stableKey}
          el={el}
          index={index}
          parentId={parentId}
          level={level}
          isSelected={isSelected}
          isReadOnly={isReadOnly}
          isGlobalMode={isGlobalMode}
          viewMode={viewMode}
          showComparison={showComparison}
          clientQtyMap={clientQtyMap}
          refMap={refMap}
          bpuConfig={bpuConfig}
          onUpdate={updateProjectItem}
          onSelect={setSelection}
          onModal={setModal}
          formulaMode={formulaMode}
          setFormulaMode={setFormulaMode}
          activeTrancheId={activeTrancheId}
          sourceIds={sourceIds}
          allItems={allItems}
          onEditItem={onEditItem}
          isMultiSelected={multiSelection?.has(el.id) || false}
          hasMultiSelection={hasMultiSelection}
          onToggleMultiSelection={toggleMultiSelection}
          priceIssue={priceIssueIds?.has(el.id) || false}
          dupInfo={duplicateIndex?.get(el.id) || null}
          onRevealItem={revealAndFlashItem}
        />
      );
    }

    subCounter += 1;
    // Mode hiérarchique : le numéro vient du refMap (séquence partagée avec les articles,
    // alignée sur la numérotation DQE). Sinon : compteur local de sous-chapitres.
    const localNumber = parentNumber ? `${parentNumber}.${subCounter}` : String(subCounter);
    const treeNumber = bpuConfig?.numberingMode === 'hierarchical'
      ? (refMap.get(el.id) || localNumber)
      : localNumber;

    return (
      <SubChapterRow
        key={stableKey}
        stableKey={stableKey}
        el={el}
        index={index}
        parentId={parentId}
        level={level}
        isSelected={isSelected}
        isReadOnly={isReadOnly}
        viewMode={viewMode}
        clientQtyMap={clientQtyMap}
        bpuConfig={bpuConfig}
        onUpdate={updateProjectItem}
        onSelect={setSelection}
        onModal={setModal}
        onAddSub={addSubChapter}
        activeTrancheId={activeTrancheId}
        isGlobalMode={isGlobalMode}
        insertTargetId={insertTargetId}
        treeNumber={treeNumber}
        collapsed={collapsedIds?.has(el.id) || false}
        onToggleCollapse={toggleCollapsed}
      />
    );
  });
};

export default ItemList;