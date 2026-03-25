// src/components/rao/RaoUI.jsx
import React from 'react';

export const TabBtn = ({ id, active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 whitespace-nowrap relative ${
      active 
        ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-900/5 z-10'
        : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
    }`}
  >
    <Icon size={14} className={active ? "text-emerald-600" : "opacity-70"} />
    {label}
    {count != null && (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ml-1 ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-500'
      }`}>{count}</span>
    )}
  </button>
);

export const Field = ({ label, children, hint, icon: Icon }) => (
  <div className="group flex flex-col gap-1.5 transition-all">
    <div className="flex items-center gap-2 ml-1">
      {Icon && <Icon size={12} className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" />}
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-emerald-600 transition-colors">
        {label}
      </label>
    </div>
    {children}
    {hint && <p className="text-[10px] text-slate-400 italic ml-1 opacity-0 group-focus-within:opacity-100 transition-opacity">{hint}</p>}
  </div>
);

export const Input = ({ value, onChange, placeholder, className = '', type = 'text' }) => (
  <input
    type={type}
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full px-4 py-2 text-sm border rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm
      ${value ? 'bg-white border-slate-300 text-slate-800 font-medium' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'} ${className}`}
  />
);

export const Textarea = ({ value, onChange, placeholder, rows = 4, className = '' }) => (
  <textarea
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className={`w-full px-4 py-3 text-sm border rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm resize-y leading-relaxed ${
      value ? 'bg-white border-slate-300 text-slate-800 font-medium' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'} ${className}`}
  />
);

export const OuiNonToggle = ({ value, onChange }) => (
  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl ring-1 ring-slate-200/50 shadow-inner">
    {[true, false, null].map((v, i) => {
      const label = v === true ? 'OUI' : v === false ? 'NON' : '—';
      const active = value === v || (v === null && value === undefined);
      return (
        <button
          key={i}
          onClick={() => onChange(v)}
          className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all duration-300 ${
            active
              ? v === true  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : v === false ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
              :               'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

export const ScoreBadge = ({ note, max, weight }) => {
  const percentage = max > 0 ? (note / max) * 100 : 0;
  const weightedScore = max > 0 ? (note / max) * weight : 0;
  
  return (
    <div className="flex items-center gap-4 bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Note / Barème</span>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-emerald-600">{note}</span>
          <span className="text-xs font-bold text-slate-300">/ {max}</span>
        </div>
      </div>
      <div className="h-8 w-px bg-slate-100" />
      <div className="flex flex-col min-w-[90px]">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Points ramenés</span>
        <span className="text-xl font-black text-slate-800">{weightedScore.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">pts</span></span>
      </div>
      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden hidden lg:block">
        <div 
          className="h-full bg-emerald-500 transition-all duration-1000" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};