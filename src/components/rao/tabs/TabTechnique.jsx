// src/components/rao/tabs/TabTechnique.jsx
import React, { useState } from 'react';
import { Brain, ChevronDown, Target, CheckCircle2, XCircle, MessageSquare, AlertCircle } from 'lucide-react';
import { ScoreBadge } from '../RaoUI';
import { COMPANY_UI_COLORS, FORMULA_LABELS_CONSULT } from '../RaoConstants';

const TabTechnique = ({ 
  companyNames, companiesData, criteria, updateTechnical, 
  analysisStats, scoringConfig, analysisCompanies = [] 
}) => {
  const [openCompany, setOpenCompany] = useState(companyNames[0] || null);
  
  const nonAuto = criteria.filter(c => !c.auto);
  const autoCrit = criteria.find(c => c.auto);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-32">
      {companyNames.map((name, ci) => {
        const uiColor = COMPANY_UI_COLORS[ci % COMPANY_UI_COLORS.length];
        const tech = companiesData[name]?.technical || {};
        const isOpen = openCompany === name;

        const totalTechScore = nonAuto.reduce((sum, crit) => {
          const d = tech[crit.id] || {};
          const note = Number(d.note || 0);
          const noteMax = Number(d.noteMax || 5);
          return sum + (noteMax > 0 ? (note / noteMax) * crit.weight : 0);
        }, 0);

        const companyObj = analysisCompanies.find(c => c.name === name);
        const rawPriceScore = companyObj ? (analysisStats?.companyScores?.[companyObj.id] ?? null) : null;
        const maxScoreAnalysis = scoringConfig?.maxScore || 40;
        const priceWeight = maxScoreAnalysis;
        const priceScoreRao = rawPriceScore !== null ? (rawPriceScore / maxScoreAnalysis) * priceWeight : null;
        const priceHT = companyObj ? (analysisStats?.companiesTotals?.[companyObj.id] || 0) : 0;

        return (
          <div 
            key={name} 
            className={`group bg-white rounded-[28px] transition-all duration-500 overflow-hidden ${
              isOpen 
                ? 'ring-1 ring-slate-900 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] scale-[1.005]' 
                : 'border border-slate-200 hover:border-slate-400 shadow-sm'
            }`}
          >
            <button
              onClick={() => setOpenCompany(isOpen ? null : name)}
              className={`w-full flex items-center justify-between px-8 py-7 transition-colors ${isOpen ? 'bg-slate-50/50' : 'bg-white'}`}
            >
              <div className="flex items-center gap-7">
                <div className={`w-16 h-16 rounded-[20px] ${uiColor.bg} ${uiColor.text} flex items-center justify-center font-black text-2xl shadow-inner transition-all group-hover:rotate-3`}>
                  {name.substring(0, 2).toUpperCase()}
                </div>
                <div className="text-left">
                  <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2">{name}</h3>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                      <Brain size={12} className="text-emerald-500" /> {nonAuto.length} Critères techniques
                    </span>
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                      {totalTechScore.toFixed(2)} pts
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-10">
                <div className="hidden xl:flex items-center gap-1.5">
                  {nonAuto.map((c, i) => (
                    <div 
                      key={i} 
                      title={c.label}
                      className={`h-2 rounded-full transition-all duration-500 ${tech[c.id]?.note > 0 ? 'bg-emerald-500 w-6' : 'bg-slate-200 w-2'}`} 
                    />
                  ))}
                </div>
                <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-sm ${isOpen ? 'bg-slate-900 text-white rotate-180' : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-slate-50'}`}>
                  <ChevronDown size={22} />
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="px-8 pb-12 pt-4 animate-in fade-in slide-in-from-top-4 duration-700 bg-slate-50/30">
                <div className="space-y-10">
                  {autoCrit && (
                    <div className="bg-emerald-50 border border-emerald-200 shadow-sm rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-2 bottom-0 bg-emerald-500" />
                      <div className="pl-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-emerald-200 text-emerald-800 tracking-wider">CRITÈRE 1 — AUTO</span>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Poids : {maxScoreAnalysis}%</span>
                          </div>
                          <p className="text-lg font-black text-slate-800 leading-snug mb-1">{autoCrit.label}</p>
                          <p className="text-sm text-slate-500">
                            Calculé d'après l'analyse financière 
                            {scoringConfig && (
                              <> — Formule <strong className="text-emerald-700">{FORMULA_LABELS_CONSULT[scoringConfig.mode] || scoringConfig.mode?.toUpperCase()}</strong></>
                            )}
                          </p>
                        </div>
                        
                        <div className="flex items-stretch gap-3 shrink-0">
                          {rawPriceScore !== null ? (
                            <>
                              <div className="flex flex-col items-center bg-white border border-emerald-200 rounded-xl px-5 py-3 shadow-inner">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Montant HT</span>
                                <span className="text-sm font-bold text-slate-600 font-mono">
                                  {priceHT > 0 ? priceHT.toLocaleString('fr-FR', {minimumFractionDigits:2}) + ' €' : '—'}
                                </span>
                              </div>
                              <div className="flex flex-col items-center justify-center bg-emerald-600 rounded-xl px-6 py-3 shadow-md">
                                <span className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mb-0.5">Points RAO</span>
                                <span className="text-2xl font-black text-white">{priceScoreRao.toFixed(2)}<span className="text-sm text-emerald-200 font-normal"> /{maxScoreAnalysis}</span></span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-700 shadow-sm">
                              <AlertCircle size={18} />
                              Saisir les offres financières
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {nonAuto.map((crit, idx) => {
                    const d = tech[crit.id] || {};
                    const note = Number(d.note || 0);
                    const noteMax = Number(d.noteMax || 5);

                    return (
                      <div key={crit.id} className="group/item relative">
                        <div className="flex flex-col bg-white border border-slate-200 rounded-[24px] overflow-hidden transition-all hover:border-slate-300 hover:shadow-lg">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-5 bg-slate-50/80 border-b border-slate-100">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800 text-white text-xs font-black shadow-inner">
                                {idx + 2}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-lg tracking-tight">{crit.label}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Pondération globale : {crit.weight}%</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex flex-col items-center px-4 border-r border-slate-100">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Barème local</span>
                                <input
                                  type="number" step={0.5} min={1} max={100}
                                  value={noteMax}
                                  onChange={e => updateTechnical(name, crit.id, 'noteMax', Number(e.target.value))}
                                  className="w-16 bg-slate-50 border border-slate-200 rounded-lg py-1 text-center font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                              </div>
                              <div className="flex flex-col items-center px-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Note attribuée</span>
                                <input
                                  type="number" step={0.5} min={0} max={noteMax}
                                  value={note}
                                  onChange={e => updateTechnical(name, crit.id, 'note', Number(e.target.value))}
                                  className="w-20 bg-emerald-50 border border-emerald-200 rounded-lg py-1 text-center font-black text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-inner"
                                />
                              </div>
                              <div className="pl-2">
                                <ScoreBadge note={note} max={noteMax} weight={crit.weight} />
                              </div>
                            </div>
                          </div>

                          <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                                    <CheckCircle2 size={14} />
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-emerald-700">Points Forts / Conformité</span>
                                </div>
                                <textarea
                                  value={d.pros || ''}
                                  onChange={e => updateTechnical(name, crit.id, 'pros', e.target.value)}
                                  placeholder="Listez les avantages techniques..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm min-h-[140px] focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-300 outline-none transition-all resize-none leading-relaxed text-slate-700 shadow-inner"
                                />
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                  <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
                                    <XCircle size={14} />
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-red-700">Points Faibles / Réserves</span>
                                </div>
                                <textarea
                                  value={d.cons || ''}
                                  onChange={e => updateTechnical(name, crit.id, 'cons', e.target.value)}
                                  placeholder="Listez les manques ou risques..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm min-h-[140px] focus:bg-white focus:ring-4 focus:ring-red-500/10 focus:border-red-300 outline-none transition-all resize-none leading-relaxed text-slate-700 shadow-inner"
                                />
                              </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-4 px-1">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-widest">
                                  <MessageSquare size={16} className="text-blue-500" /> Synthèse globale pour le rapport
                                </label>
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold tracking-widest uppercase">Visible dans le PDF</span>
                              </div>
                              <textarea
                                value={d.text || ''}
                                onChange={e => updateTechnical(name, crit.id, 'text', e.target.value)}
                                placeholder="Rédigez ici la conclusion de votre analyse technique pour ce critère..."
                                className="w-full bg-white border-2 border-slate-100 rounded-2xl p-6 text-sm font-medium text-slate-700 leading-relaxed shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all min-h-[120px]"
                                rows={4}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabTechnique;