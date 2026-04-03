// src/views/DevisMoeView.jsx
// Module Devis MOE — Propositions d'honoraires de maîtrise d'œuvre VRD
import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, ArrowLeft, Plus, Trash2, Copy, Search,
  Percent, Clock, ChevronRight, ChevronDown, Save,
  Calculator, AlertTriangle, CheckCircle2, Layers,
  FileText, Loader2, FolderOpen, CloudOff,
  User, Crown, Users, UserPlus,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  BookOpen, RotateCcw, X, GripVertical, Pencil, SlidersHorizontal
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useDevisMoe, PHASES_LOI_MOP, createEmptyLot, createEmptyCotraitant, createEmptyTache, TACHE_TEMPLATES, COTRAITANT_COLORS, MANDATAIRE_COLOR, getCategoriesForAssignee, buildCategoriesMap } from '../hooks/useDevisMoe';
import {
  calcHonByAssignee, getAssigneeName, isNestedTemps, getAssigneeKeys,
  tacheBudgetByAssignee, tacheTotalBudget, phaseBudgetByAssignee,
  grandTotalByAssignee, phaseHoursByAssignee, grandHoursByAssignee
} from '../utils/devisMoeCalculations';
import { formatPrice, generateId } from '../utils/helpers';
import {
  RibbonGroup, RibbonBtnLarge, RibbonHeader, RibbonContainer, RibbonSpacer
} from '../components/common/RibbonParts';

// ─── Helpers calcul ──────────────────────────────────────────────────────────
const pct = (lot, tauxGlobal) =>
  (parseFloat(lot.montantTravauxHT) || 0) * (parseFloat(tauxGlobal) || 0) / 100;

const honPhasePct = (honLot, repartition, phaseId) => {
  const r = (repartition || []).find(r => r.phaseId === phaseId);
  return honLot * (parseFloat(r?.pourcentage) || 0) / 100;
};

const honPhaseTemps = (lot, phaseId, categories) => {
  const pt = (lot.phasesTemps || []).find(p => p.phaseId === phaseId);
  if (!pt) return 0;
  if (pt.sousTaches?.length > 0) {
    return pt.sousTaches.reduce((total, st) =>
      total + (categories || []).reduce((s, c) =>
        s + (parseFloat(st.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
  }
  return (categories || []).reduce((s, c) =>
    s + (parseFloat(pt.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0);
};

const newSousTache = (categories) => ({
  id: generateId(),
  description: '',
  temps: Object.fromEntries((categories || []).map(c => [c.id, ''])),
});

const totalRep = (repartition) =>
  (repartition || []).reduce((s, r) => s + (parseFloat(r.pourcentage) || 0), 0);

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0);
const fmtE = (n) => formatPrice(n);

// ─── Styles inputs (thème clair) ─────────────────────────────────────────────
const iCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all duration-200';
const iSmCls = 'w-full px-2 py-1.5 text-center rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100/60 transition-all duration-200';

// ─── Card section ─────────────────────────────────────────────────────────────
const Card = ({ title, children, accent }) => (
  <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
    <div className="px-5 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <div className="flex items-center gap-2">
        <div className={`w-1 h-3.5 rounded-full ${accent || 'bg-emerald-400'}`} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TAB — INFORMATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function InfoTab({ draft, onChange }) {
  const set = (path, val) => {
    const [k1, k2] = path.split('.');
    if (!k2) return onChange({ ...draft, [k1]: val });
    onChange({ ...draft, [k1]: { ...draft[k1], [k2]: val } });
  };

  const moeType = draft.moeType || 'seul';
  const cotraitants = draft.cotraitants || [];

  const setMoeType = (newType) => {
    const updates = { ...draft, moeType: newType };
    const catIds = (draft.categories || []).map(c => c.id);
    if (newType === 'seul' && cotraitants.length > 0) {
      updates.cotraitants = [];
      updates.lots = (draft.lots || []).map(l => ({ ...l, assigneA: 'mandataire' }));
    }
    if (newType === 'cotraitant' && moeType !== 'cotraitant') {
      updates.cotraitants = [];
      updates.lots = (draft.lots || []).map(l => ({ ...l, assigneA: 'mandataire' }));
    }
    if ((moeType === 'cotraitant') && newType !== 'cotraitant') {
      updates.mandataire = { ...(draft.notreEntreprise || draft.mandataire) };
    }
    // Migration temps passé : flat → nested quand on passe en mandataire
    if (newType === 'mandataire' && moeType !== 'mandataire') {
      updates.taches = (draft.taches || []).map(t => {
        if (!isNestedTemps(t.temps, catIds)) {
          return { ...t, temps: { mandataire: { ...(t.temps || {}) } } };
        }
        return t;
      });
      // Initialiser categoriesParMembre avec les catégories globales pour le mandataire
      if (!draft.categoriesParMembre?.mandataire) {
        updates.categoriesParMembre = { ...(draft.categoriesParMembre || {}), mandataire: (draft.categories || []).map(c => ({ ...c })) };
      }
    }
    // Migration temps passé : nested → flat quand on quitte mandataire
    if (newType !== 'mandataire' && moeType === 'mandataire') {
      updates.taches = (draft.taches || []).map(t => {
        if (isNestedTemps(t.temps, catIds)) {
          return { ...t, temps: { ...(t.temps?.mandataire || {}) } };
        }
        return t;
      });
    }
    onChange(updates);
  };

  const addCotraitant = () => {
    if (cotraitants.length >= 3) return;
    const newCot = createEmptyCotraitant();
    const catIds = (draft.categories || []).map(c => c.id);
    // Ajouter la clé du nouveau cotraitant dans chaque tâche existante (format nested)
    const updatedTaches = (draft.taches || []).map(t => {
      if (isNestedTemps(t.temps, catIds)) {
        return { ...t, temps: { ...t.temps, [newCot.id]: {} } };
      }
      return t;
    });
    // Copier les catégories du mandataire comme base pour le nouveau co-traitant
    const mandCats = getCategoriesForAssignee(draft, 'mandataire');
    const newCatsParMembre = { ...(draft.categoriesParMembre || {}), [newCot.id]: mandCats.map(c => ({ ...c })) };
    onChange({ ...draft, cotraitants: [...cotraitants, newCot], taches: updatedTaches, categoriesParMembre: newCatsParMembre });
  };

  const removeCotraitant = (id) => {
    const catIds = (draft.categories || []).map(c => c.id);
    // Retirer la clé du cotraitant de chaque tâche
    const updatedTaches = (draft.taches || []).map(t => {
      if (isNestedTemps(t.temps, catIds) && t.temps[id]) {
        const { [id]: _, ...rest } = t.temps;
        return { ...t, temps: rest };
      }
      return t;
    });
    // Retirer les catégories du cotraitant
    const { [id]: _removedCats, ...restCatsParMembre } = (draft.categoriesParMembre || {});
    onChange({
      ...draft,
      cotraitants: cotraitants.filter(c => c.id !== id),
      lots: (draft.lots || []).map(l => l.assigneA === id ? { ...l, assigneA: 'mandataire' } : l),
      taches: updatedTaches,
      categoriesParMembre: restCatsParMembre,
    });
  };

  const updateCotraitant = (id, field, val) => {
    onChange({ ...draft, cotraitants: cotraitants.map(c => c.id === id ? { ...c, [field]: val } : c) });
  };

  const EntrepriseCard = ({ title, data, dataKey, badge, accent }) => (
    <Card title={title} accent={accent}>
      {badge && <div className="mb-3">{badge}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Raison sociale</label>
          <input className={iCls} value={data?.nom || ''} onChange={e => onChange({ ...draft, [dataKey]: { ...data, nom: e.target.value } })} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">SIRET</label>
          <input className={iCls} value={data?.siret || ''} onChange={e => onChange({ ...draft, [dataKey]: { ...data, siret: e.target.value } })} />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Adresse</label>
          <textarea className={`${iCls} resize-none`} rows={2} value={data?.adresse || ''} onChange={e => onChange({ ...draft, [dataKey]: { ...data, adresse: e.target.value } })} />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <Card title="Identification">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Intitulé du devis *</label>
            <input className={iCls} value={draft.nom || ''} onChange={e => set('nom', e.target.value)} placeholder="Ex: Devis MOE — Route Principale" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Référence</label>
            <input className={iCls} value={draft.reference || ''} onChange={e => set('reference', e.target.value)} placeholder="D-MOE-2024-001" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Date</label>
            <input type="date" className={iCls} value={draft.dateDevis || ''} onChange={e => set('dateDevis', e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">TVA (%)</label>
            <input type="number" className={iCls} value={draft.tva ?? 20} onChange={e => set('tva', e.target.value)} min="0" max="100" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Montant travaux HT (€)</label>
            <input type="number" className={iCls} value={draft.montantTravauxGlobal || ''} onChange={e => set('montantTravauxGlobal', e.target.value)} min="0" placeholder="500 000" />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Objet de la mission</label>
            <textarea className={`${iCls} resize-none`} rows={3} value={draft.objet || ''} onChange={e => set('objet', e.target.value)} placeholder="Décrire la mission de maîtrise d'œuvre…" />
          </div>
        </div>
      </Card>

      <Card title="Maître d'ouvrage">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Désignation</label>
            <input className={iCls} value={draft.client?.designation || ''} onChange={e => set('client.designation', e.target.value)} placeholder="Nom de la collectivité / maître d'ouvrage" />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Adresse</label>
            <input className={iCls} value={draft.client?.adresse || ''} onChange={e => set('client.adresse', e.target.value)} placeholder="Adresse" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Code postal</label>
            <input className={iCls} value={draft.client?.codePostal || ''} onChange={e => set('client.codePostal', e.target.value)} placeholder="00000" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Ville</label>
            <input className={iCls} value={draft.client?.ville || ''} onChange={e => set('client.ville', e.target.value)} placeholder="Ville" />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Contact</label>
            <input className={iCls} value={draft.client?.contact || ''} onChange={e => set('client.contact', e.target.value)} placeholder="Nom du contact" />
          </div>
        </div>
      </Card>

      {/* ── Type de MOE ──────────────────────────────────────────────────────── */}
      <Card title="Type de maîtrise d'œuvre" accent="bg-violet-400">
        <div className="flex gap-3">
          {[
            { v: 'seul',        Icon: User,  label: 'Seul',        desc: 'Vous êtes le seul maître d\'œuvre' },
            { v: 'mandataire',  Icon: Crown, label: 'Mandataire',  desc: 'Vous dirigez un groupement de MOE' },
            { v: 'cotraitant',  Icon: Users, label: 'Co-traitant', desc: 'Vous êtes co-traitant dans un groupement' },
          ].map(({ v, Icon, label, desc }) => (
            <button key={v} onClick={() => setMoeType(v)}
              className={`flex-1 flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 cursor-default ${
                moeType === v
                  ? 'bg-indigo-50/80 border-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)]'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-sm'
              }`}>
              <div className={`mt-0.5 p-2 rounded-lg shrink-0 transition-transform duration-200 ${moeType === v ? 'bg-indigo-100 text-indigo-600 scale-110' : 'bg-slate-100 text-slate-400'}`}>
                <Icon size={14} />
              </div>
              <div>
                <p className={`text-xs font-semibold ${moeType === v ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Entreprises selon moeType ─────────────────────────────────────────── */}
      {moeType === 'seul' && (
        <EntrepriseCard title="MOE — Mandataire" data={draft.mandataire} dataKey="mandataire" />
      )}

      {moeType === 'mandataire' && (
        <>
          <EntrepriseCard title="MOE — Mandataire du groupement" data={draft.mandataire} dataKey="mandataire" accent="bg-amber-400" />

          <Card title="Co-traitants" accent="bg-blue-400">
            <div className="space-y-4">
              {cotraitants.map((cot, idx) => {
                const color = COTRAITANT_COLORS[idx] || COTRAITANT_COLORS[0];
                return (
                  <div key={cot.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${color.text}`}>
                        Co-traitant {idx + 1}
                      </span>
                      <div className="flex-1 h-px bg-slate-200 ml-2" />
                      <button onClick={() => removeCotraitant(cot.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-400/60 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-default">
                        <Trash2 size={11} /> Retirer
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Raison sociale</label>
                        <input className={iCls} value={cot.nom || ''} onChange={e => updateCotraitant(cot.id, 'nom', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">SIRET</label>
                        <input className={iCls} value={cot.siret || ''} onChange={e => updateCotraitant(cot.id, 'siret', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Adresse</label>
                        <textarea className={`${iCls} resize-none`} rows={2} value={cot.adresse || ''} onChange={e => updateCotraitant(cot.id, 'adresse', e.target.value)} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {cotraitants.length < 3 && (
                <button onClick={addCotraitant}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-400/60 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-default">
                  <UserPlus size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Ajouter un co-traitant ({cotraitants.length}/3)
                  </span>
                </button>
              )}

              {cotraitants.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-[9px] font-bold text-blue-400/60 uppercase tracking-wider">Groupement :</span>
                  <span className="text-[10px] text-slate-500">
                    {draft.mandataire?.nom || '(mandataire)'}{' '}
                    {cotraitants.map((c, i) => `+ ${c.nom || `(co-traitant ${i + 1})`}`).join(' ')}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {moeType === 'cotraitant' && (
        <>
          <EntrepriseCard title="Mandataire du groupement" data={draft.mandataire} dataKey="mandataire" accent="bg-amber-400" />
          <EntrepriseCard title="Notre entreprise (co-traitant)" data={draft.notreEntreprise} dataKey="notreEntreprise" accent="bg-blue-400" />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BARRE CONFIG COLLAPSIBLE
// ═══════════════════════════════════════════════════════════════════════════════

function ConfigBar({ draft, onChange, isPct, cats, activePhases, uniteTemps, setUniteTemps }) {
  const [open, setOpen] = useState(false);
  const H_PAR_JOUR = 7;

  // Resume compact
  const methodeLabel = isPct ? '%' : 'Temps passé';
  const margeLabel = draft.marge ? `${draft.marge}%` : '0%';

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Ligne resume cliquable */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-default text-left">
        <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 shrink-0">
          <span className={`px-2.5 py-1 rounded text-xs font-bold ${isPct ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
            {isPct ? <Percent size={12} className="inline" /> : <Clock size={12} className="inline" />}
            {' '}{methodeLabel}
          </span>
        </div>
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        <span className="text-xs font-bold text-slate-500 shrink-0">{activePhases.length} phases</span>
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        {isPct ? (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
            {draft.tauxHonorairesGlobal || '—'} %
          </span>
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            {cats.map(c => {
              const tj = ((parseFloat(c.tauxHoraire) || 0) * H_PAR_JOUR);
              return (
                <span key={c.id} className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                  {c.label.split(' ')[0]} <span className="font-mono">{tj ? tj.toFixed(2) : '—'}</span> €/j
                </span>
              );
            })}
          </div>
        )}
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          Marge {margeLabel}
        </span>
        <ChevronDown size={14} className={`text-slate-300 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Contenu depliable */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
          {/* Ligne 1 : Methode + Phases */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
              {[
                { v: 'pourcentage', Icon: Percent, label: '%' },
                { v: 'temps_passe', Icon: Clock,   label: 'Temps' },
              ].map(({ v, Icon, label }) => (
                <button key={v} onClick={() => onChange({ ...draft, methode: v })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-150 cursor-default ${
                    draft.methode === v
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 shrink-0" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">{activePhases.length} phases</span>
          </div>

          {/* Ligne 2 : Taux + Travaux HT + Marge */}
          <div className="flex items-center gap-3 flex-wrap">
            {isPct ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Taux</span>
                <input type="number" min="0" max="100" step="0.1"
                  className="w-16 px-2 py-1 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                  value={draft.tauxHonorairesGlobal || ''}
                  onChange={e => onChange({ ...draft, tauxHonorairesGlobal: e.target.value })}
                  placeholder="5" />
                <span className="text-[10px] text-slate-400">%</span>
              </div>
            ) : (
              <>
                {cats.map((cat, i) => {
                  const tauxH = parseFloat(cat.tauxHoraire) || 0;
                  const displayVal = uniteTemps === 'j' ? parseFloat((tauxH * H_PAR_JOUR).toFixed(2)) || '' : (tauxH ? parseFloat(tauxH.toFixed(2)) : '');
                  return (
                    <div key={cat.id} className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{cat.label.split(' ')[0]}</span>
                      <input type="number" min="0"
                        className="w-14 px-1.5 py-1 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                        value={displayVal}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          const newTauxH = isNaN(v) ? '' : String(uniteTemps === 'j' ? v / H_PAR_JOUR : v);
                          const c = [...cats]; c[i] = { ...cat, tauxHoraire: newTauxH }; onChange({ ...draft, categories: c });
                        }} />
                      <span className="text-[10px] text-slate-400">€/{uniteTemps}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 border border-slate-200 shrink-0">
                  {['h', 'j'].map(u => (
                    <button key={u} onClick={() => setUniteTemps(u)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-default ${
                        uniteTemps === u ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
                      }`}>{u}</button>
                  ))}
                </div>
              </>
            )}

            <div className="w-px h-5 bg-slate-200 shrink-0" />

            {!isPct && (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Travaux</span>
                  <input type="number" min="0"
                    className="w-24 px-2 py-1 text-right text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                    value={draft.montantTravauxGlobal || ''}
                    onChange={e => onChange({ ...draft, montantTravauxGlobal: e.target.value })}
                    placeholder="500 000" />
                  <span className="text-[10px] text-slate-400">€</span>
                </div>
                <div className="w-px h-5 bg-slate-200 shrink-0" />
              </>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Marge</span>
              <input type="number" min="0" max="100" step="0.5"
                className="w-14 px-2 py-1 text-center text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                value={draft.marge || ''}
                onChange={e => onChange({ ...draft, marge: e.target.value })}
                placeholder="0" />
              <span className="text-[10px] text-slate-400">%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB — HONORAIRES
// ═══════════════════════════════════════════════════════════════════════════════
function HonorairesTab({ draft, onChange, templatesOpen, setTemplatesOpen, configOpen, setConfigOpen }) {
  const [expandedLots, setExpandedLots] = useState(new Set());
  const [uniteTemps, setUniteTemps] = useState('j');
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [editingTplIdx, setEditingTplIdx] = useState(null); // null=closed, -1=add, 0+=edit
  const [tplSearch, setTplSearch] = useState('');
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
  const isGrp = draft.moeType === 'mandataire';
  const catsMap = isGrp ? buildCategoriesMap(draft) : null;
  const totalTravauxHT = lots.reduce((s, l) => s + (parseFloat(l.montantTravauxHT) || 0), 0);
  const totalHonTaches = !isPct ? (() => {
    const taches = draft.taches || [];
    if (isGrp && catsMap) {
      const aKeys = getAssigneeKeys(draft);
      return taches.reduce((s, t) => s + tacheTotalBudget(t, catsMap, aKeys), 0);
    }
    return taches.reduce((s, t) =>
      s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
  })() : 0;
  const totalHonHT = isPct
    ? lots.reduce((s, l) => s + pct(l, draft.tauxHonorairesGlobal), 0)
    : totalHonTaches;

  const SectionLabel = ({ children }) => (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">{children}</h3>
  );

  return (
    <div className="flex gap-0 max-w-full h-full">

      {/* ── Contenu principal ── */}
      <div className={`flex-1 min-w-0 ${isPct ? 'overflow-y-auto px-4 pb-6 space-y-4' : 'flex flex-col overflow-hidden'}`}>

      {/* ── Mode temps passé — style ProjectView ──────────────────────────── */}
      {!isPct && (() => {
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

        const isGrpTemps = draft.moeType === 'mandataire' && (draft.cotraitants || []).length >= 0 && !isPct;
        const assigneeKeys = isGrpTemps && draft.moeType === 'mandataire' ? getAssigneeKeys(draft) : null;
        const catIds = cats.map(c => c.id);

        const addTache = (phaseId, label = '') => {
          const t = createEmptyTache(phaseId, label, assigneeKeys);
          onChange({ ...draft, taches: [...taches, t] });
        };
        const removeTache = (id) => onChange({ ...draft, taches: taches.filter(t => t.id !== id) });
        const updateTacheLabel = (id, label) => onChange({ ...draft, taches: taches.map(t => t.id === id ? { ...t, label } : t) });
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
                      const filteredTemplates = q ? templates.map((tpl, idx) => ({ tpl, idx })).filter(({ tpl }) => normalize(tpl.label).includes(q)) : templates.map((tpl, idx) => ({ tpl, idx }));
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
                                  onClick={() => { if (selectedPhaseId) addTache(selectedPhaseId, tpl.label); }}
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
                            {tplSearch ? 'Aucun résultat' : 'Aucune tâche type.'}
                            {!tplSearch && (
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
                          <div className="w-14 shrink-0" />
                          <div className="flex-1 min-w-0 px-2" />
                          {assigneeKeys.map((aKey, ai) => {
                            const ci = (draft.cotraitants || []).findIndex(c => c.id === aKey);
                            const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
                            const name = aKey === 'mandataire' ? (draft.mandataire?.nom || 'Mandataire') : ((draft.cotraitants || []).find(c => c.id === aKey)?.nom || `Co-traitant ${ci + 1}`);
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
                        <div className="w-14 shrink-0" />
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
                          const ci = aKey ? (draft.cotraitants || []).findIndex(c => c.id === aKey) : -1;
                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey ? (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]) : null;
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
                      <div ref={provided.innerRef} {...provided.droppableProps} className="p-3 space-y-4">
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
                                  className={`rounded-xl border overflow-hidden transition-all duration-200 ${selectedPhaseId === phase.id ? 'ring-4 ring-emerald-50/50 border-emerald-500' : ''} ${snapPhase.isDragging ? 'shadow-2xl z-50 ring-4 ring-emerald-500/20 rotate-1' : 'hover:shadow-md'} border-slate-200 bg-white`}>
                                  {/* Phase header dark — aligné sur les colonnes */}
                                  {(() => {
                                    const phCatColW = assigneeKeys && assigneeKeys.length > 2 ? 'w-14' : assigneeKeys && assigneeKeys.length > 1 ? 'w-16' : 'w-20';
                                    const phHoursByA = assigneeKeys && assigneeKeys.length > 1 ? phaseHoursByAssignee(phaseTaches, phase.id, catsMap || cats, assigneeKeys) : null;
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
                                          const ci = aKey ? (draft.cotraitants || []).findIndex(c => c.id === aKey) : -1;
                                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey ? (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]) : null;
                                          const groupW = cats.length * (assigneeKeys && assigneeKeys.length > 2 ? 44 : assigneeKeys && assigneeKeys.length > 1 ? 48 : 56);
                                          const aTotal = phaseBudgetByA ? (phaseBudgetByA[aKey] || 0) : null;

                                          if (!aKey) {
                                            // Mode seul : afficher heures par cat
                                            return cats.map(cat => {
                                              const tot = phaseTaches.reduce((s, t) => s + (parseFloat(t.temps?.[cat.id]) || 0), 0);
                                              const disp = tot > 0 ? (uniteTemps === 'j' ? `${parseFloat((tot / H_PAR_JOUR).toFixed(1))}j` : `${fmt(tot)}h`) : '';
                                              return <div key={cat.id} className="w-20 text-center px-1 shrink-0 text-[10px] font-bold text-white/60">{disp}</div>;
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
                                            ? tacheTotalBudget(t, cats, assigneeKeys)
                                            : cats.reduce((s, c) => s + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0);
                                          return (
                                            <Draggable key={t.id} draggableId={t.id} index={tIdx}>
                                              {(provT, snapT) => (
                                                <div ref={provT.innerRef} {...provT.draggableProps}
                                                  className={`flex items-center border-b border-slate-100 py-1 transition-colors hover:bg-emerald-50/30 group ${snapT.isDragging ? 'shadow-lg z-50 rotate-1 scale-[1.01] bg-white' : ''}`}>
                                                  {/* Drag handle */}
                                                  <div {...provT.dragHandleProps} className="w-8 flex justify-center shrink-0 text-slate-300 hover:text-emerald-500 cursor-grab active:cursor-grabbing">
                                                    <GripVertical size={14} />
                                                  </div>
                                                  {/* Désignation */}
                                                  <div className="flex-1 px-2 min-w-0">
                                                    <input className="w-full bg-transparent text-[11px] font-semibold text-slate-700 uppercase placeholder-slate-300 outline-none border-b border-transparent focus:border-emerald-300 transition-all"
                                                      value={t.label} onChange={e => updateTacheLabel(t.id, e.target.value)} placeholder="Description de la tâche…" />
                                                  </div>
                                                  {/* Heures par cat — groupées par assignee si mode groupement */}
                                                  {(assigneeKeys && assigneeKeys.length > 1 ? assigneeKeys : [null]).map((aKey, aIdx) => {
                                                    const ci = aKey ? (draft.cotraitants || []).findIndex(c => c.id === aKey) : -1;
                                                    const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey ? (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]) : null;
                                                    const tempsData = aKey
                                                      ? (isNestedTemps(t.temps, catIds) ? (t.temps?.[aKey] || {}) : (aKey === 'mandataire' ? (t.temps || {}) : {}))
                                                      : (t.temps || {});
                                                    return (
                                                      <React.Fragment key={aKey || 'solo'}>
                                                        {aKey && aIdx > 0 && <div className={`w-px self-stretch ${color?.border || 'border-slate-200'} bg-slate-200`} />}
                                                        {cats.map(cat => {
                                                          const hRaw = parseFloat(tempsData[cat.id]);
                                                          const dv = !hRaw ? (tempsData[cat.id] || '') : (uniteTemps === 'j' ? parseFloat((hRaw / H_PAR_JOUR).toFixed(2)) : hRaw);
                                                          return (
                                                            <div key={`${aKey || 'solo'}-${cat.id}`} className={`${catColW} px-0.5 shrink-0 ${color ? color.bg : ''}`}>
                                                              <input type="number" min="0" step="0.5"
                                                                className={`w-full border rounded py-0.5 px-1 text-right text-xs font-mono font-bold outline-none transition-colors focus:border-emerald-500 focus:bg-white text-slate-700 tabular-nums ${color ? `bg-white/60 ${color.border}` : 'bg-slate-50 border-slate-200'}`}
                                                                value={dv} onChange={e => { const v = parseFloat(e.target.value); updateTacheTemps(t.id, cat.id, isNaN(v) ? '' : String(uniteTemps === 'j' ? v * H_PAR_JOUR : v), aKey); }} placeholder="—" />
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
                        <div className="w-14 shrink-0" />
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Total général</span>
                        </div>
                        {(assigneeKeys && assigneeKeys.length > 1 ? assigneeKeys : [null]).map((aKey, aIdx) => {
                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey ? (COTRAITANT_COLORS[(draft.cotraitants || []).findIndex(c => c.id === aKey)] || COTRAITANT_COLORS[0]) : null;
                          return (
                            <React.Fragment key={aKey || 'solo'}>
                              {aKey && aIdx > 0 && <div className="w-px self-stretch bg-slate-200" />}
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
                          <div className="w-14 shrink-0" />
                          <div className="flex-1 min-w-0 px-2" />
                          {assigneeKeys.map(aKey => {
                            const ci = (draft.cotraitants || []).findIndex(c => c.id === aKey);
                            const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
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

      {/* ── Lots — mode pourcentage (layout classique) ─────────────────────── */}
      {isPct && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Lots / Tranches de travaux</SectionLabel>
            <button onClick={addLot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 text-[11px] font-medium transition-all -mt-3 shadow-sm cursor-default">
              <Plus size={13} />Ajouter un lot
            </button>
          </div>
          {lots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
              <Layers size={22} className="mb-2 text-slate-300" />
              <p className="text-[11px] font-semibold">Aucun lot défini</p>
              <p className="text-[10px] mt-1 text-slate-400">Cliquez sur "Ajouter un lot" pour commencer</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lots.map((lot, idx) => {
                const isOpen = expandedLots.has(lot.id);
                const honLot = pct(lot, draft.tauxHonorairesGlobal);
                const repTotal = totalRep(lot.repartitionPhases?.filter(r => activePhases.find(p => p.id === r.phaseId)));
                const repOk = Math.abs(repTotal - 100) < 0.01;
                const isGroupement = draft.moeType === 'mandataire' && (draft.cotraitants || []).length > 0;
                const lotAssignee = lot.assigneA || 'mandataire';

                return (
                  <div key={lot.id} className={`border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-300 ${isOpen ? 'border-l-[3px] border-l-indigo-400' : ''}`}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 via-white to-slate-50 cursor-default hover:from-slate-100 hover:via-slate-50 hover:to-slate-100 transition-all duration-200"
                      onClick={() => toggleLot(lot.id)}>
                      {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                      <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                      <input className="flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder-slate-300 outline-none min-w-0"
                        value={lot.designation}
                        onChange={e => { e.stopPropagation(); updateLot(lot.id, 'designation', e.target.value); }}
                        onClick={e => e.stopPropagation()} placeholder="Désignation du lot…" />
                      <div className="flex items-center gap-4 shrink-0">
                        <label className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px] text-slate-500 uppercase hidden lg:block">Travaux HT</span>
                          <input type="number" min="0"
                            className="w-28 px-2 py-1 text-right text-sm bg-white border border-slate-200 rounded text-slate-700 focus:border-indigo-400 focus:outline-none transition-all"
                            value={lot.montantTravauxHT}
                            onChange={e => { e.stopPropagation(); updateLot(lot.id, 'montantTravauxHT', e.target.value); }}
                            onClick={e => e.stopPropagation()} placeholder="0" />
                          <span className="text-[9px] text-slate-500">€ HT</span>
                        </label>
                        <div className="text-right min-w-[96px]">
                          <div className="text-[9px] text-slate-500 uppercase">Honoraires HT</div>
                          <div className="text-sm font-bold text-indigo-600">{fmtE(honLot)}</div>
                        </div>
                        <div className={`flex items-center gap-1 text-[9px] font-bold w-12 justify-end ${
                          repOk && repTotal > 0 ? 'text-emerald-600' : repTotal > 0 ? 'text-amber-500' : 'text-slate-400'
                        }`}>
                          {repOk && repTotal > 0 ? <CheckCircle2 size={11} /> : repTotal > 0 ? <AlertTriangle size={11} /> : null}
                          {repTotal > 0 ? `${fmt(repTotal)}%` : '—'}
                        </div>
                        <button onClick={e => { e.stopPropagation(); removeLot(lot.id); }}
                          className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-default">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {isGroupement && (
                      <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50/50 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Assigné à :</span>
                        <button onClick={() => updateLot(lot.id, 'assigneA', 'mandataire')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-default border ${
                            lotAssignee === 'mandataire' ? `${MANDATAIRE_COLOR.activeBg} ${MANDATAIRE_COLOR.activeText} border-transparent` : `bg-white ${MANDATAIRE_COLOR.text} ${MANDATAIRE_COLOR.border} hover:bg-amber-50`
                          }`}>{draft.mandataire?.nom || 'Mandataire'}</button>
                        {(draft.cotraitants || []).map((cot, ci) => {
                          const cc = COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0];
                          return (
                            <button key={cot.id} onClick={() => updateLot(lot.id, 'assigneA', cot.id)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-default border ${
                                lotAssignee === cot.id ? `${cc.activeBg} ${cc.activeText} border-transparent` : `bg-white ${cc.text} ${cc.border} hover:${cc.bg}`
                              }`}>{cot.nom || `Co-traitant ${ci + 1}`}</button>
                          );
                        })}
                      </div>
                    )}
                    {isOpen && (
                      <div className="px-4 py-4 border-t border-slate-100 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 w-14">Code</th>
                              <th className="text-left py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">Phase</th>
                              <th className="text-center py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 w-24">% phase</th>
                              <th className="text-right py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 w-28">Honoraires HT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activePhases.map(phase => {
                              const rp = lot.repartitionPhases?.find(r => r.phaseId === phase.id);
                              const h = honPhasePct(honLot, lot.repartitionPhases, phase.id);
                              return (
                                <tr key={phase.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                  <td className="py-2 px-3"><span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{phase.code}</span></td>
                                  <td className="py-2 px-3 text-slate-600">{phase.label}</td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-1 justify-center">
                                      <input type="number" min="0" max="100" step="0.5" className={`${iSmCls} w-16`}
                                        value={rp?.pourcentage || ''} onChange={e => updateRep(lot.id, phase.id, e.target.value)} placeholder="0" />
                                      <span className="text-[10px] text-slate-400">%</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-slate-700">{h > 0 ? fmtE(h) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 bg-slate-50">
                              <td colSpan={2} className="py-2.5 px-3 text-[9px] font-bold uppercase text-slate-500">Total</td>
                              <td className={`py-2.5 px-3 text-center text-sm font-bold ${repOk && repTotal > 0 ? 'text-emerald-600' : repTotal > 100 ? 'text-red-500' : 'text-amber-500'}`}>{fmt(repTotal)} %</td>
                              <td className="py-2.5 px-3 text-right text-sm font-bold text-indigo-600">{fmtE(honLot)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Totaux ──────────────────────────────────────────────────────────── */}
      {(totalHonHT > 0 || lots.length > 0) && (() => {
        const marge = parseFloat(draft.marge) || 0;
        const montantMarge = totalHonHT * marge / 100;
        const honAvecMarge = totalHonHT + montantMarge;
        const isGrp = draft.moeType === 'mandataire' && (draft.cotraitants || []).length > 0;
        const honByAssignee = isGrp ? calcHonByAssignee(draft) : null;
        const mtGlobal = parseFloat(draft.montantTravauxGlobal) || 0;
        const pctEquiv = !isPct && mtGlobal > 0 && totalHonHT > 0 ? (totalHonHT / mtGlobal * 100) : null;
        const travauxDisplay = isPct ? totalTravauxHT : mtGlobal;
        return (
          <div className="space-y-2">
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-100/60 via-white to-slate-100/60 border border-slate-200/80 shadow-sm flex items-center justify-between flex-wrap gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Totaux</span>
              <div className="flex gap-6 flex-wrap items-end">
                {[
                  travauxDisplay > 0 && { label: 'Travaux HT', value: fmtE(travauxDisplay), cls: 'text-slate-700' },
                  isPct && { label: 'Taux',   value: `${draft.tauxHonorairesGlobal || 0} %`, cls: 'text-slate-700' },
                  pctEquiv !== null && { label: '% équivalent', value: `${pctEquiv.toFixed(2)} %`, cls: 'text-violet-600 font-black' },
                  { label: 'Honoraires HT',   value: fmtE(totalHonHT),               cls: 'text-emerald-600' },
                  marge > 0 && { label: `Marge ${marge} %`, value: `+ ${fmtE(montantMarge)}`, cls: 'text-emerald-600' },
                  marge > 0 && { label: 'Hon. + Marge HT', value: fmtE(honAvecMarge), cls: 'text-emerald-600' },
                  { label: `TVA ${tva} %`,    value: fmtE(honAvecMarge * tva / 100),  cls: 'text-slate-500' },
                  { label: 'Total TTC',       value: fmtE(honAvecMarge * (1 + tva / 100)), cls: 'text-slate-900 font-black text-base', sep: true },
                ].filter(Boolean).map((row, i) => (
                  <div key={i} className={`text-center ${row.sep ? 'border-l border-slate-200 pl-6' : ''}`}>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wide">{row.label}</div>
                    <div className={`text-sm font-bold ${row.cls}`}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Répartition par membre du groupement — mode pourcentage */}
            {isGrp && honByAssignee && isPct && (
              <div className="flex gap-3 flex-wrap px-1">
                {Object.entries(honByAssignee).map(([key, data]) => {
                  const ci = (draft.cotraitants || []).findIndex(c => c.id === key);
                  const color = key === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
                  return (
                    <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color.bg} ${color.border}`}>
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className={`text-[10px] font-bold ${color.text}`}>
                        {getAssigneeName(key, draft)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {data.lots.length} lot{data.lots.length > 1 ? 's' : ''} — {fmtE(data.totalHonHT)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Répartition par membre du groupement — mode temps passé */}
            {isGrp && !isPct && (() => {
              const aKeys = getAssigneeKeys(draft);
              if (aKeys.length <= 1) return null;
              const budgetBA = grandTotalByAssignee(draft.taches || [], catsMap || cats, aKeys);
              return (
                <div className="flex gap-3 flex-wrap px-1">
                  {aKeys.map(aKey => {
                    const ci = (draft.cotraitants || []).findIndex(c => c.id === aKey);
                    const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
                    const aTotal = budgetBA[aKey] || 0;
                    const name = getAssigneeName(aKey, draft);
                    return (
                      <div key={aKey} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color.bg} ${color.border}`}>
                        <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                        <span className={`text-[10px] font-bold ${color.text}`}>{name}</span>
                        <span className="text-[10px] text-slate-500">{fmtE(aTotal)}</span>
                        {totalHonHT > 0 && <span className="text-[9px] text-slate-400">{(aTotal / totalHonHT * 100).toFixed(0)} %</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })()}
      </div>

      {/* ── Panneau config (droite) ── */}
      {configOpen && (
        <div className="w-64 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
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
          <div className="p-3 space-y-4">
            {/* Méthode */}
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

            {/* Taux (mode %) ou Catégories (mode temps) */}
            {isPct ? (
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
            ) : (
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
                  const H_PAR_JOUR = 7;
                  const members = isGrp && (draft.cotraitants || []).length > 0
                    ? [{ key: 'mandataire', name: draft.mandataire?.nom || 'Mandataire', color: MANDATAIRE_COLOR },
                       ...(draft.cotraitants || []).map((cot, ci) => ({ key: cot.id, name: cot.nom || `Co-traitant ${ci + 1}`, color: COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0] }))]
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
                    // Mode seul : catégories globales
                    return renderCatInputs(cats, (i, field, val) => {
                      const c = [...cats]; c[i] = { ...c[i], [field]: val }; onChange({ ...draft, categories: c });
                    });
                  }

                  // Mode groupement : une section par membre
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
            )}

            {/* Montant travaux (mode temps) */}
            {!isPct && (
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
            )}

            {/* Marge */}
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

            {/* Résumé */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Phases actives</span>
                <span className="font-bold text-slate-600">{activePhases.length}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Méthode</span>
                <span className="font-bold text-slate-600">{isPct ? 'Pourcentage' : 'Temps passé'}</span>
              </div>
              {draft.marge > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Marge</span>
                  <span className="font-bold text-amber-600">{draft.marge}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB — RÉCAPITULATIF
// ═══════════════════════════════════════════════════════════════════════════════
function RecapTab({ draft }) {
  const cats = draft.categories || [];
  const lots = draft.lots || [];
  const isPct = draft.methode === 'pourcentage';
  const activePhases = (draft.phases || PHASES_LOI_MOP).filter(p => p.actif);
  const moeType = draft.moeType || 'seul';
  const isGrp = moeType !== 'seul' && (moeType === 'mandataire' ? (draft.cotraitants || []).length > 0 : true);

  const taches = draft.taches || [];
  const recapAssigneeKeys = moeType === 'mandataire' && (draft.cotraitants || []).length > 0 ? getAssigneeKeys(draft) : null;
  const recapCatsMap = moeType === 'mandataire' ? buildCategoriesMap(draft) : null;

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
                  const ci = (draft.cotraitants || []).findIndex(c => c.id === key);
                  const color = key === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
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
                  const ci = (draft.cotraitants || []).findIndex(c => c.id === aKey);
                  const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
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
                        const ci = (draft.cotraitants || []).findIndex(c => c.id === aKey);
                        const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]);
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
                      const ci = aKey !== 'solo' ? (draft.cotraitants || []).findIndex(c => c.id === aKey) : -1;
                      const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey !== 'solo' ? (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]) : null;
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
                          const ci = aKey !== 'solo' ? (draft.cotraitants || []).findIndex(c => c.id === aKey) : -1;
                          const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey !== 'solo' ? (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]) : null;
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
                      const ci = aKey !== 'solo' ? (draft.cotraitants || []).findIndex(c => c.id === aKey) : -1;
                      const color = aKey === 'mandataire' ? MANDATAIRE_COLOR : aKey !== 'solo' ? (COTRAITANT_COLORS[ci] || COTRAITANT_COLORS[0]) : null;
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

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL AJOUT / MODIFICATION TÂCHE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

const TacheTypeEditModal = ({ isOpen, tache, phases, onSave, onClose }) => {
  const [label, setLabel] = useState('');
  const [selectedPhases, setSelectedPhases] = useState([]);

  // Sync state on open
  useEffect(() => {
    if (isOpen && tache) {
      setLabel(tache.label || '');
      setSelectedPhases([...(tache.phases || [])]);
    } else if (isOpen) {
      setLabel('');
      setSelectedPhases([]);
    }
  }, [isOpen, tache]);

  if (!isOpen) return null;

  const togglePhase = (phaseId) => {
    setSelectedPhases(prev =>
      prev.includes(phaseId) ? prev.filter(p => p !== phaseId) : [...prev, phaseId]
    );
  };

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ label: label.trim(), phases: selectedPhases });
  };

  const isEdit = !!tache;
  const activePhases = (phases || PHASES_LOI_MOP).filter(p => p.actif);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-[480px] mx-4 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              {isEdit ? <Pencil size={15} className="text-emerald-600" /> : <Plus size={15} className="text-emerald-600" />}
            </div>
            <h3 className="font-bold text-sm text-slate-800">{isEdit ? 'Modifier la tâche type' : 'Nouvelle tâche type'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Label */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Intitulé de la tâche
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Réunion de chantier, Étude technique…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-slate-800 placeholder-slate-300"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && label.trim() && handleSave()}
            />
          </div>

          {/* Phases */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Phases MOP associées <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {activePhases.map(p => (
                <button key={p.id} onClick={() => togglePhase(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-default border ${
                    selectedPhases.includes(p.id)
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                  }`}>
                  <span>{p.code}</span>
                  <span className={`text-[10px] font-normal ${selectedPhases.includes(p.id) ? 'text-slate-300' : 'text-slate-300'}`}>
                    {p.label.length > 20 ? p.label.slice(0, 20) + '…' : p.label}
                  </span>
                </button>
              ))}
            </div>
            {selectedPhases.length === 0 && (
              <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1">
                Aucune phase sélectionnée — cette tâche sera «Générale» (visible dans toutes les phases)
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all cursor-default">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!label.trim()}
            className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-default ${
              label.trim()
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}>
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL BIBLIOTHÈQUE TÂCHES TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const TacheTypeModal = ({ draft, setDraft, onClose }) => {
  const [editingIdx, setEditingIdx] = useState(null); // null = closed, -1 = add new, 0+ = edit index
  const tpls = draft.customTemplates || [...TACHE_TEMPLATES];
  const updateTpls = (newTpls) => setDraft({ ...draft, customTemplates: newTpls });

  const removeTpl = (idx) => updateTpls(tpls.filter((_, i) => i !== idx));
  const resetTpls = () => updateTpls(null);
  const reorderTpls = (fromIdx, toIdx) => {
    const arr = [...tpls];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    updateTpls(arr);
  };

  const handleSaveEdit = (data) => {
    if (editingIdx === -1) {
      // Ajout
      updateTpls([...tpls, data]);
    } else {
      // Modification
      updateTpls(tpls.map((t, i) => i === editingIdx ? data : t));
    }
    setEditingIdx(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
        <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <BookOpen size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Bibliothèque de tâches types</h3>
                <p className="text-[11px] text-slate-400">{tpls.length} tâche{tpls.length > 1 ? 's' : ''} · glissez pour réordonner</p>
              </div>
            </div>
            <button onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-default">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <DragDropContext onDragEnd={(result) => {
            if (!result.destination) return;
            reorderTpls(result.source.index, result.destination.index);
          }}>
            <Droppable droppableId="tpl-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-6 space-y-2">
                  {tpls.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      Aucune tâche type. Cliquez «Ajouter» pour en créer.
                    </div>
                  )}
                  {tpls.map((tpl, idx) => (
                    <Draggable key={`tpl-${idx}`} draggableId={`tpl-${idx}`} index={idx}>
                      {(dragProvided, dragSnapshot) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}
                          className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 group transition-shadow ${
                            dragSnapshot.isDragging ? 'shadow-lg bg-white' : ''
                          }`}>
                          <div {...dragProvided.dragHandleProps} className="text-slate-200 hover:text-slate-400 cursor-grab shrink-0">
                            <GripVertical size={14} />
                          </div>

                          {/* Label */}
                          <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                            {tpl.label || <span className="text-slate-300 italic">Sans titre</span>}
                          </span>

                          {/* Phases badges */}
                          <div className="flex gap-1 shrink-0">
                            {tpl.phases && tpl.phases.length > 0 ? (
                              tpl.phases.map(phaseId => {
                                const phase = (draft.phases || PHASES_LOI_MOP).find(p => p.id === phaseId);
                                return phase ? (
                                  <span key={phaseId} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-white">
                                    {phase.code}
                                  </span>
                                ) : null;
                              })
                            ) : (
                              <span className="text-[9px] text-amber-500 font-semibold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">
                                Générale
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <button onClick={() => setEditingIdx(idx)}
                              className="p-1 rounded text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-default"
                              title="Modifier">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => removeTpl(idx)}
                              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-default"
                              title="Supprimer">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 shrink-0">
            <div className="flex gap-2">
              <button onClick={() => setEditingIdx(-1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 border border-emerald-200 transition-all cursor-default">
                <Plus size={13} />Ajouter
              </button>
              <button onClick={resetTpls}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-slate-500 text-xs font-semibold hover:bg-slate-100 border border-slate-200 transition-all cursor-default">
                <RotateCcw size={13} />Réinitialiser
              </button>
            </div>
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all cursor-default">
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Sous-modale ajout/modification */}
      <TacheTypeEditModal
        isOpen={editingIdx !== null}
        tache={editingIdx !== null && editingIdx >= 0 ? tpls[editingIdx] : null}
        phases={draft.phases}
        onSave={handleSaveEdit}
        onClose={() => setEditingIdx(null)}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function DevisMoeView({ onBackToHub, user, companyId }) {
  const { devisList, isLoading, selected, selectedId, setSelectedId,
    createDevis, saveDevis, duplicateDevis, deleteDevis } = useDevisMoe(user, companyId);

  const [searchTerm, setSearchTerm]       = useState('');
  const [activeTab, setActiveTab]         = useState('infos');
  const [draft, setDraft]                 = useState(null);
  const [isSaving, setIsSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [configOpen, setConfigOpen]       = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    if (selected) setDraft(prev => (!prev || prev.id !== selected.id) ? { ...selected } : prev);
    else setDraft(null);
  }, [selected?.id]); // eslint-disable-line

  const isDirty = useMemo(() => {
    if (!draft || !selected) return false;
    return JSON.stringify(draft) !== JSON.stringify(selected);
  }, [draft, selected]);

  const quickTotalHon = useMemo(() => {
    if (!draft) return 0;
    const cats = draft.categories || [];
    const isPct = draft.methode === 'pourcentage';
    const activePh = (draft.phases || PHASES_LOI_MOP).filter(p => p.actif);
    return (draft.lots || []).reduce((s, l) =>
      s + (isPct ? pct(l, draft.tauxHonorairesGlobal) : activePh.reduce((s2, ph) => s2 + honPhaseTemps(l, ph.id, cats), 0)), 0);
  }, [draft]);

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    const ok = await saveDevis(updated);
    if (ok) setDraft(updated);
    setIsSaving(false);
  };

  const handleCreate = async () => {
    setActiveTab('infos');
    await createDevis('Nouveau devis MOE');
  };

  const filteredList = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return !q ? devisList : devisList.filter(d =>
      (d.nom || '').toLowerCase().includes(q) ||
      (d.reference || '').toLowerCase().includes(q) ||
      (d.client?.designation || '').toLowerCase().includes(q)
    );
  }, [devisList, searchTerm]);

  // ── Indicateur de sauvegarde ──────────────────────────────────────────────
  const SaveIndicator = () => {
    if (!draft) return null;
    if (isSaving) return (
      <div className="flex items-center gap-1 text-[10px] text-blue-500">
        <Loader2 size={11} className="animate-spin" /><span>Enregistrement...</span>
      </div>
    );
    if (isDirty) return (
      <div className="flex items-center gap-1 text-[10px] text-amber-500">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /><span>Non enregistré</span>
      </div>
    );
    return (
      <div className="flex items-center gap-1 text-[10px] text-emerald-500">
        <CheckCircle2 size={11} /><span>Enregistré</span>
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] overflow-hidden flex flex-col font-[system-ui,'Segoe_UI',sans-serif] text-slate-700 select-none">

      {/* ══════════════════════ RIBBON ══════════════════════ */}
      <header className="sticky top-0 z-20">

        {/* Barre d'onglets */}
        <RibbonHeader
          title={draft ? (draft.nom || 'Sans titre') : 'Devis MOE'}
          tabs={[{ id: 'accueil', label: 'Accueil' }]}
          activeTab="accueil"
          onTabChange={() => {}}
          rightContent={<SaveIndicator />}
        />

        {/* Ribbon body */}
        <RibbonContainer>
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label="Hub" onClick={onBackToHub} />
          </RibbonGroup>

          {/* Info devis courant */}
          {draft && (
            <div className="flex flex-col justify-center px-5 border-r border-slate-200 min-w-[200px] max-w-[260px]">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Devis en cours</p>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  draft.methode === 'pourcentage'
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}>
                  {draft.methode === 'pourcentage' ? '% Montant' : 'Temps passé'}
                </span>
                {draft.moeType === 'mandataire' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">Groupement</span>
                )}
                {draft.moeType === 'cotraitant' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">Co-traitant</span>
                )}
              </div>
              {(draft.lots?.length || 0) > 0 && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Honoraires : <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{fmtE(quickTotalHon)}</span>
                </p>
              )}
            </div>
          )}

          <RibbonGroup label="Fichier">
            <RibbonBtnLarge icon={Plus} label="Nouveau" onClick={handleCreate} accent="text-emerald-500" />
            <RibbonBtnLarge
              icon={isSaving ? Loader2 : Save}
              label={isSaving ? 'Enreg…' : 'Enregistrer'}
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              accent="text-blue-500"
              active={isDirty && !isSaving}
            />
          </RibbonGroup>

          <RibbonGroup label="Édition">
            <RibbonBtnLarge icon={Copy}   label="Dupliquer" onClick={() => selectedId && duplicateDevis(selectedId)} disabled={!selectedId} />
            <RibbonBtnLarge icon={Trash2} label="Supprimer" onClick={() => selectedId && setConfirmDelete(selectedId)} disabled={!selectedId} accent="text-red-500" />
            <RibbonBtnLarge icon={BookOpen} label="Bibliothèque" onClick={() => setShowTemplateModal(true)} disabled={!selectedId} accent="text-emerald-500" />
          </RibbonGroup>

          {/* Onglets contenu dans le ribbon */}
          {draft && (
            <RibbonGroup label="Vue">
              {[
                { id: 'infos',      label: 'Informations', Icon: FileText },
                { id: 'honoraires', label: 'Honoraires',   Icon: Calculator },
                { id: 'recap',      label: 'Récapitulatif',Icon: Receipt },
              ].map(({ id, label, Icon }) => (
                <RibbonBtnLarge key={id} icon={Icon} label={label} onClick={() => setActiveTab(id)}
                  active={activeTab === id}
                  accent={activeTab === id ? 'text-emerald-500' : undefined} />
              ))}
            </RibbonGroup>
          )}

          {draft && activeTab === 'honoraires' && (
            <RibbonGroup label="">
              <RibbonBtnLarge icon={SlidersHorizontal} label="Paramètres"
                onClick={() => setConfigOpen(!configOpen)}
                active={configOpen}
                accent={configOpen ? 'text-emerald-500' : undefined} />
            </RibbonGroup>
          )}

        </RibbonContainer>
      </header>

      {/* ══════════════════════ BODY ══════════════════════ */}
      <div className="flex-1 flex min-h-0">

        {/* Sidebar liste — repliable */}
        <div className={`shrink-0 border-r border-slate-200 flex flex-col bg-gradient-to-b from-slate-50/80 to-white transition-all duration-300 overflow-hidden ${sidebarOpen ? 'w-64' : 'w-0'}`}>
          {sidebarOpen && (
            <>
              <div className="px-3 py-2.5 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">Mes Devis</span>
                    <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                      {devisList.length}
                    </span>
                  </div>
                  <button onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-default">
                    <PanelLeftClose size={16} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-400 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 outline-none transition-all select-text" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center px-4">
                    <FolderOpen size={22} className="mb-2 text-slate-300" />
                    <p className="text-[11px] font-semibold text-slate-500">Aucun devis</p>
                    <p className="text-[10px] mt-1 text-slate-400">Utilisez "Nouveau" dans la barre d'outils</p>
                  </div>
                ) : (
                  filteredList.map(d => (
                    <div key={d.id}
                      onClick={() => { setSelectedId(d.id); setActiveTab('infos'); }}
                      className={`group relative p-3 rounded-lg cursor-default border transition-all duration-200 ${
                        d.id === selectedId
                          ? 'bg-emerald-50/80 border-emerald-200 shadow-sm border-l-[3px] border-l-emerald-500'
                          : 'border-transparent hover:bg-slate-50/80 hover:border-slate-200 hover:shadow-sm'
                      }`}>
                      <p className={`text-xs font-semibold truncate ${d.id === selectedId ? 'text-emerald-900' : 'text-slate-700'}`}>
                        {d.nom || 'Devis sans titre'}
                      </p>
                      {d.client?.designation && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{d.client.designation}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          d.methode === 'pourcentage'
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          {d.methode === 'pourcentage' ? '%' : 'Temps'}
                        </span>
                        {d.moeType === 'mandataire' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">Groupement</span>
                        )}
                        {d.moeType === 'cotraitant' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">Co-traitant</span>
                        )}
                        {d.reference && <span className="text-[9px] text-slate-400">{d.reference}</span>}
                        <span className="text-[9px] text-slate-400 ml-auto">{d.dateDevis || ''}</span>
                      </div>
                      {/* Actions hover */}
                      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white border border-slate-200 rounded shadow-sm px-1">
                        <button onClick={e => { e.stopPropagation(); duplicateDevis(d.id); }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-default" title="Dupliquer">
                          <Copy size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(d.id); }}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-default" title="Supprimer">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Bouton réouvrir sidebar — visible quand repliée */}
        {!sidebarOpen && (
          <div className="shrink-0 border-r border-slate-200 flex items-start pt-2 px-1">
            <button onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-default"
              title="Afficher la liste des devis">
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* Zone contenu */}
        {!selectedId || !draft ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-slate-50/50 via-white to-emerald-50/30">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-200/30 rounded-full blur-2xl scale-150" />
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100">
                <Receipt size={48} className="text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-500 mb-2">Aucun devis sélectionné</h2>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
              Créez un nouveau devis ou sélectionnez-en un dans la liste.
            </p>
            <button onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-sm hover:from-emerald-500 hover:to-emerald-400 hover:shadow-lg hover:shadow-emerald-200 transition-all duration-200 shadow-md cursor-default">
              <Plus size={16} />Nouveau devis MOE
            </button>
          </div>
        ) : (
          <div className={`flex-1 ${activeTab === 'honoraires' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {activeTab === 'infos'      && <InfoTab       draft={draft} onChange={setDraft} />}
            {activeTab === 'honoraires' && <HonorairesTab  draft={draft} onChange={setDraft} templatesOpen={templatesOpen} setTemplatesOpen={setTemplatesOpen} configOpen={configOpen} setConfigOpen={setConfigOpen} />}
            {activeTab === 'recap'      && <RecapTab        draft={draft} />}
          </div>
        )}
      </div>

      {/* ══════════════════════ MODAL BIBLIOTHÈQUE ══════════════════════ */}
      {showTemplateModal && draft && <TacheTypeModal
        draft={draft}
        setDraft={setDraft}
        onClose={() => setShowTemplateModal(false)}
      />}

      {/* ══════════════════════ MODAL SUPPRESSION ══════════════════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-bold text-slate-800">Supprimer le devis ?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">Cette action est irréversible. Le devis sera définitivement supprimé.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all cursor-default">
                Annuler
              </button>
              <button onClick={async () => { await deleteDevis(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-600 hover:bg-red-100 transition-all cursor-default">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
