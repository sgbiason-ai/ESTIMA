import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const DeleteCompanyModal = ({ company, membersCount, onConfirm, onCancel }) => {
  const [typed, setTyped] = useState('');
  const isValid = typed === company.name;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f1e2a] border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg">Supprimer l'entreprise</h2>
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Action irréversible</p>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5 text-xs text-red-300 space-y-1.5">
          <p>🗑️ <strong>Tous les articles BPU</strong> seront supprimés</p>
          <p>🗑️ <strong>Tous les projets</strong> seront supprimés</p>
          <p>🗑️ <strong>Toutes les ressources</strong> (CCTP, RC, Branding) seront supprimées</p>
          {membersCount > 0 && <p>👤 <strong>{membersCount} utilisateur(s)</strong> seront désassignés</p>}
        </div>
        <p className="text-slate-400 text-xs mb-2">Pour confirmer, tape exactement le nom de l'entreprise :</p>
        <p className="text-white font-bold text-sm mb-3 bg-black/30 px-3 py-2 rounded-lg font-mono">{company.name}</p>
        <input
          autoFocus value={typed} onChange={e => setTyped(e.target.value)}
          placeholder="Tape le nom ici..."
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={!isValid}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition-colors">
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteCompanyModal;
