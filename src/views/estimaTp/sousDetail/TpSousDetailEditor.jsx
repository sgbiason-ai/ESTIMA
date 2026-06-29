// src/views/estimaTp/sousDetail/TpSousDetailEditor.jsx
// ESTIMA TP — éditeur de sous-détail d'un article (rendement/durée + 5 postes + PV).
// Mise en page « 1 écran sans scroll » : bandeau récap figé en haut, puis les
// 5 postes en onglets (segmented control) — un seul poste affiché à la fois.
import React, { useState } from 'react';
import { Wrench, Users, ShoppingCart, HardHat, Truck, LayoutGrid, AlertTriangle, ChevronDown } from 'lucide-react';
import { NumCell } from './sdShared';
import { fmt, fmt2 } from './sdFormat';
import { ArticleMetaTiles } from './TpArticleMeta';
import { PosteTable } from './TpDetailTables';
import { emptyDetail, computeDetail, effectiveDuree, effectiveRendement, detailCalcQty, POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';

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

export default function TpSousDetailEditor({ item, coef, onChange, onQtyChange, onUnitChange, activePoste, onSelectPoste, onShowAll }) {
  const detail = item.detail || emptyDetail();
  const [showRecap, setShowRecap] = useState(false); // repli « Détails » du récap (allégé par défaut)
  const forced = detail.pvForce != null && detail.pvForce !== ''; // PU de vente imposé
  const qte = Number(item.qty || 0);              // quantité du cadre (bordereau)
  const qteCalc = detailCalcQty(detail, qte);     // quantité de calcul (rendement/durée)
  const r = computeDetail(detail, qte, coef);
  const duree = effectiveDuree(detail, qteCalc);

  // Alerte (non bloquante) : ressources Matériel/MO présentes mais aucune durée globale
  // (ni rendement, ni durée forcée) → leurs coûts restent à 0. On ignore les lignes ayant
  // leur propre durée forcée (elles ne dépendent pas du rendement global).
  const timeLines = [...(detail.materiel || []), ...(detail.mo || [])];
  const rendementMissing = duree <= 0 && timeLines.some(l => !l.dureeForced);

  // Poste actif : source de vérité dans le parent → onglet affiché + filtre bibliothèque.
  const poste = activePoste || 'materiel';

  const patch = (p) => onChange({ ...detail, ...p });
  const setBlock = (key) => (lines) => onChange({ ...detail, [key]: lines });

  return (
    <div className="flex flex-col">
      {/* Bloc résumé FIGÉ (sticky) : en-tête article + récap (la ventilation par poste
          est fusionnée dans les onglets ci-dessous). */}
      <div className="sticky top-0 z-20 bg-[#f5f5f7] pt-2 pb-2 space-y-1.5 border-b border-slate-200/70">
      {/* Métadonnées d'article : Quantité / Qté calcul / Rendt / Durée. Le nom de la tâche est
          déjà porté par le navigateur ci-dessus → on ne le répète pas ici. Tuiles partagées
          avec la modale « toutes les ressources ». */}
      <ArticleMetaTiles unit={item.unit} qte={qte} calcQte={detail.qteCalcul} calcUnit={detail.uniteCalcul}
        rendement={effectiveRendement(detail, qteCalc)} duree={duree} rendementMissing={rendementMissing}
        dureeForced={detail.dureeForced} onQtyChange={(v) => onQtyChange?.(v)}
        onUnitChange={(v) => onUnitChange?.(v)} onPatch={patch} />

      {/* Alerte non bloquante : rendement/durée manquant alors que des ressources temps existent. */}
      {rendementMissing && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="text-[11px] font-semibold">Rendement (ou durée) manquant — les coûts Matériel / Main d'œuvre restent à 0.</span>
        </div>
      )}

      {/* Bandeau récap allégé : PU de vente (résultat) + déboursé sec mis en avant,
          répartition dans une barre unique, le reste replié sous « Détails ». */}
      <div className="space-y-1.5">
        <div className="flex items-stretch gap-2">
          {/* Résultat principal : PU déboursé sec (déboursé sec unitaire) */}
          <div className="flex-1 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700/70">
              PU déboursé sec
            </p>
            <p className="font-mono font-black text-orange-700 leading-tight">
              <span className="text-xl">{fmt2(r.puSec)}</span>
              <span className="text-xs font-semibold text-orange-700/60"> /{item.unit}</span>
            </p>
          </div>
          {/* Déboursé sec total */}
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 min-w-[116px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Déboursé sec</p>
            <p className="text-base font-mono font-black text-slate-900 leading-tight mt-0.5">{fmt(r.deboursecSec)}</p>
          </div>
          {/* Toggle « Détails » : total vente · PU sec · PU forcé */}
          <button onClick={() => setShowRecap(s => !s)} title="Total vente, PU vente, PU forcé"
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            {forced && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wide">PV imposé</span>}
            Détails <ChevronDown size={13} className={`transition-transform ${showRecap ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Barre de répartition unique (remplace les 6 mini-jauges des onglets) */}
        <RepartitionBar r={r} />

        {/* Repli détails */}
        {showRecap && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Total vente" value={fmt(r.totalVente)} tone="emerald" />
            <Stat label="PU vente" value={fmt2(r.puVente)} sub={`par ${item.unit}`} tone="orange" />
            <ForcedTile detail={detail} unit={item.unit} onChange={patch} />
          </div>
        )}
      </div>

      </div>

      {/* Sélecteur de poste — segmented control sobre (icône colorée + nom + compteur).
          La répartition financière vit désormais dans la barre unique ci-dessus ; le
          montant/% par poste reste accessible au survol (title). Un seul poste à la fois. */}
      <div className="pt-3">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex gap-0.5 bg-gray-100 p-0.5 rounded-xl overflow-x-auto">
            {POSTES.map(p => {
              const active = p === poste;
              const Icon = POSTE_ICONS[p];
              const count = (detail[p] || []).length;
              const pct = r.deboursecSec > 0 ? r.ratios[p] * 100 : 0;
              return (
                <button key={p} onClick={() => onSelectPoste?.(p)}
                  title={`${POSTE_LABELS[p]} : ${fmt(r.sec[p])} · ${pct.toFixed(0)}%`}
                  className={`flex-1 min-w-[96px] flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Icon size={14} strokeWidth={active ? 2 : 1.5} className={POSTE_TEXT[p]} />
                  <span className="truncate">{POSTE_LABELS[p]}</span>
                  {count > 0 && (
                    <span className={`shrink-0 px-1.5 rounded-full text-[9px] font-bold ${active ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* « Toutes » : action ponctuelle → ouvre la modale des 5 postes empilés. */}
          <button onClick={onShowAll} title="Voir toutes les ressources de la tâche"
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 px-3 py-2 text-xs font-bold text-gray-600 transition-all">
            <LayoutGrid size={14} strokeWidth={1.5} /> Toutes
          </button>
        </div>

        {/* Table du poste actif uniquement */}
        <div className="pt-3">
          <PosteTable poste={poste} detail={detail} onChangeBlock={setBlock}
            qte={qteCalc} duree={duree} articleUnit={detail.uniteCalcul || item.unit}
            onHeaderClick={() => onSelectPoste?.(poste)} />
        </div>
      </div>
    </div>
  );
}

// Barre de répartition unique du déboursé sec entre postes (remplace les jauges par onglet).
// N'affiche que les postes effectivement présents ; légende qui passe à la ligne au besoin.
function RepartitionBar({ r }) {
  if (!(r.deboursecSec > 0)) return null;
  const parts = POSTES.filter(p => r.ratios[p] > 0);
  if (!parts.length) return null;
  return (
    <div className="space-y-1">
      <span className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100">
        {parts.map(p => (
          <span key={p} className={POSTE_COLORS[p]} style={{ width: `${r.ratios[p] * 100}%` }}
            title={`${POSTE_LABELS[p]} · ${fmt(r.sec[p])}`} />
        ))}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {parts.map(p => (
          <span key={p} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full ${POSTE_COLORS[p]}`} />
            {POSTE_LABELS[p]} <span className="text-slate-400">{(r.ratios[p] * 100).toFixed(0)}%</span>
          </span>
        ))}
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
