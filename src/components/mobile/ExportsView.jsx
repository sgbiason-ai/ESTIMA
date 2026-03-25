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
    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
  );

  return (
    <div className="px-4 pt-3">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Documents disponibles
      </div>
      {exports.map(ex => {
        const isDownloading = exporting === ex.key;
        const isSharing = exporting === `${ex.key}-share`;
        const isBusy = isDownloading || isSharing;

        return (
          <div key={ex.key} className="flex items-center gap-3 py-3.5 border-b border-white/5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              ex.format === 'PDF' ? 'bg-red-500/10' : 'bg-emerald-500/10'
            }`}>
              <Icon name="file" size={18} color={ex.format === 'PDF' ? '#ef4444' : '#34d399'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-200">{ex.key}</div>
              <div className="text-[11px] text-slate-500">{ex.desc} • {ex.format}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleClick(ex.key, false)}
                disabled={isBusy}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                  isBusy ? 'bg-white/5 border-white/5 opacity-40'
                    : 'bg-emerald-500/10 border-emerald-500/20 active:bg-emerald-500/30'
                }`}>
                {isDownloading ? <SpinnerBtn /> : <Icon name="download" size={16} color="#34d399" />}
              </button>
              {hasShare && (
                <button
                  onClick={() => handleClick(ex.key, true)}
                  disabled={isBusy}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                    isBusy ? 'bg-white/5 border-white/5 opacity-40'
                      : 'bg-white/5 border-white/10 active:bg-white/10'
                  }`}>
                  {isSharing ? <SpinnerBtn /> : <Icon name="share" size={16} color="#64748b" />}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
