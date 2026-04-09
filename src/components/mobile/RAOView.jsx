// src/components/mobile/RAOView.jsx — Vue mobile RAO complète (consultation)
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

// ─── Onglets ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'recap', label: 'Récap' },
  { id: 'chapters', label: 'Chapitres' },
  { id: 'detail', label: 'Détail' },
  { id: 'rao', label: 'RAO' },
];

export default function RAOView({ project, companyId, calcHook }) {
  const [tab, setTab] = useState('recap');
  const [companies, setCompanies] = useState([]);
  const [scoringConfig, setScoringConfig] = useState({ maxScore: 40, mode: 'f1' });
  const [loading, setLoading] = useState(true);
  const [openChapter, setOpenChapter] = useState(null);
  const [selectedCompanyIdx, setSelectedCompanyIdx] = useState(0);

  // ─── Chargement depuis Firestore ──────────────────────────────────────
  useEffect(() => {
    if (!project?.id || !companyId) { setLoading(false); return; }
    const docRef = doc(fireDb, 'companies', companyId, 'projects', project.id, 'analysis', 'data');
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.companies) setCompanies(d.companies);
        if (d.scoringConfig) setScoringConfig(d.scoringConfig);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [project?.id, companyId]);

  // ─── Données de calcul ────────────────────────────────────────────────
  const clientQtyMaps = calcHook?.clientQtyMaps || {};
  const qtyMap = clientQtyMaps['global'] || {};

  const chapters = useMemo(() => {
    if (!project?.chapters) return [];
    return project.chapters.filter(c => !c.isOption);
  }, [project?.chapters]);

  const allItems = useMemo(() => flattenItems(project?.chapters || []), [project?.chapters]);

  // ─── Estimation totale ────────────────────────────────────────────────
  const totalEstimation = useMemo(() => {
    return allItems.reduce((sum, item) => {
      const qty = Number(qtyMap[item.id] || item.qty || 0);
      return sum + qty * Number(item.price || 0);
    }, 0);
  }, [allItems, qtyMap]);

  // ─── Totaux par entreprise ────────────────────────────────────────────
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
              className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all ${
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
          {companyStats.ranked.map((c, i) => (
            <div key={c.id} className={`bg-white rounded-xl border overflow-hidden ${c.isOAB ? 'border-amber-400 ring-1 ring-amber-200' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2.5 p-3">
                {/* Rang */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i < 3 ? RANK_COLORS[i] : 'bg-gray-100'}`}>
                  {i === 0 ? <Icon name="trophy" size={16} color="#92400e" /> :
                    <span className={`text-sm font-black ${i < 3 ? RANK_TEXT[i] : 'text-gray-600'}`}>{c.rank}</span>}
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

                {/* Total + Note */}
                <div className="text-right shrink-0">
                  <div className={`text-sm font-extrabold ${i === 0 ? 'text-blue-600' : 'text-gray-900'}`}>{fmtShort(c.total)}</div>
                  <div className="text-[10px] font-bold text-indigo-500 mt-0.5">
                    {c.score.toFixed(1)} / {companyStats.N}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Info OAB */}
          {companyStats.oabThreshold > 0 && (
            <div className="text-[10px] text-center text-amber-600 font-medium py-2">
              Seuil OAB : {fmt(companyStats.oabThreshold)} · Formule {scoringConfig.mode?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* ═══ ONGLET CHAPITRES ═══ */}
      {tab === 'chapters' && (
        <div className="px-4 space-y-1.5">
          {chapterStats.map(chap => (
            <div key={chap.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header chapitre */}
              <button
                onClick={() => setOpenChapter(openChapter === chap.id ? null : chap.id)}
                className="w-full flex items-center gap-2 p-3 active:bg-gray-50"
              >
                <Icon name="chevron" size={12} color="#6b7280" />
                <span className="flex-1 text-left text-[13px] font-bold text-gray-900 truncate">{chap.title}</span>
                <span className="text-xs font-bold text-gray-500">{fmtShort(chap.estTotal)}</span>
              </button>

              {/* Détail par entreprise */}
              {openChapter === chap.id && (
                <div className="border-t border-gray-100 px-3 pb-2 space-y-1">
                  {chap.companyTotals.map(ct => {
                    const ecart = chap.estTotal ? ((ct.total - chap.estTotal) / chap.estTotal * 100) : 0;
                    return (
                      <div key={ct.id} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-gray-700 truncate flex-1">{ct.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 tabular-nums">{fmtShort(ct.total)}</span>
                          {renderDelta(ecart)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ ONGLET DÉTAIL ═══ */}
      {tab === 'detail' && (
        <div>
          {/* Sélecteur entreprise (pills scrollables) */}
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

              return (
                <div key={chap.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                    <span className="text-[11px] font-black text-gray-700 uppercase">{chap.title}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {chap.items.map(item => {
                      const qty = Number(qtyMap[item.id] || item.qty || 0);
                      const puEst = Number(item.price || 0);
                      const puOffer = Number(selectedCompany.offers?.[item.id] ?? 0);
                      const ecart = puEst ? ((puOffer - puEst) / puEst * 100) : 0;
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
                              {puOffer > 0 && renderDelta(ecart)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ONGLET RAO ═══ */}
      {tab === 'rao' && (
        <div className="px-4 space-y-3">
          {/* Critères */}
          {project?.rao?.criteria?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-black text-gray-500 uppercase mb-2">Critères de notation</div>
              {project.rao.criteria.map(cr => (
                <div key={cr.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-700">{cr.label}</span>
                  <span className={`text-xs font-black ${cr.auto ? 'text-blue-600' : 'text-indigo-600'}`}>
                    {cr.weight}%{cr.auto ? ' (prix)' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Classement final RAO */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[10px] font-black text-gray-500 uppercase mb-2">Classement final</div>

            {companyStats.ranked.map((c, i) => {
              // Note technique depuis project.rao.companies
              const raoCompany = project?.rao?.companies?.[c.name];
              const techCriteria = project?.rao?.criteria?.filter(cr => !cr.auto) || [];
              const techTotal = techCriteria.reduce((sum, cr) => {
                const note = raoCompany?.technical?.[cr.id]?.note || 0;
                const noteMax = raoCompany?.technical?.[cr.id]?.noteMax || cr.weight;
                return sum + (noteMax > 0 ? (note / noteMax) * cr.weight : 0);
              }, 0);

              const priceCriterion = project?.rao?.criteria?.find(cr => cr.auto);
              const priceWeight = priceCriterion?.weight || 40;
              const priceNote = companyStats.N > 0 ? (c.score / companyStats.N) * priceWeight : 0;
              const totalNote = priceNote + techTotal;

              return (
                <div key={c.id} className={`flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0 ${i === 0 ? 'bg-emerald-50/50 -mx-3 px-3 rounded-lg' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {i + 1}
                  </div>
                  <span className="flex-1 text-xs font-bold text-gray-900 truncate">{c.name}</span>
                  <div className="flex items-center gap-3 text-[10px] tabular-nums">
                    <span className="text-blue-600 font-bold" title="Note prix">{priceNote.toFixed(1)}</span>
                    {techCriteria.length > 0 && (
                      <span className="text-indigo-600 font-bold" title="Note technique">{techTotal.toFixed(1)}</span>
                    )}
                    <span className={`font-black text-sm ${i === 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {totalNote.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Légende */}
            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
              <span className="text-[9px] text-blue-600 font-bold">● Prix</span>
              {(project?.rao?.criteria?.filter(cr => !cr.auto) || []).length > 0 && (
                <span className="text-[9px] text-indigo-600 font-bold">● Technique</span>
              )}
              <span className="text-[9px] text-gray-900 font-bold">● Total / 100</span>
            </div>
          </div>

          {/* Infos consultation */}
          {project?.rao?.consultation?.objet && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-black text-gray-500 uppercase mb-2">Consultation</div>
              <div className="space-y-1 text-xs text-gray-700">
                {project.rao.consultation.objet && <div><span className="text-gray-500">Objet :</span> {project.rao.consultation.objet}</div>}
                {project.rao.consultation.client && <div><span className="text-gray-500">Client :</span> {project.rao.consultation.client}</div>}
                {project.rao.consultation.dateRemise && <div><span className="text-gray-500">Remise :</span> {project.rao.consultation.dateRemise}</div>}
                {project.rao.consultation.lot && <div><span className="text-gray-500">Lot :</span> {project.rao.consultation.lot}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
