// src/components/rao/OcrProgressModal.jsx
//
// Modale de progression pendant l'OCR d'un PDF scanné.
// Affiche le stade actuel (init / rendu / OCR) + page courante + progress bar.

import React from 'react';
import { ScanLine, Loader2, FileText } from 'lucide-react';

export default function OcrProgressModal({ open, progress }) {
  if (!open) return null;

  const stage = progress?.stage || 'init';
  const message = progress?.message || 'Préparation…';
  const page = progress?.page || 0;
  const totalPages = progress?.totalPages || 1;
  const subProgress = progress?.progress != null ? Math.round(progress.progress * 100) : null;

  const stageLabel = {
    init:   'Initialisation',
    detect: 'Détection',
    render: 'Rendu page',
    ocr:    'Reconnaissance OCR',
  }[stage] || stage;

  // Pourcentage global = pages déjà OCRisées
  const globalPct = totalPages > 0 ? Math.round(((page - (stage === 'render' ? 0 : 0.5)) / totalPages) * 100) : 0;
  const safeGlobal = Math.max(0, Math.min(100, globalPct));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
          <div className="relative p-3 rounded-2xl bg-amber-100">
            <ScanLine size={24} className="text-amber-700" strokeWidth={1.5} />
            <Loader2 size={12} className="absolute -top-1 -right-1 text-amber-600 animate-spin" />
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">OCR en cours</h2>
            <p className="text-xs text-gray-500">Reconnaissance optique d'un PDF scanné</p>
          </div>
        </div>

        {/* Corps */}
        <div className="px-6 py-5 space-y-4">

          {/* Message courant */}
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FileText size={14} className="text-amber-600 shrink-0" />
            <span className="font-medium truncate">{message}</span>
          </div>

          {/* Progression globale (pages) */}
          {totalPages > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                <span className="font-semibold uppercase tracking-wider">{stageLabel}</span>
                {page > 0 && <span>Page {page} / {totalPages}</span>}
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                  style={{ width: `${safeGlobal}%` }}
                />
              </div>
            </div>
          )}

          {/* Sous-progression (caractères reconnus dans la page courante) */}
          {subProgress != null && stage === 'ocr' && (
            <div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>Reconnaissance des caractères</span>
                <span>{subProgress}%</span>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${subProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 rounded-lg px-3 py-2">
            L'OCR peut prendre 10 à 30 secondes par page selon la qualité du scan.
            La fenêtre se fermera automatiquement à la fin.
          </div>
        </div>
      </div>
    </div>
  );
}
