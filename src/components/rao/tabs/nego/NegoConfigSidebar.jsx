// src/components/rao/tabs/nego/NegoConfigSidebar.jsx
//
// Panneau latéral (sticky) des paramètres du courrier : date limite, signataire,
// expéditeur (auto depuis la fiche affaire) et adresse entreprise. Repliable.

import React from 'react';
import { Calendar, User, MapPin, FileOutput, X } from 'lucide-react';

const NegoConfigSidebar = ({ letterConfig, project, collapsed, setCollapsed, updateConfig }) => {
  return (
    <aside className={`shrink-0 transition-all duration-200 ${collapsed ? 'w-12' : 'w-80'}`}>
      <div className="sticky top-2">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="w-12 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-md transition"
            title="Afficher le panneau de configuration"
          >
            <FileOutput size={18} />
          </button>
        ) : (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-white/10 rounded-lg border border-white/10 shrink-0">
                  <FileOutput size={14} className="text-emerald-400" />
                </div>
                <h3 className="text-[12px] font-black tracking-tight text-white truncate">Paramètres courrier</h3>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
                title="Masquer le panneau"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                  <Calendar size={11} /> Date & Heure limite
                </label>
                <input
                  type="datetime-local" value={letterConfig.deadline} onChange={e => updateConfig('deadline', e.target.value)}
                  className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-2.5 py-2 text-[12px] text-white font-semibold focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                  <User size={11} /> Signataire
                </label>
                <input
                  type="text" value={letterConfig.signatoryName} onChange={e => updateConfig('signatoryName', e.target.value)} placeholder="Ex: Fabrice Marcuzzo, Maire"
                  className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-2.5 py-2 text-[12px] text-white font-semibold placeholder:text-slate-500 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                  <MapPin size={11} /> Expéditeur (auto)
                </label>
                <div className="px-2.5 py-2 bg-slate-800/30 border border-white/10 rounded-lg text-[11px] text-slate-300 leading-relaxed">
                  <div className="font-bold text-white truncate">{project?.client || '—'}</div>
                  {project?.clientAddress && <div className="truncate">{project.clientAddress}</div>}
                  {(project?.clientZip || project?.clientCity) && (
                    <div className="truncate">{[project?.clientZip, project?.clientCity].filter(Boolean).join(' ')}</div>
                  )}
                  <div className="mt-1 text-[9px] text-slate-400 italic leading-tight">
                    📝 Modifiable via la fiche affaire.
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                  <MapPin size={11} /> Adresse entreprise
                </label>
                <textarea
                  value={letterConfig.adresseEntreprise} onChange={e => updateConfig('adresseEntreprise', e.target.value)}
                  placeholder={"Auto si vide"}
                  rows={3}
                  className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-2.5 py-2 text-[12px] text-white font-semibold placeholder:text-slate-500 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NegoConfigSidebar;
