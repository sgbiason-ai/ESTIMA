// src/components/ItemList.jsx
import React, { useContext, memo, useEffect, useRef, useState, useCallback } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd'; 
import { GripVertical, Layers, Trash2, Plus, ShieldCheck, AlertCircle, FunctionSquare, Check } from 'lucide-react';

import { ProjectContext } from '../context/ProjectContext';
import { EditableTitle, FormattedInput, OptionToggle } from './ProjectUI';
import { formatPrice, cleanText, normalizeUnitSymbol } from '../utils/helpers';
import { safeEvalMathExpr } from '../utils/projectCalculations';

// --------------------
// FORMULA INPUT — calculatrice PM + formules style Excel
// --------------------
const FormulaInput = ({ value, formula, formulaMode, setFormulaMode, onCommit, disabled, className, placeholder }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef(null);
  const inputValueRef = useRef(String(value));
  const savedCursorPos = useRef(null); // Position curseur sauvegardée avant blur

  useEffect(() => {
    if (!isEditing) {
      setInputValue(value);
      inputValueRef.current = String(value);
    }
  }, [value, isEditing]);

  // --- Insertion d'une référence à la position du curseur ---
  const handleInsertRef = useCallback((refId) => {
    const ref = `{${refId}}`;
    const currentVal = inputValueRef.current;
    // On préfère la position sauvegardée (avant que le focus parte vers l'autre ligne)
    const pos = savedCursorPos.current ?? currentVal.length;
    const newVal = currentVal.substring(0, pos) + ref + currentVal.substring(pos);

    setInputValue(newVal);
    inputValueRef.current = newVal;
    savedCursorPos.current = pos + ref.length; // curseur après la ref
    setFormulaMode({ isActive: true, onInsert: handleInsertRef });

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(savedCursorPos.current, savedCursorPos.current);
      }
    }, 0);
  }, []); // eslint-disable-line

  // --- Focus ---
  const handleFocus = () => {
    if (disabled) return;
    setIsEditing(true);
    // Si on est déjà en mode formule (ex: on vient d'insérer une ref via clic),
    // on ne réinitialise PAS l'input — la formule en cours doit être conservée.
    if (formulaMode?.isActive) return;
    const displayVal = formula ? formula : (Number(value) === 0 ? '' : String(value));
    setInputValue(displayVal);
    inputValueRef.current = displayVal;
    if (displayVal.startsWith('=')) {
      setFormulaMode({ isActive: true, onInsert: handleInsertRef });
    }
  };

  // --- Changement ---
  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    inputValueRef.current = val;
    if (val.startsWith('=')) {
      setFormulaMode({ isActive: true, onInsert: handleInsertRef });
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
      onCommit(textVal);
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
        title={hasFormula ? formula : undefined}
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
    onModal,
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
  }) => {
    const draggableId = `item:${stableKey}`;

    const qtyStudy = el.studyQty !== undefined ? Number(el.studyQty) : Number(el.qty || 0);
    const qtyClient = clientQtyMap?.has(String(el.id)) 
        ? Number(clientQtyMap.get(String(el.id)) || 0) 
        : qtyStudy;

    const displayedQty = viewMode === 'client' ? qtyClient : qtyStudy;
    const qtyFieldToUpdate = 'qty';

    const currentFormula = (activeTrancheId && activeTrancheId !== 'global') 
        ? el.quantitiesFormula?.[activeTrancheId] 
        : el.formula;

    const hasFormula = !!(currentFormula && currentFormula.startsWith('='));
    const isSource = sourceIds?.includes(el.id);

    const [localPrice, setLocalPrice] = useState(el.price);
    useEffect(() => setLocalPrice(el.price), [el.price]);

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
            className={`group flex items-center border-b border-slate-100 py-1 outline-none transition-colors
              ${isMultiSelected ? 'bg-red-50/60 ring-1 ring-inset ring-red-200' : isSelected ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : 'bg-white'}
              ${hasFormula && !isSelected && !isMultiSelected ? 'bg-emerald-50/30' : ''}
              ${isSource && !isSelected && !isMultiSelected ? 'bg-blue-50/30' : ''}
              ${formulaMode?.isActive ? 'cursor-crosshair hover:bg-amber-50 hover:ring-1 hover:ring-inset hover:ring-amber-300' : 'cursor-default hover:bg-emerald-50'}
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
              if (formulaMode?.isActive && formulaMode.onInsert) {
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
            <div className="w-16 flex items-center justify-center shrink-0">
              {bpuConfig?.numberingMode === 'manual' ? (
                el.bpuNum ? (
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 rounded">{el.bpuNum}</span>
                ) : (
                  <div className="flex items-center justify-center w-5 h-5 bg-red-100 rounded text-red-500" title="Numéro manquant">
                    <AlertCircle size={12} />
                  </div>
                )
              ) : (
                <span className="text-[10px] font-mono font-bold text-emerald-600">
                  {refMap.get(String(el.uid)) || refMap.get(el.id) || 'P.--'}
                </span>
              )}
            </div>

            {/* Désignation */}
            <div className="flex-1 px-2 flex items-center min-w-0" style={{ paddingLeft: `${level * 20 + 8}px` }}>
              <div className="text-[11px] font-semibold text-slate-700 uppercase leading-tight truncate">
                {cleanText(el.designation)}
              </div>
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
            <div className="w-16 flex justify-center shrink-0">
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                {normalizeUnitSymbol(el.unit)}
              </span>
            </div>

            {/* Quantité + FormulaInput */}
            <div className="w-24 px-2 shrink-0 flex flex-col justify-center">
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
                  isPrice={true}
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
const SubChapterRow = memo(({ el, index, parentId, level, isSelected, isReadOnly, viewMode, clientQtyMap, bpuConfig, onUpdate, onSelect, onModal, onAddSub, stableKey }) => {
  const draggableId = `chapter:${stableKey}`;
  const total = sumNodeTotal(el, viewMode === 'client', clientQtyMap);

  return (
    <Draggable draggableId={draggableId} index={index} isDragDisabled={isReadOnly}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-subchapter-id={String(el.id)}
          className={`flex flex-col border-b border-slate-200 rounded-lg mb-2 mt-2 overflow-hidden transition-all outline-none ${
            snapshot.isDragging ? 'shadow-xl bg-white z-50' : ''
          } ${el.isOption ? 'bg-slate-50 border-dashed border-slate-300' : 'bg-slate-100 border border-slate-200 shadow-sm'}`}
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

                  <div className="w-16 text-[10px] font-mono font-black text-slate-500 shrink-0 text-center">-</div>

                  <div className="flex-1 px-2 flex items-center gap-2" style={{ paddingLeft: `${level * 20 + 8}px` }}>
                    <Layers size={14} className={`shrink-0 ${el.isOption ? 'text-slate-400' : 'text-emerald-600'}`} />
                    <EditableTitle
                      value={el.title}
                      onSave={(val) => onUpdate(parentId, el.id, 'title', val)}
                      disabled={isReadOnly}
                      className="text-[11px] font-black uppercase text-slate-800 tracking-wider truncate hover:bg-white/50 px-1 rounded"
                    />
                    <OptionToggle
                      isOption={!!el.isOption}
                      onClick={() => onUpdate(parentId, el.id, 'isOption', !el.isOption)}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className={`w-28 text-right px-3 text-[11px] font-mono font-black ${el.isOption ? 'text-slate-500 line-through' : 'text-emerald-800'}`}>
                    {formatPrice(total)}
                  </div>

                  {/* Spacer (corbeille deplacee a gauche) */}
                  <div className="w-10 shrink-0">
                    {null}
                  </div>
                </div>

                <div className={`pl-4 border-l ml-4 min-h-[40px] ${el.isOption ? 'border-slate-300 opacity-70' : 'border-slate-300'}`}>
                  <ItemList items={el.children} parentId={el.id} level={level + 1} bpuConfig={bpuConfig} />
                  {providedDrop.placeholder}
                  {(!el.children || el.children.length === 0) && (
                    <div className={snapshotDrop.isDraggingOver ? 'h-8 flex items-center text-[9px] italic pl-2 text-emerald-500 font-semibold' : 'h-8 flex items-center text-[9px] italic pl-2 text-slate-400'}>
                      {snapshotDrop.isDraggingOver ? 'Déposer ici ↓' : (!isReadOnly ? 'Glisser ici...': '')}
                    </div>
                  )}
                </div>
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
const ItemList = ({ items, parentId, level = 0, bpuConfig }) => {
  const {
    selection, setSelection, updateProjectItem, setModal, addSubChapter,
    refMap, viewMode, showComparison, clientQtyMap, isGlobalMode,
    formulaMode, setFormulaMode, activeTrancheId, sourceIds, allItems,
    onEditItem,
    multiSelection, toggleMultiSelection,
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
        />
      );
    }

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
      />
    );
  });
};

export default ItemList;