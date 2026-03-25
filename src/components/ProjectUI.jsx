import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

// --- LE COMPOSANT MANQUANT (A AJOUTER) ---
export const FormattedInput = ({ value, onChange, onBlur, className, placeholder, isPrice, ...props }) => {
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

export const OptionToggle = ({ isOption, onClick, disabled }) => {
  return (
    <button onClick={(e) => { e.stopPropagation(); !disabled && onClick(); }} disabled={disabled} className={`relative flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all duration-200 ${isOption ? 'bg-blue-600 border-blue-500 text-white shadow-md pl-2 pr-2' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white pl-2 pr-2'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`} title={isOption ? "Désactiver PSE" : "Activer en PSE"}>
      <div className={`w-2 h-2 rounded-full transition-colors ${isOption ? 'bg-white animate-pulse' : 'bg-white/20'}`} />
      <span>{isOption ? 'PSE' : 'BASE'}</span>
    </button>
  );
};

export const HeaderRow = ({ isStudy }) => (
  <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest select-none">
    <div className="w-6 text-center">#</div><div className="flex-1">Désignation</div><div className="w-12 text-center">Unit</div><div className="w-16 text-center">P.U.</div>
    {isStudy && <div className="w-16 text-center text-blue-600 bg-blue-50/50 rounded py-0.5">Qté Étude</div>}
    <div className="w-16 text-center text-emerald-600 bg-emerald-50/50 rounded py-0.5">Qté Client</div><div className="w-20 text-right pr-2">Total</div>{isStudy && <div className="w-10"></div>}
  </div>
);