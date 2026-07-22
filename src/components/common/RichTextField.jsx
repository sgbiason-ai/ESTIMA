// src/components/common/RichTextField.jsx
//
// Champ d'édition WYSIWYG léger — approche contentEditable + execCommand.
// Outils : Gras, Italique, Souligné, Liste à puces, Liste numérotée.
//
// Format des données : HTML minimaliste stocké dans une string.
// Compat entrée : si `value` ne contient pas de balise HTML, on la traite comme
// du texte plain (retours à la ligne préservés via <br>). Bénéfice : le champ
// migre en douceur quand il est passé d'un <Textarea> à ce composant.

import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';

// Sanitize minimaliste : retire les balises <script>, <style>, tags media et les
// attributs event handlers (on*). Suffisant pour un contenu saisi par l'analyste
// (pas de vecteur externe), pas un remplacement de DOMPurify.
// Retire les caracteres invisibles/parasites (zero-width, BOM, separateurs LINE/PARA...)
// qui polluent le texte quand on colle depuis Word/Outlook et cassent le rendu PDF.
// Traite AUSSI les separateurs de LIGNE/PARA Unicode (U+2028/U+2029) -> newlines.
const stripInvisible = (s) =>
  String(s || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFFF9-\uFFFB]/g, '')
    .replace(/[\u2028-\u2029]/g, '\n');

const sanitizeHtml = (html) => {
  if (typeof document === 'undefined' || !html) return String(html || '');
  const tpl = document.createElement('template');
  tpl.innerHTML = stripInvisible(html);
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];
  let node = walker.nextNode();
  while (node) {
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'].includes(tag)) {
      toRemove.push(node);
    } else {
      // Strip on* attributes
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.toLowerCase().startsWith('on')) node.removeAttribute(attr.name);
        if (attr.name.toLowerCase() === 'href' && String(attr.value).toLowerCase().startsWith('javascript:')) {
          node.removeAttribute(attr.name);
        }
      }
    }
    node = walker.nextNode();
  }
  toRemove.forEach(n => n.parentNode?.removeChild(n));
  return tpl.innerHTML;
};

// Détecte si `value` contient déjà du HTML (au moins une balise reconnue) — sinon
// on l'affiche comme du texte plain avec <br> pour les retours à la ligne.
const isHtml = (v) => typeof v === 'string' && /<[a-z][^>]*>/i.test(v);

const toEditorHtml = (value) => {
  if (!value) return '';
  if (isHtml(value)) return sanitizeHtml(value);
  // Plain text → HTML minimal (préserve les retours à la ligne)
  return sanitizeHtml(
    String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  );
};

// Styles du contenu riche — partagés éditeur (RichTextField) et lecture seule
// (RichTextView) : le rendu doit être identique dans les deux contextes.
const RICH_CONTENT_CSS = `
  .rich-text-field ul { display: block; list-style-type: disc; padding-left: 1.5rem; margin: 0.35rem 0; }
  .rich-text-field ol { display: block; list-style-type: decimal; padding-left: 1.5rem; margin: 0.35rem 0; }
  .rich-text-field li { display: list-item; margin-bottom: 0.2rem; }
  .rich-text-field b, .rich-text-field strong { font-weight: 700; }
  .rich-text-field i, .rich-text-field em { font-style: italic; }
  .rich-text-field u { text-decoration: underline; }
`;

// Affichage lecture seule d'un contenu saisi au RichTextField (compatible texte
// plain hérité : retours à la ligne → <br>). Sanitize identique à l'éditeur.
export const RichTextView = ({ value, className = '' }) => {
  const html = toEditorHtml(value);
  if (!html) return null;
  return (
    <>
      <div className={`rich-text-field ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
      <style>{RICH_CONTENT_CSS}</style>
    </>
  );
};

const RichTextField = ({
  value,
  onChange,
  placeholder = '',
  rows = 6,
  className = '',
  id,
}) => {
  const editorRef = useRef(null);
  const lastEmitted = useRef('');
  const [active, setActive] = useState({
    bold: false, italic: false, underline: false,
    ul: false, ol: false,
  });

  const refreshToolbar = () => {
    if (typeof document === 'undefined') return;
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      ul: document.queryCommandState('insertUnorderedList'),
      ol: document.queryCommandState('insertOrderedList'),
    });
  };

  // Sync valeur entrante → DOM (sauf pendant l'édition pour ne pas casser le caret)
  useEffect(() => {
    const el = editorRef.current;
    if (!el || document.activeElement === el) return;
    const incoming = toEditorHtml(value);
    if (incoming !== el.innerHTML) {
      el.innerHTML = incoming;
      lastEmitted.current = incoming;
    }
  }, [value]);

  const emit = () => {
    const el = editorRef.current;
    if (!el || !onChange) return;
    const html = sanitizeHtml(el.innerHTML);
    if (html !== lastEmitted.current) {
      lastEmitted.current = html;
      onChange(html);
    }
    refreshToolbar();
  };

  const cmd = (command) => {
    // Utilise l'API contentEditable historique — largement supportée pour ces 5
    // opérations, malgré le "deprecated" nominal ; pas d'alternative simple sans
    // dépendance lourde (Quill, TipTap…).
    document.execCommand(command, false, null);
    editorRef.current?.focus();
    emit();
  };

  const Btn = ({ isActive, onClick, title, children }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-md border transition-all flex items-center justify-center ${
        isActive
          ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-emerald-300'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all ${className}`}>
      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex gap-1 items-center">
        <Btn isActive={active.bold} onClick={() => cmd('bold')} title="Gras (Ctrl+B)"><Bold size={14} strokeWidth={active.bold ? 3.5 : 2.5} /></Btn>
        <Btn isActive={active.italic} onClick={() => cmd('italic')} title="Italique (Ctrl+I)"><Italic size={14} strokeWidth={active.italic ? 3.5 : 2.5} /></Btn>
        <Btn isActive={active.underline} onClick={() => cmd('underline')} title="Souligné (Ctrl+U)"><Underline size={14} strokeWidth={active.underline ? 3.5 : 2.5} /></Btn>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <Btn isActive={active.ul} onClick={() => cmd('insertUnorderedList')} title="Liste à puces"><List size={14} strokeWidth={active.ul ? 3.5 : 2.5} /></Btn>
        <Btn isActive={active.ol} onClick={() => cmd('insertOrderedList')} title="Liste numérotée"><ListOrdered size={14} strokeWidth={active.ol ? 3.5 : 2.5} /></Btn>
      </div>

      <div
        id={id}
        ref={editorRef}
        contentEditable
        onInput={emit}
        onBlur={emit}
        onKeyUp={refreshToolbar}
        onMouseUp={refreshToolbar}
        // Coller sans styles importés (retire fonts, couleurs Word/Google Docs)
        onPaste={(e) => {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        data-placeholder={placeholder}
        className="w-full px-4 py-3 text-[14px] text-slate-900 outline-none overflow-y-auto leading-relaxed rich-text-field"
        style={{ minHeight: `${Math.max(3, rows) * 1.6}em` }}
      />

      <style>{`
        ${RICH_CONTENT_CSS}
        .rich-text-field:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default RichTextField;
