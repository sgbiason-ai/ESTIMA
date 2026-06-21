// src/views/estimaTp/sousDetail/sdShared.jsx
// ESTIMA TP — cellules de saisie partagées du sous-détail (composants uniquement ;
// les helpers de format sont dans sdFormat.js pour le fast-refresh).
import React, { useState, useEffect } from 'react';

// Champ numérique (commit au blur, vide = 0)
export function NumCell({ value, onCommit, className = '', placeholder = '0', align = 'right' }) {
  const [v, setV] = useState('');
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setV(value ? String(value) : ''); }, [value, focus]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={focus ? v : (value ? String(value) : '')}
      placeholder={placeholder}
      onFocus={() => { setFocus(true); setV(value ? String(value) : ''); }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setFocus(false); const n = Number(String(v).replace(',', '.')); onCommit(Number.isFinite(n) ? n : 0); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`w-full bg-white border border-slate-200 focus:border-orange-500 rounded px-1 py-0.5 text-${align} text-xs font-mono outline-none ${className}`}
    />
  );
}

// Champ texte (commit au blur)
export function TxtCell({ value, onCommit, className = '', placeholder = '', upper = false }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(upper ? e.target.value.toUpperCase() : e.target.value)}
      onBlur={() => { if (v !== (value ?? '')) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-orange-400 focus:bg-white rounded px-1.5 py-0.5 text-xs outline-none ${className}`}
    />
  );
}
