// src/components/rao/ImportReportModal.jsx
//
// Rapport d'import d'une offre entreprise : s'ouvre automatiquement quand une
// anomalie existe. Les toasts ne donnent que des compteurs — cette modale dit
// QUELS articles sont restés sans prix (ils comptent 0 € dans l'analyse) et
// QUELLES lignes du fichier n'ont pas trouvé leur article dans le DQE.

import React from 'react';
import { FileWarning, X, Euro, Unlink } from 'lucide-react';

export default function ImportReportModal({ report, onClose }) {
  if (!report) return null;

  const { companyName, fileName, zeroPriceItems = [], unmatched = [], stats = {} } = report;
  const { totalRows, matchCount, refMatchedRows } = stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
          <div className="p-3 rounded-2xl bg-amber-100">
            <FileWarning size={24} className="text-amber-700" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base text-gray-900">Rapport d'import — {companyName}</h2>
            <p className="text-xs text-gray-500 truncate">
              {fileName}
              {Number.isFinite(matchCount) && Number.isFinite(totalRows) && (
                <> · {matchCount}/{totalRows} ligne(s) rattachée(s){refMatchedRows > 0 ? `, ${refMatchedRows} par n° de prix` : ''}</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/70 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Articles restés sans prix */}
          {zeroPriceItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Euro size={14} className="text-red-600 shrink-0" />
                <h3 className="text-sm font-bold text-gray-900">
                  {zeroPriceItems.length} article(s) resté(s) sans prix
                </h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Ces articles de la tranche active n'ont reçu aucun prix de ce fichier :
                ils comptent pour <b>0&nbsp;€</b> dans l'analyse et minorent le total de
                l'offre (source typique d'un écart avec le montant de l'acte d'engagement).
              </p>
              <div className="border border-red-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50 text-red-900 text-left">
                      <th className="px-3 py-2 font-semibold w-16">N°</th>
                      <th className="px-3 py-2 font-semibold">Désignation</th>
                      <th className="px-3 py-2 font-semibold w-10">U</th>
                      <th className="px-3 py-2 font-semibold w-20 text-right">Qté DQE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeroPriceItems.map(item => (
                      <tr key={item.itemId} className="border-t border-red-50">
                        <td className="px-3 py-1.5 tabular-nums text-gray-500">{item.ref}</td>
                        <td className="px-3 py-1.5 text-gray-800">{item.designation}</td>
                        <td className="px-3 py-1.5 text-gray-500">{item.unit}</td>
                        <td className="px-3 py-1.5 tabular-nums text-right text-gray-800">{item.moeQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Lignes du fichier non rattachées */}
          {unmatched.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Unlink size={14} className="text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-gray-900">
                  {unmatched.length} ligne(s) du fichier non rattachée(s)
                </h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Ni la désignation ni le n° de prix de ces lignes ne correspondent à un
                article du DQE. Leur prix n'a pas été repris — vérifiez s'il s'agit
                d'articles ajoutés par l'entreprise ou de libellés trop modifiés.
              </p>
              <div className="border border-amber-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-amber-50 text-amber-900 text-left">
                      <th className="px-3 py-2 font-semibold w-24">Feuille</th>
                      <th className="px-3 py-2 font-semibold w-14">Ligne</th>
                      <th className="px-3 py-2 font-semibold w-16">N°</th>
                      <th className="px-3 py-2 font-semibold">Désignation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatched.map((row, i) => (
                      <tr key={`${row.sheet}-${row.row}-${i}`} className="border-t border-amber-50">
                        <td className="px-3 py-1.5 text-gray-500 truncate max-w-[6rem]">{row.sheet}</td>
                        <td className="px-3 py-1.5 tabular-nums text-gray-500">{row.row}</td>
                        <td className="px-3 py-1.5 tabular-nums text-gray-500">{row.ref}</td>
                        <td className="px-3 py-1.5 text-gray-800">{row.designation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
