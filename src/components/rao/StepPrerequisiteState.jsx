// src/components/rao/StepPrerequisiteState.jsx
// Empty state guidé d'un onglet RAO : remplace les `return null` muets quand
// un prérequis manque (aucune entreprise, aucun critère…). Explique le
// prérequis et propose d'aller à l'étape concernée — sans jamais bloquer.

import React from 'react';
import { ArrowRight } from 'lucide-react';

const StepPrerequisiteState = ({ icon: Icon, title, explanation, ctaLabel, onCta, children }) => (
  <div className="h-full flex items-center justify-center p-8 bg-slate-50">
    <div className="max-w-md w-full bg-white border border-gray-200/60 rounded-3xl shadow-sm p-8 text-center">
      {Icon && (
        <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon size={26} className="text-slate-400" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-base font-black text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-5">{explanation}</p>
      {onCta && (
        <button
          onClick={onCta}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
        >
          {ctaLabel} <ArrowRight size={15} />
        </button>
      )}
      {children}
    </div>
  </div>
);

export default StepPrerequisiteState;
