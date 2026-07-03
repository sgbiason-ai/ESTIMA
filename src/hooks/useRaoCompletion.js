// src/hooks/useRaoCompletion.js
// Hook centralisé : calcule l'état de complétion + items manquants détaillés
// par onglet du RAO. Alimente le stepper, les badges, la checklist pré-export
// ET les banners d'alerte / marquages inline dans chaque onglet.

import { useMemo } from 'react';
import { NON_REGULAR_STATUSES } from '../components/rao/RaoConstants';
import { getEffectiveConclusion, isRegularizedAfterNego } from '../utils/analysisCompute';

export const useRaoCompletion = ({
  rao,
  consultation,
  criteria,
  analysisCompanies = [],
  companiesData = {},
  scoringConfig = null,
}) => {
  return useMemo(() => {
    const companyNames = analysisCompanies.map(c => c.name);
    const nbCompanies = companyNames.length;

    // ─── 1. Consultation ───
    const techCs = criteria.filter(c => !c.auto);
    const priceC = criteria.find(c => c.auto);
    const totalWeight = criteria.reduce((s, c) => {
      if (c.auto) return s + (Number(scoringConfig?.maxScore) || Number(c.weight) || 0);
      if ((c.subCriteria || []).length > 0) {
        return s + c.subCriteria.reduce((sw, sc) => sw + (Number(sc.weight) || 0), 0);
      }
      return s + (Number(c.weight) || 0);
    }, 0);

    const consultationItems = [
      { id: 'critere_prix', label: 'Critère Prix défini', ok: !!priceC },
      { id: 'critere_tech', label: 'Au moins 1 critère technique', ok: techCs.length > 0 },
      { id: 'ponderation', label: 'Pondération totale = 100', ok: totalWeight === 100, warn: totalWeight !== 100, value: totalWeight },
    ];
    const consultationMissing = [];
    if (!priceC) consultationMissing.push({ id: 'crit_prix', label: 'Définir le critère Prix', anchorId: 'crit-prix', type: 'critere' });
    if (techCs.length === 0) consultationMissing.push({ id: 'crit_tech', label: 'Ajouter au moins 1 critère technique', anchorId: 'crit-tech', type: 'critere' });
    if (totalWeight !== 100) consultationMissing.push({ id: 'ponderation', label: `Pondération totale = ${totalWeight} % (doit être 100)`, anchorId: 'crit-tech', type: 'ponderation' });
    const consultationDone = consultationMissing.length === 0;

    // ─── 2. Dépouillement ───
    const aeMissing = analysisCompanies.filter(c => !c.aeAmount && !c.amountMismatch?.expectedAe).length;
    const depouillementItems = [
      { id: 'nb_entreprises', label: `${nbCompanies} entreprise${nbCompanies > 1 ? 's' : ''} consultée${nbCompanies > 1 ? 's' : ''}`, ok: nbCompanies > 0, value: nbCompanies },
      { id: 'date_ouverture', label: 'Date d\'ouverture des plis', ok: !!(consultation?.dateOuverturePLis || consultation?.dateRemise) },
      { id: 'regime_variantes', label: 'Régime des variantes défini', ok: !!consultation?.variantsAllowed },
      { id: 'ae_montants', label: `Montants AE renseignés (${nbCompanies - aeMissing}/${nbCompanies})`, ok: aeMissing === 0, warn: aeMissing > 0 && nbCompanies > 0 },
    ];
    const depouillementMissing = [];
    if (nbCompanies === 0) depouillementMissing.push({ id: 'no_companies', label: 'Aucune entreprise consultée', anchorId: 'depouill-modal', type: 'depouillement' });
    if (!consultation?.dateOuverturePLis && !consultation?.dateRemise) depouillementMissing.push({ id: 'no_date', label: 'Date d\'ouverture des plis manquante', anchorId: 'depouill-date', type: 'depouillement' });
    if (!consultation?.variantsAllowed) depouillementMissing.push({ id: 'no_regime', label: 'Régime des variantes non défini', anchorId: 'depouill-regime', type: 'depouillement' });
    analysisCompanies.forEach(c => {
      if (!c.aeAmount && !c.amountMismatch?.expectedAe) {
        depouillementMissing.push({ id: `ae_${c.id}`, label: `Montant AE manquant pour ${c.name}`, anchorId: `depouill-ae-${c.id}`, companyName: c.name, type: 'ae' });
      }
    });
    const depouillementDone = depouillementMissing.length === 0 && nbCompanies > 0;

    // ─── 3. Administratif ───
    // Phase après négo : le statut effectif (régularisation prise en compte) pilote
    // les exigences ; un motif de régularisation est requis pour toute offre régularisée.
    const adminBasis = scoringConfig?.basis === 'nego' ? 'nego' : 'initial';
    const adminConcl = companyNames.filter(name => !!companiesData[name]?.admin?.conclusion).length;
    // Offres régularisées en négociation : motif de régularisation obligatoire (CCP R2152-2).
    const regularizedNames = adminBasis === 'nego'
      ? companyNames.filter(name => isRegularizedAfterNego(companiesData[name]?.admin))
      : [];
    const regCommentMissingNames = regularizedNames.filter(name => !(companiesData[name]?.admin?.regularizationComment || '').trim());
    const adminItems = [
      { id: 'conclusions', label: `Conclusions admin (${adminConcl}/${nbCompanies})`, ok: adminConcl === nbCompanies && nbCompanies > 0, value: `${adminConcl}/${nbCompanies}` },
    ];
    if (regularizedNames.length > 0) {
      const motived = regularizedNames.length - regCommentMissingNames.length;
      adminItems.push({
        id: 'regularization_comments',
        label: `Motifs de régularisation après négo (${motived}/${regularizedNames.length})`,
        ok: regCommentMissingNames.length === 0,
        warn: regCommentMissingNames.length > 0,
        value: `${motived}/${regularizedNames.length}`,
      });
    }
    const adminMissing = [];
    companyNames.forEach(name => {
      if (!companiesData[name]?.admin?.conclusion) {
        adminMissing.push({
          id: `concl_${name}`,
          label: `Conclusion admin pour ${name}`,
          anchorId: `admin-concl-${name}`,
          companyName: name,
          type: 'admin_conclusion',
        });
      }
    });
    regCommentMissingNames.forEach(name => {
      adminMissing.push({
        id: `reg_comment_${name}`,
        label: `Motif de régularisation après négo pour ${name}`,
        anchorId: `admin-reg-comment-${name}`,
        companyName: name,
        type: 'admin_regularization_comment',
      });
    });
    const adminDone = nbCompanies > 0 && adminMissing.length === 0;
    const adminRatio = nbCompanies > 0 ? `${adminConcl}/${nbCompanies}` : null;

    // ─── 4. Technique (entreprises régulières uniquement — statut effectif) ───
    const regularCompanies = analysisCompanies.filter(c => {
      const concl = getEffectiveConclusion(companiesData[c.name]?.admin, adminBasis);
      return !concl || !NON_REGULAR_STATUSES.includes(concl);
    });

    let totalTechSlots = 0, filledTechSlots = 0;
    let totalCommSlots = 0, filledCommSlots = 0;
    const techMissing = [];

    regularCompanies.forEach(c => {
      const tech = companiesData[c.name]?.technical || {};
      techCs.forEach(crit => {
        const hasSubs = (crit.subCriteria || []).length > 0;
        if (hasSubs) {
          crit.subCriteria.forEach(sc => {
            totalTechSlots++;
            totalCommSlots++;
            const noteFilled = Number(tech[sc.id]?.note || 0) > 0;
            const commFilled = (tech[sc.id]?.text || '').trim();
            if (noteFilled) filledTechSlots++; else techMissing.push({
              id: `note_${c.name}_${sc.id}`,
              label: `Note ${sc.label || 'sous-critère'} manquante pour ${c.name}`,
              anchorId: `tech-note-${c.name}-${sc.id}`,
              companyName: c.name,
              type: 'note',
            });
            if (commFilled) filledCommSlots++; else techMissing.push({
              id: `comm_${c.name}_${sc.id}`,
              label: `Commentaire ${sc.label || 'sous-critère'} pour ${c.name}`,
              anchorId: `tech-comm-${c.name}-${sc.id}`,
              companyName: c.name,
              type: 'comment',
            });
          });
        } else {
          totalTechSlots++;
          totalCommSlots++;
          const noteFilled = Number(tech[crit.id]?.note || 0) > 0;
          const commFilled = (tech[crit.id]?.text || '').trim();
          if (noteFilled) filledTechSlots++; else techMissing.push({
            id: `note_${c.name}_${crit.id}`,
            label: `Note ${crit.label} manquante pour ${c.name}`,
            anchorId: `tech-note-${c.name}-${crit.id}`,
            companyName: c.name,
            type: 'note',
          });
          if (commFilled) filledCommSlots++; else techMissing.push({
            id: `comm_${c.name}_${crit.id}`,
            label: `Commentaire ${crit.label} pour ${c.name}`,
            anchorId: `tech-comm-${c.name}-${crit.id}`,
            companyName: c.name,
            type: 'comment',
          });
        }
      });
    });

    // Variantes retenues : justifications
    let retainedVariants = 0, justifiedVariants = 0;
    analysisCompanies.forEach(c => {
      (c.variants || []).forEach((v, vi) => {
        if (v.retained) {
          retainedVariants++;
          if ((v.justification || '').trim()) justifiedVariants++;
          else techMissing.push({
            id: `var_justif_${c.id}_${v.id}`,
            label: `Justification de la variante V${vi + 1} ${v.label ? `(${v.label}) ` : ''}pour ${c.name}`,
            anchorId: `tech-var-${c.name}-${v.id}`,
            companyName: c.name,
            type: 'variant_justif',
          });
        }
      });
    });

    const techItems = [
      { id: 'notes', label: `Notes techniques (${filledTechSlots}/${totalTechSlots})`, ok: totalTechSlots > 0 && filledTechSlots === totalTechSlots, warn: filledTechSlots < totalTechSlots, value: `${filledTechSlots}/${totalTechSlots}` },
      { id: 'comments', label: `Commentaires (${filledCommSlots}/${totalCommSlots})`, ok: totalCommSlots > 0 && filledCommSlots === totalCommSlots, warn: filledCommSlots < totalCommSlots, value: `${filledCommSlots}/${totalCommSlots}` },
    ];
    if (retainedVariants > 0) {
      techItems.push({
        id: 'variants_justif',
        label: `Justification variantes retenues (${justifiedVariants}/${retainedVariants})`,
        ok: justifiedVariants === retainedVariants,
        warn: justifiedVariants < retainedVariants,
        value: `${justifiedVariants}/${retainedVariants}`,
      });
    }
    const techDone = totalTechSlots > 0 && techMissing.length === 0;
    const techRatio = totalTechSlots > 0 ? `${filledTechSlots}/${totalTechSlots}` : null;

    // ─── 5. Négociation (optionnel) ───
    let negotiationsFilled = 0;
    companyNames.forEach(name => {
      const nego = companiesData[name]?.negotiation || {};
      if ((nego.questions || '').trim() || (nego.responses || '').trim()) {
        negotiationsFilled++;
      }
    });
    const negociationItems = [
      { id: 'opt', label: 'Section optionnelle (non exportée dans le PDF)', ok: true, info: true },
      { id: 'negociations_filled', label: `Négociations renseignées (${negotiationsFilled}/${nbCompanies})`, ok: false, info: true },
    ];
    const negociationDone = false;
    const negociationRatio = nbCompanies > 0 ? `${negotiationsFilled}/${nbCompanies}` : null;

    // ─── 6. Récap ───
    const recapItems = [
      { id: 'consultation_ok', label: 'Consultation', ok: consultationDone },
      { id: 'depouillement_ok', label: 'Dépouillement', ok: depouillementDone },
      { id: 'admin_ok', label: 'Administratif', ok: adminDone },
      { id: 'technique_ok', label: 'Technique', ok: techDone },
    ];
    const recapMissing = [];
    if (!consultationDone) recapMissing.push({ id: 'rcp_c', label: 'Compléter l\'onglet Consultation', anchorId: null, type: 'tab', goToTab: 'consultation' });
    if (!depouillementDone) recapMissing.push({ id: 'rcp_d', label: 'Compléter l\'onglet Dépouillement', anchorId: null, type: 'tab', goToTab: 'depouillement' });
    if (!adminDone) recapMissing.push({ id: 'rcp_a', label: 'Compléter l\'onglet Administratif', anchorId: null, type: 'tab', goToTab: 'admin' });
    if (!techDone) recapMissing.push({ id: 'rcp_t', label: 'Compléter l\'onglet Technique', anchorId: null, type: 'tab', goToTab: 'technique' });
    const recapDone = consultationDone && depouillementDone && adminDone && techDone;

    // ─── État par onglet ───
    const tabStates = {
      consultation:  { done: consultationDone,  items: consultationItems,  missing: consultationMissing, ratio: null },
      depouillement: { done: depouillementDone, items: depouillementItems, missing: depouillementMissing, ratio: null },
      admin:         { done: adminDone,         items: adminItems,         missing: adminMissing,         ratio: adminRatio },
      technique:     { done: techDone,          items: techItems,          missing: techMissing,          ratio: techRatio },
      negociation:   { done: negociationDone,   items: negociationItems,   missing: [],                   ratio: negociationRatio, optional: true },
      recap:         { done: recapDone,         items: recapItems,         missing: recapMissing,         ratio: null },
    };

    // ─── Avancement global ───
    const tabsForProgress = ['consultation', 'depouillement', 'admin', 'technique'];
    const completedTabs = tabsForProgress.filter(t => tabStates[t].done).length;
    const overallProgress = Math.round((completedTabs / tabsForProgress.length) * 100);

    return {
      tabStates,
      overallProgress,
      isReadyForExport: recapDone,
      preExportChecks: [
        { tab: 'consultation', label: 'Consultation', items: consultationItems },
        { tab: 'depouillement', label: 'Dépouillement', items: depouillementItems },
        { tab: 'admin', label: 'Administratif', items: adminItems },
        { tab: 'technique', label: 'Technique', items: techItems },
      ],
    };
  }, [rao, consultation, criteria, analysisCompanies, companiesData, scoringConfig]);
};

export default useRaoCompletion;
