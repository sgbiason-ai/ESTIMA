// src/components/rao/tabs/TabAdministrative.jsx
import React, { useState } from 'react';
import { ChevronDown, FileText, Target, MessageSquare, Users, Plus, Trash2 } from 'lucide-react';
import { Field, Textarea, OuiNonToggle } from '../RaoUI';
import { COMPANY_UI_COLORS, CONCLUSION_OPTIONS } from '../RaoConstants';
import { DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../../../hooks/useRao';

const ROLES = ['Mandataire', 'Cotraitant'];

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
        const isGroupement = !!admin.isGroupement;
        const members = admin.groupementMembers || [];

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
                {isGroupement && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shadow-sm bg-indigo-50 text-indigo-700 border-indigo-200">
                    Groupement ({members.length})
                  </span>
                )}
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

                {/* ── Toggle Groupement ── */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-indigo-500" />
                      <div>
                        <span className="text-sm font-bold text-slate-800">Groupement d'entreprises</span>
                        <p className="text-[11px] text-slate-500">Cocher si le candidat se présente en groupement</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateAdminField(name, 'isGroupement', !isGroupement)}
                      className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${isGroupement ? 'bg-indigo-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${isGroupement ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* ── Membres du groupement ── */}
                  {isGroupement && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Membres du groupement (3 max)</span>
                        {members.length < 3 && (
                          <button
                            onClick={() => updateAdminField(name, 'groupementMembers', [...members, { id: `m${Date.now()}`, name: '', role: 'Cotraitant' }])}
                            className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                          >
                            <Plus size={12} /> Ajouter
                          </button>
                        )}
                      </div>
                      {members.map((m, mi) => (
                        <div key={m.id} className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2">
                          <span className="text-xs font-black text-indigo-500 w-5 text-center">{mi + 1}</span>
                          <input
                            value={m.name}
                            onChange={e => {
                              const updated = [...members];
                              updated[mi] = { ...updated[mi], name: e.target.value };
                              updateAdminField(name, 'groupementMembers', updated);
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            placeholder="Nom du membre"
                          />
                          <select
                            value={m.role}
                            onChange={e => {
                              const updated = [...members];
                              updated[mi] = { ...updated[mi], role: e.target.value };
                              updateAdminField(name, 'groupementMembers', updated);
                            }}
                            className="px-2 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button
                            onClick={() => updateAdminField(name, 'groupementMembers', members.filter((_, j) => j !== mi))}
                            className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Pièces administratives : par membre si groupement, sinon pour l'entreprise ── */}
                {/* ── Pièces administratives par membre (ou entreprise seule) ── */}
                {(() => {
                  const adminEntities = isGroupement && members.length > 0
                    ? members.map(m => ({ key: m.id, label: m.name || 'Sans nom', role: m.role }))
                    : [{ key: '_self', label: name, role: null }];

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Colonne gauche : pièces admin par membre */}
                      <div className="space-y-4">
                        {adminEntities.map(entity => (
                          <div key={entity.key} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2">
                              <FileText size={16} className="text-blue-500" />
                              Pièces administratives
                              {entity.key !== '_self' && (
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg ml-1">
                                  {entity.label} — {entity.role}
                                </span>
                              )}
                            </h4>
                            <div className="space-y-4">
                              {DEFAULT_ADMIN_PIECES.map(p => {
                                const pieceKey = entity.key === '_self' ? p.id : `${entity.key}_${p.id}`;
                                return (
                                  <div key={pieceKey} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
                                    <span className="text-sm font-medium text-slate-700 leading-snug">{p.label}</span>
                                    <OuiNonToggle value={pieces[pieceKey]} onChange={v => updateAdminPiece(name, pieceKey, v)} />
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-6 pt-5 border-t border-slate-100">
                              <Field label="Observations" icon={MessageSquare}>
                                <Textarea value={admin[entity.key === '_self' ? 'obsAdmin' : `obsAdmin_${entity.key}`] || ''} onChange={v => updateAdminField(name, entity.key === '_self' ? 'obsAdmin' : `obsAdmin_${entity.key}`, v)} placeholder="Notes sur le dossier administratif…" rows={2} />
                              </Field>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Colonne droite : offre unique du groupement */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-fit">
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
                            <Textarea value={admin.obsOffre || ''} onChange={v => updateAdminField(name, 'obsOffre', v)} placeholder="Notes sur le contenu de l'offre…" rows={2} />
                          </Field>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Conclusion ── */}
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
