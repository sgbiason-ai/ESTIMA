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
  // Garantit toujours la présence du critère "Prix" (auto) en première position.
  // Si manquant dans rao.criteria (anciennes données, suppression accidentelle…),
  // on le réinjecte automatiquement depuis DEFAULT_CRITERIA.
  const ensurePriceCriterion = (list) => {
    const safeList = Array.isArray(list) && list.length > 0 ? list : DEFAULT_CRITERIA;
    if (safeList.some(c => c.auto)) return safeList;
    // Pas de critère auto → on insère DEFAULT_CRITERIA[0] (Prix) en tête
    return [DEFAULT_CRITERIA[0], ...safeList];
  };

  const criteria = ensurePriceCriterion(rao.criteria);

  const updateCriteria = (newCriteria) => updateRao(() => ({ criteria: ensurePriceCriterion(newCriteria) }));

  const addCriterion = () => {
    const newId = `c${Date.now()}`;
    updateRao(r => ({
      criteria: [...ensurePriceCriterion(r.criteria), {
        id: newId, label: 'Nouveau critère', weight: 0, auto: false, description: '', subCriteria: [],
      }],
    }));
  };

  const removeCriterion = (id) => {
    updateRao(r => ({
      criteria: ensurePriceCriterion(
        ensurePriceCriterion(r.criteria).filter(c => c.id !== id)
      ),
    }));
  };

  const addSubCriterion = (parentId) => {
    updateRao(r => ({
      criteria: ensurePriceCriterion(r.criteria).map(c => {
        if (c.id !== parentId) return c;
        const subs = c.subCriteria || [];
        return { ...c, subCriteria: [...subs, { id: `sc${Date.now()}`, label: '', description: '' }] };
      }),
    }));
  };

  const removeSubCriterion = (parentId, subId) => {
    updateRao(r => ({
      criteria: ensurePriceCriterion(r.criteria).map(c => {
        if (c.id !== parentId) return c;
        const newSubs = (c.subCriteria || []).filter(sc => sc.id !== subId);
        const totalWeight = newSubs.reduce((s, sc) => s + (Number(sc.weight) || 0), 0);
        return { ...c, subCriteria: newSubs, weight: newSubs.length > 0 ? totalWeight : c.weight };
      }),
    }));
  };

  const updateSubCriterion = (parentId, subId, field, value) => {
    updateRao(r => ({
      criteria: ensurePriceCriterion(r.criteria).map(c => {
        if (c.id !== parentId) return c;
        const newSubs = (c.subCriteria || []).map(sc => sc.id === subId ? { ...sc, [field]: value } : sc);
        // Recalcule le weight parent = somme des sous-critères
        const totalWeight = newSubs.reduce((s, sc) => s + (Number(sc.weight) || 0), 0);
        return { ...c, subCriteria: newSubs, weight: totalWeight };
      }),
    }));
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

  // ── PIÈCES ADMIN / OFFRE (custom, partagées entre toutes les entreprises) ─
  const adminPieces = rao.adminPieces || DEFAULT_ADMIN_PIECES;
  const offerPieces = rao.offerPieces || DEFAULT_OFFER_PIECES;

  const setAdminPieces = useCallback((pieces) => updateRao({ adminPieces: pieces }), [updateRao]);
  const setOfferPieces = useCallback((pieces) => updateRao({ offerPieces: pieces }), [updateRao]);

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

  // Config courrier négociation au niveau projet (signataire, ville). Les champs
  // par entreprise (deadline, adresseEntreprise) restent dans nego.* via updateNegotiation.
  const letterConfig = {
    signatoryName: '',
    city: '',
    ...(rao.letterConfig || {}),
  };
  const updateLetterConfig = (field, value) =>
    updateRao(r => ({ letterConfig: { ...(r.letterConfig || {}), [field]: value } }));

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
  // Reprend directement les scores prix de l'analyse financière (usePriceAnalysis)
  // et les rebase sur le poids du critère prix dans la grille RAO.
  const computeScores = () => {
    // N = barème prix dans la grille RAO (affiché en lecture seule = scoringConfig.maxScore)
    const N = Number(scoringConfig?.maxScore || 40);
    const mode = scoringConfig?.mode || 'f1';

    // Totaux depuis l'analyse financière (source de vérité unique)
    const effectiveStats = raoAnalysisStats || analysisStats;
    const companiesTotals = effectiveStats?.companiesTotals || {};

    // Détection des offres irrégulières (CCP : exclues de la notation)
    // Source : project.rao.companies[name].admin.conclusion
    const NON_REGULAR = ['irreguliere', 'inacceptable', 'inappropriee'];
    const isIrregular = (companyName) => {
      const conclusion = rao.companies?.[companyName]?.admin?.conclusion;
      return conclusion && NON_REGULAR.includes(conclusion);
    };

    // Calcul Pmin/Pmax/Pmoy depuis les totaux — EXCLUSION des entreprises irrégulières
    const validTotals = analysisCompanies
      .filter(c => !isIrregular(c.name))
      .map(c => companiesTotals[c.id] || 0)
      .filter(t => t > 0);
    const Pmin = validTotals.length ? Math.min(...validTotals) : 0;
    const Pmax = validTotals.length ? Math.max(...validTotals) : 0;
    const Pmoy = validTotals.length ? validTotals.reduce((a, b) => a + b, 0) / validTotals.length : 0;

    const scores = {};
    analysisCompanies.forEach((company) => {
      const name = company.name;
      const price = companiesTotals[company.id] || 0;
      const irregular = isIrregular(name);

      // Score prix : 0 si offre irrégulière (exclue de la notation — CCP)
      let priceScore = 0;
      if (!irregular) {
        let rawScore = 0;
        if (price > 0 && Pmin > 0) {
          switch (mode) {
            case 'f1': rawScore = N * (Pmin / price); break;
            case 'f2': rawScore = N * Math.pow(Pmin / price, 2); break;
            case 'f3': rawScore = N * Math.pow(Pmin / price, 3); break;
            case 'f4': rawScore = N * (1 - (price - Pmin) / Pmin); break;
            case 'f5': rawScore = N * (1 - (price - Pmin) / Pmoy); break;
            case 'f6': rawScore = price <= Pmoy ? N * Math.sqrt(Pmin / price) : N * Math.pow(Pmin / price, 2); break;
            case 'f7': rawScore = Pmax === Pmin ? N : N * (1 - (price - Pmin) / (Pmax - Pmin)); break;
            case 'f8': rawScore = (N * Pmoy) / (Pmoy + price); break;
            case 'f9': rawScore = N * ((2 * Pmin) / (Pmin + price)); break;
            default:   rawScore = N * (Pmin / price);
          }
        }
        priceScore = Math.max(0, Math.min(N, rawScore));
      }

      // Scores techniques (notes saisies dans le RAO)
      const techScores = {};
      const techData = rao.companies?.[name]?.technical || {};
      criteria.filter(c => !c.auto).forEach(crit => {
        const hasSubs = (crit.subCriteria || []).length > 0;
        if (hasSubs) {
          // Somme pondérée des sous-critères
          techScores[crit.id] = crit.subCriteria.reduce((sum, sc) => {
            const sd = techData[sc.id] || {};
            const sNote = Number(sd.note || 0);
            const sMax = Number(sd.noteMax || 5);
            return sum + (sMax > 0 ? (sNote / sMax) * (Number(sc.weight) || 0) : 0);
          }, 0);
        } else {
          const d = techData[crit.id] || {};
          const note = Number(d.note || 0);
          const noteMax = Number(d.noteMax || 5);
          techScores[crit.id] = noteMax > 0 ? (note / noteMax) * crit.weight : 0;
        }
      });

      const totalScore = priceScore + Object.values(techScores).reduce((a, b) => a + b, 0);
      scores[name] = { priceScore, techScores, totalScore, price, irregular };
    });
    return scores;
  };

  // ── CLASSEMENT ────────────────────────────────────────────────────────────
  // Les offres irrégulières sont placées en bas et n'ont pas de rang (CCP).
  const getRanking = () => {
    const scores = computeScores();
    const entries = Object.entries(scores);
    const regular = entries
      .filter(([, s]) => !s.irregular)
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .map(([name, s], i) => ({ name, rank: i + 1, ...s }));
    const irregular = entries
      .filter(([, s]) => s.irregular)
      .map(([name, s]) => ({ name, rank: null, ...s }));
    return [...regular, ...irregular];
  };

  return {
    rao,
    consultation, updateConsultation,
    criteria, updateCriteria, addCriterion, removeCriterion,
    addSubCriterion, removeSubCriterion, updateSubCriterion,
    updateAdminPiece, updateAdminField,
    adminPieces, offerPieces, setAdminPieces, setOfferPieces,
    updateTechnical,
    updateNegotiation,
    letterConfig, updateLetterConfig,
    computeScores, getRanking,
    // Tranches
    hasTranches, tranches, raoTrancheId, setRaoTrancheId,
    // PSE / Options
    optionChapters, includedOptions, updateIncludedOption,
    // Stats enrichies
    raoAnalysisStats,
  };
};