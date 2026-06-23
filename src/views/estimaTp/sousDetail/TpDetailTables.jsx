// src/views/estimaTp/sousDetail/TpDetailTables.jsx
// ESTIMA TP — tables de saisie du sous-détail (5 postes). Saisie manuelle des
// ressources (bibliothèque partagée prévue en Phase 3).
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NumCell, TxtCell, DureeCell } from './sdShared';
import { fmt2 } from './sdFormat';
import {
  newRessourceLine, newFournitureLine, newSousTraitanceLine, newTransportLine,
  ressourceCosts, fournitureQty, fournitureCost, sousTraitanceCost, sousTraitanceQty,
  transportCost, transportCamions,
} from '../../../utils/tp/tpPriceCompute';

function useOps(lines, onChange) {
  const arr = lines || [];
  return {
    add: (line) => onChange([...arr, line]),
    upd: (id, patch) => onChange(arr.map(l => l.id === id ? { ...l, ...patch } : l)),
    del: (id) => onChange(arr.filter(l => l.id !== id)),
  };
}

// Classes littérales par accent (Tailwind ne génère pas les classes construites dynamiquement)
const ACCENT = {
  orange:  { head: 'bg-orange-50 border-orange-100',   title: 'text-orange-700',  btn: 'text-orange-600 hover:text-orange-800' },
  emerald: { head: 'bg-emerald-50 border-emerald-100', title: 'text-emerald-700', btn: 'text-emerald-600 hover:text-emerald-800' },
  violet:  { head: 'bg-violet-50 border-violet-100',   title: 'text-violet-700',  btn: 'text-violet-600 hover:text-violet-800' },
  sky:     { head: 'bg-sky-50 border-sky-100',         title: 'text-sky-700',     btn: 'text-sky-600 hover:text-sky-800' },
};

function Block({ title, accent = 'orange', onAdd, addLabel, children }) {
  const a = ACCENT[accent] || ACCENT.orange;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-3 py-2 border-b ${a.head}`}>
        <h4 className={`text-[11px] font-black uppercase tracking-wider ${a.title}`}>{title}</h4>
        <button onClick={onAdd} className={`flex items-center gap-1 text-[11px] font-semibold ${a.btn}`}>
          <Plus size={13} /> {addLabel}
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const Th = ({ children, className = '' }) => (
  <div className={`text-[9px] font-black uppercase tracking-wide text-slate-400 px-1 ${className}`}>{children}</div>
);
const DelBtn = ({ onClick }) => (
  <button onClick={onClick} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex justify-center"><Trash2 size={13} /></button>
);

// ─── Matériel / Main d'œuvre (même structure) ─────────────────────────────────
// Durée par ligne, pré-remplie avec la durée totale calculée (prop `duree`),
// modifiable ; le coût court sur cette durée.
const RES_COLS = 'grid grid-cols-[1fr_52px_64px_70px_66px_66px_66px_66px_92px_28px] gap-1 items-center';

export function RessourceTable({ title, accent, addLabel, lines, onChange, duree = 0 }) {
  const { add, upd, del } = useOps(lines, onChange);
  return (
    <Block title={title} accent={accent} addLabel={addLabel} onAdd={() => add(newRessourceLine())}>
      <div className="min-w-[740px]">
        <div className={`${RES_COLS} px-2 py-1.5 border-b border-slate-100`}>
          <Th>Désignation</Th><Th className="text-center">Nb</Th><Th className="text-center">Durée</Th>
          <Th className="text-right">Perso.</Th><Th className="text-right">Amort.</Th><Th className="text-right">Entret.</Th>
          <Th className="text-right">Cons.</Th><Th className="text-right">Loc.</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => (
            <div key={l.id} className={`group ${RES_COLS} px-2 py-1 border-b border-slate-50 hover:bg-slate-50/60`}>
              <TxtCell value={l.designation} onCommit={(v) => upd(l.id, { designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
              <NumCell value={l.nombre} onCommit={(v) => upd(l.id, { nombre: v })} align="center" />
              <DureeCell forced={l.dureeForced} duree={l.duree} auto={duree} onCommit={(patch) => upd(l.id, patch)} />
              <NumCell value={l.puJour} onCommit={(v) => upd(l.id, { puJour: v })} />
              <NumCell value={l.amort} onCommit={(v) => upd(l.id, { amort: v })} />
              <NumCell value={l.entret} onCommit={(v) => upd(l.id, { entret: v })} />
              <NumCell value={l.cons} onCommit={(v) => upd(l.id, { cons: v })} />
              <NumCell value={l.loc} onCommit={(v) => upd(l.id, { loc: v })} />
              <div className="text-right text-[11px] font-mono font-bold text-slate-900 px-1">{fmt2(ressourceCosts(l, duree))}</div>
              <DelBtn onClick={() => del(l.id)} />
            </div>
        ))}
        {(!lines || lines.length === 0) && <div className="px-3 py-2 text-[10px] italic text-slate-400">Aucune ligne</div>}
      </div>
    </Block>
  );
}

// ─── Fournitures ──────────────────────────────────────────────────────────────
const FOUR_COLS = 'grid grid-cols-[1fr_44px_64px_64px_78px_78px_78px_92px_28px] gap-1 items-center';

export function FournitureTable({ lines, onChange, qteOuvrage }) {
  const { add, upd, del } = useOps(lines, onChange);
  return (
    <Block title="Fournitures" accent="emerald" addLabel="Fourniture" onAdd={() => add(newFournitureLine())}>
      <div className="min-w-[700px]">
        <div className={`${FOUR_COLS} px-2 py-1.5 border-b border-slate-100`}>
          <Th>Désignation</Th><Th className="text-center">U</Th><Th className="text-right">Épaiss.</Th><Th className="text-right">Densité</Th>
          <Th className="text-right">Qté</Th><Th className="text-right">PU barème</Th><Th className="text-right">PU forcé</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => {
          const auto = Number(l.epaisseur) > 0 && Number(l.densite) > 0;
          const qte = fournitureQty(l, qteOuvrage);
          return (
            <div key={l.id} className={`group ${FOUR_COLS} px-2 py-1 border-b border-slate-50 hover:bg-slate-50/60`}>
              <TxtCell value={l.designation} onCommit={(v) => upd(l.id, { designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
              <TxtCell value={l.unit} upper onCommit={(v) => upd(l.id, { unit: v })} className="text-center" />
              <NumCell value={l.epaisseur} onCommit={(v) => upd(l.id, { epaisseur: v })} placeholder="—" />
              <NumCell value={l.densite} onCommit={(v) => upd(l.id, { densite: v })} placeholder="—" />
              {auto
                ? <div className="text-right text-[11px] font-mono text-slate-500 px-1" title="Quantité = quantité d'ouvrage × épaisseur × densité">{qte.toLocaleString('fr-FR')}</div>
                : <NumCell value={l.qte} onCommit={(v) => upd(l.id, { qte: v })} />}
              <NumCell value={l.puBareme} onCommit={(v) => upd(l.id, { puBareme: v })} />
              <NumCell value={l.puForce} onCommit={(v) => upd(l.id, { puForce: v })} placeholder="—" />
              <div className="text-right text-[11px] font-mono font-bold text-slate-900 px-1">{fmt2(fournitureCost(l, qteOuvrage))}</div>
              <DelBtn onClick={() => del(l.id)} />
            </div>
          );
        })}
        {(!lines || lines.length === 0) && <div className="px-3 py-2 text-[10px] italic text-slate-400">Aucune ligne</div>}
      </div>
    </Block>
  );
}

// ─── Sous-traitance ───────────────────────────────────────────────────────────
const ST_COLS = 'grid grid-cols-[1fr_44px_72px_72px_80px_80px_92px_28px] gap-1 items-center';

export function SousTraitanceTable({ lines, onChange, qteOuvrage = 0, articleUnit = '' }) {
  const { add, upd, del } = useOps(lines, onChange);
  return (
    <Block title="Sous-traitance" accent="violet" addLabel="Sous-traitant" onAdd={() => add(newSousTraitanceLine({ unit: articleUnit || 'U' }))}>
      <div className="min-w-[600px]">
        <div className={`${ST_COLS} px-2 py-1.5 border-b border-slate-100`}>
          <Th>Désignation</Th><Th className="text-center">U</Th><Th className="text-right">Qté unit.</Th><Th className="text-right">Qté tot.</Th>
          <Th className="text-right">PU barème</Th><Th className="text-right">PU forcé</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => (
          <div key={l.id} className={`group ${ST_COLS} px-2 py-1 border-b border-slate-50 hover:bg-slate-50/60`}>
            <TxtCell value={l.designation} onCommit={(v) => upd(l.id, { designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
            <TxtCell value={l.unit} upper onCommit={(v) => upd(l.id, { unit: v })} className="text-center" />
            <NumCell value={l.qteUnitaire} onCommit={(v) => upd(l.id, { qteUnitaire: v })} placeholder="1" />
            <div className="text-right text-[11px] font-mono text-slate-500 px-1" title="Quantité totale = quantité unitaire × quantité d'ouvrage">{sousTraitanceQty(l, qteOuvrage, articleUnit).toLocaleString('fr-FR')}</div>
            <NumCell value={l.puBareme} onCommit={(v) => upd(l.id, { puBareme: v })} />
            <NumCell value={l.puForce} onCommit={(v) => upd(l.id, { puForce: v })} placeholder="—" />
            <div className="text-right text-[11px] font-mono font-bold text-slate-900 px-1">{fmt2(sousTraitanceCost(l, qteOuvrage, articleUnit))}</div>
            <DelBtn onClick={() => del(l.id)} />
          </div>
        ))}
        {(!lines || lines.length === 0) && <div className="px-3 py-2 text-[10px] italic text-slate-400">Aucune ligne</div>}
      </div>
    </Block>
  );
}

// ─── Transport ────────────────────────────────────────────────────────────────
// Contenance/voyage + voyages/jour → nombre de camions selon la quantité à transporter.
const TRANS_COLS = 'grid grid-cols-[1fr_44px_60px_60px_74px_56px_84px_60px_92px_28px] gap-1 items-center';

export function TransportTable({ lines, onChange, qteOuvrage = 0, duree = 0 }) {
  const { add, upd, del } = useOps(lines, onChange);
  return (
    <Block title="Transport" accent="sky" addLabel="Transport" onAdd={() => add(newTransportLine())}>
      <div className="min-w-[800px]">
        <div className={`${TRANS_COLS} px-2 py-1.5 border-b border-slate-100`}>
          <Th>Désignation</Th><Th className="text-center">U</Th><Th className="text-right">Épaiss.</Th><Th className="text-right">Densité</Th>
          <Th className="text-right">Contenance</Th><Th className="text-right">Voy./j</Th><Th className="text-right">Coût/j</Th>
          <Th className="text-right">Camions</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => (
          <div key={l.id} className={`group ${TRANS_COLS} px-2 py-1 border-b border-slate-50 hover:bg-slate-50/60`}>
            <TxtCell value={l.designation} onCommit={(v) => upd(l.id, { designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
            <TxtCell value={l.unit} upper onCommit={(v) => upd(l.id, { unit: v })} className="text-center" />
            <NumCell value={l.epaisseur} onCommit={(v) => upd(l.id, { epaisseur: v })} placeholder="—" />
            <NumCell value={l.densite} onCommit={(v) => upd(l.id, { densite: v })} placeholder="—" />
            <NumCell value={l.contenance} onCommit={(v) => upd(l.id, { contenance: v })} />
            <NumCell value={l.voyagesParJour} onCommit={(v) => upd(l.id, { voyagesParJour: v })} />
            <NumCell value={l.coutJour} onCommit={(v) => upd(l.id, { coutJour: v })} />
            <div className="text-right text-[11px] font-mono text-slate-500 px-1" title="Camions nécessaires en parallèle (camions-jours / durée)">{transportCamions(l, qteOuvrage, duree).toLocaleString('fr-FR')}</div>
            <div className="text-right text-[11px] font-mono font-bold text-slate-900 px-1">{fmt2(transportCost(l, qteOuvrage))}</div>
            <DelBtn onClick={() => del(l.id)} />
          </div>
        ))}
        {(!lines || lines.length === 0) && <div className="px-3 py-2 text-[10px] italic text-slate-400">Aucune ligne</div>}
      </div>
    </Block>
  );
}
