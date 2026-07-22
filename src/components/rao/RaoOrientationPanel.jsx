// src/components/rao/RaoOrientationPanel.jsx
// Panneau d'orientation affiché à la première ouverture du RAO (aucune
// entreprise saisie) : timeline des 9 étapes du processus (deux phases,
// avant/après négociation) + points d'entrée.
// Remplace l'ancienne modale Dépouillement auto-ouvrante qui masquait le contexte.

import React from 'react';
import { CheckCircle2, Plus, ArrowRight, Handshake } from 'lucide-react';
import { RAO_STEPS } from './RaoConstants';

const RaoOrientationPanel = ({ tabStates = {}, onGoToConsultation, onStartDepouillement }) => (
  <div className="bg-white border border-gray-200/60 rounded-3xl shadow-sm overflow-hidden">
    <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200/60">
      <h3 className="text-base font-black text-slate-800">Bienvenue dans le Rapport RAO</h3>
      <p className="text-xs text-slate-500 mt-1">
        L'analyse des offres suit 9 étapes en deux phases (avant / après négociation) — naviguez librement, le processus vous guide.
      </p>
    </div>

    <div className="px-6 py-5">
      <ol className="space-y-1">
        {RAO_STEPS.map((step, i) => {
          const done = !!tabStates[step.id]?.done;
          const phaseStart = step.phase === 'apres' && RAO_STEPS[i - 1]?.phase === 'avant';
          return (
            <React.Fragment key={step.id}>
              {phaseStart && (
                <li className="flex items-center gap-2 pt-3 pb-1">
                  <Handshake size={13} className="text-slate-400 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Après négociation</span>
                  <span className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 italic">si le marché le prévoit</span>
                </li>
              )}
              <li className="flex items-center gap-3 py-1.5">
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                  done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {done ? <CheckCircle2 size={14} /> : step.num}
                </span>
                <div className="min-w-0">
                  <span className={`text-sm font-bold ${done ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {step.label}
                    {step.optional && <span className="ml-1.5 text-[10px] font-bold text-slate-400 uppercase">optionnelle</span>}
                  </span>
                  <p className="text-[11px] text-slate-400 leading-snug">{step.hint}</p>
                </div>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      <div className="mt-5 pt-5 border-t border-gray-200/60 flex flex-col sm:flex-row gap-2.5">
        {onGoToConsultation && (
          <button
            onClick={onGoToConsultation}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-slate-700 text-sm font-bold hover:bg-gray-50 transition-all active:scale-[0.97]"
          >
            1 · Vérifier la consultation <ArrowRight size={14} />
          </button>
        )}
        {onStartDepouillement && (
          <button
            onClick={onStartDepouillement}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
          >
            <Plus size={14} /> 2 · Démarrer le dépouillement
          </button>
        )}
      </div>
    </div>
  </div>
);

export default RaoOrientationPanel;
