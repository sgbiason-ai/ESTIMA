// src/components/ChangelogModal.jsx
// Modal Apple-style affichant l'historique des versions.

import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { CHANGELOG, APP_VERSION } from '../data/changelog';

export default function ChangelogModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-gray-300/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50">
              <Sparkles size={18} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Nouveautés</h2>
              <p className="text-xs text-gray-400 mt-0.5">Historique des mises à jour</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="h-px bg-gray-100 mx-6" />

        {/* Content — scrollable */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-6">
          {CHANGELOG.map((release, idx) => {
            const isCurrent = release.version === APP_VERSION;
            return (
              <div key={release.version}>
                {/* Version header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    isCurrent
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    v{release.version}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Version actuelle</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(release.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                {/* Title */}
                <h3 className={`text-sm font-semibold mb-2 ${isCurrent ? 'text-gray-900' : 'text-gray-600'}`}>
                  {release.title}
                </h3>

                {/* Highlights */}
                <ul className="space-y-1.5">
                  {release.highlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                      <CheckCircle2 size={14} className={`shrink-0 mt-0.5 ${isCurrent ? 'text-emerald-500' : 'text-gray-300'}`} />
                      <span className={isCurrent ? 'text-gray-700' : 'text-gray-400'}>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Separator between versions */}
                {idx < CHANGELOG.length - 1 && (
                  <div className="h-px bg-gray-100 mt-5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {CHANGELOG.length} version{CHANGELOG.length > 1 ? 's' : ''} publiée{CHANGELOG.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
