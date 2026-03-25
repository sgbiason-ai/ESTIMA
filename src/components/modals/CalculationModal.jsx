// src/components/modals/CalculationModal.jsx
import React, { useState } from 'react';
import { Calculator, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';

export default function CalculationModal({ show, onClose, onConfirm, analysis }) {
  // Par défaut, on propose +10% d'augmentation sur les lignes variables
  const [appliedPercent, setAppliedPercent] = useState(10);

  if (!show || !analysis) return null; 

  // 1. Calcul de la part "Intouchable" (Forfaits fixes + Petites quantités entre -20 et 20)
  const untouchableTotal = analysis.fixedTotal + (analysis.smallQtyTotal || 0);
  
  // 2. Calcul de la part "Variable" (Celle qui va subir l'augmentation)
  const variableBase = analysis.totalStudy - untouchableTotal;

  // 3. Simulation : On applique le pourcentage choisi UNIQUEMENT sur la part variable
  // Exemple : Si variableBase = 1000€ et appliedPercent = 10% -> Augmentation de 100€
  const increaseAmount = variableBase * (Number(appliedPercent) / 100);

  // 4. Résultats projetés
  const newTotal = analysis.totalStudy + increaseAmount;
  
  // Calcul du % d'augmentation global réel
  const globalPercentIncrease = analysis.totalStudy !== 0 
    ? (increaseAmount / analysis.totalStudy) * 100 
    : 0;

  const isImpossible = variableBase === 0; 

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-emerald-600 p-4 flex items-center gap-3 text-white">
          <Calculator size={24} />
          <h2 className="font-black uppercase tracking-widest text-sm">Calculateur de Marge</h2>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                % à appliquer sur les lignes variables
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={appliedPercent} 
                onChange={(e) => setAppliedPercent(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-bold text-emerald-600 outline-none focus:border-emerald-500"
                autoFocus
                step="0.1"
              />
              <span className="text-xl font-black text-slate-300">%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
                Ce pourcentage s'appliquera aux quantités supérieures à 20 ou inférieures à -20.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-xs space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Étude (Actuel) :</span>
              <span className="font-mono font-bold">{formatPrice(analysis.totalStudy)}</span>
            </div>
            
             {/* Affichage de la part variable qui sera impactée */}
             <div className="flex justify-between text-slate-500 italic">
              <span>Dont part variable :</span>
              <span>{formatPrice(variableBase)}</span>
            </div>

            <div className="h-px bg-slate-200 my-2"></div>

            <div className="flex justify-between">
              <span className="text-slate-700 font-bold">Nouveau Total Client :</span>
              <span className="font-mono font-bold text-emerald-600">{formatPrice(newTotal)}</span>
            </div>
          </div>

          {!isImpossible ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
              <div className="mt-0.5 text-blue-500"><ArrowRight size={16} /></div>
              <div>
                <p className="text-xs text-blue-800 font-bold mb-1">Impact Global</p>
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  En appliquant <strong>{appliedPercent}%</strong> sur les lignes variables, votre budget global augmentera de <strong>{globalPercentIncrease.toFixed(2)}%</strong>.
                </p>
              </div>
            </div>
          ) : (
             <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs font-bold flex gap-2">
               <AlertTriangle size={16} />
               Aucune ligne variable détectée (toutes les quantités sont entre -20 et 20 ou figées).
             </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg">Annuler</button>
          <button 
            disabled={isImpossible}
            onClick={() => onConfirm(Number(appliedPercent))} 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wide rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Appliquer {appliedPercent}%
          </button>
        </div>
      </div>
    </div>
  );
}