import React, { useState } from 'react';
import Icon from './Icon';
import { canNativeShare } from '../../utils/fileSaver';

const EXPORT_SECTIONS = [
  {
    title: 'Projet',
    items: [
      { key: 'CoverPage', label: 'Fiche Projet', format: 'PDF', desc: 'Page de garde du projet' },
    ],
  },
  {
    title: 'Estimation',
    items: [
      { key: 'Estim', label: 'Estim. (DQE)', format: 'PDF',   desc: 'Devis PDF (DQE)' },
      { key: 'BPU',   label: 'BPU',          format: 'Excel', desc: 'Bordereau des Prix Unitaires' },
      { key: 'DQE',   label: 'DQE',          format: 'Excel', desc: 'Détail Quantitatif Estimatif' },
    ],
  },
  {
    title: 'Analyse des Offres',
    items: [
      { key: 'Analyse',      label: 'Analyse',      format: 'PDF',   desc: 'Analyse comparative des offres' },
      { key: 'AnalyseExcel', label: 'Analyse',      format: 'Excel', desc: 'Tableur comparatif des offres' },
      { key: 'RAO',          label: 'RAO',          format: 'PDF',   desc: 'Rapport d\'Analyse des Offres' },
      { key: 'NegoLetter',   label: 'Lettre négo.', format: 'PDF',   desc: 'Courrier de négociation', needsCompany: true },
    ],
  },
];

export default function ExportsView({ onExport, companies = [] }) {
  const [exporting, setExporting] = useState(null);
  const [pickerFor, setPickerFor] = useState(null); // { key, share }
  const hasShare = canNativeShare();

  const runExport = async (key, share, opts = {}) => {
    const stateKey = share ? `${key}-share` : key;
    setExporting(stateKey);
    await onExport(key, share, opts);
    setTimeout(() => setExporting(null), 500);
  };

  const handleClick = async (item, share = false) => {
    if (item.needsCompany) {
      if (!companies?.length) {
        // Laisse onExport renvoyer le toast "Aucune analyse disponible"
        await runExport(item.key, share);
        return;
      }
      setPickerFor({ key: item.key, share });
      return;
    }
    await runExport(item.key, share);
  };

  const handlePickCompany = async (companyName) => {
    const { key, share } = pickerFor;
    setPickerFor(null);
    await runExport(key, share, { companyName });
  };

  const SpinnerBtn = () => (
    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  );

  return (
    <div className="px-4 pt-3 pb-6">
      {EXPORT_SECTIONS.map((section, idx) => (
        <div key={section.title} className={idx > 0 ? 'mt-6' : ''}>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            {section.title}
          </div>
          {section.items.map(item => {
            const isDownloading = exporting === item.key;
            const isSharing = exporting === `${item.key}-share`;
            const isBusy = isDownloading || isSharing;

            return (
              <div key={item.key} className="flex items-center gap-3 py-3.5 border-b border-gray-100">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  item.format === 'PDF' ? 'bg-red-100' : 'bg-emerald-100'
                }`}>
                  <Icon name="file" size={18} color={item.format === 'PDF' ? '#dc2626' : '#059669'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-gray-900">{item.label}</div>
                  <div className="text-[11px] text-gray-500 font-medium">{item.desc} · {item.format}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleClick(item, false)}
                    disabled={isBusy}
                    aria-label={`Télécharger ${item.label} au format ${item.format}`}
                    title={`Télécharger ${item.label}`}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                      isBusy ? 'bg-gray-50 border-gray-200 opacity-40'
                        : 'bg-blue-50 border-blue-200 active:bg-blue-100'
                    }`}>
                    {isDownloading ? <SpinnerBtn /> : <Icon name="download" size={16} color="#2563eb" />}
                  </button>
                  {hasShare && (
                    <button
                      onClick={() => handleClick(item, true)}
                      disabled={isBusy}
                      aria-label={`Partager ${item.label} au format ${item.format}`}
                      title={`Partager ${item.label}`}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                        isBusy ? 'bg-gray-50 border-gray-200 opacity-40'
                          : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                      }`}>
                      {isSharing ? <SpinnerBtn /> : <Icon name="share" size={16} color="#6b7280" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ─── Sheet picker pour Lettre de négociation ─── */}
      {pickerFor && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end"
          onClick={() => setPickerFor(null)}>
          <div
            className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="text-[15px] font-bold text-gray-900 mb-1">Lettre de négociation</div>
            <div className="text-xs text-gray-500 mb-4">
              Choisissez l'entreprise destinataire
            </div>
            {companies.map((c, i) => {
              const name = c?.name || c;
              return (
                <button
                  key={name + i}
                  onClick={() => handlePickCompany(name)}
                  className="w-full text-left py-3 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 active:bg-gray-100 mb-2 text-[15px] font-medium text-gray-900">
                  {name}
                </button>
              );
            })}
            <button
              onClick={() => setPickerFor(null)}
              className="w-full mt-2 py-3 rounded-xl bg-gray-100 text-[14px] font-medium text-gray-600">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
