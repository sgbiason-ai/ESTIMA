// src/views/RaoAnalysisView.jsx
import React from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import { useProjectManager } from '../hooks/useProjectManager';
import { useAppResources } from '../hooks/useAppResources';
import PriceAnalysisView from './PriceAnalysisView';

export default function RaoAnalysisView({ user, companyId, onBackToHub }) {
  const db = useDatabase(user, companyId);
  const {
    project, setProject,
  } = useProjectManager(user, companyId);
  const resources = useAppResources(user, companyId);

  // Charger le BPU à la demande
  React.useEffect(() => {
    db.loadBpu();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#040a0e] text-slate-300 overflow-hidden">

      {/* Header avec bouton retour */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-white/5 shrink-0">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Hub</span>
        </button>

        <div className="h-6 w-px bg-white/10" />

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
            <BarChart3 size={20} className="text-blue-400" />
          </div>
          <h1 className="font-black text-lg text-white tracking-tight">RAO & Analyse des Prix</h1>
        </div>
      </header>

      {/* Vue PriceAnalysis existante */}
      <div className="flex-1 overflow-hidden">
        <PriceAnalysisView
          project={project}
          setProject={setProject}
          bpuConfig={{ numberingMode: 'auto' }}
          clientPercent={10}
          masterBranding={resources.masterBranding}
          bpu={db.bpu}
          updateBpuItem={db.updateBpuItem}
        />
      </div>
    </div>
  );
}
