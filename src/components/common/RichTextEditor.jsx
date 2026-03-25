import React, { useEffect, useRef, useState } from 'react';
import { Bold, Underline, List, Type } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);
  
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    underline: false,
    insertUnorderedList: false
  });

  const updateToolbar = () => {
    if (typeof document !== 'undefined') {
      setActiveStyles({
        bold: document.queryCommandState('bold'),
        underline: document.queryCommandState('underline'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      });
    }
  };

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const executeCommand = (command) => {
    document.execCommand(command, false, null);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput(); 
      updateToolbar();
    }
  };

  const handleInput = () => {
    if (editorRef.current && onChange) {
      const html = editorRef.current.innerHTML;
      onChange(html === '<br>' ? '' : html);
    }
    updateToolbar();
  };

  // --- CHANGEMENT ICI : COULEUR PLUS FONCÉE ---
  const getBtnClass = (isActive) => `
    p-2 rounded transition-all duration-200 border flex items-center justify-center
    ${isActive 
      ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner' // Actif (Vert)
      // Inactif : text-slate-900 (Quasi noir) au lieu de slate-700
      : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200'} 
  `;

  // --- CHANGEMENT ICI : ÉPAISSEUR DU TRAIT AUGMENTÉE ---
  // Je passe l'épaisseur de base de 2/2.5 à 3 pour qu'elles soient bien nettes.
  const baseStroke = 3;
  const activeStroke = 3.5;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="border border-slate-300 rounded-md overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all flex flex-col h-full">
        
        {/* BARRE D'OUTILS */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-2 shrink-0 items-center select-none">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('bold'); }} className={getBtnClass(activeStyles.bold)} title="Gras">
            <Bold size={16} strokeWidth={activeStyles.bold ? activeStroke : baseStroke} />
          </button>

          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('underline'); }} className={getBtnClass(activeStyles.underline)} title="Souligné">
            <Underline size={16} strokeWidth={activeStyles.underline ? activeStroke : baseStroke} />
          </button>

          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('insertUnorderedList'); }} className={getBtnClass(activeStyles.insertUnorderedList)} title="Liste à puces">
            <List size={16} strokeWidth={activeStyles.insertUnorderedList ? activeStroke : baseStroke} />
          </button>
          
          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2 pointer-events-none opacity-60">
             <Type size={12} strokeWidth={3} /> Éditeur Visuel
          </div>
        </div>

        {/* ZONE D'ÉDITION */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          onKeyUp={updateToolbar}
          onMouseUp={updateToolbar}
          className="w-full flex-1 p-4 text-sm text-slate-900 outline-none overflow-y-auto leading-relaxed wysiwyg-content bg-white"
          style={{ minHeight: '150px' }}
          placeholder={placeholder}
        />
      </div>
      
      <style>{`
        .wysiwyg-content {
          color: #0f172a !important; 
        }
        .wysiwyg-content ul {
          display: block !important;
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .wysiwyg-content li { display: list-item !important; margin-bottom: 0.25rem !important; }
        .wysiwyg-content b, .wysiwyg-content strong {
          font-weight: 800 !important;
          color: #059669 !important; 
        }
        .wysiwyg-content:empty:before {
          content: attr(placeholder);
          color: #94a3b8;
          font-style: italic;
          display: block;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;