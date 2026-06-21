// src/views/estimaTp/ressources/TpResourcesTab.jsx
// ESTIMA TP — bibliothèque de ressources réutilisable : les 5 catégories (postes)
// sont affichées comme 5 bibliothèques distinctes, chacune avec son tableau.
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTpResources, emptyResource } from '../../../hooks/useTpResources';
import { POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';
import { NumCell, TxtCell } from '../sousDetail/sdShared';

export default function TpResourcesTab({ companyId }) {
  const { resources, loading, saveResource, deleteResource } = useTpResources(companyId);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const byCat = useMemo(() => {
    const m = {}; POSTES.forEach(p => { m[p] = []; });
    resources.forEach(r => { if (m[r.category]) m[r.category].push(r); });
    return m;
  }, [resources]);

  const toggle = (cat) => setCollapsed(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-[#f5f5f7]"><Loader2 size={26} className="animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-5xl mx-auto space-y-4">
        <p className="text-xs text-gray-400">
          Vos ressources types, réutilisables dans les sous-détails (volet « Bibliothèque »). Une bibliothèque par catégorie.
        </p>
        {POSTES.map(cat => (
          <LibrarySection
            key={cat}
            cat={cat}
            list={byCat[cat]}
            collapsed={collapsed.has(cat)}
            onToggle={() => toggle(cat)}
            onAdd={() => saveResource(emptyResource(cat))}
            onUpd={(r, patch) => saveResource({ ...r, ...patch })}
            onDel={(id) => deleteResource(id)}
          />
        ))}
      </div>
    </div>
  );
}

function LibrarySection({ cat, list, collapsed, onToggle, onAdd, onUpd, onDel }) {
  const isFourn = cat === 'fourniture';
  const isST = cat === 'soustraitance';
  const isRes = !isFourn && !isST;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* En-tête de la bibliothèque */}
      <div className="flex items-center gap-2 px-4 py-3 bg-orange-50/60 border-b border-orange-100">
        <button onClick={onToggle} className="p-0.5 rounded text-orange-500 hover:bg-orange-100" title={collapsed ? 'Déplier' : 'Replier'}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <h3 className="text-sm font-black uppercase tracking-wider text-orange-700 flex-1">{POSTE_LABELS[cat]}</h3>
        <span className="text-[11px] font-bold text-orange-600/70">{list.length} ressource{list.length > 1 ? 's' : ''}</span>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-all">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {!collapsed && (
        list.length === 0 ? (
          <p className="px-4 py-5 text-xs italic text-slate-400">Aucune ressource — cliquez « Ajouter » pour créer une entrée (avec un code).</p>
        ) : (
          <div className="overflow-x-auto">
            <div className={isFourn ? 'min-w-[640px]' : isST ? 'min-w-[460px]' : 'min-w-[720px]'}>
              <Header isRes={isRes} isFourn={isFourn} isST={isST} />
              {list.map(r => (
                <Row key={r.id} r={r} isRes={isRes} isFourn={isFourn} isST={isST} upd={(patch) => onUpd(r, patch)} del={() => onDel(r.id)} />
              ))}
            </div>
          </div>
        )
      )}
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
      <TxtCell value={r.code} upper onCommit={(v) => upd({ code: v })} placeholder="code" className="font-mono font-bold text-orange-600" />
      <TxtCell value={r.designation} onCommit={(v) => upd({ designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
      <TxtCell value={r.unit} upper onCommit={(v) => upd({ unit: v })} className="text-center" />
      {isRes && <>
        <NumCell value={r.puJour} onCommit={(v) => upd({ puJour: v })} />
        <NumCell value={r.amort} onCommit={(v) => upd({ amort: v })} />
        <NumCell value={r.entret} onCommit={(v) => upd({ entret: v })} />
        <NumCell value={r.cons} onCommit={(v) => upd({ cons: v })} />
        <NumCell value={r.loc} onCommit={(v) => upd({ loc: v })} />
      </>}
      {isFourn && <>
        <NumCell value={r.epaisseur} onCommit={(v) => upd({ epaisseur: v })} placeholder="—" />
        <NumCell value={r.densite} onCommit={(v) => upd({ densite: v })} placeholder="—" />
        <NumCell value={r.puBareme} onCommit={(v) => upd({ puBareme: v })} />
      </>}
      {isST && <NumCell value={r.puBareme} onCommit={(v) => upd({ puBareme: v })} />}
      <button onClick={del} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex justify-center"><Trash2 size={13} /></button>
    </div>
  );
}
