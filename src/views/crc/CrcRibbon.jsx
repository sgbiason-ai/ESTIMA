// src/views/crc/CrcRibbon.jsx — EstimaStyle responsive
import React from 'react';

export const RibbonButton = ({ icon: Icon, label, onClick, disabled, variant = 'default', active, title }) => {
  const base = 'flex flex-col items-center gap-0.5 px-2 xl:px-3 py-1 xl:py-1.5 rounded-lg xl:rounded-xl transition-all duration-200 text-center min-w-[46px] xl:min-w-[56px]';
  const variants = {
    default: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100/80 text-slate-500 hover:text-slate-800 hover:shadow-sm active:scale-95'}`,
    primary: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-50 hover:bg-gradient-to-b hover:from-indigo-50/50 hover:to-indigo-100/50 text-indigo-600 hover:text-indigo-800 hover:shadow-sm hover:shadow-indigo-500/10 active:scale-95'}`,
    accent: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-violet-50 hover:bg-gradient-to-b hover:from-violet-50/50 hover:to-violet-100/50 text-violet-600 hover:text-violet-800 hover:shadow-sm hover:shadow-violet-500/10 active:scale-95'}`,
    active: `${base} bg-indigo-50/80 text-indigo-700 border border-indigo-200/60 shadow-inner`,
  };

  return (
    <button onClick={onClick} disabled={disabled} title={title || label} className={active ? variants.active : variants[variant]}>
      <Icon size={16} className="xl:hidden" />
      <Icon size={18} className="hidden xl:block" />
      <span className="text-[8px] xl:text-[9px] font-semibold leading-tight whitespace-nowrap">{label}</span>
    </button>
  );
};

export const RibbonDivider = () => (
  // Masque sous xl (ribbon wrap : les dividers seraient mal places)
  <div className="hidden xl:block w-px bg-gray-200/60 mx-1 xl:mx-1.5 self-stretch my-1 shrink-0" />
);

export const RibbonGroup = ({ label, children, dataTour }) => (
  <div className="flex flex-col items-center shrink-0" data-tour={dataTour}>
    <div className="flex items-center gap-0 xl:gap-0.5 flex-1">
      {children}
    </div>
    <span className="text-[7px] xl:text-[8px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">{label}</span>
  </div>
);
