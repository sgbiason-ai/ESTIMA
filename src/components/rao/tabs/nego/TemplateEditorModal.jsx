// src/components/rao/tabs/nego/TemplateEditorModal.jsx
//
// Modale d'édition de la trame globale du courrier (WYSIWYG Quill + insertion
// de variables). La trame est partagée par toutes les entreprises du projet.

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Copy, X, Save, Settings, Maximize, Minimize } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { AVAILABLE_VARIABLES } from './negoTemplates';

const TemplateEditorModal = ({ isOpen, onClose, initialHtml, onSaveTemplate, variableValues = {} }) => {
  const [editorHtml, setEditorHtml] = useState(initialHtml);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedVar, setCopiedVar] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setEditorHtml(initialHtml);
      setIsFullscreen(false);
    }
  }, [isOpen, initialHtml]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveTemplate(editorHtml);
    onClose();
  };

  const copyVariable = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedVar(tag);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-modal bg-slate-100 flex flex-col animate-in fade-in duration-200"
    : "fixed inset-0 z-modal flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4";

  const modalClasses = isFullscreen
    ? "bg-white w-full h-full flex flex-col shadow-2xl"
    : "bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200";

  return (
    <div className={containerClasses}>
      <div className={modalClasses}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900">Éditer le Modèle Global</h3>
              <p className="text-sm font-medium text-slate-600">
                Modifiez la trame et intégrez les variables du projet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
              title={isFullscreen ? "Réduire" : "Plein écran"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50">
          <div className="flex-1 flex flex-col bg-white [&_.ql-editor]:text-black [&_.ql-editor]:text-[15px] [&_.ql-editor]:leading-relaxed overflow-hidden">
            <ReactQuill
              theme="snow"
              value={editorHtml}
              onChange={setEditorHtml}
              className="flex-1 flex flex-col h-full text-black"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  [{ 'align': [] }],
                  ['clean']
                ],
              }}
            />
          </div>

          <div className="w-72 bg-slate-50 border-l border-slate-200 p-5 overflow-y-auto shrink-0 shadow-inner">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1">Insérer une variable</h4>
            <p className="text-[10px] text-slate-500 mb-6 leading-tight">
              Cliquez sur une étiquette pour la copier, puis collez-la (Ctrl+V) dans votre texte.
            </p>
            <div className="flex flex-col gap-2">
              {AVAILABLE_VARIABLES.map(v => {
                const value = variableValues[v.tag];
                const hasValue = value != null && String(value).trim() !== '';
                return (
                  <button
                    key={v.tag}
                    onClick={() => copyVariable(v.tag)}
                    className={`flex flex-col text-left px-3 py-2 bg-white border rounded-xl hover:border-amber-400 hover:shadow-sm focus:bg-amber-50 focus:border-amber-500 transition-all group ${
                      hasValue ? 'border-slate-200' : 'border-slate-200 opacity-70'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                      {v.label}
                    </span>
                    {/* Valeur actuelle résolue (ou tiret si non renseigné) */}
                    <span className={`text-[12px] font-bold mt-0.5 leading-snug whitespace-pre-line ${
                      hasValue ? 'text-slate-900' : 'text-slate-300 italic'
                    }`}>
                      {hasValue ? String(value) : '— non renseigné —'}
                    </span>
                    {/* Tag mono en dessous */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-mono text-slate-400">{v.tag}</span>
                      {copiedVar === v.tag ? (
                        <CheckCircle2 size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-sm text-slate-600 font-medium">
            Ce modèle sera sauvegardé et utilisé pour générer tous les futurs courriers.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all active:scale-95">
              <Save size={16} />
              Enregistrer la trame
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorModal;
