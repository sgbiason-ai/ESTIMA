// src/views/estimaTp/sousDetail/TpSousDetailEditor.jsx
// ESTIMA TP — éditeur de sous-détail d'un article (rendement/durée + 5 postes + PV).
// Mise en page « 1 écran sans scroll » : bandeau récap figé en haut, puis les
// 5 postes en onglets (segmented control) — un seul poste affiché à la fois.
import React from 'react';
import { Hammer, Wrench, Users, ShoppingCart, HardHat, Truck, LayoutGrid } from 'lucide-react';
import { NumCell } from './sdShared';
import { fmt, fmt2 } from './sdFormat';
import { ArticleMetaTiles } from './TpArticleMeta';
import { PosteTable } from './TpDetailTables';
import { emptyDetail, computeDetail, effectiveDuree, effectiveRendement, POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';

// Couleurs par poste (classes littérales — requis par le JIT Tailwind) — barre de répartition
const POSTE_COLORS = {
  materiel: 'bg-orange-500',
  mo: 'bg-blue-500',
  fourniture: 'bg-emerald-500',
  soustraitance: 'bg-violet-500',
  transport: 'bg-amber-500',
};

// Icône par poste (onglets) — façon mockup
const POSTE_ICONS = {
  materiel: Wrench,
  mo: Users,
  fourniture: ShoppingCart,
  soustraitance: HardHat,
  transport: Truck,
};

// Couleur de texte par poste (icône d'onglet = clé de légende du graphique fusionné)
const POSTE_TEXT = {
  materiel: 'text-orange-500',
  mo: 'text-blue-500',
  fourniture: 'text-emerald-500',
  soustraitance: 'text-violet-500',
  transport: 'text-amber-500',
};

export default function TpSousDetailEditor({ item, coef, onChange, onQtyChange, activePoste, onSelectPoste, onShowAll }) {
  const detail = item.detail || emptyDetail();
  const qte = Number(item.qty || 0);
  const r = computeDetail(detail, qte, coef);
  const duree = effectiveDuree(detail, qte);

  // Poste actif : source de vérité dans le parent → onglet affiché + filtre bibliothèque.
  const poste = activePoste || 'materiel';

  const patch = (p) => onChange({ ...detail, ...p });
  const setBlock = (key) => (lines) => onChange({ ...detail, [key]: lines });

  return (
    <div className="flex flex-col">
      {/* Bloc résumé FIGÉ (sticky) : en-tête article + récap (la ventilation par poste
          est fusionnée dans les onglets ci-dessous). */}
      <div className="sticky top-0 z-20 bg-[#f5f5f7] pt-2 pb-2 space-y-1.5 border-b border-slate-200/70">
      {/* En-tête article — compact : désignation + quantité / rendement / durée sur une ligne */}
      <div className="relative bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-lg py-1.5 pl-3 pr-2 shadow-sm overflow-hidden flex items-center gap-2 flex-wrap">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />

        {/* Désignation + badge sur UNE ligne */}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest shrink-0">
            <Hammer size={10} /> Article
          </span>
          <h3 className="text-sm font-black text-slate-900 leading-tight tracking-tight truncate">
            {item.designation || 'Article sans nom'}
          </h3>
        </div>

        {/* Tuiles Quantité / Rendt / Durée (partagées avec la modale « toutes les ressources ») */}
        <ArticleMetaTiles unit={item.unit} qte={qte} rendement={effectiveRendement(detail, qte)} duree={duree}
          dureeForced={detail.dureeForced} onQtyChange={(v) => onQtyChange?.(v)} onPatch={patch} />
      </div>

      {/* Bandeau récap : total déboursé sec · total vente · PU sec · PU vente · PU forcé */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Stat label="Total déboursé sec" value={fmt(r.deboursecSec)} tone="slate" />
        <Stat label="Total vente" value={fmt(r.totalVente)} tone="emerald" />
        <Stat label="PU sec" value={fmt2(r.puSec)} sub={`par ${item.unit}`} tone="slate" />
        <Stat label="Prix unitaire vente" value={fmt2(r.puVente)} sub={`par ${item.unit}`} tone="orange" />
        <ForcedTile detail={detail} unit={item.unit} onChange={patch} />
      </div>

      </div>

      {/* Onglets-graphique fusionnés : chaque poste = une mini-barre (montant + % + jauge
          proportionnelle au déboursé sec) qui sert aussi de sélecteur de la table ci-dessous.
          Un seul poste affiché à la fois → pas de scroll. */}
      <div className="pt-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {POSTES.map(p => {
            const active = p === poste;
            const Icon = POSTE_ICONS[p];
            const count = (detail[p] || []).length;
            const pct = r.deboursecSec > 0 ? r.ratios[p] * 100 : 0;
            return (
              <button key={p} onClick={() => onSelectPoste?.(p)} title={`${POSTE_LABELS[p]} : ${fmt(r.sec[p])} · ${pct.toFixed(0)}%`}
                className={`flex-1 min-w-[128px] rounded-xl border px-3 py-2 text-left transition-all ${active ? 'bg-white border-gray-300 shadow-sm' : 'bg-gray-50 border-transparent hover:bg-white/70'}`}>
                <span className="flex items-center gap-1.5">
                  <Icon size={14} strokeWidth={active ? 2 : 1.5} className={POSTE_TEXT[p]} />
                  <span className={`text-xs font-bold truncate ${active ? 'text-gray-900' : 'text-gray-500'}`}>{POSTE_LABELS[p]}</span>
                  {count > 0 && (
                    <span className={`ml-auto shrink-0 px-1.5 rounded-full text-[9px] font-bold ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
                  )}
                </span>
                <span className="flex items-baseline justify-between mt-1">
                  <span className={`text-[13px] font-mono font-bold ${active ? 'text-gray-900' : 'text-gray-600'}`}>{fmt(r.sec[p])}</span>
                  <span className="text-[10px] font-semibold text-gray-400 shrink-0 ml-1">{pct.toFixed(0)}%</span>
                </span>
                <span className="mt-1 block h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <span className={`block h-full rounded-full ${POSTE_COLORS[p]}`} style={{ width: `${pct}%` }} />
                </span>
              </button>
            );
          })}

          {/* 6ᵉ onglet « Toutes » : ouvre la modale des 5 postes empilés. Aligné avec les
              autres onglets (mêmes dimensions), n'est jamais « actif » (action ponctuelle). */}
          <button onClick={onShowAll} title="Voir toutes les ressources de la tâche"
            className="flex-1 min-w-[128px] rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-white hover:border-gray-400 px-3 py-2 text-left transition-all">
            <span className="flex items-center gap-1.5">
              <LayoutGrid size={14} strokeWidth={1.5} className="text-gray-500" />
              <span className="text-xs font-bold truncate text-gray-700">Toutes</span>
              <span className="ml-auto shrink-0 px-1.5 rounded-full text-[9px] font-bold bg-gray-200 text-gray-500">{POSTES.length}</span>
            </span>
            <span className="flex items-baseline justify-between mt-1">
              <span className="text-[13px] font-mono font-bold text-gray-900">{fmt(r.deboursecSec)}</span>
              <span className="text-[10px] font-semibold text-gray-400 shrink-0 ml-1">total</span>
            </span>
            <span className="mt-1 block h-1.5 w-full rounded-full bg-gray-100 overflow-hidden flex">
              {POSTES.map(p => (r.ratios[p] > 0
                ? <span key={p} className={`block h-full ${POSTE_COLORS[p]}`} style={{ width: `${r.ratios[p] * 100}%` }} />
                : null))}
            </span>
          </button>
        </div>

        {/* Table du poste actif uniquement */}
        <div className="pt-3">
          <PosteTable poste={poste} detail={detail} onChangeBlock={setBlock}
            qte={qte} duree={duree} articleUnit={item.unit}
            onHeaderClick={() => onSelectPoste?.(poste)} />
        </div>
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

// PU forcé : prix de vente unitaire imposé (vide = prix calculé). Pilote le PU retenu.
function ForcedTile({ detail, unit, onChange }) {
  const forced = detail.pvForce != null && detail.pvForce !== '';
  return (
    <div className={`rounded-2xl border p-3 ${forced ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-slate-300 bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PU forcé</p>
      <div className="flex items-baseline gap-1 mt-0.5">
        <div className="flex-1 min-w-0">
          <NumCell value={detail.pvForce} onCommit={(v) => onChange({ pvForce: Number(v) > 0 ? v : null })} align="left" placeholder="—"
            className="!border-0 !bg-transparent !px-0 !py-0 !text-lg !font-black !text-emerald-700" />
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-slate-400">/{unit}</span>
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5">{forced ? 'Prix imposé' : 'vide = calculé'}</p>
    </div>
  );
}
