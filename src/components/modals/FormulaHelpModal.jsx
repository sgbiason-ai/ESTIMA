// src/components/modals/FormulaHelpModal.jsx
import React from 'react';
import { FunctionSquare, X, BookOpen, MousePointerClick, GitBranch, Keyboard } from 'lucide-react';

const FormulaHelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <FunctionSquare size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-white tracking-wide text-sm">Aide — Barre de formule</h2>
              <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">Style Excel · Référencement entre articles</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1 — Syntaxe */}
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <BookOpen size={14} className="text-slate-500 shrink-0" />
              <span className="font-black text-slate-700 text-[11px] uppercase tracking-widest">Syntaxe des formules</span>
            </div>
            <div className="p-4 space-y-3 text-xs text-slate-600">
              <p>Toute formule commence obligatoirement par le signe <code className="bg-slate-100 text-emerald-700 font-mono px-1.5 py-0.5 rounded font-bold">=</code></p>
              <div className="space-y-2">
                {[
                  { expr: '=[FOUILLE EN MASSE] * 1.1', desc: 'Quantité d\'un article × 1.1' },
                  { expr: '=[BÉTON C25] + [BÉTON C30]', desc: 'Somme de deux articles' },
                  { expr: '=([DÉBLAI] - [REMBLAI]) / 2', desc: 'Expression avec parenthèses' },
                  { expr: '=[SURFACE TOTALE] * 0.05', desc: '5 % d\'une autre quantité' },
                ].map(({ expr, desc }) => (
                  <div key={expr} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50">
                    <code className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded whitespace-nowrap">{expr}</code>
                    <span className="text-slate-500 text-[11px] pt-0.5">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">Les opérateurs supportés sont <code className="bg-slate-100 px-1 rounded">+ - * / ( )</code> ainsi que toute expression JavaScript valide.</p>
            </div>
          </div>

          {/* Section 2 — Clic pour insérer */}
          <div className="rounded-xl border border-blue-100 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border-b border-blue-100">
              <MousePointerClick size={14} className="text-blue-500 shrink-0" />
              <span className="font-black text-blue-700 text-[11px] uppercase tracking-widest">Insérer une référence par clic</span>
            </div>
            <div className="p-4 space-y-2 text-xs text-slate-600">
              <ol className="space-y-2 list-none">
                {[
                  'Sélectionnez un article dans le tableau (il se surligne en vert).',
                  'Cliquez sur l\'icône ƒ(x) ou directement sur la barre de formule pour passer en mode édition.',
                  'Tapez = pour commencer votre expression.',
                  'Cliquez sur un autre article du tableau : sa désignation s\'insère automatiquement.',
                  'Ajoutez des opérateurs et d\'autres références au besoin, puis validez.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="text-[11px] leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Section 3 — Tranches */}
          <div className="rounded-xl border border-violet-100 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-violet-50 border-b border-violet-100">
              <GitBranch size={14} className="text-violet-500 shrink-0" />
              <span className="font-black text-violet-700 text-[11px] uppercase tracking-widest">Propagation aux tranches</span>
            </div>
            <div className="p-4 space-y-2 text-xs text-slate-600">
              <p className="text-[11px] leading-relaxed">Lorsque votre projet contient plusieurs <strong>tranches</strong>, une formule saisie dans la barre est automatiquement appliquée à <strong>toutes les tranches simultanément</strong>.</p>
            </div>
          </div>

          {/* Section 4 — Raccourcis */}
          <div className="rounded-xl border border-amber-100 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border-b border-amber-100">
              <Keyboard size={14} className="text-amber-600 shrink-0" />
              <span className="font-black text-amber-700 text-[11px] uppercase tracking-widest">Raccourcis clavier</span>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {[
                  { key: '↵ Entrée', desc: 'Valider et enregistrer la formule' },
                  { key: 'Échap', desc: 'Annuler sans sauvegarder' },
                  { key: 'Clic ƒ(x)', desc: 'Ouvrir / valider la barre de formule' },
                  { key: 'Clic Effacer', desc: 'Supprimer la formule sur toutes les tranches' },
                ].map(({ key, desc }) => (
                  <div key={key} className="flex items-center gap-4 py-1.5 border-b border-slate-50 last:border-0">
                    <kbd className="shrink-0 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md font-mono text-[11px] text-slate-700 shadow-sm">{key}</kbd>
                    <span className="text-[11px] text-slate-600">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wide rounded-lg transition-colors">
            Compris !
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormulaHelpModal;