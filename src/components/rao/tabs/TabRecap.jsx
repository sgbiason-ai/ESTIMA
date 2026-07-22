// src/components/rao/tabs/TabRecap.jsx
import React, { useMemo } from 'react';
import { Award, Download, ShieldCheck, Info, Layers, CheckCircle2, XCircle, GitBranch, Check, Handshake } from 'lucide-react';
import { FORMULA_LABELS_CONSULT } from '../RaoConstants';
import { computePriceReference, getVariantEffectiveTotal } from '../../../utils/analysisCompute';
import { htmlToPlainText } from '../../../utils/richText';
import RichTextField from '../../common/RichTextField';

// ─── Formatage montant FR ─────────────────────────────────────────────────────
const fmtPrice = (v) =>
  v > 0 ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—';

// ─── Composant ────────────────────────────────────────────────────────────────
const TabRecap = ({
  criteria, ranking, onExportPDF, isExporting,
  scoringConfig, hasTranches, raoTrancheId, tranches,
  optionChapters = [], includedOptions = {},
  analysisCompanies = [],
  recommendation = '', updateRecommendation = () => {},
  negoActive = false,
  // Workflow 9 étapes : 'initial' → étape 5 (Récap avant négo), 'nego' → étape 9
  // (Récap final). isFinal pilote la recommandation/conclusion (une seule source).
  phase = 'initial',
  isFinal = true,
  onEngageNego = null,   // étape 5, négo non engagée → CTA « Engager la négociation »
  onGoToFinalRecap = null, // étape 5, négo engagée → renvoi vers le Récap final (9)
}) => {
  const priceC  = criteria.find(c => c.auto) || criteria[0];
  const techCs  = criteria.filter(c => !c.auto);
  const isNegoPhase = phase === 'nego';

  // ─── Construire les lignes "variante retenue" sous chaque entreprise ──
  // Recalcule un nouveau Pmin/Pmax/Pmoy qui inclut les variantes retenues,
  // puis recalcule les scores pour TOUTES les lignes (cohérence).
  const extendedRanking = useMemo(() => {
    if (!ranking || ranking.length === 0) return [];
    // Collecter toutes les "offres" notables : base régulière + variantes retenues
    const N = Number(scoringConfig?.maxScore || 40);
    const mode = scoringConfig?.mode || 'f1';

    // 1. Construire une liste enrichie avec variantes retenues
    // Note : les variantes sont des offres INDÉPENDANTES (CCP R2151-8). Le statut
    // 'irrégulière' de l'entreprise s'applique uniquement à l'offre de base ;
    // les variantes sont régulières par défaut (sauf statut variant.adminConclusion).
    const NON_REGULAR_STATUSES = ['irreguliere', 'inacceptable', 'inappropriee'];
    const flatList = [];
    ranking.forEach(r => {
      flatList.push({ ...r, kind: 'base' });
      const company = analysisCompanies.find(c => c.name === r.name);
      const retainedVariants = (company?.variants || []).filter(v => v.retained);
      retainedVariants.forEach((v, vi) => {
        // Statut variante indépendant : par défaut régulière, sauf v.adminConclusion non-régulier
        const variantIrregular = v.adminConclusion && NON_REGULAR_STATUSES.includes(v.adminConclusion);
        flatList.push({
          ...r,
          kind: 'variant',
          variantId: v.id,
          variantLabel: v.label,
          variantIndex: vi + 1,
          // Le prix devient le total NET de la variante (rabais commercial global
          // de l'entreprise déduit en phase après négo) — même primitif que le
          // comparatif RAO et l'export PDF (source unique, cf. analysisCompute).
          price: getVariantEffectiveTotal(company, v, negoActive ? 'nego' : 'initial'),
          // Surcharge : statut indépendant de la base
          irregular: !!variantIrregular,
          irregularLabel: v.adminConclusion || null,
        });
      });
    });

    // 2. Recalculer Pmin/Pmax/Pmoy sur TOUTES les lignes (irrégulières incluses)
    //    — computePriceReference (source unique de la règle CCP).
    const { Pmin, Pmax, Pmoy } = computePriceReference(flatList.map(r => r.price));

    // 3. Recalculer priceScore pour chaque ligne (formule scoring)
    const scoreFor = (price) => {
      if (price <= 0 || Pmin <= 0) return 0;
      let s = 0;
      switch (mode) {
        case 'f1': s = N * (Pmin / price); break;
        case 'f2': s = N * Math.pow(Pmin / price, 2); break;
        case 'f3': s = N * Math.pow(Pmin / price, 3); break;
        case 'f4': s = N * (1 - (price - Pmin) / Pmin); break;
        case 'f5': s = N * (1 - (price - Pmin) / Pmoy); break;
        case 'f6': s = price <= Pmoy ? N * Math.sqrt(Pmin / price) : N * Math.pow(Pmin / price, 2); break;
        case 'f7': s = Pmax === Pmin ? N : N * (1 - (price - Pmin) / (Pmax - Pmin)); break;
        case 'f8': s = (N * Pmoy) / (Pmoy + price); break;
        case 'f9': s = N * ((2 * Pmin) / (Pmin + price)); break;
        default:   s = 0;
      }
      return Math.max(0, Math.min(N, s));
    };

    // 4. Mettre à jour priceScore et totalScore pour TOUTES les lignes (irrégulières incluses)
    const recomputed = flatList.map(r => {
      const priceScore = scoreFor(r.price);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      return {
        ...r,
        priceScore,
        totalScore: priceScore + techTotal,
      };
    });

    // 5. Re-trier : TOUTES les offres classées ensemble par totalScore décroissant.
    //    Les irrégulières conservent leur flag pour être marquées « sous réserve ».
    return recomputed
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [ranking, analysisCompanies, scoringConfig, negoActive]);
  const trancheName = hasTranches && raoTrancheId !== 'global'
    ? (tranches || []).find(t => t.id === raoTrancheId)?.name || raoTrancheId
    : null;

  // PSE incluses dans la base notée
  const includedPSE = optionChapters.filter(c => !!includedOptions[c.id]);
  const hasOptions  = optionChapters.length > 0;

  // ─── Texte de conclusion finale (utilise par le PDF) ──────────────────
  // Calcule un libelle d'entreprise enrichi pour le winner (base ou variante)
  const winner = extendedRanking.find(r => r.rank === 1) || ranking?.[0];
  const winnerLabel = winner
    ? (winner.kind === 'variant'
        ? `${winner.name.toUpperCase()} — VARIANTE V${winner.variantIndex}${winner.variantLabel ? ` (${winner.variantLabel})` : ''}`
        : winner.name.toUpperCase())
    : '[ENTREPRISE]';
  const defaultRecommendation = `Au regard des critères d'attribution définis dans les documents de consultation, l'offre de l'entreprise ${winnerLabel} est l'offre économiquement la plus avantageuse.`;
  const effectiveRecommendation = recommendation || defaultRecommendation;
  const isCustomRecommendation = !!recommendation && recommendation !== defaultRecommendation;

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
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              {isNegoPhase ? 'Classement final — après négociation'
                : isFinal ? 'Classement Final'
                : 'Récap avant négociation'}
            </h3>
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

      {/* ── Étape 5, négo non engagée : proposer d'engager la négociation ──── */}
      {onEngageNego && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-blue-50/70 border border-blue-200 rounded-2xl px-5 py-4">
          <Handshake size={18} className="shrink-0 text-blue-600" />
          <p className="flex-1 text-xs text-blue-900 leading-relaxed">
            <strong>Ce classement porte sur les offres initiales.</strong> Si le marché prévoit une négociation,
            engagez-la pour déverrouiller les étapes 6 à 10 (courriers, dépouillement des offres finales,
            statuts et notes après négo, classement final). Sinon, ce récap fait office de classement final.
          </p>
          <button
            onClick={onEngageNego}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            <Handshake size={13} /> Engager la négociation
          </button>
        </div>
      )}

      {/* ── Étape 5, négo engagée : ce récap fige l'avant-négo ─────────────── */}
      {!isFinal && onGoToFinalRecap && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50/70 border border-amber-200 rounded-2xl px-5 py-4">
          <Info size={16} className="shrink-0 text-amber-600" />
          <p className="flex-1 text-xs text-amber-900 leading-relaxed">
            <strong>Négociation engagée :</strong> ce récap fige l'état <strong>avant négociation</strong> (comparatif).
            Le classement qui engage l'attribution est le <strong>Récap final (étape 10)</strong>, établi sur les offres finales.
          </p>
          <button
            onClick={onGoToFinalRecap}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            Voir le Récap final
          </button>
        </div>
      )}

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
              {extendedRanking.map((r) => {
                const isIrregular = !!r.irregular;
                const isVariant = r.kind === 'variant';
                const isWinner = r.rank === 1 && !isIrregular;
                const rowCls = isIrregular
                  ? 'bg-rose-50/60 border-l-4 border-l-rose-300'
                  : isVariant ? 'bg-purple-50/40 border-l-4 border-l-purple-300'
                  : isWinner ? 'bg-emerald-50/30' : '';
                const rowKey = isVariant ? `${r.name}_${r.variantId}` : r.name;
                return (
                  <tr key={rowKey} className={`transition-colors hover:bg-slate-50/50 ${rowCls}`}>
                    <td className="px-6 py-5 font-extrabold text-slate-800 text-base">
                      <div className="flex items-center gap-3">
                        {isVariant && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 text-purple-700 text-[10px] font-black shrink-0">
                            <GitBranch size={11} />
                          </span>
                        )}
                        <span className={isIrregular ? 'text-slate-500' : ''}>
                          {r.name}
                          {isVariant && <span className="text-purple-600 ml-1 font-bold"> · V{r.variantIndex} {r.variantLabel ? `(${r.variantLabel})` : ''}</span>}
                        </span>
                        {isVariant && (
                          <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-md font-black shadow-sm tracking-widest uppercase inline-flex items-center gap-1">
                            <Check size={10} strokeWidth={3} /> Retenue
                          </span>
                        )}
                        {isWinner && (
                          <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-1 rounded-full font-black shadow-sm tracking-widest uppercase">
                            Mieux-disant
                          </span>
                        )}
                        {isIrregular && (
                          <span className="text-[10px] bg-red-500 text-white px-2.5 py-1 rounded-full font-black shadow-sm tracking-widest uppercase" title="Offre non régulière — classée sous réserve de régularisation (CCP R2152-2)">
                            ⚠ {(r.irregularLabel || 'Irrégulière').replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center font-bold text-base">
                      <span className="text-emerald-700">{r.priceScore?.toFixed(2)}</span>
                    </td>
                    {techCs.map(c => (
                      <td key={c.id} className="px-4 py-5 text-center font-semibold text-base">
                        <span className="text-blue-700">{(r.techScores?.[c.id] || 0).toFixed(2)}</span>
                      </td>
                    ))}
                    <td className="px-6 py-5 text-right text-slate-700 font-mono font-bold text-sm">
                      {fmtPrice(r.price)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`font-black text-xl ${isWinner ? 'text-emerald-600' : isIrregular ? 'text-rose-700' : 'text-slate-900'}`}>
                        {r.totalScore?.toFixed(2)}
                      </span>
                      {isIrregular && <div className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Sous réserve</div>}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className={`mx-auto w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shadow-sm ${
                        isIrregular ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-200'
                      : r.rank === 1 ? 'bg-amber-400 text-amber-900 ring-4 ring-amber-400/20'
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

      {/* ── Recommandation MOE (récap FINAL uniquement — étape 9, ou 5 sans négo) ── */}
      {isFinal && winner && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-[32px] p-10 text-white shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] relative overflow-hidden">
          <Award size={160} className="absolute -right-10 -bottom-10 text-white opacity-10 rotate-12" />
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-3">Recommandation du Maître d'Œuvre</p>
            <p className="text-3xl font-light leading-tight">
              {winner.kind === 'variant' ? (
                <>L'entreprise <span className="font-black text-white">{winner.name}</span> avec sa <span className="font-black text-white">{winner.variantLabel || `Variante ${winner.variantIndex}`}</span> est classée <strong className="font-black">1ère</strong>.</>
              ) : (
                <>L'entreprise <span className="font-black text-white">{winner.name}</span> est classée <strong className="font-black">1ère</strong>.</>
              )}
            </p>
            <div className="flex flex-wrap gap-6 mt-6">
              <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-md border border-white/20 shadow-inner">
                <p className="text-[10px] uppercase tracking-widest text-emerald-100 mb-1">Score global</p>
                <p className="text-2xl font-black">
                  {winner.totalScore?.toFixed(2)} <span className="text-base font-normal opacity-80">/ 100</span>
                </p>
              </div>
              <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-md border border-white/20 shadow-inner">
                <p className="text-[10px] uppercase tracking-widest text-emerald-100 mb-1">
                  Montant {winner.kind === 'variant' ? 'variante retenue' : (includedPSE.length > 0 ? 'Base + PSE notées' : 'Base seule')}
                </p>
                <p className="text-2xl font-black font-mono">
                  {fmtPrice(winner.price)} <span className="text-base font-normal opacity-80 font-sans">HT</span>
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

      {/* ── Conclusion finale (PDF) — editable, récap FINAL uniquement ──── */}
      {isFinal && winner && (
        <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                Conclusion finale (export PDF)
              </p>
              {isCustomRecommendation && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wide">Personnalisé</span>
              )}
            </div>
            {isCustomRecommendation && (
              <button
                onClick={() => updateRecommendation('')}
                className="text-[11px] text-gray-500 hover:text-blue-600 font-medium transition"
                title="Restaurer le texte automatique"
              >
                Réinitialiser
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mb-2">
            Ce texte s'affiche dans le bloc de recommandation du PDF RAO. Modifiez-le si besoin (mentions légales, nuances, etc.).
          </p>
          <RichTextField
            value={effectiveRecommendation}
            onChange={(html) => {
              // Revenir au texte par défaut = ne rien stocker. La comparaison se
              // fait sur le texte aplati : si l'utilisateur a seulement ajouté de
              // la mise en forme (gras…) au texte par défaut, le HTML porte des
              // balises de style → on le conserve.
              const plain = htmlToPlainText(html).trim();
              const hasStyling = /<(b|strong|i|em|u|ul|ol|li)\b/i.test(html);
              updateRecommendation(!plain || (plain === defaultRecommendation && !hasStyling) ? '' : html);
            }}
            rows={3}
            placeholder={defaultRecommendation}
          />
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