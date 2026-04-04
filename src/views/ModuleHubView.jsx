// src/views/ModuleHubView.jsx
import React, { useState, useEffect } from 'react';
import {
  Calculator, BarChart3, ClipboardList, FileStack, ShieldCheck,
  Folder, LogOut, User, Lock, ArrowRight, Sparkles, Briefcase, Wrench, Receipt,
  ChevronRight, Zap, Globe, Layers, Settings, Palette, Shield
} from 'lucide-react';

// ─── DÉFINITION DES GROUPES DE MODULES ──────────────────────────────────────

const MODULE_GROUPS = [
  {
    id: 'project',
    label: 'Projet & Estimation',
    description: 'Gestion de vos projets VRD, chiffrage et analyse',
    icon: Briefcase,
    modules: [
      {
        id: 'projects_manager',
        label: 'Gestion de Projets',
        description: 'Création, organisation et gestion de vos projets VRD',
        icon: Folder,
        color: 'cyan',
        access: 'all',
        tag: 'Core',
      },
      {
        id: 'estima',
        label: 'ESTIMA VRD',
        description: 'Estimation, chiffrage et documents de consultation',
        icon: Calculator,
        color: 'emerald',
        access: 'all',
        tag: 'Core',
        featured: true,
      },
      {
        id: 'rao_analysis',
        label: 'RAO & Analyse',
        description: "Rapport d'analyse des offres et analyse comparative",
        icon: BarChart3,
        color: 'blue',
        access: 'all',
        tag: 'Analyse',
      },
    ],
  },
  {
    id: 'tools',
    label: 'Outils & Administration',
    description: 'Modules complémentaires et gestion',
    icon: Wrench,
    modules: [
      {
        id: 'devis_moe',
        label: 'Devis MOE',
        description: "Proposition d'honoraires de maîtrise d'œuvre VRD",
        icon: Receipt,
        color: 'indigo',
        access: 'admin_only',
        tag: 'Finance',
      },
      {
        id: 'crc',
        label: 'Compte Rendu Chantier',
        description: 'Suivi de chantier et comptes rendus de réunion',
        icon: ClipboardList,
        color: 'amber',
        access: 'admin_or_unlocked',
        tag: 'Terrain',
      },
      {
        id: 'doc_admin',
        label: 'Documents Administratifs',
        description: 'Génération des documents administratifs de marché',
        icon: FileStack,
        color: 'purple',
        access: 'admin_or_unlocked',
        tag: 'Admin',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Paramètres & Compte',
    description: 'Configuration, identité visuelle et gestion du compte',
    icon: Settings,
    modules: [
      {
        id: 'branding',
        label: 'Identité & Charte Graphique',
        description: 'Logo, couleurs, typographie et informations de contact pour vos exports',
        icon: Palette,
        color: 'purple',
        access: 'all',
        tag: 'Branding',
      },
      {
        id: 'rgpd',
        label: 'Mon Compte & Données',
        description: 'RGPD — Portabilité des données et droit à l\'effacement',
        icon: Shield,
        color: 'blue',
        access: 'all',
        tag: 'RGPD',
      },
      {
        id: 'admin',
        label: 'Administration',
        description: "Utilisateurs, entreprise et paramètres",
        icon: ShieldCheck,
        color: 'red',
        access: 'admin_only',
        tag: 'Système',
      },
    ],
  },
];

// ─── COULEURS ───────────────────────────────────────────────────────────────

const COLOR_MAP = {
  cyan: {
    border: 'border-cyan-500/20',
    hoverBorder: 'group-hover:border-cyan-400/60',
    text: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    iconRing: 'border-cyan-500/30',
    tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    glow: 'rgba(6,182,212,0.3)',
    accent: 'rgba(6,182,212,0.15)',
  },
  emerald: {
    border: 'border-emerald-500/20',
    hoverBorder: 'group-hover:border-emerald-400/60',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconRing: 'border-emerald-500/30',
    tagBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    glow: 'rgba(16,185,129,0.3)',
    accent: 'rgba(16,185,129,0.15)',
  },
  blue: {
    border: 'border-blue-500/20',
    hoverBorder: 'group-hover:border-blue-400/60',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    iconRing: 'border-blue-500/30',
    tagBg: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    glow: 'rgba(59,130,246,0.3)',
    accent: 'rgba(59,130,246,0.15)',
  },
  amber: {
    border: 'border-amber-500/20',
    hoverBorder: 'group-hover:border-amber-400/60',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconRing: 'border-amber-500/30',
    tagBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    glow: 'rgba(245,158,11,0.3)',
    accent: 'rgba(245,158,11,0.15)',
  },
  purple: {
    border: 'border-purple-500/20',
    hoverBorder: 'group-hover:border-purple-400/60',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    iconRing: 'border-purple-500/30',
    tagBg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    glow: 'rgba(168,85,247,0.3)',
    accent: 'rgba(168,85,247,0.15)',
  },
  red: {
    border: 'border-red-500/20',
    hoverBorder: 'group-hover:border-red-400/60',
    text: 'text-red-400',
    iconBg: 'bg-red-500/10',
    iconRing: 'border-red-500/30',
    tagBg: 'bg-red-500/10 text-red-300 border-red-500/20',
    glow: 'rgba(239,68,68,0.3)',
    accent: 'rgba(239,68,68,0.15)',
  },
  indigo: {
    border: 'border-indigo-500/20',
    hoverBorder: 'group-hover:border-indigo-400/60',
    text: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    iconRing: 'border-indigo-500/30',
    tagBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    glow: 'rgba(99,102,241,0.3)',
    accent: 'rgba(99,102,241,0.15)',
  },
};

// ─── COMPOSANT CARTE MODULE ────────────────────────────────────────────────

function ModuleCard({ mod, colors, accessible, onSelect }) {
  const Icon = mod.icon;

  return (
    <button
      onClick={() => accessible && onSelect(mod.id)}
      disabled={!accessible}
      style={accessible ? { '--card-glow': `0 8px 30px -10px ${colors.glow}` } : undefined}
      className={`
        group relative flex flex-col text-left w-full h-[200px] rounded-2xl border backdrop-blur-xl
        transition-all duration-400 ease-out overflow-hidden
        ${accessible
          ? `${colors.border} bg-white/[0.02] hover:bg-white/[0.04] ${colors.hoverBorder} hover:shadow-[var(--card-glow)] hover:-translate-y-1`
          : 'border-white/[0.02] bg-white/[0.01] cursor-not-allowed opacity-60'
        }
      `}
    >
      {/* Top glow effect on hover */}
      {accessible && (
        <div
          className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: colors.accent }}
        />
      )}

      <div className="relative z-10 p-5 flex flex-col h-full w-full">
        {/* Header : icône + tag */}
        <div className="flex items-start justify-between mb-4">
          <div
            style={accessible ? { '--icon-glow': `0 0 15px ${colors.glow}` } : undefined}
            className={`
            p-3 rounded-xl border transition-all duration-300
            ${accessible
              ? `${colors.iconBg} ${colors.iconRing} group-hover:scale-110 group-hover:shadow-[var(--icon-glow)]`
              : 'bg-white/[0.02] border-white/[0.05]'
            }
          `}>
            <Icon
              size={22}
              className={`transition-colors duration-300 ${accessible ? colors.text : 'text-slate-500'}`}
              strokeWidth={1.5}
            />
          </div>

          {!accessible ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
              <Lock size={12} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Verrouillé</span>
            </span>
          ) : mod.tag ? (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colors.tagBg}`}>
              {mod.tag}
            </span>
          ) : null}
        </div>

        {/* Texte */}
        <div className="flex-1 mt-1">
          <h3 className={`
              font-bold text-base tracking-tight mb-1.5 transition-colors duration-300
              ${accessible ? 'text-slate-100 group-hover:text-white' : 'text-slate-400'}
          `}>
            {mod.label}
          </h3>
          <p className={`
              text-[13px] leading-relaxed line-clamp-2 transition-colors duration-300
              ${accessible ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-600'}
          `}>
            {mod.description}
          </p>
        </div>

        {/* Footer */}
        <div className={`mt-auto pt-3 border-t transition-colors duration-300 relative h-9 overflow-hidden ${accessible ? 'border-white/[0.05] group-hover:border-white/[0.1]' : 'border-white/[0.02]'}`}>
          <div className={`absolute inset-0 flex items-center justify-between transition-all duration-300 ${accessible ? 'group-hover:opacity-0 group-hover:-translate-x-4' : ''}`}>
            <span className="text-[11px] font-medium text-slate-500">
              {accessible ? 'Prêt à l\'emploi' : 'Accès restreint'}
              </span>
            </div>
            {accessible && (
              <div className={`absolute inset-0 flex items-center justify-between opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`}>
              <span className={`text-[12px] font-bold ${colors.text}`}>
                Accéder au module
              </span>
              <ArrowRight size={16} className={`${colors.text}`} />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

export default function ModuleHubView({ isAdmin, userEmail, onSelectModule, onLogout }) {

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const canAccess = (mod) => {
    if (mod.access === 'all') return true;
    if (mod.access === 'admin_only') return isAdmin;
    if (mod.access === 'admin_or_unlocked') return isAdmin;
    return false;
  };

  const isVisible = (mod) => {
    if (mod.access === 'admin_only') return isAdmin;
    return true;
  };

  const firstName = userEmail?.split('@')[0]?.split('.')[0] || '';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a101d] text-slate-300 overflow-hidden font-sans selection:bg-emerald-500/30">

      {/* ── Background effects ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiPjxwb2x5Z29uIHBvaW50cz0iNjAsMCA2MCw2MCAwLDYwIi8+PC9nPjwvc3ZnPg==")`,
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Soft floating orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-8 lg:px-12 py-5 shrink-0 bg-white/[0.01] backdrop-blur-md border-b border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <Layers size={20} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-xl tracking-tight text-white">Estima</span>
            <span className="text-xs font-medium text-slate-400">Suite</span>
          </div>
        </div>

        {/* User area */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.02] border border-white/[0.05] shadow-sm backdrop-blur-md">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-inner">
              <span className="text-xs font-bold text-white shadow-sm">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col pr-1">
              <span className="text-[11px] text-white font-bold leading-none mb-0.5">{displayName}</span>
              <span className="text-[9px] text-slate-400 font-medium leading-none">{isAdmin ? 'Administrateur' : 'Utilisateur'}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.02] border border-white/[0.05] text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-300 backdrop-blur-md"
            title="Se déconnecter"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="flex flex-col justify-center min-h-full max-w-[1400px] w-full mx-auto px-8 lg:px-12 py-8">

          {/* Hero section */}
          <div
            className={`shrink-0 mb-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
                  <Sparkles size={14} className="text-emerald-400" /> Estima Suite · {isAdmin ? 'Administrateur' : 'Utilisateur'}
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-2">
                  {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{displayName}</span>.
                </h1>
                <p className="text-sm lg:text-base text-slate-400 max-w-xl leading-snug">
                  Sélectionnez un module pour accéder à votre espace de travail. Vos données sont synchronisées et sécurisées en temps réel.
                </p>
              </div>
              <div className="hidden md:flex flex-col items-end">
                <p className="text-sm font-semibold text-slate-300 capitalize">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Système en ligne
                </p>
              </div>
            </div>
          </div>

          {/* Module groups */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-12">
            {MODULE_GROUPS.map((group, groupIdx) => {
              const visibleModules = group.modules.filter(isVisible);
              if (visibleModules.length === 0) return null;

              const GroupIcon = group.icon;

              return (
                <section
                  key={group.id}
                  className={`flex flex-col h-full min-h-0 transition-all duration-700 ease-out ${
                    mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: `${150 + groupIdx * 100}ms` }}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shadow-inner">
                      <GroupIcon size={16} className="text-slate-300" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {group.label}
                    </h2>
                  </div>

                  {/* Cards grid */}
                  <div className="flex-1 min-h-0 flex flex-col justify-start gap-4">
                    {visibleModules.map((mod, modIdx) => {
                      const colors = COLOR_MAP[mod.color];
                      const accessible = canAccess(mod);

                      return (
                        <div
                          key={mod.id}
                          className={`transition-all duration-700 ease-out ${
                            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                          }`}
                          style={{ transitionDelay: `${250 + groupIdx * 100 + modIdx * 60}ms` }}
                        >
                          <ModuleCard
                            mod={mod}
                            colors={colors}
                            accessible={accessible}
                            onSelect={onSelectModule}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 flex items-center justify-between px-8 py-4 border-t border-white/[0.04] shrink-0 bg-white/[0.01] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">Tous les systèmes opérationnels</span>
        </div>
        <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">
          Estima Suite &copy; {new Date().getFullYear()}
        </p>
        <span className="text-[11px] font-mono text-slate-600 font-medium">v2.0.0</span>
      </footer>
    </div>
  );
}
