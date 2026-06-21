// src/views/estimaTp/sousDetail/TpSousDetailEditor.jsx
// ESTIMA TP — éditeur de sous-détail d'un article (rendement/durée + 5 postes + PV).
import React from 'react';
import { Gauge, Lock, Unlock, BookOpen } from 'lucide-react';
import { NumCell } from './sdShared';
import { fmt, fmt2 } from './sdFormat';
import { RessourceTable, FournitureTable, SousTraitanceTable, TransportTable } from './TpDetailTables';
import { emptyDetail, computeDetail, effectiveDuree, POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';

export default function TpSousDetailEditor({ item, coef, onChange, libraryOpen, onToggleLibrary }) {
  const detail = item.detail || emptyDetail();
  const qte = Number(item.qty || 0);
  const r = computeDetail(detail, qte, coef);
  const duree = effectiveDuree(detail, qte);

  const patch = (p) => onChange({ ...detail, ...p });
  const setBlock = (key) => (lines) => onChange({ ...detail, [key]: lines });

  return (
    <div className="space-y-4">
      {/* En-tête article + rendement / durée */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Article</p>
              {onToggleLibrary && (
                <button onClick={onToggleLibrary}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${libraryOpen ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  title="Insérer des ressources depuis la bibliothèque">
                  <BookOpen size={11} /> Bibliothèque
                </button>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 truncate">{item.designation || 'Article sans nom'}</h3>
            <p className="text-xs text-slate-400">Quantité d'ouvrage : <span className="font-semibold text-slate-700">{qte.toLocaleString('fr-FR')} {item.unit}</span></p>
          </div>
          <div className="flex items-end gap-4">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rendement / jour</span>
              <div className="flex items-center gap-1.5">
                <Gauge size={15} className="text-orange-500" />
                <div className="w-28"><NumCell value={detail.rendement} onCommit={(v) => patch({ rendement: v })} placeholder="0" /></div>
                <span className="text-[11px] text-slate-400">{item.unit}/j</span>
              </div>
            </label>
            <label className="block">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Durée (j)
                <button onClick={() => patch({ dureeForced: !detail.dureeForced, duree: detail.dureeForced ? detail.duree : duree })}
                  className="text-slate-400 hover:text-orange-500" title={detail.dureeForced ? 'Durée forcée (cliquer pour auto)' : 'Durée auto = quantité / rendement (cliquer pour forcer)'}>
                  {detail.dureeForced ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
              </span>
              {detail.dureeForced
                ? <div className="w-24"><NumCell value={detail.duree} onCommit={(v) => patch({ duree: v })} /></div>
                : <div className="w-24 text-right text-sm font-mono font-bold text-slate-700 px-1 py-0.5">{duree.toLocaleString('fr-FR')}</div>}
            </label>
          </div>
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

      {/* Les 5 postes */}
      <RessourceTable title="Matériel (+ chauffeur)" accent="orange" addLabel="Matériel" lines={detail.materiel} onChange={setBlock('materiel')} />
      <RessourceTable title="Main d'œuvre (+ véhicule)" accent="sky" addLabel="Personnel" lines={detail.mo} onChange={setBlock('mo')} />
      <FournitureTable lines={detail.fourniture} onChange={setBlock('fourniture')} qteOuvrage={qte} />
      <SousTraitanceTable lines={detail.soustraitance} onChange={setBlock('soustraitance')} />
      <TransportTable lines={detail.transport} onChange={setBlock('transport')} />
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
