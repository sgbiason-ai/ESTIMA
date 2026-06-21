// src/views/estimaTp/ressources/TpResourcesTab.jsx
// ESTIMA TP — gestion de la bibliothèque de ressources réutilisable (niveau entreprise).
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Package } from 'lucide-react';
import { useTpResources, emptyResource } from '../../../hooks/useTpResources';
import { POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';
import { NumCell, TxtCell } from '../sousDetail/sdShared';

export default function TpResourcesTab({ companyId }) {
  const { resources, loading, saveResource, deleteResource } = useTpResources(companyId);
  const [cat, setCat] = useState('materiel');
  const list = useMemo(() => resources.filter(r => r.category === cat), [resources, cat]);

  const upd = (r, patch) => saveResource({ ...r, ...patch });
  const isFourn = cat === 'fourniture';
  const isST = cat === 'soustraitance';
  const isRes = !isFourn && !isST; // matériel / MO / transport

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Sélecteur de catégorie */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {POSTES.map(p => (
            <button key={p} onClick={() => setCat(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${cat === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {POSTE_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{list.length} ressource(s) — réutilisables dans les sous-détails (volet « Bibliothèque »).</p>
          <button onClick={() => saveResource(emptyResource(cat))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all shadow-sm">
            <Plus size={16} /> Ajouter
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={26} className="animate-spin text-orange-500" /></div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 bg-white/60 border border-dashed border-gray-200 rounded-2xl text-center px-6">
            <div className="p-4 rounded-2xl bg-orange-50 mb-3"><Package size={26} className="text-orange-500" /></div>
            <p className="text-sm font-semibold text-gray-700">Aucune ressource « {POSTE_LABELS[cat]} »</p>
            <p className="text-xs text-gray-400 mt-1">Ajoutez vos ressources types (avec un code) pour les réutiliser d'une étude à l'autre.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
            <div className="min-w-[760px]">
              {/* En-tête */}
              <Header isRes={isRes} isFourn={isFourn} isST={isST} />
              {list.map(r => (
                <Row key={r.id} r={r} isRes={isRes} isFourn={isFourn} isST={isST} upd={upd} del={() => deleteResource(r.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const GRID_RES = 'grid grid-cols-[80px_1fr_48px_72px_70px_70px_70px_70px_32px] gap-1 items-center';
const GRID_FOURN = 'grid grid-cols-[80px_1fr_48px_72px_72px_90px_32px] gap-1 items-center';
const GRID_ST = 'grid grid-cols-[80px_1fr_48px_90px_32px] gap-1 items-center';

const Th = ({ children, className = '' }) => (
  <div className={`text-[9px] font-black uppercase tracking-wide text-slate-400 px-1 ${className}`}>{children}</div>
);

function Header({ isRes, isFourn, isST }) {
  const grid = isFourn ? GRID_FOURN : isST ? GRID_ST : GRID_RES;
  return (
    <div className={`${grid} px-3 py-2 border-b border-slate-200`}>
      <Th>Code</Th><Th>Désignation</Th><Th className="text-center">U</Th>
      {isRes && <><Th className="text-right">PU/J</Th><Th className="text-right">Amort.</Th><Th className="text-right">Entret.</Th><Th className="text-right">Cons.</Th><Th className="text-right">Loc.</Th></>}
      {isFourn && <><Th className="text-right">Épaiss.</Th><Th className="text-right">Densité</Th><Th className="text-right">PU barème</Th></>}
      {isST && <Th className="text-right">PU barème</Th>}
      <Th />
    </div>
  );
}

function Row({ r, isRes, isFourn, isST, upd, del }) {
  const grid = isFourn ? GRID_FOURN : isST ? GRID_ST : GRID_RES;
  return (
    <div className={`group ${grid} px-3 py-1 border-b border-slate-50 hover:bg-slate-50/60`}>
      <TxtCell value={r.code} upper onCommit={(v) => upd(r, { code: v })} placeholder="code" className="font-mono font-bold text-orange-600" />
      <TxtCell value={r.designation} onCommit={(v) => upd(r, { designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
      <TxtCell value={r.unit} upper onCommit={(v) => upd(r, { unit: v })} className="text-center" />
      {isRes && <>
        <NumCell value={r.puJour} onCommit={(v) => upd(r, { puJour: v })} />
        <NumCell value={r.amort} onCommit={(v) => upd(r, { amort: v })} />
        <NumCell value={r.entret} onCommit={(v) => upd(r, { entret: v })} />
        <NumCell value={r.cons} onCommit={(v) => upd(r, { cons: v })} />
        <NumCell value={r.loc} onCommit={(v) => upd(r, { loc: v })} />
      </>}
      {isFourn && <>
        <NumCell value={r.epaisseur} onCommit={(v) => upd(r, { epaisseur: v })} placeholder="—" />
        <NumCell value={r.densite} onCommit={(v) => upd(r, { densite: v })} placeholder="—" />
        <NumCell value={r.puBareme} onCommit={(v) => upd(r, { puBareme: v })} />
      </>}
      {isST && <NumCell value={r.puBareme} onCommit={(v) => upd(r, { puBareme: v })} />}
      <button onClick={del} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex justify-center"><Trash2 size={13} /></button>
    </div>
  );
}
