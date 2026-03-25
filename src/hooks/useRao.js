// src/hooks/useRao.js
import { useCallback, useMemo } from 'react';

// ── CONSTANTES ──────────────────────────────────────────────────────────────

export const DEFAULT_CRITERIA = [
  { id: 'c1', label: 'Prix des prestations', weight: 60, auto: true,
    description: 'Noté automatiquement à partir des montants HT des offres.' },
  { id: 'c2', label: 'Cohérence du phasage, méthodologie et précision du planning et durée d\'exécution', weight: 20, auto: false,
    description: 'Pertinence du phasage, contraintes techniques et urbaines, maintien des accès, planning.' },
  { id: 'c3', label: 'Qualité de l\'organisation du candidat et pertinence des moyens humains et matériels proposés', weight: 20, auto: false,
    description: 'Organigramme, encadrement, procédés d\'exécution, matériaux, contrôle interne.' },
];

export const DEFAULT_ADMIN_PIECES = [
  { id: 'dc1dc2',     label: 'DC1 et DC2' },
  { id: 'honneur1',   label: 'Déclaration sur l\'honneur (interdiction de soumissionner)' },
  { id: 'honneur2',   label: 'Déclaration sur l\'honneur (emploi travailleurs handicapés L.5212-1)' },
  { id: 'effectifs',  label: 'Déclaration effectifs moyens annuels des 5 dernières années' },
  { id: 'materiel',   label: 'Déclaration matériel et équipement technique' },
  { id: 'references', label: 'Liste des travaux similaires (5 dernières années) + attestations' },
  { id: 'certifs',    label: 'Certificats de qualification professionnelle' },
];

export const DEFAULT_OFFER_PIECES = [
  { id: 'ae',      label: 'L\'acte d\'engagement (AE) et ses annexes' },
  { id: 'ccap',    label: 'Le CCAP signé' },
  { id: 'cctp',    label: 'Le CCTP et ses annexes signé' },
  { id: 'bpu',     label: 'Le bordereau des prix unitaires (BPU)' },
  { id: 'de',      label: 'Le détail estimatif complété' },
  { id: 'memoire', label: 'Le mémoire technique avec planning détaillé à la semaine' },
];

// ── HOOK ────────────────────────────────────────────────────────────────────

export const useRao = (project, setProject, analysisCompanies = [], analysisStats = null, scoringConfig = null, tranches = [], chaptersData = []) => {
  const rao = project?.rao || {};

  // ── Updater générique ──
  const updateRao = useCallback((updater) => {
    setProject(prev => {
      const current = prev?.rao || {};
      const patch = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, rao: { ...current, ...patch } };
    });
  }, [setProject]);

  // ── deep updater pour companies ──
  const patchCompany = useCallback((name, section, patch) => {
    setProject(prev => {
      const r = prev?.rao || {};
      const companies = r.companies || {};
      const company = companies[name] || {};
      const sectionData = company[section] || {};
      return {
        ...prev,
        rao: {
          ...r,
          companies: {
            ...companies,
            [name]: {
              ...company,
              [section]: { ...sectionData, ...patch },
            },
          },
        },
      };
    });
  }, [setProject]);

  // ── CONSULTATION ──────────────────────────────────────────────────────────
  // On initialise avec les valeurs par défaut du ProjectDetailsModal, tout en
  // gardant les valeurs déjà écrasées/saisies dans la section RAO.
  const consultation = {
    objet: project?.name || '',
    subtitle1: project?.subtitle1 || '',
    subtitle2: project?.subtitle2 || '',
    client: project?.client || '',
    moe: project?.moe || 'PAPYRUS',
    code: project?.code || '',
    lieu: project?.location || '',
    marketType: project?.marketType || 'Privé',
    phase: project?.phase || 'DCE',
    duration: project?.duration || '',
    prepPeriod: project?.prepPeriod || '1 mois',
    dateRemise: project?.dateRemise || '',
    timeRemise: project?.timeRemise || '',
    lot: '',
    procedure: '',
    dateNego: '',
    ...(rao.consultation || {})
  };

  const updateConsultation = (field, value) =>
    updateRao(r => ({ consultation: { ...(r.consultation || {}), [field]: value } }));

  // ── CRITÈRES ─────────────────────────────────────────────────────────────
  const criteria = rao.criteria || DEFAULT_CRITERIA;
  const updateCriteria = (newCriteria) => updateRao(() => ({ criteria: newCriteria }));

  const addCriterion = () => {
    const newId = `c${Date.now()}`;
    updateRao(r => ({
      criteria: [...(r.criteria || DEFAULT_CRITERIA), {
        id: newId, label: 'Nouveau critère', weight: 0, auto: false, description: '',
      }],
    }));
  };

  const removeCriterion = (id) => {
    updateRao(r => ({ criteria: (r.criteria || DEFAULT_CRITERIA).filter(c => c.id !== id) }));
  };

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  const updateAdminPiece = (companyName, pieceId, value) => {
    setProject(prev => {
      const r = prev?.rao || {};
      const co = (r.companies || {})[companyName] || {};
      const admin = co.admin || {};
      return {
        ...prev,
        rao: {
          ...r,
          companies: {
            ...(r.companies || {}),
            [companyName]: {
              ...co,
              admin: { ...admin, pieces: { ...(admin.pieces || {}), [pieceId]: value } },
            },
          },
        },
      };
    });
  };

  const updateAdminField = (companyName, field, value) =>
    patchCompany(companyName, 'admin', { [field]: value });

  // ── TECHNIQUE ─────────────────────────────────────────────────────────────
  const updateTechnical = (companyName, criterionId, field, value) => {
    setProject(prev => {
      const r = prev?.rao || {};
      const co = (r.companies || {})[companyName] || {};
      const tech = co.technical || {};
      const crit = tech[criterionId] || {};
      return {
        ...prev,
        rao: {
          ...r,
          companies: {
            ...(r.companies || {}),
            [companyName]: {
              ...co,
              technical: { ...tech, [criterionId]: { ...crit, [field]: value } },
            },
          },
        },
      };
    });
  };

  // ── NÉGOCIATION ───────────────────────────────────────────────────────────
  const updateNegotiation = (companyName, field, value) =>
    patchCompany(companyName, 'negotiation', { [field]: value });

  // ── TRANCHES ──────────────────────────────────────────────────────────────
  const hasTranches = tranches?.length > 0;
  const raoTrancheId = rao.raoTrancheId || 'global';
  const setRaoTrancheId = (id) => updateRao(() => ({ raoTrancheId: id }));

  // ── OPTIONS / PSE ─────────────────────────────────────────────────────────
  const optionChapters = useMemo(
    () => (project?.chapters || []).filter(c => c.isOption),
    [project?.chapters]
  );
  const includedOptions = rao.includedOptions || {};
  const updateIncludedOption = (chapterId, value) =>
    updateRao(r => ({ includedOptions: { ...(r.includedOptions || {}), [chapterId]: value } }));

  // ── STATS RAO (base + PSE incluses selon toggle) ───────────────────────────
  const raoAnalysisStats = useMemo(() => {
    if (!analysisStats) return null;
    const includedChaps = chaptersData.filter(c => c.isOption && includedOptions[c.id]);
    if (includedChaps.length === 0) return analysisStats;

    const newTotals = { ...analysisStats.companiesTotals };
    let newTotalEst = analysisStats.totalEstimation;
    includedChaps.forEach(chap => {
      chap.items.forEach(item => {
        newTotalEst += item.estimationTotal || (item.activeQty * (item.price || 0));
        analysisCompanies.forEach(company => {
          if (!newTotals[company.id]) newTotals[company.id] = 0;
          newTotals[company.id] += item.companyData?.[company.id]?.lineTotal ?? 0;
        });
      });
    });

    const totals = Object.values(newTotals).filter(t => t > 0);
    if (!totals.length) return { ...analysisStats, companiesTotals: newTotals, totalEstimation: newTotalEst };

    const Pmin = Math.min(...totals);
    const Pmax = Math.max(...totals);
    const Pmoy = totals.reduce((a, b) => a + b, 0) / totals.length;
    const N = Number(scoringConfig?.maxScore || 40);
    const newScores = {};
    const newEcarts = {};

    analysisCompanies.forEach(company => {
      const P = newTotals[company.id] || 0;
      let score = 0;
      if (P > 0) {
        switch (scoringConfig?.mode) {
          case 'f1': score = N * (Pmin / P); break;
          case 'f2': score = N * Math.pow(Pmin / P, 2); break;
          case 'f3': score = N * Math.pow(Pmin / P, 3); break;
          case 'f4': score = N * (1 - (P - Pmin) / Pmin); break;
          case 'f5': score = N * (1 - (P - Pmin) / Pmoy); break;
          case 'f6': score = P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2); break;
          case 'f7': score = Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin)); break;
          case 'f8': score = (N * Pmoy) / (Pmoy + P); break;
          case 'f9': score = N * ((2 * Pmin) / (Pmin + P)); break;
          default:   score = N * (Pmin / P);
        }
      }
      newScores[company.id] = Math.max(0, Math.min(N, score));
      newEcarts[company.id] = {
        abs: P - newTotalEst,
        pct: newTotalEst ? ((P - newTotalEst) / newTotalEst) * 100 : 0,
      };
    });

    return { ...analysisStats, companiesTotals: newTotals, totalEstimation: newTotalEst,
             companyScores: newScores, companyEcarts: newEcarts, Pmin, Pmax, Pmoy };
  }, [analysisStats, chaptersData, includedOptions, analysisCompanies, scoringConfig]);

  // ── CALCUL DES SCORES ─────────────────────────────────────────────────────
  // Utilise directement stats.companyScores de usePriceAnalysis (déjà calculé avec la bonne formule f1-f9)
  // et ramène le score prix sur le poids défini dans les critères RAO.
  const computeScores = () => {
    const autoCrit = criteria.find(c => c.auto);
    const priceWeight = autoCrit?.weight || 60;
    const maxScoreAnalysis = scoringConfig?.maxScore || 40; // points max dans l'analyse financière

    const scores = {};
    analysisCompanies.forEach((company) => {
      const name = company.name;

      // Score prix : on rebase le score de l'analyse financière sur le poids RAO
      // Ex : si analyse donne 38.5/40 et poids RAO = 60 → 38.5/40 * 60 = 57.75
      const rawPriceScore = analysisStats?.companyScores?.[company.id] ?? null;
      const priceScore = rawPriceScore !== null
        ? (rawPriceScore / maxScoreAnalysis) * priceWeight
        : 0;

      // Prix HT total depuis l'analyse
      const price = analysisStats?.companiesTotals?.[company.id] || 0;

      // Scores techniques (notes saisies dans le RAO)
      const techScores = {};
      criteria.filter(c => !c.auto).forEach(crit => {
        const d = (rao.companies?.[name]?.technical || {})[crit.id] || {};
        const note = Number(d.note || 0);
        const noteMax = Number(d.noteMax || 5);
        techScores[crit.id] = noteMax > 0 ? (note / noteMax) * crit.weight : 0;
      });

      const totalScore = priceScore + Object.values(techScores).reduce((a, b) => a + b, 0);
      scores[name] = { priceScore, techScores, totalScore, price };
    });
    return scores;
  };

  // ── CLASSEMENT ────────────────────────────────────────────────────────────
  const getRanking = () => {
    const scores = computeScores();
    return Object.entries(scores)
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .map(([name, s], i) => ({ name, rank: i + 1, ...s }));
  };

  return {
    rao,
    consultation, updateConsultation,
    criteria, updateCriteria, addCriterion, removeCriterion,
    updateAdminPiece, updateAdminField,
    updateTechnical,
    updateNegotiation,
    computeScores, getRanking,
    // Tranches
    hasTranches, tranches, raoTrancheId, setRaoTrancheId,
    // PSE / Options
    optionChapters, includedOptions, updateIncludedOption,
    // Stats enrichies
    raoAnalysisStats,
  };
};