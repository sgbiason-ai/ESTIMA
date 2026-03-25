// src/components/rao/tabs/TabAdministrative.jsx
import React, { useState } from 'react';
import { ChevronDown, FileText, Target, MessageSquare } from 'lucide-react';
import { Field, Textarea, OuiNonToggle } from '../RaoUI';
import { COMPANY_UI_COLORS, CONCLUSION_OPTIONS } from '../RaoConstants';
// Assure-toi que ce chemin correspond bien à l'emplacement de ton hook
import { DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../../../hooks/useRao';

const TabAdministrative = ({ companyNames, companiesData, updateAdminPiece, updateAdminField }) => {
  const [openCompany, setOpenCompany] = useState(companyNames[0] || null);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {companyNames.map((name, ci) => {
        const uiColor = COMPANY_UI_COLORS[ci % COMPANY_UI_COLORS.length];
        const admin = companiesData[name]?.admin || {};
        const pieces = admin.pieces || {};
        const concl = admin.conclusion || 'reguliere';
        const conclOpt = CONCLUSION_OPTIONS.find(o => o.value === concl) || CONCLUSION_OPTIONS[0];
        const isOpen = openCompany === name;

        return (
          <div key={name} className={`bg-white rounded-[24px] border ${isOpen ? 'border-slate-300 shadow-lg scale-[1.002]' : 'border-slate-200 shadow-sm hover:shadow-md'} overflow-hidden transition-all duration-300`}>
            <button
              onClick={() => setOpenCompany(isOpen ? null : name)}
              className={`w-full flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50 border-l-[6px] ${uiColor.border}`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-10 h-10 rounded-xl ${uiColor.bg} ${uiColor.text} flex items-center justify-center font-black text-lg shadow-inner`}>
                  {name.substring(0, 1).toUpperCase()}
                </div>
                <span className="font-extrabold text-slate-800 text-xl tracking-tight">{name}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shadow-sm ml-2 ${
                  concl === 'reguliere' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : concl === 'inappropriee' ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {conclOpt.label}
                </span>
              </div>
              <div className={`p-2 rounded-full transition-transform duration-300 ${isOpen ? 'rotate-180 bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                <ChevronDown size={20} />
              </div>
            </button>

            {isOpen && (
              <div className="px-6 pb-6 pt-4 bg-slate-50/50 border-t border-slate-100 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" /> Pièces administratives
                    </h4>
                    <div className="space-y-4">
                      {DEFAULT_ADMIN_PIECES.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
                          <span className="text-sm font-medium text-slate-700 leading-snug">{p.label}</span>
                          <OuiNonToggle value={pieces[p.id]} onChange={v => updateAdminPiece(name, p.id, v)} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <Field label="Observations éventuelles" icon={MessageSquare}>
                        <Textarea value={admin.obsAdmin} onChange={v => updateAdminField(name, 'obsAdmin', v)} placeholder="Notes sur le dossier administratif…" rows={2} />
                      </Field>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2">
                      <Target size={16} className="text-emerald-500" /> Offre de l'entreprise
                    </h4>
                    <div className="space-y-4">
                      {DEFAULT_OFFER_PIECES.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
                          <span className="text-sm font-medium text-slate-700 leading-snug">{p.label}</span>
                          <OuiNonToggle value={pieces[p.id]} onChange={v => updateAdminPiece(name, p.id, v)} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <Field label="Observations éventuelles" icon={MessageSquare}>
                        <Textarea value={admin.obsOffre} onChange={v => updateAdminField(name, 'obsOffre', v)} placeholder="Notes sur le contenu de l'offre…" rows={2} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-1">Conclusion de l'analyse</h4>
                    <p className="text-xs text-slate-500">Statut officiel de la candidature pour la suite de l'analyse.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                    {CONCLUSION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateAdminField(name, 'conclusion', opt.value)}
                        className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all duration-300 ${
                          concl === opt.value
                            ? opt.color === 'emerald' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : opt.color === 'orange'  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                            :                           'bg-red-500 text-white shadow-md shadow-red-500/30'
                            : 'bg-transparent text-slate-500 hover:bg-white hover:shadow-sm'
                        }`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabAdministrative;