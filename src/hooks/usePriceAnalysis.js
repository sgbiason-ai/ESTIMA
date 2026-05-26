// src/hooks/usePriceAnalysis.js
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as fireDb } from '../firebase';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';
import { computeChaptersData, computeAnalysisStats } from '../utils/analysisCompute';

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

const usePriceAnalysis = (project, bpuConfig, activeTrancheId = 'global', clientQtyMaps = {}, companyId = null, setProject = null) => {
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
  const [scoringConfig, setScoringConfig] = useState({ maxScore: 40, mode: 'f1' });
  const [firestoreLoaded, setFirestoreLoaded] = useState(false);
  // Progression OCR pour PDF scannés
  const [ocrProgress, setOcrProgress] = useState(null);
  // Stocke le projectId pour lequel Firestore a été chargé (pas un boolean, un ID)
  const loadedForProjectRef = useRef(null);

  // ─── Identifiants stables pour le path Firestore ───────────────────────
  const projectId = project?.id || null;

  // ─── CHARGEMENT depuis Firestore (une seule fois par projectId) ────────
  useEffect(() => {
    if (!projectId || !companyId) return;
    if (loadedForProjectRef.current === projectId) return; // déjà chargé pour ce projet
    loadedForProjectRef.current = projectId;

    const docRef = doc(fireDb, 'companies', companyId, 'projects', projectId, 'analysis', 'data');
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.companies?.length > 0) setCompanies(data.companies);
        if (data.scoringConfig) setScoringConfig(data.scoringConfig);
      }
      setFirestoreLoaded(true);
    }).catch(e => {
      console.error('[Analysis] Erreur chargement Firestore:', e);
      setFirestoreLoaded(true);
    });
  }, [projectId, companyId]);

  // ─── Refs stables pour le debounce ─────────────────────────────────────
  const companiesRef = useRef(companies);
  useEffect(() => { companiesRef.current = companies; }, [companies]);
  const scoringRef = useRef(scoringConfig);
  useEffect(() => { scoringRef.current = scoringConfig; }, [scoringConfig]);
  const projectIdRef = useRef(projectId);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  const companyIdRef = useRef(companyId);
  useEffect(() => { companyIdRef.current = companyId; }, [companyId]);

  // ─── SAUVEGARDE directe dans le document dédié (avec retry) ─────────────
  const saveAnalysis = useCallback(async () => {
    const pid = projectIdRef.current;
    const cid = companyIdRef.current;
    if (!pid || !cid) return;
    const docRef = doc(fireDb, 'companies', cid, 'projects', pid, 'analysis', 'data');
    const payload = {
      companies: companiesRef.current,
      scoringConfig: scoringRef.current,
      lastSaved: new Date().toISOString(),
    };
    // Sauvegarder en localStorage immédiatement (brouillon)
    if (STORAGE_KEY) safeStorage.set(STORAGE_KEY, JSON.stringify(companiesRef.current));
    // Retry avec backoff exponentiel (3 tentatives)
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await setDoc(docRef, payload);
        setLastSaved(new Date());
        return; // Succès
      } catch (e) {
        console.warn(`[Analysis] Tentative ${attempt + 1}/${maxRetries + 1} échouée:`, e.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
        } else {
          console.error('[Analysis] ❌ Échec sauvegarde après retries:', e);
          toast.error('Sauvegarde analyse impossible. Données conservées localement.');
        }
      }
    }
  }, [STORAGE_KEY, toast]); // Aucune dep instable — tout lu via refs

  // ─── AUTO-SAVE debounced (800ms) quand companies ou scoringConfig changent ─
  // userHasChanged : ne sauvegarde que quand l'UTILISATEUR modifie, pas le chargement initial
  const saveTimerRef = useRef(null);
  const userHasChanged = useRef(false);
  useEffect(() => {
    if (!firestoreLoaded) return;
    // Premier passage après chargement Firestore = skip (c'est le sync initial)
    if (!userHasChanged.current) { userHasChanged.current = true; return; }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveAnalysis, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [companies, scoringConfig, firestoreLoaded, saveAnalysis]);

  // ─── EXPORT JSON ──────────────────────────────────────────────────────────
  const handleExportJson = useCallback(async () => {
    // Charger les données RAO depuis Firestore si pas encore en mémoire
    let raoData = project?.rao || {};
    if (Object.keys(raoData).length === 0 && project?.id && companyId) {
      try {
        const docRef = doc(fireDb, 'companies', companyId, 'projects', project.id, 'rao', 'data');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().rao) raoData = snap.data().rao;
      } catch (e) { console.warn('[Analysis] RAO fetch for export:', e); }
    }
    const data = {
      companies,
      scoringConfig,
      rao: raoData,
      exportedAt: new Date().toISOString(),
      projectName: project?.name,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RAO_${(project?.name || 'export').replace(/[^a-z0-9_-]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export JSON téléchargé.');
  }, [companies, scoringConfig, project?.rao, project?.id, project?.name, companyId, toast]);

  // ─── IMPORT JSON ──────────────────────────────────────────────────────────
  const handleImportJson = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.companies) setCompanies(data.companies);
      if (data.scoringConfig) setScoringConfig(data.scoringConfig);
      if (data.rao && setProject) {
        setProject(prev => ({ ...prev, rao: { ...(prev?.rao || {}), ...data.rao } }));
      }
      const parts = [`${data.companies?.length || 0} entreprise(s)`];
      if (data.rao) parts.push('analyse technique');
      toast.success(`RAO restauré : ${parts.join(' + ')}`);
    } catch (e) {
      toast.error('Fichier JSON invalide.');
      console.error('[Analysis] Import JSON error:', e);
    } finally {
      event.target.value = null;
    }
  }, [toast, setProject]);

  // ─── DONNÉES PAR CHAPITRE ─────────────────────────────────────────────────
  // Calcul deporte dans src/utils/analysisCompute.js (reutilise par les exports mobile)
  const chaptersData = useMemo(() => {
    const currentQtyMap = clientQtyMaps[activeTrancheId || 'global'] || {};
    return computeChaptersData(project, companies, currentQtyMap);
  }, [project, activeTrancheId, companies, clientQtyMaps]);

  // ─── STATISTIQUES GLOBALES ───────────────────────────────────────────────
  const stats = useMemo(
    () => computeAnalysisStats(chaptersData, companies, scoringConfig),
    [chaptersData, companies, scoringConfig]
  );

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

  // ─── IMPORT PDF — extraction texte + conversion vers le parser Excel ──────
  // Le PDF est extrait via pdfjs-dist, converti en workbook ExcelJS en mémoire,
  // puis le parser Excel normal s'occupe du matching avec le DQE MOE.
  const handleImportPdfOffer = async (file, forcedCompanyName = null) => {
    if (!file) return { ok: false, reason: 'no_file' };
    try {
      const { parsePdfOffer, pdfToWorkbookFile } = await import('../utils/parsePdfOffer');
      const result = await parsePdfOffer(file, {
        onProgress: (p) => setOcrProgress(p),
      });
      setOcrProgress(null);

      if (result.articles.length === 0) {
        toast.error('Aucun article détecté dans le PDF même après OCR. Vérifiez le format (tableau Ref/Désignation/Unité/Qté/PU).');
        if (result.warnings.length > 0) result.warnings.forEach(w => toast.warning(w));
        return { ok: false, reason: 'no_articles' };
      }

      const totalStr = result.stats.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
      const ocrLabel = result.viaOcr ? ' (via OCR)' : '';
      toast.info(`PDF${ocrLabel} : ${result.articles.length} article(s) extrait(s) (total ≈ ${totalStr} €). Matching en cours…`);

      const xlsxFile = await pdfToWorkbookFile(result.articles, file.name.replace(/\.pdf$/i, '.xlsx'));
      await handleImportExcel({ target: { files: [xlsxFile], value: null } }, forcedCompanyName);
      return { ok: true, articleCount: result.articles.length, viaOcr: result.viaOcr };
    } catch (e) {
      setOcrProgress(null);
      console.error('[Import PDF] Erreur :', e);
      toast.error(e.message || 'Impossible de lire le PDF.');
      return { ok: false, reason: 'parse_error', error: e.message };
    }
  };

  const handleImportExcel = async (event, forcedCompanyName = null) => {
    // event peut être un événement DOM (input file) ou un objet { target: { files: [file] } }
    // forcedCompanyName : si fourni, skip le prompt (workflow guidé depuis Dépouillement)
    const file = event.target?.files?.[0];
    if (!file) return;

    const suggestedName = file.name.replace(/\.[^/.]+$/, "").split('_')[0];
    let companyName;
    if (forcedCompanyName) {
      companyName = forcedCompanyName;
    } else {
      companyName = await prompt("Nom de l'entreprise pour cette offre :", suggestedName, {
        title: "Importer une offre",
        placeholder: "Ex: MARTIN VRD",
        confirmLabel: "Importer",
      });
      if (companyName === null) { event.target.value = null; return; }
    }

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    try {
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      // Collecter TOUS les onglets valides (tranches multiples)
      // Détection flexible du header : scanner les 15 premières lignes
      const DESIG_PATTERN = /^D[EÉ]SIGNATION$/i;
      const findHeaderRow = (ws) => {
        for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
          try {
            const v = ws.getRow(r).getCell(2).value;
            if (v && DESIG_PATTERN.test(String(v).trim())) return r;
          } catch {}
        }
        return 0;
      };
      const validSheets = [];
      const sheetHeaderRows = new Map();
      workbook.eachSheet((ws) => {
        const hr = findHeaderRow(ws);
        if (hr > 0) { validSheets.push(ws); sheetHeaderRows.set(ws.name, hr); }
      });
      if (validSheets.length === 0) {
        const fallback = workbook.getWorksheet('GLOBAL') || workbook.getWorksheet(2) || workbook.getWorksheet(1);
        if (fallback) { validSheets.push(fallback); sheetHeaderRows.set(fallback.name, 1); }
      }

      const importedOffers = {};
      const importedQuantities = {}; // qté lue dans le fichier offre (col 4 par défaut)

      // ─── Normalisations pour matching tolérant ─────────────────────────────
      // Accepte les variations d'accents, ponctuation, espaces multiples, casse.
      const normalizeDesignation = (s) => {
        return (s || '')
          .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
          .replace(/['"]/g, '')                              // apostrophes
          .replace(/[.,;:()\[\]]/g, ' ')                     // ponctuation → espace
          .replace(/\s+/g, ' ')                              // espaces multiples
          .trim()
          .toUpperCase();
      };
      // Normalise une référence : retire espaces / tirets / points pour matcher "1 005" = "1.005" = "1-005"
      const normalizeRef = (s) => {
        return (s || '')
          .replace(/[\s.\-_]/g, '')
          .toUpperCase()
          .trim();
      };

      // Map désignation normalisée → itemId
      const projectItemsMap = new Map();
      const itemIdToDesignation = new Map();
      const itemIdToUnit = new Map();
      chaptersData.forEach(chap => {
        chap.items.forEach(item => {
          if (item.designation) {
            projectItemsMap.set(normalizeDesignation(item.designation), item.id);
            itemIdToDesignation.set(item.id, item.designation);
            itemIdToUnit.set(item.id, item.unit || '');
          }
        });
      });

      // Map itemId → quantité MOE (ce que l'entreprise doit respecter — Code Commande Publique L2152-2)
      const moeQtyMap = clientQtyMaps[activeTrancheId] || new Map();
      // Map ref normalisée → itemId pour fallback si désignation modifiée
      const projectRefMap = new Map();
      if (project?.chapters) {
        let counter = 1;
        const traverse = (items) => {
          if (!items) return;
          items.forEach(item => {
            if (item.type === 'item') {
              // 1. Numérotation auto P.XX (legacy)
              const autoRef = normalizeRef(`P.${String(counter).padStart(2, '0')}`);
              // 2. Référence BPU saisie (bpuNum) — peut être "1 005", "1.005", "1-005"...
              const bpuRef = item.bpuNum ? normalizeRef(item.bpuNum) : null;
              if (bpuRef && !projectRefMap.has(bpuRef)) projectRefMap.set(bpuRef, item.id);
              if (!projectRefMap.has(autoRef)) projectRefMap.set(autoRef, item.id);
              counter++;
            }
            if (item.children?.length > 0) traverse(item.children);
          });
        };
        project.chapters.forEach(chap => { if (chap.children) traverse(chap.children); });
      }

      // Lecture sûre d'une cellule (gère les cellules fusionnées MergeValue)
      const safeCellStr = (cell) => {
        try { const v = cell?.value; if (v !== null && v !== undefined) return typeof v === 'object' && 'result' in v ? String(v.result ?? '') : String(v); } catch {}
        try { return String(cell?.text ?? ''); } catch {}
        return '';
      };
      const safeCellNum = (cell) => {
        try {
          let v = cell?.value;
          if (v !== null && typeof v === 'object' && 'result' in v) v = v.result;
          const n = Number(v ?? 0);
          return isFinite(n) ? n : 0;
        } catch { return 0; }
      };

      let totalRows = 0;
      let skippedRows = 0;
      let unmatchedRows = 0;
      let invalidPriceRows = 0;
      let refMatchedRows = 0;
      const unmatchedDetails = []; // { sheet, row, ref, designation } pour diagnostic

      for (const ws of validSheets) {
        const headerRowNum = sheetHeaderRows.get(ws.name) || 1;
        ws.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return;
          totalRows++;
          const designationRaw = safeCellStr(row.getCell(2)).trim();
          const designationNorm = normalizeDesignation(designationRaw);

          if (!designationNorm) { skippedRows++; return; }

          // 1. Match par désignation normalisée
          let itemId = projectItemsMap.get(designationNorm);
          // 2. Fallback : match par référence normalisée (col 1)
          if (!itemId) {
            const refNorm = normalizeRef(safeCellStr(row.getCell(1)));
            if (refNorm && projectRefMap.has(refNorm)) {
              itemId = projectRefMap.get(refNorm);
              refMatchedRows++;
            }
          }
          // 3. Fallback : match par préfixe de désignation (30 premiers caractères normalisés)
          //    Utile pour les libellés tronqués ou avec suffixe différent
          if (!itemId) {
            const prefix = designationNorm.slice(0, 30);
            for (const [key, id] of projectItemsMap.entries()) {
              if (key.startsWith(prefix) || prefix.startsWith(key.slice(0, 30))) {
                itemId = id;
                refMatchedRows++; // compté dans les approximatifs
                break;
              }
            }
          }

          if (!itemId) {
            unmatchedRows++;
            unmatchedDetails.push({
              sheet: ws.name,
              row: rowNumber,
              ref: safeCellStr(row.getCell(1)).trim(),
              designation: designationRaw,
            });
            return;
          }

          const price = safeCellNum(row.getCell(5));
          const offerQty = safeCellNum(row.getCell(4)); // quantité de l'offre (col 4)

          // Garder le premier prix non-nul trouvé (évite d'écraser avec 0)
          if (!(itemId in importedOffers) || (importedOffers[itemId] === 0 && price !== 0)) {
            importedOffers[itemId] = price;
          }
          // Idem pour la quantité (premier non-nul gagne)
          if (offerQty > 0 && (!(itemId in importedQuantities) || importedQuantities[itemId] === 0)) {
            importedQuantities[itemId] = offerQty;
          }
        });
      }

      // Log diagnostique des lignes non matchées (visible dans la console du navigateur)
      if (unmatchedDetails.length > 0) {
        console.warn('[Import offre] Lignes non matchées avec le DQE MOE :', unmatchedDetails);
        console.warn('[Import offre] Vérifiez les références (col 1) et les désignations (col 2) du fichier offre vs le DQE.');
      }

      // ─── CONTRÔLE QUANTITÉS — Code Commande Publique L2152-2 ──────────────
      // Le soumissionnaire ne peut pas modifier les quantités du DQE.
      // Toute divergence (stricte) → offre marquée 'irrégulière' (régularisable manuellement).
      const quantityMismatches = [];
      const round = (n) => Math.round(Number(n || 0) * 1e6) / 1e6;
      Object.entries(importedQuantities).forEach(([itemId, offerQty]) => {
        const moeQty = round(moeQtyMap.get?.(String(itemId)) ?? moeQtyMap[itemId] ?? 0);
        const off = round(offerQty);
        if (moeQty > 0 && off !== moeQty) {
          quantityMismatches.push({
            itemId,
            designation: itemIdToDesignation.get(itemId) || '',
            unit: itemIdToUnit.get(itemId) || '',
            moeQty,
            offerQty: off,
            delta: round(off - moeQty),
          });
        }
      });
      const isAutoFlaggedIrregular = quantityMismatches.length > 0;

      const matchCount = Object.keys(importedOffers).length;
      if (matchCount === 0) {
        const details = [];
        if (unmatchedRows > 0) details.push(`${unmatchedRows} désignation(s) non trouvée(s)`);
        if (invalidPriceRows > 0) details.push(`${invalidPriceRows} prix invalide(s)`);
        if (skippedRows > 0) details.push(`${skippedRows} ligne(s) vide(s)`);
        toast.warning(`Aucune correspondance trouvée.${details.length > 0 ? ' ' + details.join(', ') + '.' : ''}`);
        event.target.value = null;
        return;
      }

      const finalCompanyName = companyName.trim() || suggestedName;

      // ─── Calcul du total recalculé (qté MOE × prix importés, hors options) ──
      // Utilisé pour comparer avec le montant AE saisi au dépouillement (CCP L2113-1).
      const optionItemIds = new Set();
      chaptersData.forEach(chap => {
        if (chap.isOption) chap.items.forEach(it => optionItemIds.add(it.id));
      });
      let computedTotal = 0;
      Object.entries(importedOffers).forEach(([itemId, price]) => {
        if (optionItemIds.has(itemId)) return;
        const q = Number(moeQtyMap.get?.(String(itemId)) ?? moeQtyMap[itemId] ?? 0);
        computedTotal += q * Number(price || 0);
      });
      computedTotal = Math.round(computedTotal * 100) / 100;

      // ─── Fusion avec entreprise existante (par nom) ou création ──
      const existingCompany = companies.find(
        c => c.name.toLowerCase().trim() === finalCompanyName.toLowerCase().trim()
      );

      // Comparaison total recalculé vs AE annoncé au dépouillement
      let amountMismatch = null;
      const expectedAe = existingCompany?.aeAmount;
      if (expectedAe != null && Number.isFinite(expectedAe) && expectedAe > 0) {
        const delta = Math.round((computedTotal - expectedAe) * 100) / 100;
        if (Math.abs(delta) > 0.01) {
          const deltaPct = (delta / expectedAe) * 100;
          amountMismatch = {
            expectedAe,
            computedTotal,
            delta,
            deltaPct: Math.round(deltaPct * 100) / 100,
            checkedAt: new Date().toISOString(),
          };
        }
      }

      if (existingCompany) {
        // Fusion sur l'entreprise existante (préserve aeAmount, variants déjà saisis)
        setCompanies(prev => prev.map(c =>
          c.id === existingCompany.id
            ? {
                ...c,
                offers: { ...c.offers, ...importedOffers },
                isManual: false,
                quantityMismatches,
                isAutoFlaggedIrregular,
                computedTotal,
                amountMismatch,
                lastImportAt: new Date().toISOString(),
                lastImportFile: file.name,
              }
            : c
        ));
      } else {
        setCompanies(prev => [...prev, {
          id: `import_${Date.now()}`,
          name: finalCompanyName,
          offers: importedOffers,
          isManual: false,
          quantityMismatches,
          isAutoFlaggedIrregular,
          computedTotal,
          amountMismatch,
          lastImportAt: new Date().toISOString(),
          lastImportFile: file.name,
        }]);
      }

      // Si offre irrégulière (écart de quantités) → flag automatique dans le RAO admin
      // Conforme CCP L2152-2 : modification quantités DQE = irrégulière (régularisable manuellement)
      if (isAutoFlaggedIrregular && typeof setProject === 'function') {
        setProject(prev => {
          if (!prev) return prev;
          const r = prev.rao || {};
          const allCompanies = r.companies || {};
          const co = allCompanies[finalCompanyName] || {};
          const admin = co.admin || {};
          return {
            ...prev,
            rao: {
              ...r,
              companies: {
                ...allCompanies,
                [finalCompanyName]: {
                  ...co,
                  admin: {
                    ...admin,
                    conclusion: 'irreguliere',
                    autoFlaggedReason: 'quantity_mismatch',
                    autoFlaggedAt: new Date().toISOString(),
                  },
                },
              },
            },
          };
        });
      }
      const warnings = [];
      if (unmatchedRows > 0) warnings.push(`${unmatchedRows} non trouvé(s)`);
      if (invalidPriceRows > 0) warnings.push(`${invalidPriceRows} prix invalide(s)`);
      if (refMatchedRows > 0) warnings.push(`${refMatchedRows} par n° réf.`);
      const detail = warnings.length > 0 ? ` (${warnings.join(', ')})` : '';
      const sheetsInfo = validSheets.length > 1 ? ` (${validSheets.length} onglets lus)` : '';
      toast.success(`${matchCount}/${totalRows} offre(s) importée(s) pour "${companyName}".${detail}${sheetsInfo}`);

      // Alerte spécifique en cas d'irrégularité détectée (CCP L2152-2)
      if (isAutoFlaggedIrregular) {
        toast.warning(
          `⚠ Offre "${companyName}" classée IRRÉGULIÈRE : ${quantityMismatches.length} article(s) avec quantité divergente du DQE (régularisable manuellement onglet Administrative).`
        );
      }

      // Alerte si écart entre total recalculé et montant AE annoncé (CCP L2113-1)
      if (amountMismatch) {
        const fmt = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const sign = amountMismatch.delta > 0 ? '+' : '';
        toast.warning(
          `⚠ Écart AE détecté pour "${finalCompanyName}" : annoncé ${fmt(amountMismatch.expectedAe)} € → recalculé ${fmt(amountMismatch.computedTotal)} € (${sign}${fmt(amountMismatch.delta)} €, ${sign}${amountMismatch.deltaPct}%). Vérifier les prix unitaires (BPU prévaut contractuellement).`
        );
      }
    } catch (error) {
      console.error("Erreur lecture fichier Excel:", error);
      toast.error("Impossible de lire le fichier. Vérifiez le format Excel.");
    } finally {
      event.target.value = null;
    }
  };

  const updateCompanyOffer = (cId, iId, val) => setCompanies(prev => prev.map(c => c.id === cId ? { ...c, offers: { ...c.offers, [iId]: Number(val) } } : c));
  const renameCompany = (cId, val) => setCompanies(prev => prev.map(c => c.id === cId ? { ...c, name: val } : c));

  // ─── VARIANTES — CCP R2151-8 à R2151-11 ────────────────────────────────────
  // Importe un fichier Excel comme variante d'une entreprise.
  // La variante se substitue à la solution de base dans ses éléments différents.
  const handleImportVariant = async (companyId, file, metadata = {}) => {
    if (!file) return { ok: false, reason: 'no_file' };
    const company = companies.find(c => c.id === companyId);
    if (!company) return { ok: false, reason: 'company_not_found' };

    // ─── Détection format PDF → conversion en workbook Excel en mémoire ───
    let workingFile = file;
    if (/\.pdf$/i.test(file.name)) {
      try {
        const { parsePdfOffer, pdfToWorkbookFile } = await import('../utils/parsePdfOffer');
        const result = await parsePdfOffer(file, {
          onProgress: (p) => setOcrProgress(p),
        });
        setOcrProgress(null);
        if (result.articles.length === 0) {
          toast.error('Aucun article détecté dans le PDF de variante même après OCR.');
          return { ok: false, reason: 'no_articles' };
        }
        const ocrLabel = result.viaOcr ? ' (via OCR)' : '';
        toast.info(`PDF variante${ocrLabel} : ${result.articles.length} article(s) extrait(s). Matching en cours…`);
        workingFile = await pdfToWorkbookFile(result.articles, file.name.replace(/\.pdf$/i, '.xlsx'));
      } catch (e) {
        setOcrProgress(null);
        console.error('[Variant PDF] Erreur:', e);
        toast.error(e.message || 'Impossible de lire le PDF de variante.');
        return { ok: false, reason: 'pdf_parse_error', error: e.message };
      }
    }

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    try {
      const arrayBuffer = await workingFile.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const DESIG_PATTERN = /^D[EÉ]SIGNATION$/i;
      const findHeaderRow = (ws) => {
        for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
          try {
            const v = ws.getRow(r).getCell(2).value;
            if (v && DESIG_PATTERN.test(String(v).trim())) return r;
          } catch {}
        }
        return 0;
      };
      const validSheets = [];
      const sheetHeaderRows = new Map();
      workbook.eachSheet((ws) => {
        const hr = findHeaderRow(ws);
        if (hr > 0) { validSheets.push(ws); sheetHeaderRows.set(ws.name, hr); }
      });
      if (validSheets.length === 0) {
        const fallback = workbook.getWorksheet('GLOBAL') || workbook.getWorksheet(2) || workbook.getWorksheet(1);
        if (fallback) { validSheets.push(fallback); sheetHeaderRows.set(fallback.name, 1); }
      }

      // ─── Normalisations pour matching tolérant (alignées sur handleImportExcel) ─
      const normalizeDesignation = (s) => {
        return (s || '')
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/['"]/g, '')
          .replace(/[.,;:()\[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase();
      };
      const normalizeRef = (s) => {
        return (s || '')
          .replace(/[\s.\-_]/g, '')
          .toUpperCase()
          .trim();
      };

      // Maps de matching (désignation normalisée + ref normalisée)
      const projectItemsMap = new Map();
      const itemIdToDesignation = new Map();
      const itemIdToUnit = new Map();
      chaptersData.forEach(chap => {
        chap.items.forEach(item => {
          if (item.designation) {
            projectItemsMap.set(normalizeDesignation(item.designation), item.id);
            itemIdToDesignation.set(item.id, item.designation);
            itemIdToUnit.set(item.id, item.unit || '');
          }
        });
      });
      const projectRefMap = new Map();
      if (project?.chapters) {
        let counter = 1;
        const traverse = (items) => {
          if (!items) return;
          items.forEach(item => {
            if (item.type === 'item') {
              const autoRef = normalizeRef(`P.${String(counter).padStart(2, '0')}`);
              const bpuRef = item.bpuNum ? normalizeRef(item.bpuNum) : null;
              if (bpuRef && !projectRefMap.has(bpuRef)) projectRefMap.set(bpuRef, item.id);
              if (!projectRefMap.has(autoRef)) projectRefMap.set(autoRef, item.id);
              counter++;
            }
            if (item.children?.length > 0) traverse(item.children);
          });
        };
        project.chapters.forEach(chap => { if (chap.children) traverse(chap.children); });
      }

      const moeQtyMap = clientQtyMaps[activeTrancheId] || new Map();
      const baseOffers = company.offers || {};

      const round = (n) => Math.round(Number(n || 0) * 1e6) / 1e6;

      const safeCellStr = (cell) => {
        try { const v = cell?.value; if (v !== null && v !== undefined) return typeof v === 'object' && 'result' in v ? String(v.result ?? '') : String(v); } catch {}
        try { return String(cell?.text ?? ''); } catch {}
        return '';
      };
      const safeCellNum = (cell) => {
        try {
          let v = cell?.value;
          if (v !== null && typeof v === 'object' && 'result' in v) v = v.result;
          const n = Number(v ?? 0);
          return isFinite(n) ? n : 0;
        } catch { return 0; }
      };

      const variantOffers = {};
      const variantQuantities = {};
      const newItems = []; // articles ajoutés par la variante (absents du DQE base)
      let totalRows = 0;

      for (const ws of validSheets) {
        const headerRowNum = sheetHeaderRows.get(ws.name) || 1;
        ws.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return;
          totalRows++;
          const desigRaw = safeCellStr(row.getCell(2)).trim();
          const designationNorm = normalizeDesignation(desigRaw);
          if (!designationNorm) return;

          const price = safeCellNum(row.getCell(5));
          const qty   = safeCellNum(row.getCell(4));
          const unit  = safeCellStr(row.getCell(3)).trim();
          const rawRef = safeCellStr(row.getCell(1)).trim();

          // 1. Match par désignation normalisée
          let itemId = projectItemsMap.get(designationNorm);
          // 2. Fallback : match par référence normalisée
          if (!itemId) {
            const refNorm = normalizeRef(rawRef);
            if (refNorm && projectRefMap.has(refNorm)) {
              itemId = projectRefMap.get(refNorm);
            }
          }
          // 3. Fallback : match par préfixe (30 caractères normalisés)
          if (!itemId) {
            const prefix = designationNorm.slice(0, 30);
            for (const [key, id] of projectItemsMap.entries()) {
              if (key.startsWith(prefix) || prefix.startsWith(key.slice(0, 30))) {
                itemId = id;
                break;
              }
            }
          }

          if (!itemId) {
            // Prix nouveau : article ajouté par la variante, absent du DQE base
            newItems.push({
              id: `new_${Date.now()}_${newItems.length}`,
              ref: rawRef || '',
              designation: desigRaw,
              unit,
              qty,
              price,
              lineTotal: round(qty * price),
            });
            return;
          }

          if (!(itemId in variantOffers) || (variantOffers[itemId] === 0 && price !== 0)) {
            variantOffers[itemId] = price;
          }
          if (qty > 0 && (!(itemId in variantQuantities) || variantQuantities[itemId] === 0)) {
            variantQuantities[itemId] = qty;
          }
        });
      }

      // Articles supprimés : présents dans DQE base mais absents du fichier variante
      const removedItems = [];
      itemIdToDesignation.forEach((designation, itemId) => {
        if (!(itemId in variantOffers)) {
          const basePrice = round(baseOffers[itemId] || 0);
          const moeQty = round(moeQtyMap.get?.(String(itemId)) ?? moeQtyMap[itemId] ?? 0);
          removedItems.push({
            itemId,
            designation,
            unit: itemIdToUnit.get(itemId) || '',
            moeQty,
            basePrice,
            lostAmount: round(moeQty * basePrice),
          });
        }
      });

      const matchCount = Object.keys(variantOffers).length;
      if (matchCount === 0 && newItems.length === 0) {
        toast.warning(`Aucune correspondance dans le fichier variante.`);
        return { ok: false, reason: 'no_match' };
      }

      // Comparaisons : variante vs DQE MOE + variante vs offre de base
      const mismatchesVsMoe = [];
      const mismatchesVsBase = [];
      Object.entries(variantQuantities).forEach(([itemId, vQty]) => {
        const moeQty = round(moeQtyMap.get?.(String(itemId)) ?? moeQtyMap[itemId] ?? 0);
        const off = round(vQty);
        if (moeQty > 0 && off !== moeQty) {
          mismatchesVsMoe.push({
            itemId,
            designation: itemIdToDesignation.get(itemId) || '',
            unit: itemIdToUnit.get(itemId) || '',
            moeQty,
            offerQty: off,
            delta: round(off - moeQty),
          });
        }
      });
      // Comparer prix vs offre de base (signaler les articles dont le PU varie)
      Object.entries(variantOffers).forEach(([itemId, vPrice]) => {
        const basePrice = round(baseOffers[itemId] || 0);
        const vP = round(vPrice);
        if (basePrice > 0 && vP !== basePrice) {
          mismatchesVsBase.push({
            itemId,
            designation: itemIdToDesignation.get(itemId) || '',
            unit: itemIdToUnit.get(itemId) || '',
            basePrice,
            variantPrice: vP,
            delta: round(vP - basePrice),
          });
        }
      });

      // Total variante : articles matchés (qté variante si dispo, sinon qté MOE) + nouveaux articles
      // Les articles supprimés sortent naturellement (pas dans variantOffers)
      let totalMatched = 0;
      Object.entries(variantOffers).forEach(([itemId, vPrice]) => {
        const q = variantQuantities[itemId] != null
          ? variantQuantities[itemId]
          : (moeQtyMap.get?.(String(itemId)) ?? moeQtyMap[itemId] ?? 0);
        totalMatched += Number(q || 0) * Number(vPrice || 0);
      });
      const totalNew = newItems.reduce((s, it) => s + Number(it.lineTotal || 0), 0);
      const totalRemoved = removedItems.reduce((s, it) => s + Number(it.lostAmount || 0), 0);
      const totalVariant = round(totalMatched + totalNew);

      const variant = {
        id: `var_${Date.now()}`,
        label: metadata.label || 'Variante sans nom',
        description: metadata.description || '',
        fileName: file.name,
        importedAt: new Date().toISOString(),
        offers: variantOffers,
        quantities: variantQuantities,
        newItems,                 // articles ajoutés par la variante (absents du DQE)
        removedItems,             // articles du DQE absents du fichier variante
        total: totalVariant,
        totalNew: round(totalNew),
        totalRemoved: round(totalRemoved),
        mismatchesVsMoe,
        mismatchesVsBase,
        stats: { totalRows, matchCount, newCount: newItems.length, removedCount: removedItems.length },
      };

      setCompanies(prev => prev.map(c =>
        c.id === companyId
          ? { ...c, variants: [...(c.variants || []), variant] }
          : c
      ));

      const details = [];
      if (newItems.length > 0) details.push(`${newItems.length} nouveau(x)`);
      if (removedItems.length > 0) details.push(`${removedItems.length} supprimé(s)`);
      if (mismatchesVsMoe.length > 0) details.push(`${mismatchesVsMoe.length} qté ≠ DQE`);
      if (mismatchesVsBase.length > 0) details.push(`${mismatchesVsBase.length} prix ≠ base`);
      const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
      toast.success(`Variante "${variant.label}" importée : ${matchCount}/${totalRows} article(s) matchés${detailStr}.`);

      return { ok: true, variant };
    } catch (error) {
      console.error('[Variant] Erreur import:', error);
      toast.error('Impossible de lire le fichier variante. Vérifiez le format Excel.');
      return { ok: false, reason: 'parse_error' };
    }
  };

  // ─── DÉPOUILLEMENT — étape macro avant import détaillé ────────────────────
  // Applique les données du PV de dépouillement (entreprises + AE + variantes annoncées).
  // Crée les entreprises manquantes, met à jour les existantes (match par nom).
  // Les détails par article (offers) restent intacts pour les entreprises existantes.
  // Met aussi à jour les champs de consultation (régime variantes, date plis).
  const applyDepouillement = (payload) => {
    // Compat : si on reçoit juste un array, c'est l'ancien format (entries only)
    const { consultation, entries } = Array.isArray(payload)
      ? { consultation: null, entries: payload }
      : (payload || {});
    if (!Array.isArray(entries)) return;

    // 1. Mise à jour des champs consultation (variantes régime + exigences + date plis)
    if (consultation && typeof setProject === 'function') {
      setProject(prev => {
        if (!prev) return prev;
        const r = prev.rao || {};
        return {
          ...prev,
          rao: {
            ...r,
            consultation: {
              ...(r.consultation || {}),
              ...consultation,
            },
          },
        };
      });
    }

    setCompanies(prev => {
      const byNameLower = new Map(prev.map(c => [c.name.toLowerCase().trim(), c]));
      const seenIds = new Set();

      const next = entries.map(entry => {
        const key = entry.name.toLowerCase().trim();
        const existing = entry.existingId
          ? prev.find(c => c.id === entry.existingId)
          : byNameLower.get(key);

        // Conserver les variantes existantes (avec leurs détails) et fusionner avec celles annoncées
        const existingVariants = existing?.variants || [];
        const variantsByLabel = new Map(existingVariants.map(v => [v.label.toLowerCase().trim(), v]));
        const mergedVariants = (entry.variants || []).map(annouce => {
          const labelKey = annouce.label.toLowerCase().trim();
          const existingV = annouce.existingId
            ? existingVariants.find(v => v.id === annouce.existingId)
            : variantsByLabel.get(labelKey);
          if (existingV) {
            return { ...existingV, label: annouce.label, aeAmount: annouce.aeAmount };
          }
          // Stub minimal — sera complété par import Excel plus tard
          return {
            id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            label: annouce.label,
            aeAmount: annouce.aeAmount,
            description: '',
            offers: {},
            quantities: {},
            newItems: [],
            removedItems: [],
            mismatchesVsMoe: [],
            mismatchesVsBase: [],
            total: 0,
          };
        });

        if (existing) {
          seenIds.add(existing.id);
          return {
            ...existing,
            name: entry.name,
            aeAmount: entry.aeAmount,
            variants: mergedVariants,
          };
        }
        return {
          id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: entry.name,
          aeAmount: entry.aeAmount,
          offers: {},
          isManual: true,
          variants: mergedVariants,
        };
      });

      // Conserver les entreprises existantes non listées dans le dépouillement (sécurité)
      const preserved = prev.filter(c => !next.find(n => n.id === c.id) && !seenIds.has(c.id));
      return [...next, ...preserved];
    });

    toast.success(`Dépouillement enregistré : ${entries.length} entreprise(s).`);
  };

  // Bascule le statut "retenue" d'une variante. Une variante retenue apparaît
  // comme une ligne supplémentaire dans le récapitulatif RAO.
  const toggleVariantRetained = (companyId, variantId) => {
    setCompanies(prev => prev.map(c =>
      c.id !== companyId
        ? c
        : {
            ...c,
            variants: (c.variants || []).map(v =>
              v.id === variantId ? { ...v, retained: !v.retained } : v
            ),
          }
    ));
  };

  // Justification d'acceptation/rejet d'une variante. Le texte est utilisé
  // dans la tab Technique du RAO et repris dans le PDF section 7.bis.
  const updateVariantJustification = (companyId, variantId, justification) => {
    setCompanies(prev => prev.map(c =>
      c.id !== companyId
        ? c
        : {
            ...c,
            variants: (c.variants || []).map(v =>
              v.id === variantId ? { ...v, justification } : v
            ),
          }
    ));
  };

  const removeVariant = async (companyId, variantId) => {
    const company = companies.find(c => c.id === companyId);
    const variant = (company?.variants || []).find(v => v.id === variantId);
    const ok = await confirm(`Supprimer la variante "${variant?.label || variantId}" ?`, {
      title: 'Supprimer la variante', danger: true, confirmLabel: 'Supprimer',
    });
    if (!ok) return;
    setCompanies(prev => prev.map(c =>
      c.id === companyId
        ? { ...c, variants: (c.variants || []).filter(v => v.id !== variantId) }
        : c
    ));
    toast.success('Variante supprimée.');
  };
  
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
        const prices = companies.map(c => Number(c.offers?.[item.id] ?? 0)).filter(p => p !== 0);
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
    const now = new Date().toISOString();
    // Nom du projet pour traçabilité (passé en 3e argument optionnel)
    for (const [itemId, data] of entries) {
      const key = data.designation?.trim().toUpperCase();
      const bpuItem = bpuByDesignation.get(key);
      if (bpuItem) {
        // Accumuler dans l'historique au lieu d'écraser
        const history = [...(bpuItem.priceHistory || [])];
        // Migrer l'ancien observedPrice s'il existe et qu'il n'y a pas encore d'historique
        if (history.length === 0 && bpuItem.observedPrice && bpuItem.observedPrice !== data.avg) {
          history.push({ price: bpuItem.observedPrice, date: bpuItem.updatedAt || now, count: 0 });
        }
        history.push({ price: data.avg, date: now, count: data.count, total: data.total });
        // Moyenne de tout l'historique
        const avgAll = Math.round(history.reduce((s, h) => s + h.price, 0) / history.length * 100) / 100;
        await updateBpuItem(bpuItem.id, { observedPrice: avgAll, priceHistory: history });
        updated++;
      }
    }

    if (updated > 0) {
      toast.success(`${updated} prix observé(s) mis à jour dans la base de prix (historique conservé).`);
    } else {
      toast.warning("Aucune correspondance trouvée entre les articles analysés et la base de prix.");
    }
  }, [averagesHorsOAB, confirm, toast]);

  const handleManualSave = useCallback(async () => {
    await saveAnalysis();
    toast.success(`${companies.length} entreprise(s) sauvegardée(s).`);
  }, [companies, saveAnalysis, toast]);

  return {
    chaptersData, companies, stats, scoringConfig, setScoringConfig,
    canUndoObservatory: history.length > 0, lastSaved,
    handleAddManualCompany, handleImportExcel, updateCompanyOffer,
    renameCompany, removeCompany, handleClearAll,
    handleSaveToObservatory, handleUndoObservatory,
    averagesHorsOAB, handlePushAveragesToBpu, handleManualSave,
    handleExportJson, handleImportJson,
    // Variantes — CCP R2151-8 à R2151-11
    handleImportVariant, removeVariant, toggleVariantRetained, updateVariantJustification,
    // Dépouillement — CCP L2113-1 / R2151-1
    applyDepouillement,
    // Import PDF
    handleImportPdfOffer,
    // Progression OCR (PDF scannés)
    ocrProgress,
  };
};

export default usePriceAnalysis;