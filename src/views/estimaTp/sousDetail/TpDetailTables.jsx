// src/views/estimaTp/sousDetail/TpDetailTables.jsx
// ESTIMA TP — tables de saisie du sous-détail (5 postes). Saisie manuelle des
// ressources (bibliothèque partagée prévue en Phase 3).
import React from 'react';
import { Plus, Trash2, Filter } from 'lucide-react';
import { NumCell, TxtCell, DureeCell, AutoNumCell } from './sdShared';
import { fmt2 } from './sdFormat';
import {
  newRessourceLine, newFournitureLine, newSousTraitanceLine, newTransportLine,
  ressourceCosts, fournitureQty, fournitureCost, sousTraitanceCost,
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

// Accent couleur par poste (classes littérales — requis par le JIT Tailwind).
const ACCENT = {
  orange:  { head: 'bg-orange-50',  hover: 'hover:bg-orange-100/70',  title: 'text-orange-700',  btn: 'text-orange-600 hover:text-orange-800',  ring: 'ring-orange-300' },
  blue:    { head: 'bg-blue-50',    hover: 'hover:bg-blue-100/70',    title: 'text-blue-700',    btn: 'text-blue-600 hover:text-blue-800',    ring: 'ring-blue-300' },
  emerald: { head: 'bg-emerald-50', hover: 'hover:bg-emerald-100/70', title: 'text-emerald-700', btn: 'text-emerald-600 hover:text-emerald-800', ring: 'ring-emerald-300' },
  violet:  { head: 'bg-violet-50',  hover: 'hover:bg-violet-100/70',  title: 'text-violet-700',  btn: 'text-violet-600 hover:text-violet-800',  ring: 'ring-violet-300' },
  amber:   { head: 'bg-amber-50',   hover: 'hover:bg-amber-100/70',   title: 'text-amber-700',   btn: 'text-amber-600 hover:text-amber-800',   ring: 'ring-amber-300' },
};

// Bloc poste : en-tête coloré (identité du poste, on garde les couleurs des ressources).
// Si onHeaderClick est fourni, l'en-tête devient cliquable → filtre la bibliothèque sur ce poste.
function Block({ title, accent = 'orange', onAdd, addLabel, children, onHeaderClick, active = false, collapsed = false }) {
  const a = ACCENT[accent] || ACCENT.orange;
  const clickable = !!onHeaderClick;
  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${active ? `ring-2 ${a.ring} border-transparent` : 'border-gray-200/60'}`}>
      <div
        className={`flex items-center justify-between px-3 py-2 ${collapsed ? '' : 'border-b border-gray-200/60'} ${a.head} ${clickable ? `cursor-pointer ${a.hover} transition-colors` : ''}`}
        onClick={onHeaderClick}
        title={clickable ? 'Filtrer la bibliothèque sur ce poste' : undefined}
      >
        <h4 className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${a.title}`}>
          {clickable && <Filter size={11} />}{title}
          {collapsed && <span className="font-semibold normal-case tracking-normal text-[10px] opacity-50">· vide</span>}
        </h4>
        <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className={`flex items-center gap-1 text-[11px] font-semibold ${a.btn}`}>
          <Plus size={13} /> {addLabel}
        </button>
      </div>
      {!collapsed && <div className="overflow-x-auto">{children}</div>}
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

export function RessourceTable({ title, addLabel, lines, onChange, duree = 0, accent = 'orange', onHeaderClick, active, collapseEmpty }) {
  const { add, upd, del } = useOps(lines, onChange);
  const collapsed = collapseEmpty && !(lines || []).length;
  return (
    <Block title={title} accent={accent} addLabel={addLabel} onAdd={() => add(newRessourceLine())} onHeaderClick={onHeaderClick} active={active} collapsed={collapsed}>
      {!collapsed && (
      <div className="min-w-[740px]">
        <div className={`${RES_COLS} px-2 py-1.5 border-b border-gray-200/60`}>
          <Th>Désignation</Th><Th className="text-center">Nb</Th><Th className="text-center">Durée</Th>
          <Th className="text-right">Perso.</Th><Th className="text-right">Amort.</Th><Th className="text-right">Entret.</Th>
          <Th className="text-right">Cons.</Th><Th className="text-right">Loc.</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => (
            <div key={l.id} className={`group ${RES_COLS} px-2 py-1 border-b border-gray-100 hover:bg-gray-50/50`}>
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
      )}
    </Block>
  );
}

// ─── Fournitures ──────────────────────────────────────────────────────────────
const FOUR_COLS = 'grid grid-cols-[1fr_44px_64px_64px_78px_78px_78px_92px_28px] gap-1 items-center';

export function FournitureTable({ lines, onChange, qteOuvrage, accent = 'emerald', onHeaderClick, active, collapseEmpty }) {
  const { add, upd, del } = useOps(lines, onChange);
  const collapsed = collapseEmpty && !(lines || []).length;
  return (
    <Block title="Fournitures" accent={accent} addLabel="Fourniture" onAdd={() => add(newFournitureLine())} onHeaderClick={onHeaderClick} active={active} collapsed={collapsed}>
      {!collapsed && (
      <div className="min-w-[700px]">
        <div className={`${FOUR_COLS} px-2 py-1.5 border-b border-gray-200/60`}>
          <Th>Désignation</Th><Th className="text-center">U</Th><Th className="text-right">Épaiss.</Th><Th className="text-right">Densité</Th>
          <Th className="text-right">Qté</Th><Th className="text-right">PU barème</Th><Th className="text-right">PU forcé</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => {
          const auto = Number(l.epaisseur) > 0 && Number(l.densite) > 0;
          const qte = fournitureQty(l, qteOuvrage);
          return (
            <div key={l.id} className={`group ${FOUR_COLS} px-2 py-1 border-b border-gray-100 hover:bg-gray-50/50`}>
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
      )}
    </Block>
  );
}

// ─── Sous-traitance ───────────────────────────────────────────────────────────
const ST_COLS = 'grid grid-cols-[1fr_44px_84px_84px_84px_92px_28px] gap-1 items-center';

export function SousTraitanceTable({ lines, onChange, qteOuvrage = 0, articleUnit = '', accent = 'violet', onHeaderClick, active, collapseEmpty }) {
  const { add, upd, del } = useOps(lines, onChange);
  const collapsed = collapseEmpty && !(lines || []).length;
  return (
    <Block title="Sous-traitance" accent={accent} addLabel="Sous-traitant" onAdd={() => add(newSousTraitanceLine({ unit: articleUnit || 'U' }))} onHeaderClick={onHeaderClick} active={active} collapsed={collapsed}>
      {!collapsed && (
      <div className="min-w-[560px]">
        <div className={`${ST_COLS} px-2 py-1.5 border-b border-gray-200/60`}>
          <Th>Désignation</Th><Th className="text-center">U</Th><Th className="text-right">Qté</Th>
          <Th className="text-right">PU barème</Th><Th className="text-right">PU forcé</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => (
          <div key={l.id} className={`group ${ST_COLS} px-2 py-1 border-b border-gray-100 hover:bg-gray-50/50`}>
            <TxtCell value={l.designation} onCommit={(v) => upd(l.id, { designation: v })} placeholder="Désignation" className="font-semibold text-slate-700" />
            <TxtCell value={l.unit} upper onCommit={(v) => upd(l.id, { unit: v })} className="text-center" />
            <AutoNumCell value={l.qte} auto={qteOuvrage} onCommit={(v) => upd(l.id, { qte: v })} />
            <NumCell value={l.puBareme} onCommit={(v) => upd(l.id, { puBareme: v })} />
            <NumCell value={l.puForce} onCommit={(v) => upd(l.id, { puForce: v })} placeholder="—" />
            <div className="text-right text-[11px] font-mono font-bold text-slate-900 px-1">{fmt2(sousTraitanceCost(l, qteOuvrage))}</div>
            <DelBtn onClick={() => del(l.id)} />
          </div>
        ))}
        {(!lines || lines.length === 0) && <div className="px-3 py-2 text-[10px] italic text-slate-400">Aucune ligne</div>}
      </div>
      )}
    </Block>
  );
}

// ─── Transport ────────────────────────────────────────────────────────────────
// (Transport ci-dessous, puis le dispatcher PosteTable en fin de fichier.)
// Contenance/voyage + voyages/jour → nombre de camions selon la quantité à transporter.
const TRANS_COLS = 'grid grid-cols-[1fr_44px_60px_60px_74px_56px_84px_60px_92px_28px] gap-1 items-center';

export function TransportTable({ lines, onChange, qteOuvrage = 0, duree = 0, accent = 'amber', onHeaderClick, active, collapseEmpty }) {
  const { add, upd, del } = useOps(lines, onChange);
  const collapsed = collapseEmpty && !(lines || []).length;
  return (
    <Block title="Transport" accent={accent} addLabel="Transport" onAdd={() => add(newTransportLine())} onHeaderClick={onHeaderClick} active={active} collapsed={collapsed}>
      {!collapsed && (
      <div className="min-w-[800px]">
        <div className={`${TRANS_COLS} px-2 py-1.5 border-b border-gray-200/60`}>
          <Th>Désignation</Th><Th className="text-center">U</Th><Th className="text-right">Épaiss.</Th><Th className="text-right">Densité</Th>
          <Th className="text-right">Contenance</Th><Th className="text-right">Voy./j</Th><Th className="text-right">Coût/j</Th>
          <Th className="text-right">Camions</Th><Th className="text-right">Total</Th><Th />
        </div>
        {(lines || []).map(l => (
          <div key={l.id} className={`group ${TRANS_COLS} px-2 py-1 border-b border-gray-100 hover:bg-gray-50/50`}>
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
      )}
    </Block>
  );
}

// ─── Dispatcher partagé ───────────────────────────────────────────────────────
// Métadonnées d'affichage par poste (titre, libellé d'ajout, accent couleur).
const POSTE_TABLE_META = {
  materiel:      { title: 'Matériel (+ chauffeur)',   addLabel: 'Matériel',      accent: 'orange' },
  mo:            { title: "Main d'œuvre (+ véhicule)", addLabel: 'Personnel',     accent: 'blue' },
  fourniture:    { title: 'Fournitures',              addLabel: 'Fourniture',    accent: 'emerald' },
  soustraitance: { title: 'Sous-traitance',           addLabel: 'Sous-traitant', accent: 'violet' },
  transport:     { title: 'Transport',                addLabel: 'Transport',     accent: 'amber' },
};

// Rend la table d'un poste — partagé entre la vue à onglets (un seul poste) et la
// modale « toutes les ressources » (les 5 empilés). `onChangeBlock(poste)` renvoie le
// handler onChange(lines) du bloc.
export function PosteTable({ poste, detail, onChangeBlock, qte = 0, duree = 0, articleUnit = '', onHeaderClick, active = false, collapseEmpty = false }) {
  const m = POSTE_TABLE_META[poste];
  if (!m) return null;
  const common = { accent: m.accent, onHeaderClick, active, collapseEmpty };
  switch (poste) {
    case 'materiel':
    case 'mo':
      return <RessourceTable title={m.title} addLabel={m.addLabel} lines={detail[poste]} onChange={onChangeBlock(poste)} duree={duree} {...common} />;
    case 'fourniture':
      return <FournitureTable lines={detail.fourniture} onChange={onChangeBlock('fourniture')} qteOuvrage={qte} {...common} />;
    case 'soustraitance':
      return <SousTraitanceTable lines={detail.soustraitance} onChange={onChangeBlock('soustraitance')} qteOuvrage={qte} articleUnit={articleUnit} {...common} />;
    case 'transport':
      return <TransportTable lines={detail.transport} onChange={onChangeBlock('transport')} qteOuvrage={qte} duree={duree} {...common} />;
    default:
      return null;
  }
}
