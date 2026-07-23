import { DEFAULT_CRITERIA } from '../hooks/useRao';
import {
  companiesHaveNego,
  computeAnalysisStats,
  computeChaptersData,
  computePriceReference,
  getCompanyRabaisPct,
  getEffectiveConclusion,
  getEffectiveTechnical,
  getVariantEffectiveTotal,
  scoreOffer,
  variantHasNego,
} from './analysisCompute';

export const buildRaoConsultation = (project = {}, rao = {}) => ({
  objet: project.name || '',
  subtitle1: project.subtitle1 || '',
  subtitle2: project.subtitle2 || '',
  client: project.client || '',
  moe: project.moe || 'PAPYRUS',
  code: project.code || '',
  lieu: project.location || '',
  marketType: project.marketType || 'Privé',
  phase: project.phase || 'DCE',
  duration: project.duration || '',
  prepPeriod: project.prepPeriod || '1 mois',
  lot: '',
  procedure: '',
  dateNego: '',
  ...(rao.consultation || {}),
  dateRemise: project.dateRemise || rao.consultation?.dateRemise || '',
  timeRemise: project.timeRemise || rao.consultation?.timeRemise || '',
});

export const ensureRaoCriteria = (criteria) => {
  const safeCriteria = Array.isArray(criteria) && criteria.length > 0
    ? criteria
    : DEFAULT_CRITERIA;
  return safeCriteria.some((criterion) => criterion.auto)
    ? safeCriteria
    : [DEFAULT_CRITERIA[0], ...safeCriteria];
};

const includeSelectedOptions = ({
  stats,
  chaptersData,
  includedOptions,
  companies,
  scoringConfig,
  basis,
}) => {
  if (!stats) return null;
  const optionChapters = chaptersData.filter(
    (chapter) => chapter.isOption && includedOptions[chapter.id],
  );
  if (optionChapters.length === 0) return stats;

  const companiesTotals = { ...stats.companiesTotals };
  let totalEstimation = stats.totalEstimation;

  optionChapters.forEach((chapter) => {
    chapter.items.forEach((item) => {
      totalEstimation += item.estimationTotal || (item.activeQty * (item.price || 0));
      companies.forEach((company) => {
        const lineTotal = item.companyData?.[company.id]?.lineTotal ?? 0;
        const rabais = getCompanyRabaisPct(company, basis);
        companiesTotals[company.id] = (companiesTotals[company.id] || 0)
          + (rabais > 0 ? lineTotal * (1 - rabais / 100) : lineTotal);
      });
    });
  });

  const { Pmin, Pmax, Pmoy } = computePriceReference(Object.values(companiesTotals));
  const maxScore = Number(scoringConfig?.maxScore || 40);
  const mode = scoringConfig?.mode || 'f1';
  const companyScores = {};
  const companyEcarts = {};

  companies.forEach((company) => {
    const price = companiesTotals[company.id] || 0;
    companyScores[company.id] = Pmin > 0
      ? scoreOffer(price, Pmin, Pmax, Pmoy, maxScore, mode)
      : 0;
    const abs = price - totalEstimation;
    companyEcarts[company.id] = {
      abs,
      pct: totalEstimation ? (abs / totalEstimation) * 100 : 0,
    };
  });

  return {
    ...stats,
    totalEstimation,
    companiesTotals,
    companyScores,
    companyEcarts,
    Pmin,
    Pmax,
    Pmoy,
  };
};

export const computeRaoRanking = ({
  companies,
  rao,
  criteria,
  scoringConfig,
  stats,
  basis,
}) => {
  const maxScore = Number(scoringConfig?.maxScore || 40);
  const mode = scoringConfig?.mode || 'f1';
  const totals = stats?.companiesTotals || {};
  const { Pmin, Pmax, Pmoy } = computePriceReference(
    companies.map((company) => totals[company.id] || 0),
  );

  return companies
    .map((company) => {
      const price = totals[company.id] || 0;
      const priceScore = Pmin > 0
        ? scoreOffer(price, Pmin, Pmax, Pmoy, maxScore, mode)
        : 0;
      const techData = getEffectiveTechnical(rao.companies?.[company.name], basis);
      const techScores = {};

      criteria.filter((criterion) => !criterion.auto).forEach((criterion) => {
        const subCriteria = criterion.subCriteria || [];
        if (subCriteria.length > 0) {
          techScores[criterion.id] = subCriteria.reduce((sum, subCriterion) => {
            const data = techData[subCriterion.id] || {};
            const noteMax = Number(data.noteMax || 5);
            return sum + (noteMax > 0
              ? (Number(data.note || 0) / noteMax) * (Number(subCriterion.weight) || 0)
              : 0);
          }, 0);
        } else {
          const data = techData[criterion.id] || {};
          const noteMax = Number(data.noteMax || 5);
          techScores[criterion.id] = noteMax > 0
            ? (Number(data.note || 0) / noteMax) * (Number(criterion.weight) || 0)
            : 0;
        }
      });

      const conclusion = getEffectiveConclusion(
        rao.companies?.[company.name]?.admin,
        basis,
      );
      return {
        name: company.name,
        priceScore,
        techScores,
        totalScore: priceScore + Object.values(techScores).reduce((sum, score) => sum + score, 0),
        price,
        irregular: ['irreguliere', 'inacceptable', 'inappropriee'].includes(conclusion),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};

const buildNegoComparison = ({
  companies,
  statsInitial,
  statsNego,
  scoringConfig,
}) => {
  const rows = [];
  companies.forEach((company) => {
    const rabaisPct = getCompanyRabaisPct(company, 'nego');
    rows.push({
      kind: 'base',
      id: company.id,
      companyId: company.id,
      name: company.name,
      initialTotal: statsInitial.companiesTotals?.[company.id] || 0,
      negoTotal: statsNego.companiesTotals?.[company.id] || 0,
      negoTotalBrut: statsNego.companiesTotalsBrut?.[company.id]
        ?? (statsNego.companiesTotals?.[company.id] || 0),
      rabaisPct,
      negotiated: !!Object.keys(company.offersNego || {}).length || rabaisPct > 0,
      negoImportFile: company.negoImportFile || null,
      negoImportAt: company.negoImportAt || null,
      aeAmountNego: company.aeAmountNego ?? null,
    });

    (company.variants || []).filter((variant) => variant.retained).forEach((variant, index) => {
      rows.push({
        kind: 'variant',
        id: `${company.id}_${variant.id}`,
        companyId: company.id,
        variantId: variant.id,
        name: `${company.name} · ${variant.label || `V${index + 1}`}`,
        initialTotal: getVariantEffectiveTotal(company, variant, 'initial'),
        negoTotal: getVariantEffectiveTotal(company, variant, 'nego'),
        negoTotalBrut: Number(variant.totalNego ?? variant.total ?? 0),
        rabaisPct,
        negotiated: variantHasNego(variant) || rabaisPct > 0,
        negoImportFile: variant.negoImportFile || null,
        negoImportAt: variant.negoImportAt || null,
        aeAmountNego: variant.aeAmountNego ?? null,
      });
    });
  });

  const keptRows = rows.filter((row) => row.initialTotal > 0 || row.negoTotal > 0);
  if (keptRows.length === 0) return null;

  const maxScore = Number(scoringConfig?.maxScore || 40);
  const mode = scoringConfig?.mode || 'f1';
  const initialRef = computePriceReference(keptRows.map((row) => row.initialTotal));
  const negoRef = computePriceReference(keptRows.map((row) => row.negoTotal));

  keptRows.forEach((row) => {
    row.delta = row.negoTotal - row.initialTotal;
    row.deltaPct = row.initialTotal > 0 ? (row.delta / row.initialTotal) * 100 : 0;
    row.scoreInitial = initialRef.Pmin > 0
      ? scoreOffer(row.initialTotal, initialRef.Pmin, initialRef.Pmax, initialRef.Pmoy, maxScore, mode)
      : 0;
    row.scoreNego = negoRef.Pmin > 0
      ? scoreOffer(row.negoTotal, negoRef.Pmin, negoRef.Pmax, negoRef.Pmoy, maxScore, mode)
      : 0;
  });

  return keptRows.sort((a, b) => a.negoTotal - b.negoTotal);
};

export const prepareMobileRaoExportData = ({
  project,
  analysisData,
  clientQtyMaps,
  tranches,
}) => {
  const rao = project?.rao || {};
  const companies = analysisData?.companies || [];
  const scoringConfig = analysisData?.scoringConfig
    || project?.scoringConfig
    || { maxScore: 40, mode: 'f1', basis: 'initial' };
  const basis = scoringConfig.basis === 'nego' ? 'nego' : 'initial';
  const savedTrancheId = rao.raoTrancheId || 'global';
  const activeTrancheId = savedTrancheId === 'global'
    || tranches.some((tranche) => tranche.id === savedTrancheId)
    ? savedTrancheId
    : 'global';
  const qtyMap = clientQtyMaps?.[activeTrancheId] || clientQtyMaps?.global || {};
  const criteria = ensureRaoCriteria(rao.criteria);
  const includedOptions = rao.includedOptions || {};

  const chaptersInitial = computeChaptersData(project, companies, qtyMap, 'initial');
  const chaptersNego = computeChaptersData(project, companies, qtyMap, 'nego');
  const statsInitial = computeAnalysisStats(chaptersInitial, companies, scoringConfig, 'initial');
  const statsNego = computeAnalysisStats(chaptersNego, companies, scoringConfig, 'nego');
  const chaptersData = basis === 'nego' ? chaptersNego : chaptersInitial;
  const baseStats = basis === 'nego' ? statsNego : statsInitial;
  const analysisStats = includeSelectedOptions({
    stats: baseStats,
    chaptersData,
    includedOptions,
    companies,
    scoringConfig,
    basis,
  });
  const hasNego = companiesHaveNego(companies);
  const negoEngaged = !!rao.negoEngaged || hasNego || basis === 'nego';

  return {
    rao,
    companies,
    scoringConfig,
    consultation: buildRaoConsultation(project, rao),
    criteria,
    includedOptions,
    optionChapters: (project?.chapters || []).filter((chapter) => chapter.isOption),
    activeTrancheId,
    raoTrancheName: activeTrancheId === 'global'
      ? 'Global (toutes tranches)'
      : tranches.find((tranche) => tranche.id === activeTrancheId)?.name || activeTrancheId,
    chaptersData,
    analysisStats,
    analysisStatsInitial: statsInitial,
    ranking: computeRaoRanking({
      companies,
      rao,
      criteria,
      scoringConfig,
      stats: analysisStats,
      basis,
    }),
    rankingInitial: computeRaoRanking({
      companies,
      rao,
      criteria,
      scoringConfig,
      stats: statsInitial,
      basis: 'initial',
    }),
    rankingNego: negoEngaged
      ? computeRaoRanking({
          companies,
          rao,
          criteria,
          scoringConfig,
          stats: statsNego,
          basis: 'nego',
        })
      : null,
    negoComparison: negoEngaged
      ? buildNegoComparison({ companies, statsInitial, statsNego, scoringConfig })
      : null,
    negotiationPhase: basis === 'nego' ? 'after' : (negoEngaged ? 'before' : 'none'),
    negoActive: basis === 'nego',
    analysisMode: analysisData?.analysisMode || 'none',
  };
};
