// src/components/mobile/RAOView.jsx — Vue mobile RAO complète (consultation)
// Charge depuis Firestore : analysis/data + rao/data
// Onglets : Récap · Admin · Technique · Détail · RAO
import React, { useState, useMemo, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db as fireDb } from '../../firebase';
import Icon from './Icon';
import { fmt, fmtShort } from './formatters';
import { flattenItems } from './helpers';

// ─── OAB (Double Moyenne) ────────────────────────────────────────────────────
const calcOAB = (values) => {
  const v = values.filter(x => x > 0);
  if (!v.length) return 0;
  const M1 = v.reduce((a, b) => a + b, 0) / v.length;
  const f = v.filter(x => x <= M1 * 1.2);
  const M2 = f.length ? f.reduce((a, b) => a + b, 0) / f.length : M1;
  return (f.length ? M2 : M1) * 0.9;
};

// ─── Scoring formules ────────────────────────────────────────────────────────
const calcScore = (P, Pmin, Pmax, Pmoy, N, mode) => {
  if (!P || P <= 0) return 0;
  switch (mode) {
    case 'f1': return N * (Pmin / P);
    case 'f2': return N * Math.pow(Pmin / P, 2);
    case 'f3': return N * Math.pow(Pmin / P, 3);
    case 'f4': return N * (1 - (P - Pmin) / Pmin);
    case 'f5': return N * (1 - (P - Pmin) / Pmoy);
    case 'f6': return P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2);
    case 'f7': return Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin));
    case 'f8': return (N * Pmoy) / (Pmoy + P);
    case 'f9': return N * ((2 * Pmin) / (Pmin + P));
    default: return N * (Pmin / P);
  }
};

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

  const totalEstimation = useMemo(() => {
    return allItems.reduce((sum, item) => {
      const qty = Number(qtyMap[item.id] || item.qty || 0);
      return sum + qty * Number(item.price || 0);
    }, 0);
  }, [allItems, qtyMap]);

  // ─── Totaux par entreprise + scores ──────────────────────────────────
  const companyStats = useMemo(() => {
    const totals = companies.map(c => {
      let total = 0;
      allItems.forEach(item => {
        const qty = Number(qtyMap[item.id] || item.qty || 0);
        const pu = Number(c.offers?.[item.id] ?? 0);
        total += qty * pu;
      });
      return { ...c, total };
    });

    const validTotals = totals.filter(c => c.total > 0).map(c => c.total);
    const Pmin = validTotals.length ? Math.min(...validTotals) : 0;
    const Pmax = validTotals.length ? Math.max(...validTotals) : 0;
    const Pmoy = validTotals.length ? validTotals.reduce((a, b) => a + b, 0) / validTotals.length : 0;
    const oabThreshold = calcOAB(validTotals);
    const N = scoringConfig.maxScore || 40;
    const mode = scoringConfig.mode || 'f1';

    const ranked = totals
      .map(c => ({
        ...c,
        score: calcScore(c.total, Pmin, Pmax, Pmoy, N, mode),
        ecart: totalEstimation ? ((c.total - totalEstimation) / totalEstimation * 100) : 0,
        isOAB: c.total > 0 && c.total < oabThreshold,
      }))
      .sort((a, b) => a.total - b.total)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    return { ranked, Pmin, Pmax, Pmoy, oabThreshold, N, mode };
  }, [companies, allItems, qtyMap, totalEstimation, scoringConfig]);

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
        const qty = Number(qtyMap[item.id] || item.qty || 0);
        return s + qty * Number(item.price || 0);
      }, 0);
      const companyTotals = companies.map(c => {
        const total = chapItems.reduce((s, item) => {
          const qty = Number(qtyMap[item.id] || item.qty || 0);
          return s + qty * Number(c.offers?.[item.id] ?? 0);
        }, 0);
        return { id: c.id, name: c.name, total };
      });
      return { id: chap.id, title: chap.title || chap.designation, estTotal, companyTotals, items: chapItems };
    });
  }, [chapters, companies, qtyMap]);

  // ─── Classement final (prix + technique) ─────────────────────────────
  const ranking = useMemo(() => {
    const nonAuto = raoCriteria.filter(c => !c.auto);
    const priceCrit = raoCriteria.find(c => c.auto);
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

          {/* Classement final */}
          {ranking.map((c, i) => {
            const ui = getUI(companies.findIndex(co => co.name === c.name));
            return (
              <div key={c.id} className={`bg-white rounded-xl border overflow-hidden ${c.isOAB ? 'border-amber-400 ring-1 ring-amber-200' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2.5 p-3">
                  {/* Rang */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i < 3 ? RANK_COLORS[i] : 'bg-gray-100'}`}>
                    {i === 0 ? <Icon name="trophy" size={16} color="#92400e" /> :
                      <span className={`text-sm font-black ${i < 3 ? RANK_TEXT[i] : 'text-gray-600'}`}>{c.finalRank}</span>}
                  </div>

                  {/* Nom + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{c.name}</div>
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
                L'entreprise <strong>{ranking[0].name}</strong> est classée 1ère avec {ranking[0].totalNote.toFixed(2)}/100.
              </p>
              <p className="text-[10px] text-emerald-200 mt-1">
                {fmt(ranking[0].total)} HT — {fmt(ranking[0].total * 1.2)} TTC
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

                        {/* Note prix */}
                        <div className="bg-emerald-50 rounded-lg p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-800">C1. Prix</span>
                            <span className="text-[10px] font-black text-emerald-700">
                              {(companyStats.ranked.find(r => r.name === c.name)?.score || 0).toFixed(2)} / {companyStats.N}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            Montant : {fmt(companyStats.ranked.find(r => r.name === c.name)?.total || 0)}
                          </div>
                        </div>

                        {/* Total général */}
                        <div className="bg-gray-900 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white">TOTAL</span>
                          <span className="text-sm font-black text-white">
                            {((companyStats.ranked.find(r => r.name === c.name)?.score || 0) / companyStats.N * (scoringConfig.maxScore || 40) + totalScore).toFixed(2)} / 100
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
      {tab === 'detail' && (
        <div>
          {/* Sélecteur entreprise */}
          <div className="px-4 pb-2 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {companies.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCompanyIdx(i)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedCompanyIdx === i
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items par chapitre */}
          <div className="px-4 space-y-2">
            {chapterStats.map(chap => {
              const selectedCompany = companies[selectedCompanyIdx];
              if (!selectedCompany) return null;
              const chapTotal = chap.companyTotals.find(ct => ct.id === selectedCompany.id)?.total || 0;
              const ecart = chap.estTotal ? ((chapTotal - chap.estTotal) / chap.estTotal * 100) : 0;

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
                      {chap.items.map(item => {
                        const qty = Number(qtyMap[item.id] || item.qty || 0);
                        const puEst = Number(item.price || 0);
                        const puOffer = Number(selectedCompany.offers?.[item.id] ?? 0);
                        const ecartItem = puEst ? ((puOffer - puEst) / puEst * 100) : 0;
                        if (qty === 0 && puOffer === 0) return null;

                        return (
                          <div key={item.id} className="px-3 py-2">
                            <div className="text-[12px] font-medium text-gray-900 leading-tight">{item.designation}</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-gray-500">
                                {qty} {item.unit} · Est. {fmt(puEst)}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[12px] font-bold tabular-nums ${puOffer === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                                  {puOffer === 0 ? '—' : fmt(puOffer)}
                                </span>
                                {puOffer > 0 && renderDelta(ecartItem)}
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
      )}

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
