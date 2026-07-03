// src/components/rao/tabs/TabDepouillement.jsx
//
// Onglet "Dépouillement" — hub d'actions par entreprise après l'ouverture des plis.
// Workflow guidé :
//   ① Dépouillement (modale) → MAJ entreprises + régime variantes
//   ② Import offre par entreprise (bouton "Importer" sur la carte)
//   ③ Import variante (bouton sur la sous-ligne variante)
//   ④ Analyse technique (lien vers l'onglet Technique avec entreprise pré-sélectionnée)

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  ScrollText, Calendar, GitBranch, Building2, FileSpreadsheet, Brain,
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Plus, ChevronRight, FileText, Handshake
} from 'lucide-react';
import { getVariantEffectiveTotal, variantHasNego, getCompanyRabaisPct, getEffectiveConclusion } from '../../../utils/analysisCompute';

const REGIME_LABELS = {
  forbidden: 'Variantes interdites',
  allowed:   'Variantes autorisées',
  mandatory: 'Variantes obligatoires',
};
const REGIME_STYLES = {
  forbidden: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    icon: 'text-red-500' },
  allowed:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   icon: 'text-blue-500' },
  mandatory: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  icon: 'text-amber-500' },
};

const fmtEUR = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

// Nombre formaté FR avec séparateur de milliers, sans symbole € (pour les champs de saisie au repos)
const fmtNumber = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Taux de TVA appliqué pour déduire le TTC à partir du montant AE saisi (HT)
const TVA_RATE = 0.20;

// Parse une saisie utilisateur "1 234,56 €" → 1234.56 (ou null si vide/invalide)
const parseAmount = (v) => {
  if (v === '' || v == null) return null;
  const cleaned = String(v).replace(/[\s€]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return '—'; }
};

export default function TabDepouillement({
  consultation = {},
  analysisCompanies = [],
  onReopenDepouillement,
  onUpdateAeAmount,        // (companyId, value:number|null) → void — édition inline AE entreprise
  onUpdateVariantAeAmount, // (companyId, variantId, value:number|null) → void — édition inline AE variante
  onImportOffer,     // (companyName, file) → Promise
  onImportPdfOffer,  // (companyName, file) → Promise — fichier PDF
  onImportVariant,   // (companyId, file, { label }) → Promise
  onGoToTechnique,   // (companyName) → void
  onGoToAdmin,       // (companyName) → void
  // Pour calculer si l'analyse admin/tech est complète par entreprise
  companiesData = {},
  criteria = [],
  // ─── Phase après négociation (dépouillement des offres finales) ───
  negoActive = false,            // phase de notation active (scoringConfig.basis)
  onSetNegoPhase = null,         // (bool) → bascule Offres initiales / Après négo
  negoRows = null,               // lignes du comparatif (RaoView.negoComparison) — totaux nets
  onOpenDepouillementNego = null,// ouvre la modale PV après négo
  onUpdateAeAmountNego = null,   // (companyId, value) → montant annoncé après négo
  onUpdateVariantAeAmountNego = null, // (companyId, variantId, value)
  onImportNegoOffer = null,      // (row, file) → import offre/variante négociée
}) {
  const regime = consultation.variantsAllowed || 'forbidden';
  const regimeStyle = REGIME_STYLES[regime] || REGIME_STYLES.forbidden;

  // Lookup des lignes du comparatif : base → c.id, variante → `${c.id}_${v.id}`
  const negoRowById = useMemo(
    () => new Map((negoRows || []).map(r => [r.id, r])),
    [negoRows]
  );

  // Inputs cachés pour les imports
  const offerFileRefs = useRef({});         // { companyId: HTMLInputElement } — Excel offre
  const pdfFileRefs = useRef({});           // { companyId: HTMLInputElement } — PDF offre
  const variantXlsxRefs = useRef({});       // { variantKey: HTMLInputElement } — Excel variante
  const variantPdfRefs = useRef({});        // { variantKey: HTMLInputElement } — PDF variante
  const [pendingVariantCtx, setPendingVariantCtx] = useState({}); // { variantKey: { companyId, label } }

  const triggerOfferFile = (companyId) => offerFileRefs.current[companyId]?.click();
  const triggerPdfFile = (companyId) => pdfFileRefs.current[companyId]?.click();
  const triggerVariantXlsx = (companyId, variantId, label) => {
    const key = `${companyId}_${variantId}`;
    setPendingVariantCtx(prev => ({ ...prev, [key]: { companyId, variantId, label } }));
    variantXlsxRefs.current[key]?.click();
  };
  const triggerVariantPdf = (companyId, variantId, label) => {
    const key = `${companyId}_${variantId}`;
    setPendingVariantCtx(prev => ({ ...prev, [key]: { companyId, variantId, label } }));
    variantPdfRefs.current[key]?.click();
  };

  // En phase après négo, les mêmes boutons d'import alimentent les prix NÉGOCIÉS
  // (offersNego / variante.offersNego) via onImportNegoOffer — sinon flux initial.
  const handleOfferChange = async (company, e) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = null; return; }
    if (negoActive && onImportNegoOffer) {
      await onImportNegoOffer({ kind: 'base', companyId: company.id, name: company.name }, file);
    } else if (onImportOffer) {
      await onImportOffer(company.name, file);
    }
    e.target.value = null;
  };

  const handlePdfChange = async (company, e) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = null; return; }
    if (negoActive && onImportNegoOffer) {
      await onImportNegoOffer({ kind: 'base', companyId: company.id, name: company.name }, file);
    } else if (onImportPdfOffer) {
      await onImportPdfOffer(company.name, file);
    }
    e.target.value = null;
  };

  const handleVariantChange = async (key, e) => {
    const file = e.target.files?.[0];
    const ctx = pendingVariantCtx[key];
    if (!file || !ctx) { e.target.value = null; return; }
    if (negoActive && onImportNegoOffer) {
      await onImportNegoOffer({ kind: 'variant', companyId: ctx.companyId, variantId: ctx.variantId, name: ctx.label }, file);
    } else if (onImportVariant) {
      await onImportVariant(ctx.companyId, file, { label: ctx.label });
    }
    e.target.value = null;
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ─── Synthèse de la consultation ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <header className={`flex items-center gap-3 px-5 py-3 border-b border-slate-200/70 ${negoActive ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-indigo-50 to-blue-50'}`}>
            <div className={`p-2 rounded-xl ${negoActive ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
              {negoActive
                ? <Handshake size={18} className="text-emerald-700" />
                : <ScrollText size={18} className="text-indigo-700" />}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-slate-800">
                {negoActive ? 'Dépouillement après négociation' : 'Synthèse du dépouillement'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {negoActive
                  ? 'Offres finales — la notation porte sur les montants après négociation (rabais déduit)'
                  : 'Ouverture des plis et régime applicable aux variantes (CCP)'}
              </p>
            </div>

            {/* Bascule de phase — pilote scoringConfig.basis (tableau, notation, exports) */}
            {onSetNegoPhase && (
              <div className="flex bg-gray-100 p-0.5 rounded-xl shrink-0" title="Phase d'analyse : la notation du RAO suit la phase sélectionnée">
                <button
                  onClick={() => onSetNegoPhase(false)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${!negoActive ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Offres initiales
                </button>
                <button
                  onClick={() => onSetNegoPhase(true)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${negoActive ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Après négo
                </button>
              </div>
            )}

            {negoActive && onOpenDepouillementNego ? (
              <button
                onClick={onOpenDepouillementNego}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-bold shadow-sm transition-all"
                title="Saisir les montants annoncés des offres finales (PV après négociation)"
              >
                <Handshake size={12} />
                PV après négo
              </button>
            ) : onReopenDepouillement && (
              <button
                onClick={onReopenDepouillement}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold shadow-sm transition-all"
              >
                <RefreshCw size={12} />
                Refaire le dépouillement
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5">
            <InfoTile
              icon={<Calendar size={14} />}
              label="Date d'ouverture des plis"
              value={fmtDate(consultation.dateOuverturePLis || consultation.dateRemise)}
            />
            <InfoTile
              icon={<GitBranch size={14} className={regimeStyle.icon} />}
              label="Régime des variantes"
              value={REGIME_LABELS[regime]}
              valueClass={regimeStyle.text}
              bg={regimeStyle.bg}
              border={regimeStyle.border}
            />
            <InfoTile
              icon={<Building2 size={14} />}
              label="Entreprises soumissionnaires"
              value={`${analysisCompanies.length} entreprise${analysisCompanies.length > 1 ? 's' : ''}`}
            />
          </div>

          {regime !== 'forbidden' && consultation.variantsRequirements && (
            <div className="px-5 pb-4">
              <div className="px-4 py-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1">
                  Exigences minimales des variantes
                </div>
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {consultation.variantsRequirements}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Liste des entreprises ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
              Entreprises et progression
            </h3>
            <span className="text-[11px] text-slate-400">
              {negoActive
                ? '① Import offre négociée · ② Import variantes négociées · ③ Analyse technique'
                : '① Import offre · ② Import variantes · ③ Analyse technique'}
            </span>
          </div>

          {analysisCompanies.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <Building2 size={32} className="text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-slate-500 mb-3">
                Aucune entreprise saisie pour le moment.
              </p>
              {onReopenDepouillement && (
                <button
                  onClick={onReopenDepouillement}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all"
                >
                  <Plus size={14} />
                  Démarrer le dépouillement
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {analysisCompanies.map((c, idx) => {
                // ─── Complétion admin/technique de cette entreprise ───
                const admin = companiesData[c.name]?.admin || {};
                const tech = companiesData[c.name]?.technical || {};
                const adminDone = !!admin.conclusion;

                // Technique : toutes les notes critères/sous-critères saisies
                const techCs = criteria.filter(cr => !cr.auto);
                let totalSlots = 0, filledSlots = 0;
                techCs.forEach(crit => {
                  const subs = crit.subCriteria || [];
                  if (subs.length > 0) {
                    subs.forEach(sc => {
                      totalSlots++;
                      if (Number(tech[sc.id]?.note || 0) > 0) filledSlots++;
                    });
                  } else {
                    totalSlots++;
                    if (Number(tech[crit.id]?.note || 0) > 0) filledSlots++;
                  }
                });
                // Variantes retenues : justification requise
                let retainedVar = 0, justifiedVar = 0;
                (c.variants || []).forEach(v => {
                  if (v.retained) {
                    retainedVar++;
                    if ((v.justification || '').trim()) justifiedVar++;
                  }
                });
                const techDone = totalSlots > 0
                  && filledSlots === totalSlots
                  && (retainedVar === 0 || justifiedVar === retainedVar);
                const techRatio = totalSlots > 0 ? `${filledSlots}/${totalSlots}` : null;

                return (
                  <CompanyProgressCard
                    key={c.id}
                    company={c}
                    index={idx + 1}
                    regime={regime}
                    onImportOffer={() => triggerOfferFile(c.id)}
                    onImportPdf={onImportPdfOffer ? () => triggerPdfFile(c.id) : null}
                    onImportVariantXlsx={(variantId, label) => triggerVariantXlsx(c.id, variantId, label)}
                    onImportVariantPdf={(variantId, label) => triggerVariantPdf(c.id, variantId, label)}
                    onUpdateAe={onUpdateAeAmount ? (value) => onUpdateAeAmount(c.id, value) : null}
                    onUpdateVariantAe={onUpdateVariantAeAmount ? (variantId, value) => onUpdateVariantAeAmount(c.id, variantId, value) : null}
                    onGoToTechnique={() => onGoToTechnique?.(c.name)}
                    onGoToAdmin={() => onGoToAdmin?.(c.name)}
                    adminDone={adminDone}
                    adminConclusion={getEffectiveConclusion(admin, negoActive ? 'nego' : 'initial')}
                    techDone={techDone}
                    techRatio={techRatio}
                    negoActive={negoActive}
                    negoRowBase={negoRowById.get(c.id) || null}
                    onUpdateAeNego={onUpdateAeAmountNego ? (value) => onUpdateAeAmountNego(c.id, value) : null}
                    onUpdateVariantAeNego={onUpdateVariantAeAmountNego ? (variantId, value) => onUpdateVariantAeAmountNego(c.id, variantId, value) : null}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Inputs cachés pour les imports */}
        {analysisCompanies.map(c => {
          const variantInputs = (c.variants || []).flatMap(v => {
            const key = `${c.id}_${v.id}`;
            return [
              <input
                key={`${key}_xlsx`}
                ref={(el) => { variantXlsxRefs.current[key] = el; }}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleVariantChange(key, e)}
              />,
              <input
                key={`${key}_pdf`}
                ref={(el) => { variantPdfRefs.current[key] = el; }}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleVariantChange(key, e)}
              />,
            ];
          });
          return (
            <React.Fragment key={`inputs_${c.id}`}>
              <input
                ref={(el) => { offerFileRefs.current[c.id] = el; }}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleOfferChange(c, e)}
              />
              <input
                ref={(el) => { pdfFileRefs.current[c.id] = el; }}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handlePdfChange(c, e)}
              />
              {variantInputs}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tuile d'info simple ────────────────────────────────────────────────────
function InfoTile({ icon, label, value, valueClass = 'text-slate-900', bg = 'bg-slate-50', border = 'border-slate-200' }) {
  return (
    <div className={`px-4 py-3 ${bg} border ${border} rounded-xl`}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-sm font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

// ─── Carte de progression par entreprise ───────────────────────────────────
function CompanyProgressCard({
  company, index, regime,
  onImportOffer, onImportPdf, onImportVariantXlsx, onImportVariantPdf,
  onUpdateAe, onUpdateVariantAe,
  onGoToTechnique, onGoToAdmin,
  adminDone = false, adminConclusion = null,
  techDone = false, techRatio = null,
  // ─── Phase après négociation ───
  negoActive = false,
  negoRowBase = null,        // ligne comparatif (RaoView.negoComparison) — base uniquement, totaux qté-exacts
  onUpdateAeNego = null,     // (value) → montant annoncé après négo (entreprise)
  onUpdateVariantAeNego = null, // (variantId, value) → montant annoncé après négo (variante)
}) {
  // Label pour la conclusion admin
  const CONCL_LABELS = {
    reguliere: 'Régulière',
    irreguliere: 'Irrégulière',
    inacceptable: 'Inacceptable',
    inappropriee: 'Inappropriée',
  };
  const adminConclLabel = adminConclusion ? CONCL_LABELS[adminConclusion] || adminConclusion : null;
  const offerImported = company.offers && Object.keys(company.offers).length > 0;
  const hasAeMismatch = !!company.amountMismatch;
  const hasQtyMismatch = (company.quantityMismatches || []).length > 0;
  const variants = company.variants || [];

  // Rabais commercial global de l'entreprise (phase négo) — s'applique base + variantes
  const rabaisPct = negoActive ? getCompanyRabaisPct(company, 'nego') : 0;
  const offerNegoImported = !!(company.offersNego && Object.keys(company.offersNego).length > 0);

  const offerStatus = negoActive
    ? ((offerNegoImported || rabaisPct > 0) ? 'done' : 'todo')
    : (offerImported ? 'done' : 'todo');
  const offerStatusLabel = offerImported
    ? `Importée — ${fmtEUR(company.computedTotal || 0)}`
    : (company.aeAmount != null ? `Annoncée : ${fmtEUR(company.aeAmount)}` : 'À importer');

  // Régime "interdites" + variantes déposées = anomalie
  const illegalVariants = regime === 'forbidden' && variants.length > 0;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header entreprise */}
      <header className="flex items-center gap-3 px-5 py-3 bg-slate-50/70 border-b border-slate-200/70">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center font-black text-indigo-700 text-sm shrink-0">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-extrabold text-slate-900 truncate">{company.name}</h4>
          {variants.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
              <span className="text-purple-600">{variants.length} variante{variants.length > 1 ? 's' : ''} annoncée{variants.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        {hasAeMismatch && (
          <span title={`Écart AE : ${fmtEUR(company.amountMismatch.delta)} (${company.amountMismatch.deltaPct}%)`}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-200">
            <AlertTriangle size={10} />
            Écart AE
          </span>
        )}
        {hasQtyMismatch && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
            <AlertTriangle size={10} />
            Qté ≠ DQE
          </span>
        )}
      </header>

      <div className="p-4 space-y-2.5">
        {/* ① Offre de base — boutons d'import regroupés dans un fieldset "Importer" */}
        <StepRow
          stepNumber="①"
          icon={<FileSpreadsheet size={14} />}
          label="Offre de base"
          status={offerStatus}
          statusLabel={offerStatusLabel}
          statusContent={
            <AeStatus
              ae={company.aeAmount}
              onUpdateAe={onUpdateAe}
              importedLabel={offerImported ? `Importée — ${fmtEUR(company.computedTotal || 0)}` : null}
              nego={negoActive ? {
                initialTotal: negoRowBase?.initialTotal ?? (company.computedTotal ?? company.aeAmount ?? 0),
                total: negoRowBase?.negoTotal ?? null,
                totalBrut: negoRowBase?.negoTotalBrut ?? null,
                rabaisPct,
                imported: offerNegoImported,
                aeNego: company.aeAmountNego ?? null,
                importFile: company.negoImportFile || null,
                importAt: company.negoImportAt || null,
              } : null}
              onUpdateAeNego={onUpdateAeNego}
            />
          }
          actionLabel="Excel"
          actionIcon={<FileSpreadsheet size={12} />}
          actionAccent="green"
          onAction={onImportOffer}
          extraAction={onImportPdf ? {
            icon: <FileText size={12} />,
            label: 'PDF',
            onClick: onImportPdf,
            accent: 'red',
            title: 'Importer une offre depuis un PDF (extraction automatique du tableau)',
          } : null}
          buttonsGroupLabel={negoActive ? 'Négo' : 'Importer'}
        />

        {/* ② Variantes */}
        {regime !== 'forbidden' && variants.length > 0 && (
          <div className="ml-7 space-y-1.5">
            {variants.map((v, vi) => {
              const imported = (v.offers && Object.keys(v.offers).length > 0) || (v.newItems || []).length > 0;
              const variantNegoImported = negoActive && variantHasNego(v);
              const variantStatus = negoActive
                ? ((variantNegoImported || rabaisPct > 0) ? 'done' : 'todo')
                : (imported ? 'done' : 'todo');
              return (
                <StepRow
                  key={v.id}
                  stepNumber={`V${vi + 1}`}
                  icon={<GitBranch size={14} className="text-purple-600" />}
                  label={v.label || `Variante ${vi + 1}`}
                  status={variantStatus}
                  statusContent={
                    <AeStatus
                      ae={v.aeAmount}
                      accent="purple"
                      onUpdateAe={onUpdateVariantAe ? (value) => onUpdateVariantAe(v.id, value) : null}
                      importedLabel={imported ? `Importée — ${fmtEUR(v.total || 0)}` : null}
                      nego={negoActive ? {
                        initialTotal: v.aeAmount ?? v.total ?? 0,
                        total: getVariantEffectiveTotal(company, v, 'nego'),
                        totalBrut: Number(v.totalNego ?? v.total ?? 0),
                        rabaisPct,
                        imported: variantNegoImported,
                        aeNego: v.aeAmountNego ?? null,
                        importFile: v.negoImportFile || null,
                        importAt: v.negoImportAt || null,
                      } : null}
                      onUpdateAeNego={onUpdateVariantAeNego ? (value) => onUpdateVariantAeNego(v.id, value) : null}
                    />
                  }
                  actionLabel="Excel"
                  actionIcon={<FileSpreadsheet size={12} />}
                  actionAccent="green"
                  onAction={() => onImportVariantXlsx(v.id, v.label)}
                  extraAction={onImportVariantPdf ? {
                    icon: <FileText size={12} />,
                    label: 'PDF',
                    onClick: () => onImportVariantPdf(v.id, v.label),
                    accent: 'red',
                    title: 'Importer la variante depuis un PDF',
                  } : null}
                  buttonsGroupLabel={negoActive ? 'Négo' : 'Importer'}
                  isVariant
                />
              );
            })}
          </div>
        )}

        {/* Alerte variantes non autorisées */}
        {illegalVariants && (
          <div className="ml-7 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
            <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              Variantes interdites par la consultation mais {variants.length} déposée(s) — offre à classer
              irrégulière (L2152-2).
            </div>
          </div>
        )}

        {/* ③ Analyse admin/technique — statut réel basé sur completion */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <StepRow
            stepNumber="③"
            icon={<ScrollText size={14} />}
            label="Analyse administrative"
            status={!offerImported ? 'disabled' : (adminDone ? 'done' : 'todo')}
            statusLabel={
              !offerImported
                ? 'Importer l\'offre d\'abord'
                : adminDone
                  ? `Complétée — ${adminConclLabel}`
                  : 'À compléter'
            }
            actionLabel="Ouvrir Admin"
            actionAccent="neutral"
            onAction={onGoToAdmin}
            disabled={!offerImported}
          />
          <StepRow
            stepNumber="④"
            icon={<Brain size={14} />}
            label="Analyse technique"
            status={!offerImported ? 'disabled' : (techDone ? 'done' : 'todo')}
            statusLabel={
              !offerImported
                ? 'Importer l\'offre d\'abord'
                : techDone
                  ? 'Complétée'
                  : techRatio ? `À compléter — ${techRatio}` : 'À compléter'
            }
            actionLabel="Ouvrir Technique"
            actionAccent="neutral"
            onAction={onGoToTechnique}
            disabled={!offerImported}
          />
        </div>
      </div>
    </article>
  );
}

// ─── Ligne d'étape avec status + action ────────────────────────────────────
function StepRow({ stepNumber, icon, label, status, statusLabel, statusContent = null, actionLabel, actionIcon = null, actionAccent = 'primary', onAction, disabled, isVariant, extraAction = null, buttonsGroupLabel = null }) {
  const statusIcon = status === 'done'
    ? <CheckCircle2 size={14} className="text-emerald-500" />
    : status === 'disabled'
      ? <Clock size={14} className="text-slate-300" />
      : <Clock size={14} className="text-amber-500" />;

  const accentCls = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    purple:  'bg-purple-600 hover:bg-purple-700 text-white',
    red:     'bg-red-600 hover:bg-red-700 text-white',
    green:   'bg-emerald-600 hover:bg-emerald-700 text-white',
    neutral: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
  };
  const mainAccent = accentCls[actionAccent] || accentCls.primary;
  const extraAccent = extraAction ? (accentCls[extraAction.accent] || accentCls.red) : '';

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isVariant ? 'bg-purple-50/40 border border-purple-100' : 'bg-slate-50/50 border border-slate-100'}`}>
      {!isVariant && (
        <span className="font-black text-slate-400 text-[11px] w-5 text-center">{stepNumber}</span>
      )}
      {isVariant && (
        <span className="font-black text-purple-600 text-[10px] w-5 text-center">{stepNumber}</span>
      )}
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 truncate">{label}</span>
          {statusIcon}
        </div>
        {statusContent ? (
          <div className="mt-1">{statusContent}</div>
        ) : (
          <div className={`text-[11px] mt-0.5 ${status === 'done' ? 'text-emerald-600' : status === 'disabled' ? 'text-slate-400' : 'text-amber-600'}`}>
            {statusLabel}
          </div>
        )}
      </div>
      {/* Boutons d'action — wrappés dans un fieldset si label de groupe fourni */}
      {buttonsGroupLabel ? (
        <fieldset className="shrink-0 border border-slate-300 rounded-lg px-2 pt-0.5 pb-1">
          <legend className="px-1 text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">
            {buttonsGroupLabel}
          </legend>
          <div className="flex items-center gap-1.5">
            {extraAction && (
              <button
                onClick={extraAction.onClick}
                disabled={disabled}
                title={extraAction.title}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${extraAccent} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {extraAction.icon}
                {extraAction.label}
              </button>
            )}
            <button
              onClick={onAction}
              disabled={disabled}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mainAccent} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              {actionIcon}
              {actionLabel}
              {!actionIcon && <ChevronRight size={11} />}
            </button>
          </div>
        </fieldset>
      ) : (
        <div className="shrink-0 flex items-center gap-1.5">
          {extraAction && (
            <button
              onClick={extraAction.onClick}
              disabled={disabled}
              title={extraAction.title}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${extraAccent} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              {extraAction.icon}
              {extraAction.label}
            </button>
          )}
          <button
            onClick={onAction}
            disabled={disabled}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mainAccent} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            {actionIcon}
            {actionLabel}
            {!actionIcon && <ChevronRight size={11} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Zone "statut" de l'offre/variante : libellé "Montant AE" + champ éditable ─
// nego : { initialTotal, total, totalBrut, rabaisPct, imported, aeNego, importFile, importAt } | null
//   Fourni uniquement en phase après négo — bascule tout l'affichage sur le PV négo
//   (montant annoncé après négo éditable + total recalculé net de rabais).
function AeStatus({ ae, onUpdateAe, importedLabel, accent = 'slate', nego = null, onUpdateAeNego = null }) {
  if (nego) {
    const showNegoTotal = nego.imported || nego.rabaisPct > 0;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400" title="Montant de l'offre initiale (dépouillement)">
            Initial
          </span>
          <span className="font-mono text-[11px] text-slate-500">{fmtEUR(nego.initialTotal)}</span>
          <span className="text-slate-300">→</span>
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Après négo (HT)</span>
          {onUpdateAeNego ? (
            <AeAmountInput value={nego.aeNego} onCommit={onUpdateAeNego} accent="emerald" />
          ) : (
            <span className="font-mono text-[11px] text-slate-700">{nego.aeNego != null ? fmtEUR(nego.aeNego) : '—'}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {showNegoTotal ? (
            <span
              className="font-semibold text-emerald-600"
              title={nego.rabaisPct > 0 && nego.totalBrut != null ? `Total brut (avant rabais) : ${fmtEUR(nego.totalBrut)}` : undefined}
            >
              Négocié — {fmtEUR(nego.total)}{nego.rabaisPct > 0 ? ` (net, rabais −${nego.rabaisPct}%)` : ''}
            </span>
          ) : (
            <span className="text-slate-400 italic">Offre initiale reprise (aucun prix renégocié)</span>
          )}
          {nego.importFile && (
            <span className="text-slate-400" title={nego.importAt ? new Date(nego.importAt).toLocaleString('fr-FR') : ''}>
              ⇡ {nego.importFile}
            </span>
          )}
        </div>
      </div>
    );
  }

  const ttc = (ae != null && Number.isFinite(Number(ae))) ? Number(ae) * (1 + TVA_RATE) : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Montant AE (HT)</span>
      {onUpdateAe ? (
        <AeAmountInput value={ae} onCommit={onUpdateAe} accent={accent} />
      ) : (
        <span className="font-mono text-[11px] text-slate-700">{ae != null ? fmtEUR(ae) : '—'}</span>
      )}
      {ttc != null && (
        <span className="text-[11px] text-slate-500">
          TTC (TVA&nbsp;20&nbsp;%)&nbsp;: <strong className="font-mono text-slate-700">{fmtEUR(ttc)}</strong>
        </span>
      )}
      {importedLabel && (
        <span className="text-[11px] font-semibold text-emerald-600">· {importedLabel}</span>
      )}
    </div>
  );
}

// ─── Champ AE éditable inline (string locale → commit nombre parsé) ───────────
function AeAmountInput({ value, onCommit, accent = 'slate' }) {
  // Au repos : nombre formaté avec séparateur de milliers (« 1 234 567,89 »)
  const fmtRest = (v) => fmtNumber(v);
  // En saisie : valeur brute éditable, virgule décimale, sans séparateur (« 1234567,89 »)
  const fmtEdit = (v) => (v == null ? '' : String(v).replace('.', ','));

  const [draft, setDraft] = useState(fmtRest(value));
  const [focused, setFocused] = useState(false);

  // Resync depuis le prop hors focus (ex. import Excel qui ajuste l'AE)
  useEffect(() => {
    if (!focused) setDraft(fmtRest(value));
  }, [value, focused]);

  const commit = () => {
    const parsed = parseAmount(draft);
    setDraft(fmtRest(parsed));
    onCommit(parsed);
  };

  const accentCls = accent === 'purple'
    ? 'border-purple-200 focus:border-purple-400 focus:ring-purple-100'
    : accent === 'emerald'
      ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
      : 'border-slate-300 focus:border-indigo-400 focus:ring-indigo-100';

  return (
    <div className="relative inline-flex items-center">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => { setFocused(true); setDraft(fmtEdit(value)); }}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          else if (e.key === 'Escape') { setDraft(fmtRest(value)); e.currentTarget.blur(); }
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder="0,00"
        inputMode="decimal"
        className={`w-36 pl-2.5 pr-5 py-1 text-xs text-right font-mono tabular-nums text-slate-900 bg-white border rounded-lg focus:outline-none focus:ring-2 transition-all ${accentCls}`}
      />
      <span className="absolute right-2 text-[11px] text-slate-400 pointer-events-none">€</span>
    </div>
  );
}
