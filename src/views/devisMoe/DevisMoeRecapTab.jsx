// src/views/devisMoe/DevisMoeRecapTab.jsx
// Onglet Récapitulatif — synthèse honoraires, phases, lots, groupement
import React, { useMemo } from 'react';
import { Calculator, Receipt, Percent } from 'lucide-react';
import { PHASES_LOI_MOP, COTRAITANT_COLORS, MANDATAIRE_COLOR, getCategoriesForAssignee, buildCategoriesMap } from '../../hooks/useDevisMoe';
import {
  calcHonByAssignee, getAssigneeName, isNestedTemps, getAssigneeKeys,
  tacheTotalBudget, grandTotalByAssignee
} from '../../utils/devisMoeCalculations';
import { pct, honPhasePct, honPhaseTemps, fmt, fmtE } from './devisMoeHelpers';

const getColor = (aKey, draft) => {
  if (aKey === 'mandataire') return MANDATAIRE_COLOR;
  if (aKey === 'notreEntreprise') return COTRAITANT_COLORS[0];
  const ci = (draft.cotraitants || []).findIndex(c => c.id === aKey);
  return COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0];
};

export default function DevisMoeRecapTab({ draft }) {
  const cats = draft.categories || [];
  const lots = draft.lots || [];
  const isPct = draft.methode === 'pourcentage';
  const activePhases = (draft.phases || PHASES_LOI_MOP).filter(p => p.actif);
  const moeType = draft.moeType || 'seul';
  const isGrp = moeType !== 'seul' && (moeType === 'mandataire' ? (draft.cotraitants || []).length > 0 : true);

  const taches = draft.taches || [];
  const recapAssigneeKeys = (moeType === 'mandataire' && (draft.cotraitants || []).length > 0) || moeType === 'cotraitant' ? getAssigneeKeys(draft) : null;
  const recapCatsMap = (moeType === 'mandataire' || moeType === 'cotraitant') ? buildCategoriesMap(draft) : null;

  const phasesSummary = useMemo(() => {
    if (!isPct && taches.length > 0) {
      // Mode temps passé : calculer depuis les tâches
      return activePhases.map(phase => {
        const phaseTaches = taches.filter(t => t.phaseId === phase.id);
        const total = recapAssigneeKeys
          ? phaseTaches.reduce((s, t) => s + tacheTotalBudget(t, recapCatsMap || cats, recapAssigneeKeys), 0)
          : phaseTaches.reduce((s, t) => s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
        return { ...phase, total };
      });
    }
    return activePhases.map(phase => ({
      ...phase,
      total: lots.reduce((s, lot) => s + (isPct
        ? honPhasePct(pct(lot, draft.tauxHonorairesGlobal), lot.repartitionPhases, phase.id)
        : honPhaseTemps(lot, phase.id, cats)
      ), 0),
    }));
  }, [draft, lots, taches, isPct, cats, activePhases, recapAssigneeKeys]); // eslint-disable-line

  const honByAssignee = useMemo(() => isGrp && isPct ? calcHonByAssignee(draft) : null, [draft, isGrp, isPct]);
  const honByAssigneeTemps = useMemo(() => isGrp && !isPct && recapAssigneeKeys ? grandTotalByAssignee(taches, recapCatsMap || cats, recapAssigneeKeys) : null, [draft, isGrp, isPct, taches, cats, recapAssigneeKeys, recapCatsMap]); // eslint-disable-line

  const totalHonHT = phasesSummary.reduce((s, p) => s + p.total, 0);
  const marge = parseFloat(draft.marge) || 0;
  const montantMarge = totalHonHT * marge / 100;
  const honAvecMarge = totalHonHT + montantMarge;
  const tva = parseFloat(draft.tva) || 20;
  const montantTVA = honAvecMarge * tva / 100;

  return (
    <div className="p-6 space-y-5 max-w-2xl">

      {/* Stat cards */}
      <div className={`grid gap-4 ${marge > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="relative bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-300 p-5 overflow-hidden">
          <Calculator size={48} className="absolute -right-1 -bottom-1 text-slate-100" />
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5">Honoraires HT</p>
          <p className="text-3xl font-bold text-slate-900">{fmtE(totalHonHT)}</p>
          <p className="text-[10px] text-slate-400 mt-1.5">{isPct ? `${lots.length} lot${lots.length > 1 ? 's' : ''}` : `${taches.length} tâche${taches.length > 1 ? 's' : ''}`} · {activePhases.length} phases</p>
        </div>
        {marge > 0 && (
          <div className="relative bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow duration-300 p-5 overflow-hidden">
            <Percent size={48} className="absolute -right-1 -bottom-1 text-emerald-100" />
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-1.5">Marge {marge} %</p>
            <p className="text-3xl font-bold text-emerald-700">+ {fmtE(montantMarge)}</p>
            <p className="text-[10px] text-slate-500 mt-1.5">Avec marge : {fmtE(honAvecMarge)}</p>
          </div>
        )}
        <div className="relative bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl border border-indigo-200 shadow-sm hover:shadow-md hover:shadow-indigo-100 transition-shadow duration-300 p-5 overflow-hidden">
          <Receipt size={48} className="absolute -right-1 -bottom-1 text-indigo-100" />
          <p className="text-[10px] text-indigo-600 uppercase tracking-wide font-semibold mb-1.5">Total TTC</p>
          <p className="text-3xl font-bold text-indigo-700">{fmtE(honAvecMarge + montantTVA)}</p>
          <p className="text-[10px] text-slate-500 mt-1.5">TVA {tva}% : {fmtE(montantTVA)}</p>
        </div>
      </div>

      {/* Répartition par membre du groupement */}
      {isGrp && (honByAssignee || honByAssigneeTemps) && (
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Répartition par membre du groupement</h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Membre</th>
                  {isPct && <th className="text-center py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-14">Lots</th>}
                  {isPct && <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-28">Travaux HT</th>}
                  <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-28">Honoraires HT</th>
                  <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-16">%</th>
                </tr>
              </thead>
              <tbody>
                {isPct && honByAssignee && Object.entries(honByAssignee).map(([key, data]) => {
                  const color = getColor(key, draft);
                  return (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                          <span className={`text-xs font-semibold ${color.text}`}>{getAssigneeName(key, draft)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{data.lots.length}</td>
                      <td className="py-2.5 px-4 text-right text-slate-500">{fmtE(data.totalTravauxHT)}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-700">{fmtE(data.totalHonHT)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">
                        {totalHonHT > 0 ? `${fmt(data.totalHonHT / totalHonHT * 100)} %` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {!isPct && honByAssigneeTemps && recapAssigneeKeys && recapAssigneeKeys.map(aKey => {
                  const color = getColor(aKey, draft);
                  const aTotal = honByAssigneeTemps[aKey] || 0;
                  return (
                    <tr key={aKey} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                          <span className={`text-xs font-semibold ${color.text}`}>{getAssigneeName(aKey, draft)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-700">{fmtE(aTotal)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">
                        {totalHonHT > 0 ? `${fmt(aTotal / totalHonHT * 100)} %` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="py-3 px-4 text-[9px] font-bold uppercase text-slate-500">Total groupement</td>
                  {isPct && <td className="py-3 px-4 text-center text-xs font-bold text-slate-600">{lots.length}</td>}
                  {isPct && honByAssignee && (
                    <td className="py-3 px-4 text-right text-xs font-bold text-slate-600">
                      {fmtE(Object.values(honByAssignee).reduce((s, d) => s + d.totalTravauxHT, 0))}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right text-sm font-bold text-indigo-600">{fmtE(totalHonHT)}</td>
                  <td className="py-3 px-4 text-right text-xs text-slate-400">100 %</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Par phase */}
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Honoraires par phase</h3>
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <th className="text-left py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-14">Code</th>
                <th className="text-left py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Phase</th>
                <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-32">Honoraires HT</th>
                <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-16">%</th>
              </tr>
            </thead>
            <tbody>
              {phasesSummary.map(phase => (
                <tr key={phase.id} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors duration-150">
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{phase.code}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{phase.label}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{fmtE(phase.total)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">
                    {totalHonHT > 0 ? `${fmt(phase.total / totalHonHT * 100)} %` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-gradient-to-r from-indigo-50/60 to-white">
                <td colSpan={2} className="py-3 px-4 text-[9px] font-bold uppercase text-slate-500">Total HT</td>
                <td className="py-3 px-4 text-right text-sm font-bold text-indigo-600">{fmtE(totalHonHT)}</td>
                <td className="py-3 px-4 text-right text-xs text-slate-400">100 %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Jours par fonction, phase et co-traitant — mode temps passé */}
      {!isPct && taches.length > 0 && (() => {
        const H_PAR_JOUR = 7;
        const aKeys = recapAssigneeKeys || ['mandataire'];
        const members = aKeys.length > 1 ? aKeys : null;

        return (
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Détail jours par phase{members ? ' et par membre' : ''}</h3>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  {/* Ligne 1 : en-têtes membres (si groupement) */}
                  {members && (
                    <tr className="border-b border-slate-100">
                      <th colSpan={2} className="bg-slate-50" />
                      {members.map(aKey => {
                        const color = getColor(aKey, draft);
                        const memberCats = getCategoriesForAssignee(draft, aKey);
                        return (
                          <th key={aKey} colSpan={memberCats.length} className={`text-center py-1.5 px-2 ${color.bg} border-x ${color.border}`}>
                            <div className="flex items-center justify-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                              <span className={`text-[8px] font-bold ${color.text}`}>{getAssigneeName(aKey, draft)}</span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="bg-slate-50" />
                    </tr>
                  )}
                  {/* Ligne 2 : labels catégories */}
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-12">Code</th>
                    <th className="text-left py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">Phase</th>
                    {(members || ['solo']).map(aKey => {
                      const memberCats = aKey !== 'solo' ? getCategoriesForAssignee(draft, aKey) : cats;
                      const color = aKey !== 'solo' ? getColor(aKey, draft) : null;
                      return memberCats.map(cat => (
                        <th key={`${aKey}-${cat.id}`} className={`text-center py-2 px-2 text-[8px] font-bold uppercase tracking-wider w-14 ${color ? color.text : 'text-slate-500'}`}
                          title={cat.label}>{cat.label.slice(0, 6)}</th>
                      ));
                    })}
                    <th className="text-right py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-20">Total €</th>
                  </tr>
                </thead>
                <tbody>
                  {activePhases.map(phase => {
                    const phaseTaches = taches.filter(t => t.phaseId === phase.id);
                    const catIds = cats.map(c => c.id);
                    let phaseTotal = 0;

                    return (
                      <tr key={phase.id} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                        <td className="py-2 px-3"><span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{phase.code}</span></td>
                        <td className="py-2 px-3 text-slate-600">{phase.label}</td>
                        {(members || ['solo']).map(aKey => {
                          const memberCats = aKey !== 'solo' ? getCategoriesForAssignee(draft, aKey) : cats;
                          const color = aKey !== 'solo' ? getColor(aKey, draft) : null;
                          return memberCats.map(cat => {
                            const hours = phaseTaches.reduce((s, t) => {
                              const nested = isNestedTemps(t.temps, catIds);
                              const tempsData = aKey !== 'solo'
                                ? (nested ? (t.temps?.[aKey] || {}) : (aKey === 'mandataire' ? (t.temps || {}) : {}))
                                : (t.temps || {});
                              return s + (parseFloat(tempsData[cat.id]) || 0);
                            }, 0);
                            const jours = hours / H_PAR_JOUR;
                            phaseTotal += hours * (parseFloat(cat.tauxHoraire) || 0);
                            return (
                              <td key={`${aKey}-${cat.id}`} className={`text-center py-2 px-1 font-mono text-[11px] tabular-nums ${color ? color.bg : ''} ${hours > 0 ? 'font-bold text-slate-700' : 'text-slate-300'}`}>
                                {hours > 0 ? `${parseFloat(jours.toFixed(1))}` : '—'}
                              </td>
                            );
                          });
                        })}
                        <td className="py-2 px-3 text-right font-semibold text-slate-800">{phaseTotal > 0 ? fmtE(phaseTotal) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-gradient-to-r from-indigo-50/60 to-white">
                    <td colSpan={2} className="py-3 px-3 text-[9px] font-bold uppercase text-slate-500">Total</td>
                    {(members || ['solo']).map(aKey => {
                      const memberCats = aKey !== 'solo' ? getCategoriesForAssignee(draft, aKey) : cats;
                      const color = aKey !== 'solo' ? getColor(aKey, draft) : null;
                      const catIds = cats.map(c => c.id);
                      return memberCats.map(cat => {
                        const totalH = taches.reduce((s, t) => {
                          const nested = isNestedTemps(t.temps, catIds);
                          const tempsData = aKey !== 'solo'
                            ? (nested ? (t.temps?.[aKey] || {}) : (aKey === 'mandataire' ? (t.temps || {}) : {}))
                            : (t.temps || {});
                          return s + (parseFloat(tempsData[cat.id]) || 0);
                        }, 0);
                        const jours = totalH / H_PAR_JOUR;
                        return (
                          <td key={`tot-${aKey}-${cat.id}`} className={`text-center py-3 px-1 font-mono text-xs font-bold ${color ? color.bg : ''} ${totalH > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                            {totalH > 0 ? `${parseFloat(jours.toFixed(1))}` : '—'}
                          </td>
                        );
                      });
                    })}
                    <td className="py-3 px-3 text-right text-sm font-bold text-indigo-600">{fmtE(totalHonHT)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })()}

      {/* Par lot */}
      {lots.length > 0 && (
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Honoraires par lot</h3>
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <th className="text-left py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Lot</th>
                  {isGrp && <th className="text-left py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 w-32">Assigné à</th>}
                  <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Travaux HT</th>
                  <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Honoraires HT</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot, i) => {
                  const hon = isPct ? pct(lot, draft.tauxHonorairesGlobal) : activePhases.reduce((s, ph) => s + honPhaseTemps(lot, ph.id, cats), 0);
                  const assignKey = lot.assigneA || 'mandataire';
                  const ci = (draft.cotraitants || []).findIndex(c => c.id === assignKey);
                  const color = assignKey === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
                  return (
                    <tr key={lot.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 text-slate-600">
                        <span className="text-[9px] font-bold text-slate-400 mr-2">#{i + 1}</span>
                        {lot.designation || <span className="italic text-slate-400">Sans désignation</span>}
                      </td>
                      {isGrp && (
                        <td className="py-2.5 px-4">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text} ${color.border} border`}>
                            {getAssigneeName(assignKey, draft)}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right text-slate-500">{fmtE(parseFloat(lot.montantTravauxHT) || 0)}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-700">{fmtE(hon)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Synthèse */}
      <section>
      {/* Comparaison % équivalent — mode temps passé */}
      {!isPct && (() => {
        const mtGlobal = parseFloat(draft.montantTravauxGlobal) || 0;
        const pctEquiv = mtGlobal > 0 && totalHonHT > 0 ? (totalHonHT / mtGlobal * 100) : null;
        return mtGlobal > 0 ? (
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Comparaison temps passé vs % équivalent</h3>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <th className="text-left py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500"></th>
                    <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-indigo-500 w-36">Temps passé</th>
                    <th className="text-right py-2.5 px-4 text-[9px] font-bold uppercase tracking-wider text-violet-500 w-36">% équivalent</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 px-4 text-slate-600">Montant travaux HT</td>
                    <td className="py-2.5 px-4 text-right text-slate-500" colSpan={2}>{fmtE(mtGlobal)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 px-4 text-slate-600">Taux honoraires</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-indigo-600">{pctEquiv !== null ? `${pctEquiv.toFixed(2)} %` : '—'}</td>
                    <td className="py-2.5 px-4 text-right text-slate-400 italic">calculé</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 px-4 text-slate-600">Honoraires HT</td>
                    <td className="py-2.5 px-4 text-right font-bold text-indigo-600">{fmtE(totalHonHT)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-violet-600">{fmtE(totalHonHT)}</td>
                  </tr>
                  {marge > 0 && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-slate-600">Marge {marge} %</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600">+ {fmtE(montantMarge)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600">+ {fmtE(montantMarge)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-gradient-to-r from-indigo-50/60 to-white">
                    <td className="py-3 px-4 text-[9px] font-bold uppercase text-slate-500">Total TTC</td>
                    <td className="py-3 px-4 text-right text-sm font-bold text-indigo-600">{fmtE(honAvecMarge + montantTVA)}</td>
                    <td className="py-3 px-4 text-right text-sm font-bold text-violet-600">{fmtE(honAvecMarge + montantTVA)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {pctEquiv !== null && (
              <div className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-50 border border-violet-100">
                <Percent size={14} className="text-violet-400" />
                <p className="text-[11px] text-violet-700">
                  Vos honoraires au temps passé correspondent à un taux de <span className="font-bold">{pctEquiv.toFixed(2)} %</span> du montant des travaux.
                </p>
              </div>
            )}
          </section>
        ) : null;
      })()}

        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Synthèse financière</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200">
            <span className="text-sm text-slate-600">Honoraires HT (base)</span>
            <span className="text-base font-bold text-slate-800">{fmtE(totalHonHT)}</span>
          </div>
          {marge > 0 && (
            <>
              <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-sm text-emerald-700">Marge {marge} %</span>
                <span className="text-base font-bold text-emerald-700">+ {fmtE(montantMarge)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-sm text-slate-600">Honoraires HT (avec marge)</span>
                <span className="text-base font-bold text-slate-800">{fmtE(honAvecMarge)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-600">TVA {tva} %</span>
            <span className="text-base font-bold text-slate-700">{fmtE(montantTVA)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-4 rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100/60 border border-indigo-200 shadow-sm shadow-indigo-100">
            <span className="text-sm font-bold text-indigo-800">Honoraires TTC</span>
            <span className="text-2xl font-black text-indigo-700">{fmtE(honAvecMarge + montantTVA)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
