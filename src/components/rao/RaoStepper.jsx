// src/components/rao/RaoStepper.jsx
// Stepper compact sur 1 ligne : étapes-pills à gauche + barre de progression à droite.

import React from 'react';
import { CheckCircle2, AlertCircle, Minus } from 'lucide-react';

const STEPS = [
  { id: 'consultation',  label: 'Consultation',  num: 1, short: 'Consult.' },
  { id: 'depouillement', label: 'Dépouillement', num: 2, short: 'Dépouill.' },
  { id: 'admin',         label: 'Administratif', num: 3, short: 'Admin' },
  { id: 'technique',     label: 'Technique',     num: 4, short: 'Tech.' },
  { id: 'negociation',   label: 'Négociation',   num: 5, optional: true, short: 'Négo' },
  { id: 'recap',         label: 'Récapitulatif', num: 6, short: 'Récap' },
];

const RaoStepper = ({ activeTab, tabStates, overallProgress, onSelectTab, embedded = false }) => {
  // ► Mode embedded : pas de container externe (parent gère le bg/border/padding)
  const wrapperCls = embedded
    ? 'flex items-center gap-1.5'
    : 'shrink-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200';
  return (
    <div className={wrapperCls}>
      {/* Pills d'étapes */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
        {STEPS.map((step, idx) => {
          const state = tabStates[step.id] || { done: false };
          const isActive = activeTab === step.id;
          const isDone = state.done;
          const isOptional = step.optional;
          const ratio = state.ratio;
          const hasWarn = state.items?.some(it => it.warn);

          // Couleur de la pill — ► optional prime sur done pour éviter ✓ trompeur
          let pillCls = 'bg-slate-100 text-slate-500 border-slate-200';
          let numCls = 'bg-slate-300 text-white';
          if (isActive) {
            pillCls = 'bg-blue-600 text-white border-blue-700 shadow-md';
            numCls = 'bg-white/20 text-white';
          } else if (isOptional) {
            // Toujours en gris discret pour signaler "facultatif"
            pillCls = 'bg-slate-50 text-slate-400 border-slate-200 italic hover:bg-slate-100';
            numCls = 'bg-slate-300 text-white';
          } else if (isDone) {
            pillCls = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
            numCls = 'bg-emerald-500 text-white';
          } else if (hasWarn) {
            pillCls = 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
            numCls = 'bg-amber-500 text-white';
          } else {
            pillCls += ' hover:bg-slate-200';
          }

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelectTab(step.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all whitespace-nowrap ${pillCls}`}
                title={`${step.label} — ${isDone ? 'Complet' : hasWarn ? 'À compléter' : isOptional ? 'Optionnel' : 'Vide'}`}
              >
                <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${numCls}`}>
                  {isDone ? <CheckCircle2 size={10} strokeWidth={3} /> : isOptional ? <Minus size={9} strokeWidth={3} /> : step.num}
                </span>
                <span className="hidden md:inline">{step.label}</span>
                <span className="md:hidden">{step.short}</span>
                {ratio && (
                  <span className={`text-[9px] font-black px-1 py-0.5 rounded ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isOptional
                        ? 'bg-slate-200/60 text-slate-600'
                        : isDone
                          ? 'bg-emerald-200/60 text-emerald-800'
                          : 'bg-amber-200/60 text-amber-800'
                  }`}>
                    {ratio}
                  </span>
                )}
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`h-px w-3 ${isDone || tabStates[STEPS[idx + 1].id]?.done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Barre de progression compacte à droite */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Avancement</span>
          <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${overallProgress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <span className={`text-xs font-black ${overallProgress === 100 ? 'text-emerald-600' : overallProgress >= 50 ? 'text-amber-600' : 'text-slate-600'}`}>
          {overallProgress} %
        </span>
        {overallProgress === 100 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black border border-emerald-200">
            <CheckCircle2 size={10} strokeWidth={3} /> PRÊT
          </span>
        )}
      </div>
    </div>
  );
};

export default RaoStepper;
