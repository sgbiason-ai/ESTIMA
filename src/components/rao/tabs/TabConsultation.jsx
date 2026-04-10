// src/components/rao/tabs/TabConsultation.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Info, BarChart2, Plus, Trash2, Layers, Lock, AlertTriangle, ShieldCheck, CornerDownRight } from 'lucide-react';
import { Field, Input } from '../RaoUI';
import { FORMULA_LABELS_CONSULT } from '../RaoConstants';

// ─── Textarea auto-resize ────────────────────────────────────────────────────
const AutoTextarea = ({ value, onChange, className, placeholder }) => {
  const ref = useRef(null);
  const resize = () => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = ref.current.scrollHeight + 'px';
  };
  useEffect(resize, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => { onChange(e.target.value); resize(); }}
      onFocus={resize}
      rows={1}
      className={`resize-none overflow-hidden ${className}`}
      placeholder={placeholder}
    />
  );
};

// ─── Split Panel avec divider déplaçable ─────────────────────────────────────
const SplitPanel = ({ left, right }) => {
  const containerRef = useRef(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.max(25, Math.min(75, pct)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex gap-0 max-w-[1600px] mx-auto pb-24 items-stretch h-full">
      {/* Panneau gauche */}
      <div className="overflow-y-auto min-w-0" style={{ width: `${splitPercent}%` }}>
        {left}
      </div>

      {/* Divider déplaçable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex flex-col items-center justify-center w-3 cursor-col-resize group shrink-0 hover:bg-blue-50 transition-colors rounded"
        title="Glisser pour redimensionner"
      >
        <div className="w-1 h-10 rounded-full bg-slate-200 group-hover:bg-blue-400 transition-colors" />
      </div>

      {/* Panneau droit */}
      <div className="overflow-y-auto min-w-0" style={{ width: `${100 - splitPercent}%` }}>
        {right}
      </div>
    </div>
  );
};

const TabConsultation = ({
  consultation, updateConsultation, criteria, updateCriteria,
  addCriterion, removeCriterion, addSubCriterion, removeSubCriterion, updateSubCriterion,
  scoringConfig, hasTranches,
  tranches, raoTrancheId, setRaoTrancheId,
  optionChapters = [], includedOptions = {}, updateIncludedOption,
  offersLocked = false,
}) => {
  return (
    <SplitPanel
      left={
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mr-1">
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
      }
      right={
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm ml-1">
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
            {(() => {
              const getWeight = (c) => {
                if (c.auto) return scoringConfig?.maxScore ?? c.weight;
                if ((c.subCriteria || []).length > 0) return c.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0);
                return Number(c.weight) || 0;
              };
              const total = criteria.reduce((s, c) => s + getWeight(c), 0);
              return (
                <span className={`text-xs font-bold px-4 py-2 rounded-xl shadow-inner ${
                  total === 100
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  Total pondération : {total}%
                </span>
              );
            })()}
            <button onClick={addCriterion} className="flex items-center gap-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 shadow-md px-5 py-2.5 rounded-xl transition-all duration-200 active:scale-95">
              <Plus size={16} /> Ajouter un critère
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {criteria.map((crit, i) => {
            const hasSubs = (crit.subCriteria || []).length > 0;
            const subTotal = hasSubs ? crit.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0) : 0;

            return (
            <div key={crit.id} className="group rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-300 relative overflow-hidden">
              {crit.auto && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 z-10" />}

              {/* ── Ligne principale du critère (pleine largeur) ── */}
              <div className="flex items-center gap-4 p-4 bg-slate-50/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-700 text-sm font-black shrink-0">
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    value={crit.label}
                    onChange={e => {
                      const newC = [...criteria];
                      newC[i] = { ...newC[i], label: e.target.value };
                      updateCriteria(newC);
                    }}
                    className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                    placeholder="Intitulé du critère"
                  />
                </div>

                {/* Pondération */}
                <div className="relative shrink-0">
                  {crit.auto ? (
                    <>
                      <div className="w-20 px-3 py-2 text-sm bg-emerald-50 border border-emerald-200 rounded-xl text-center font-black text-emerald-700 pr-6 select-none shadow-sm">
                        {scoringConfig?.maxScore ?? crit.weight}
                      </div>
                      <span className="absolute right-2.5 top-2.5 text-emerald-500 text-xs font-bold">%</span>
                    </>
                  ) : hasSubs ? (
                    <>
                      <div className="w-20 px-3 py-2 text-sm bg-blue-50 border border-blue-200 rounded-xl text-center font-black text-blue-700 pr-6 select-none shadow-sm" title="Σ sous-critères">
                        {subTotal}
                      </div>
                      <span className="absolute right-2.5 top-2.5 text-blue-400 text-xs font-bold">%</span>
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
                        className="w-20 px-3 py-2 text-sm bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-black pr-6"
                      />
                      <span className="absolute right-2.5 top-2.5 text-slate-400 text-xs font-bold">%</span>
                    </>
                  )}
                </div>

                {/* Actions */}
                {!crit.auto && (
                  <button onClick={() => addSubCriterion?.(crit.id)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Ajouter un sous-critère">
                    <Plus size={16} />
                  </button>
                )}
                {criteria.length > 1 && !crit.auto && (
                  <button onClick={() => removeCriterion(crit.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                )}
                {crit.auto && (
                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg shrink-0">Prix</span>
                )}
              </div>

              {/* ── Description du critère (masquée si sous-critères) ── */}
              {!hasSubs && (
                <div className="px-4 pb-3 pt-0">
                  <AutoTextarea
                    value={crit.description || ''}
                    onChange={v => {
                      const newC = [...criteria];
                      newC[i] = { ...newC[i], description: v };
                      updateCriteria(newC);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30 text-slate-500 ml-14"
                    placeholder="Description ou méthode de calcul de la note…"
                  />
                </div>
              )}

              {/* ── Infos auto (formule, tranches, PSE) pour critère Prix ── */}
              {crit.auto && scoringConfig && (
                <div className="px-4 pb-4 ml-14 space-y-2" style={{ width: 'calc(100% - 3.5rem)' }}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Formule</span>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-lg shadow-sm">
                        {FORMULA_LABELS_CONSULT[scoringConfig.mode] || scoringConfig.mode?.toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden md:block w-px h-5 bg-emerald-200" />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Barème</span>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-lg shadow-sm">{scoringConfig.maxScore} pts</span>
                    </div>
                  </div>
                  {hasTranches && tranches && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 shrink-0">📐 Tranche</span>
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
                </div>
              )}

              {/* ── Sous-critères (décalés sous le critère parent) ── */}
              {hasSubs && (
                <div className="mx-4 mb-4 ml-14 bg-blue-50/50 border border-blue-200/50 rounded-xl p-2.5 space-y-1.5" style={{ width: 'calc(100% - 5rem)' }}>
                  {crit.subCriteria.map((sub, si) => (
                    <div key={sub.id} className="bg-white rounded-lg border border-blue-100 px-3 py-2.5 shadow-sm space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-black text-blue-600 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">
                          {i + 1}.{si + 1}
                        </span>
                        <input
                          value={sub.label}
                          onChange={e => updateSubCriterion?.(crit.id, sub.id, 'label', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none min-w-0"
                          placeholder={`Sous-critère ${i + 1}.${si + 1}`}
                        />
                        <div className="relative shrink-0">
                          <input
                            type="number" min={0} max={100}
                            value={sub.weight || 0}
                            onChange={e => updateSubCriterion?.(crit.id, sub.id, 'weight', Number(e.target.value))}
                            className="w-14 px-1.5 py-1 text-xs bg-blue-50 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400/30 text-center font-black text-blue-700 pr-4"
                          />
                          <span className="absolute right-1 top-1.5 text-blue-400 text-[9px] font-bold">%</span>
                        </div>
                        <button onClick={() => removeSubCriterion?.(crit.id, sub.id)} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <AutoTextarea
                        value={sub.description || ''}
                        onChange={v => updateSubCriterion?.(crit.id, sub.id, 'description', v)}
                        className="w-full px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400/30 text-slate-500 ml-7"
                        placeholder="Description ou méthode de notation…"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>
      }
    />
  );
};

export default TabConsultation;