// src/components/mobile/MobileHubView.jsx
// Hub mobile — Bento Box Apple-style, fond clair
import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { APP_VERSION } from '../../data/changelog';
import ChangelogModal from '../ChangelogModal';

// ─── MODULES MOBILES ───────────────────────────────────────────────────────

const MOBILE_MODULES = [
  { id: 'projects',  label: 'Mes Projets',         description: 'Consultation des devis, DQE et analyses',      icon: 'folder',    tag: 'Core',   row: 1 },
  { id: 'crc',       label: 'Comptes Rendus',      description: 'Consultation des CR de chantier',              icon: 'clipboard', tag: 'CRC',    row: 1 },
  { id: 'moe',       label: 'Devis MOE',           description: 'Honoraires maîtrise d\'œuvre',                 icon: 'euro',      tag: 'MOE',    row: 2 },
  { id: 'doc_admin', label: 'Documents Admin',      description: 'Fiches marché et documents EXE',              icon: 'file',      tag: 'EXE',    row: 2 },
  { id: 'exports',   label: 'Exports Rapides',      description: 'PDF, Excel — télécharger ou partager',        icon: 'download',  tag: 'Export', row: 3 },
];

// ─── THÈMES PAR ROW ───────────────────────────────────────────────────────

const ROW_THEMES = {
  1: {
    card: 'bg-white border-gray-200/70',
    iconBg: 'bg-gray-50',
    iconColor: '#374151',
    title: 'text-gray-900',
    desc: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-500 border-gray-200/60',
  },
  2: {
    card: 'bg-gradient-to-br from-amber-950/90 via-stone-900/95 to-stone-950/90 border-amber-700/30',
    iconBg: 'bg-amber-800/40',
    iconColor: '#fbbf24',
    title: 'text-amber-50',
    desc: 'text-amber-200/60',
    badge: 'bg-amber-800/40 text-amber-300/80 border-amber-600/30',
  },
  3: {
    card: 'bg-gradient-to-br from-violet-950/90 via-purple-950/95 to-slate-950/90 border-violet-700/30',
    iconBg: 'bg-violet-800/40',
    iconColor: '#a78bfa',
    title: 'text-violet-50',
    desc: 'text-violet-200/60',
    badge: 'bg-violet-800/40 text-violet-300/80 border-violet-600/30',
  },
};

// ─── COMPOSANT ─────────────────────────────────────────────────────────────

export default function MobileHubView({ userEmail, onSelectModule, onLogout, isLandscape }) {
  const [mounted, setMounted] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const firstName = userEmail?.split('@')[0]?.split('.')[0] || '';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`px-5 ${isLandscape ? 'pt-2 pb-1' : 'pt-5 pb-3'} bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shrink-0`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold text-gray-900 tracking-tight"
            style={{ fontFamily: '"SF Pro Display", Georgia, serif' }}>
            Estima Suite
          </span>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
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
        <p className="text-[15px] text-gray-400 mt-1 font-light">
          Sélectionnez un module pour commencer.
        </p>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className={isLandscape ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
          {MOBILE_MODULES.map((mod, idx) => {
            const theme = ROW_THEMES[mod.row];
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`
                  relative flex items-center gap-4 w-full p-5 rounded-[20px]
                  border text-left transition-all duration-300 active:scale-[0.97]
                  ${theme.card}
                `}
                style={{
                  transitionDelay: mounted ? `${80 + idx * 50}ms` : '0ms',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(10px)',
                }}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon name={mod.icon} size={22} color={theme.iconColor} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[15px] font-semibold ${theme.title}`}>{mod.label}</span>
                    {mod.tag && (
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${theme.badge}`}>
                        {mod.tag}
                      </span>
                    )}
                  </div>
                  <p className={`text-[13px] leading-snug ${theme.desc}`}>{mod.description}</p>
                </div>

                {/* Chevron */}
                <Icon name="chevron" size={14} color={mod.row === 1 ? '#d1d5db' : mod.row === 2 ? '#92400e50' : '#7c3aed50'} />
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
          <span className="text-[10px] text-gray-400 font-medium">
            Opérationnel · v{APP_VERSION}
          </span>
          <span className="text-[10px] text-gray-300">·</span>
          <button
            onClick={() => setShowChangelog(true)}
            className="text-[10px] font-medium text-blue-500"
          >
            Nouveautés
          </button>
        </div>
      </div>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}

export { MOBILE_MODULES };
