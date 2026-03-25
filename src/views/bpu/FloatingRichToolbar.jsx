import React, { useState, useCallback, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Strikethrough, Undo2 } from 'lucide-react';

// ── ACTIONS DE LA BARRE ───────────────────────────────────────────────────────
const TOOLBAR_ACTIONS = [
  { cmd: 'bold',                icon: Bold,          title: 'Gras (Ctrl+B)',            group: 1 },
  { cmd: 'italic',              icon: Italic,         title: 'Italique (Ctrl+I)',         group: 1 },
  { cmd: 'underline',           icon: Underline,      title: 'Souligné (Ctrl+U)',         group: 1 },
  { cmd: 'strikeThrough',       icon: Strikethrough,  title: 'Barré',                    group: 1 },
  { cmd: 'insertUnorderedList', icon: List,           title: 'Liste à puces',            group: 2 },
  { cmd: 'insertOrderedList',   icon: ListOrdered,    title: 'Liste numérotée',          group: 2 },
  { cmd: 'removeFormat',        icon: Undo2,          title: 'Effacer la mise en forme', group: 3 },
];

// ── COMPOSANT ─────────────────────────────────────────────────────────────────
// Rendu UNE SEULE FOIS en dehors de la boucle des articles.
// position: fixed → jamais remontée, ne perturbe pas le focus.

const FloatingRichToolbar = ({
  targetRef,
  visible,
  itemLabel,
  onSave,
  onReset,
  hasOverride,
  primary,
}) => {
  const [activeFormats, setActiveFormats] = useState({});

  const updateActiveFormats = useCallback(() => {
    const formats = {};
    TOOLBAR_ACTIONS.forEach((a) => {
      try { formats[a.cmd] = document.queryCommandState(a.cmd); } catch {}
    });
    setActiveFormats(formats);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats);
    return () => document.removeEventListener('selectionchange', updateActiveFormats);
  }, [updateActiveFormats]);

  const exec = (cmd) => {
    if (targetRef.current) targetRef.current.focus();
    document.execCommand(cmd, false, null);
    updateActiveFormats();
  };

  // Regrouper les actions par groupe pour afficher des séparateurs
  const groups = [];
  let currentGroup = null;
  TOOLBAR_ACTIONS.forEach((a) => {
    if (a.group !== currentGroup) { groups.push([]); currentGroup = a.group; }
    groups[groups.length - 1].push(a);
  });

  return (
    <div
      className="print:hidden"
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        zIndex: 9999,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-12px)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className="flex items-center gap-2 bg-slate-900 rounded-2xl shadow-2xl px-3 py-2"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
      >
        {/* Label article actif */}
        {itemLabel && (
          <>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide max-w-[180px] truncate pl-1">
              {itemLabel}
            </span>
            <div className="w-px h-4 bg-slate-700 mx-1" />
          </>
        )}

        {/* Boutons de formatage */}
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="w-px h-4 bg-slate-700 mx-0.5" />}
            {group.map(({ cmd, icon: Icon, title }) => (
              <button
                key={cmd}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
                title={title}
                className={`p-1.5 rounded-lg transition-colors ${
                  activeFormats[cmd]
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={13} />
              </button>
            ))}
          </React.Fragment>
        ))}

        <div className="w-px h-4 bg-slate-700 mx-1" />

        {/* Réinitialiser (visible seulement si override actif) */}
        {hasOverride && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onReset?.(); }}
            title="Réinitialiser le texte d'origine"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-amber-400 hover:bg-amber-400/10 transition-colors"
          >
            <Undo2 size={12} />
            Réinitialiser
          </button>
        )}

        {/* Valider */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSave?.(); }}
          title="Valider la modification"
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-bold text-white transition-colors"
          style={{ backgroundColor: primary || '#286E55' }}
        >
          Valider
        </button>
      </div>
    </div>
  );
};

export default FloatingRichToolbar;
