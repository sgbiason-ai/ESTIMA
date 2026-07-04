// src/components/rao/RaoKpiBar.jsx
// Bandeau de synthèse en tête des onglets denses du RAO : répond à
// « que voir en premier ? ». Toutes les données viennent de l'existant
// (analysisStats + companiesData) — aucun nouveau calcul métier.

import React from 'react';
import { Building2, ArrowDownUp, AlertTriangle, GitBranch } from 'lucide-react';
import { NON_REGULAR_STATUSES } from './RaoConstants';
import { getEffectiveConclusion } from '../../utils/analysisCompute';

const fmtEUR = (n) =>
  Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';

const KpiTile = ({ icon: Icon, label, value, sub, tone = 'neutral' }) => {
  const tones = {
    neutral: { box: 'bg-white border-gray-200/60', icon: 'text-slate-400', value: 'text-slate-800' },
    amber:   { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', value: 'text-amber-800' },
    rose:    { box: 'bg-rose-50 border-rose-200', icon: 'text-rose-500', value: 'text-rose-700' },
    emerald: { box: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-500', value: 'text-emerald-700' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-sm min-w-0 ${t.box}`}>
      <Icon size={18} className={`shrink-0 ${t.icon}`} strokeWidth={1.5} />
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{label}</div>
        <div className={`text-sm font-black leading-tight truncate ${t.value}`}>
          {value}
          {sub && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{sub}</span>}
        </div>
      </div>
    </div>
  );
};

const RaoKpiBar = ({ analysisCompanies = [], analysisStats = null, companiesData = {}, negoActive = false, className = '' }) => {
  const nb = analysisCompanies.length;
  if (nb === 0) return null;

  const basis = negoActive ? 'nego' : 'initial';
  const imported = analysisCompanies.filter(c => Object.keys(c.offers || {}).length > 0).length;

  // Fourchette des totaux (offres de base > 0)
  const totals = analysisCompanies
    .map(c => Number(analysisStats?.companiesTotals?.[c.id] || 0))
    .filter(v => v > 0);
  const min = totals.length ? Math.min(...totals) : 0;
  const max = totals.length ? Math.max(...totals) : 0;
  const spreadPct = min > 0 && totals.length > 1 ? ((max - min) / min) * 100 : null;

  // Offres non régulières (statut effectif selon la phase)
  const irregular = analysisCompanies.filter(c =>
    NON_REGULAR_STATUSES.includes(getEffectiveConclusion(companiesData[c.name]?.admin, basis))
  ).length;

  const retainedVariants = analysisCompanies.reduce(
    (s, c) => s + (c.variants || []).filter(v => v.retained).length, 0
  );

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 ${className}`}>
      <KpiTile
        icon={Building2}
        label="Offres importées"
        value={`${imported}/${nb}`}
        tone={imported < nb ? 'amber' : 'neutral'}
      />
      <KpiTile
        icon={ArrowDownUp}
        label="Fourchette des offres"
        value={totals.length > 1 ? `${fmtEUR(min)} – ${fmtEUR(max)}` : totals.length === 1 ? fmtEUR(min) : '—'}
        sub={spreadPct != null ? `écart ${spreadPct.toFixed(1)} %` : null}
      />
      <KpiTile
        icon={AlertTriangle}
        label="Offres non régulières"
        value={String(irregular)}
        tone={irregular > 0 ? 'rose' : 'neutral'}
      />
      <KpiTile
        icon={GitBranch}
        label="Variantes retenues"
        value={String(retainedVariants)}
        tone={retainedVariants > 0 ? 'emerald' : 'neutral'}
      />
    </div>
  );
};

export default RaoKpiBar;
