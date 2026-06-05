// src/views/ModuleHubView.jsx — Bento Box Apple-style
import React, { useState, useEffect } from 'react';
import {
  Calculator, Zap, BarChart3, ClipboardList, FileStack, ShieldCheck,
  Folder, LogOut, Lock, Briefcase, Wrench, Receipt, Car,
  Layers, Settings, Palette, Shield, Smartphone, RefreshCw,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, MapPin, ChevronRight, Sparkles
} from 'lucide-react';
import { APP_VERSION } from '../data/changelog';
import ChangelogModal from '../components/ChangelogModal';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

// ─── WIDGET MÉTÉO ──────────────────────────────────────────────────────────

const WMO_ICONS = {
  0: Sun, 1: Sun, 2: Cloud, 3: Cloud, 45: CloudFog, 48: CloudFog,
  51: CloudDrizzle, 53: CloudDrizzle, 55: CloudDrizzle,
  61: CloudRain, 63: CloudRain, 65: CloudRain,
  71: CloudSnow, 73: CloudSnow, 75: CloudSnow,
  80: CloudRain, 81: CloudRain, 82: CloudRain, 85: CloudSnow, 86: CloudSnow,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
};

function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function fetchWeather() {
      try {
        const pos = await new Promise((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 5000 }));
        const { latitude, longitude } = pos.coords;
        const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
        const meteo = await meteoRes.json();
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&accept-language=fr`);
        const geo = await geoRes.json();
        const city = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.municipality || '';
        if (!cancelled) setWeather({ temp: Math.round(meteo.current.temperature_2m), code: meteo.current.weather_code, city });
      } catch { /* pas de géolocalisation */ }
    }
    fetchWeather();
    return () => { cancelled = true; };
  }, []);
  if (!weather) return null;
  const WeatherIcon = WMO_ICONS[weather.code] || Cloud;
  return (
    <div className="flex items-center gap-2">
      <WeatherIcon size={16} className="text-amber-500" strokeWidth={1.5} />
      <span className="text-sm font-medium text-gray-600">{weather.temp}°C</span>
    </div>
  );
}

// ─── MODULES — Flat list avec row assignment ───────────────────────────────

const MODULES = [
  // Row 1 — Projet & Estimation (white)
  { id: 'projects_manager', label: 'Gestion de Projets', description: 'Création, organisation et gestion de vos projets VRD', icon: Folder, access: 'all', tag: 'Core', row: 1 },
  { id: 'estima', label: 'ESTIMA VRD', description: 'Estimation, chiffrage et documents de consultation', icon: Calculator, access: 'all', tag: 'Core', row: 1, featured: true },
  { id: 'estim_rapide', label: 'Estimation Rapide', description: "Chiffrage d'enveloppe par ratios et grands lots VRD — esquisse & avant-projet", icon: Zap, access: 'all', tag: 'Esquisse', row: 1 },
  { id: 'rao_analysis', label: 'RAO & Analyse', description: "Rapport d'analyse des offres et analyse comparative", icon: BarChart3, access: 'all', tag: 'Analyse', row: 1 },
  // Row 2 — Outils & Administration (copper glass)
  { id: 'devis_moe', label: 'Devis MOE', description: "Proposition d'honoraires de maîtrise d'œuvre VRD", icon: Receipt, access: 'admin_only', tag: 'Finance', row: 2 },
  { id: 'expense_notes', label: 'Notes de Frais', description: 'Frais kilométriques avec barème fiscal', icon: Car, access: 'admin_only', tag: 'Finance', row: 2 },
  { id: 'crc', label: 'Compte Rendu Chantier', description: 'Suivi de chantier et comptes rendus de réunion', icon: ClipboardList, access: 'admin_or_unlocked', tag: 'Terrain', row: 2 },
  { id: 'doc_admin', label: 'Documents Administratifs', description: 'Génération des documents administratifs de marché', icon: FileStack, access: 'admin_or_unlocked', tag: 'Admin', row: 2 },
  { id: 'site_visits', label: 'Visites de Site', description: 'Documentation terrain avec photos et GPS', icon: MapPin, access: 'all', tag: 'Terrain', row: 2 },
  // Row 3 — Paramètres & Compte (amethyst glass)
  { id: 'branding', label: 'Identité & Charte Graphique', description: 'Logo, couleurs, typographie et informations de contact', icon: Palette, access: 'all', tag: 'Branding', row: 3 },
  { id: 'rgpd', label: 'Mon Compte & Données', description: 'RGPD — Portabilité des données et droit à l\'effacement', icon: Shield, access: 'all', tag: 'RGPD', row: 3 },
  { id: 'admin', label: 'Administration', description: "Utilisateurs, entreprise et paramètres", icon: ShieldCheck, access: 'admin_only', tag: 'Système', row: 3 },
];

// ─── ROW THEMES ────────────────────────────────────────────────────────────

const ROW_THEMES = {
  1: {
    // Clean white
    card: 'bg-white border-gray-200/70',
    cardHover: 'hover:shadow-lg hover:shadow-gray-200/60 hover:-translate-y-0.5',
    iconBg: 'bg-gray-50',
    iconColor: 'text-gray-700',
    title: 'text-gray-900',
    desc: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-500 border border-gray-200/60',
    status: 'text-gray-400',
    statusLabel: 'Prêt à l\'emploi',
  },
  2: {
    // Dark copper glass
    card: 'bg-gradient-to-br from-amber-950/90 via-stone-900/95 to-stone-950/90 border-amber-700/30',
    cardHover: 'hover:shadow-xl hover:shadow-amber-900/20 hover:-translate-y-0.5',
    iconBg: 'bg-amber-800/40',
    iconColor: 'text-amber-400',
    title: 'text-amber-50',
    desc: 'text-amber-200/60',
    badge: 'bg-amber-800/40 text-amber-300/80 border border-amber-600/30',
    status: 'text-amber-400/50',
    statusLabel: 'Prêt à l\'emploi',
  },
  3: {
    // Dark amethyst glass
    card: 'bg-gradient-to-br from-violet-950/90 via-purple-950/95 to-slate-950/90 border-violet-700/30',
    cardHover: 'hover:shadow-xl hover:shadow-violet-900/20 hover:-translate-y-0.5',
    iconBg: 'bg-violet-800/40',
    iconColor: 'text-violet-400',
    title: 'text-violet-50',
    desc: 'text-violet-200/60',
    badge: 'bg-violet-800/40 text-violet-300/80 border border-violet-600/30',
    status: 'text-violet-400/50',
    statusLabel: 'Prêt à l\'emploi',
  },
};

// ─── BENTO CARD ────────────────────────────────────────────────────────────

function BentoCard({ mod, theme, accessible, onSelect, mounted, delay }) {
  const Icon = mod.icon;

  return (
    <button
      onClick={() => accessible && onSelect(mod.id)}
      disabled={!accessible}
      className={`
        group relative flex flex-col lg:flex-1 text-left rounded-[24px] border p-[clamp(0.625rem,1.2vh,1.5rem)] transition-all duration-500 ease-out
        ${theme.card}
        ${accessible ? `${theme.cardHover} cursor-pointer` : 'opacity-50 cursor-not-allowed'}
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Header: icon + badge */}
      <div className="flex items-start justify-between mb-[clamp(0.25rem,0.5vh,1rem)]">
        <div className={`p-[clamp(0.375rem,0.6vh,0.75rem)] rounded-xl ${theme.iconBg} transition-transform duration-200 ${accessible ? 'group-hover:scale-110' : ''}`}>
          <Icon size={24} className={accessible ? theme.iconColor : 'text-gray-400'} strokeWidth={1.5} />
        </div>
        {!accessible ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-200/50 text-gray-400">
            <Lock size={10} />
            <span className="text-[9px] font-semibold uppercase tracking-wide">Verrouillé</span>
          </span>
        ) : mod.tag ? (
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${theme.badge}`}>
            {mod.tag}
          </span>
        ) : null}
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3 className={`font-semibold text-[15px] tracking-tight mb-1.5 ${accessible ? theme.title : 'text-gray-400'}`}>
          {mod.label}
        </h3>
        <p className={`text-[12px] leading-relaxed ${accessible ? theme.desc : 'text-gray-300'}`}>
          {mod.description}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-[clamp(0.25rem,0.5vh,1rem)] flex items-center justify-between">
        <span className={`text-[11px] font-medium ${theme.status}`}>
          {accessible ? theme.statusLabel : 'Accès restreint'}
        </span>
        {accessible && (
          <ChevronRight
            size={16}
            className={`${theme.status} opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200`}
          />
        )}
      </div>
    </button>
  );
}

// ─── ROW LABELS ────────────────────────────────────────────────────────────

const ROW_LABELS = {
  1: { label: 'Projet & Estimation', icon: Briefcase },
  2: { label: 'Outils & Administration', icon: Wrench },
  3: { label: 'Paramètres & Compte', icon: Settings },
};

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

export default function ModuleHubView({ isAdmin, userEmail, userModules, onSelectModule, onLogout, onSwitchToMobile = null }) {
  const [mounted, setMounted] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleClearCache = async () => {
    if (cacheClearing) return;
    setCacheClearing(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.error('Cache clear failed', e);
    }
    setTimeout(() => window.location.reload(), 900);
  };

  // Modèle de permissions :
  // - Module 'admin' : exclusivement gated par isAdmin (toujours)
  // - userModules défini (array Firestore) : source de vérité, override le flag access legacy
  // - userModules absent : fallback legacy basé sur mod.access
  const hasModuleRestriction = Array.isArray(userModules);

  const canAccess = (mod) => {
    if (mod.id === 'admin') return isAdmin;
    if (hasModuleRestriction) return userModules.includes(mod.id);
    if (mod.access === 'all') return true;
    if (mod.access === 'admin_only') return isAdmin;
    if (mod.access === 'admin_or_unlocked') return isAdmin;
    return false;
  };

  const isVisible = (mod) => {
    if (mod.id === 'admin') return isAdmin;
    if (hasModuleRestriction) return userModules.includes(mod.id);
    if (mod.access === 'admin_only') return isAdmin;
    return true;
  };

  const firstName = userEmail?.split('@')[0]?.split('.')[0] || '';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const visibleModules = MODULES.filter(isVisible);
  const rows = [1, 2, 3];

  return (
    <div className="flex flex-col h-screen w-full bg-[#f5f5f7] text-gray-900 overflow-hidden selection:bg-blue-200"
      >

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="moduleHub" />

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-8 lg:px-12 py-[clamp(0.375rem,0.5vh,0.75rem)] shrink-0 bg-white/70 backdrop-blur-2xl border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-gray-900" style={{ fontFamily: '"SF Pro Display", Georgia, serif' }}>
            Estima Suite
          </span>
        </div>

        <div className="flex items-center gap-5">
          <WeatherWidget />
          <span className="text-sm text-gray-500 capitalize hidden md:block">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium text-gray-700 hidden md:block">{displayName}</span>
          </div>
          {onSwitchToMobile && (
            <button
              onClick={onSwitchToMobile}
              className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
              title="Passer en vue mobile"
              aria-label="Passer en vue mobile"
            >
              <Smartphone size={15} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={handleClearCache}
            disabled={cacheClearing}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${cacheClearing ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
            title="Vider le cache et recharger"
            aria-label="Vider le cache et recharger"
          >
            <RefreshCw size={15} strokeWidth={2} className={cacheClearing ? 'animate-spin' : ''} />
          </button>
          <HelpButton onClick={() => setShowHelp(true)} />
          <button
            onClick={onLogout}
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
            title="Se déconnecter"
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="flex flex-col flex-1 min-h-0 max-w-[1360px] w-full mx-auto px-8 lg:px-12 py-[clamp(0.75rem,1.5vh,1.5rem)]">

          {/* Hero */}
          <div className={`shrink-0 mb-[clamp(0.5rem,1vh,1.5rem)] transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h1 className="text-4xl md:text-5xl lg:text-[clamp(1.75rem,3.5vh,3.25rem)] font-semibold text-gray-900 tracking-tight leading-tight"
              style={{ fontFamily: '"SF Pro Display", Georgia, -apple-system, serif' }}>
              {greeting},{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400">
                {displayName}
              </span>.
            </h1>
            <p className="text-[clamp(0.8rem,1.2vw,1.125rem)] text-gray-400 mt-[clamp(0.125rem,0.3vh,0.5rem)] font-light">
              Sélectionnez un module pour commencer.
            </p>
          </div>

          {/* Bento Grid — desktop : 3 colonnes (rows horizontales)
              Tablette/mobile : 1 colonne externe (sections empilées),
                chaque section a ses cartes en grille 2 cols (md) ou 1 col (mobile) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[clamp(0.5rem,0.8vh,1.25rem)] lg:flex-1 lg:min-h-0">
            {rows.map((rowNum) => {
              const colModules = visibleModules.filter(m => m.row === rowNum);
              if (colModules.length === 0) return null;
              const ColIcon = ROW_LABELS[rowNum].icon;

              return (
                <div key={rowNum} className="flex flex-col lg:min-h-0">
                  {/* Column label */}
                  <div className={`flex items-center gap-2 mb-[clamp(0.25rem,0.4vh,0.75rem)] mt-3 lg:mt-0 shrink-0 transition-all duration-700 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: `${100 + rowNum * 80}ms` }}>
                    <ColIcon size={14} className={rowNum === 1 ? 'text-gray-400' : rowNum === 2 ? 'text-amber-500/70' : 'text-violet-500/70'} strokeWidth={1.5} />
                    <span className={`text-xs font-medium uppercase tracking-widest ${rowNum === 1 ? 'text-gray-400' : rowNum === 2 ? 'text-amber-600/50' : 'text-violet-600/50'}`}>
                      {ROW_LABELS[rowNum].label}
                    </span>
                  </div>
                  {/* Cards : mobile stacked / tablet grid 2 cols / desktop flex-col qui remplit */}
                  <div className="flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-col gap-[clamp(0.375rem,0.6vh,1rem)] lg:flex-1 lg:min-h-0">
                    {colModules.map((mod, idx) => (
                      <BentoCard
                        key={mod.id}
                        mod={mod}
                        theme={ROW_THEMES[rowNum]}
                        accessible={canAccess(mod)}
                        onSelect={onSelectModule}
                        mounted={mounted}
                        delay={200 + rowNum * 100 + idx * 60}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 flex items-center justify-center gap-4 px-8 py-[clamp(0.25rem,0.3vh,0.5rem)] shrink-0 bg-transparent">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-[10px] font-medium text-gray-400">Opérationnel</span>
        </div>
        <span className="text-[10px] text-gray-300">·</span>
        <span className="text-[10px] text-gray-400">Estima Suite &copy; {new Date().getFullYear()}</span>
        <span className="text-[10px] text-gray-300">·</span>
        <span className="text-[10px] font-mono text-gray-300">v{APP_VERSION}</span>
        <span className="text-[10px] text-gray-300">·</span>
        <button
          onClick={() => setShowChangelog(true)}
          className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-blue-500 transition-colors"
        >
          <Sparkles size={10} />
          Nouveautés
        </button>
      </footer>

      {/* ── Changelog modal ── */}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
