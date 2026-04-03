import React, { useContext, createContext } from 'react';

/* ════════════════════════════════════════════════════════════════════
   OFFICE RIBBON — Composants partagés
   Supporte un thème sombre via le prop `dark` sur RibbonContainer.
   RibbonHeader reçoit `dark` directement (il est hors du conteneur).
   ════════════════════════════════════════════════════════════════════ */

const RibbonThemeCtx = createContext(false);

// ─── Groupe Ribbon avec label en bas et séparateur droit intégré ────
export const RibbonGroup = ({ label, children, className = '', noBorder }) => {
  const dark = useContext(RibbonThemeCtx);
  return (
    <div className={`flex flex-col h-full relative ${className}`}>
      <div className="flex items-center justify-center gap-1.5 px-4 flex-1 py-1">
        {children}
      </div>
      <div className="text-center pb-1 px-2">
        <span className={`text-[10px] font-normal tracking-wide select-none whitespace-nowrap leading-none ${
          dark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {label}
        </span>
      </div>
      {!noBorder && (
        <div className={`absolute right-0 top-2 bottom-2 w-px bg-gradient-to-b from-transparent ${
          dark ? 'via-white/10' : 'via-slate-200'
        } to-transparent`} />
      )}
    </div>
  );
};

// ─── Bouton large : icône 22px + texte dessous ─────────────────────
export const RibbonBtnLarge = ({ icon: Icon, label, onClick, title, active, accent, disabled }) => {
  const dark = useContext(RibbonThemeCtx);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || (typeof label === 'string' ? label : '')}
      className={`
        group flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded min-w-[52px]
        transition-all duration-100
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default'}
        ${dark
          ? active
            ? 'bg-white/10 border border-white/20 shadow-sm'
            : 'border border-transparent hover:bg-white/[0.07] hover:border-white/10 active:bg-white/[0.12]'
          : active
            ? 'bg-blue-50 border border-blue-200 shadow-sm'
            : 'border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] active:bg-[#b8cce0]'
        }
      `}
    >
      <div className={`transition-colors ${accent || (dark ? 'text-slate-400' : 'text-slate-600')} ${
        !disabled && !active ? (dark ? 'group-hover:text-slate-100' : 'group-hover:text-slate-800') : ''
      }`}>
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <span className={`text-[10.5px] leading-tight text-center font-normal transition-colors
        ${dark
          ? active ? 'text-white font-medium' : 'text-slate-400'
          : active ? 'text-blue-700 font-medium' : 'text-slate-600'
        }
        ${!disabled && !active ? (dark ? 'group-hover:text-slate-200' : 'group-hover:text-slate-800') : ''}
      `}>
        {label}
      </span>
    </button>
  );
};

// ─── Bouton petit : icône 16px + texte à côté ──────────────────────
export const RibbonBtnSmall = ({ icon: Icon, label, onClick, title, active, accent, disabled }) => {
  const dark = useContext(RibbonThemeCtx);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || (typeof label === 'string' ? label : '')}
      className={`
        group flex items-center gap-2 px-2.5 py-[5px] rounded w-full
        transition-all duration-100
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default'}
        ${dark
          ? active
            ? 'bg-white/10 border border-white/20'
            : 'border border-transparent hover:bg-white/[0.07] hover:border-white/10 active:bg-white/[0.12]'
          : active
            ? 'bg-blue-50 border border-blue-200'
            : 'border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] active:bg-[#b8cce0]'
        }
      `}
    >
      <div className={`transition-colors shrink-0 ${accent || 'text-slate-500'} ${
        !disabled && !active ? (dark ? 'group-hover:text-slate-300' : 'group-hover:text-slate-700') : ''
      }`}>
        <Icon size={16} strokeWidth={1.6} />
      </div>
      {label && (
        <span className={`text-[11px] leading-none whitespace-nowrap font-normal transition-colors
          ${dark
            ? active ? 'text-white font-medium' : 'text-slate-400'
            : active ? 'text-blue-700 font-medium' : 'text-slate-600'
          }
          ${!disabled && !active ? (dark ? 'group-hover:text-slate-200' : 'group-hover:text-slate-800') : ''}
        `}>
          {label}
        </span>
      )}
    </button>
  );
};

// ─── Barre d'onglets + titre ────────────────────────────────────────
export const RibbonHeader = ({ title, tabs, activeTab, onTabChange, rightContent, dark }) => (
  <div className={`flex items-center h-[30px] px-1 border-b ${
    dark ? 'bg-[#060d14] border-white/[0.07]' : 'bg-white border-slate-200'
  }`}>
    {tabs && tabs.length > 0 && (
      <div className="flex items-end h-full">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative px-5 pb-0 pt-1.5 text-[11.5px] font-normal transition-colors rounded-t
                ${dark
                  ? isActive
                    ? 'text-slate-200 bg-[#0b1926] border border-white/10 border-b-[#0b1926] -mb-px z-10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                  : isActive
                    ? 'text-slate-700 bg-[#f3f3f3] border border-slate-200 border-b-[#f3f3f3] -mb-px z-10'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    )}
    <div className="flex-1 flex items-center justify-center gap-2.5">
      <span className={`text-[11.5px] font-semibold tracking-wide truncate max-w-[400px] ${
        dark ? 'text-slate-300' : 'text-slate-700'
      }`}>
        {title}
      </span>
    </div>
    {rightContent && (
      <div className="flex items-center pr-2">
        {rightContent}
      </div>
    )}
  </div>
);

// ─── Conteneur du ribbon (fournit le thème aux enfants via Context) ─
export const RibbonContainer = ({ children, dark }) => (
  <RibbonThemeCtx.Provider value={!!dark}>
    <div className={`flex items-stretch border-b min-h-[78px] ${
      dark
        ? 'bg-[#0b1926] border-white/[0.07]'
        : 'bg-[#f3f3f3] border-slate-200'
    }`}>
      {children}
    </div>
  </RibbonThemeCtx.Provider>
);

// ─── Spacer flexible ────────────────────────────────────────────────
export const RibbonSpacer = () => <div className="flex-1 min-w-[16px]" />;
