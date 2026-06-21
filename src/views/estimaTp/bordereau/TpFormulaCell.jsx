// src/views/estimaTp/bordereau/TpFormulaCell.jsx
// Cellule « quantité » du bordereau TP avec formules ƒ(x) (forme ESTIMA) :
//  - saisie d'un nombre ou d'une formule =expression
//  - références à d'autres lignes par [n°] (clic sur une autre ligne pour insérer)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTpBordereau } from './TpBordereauContext';

export default function TpFormulaCell({ el }) {
  const { refMap, reverseRefMap, setFormulaMode, onUpdateNode, readOnly } = useTpBordereau();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const cursor = useRef(null);
  const sessionMap = useRef(new Map()); // label -> id exact (lève l'ambiguïté des doublons)

  const formula = el.formula || '';
  const hasFormula = formula.startsWith('=');

  // {id} -> [label lisible]
  const toReadable = useCallback((s) => String(s || '').replace(/\{([^}]+)\}/g, (m, id) => {
    const lbl = refMap.get(id) || refMap.get(String(id));
    return lbl ? `[${lbl}]` : m;
  }), [refMap]);

  // [label] -> {id}
  const toRaw = useCallback((s) => String(s || '').replace(/\[([^\]]+)\]/g, (m, lbl) => {
    const id = sessionMap.current.get(lbl) ?? reverseRefMap.get(lbl);
    return id ? `{${id}}` : m;
  }), [reverseRefMap]);

  useEffect(() => { if (!editing) setInput(''); }, [el.qty, formula, editing]);

  const startEdit = () => {
    if (readOnly) return;
    setEditing(true);
    // pré-remplit la session avec les ids déjà référencés (aller-retour fidèle)
    sessionMap.current = new Map();
    formula.replace(/\{([^}]+)\}/g, (m, id) => {
      const lbl = refMap.get(id) || refMap.get(String(id));
      if (lbl) sessionMap.current.set(lbl, id);
      return m;
    });
    const display = hasFormula ? toReadable(formula) : (Number(el.qty) === 0 ? '' : String(el.qty));
    setInput(display);
    if (display.startsWith('=')) setFormulaMode({ activeId: el.id, onInsert: insertRef });
  };

  const insertRef = useCallback((id) => {
    const label = refMap.get(id) || refMap.get(String(id)) || id;
    sessionMap.current.set(String(label), id);
    setInput(prev => {
      const pos = cursor.current ?? prev.length;
      const ref = `[${label}]`;
      const next = prev.slice(0, pos) + ref + prev.slice(pos);
      cursor.current = pos + ref.length;
      return next;
    });
    setFormulaMode({ activeId: el.id, onInsert: insertRef });
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (cursor.current != null) inputRef.current.setSelectionRange(cursor.current, cursor.current);
      }
    }, 0);
  }, [refMap, el.id, setFormulaMode]);

  const change = (e) => {
    const v = e.target.value;
    setInput(v);
    if (v.startsWith('=')) setFormulaMode({ activeId: el.id, onInsert: insertRef });
    else setFormulaMode({ activeId: null });
  };

  const commit = () => {
    setEditing(false);
    setFormulaMode({ activeId: null });
    const txt = String(input).trim();
    if (txt === '') { onUpdateNode(el.id, { formula: '', qty: 0 }); return; }
    if (txt.startsWith('=')) {
      onUpdateNode(el.id, { formula: toRaw(txt) });
    } else {
      const n = Number(txt.replace(',', '.'));
      onUpdateNode(el.id, { formula: '', qty: Number.isFinite(n) ? n : 0 });
    }
  };

  const keyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') { setEditing(false); setFormulaMode({ activeId: null }); inputRef.current?.blur(); }
  };

  const display = editing
    ? input
    : (hasFormula ? (Number(el.qty) || 0) : (Number(el.qty) === 0 ? '' : el.qty));

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={display}
        disabled={readOnly}
        onFocus={startEdit}
        onChange={change}
        onBlur={commit}
        onKeyDown={keyDown}
        onClick={(e) => { cursor.current = e.currentTarget.selectionStart; }}
        onKeyUp={(e) => { cursor.current = e.currentTarget.selectionStart; }}
        placeholder="0"
        title={hasFormula ? toReadable(formula) : undefined}
        className={`w-full rounded py-0.5 px-1 text-right text-xs font-mono font-bold outline-none transition-colors border
          ${hasFormula && !editing
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : editing && input.startsWith('=')
              ? 'bg-amber-50 border-amber-400 text-amber-800'
              : 'bg-white border-slate-300 focus:border-orange-500 text-slate-900'}`}
      />
      {hasFormula && !editing && (
        <span className="absolute left-0.5 top-0 text-[7px] text-emerald-500 font-black pointer-events-none leading-tight">ƒ</span>
      )}
    </div>
  );
}
