// src/views/estimaTp/sousDetail/TpSousDetailEditor.jsx
// ESTIMA TP — éditeur de sous-détail d'un article (rendement/durée + 5 postes + PV).
import React from 'react';
import { Gauge, Lock, Unlock, BookOpen, Hammer, Ruler, Clock } from 'lucide-react';
import { NumCell } from './sdShared';
import { fmt, fmt2 } from './sdFormat';
import { RessourceTable, FournitureTable, SousTraitanceTable, TransportTable } from './TpDetailTables';
import { emptyDetail, computeDetail, effectiveDuree, POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';

export default function TpSousDetailEditor({ item, coef, onChange, onQtyChange, libraryOpen, onToggleLibrary, onActivePoste }) {
  const detail = item.detail || emptyDetail();
  const qte = Number(item.qty || 0);
  const r = computeDetail(detail, qte, coef);
  const duree = effectiveDuree(detail, qte);

  const patch = (p) => onChange({ ...detail, ...p });
  const setBlock = (key) => (lines) => onChange({ ...detail, [key]: lines });
  // Tout clic/focus dans un bloc signale le poste actif → le volet bibliothèque s'y filtre.
  const blockProps = (poste) => ({
    onMouseDownCapture: () => onActivePoste?.(poste),
    onFocusCapture: () => onActivePoste?.(poste),
  });

  return (
    <div className="space-y-4">
      {/* En-tête article — bloc prioritaire (désignation + quantité / rendement / durée) */}
      <div className="relative bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-2xl p-5 pl-6 shadow-sm overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />

        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
            <Hammer size={12} /> Article à chiffrer
          </span>
          {onToggleLibrary && (
            <button onClick={onToggleLibrary}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${libraryOpen ? 'bg-orange-600 text-white shadow-sm' : 'bg-white border border-orange-200 text-orange-600 hover:bg-orange-100'}`}
              title="Insérer des ressources depuis la bibliothèque">
              <BookOpen size={13} /> Bibliothèque
            </button>
          )}
        </div>

        <h3 className="text-xl font-black text-slate-900 leading-tight tracking-tight mb-4 line-clamp-2">
          {item.designation || 'Article sans nom'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Quantité d'ouvrage */}
          <HeaderTile icon={Ruler} label="Quantité d'ouvrage" unit={item.unit}>
            <NumCell value={qte} onCommit={(v) => onQtyChange?.(v)} align="left"
              className="!border-0 !bg-transparent !px-0 !py-0 !text-2xl !font-black !text-slate-900" />
          </HeaderTile>

          {/* Rendement / jour */}
          <HeaderTile icon={Gauge} label="Rendement / jour" unit={`${item.unit}/j`}>
            <NumCell value={detail.rendement} onCommit={(v) => patch({ rendement: v })} placeholder="0" align="left"
              className="!border-0 !bg-transparent !px-0 !py-0 !text-2xl !font-black !text-orange-700" />
          </HeaderTile>

          {/* Durée */}
          <HeaderTile
            icon={Clock}
            label="Durée (jours)"
            unit={detail.dureeForced ? 'forcée' : 'auto'}
            action={
              <button onClick={() => patch({ dureeForced: !detail.dureeForced, duree: detail.dureeForced ? detail.duree : duree })}
                className={`p-0.5 rounded ${detail.dureeForced ? 'text-orange-600' : 'text-slate-400 hover:text-orange-500'}`}
                title={detail.dureeForced ? 'Durée forcée (cliquer pour repasser en calcul auto)' : 'Durée calculée = quantité / rendement (cliquer pour forcer)'}>
                {detail.dureeForced ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            }>
            {detail.dureeForced
              ? <NumCell value={detail.duree} onCommit={(v) => patch({ duree: v })} align="left"
                  className="!border-0 !bg-transparent !px-0 !py-0 !text-2xl !font-black !text-orange-700" />
              : <span className="text-2xl font-black font-mono text-slate-900 leading-none">{duree.toLocaleString('fr-FR')}</span>}
          </HeaderTile>
        </div>
      </div>

      {/* Bandeau récap */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Déboursé sec" value={fmt(r.deboursecSec)} sub={`PU sec ${fmt2(r.puSec)}/${item.unit}`} tone="slate" />
        <Stat label="PV calculé / U" value={`${fmt2(r.puVente)}`} sub={`Total ${fmt(r.pvTotalTache)}`} tone="orange" />
        <PvForce detail={detail} puVente={r.puVente} onChange={patch} />
        <Stat label="Total vente" value={fmt(r.totalVente)} sub={`${qte.toLocaleString('fr-FR')} ${item.unit} × ${fmt2(r.puRetenu)}`} tone="emerald" />
      </div>

      {/* Répartition par poste (sec) */}
      <div className="flex flex-wrap gap-2">
        {POSTES.map(p => (
          <span key={p} className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-medium text-slate-600">
            {POSTE_LABELS[p]} : <span className="font-bold text-slate-900">{fmt(r.sec[p])}</span>
            {r.deboursecSec > 0 && <span className="text-slate-400"> · {(r.ratios[p] * 100).toFixed(0)}%</span>}
          </span>
        ))}
      </div>

      {/* Les 5 postes — chaque bloc signale le poste actif au clic/focus */}
      <div {...blockProps('materiel')}>
        <RessourceTable title="Matériel (+ chauffeur)" accent="orange" addLabel="Matériel" lines={detail.materiel} onChange={setBlock('materiel')} duree={duree} />
      </div>
      <div {...blockProps('mo')}>
        <RessourceTable title="Main d'œuvre (+ véhicule)" accent="sky" addLabel="Personnel" lines={detail.mo} onChange={setBlock('mo')} duree={duree} />
      </div>
      <div {...blockProps('fourniture')}>
        <FournitureTable lines={detail.fourniture} onChange={setBlock('fourniture')} qteOuvrage={qte} />
      </div>
      <div {...blockProps('soustraitance')}>
        <SousTraitanceTable lines={detail.soustraitance} onChange={setBlock('soustraitance')} />
      </div>
      <div {...blockProps('transport')}>
        <TransportTable lines={detail.transport} onChange={setBlock('transport')} duree={duree} />
      </div>
    </div>
  );
}

// Tuile de saisie du header (label + icône + valeur en grand + unité + action)
function HeaderTile({ icon: Icon, label, unit, action, children }) {
  return (
    <div className="bg-white border border-orange-200/70 rounded-xl p-3 transition-shadow focus-within:ring-2 focus-within:ring-orange-200">
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {Icon && <Icon size={12} className="text-orange-500" />}{label}
        </span>
        {action}
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="flex-1 min-w-0">{children}</div>
        {unit && <span className="shrink-0 text-[11px] font-semibold text-slate-400 lowercase">{unit}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-lg font-mono font-black leading-tight">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// PU retenu, avec possibilité de forcer (PV forcé)
function PvForce({ detail, puVente, onChange }) {
  const forced = detail.pvForce != null && detail.pvForce !== '';
  return (
    <div className="rounded-2xl border border-orange-300 bg-white p-3">
      <p className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        PU retenu
        <button onClick={() => onChange({ pvForce: forced ? null : puVente })} className="text-orange-500 hover:text-orange-700" title={forced ? 'Revenir au PV calculé' : 'Forcer le PU de vente'}>
          {forced ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
      </p>
      {forced
        ? <div className="mt-1"><NumCell value={detail.pvForce} onCommit={(v) => onChange({ pvForce: v })} className="!text-base !font-black !text-orange-700" /></div>
        : <p className="text-lg font-mono font-black text-orange-700 leading-tight mt-1">{fmt2(puVente)}</p>}
      <p className="text-[10px] text-slate-400 mt-0.5">{forced ? 'Forcé' : 'Calculé'}</p>
    </div>
  );
}
