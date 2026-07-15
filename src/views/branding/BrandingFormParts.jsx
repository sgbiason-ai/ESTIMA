// src/views/branding/BrandingFormParts.jsx
// Sous-composants formulaire Branding — extraits de BrandingView.jsx

import React from 'react';

export const SectionTitle = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 mt-6 first:mt-0">
    {children}
  </h3>
);

export const Field = ({ label, children }) => (
  <div className="mb-3">
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

export const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl
               text-gray-800 placeholder-gray-300
               focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white
               transition-all duration-150"
  />
);

export const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl
               text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100
               focus:border-blue-400 focus:bg-white transition-all duration-150"
  >
    {options.map(o => {
      const value = typeof o === 'string' ? o : o.value;
      const label = typeof o === 'string' ? o : o.label;
      return <option key={value} value={value}>{label}</option>;
    })}
  </select>
);

// `isAuto` / `onReset` (optionnels) → mode "auto par défaut, débrayage ponctuel" :
//   - isAuto = true  → la couleur est dérivée (badge « Auto » gris)
//   - isAuto = false → couleur fixée manuellement (bouton « ↺ Auto » pour revenir au dérivé)
export const ColorPicker = ({ label, value, onChange, description, isAuto, onReset }) => (
  <div className="flex items-center gap-3 mb-3 p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
    <div className="relative group">
      <div
        className="w-10 h-10 rounded-xl shadow-sm cursor-pointer
                   transition-transform group-hover:scale-105"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-xl"
        title={`Changer ${label.toLowerCase()}`}
      />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
        {onReset && (
          isAuto
            ? <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 flex-shrink-0">Auto</span>
            : <button
                onClick={onReset}
                className="text-[10px] font-semibold uppercase tracking-wide text-blue-400
                           hover:text-blue-600 flex-shrink-0"
                title="Revenir à la couleur automatique (dérivée)"
              >
                ↺ Auto
              </button>
        )}
      </div>
      {description && <div className="text-xs text-gray-400 truncate">{description}</div>}
      <input
        type="text"
        value={value}
        onChange={e => {
          if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value);
        }}
        className={`text-xs font-mono bg-transparent border-none outline-none w-24 mt-0.5
                    ${isAuto ? 'text-gray-300' : 'text-gray-500'}`}
        maxLength={7}
      />
    </div>
  </div>
);

export const SizeSlider = ({ label, value, onChange, min = 14, max = 40 }) => {
  const pt = (value / 2).toFixed(0);
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span className="text-xs text-gray-500 w-14 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-blue-500 rounded-full"
      />
      <span className="text-xs font-mono text-gray-600 w-10 text-right bg-gray-100 px-1.5 py-0.5 rounded-lg">{pt} pt</span>
    </div>
  );
};
