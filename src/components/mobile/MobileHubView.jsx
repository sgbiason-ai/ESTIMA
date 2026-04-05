// src/components/mobile/MobileHubView.jsx
//
// Hub d'accueil mobile — écran d'atterrissage avec accès aux modules.
// Design adapté du ModuleHubView desktop pour contexte tactile.

import React, { useState, useEffect } from 'react';
import Icon from './Icon';

// ─── DÉFINITION DES MODULES MOBILES ─────────────────────────────────────────

const MOBILE_MODULES = [
  {
    id: 'projects',
    label: 'Mes Projets',
    description: 'Consultation des devis, DQE et analyses',
    icon: 'folder',
    color: 'emerald',
    tag: 'Core',
  },
  {
    id: 'crc',
    label: 'Comptes Rendus',
    description: 'Consultation des CR de chantier',
    icon: 'clipboard',
    color: 'amber',
    tag: 'CRC',
  },
  {
    id: 'moe',
    label: 'Devis MOE',
    description: 'Honoraires maîtrise d\'œuvre',
    icon: 'euro',
    color: 'purple',
    tag: 'MOE',
  },
  {
    id: 'doc_admin',
    label: 'Documents Admin',
    description: 'Fiches marché et documents EXE',
    icon: 'file',
    color: 'rose',
    tag: 'EXE',
  },
  {
    id: 'exports',
    label: 'Exports Rapides',
    description: 'PDF, Excel — télécharger ou partager',
    icon: 'download',
    color: 'cyan',
    tag: 'Export',
  },
];

// ─── COULEURS ───────────────────────────────────────────────────────────────

const COLORS = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    activeBorder: 'active:border-emerald-400/50',
    text: 'text-emerald-400',
    icon: '#34d399',
    tagBg: 'bg-emerald-500/10',
    tagText: 'text-emerald-300',
    tagBorder: 'border-emerald-500/20',
    glow: 'rgba(16,185,129,0.12)',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    activeBorder: 'active:border-cyan-400/50',
    text: 'text-cyan-400',
    icon: '#22d3ee',
    tagBg: 'bg-cyan-500/10',
    tagText: 'text-cyan-300',
    tagBorder: 'border-cyan-500/20',
    glow: 'rgba(6,182,212,0.12)',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    activeBorder: 'active:border-amber-400/50',
    text: 'text-amber-400',
    icon: '#fbbf24',
    tagBg: 'bg-amber-500/10',
    tagText: 'text-amber-300',
    tagBorder: 'border-amber-500/20',
    glow: 'rgba(245,158,11,0.12)',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    activeBorder: 'active:border-blue-400/50',
    text: 'text-blue-400',
    icon: '#60a5fa',
    tagBg: 'bg-blue-500/10',
    tagText: 'text-blue-300',
    tagBorder: 'border-blue-500/20',
    glow: 'rgba(59,130,246,0.12)',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    activeBorder: 'active:border-purple-400/50',
    text: 'text-purple-400',
    icon: '#a78bfa',
    tagBg: 'bg-purple-500/10',
    tagText: 'text-purple-300',
    tagBorder: 'border-purple-500/20',
    glow: 'rgba(168,85,247,0.12)',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    activeBorder: 'active:border-rose-400/50',
    text: 'text-rose-400',
    icon: '#fb7185',
    tagBg: 'bg-rose-500/10',
    tagText: 'text-rose-300',
    tagBorder: 'border-rose-500/20',
    glow: 'rgba(244,63,94,0.12)',
  },
};

// ─── COMPOSANT ──────────────────────────────────────────────────────────────

export default function MobileHubView({ userEmail, onSelectModule, onLogout, isLandscape }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const firstName = userEmail?.split('@')[0]?.split('.')[0] || '';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="flex flex-col h-full">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className={`px-5 ${isLandscape ? 'pt-3 pb-2' : 'pt-6 pb-4'} transition-all duration-500 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-1">
            <span className="font-extrabold text-base text-white tracking-tight">Estima</span>
            <span className="text-xs font-medium text-slate-500">Suite</span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 -mr-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Icon name="logout" size={18} color="currentColor" />
          </button>
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">
          {greeting},{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            {displayName}
          </span>
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Sélectionnez un module pour commencer.
        </p>
      </div>

      {/* ── Module cards ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className={isLandscape ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
          {MOBILE_MODULES.map((mod, idx) => {
            const c = COLORS[mod.color];
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`
                  relative flex items-center gap-4 w-full p-4 rounded-2xl
                  border backdrop-blur-sm text-left
                  transition-all duration-300 active:scale-[0.98]
                  ${c.border} ${c.activeBorder} bg-white/[0.02]
                `}
                style={{
                  transitionDelay: mounted ? `${100 + idx * 60}ms` : '0ms',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(12px)',
                }}
              >
                {/* Icon */}
                <div className={`
                  w-12 h-12 rounded-xl ${c.bg} border ${c.border}
                  flex items-center justify-center shrink-0
                `}>
                  <Icon name={mod.icon} size={22} color={c.icon} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-100">{mod.label}</span>
                    {mod.tag && (
                      <span className={`
                        px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest
                        border ${c.tagBg} ${c.tagText} ${c.tagBorder}
                      `}>
                        {mod.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-snug">{mod.description}</p>
                </div>

                {/* Chevron */}
                <Icon name="chevron" size={16} color="#475569" />
              </button>
            );
          })}
        </div>

        {/* ── Status footer ────────────────────────────────────────────── */}
        <div
          className={`flex items-center justify-center gap-2 mt-8 transition-all duration-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] text-slate-600 font-medium">
            Connecté · v2.0.0
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT DES MODULES POUR USAGE EXTERNE ──────────────────────────────────
export { MOBILE_MODULES, COLORS };
