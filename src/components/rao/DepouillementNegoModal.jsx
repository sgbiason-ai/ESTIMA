// src/components/rao/DepouillementNegoModal.jsx
//
// Modale « Dépouillement après négociation » — PV des offres finales.
// Pré-remplie avec les entreprises et variantes du dépouillement initial
// (aucune création possible : les soumissionnaires sont ceux des plis initiaux).
// On y saisit les montants annoncés APRÈS négociation (HT), avec rappel du
// montant initial et écart live. La validation active la phase « Après négo ».

import React, { useState, useEffect } from 'react';
import { X, Handshake, GitBranch, Building2, Check, ArrowRight } from 'lucide-react';

const parseAmount = (v) => {
  if (v === '' || v == null) return null;
  const cleaned = String(v).replace(/[\s €]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const fmtEUR = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

// Écart nouveau vs initial (— si l'un des deux manque)
const DeltaBadge = ({ initial, next }) => {
  if (initial == null || next == null || !(initial > 0)) return <span className="text-[11px] text-slate-300">—</span>;
  const delta = next - initial;
  const pct = (delta / initial) * 100;
  if (Math.abs(delta) < 0.01) return <span className="text-[11px] font-bold text-slate-400">=</span>;
  const down = delta < 0;
  return (
    <span className={`text-[11px] font-bold tabular-nums ${down ? 'text-emerald-600' : 'text-red-500'}`}>
      {down ? '' : '+'}{pct.toFixed(2)} %
    </span>
  );
};

export default function DepouillementNegoModal({
  open,
  companies = [],           // analysisCompanies (entreprises + variantes existantes)
  onConfirm,                // (entries) → void — [{ companyId, aeAmountNego, variants: [{ variantId, aeAmountNego }] }]
  onCancel,
}) {
  const [drafts, setDrafts] = useState([]);

  // Pré-remplissage : montants négo existants, sinon champ vide
  useEffect(() => {
    if (!open) return;
    setDrafts(companies.map(c => ({
      companyId: c.id,
      name: c.name,
      aeInitial: c.aeAmount ?? null,
      aeNego: c.aeAmountNego != null ? String(c.aeAmountNego).replace('.', ',') : '',
      variants: (c.variants || []).map((v, i) => ({
        variantId: v.id,
        label: v.label || `Variante ${i + 1}`,
        aeInitial: v.aeAmount ?? v.total ?? null,
        aeNego: v.aeAmountNego != null ? String(v.aeAmountNego).replace('.', ',') : '',
      })),
    })));
  }, [open, companies]);

  if (!open) return null;

  const setCompanyAmount = (companyId, value) =>
    setDrafts(prev => prev.map(d => d.companyId === companyId ? { ...d, aeNego: value } : d));
  const setVariantAmount = (companyId, variantId, value) =>
    setDrafts(prev => prev.map(d => d.companyId !== companyId ? d : {
      ...d,
      variants: d.variants.map(v => v.variantId === variantId ? { ...v, aeNego: value } : v),
    }));

  const handleConfirm = () => {
    onConfirm(drafts.map(d => ({
      companyId: d.companyId,
      aeAmountNego: parseAmount(d.aeNego),
      variants: d.variants.map(v => ({ variantId: v.variantId, aeAmountNego: parseAmount(v.aeNego) })),
    })));
  };

  const filledCount = drafts.filter(d => parseAmount(d.aeNego) != null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200 shrink-0">
          <div className="p-2.5 rounded-2xl bg-emerald-100">
            <Handshake size={20} className="text-emerald-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-slate-900">Dépouillement après négociation</h2>
            <p className="text-[11px] text-slate-500">
              Montants annoncés des offres finales (HT) — entreprises et variantes du dépouillement initial
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-white/70 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </header>

        {/* ── Corps : une carte par entreprise ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50/50">
          {drafts.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              Aucune entreprise — faites d'abord le dépouillement initial.
            </div>
          ) : drafts.map((d, idx) => (
            <div key={d.companyId} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 space-y-2">
              {/* Offre de base */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-emerald-700 text-xs shrink-0">
                  {idx + 1}
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <Building2 size={13} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-extrabold text-slate-900 truncate">{d.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums" title="Montant AE du dépouillement initial">
                  Initial : <strong className="text-slate-600">{fmtEUR(d.aeInitial)}</strong>
                </span>
                <ArrowRight size={12} className="text-slate-300 shrink-0" />
                <div className="relative inline-flex items-center">
                  <input
                    value={d.aeNego}
                    onChange={(e) => setCompanyAmount(d.companyId, e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-36 pl-2.5 pr-5 py-1.5 text-xs text-right font-mono tabular-nums text-slate-900 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:border-emerald-400 focus:ring-emerald-100 transition-all"
                    title="Montant annoncé après négociation (HT)"
                  />
                  <span className="absolute right-2 text-[11px] text-slate-400 pointer-events-none">€</span>
                </div>
                <DeltaBadge initial={d.aeInitial} next={parseAmount(d.aeNego)} />
              </div>

              {/* Variantes */}
              {d.variants.length > 0 && (
                <div className="ml-10 space-y-1.5">
                  {d.variants.map(v => (
                    <div key={v.variantId} className="flex items-center gap-3 flex-wrap px-3 py-1.5 bg-purple-50/40 border border-purple-100 rounded-xl">
                      <GitBranch size={12} className="text-purple-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 flex-1 min-w-[120px] truncate">{v.label}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums" title="Montant initial de la variante (AE annoncé ou total importé)">
                        Initial : <strong className="text-slate-600">{fmtEUR(v.aeInitial)}</strong>
                      </span>
                      <ArrowRight size={12} className="text-slate-300 shrink-0" />
                      <div className="relative inline-flex items-center">
                        <input
                          value={v.aeNego}
                          onChange={(e) => setVariantAmount(d.companyId, v.variantId, e.target.value)}
                          placeholder="0,00"
                          inputMode="decimal"
                          className="w-32 pl-2.5 pr-5 py-1 text-xs text-right font-mono tabular-nums text-slate-900 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:border-purple-400 focus:ring-purple-100 transition-all"
                          title="Montant annoncé après négociation de la variante (HT)"
                        />
                        <span className="absolute right-2 text-[11px] text-slate-400 pointer-events-none">€</span>
                      </div>
                      <DeltaBadge initial={v.aeInitial} next={parseAmount(v.aeNego)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between gap-3 px-6 py-4 bg-white border-t border-slate-200 shrink-0">
          <span className="text-[11px] text-slate-400">
            {filledCount}/{drafts.length} montant(s) après négo renseigné(s) — les entreprises sans montant conservent leur offre initiale
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={drafts.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-40"
            >
              <Check size={15} />
              Valider le PV après négo
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
