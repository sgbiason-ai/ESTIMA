// src/views/estimaTp/MargesTab.jsx
// ESTIMA TP — onglet « Marges » : coefficients de vente par poste (déboursé → PV).
import React from 'react';
import { Percent, RotateCcw } from 'lucide-react';
import { POSTES, POSTE_LABELS, defaultCoefficients, DEFAULT_COEF, computeDetail } from '../../utils/tp/tpPriceCompute';

export default function MargesTab({ study, setStudy }) {
  const coef = study?.coefficients || defaultCoefficients();

  // Changer un coefficient recalcule le PU retenu de tous les articles déjà chiffrés.
  const setCoef = (next) => {
    const chapters = JSON.parse(JSON.stringify(study?.cadre?.chapters || []));
    const walk = (arr) => arr.forEach(n => {
      if (n.type === 'item' && n.detail) n.price = computeDetail(n.detail, Number(n.qty || 0), next).puRetenu;
      if (n.children) walk(n.children);
    });
    walk(chapters);
    setStudy(prev => ({ ...prev, coefficients: next, cadre: { ...(prev?.cadre || {}), chapters } }));
  };
  const setOne = (p, v) => setCoef({ ...coef, [p]: v });
  const setAll = (v) => setCoef(POSTES.reduce((o, p) => ({ ...o, [p]: v }), {}));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Percent size={16} className="text-orange-500" /> Coefficients de vente</h3>
              <p className="text-xs text-slate-400 mt-0.5">Appliqués au déboursé sec de chaque poste pour obtenir le prix de vente. Ex : 1,15 = +15 %.</p>
            </div>
            <button onClick={() => setAll(DEFAULT_COEF)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all" title="Réinitialiser tous les coefficients à 1,15">
              <RotateCcw size={13} /> 1,15 partout
            </button>
          </div>

          <div className="space-y-2">
            {POSTES.map(p => {
              const val = Number(coef[p] ?? DEFAULT_COEF);
              const pct = Math.round((val - 1) * 100);
              return (
                <div key={p} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="flex-1 text-sm font-semibold text-slate-700">{POSTE_LABELS[p]}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{pct >= 0 ? '+' : ''}{pct} %</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={val}
                    onChange={(e) => setOne(p, Number(e.target.value) || 0)}
                    className="w-24 bg-white border border-slate-200 focus:border-orange-500 rounded-lg px-2 py-1.5 text-right text-sm font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 px-1">
          Le coefficient global du fichier (Données de Base) est décomposé ici par poste. Modifier un coefficient recalcule
          immédiatement le prix de vente de tous les articles dont le sous-détail utilise ce poste.
        </p>
      </div>
    </div>
  );
}
