// src/views/estimaTp/EstimaTpView.jsx
// ESTIMA TP — module « Étude de Prix » (chiffrage entreprise de travaux publics).
// Navigation en volet latéral gauche (façon ESTIMA) ; header compact.
import React, { useState } from 'react';
import { ArrowLeft, HardHat, Check, Loader2, ListTree, Coins, Percent, BarChart3, Package } from 'lucide-react';
import { useTpStudies } from '../../hooks/useTpStudies';
import { useTpStudy } from '../../hooks/useTpStudy';
import TpLandingView from './TpLandingView';
import TpCadreTab from './TpCadreTab';
import TpSousDetailTab from './sousDetail/TpSousDetailTab';
import MargesTab from './MargesTab';
import RecapTab from './RecapTab';
import TpResourcesTab from './ressources/TpResourcesTab';
import HelpButton from '../../components/help/HelpButton';
import HelpPanel from '../../components/help/HelpPanel';

const TABS = [
  { id: 'cadre',      label: 'Cadre',       icon: ListTree },
  { id: 'detail',     label: 'Sous-détail', icon: Coins },
  { id: 'marges',     label: 'Marges',      icon: Percent },
  { id: 'recap',      label: 'Récap',       icon: BarChart3 },
  { id: 'ressources', label: 'Ressources',  icon: Package },
];

export default function EstimaTpView({ companyId, onBackToHub }) {
  const [activeStudyId, setActiveStudyId] = useState(null);
  const [activeTab, setActiveTab] = useState('cadre');
  const [showHelp, setShowHelp] = useState(false);

  const { studies, loading, createStudy, deleteStudy } = useTpStudies(companyId);
  const { study, setStudy, loading: loadingStudy, saving } = useTpStudy(companyId, activeStudyId);

  const isEditing = !!activeStudyId;

  const handleBack = () => {
    if (isEditing) { setActiveStudyId(null); setActiveTab('cadre'); }
    else onBackToHub();
  };

  const renderTab = () => {
    if (loadingStudy) return <div className="flex-1 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-orange-500" /></div>;
    if (!study) return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-semibold text-gray-700">Étude introuvable</p>
        <button onClick={() => setActiveStudyId(null)} className="mt-3 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all">Retour aux études</button>
      </div>
    );
    switch (activeTab) {
      case 'cadre':      return <TpCadreTab study={study} setStudy={setStudy} />;
      case 'detail':     return <TpSousDetailTab study={study} setStudy={setStudy} companyId={companyId} />;
      case 'marges':     return <MargesTab study={study} setStudy={setStudy} />;
      case 'recap':      return <RecapTab study={study} />;
      case 'ressources': return <TpResourcesTab companyId={companyId} />;
      default:           return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden">
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="estimaTp" />

      {/* Header compact (une seule ligne fine) */}
      <header className="flex items-center gap-2.5 px-4 py-1.5 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button onClick={handleBack} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <ArrowLeft size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">{isEditing ? 'Études' : 'Hub'}</span>
        </button>
        <div className="h-5 w-px bg-gray-200/60" />
        <HardHat size={16} className="text-orange-600 shrink-0" />
        <h1 className="font-bold text-sm text-gray-900 tracking-tight shrink-0">ESTIMA TP</h1>
        {isEditing && study && (
          <span className="text-xs text-gray-400 truncate min-w-0">— {study.name || 'Étude sans nom'}{study.reference ? ` · ${study.reference}` : ''}</span>
        )}
        {isEditing && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-gray-400 shrink-0">
            {saving ? <><Loader2 size={12} className="animate-spin text-orange-500" /> Enregistrement…</> : <><Check size={12} className="text-emerald-500" /> Enregistré</>}
          </span>
        )}
        <div className={isEditing ? 'shrink-0' : 'ml-auto shrink-0'}><HelpButton onClick={() => setShowHelp(true)} /></div>
      </header>

      {/* Corps */}
      {!isEditing ? (
        <TpLandingView studies={studies} loading={loading} onOpen={setActiveStudyId} onCreate={createStudy} onDelete={deleteStudy} />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Volet de navigation (gauche, façon ESTIMA) */}
          <nav className="w-40 shrink-0 border-r border-gray-200/60 bg-white flex flex-col py-2 gap-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <Icon size={17} strokeWidth={1.8} /> {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Contenu de l'onglet */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {renderTab()}
          </div>
        </div>
      )}
    </div>
  );
}
