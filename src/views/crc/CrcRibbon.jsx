// src/views/crc/CrcRibbon.jsx — EstimaStyle responsive
import React from 'react';

export const RibbonButton = ({ icon: Icon, label, onClick, disabled, variant = 'default', active, title }) => {
  const base = 'flex flex-col items-center gap-0.5 px-2 xl:px-3 py-1 xl:py-1.5 rounded-lg xl:rounded-xl transition-all text-center min-w-[46px] xl:min-w-[56px]';
  const variants = {
    default: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`,
    primary: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'}`,
    accent: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-violet-50 text-violet-600 hover:text-violet-700'}`,
    active: `${base} bg-blue-50 text-blue-700 border border-blue-200/60`,
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
