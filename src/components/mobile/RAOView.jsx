// src/components/mobile/RAOView.jsx — Vue mobile RAO complète (consultation)
// Charge depuis Firestore : analysis/data + rao/data
// Onglets : Récap · Admin · Technique · Détail · RAO
import React, { useState, useMemo, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db as fireDb } from '../../firebase';
import Icon from './Icon';
import { fmt, fmtShort } from './formatters';
import { flattenItems } from './helpers';
import { scoreOffer, computeOABThreshold, computeChaptersData, computeAnalysisStats } from '../../utils/analysisCompute';
import { computeVatBreakdown } from '../../utils/financeFormat';

// Notation prix : primitif partagé scoreOffer (src/utils/analysisCompute.js),
// même source que le desktop — inclut le clamp [0, N] (les offres chères ne
// produisent plus de note négative comme avec l'ancien calcScore local).

// ─── Couleurs rang ───────────────────────────────────────────────────────────
const RANK_COLORS = ['bg-amber-400', 'bg-gray-300', 'bg-amber-700'];
const RANK_TEXT = ['text-amber-900', 'text-gray-700', 'text-white'];

// ─── Couleurs entreprises ────────────────────────────────────────────────────
const COMPANY_UI = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-400', dot: 'bg-cyan-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-400', dot: 'bg-emerald-500' },
];
const getUI = (i) => COMPANY_UI[i % COMPANY_UI.length];

// ─── Labels ─────────────────────────────────────────────────────────────────
const CONCL_LABELS = { reguliere: 'Régulière', irreguliere: 'Irrégulière', inacceptable: 'Inacceptable', inappropriee: 'Inappropriée' };
const CONCL_COLORS = { reguliere: 'bg-emerald-100 text-emerald-700', irreguliere: 'bg-red-100 text-red-600', inacceptable: 'bg-red-100 text-red-600', inappropriee: 'bg-orange-100 text-orange-700' };

const FORMULA_LABELS = {
  f1: 'F1 — Pmin / P', f2: 'F2 — (Pmin/P)²', f3: 'F3 — (Pmin/P)³',
  f4: 'F4 — 1−(P−Pmin)/Pmin', f5: 'F5 — 1−(P−Pmin)/Pmoy', f6: 'F6 — mixte',
  f7: 'F7 — linéaire', f8: 'F8 — Pmoy/(Pmoy+P)', f9: 'F9 — 2Pmin/(Pmin+P)',
};

const DEFAULT_ADMIN_PIECES = [
  { id: 'dc1dc2', label: 'DC1 et DC2' },
  { id: 'honneur1', label: 'Décl. honneur (interdiction soumissionner)' },
  { id: 'honneur2', label: 'Décl. honneur (travailleurs handicapés)' },
  { id: 'effectifs', label: 'Décl. effectifs moyens' },
  { id: 'materiel', label: 'Décl. matériel et équipement' },
  { id: 'references', label: 'Travaux similaires + attestations' },
  { id: 'certifs', label: 'Certif. qualification professionnelle' },
];
const DEFAULT_OFFER_PIECES = [
  { id: 'ae', label: 'Acte d\'engagement (AE)' },
  { id: 'ccap', label: 'CCAP signé' },
  { id: 'cctp', label: 'CCTP signé' },
  { id: 'bpu', label: 'BPU' },
  { id: 'de', label: 'Détail estimatif' },
  { id: 'memoire', label: 'Mémoire technique + planning' },
];

// ─── Onglets ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'recap', label: 'Récap' },
  { id: 'admin', label: 'Admin' },
  { id: 'technique', label: 'Technique' },
  { id: 'detail', label: 'Détail' },
  { id: 'rao', label: 'Infos' },
];

export default function RAOView({ project, companyId, calcHook }) {
  const [tab, setTab] = useState('recap');
  const [companies, setCompanies] = useState([]);
  const [scoringConfig, setScoringConfig] = useState({ maxScore: 40, mode: 'f1' });
  const [raoData, setRaoData] = useState(null); // données rao/data (critères, companies RAO)
  const [loading, setLoading] = useState(true);
  const [openChapter, setOpenChapter] = useState(null);
  const [selectedCompanyIdx, setSelectedCompanyIdx] = useState(0);
  const [openTechCompany, setOpenTechCompany] = useState(null);
  const [openAdminCompany, setOpenAdminCompany] = useState(null);

  // ─── Chargement depuis Firestore (analysis/data + rao/data) ──────────
  useEffect(() => {
    if (!project?.id || !companyId) { setLoading(false); return; }
    const loadAll = async () => {
      try {
        // Charger analysis/data
        const analysisRef = doc(fireDb, 'companies', companyId, 'projects', project.id, 'analysis', 'data');
        const analysisSnap = await getDoc(analysisRef);
        if (analysisSnap.exists()) {
          const d = analysisSnap.data();
          if (d.companies) setCompanies(d.companies);
          if (d.scoringConfig) setScoringConfig(d.scoringConfig);
        }
        // Charger rao/data
        const raoRef = doc(fireDb, 'companies', companyId, 'projects', project.id, 'rao', 'data');
        const raoSnap = await getDoc(raoRef);
        if (raoSnap.exists()) {
          setRaoData(raoSnap.data().rao || null);
        }
      } catch (e) {
        console.error('[Mobile RAO] Erreur chargement:', e);
      }
      setLoading(false);
    };
    loadAll();
  }, [project?.id, companyId]);

  // ─── Données RAO (merge: rao/data prioritaire, fallback project.rao) ──
  const rao = raoData || project?.rao || {};
  const raoCriteria = rao.criteria || [];
  const raoCompanies = rao.companies || {};
  const consultation = rao.consultation || {};

  // ─── Données de calcul ────────────────────────────────────────────────
  const clientQtyMaps = calcHook?.clientQtyMaps || {};
  const qtyMap = clientQtyMaps['global'] || {};

  const chapters = useMemo(() => {
    if (!project?.chapters) return [];
    return project.chapters.filter(c => !c.isOption);
  }, [project?.chapters]);

  const allItems = useMemo(() => flattenItems(project?.chapters || []), [project?.chapters]);

  // Base de comparaison IDENTIQUE au desktop (audit F4) : options exclues + repli quantité 0.
  // Réutilise les primitives partagées analysisCompute → totaux et classement mobile == bureau.
  const baseStats = useMemo(
    () => computeAnalysisStats(computeChaptersData(project, companies, qtyMap), companies, scoringConfig),
    [project, companies, qtyMap, scoringConfig]
  );
  const totalEstimation = baseStats.totalEstimation;

  // ─── Helper : total d'une variante (matched + new items, removed exclus) ──
  // Recalcule a la volee depuis offers/quantities de la variante (au cas ou v.total
  // est obsolete ou absent) — meme logique que usePriceAnalysis.handleImportVariant.
  const computeVariantTotal = (base, variant, items, qtyM) => {
    const mergedOffers = { ...(base.offers || {}), ...(variant.offers || {}) };
    const mergedQty    = variant.quantities || {};
    const removed      = new Set((variant.removedItems || []).map(it => it.itemId));
    let totalMatched = 0;
    items.forEach(it => {
      if (removed.has(it.id)) return;
      const pu = Number(mergedOffers[it.id] ?? 0);
      const qty = Number(mergedQty[it.id] ?? qtyM[it.id] ?? it.qty ?? 0);
      totalMatched += qty * pu;
    });
    const totalNew = (variant.newItems || []).reduce((s, it) => s + Number(it.lineTotal || 0), 0);
    return totalMatched + totalNew;
  };

  // ─── Totaux par entreprise (avec variantes retenues comme entrees additionnelles) ──
  // Reproduit la logique desktop pdfRaoGenerator synthRows : base ajoutee si reguliere,
  // chaque variante retenue ajoutee si reguliere.
  const NON_REGULAR = ['irreguliere', 'inacceptable', 'inappropriee'];

  const companyStats = useMemo(() => {
    const entries = [];
    companies.forEach((c, ci) => {
      const admin = raoCompanies[c.name]?.admin || {};
      const baseIrregular = !!(admin.conclusion && NON_REGULAR.includes(admin.conclusion));
      // Base (toujours ajoutee — la regularite est juste un marqueur visuel).
      // Total de base aligne sur le desktop (options exclues, repli qty 0) — audit F4.
      const baseTotal = baseStats.companiesTotals[c.id] || 0;
      entries.push({
        ...c, kind: 'base', total: baseTotal, baseTotal,
        companyIndex: ci, displayName: c.name, irregular: baseIrregular,
      });
      // Variantes retenues (filtrees si elles-memes irregulieres)
      (c.variants || []).filter(v => v.retained).forEach((v, vi) => {
        if (v.adminConclusion && NON_REGULAR.includes(v.adminConclusion)) return;
        const vTotal = computeVariantTotal(c, v, allItems, qtyMap);
        entries.push({
          ...c, // herite id/name pour technique/admin lookup
          kind: 'variant',
          id: `${c.id}_${v.id}`,
          variantId: v.id,
          variantIndex: vi + 1,
          variantLabel: v.label || `V${vi + 1}`,
          displayName: `${c.name} · ${v.label || `V${vi + 1}`}`,
          baseCompanyName: c.name,
          baseCompanyId: c.id,
          companyIndex: ci,
          total: vTotal,
          baseTotal,
          irregular: false,
        });
      });
    });

    const validTotals = entries.filter(e => e.total > 0).map(e => e.total);
    const Pmin = validTotals.length ? Math.min(...validTotals) : 0;
    const Pmax = validTotals.length ? Math.max(...validTotals) : 0;
    const Pmoy = validTotals.length ? validTotals.reduce((a, b) => a + b, 0) / validTotals.length : 0;
    const oabThreshold = computeOABThreshold(validTotals);
    const N = scoringConfig.maxScore || 40;
    const mode = scoringConfig.mode || 'f1';

    const ranked = entries
      .map(e => ({
        ...e,
        score: scoreOffer(e.total, Pmin, Pmax, Pmoy, N, mode),
        ecart: totalEstimation ? ((e.total - totalEstimation) / totalEstimation * 100) : 0,
        isOAB: e.total > 0 && e.total < oabThreshold,
      }))
      .sort((a, b) => a.total - b.total)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    return { ranked, Pmin, Pmax, Pmoy, oabThreshold, N, mode };
  }, [companies, allItems, qtyMap, baseStats, totalEstimation, scoringConfig, raoCompanies]);

  // ─── Notes techniques par entreprise ─────────────────────────────────
  const techScoresMap = useMemo(() => {
    const map = {};
    const nonAuto = raoCriteria.filter(c => !c.auto);
    companies.forEach(c => {
      const tech = raoCompanies[c.name]?.technical || {};
      let total = 0;
      const perCrit = {};
      nonAuto.forEach(crit => {
        const hasSubs = (crit.subCriteria || []).length > 0;
        if (hasSubs) {
          let critScore = 0;
          crit.subCriteria.forEach(sc => {
            const sd = tech[sc.id] || {};
            const n = Number(sd.note || 0);
            const m = Number(sd.noteMax || 5);
            critScore += m > 0 ? (n / m) * (Number(sc.weight) || 0) : 0;
          });
          perCrit[crit.id] = critScore;
          total += critScore;
        } else {
          const d = tech[crit.id] || {};
          const n = Number(d.note || 0);
          const m = Number(d.noteMax || 5);
          const score = m > 0 ? (n / m) * crit.weight : 0;
          perCrit[crit.id] = score;
          total += score;
        }
      });
      map[c.name] = { total, perCrit };
    });
    return map;
  }, [companies, raoCriteria, raoCompanies]);

  // ─── Totaux par chapitre ──────────────────────────────────────────────
  const chapterStats = useMemo(() => {
    return chapters.map(chap => {
      const chapItems = flattenItems([chap]);
      const estTotal = chapItems.reduce((s, item) => {
        const qty = Number(qtyMap[item.id] || 0);
        return s + qty * Number(item.price || 0);
      }, 0);
      const companyTotals = companies.map(c => {
        const total = chapItems.reduce((s, item) => {
          const qty = Number(qtyMap[item.id] || 0);
          return s + qty * Number(c.offers?.[item.id] ?? 0);
        }, 0);
        return { id: c.id, name: c.name, total };
      });
      return { id: chap.id, title: chap.title || chap.designation, estTotal, companyTotals, items: chapItems };
    });
  }, [chapters, companies, qtyMap]);

  // ─── Classement final (prix + technique) ─────────────────────────────
  const ranking = useMemo(() => {
    const priceWeight = scoringConfig.maxScore || 40;

    return companyStats.ranked.map(c => {
      const techTotal = techScoresMap[c.name]?.total || 0;
      const priceNote = companyStats.N > 0 ? (c.score / companyStats.N) * priceWeight : 0;
      const totalNote = priceNote + techTotal;
      return {
        ...c,
        priceNote,
        techTotal,
        techPerCrit: techScoresMap[c.name]?.perCrit || {},
        totalNote,
      };
    }).sort((a, b) => b.totalNote - a.totalNote)
      .map((c, i) => ({ ...c, finalRank: i + 1 }));
  }, [companyStats, techScoresMap, raoCriteria, scoringConfig]);

  // ─── Loading / Empty ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader" size={24} color="#6b7280" />
        <span className="ml-2 text-sm text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-700">
        <Icon name="chart" size={40} color="#475569" />
        <span className="mt-3 text-sm font-bold">Aucune analyse des offres</span>
        <span className="mt-1 text-xs text-gray-500">Importez des offres depuis le desktop</span>
      </div>
    );
  }

  // ─── Render helpers ───────────────────────────────────────────────────
  const renderDelta = (val) => {
    if (!val || Math.abs(val) < 0.1) return <span className="text-gray-400">=</span>;
    const isOver = val > 0;
    return (
      <span className={`text-xs font-extrabold ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
        {isOver ? '+' : ''}{val.toFixed(1)}%
      </span>
    );
  };

  const nonAutoCriteria = raoCriteria.filter(c => !c.auto);

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="pb-8">

      {/* ── Segmented Control ── */}
      <div className="sticky top-0 z-20 bg-[#f5f5f7] px-3 pt-2 pb-1">
        <div className="bg-gray-100 rounded-2xl p-1 flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all ${
                tab === t.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-transparent text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Header estimation ── */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500 uppercase">Estimation</span>
        <span className="text-sm font-extrabold text-gray-900">{fmtShort(totalEstimation)}</span>
      </div>

      {/* ═══ ONGLET RÉCAP ═══ */}
      {tab === 'recap' && (
        <div className="px-4 space-y-2">
          {/* Formule et barème */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-500 uppercase">Formule prix</span>
              <span className="text-[10px] font-bold text-gray-700">{FORMULA_LABELS[scoringConfig.mode] || scoringConfig.mode?.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-black text-gray-500 uppercase">Barème</span>
              <span className="text-[10px] font-bold text-gray-700">{scoringConfig.maxScore} pts prix</span>
            </div>
          </div>

          {/* Alerte variantes retenues sans justification */}
          {(() => {
            const issues = [];
            companies.forEach(c => {
              (c.variants || []).forEach((v, vi) => {
                if (v.retained && !(v.justification || '').trim()) {
                  issues.push({ company: c.name, label: v.label || `V${vi + 1}` });
                }
              });
            });
            if (!issues.length) return null;
            return (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-base leading-none">⚠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-amber-700 uppercase mb-1">
                      {issues.length} variante{issues.length > 1 ? 's' : ''} retenue{issues.length > 1 ? 's' : ''} sans justification
                    </p>
                    <ul className="text-[10px] text-amber-800 leading-snug space-y-0.5">
                      {issues.map((it, i) => (
                        <li key={i} className="truncate">• <strong>{it.company}</strong> — {it.label}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Classement final */}
          {ranking.map((c, i) => {
            const isVariant = c.kind === 'variant';
            return (
              <div key={c.id} className={`bg-white rounded-xl border overflow-hidden ${c.isOAB ? 'border-amber-400 ring-1 ring-amber-200' : isVariant ? 'border-purple-200' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2.5 p-3">
                  {/* Rang */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i < 3 ? RANK_COLORS[i] : 'bg-gray-100'}`}>
                    {i === 0 ? <Icon name="trophy" size={16} color="#92400e" /> :
                      <span className={`text-sm font-black ${i < 3 ? RANK_TEXT[i] : 'text-gray-600'}`}>{c.finalRank}</span>}
                  </div>

                  {/* Nom + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isVariant && (
                        <span className="text-[8px] font-black px-1 py-0.5 rounded bg-purple-200 text-purple-800 uppercase shrink-0">VAR</span>
                      )}
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {isVariant ? `${c.baseCompanyName} · ${c.variantLabel}` : c.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {renderDelta(c.ecart)}
                      {c.isOAB && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase">OAB</span>
                      )}
                    </div>
                  </div>

                  {/* Notes + Total */}
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-extrabold ${i === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {c.totalNote.toFixed(1)} <span className="text-[9px] font-normal text-gray-400">/ 100</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                      <span className="text-[9px] font-bold text-emerald-600">{c.priceNote.toFixed(1)}</span>
                      {nonAutoCriteria.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600">{c.techTotal.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Montant */}
                <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between bg-gray-50/50">
                  <span className="text-[10px] text-gray-500">Montant HT</span>
                  <span className="text-xs font-bold text-gray-900 tabular-nums">{fmt(c.total)}</span>
                </div>
              </div>
            );
          })}

          {/* Légende */}
          <div className="flex items-center justify-center gap-4 py-2">
            <span className="text-[9px] text-emerald-600 font-bold">● Prix</span>
            {nonAutoCriteria.length > 0 && <span className="text-[9px] text-blue-600 font-bold">● Technique</span>}
            <span className="text-[9px] text-gray-700 font-bold">● Total / 100</span>
          </div>

          {/* OAB info */}
          {companyStats.oabThreshold > 0 && (
            <div className="text-[10px] text-center text-amber-600 font-medium py-1 bg-amber-50 rounded-lg">
              Seuil OAB : {fmt(companyStats.oabThreshold)} (Double Moyenne)
            </div>
          )}

          {/* Recommandation */}
          {ranking[0] && (
            <div className="bg-emerald-600 rounded-xl p-3 mt-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-200 mb-1">Recommandation</p>
              <p className="text-sm text-white leading-snug">
                {ranking[0].kind === 'variant' ? (
                  <>L'entreprise <strong>{ranking[0].baseCompanyName}</strong> avec sa <strong>{ranking[0].variantLabel}</strong> est classée 1ère avec {ranking[0].totalNote.toFixed(2)}/100.</>
                ) : (
                  <>L'entreprise <strong>{ranking[0].name}</strong> est classée 1ère avec {ranking[0].totalNote.toFixed(2)}/100.</>
                )}
              </p>
              <p className="text-[10px] text-emerald-200 mt-1">
                {fmt(ranking[0].total)} HT — {fmt(computeVatBreakdown(ranking[0].total, Number(project?.tauxTVA ?? 20) / 100).ttc)} TTC
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ ONGLET ADMIN ═══ */}
      {tab === 'admin' && (
        <div className="px-4 space-y-2">
          {companies.map((c, ci) => {
            const ui = getUI(ci);
            const admin = raoCompanies[c.name]?.admin || {};
            const pieces = admin.pieces || {};
            const concl = admin.conclusion || 'reguliere';
            const isOpen = openAdminCompany === c.name;
            const isGroupement = !!admin.isGroupement;
            const members = admin.groupementMembers || [];

            return (
              <div key={c.id} className={`bg-white rounded-xl border overflow-hidden ${ui.border}`}>
                {/* Header */}
                <button
                  onClick={() => setOpenAdminCompany(isOpen ? null : c.name)}
                  className="w-full flex items-center gap-3 p-3 active:bg-gray-50"
                >
                  <div className={`w-7 h-7 rounded-lg ${ui.bg} ${ui.text} flex items-center justify-center text-xs font-black`}>
                    {c.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{c.name}</div>
                    {isGroupement && (
                      <span className="text-[8px] font-bold text-indigo-600">Groupement ({members.length})</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${CONCL_COLORS[concl] || CONCL_COLORS.reguliere}`}>
                    {CONCL_LABELS[concl] || 'Régulière'}
                  </span>
                  <Icon name="chevron" size={12} color="#6b7280" />
                </button>

                {/* Détail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                    {/* Membres groupement */}
                    {isGroupement && members.length > 0 && (
                      <div className="mb-3 bg-indigo-50 rounded-lg p-2">
                        <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">Membres du groupement</p>
                        {members.map((m, mi) => (
                          <div key={mi} className="text-xs text-gray-700 py-0.5">
                            <span className="font-bold">{m.role || 'Cotraitant'}</span> : {m.name || '—'}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pièces administratives */}
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Pièces administratives</p>
                    {DEFAULT_ADMIN_PIECES.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-[11px] text-gray-700 flex-1 pr-2">{p.label}</span>
                        <span className={`text-[10px] font-black ${pieces[p.id] === false ? 'text-red-500' : 'text-emerald-600'}`}>
                          {pieces[p.id] === false ? 'NON' : 'OUI'}
                        </span>
                      </div>
                    ))}

                    {/* Pièces offre */}
                    <p className="text-[9px] font-black text-gray-500 uppercase mt-3 mb-1">Pièces de l'offre</p>
                    {DEFAULT_OFFER_PIECES.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-[11px] text-gray-700 flex-1 pr-2">{p.label}</span>
                        <span className={`text-[10px] font-black ${pieces[p.id] === false ? 'text-red-500' : 'text-emerald-600'}`}>
                          {pieces[p.id] === false ? 'NON' : 'OUI'}
                        </span>
                      </div>
                    ))}

                    {/* Observations */}
                    {admin.observations && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-2">
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Observations</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{admin.observations}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ONGLET TECHNIQUE ═══ */}
      {tab === 'technique' && (
        <div className="px-4 space-y-2">
          {/* Critères avec sous-critères */}
          {nonAutoCriteria.length > 0 ? (
            <>
              {companies.map((c, ci) => {
                const ui = getUI(ci);
                const tech = raoCompanies[c.name]?.technical || {};
                const isOpen = openTechCompany === c.name;
                const totalScore = techScoresMap[c.name]?.total || 0;

                return (
                  <div key={c.id} className={`bg-white rounded-xl border overflow-hidden ${ui.border}`}>
                    {/* Header */}
                    <button
                      onClick={() => setOpenTechCompany(isOpen ? null : c.name)}
                      className="w-full flex items-center gap-3 p-3 active:bg-gray-50"
                    >
                      <div className={`w-7 h-7 rounded-lg ${ui.bg} ${ui.text} flex items-center justify-center text-xs font-black`}>
                        {c.name.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="flex-1 text-left text-sm font-bold text-gray-900 truncate">{c.name}</span>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                        {totalScore.toFixed(2)} pts
                      </span>
                      <Icon name="chevron" size={12} color="#6b7280" />
                    </button>

                    {/* Détail par critère */}
                    {isOpen && (
                      <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-3">
                        {nonAutoCriteria.map((crit, critIdx) => {
                          const hasSubs = (crit.subCriteria || []).length > 0;
                          const critScore = techScoresMap[c.name]?.perCrit?.[crit.id] || 0;

                          return (
                            <div key={crit.id} className="bg-gray-50 rounded-lg p-2.5">
                              {/* Nom critère + score */}
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-gray-800">
                                  C{critIdx + 2}. {crit.label}
                                </span>
                                <span className="text-[10px] font-black text-blue-600">
                                  {critScore.toFixed(2)} / {crit.weight}
                                </span>
                              </div>

                              {/* Barre de score */}
                              <div className="w-full h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${crit.weight > 0 ? (critScore / crit.weight) * 100 : 0}%` }}
                                />
                              </div>

                              {hasSubs ? (
                                // Sous-critères
                                <div className="space-y-1.5">
                                  {crit.subCriteria.map((sc, si) => {
                                    const sd = tech[sc.id] || {};
                                    const sNote = Number(sd.note || 0);
                                    const sMax = Number(sd.noteMax || 5);
                                    const sPond = sMax > 0 ? (sNote / sMax) * (Number(sc.weight) || 0) : 0;

                                    return (
                                      <div key={sc.id}>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-gray-600">
                                            {critIdx + 2}.{si + 1} {sc.label}
                                          </span>
                                          <span className="text-[10px] font-bold text-gray-700">
                                            {sNote}/{sMax} = {sPond.toFixed(2)}/{sc.weight}
                                          </span>
                                        </div>
                                        {/* Synthèse sous-critère */}
                                        {sd.text && (
                                          <p className="text-[10px] text-gray-500 leading-snug mt-0.5 ml-2 italic">{sd.text}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                // Critère simple
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-600">Note</span>
                                    <span className="text-[10px] font-bold text-gray-700">
                                      {Number(tech[crit.id]?.note || 0)}/{Number(tech[crit.id]?.noteMax || 5)}
                                    </span>
                                  </div>
                                  {tech[crit.id]?.text && (
                                    <p className="text-[10px] text-gray-500 leading-snug mt-1 italic">{tech[crit.id].text}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Variantes proposées */}
                        {(c.variants || []).length > 0 && (
                          <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-purple-700 uppercase">
                                Variantes ({c.variants.length})
                              </span>
                              <span className="text-[9px] font-bold text-purple-600">
                                {c.variants.filter(v => v.retained).length} retenue{c.variants.filter(v => v.retained).length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {c.variants.map((v, vi) => {
                                const justifMissing = v.retained && !(v.justification || '').trim();
                                // Total recalcule a la volee (v.total stocke peut etre obsolete ou absent)
                                const vTotalComputed = computeVariantTotal(c, v, allItems, qtyMap);
                                const baseTot = companyStats.ranked.find(r => r.kind === 'base' && r.id === c.id)?.baseTotal
                                             ?? companyStats.ranked.find(r => r.kind === 'variant' && r.baseCompanyId === c.id)?.baseTotal
                                             ?? 0;
                                const deltaVsBase = baseTot ? ((vTotalComputed - baseTot) / baseTot * 100) : 0;
                                return (
                                  <div key={v.id || vi} className={`rounded-lg p-2 ${v.retained ? 'bg-white border border-emerald-200' : 'bg-white/60 border border-gray-200'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="w-5 h-5 rounded-md bg-purple-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                        V{vi + 1}
                                      </span>
                                      <span className="flex-1 text-[11px] font-bold text-gray-800 truncate">
                                        {v.label || `Variante ${vi + 1}`}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                        v.retained ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-700'
                                      }`}>
                                        {v.retained ? 'Retenue' : 'Rejetée'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-gray-700 tabular-nums">{fmt(vTotalComputed)} HT</span>
                                      {baseTot > 0 && Math.abs(deltaVsBase) >= 0.1 && (
                                        <span className={`text-[9px] font-extrabold ${deltaVsBase > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                          {deltaVsBase > 0 ? '+' : ''}{deltaVsBase.toFixed(1)}% vs base
                                        </span>
                                      )}
                                    </div>
                                    {v.justification ? (
                                      <p className="text-[10px] text-gray-600 italic leading-snug">{v.justification}</p>
                                    ) : justifMissing ? (
                                      <p className="text-[10px] text-amber-700 font-bold italic">⚠ Justification d'acceptation requise</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Note prix */}
                        <div className="bg-emerald-50 rounded-lg p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-800">C1. Prix</span>
                            <span className="text-[10px] font-black text-emerald-700">
                              {(companyStats.ranked.find(r => r.kind === 'base' && r.name === c.name)?.score || 0).toFixed(2)} / {companyStats.N}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            Montant : {fmt(companyStats.ranked.find(r => r.kind === 'base' && r.name === c.name)?.total || 0)}
                          </div>
                        </div>

                        {/* Total général */}
                        <div className="bg-gray-900 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white">TOTAL</span>
                          <span className="text-sm font-black text-white">
                            {((companyStats.ranked.find(r => r.kind === 'base' && r.name === c.name)?.score || 0) / companyStats.N * (scoringConfig.maxScore || 40) + totalScore).toFixed(2)} / 100
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="text-center text-gray-500 text-sm py-10">
              Aucun critère technique défini
            </div>
          )}
        </div>
      )}

      {/* ═══ ONGLET DÉTAIL ═══ */}
      {tab === 'detail' && (() => {
        // ── Liste plate base + variantes pour le sélecteur ──
        const detailEntries = [];
        companies.forEach((c, ci) => {
          detailEntries.push({
            key: c.id, kind: 'base', companyId: c.id, companyIndex: ci,
            label: c.name, offers: c.offers || {}, quantities: {},
            removedIds: new Set(), newItems: [],
          });
          (c.variants || []).forEach((v, vi) => {
            detailEntries.push({
              key: `${c.id}_${v.id}`, kind: 'variant', companyId: c.id, companyIndex: ci,
              variantIndex: vi, variantLabel: v.label || `V${vi + 1}`,
              label: `${c.name} · ${v.label || `V${vi + 1}`}`,
              offers: { ...(c.offers || {}), ...(v.offers || {}) },
              quantities: v.quantities || {},
              removedIds: new Set((v.removedItems || []).map(it => it.itemId)),
              newItems: v.newItems || [],
              retained: !!v.retained,
              adminConclusion: v.adminConclusion || null,
            });
          });
        });

        const selectedEntry = detailEntries[selectedCompanyIdx] || detailEntries[0];
        if (!selectedEntry) return null;
        const isVariant = selectedEntry.kind === 'variant';
        const baseColor = getUI(selectedEntry.companyIndex);
        const getQty = (item) => Number(selectedEntry.quantities[item.id] ?? qtyMap[item.id] ?? item.qty ?? 0);

        return (
          <div>
            {/* Sélecteur entreprise/variante */}
            <div className="px-4 pb-2 overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {detailEntries.map((e, i) => {
                  const active = selectedCompanyIdx === i;
                  const isVar = e.kind === 'variant';
                  return (
                    <button
                      key={e.key}
                      onClick={() => setSelectedCompanyIdx(i)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        active
                          ? 'bg-gray-900 text-white shadow-sm'
                          : isVar
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      {isVar && <span className={`text-[8px] font-black px-1 rounded ${active ? 'bg-white/20' : 'bg-purple-200 text-purple-800'}`}>VAR</span>}
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bandeau info variante */}
            {isVariant && (
              <div className="px-4 pb-2">
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 uppercase shrink-0">Variante</span>
                    <span className="text-[11px] font-bold text-purple-900 truncate">{selectedEntry.variantLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedEntry.retained && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Retenue</span>
                    )}
                    {selectedEntry.adminConclusion && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${CONCL_COLORS[selectedEntry.adminConclusion] || 'bg-gray-100 text-gray-700'}`}>
                        {CONCL_LABELS[selectedEntry.adminConclusion] || selectedEntry.adminConclusion}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Items par chapitre */}
            <div className="px-4 space-y-2">
              {chapterStats.map(chap => {
                // Items base filtrés (variantes peuvent supprimer des items)
                const baseItems = chap.items.filter(it => !selectedEntry.removedIds.has(it.id));
                // Items "new" de la variante : on rattache ceux dont chapterId correspond (sinon tous au 1er chap)
                const variantNewItems = isVariant
                  ? selectedEntry.newItems.filter(ni => !ni.chapterId || ni.chapterId === chap.id)
                  : [];
                const allItems = [...baseItems, ...variantNewItems];

                const chapTotal = allItems.reduce((s, it) => s + getQty(it) * Number(selectedEntry.offers[it.id] ?? 0), 0);
                const chapEstTotal = baseItems.reduce((s, it) => s + Number(qtyMap[it.id] ?? it.qty ?? 0) * Number(it.price || 0), 0);
                const ecart = chapEstTotal ? ((chapTotal - chapEstTotal) / chapEstTotal * 100) : 0;

                return (
                  <div key={chap.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setOpenChapter(openChapter === chap.id ? null : chap.id)}
                      className="w-full bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center justify-between active:bg-gray-100"
                    >
                      <span className="text-[11px] font-black text-gray-700 uppercase truncate flex-1 text-left">{chap.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-gray-900 tabular-nums">{fmtShort(chapTotal)}</span>
                        {renderDelta(ecart)}
                      </div>
                    </button>
                    {openChapter === chap.id && (
                      <div className="divide-y divide-gray-50">
                        {allItems.map(item => {
                          const isNew = isVariant && selectedEntry.newItems.includes(item);
                          const qty = getQty(item);
                          const puEst = Number(item.price || 0);
                          const puOffer = Number(selectedEntry.offers[item.id] ?? 0);
                          const ecartItem = puEst ? ((puOffer - puEst) / puEst * 100) : 0;
                          if (qty === 0 && puOffer === 0 && !isNew) return null;

                          return (
                            <div key={item.id} className={`px-3 py-2 ${isNew ? 'bg-emerald-50/40' : ''}`}>
                              <div className="flex items-start gap-1.5">
                                {isNew && <span className="text-[8px] font-black px-1 py-0.5 rounded bg-emerald-200 text-emerald-800 uppercase shrink-0 mt-0.5">Nouveau</span>}
                                <div className="text-[12px] font-medium text-gray-900 leading-tight flex-1">{item.designation}</div>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-gray-500">
                                  {qty} {item.unit}{!isNew && ` · Est. ${fmt(puEst)}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[12px] font-bold tabular-nums ${puOffer === 0 ? 'text-gray-300' : isVariant ? baseColor.text : 'text-gray-900'}`}>
                                    {puOffer === 0 ? '—' : fmt(puOffer)}
                                  </span>
                                  {puOffer > 0 && !isNew && renderDelta(ecartItem)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ═══ ONGLET INFOS (RAO) ═══ */}
      {tab === 'rao' && (
        <div className="px-4 space-y-3">
          {/* Consultation */}
          {(consultation.objet || consultation.client) && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-black text-gray-500 uppercase mb-2">Consultation</div>
              <div className="space-y-1.5 text-xs text-gray-700">
                {consultation.objet && <div><span className="text-gray-500 font-bold">Objet :</span> {consultation.objet}</div>}
                {consultation.client && <div><span className="text-gray-500 font-bold">Client :</span> {consultation.client}</div>}
                {consultation.lieu && <div><span className="text-gray-500 font-bold">Lieu :</span> {consultation.lieu}</div>}
                {consultation.procedure && <div><span className="text-gray-500 font-bold">Procédure :</span> {consultation.procedure}</div>}
                {consultation.lot && <div><span className="text-gray-500 font-bold">Lot :</span> {consultation.lot}</div>}
                {consultation.dateRemise && (
                  <div><span className="text-gray-500 font-bold">Date remise :</span> {consultation.dateRemise}
                    {consultation.timeRemise && ` à ${consultation.timeRemise}`}
                  </div>
                )}
                {consultation.dateNego && <div><span className="text-gray-500 font-bold">Date négo :</span> {consultation.dateNego}</div>}
                {consultation.ref && <div><span className="text-gray-500 font-bold">Réf. :</span> {consultation.ref}</div>}
                {consultation.code && <div><span className="text-gray-500 font-bold">Code affaire :</span> {consultation.code}</div>}
              </div>
            </div>
          )}

          {/* Régime des variantes */}
          {consultation.variantsAllowed && consultation.variantsAllowed !== 'forbidden' && (
            <div className="bg-white rounded-xl border border-purple-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-purple-600 uppercase">Régime des variantes</span>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                  consultation.variantsAllowed === 'mandatory'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {consultation.variantsAllowed === 'mandatory' ? 'Obligatoires' : 'Autorisées'}
                </span>
              </div>
              {consultation.variantsRequirements && (
                <p className="text-[11px] text-gray-700 leading-snug whitespace-pre-wrap">
                  {consultation.variantsRequirements}
                </p>
              )}
            </div>
          )}

          {/* Critères de notation */}
          {raoCriteria.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-black text-gray-500 uppercase mb-2">Critères de notation</div>
              {raoCriteria.map((cr, ci) => {
                const hasSubs = (cr.subCriteria || []).length > 0;
                const weight = cr.auto ? (scoringConfig?.maxScore || cr.weight) : (hasSubs ? cr.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0) : cr.weight);

                return (
                  <div key={cr.id} className="py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-700 font-bold">C{ci + 1}. {cr.label}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${cr.auto ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {weight}%{cr.auto ? ' (prix)' : ''}
                      </span>
                    </div>
                    {cr.description && !hasSubs && (
                      <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{cr.description}</p>
                    )}
                    {hasSubs && (
                      <div className="ml-3 mt-1 space-y-0.5">
                        {cr.subCriteria.map((sc, si) => (
                          <div key={sc.id} className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-600">{ci + 1}.{si + 1} {sc.label}</span>
                            <span className="text-[10px] font-bold text-gray-500">{sc.weight}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Négociations */}
          {companies.some(c => {
            const nego = raoCompanies[c.name]?.negotiation;
            return nego?.questions || nego?.responses;
          }) && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-black text-gray-500 uppercase mb-2">Négociations</div>
              {companies.map(c => {
                const nego = raoCompanies[c.name]?.negotiation;
                if (!nego?.questions && !nego?.responses) return null;
                return (
                  <div key={c.id} className="py-2 border-b border-gray-50 last:border-0">
                    <p className="text-xs font-bold text-gray-800 mb-1">{c.name}</p>
                    {nego.questions && (
                      <div className="mb-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase">Questions</p>
                        <p className="text-[11px] text-gray-700 leading-snug">{nego.questions}</p>
                      </div>
                    )}
                    {nego.responses && (
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase">Réponses</p>
                        <p className="text-[11px] text-gray-700 leading-snug">{nego.responses}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Note légale */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <p className="text-[9px] text-gray-500 leading-relaxed">
              <strong className="text-gray-600">Réf. légales :</strong> Classement établi conformément aux articles R2152-1,
              R2152-6 et R2152-7 du Code de la commande publique. Les critères et pondérations ont été portés
              à la connaissance des candidats dans les documents de consultation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
