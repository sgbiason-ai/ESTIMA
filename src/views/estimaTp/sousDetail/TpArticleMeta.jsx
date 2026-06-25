// src/views/estimaTp/sousDetail/TpArticleMeta.jsx
// ESTIMA TP — tuiles éditables Quantité / Qté calcul / Rendement / Durée d'un article,
// partagées entre l'éditeur de sous-détail et la modale « toutes les ressources ».
import React, { useState, useEffect } from 'react';
import { Ruler, Gauge, Clock, Calculator } from 'lucide-react';
import { NumCell } from './sdShared';

// Unités de calcul courantes (TP) — suggestions du champ unité (saisie libre conservée).
const CALC_UNITS = ['m²', 'm³', 'ml', 'm', 'T', 'kg', 'U', 'ha', 'F'];

// Durée ⇄ rendement, liés par la quantité de CALCUL. UN des deux pilote (affiché en orange) :
//  - saisir la Durée la fige (dureeForced) → valeur exacte, le rendement en découle ;
//  - saisir le Rendement la délie (dureeForced=false) → la durée = quantité de calcul / rendement.
// La « Qté calcul » (quantité + unité) permet de raisonner le rendement dans une autre unité que
// le cadre (ex. décapage facturé au m² mais piloté en m³). Vide → quantité d'ouvrage du cadre.
export function ArticleMetaTiles({ unit, qte, calcQte, calcUnit, rendement, duree, dureeForced = false, rendementMissing = false, onQtyChange, onPatch }) {
  const driver = dureeForced ? 'duree' : 'rendement';
  const calcActive = Number(calcQte) > 0;                 // moteur : qté de calcul prise en compte si > 0
  const hasCalc = calcActive || !!(calcUnit && calcUnit.trim());
  const rUnit = ((calcActive && calcUnit) || unit || '').trim(); // rendement dans l'unité réellement utilisée
  return (
    <div className="flex items-stretch gap-2 shrink-0 flex-wrap">
      <MiniTile icon={Ruler} label="Quantité" unit={unit}>
        <NumCell value={qte} onCommit={(v) => onQtyChange?.(v)} align="left"
          className="!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black !text-slate-900" />
      </MiniTile>

      {/* Qté + unité de CALCUL : pilotent le rendement dans une autre unité que le cadre.
          L'unité est un vrai champ éditable (chip orange) — vide = unité du cadre. */}
      <div className={`bg-white border ${hasCalc ? 'border-orange-200/70' : 'border-dashed border-orange-300'} rounded-lg px-2.5 py-1 min-w-[128px] transition-shadow focus-within:ring-2 focus-within:ring-orange-200`}>
        <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wide text-slate-500">
          <Calculator size={10} className="text-orange-500" /> Qté calcul
        </span>
        <div className="flex items-center gap-1.5">
          <NumCell value={calcQte} onCommit={(v) => onPatch?.({ qteCalcul: Number(v) > 0 ? v : null })}
            placeholder={qte ? String(qte) : '—'} align="left"
            className={`!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black ${Number(calcQte) > 0 ? '!text-slate-900' : '!text-slate-400'}`} />
          <UnitCell value={calcUnit} placeholder={unit || 'unité'} onCommit={(v) => onPatch?.({ uniteCalcul: v })} />
        </div>
      </div>

      <MiniTile icon={Gauge} label="Rendt/j" unit={`${rUnit}/j`} alert={rendementMissing}
        title={rendementMissing ? 'Rendement (ou durée) requis : ressources Matériel/MO présentes — sinon coûts à 0' : undefined}>
        <NumCell value={rendement} onCommit={(v) => onPatch?.({ rendement: v, dureeForced: false })} placeholder="0" align="left"
          className={`!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black ${rendementMissing ? '!text-red-600' : (driver === 'rendement' ? '!text-orange-700' : '!text-slate-500')}`} />
      </MiniTile>
      <MiniTile icon={Clock} label="Durée" unit="j">
        <NumCell value={duree} onCommit={(v) => onPatch?.({ duree: v, dureeForced: true })} placeholder="0" align="left"
          className={`!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black ${driver === 'duree' ? '!text-orange-700' : '!text-slate-900'}`} />
      </MiniTile>

      {/* Suggestions d'unités (partagées par le champ unité de calcul) */}
      <datalist id="tp-calc-units">{CALC_UNITS.map(u => <option key={u} value={u} />)}</datalist>
    </div>
  );
}

// Mini-tuile de saisie (label + icône + valeur + unité statique). `alert` → état rouge
// (champ requis non renseigné), avec un suffixe « · requis » sur le libellé.
function MiniTile({ icon: Icon, label, unit, alert = false, title, children }) {
  return (
    <div title={title}
      className={`bg-white border rounded-lg px-2.5 py-1 min-w-[94px] transition-shadow focus-within:ring-2 ${alert ? 'border-red-300 bg-red-50/40 focus-within:ring-red-200' : 'border-orange-200/70 focus-within:ring-orange-200'}`}>
      <div className="flex items-center gap-1">
        <span className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-wide ${alert ? 'text-red-500' : 'text-slate-500'}`}>
          {Icon && <Icon size={10} className={alert ? 'text-red-500' : 'text-orange-500'} />}{label}{alert && ' · requis'}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <div className="flex-1 min-w-0">{children}</div>
        {unit && <span className="shrink-0 text-[9px] font-semibold text-slate-400 lowercase">{unit}</span>}
      </div>
    </div>
  );
}

// Champ d'unité de calcul éditable (chip orange, commit au blur) — ex. m³. Liste de
// suggestions via datalist, saisie libre conservée. Vide = unité du cadre.
function UnitCell({ value, placeholder = '', onCommit }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = () => { const t = v.trim(); if (t !== (value ?? '')) onCommit?.(t); };
  return (
    <input
      value={v}
      list="tp-calc-units"
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      title="Unité de calcul (ex. m³) — vide = unité du cadre"
      className="w-12 shrink-0 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 text-[11px] font-bold text-orange-700 text-center outline-none focus:border-orange-400 focus:bg-white placeholder:font-normal placeholder:text-slate-400"
    />
  );
}
