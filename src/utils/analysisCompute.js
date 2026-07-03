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
 * Référence de prix (Pmin / Pmax / Pmoy) servant à la notation du critère prix.
 * TOUTES les offres concourent (régulières ET irrégulières) — la régularité relève
 * d'une décision du pouvoir adjudicateur, pas du barème. Simple min / max / moyenne
 * des totaux valides (> 0).
 *
 * @param   {number[]} values - totaux HT des offres concourantes
 * @returns {{ Pmin:number, Pmax:number, Pmoy:number }}
 */
export function computePriceReference(values) {
  const valid = (Array.isArray(values) ? values : []).filter(v => v > 0);
  if (valid.length === 0) return { Pmin: 0, Pmax: 0, Pmoy: 0 };
  return {
    Pmin: Math.min(...valid),
    Pmax: Math.max(...valid),
    Pmoy: valid.reduce((a, b) => a + b, 0) / valid.length,
  };
}

/**
 * Offres effectives d'une entreprise selon la phase d'analyse.
 * Phase « après négociation » : les prix négociés (offersNego) se substituent
 * article par article aux prix initiaux — un article non renégocié (ou une
 * entreprise sans contre-proposition) conserve son prix initial.
 *
 * @param {Object} company - { offers, offersNego }
 * @param {string} basis   - 'initial' (défaut) | 'nego'
 * @returns {Object} { [itemId]: PU }
 */
export function getEffectiveOffers(company, basis = 'initial') {
  const offers = company?.offers || {};
  if (basis !== 'nego') return offers;
  const nego = company?.offersNego;
  if (!nego || Object.keys(nego).length === 0) return offers;
  return { ...offers, ...nego };
}

/**
 * Rabais commercial (%) consenti par l'entreprise sur son Total HT en phase
 * de négociation. Ne s'applique qu'en basis 'nego' ; borné à [0, 100].
 * Le rabais porte sur le TOTAL (les PU du DQE restent bruts à l'affichage).
 */
export function getCompanyRabaisPct(company, basis = 'initial') {
  if (basis !== 'nego') return 0;
  const r = Number(company?.negoRabaisPct);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.min(100, r);
}

// Statuts d'offre « non réguliers » (CCP L2152-2 et s.). Source unique.
export const NON_REGULAR_CONCLUSIONS = ['irreguliere', 'inacceptable', 'inappropriee'];

/**
 * Statut de régularité EFFECTIF d'une offre selon la phase. En phase 'nego', le
 * statut « après négociation » (admin.conclusionNego) prend le pas sur le statut
 * initial (admin.conclusion) : cela permet de RÉGULARISER une offre irrégulière à
 * l'issue de la négociation (CCP R2152-2). Sans override, le statut initial est
 * conservé (hérité). En phase 'initial', on lit toujours le statut initial.
 *
 * @param {Object} admin - rao.companies[name].admin
 * @param {string} basis - 'initial' (défaut) | 'nego'
 * @returns {string|undefined} 'reguliere' | 'irreguliere' | 'inacceptable' | 'inappropriee'
 */
export function getEffectiveConclusion(admin, basis = 'initial') {
  if (!admin) return undefined;
  return (basis === 'nego' && admin.conclusionNego) ? admin.conclusionNego : admin.conclusion;
}

/** Vrai si le statut effectif est non régulier (irrégulière / inacceptable / inappropriée). */
export function isConclusionNonRegular(admin, basis = 'initial') {
  const c = getEffectiveConclusion(admin, basis);
  return !!c && NON_REGULAR_CONCLUSIONS.includes(c);
}

/**
 * Vrai si l'offre a été RÉGULARISÉE en négociation : statut initial non régulier
 * mais statut « après négo » régulier. Sert à documenter la transition (§5.bis PDF).
 */
export function isRegularizedAfterNego(admin) {
  if (!admin) return false;
  const wasNonRegular = !!admin.conclusion && NON_REGULAR_CONCLUSIONS.includes(admin.conclusion);
  return wasNonRegular && admin.conclusionNego === 'reguliere';
}

/** Vrai si la variante porte des données négociées (prix ré-importés ou total dénormalisé). */
export function variantHasNego(variant) {
  return !!(variant?.offersNego && Object.keys(variant.offersNego).length > 0) || variant?.totalNego != null;
}

/** Vrai si au moins une entreprise porte des prix négociés, un rabais commercial ou une variante négociée. */
export function companiesHaveNego(companies) {
  return (Array.isArray(companies) ? companies : []).some(c =>
    (c?.offersNego && Object.keys(c.offersNego).length > 0)
    || getCompanyRabaisPct(c, 'nego') > 0
    || (c?.variants || []).some(variantHasNego)
  );
}

/**
 * Offres effectives d'une VARIANTE : fusion base + variante, puis prix négociés
 * propres à la variante (v.offersNego) en phase 'nego'. Les prix négociés de la
 * BASE ne s'appliquent pas à la variante — une variante est une offre
 * indépendante (CCP R2151-8), renégociée via son propre fichier.
 */
export function getEffectiveVariantOffers(company, variant, basis = 'initial') {
  const merged = { ...(company?.offers || {}), ...(variant?.offers || {}) };
  if (basis !== 'nego') return merged;
  const nego = variant?.offersNego;
  if (!nego || Object.keys(nego).length === 0) return merged;
  return { ...merged, ...nego };
}

/**
 * Total d'une variante recalculé à la volée — source unique desktop / mobile /
 * écran d'accueil RAO. Applique le rabais commercial GLOBAL de l'entreprise en
 * phase 'nego' (le rabais porte sur le Total HT, base et variantes).
 *
 * @param {Array}  items  - liste plate d'items { id, qty? } (qty = repli si absent des cartes)
 * @param {Object} qtyMap - quantités à valoir { [itemId]: qté }
 */
export function computeVariantTotal(company, variant, items, qtyMap, basis = 'initial') {
  const offers  = getEffectiveVariantOffers(company, variant, basis);
  const removed = new Set((variant?.removedItems || []).map(it => it.itemId));
  const vQtys   = variant?.quantities || {};
  const qm      = qtyMap || {};
  let total = 0;
  (items || []).forEach(it => {
    if (removed.has(it.id)) return;
    const pu  = Number(offers[it.id] ?? 0);
    const qty = Number(vQtys[it.id] ?? qm[it.id] ?? it.qty ?? 0);
    total += qty * pu;
  });
  (variant?.newItems || []).forEach(it => {
    total += Number(it.lineTotal || ((it.qty || 0) * (it.price || 0)) || 0);
  });
  const rabais = getCompanyRabaisPct(company, basis);
  if (rabais > 0) total *= (1 - rabais / 100);
  return Math.round(total * 100) / 100;
}

/**
 * Total effectif d'une variante à partir des totaux DÉNORMALISÉS (v.total à
 * l'import initial, v.totalNego à l'import négocié — stockés BRUTS), rabais
 * commercial global déduit en 'nego'. Pour les surfaces sans contexte
 * quantités (Récap, synthèses PDF, comparatif avant/après).
 */
export function getVariantEffectiveTotal(company, variant, basis = 'initial') {
  const brut = basis === 'nego'
    ? Number(variant?.totalNego ?? variant?.total ?? 0)
    : Number(variant?.total ?? 0);
  const rabais = getCompanyRabaisPct(company, basis);
  return rabais > 0 ? Math.round(brut * (1 - rabais / 100) * 100) / 100 : brut;
}

/**
 * Construit chaptersData : liste de chapitres avec leurs items enrichis
 * de companyData (PU, lineTotal, ecart) par entreprise.
 *
 * @param {Object} project - { chapters }
 * @param {Array}  companies - [{ id, name, offers: { [itemId]: PU }, offersNego? }]
 * @param {Object} clientQtyMap - { [itemId]: quantite } pour la tranche active
 * @param {string} basis - 'initial' (défaut) | 'nego' : phase des prix utilisés.
 *                 En phase 'nego', companyData porte aussi puInitial (prix avant négo).
 */
export function computeChaptersData(project, companies, clientQtyMap, basis = 'initial') {
  if (!project?.chapters) return [];
  const qty = clientQtyMap || {};
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const isNego = basis === 'nego';

  // Offres effectives par entreprise, résolues une fois pour toute la structure.
  const effectiveOffers = new Map(
    safeCompanies.map(c => [c.id, getEffectiveOffers(c, basis)])
  );

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
            const pu        = Number(effectiveOffers.get(company.id)?.[node.id] ?? 0);
            const lineTotal = activeQty * pu;
            const ecartAbs  = lineTotal - estimationTotal;
            const ecartPct  = estimationTotal !== 0 ? (ecartAbs / estimationTotal) * 100 : 0;
            companyData[company.id] = { pu, lineTotal, ecartAbs, ecartPct };
            if (isNego) companyData[company.id].puInitial = Number(company.offers?.[node.id] ?? 0);
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
 * @param {string} basis - 'initial' (défaut) | 'nego'. En 'nego', le rabais
 *                 commercial (negoRabaisPct) est déduit du Total HT de chaque
 *                 entreprise : companiesTotals devient NET de rabais (la
 *                 notation porte dessus), companiesTotalsBrut conserve le brut
 *                 et companiesRabais expose les % appliqués.
 */
export function computeAnalysisStats(chaptersData, companies, scoringConfig, basis = 'initial') {
  const report = {
    totalEstimation: 0,
    companiesTotals: {},
    companiesTotalsBrut: {},
    companiesRabais: {},
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

  // Rabais commercial (phase négo) : déduit du total HT, article par article
  // les PU restent bruts — seul le total (et donc la notation) est net.
  report.companiesTotalsBrut = { ...report.companiesTotals };
  safeCompanies.forEach(company => {
    const rabais = getCompanyRabaisPct(company, basis);
    if (rabais > 0) {
      report.companiesRabais[company.id] = rabais;
      report.companiesTotals[company.id] =
        Math.round((report.companiesTotals[company.id] || 0) * (1 - rabais / 100) * 100) / 100;
    }
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
