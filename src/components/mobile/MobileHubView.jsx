// src/components/mobile/MobileHubView.jsx
// Hub mobile — Bento Box Apple-style, fond clair
import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { APP_VERSION } from '../../data/changelog';
import ChangelogModal from '../ChangelogModal';

// ─── MODULES MOBILES ───────────────────────────────────────────────────────

const MOBILE_MODULES = [
  { id: 'projects',    label: 'Mes Projets & RAO',   description: 'Devis, DQE et analyse des offres', icon: 'folder',    tag: 'Core',    row: 1, wide: true },
  { id: 'crc',         label: 'Comptes Rendus',      description: 'CR de chantier',                  icon: 'clipboard', tag: 'CRC',     row: 2 },
  { id: 'site_visits', label: 'Visites de Site',     description: 'Notes terrain, photos et GPS',    icon: 'camera',    tag: 'Terrain', row: 2 },
  { id: 'moe',         label: 'Devis MOE',           description: 'Honoraires maîtrise d\'œuvre',    icon: 'euro',      tag: 'MOE',     row: 3 },
  { id: 'doc_admin',   label: 'Documents Admin',     description: 'Fiches marché et docs EXE',       icon: 'file',      tag: 'EXE',     row: 3 },
  { id: 'pdf_reader',  label: 'Lecteur PDF',         description: 'Visualiser plans et documents',   icon: 'file',      tag: 'Outil',   row: 2, wide: true },
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
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col">
        <div className="grid grid-cols-2 gap-2.5 flex-1">
          {MOBILE_MODULES.map((mod, idx) => {
            const theme = ROW_THEMES[mod.row];
            const isWide = !!mod.wide;
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`
                  relative w-full rounded-[20px]
                  border transition-all duration-300 active:scale-[0.97]
                  ${isWide ? 'col-span-2 flex flex-row items-center gap-4 px-5 py-4' : 'flex flex-col items-center justify-center gap-3 text-center'}
                  ${theme.card}
                `}
                style={{
                  transitionDelay: mounted ? `${80 + idx * 50}ms` : '0ms',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(10px)',
                }}
              >
                {/* Tag */}
                {mod.tag && (
                  <span className={`absolute top-3 right-3 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider border ${theme.badge}`}>
                    {mod.tag}
                  </span>
                )}

                {/* Icon */}
                <div className={`${isWide ? 'w-12 h-12' : 'w-14 h-14'} rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon name={mod.icon} size={isWide ? 24 : 26} color={theme.iconColor} />
                </div>

                {/* Text */}
                <div className={isWide ? 'text-left flex-1' : ''}>
                  <span className={`${isWide ? 'text-[16px]' : 'text-[15px]'} font-semibold block ${theme.title}`}>{mod.label}</span>
                  <p className={`text-[11px] leading-snug mt-0.5 ${theme.desc}`}>{mod.description}</p>
                </div>

                {/* Chevron pour wide */}
                {isWide && (
                  <Icon name="chevron" size={16} color="#9ca3af" />
                )}
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
