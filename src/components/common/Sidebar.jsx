import React, { useState } from 'react';
import {
  LayoutDashboard, Database, Settings, FileText, Calculator, Folder,
  LineChart, LogOut, User, PanelLeftClose, PanelLeftOpen, BookOpen,
  FileCheck, ArrowLeft, Cloud, CheckCircle2, AlertCircle, Loader, Layers
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, onLogout, userEmail, onOpenCalculator, onToggle, saveStatus, projectName, onBackToHub, onBackToWorkspace }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onToggle) onToggle(newState);
  };

  const sections = [
    { id: 'travail_section', items: [{ id: 'project', label: 'Projet en cours', icon: LayoutDashboard }] },
    { id: 'documents_section', items: [
      { id: 'bpu_export', label: 'Bordereau de prix', icon: FileText },
      { id: 'cctp', label: 'CCTP', icon: BookOpen },
      { id: 'rc', label: 'Règlement Consul.', icon: FileCheck },
    ]},
    { id: 'analyse_section', items: [{ id: 'price_analysis', label: 'Analyse des Prix', icon: LineChart }] },
  ];

  const libraryItem  = { id: 'database',  label: 'Bibliothèque', icon: Database };
  const settingsItem = { id: 'settings',  label: 'Paramètres',   icon: Settings };

  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        onClick={() => setActiveTab(item.id)}
        title={isCollapsed ? item.label : ''}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
          isActive
            ? 'bg-blue-50 text-blue-600 border border-blue-200/60'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
        }`}
      >
        {/* Active bar */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r" />
        )}

        <div className={`flex items-center justify-center shrink-0 ${isCollapsed ? 'w-full' : ''}`}>
          <Icon size={18} strokeWidth={1.5} className={`transition-all duration-200 ${isActive ? '' : 'group-hover:scale-105'}`} />
        </div>

        <div className={`overflow-hidden transition-all duration-300 flex items-center ${isCollapsed ? 'w-0 opacity-0' : 'w-40 opacity-100'}`}>
          <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
        </div>

        {isActive && !isCollapsed && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div
      className={`relative flex flex-col h-screen z-50 print:hidden border-r border-gray-200/60 bg-white/80 backdrop-blur-xl text-gray-900
        transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}

    >
      {/* HEADER */}
      <div className="p-4 mb-1 flex flex-col gap-3">
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'justify-between'}`}>
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'gap-1'}`}>
            {onBackToHub && (
              <button onClick={onBackToHub} title="Retour aux modules"
                className={`flex items-center gap-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all ${isCollapsed ? 'p-1.5' : 'px-2.5 py-1.5'}`}>
                <ArrowLeft size={15} />
                {!isCollapsed && <span className="text-[10px] font-medium">Hub</span>}
              </button>
            )}
            {onBackToWorkspace && (
              <button onClick={onBackToWorkspace} title="Retour à la Gestion de Projets"
                className={`flex items-center gap-1.5 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all ${isCollapsed ? 'p-1.5' : 'px-2.5 py-1.5'}`}>
                <Layers size={15} />
                {!isCollapsed && <span className="text-[10px] font-medium">Workspace</span>}
              </button>
            )}
          </div>
          <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Logo */}
        <div className={`flex items-center gap-3 cursor-pointer group transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
          onClick={onOpenCalculator} title="Ouvrir la calculatrice">
          <div className="p-2 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 shadow-sm group-hover:shadow-md transition-all shrink-0">
            <Calculator size={20} className="text-white" />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="font-bold text-lg tracking-tight text-gray-900 whitespace-nowrap">Estima</h1>
            <p className="text-[9px] font-medium text-gray-400 tracking-wider">Suite VRD</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-3 flex flex-col gap-4 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            {!isCollapsed && <div className="h-px bg-gray-200/60 mb-2 ml-3 mr-6" />}
            {section.items.map(item => <NavButton key={item.id} item={item} />)}
          </div>
        ))}

        <div className="flex-1" />

        <div className="pb-3 border-t border-gray-200/60 pt-3 flex flex-col gap-0.5">
          <NavButton item={libraryItem} />
          <NavButton item={settingsItem} />
        </div>
      </nav>

      {/* AUTOSAVE INDICATOR */}
      <div className={`mx-3 mb-2 rounded-xl border transition-all duration-300 overflow-hidden ${
        isCollapsed ? 'p-2 flex flex-col items-center' : 'px-3 py-2'
      } ${
        saveStatus === 'saving'  ? 'bg-blue-50 border-blue-200/60' :
        saveStatus === 'waiting' ? 'bg-amber-50 border-amber-200/60' :
        saveStatus === 'error'   ? 'bg-red-50 border-red-200/60' :
                                   'bg-emerald-50 border-emerald-200/60'
      }`}>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <Loader size={12} className="text-blue-500 animate-spin shrink-0" />}
          {saveStatus === 'waiting' && <Cloud size={12} className="text-amber-500 animate-pulse shrink-0" />}
          {saveStatus === 'error' && <AlertCircle size={12} className="text-red-500 shrink-0" />}
          {(!saveStatus || saveStatus === 'saved') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}

          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}>
            <p className={`text-[10px] font-medium whitespace-nowrap ${
              saveStatus === 'saving'  ? 'text-blue-600' :
              saveStatus === 'waiting' ? 'text-amber-600' :
              saveStatus === 'error'   ? 'text-red-600' :
                                         'text-emerald-600'
            }`}>
              {saveStatus === 'saving'  ? 'Sauvegarde...' :
               saveStatus === 'waiting' ? 'Modifications' :
               saveStatus === 'error'   ? 'Erreur sauvegarde' :
                                          'Sauvegardé'}
            </p>
            {projectName && <p className="text-[9px] text-gray-400 truncate max-w-[150px] mt-0.5">{projectName}</p>}
          </div>
        </div>
      </div>

      {/* FOOTER: USER */}
      <div className="p-3">
        <div className={`rounded-xl bg-gray-50 border border-gray-200/60 transition-all duration-300 ${isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3'}`}>
          <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center mb-0' : 'mb-2.5 pb-2.5 border-b border-gray-200/60'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white">{(userEmail || '?')[0].toUpperCase()}</span>
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <p className="text-[10px] font-medium text-gray-800 truncate w-28" title={userEmail}>{userEmail || 'Utilisateur'}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className={`flex items-center justify-center gap-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all ${isCollapsed ? 'w-8 h-8 p-0' : 'w-full py-2'}`}
            title="Se déconnecter"
          >
            <LogOut size={15} />
            <span className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 text-xs font-medium'}`}>
              Déconnexion
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
