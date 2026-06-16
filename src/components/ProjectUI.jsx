import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, ArrowLeftRight, ChevronDown, Search, AlertTriangle, FileText } from 'lucide-react';
import RichTextEditor from './common/RichTextEditor';

// --- LE COMPOSANT MANQUANT (A AJOUTER) ---
export const FormattedInput = ({ value, onChange, onBlur, className, placeholder, ...props }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    if (onChange) onChange(val);
  };

  return (
    <input
      value={localValue || ''}
      onChange={handleChange}
      onBlur={onBlur}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  );
};
// ------------------------------------------

export const EditableTitle = ({ value, onSave, className, disabled }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => { setTempValue(value); }, [value]);

  const handleSave = () => {
    if (tempValue.trim() && tempValue !== value) onSave(tempValue);
    else setTempValue(value);
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input autoFocus type="text" value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={handleSave} onKeyDown={(e) => e.key === 'Enter' && handleSave()} className="bg-white text-slate-900 border border-blue-400 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide outline-none min-w-[150px] shadow-sm" />
        <button onMouseDown={handleSave} className="bg-emerald-500 text-white p-0.5 rounded hover:bg-emerald-600"><Check size={12} /></button>
        <button onMouseDown={() => { setTempValue(value); setIsEditing(false); }} className="bg-slate-300 text-slate-600 p-0.5 rounded hover:bg-slate-400"><X size={12} /></button>
      </div>
    );
  }
  return <span onDoubleClick={(e) => { e.stopPropagation(); !disabled && setIsEditing(true); }} className={`cursor-text ${className} ${disabled ? 'cursor-default' : ''}`} title={!disabled ? "Double-cliquer pour éditer" : ""}>{value}</span>;
};

/**
 * Contrôle du type de PSE : « simple » ou « substitution ».
 * Visible uniquement quand l'élément est déjà une PSE (isOption).
 * En substitution, ouvre un sélecteur de la prestation de base remplacée.
 *
 * @param mode        'simple' | 'substitution'
 * @param baseId      id de la base remplacée (si substitution)
 * @param candidates  [{ id, ref, label, kind }] éléments de base sélectionnables
 * @param baseRef     réf de la base remplacée (affichée sur le toggle)
 * @param baseLabel   libellé de la base remplacée (affiché sur le toggle)
 * @param baseMissing true si la base liée est introuvable (alerte)
 * @param onChange    (mode, baseId) => void
 */
export const PseModeControl = ({ mode = 'simple', baseId = '', candidates = [], baseRef = '', baseLabel = '', baseMissing = false, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'bottom' });
  const isSub = mode === 'substitution';

  // Le menu est portalisé dans <body> pour échapper à `overflow-hidden` des
  // conteneurs chapitre/sous-chapitre qui le tronquent. Positionnement fixe
  // calculé depuis le bouton, avec bascule vers le haut si la place manque.
  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const popW = 288; // w-72
      const popH = popRef.current?.offsetHeight || 320;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom;
      const placeAbove = spaceBelow < popH + 12 && rect.top > popH + 12;
      let top = placeAbove ? rect.top - popH - 4 : rect.bottom + 4;
      let left = rect.left;
      // Clamp horizontal pour rester dans la viewport (marge 8px).
      if (left + popW > vw - 8) left = vw - popW - 8;
      if (left < 8) left = 8;
      // Clamp vertical de sécurité.
      if (top < 8) top = 8;
      if (top + popH > vh - 8) top = Math.max(8, vh - popH - 8);
      setPos({ top, left, placement: placeAbove ? 'top' : 'bottom' });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, isSub, candidates.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = candidates.find((c) => c.id === baseId);
  const filtered = query
    ? candidates.filter((c) => `${c.ref} ${c.label}`.toLowerCase().includes(query.toLowerCase()))
    : candidates;

  // Libellé de la base remplacée porté DIRECTEMENT par le toggle (toggle + pastille
  // fusionnés pour gagner de la place). Source : props (pseDeltaMap) sinon sélection.
  const effRef = baseRef || selected?.ref || '';
  const effLabel = baseLabel || selected?.label || '';
  const baseText = [effRef, effLabel].filter(Boolean).join(' · ');
  const btnLabel = !isSub ? 'Simple' : (baseMissing ? 'base introuvable' : (baseText || 'substit.'));
  const btnTitle = !isSub
    ? "Type de PSE : simple ou substitution d'une prestation de base"
    : (baseMissing
        ? 'Prestation de base introuvable — la PSE est comptée au montant plein. Re-sélectionnez la base.'
        : (baseText ? `PSE en remplacement de ${baseText}` : 'Choisir la prestation de base remplacée'));

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); !disabled && setOpen((o) => !o); }}
        title={btnTitle}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all max-w-[210px] ${
          isSub
            ? (baseMissing ? 'bg-amber-500 border-amber-400 text-white' : 'bg-violet-600 border-violet-500 text-white')
            : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
      >
        {isSub ? (baseMissing ? <AlertTriangle size={10} className="shrink-0" /> : <ArrowLeftRight size={10} className="shrink-0" />) : null}
        <span className="truncate">{btnLabel}</span>
        <ChevronDown size={10} className="opacity-70 shrink-0" />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 288, zIndex: 1000 }}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 p-2 text-slate-700"
        >
          <div className="flex gap-1 mb-2">
            <button
              type="button"
              onClick={() => { onChange?.('simple', ''); setOpen(false); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${!isSub ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              PSE simple
            </button>
            <button
              type="button"
              onClick={() => onChange?.('substitution', baseId)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${isSub ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Substitution
            </button>
          </div>

          {isSub && (
            <>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg mb-1.5">
                <Search size={12} className="text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher une prestation de base…"
                  className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="px-2 py-3 text-[10px] text-slate-400 italic text-center">Aucune prestation de base disponible</div>
                )}
                {filtered.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => { onChange?.('substitution', c.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${c.id === baseId ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-100'}`}
                  >
                    <span className="shrink-0 text-[9px] font-mono font-bold text-slate-400 w-12 truncate">{c.ref || '—'}</span>
                    <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate uppercase">{c.label}</span>
                    <span className="shrink-0 text-[8px] font-bold uppercase text-slate-300">{c.kind}</span>
                    {c.id === baseId && <Check size={12} className="text-violet-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export const OptionToggle = ({ isOption, onClick, disabled, pseNumber = null }) => {
  // Quand c'est une PSE, le toggle porte directement son numéro (PSE n°X) :
  // toggle + pastille fusionnés pour gagner de la place.
  const label = isOption ? (pseNumber ? `PSE n°${pseNumber}` : 'PSE') : 'BASE';
  return (
    <button onClick={(e) => { e.stopPropagation(); !disabled && onClick(); }} disabled={disabled} className={`relative flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all duration-200 ${isOption ? 'bg-blue-600 border-blue-500 text-white shadow-md pl-2 pr-2' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white pl-2 pr-2'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`} title={isOption ? "Désactiver PSE" : "Activer en PSE"}>
      <div className={`w-2 h-2 rounded-full transition-colors ${isOption ? 'bg-white animate-pulse' : 'bg-white/20'}`} />
      <span>{label}</span>
    </button>
  );
};

// ─── DESCRIPTION / JUSTIFICATION D'UNE PSE ────────────────────────────────────
// Champ repliable sous l'en-tête d'une PSE (chapitre ou sous-chapitre option).
// Texte riche (gras, souligné, listes) persisté dans node.pseDescription et repris
// dans les exports (page PSE du PDF, bloc Excel, récapitulatif).
export const PseDescriptionEditor = ({ value, onChange, disabled = false }) => {
  const hasText = !!(value && value.replace(/<[^>]*>/g, '').split(String.fromCharCode(160)).join('').trim());
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-8 mr-2 mt-1 mb-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-600 transition-colors"
        title="Décrire / justifier cette PSE — repris dans les exports (PDF, Excel, récap)"
      >
        <FileText size={12} />
        Description PSE
        {hasText && !open && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[8px] normal-case font-semibold tracking-normal">renseignée</span>
        )}
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-1.5">
          {disabled ? (
            hasText ? (
              <div
                className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded-md p-3 leading-relaxed [&_b]:font-bold [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <p className="text-[11px] italic text-slate-400 px-1">Aucune description.</p>
            )
          ) : (
            <div className="h-44">
              <RichTextEditor
                value={value || ''}
                onChange={onChange}
                placeholder="Expliquez clairement la PSE : objet, prestations incluses, conditions, intérêt pour le maître d'ouvrage…"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const HeaderRow = ({ isStudy }) => (
  <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest select-none">
    <div className="w-6 text-center">#</div><div className="flex-1">Désignation</div><div className="w-12 text-center">Unit</div><div className="w-16 text-center">P.U.</div>
    {isStudy && <div className="w-16 text-center text-blue-600 bg-blue-50/50 rounded py-0.5">Qté Étude</div>}
    <div className="w-16 text-center text-emerald-600 bg-emerald-50/50 rounded py-0.5">Qté Client</div><div className="w-20 text-right pr-2">Total</div>{isStudy && <div className="w-10"></div>}
  </div>
);