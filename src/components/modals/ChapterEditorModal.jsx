import React, { useState, useEffect } from 'react';
import {
  X, Save, Maximize2, Minimize2,
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Eraser, Braces, Undo2, Redo2, Table as TableIcon, Link2,
  Highlighter, Indent, Outdent, ChevronDown,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline as TiptapUnderline } from '@tiptap/extension-underline';
import { Highlight as TiptapHighlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';

import { compressImage } from '../../utils/imageCompressor';
import { prompt as uiPrompt } from '../../utils/globalUI';

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

const HL_COLORS = [
  { name: 'Jaune', color: '#fef08a' },
  { name: 'Vert', color: '#bbf7d0' },
  { name: 'Bleu', color: '#bfdbfe' },
  { name: 'Rose', color: '#fbcfe8' },
  { name: 'Orange', color: '#fed7aa' },
];

const ChapterEditorModal = ({ isOpen, onClose, node, onSave, availableVariables }) => {
  const [title, setTitle] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [menu, setMenu] = useState(null); // 'table' | 'hl' | null

  const handleImageUpload = async (files, view, clientX, clientY) => {
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    for (const file of images) {
      try {
        const out = await compressImage(file, 900, 0.72, { withGps: false });
        const src = typeof out === 'string' ? out : out?.src;
        if (!src) continue;
        
        const { schema } = view.state;
        const imgNode = schema.nodes.image.create({ src });
        const tr = view.state.tr;
        if (clientX !== undefined && clientY !== undefined) {
          const pos = view.posAtCoords({ left: clientX, top: clientY });
          if (pos) {
            tr.insert(pos.pos, imgNode);
          } else {
            tr.replaceSelectionWith(imgNode);
          }
        } else {
          tr.replaceSelectionWith(imgNode);
        }
        view.dispatch(tr);
      } catch { /* image ignorée */ }
    }
  };

  const extensions = React.useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      underline: false,
      link: false,
    }),
    TiptapUnderline,
    TiptapHighlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Link.configure({ openOnClick: false }),
    Image.configure({ inline: true, allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ], []);

  const editor = useEditor({
    extensions,
    content: '',
    onUpdate: ({ editor }) => {
      const txt = editor.getText().replace(/ /g, ' ').trim();
      const words = txt ? txt.split(/\s+/).filter(Boolean).length : 0;
      setCounts({ words, chars: txt.length });
    },
    editorProps: {
      attributes: {
        class: 'editor-wrapper outline-none px-16 py-14 min-h-[55vh] text-slate-800 font-sans',
        spellcheck: 'true',
        lang: 'fr'
      },
      handleDrop: function(view, event, slice, moved) {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          handleImageUpload(event.dataTransfer.files, view, event.clientX, event.clientY);
          return true;
        }
        return false;
      },
      handlePaste: function(view, event) {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          handleImageUpload(event.clipboardData.files, view);
          return true;
        }
        return false;
      }
    }
  });

  useEffect(() => {
    if (node && isOpen && editor) {
      setTitle(node.title || '');
      setTimeout(() => {
        editor.commands.setContent(node.content || '');
        const txt = editor.getText().replace(/ /g, ' ').trim();
        const words = txt ? txt.split(/\s+/).filter(Boolean).length : 0;
        setCounts({ words, chars: txt.length });
      }, 0);
    }
  }, [node, isOpen, editor]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const id = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', close); };
  }, [menu]);

  const handleSave = () => {
    if (editor) {
      const html = editor.getHTML();
      onSave(node.id, { title, content: html });
    }
    onClose();
  };

  const insertLink = async () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = await uiPrompt('Adresse du lien (URL)', previousUrl || 'https://');
    
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const applyHighlight = (color) => {
    if (!editor) return;
    if (color === 'transparent') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
    setMenu(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isFullScreen ? 'w-[98vw] h-[95vh]' : 'w-full max-w-5xl h-[88vh]'}`}>

        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex-1 mr-4">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Titre du chapitre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              spellCheck="true"
              lang="fr"
              className="w-full px-3 py-2 text-lg font-bold text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors"
              placeholder="Titre du chapitre..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all" title={isFullScreen ? 'Réduire' : 'Plein écran'}>
              {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-red-500 hover:bg-white border border-transparent hover:border-red-200 rounded-lg transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        {editor && (
        <div className="flex items-stretch flex-wrap gap-y-1 p-2 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white shrink-0">
          <Grp label="Annuler">
            <Btn onClick={() => editor.chain().focus().undo().run()} title="Annuler (Ctrl+Z)"><Undo2 size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} title="Rétablir (Ctrl+Y)"><Redo2 size={16} /></Btn>
          </Grp>
          <Sep />
          <Grp label="Format">
            <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras (Ctrl+B)"><Bold size={16} /></Btn>
            <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique (Ctrl+I)"><Italic size={16} /></Btn>
            <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné (Ctrl+U)"><Underline size={16} /></Btn>
            <div className="relative">
              <Btn active={editor.isActive('highlight')} onClick={() => setMenu(menu === 'hl' ? null : 'hl')} title="Surligner"><Highlighter size={16} /></Btn>
              {menu === 'hl' && (
                <div className="absolute z-20 top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex items-center gap-1.5" onMouseDown={(e) => e.preventDefault()}>
                  {HL_COLORS.map((c) => (
                    <button key={c.color} onClick={() => applyHighlight(c.color)} title={c.name} className="w-6 h-6 rounded-md border border-black/10 hover:scale-110 transition-transform" style={{ background: c.color }} />
                  ))}
                  <button onClick={() => applyHighlight('transparent')} title="Retirer le surlignage" className="w-6 h-6 rounded-md border border-slate-300 bg-white text-slate-400 text-xs flex items-center justify-center hover:bg-slate-50">∅</button>
                </div>
              )}
            </div>
            <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Effacer la mise en forme"><Eraser size={16} /></Btn>
          </Grp>
          <Sep />
          <Grp label="Paragraphe">
            <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces"><List size={16} /></Btn>
            <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée"><ListOrdered size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().liftListItem('listItem').run()} title="Réduire le retrait"><Outdent size={16} /></Btn>
            <Btn onClick={() => editor.chain().focus().sinkListItem('listItem').run()} title="Augmenter le retrait"><Indent size={16} /></Btn>
            <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Aligner à gauche"><AlignLeft size={16} /></Btn>
            <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrer"><AlignCenter size={16} /></Btn>
            <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Aligner à droite"><AlignRight size={16} /></Btn>
            <Btn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justifier"><AlignJustify size={16} /></Btn>
          </Grp>
          <Sep />
          <Grp label="Insertion">
            <div className="relative">
              <Btn active={editor.isActive('table')} onClick={() => setMenu(menu === 'table' ? null : 'table')} title="Tableau">
                <TableIcon size={16} /><ChevronDown size={11} className="-ml-0.5 text-slate-400" />
              </Btn>
              {menu === 'table' && (
                <div className="absolute z-20 top-full left-0 mt-1 py-1 bg-white border border-slate-200 rounded-xl shadow-xl w-48 text-xs" onMouseDown={(e) => e.preventDefault()}>
                  <MenuItem onClick={() => { editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(); setMenu(null); }}>Insérer un tableau 2 × 2</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setMenu(null); }}>Insérer un tableau 3 × 3</MenuItem>
                  <div className="h-px bg-slate-100 my-1" />
                  <MenuItem onClick={() => { editor.chain().focus().addRowAfter().run(); setMenu(null); }}>Ajouter une ligne</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().addColumnAfter().run(); setMenu(null); }}>Ajouter une colonne</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().deleteRow().run(); setMenu(null); }} danger>Supprimer la ligne</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().deleteColumn().run(); setMenu(null); }} danger>Supprimer la colonne</MenuItem>
                  <div className="h-px bg-slate-100 my-1" />
                  <MenuItem onClick={() => { editor.chain().focus().deleteTable().run(); setMenu(null); }} danger>Supprimer le tableau</MenuItem>
                </div>
              )}
            </div>
            <Btn active={editor.isActive('link')} onClick={insertLink} title="Insérer un lien"><Link2 size={16} /></Btn>
            <div className="relative">
              <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 cursor-pointer" title="Insérer une variable">
                <Braces size={14} />
                <span className="text-xs font-bold">Var</span>
                <select
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => { 
                    if (e.target.value) {
                      editor.chain().focus().insertContent(`{{${e.target.value}}}`).run();
                      e.target.value = ''; 
                    }
                  }}
                >
                  <option value="">Insérer une variable...</option>
                  {availableVariables && Object.keys(availableVariables).map((k) => (
                    <option key={k} value={k}>{VARIABLE_LABELS[k] || k}</option>
                  ))}
                </select>
              </div>
            </div>
          </Grp>
        </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-100 py-8 px-4 cursor-text" onClick={() => editor?.commands.focus()}>
          <div className="page-surface mx-auto bg-white shadow-xl rounded-sm border border-slate-200/80 max-w-[820px]">
            <EditorContent editor={editor} />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0 gap-4">
          <p className="text-[11px] text-slate-400 italic hidden sm:block flex-1 min-w-0 truncate">
            Éditeur Tiptap · correcteur orthographique FR actif
          </p>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 tabular-nums" title="Mots et caractères">
              {counts.words} mots · {counts.chars} car.
            </span>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all">
              Annuler
            </button>
            <button onClick={handleSave} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg flex items-center gap-2 transition-all active:scale-95">
              <Save size={18} /> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .editor-wrapper { font-size: 15px; line-height: 1.7; }
        .editor-wrapper .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #cbd5e1;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .editor-wrapper table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
        }
        .editor-wrapper table td,
        .editor-wrapper table th {
          min-width: 1em;
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          font-size: 14px;
        }
        .editor-wrapper table th {
          font-weight: bold;
          text-align: left;
          background-color: #f1f5f9;
        }
        .editor-wrapper ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.6em 0;
        }
        .editor-wrapper ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.6em 0;
        }
        .editor-wrapper li {
          margin-bottom: 0.2em;
        }
        .editor-wrapper p {
          margin: 0 0 0.7em;
        }
        .editor-wrapper a {
          color: #2563eb;
          text-decoration: underline;
        }
        .editor-wrapper img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 0.4em 0;
        }
        .editor-wrapper img.ProseMirror-selectednode {
          outline: 3px solid #6366f1;
        }
        .editor-wrapper table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

const Btn = ({ onClick, title, children, active }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded-md transition-colors flex items-center ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'}`}
  >
    {children}
  </button>
);

const Grp = ({ label, children }) => (
  <div className="flex flex-col items-center px-1.5">
    <div className="flex items-center gap-0.5">{children}</div>
    <span className="text-[8px] uppercase tracking-wider text-slate-400 mt-0.5 select-none">{label}</span>
  </div>
);

const Sep = () => <div className="w-px self-stretch bg-slate-200 mx-1 my-1" />;

const MenuItem = ({ onClick, children, danger }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`block w-full text-left px-3 py-1.5 hover:bg-slate-100 transition-colors ${danger ? 'text-red-500' : 'text-slate-700'}`}
  >
    {children}
  </button>
);

export default ChapterEditorModal;
