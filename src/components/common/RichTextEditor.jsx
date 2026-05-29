import React, { useEffect, useRef, useState } from 'react';
import { Bold, Underline, List, Type, ImagePlus, Loader2 } from 'lucide-react';
import {
  extractImageFiles, addPhotos, getCleanDescriptionHtml, decoratePhotoGrid, tryDeletePhoto,
} from '../../utils/editorImages';

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
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

  // Synchronise la valeur entrante → DOM (sauf pendant l'édition) puis décore les photos.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || document.activeElement === el) return;
    if (value !== getCleanDescriptionHtml(el)) el.innerHTML = value || "";
    decoratePhotoGrid(el);
  }, [value]);

  const propagate = () => {
    if (editorRef.current && onChange) onChange(getCleanDescriptionHtml(editorRef.current));
    updateToolbar();
  };

  const executeCommand = (command) => {
    document.execCommand(command, false, null);
    if (editorRef.current) {
      editorRef.current.focus();
      propagate();
    }
  };

  const handleInput = () => propagate();

  // ── Photos (drag-drop / coller / bouton) ───────────────────────────────────
  const doInsertImages = async (files) => {
    if (!files || !files.length || !editorRef.current) return;
    setBusy(true);
    try {
      await addPhotos(editorRef.current, files);
      propagate();
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e) => {
    const files = extractImageFiles(e);
    setIsDragging(false);
    if (!files.length) return;
    e.preventDefault();
    doInsertImages(files);
  };

  const handleDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      if (!isDragging) setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handlePaste = (e) => {
    const files = extractImageFiles(e);
    if (!files.length) return;
    e.preventDefault();
    doInsertImages(files);
  };

  const handlePickFiles = (e) => {
    if (e.target.files?.length) doInsertImages(e.target.files);
    e.target.value = '';
  };

  // Clic sur ✕ d'une photo → suppression
  const handleClick = (e) => {
    if (tryDeletePhoto(e.target, editorRef.current)) {
      e.preventDefault();
      propagate();
    }
  };

  const getBtnClass = (isActive) => `
    p-2 rounded transition-all duration-200 border flex items-center justify-center
    ${isActive
      ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner'
      : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200'}
  `;

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

          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Photo : glisser-déposer, coller, ou ce bouton (toujours regroupées en bas) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={getBtnClass(false)}
            title="Ajouter une photo (ou glisser-déposer / coller) — regroupées en bas"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} strokeWidth={baseStroke} />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePickFiles} />

          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2 pointer-events-none opacity-60">
             <Type size={12} strokeWidth={3} /> Éditeur Visuel
          </div>
        </div>

        {/* ZONE D'ÉDITION */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            onKeyUp={updateToolbar}
            onMouseUp={updateToolbar}
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onPaste={handlePaste}
            className="w-full flex-1 p-4 text-sm text-slate-900 outline-none overflow-y-auto leading-relaxed wysiwyg-content bg-white"
            style={{ minHeight: '150px' }}
            placeholder={placeholder}
          />

          {/* Overlay de dépôt */}
          {isDragging && (
            <div className="absolute inset-2 rounded-lg border-2 border-dashed border-emerald-500 bg-emerald-50/80 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ImagePlus size={18} /> Déposez la photo ici
              </div>
            </div>
          )}
        </div>
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
        .wysiwyg-content img { max-width: 100%; height: auto; }
        .wysiwyg-content .bpu-photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .wysiwyg-content .bpu-photo { position: relative; flex: 1 1 calc(50% - 3px); min-width: 0; margin: 0; }
        .wysiwyg-content .bpu-photo img { width: 100%; height: auto; display: block; border-radius: 6px; }
        .wysiwyg-content .bpu-photo-del {
          position: absolute; top: 6px; right: 6px;
          width: 24px; height: 24px; border-radius: 9999px; padding: 0;
          background: rgba(15,23,42,.72); color: #fff; border: none; cursor: pointer;
          font-size: 12px; line-height: 1; display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .15s; z-index: 2;
        }
        .wysiwyg-content .bpu-photo:hover .bpu-photo-del { opacity: 1; }
        .wysiwyg-content .bpu-photo-del:hover { background: #ef4444; }
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
