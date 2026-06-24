// src/views/estimaTp/sousDetail/TpArticleMeta.jsx
// ESTIMA TP — tuiles éditables Quantité / Rendement / Durée d'un article, partagées
// entre l'éditeur de sous-détail et la modale « toutes les ressources » (source unique).
import React from 'react';
import { Ruler, Gauge, Clock } from 'lucide-react';
import { NumCell } from './sdShared';
import { rendementFromDuree } from '../../../utils/tp/tpPriceCompute';

// Durée et rendement sont liés par la quantité : saisir la durée recalcule le rendement.
export function ArticleMetaTiles({ unit, qte, rendement, duree, onQtyChange, onRendementChange }) {
  return (
    <div className="flex items-stretch gap-2 shrink-0">
      <MiniTile icon={Ruler} label="Quantité" unit={unit}>
        <NumCell value={qte} onCommit={(v) => onQtyChange?.(v)} align="left"
          className="!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black !text-slate-900" />
      </MiniTile>
      <MiniTile icon={Gauge} label="Rendt/j" unit={`${unit}/j`}>
        <NumCell value={rendement} onCommit={(v) => onRendementChange?.(v)} placeholder="0" align="left"
          className="!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black !text-orange-700" />
      </MiniTile>
      <MiniTile icon={Clock} label="Durée" unit={qte > 0 ? 'j' : ''}>
        {qte > 0 ? (
          <NumCell value={duree} onCommit={(v) => onRendementChange?.(rendementFromDuree(qte, v))} placeholder="0" align="left"
            className="!border-0 !bg-transparent !px-0 !py-0 !text-base !font-black !text-slate-900" />
        ) : (
          // Sans quantité, la durée n'a pas de sens : non éditable pour ne pas écraser le rendement à 0.
          <span className="text-base font-black text-slate-300" title="Définissez d'abord la quantité de l'ouvrage">—</span>
        )}
      </MiniTile>
    </div>
  );
}

// Mini-tuile de saisie (label + icône + valeur + unité)
function MiniTile({ icon: Icon, label, unit, children }) {
  return (
    <div className="bg-white border border-orange-200/70 rounded-lg px-2.5 py-1 min-w-[94px] transition-shadow focus-within:ring-2 focus-within:ring-orange-200">
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wide text-slate-500">
          {Icon && <Icon size={10} className="text-orange-500" />}{label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <div className="flex-1 min-w-0">{children}</div>
        {unit && <span className="shrink-0 text-[9px] font-semibold text-slate-400 lowercase">{unit}</span>}
      </div>
    </div>
  );
}
