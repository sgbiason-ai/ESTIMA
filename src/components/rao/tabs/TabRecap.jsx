// src/components/rao/tabs/TabRecap.jsx
import React from 'react';
import { Award, Download, ShieldCheck, Info, Layers, CheckCircle2, XCircle } from 'lucide-react';
import { FORMULA_LABELS_CONSULT } from '../RaoConstants';

// ─── Formatage montant FR ─────────────────────────────────────────────────────
const fmtPrice = (v) =>
  v > 0 ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—';

// ─── Composant ────────────────────────────────────────────────────────────────
const TabRecap = ({
  criteria, ranking, companyNames, onExportPDF, isExporting,
  scoringConfig, hasTranches, raoTrancheId, tranches,
  optionChapters = [], includedOptions = {},
}) => {
  const priceC  = criteria.find(c => c.auto) || criteria[0];
  const techCs  = criteria.filter(c => !c.auto);
  const trancheName = hasTranches && raoTrancheId !== 'global'
    ? (tranches || []).find(t => t.id === raoTrancheId)?.name || raoTrancheId
    : null;

  // PSE incluses dans la base notée
  const includedPSE = optionChapters.filter(c => !!includedOptions[c.id]);
  const hasOptions  = optionChapters.length > 0;

  // Libellé colonne Prix (précise ce qui est noté)
  const prixLabel = includedPSE.length > 0
    ? `Prix HT noté\n(Base + ${includedPSE.length} PSE)`
    : 'Prix HT noté\n(Base seule)';

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-24">

      {/* ── En-tête + bouton PDF ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white px-6 py-5 rounded-[24px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Award size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Classement Final</h3>
            {scoringConfig && (
              <p className="text-xs text-slate-500 mt-1">
                Formule prix : <strong className="text-slate-700">{FORMULA_LABELS_CONSULT[scoringConfig.mode] || scoringConfig.mode?.toUpperCase()}</strong>
                {' — '} barème <strong className="text-slate-700">{scoringConfig.maxScore} pts</strong>
                {hasTranches && (
                  <span className="ml-3 px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-lg text-[10px] border border-amber-200 shadow-sm">
                    📐 {trancheName ? `Tranche : ${trancheName}` : '🌐 Global'}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-8 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap"
        >
          <Download size={18} />
          {isExporting ? 'Génération du document…' : 'Générer le PDF final'}
        </button>
      </div>

      {/* ── Bloc conformité CCP ────────────────────────────────────────────── */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm px-6 py-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Base de notation — Conformité CCP</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Critères et pondérations publiés dans le RC conformément aux articles <strong>R2152-1</strong> et <strong>R2152-7</strong> du Code de la commande publique.
              Le classement ci-dessous ne peut être établi qu'au regard des seuls critères annoncés aux candidats.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Critères et leur poids */}
          <div className="flex flex-col gap-1.5 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">
              <Info size={11} /> Critères de jugement
            </p>
            {criteria.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-700 font-medium leading-snug flex-1">{c.label}</span>
                <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${c.auto ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {c.auto ? (scoringConfig?.maxScore ?? c.weight) : c.weight} pts
                </span>
              </div>
            ))}
          </div>

          {/* PSE — ce qui est inclus dans le prix noté */}
          <div className="flex flex-col gap-1.5 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">
              <Layers size={11} /> Périmètre du prix noté
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-700 font-medium">Travaux de base</span>
              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                <CheckCircle2 size={11} /> Incluse
              </span>
            </div>
            {hasOptions
              ? optionChapters.map(chap => {
                  const on = !!includedOptions[chap.id];
                  return (
                    <div key={chap.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600 font-medium leading-snug flex-1 italic">{chap.title}</span>
                      {on
                        ? <span className="flex items-center gap-1 text-[10px] font-black text-violet-700 bg-violet-100 px-2.5 py-1 rounded-lg whitespace-nowrap"><CheckCircle2 size={11} /> Dans le score</span>
                        : <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg whitespace-nowrap"><XCircle size={11} /> Hors score</span>
                      }
                    </div>
                  );
                })
              : <p className="text-[10px] text-slate-400 italic">Aucune PSE / variante dans ce projet.</p>
            }
          </div>
        </div>
      </div>

      {/* ── Tableau de classement ──────────────────────────────────────────── */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-5 text-left font-black text-slate-700 text-xs uppercase tracking-wider">Entreprise</th>
                <th className="px-4 py-5 text-center font-bold text-slate-600 text-[10px] uppercase leading-tight">
                  {priceC?.label?.slice(0, 22)}…<br/>
                  <span className="text-emerald-600 font-black text-sm">{scoringConfig?.maxScore ?? priceC?.weight} pts</span>
                </th>
                {techCs.map(c => (
                  <th key={c.id} className="px-4 py-5 text-center font-bold text-slate-600 text-[10px] uppercase leading-tight">
                    {c.label.slice(0, 22)}…<br/>
                    <span className="text-blue-600 font-black text-sm">{c.weight} pts</span>
                  </th>
                ))}
                <th className="px-6 py-5 text-right font-black text-slate-700 text-xs uppercase tracking-wider whitespace-pre-line leading-snug">
                  {prixLabel}
                </th>
                <th className="px-6 py-5 text-center font-black text-slate-800 text-xs uppercase tracking-wider">Total /100</th>
                <th className="px-6 py-5 text-center font-black text-slate-700 text-xs uppercase tracking-wider">Rang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranking.map((r, i) => {
                const isWinner = i === 0;
                return (
                  <tr key={r.name} className={`transition-colors hover:bg-slate-50/50 ${isWinner ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-6 py-5 font-extrabold text-slate-800 text-base">
                      <div className="flex items-center gap-3">
                        {r.name}
                        {isWinner && (
                          <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-1 rounded-full font-black shadow-sm tracking-widest uppercase">
                            Mieux-disant
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center font-bold text-emerald-700 text-base">{r.priceScore?.toFixed(2)}</td>
                    {techCs.map(c => (
                      <td key={c.id} className="px-4 py-5 text-center text-blue-700 font-semibold text-base">
                        {(r.techScores?.[c.id] || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-6 py-5 text-right text-slate-700 font-mono font-bold text-sm">{fmtPrice(r.price)}</td>
                    <td className="px-6 py-5 text-center">
                      <span className={`font-black text-xl ${isWinner ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {r.totalScore?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className={`mx-auto w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shadow-sm ${
                        r.rank === 1 ? 'bg-amber-400 text-amber-900 ring-4 ring-amber-400/20'
                      : r.rank === 2 ? 'bg-slate-300 text-slate-700'
                      : r.rank === 3 ? 'bg-orange-300 text-orange-900'
                      : 'bg-slate-100 text-slate-500'
                      }`}>
                        {r.rank}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recommandation MOE ────────────────────────────────────────────── */}
      {ranking[0] && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-[32px] p-10 text-white shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] relative overflow-hidden">
          <Award size={160} className="absolute -right-10 -bottom-10 text-white opacity-10 rotate-12" />
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-3">Recommandation du Maître d'Œuvre</p>
            <p className="text-3xl font-light leading-tight">
              L'entreprise <span className="font-black text-white">{ranking[0].name}</span> est classée <strong className="font-black">1ère</strong>.
            </p>
            <div className="flex flex-wrap gap-6 mt-6">
              <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-md border border-white/20 shadow-inner">
                <p className="text-[10px] uppercase tracking-widest text-emerald-100 mb-1">Score global</p>
                <p className="text-2xl font-black">
                  {ranking[0].totalScore?.toFixed(2)} <span className="text-base font-normal opacity-80">/ 100</span>
                </p>
              </div>
              <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-md border border-white/20 shadow-inner">
                <p className="text-[10px] uppercase tracking-widest text-emerald-100 mb-1">
                  Montant {includedPSE.length > 0 ? 'Base + PSE notées' : 'Base seule'}
                </p>
                <p className="text-2xl font-black font-mono">
                  {fmtPrice(ranking[0].price)} <span className="text-base font-normal opacity-80 font-sans">HT</span>
                </p>
              </div>
              {includedPSE.length > 0 && (
                <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-md border border-white/20 shadow-inner">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-100 mb-1">PSE incluses dans le score</p>
                  <p className="text-sm font-bold leading-snug">
                    {includedPSE.map(c => c.title).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Note de conformité légale ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] text-slate-500 leading-relaxed">
        <ShieldCheck size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-600">Références légales :</strong>{' '}
          Ce classement est établi conformément aux articles <strong>R2152-1</strong> (critères d'attribution),{' '}
          <strong>R2152-6</strong> (offre économiquement la plus avantageuse) et <strong>R2152-7</strong>{' '}
          (pondération des critères) du Code de la commande publique.
          Les critères et leurs pondérations ont été portés à la connaissance des candidats dans les documents de consultation.
          Toute modification des critères ou de leur pondération après réception des offres est prohibée{' '}
          <em>(CE 11 mars 2013, n°363460 ; CJUE 24 nov. 2005, ATI EAC, C-331/04)</em>.
          Le classement final engage la responsabilité du pouvoir adjudicateur{' '}
          <em>(CCP art. L6, principe de bonne administration)</em>.
        </p>
      </div>

    </div>
  );
};

export default TabRecap;