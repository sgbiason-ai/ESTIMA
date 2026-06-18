/* eslint-disable react-refresh/only-export-components -- fichier mêlant volontairement composants et helpers/constantes (règle DX Fast-Refresh, sans impact fonctionnel) */
// src/views/devisMoe/devisMoeHelpers.jsx
// Helpers de calcul, styles et composants partagés pour le module Devis MOE
import React from 'react';
import { formatPrice, generateId } from '../../utils/helpers';

// ─── Helpers calcul ──────────────────────────────────────────────────────────
export const pct = (lot, tauxGlobal) =>
  (parseFloat(lot.montantTravauxHT) || 0) * (parseFloat(tauxGlobal) || 0) / 100;

export const honPhasePct = (honLot, repartition, phaseId) => {
  const r = (repartition || []).find(r => r.phaseId === phaseId);
  return honLot * (parseFloat(r?.pourcentage) || 0) / 100;
};

export const honPhaseTemps = (lot, phaseId, categories) => {
  const pt = (lot.phasesTemps || []).find(p => p.phaseId === phaseId);
  if (!pt) return 0;
  if (pt.sousTaches?.length > 0) {
    return pt.sousTaches.reduce((total, st) =>
      total + (categories || []).reduce((s, c) =>
        s + (parseFloat(st.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
  }
  return (categories || []).reduce((s, c) =>
    s + (parseFloat(pt.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0);
};

export const newSousTache = (categories) => ({
  id: generateId(),
  description: '',
  temps: Object.fromEntries((categories || []).map(c => [c.id, ''])),
});

export const totalRep = (repartition) =>
  (repartition || []).reduce((s, r) => s + (parseFloat(r.pourcentage) || 0), 0);

export const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0);
export const fmtE = (n) => formatPrice(n);

// ─── Styles inputs (thème clair) ─────────────────────────────────────────────
export const iCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all duration-200';
export const iSmCls = 'w-full px-2 py-1.5 text-center rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100/60 transition-all duration-200';

// ─── Card section ─────────────────────────────────────────────────────────────
export const Card = ({ title, children, accent }) => (
  <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
    <div className="px-5 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <div className="flex items-center gap-2">
        <div className={`w-1 h-3.5 rounded-full ${accent || 'bg-emerald-400'}`} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);
