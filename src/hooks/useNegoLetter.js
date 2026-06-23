// src/hooks/useNegoLetter.js
//
// Logique métier de l'onglet Négociation RAO : génération de l'aperçu courrier,
// détection des prix atypiques, injection / réinitialisation des sections, et
// gestion des modèles de texte "Prix atypiques" (localStorage).
//
// Le composant TabNegociation se contente de câbler ce hook avec ses sous-vues.

import { useState, useEffect, useRef } from 'react';
import { toast } from '../utils/globalUI';
import {
  applyTemplate,
  buildAnomalySectionHtml,
  injectSectionsIntoHtml,
  htmlToPlainText,
} from '../components/rao/tabs/nego/negoLetterUtils';
import {
  ANOMALY_TPL_KEY,
  ANOMALY_MODE_KEY,
  DEFAULT_LOW_TEMPLATE,
  DEFAULT_HIGH_TEMPLATE,
  DEFAULT_UNIFIED_TEMPLATE,
  OLD_LOW_TEMPLATE,
  OLD_HIGH_TEMPLATE,
} from '../components/rao/tabs/nego/negoTemplates';

export const useNegoLetter = ({
  selectedCompany,
  masterTemplate,
  letterConfig,
  consultation,
  project,
  analysisCompanies = [],
  chaptersData = [],
  analysisStats = null,
  bpuRefMap = new Map(),
  companiesData,
  updateNegotiation,
}) => {
  // ── Seuils de détection ──
  const [anomalyThresholds, setAnomalyThresholds] = useState({ ecart: 15, impact: 1 });

  // ── Mode d'injection : 'split' (2 blocs bas/haut) | 'unified' (1 bloc) ──
  const [anomalyMode, setAnomalyModeState] = useState(() => {
    try { return localStorage.getItem(ANOMALY_MODE_KEY) === 'unified' ? 'unified' : 'split'; }
    catch { return 'split'; }
  });
  const setAnomalyMode = (mode) => {
    const m = mode === 'unified' ? 'unified' : 'split';
    setAnomalyModeState(m);
    try { localStorage.setItem(ANOMALY_MODE_KEY, m); } catch { /* ignore */ }
  };

  // ── Templates de texte "Prix atypiques" (HTML Quill, persistés localStorage) ──
  const [anomalyTemplates, setAnomalyTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(ANOMALY_TPL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration : si l'utilisateur a juste les anciens défauts, basculer vers les nouveaux
        return {
          low:  (!parsed.low  || parsed.low  === OLD_LOW_TEMPLATE)  ? DEFAULT_LOW_TEMPLATE  : parsed.low,
          high: (!parsed.high || parsed.high === OLD_HIGH_TEMPLATE) ? DEFAULT_HIGH_TEMPLATE : parsed.high,
          unified: parsed.unified || DEFAULT_UNIFIED_TEMPLATE,
        };
      }
    } catch { /* ignore */ }
    return { low: DEFAULT_LOW_TEMPLATE, high: DEFAULT_HIGH_TEMPLATE, unified: DEFAULT_UNIFIED_TEMPLATE };
  });
  const saveAnomalyTemplates = (next) => {
    setAnomalyTemplates(next);
    try { localStorage.setItem(ANOMALY_TPL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // ── État aperçu courrier (volatile, jamais persisté) ──
  // Régénéré depuis la trame quand : entreprise change, trame change, ou une
  // variable de letterConfig change. Les sections data-anomaly injectées sont
  // conservées dans un ref pour survivre aux régénérations dues aux variables.
  const [letterHtml, setLetterHtml] = useState('');
  const anomalySectionsRef = useRef({ low: null, high: null });

  // Restauration des sections persistées quand on change d'entreprise
  // (stockées dans nego.anomalySections par entreprise)
  useEffect(() => {
    const persisted = companiesData[selectedCompany]?.negotiation?.anomalySections || null;
    anomalySectionsRef.current = {
      low:  persisted?.low  || null,
      high: persisted?.high || null,
    };
  }, [selectedCompany, companiesData]);

  // Régénération de la trame + réinjection des sections préservées
  useEffect(() => {
    if (!selectedCompany) {
      setLetterHtml('');
      return;
    }
    const generated = applyTemplate(masterTemplate, selectedCompany, '', letterConfig, consultation, project);
    const { low, high } = anomalySectionsRef.current;
    setLetterHtml((low || high) ? injectSectionsIntoHtml(generated, low, high) : generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, masterTemplate, letterConfig.signatoryName, letterConfig.city, letterConfig.deadline, letterConfig.adresseEntreprise, companiesData]);

  // ── DÉTECTION DES PRIX ATYPIQUES (HAUTS ET BAS) ──
  const detectAnomalies = (companyName) => {
    const company = analysisCompanies.find(c => c.name === companyName);
    if (!company) {
      toast.warning(`Entreprise "${companyName}" introuvable dans les données d'analyse. Vérifiez que l'import est bien effectué.`);
      return null;
    }
    if (!chaptersData?.length || !analysisStats) {
      toast.warning("Les données d'analyse financière ne sont pas disponibles. Veuillez d'abord importer les offres dans l'onglet Analyse.");
      return null;
    }

    const lowItems = [];
    const highItems = [];
    const allItems = []; // tous les atypiques dans l'ordre du document (mode unifié)
    const companyGrandTotal = analysisStats.companiesTotals?.[company.id] || 0;
    if (companyGrandTotal === 0) {
      toast.warning(`Aucune offre chiffrée trouvée pour "${companyName}". Vérifiez que l'import Excel est complet.`);
      return null;
    }

    chaptersData.forEach(chapter => {
      chapter.items.forEach(item => {
        const cd = item.companyData?.[company.id];
        if (!cd) return;
        const companyPU = cd.pu || 0;
        const activeQty = item.activeQty || 0;
        const lineTotal = cd.lineTotal || (companyPU * activeQty);
        if (companyPU === 0) return;
        const allPUs = analysisCompanies
          .map(co => Number(co.offers?.[item.id] ?? 0))
          .filter(p => p !== 0);
        if (allPUs.length < 2) return;
        const averagePU = allPUs.reduce((a, b) => a + b, 0) / allPUs.length;
        const diffRatio = (companyPU - averagePU) / averagePU;
        const impactRatio = lineTotal / companyGrandTotal;
        if (Math.abs(diffRatio) > (anomalyThresholds.ecart / 100) && impactRatio > (anomalyThresholds.impact / 100)) {
          const puFormatted = companyPU.toLocaleString('fr-FR', { minimumFractionDigits: 2 }).replace(/[\u202F\u00A0\u2009]/g, ' ');
          const refLabel = bpuRefMap?.get?.(item.id) || item.bpuNum || item.ref || '—';
          const label = item.designation || item.name || '';
          const unit = item.unit || item.unite || '';
          // Item structure : utilisé par buildAnomalySectionHtml (table) + plain-text (PDF)
          const structuredItem = { ref: refLabel, label, pu: puFormatted, unit };
          allItems.push(structuredItem);
          if (diffRatio > 0) highItems.push(structuredItem);
          else lowItems.push(structuredItem);
        }
      });
    });

    return { lowItems, highItems, allItems };
  };

  // ── INJECTION DES SECTIONS PRIX ATYPIQUES DANS L'APERÇU ──
  // Toujours partir d'une trame fraîche pour garantir l'ordre :
  // intro → low → high → suite de la lettre.
  const injectAnomalies = () => {
    if (!selectedCompany) return;
    const result = detectAnomalies(selectedCompany);
    if (!result) return; // toast déjà émis

    const { lowItems, highItems, allItems } = result;
    if (allItems.length === 0) {
      toast.info(`Aucun prix atypique détecté (seuils : écart > ${anomalyThresholds.ecart}% de la moyenne ET impact > ${anomalyThresholds.impact}% de l'offre totale).`);
      return;
    }

    // Synchronise nego.questions (string brut) pour le générateur PDF.
    const itemToString = (it) => {
      const unitSuffix = it.unit ? `/${it.unit}` : '';
      return `- Prix n°${it.ref} — ${it.label} : PU proposé de ${it.pu} € HT${unitSuffix}.`;
    };
    const itemsBlock = (items) => '\n\nArticles concernés :\n' + items.map(itemToString).join('\n');

    let lowSection = null;
    let highSection = null;
    let questionsString = '';

    if (anomalyMode === 'unified') {
      // Un seul bloc : tous les prix atypiques (bas + hauts) dans un tableau unique.
      // On réutilise le slot "low" de l'injection (high = null) → ordre/réinjection inchangés.
      lowSection = buildAnomalySectionHtml('unified', anomalyTemplates.unified, allItems);
      questionsString = htmlToPlainText(anomalyTemplates.unified) + itemsBlock(allItems);
    } else {
      // Deux blocs distincts : prix bas (rouge) puis prix hauts (amber).
      lowSection = lowItems.length > 0
        ? buildAnomalySectionHtml('low', anomalyTemplates.low, lowItems)
        : null;
      highSection = highItems.length > 0
        ? buildAnomalySectionHtml('high', anomalyTemplates.high, highItems)
        : null;
      questionsString = [
        lowItems.length > 0 ? htmlToPlainText(anomalyTemplates.low) + itemsBlock(lowItems) : null,
        highItems.length > 0 ? htmlToPlainText(anomalyTemplates.high) + itemsBlock(highItems) : null,
      ].filter(Boolean).join('\n\n');
    }

    // Stocker dans le ref pour persister à travers les régénérations
    anomalySectionsRef.current = { low: lowSection, high: highSection };
    // Persistance Firestore (par entreprise) : survivront au rechargement
    updateNegotiation(selectedCompany, 'anomalySections', { low: lowSection, high: highSection });

    // Regénérer depuis la trame propre + injecter les sections (ordre garanti)
    const generated = applyTemplate(masterTemplate, selectedCompany, '', letterConfig, consultation, project);
    setLetterHtml(injectSectionsIntoHtml(generated, lowSection, highSection));

    updateNegotiation(selectedCompany, 'questions', questionsString);

    const total = allItems.length;
    toast.success(`${total} prix atypique${total > 1 ? 's' : ''} injecté${total > 1 ? 's' : ''} dans l'aperçu.`);
  };

  // ── RÉINITIALISATION DEPUIS LA TRAME ──
  const resetFromTemplate = () => {
    if (!selectedCompany) return;
    if (!window.confirm("Effacer toutes vos modifications et repartir de la trame de base ?\n\nLes prix atypiques injectés et les éditions manuelles seront perdus.")) return;
    anomalySectionsRef.current = { low: null, high: null };
    const generated = applyTemplate(masterTemplate, selectedCompany, '', letterConfig, consultation, project);
    setLetterHtml(generated);
    updateNegotiation(selectedCompany, 'questions', '');
    updateNegotiation(selectedCompany, 'anomalySections', null);
    toast.success("Aperçu réinitialisé depuis la trame.");
  };

  return {
    letterHtml,
    anomalyMode,
    setAnomalyMode,
    anomalyTemplates,
    saveAnomalyTemplates,
    anomalyThresholds,
    setAnomalyThresholds,
    injectAnomalies,
    resetFromTemplate,
  };
};
