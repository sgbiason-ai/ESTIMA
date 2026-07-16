// src/components/mobile/MobileHubView.jsx
// Hub mobile — Bento Box Apple-style, fond clair
import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { APP_VERSION } from '../../data/appVersion';
import lazyWithReload from '../../utils/lazyWithReload';
// Lazy : la modale « Nouveautés » embarque tout le changelog (~160 KB de texte).
const ChangelogModal = lazyWithReload(() => import('../ChangelogModal'));
import { satisfiesDesktopGate, isSuperAdmin } from '../../config/superAdmin';
import { useNewFeedbackCount } from '../../hooks/useFeedback';
import { useSiteVisitShareNotifications } from '../../hooks/useSiteVisitShareNotifications';

// ─── MODULES MOBILES ───────────────────────────────────────────────────────
//
// Visibilité d'un module mobile :
//   1. desktopGate doit être satisfait par `userModules` (les permissions
//      desktop PRÉVALENT — un module mobile ne peut pas être visible si son
//      équivalent desktop est interdit).
//   2. ET si `userMobileModules` est défini, l'ID doit y figurer.
//      Sinon (champ absent) → autorisé par défaut.
const MOBILE_MODULES = [
  { id: 'projects',    label: 'Projets & RAO',    description: 'Devis, DQE et analyse des offres', icon: 'folder',    tag: 'Core',    row: 1, desktopGate: ['projects_manager', 'estima', 'rao_analysis'] },
  { id: 'pdf_reader',  label: 'Serveur Papyrus',  description: 'Plans, documents et fichiers PDF', icon: 'file',      tag: 'Cloud',   row: 1, desktopGate: [] },
  { id: 'site_visits', label: 'Visites de Site',  description: 'Notes terrain, photos et GPS',     icon: 'camera',    tag: 'Terrain', row: 2, desktopGate: ['site_visits'] },
  { id: 'crc',         label: 'Comptes Rendus',   description: 'CR de chantier',                   icon: 'clipboard', tag: 'CRC',     row: 2, desktopGate: ['crc'] },
  { id: 'moe',         label: 'Devis MOE',        description: 'Honoraires maîtrise d\'œuvre',     icon: 'euro',      tag: 'MOE',     row: 3, desktopGate: ['devis_moe'] },
  { id: 'doc_admin',   label: 'Documents Admin',  description: 'Fiches marché et docs EXE',        icon: 'file',      tag: 'EXE',     row: 3, desktopGate: ['doc_admin'] },
];

// ─── THÈMES PAR ROW ───────────────────────────────────────────────────────

const ROW_THEMES = {
  1: {
    card: 'bg-white border-gray-200',
    iconBg: 'bg-blue-50',
    iconColor: '#2563eb',
    title: 'text-gray-900',
    desc: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    status: 'text-gray-600',
  },
  2: {
    card: 'bg-gradient-to-br from-amber-950/90 via-stone-900/95 to-stone-950/90 border-amber-700/30',
    iconBg: 'bg-amber-800/40',
    iconColor: '#fbbf24',
    title: 'text-amber-50',
    desc: 'text-amber-200/70',
    badge: 'bg-amber-800/40 text-amber-300/80 border-amber-600/30',
    status: 'text-amber-400/60',
  },
  3: {
    card: 'bg-gradient-to-br from-violet-950/90 via-purple-950/95 to-slate-950/90 border-violet-700/30',
    iconBg: 'bg-violet-800/40',
    iconColor: '#a78bfa',
    title: 'text-violet-50',
    desc: 'text-violet-200/70',
    badge: 'bg-violet-800/40 text-violet-300/80 border-violet-600/30',
    status: 'text-violet-400/60',
  },
};

// ─── COMPOSANT ─────────────────────────────────────────────────────────────

export default function MobileHubView({ userId, userEmail, userModules, userMobileModules, onSelectModule, onLogout, isLandscape, isTablet = false, onSwitchToDesktop = null }) {
  const [mounted, setMounted] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Pastille « nouveau feedback » sur l'avatar (super-admin only, informatif :
  // le panneau de traitement vit côté desktop).
  const newFeedbackCount = useNewFeedbackCount(isSuperAdmin(userEmail));
  const { count: sharedVisitCount, markAllRead: markSharedVisitsRead } = useSiteVisitShareNotifications(userId);

  const handleSelectModule = async (moduleId) => {
    if (moduleId === 'site_visits') {
      try { await markSharedVisitsRead(); } catch { /* la navigation reste disponible */ }
    }
    onSelectModule(moduleId);
  };

  const firstName = userEmail?.split('@')[0]?.split('.')[0] || '';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  // Filtrage : (desktopGate satisfait) ET (mobileModules contient l'id OU
  // userMobileModules absent → tout autorisé par défaut).
  const hasMobileRestriction = Array.isArray(userMobileModules);
  const visibleModules = MOBILE_MODULES.filter(mod => {
    if (!satisfiesDesktopGate(mod, userModules)) return false;
    if (!hasMobileRestriction) return true;
    return userMobileModules.includes(mod.id);
  });

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]"
      >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`px-5 ${isLandscape ? 'pt-2 pb-1' : 'pt-5 pb-3'} bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shrink-0`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold text-gray-900 tracking-tight"
            style={{ fontFamily: '"SF Pro Display", Georgia, serif' }}>
            Estima Suite
          </span>
          <div className="flex items-center gap-3">
            {onSwitchToDesktop && (
              <button
                onClick={onSwitchToDesktop}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                title="Passer en vue desktop"
                aria-label="Passer en vue desktop"
              >
                <Icon name="monitor" size={16} color="currentColor" />
              </button>
            )}
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
              </div>
              {newFeedbackCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-white shadow-sm"
                  title={`${newFeedbackCount} feedback${newFeedbackCount > 1 ? 's' : ''} à traiter`}
                >
                  {newFeedbackCount > 99 ? '99+' : newFeedbackCount}
                </span>
              )}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            >
              <Icon name="logout" size={16} color="currentColor" />
            </button>
          </div>
        </div>

        <h1 className={`${isLandscape ? 'text-xl' : 'text-[1.75rem]'} font-semibold text-gray-900 tracking-tight leading-tight`}
          style={{ fontFamily: '"SF Pro Display", Georgia, -apple-system, serif' }}>
          {greeting},{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400">
            {displayName}
          </span>.
        </h1>
        <p className="text-[15px] text-gray-600 mt-1 font-light">
          Sélectionnez un module pour commencer.
        </p>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col">
        <div className={`grid gap-2.5 flex-1 ${
          isTablet && isLandscape ? 'grid-cols-3' : 'grid-cols-2'
        }`}>
          {visibleModules.map((mod, idx) => {
            const theme = ROW_THEMES[mod.row];
            return (
              <button
                key={mod.id}
                onClick={() => handleSelectModule(mod.id)}
                className={`
                  relative w-full rounded-[20px] border p-4
                  flex flex-col text-left
                  transition-all duration-300 active:scale-[0.97]
                  ${theme.card}
                `}
                style={{
                  transitionDelay: mounted ? `${80 + idx * 50}ms` : '0ms',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(10px)',
                }}
              >
                {/* Header: icon + badge */}
                <div className="flex items-start justify-between mb-2">
                  <div className={`relative w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon name={mod.icon} size={20} color={theme.iconColor} />
                    {mod.id === 'site_visits' && sharedVisitCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white shadow-sm"
                        title={`${sharedVisitCount} nouvelle${sharedVisitCount > 1 ? 's' : ''} visite${sharedVisitCount > 1 ? 's' : ''} partagée${sharedVisitCount > 1 ? 's' : ''}`}>
                        {sharedVisitCount > 99 ? '99+' : sharedVisitCount}
                      </span>
                    )}
                  </div>
                  {mod.tag && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider border ${theme.badge}`}>
                      {mod.tag}
                    </span>
                  )}
                </div>

                {/* Title + description */}
                <div className="flex-1">
                  <span className={`text-[14px] font-semibold block leading-tight ${theme.title}`}>{mod.label}</span>
                  <p className={`text-[11px] leading-snug mt-1 ${theme.desc}`}>{mod.description}</p>
                </div>

                {/* Footer status */}
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-[10px] font-medium ${theme.status}`}>Prêt</span>
                  <Icon name="chevron" size={12} color="#9ca3af" />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Footer status ──────────────────────────────────────────── */}
        <div
          className={`flex items-center justify-center gap-2 mt-6 transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDelay: '350ms' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-gray-600 font-medium">
            Opérationnel · v{APP_VERSION}
          </span>
          <span className="text-[10px] text-gray-400">·</span>
          <button
            onClick={() => setShowChangelog(true)}
            className="text-[10px] font-medium text-blue-500"
          >
            Nouveautés
          </button>
        </div>
      </div>

      {showChangelog && (
        <React.Suspense fallback={null}>
          <ChangelogModal onClose={() => setShowChangelog(false)} />
        </React.Suspense>
      )}
    </div>
  );
}

export { MOBILE_MODULES };
