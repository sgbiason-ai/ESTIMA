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

// Cellule « durée » : affiche la durée calculée (auto, en gris) tant que la ligne
// n'est pas forcée. Saisir une valeur force la durée pour cette ligne ; vider
// revient à la durée calculée. onCommit reçoit un patch { duree, dureeForced }.
export function DureeCell({ forced, duree, auto, onCommit }) {
  const eff = forced ? duree : auto;
  const [focus, setFocus] = useState(false);
  const [v, setV] = useState('');
  return (
    <input
      type="text"
      inputMode="decimal"
      value={focus ? v : ((eff || eff === 0) ? String(eff) : '')}
      onFocus={() => { setFocus(true); setV(forced ? String(duree ?? '') : String(auto || '')); }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocus(false);
        const t = String(v).trim();
        if (t === '') { onCommit({ duree: null, dureeForced: false }); return; }
        const n = Number(t.replace(',', '.'));
        if (!Number.isFinite(n)) { onCommit({ duree: null, dureeForced: false }); return; }
        onCommit({ duree: n, dureeForced: true });
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      title={forced ? 'Durée forcée pour cette ligne (vider = durée calculée)' : 'Durée calculée (= quantité / rendement) — saisir pour forcer'}
      className={`w-full rounded px-1 py-0.5 text-center text-xs font-mono outline-none border focus:border-orange-500 ${forced ? 'bg-white border-orange-300 text-orange-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
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
