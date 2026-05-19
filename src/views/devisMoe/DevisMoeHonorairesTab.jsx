// src/views/devisMoe/DevisMoeHonorairesTab.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, ChevronRight, ChevronDown, CheckCircle2, Layers, AlertTriangle, PanelLeftClose, PanelLeftOpen, BookOpen, GripVertical, Pencil, X } from 'lucide-react';
import HonorairesConfigPanel from './HonorairesConfigPanel';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PHASES_LOI_MOP, createEmptyLot, TACHE_TEMPLATES, COTRAITANT_COLORS, MANDATAIRE_COLOR, getCategoriesForAssignee, buildCategoriesMap, createEmptyTache } from '../../hooks/useDevisMoe';
import { calcHonByAssignee, getAssigneeName, isNestedTemps, getAssigneeKeys, tacheTotalBudget, tacheBudgetByAssignee, phaseBudgetByAssignee, grandTotalByAssignee, phaseHoursByAssignee, grandHoursByAssignee } from '../../utils/devisMoeCalculations';
import { pct, honPhasePct, honPhaseTemps, newSousTache, totalRep, fmt, fmtE, iSmCls } from './devisMoeHelpers';
import TacheTypeEditModal from './TacheTypeEditModal';

export default function DevisMoeHonorairesTab({ draft, onChange, templatesOpen, setTemplatesOpen, configOpen, setConfigOpen }) {
  const [expandedLots, setExpandedLots] = useState(new Set());
  const [uniteTemps, setUniteTemps] = useState('j');
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [editingTplIdx, setEditingTplIdx] = useState(null); // null=closed, -1=add, 0+=edit
  const [tplSearch, setTplSearch] = useState('');
  const [tplFilterPhase, setTplFilterPhase] = useState(null); // null = toutes, sinon id phase
  const [totauxOpen, setTotauxOpen] = useState(true);
  const H_PAR_JOUR = 7;

  const activePhases = useMemo(() =>
    (draft.phases || PHASES_LOI_MOP).filter(p => p.actif), [draft.phases]);

  // Auto-select first active phase if none selected
  useEffect(() => {
    if (activePhases.length > 0 && (!selectedPhaseId || !activePhases.find(p => p.id === selectedPhaseId))) {
      setSelectedPhaseId(activePhases[0].id);
    }
  }, [activePhases]); // eslint-disable-line


  const togglePhase = (phaseId) => {
    const phases = (draft.phases || PHASES_LOI_MOP).map(p =>
      p.id === phaseId ? { ...p, actif: !p.actif } : p
    );
    const activePh = phases.filter(p => p.actif);
    const cats = draft.categories || [];
    const lots = (draft.lots || []).map(lot => ({
      ...lot,
      repartitionPhases: activePh.map(p =>
        lot.repartitionPhases?.find(r => r.phaseId === p.id) || { phaseId: p.id, pourcentage: '' }
      ),
      phasesTemps: activePh.map(p =>
        lot.phasesTemps?.find(r => r.phaseId === p.id) || { phaseId: p.id, sousTaches: [newSousTache(cats)] }
      ),
    }));
    onChange({ ...draft, phases, lots });
  };

  const addLot = () => {
    const cats = draft.categories || [];
    const newLot = createEmptyLot((draft.lots?.length || 0) + 1, draft.phases || PHASES_LOI_MOP, cats);
    newLot.phasesTemps = newLot.phasesTemps.map(pt => ({ phaseId: pt.phaseId, sousTaches: [newSousTache(cats)] }));
    onChange({ ...draft, lots: [...(draft.lots || []), newLot] });
    setExpandedLots(prev => new Set([...prev, newLot.id]));
  };

  const removeLot = (id) => onChange({ ...draft, lots: (draft.lots || []).filter(l => l.id !== id) });

  const updateLot = (id, field, val) =>
    onChange({ ...draft, lots: (draft.lots || []).map(l => l.id === id ? { ...l, [field]: val } : l) });

  const updateRep = (lotId, phaseId, val) =>
    onChange({
      ...draft,
      lots: (draft.lots || []).map(l => l.id !== lotId ? l : {
        ...l,
        repartitionPhases: (l.repartitionPhases || []).map(r =>
          r.phaseId === phaseId ? { ...r, pourcentage: val } : r
        ),
      }),
    });

  const addSousTache = (lotId, phaseId) => {
    const cats = draft.categories || [];
    onChange({
      ...draft,
      lots: (draft.lots || []).map(l => l.id !== lotId ? l : {
        ...l,
        phasesTemps: (l.phasesTemps || []).map(pt =>
          pt.phaseId !== phaseId ? pt : { ...pt, sousTaches: [...(pt.sousTaches || []), newSousTache(cats)] }
        ),
      }),
    });
  };

  const removeSousTache = (lotId, phaseId, stId) =>
    onChange({
      ...draft,
      lots: (draft.lots || []).map(l => l.id !== lotId ? l : {
        ...l,
        phasesTemps: (l.phasesTemps || []).map(pt =>
          pt.phaseId !== phaseId ? pt : { ...pt, sousTaches: (pt.sousTaches || []).filter(st => st.id !== stId) }
        ),
      }),
    });

  const updateSousTache = (lotId, phaseId, stId, field, val) =>
    onChange({
      ...draft,
      lots: (draft.lots || []).map(l => l.id !== lotId ? l : {
        ...l,
        phasesTemps: (l.phasesTemps || []).map(pt =>
          pt.phaseId !== phaseId ? pt : {
            ...pt,
            sousTaches: (pt.sousTaches || []).map(st => st.id !== stId ? st : { ...st, [field]: val }),
          }
        ),
      }),
    });

  const updateSousTacheTemps = (lotId, phaseId, stId, catId, val) =>
    onChange({
      ...draft,
      lots: (draft.lots || []).map(l => l.id !== lotId ? l : {
        ...l,
        phasesTemps: (l.phasesTemps || []).map(pt =>
          pt.phaseId !== phaseId ? pt : {
            ...pt,
            sousTaches: (pt.sousTaches || []).map(st =>
              st.id !== stId ? st : { ...st, temps: { ...st.temps, [catId]: val } }
            ),
          }
        ),
      }),
    });

  const toggleLot = (id) =>
    setExpandedLots(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const cats = draft.categories || [];
  const lots = draft.lots || [];
  const isPct = draft.methode === 'pourcentage';

  const tva = parseFloat(draft.tva) || 20;
  const isGrp = draft.moeType === 'mandataire' || draft.moeType === 'cotraitant';
  const catsMap = isGrp ? buildCategoriesMap(draft) : null;
  const totalTravauxHT = lots.reduce((s, l) => s + (parseFloat(l.montantTravauxHT) || 0), 0);
  const totalHonTaches = (() => {
    const taches = draft.taches || [];
    if (isGrp && catsMap) {
      const aKeys = getAssigneeKeys(draft);
      return taches.reduce((s, t) => s + tacheTotalBudget(t, catsMap, aKeys), 0);
    }
    return taches.reduce((s, t) =>
      s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
  })();
  const totalHonPctLots = lots.reduce((s, l) => s + pct(l, draft.tauxHonorairesGlobal), 0);
  const totalHonHT = totalHonTaches;

  const SectionLabel = ({ children }) => (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">{children}</h3>
  );

  return (
    <div className="flex gap-0 max-w-full h-full">

      {/* ── Contenu principal ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ── Mode temps passe -- style ProjectView ──────────────────────────── */}
      {(() => {
        const taches = draft.taches || [];
        const mtGlobal = parseFloat(draft.montantTravauxGlobal) || 0;
        const pctOf = (val) => mtGlobal > 0 ? (val / mtGlobal * 100).toFixed(2) : null;
        const templates = draft.customTemplates || TACHE_TEMPLATES;
        const updateTemplates = (newTpls) => onChange({ ...draft, customTemplates: newTpls });
        const removeTemplate = (idx) => updateTemplates(templates.filter((_, i) => i !== idx));
        const saveTemplate = (idx, data) => {
          if (idx === -1) updateTemplates([...templates, data]);
          else updateTemplates(templates.map((t, i) => i === idx ? data : t));
        };
        const reorderTemplates = (fromIdx, toIdx) => {
          const arr = [...templates];
          const [moved] = arr.splice(fromIdx, 1);
          arr.splice(toIdx, 0, moved);
          updateTemplates(arr);
        };

        const tachesByPhase = {};
        activePhases.forEach(p => { tachesByPhase[p.id] = []; });
        taches.forEach(t => { if (tachesByPhase[t.phaseId]) tachesByPhase[t.phaseId].push(t); });

        const isGrpTemps = (draft.moeType === 'mandataire' || draft.moeType === 'cotraitant');
        const assigneeKeys = isGrpTemps ? getAssigneeKeys(draft) : null;
        const catIds = cats.map(c => c.id);

        const addTache = (phaseId, label = '') => {
          const t = createEmptyTache(phaseId, label, assigneeKeys);
          onChange({ ...draft, taches: [...taches, t] });
        };
        const removeTache = (id) => onChange({ ...draft, taches: taches.filter(t => t.id !== id) });
        const updateTacheLabel = (id, label) => onChange({ ...draft, taches: taches.map(t => t.id === id ? { ...t, label } : t) });

        // Extracted handlers for .map() rows
        const handleTacheLabelChange = (tacheId) => (e) => updateTacheLabel(tacheId, e.target.value);
        const handleTacheTempsChange = (tacheId, catId, aKey) => (e) => {
          const v = parseFloat(e.target.value);
          updateTacheTemps(tacheId, catId, isNaN(v) ? '' : String(uniteTemps === 'j' ? v * H_PAR_JOUR : v), aKey);
        };
        const handleTemplateClick = (tplLabel) => () => { if (selectedPhaseId) addTache(selectedPhaseId, tplLabel); };
        const updateTacheTemps = (id, catId, val, assigneeKey = null) => {
          onChange({ ...draft, taches: taches.map(t => {
            if (t.id !== id) return t;
            if (assigneeKey) {
              // Format nested
              const aTemps = { ...(t.temps?.[assigneeKey] || {}), [catId]: val };
              return { ...t, temps: { ...t.temps, [assigneeKey]: aTemps } };
            }
            // Format flat
            return { ...t, temps: { ...t.temps, [catId]: val } };
          })});
        };
        const removePhase = (phaseId) => {
          onChange({
            ...draft,
            phases: (draft.phases || PHASES_LOI_MOP).map(p => p.id === phaseId ? { ...p, actif: false } : p),
            taches: taches.filter(t => t.phaseId !== phaseId),
          });
        };

        const grandTotalHon = assigneeKeys
          ? taches.reduce((s, t) => s + tacheTotalBudget(t, catsMap || cats, assigneeKeys), 0)
          : taches.reduce((s, t) => s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);

        const handleDragEnd = (result) => {
          const { source, destination, type } = result;
          if (!destination) return;
          if (type === 'PHASE') {
            const newPhases = [...(draft.phases || PHASES_LOI_MOP)];
            const actives = newPhases.filter(p => p.actif);
            const [moved] = actives.splice(source.index, 1);
            actives.splice(destination.index, 0, moved);
            const inactives = newPhases.filter(p => !p.actif);
            onChange({ ...draft, phases: [...actives, ...inactives] });
          } else if (type === 'TACHE') {
            const srcPhase = source.droppableId;
            const dstPhase = destination.droppableId;
            const srcTaches = [...(tachesByPhase[srcPhase] || [])];
            const [moved] = srcTaches.splice(source.index, 1);
            moved.phaseId = dstPhase;
            if (srcPhase === dstPhase) {
              srcTaches.splice(destination.index, 0, moved);
              const newTaches = taches.filter(t => t.phaseId !== srcPhase);
              onChange({ ...draft, taches: [...newTaches, ...srcTaches] });
            } else {
              const dstTaches = [...(tachesByPhase[dstPhase] || [])];
              dstTaches.splice(destination.index, 0, moved);
              const newTaches = taches.filter(t => t.phaseId !== srcPhase && t.phaseId !== dstPhase);
              onChange({ ...draft, taches: [...newTaches, ...srcTaches, ...dstTaches] });
            }
          }
        };

        return (
          <section className="flex gap-3 min-h-0 flex-1">
            {/* ── Panneau templates (gauche) — style ProjectView ──────────── */}
            {templatesOpen ? (
              <div className="w-72 shrink-0 flex flex-col bg-white border-r border-slate-200 shadow-xl z-20 overflow-hidden">
                {/* Header */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <BookOpen size={14} className="text-emerald-600" />
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Tâches types</span>
                      <span className="text-[9px] text-slate-400 font-medium">({templates.length})</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setEditingTplIdx(-1)} className="p-1 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-default" title="Ajouter une tâche type">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => setTemplatesOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-default">
                        <PanelLeftClose size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Recherche */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="text" value={tplSearch} onChange={e => setTplSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-400 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 outline-none transition-all select-text" />
                  </div>
                  {/* Filtre par phase */}
                  <div className="flex items-center gap-1 flex-wrap mt-2">
                    <button onClick={() => setTplFilterPhase(null)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-default ${
                        !tplFilterPhase ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                      Toutes
                    </button>
                    {(draft.phases || PHASES_LOI_MOP).filter(p => p.actif).map(p => (
                      <button key={p.id} onClick={() => setTplFilterPhase(tplFilterPhase === p.id ? null : p.id)}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-default ${
                          tplFilterPhase === p.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}>
                        {p.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Liste */}
                <DragDropContext onDragEnd={(result) => {
                  if (!result.destination) return;
                  reorderTemplates(result.source.index, result.destination.index);
                }}>
                  <Droppable droppableId="sidebar-tpl">
                    {(provided) => {
                      const normalize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                      const q = normalize(tplSearch);
                      const filteredTemplates = templates.map((tpl, idx) => ({ tpl, idx }))
                        .filter(({ tpl }) => !q || normalize(tpl.label).includes(q))
                        .filter(({ tpl }) => !tplFilterPhase || (tpl.phases && tpl.phases.includes(tplFilterPhase)));
                      return (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50">
                        {filteredTemplates.map(({ tpl, idx }) => {
                          const tplPhases = (tpl.phases && tpl.phases.length > 0)
                            ? tpl.phases.map(pid => (draft.phases || PHASES_LOI_MOP).find(p => p.id === pid)).filter(Boolean)
                            : null;

                          return (
                            <Draggable key={`stpl-${idx}`} draggableId={`stpl-${idx}`} index={idx}>
                              {(dragProvided, dragSnapshot) => (
                                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                                  onClick={handleTemplateClick(tpl.label)}
                                  className={`group/tpl relative flex items-start p-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-default
                                    hover:border-emerald-400 hover:shadow-md hover:bg-emerald-50/30 transition-all duration-200 active:scale-[0.98] ${
                                    dragSnapshot.isDragging ? 'shadow-lg border-emerald-400 bg-emerald-50/30' : ''
                                  }`}>
                                  {/* Accent vert gauche */}
                                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-emerald-500 opacity-0 group-hover/tpl:opacity-100 transition-opacity" />

                                  {/* Grip */}
                                  <div {...dragProvided.dragHandleProps} className="text-slate-200 hover:text-slate-400 cursor-grab shrink-0 mt-0.5 mr-1.5">
                                    <GripVertical size={12} />
                                  </div>

                                  {/* Contenu */}
                                  <div className="flex-1 min-w-0 pr-1">
                                    <div className="text-[10px] font-bold text-slate-700 uppercase leading-snug line-clamp-2 group-hover/tpl:text-emerald-800 transition-colors">
                                      {tpl.label || <span className="text-slate-300 italic normal-case">Sans titre</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                      {tplPhases ? tplPhases.map(p => (
                                        <span key={p.id} className="text-[7px] font-black text-white bg-slate-600 px-1 py-px rounded-sm uppercase">
                                          {p.code}
                                        </span>
                                      )) : (
                                        <span className="text-[7px] font-black text-white bg-amber-500 px-1 py-px rounded-sm uppercase">Général</span>
                                      )}
                                    </div>

                                  </div>

                                  {/* Actions droite */}
                                  <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover/tpl:opacity-100 transition-all shrink-0">
                                    <button onClick={() => setEditingTplIdx(idx)}
                                      className="p-1 rounded text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 cursor-default" title="Modifier">
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={() => removeTemplate(idx)}
                                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-default" title="Supprimer">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {filteredTemplates.length === 0 && (
                          <div className="p-4 text-center text-slate-400 text-[10px] italic">
                            {(tplSearch || tplFilterPhase) ? 'Aucun résultat' : 'Aucune tâche type.'}
                            {!tplSearch && !tplFilterPhase && (
                              <button onClick={() => setEditingTplIdx(-1)} className="block mx-auto mt-1 text-emerald-500 hover:underline cursor-default font-medium not-italic">
                                Créer une tâche type
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    }}
                  </Droppable>
                </DragDropContext>

                {/* Sous-modale ajout/modification */}
                <TacheTypeEditModal
                  isOpen={editingTplIdx !== null}
                  tache={editingTplIdx !== null && editingTplIdx >= 0 ? templates[editingTplIdx] : null}
                  phases={draft.phases}
                  onSave={(data) => { saveTemplate(editingTplIdx, data); setEditingTplIdx(null); }}
                  onClose={() => setEditingTplIdx(null)}
                />
              </div>
            ) : (
              <div className="shrink-0 flex items-start pt-2 px-1">
                <button onClick={() => setTemplatesOpen(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-default" title="Tâches types">
                  <PanelLeftOpen size={16} />
                </button>
              </div>
            )}

            {/* ── Contenu principal style ProjectView ─── */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
              {/* Header colonnes — sticky */}
              {(() => {
                const catColW = assigneeKeys && assigneeKeys.length > 2 ? 'w-11' : assigneeKeys && assigneeKeys.length > 1 ? 'w-12' : 'w-14';
                const rateUnit = uniteTemps;
                return (
                  <div className="sticky top-0 z-10 bg-white border border-slate-200 rounded-t-xl shadow-sm">
                      {/* Ligne 1 : en-têtes assignee (mode groupement uniquement) */}
                      {assigneeKeys && assigneeKeys.length > 1 && (
                        <div className="flex items-center px-4 py-1.5 bg-gradient-to-r from-slate-100 to-slate-50">
                          <div className="w-8 shrink-0" />
                          <div className="flex-1 min-w-0 px-2" />
                          {assigneeKeys.map((aKey, ai) => {
                            const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey === 'notreEntreprise' ? COTRAITANT_COLORS[0] : (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]);
                            const name = getAssigneeName(aKey, draft);
                            return (
                              <div key={aKey} className={`flex items-center justify-center gap-1 px-1 ${color.bg} rounded-t-lg border-t border-x ${color.border}`}
                                style={{ width: `${cats.length * (assigneeKeys.length > 2 ? 44 : assigneeKeys.length > 1 ? 48 : 56)}px` }}>
                                <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                <span className={`text-[8px] font-bold ${color.text} truncate`}>{name}</span>
                              </div>
                            );
                          })}
                          <div className="w-20 shrink-0" />
                          <div className="w-14 shrink-0" />
                          <div className="w-14 shrink-0" />
                        </div>
                      )}
                      {/* Ligne 2 : bouton phase + labels catégories */}
                      <div className="flex items-end px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50">
                        <div className="w-8 shrink-0" />
                        <div className="flex-1 min-w-0 px-2">
                          <div className="relative inline-block">
                            <button onClick={() => setShowPhaseMenu(!showPhaseMenu)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold hover:bg-emerald-100 border border-emerald-200 transition-all cursor-default">
                              <Plus size={12} />Ajouter une phase
                            </button>
                            {showPhaseMenu && (
                              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 min-w-[240px]">
                                {(draft.phases || PHASES_LOI_MOP).filter(p => !p.actif).map(p => (
                                  <button key={p.id} onClick={() => { togglePhase(p.id); setShowPhaseMenu(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-default">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{p.code}</span>
                                    <span>{p.label}</span>
                                  </button>
                                ))}
                                {(draft.phases || PHASES_LOI_MOP).filter(p => !p.actif).length === 0 && (
                                  <p className="px-3 py-2 text-[10px] text-slate-400 italic">Toutes les phases sont actives</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {(assigneeKeys && assigneeKeys.length > 1 ? assigneeKeys : [null]).map(aKey => {
                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey === 'notreEntreprise' ? COTRAITANT_COLORS[0] : aKey ? (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]) : null;
                          const memberCats = aKey ? getCategoriesForAssignee(draft, aKey) : cats;
                          return memberCats.map(cat => (
                            <div key={`${aKey || 'solo'}-${cat.id}`} className={`${catColW} shrink-0 text-center px-0.5`} title={`${cat.label} — ${parseFloat(cat.tauxHoraire) || 0} €/h`}>
                              <div className={`text-[8px] font-bold uppercase ${color ? color.text : 'text-slate-500'}`}>{cat.label.slice(0, 6)}</div>
                              <div className="text-[7px] text-slate-400">{rateUnit === 'j' ? `${Math.round(parseFloat(cat.tauxHoraire) * H_PAR_JOUR)}€` : `${parseFloat(parseFloat(cat.tauxHoraire).toFixed(0))}€`}</div>
                            </div>
                          ));
                        })}
                        <div className="w-20 shrink-0 text-right px-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Total</span></div>
                        <div className="w-14 shrink-0 text-right px-2"><span className="text-[9px] font-bold text-slate-500 uppercase">%</span></div>
                        <div className="w-14 shrink-0" />
                      </div>
                    </div>
                );
              })()}
              <div className="bg-white border-x border-b border-slate-200 rounded-b-xl shadow-sm">
                {/* DragDropContext */}
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="root" type="PHASE">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="py-3 space-y-4">
                        {activePhases.map((phase, phaseIdx) => {
                          const phaseTaches = tachesByPhase[phase.id] || [];
                          const phaseTotHon = assigneeKeys
                            ? phaseTaches.reduce((s, t) => s + tacheTotalBudget(t, catsMap || cats, assigneeKeys), 0)
                            : phaseTaches.reduce((s, t) => s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
                          const phaseBudgetByA = assigneeKeys && assigneeKeys.length > 1 ? phaseBudgetByAssignee(phaseTaches, phase.id, catsMap || cats, assigneeKeys) : null;
                          return (
                            <Draggable key={phase.id} draggableId={`phase:${phase.id}`} index={phaseIdx}>
                              {(provPhase, snapPhase) => (
                                <div ref={provPhase.innerRef} {...provPhase.draggableProps}
                                  className={`overflow-hidden transition-all duration-200 ${selectedPhaseId === phase.id ? 'ring-2 ring-emerald-400/50' : ''} ${snapPhase.isDragging ? 'shadow-2xl z-50 ring-4 ring-emerald-500/20 rotate-1' : ''} bg-white`}>
                                  {/* Phase header dark — aligné sur les colonnes */}
                                  {(() => {
                                    const catColW = assigneeKeys && assigneeKeys.length > 2 ? 'w-11' : assigneeKeys && assigneeKeys.length > 1 ? 'w-12' : 'w-14';
                                    return (
                                      <div className={`flex items-center px-4 py-3 transition-colors duration-300 ${selectedPhaseId === phase.id ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}
                                        onClick={() => setSelectedPhaseId(phase.id)}>
                                        {/* Drag handle */}
                                        <div {...provPhase.dragHandleProps} className="w-8 flex justify-center shrink-0 text-white/40 hover:text-white cursor-grab active:cursor-grabbing">
                                          <GripVertical size={16} />
                                        </div>
                                        {/* Label phase */}
                                        <div className="flex-1 min-w-0 px-2 flex items-center gap-2">
                                          <span className="w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-black bg-white/20 text-white shrink-0">{phaseIdx + 1}</span>
                                          <span className="text-[10px] font-bold text-emerald-400 bg-white/10 px-2 py-0.5 rounded shrink-0">{phase.code}</span>
                                          <span className="text-[11px] font-black uppercase tracking-widest truncate">{phase.label}</span>
                                        </div>
                                        {/* Pastilles par assignee — centrées sur les colonnes catégories */}
                                        {(assigneeKeys && assigneeKeys.length > 1 ? assigneeKeys : [null]).map((aKey, aIdx) => {
                                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey === 'notreEntreprise' ? COTRAITANT_COLORS[0] : aKey ? (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]) : null;
                                          const groupW = cats.length * (assigneeKeys && assigneeKeys.length > 2 ? 44 : assigneeKeys && assigneeKeys.length > 1 ? 48 : 56);
                                          const aTotal = phaseBudgetByA ? (phaseBudgetByA[aKey] || 0) : null;

                                          if (!aKey) {
                                            // Mode seul : afficher heures par cat
                                            return cats.map(cat => {
                                              const tot = phaseTaches.reduce((s, t) => s + (parseFloat(t.temps?.[cat.id]) || 0), 0);
                                              const disp = tot > 0 ? (uniteTemps === 'j' ? `${parseFloat((tot / H_PAR_JOUR).toFixed(1))}j` : `${fmt(tot)}h`) : '';
                                              return <div key={cat.id} className={`${catColW} text-center px-0.5 shrink-0 text-[10px] font-bold text-white/60`}>{disp}</div>;
                                            });
                                          }

                                          return (
                                            <div key={aKey} className="shrink-0 flex items-center justify-center" style={{ width: `${groupW}px` }}>
                                              {aTotal > 0 && (
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                                                  {fmtE(aTotal)}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {/* Total — aligné col total */}
                                        <div className="w-20 text-right px-1 shrink-0">
                                          <span className="font-mono font-black text-xs text-white">{fmtE(phaseTotHon)}</span>
                                        </div>
                                        {/* % */}
                                        <div className="w-14 text-right px-2 shrink-0">
                                          <span className="text-[10px] text-emerald-400 font-bold">{grandTotalHon > 0 && phaseTotHon > 0 ? `${(phaseTotHon / grandTotalHon * 100).toFixed(1)}%` : ''}</span>
                                        </div>
                                        {/* Actions — aligné col delete */}
                                        <div className="w-14 flex justify-center shrink-0">
                                          <div className="flex gap-0.5">
                                            <button onClick={(e) => { e.stopPropagation(); addTache(phase.id); }} className="p-1 rounded-md hover:bg-white/20 text-white" title="Ajouter une tâche">
                                              <Plus size={14} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); removePhase(phase.id); }} className="p-1 text-white/30 hover:text-red-400" title="Retirer la phase">
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Tâches (droppable) */}
                                  <Droppable droppableId={phase.id} type="TACHE">
                                    {(provItems, snapItems) => (
                                      <div ref={provItems.innerRef} {...provItems.droppableProps}
                                        className={`min-h-[40px] transition-colors ${snapItems.isDraggingOver ? 'bg-emerald-50/50' : 'bg-white'}`}>
                                        {phaseTaches.map((t, tIdx) => {
                                          const catColW = assigneeKeys && assigneeKeys.length > 2 ? 'w-11' : assigneeKeys && assigneeKeys.length > 1 ? 'w-12' : 'w-14';
                                          const tBudget = assigneeKeys
                                            ? tacheTotalBudget(t, catsMap || cats, assigneeKeys)
                                            : cats.reduce((s, c) => s + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0);
                                          return (
                                            <Draggable key={t.id} draggableId={t.id} index={tIdx}>
                                              {(provT, snapT) => (
                                                <div ref={provT.innerRef} {...provT.draggableProps}
                                                  className={`flex items-center border-b border-slate-100 px-4 py-1 transition-colors hover:bg-emerald-50/30 group ${snapT.isDragging ? 'shadow-lg z-50 rotate-1 scale-[1.01] bg-white' : ''}`}>
                                                  {/* Drag handle */}
                                                  <div {...provT.dragHandleProps} className="w-8 flex justify-center shrink-0 text-slate-300 hover:text-emerald-500 cursor-grab active:cursor-grabbing">
                                                    <GripVertical size={14} />
                                                  </div>
                                                  {/* Désignation */}
                                                  <div className="flex-1 px-2 min-w-0">
                                                    <input className="w-full bg-transparent text-[11px] font-semibold text-slate-700 uppercase placeholder-slate-300 outline-none border-b border-transparent focus:border-emerald-300 transition-all"
                                                      value={t.label} onChange={handleTacheLabelChange(t.id)} placeholder="Description de la tâche…" />
                                                  </div>
                                                  {/* Heures par cat — groupées par assignee si mode groupement */}
                                                  {(assigneeKeys && assigneeKeys.length > 1 ? assigneeKeys : [null]).map((aKey, aIdx) => {
                                                    const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey === 'notreEntreprise' ? COTRAITANT_COLORS[0] : aKey ? (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]) : null;
                                                    const tempsData = aKey
                                                      ? (isNestedTemps(t.temps, catIds) ? (t.temps?.[aKey] || {}) : (aKey === 'mandataire' ? (t.temps || {}) : {}))
                                                      : (t.temps || {});
                                                    return (
                                                      <React.Fragment key={aKey || 'solo'}>
                                                        {cats.map(cat => {
                                                          const hRaw = parseFloat(tempsData[cat.id]);
                                                          const dv = !hRaw ? (tempsData[cat.id] || '') : (uniteTemps === 'j' ? parseFloat((hRaw / H_PAR_JOUR).toFixed(2)) : hRaw);
                                                          return (
                                                            <div key={`${aKey || 'solo'}-${cat.id}`} className={`${catColW} px-0.5 shrink-0 ${color ? color.bg : ''}`}>
                                                              <input type="number" min="0" step="0.5"
                                                                className={`w-full border rounded py-0.5 px-1 text-center text-xs font-mono font-bold outline-none transition-colors focus:border-emerald-500 focus:bg-white text-slate-700 tabular-nums ${color ? `bg-white/60 ${color.border}` : 'bg-slate-50 border-slate-200'}`}
                                                                value={dv} onChange={handleTacheTempsChange(t.id, cat.id, aKey)} placeholder="—" />
                                                            </div>
                                                          );
                                                        })}
                                                      </React.Fragment>
                                                    );
                                                  })}
                                                  {/* Total */}
                                                  <div className="w-20 text-right px-1 shrink-0">
                                                    <span className="text-[11px] font-mono font-black text-slate-900">{tBudget > 0 ? fmtE(tBudget) : ''}</span>
                                                  </div>
                                                  {/* % */}
                                                  <div className="w-14 text-right px-2 shrink-0">
                                                    <span className="text-[10px] text-slate-400 tabular-nums">{tBudget > 0 && pctOf(tBudget) ? `${pctOf(tBudget)}%` : ''}</span>
                                                  </div>
                                                  {/* Delete */}
                                                  <div className="w-14 flex justify-center shrink-0">
                                                    <button onClick={() => removeTache(t.id)} className="text-transparent group-hover:text-slate-300 hover:!text-red-500 transition-colors cursor-default">
                                                      <Trash2 size={13} />
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </Draggable>
                                          );
                                        })}
                                        {provItems.placeholder}
                                        {phaseTaches.length === 0 && !snapItems.isDraggingOver && (
                                          <div className="p-6 text-center border-t border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Phase vide</div>
                                        )}
                                      </div>
                                    )}
                                  </Droppable>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                {/* Total général — aligné sur les colonnes */}
                {(() => {
                  const catColW = assigneeKeys && assigneeKeys.length > 2 ? 'w-11' : assigneeKeys && assigneeKeys.length > 1 ? 'w-12' : 'w-14';
                  const grandHoursBA = assigneeKeys && assigneeKeys.length > 1 ? grandHoursByAssignee(taches, catsMap || cats, assigneeKeys) : null;
                  const grandBudgetBA = assigneeKeys && assigneeKeys.length > 1 ? grandTotalByAssignee(taches, catsMap || cats, assigneeKeys) : null;
                  return (
                    <>
                      <div className="flex items-center px-4 py-3 border-t-2 border-slate-300 bg-gradient-to-r from-slate-100 to-white">
                        <div className="w-8 shrink-0" />
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Total général</span>
                        </div>
                        {(assigneeKeys && assigneeKeys.length > 1 ? assigneeKeys : [null]).map((aKey, aIdx) => {
                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey === 'notreEntreprise' ? COTRAITANT_COLORS[0] : aKey ? (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]) : null;
                          return (
                            <React.Fragment key={aKey || 'solo'}>
                              {cats.map(cat => {
                                const tot = grandHoursBA
                                  ? (grandHoursBA[aKey]?.[cat.id] || 0)
                                  : taches.reduce((s, t) => s + (parseFloat(t.temps?.[cat.id]) || 0), 0);
                                const disp = tot > 0 ? (uniteTemps === 'j' ? `${parseFloat((tot / H_PAR_JOUR).toFixed(1))} j` : `${fmt(tot)} h`) : '—';
                                return <div key={`${aKey || 'solo'}-${cat.id}`} className={`${catColW} text-center px-0.5 shrink-0 text-xs font-bold text-emerald-600`}>{disp}</div>;
                              })}
                            </React.Fragment>
                          );
                        })}
                        <div className="w-20 text-right px-1 shrink-0">
                          <span className="text-sm font-black text-emerald-600">{fmtE(grandTotalHon)}</span>
                        </div>
                        <div className="w-14 text-right px-2 shrink-0">
                          <span className="text-xs font-bold text-emerald-500">{pctOf(grandTotalHon) ? `${pctOf(grandTotalHon)}%` : ''}</span>
                        </div>
                        <div className="w-14 shrink-0" />
                      </div>
                      {/* Sous-totaux par assignee — alignés sous les colonnes */}
                      {grandBudgetBA && (
                        <div className="flex items-center px-4 py-2 border-t border-slate-200 bg-slate-50/50">
                          <div className="w-8 shrink-0" />
                          <div className="flex-1 min-w-0 px-2" />
                          {assigneeKeys.map(aKey => {
                            const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey === 'notreEntreprise' ? COTRAITANT_COLORS[0] : (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]);
                            const aTotal = grandBudgetBA[aKey] || 0;
                            const pctA = grandTotalHon > 0 ? (aTotal / grandTotalHon * 100).toFixed(0) : 0;
                            const groupW = cats.length * (assigneeKeys.length > 2 ? 44 : assigneeKeys.length > 1 ? 48 : 56);
                            return (
                              <div key={aKey} className="shrink-0 flex items-center justify-center" style={{ width: `${groupW}px` }}>
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${color.bg} ${color.border}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                  <span className={`text-[9px] font-bold ${color.text}`}>{fmtE(aTotal)}</span>
                                  <span className="text-[8px] text-slate-400">{pctA}%</span>
                                </div>
                              </div>
                            );
                          })}
                          <div className="w-20 shrink-0" />
                          <div className="w-14 shrink-0" />
                          <div className="w-14 shrink-0" />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </section>
        );
      })()}


      {/* ── Totaux ──────────────────────────────────────────────────────────── */}
      {(totalHonHT > 0 || totalHonPctLots > 0) && (() => {
        const marge = parseFloat(draft.marge) || 0;
        const montantMarge = totalHonHT * marge / 100;
        const honAvecMarge = totalHonHT + montantMarge;
        const mtGlobal = parseFloat(draft.montantTravauxGlobal) || 0;
        const tauxGlobal = parseFloat(draft.tauxHonorairesGlobal) || 0;
        const honPctTotal = mtGlobal * tauxGlobal / 100;
        const hasPct = tauxGlobal > 0 && mtGlobal > 0;
        const pctEquiv = mtGlobal > 0 && totalHonHT > 0 ? (totalHonHT / mtGlobal * 100) : null;
        return (
          <div className="rounded-xl bg-gradient-to-r from-slate-100/60 via-white to-slate-100/60 border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 cursor-default hover:bg-slate-50 transition-colors" onClick={() => setTotauxOpen(p => !p)}>
              <div className="flex items-center gap-2">
                {totauxOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Totaux</span>
              </div>
              {!totauxOpen && totalHonHT > 0 && <span className="text-sm font-black text-emerald-600">{fmtE(totalHonHT)}</span>}
            </div>
            {totauxOpen && <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="py-2 px-3 text-left text-[8px] font-bold uppercase tracking-wider text-slate-400 w-24">Méthode</th>
                  {mtGlobal > 0 && <th className="py-2 px-3 text-right text-[8px] font-bold uppercase tracking-wider text-slate-400">Travaux</th>}
                  <th className="py-2 px-3 text-right text-[8px] font-bold uppercase tracking-wider text-slate-400">Hon. HT</th>
                  <th className="py-2 px-3 text-right text-[8px] font-bold uppercase tracking-wider text-slate-400">% tvx</th>
                  <th className="py-2 px-3 text-right text-[8px] font-bold uppercase tracking-wider text-slate-400">TTC</th>
                  {hasPct && totalHonHT > 0 && <th className="py-2 px-3 text-right text-[8px] font-bold uppercase tracking-wider text-slate-400">Écart</th>}
                </tr>
              </thead>
              <tbody>
                {totalHonHT > 0 && (
                  <tr className="border-b border-slate-100 bg-emerald-50/30">
                    <td className="py-2.5 px-3 text-[9px] font-bold text-emerald-600 uppercase">Temps passé</td>
                    {mtGlobal > 0 && <td className="py-2.5 px-3 text-right font-bold text-slate-600">{fmtE(mtGlobal)}</td>}
                    <td className="py-2.5 px-3 text-right font-black text-emerald-600 text-sm">{fmtE(totalHonHT)}{marge > 0 ? <span className="text-[9px] text-emerald-500 ml-1">(+{fmt(marge)}%)</span> : ''}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{pctEquiv !== null ? `${pctEquiv.toFixed(2)} %` : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">{fmtE(honAvecMarge * (1 + tva / 100))}</td>
                    {hasPct && <td />}
                  </tr>
                )}
                {hasPct && (
                  <tr className="bg-indigo-50/30">
                    <td className="py-2.5 px-3 text-[9px] font-bold text-indigo-600 uppercase">% ({fmt(tauxGlobal)}%)</td>
                    {mtGlobal > 0 && <td className="py-2.5 px-3 text-right font-bold text-slate-600">{fmtE(mtGlobal)}</td>}
                    <td className="py-2.5 px-3 text-right font-black text-indigo-600 text-sm">{fmtE(honPctTotal)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-500">{fmt(tauxGlobal)} %</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">{fmtE(honPctTotal * (1 + tva / 100))}</td>
                    {totalHonHT > 0 && <td className={`py-2.5 px-3 text-right font-black ${totalHonHT >= honPctTotal ? 'text-amber-600' : 'text-red-500'}`}>{fmtE(totalHonHT - honPctTotal)}</td>}
                  </tr>
                )}
              </tbody>
            </table>}
          </div>
        );
      })()}
      </div>

      {/* ── Panneau config (droite) ── */}
      <HonorairesConfigPanel
        draft={draft} onChange={onChange}
        configOpen={configOpen} setConfigOpen={setConfigOpen}
        uniteTemps={uniteTemps} setUniteTemps={setUniteTemps}
        cats={cats} isGrp={isGrp} activePhases={activePhases}
      />
    </div>
  );
}
