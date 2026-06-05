// src/views/estimRapide/EstimRapideEditor.jsx
// Éditeur d'une estimation rapide — grands lots VRD + postes, look ESTIMA
// (lignes plates, accent émeraude, chiffres mono) + barre de formule type Excel
// sur les quantités (références [Désignation]).
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Layers, Building2, MapPin,
  Percent, Eye, EyeOff, FunctionSquare, Check, X,
} from 'lucide-react';
import { formatPrice, generateId } from '../../utils/helpers';
import { lotSubtotal, lotHasValues, buildSummary } from '../../utils/estimRapideCalc';
import { BASE_LOTS, UNITS, buildLot } from '../../data/estimRapideTemplates';
import {
  isFormula, normalizeFormula, buildRefIndex,
  formulaToDisplay, displayToFormula, resolveEstimate,
} from '../../utils/estimRapideFormula';

const toNum = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
const numDisplay = (v) => (v === 0 || v === '0' || v === '' || v == null ? '' : v);
const roundQty = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);

export default function EstimRapideEditor({ draft, onChange }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showAddLot, setShowAddLot] = useState(false);
  const [editing, setEditing] = useState(null); // { lotId, posteId, display }

  const sessionMapRef = useRef(new Map()); // label → id (clics de la session d'édition)
  const activeFieldRef = useRef(null);     // input focalisé (cellule ou barre)
  const pendingCaretRef = useRef(null);

  const refIndex = useMemo(() => buildRefIndex(draft), [draft]);
  const resolved = useMemo(() => resolveEstimate(draft).estimate, [draft]);
  const resolvedQtyById = useMemo(() => {
    const m = {};
    (resolved?.lots || []).forEach(l => (l.postes || []).forEach(p => { m[p.id] = p.qty; }));
    return m;
  }, [resolved]);
  const ordinalById = useMemo(() => {
    const m = {};
    refIndex.flat.forEach(({ poste, ordinal }) => { m[poste.id] = ordinal; });
    return m;
  }, [refIndex]);
  const summary = useMemo(() => buildSummary(resolved), [resolved]);

  // Réécrit les quantités résolues dans le draft (persistance + dirty cohérents)
  useEffect(() => {
    const { estimate, changed } = resolveEstimate(draft);
    if (changed) onChange(() => estimate);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restaure le curseur après insertion d'une référence
  useLayoutEffect(() => {
    if (pendingCaretRef.current != null && activeFieldRef.current) {
      const pos = pendingCaretRef.current;
      activeFieldRef.current.focus();
      activeFieldRef.current.setSelectionRange(pos, pos);
      pendingCaretRef.current = null;
    }
  });

  // ── Mutateurs immuables ──
  const patchLot = (lotId, producer) => onChange(prev => ({
    ...prev, lots: (prev.lots || []).map(l => (l.id === lotId ? producer(l) : l)),
  }));
  const setMeta = (field, value) => onChange(prev => ({ ...prev, [field]: value }));
  const setLotLabel = (lotId, label) => patchLot(lotId, l => ({ ...l, label }));
  const patchPoste = (lotId, posteId, patch) => patchLot(lotId, l => ({
    ...l, postes: (l.postes || []).map(p => (p.id === posteId ? { ...p, ...patch } : p)),
  }));
  const setPosteField = (lotId, posteId, field, value) => patchPoste(lotId, posteId, { [field]: value });
  const addPoste = (lotId) => patchLot(lotId, l => ({
    ...l, postes: [...(l.postes || []), { id: generateId(), label: '', unit: 'u', qty: 0, ratio: 0 }],
  }));
  const removePoste = (lotId, posteId) => patchLot(lotId, l => ({
    ...l, postes: (l.postes || []).filter(p => p.id !== posteId),
  }));
  const removeLot = (lotId) => onChange(prev => ({ ...prev, lots: (prev.lots || []).filter(l => l.id !== lotId) }));

  const addLotFromCatalog = (key) => {
    const lot = key === '__custom__'
      ? { id: generateId(), key: 'custom', label: 'Nouveau lot', postes: [{ id: generateId(), label: '', unit: 'u', qty: 0, ratio: 0 }] }
      : buildLot(key);
    if (lot) onChange(prev => ({ ...prev, lots: [...(prev.lots || []), lot] }));
    setShowAddLot(false);
  };

  const toggleAleas = () => onChange(prev => ({ ...prev, aleas: { ...(prev.aleas || { percent: 10 }), enabled: !prev.aleas?.enabled } }));
  const setAleasPercent = (value) => onChange(prev => ({ ...prev, aleas: { ...(prev.aleas || { enabled: true }), percent: value } }));
  const toggleCollapse = (lotId) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(lotId)) next.delete(lotId); else next.add(lotId);
    return next;
  });

  // ── Édition de quantité / formule ──
  const beginEdit = (lotId, poste, inputEl) => {
    activeFieldRef.current = inputEl;
    if (editing?.posteId === poste.id) return; // déjà en édition (bascule cellule ↔ barre)
    const display = isFormula(poste.formula)
      ? formulaToDisplay(poste.formula, refIndex.idToLabel)
      : String(numDisplay(poste.qty));
    sessionMapRef.current = new Map();
    if (isFormula(poste.formula)) {
      (poste.formula.match(/\{([^}]+)\}/g) || []).forEach(tok => {
        const id = tok.slice(1, -1);
        const label = refIndex.idToLabel.get(id);
        if (label) sessionMapRef.current.set(label, id);
      });
    }
    setEditing({ lotId, posteId: poste.id, display });
  };

  const changeEdit = (value) => {
    setEditing(e => (e ? { ...e, display: value } : e));
    if (editing && !isFormula(value)) {
      patchPoste(editing.lotId, editing.posteId, { qty: value, formula: undefined });
    }
  };

  const insertRef = (poste) => {
    if (!editing || poste.id === editing.posteId) return;
    const label = refIndex.idToLabel.get(poste.id);
    if (!label) return;
    let cur = editing.display || '=';
    if (!cur.startsWith('=')) cur = `=${cur}`;
    const field = activeFieldRef.current;
    let start = cur.length, end = cur.length;
    if (field && typeof field.selectionStart === 'number' && field.value === editing.display) {
      start = field.selectionStart; end = field.selectionEnd;
    }
    const token = `[${label}]`;
    const next = cur.slice(0, start) + token + cur.slice(end);
    sessionMapRef.current.set(label, poste.id);
    pendingCaretRef.current = start + token.length;
    setEditing(e => (e ? { ...e, display: next } : e));
  };

  const commitEdit = () => {
    if (!editing) return;
    const { lotId, posteId, display } = editing;
    if (isFormula(display)) {
      const raw = displayToFormula(normalizeFormula(display), refIndex.nameToId, sessionMapRef.current);
      patchPoste(lotId, posteId, { formula: raw });
    } else {
      patchPoste(lotId, posteId, { qty: display, formula: undefined });
    }
    setEditing(null);
    sessionMapRef.current = new Map();
  };

  const cancelEdit = () => { setEditing(null); sessionMapRef.current = new Map(); };

  const handleFieldFocus = (e) => { activeFieldRef.current = e.target; };
  const handleFieldBlur = (e) => {
    if (e.relatedTarget?.dataset?.formulaField) { activeFieldRef.current = e.relatedTarget; return; }
    commitEdit();
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  if (!draft) return null;

  const presentKeys = new Set((resolved.lots || []).map(l => l.key));
  const availableLots = BASE_LOTS.filter(l => !presentKeys.has(l.key));
  const visibleLots = (resolved.lots || []).filter(l => !hideEmpty || lotHasValues(l));
  const insertActive = editing && isFormula(editing.display);
  const editingPoste = editing ? refIndex.flat.find(f => f.poste.id === editing.posteId) : null;
  const aleasOn = !!draft.aleas?.enabled;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc]">

      {/* ── Barre de stats ── */}
      <div className="bg-slate-900 text-white px-6 py-2 flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2"><span className="text-slate-500">Total HT:</span><span className="text-emerald-400 font-mono text-xs">{formatPrice(summary.totalHT)}</span></div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-2"><span className="text-slate-500">Lots:</span><span className="text-slate-200 font-mono text-xs">{(resolved.lots || []).length}</span></div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-2"><span className="text-slate-500">Postes:</span><span className="text-slate-200 font-mono text-xs">{refIndex.flat.length}</span></div>
        {aleasOn && (<><div className="h-3 w-px bg-slate-700" /><div className="flex items-center gap-2"><span className="text-slate-500">Aléas:</span><span className="text-amber-400 font-mono text-xs">+{toNum(draft.aleas.percent)}%</span></div></>)}
      </div>

      {/* ── Barre de formule ── */}
      {insertActive && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 flex items-center gap-2 shrink-0">
          <FunctionSquare size={16} className="text-emerald-500 shrink-0" />
          <span className="text-[11px] font-bold text-emerald-700 shrink-0 max-w-[160px] truncate" title={editingPoste?.label}>{editingPoste?.label || 'Quantité'}</span>
          <input
            data-formula-field="1" type="text" value={editing.display}
            onChange={(e) => changeEdit(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-white border border-emerald-200 rounded px-2.5 py-1 text-[13px] font-mono text-slate-900 outline-none focus:border-emerald-400"
          />
          <span className="text-[10px] text-emerald-500 hidden md:block shrink-0">Cliquez un poste pour insérer sa référence</span>
          <button onMouseDown={(e) => { e.preventDefault(); commitEdit(); }} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded shrink-0" title="Valider (Entrée)"><Check size={16} /></button>
          <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded shrink-0" title="Annuler (Échap)"><X size={16} /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Méta ── */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <input
              value={draft.name || ''} onChange={(e) => setMeta('name', e.target.value)} placeholder="Nom de l'estimation"
              className="w-full text-xl font-bold text-slate-900 placeholder-slate-300 outline-none bg-transparent mb-4"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Building2 size={15} className="text-slate-400 shrink-0" />
                <input value={draft.client || ''} onChange={(e) => setMeta('client', e.target.value)} placeholder="Client / maître d'ouvrage"
                  className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
              </label>
              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <MapPin size={15} className="text-slate-400 shrink-0" />
                <input value={draft.location || ''} onChange={(e) => setMeta('location', e.target.value)} placeholder="Lieu / commune"
                  className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
              </label>
            </div>
          </div>

          {/* ── Toolbar lots ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <Layers size={16} />
              <span className="text-[11px] font-bold uppercase tracking-widest">{(resolved.lots || []).length} grands lots</span>
            </div>
            <button onClick={() => setHideEmpty(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition">
              {hideEmpty ? <Eye size={13} /> : <EyeOff size={13} />}
              {hideEmpty ? 'Afficher lots vides' : 'Masquer lots vides'}
            </button>
          </div>

          {/* ── Lots ── */}
          <div className="space-y-4">
            {visibleLots.map((lot, idx) => {
              const sub = lotSubtotal(lot);
              const isCollapsed = collapsed.has(lot.id);
              return (
                <div key={lot.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-900 text-white p-3 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button onClick={() => toggleCollapse(lot.id)} className="text-white/50 hover:text-white shrink-0">
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <span className="w-6 h-6 rounded bg-white/15 flex items-center justify-center font-mono text-[10px] font-black shrink-0">{idx + 1}</span>
                      <input value={lot.label || ''} onChange={(e) => setLotLabel(lot.id, e.target.value)}
                        className="font-black uppercase tracking-wider text-[12px] bg-transparent outline-none hover:bg-white/10 focus:bg-white/10 rounded px-1.5 py-0.5 min-w-0 flex-1" />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-black text-xs px-3 py-1 rounded-full bg-black/25">{formatPrice(sub)}</span>
                      <button onClick={() => removeLot(lot.id)} className="text-white/40 hover:text-red-300 transition" title="Supprimer le lot"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="px-3 pb-3 pt-1">
                      {/* en-tête colonnes */}
                      <div className="flex items-center px-1 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                        <span className="w-10 text-center">N°</span>
                        <span className="flex-1 px-1.5">Désignation</span>
                        <span className="w-7" />
                        <span className="w-16 text-center">Unité</span>
                        <span className="w-24 text-right pr-1">Quantité</span>
                        <span className="w-28 text-right pr-1">P.U.</span>
                        <span className="w-24 text-right pr-1">Montant</span>
                        <span className="w-7" />
                      </div>

                      {(lot.postes || []).map(poste => {
                        const isEditingThis = editing?.posteId === poste.id;
                        const isInsertTarget = insertActive && !isEditingThis;
                        const hasFormula = isFormula(poste.formula);
                        const montant = toNum(resolvedQtyById[poste.id]) * toNum(poste.ratio);
                        const cellValue = isEditingThis ? editing.display : String(numDisplay(roundQty(resolvedQtyById[poste.id])));
                        const isPM = montant === 0;
                        return (
                          <div key={poste.id}
                            className={`group flex items-center border-b border-slate-100 py-1 transition-colors
                              ${hasFormula && !isInsertTarget ? 'bg-emerald-50/30' : ''}
                              ${isInsertTarget ? 'cursor-crosshair hover:bg-amber-50 hover:ring-1 hover:ring-inset hover:ring-amber-300' : ''}`}
                            onMouseDown={isInsertTarget ? (e) => { e.preventDefault(); insertRef(poste); } : undefined}
                            title={isInsertTarget ? 'Insérer la référence de ce poste' : undefined}>
                            {/* N° réf */}
                            <span className="w-10 text-center text-[10px] font-mono font-bold text-emerald-600 shrink-0">P{ordinalById[poste.id]}</span>
                            {/* Désignation */}
                            <div className="flex-1 px-1 min-w-0">
                              <input value={poste.label || ''} onChange={(e) => setPosteField(lot.id, poste.id, 'label', e.target.value)}
                                placeholder="Désignation du poste" tabIndex={isInsertTarget ? -1 : 0}
                                className="w-full bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent focus:border-emerald-300 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 uppercase placeholder-slate-300 outline-none transition" />
                            </div>
                            {/* Indicateur formule */}
                            <div className="w-7 flex justify-center shrink-0">
                              {hasFormula && (
                                <span className="flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-600" title="Quantité calculée par formule">
                                  <FunctionSquare size={13} />
                                </span>
                              )}
                            </div>
                            {/* Unité */}
                            <div className="w-16 flex justify-center shrink-0">
                              <select value={poste.unit || 'u'} onChange={(e) => setPosteField(lot.id, poste.id, 'unit', e.target.value)} tabIndex={isInsertTarget ? -1 : 0}
                                className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1 py-1 uppercase text-center cursor-pointer outline-none focus:border-emerald-400">
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            {/* Quantité (formule type Excel) */}
                            <div className="w-24 px-1 shrink-0 relative">
                              {hasFormula && !isEditingThis && (
                                <FunctionSquare size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                              )}
                              <input
                                data-formula-field={isEditingThis && isFormula(editing.display) ? '1' : undefined}
                                type="text" inputMode="decimal" value={cellValue} placeholder="0" tabIndex={isInsertTarget ? -1 : 0}
                                onFocus={(e) => beginEdit(lot.id, poste, e.target)} onChange={(e) => changeEdit(e.target.value)}
                                onBlur={handleFieldBlur} onKeyDown={handleKeyDown}
                                className={`w-full border rounded py-0.5 text-right text-xs font-mono font-black outline-none transition
                                  ${hasFormula && !isEditingThis
                                    ? 'pl-5 pr-1 bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'px-1 bg-white border-slate-300 focus:border-emerald-500 text-black shadow-sm'}`}
                              />
                            </div>
                            {/* P.U. */}
                            <div className="w-28 px-1 shrink-0 relative flex items-center">
                              <input type="number" inputMode="decimal" value={numDisplay(poste.ratio)} placeholder="0" tabIndex={isInsertTarget ? -1 : 0}
                                onChange={(e) => setPosteField(lot.id, poste.id, 'ratio', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded py-0.5 pl-1 pr-4 text-right text-xs font-mono font-bold text-emerald-700 outline-none focus:border-emerald-500 focus:bg-white transition" />
                              <span className="absolute right-2 text-[10px] text-emerald-300 font-black pointer-events-none">€</span>
                            </div>
                            {/* Montant */}
                            <span className={`w-24 text-right px-1 text-[11px] font-mono font-black shrink-0 ${isPM ? 'italic text-slate-400 font-medium' : 'text-slate-900'}`}>
                              {isPM ? 'PM' : formatPrice(montant)}
                            </span>
                            {/* Suppression */}
                            <div className="w-7 flex justify-center shrink-0">
                              <button onClick={() => removePoste(lot.id, poste.id)} className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Supprimer le poste"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                      {(!lot.postes || lot.postes.length === 0) && (
                        <p className="text-center text-[10px] text-slate-400 py-4 uppercase tracking-widest font-bold">Lot vide</p>
                      )}
                      <button onClick={() => addPoste(lot.id)}
                        className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition">
                        <Plus size={14} /> Ajouter un poste
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {visibleLots.length === 0 && (
              <div className="text-center text-slate-400 py-12 bg-white border border-dashed border-slate-300 rounded-xl">
                <Layers size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">{hideEmpty ? 'Tous les lots sont vides' : 'Aucun lot'}</p>
              </div>
            )}
          </div>

          {/* ── Ajouter un lot ── */}
          <div className="relative">
            <button onClick={() => setShowAddLot(v => !v)}
              className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-sm hover:shadow transition">
              <Plus size={16} className="text-emerald-500" /> Ajouter un grand lot
            </button>
            {showAddLot && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddLot(false)} />
                <div className="absolute z-20 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 max-h-80 overflow-y-auto">
                  {availableLots.map(l => (
                    <button key={l.key} onClick={() => addLotFromCatalog(l.key)}
                      className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                      {l.label}
                    </button>
                  ))}
                  {availableLots.length === 0 && <p className="px-4 py-2 text-[11px] text-slate-400 italic">Tous les lots VRD sont déjà présents</p>}
                  <div className="border-t border-slate-100 my-1" />
                  <button onClick={() => addLotFromCatalog('__custom__')}
                    className="w-full text-left px-4 py-2 text-[13px] font-medium text-slate-900 hover:bg-slate-50 transition flex items-center gap-2">
                    <Plus size={13} /> Lot personnalisé
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Carte total ── */}
          <div className="flex justify-end mt-8 mb-10">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 w-96">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total HT (base)</span>
                <span className="text-sm font-black font-mono text-slate-900">{formatPrice(summary.base)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={aleasOn} onChange={toggleAleas} className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Aléas</span>
                  <span className={`flex items-center gap-0.5 ${aleasOn ? '' : 'opacity-40 pointer-events-none'}`}>
                    <input type="number" value={numDisplay(draft.aleas?.percent)} placeholder="10" onChange={(e) => setAleasPercent(e.target.value)}
                      className="w-10 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-right text-[11px] font-mono outline-none focus:border-emerald-500" />
                    <Percent size={10} className="text-slate-400" />
                  </span>
                </label>
                <span className="text-xs font-bold font-mono text-slate-400">{aleasOn ? `+ ${formatPrice(summary.aleas)}` : '—'}</span>
              </div>
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Total HT</span>
                <span className="text-sm font-black font-mono text-emerald-700">{formatPrice(summary.totalHT)}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">TVA (20%)</span>
                <span className="text-sm font-bold text-slate-500 font-mono">{formatPrice(summary.totalHT * 0.2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-widest text-emerald-700">Total TTC</span>
                <span className="text-xl font-black font-mono px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600">{formatPrice(summary.totalHT * 1.2)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
