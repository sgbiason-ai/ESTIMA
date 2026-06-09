import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, Maximize2, Minimize2,
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Eraser, Braces
} from 'lucide-react';
import { sanitizePastedHtml, escapeTextToHtml } from '../../utils/htmlPasteSanitizer';

const VARIABLE_LABELS = {
  name:               "Nom de l'opération",
  client:             "Client / MOA",
  clientAddress:      "Adresse (Rue)",
  clientZip:          "Code Postal",
  clientCity:         "Ville",
  location:           "Lieu de réalisation",
  code:               "Code Affaire",
  moe:                "Maître d'Œuvre (MOE)",
  moeAddress:         "Adresse MOE",
  phase:              "Phase",
  marketType:         "Type de Marché",
  dateRemise:         "Date de remise offre",
  timeRemise:         "Heure de remise offre",
  duration:           "Durée Travaux",
  prepPeriod:         "Période de Préparation",
  projectDescription: "Description du projet",
  hasPSE:             "PSE (comporte / ne comporte pas)",
  trancheCount:       "Nombre de tranches",
  trancheNames:       "Liste des tranches (à puces)",
  department:         "Département",
  lotName:            "Intitulé du lot",
  spsLevel:           "Niveau coordination SPS",
  startDate:          "Démarrage prévisionnel",
  validityDays:       "Validité des offres (jours)",
  platformUrl:        "Plateforme de dématérialisation",
  criteresTable:      "Tableau des critères (RAO)",
};

const ChapterEditorModal = ({ isOpen, onClose, node, onSave, availableVariables }) => {
  const [title, setTitle] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => {
    if (node && isOpen) {
      setTitle(node.title || '');
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = node.content || '';
        }
      }, 0);
    }
  }, [node, isOpen]);

  const handleSave = () => {
    if (editorRef.current) {
      onSave(node.id, {
        title,
        content: editorRef.current.innerHTML
      });
    }
    onClose();
  };

  const execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  // Collage nettoyé : on conserve la structure (titres, listes, tableaux, gras…)
  // mais on retire polices, tailles, couleurs et styles inline (Word / Google Docs / web).
  const handlePaste = (e) => {
    e.preventDefault();
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    const clean = html ? sanitizePastedHtml(html) : escapeTextToHtml(text);
    if (clean) {
      document.execCommand('insertHTML', false, clean);
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isFullScreen ? 'w-[98vw] h-[95vh]' : 'w-full max-w-5xl h-[85vh]'}`}
      >
        {/* --- EN-TÊTE --- */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex-1 mr-4">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Titre du chapitre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-lg font-bold text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors"
              placeholder="Titre du chapitre..."
            />
          </div>

          <div className="flex items-center gap-2">
            <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
                title={isFullScreen ? "Réduire" : "Plein écran"}
            >
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-red-500 hover:bg-white border border-transparent hover:border-red-200 rounded-lg transition-all"
            >
                <X size={24} />
            </button>
          </div>
        </div>

        {/* --- BARRE D'OUTILS --- */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto">
            <ToolbarBtn onClick={() => execCmd('formatBlock', 'H3')} icon={<Heading1 size={18} />} label="Titre 1" />
            <ToolbarBtn onClick={() => execCmd('formatBlock', 'H4')} icon={<Heading2 size={16} />} label="Titre 2" />
            <ToolbarBtn onClick={() => execCmd('formatBlock', 'P')} icon={<span className="text-[11px] font-bold px-0.5">¶</span>} label="Paragraphe (texte normal)" />
            <div className="w-px h-6 bg-slate-300 mx-2"></div>
            <ToolbarBtn onClick={() => execCmd('bold')} icon={<Bold size={16} />} label="Gras" />
            <ToolbarBtn onClick={() => execCmd('italic')} icon={<Italic size={16} />} label="Italique" />
            <ToolbarBtn onClick={() => execCmd('underline')} icon={<Underline size={16} />} label="Souligné" />
            <div className="w-px h-6 bg-slate-300 mx-2"></div>
            <ToolbarBtn onClick={() => execCmd('insertUnorderedList')} icon={<List size={16} />} label="Liste" />
            <ToolbarBtn onClick={() => execCmd('insertOrderedList')} icon={<ListOrdered size={16} />} label="Numérotation" />
            <div className="w-px h-6 bg-slate-300 mx-2"></div>
            <ToolbarBtn onClick={() => execCmd('justifyLeft')} icon={<AlignLeft size={16} />} label="Gauche" />
            <ToolbarBtn onClick={() => execCmd('justifyCenter')} icon={<AlignCenter size={16} />} label="Centré" />
            <ToolbarBtn onClick={() => execCmd('justifyRight')} icon={<AlignRight size={16} />} label="Droite" />
            <ToolbarBtn onClick={() => execCmd('justifyFull')} icon={<AlignJustify size={16} />} label="Justifié" />
            <div className="w-px h-6 bg-slate-300 mx-2"></div>

            {/* INSERTION VARIABLE */}
            <div className="relative group">
                <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 cursor-pointer">
                    <Braces size={14} />
                    <span className="text-xs font-bold">Var</span>
                    {/* Select invisible par dessus pour gérer le clic */}
                    <select
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                            if(e.target.value) execCmd('insertText', `{{${e.target.value}}}`);
                            e.target.value="";
                        }}
                    >
                        <option value="">Insérer une variable...</option>
                        {availableVariables && Object.keys(availableVariables).map(k => (
                            <option key={k} value={k}>{VARIABLE_LABELS[k] || k}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="w-px h-6 bg-slate-300 mx-2"></div>
            <ToolbarBtn onClick={() => execCmd('removeFormat')} icon={<Eraser size={16} />} label="Nettoyer le format" />
        </div>

        {/* --- ZONE ÉDITEUR (NATIVE) --- */}
        <div className="flex-1 overflow-y-auto bg-white relative editor-wrapper cursor-text" onClick={() => editorRef.current?.focus()}>
            <div
                ref={editorRef}
                contentEditable
                onPaste={handlePaste}
                className="outline-none min-h-full p-12 text-slate-800 font-sans"
                suppressContentEditableWarning={true}
            />
        </div>

        {/* --- PIED DE PAGE --- */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <p className="text-xs text-slate-400 italic">
            <span className="font-bold text-emerald-600">Astuce :</span> Le collage depuis Word / Google Docs est automatiquement nettoyé (structure conservée, polices et couleurs retirées). Bouton "Var" pour insérer des champs dynamiques.
          </p>
          <div className="flex gap-3">
            <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
            >
                Annuler
            </button>
            <button
                onClick={handleSave}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
            >
                <Save size={18} /> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .editor-wrapper { font-size: 15px; line-height: 1.6; }
        .editor-wrapper table { width: 100%; border-collapse: collapse; margin: 1em 0; table-layout: fixed; }
        .editor-wrapper td, .editor-wrapper th { border: 1px solid #cbd5e1; padding: 6px 10px; min-width: 30px; vertical-align: top; position: relative; font-size: 14px; }
        .editor-wrapper th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        .editor-wrapper ul { list-style-type: disc; padding-left: 1.5em; margin: 0.6em 0; }
        .editor-wrapper ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.6em 0; }
        .editor-wrapper li { margin-bottom: 0.2em; }
        .editor-wrapper p { margin: 0 0 0.6em; }
        /* Titres à taille FIXE et modérée — restent éditables, jamais géants */
        .editor-wrapper h1, .editor-wrapper h3 { font-size: 18px; line-height: 1.3; font-weight: 700; color: #1e293b; margin: 0.9em 0 0.4em; }
        .editor-wrapper h2, .editor-wrapper h4 { font-size: 16px; line-height: 1.3; font-weight: 700; color: #334155; margin: 0.8em 0 0.4em; }
        .editor-wrapper h5, .editor-wrapper h6 { font-size: 15px; line-height: 1.3; font-weight: 700; color: #475569; margin: 0.7em 0 0.3em; }
        .editor-wrapper [align="justify"] { text-align: justify; }
      `}</style>
    </div>
  );
};

const ToolbarBtn = ({ onClick, icon, label }) => (
  <button onClick={onClick} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title={label}>
    {icon}
  </button>
);

export default ChapterEditorModal;
