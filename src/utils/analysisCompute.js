// src/utils/analysisCompute.js
//
// Calculs derives de l'analyse comparative des offres.
// Extrait de usePriceAnalysis.js pour pouvoir etre reutilise cote mobile
// (les exports mobile chargent uniquement analysis.companies depuis Firestore
// et doivent recalculer chaptersData + stats localement avant export PDF/Excel).

const SCORING_MODES = {
  f1: (N, Pmin, P)              => N * (Pmin / P),
  f2: (N, Pmin, P)              => N * Math.pow(Pmin / P, 2),
  f3: (N, Pmin, P)              => N * Math.pow(Pmin / P, 3),
  f4: (N, Pmin, P)              => N * (1 - (P - Pmin) / Pmin),
  f5: (N, Pmin, P, _Pmax, Pmoy) => N * (1 - (P - Pmin) / Pmoy),
  f6: (N, Pmin, P, _Pmax, Pmoy) => P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2),
  f7: (N, Pmin, P, Pmax)        => Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin)),
  f8: (N, _Pmin, P, _Pmax, Pmoy)=> (N * Pmoy) / (Pmoy + P),
  f9: (N, Pmin, P)              => N * ((2 * Pmin) / (Pmin + P)),
};

/**
 * Note prix d'une offre selon la formule choisie (f1..f9), bornée à [0, N].
 * Primitif partagé desktop (computeAnalysisStats) ET mobile (RAOView) : c'est
 * LA source unique de la formule de notation, pour éviter toute divergence.
 * Signature alignée sur l'usage mobile : (P, Pmin, Pmax, Pmoy, N, mode).
 *
 * @returns {number} note dans [0, N] (0 si l'offre est nulle/absente)
 */
export function scoreOffer(P, Pmin, Pmax, Pmoy, N, mode) {
  if (!(P > 0)) return 0;
  const fn = SCORING_MODES[mode] || SCORING_MODES.f1;
  return Math.max(0, Math.min(N, fn(N, Pmin, P, Pmax, Pmoy)));
}

/**
 * Seuil OAB (Offre Anormalement Basse) par la méthode de la Double Moyenne,
 * avec le détail des étapes intermédiaires (pour l'affichage pédagogique).
 * Source unique partagée : AnalysisTable, OabDetailModal et le mobile.
 *
 *  M1      = moyenne des offres valides (> 0)
 *  plafond = M1 × 1.20  (écarte les offres trop hautes)
 *  M2      = moyenne des offres ≤ plafond
 *  seuil   = M2 × 0.90  (une offre en dessous est « anormalement basse »)
 *
 * @param   {number[]} values - totaux des offres
 * @returns {{ M1:number, plafond:number, filtered:number[], M2:number, threshold:number }}
 */
export function computeOABDetail(values) {
  const valid = (Array.isArray(values) ? values : []).filter(v => v > 0);
  if (valid.length === 0) return { M1: 0, plafond: 0, filtered: [], M2: 0, threshold: 0 };

  const M1       = valid.reduce((a, b) => a + b, 0) / valid.length;
  const plafond  = M1 * 1.20;
  const filtered = valid.filter(v => v <= plafond);
  const M2       = filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : M1;
  const threshold = (filtered.length > 0 ? M2 : M1) * 0.90;

  return { M1, plafond, filtered, M2, threshold };
}

/** Seuil OAB seul (raccourci sur computeOABDetail). */
export function computeOABThreshold(values) {
  return computeOABDetail(values).threshold;
}

/**
 * Construit chaptersData : liste de chapitres avec leurs items enrichis
 * de companyData (PU, lineTotal, ecart) par entreprise.
 *
 * @param {Object} project - { chapters }
 * @param {Array}  companies - [{ id, name, offers: { [itemId]: PU } }]
 * @param {Object} clientQtyMap - { [itemId]: quantite } pour la tranche active
 */
export function computeChaptersData(project, companies, clientQtyMap) {
  if (!project?.chapters) return [];
  const qty = clientQtyMap || {};
  const safeCompanies = Array.isArray(companies) ? companies : [];

  return project.chapters.map(chapter => {
    const items = [];
    const extract = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'item') {
          const activeQty       = qty[node.id] || 0;
          const estimationPU    = Number(node.price || 0);
          const estimationTotal = activeQty * estimationPU;
          const companyData     = {};
          let minPU = Infinity, maxPU = -Infinity, minTotal = Infinity, maxTotal = -Infinity;

          safeCompanies.forEach(company => {
            const pu        = Number(company.offers?.[node.id] ?? 0);
            const lineTotal = activeQty * pu;
            const ecartAbs  = lineTotal - estimationTotal;
            const ecartPct  = estimationTotal !== 0 ? (ecartAbs / estimationTotal) * 100 : 0;
            companyData[company.id] = { pu, lineTotal, ecartAbs, ecartPct };
            if (pu > 0) {
              if (pu < minPU) minPU = pu;
              if (pu > maxPU) maxPU = pu;
              if (lineTotal < minTotal) minTotal = lineTotal;
              if (lineTotal > maxTotal) maxTotal = lineTotal;
            }
          });

          items.push({
            ...node,
            activeQty,
            estimationPU,
            estimationTotal,
            companyData,
            minPU:    minPU    === Infinity  ? 0 : minPU,
            maxPU:    maxPU    === -Infinity ? 0 : maxPU,
            minTotal: minTotal === Infinity  ? 0 : minTotal,
            maxTotal: maxTotal === -Infinity ? 0 : maxTotal,
            chapterId:    chapter.id,
            chapterTitle: chapter.title,
          });
        } else if (node.children) {
          extract(node.children);
        }
      });
    };
    extract(chapter.children || []);
    return { id: chapter.id, title: chapter.title, isOption: chapter.isOption, items };
  });
}

/**
 * Calcule les statistiques globales : totaux par entreprise, Pmin/Pmax/Pmoy,
 * scores selon scoringConfig.mode (f1..f9).
 *
 * @param {Array}  chaptersData - sortie de computeChaptersData
 * @param {Array}  companies
 * @param {Object} scoringConfig - { mode: 'f1'..'f9', maxScore: number }
 */
export function computeAnalysisStats(chaptersData, companies, scoringConfig) {
  const report = {
    totalEstimation: 0,
    companiesTotals: {},
    companyScores:   {},
    companyEcarts:   {},
    Pmin: 0, Pmax: 0, Pmoy: 0,
  };
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeChapters  = Array.isArray(chaptersData) ? chaptersData : [];

  safeChapters.forEach(chap => {
    if (chap.isOption) return;
    chap.items.forEach(item => {
      report.totalEstimation += item.estimationTotal;
      safeCompanies.forEach(company => {
        if (!report.companiesTotals[company.id]) report.companiesTotals[company.id] = 0;
        report.companiesTotals[company.id] += item.companyData[company.id]?.lineTotal ?? 0;
      });
    });
  });

  const totals = Object.values(report.companiesTotals).filter(t => t > 0);
  if (totals.length === 0) return report;

  const Pmin = Math.min(...totals);
  const Pmax = Math.max(...totals);
  const Pmoy = totals.reduce((a, b) => a + b, 0) / totals.length;
  const N    = Number(scoringConfig?.maxScore || 40);
  const mode = scoringConfig?.mode || 'f1';

  report.Pmin = Pmin;
  report.Pmax = Pmax;
  report.Pmoy = Pmoy;

  safeCompanies.forEach(company => {
    const P = report.companiesTotals[company.id] || 0;
    const ecartAbs = P - report.totalEstimation;
    const ecartPct = report.totalEstimation !== 0 ? (ecartAbs / report.totalEstimation) * 100 : 0;
    report.companyEcarts[company.id] = { abs: ecartAbs, pct: ecartPct };
    report.companyScores[company.id] = scoreOffer(P, Pmin, Pmax, Pmoy, N, mode);
  });

  return report;
}
