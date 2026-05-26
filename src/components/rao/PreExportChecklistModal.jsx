// src/components/rao/PreExportChecklistModal.jsx
// Modale de validation pré-export PDF du RAO.
// Affiche une checklist par onglet avec les items manquants cliquables.

import React from 'react';
import { CheckCircle2, AlertTriangle, X, FileDown, ArrowRight, Loader2 } from 'lucide-react';

const TAB_LABELS = {
  consultation: { num: 1, label: 'Consultation' },
  depouillement: { num: 2, label: 'Dépouillement' },
  admin: { num: 3, label: 'Administratif' },
  technique: { num: 4, label: 'Technique' },
};

const PreExportChecklistModal = ({
  open,
  preExportChecks = [],
  isReadyForExport,
  onConfirm,
  onCancel,
  onNavigate,
  isExporting = false,
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
                  </div>
                </div>
              );
            })}
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
