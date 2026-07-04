// src/components/rao/tabs/nego/NegoComparisonPanel.jsx
//
// Panneau « Analyse après négociation » de l'onglet Négociation du RAO.
// Comparatif par entreprise : montant initial → montant après négo (Δ € / Δ %)
// et notes prix des deux phases. Les montants « après négo » proviennent de la
// phase Après négo de l'Analyse financière (offres initiales reprises article
// par article tant qu'elles ne sont pas renégociées).

import React, { useState } from 'react';
import { Handshake, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Info, FileUp, GitBranch, RotateCcw } from 'lucide-react';

const fmtEur = (v) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const NegoComparisonPanel = ({
  comparison = null,
  negoActive = false,
  scoringConfig = null,
  onUpdateRabais = null,
  // (row, file) → import de l'offre négociée (xlsx/pdf). row.kind === 'base'
  // → offersNego de l'entreprise ; row.kind === 'variant' → offersNego de la
  // variante (row.companyId + row.variantId). Active la phase « Après négo ».
  onImportNegoOffer = null,
  // (bool) → bascule la notation du RAO sur les offres initiales / négociées.
  // Évite l'aller-retour vers l'onglet Analyse financière.
  onSetNegoPhase = null,
}) => {
  const [open, setOpen] = useState(negoActive);
  const maxScore = Number(scoringConfig?.maxScore || 40);

  // Rien à montrer : pas de prix négociés et phase initiale → onglet inchangé
  if (!comparison && !negoActive) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Handshake size={20} className="text-emerald-600" />
          <div>
            <h4 className="text-base font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              Analyse après négociation
              {negoActive ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Notation active
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
                  Notation sur offres initiales
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {comparison
                ? `${comparison.filter(r => r.negotiated).length}/${comparison.length} entreprise(s) avec prix négociés`
                : 'Aucun prix négocié saisi pour le moment'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-4">
          {comparison ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-wider">
                    <th className="px-3 py-2.5 text-left">Entreprise</th>
                    <th className="px-3 py-2.5 text-right">Montant initial HT</th>
                    <th className="px-3 py-2.5 text-right" title="Rabais commercial en % consenti sur le Total HT — déduit du montant noté">Rabais</th>
                    <th className="px-3 py-2.5 text-right" title="Total HT net (prix négociés, rabais commercial déduit)">Après négo HT</th>
                    <th className="px-3 py-2.5 text-right">Δ €</th>
                    <th className="px-3 py-2.5 text-right">Δ %</th>
                    <th className="px-3 py-2.5 text-right" title={`Note prix sur ${maxScore} pts — offres initiales`}>Note init.</th>
                    <th className="px-3 py-2.5 text-right" title={`Note prix sur ${maxScore} pts — après négociation`}>Note négo</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(r => {
                    const down = r.delta < -0.005;
                    const up = r.delta > 0.005;
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className={`px-3 py-2 font-bold ${r.kind === 'variant' ? 'text-purple-800 pl-6' : 'text-slate-800'}`}>
                          <span className="flex items-center gap-2">
                            {onImportNegoOffer && (
                              <label
                                className={`shrink-0 p-1.5 rounded-lg border cursor-pointer transition-colors active:scale-95 ${
                                  r.kind === 'variant'
                                    ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                                title={`Importer l'offre négociée de ${r.name} (Excel ou PDF)${r.negoImportFile ? `\nDernier import : ${r.negoImportFile}${r.negoImportAt ? ' — ' + new Date(r.negoImportAt).toLocaleDateString('fr-FR') : ''}` : ''}`}
                              >
                                <FileUp size={13} />
                                <input
                                  type="file"
                                  accept=".xlsx,.xls,.pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) onImportNegoOffer(r, f);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                            {r.kind === 'variant' && <GitBranch size={11} className="text-purple-500 shrink-0" />}
                            <span className="flex flex-col min-w-0">
                              <span className="truncate">{r.name}</span>
                              {r.negoImportFile && (
                                <span className="text-[9px] font-medium text-emerald-600 truncate" title={r.negoImportFile}>
                                  ⇡ {r.negoImportFile}
                                </span>
                              )}
                            </span>
                            {!r.negotiated && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded shrink-0" title="Aucun prix renégocié — offre initiale reprise telle quelle">
                                offre initiale
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtEur(r.initialTotal)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.kind === 'variant' ? (
                            <span className="tabular-nums font-bold text-slate-400" title="Rabais global de l'entreprise (saisi sur sa ligne d'offre de base) — s'applique aussi aux variantes">
                              {r.rabaisPct > 0 ? `−${r.rabaisPct} %` : '—'}
                            </span>
                          ) : onUpdateRabais ? (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <input
                                type="number" min="0" max="100" step="0.1"
                                value={r.rabaisPct > 0 ? r.rabaisPct : ''}
                                onChange={(e) => onUpdateRabais(r.companyId, e.target.value)}
                                placeholder="—"
                                className="w-14 bg-gray-100 border border-gray-200/60 rounded-lg px-1.5 py-0.5 text-right text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 tabular-nums placeholder:text-slate-300"
                                title="Rabais commercial en % sur le Total HT (s'applique à la base et aux variantes de l'entreprise)"
                              />
                              <span className="text-slate-400 font-bold">%</span>
                            </span>
                          ) : (
                            <span className="tabular-nums font-bold text-slate-700">{r.rabaisPct > 0 ? `−${r.rabaisPct} %` : '—'}</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums font-bold text-slate-900"
                          title={r.rabaisPct > 0 ? `Total DQE négocié avant rabais : ${fmtEur(r.negoTotalBrut)}` : undefined}
                        >
                          {fmtEur(r.negoTotal)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${down ? 'text-emerald-600' : up ? 'text-red-500' : 'text-slate-400'}`}>
                          <span className="inline-flex items-center gap-1">
                            {down && <TrendingDown size={12} />}
                            {up && <TrendingUp size={12} />}
                            {r.delta > 0 ? '+' : ''}{fmtEur(r.delta)}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${down ? 'text-emerald-600' : up ? 'text-red-500' : 'text-slate-400'}`}>
                          {r.deltaPct > 0 ? '+' : ''}{r.deltaPct.toFixed(2)} %
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.scoreInitial.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-black text-emerald-700">{r.scoreNego.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-[12px] text-emerald-900">
              <Info size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              <p>
                La phase <strong>Après négociation</strong> est active mais aucun prix négocié n'a encore été saisi :
                les offres initiales sont reprises telles quelles. Importez les offres négociées via le bouton
                <FileUp size={12} className="inline mx-1 -mt-0.5" /> sur chaque ligne du tableau.
              </p>
            </div>
          )}

          {/* Bascule directe de la notation — évite l'aller-retour vers Analyse financière */}
          {comparison && !negoActive && onSetNegoPhase && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-[12px] text-amber-900">
              <Info size={15} className="shrink-0 text-amber-600" />
              <p className="flex-1">
                Des prix négociés existent mais la notation du RAO utilise encore les <strong>offres initiales</strong>.
              </p>
              <button
                onClick={() => onSetNegoPhase(true)}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
              >
                <Handshake size={13} /> Noter sur les offres négociées
              </button>
            </div>
          )}

          {/* Retour possible vers les offres initiales */}
          {comparison && negoActive && onSetNegoPhase && (
            <div className="flex justify-end">
              <button
                onClick={() => onSetNegoPhase(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                title="Revenir à la notation sur les offres initiales"
              >
                <RotateCcw size={12} /> Repasser sur les offres initiales
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NegoComparisonPanel;
