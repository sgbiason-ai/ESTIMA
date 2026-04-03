// src/components/crr/CrcGuidedTour.jsx
//
// Tour guide interactif pas-a-pas pour le module Compte Rendu.
// Highlight chaque zone avec overlay + bulle explicative.

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const STEPS = [
  {
    target: '[data-tour="chantier"]',
    title: 'Selecteur de chantier',
    text: 'Choisissez ou creez un chantier. Chaque chantier regroupe ses propres reunions, participants et categories d\'observations.',
    position: 'bottom',
  },
  {
    target: '[data-tour="reunion"]',
    title: 'Gestion des reunions',
    text: 'Creez, dupliquez ou supprimez des reunions de chantier. La duplication reporte automatiquement les observations non resolues.',
    position: 'bottom',
  },
  {
    target: '[data-tour="configuration"]',
    title: 'Configuration',
    text: 'Renseignez les informations du chantier, gerez la liste des participants et les categories d\'observations.',
    position: 'bottom',
  },
  {
    target: '[data-tour="mode"]',
    title: 'Mode Edition / Apercu',
    text: 'Basculez entre le mode edition (modification des donnees) et l\'apercu qui reproduit le rendu final du PDF.',
    position: 'bottom',
  },
  {
    target: '[data-tour="exports"]',
    title: 'Exports',
    text: 'Exportez le compte rendu en PDF ou Word, ou envoyez-le directement par email aux contacts marques CPR.',
    position: 'bottom',
  },
  {
    target: '[data-tour="meetings-list"]',
    title: 'Liste des reunions',
    text: 'Naviguez entre vos reunions. Le badge colore indique le nombre d\'observations ouvertes pour chaque reunion.',
    position: 'right',
  },
  {
    target: '[data-tour="content-area"]',
    title: 'Zone de contenu',
    text: 'C\'est ici que vous editez l\'en-tete, les participants et les observations de la reunion selectionnee. Toutes les modifications sont sauvegardees automatiquement.',
    position: 'top',
  },
];

const CrcGuidedTour = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const currentStep = STEPS[step];

  const updateTargetRect = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      // Scroll into view si necessaire
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    return () => window.removeEventListener('resize', updateTargetRect);
  }, [updateTargetRect]);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem('crc-tour-dismissed', 'true');
    }
    onClose();
  };

  const isLast = step === STEPS.length - 1;
  const pad = 6; // padding autour de l'element highlight

  // Position de la bulle
  const getBubbleStyle = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const pos = currentStep.position;
    const style = { position: 'fixed' };

    if (pos === 'bottom') {
      style.top = targetRect.top + targetRect.height + pad + 12;
      style.left = targetRect.left + targetRect.width / 2;
      style.transform = 'translateX(-50%)';
    } else if (pos === 'top') {
      style.top = targetRect.top - pad - 12;
      style.left = targetRect.left + targetRect.width / 2;
      style.transform = 'translate(-50%, -100%)';
    } else if (pos === 'right') {
      style.top = targetRect.top + targetRect.height / 2;
      style.left = targetRect.left + targetRect.width + pad + 12;
      style.transform = 'translateY(-50%)';
    } else if (pos === 'left') {
      style.top = targetRect.top + targetRect.height / 2;
      style.left = targetRect.left - pad - 12;
      style.transform = 'translate(-100%, -50%)';
    }

    return style;
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Overlay avec trou */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={handleNext}
        />
      </svg>

      {/* Bordure lumineuse autour de l'element */}
      {targetRect && (
        <div
          className="fixed border-2 border-emerald-400 rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - pad,
            left: targetRect.left - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            boxShadow: '0 0 0 4px rgba(16,185,129,0.2), 0 0 20px rgba(16,185,129,0.15)',
          }}
        />
      )}

      {/* Bulle explicative */}
      <div
        className="fixed z-[61] bg-[#0f1e2a] rounded-xl shadow-2xl border border-white/10 p-4 w-[340px]"
        style={getBubbleStyle()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
              {step + 1}
            </span>
            <h3 className="text-sm font-bold text-white">{currentStep.title}</h3>
          </div>
          <button onClick={handleFinish} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {/* Texte */}
        <p className="text-xs text-white/60 leading-relaxed mb-4">{currentStep.text}</p>

        {/* Progress */}
        <div className="flex gap-1 mb-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-emerald-400' : 'bg-white/10'}`} />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-3 h-3 rounded border-white/20"
            />
            Ne plus afficher
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">{step + 1} / {STEPS.length}</span>
            {step > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={14} />
                Precedent
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
            >
              {isLast ? (
                <>
                  <Check size={14} />
                  Terminer
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrcGuidedTour;
