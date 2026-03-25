// src/components/rao/tabs/TabConsultation.jsx
import React from 'react';
import { Info, BarChart2, Plus, Trash2, Layers, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Field, Input } from '../RaoUI';
import { FORMULA_LABELS_CONSULT } from '../RaoConstants';

const TabConsultation = ({ 
  consultation, updateConsultation, criteria, updateCriteria, 
  addCriterion, removeCriterion, scoringConfig, hasTranches, 
  tranches, raoTrancheId, setRaoTrancheId,
  optionChapters = [], includedOptions = {}, updateIncludedOption,
  offersLocked = false,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-7xl mx-auto pb-24">
      <div className="col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Info size={20} />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-[0.1em] text-slate-800">
              Informations de la consultation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Ces éléments apparaitront sur la page de garde et l'en-tête du rapport.</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-8">
          {/* Section 1 : Identification du Projet */}
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Identification du projet
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-9">
                <Field label="Objet des travaux / Titre principal">
                  <Input value={consultation.objet} onChange={v => updateConsultation('objet', v)} placeholder="Ex. Aménagement du Boulevard..." />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Code Affaire / Réf.">
                  <Input value={consultation.code} onChange={v => updateConsultation('code', v)} placeholder="Ex. 26-0001" />
                </Field>
              </div>
              <div className="md:col-span-6">
                <Field label="Sous-titre 1 (Optionnel)">
                  <Input value={consultation.subtitle1} onChange={v => updateConsultation('subtitle1', v)} placeholder="Ex. Voirie et Réseaux Divers" />
                </Field>
              </div>
              <div className="md:col-span-6">
                <Field label="Sous-titre 2 (Optionnel)">
                  <Input value={consultation.subtitle2} onChange={v => updateConsultation('subtitle2', v)} placeholder="Ex. Tranche 1" />
                </Field>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100"></div>

          {/* Section 2 : Acteurs & Marché */}
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Acteurs & Caractéristiques du marché
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4">
                <Field label="Client / Maître d'Ouvrage">
                  <Input value={consultation.client} onChange={v => updateConsultation('client', v)} placeholder="Nom du client" />
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field label="Maître d'Œuvre (MOE)">
                  <Input value={consultation.moe} onChange={v => updateConsultation('moe', v)} placeholder="Ex. PAPYRUS" />
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field label="Lieu d'exécution">
                  <Input value={consultation.lieu} onChange={v => updateConsultation('lieu', v)} placeholder="Ex. Aussillon (81)" />
                </Field>
              </div>
              
              <div className="md:col-span-3">
                <Field label="Type de Marché">
                  <Input value={consultation.marketType} onChange={v => updateConsultation('marketType', v)} placeholder="Ex. Privé ou Public" />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Procédure">
                  <Input value={consultation.procedure} onChange={v => updateConsultation('procedure', v)} placeholder="Ex. Procédure adaptée ouverte" />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Phase">
                  <Input value={consultation.phase} onChange={v => updateConsultation('phase', v)} placeholder="Ex. DCE" />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Lot">
                  <Input value={consultation.lot} onChange={v => updateConsultation('lot', v)} placeholder="Ex. Lot 1 — Voirie et génie civil" />
                </Field>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100"></div>

          {/* Section 3 : Calendrier & Délais */}
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Calendrier & Délais
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-10 gap-5">
              <div className="md:col-span-2">
                <Field label="Date remise des offres">
                  <Input type="date" value={consultation.dateRemise} onChange={v => updateConsultation('dateRemise', v)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Heure limite">
                  <Input type="time" value={consultation.timeRemise} onChange={v => updateConsultation('timeRemise', v)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Date limite après négo.">
                  <Input value={consultation.dateNego} onChange={v => updateConsultation('dateNego', v)} placeholder="Ex. 3 oct. à 17H00" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Délai préparation">
                  <Input value={consultation.prepPeriod} onChange={v => updateConsultation('prepPeriod', v)} placeholder="Ex. 1 mois" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Durée des travaux">
                  <Input value={consultation.duration} onChange={v => updateConsultation('duration', v)} placeholder="Ex. 4 mois" />
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BarChart2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-[0.1em] text-slate-800">
                Critères de notation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Configuration des critères d'évaluation des candidatures.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-4 py-2 rounded-xl shadow-inner ${
              criteria.reduce((s, c) => s + (c.auto ? (scoringConfig?.maxScore ?? c.weight) : (Number(c.weight) || 0)), 0) === 100
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              Total pondération : {criteria.reduce((s, c) => s + (c.auto ? (scoringConfig?.maxScore ?? c.weight) : (Number(c.weight) || 0)), 0)}%
            </span>
            <button onClick={addCriterion} className="flex items-center gap-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 shadow-md px-5 py-2.5 rounded-xl transition-all duration-200 active:scale-95">
              <Plus size={16} /> Ajouter un critère
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {criteria.map((crit, i) => (
            <div key={crit.id} className="group flex flex-col md:flex-row gap-5 p-5 bg-slate-50/50 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-300 relative overflow-hidden">
              {crit.auto && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />}
              
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-700 text-sm font-black shrink-0 mt-1">
                {i + 1}
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8 flex flex-col gap-3">
                  <input
                    value={crit.label}
                    onChange={e => {
                      const newC = [...criteria];
                      newC[i] = { ...newC[i], label: e.target.value };
                      updateCriteria(newC);
                    }}
                    className="w-full px-4 py-2.5 text-sm font-bold text-slate-800 bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all"
                    placeholder="Intitulé du critère (ex: Prix des prestations)"
                  />
                  <textarea
                    value={crit.description || ''}
                    onChange={e => {
                      const newC = [...criteria];
                      newC[i] = { ...newC[i], description: e.target.value };
                      updateCriteria(newC);
                    }}
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none text-slate-600 transition-all"
                    placeholder="Description ou méthode de calcul de la note…"
                  />
                  {crit.auto && scoringConfig && (
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Formule</span>
                          <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-lg shadow-sm">
                            {FORMULA_LABELS_CONSULT[scoringConfig.mode] || scoringConfig.mode?.toUpperCase()}
                          </span>
                        </div>
                        <div className="hidden md:block w-px h-5 bg-emerald-200" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Barème analyse</span>
                          <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-lg shadow-sm">{scoringConfig.maxScore} pts</span>
                        </div>
                        <div className="hidden md:block w-px h-5 bg-emerald-200" />
                        <span className="text-[10px] text-emerald-600 italic font-medium">Repris depuis l'analyse financière</span>
                      </div>
                      {hasTranches && tranches && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 shrink-0">📐 Tranche pour le prix</span>
                          <div className="w-px h-5 bg-amber-200" />
                          <select
                            value={raoTrancheId}
                            onChange={e => setRaoTrancheId(e.target.value)}
                            className="flex-1 text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 outline-none focus:border-amber-400 cursor-pointer shadow-sm"
                          >
                            <option value="global">🌐 Global (toutes tranches)</option>
                            {tranches.map(t => (
                              <option key={t.id} value={t.id}>{t.name || `Tranche ${t.id}`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {/* ── PSE / Variantes — Paramètre de consultation (CCP art. R2152-7) ── */}
                      {optionChapters.length > 0 && (
                        <div className="flex flex-col gap-2 mt-1">
                          <div className={`flex flex-col gap-1.5 px-4 py-3 rounded-xl border ${offersLocked ? 'bg-slate-50 border-slate-200' : 'bg-violet-50 border-violet-200'}`}>

                            {/* En-tête */}
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <Layers size={13} className={offersLocked ? 'text-slate-400 shrink-0' : 'text-violet-600 shrink-0'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${offersLocked ? 'text-slate-500' : 'text-violet-700'}`}>
                                  PSE / Variantes — Base de notation
                                </span>
                              </div>
                              {offersLocked && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 border border-amber-300 rounded-lg">
                                  <Lock size={11} className="text-amber-700 shrink-0" />
                                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-700">Verrouillé</span>
                                </div>
                              )}
                            </div>

                            {/* Référence légale */}
                            <div className={`flex items-start gap-2 px-3 py-2 rounded-lg mb-1 ${offersLocked ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-violet-100'}`}>
                              {offersLocked
                                ? <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                : <ShieldCheck size={13} className="text-violet-500 shrink-0 mt-0.5" />
                              }
                              <p className={`text-[10px] leading-snug ${offersLocked ? 'text-amber-700' : 'text-violet-600'}`}>
                                {offersLocked
                                  ? <><strong>Paramètre verrouillé</strong> — Des offres ont déjà été importées. Toute modification de la base de notation après ouverture des plis contreviendrait au principe d'égalité de traitement des candidats <em>(CCP art. L3 et R2152-7 ; CE 11 mars 2013, n°363460)</em>.</>
                                  : <><strong>À définir avant la remise des offres.</strong> Ces paramètres doivent figurer dans le RC ou le CCAP. Toute modification après réception des plis est prohibée <em>(CCP art. R2152-7 ; CJUE 24 nov. 2005, ATI EAC)</em>.</>
                                }
                              </p>
                            </div>

                            {/* Toggles par PSE */}
                            <div className="flex flex-col gap-1.5">
                              {optionChapters.map(chap => {
                                const isOn = !!includedOptions[chap.id];
                                return (
                                  <div key={chap.id} className={`flex items-center justify-between gap-3 px-3 py-2 bg-white border rounded-lg shadow-sm ${offersLocked ? 'border-slate-200 opacity-75' : 'border-violet-100'}`}>
                                    <span className="text-xs font-semibold text-slate-700 leading-snug flex-1">{chap.title}</span>
                                    {offersLocked
                                      ? <div className="flex items-center gap-2">
                                          <Lock size={12} className="text-slate-400" />
                                          <span className={`text-[10px] font-black ${isOn ? 'text-violet-600' : 'text-slate-400'}`}>
                                            {isOn ? 'Incluse dans le classement' : 'Exclue du classement'}
                                          </span>
                                        </div>
                                      : <>
                                          <button
                                            onClick={() => updateIncludedOption?.(chap.id, !isOn)}
                                            className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${isOn ? 'bg-violet-500' : 'bg-slate-200'}`}
                                            title={isOn ? 'Exclure cette PSE du classement' : 'Inclure cette PSE dans le classement'}
                                          >
                                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                          </button>
                                          <span className={`text-[10px] font-black w-20 text-right ${isOn ? 'text-violet-600' : 'text-slate-400'}`}>
                                            {isOn ? 'Dans le score' : 'Hors score'}
                                          </span>
                                        </>
                                    }
                                  </div>
                                );
                              })}
                            </div>

                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
                
                <div className="md:col-span-4 flex flex-col items-end gap-3 md:border-l md:border-slate-200 md:pl-6">
                  <div className="w-full flex items-center justify-between gap-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pondération</label>
                    <div className="relative">
                      {crit.auto ? (
                        <>
                          <div className="w-24 px-4 py-2.5 text-base bg-emerald-50 border border-emerald-200 rounded-xl text-center font-black text-emerald-700 pr-6 select-none shadow-sm">
                            {scoringConfig?.maxScore ?? crit.weight}
                          </div>
                          <span className="absolute right-3 top-3 text-emerald-500 text-sm font-bold">%</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="number" min={0} max={100}
                            value={crit.weight}
                            onChange={e => {
                              const newC = [...criteria];
                              newC[i] = { ...newC[i], weight: Number(e.target.value) };
                              updateCriteria(newC);
                            }}
                            className="w-24 px-4 py-2.5 text-base bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-black pr-6 transition-all"
                          />
                          <span className="absolute right-3 top-3 text-slate-400 text-sm font-bold">%</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full flex items-center justify-between mt-auto">
                    {crit.auto ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Critère Prix
                      </span>
                    ) : (
                      <span />
                    )}
                    {criteria.length > 1 && !crit.auto && (
                      <button onClick={() => removeCriterion(crit.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TabConsultation;