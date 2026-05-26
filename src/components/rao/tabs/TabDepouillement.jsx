// src/components/rao/tabs/TabDepouillement.jsx
//
// Onglet "Dépouillement" — hub d'actions par entreprise après l'ouverture des plis.
// Workflow guidé :
//   ① Dépouillement (modale) → MAJ entreprises + régime variantes
//   ② Import offre par entreprise (bouton "Importer" sur la carte)
//   ③ Import variante (bouton sur la sous-ligne variante)
//   ④ Analyse technique (lien vers l'onglet Technique avec entreprise pré-sélectionnée)

import React, { useRef, useState } from 'react';
import {
  ScrollText, Calendar, GitBranch, Building2, FileSpreadsheet, Brain,
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Plus, ChevronRight, FileText
} from 'lucide-react';

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

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return '—'; }
};

export default function TabDepouillement({
  consultation = {},
  analysisCompanies = [],
  onReopenDepouillement,
  onImportOffer,     // (companyName, file) → Promise
  onImportPdfOffer,  // (companyName, file) → Promise — fichier PDF
  onImportVariant,   // (companyId, file, { label }) → Promise
  onGoToTechnique,   // (companyName) → void
  onGoToAdmin,       // (companyName) → void
  // Pour calculer si l'analyse admin/tech est complète par entreprise
  companiesData = {},
  criteria = [],
}) {
  const regime = consultation.variantsAllowed || 'forbidden';
  const regimeStyle = REGIME_STYLES[regime] || REGIME_STYLES.forbidden;

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
    setPendingVariantCtx(prev => ({ ...prev, [key]: { companyId, label } }));
    variantXlsxRefs.current[key]?.click();
  };
  const triggerVariantPdf = (companyId, variantId, label) => {
    const key = `${companyId}_${variantId}`;
    setPendingVariantCtx(prev => ({ ...prev, [key]: { companyId, label } }));
    variantPdfRefs.current[key]?.click();
  };

  const handleOfferChange = async (companyName, e) => {
    const file = e.target.files?.[0];
    if (!file || !onImportOffer) { e.target.value = null; return; }
    await onImportOffer(companyName, file);
    e.target.value = null;
  };

  const handlePdfChange = async (companyName, e) => {
    const file = e.target.files?.[0];
    if (!file || !onImportPdfOffer) { e.target.value = null; return; }
    await onImportPdfOffer(companyName, file);
    e.target.value = null;
  };

  const handleVariantChange = async (key, e) => {
    const file = e.target.files?.[0];
    const ctx = pendingVariantCtx[key];
    if (!file || !ctx || !onImportVariant) { e.target.value = null; return; }
    await onImportVariant(ctx.companyId, file, { label: ctx.label });
    e.target.value = null;
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ─── Synthèse de la consultation ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <header className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200/70">
            <div className="p-2 rounded-xl bg-indigo-100">
              <ScrollText size={18} className="text-indigo-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-slate-800">Synthèse du dépouillement</h2>
              <p className="text-[11px] text-slate-500">Ouverture des plis et régime applicable aux variantes (CCP)</p>
            </div>
            {onReopenDepouillement && (
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
              ① Import offre · ② Import variantes · ③ Analyse technique
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
                    onGoToTechnique={() => onGoToTechnique?.(c.name)}
                    onGoToAdmin={() => onGoToAdmin?.(c.name)}
                    adminDone={adminDone}
                    adminConclusion={admin.conclusion}
                    techDone={techDone}
                    techRatio={techRatio}
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
                onChange={(e) => handleOfferChange(c.name, e)}
              />
              <input
                ref={(el) => { pdfFileRefs.current[c.id] = el; }}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handlePdfChange(c.name, e)}
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
  onGoToTechnique, onGoToAdmin,
  adminDone = false, adminConclusion = null,
  techDone = false, techRatio = null,
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

  const offerStatus = offerImported ? 'done' : 'todo';
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
          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
            {company.aeAmount != null && (
              <span>AE : <strong className="font-mono text-slate-700">{fmtEUR(company.aeAmount)}</strong></span>
            )}
            {variants.length > 0 && (
              <span className="text-purple-600">{variants.length} variante{variants.length > 1 ? 's' : ''} annoncée{variants.length > 1 ? 's' : ''}</span>
            )}
          </div>
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
          buttonsGroupLabel="Importer"
        />

        {/* ② Variantes */}
        {regime !== 'forbidden' && variants.length > 0 && (
          <div className="ml-7 space-y-1.5">
            {variants.map((v, vi) => {
              const imported = (v.offers && Object.keys(v.offers).length > 0) || (v.newItems || []).length > 0;
              return (
                <StepRow
                  key={v.id}
                  stepNumber={`V${vi + 1}`}
                  icon={<GitBranch size={14} className="text-purple-600" />}
                  label={v.label || `Variante ${vi + 1}`}
                  status={imported ? 'done' : 'todo'}
                  statusLabel={
                    imported
                      ? `Importée — ${fmtEUR(v.total || 0)}`
                      : (v.aeAmount != null ? `Annoncée : ${fmtEUR(v.aeAmount)}` : 'À importer')
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
                  buttonsGroupLabel="Importer"
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
function StepRow({ stepNumber, icon, label, status, statusLabel, actionLabel, actionIcon = null, actionAccent = 'primary', onAction, disabled, isVariant, extraAction = null, buttonsGroupLabel = null }) {
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
        <div className={`text-[11px] mt-0.5 ${status === 'done' ? 'text-emerald-600' : status === 'disabled' ? 'text-slate-400' : 'text-amber-600'}`}>
          {statusLabel}
        </div>
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
