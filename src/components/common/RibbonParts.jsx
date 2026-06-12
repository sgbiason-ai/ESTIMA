import React, { useContext, createContext, useLayoutEffect, useRef, useState } from 'react';

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
      <div className="ribbon-grp-inner flex items-center justify-center gap-1.5 px-4 flex-1 py-1">
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
export const RibbonBtnLarge = ({ icon: Icon, label, onClick, title, active, accent, disabled, badge = 0 }) => {
  const dark = useContext(RibbonThemeCtx);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || (typeof label === 'string' ? label : '')}
      className={`
        ribbon-btn-lg group relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded min-w-[52px]
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
      {badge > 0 && (
        <span className="absolute top-0.5 right-0.5 z-10 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm ring-1 ring-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <div className={`transition-colors ${accent || (dark ? 'text-slate-400' : 'text-slate-600')} ${
        !disabled && !active ? (dark ? 'group-hover:text-slate-100' : 'group-hover:text-slate-800') : ''
      }`}>
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <span className={`ribbon-lbl-lg text-[10.5px] leading-tight text-center font-normal transition-colors
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
// Adaptatif : quand la largeur disponible ne suffit plus, passe en mode
// « compact » (libellés des gros boutons masqués via .ribbon-compact, cf.
// index.css), puis autorise le retour à la ligne si même compact ça déborde.
// La mesure se fait sur le DOM réel (nowrap forcé temporairement, jamais
// peint : tout se joue avant le paint, dans un rAF ou un layout effect).
const STAGE_NORMAL = 0, STAGE_COMPACT = 1, STAGE_WRAP = 2;

export const RibbonContainer = ({ children, dark }) => {
  const ref = useRef(null);
  const [stage, setStage] = useState(STAGE_NORMAL);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let raf = 0;
    let pendingForce = false;
    let lastWidth = -1; // largeur DISPONIBLE de la dernière mesure (anti-boucle)

    // Largeur naturelle (sans wrap) suffisante ? — testé avec/sans compact.
    const fitsWith = (compact) => {
      el.classList.toggle('ribbon-compact', compact);
      return el.scrollWidth <= el.clientWidth + 1;
    };

    // force = re-mesurer même si la largeur n'a pas changé (contenu modifié).
    const measure = (force) => {
      // Largeur disponible réelle, lue AVANT toute manipulation. Changer de
      // stage modifie la HAUTEUR (1 ↔ 2 lignes) mais PAS cette largeur : on
      // court-circuite donc la boucle de rétroaction du ResizeObserver.
      const avail = el.clientWidth;
      if (!force && avail === lastWidth) return;
      lastWidth = avail;

      const hadCompact = el.classList.contains('ribbon-compact');
      const hadWrap = el.classList.contains('ribbon-wrap');
      const prevWrap = el.style.flexWrap;
      // Mesure en conditions "une seule ligne" : nowrap forcé et spacers à
      // leur largeur native (ribbon-wrap les écrase, ce qui fausserait la
      // mesure et créerait une oscillation au point de bascule).
      el.classList.remove('ribbon-wrap');
      el.style.flexWrap = 'nowrap';
      let next = STAGE_WRAP;
      if (fitsWith(false)) next = STAGE_NORMAL;
      else if (fitsWith(true)) next = STAGE_COMPACT;
      // Restaure l'état rendu par React (le re-render appliquera le stage).
      el.classList.toggle('ribbon-compact', hadCompact);
      el.classList.toggle('ribbon-wrap', hadWrap);
      el.style.flexWrap = prevWrap;
      setStage(s => (s === next ? s : next));
    };

    const schedule = (force) => {
      pendingForce = pendingForce || force;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { const f = pendingForce; pendingForce = false; measure(f); });
    };

    measure(true);

    // Redimensionnement de la fenêtre → re-mesure (déduplicée sur la largeur
    // dans measure, donc insensible aux variations de hauteur du wrap).
    // Couvre le cas principal partout, y compris si ResizeObserver est absent.
    const onResize = () => schedule(false);
    window.addEventListener('resize', onResize);

    // Largeur disponible qui change SANS resize fenêtre (ouverture/fermeture du
    // panneau BPU, de la sidebar…) : capté par ResizeObserver quand disponible.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => schedule(false));
      ro.observe(el);
    }
    // Les groupes apparaissent/disparaissent selon onglet, mode, droits… → force.
    // (childList/characterData uniquement : nos toggles de classe de mesure sont
    // des mutations d'attributs et ne re-déclenchent donc pas l'observateur)
    const mo = new MutationObserver(() => schedule(true));
    mo.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <RibbonThemeCtx.Provider value={!!dark}>
      <div
        ref={ref}
        className={`flex items-stretch border-b min-h-[78px] ${
          stage === STAGE_WRAP ? 'flex-wrap ribbon-wrap' : 'flex-nowrap'
        } ${stage >= STAGE_COMPACT ? 'ribbon-compact' : ''} ${
          dark
            ? 'bg-[#0b1926] border-white/[0.07]'
            : 'bg-[#f3f3f3] border-slate-200'
        }`}
      >
        {children}
      </div>
    </RibbonThemeCtx.Provider>
  );
};

// ─── Spacer flexible (neutralisé en mode 2 lignes via .ribbon-wrap) ─
export const RibbonSpacer = () => <div className="ribbon-spacer flex-1 min-w-[16px]" />;
