// src/components/rao/NextStepHint.jsx
// Bandeau « Prochaine étape » du workflow RAO : affiché sous le ribbon quand
// l'étape courante est complète et qu'une étape suivante reste à faire.
// Suggestion, jamais blocage — masquable d'un clic (par étape).

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';

const NextStepHint = ({ steps, tabStates, activeTab, onGoToTab }) => {
  const [dismissed, setDismissed] = useState(() => new Set());

  const state = tabStates?.[activeTab];
  if (!state?.done || dismissed.has(activeTab)) return null;

  const idx = steps.findIndex(s => s.id === activeTab);
  if (idx === -1) return null;
  // Prochaine étape incomplète après l'étape courante (les optionnelles ne bloquent pas)
  const next = steps.slice(idx + 1).find(s => !s.optional && !tabStates?.[s.id]?.done);
  if (!next) return null;

  return (
    <div className="shrink-0 mx-6 mt-3 flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200/60 rounded-2xl shadow-sm">
      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
      <p className="flex-1 min-w-0 text-xs text-slate-600 truncate">
        <span className="font-bold text-emerald-700">{steps[idx].label} : complet.</span>
        {' '}Prochaine étape — <span className="font-bold text-slate-800">{next.num} · {next.label}</span>
        {next.hint ? <span className="text-slate-400"> ({next.hint.toLowerCase()})</span> : null}
      </p>
      <button
        onClick={() => onGoToTab(next.id)}
        className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-bold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
      >
        Continuer <ArrowRight size={12} />
      </button>
      <button
        onClick={() => setDismissed(prev => new Set(prev).add(activeTab))}
        className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-gray-100 transition-colors"
        title="Masquer cette suggestion"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default NextStepHint;
