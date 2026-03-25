// src/hooks/usePriceAnalysis.js
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';

// --- ALGORITHME OAB (Double Moyenne) ---
const calculateOABThreshold = (values) => {
  const validValues = values.filter(v => v > 0);
  if (validValues.length === 0) return 0;
  const M1 = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const upperLimit = M1 * 1.20;
  const filteredValues = validValues.filter(v => v <= upperLimit);
  if (filteredValues.length === 0) return M1 * 0.90;
  const M2 = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
  return M2 * 0.90;
};

const safeStorage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch {} },
};

// AJOUT DE clientQtyMaps EN PARAMÈTRE
const usePriceAnalysis = (project, bpuConfig, activeTrancheId = 'global', clientQtyMaps = {}) => {
  const { confirm, prompt } = useDialog();
  const toast = useToast();

  const STORAGE_KEY = project?.id ? `analysis_autosave_${project.id}` : null;

  const [companies, setCompanies] = useState(() => {
    if (!STORAGE_KEY) return [];
    try {
      const saved = safeStorage.get(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [history, setHistory] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);

  const [scoringConfig, setScoringConfig] = useState(project?.scoringConfig || { maxScore: 40, mode: 'f1' });

  // ─── AUTO-SAVE ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!STORAGE_KEY) return;
    safeStorage.set(STORAGE_KEY, JSON.stringify(companies));
    setLastSaved(new Date());
  }, [companies, STORAGE_KEY]);

  // ─── DONNÉES PAR CHAPITRE ─────────────────────────────────────────────────
  const chaptersData = useMemo(() => {
    if (!project?.chapters) return [];

    // On isole le dictionnaire des quantités correspondant à la tranche active
    const currentQtyMap = clientQtyMaps[activeTrancheId || 'global'] || {};

    return project.chapters.map(chapter => {
      const items = [];

      const extractItems = (nodes) => {
        nodes.forEach(node => {
          if (node.type === 'item') {
            
            // LECTURE DIRECTE DEPUIS LE MOTEUR DU MODE RENDU
            const activeQty        = currentQtyMap[node.id] || 0;
            
            const estimationPU     = Number(node.price || 0);
            const estimationTotal  = activeQty * estimationPU;

            const companyData = {};
            let minPU = Infinity, maxPU = -Infinity, minTotal = Infinity, maxTotal = -Infinity;

            companies.forEach(company => {
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
              minPU:    minPU === Infinity ? 0 : minPU,
              maxPU:    maxPU === -Infinity ? 0 : maxPU,
              minTotal: minTotal === Infinity ? 0 : minTotal,
              maxTotal: maxTotal === -Infinity ? 0 : maxTotal,
              chapterId:    chapter.id,
              chapterTitle: chapter.title,
            });
          } else if (node.children) {
            extractItems(node.children);
          }
        });
      };

      extractItems(chapter.children || []);
      return { id: chapter.id, title: chapter.title, isOption: chapter.isOption, items };
    });
  }, [project, activeTrancheId, companies, clientQtyMaps]);

  // ─── STATISTIQUES GLOBALES ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const report = {
      totalEstimation:  0,
      companiesTotals:  {},
      companyScores:    {},
      companyEcarts:    {},
      Pmin: 0, Pmax: 0, Pmoy: 0,
    };

    chaptersData.forEach(chap => {
      if (chap.isOption) return;
      chap.items.forEach(item => {
        report.totalEstimation += item.estimationTotal;
        companies.forEach(company => {
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
    const N    = Number(scoringConfig.maxScore);

    report.Pmin = Pmin;
    report.Pmax = Pmax;
    report.Pmoy = Pmoy;

    companies.forEach(company => {
      const P = report.companiesTotals[company.id] || 0;
      const ecartAbs = P - report.totalEstimation;
      const ecartPct = report.totalEstimation !== 0 ? (ecartAbs / report.totalEstimation) * 100 : 0;
      report.companyEcarts[company.id] = { abs: ecartAbs, pct: ecartPct };

      let score = 0;
      if (P > 0) {
        switch (scoringConfig.mode) {
          case 'f1': score = N * (Pmin / P); break;
          case 'f2': score = N * Math.pow(Pmin / P, 2); break;
          case 'f3': score = N * Math.pow(Pmin / P, 3); break;
          case 'f4': score = N * (1 - (P - Pmin) / Pmin); break;
          case 'f5': score = N * (1 - (P - Pmin) / Pmoy); break;
          case 'f6': score = P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2); break;
          case 'f7': score = Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin)); break;
          case 'f8': score = (N * Pmoy) / (Pmoy + P); break;
          case 'f9': score = N * ((2 * Pmin) / (Pmin + P)); break;
          default:   score = 0;
        }
      }
      report.companyScores[company.id] = Math.max(0, Math.min(N, score));
    });

    return report;
  }, [chaptersData, companies, scoringConfig]);

  // ─── ACTIONS ──────────────────────────────────────────────────────────────
  const handleAddManualCompany = async () => {
    const defaultName = `Entreprise ${companies.length + 1}`;
    const name = await prompt("Nom de l'entreprise :", defaultName, {
      title: "Ajouter une entreprise",
      placeholder: "Ex: DUPONT TP",
      confirmLabel: "Ajouter",
    });
    if (name === null) return;
    setCompanies(prev => [...prev, { id: `comp_${Date.now()}`, name: name.trim() || defaultName, offers: {}, isManual: true }]);
    toast.success(`Entreprise "${name.trim() || defaultName}" ajoutée.`);
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const suggestedName = file.name.replace(/\.[^/.]+$/, "").split('_')[0];
    const companyName = await prompt("Nom de l'entreprise pour cette offre :", suggestedName, {
      title: "Importer une offre",
      placeholder: "Ex: MARTIN VRD",
      confirmLabel: "Importer",
    });

    if (companyName === null) { event.target.value = null; return; }

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    try {
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      let worksheet = null;
      workbook.eachSheet((ws) => {
        if (worksheet) return;
        const headerRow = ws.getRow(5);
        const col2 = headerRow.getCell(2);
        const col2Val = (col2.value ?? col2.text ?? '').toString().trim().toUpperCase();
        if (col2Val === 'DÉSIGNATION' || col2Val === 'DESIGNATION') worksheet = ws;
      });
      if (!worksheet) worksheet = workbook.getWorksheet('GLOBAL') || workbook.getWorksheet(2) || workbook.getWorksheet(1);

      const importedOffers = {};
      const projectItemsMap = new Map();
      chaptersData.forEach(chap => {
        chap.items.forEach(item => {
          if (item.designation) projectItemsMap.set(item.designation.trim().toUpperCase(), item.id);
        });
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 5) return;
        const cell2 = row.getCell(2);
        const rawDesig = cell2.value ?? cell2.text ?? '';
        const designation = (typeof rawDesig === 'string' ? rawDesig : String(rawDesig ?? '')).trim().toUpperCase();

        if (!designation || !projectItemsMap.has(designation)) return;

        const cell5 = row.getCell(5);
        let val = cell5.value;
        if (val !== null && typeof val === 'object' && 'result' in val) val = val.result;
        const price = Number(val ?? 0);
        if (!isFinite(price)) return;

        importedOffers[projectItemsMap.get(designation)] = price;
      });

      const matchCount = Object.keys(importedOffers).length;
      if (matchCount === 0) {
        toast.warning("Aucune correspondance trouvée entre le fichier et les articles du projet.");
        event.target.value = null;
        return;
      }

      setCompanies(prev => [...prev, { id: `import_${Date.now()}`, name: companyName.trim() || suggestedName, offers: importedOffers, isManual: false }]);
      toast.success(`${matchCount} offre(s) importée(s) pour "${companyName}".`);
    } catch (error) {
      console.error("Erreur lecture fichier Excel:", error);
      toast.error("Impossible de lire le fichier. Vérifiez le format Excel.");
    } finally {
      event.target.value = null;
    }
  };

  const updateCompanyOffer = (cId, iId, val) => setCompanies(prev => prev.map(c => c.id === cId ? { ...c, offers: { ...c.offers, [iId]: Number(val) } } : c));
  const renameCompany = (cId, val) => setCompanies(prev => prev.map(c => c.id === cId ? { ...c, name: val } : c));
  
  const removeCompany = async (cId) => {
    const company = companies.find(c => c.id === cId);
    const ok = await confirm(`Supprimer "${company?.name}" et toutes ses offres ?`, { title: "Supprimer l'entreprise", danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    setCompanies(prev => prev.filter(c => c.id !== cId));
    toast.success(`Entreprise "${company?.name}" supprimée.`);
  };

  const handleClearAll = async () => {
    const ok = await confirm("Effacer toutes les entreprises et offres saisies ? Cette action est irréversible.", { title: "Réinitialiser l'analyse", danger: true, confirmLabel: "Tout effacer" });
    if (!ok) return;
    setCompanies([]);
    if (STORAGE_KEY) safeStorage.remove(STORAGE_KEY);
    toast.success("Analyse réinitialisée.");
  };

  const handleSaveToObservatory = () => {
    setHistory(prev => [...prev, { date: new Date(), data: JSON.parse(JSON.stringify(companies)) }]);
    toast.success("État sauvegardé dans l'historique.");
  };

  const handleUndoObservatory = () => {
    if (history.length === 0) return;
    setCompanies(history[history.length - 1].data);
    setHistory(prev => prev.slice(0, -1));
    toast.info("Retour à l'état précédent.");
  };

  // ─── MOYENNE HORS OAB PAR ITEM ─────────────────────────────────────────────
  const averagesHorsOAB = useMemo(() => {
    const result = {};
    chaptersData.forEach(chap => {
      chap.items.forEach(item => {
        const prices = companies.map(c => Number(c.offers?.[item.id] ?? 0)).filter(p => p > 0);
        if (prices.length === 0) return;
        const threshold = calculateOABThreshold(prices);
        const validPrices = prices.filter(p => p >= threshold);
        if (validPrices.length === 0) return;
        const avg = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
        result[item.id] = {
          avg: Math.round(avg * 100) / 100,
          designation: item.designation,
          count: validPrices.length,
          total: prices.length,
          excluded: prices.length - validPrices.length,
        };
      });
    });
    return result;
  }, [chaptersData, companies]);

  // ─── ACTION : Pousser les moyennes hors OAB vers la base de prix ───────────
  const handlePushAveragesToBpu = useCallback(async (bpu, updateBpuItem) => {
    if (!bpu || !updateBpuItem) return;
    const entries = Object.entries(averagesHorsOAB);
    if (entries.length === 0) {
      toast.warning("Aucune moyenne à calculer. Ajoutez des offres d'entreprises d'abord.");
      return;
    }

    const ok = await confirm(
      `Mettre à jour le prix observé (moyenne hors OAB) pour ${entries.length} article(s) dans la base de prix ?`,
      { title: 'Remonter les moyennes', confirmLabel: 'Mettre à jour' }
    );
    if (!ok) return;

    // Matching par désignation (même logique que l'import)
    const bpuByDesignation = new Map();
    bpu.forEach(bpuItem => {
      if (bpuItem.designation) {
        bpuByDesignation.set(bpuItem.designation.trim().toUpperCase(), bpuItem);
      }
    });

    let updated = 0;
    for (const [itemId, data] of entries) {
      const key = data.designation?.trim().toUpperCase();
      const bpuItem = bpuByDesignation.get(key);
      if (bpuItem) {
        await updateBpuItem(bpuItem.id, { observedPrice: data.avg });
        updated++;
      }
    }

    if (updated > 0) {
      toast.success(`${updated} prix observé(s) mis à jour dans la base de prix.`);
    } else {
      toast.warning("Aucune correspondance trouvée entre les articles analysés et la base de prix.");
    }
  }, [averagesHorsOAB, confirm, toast]);

  return {
    chaptersData, companies, stats, scoringConfig, setScoringConfig,
    canUndoObservatory: history.length > 0, lastSaved,
    handleAddManualCompany, handleImportExcel, updateCompanyOffer,
    renameCompany, removeCompany, handleClearAll,
    handleSaveToObservatory, handleUndoObservatory,
    averagesHorsOAB, handlePushAveragesToBpu,
  };
};

export default usePriceAnalysis;