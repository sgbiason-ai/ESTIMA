// src/views/devisMoe/HonorairesConfigPanel.jsx
// Panneau config (droite) de l'onglet Honoraires — extrait de DevisMoeHonorairesTab.jsx

import React from 'react';
import { Percent, Clock, Calculator, PanelRightClose } from 'lucide-react';
import { COTRAITANT_COLORS, MANDATAIRE_COLOR, getCategoriesForAssignee } from '../../hooks/useDevisMoe';
import { fmt, fmtE } from './devisMoeHelpers';

const H_PAR_JOUR = 7;

export default function HonorairesConfigPanel({
  draft, onChange, configOpen, setConfigOpen,
  uniteTemps, setUniteTemps, cats, isGrp, activePhases,
}) {
  if (!configOpen) return null;

  const isPct = draft.methode === 'pourcentage';

  return (
    <div className={`w-64 shrink-0 border-l border-slate-200 bg-white flex flex-col ${isPct ? '' : 'overflow-y-auto'}`}>
      {/* ── Header + Paramètres (sticky en mode %) ── */}
      <div className={isPct ? 'sticky top-0 z-10 bg-white' : ''}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center gap-1.5">
            <Calculator size={14} className="text-emerald-600" />
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Paramètres</span>
          </div>
          <button onClick={() => setConfigOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-default">
            <PanelRightClose size={16} />
          </button>
        </div>
        <div className="p-3 space-y-3">
          {/* Méthode toggle */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Méthode</span>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              {[
                { v: 'pourcentage', Icon: Percent, label: '%' },
                { v: 'temps_passe', Icon: Clock,   label: 'Temps' },
              ].map(({ v, Icon, label }) => (
                <button key={v} onClick={() => onChange({ ...draft, methode: v })}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all duration-150 cursor-default ${
                    draft.methode === v
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Paramètres spécifiques au mode */}
          {isPct ? (
            <>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Taux honoraires</span>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" max="100" step="0.1"
                    className="flex-1 px-2 py-1.5 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                    value={draft.tauxHonorairesGlobal || ''}
                    onChange={e => onChange({ ...draft, tauxHonorairesGlobal: e.target.value })}
                    placeholder="5" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Taux horaires</span>
                  <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 border border-slate-200">
                    {['h', 'j'].map(u => (
                      <button key={u} onClick={() => setUniteTemps(u)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-default ${
                          uniteTemps === u ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
                        }`}>{u}</button>
                    ))}
                  </div>
                </div>
                {/* Catégories par membre en mode groupement, sinon global */}
                {(() => {
                  const members = isGrp && ((draft.cotraitants || []).length > 0 || draft.moeType === 'cotraitant')
                    ? [{ key: 'mandataire', name: draft.mandataire?.nom || 'Mandataire', color: MANDATAIRE_COLOR },
                       ...(draft.moeType === 'cotraitant'
                         ? [{ key: 'notreEntreprise', name: draft.notreEntreprise?.nom || 'Notre entreprise', color: COTRAITANT_COLORS[0] }]
                         : (draft.cotraitants || []).map((cot, ci) => ({ key: cot.id, name: cot.nom || `Co-traitant ${ci + 1}`, color: COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0] })))]
                    : null;

                  const renderCatInputs = (memberCats, updateFn) =>
                    memberCats.map((cat, i) => {
                      const tauxH = parseFloat(cat.tauxHoraire) || 0;
                      const displayVal = uniteTemps === 'j' ? parseFloat((tauxH * H_PAR_JOUR).toFixed(2)) || '' : (tauxH ? parseFloat(tauxH.toFixed(2)) : '');
                      return (
                        <div key={cat.id} className="flex items-center gap-1.5">
                          <input type="text"
                            className="w-16 px-1.5 py-1 text-[10px] font-bold text-slate-600 rounded border border-slate-200 bg-white focus:border-indigo-400 focus:outline-none transition-all truncate"
                            value={cat.label}
                            onChange={e => updateFn(i, 'label', e.target.value)} />
                          <input type="number" min="0"
                            className="w-14 px-1.5 py-1 text-center text-xs rounded border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                            value={displayVal}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              updateFn(i, 'tauxHoraire', isNaN(v) ? '' : String(uniteTemps === 'j' ? v / H_PAR_JOUR : v));
                            }} />
                          <span className="text-[8px] text-slate-400">€/{uniteTemps}</span>
                        </div>
                      );
                    });

                  if (!members) {
                    return renderCatInputs(cats, (i, field, val) => {
                      const c = [...cats]; c[i] = { ...c[i], [field]: val }; onChange({ ...draft, categories: c });
                    });
                  }

                  return members.map(member => {
                    const memberCats = getCategoriesForAssignee(draft, member.key);
                    const updateMemberCat = (i, field, val) => {
                      const newCats = [...memberCats]; newCats[i] = { ...newCats[i], [field]: val };
                      onChange({ ...draft, categoriesParMembre: { ...(draft.categoriesParMembre || {}), [member.key]: newCats } });
                    };
                    return (
                      <div key={member.key} className="space-y-1.5">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${member.color.bg} border ${member.color.border}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${member.color.dot}`} />
                          <span className={`text-[9px] font-bold ${member.color.text}`}>{member.name}</span>
                        </div>
                        {renderCatInputs(memberCats, updateMemberCat)}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Montant travaux</span>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0"
                    className="flex-1 px-2 py-1.5 text-right text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                    value={draft.montantTravauxGlobal || ''}
                    onChange={e => onChange({ ...draft, montantTravauxGlobal: e.target.value })}
                    placeholder="500 000" />
                  <span className="text-[9px] text-slate-400">€ HT</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Marge</span>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" max="100" step="0.5"
                    className="flex-1 px-2 py-1.5 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                    value={draft.marge || ''}
                    onChange={e => onChange({ ...draft, marge: e.target.value })}
                    placeholder="0" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
              </div>
              {/* Résumé mode temps */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Phases actives</span>
                  <span className="font-bold text-slate-600">{activePhases.length}</span>
                </div>
              </div>
            </>
          )}
        </div>
        {isPct && <div className="border-b border-slate-200" />}
      </div>

      {/* ── Calcul % par phase (indépendant du temps passé) ── */}
      {isPct && (() => {
        const mtGlobal = parseFloat(draft.montantTravauxGlobal) || 0;
        const tauxGlobal = parseFloat(draft.tauxHonorairesGlobal) || 0;
        const totalHonPct = mtGlobal * tauxGlobal / 100;
        const repartition = draft.repartitionPhasePct || {};
        const repTotal = activePhases.reduce((s, p) => s + (parseFloat(repartition[p.id]) || 0), 0);
        const repOk = Math.abs(repTotal - 100) < 0.01;

        const updateRep = (phaseId, val) => {
          onChange({ ...draft, repartitionPhasePct: { ...repartition, [phaseId]: val } });
        };

        return (
          <div className="px-3 pb-3 overflow-y-auto flex-1">
            {/* Montant travaux (lecture seule, défini dans l'onglet Informations) */}
            {mtGlobal > 0 && (
              <div className="flex items-center justify-between px-2.5 py-2 my-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Travaux HT</span>
                <span className="text-[11px] font-bold text-slate-700">{fmtE(mtGlobal)}</span>
              </div>
            )}

            {/* Résumé honoraires */}
            {totalHonPct > 0 && (
              <div className="flex items-center justify-between px-2.5 py-2 mb-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[9px] font-bold text-emerald-600 uppercase">Honoraires HT</span>
                <span className="text-sm font-black text-emerald-700">{fmtE(totalHonPct)}</span>
              </div>
            )}

            {/* Répartition par phase */}
            <div className="py-1 mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Répartition par phase</span>
            </div>

            <div className="space-y-1">
              {activePhases.map(phase => {
                const phasePctVal = parseFloat(repartition[phase.id]) || 0;
                const phaseHon = totalHonPct * phasePctVal / 100;

                return (
                  <div key={phase.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-to-r from-indigo-50/40 to-white border border-slate-200/60">
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">{phase.code}</span>
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      <input type="number" min="0" max="100" step="0.5"
                        className="w-12 px-1 py-0.5 text-center text-[11px] font-bold rounded border border-slate-200 bg-white text-slate-700 focus:border-indigo-400 focus:outline-none transition-all tabular-nums"
                        value={repartition[phase.id] || ''}
                        onChange={e => updateRep(phase.id, e.target.value)}
                        placeholder="0" />
                      <span className="text-[9px] text-slate-400">%</span>
                      <div className="text-right min-w-[50px]">
                        <span className="text-[10px] font-bold text-slate-600 tabular-nums">{phaseHon > 0 ? fmtE(phaseHon) : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className={`flex items-center justify-between px-2.5 py-2 rounded-xl border mt-2 ${repOk && repTotal > 0 ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-emerald-200' : repTotal > 100 ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-indigo-100 to-indigo-50 border-indigo-200'}`}>
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Total</span>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black tabular-nums ${repOk && repTotal > 0 ? 'text-emerald-600' : repTotal > 100 ? 'text-red-600' : 'text-amber-500'}`}>
                  {fmt(repTotal)} %
                </span>
                {totalHonPct > 0 && (
                  <span className="text-[10px] font-bold text-slate-700">{fmtE(totalHonPct)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
