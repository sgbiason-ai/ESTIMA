// src/components/rao/tabs/nego/AnomalyControls.jsx
//
// Cluster de contrôle "Prix atypiques" de la toolbar : bouton d'injection,
// réglage des seuils (écart / impact) et éditeurs des textes injectés.

import React, { useState } from 'react';
import { Wand2, SlidersHorizontal, X, Info, Edit3, CheckCircle2 } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { DEFAULT_LOW_TEMPLATE, DEFAULT_HIGH_TEMPLATE } from './negoTemplates';

const AnomalyControls = ({ onInject, thresholds, setThresholds, templates, onSaveTemplates }) => {
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  return (
    <div className="flex items-center gap-1.5 relative">
      <button
        onClick={onInject}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
        title="Détecter et injecter les prix atypiques (hauts et bas) dans l'aperçu"
      >
        <Wand2 size={14} />
        Prix atypiques
      </button>
      <button
        onClick={() => setShowThresholdSettings(v => !v)}
        className={`p-1.5 rounded-lg border transition-all ${showThresholdSettings ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
        title="Réglages des seuils de détection et modèles de texte"
      >
        <SlidersHorizontal size={14} />
      </button>

      {/* Popover réglages anomalies */}
      {showThresholdSettings && (
        <div className={`absolute top-full left-0 mt-2 ${showTemplateEditor ? 'w-[720px]' : 'w-80'} bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-5 space-y-4 transition-all ${showTemplateEditor ? 'max-h-[85vh] overflow-y-auto' : ''}`}>
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-indigo-500" />
              Paramètres « Prix atypiques »
            </h5>
            <button onClick={() => setShowThresholdSettings(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X size={14} />
            </button>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Un prix est signalé comme <strong>atypique</strong> si les <strong>2 conditions</strong> sont remplies simultanément :
                le PU s'écarte de plus de <strong>{thresholds.ecart}%</strong> de la moyenne des offres,
                ET le montant de la ligne représente plus de <strong>{thresholds.impact}%</strong> du total HT de l'entreprise.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Écart par rapport à la moyenne</label>
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{thresholds.ecart}%</span>
              </div>
              <input
                type="range" min={5} max={50} step={1}
                value={thresholds.ecart}
                onChange={e => setThresholds(prev => ({ ...prev, ecart: Number(e.target.value) }))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>5% (sensible)</span>
                <span>50% (tolérant)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Impact sur l'offre totale</label>
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{thresholds.impact}%</span>
              </div>
              <input
                type="range" min={0.25} max={5} step={0.25}
                value={thresholds.impact}
                onChange={e => setThresholds(prev => ({ ...prev, impact: Number(e.target.value) }))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>0.25% (sensible)</span>
                <span>5% (tolérant)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => { setThresholds({ ecart: 15, impact: 1 }); }}
            className="w-full text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
          >
            Réinitialiser seuils (15% / 1%)
          </button>

          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setShowTemplateEditor(v => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-indigo-600 py-1.5 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Edit3 size={13} className="text-indigo-500" />
                Modèles de texte injectés
              </span>
              <span className="text-[10px] font-normal text-slate-400">{showTemplateEditor ? 'Masquer' : 'Éditer'}</span>
            </button>

            {showTemplateEditor && (
              <div className="mt-2 space-y-3 [&_.ql-editor]:min-h-[240px] [&_.ql-editor]:max-h-[360px] [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:text-[12px] [&_.ql-editor]:leading-relaxed [&_.ql-editor]:p-3 [&_.ql-container]:bg-slate-50 [&_.ql-toolbar]:bg-slate-50 [&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-lg [&_.ql-toolbar]:border-slate-200 [&_.ql-container]:border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Texte « Prix anormalement bas »</label>
                    <button
                      onClick={() => onSaveTemplates({ ...templates, low: DEFAULT_LOW_TEMPLATE })}
                      className="text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                      title="Restaurer le texte par défaut"
                    >
                      Réinitialiser
                    </button>
                  </div>
                  <ReactQuill
                    theme="snow"
                    value={templates.low}
                    onChange={(html) => onSaveTemplates({ ...templates, low: html })}
                    modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }], ['clean']] }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Texte « Prix excessifs »</label>
                    <button
                      onClick={() => onSaveTemplates({ ...templates, high: DEFAULT_HIGH_TEMPLATE })}
                      className="text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                      title="Restaurer le texte par défaut"
                    >
                      Réinitialiser
                    </button>
                  </div>
                  <ReactQuill
                    theme="snow"
                    value={templates.high}
                    onChange={(html) => onSaveTemplates({ ...templates, high: html })}
                    modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }], ['clean']] }}
                  />
                </div>
                <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-700 leading-relaxed">
                    Sauvegarde automatique dans le navigateur. La liste des articles concernés est ajoutée à la fin de chaque texte lors de l'injection.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnomalyControls;
