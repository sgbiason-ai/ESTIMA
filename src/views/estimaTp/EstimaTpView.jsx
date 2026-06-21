// src/views/estimaTp/EstimaTpView.jsx
// ESTIMA TP — module « Étude de Prix » (chiffrage entreprise de travaux publics).
// Phase 1 : Cadre (bordereau forme ESTIMA). Phase 2 : Sous-détail, Marges, Récap.
// Phase 3 : bibliothèque de ressources réutilisable.
import React, { useState } from 'react';
import { ArrowLeft, HardHat, Check, Loader2, Lock } from 'lucide-react';
import { useTpStudies } from '../../hooks/useTpStudies';
import { useTpStudy } from '../../hooks/useTpStudy';
import TpLandingView from './TpLandingView';
import TpCadreTab from './TpCadreTab';
import TpSousDetailTab from './sousDetail/TpSousDetailTab';
import MargesTab from './MargesTab';
import RecapTab from './RecapTab';
import HelpButton from '../../components/help/HelpButton';
import HelpPanel from '../../components/help/HelpPanel';

// phase ≤ 2 = disponible ; phase 3 = à venir (verrouillé)
const TABS = [
  { id: 'cadre',      label: 'Cadre',       phase: 1 },
  { id: 'detail',     label: 'Sous-détail', phase: 2 },
  { id: 'marges',     label: 'Marges',      phase: 2 },
  { id: 'recap',      label: 'Récap',       phase: 2 },
  { id: 'ressources', label: 'Ressources',  phase: 3 },
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

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden">
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="estimaTp" />

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isEditing ? 'Études' : 'Hub'}
          </span>
        </button>

        <div className="h-6 w-px bg-gray-200/60" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-orange-50 border border-orange-100">
            <HardHat size={20} className="text-orange-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base text-gray-900 tracking-tight truncate">
              ESTIMA TP — Étude de Prix
            </h1>
            {isEditing && study && (
              <p className="text-xs text-gray-400 -mt-0.5 truncate max-w-md">
                {study.name || 'Étude sans nom'}
                {study.reference ? ` — ${study.reference}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Indicateur de sauvegarde */}
        {isEditing && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
            {saving
              ? <><Loader2 size={13} className="animate-spin text-orange-500" /> Enregistrement…</>
              : <><Check size={13} className="text-emerald-500" /> Enregistré</>}
          </span>
        )}

        <div className={isEditing ? '' : 'ml-auto'}>
          <HelpButton onClick={() => setShowHelp(true)} />
        </div>
      </header>

      {/* Barre d'onglets (mode édition) */}
      {isEditing && (
        <div className="flex items-center gap-1 px-6 py-2 bg-white border-b border-gray-200/60 shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const disabled = tab.phase > 2;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && setActiveTab(tab.id)}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-orange-600 text-white shadow-sm'
                    : disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={disabled ? 'Disponible en Phase 3' : undefined}
              >
                {disabled && <Lock size={11} />}
                {tab.label}
                {disabled && (
                  <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400 text-[9px] font-bold uppercase">
                    P{tab.phase}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!isEditing ? (
          <TpLandingView
            studies={studies}
            loading={loading}
            onOpen={setActiveStudyId}
            onCreate={createStudy}
            onDelete={deleteStudy}
          />
        ) : loadingStudy ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : !study ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-semibold text-gray-700">Étude introuvable</p>
            <button
              onClick={() => setActiveStudyId(null)}
              className="mt-3 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all"
            >
              Retour aux études
            </button>
          </div>
        ) : activeTab === 'cadre' ? (
          <TpCadreTab study={study} setStudy={setStudy} />
        ) : activeTab === 'detail' ? (
          <TpSousDetailTab study={study} setStudy={setStudy} />
        ) : activeTab === 'marges' ? (
          <MargesTab study={study} setStudy={setStudy} />
        ) : activeTab === 'recap' ? (
          <RecapTab study={study} />
        ) : null}
      </div>
    </div>
  );
}
