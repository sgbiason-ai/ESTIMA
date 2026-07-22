// src/hooks/useRaoCompletion.js
// Hook centralisé : calcule l'état de complétion + items manquants détaillés
// par étape du RAO (workflow 9 étapes, deux phases avant/après négociation).
// Alimente le stepper, les badges, la checklist pré-export ET les banners
// d'alerte / marquages inline dans chaque onglet.

import { useMemo } from 'react';
import { NON_REGULAR_STATUSES } from '../components/rao/RaoConstants';
import { getEffectiveConclusion, getEffectiveTechnical, isRegularizedAfterNego, getCompanyRabaisPct, variantHasNego } from '../utils/analysisCompute';
import { isRichTextEmpty } from '../utils/richText';

export const useRaoCompletion = ({
  rao,
  consultation,
  criteria,
  analysisCompanies = [],
  companiesData = {},
  scoringConfig = null,
  // Négociation engagée : les étapes 7-9 comptent dans l'avancement + l'export.
  negoEngaged = false,
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

    // ─── 3. Administratif (phase initiale uniquement) ───
    const adminConcl = companyNames.filter(name => !!companiesData[name]?.admin?.conclusion).length;
    const adminItems = [
      { id: 'conclusions', label: `Conclusions admin (${adminConcl}/${nbCompanies})`, ok: adminConcl === nbCompanies && nbCompanies > 0, value: `${adminConcl}/${nbCompanies}` },
    ];
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
    const adminDone = nbCompanies > 0 && adminMissing.length === 0;
    const adminRatio = nbCompanies > 0 ? `${adminConcl}/${nbCompanies}` : null;

    // ─── Fabrique commune : complétion technique d'une phase ───
    // basis 'initial' → notes saisies (technical) ; basis 'nego' → notes
    // effectives (technicalNego surcharge l'initial champ par champ) — le
    // pré-remplissage par héritage compte donc comme rempli.
    const buildTechState = (basis) => {
      const regularCompanies = analysisCompanies.filter(c => {
        const concl = getEffectiveConclusion(companiesData[c.name]?.admin, basis);
        return !concl || !NON_REGULAR_STATUSES.includes(concl);
      });

      let totalTechSlots = 0, filledTechSlots = 0;
      let totalCommSlots = 0, filledCommSlots = 0;
      const missing = [];

      regularCompanies.forEach(c => {
        const tech = getEffectiveTechnical(companiesData[c.name], basis);
        techCs.forEach(crit => {
          const hasSubs = (crit.subCriteria || []).length > 0;
          const slots = hasSubs ? crit.subCriteria : [crit];
          slots.forEach(slot => {
            totalTechSlots++;
            totalCommSlots++;
            const slotLabel = hasSubs ? (slot.label || 'sous-critère') : crit.label;
            const noteFilled = Number(tech[slot.id]?.note || 0) > 0;
            const commFilled = !isRichTextEmpty(tech[slot.id]?.text);
            if (noteFilled) filledTechSlots++; else missing.push({
              id: `note_${c.name}_${slot.id}`,
              label: `Note ${slotLabel} manquante pour ${c.name}`,
              anchorId: `tech-note-${c.name}-${slot.id}`,
              companyName: c.name,
              type: 'note',
            });
            if (commFilled) filledCommSlots++; else missing.push({
              id: `comm_${c.name}_${slot.id}`,
              label: `Commentaire ${slotLabel} pour ${c.name}`,
              anchorId: `tech-comm-${c.name}-${slot.id}`,
              companyName: c.name,
              type: 'comment',
            });
          });
        });
      });

      const items = [
        { id: 'notes', label: `Notes techniques (${filledTechSlots}/${totalTechSlots})`, ok: totalTechSlots > 0 && filledTechSlots === totalTechSlots, warn: filledTechSlots < totalTechSlots, value: `${filledTechSlots}/${totalTechSlots}` },
        { id: 'comments', label: `Commentaires (${filledCommSlots}/${totalCommSlots})`, ok: totalCommSlots > 0 && filledCommSlots === totalCommSlots, warn: filledCommSlots < totalCommSlots, value: `${filledCommSlots}/${totalCommSlots}` },
      ];
      return { items, missing, totalTechSlots, filledTechSlots, totalCommSlots, filledCommSlots };
    };

    // ─── 4. Technique (phase initiale — entreprises régulières uniquement) ───
    const techState = buildTechState('initial');
    const techMissing = techState.missing;
    const techItems = techState.items;

    // Variantes retenues : justifications (phase initiale uniquement)
    let retainedVariants = 0, justifiedVariants = 0;
    analysisCompanies.forEach(c => {
      (c.variants || []).forEach((v, vi) => {
        if (v.retained) {
          retainedVariants++;
          if (!isRichTextEmpty(v.justification)) justifiedVariants++;
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
    if (retainedVariants > 0) {
      techItems.push({
        id: 'variants_justif',
        label: `Justification variantes retenues (${justifiedVariants}/${retainedVariants})`,
        ok: justifiedVariants === retainedVariants,
        warn: justifiedVariants < retainedVariants,
        value: `${justifiedVariants}/${retainedVariants}`,
      });
    }
    const techDone = techState.totalTechSlots > 0 && techMissing.length === 0;
    const techRatio = techState.totalTechSlots > 0 ? `${techState.filledTechSlots}/${techState.totalTechSlots}` : null;

    // ─── 5. Récap avant négo ───
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

    // ─── 6. Négociation (optionnel) ───
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

    // ─── 7. Dépouillement après négo (offres finales) ───
    // Une entreprise a « remis une offre finale » dès qu'elle porte des prix
    // négociés (import), un rabais commercial global, ou une variante renégociée.
    const negotiatedCompanies = analysisCompanies.filter(c =>
      (c.offersNego && Object.keys(c.offersNego).length > 0) ||
      getCompanyRabaisPct(c, 'nego') > 0 ||
      (c.variants || []).some(v => variantHasNego(v))
    );
    const nbNegotiated = negotiatedCompanies.length;
    const aeNegoFilled = analysisCompanies.filter(c => c.aeAmountNego != null && c.aeAmountNego !== '').length;
    const depouillementNegoItems = [
      { id: 'offres_nego', label: `Offres finales dépouillées (${nbNegotiated}/${nbCompanies})`, ok: nbCompanies > 0 && nbNegotiated > 0, warn: nbCompanies > 0 && nbNegotiated === 0, value: `${nbNegotiated}/${nbCompanies}` },
      { id: 'ae_nego', label: `Montants annoncés après négo (${aeNegoFilled}/${nbCompanies})`, ok: aeNegoFilled === nbCompanies && nbCompanies > 0, info: true },
    ];
    const depouillementNegoMissing = [];
    if (nbCompanies > 0 && nbNegotiated === 0) {
      depouillementNegoMissing.push({ id: 'no_nego_offers', label: 'Aucune offre finale dépouillée (import fichier, rabais global ou PV après négo)', anchorId: null, type: 'depouillement' });
    }
    const depouillementNegoDone = nbCompanies > 0 && nbNegotiated > 0;
    const depouillementNegoRatio = nbCompanies > 0 ? `${nbNegotiated}/${nbCompanies}` : null;

    // ─── 8. Administratif après négo ───
    // Pré-rempli par héritage : sans override, le statut initial vaut statut
    // effectif (getEffectiveConclusion). Exigence propre à la phase : un motif
    // de régularisation pour toute offre régularisée (CCP R2152-2).
    const adminNegoConcl = companyNames.filter(name => !!getEffectiveConclusion(companiesData[name]?.admin, 'nego')).length;
    const regularizedNames = companyNames.filter(name => isRegularizedAfterNego(companiesData[name]?.admin));
    const regCommentMissingNames = regularizedNames.filter(name => !(companiesData[name]?.admin?.regularizationComment || '').trim());
    const adminNegoItems = [
      { id: 'conclusions_nego', label: `Statuts après négo (${adminNegoConcl}/${nbCompanies})`, ok: adminNegoConcl === nbCompanies && nbCompanies > 0, value: `${adminNegoConcl}/${nbCompanies}` },
    ];
    if (regularizedNames.length > 0) {
      const motived = regularizedNames.length - regCommentMissingNames.length;
      adminNegoItems.push({
        id: 'regularization_comments',
        label: `Motifs de régularisation (${motived}/${regularizedNames.length})`,
        ok: regCommentMissingNames.length === 0,
        warn: regCommentMissingNames.length > 0,
        value: `${motived}/${regularizedNames.length}`,
      });
    }
    const adminNegoMissing = [];
    companyNames.forEach(name => {
      if (!getEffectiveConclusion(companiesData[name]?.admin, 'nego')) {
        adminNegoMissing.push({
          id: `concl_nego_${name}`,
          label: `Statut après négo pour ${name}`,
          anchorId: `admin-concl-nego-${name}`,
          companyName: name,
          type: 'admin_conclusion',
        });
      }
    });
    regCommentMissingNames.forEach(name => {
      adminNegoMissing.push({
        id: `reg_comment_${name}`,
        label: `Motif de régularisation après négo pour ${name}`,
        anchorId: `admin-reg-comment-${name}`,
        companyName: name,
        type: 'admin_regularization_comment',
      });
    });
    const adminNegoDone = nbCompanies > 0 && adminNegoMissing.length === 0;
    const adminNegoRatio = nbCompanies > 0 ? `${adminNegoConcl}/${nbCompanies}` : null;

    // ─── 9. Technique après négo (notes effectives — héritage compris) ───
    const techNegoState = buildTechState('nego');
    const techNegoDone = techNegoState.totalTechSlots > 0 && techNegoState.missing.length === 0;
    const techNegoRatio = techNegoState.totalTechSlots > 0 ? `${techNegoState.filledTechSlots}/${techNegoState.totalTechSlots}` : null;

    // ─── 10. Récap après négo ───
    const recapNegoItems = [
      { id: 'recap_avant_ok', label: 'Phase avant négo complète', ok: recapDone },
      { id: 'depouillement_nego_ok', label: 'Dépouillement après négo', ok: depouillementNegoDone },
      { id: 'admin_nego_ok', label: 'Administratif après négo', ok: adminNegoDone },
      { id: 'technique_nego_ok', label: 'Technique après négo', ok: techNegoDone },
    ];
    const recapNegoMissing = [];
    if (!recapDone) recapNegoMissing.push({ id: 'rcpn_avant', label: 'Compléter la phase avant négo (étapes 1-5)', anchorId: null, type: 'tab', goToTab: 'recap' });
    if (!depouillementNegoDone) recapNegoMissing.push({ id: 'rcpn_d', label: 'Compléter le Dépouillement après négo', anchorId: null, type: 'tab', goToTab: 'depouillementNego' });
    if (!adminNegoDone) recapNegoMissing.push({ id: 'rcpn_a', label: 'Compléter l\'Administratif après négo', anchorId: null, type: 'tab', goToTab: 'adminNego' });
    if (!techNegoDone) recapNegoMissing.push({ id: 'rcpn_t', label: 'Compléter la Technique après négo', anchorId: null, type: 'tab', goToTab: 'techniqueNego' });
    const recapNegoDone = recapDone && depouillementNegoDone && adminNegoDone && techNegoDone;

    // ─── État par étape ───
    const tabStates = {
      consultation:  { done: consultationDone,  items: consultationItems,  missing: consultationMissing, ratio: null },
      depouillement: { done: depouillementDone, items: depouillementItems, missing: depouillementMissing, ratio: null },
      admin:         { done: adminDone,         items: adminItems,         missing: adminMissing,         ratio: adminRatio },
      technique:     { done: techDone,          items: techItems,          missing: techMissing,          ratio: techRatio },
      recap:         { done: recapDone,         items: recapItems,         missing: recapMissing,         ratio: null },
      negociation:   { done: negociationDone,   items: negociationItems,   missing: [],                   ratio: negociationRatio, optional: true },
      depouillementNego: { done: depouillementNegoDone, items: depouillementNegoItems, missing: depouillementNegoMissing, ratio: depouillementNegoRatio },
      adminNego:     { done: adminNegoDone,     items: adminNegoItems,     missing: adminNegoMissing,     ratio: adminNegoRatio },
      techniqueNego: { done: techNegoDone,      items: techNegoState.items, missing: techNegoState.missing, ratio: techNegoRatio },
      recapNego:     { done: recapNegoDone,     items: recapNegoItems,     missing: recapNegoMissing,     ratio: null },
    };

    // ─── Avancement global ───
    // Sans négo engagée : les 4 étapes de fond de la phase initiale.
    // Négo engagée : les étapes après-négo comptent aussi (7 étapes de fond).
    const tabsForProgress = negoEngaged
      ? ['consultation', 'depouillement', 'admin', 'technique', 'depouillementNego', 'adminNego', 'techniqueNego']
      : ['consultation', 'depouillement', 'admin', 'technique'];
    const completedTabs = tabsForProgress.filter(t => tabStates[t].done).length;
    const overallProgress = Math.round((completedTabs / tabsForProgress.length) * 100);

    // ─── Checklist pré-export ───
    const preExportChecks = [
      { tab: 'consultation', label: 'Consultation', items: consultationItems, missing: consultationMissing },
      { tab: 'depouillement', label: 'Dépouillement', items: depouillementItems, missing: depouillementMissing },
      { tab: 'admin', label: 'Administratif', items: adminItems, missing: adminMissing },
      { tab: 'technique', label: 'Technique', items: techItems, missing: techMissing },
    ];
    if (negoEngaged) {
      preExportChecks.push(
        { tab: 'adminNego', label: 'Administratif après négo', items: adminNegoItems, missing: adminNegoMissing },
        { tab: 'techniqueNego', label: 'Technique après négo', items: techNegoState.items, missing: techNegoState.missing },
      );
    }

    return {
      tabStates,
      overallProgress,
      isReadyForExport: negoEngaged ? recapNegoDone : recapDone,
      preExportChecks,
    };
  }, [rao, consultation, criteria, analysisCompanies, companiesData, scoringConfig, negoEngaged]);
};

export default useRaoCompletion;
