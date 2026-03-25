import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Settings, 
  FileText, 
  Calculator,
  Folder,
  LineChart, 
  LogOut,    
  User,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  FileCheck,
  ShieldCheck,  // ← icône Admin
  Cloud, CheckCircle2, AlertCircle, Loader
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, onLogout, userEmail, onOpenCalculator, onToggle, isAdmin, saveStatus, projectName }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onToggle) onToggle(newState);
  };

  // --- 1. DEFINITION DES SECTIONS DU HAUT ---
  const sections = [
    {
      id: 'gestion_section',
      items: [
        { id: 'projects_manager', label: 'Gestion Projets', icon: Folder }
      ]
    },
    {
      id: 'travail_section',
      items: [
        { id: 'project', label: 'Projet en cours', icon: LayoutDashboard }
      ]
    },
    {
      id: 'documents_section',
      items: [
        { id: 'bpu_export', label: 'Bordereau de prix', icon: FileText },
        { id: 'cctp', label: 'CCTP', icon: BookOpen },
        { id: 'rc', label: 'Règlement Consul.', icon: FileCheck }
      ]
    },
    {
      id: 'analyse_section',
      items: [
        { id: 'price_analysis', label: 'Analyse des Prix', icon: LineChart }
      ]
    }
  ];

  // --- 2. ITEMS DU BAS (FIXES) ---
  const libraryItem  = { id: 'database',  label: 'Bibliothèque', icon: Database };
  const settingsItem = { id: 'settings',  label: 'Paramètres',   icon: Settings };
  const adminItem    = { id: 'admin',     label: 'Administration', icon: ShieldCheck };

  // --- COMPOSANT BOUTON DE NAVIGATION ---
  const NavButton = ({ item, highlight }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    
    return (
      <button
        onClick={() => setActiveTab(item.id)}
        title={isCollapsed ? item.label : ''}
        className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
          isActive 
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
            : highlight
              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
      >
        {/* Barre latérale active */}
        <div className={`absolute left-0 w-1 bg-emerald-400 transition-all duration-500 shadow-[0_0_15px_#34d399] ${
          isActive ? 'h-6 opacity-100' : 'h-0 opacity-0'
        }`} />

        {/* Icône */}
        <div className={`flex items-center justify-center shrink-0 ${isCollapsed ? 'w-full' : ''}`}>
           <Icon 
            size={20} 
            className={`transition-all duration-300 ${
              isActive ? 'scale-110 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]' : 'group-hover:scale-110'
            }`} 
          />
        </div>
        
        {/* Label Texte */}
        <div className={`overflow-hidden transition-all duration-300 flex items-center ${isCollapsed ? 'w-0 opacity-0' : 'w-40 opacity-100 ml-2'}`}>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
            {item.label}
          </span>
        </div>

        {/* Point lumineux actif */}
        {isActive && !isCollapsed && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
        )}
      </button>
    );
  };

  return (
    <div 
      className={`
        relative flex flex-col h-screen z-50 print:hidden border-r border-white/10 bg-[#040a0e] text-slate-300 
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-72'}
      `}
    >
      {/* Fond décoratif */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.18)_0%,transparent_50%)] pointer-events-none" />

      {/* HEADER : LOGO & CALCULATRICE */}
      <div className="p-4 mb-2 relative z-10 flex flex-col gap-4">
        {/* Bouton Toggle */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'}`}>
          <button 
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        {/* Logo / Calculatrice */}
        <div 
          className={`flex items-center gap-3 cursor-pointer group transition-all duration-300 ${isCollapsed ? 'justify-center flex-col' : ''}`}
          onClick={onOpenCalculator}
          title="Ouvrir la calculatrice"
        >
          <div className="relative p-2.5 rounded-xl bg-slate-900 border-2 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.25)] group-hover:border-emerald-400 transition-all shrink-0">
            <Calculator size={24} className="text-emerald-400" />
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl animate-pulse" />
          </div>
          
          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 h-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="font-black text-xl tracking-tighter text-white whitespace-nowrap">
              ESTIMA
            </h1>
            <p className="text-[7px] font-black text-emerald-500/70 tracking-[0.4em] uppercase">Papyrus</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION PRINCIPALE (SCROLLABLE) */}
      <nav className="flex-1 px-3 flex flex-col gap-6 relative z-10 overflow-y-auto no-scrollbar overflow-x-hidden">
        {/* Boucle sur les sections du haut */}
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-1">
            {!isCollapsed && (
               <div className="h-[1px] w-8 bg-gradient-to-r from-emerald-500/40 to-transparent mb-2 ml-4 rounded-full transition-all" />
            )}
            {section.items.map(item => (
              <NavButton key={item.id} item={item} />
            ))}
          </div>
        ))}

        {/* ESPACE VIDE FLEXIBLE */}
        <div className="flex-1" />

        {/* --- ZONE DU BAS : BIBLIOTHÈQUE + PARAMÈTRES + ADMIN --- */}
        <div className="pb-4 border-t border-white/10 pt-4 flex flex-col gap-1">
          <NavButton item={libraryItem} />
          <NavButton item={settingsItem} />

          {/* Onglet Admin — visible uniquement si isAdmin === true */}
          {isAdmin && (
            <>
              {/* Séparateur */}
              {!isCollapsed && (
                <div className="h-[1px] w-8 bg-gradient-to-r from-amber-500/40 to-transparent my-2 ml-4 rounded-full" />
              )}
              <NavButton item={adminItem} highlight={true} />
            </>
          )}
        </div>
      </nav>


      {/* ── INDICATEUR AUTOSAVE ── */}
      <div className={`mx-3 mb-2 rounded-xl border transition-all duration-500 overflow-hidden ${
        isCollapsed ? 'p-2 flex flex-col items-center gap-1' : 'px-3 py-2.5'
      } ${
        saveStatus === 'saving'  ? 'bg-blue-500/5 border-blue-500/20' :
        saveStatus === 'waiting' ? 'bg-amber-500/5 border-amber-500/20' :
        saveStatus === 'error'   ? 'bg-red-500/5 border-red-500/20' :
                                   'bg-emerald-500/5 border-emerald-500/10'
      }`}>
        {/* Icône */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <Loader size={12} className="text-blue-400 animate-spin shrink-0" />}
          {saveStatus === 'waiting' && <Cloud size={12} className="text-amber-400 animate-pulse shrink-0" />}
          {saveStatus === 'error' && <AlertCircle size={12} className="text-red-400 shrink-0" />}
          {(!saveStatus || saveStatus === 'saved') && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}

          {/* Texte (masqué si collapsed) */}
          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
              saveStatus === 'saving'  ? 'text-blue-400' :
              saveStatus === 'waiting' ? 'text-amber-400' :
              saveStatus === 'error'   ? 'text-red-400' :
                                         'text-emerald-400'
            }`}>
              {saveStatus === 'saving'  ? 'Sauvegarde...' :
               saveStatus === 'waiting' ? 'Modifications en attente' :
               saveStatus === 'error'   ? 'Erreur de sauvegarde' :
                                          'Projet sauvegardé'}
            </p>
            {projectName && (
              <p className="text-[9px] text-slate-600 truncate max-w-[150px] mt-0.5">{projectName}</p>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER : PROFIL UTILISATEUR */}
      <div className="p-3 relative z-10">
        <div className={`
          rounded-xl bg-slate-900/50 border border-white/5 backdrop-blur-md transition-all duration-300
          ${isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-4'}
        `}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center mb-0 pb-0' : 'mb-3 pb-3 border-b border-white/5'}`}>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <User size={14} className="text-emerald-400" />
            </div>
            
            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Compte</p>
              <p className="text-[10px] font-bold text-white truncate w-28" title={userEmail}>
                {userEmail || 'Utilisateur'}
              </p>
            </div>
          </div>

          <button 
            onClick={onLogout}
            className={`
              flex items-center justify-center gap-2 rounded-lg border border-red-500/10 bg-red-500/5 text-red-400/70 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all group
              ${isCollapsed ? 'w-8 h-8 p-0' : 'w-full py-2.5'}
            `}
            title="Se déconnecter"
          >
            <LogOut size={16} className="group-hover:scale-110 transition-transform" />
            <span className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 text-[9px] font-black uppercase tracking-widest'}`}>
              Déconnexion
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;