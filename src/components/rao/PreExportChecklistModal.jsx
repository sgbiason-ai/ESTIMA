// src/components/rao/PreExportChecklistModal.jsx
// Modale de validation pré-export PDF du RAO.
// Affiche une checklist par onglet avec les items manquants cliquables.

import React from 'react';
import { CheckCircle2, AlertTriangle, X, FileDown, ArrowRight, Loader2, Files, Handshake, Printer, ChevronRight } from 'lucide-react';

const TAB_LABELS = {
  consultation: { num: 1, label: 'Consultation' },
  depouillement: { num: 2, label: 'Dépouillement' },
  admin: { num: 3, label: 'Administratif' },
  technique: { num: 4, label: 'Technique' },
  adminNego: { num: 8, label: 'Administratif après négo' },
  techniqueNego: { num: 9, label: 'Technique après négo' },
};

const PreExportChecklistModal = ({
  open,
  preExportChecks = [],
  isReadyForExport,
  onConfirm,
  onCancel,
  onNavigate,
  // (tabId, anchorId, companyName) → bascule d'onglet + surbrillance du champ précis.
  onNavigateToField,
  isExporting = false,
  includeAnnexes = true,
  onToggleIncludeAnnexes,
  negotiationPhase = 'none',
  onChangeNegotiationPhase,
  pricesPaperSize = 'a4',
  onChangePricesPaperSize,
}) => {
  if (!open) return null;

  // Compte les warnings / OK
  let totalItems = 0, okItems = 0, warnItems = 0;
  preExportChecks.forEach(group => {
    group.items.forEach(it => {
      if (it.info) return;
      totalItems++;
      if (it.ok) okItems++;
      else if (it.warn || !it.ok) warnItems++;
    });
  });

  const ratio = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : 0;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onCancel}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-6 py-5 border-b ${isReadyForExport ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 border-emerald-200' : 'bg-gradient-to-br from-amber-50 to-amber-100/40 border-amber-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${isReadyForExport ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                  {isReadyForExport ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <AlertTriangle size={22} strokeWidth={2.5} />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    {isReadyForExport ? 'Prêt à exporter' : 'Vérification avant export'}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isReadyForExport
                      ? 'Toutes les sections sont complètes.'
                      : `${okItems}/${totalItems} contrôles validés — ${warnItems} item${warnItems > 1 ? 's' : ''} à compléter`}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Barre de progression */}
            <div className="mt-4 h-2 bg-white/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isReadyForExport ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-emerald-400'}`}
                style={{ width: `${ratio}%` }}
              />
            </div>
          </div>

          {/* Content — checklist par onglet */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {preExportChecks.map(group => {
              const tabInfo = TAB_LABELS[group.tab] || { num: '?', label: group.tab };
              const groupOk = group.items.every(it => it.ok || it.info);
              const visibleItems = group.items.filter(it => !it.info);

              return (
                <div key={group.tab}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black ${groupOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tabInfo.num}
                      </span>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">{tabInfo.label}</h3>
                      {groupOk ? (
                        <span className="text-[10px] font-bold uppercase text-emerald-700">Complet</span>
                      ) : (
                        <button
                          onClick={() => { onNavigate && onNavigate(group.tab); onCancel(); }}
                          className="ml-1 flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 hover:text-amber-900 hover:underline"
                        >
                          Aller à l'onglet <ArrowRight size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 ml-2 pl-7 border-l-2 border-slate-100">
                    {visibleItems.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 text-xs py-1 ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}
                      >
                        {item.ok
                          ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                          : <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                        }
                        <span className={item.ok ? '' : 'font-medium'}>{item.label}</span>
                      </div>
                    ))}

                    {/* Items manquants cliquables → saut direct vers le champ à corriger */}
                    {!groupOk && (group.missing || []).length > 0 && onNavigateToField && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5">
                        {group.missing.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onNavigateToField(group.tab, m.anchorId, m.companyName)}
                            className="w-full flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg px-2 py-1 transition-colors text-left"
                          >
                            <ChevronRight size={12} className="shrink-0 text-amber-400" />
                            <span className="flex-1 truncate">Corriger : {m.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Option Annexes — toujours proposée */}
          <div className="shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50/40">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeAnnexes}
                onChange={(e) => onToggleIncludeAnnexes && onToggleIncludeAnnexes(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400 cursor-pointer"
              />
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Files size={14} className="text-slate-500" />
                  Inclure les annexes méthodologiques
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Annexe D (formules de notation du critère prix) et Annexe E (références du Code de la
                  commande publique). Décoché, le PDF est allégé sans ces annexes.
                </span>
              </span>
            </label>
          </div>

          {/* Format papier des annexes de prix A/B — A4 compact ou A3 confort de lecture */}
          <div className="shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
              <Printer size={14} className="text-slate-500" />
              Impression des annexes de prix (A/B)
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {[
                { value: 'a4', label: 'A4 paysage', desc: 'compact' },
                { value: 'a3', label: 'A3 paysage', desc: 'confort de lecture' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangePricesPaperSize && onChangePricesPaperSize(opt.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    pricesPaperSize === opt.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="ml-1 text-[10px] font-normal text-slate-400">· {opt.desc}</span>
                </button>
              ))}
            </div>
            <span className="block text-[11px] text-slate-500 mt-1.5">
              A4 : format standard d'impression bureautique (police compacte 5,5 pt).
              A3 : format élargi, police plus lisible (6,5 pt) — utile quand il y a beaucoup d'entreprises ou de variantes.
            </span>
          </div>

          {/* Phase de négociation — marque le rapport avant / après négociation */}
          <div className="shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
              <Handshake size={14} className="text-slate-500" />
              Phase de négociation
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {[
                { value: 'none', label: 'Sans mention' },
                { value: 'before', label: 'Avant négociation' },
                { value: 'after', label: 'Après négociation' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeNegotiationPhase && onChangeNegotiationPhase(opt.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    negotiationPhase === opt.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="block text-[11px] text-slate-500 mt-1.5">
              Ajoute un badge sur la page de garde et adapte la phrase de recommandation
              («&nbsp;Sur la base des offres initiales remises…&nbsp;» / «&nbsp;À l'issue de la phase de négociation…&nbsp;»).
            </span>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={isExporting}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-md transition-all active:scale-95 ${
                isReadyForExport
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-500 hover:bg-amber-600'
              } ${isExporting ? 'opacity-60 cursor-wait' : ''}`}
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              {isExporting
                ? 'Génération…'
                : isReadyForExport
                  ? 'Générer le PDF'
                  : 'Générer quand même'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PreExportChecklistModal;
