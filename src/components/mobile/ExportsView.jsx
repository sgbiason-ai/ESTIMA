import React, { useState } from 'react';
import Icon from './Icon';
import { canNativeShare } from '../../utils/fileSaver';

export default function ExportsView({ onExport }) {
  const [exporting, setExporting] = useState(null);
  const hasShare = canNativeShare();

  const handleClick = async (type, share = false) => {
    const key = share ? `${type}-share` : type;
    setExporting(key);
    await onExport(type, share);
    setTimeout(() => setExporting(null), 500);
  };

  const exports = [
    { key: 'CCTP',    format: 'PDF',   desc: 'Cahier des Clauses Techniques' },
    { key: 'RC',      format: 'PDF',   desc: 'Règlement de Consultation' },
    { key: 'Estim',   format: 'PDF',   desc: 'Devis PDF (DQE)' },
    { key: 'BPU',     format: 'Excel', desc: 'Bordereau des Prix Unitaires' },
    { key: 'DQE',     format: 'Excel', desc: 'Détail Quantitatif Estimatif' },
    { key: 'Analyse', format: 'PDF',   desc: 'Analyse comparative des offres' },
    { key: 'RAO',     format: 'PDF',   desc: 'Rapport d\'Analyse des Offres' },
  ];

  const SpinnerBtn = () => (
    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  );

  return (
    <div className="px-4 pt-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Documents disponibles
      </div>
      {exports.map(ex => {
        const isDownloading = exporting === ex.key;
        const isSharing = exporting === `${ex.key}-share`;
        const isBusy = isDownloading || isSharing;

        return (
          <div key={ex.key} className="flex items-center gap-3 py-3.5 border-b border-gray-100">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              ex.format === 'PDF' ? 'bg-red-100' : 'bg-emerald-100'
            }`}>
              <Icon name="file" size={18} color={ex.format === 'PDF' ? '#dc2626' : '#059669'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">{ex.key}</div>
              <div className="text-[11px] text-gray-500 font-medium">{ex.desc} · {ex.format}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleClick(ex.key, false)}
                disabled={isBusy}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                  isBusy ? 'bg-gray-50 border-gray-200 opacity-40'
                    : 'bg-blue-50 border-blue-200 active:bg-blue-100'
                }`}>
                {isDownloading ? <SpinnerBtn /> : <Icon name="download" size={16} color="#2563eb" />}
              </button>
              {hasShare && (
                <button
                  onClick={() => handleClick(ex.key, true)}
                  disabled={isBusy}
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
  );
}
