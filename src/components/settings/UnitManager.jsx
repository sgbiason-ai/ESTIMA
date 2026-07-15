// src/components/settings/UnitManager.jsx
//
// Gestionnaire des unités « complet » : recherche, catégories (dimensions)
// ÉDITABLES (renommage, ajout de catégories personnalisées, suppression si vide),
// déplacement des unités par DRAG & DROP (changement de catégorie + ordre),
// facteur de conversion éditable, compteur d'usage (articles BPU), garde-fou à
// la suppression, convertisseur et densités matériaux.
//
// Source unique : la métadonnée d'unité provient de src/data/units.js ; la
// persistance passe par saveUnit/saveUnits/deleteUnit/saveDimensions (useDatabase).
// Les 7 dimensions physiques intégrées sont renommables mais pas supprimables :
// leurs clés pilotent les conversions de blocs (mass/volume/area/length).

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Ruler, Plus, Edit2, Trash2, X, Check, Search, Scale, AlertTriangle,
  GripVertical, FolderPlus, SlidersHorizontal, ShieldCheck, Wand2, Filter,
  RotateCcw, Tag,
} from 'lucide-react';
import { confirm, toast } from '../../utils/globalUI';
import { normalizeUnitSymbol } from '../../utils/helpers';
import {
  mergeDimensions, enrichUnit, convert, sameDimension,
  MATERIAL_DENSITIES, DIMENSION_COLORS, CANONICAL_SYMBOLS,
  auditUnits, canonicalSymbol,
} from '../../data/units';

// Teintes des badges par couleur de catégorie. Classes statiques → pas de purge Tailwind.
const COLOR_BADGE = {
  sky:     'bg-sky-50 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  slate:   'bg-slate-100 text-slate-600 border-slate-200',
  teal:    'bg-teal-50 text-teal-700 border-teal-200',
  orange:  'bg-orange-50 text-orange-700 border-orange-200',
  cyan:    'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const EMPTY_DRAFT = { symbol: '', label: '', dimension: 'count', factor: 1, aliases: '' };

// Clé technique d'une catégorie personnalisée à partir de son nom affiché.
const slugify = (name) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

const UnitManager = ({
  units = [], bpu = [], dimensions, densities,
  saveUnit, saveUnits, deleteUnit, updateBpuItem, saveDimensions, saveDensities,
}) => {
  const dims = useMemo(() => (dimensions?.length ? dimensions : mergeDimensions([])), [dimensions]);
  const densList = densities?.length ? densities : MATERIAL_DENSITIES;
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('simple');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingSymbol, setEditingSymbol] = useState(null); // null = mode ajout
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [replacementSymbol, setReplacementSymbol] = useState('');
  const [editingDim, setEditingDim] = useState(null);       // key de la catégorie en cours de renommage
  const [dimName, setDimName] = useState('');
  const [addingDim, setAddingDim] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [convFrom, setConvFrom] = useState('');
  const [convTo, setConvTo] = useState('');
  const [convQty, setConvQty] = useState('1');

  const isEditing = editingSymbol !== null;
  const searching = search.trim() !== '';
  const expertMode = mode === 'expert';

  const dimLabel = (key) => dims.find((d) => d.key === key)?.label || 'Autre';
  const dimColor = (key) => dims.find((d) => d.key === key)?.color || 'slate';

  // Compteur d'usage : nombre d'articles BPU référençant chaque symbole (normalisé).
  const usageBySymbol = useMemo(() => {
    const map = new Map();
    (bpu || []).forEach((item) => {
      const n = normalizeUnitSymbol(item?.unit || '');
      if (n) map.set(n, (map.get(n) || 0) + 1);
    });
    return map;
  }, [bpu]);
  const usageOf = (symbol) => usageBySymbol.get(normalizeUnitSymbol(symbol)) || 0;
  const isSystemUnit = (symbol) => CANONICAL_SYMBOLS.includes(canonicalSymbol(symbol));
  const audit = useMemo(() => auditUnits({ units, bpu }), [units, bpu]);

  // Filtre recherche (symbole, libellé, catégorie, alias).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (categoryFilter !== 'all' && (u.dimension || 'count') !== categoryFilter) return false;
      const uses = usageOf(u.symbol);
      if (statusFilter === 'used' && uses === 0) return false;
      if (statusFilter === 'unused' && uses > 0) return false;
      if (statusFilter === 'issues') {
        const key = normalizeUnitSymbol(u.symbol);
        const hasIssue =
          u.symbol !== canonicalSymbol(u.symbol)
          || audit.duplicateSymbols.some((d) => d.symbol === key)
          || audit.aliasConflicts.some((c) => c.units.includes(u.symbol));
        if (!hasIssue) return false;
      }
      if (!q) return true;
      const hay = [u.symbol, u.label, dimLabel(u.dimension), ...(u.aliases || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, search, dims, categoryFilter, statusFilter, audit]);

  // Groupes par catégorie, dans l'ordre de la config. Les groupes vides restent
  // visibles hors recherche : ils servent de cible de drop.
  const groups = useMemo(() => {
    const sortInGroup = (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) || String(a.symbol).localeCompare(String(b.symbol), 'fr');
    return dims
      .map((dim) => ({ dim, items: filtered.filter((u) => (u.dimension || 'count') === dim.key).sort(sortInGroup) }))
      .filter((g) => !searching || g.items.length > 0);
  }, [dims, filtered, searching]);

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  // Déplacement dans un groupe = réordonnancement ; vers un autre groupe =
  // changement de catégorie (dimension). Le facteur est remis à 1 quand la
  // dimension change (l'ancien facteur n'a plus de sens physique).
  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const moved = units.find((u) => u.symbol === draggableId);
    if (!moved) return;

    const srcKey = source.droppableId;
    const dstKey = destination.droppableId;
    const inGroup = (key) => groups.find((g) => g.dim.key === key)?.items || [];

    const srcItems = inGroup(srcKey).filter((u) => u.symbol !== moved.symbol);
    const dstItems = srcKey === dstKey ? srcItems : [...inGroup(dstKey)];
    const movedNext = srcKey === dstKey
      ? moved
      : { ...moved, dimension: dstKey, factor: 1 };
    dstItems.splice(destination.index, 0, movedNext);

    // Réattribue un ordre séquentiel aux groupes touchés → persistance stable.
    const changed = [];
    dstItems.forEach((u, i) => changed.push({ ...u, order: i }));
    if (srcKey !== dstKey) srcItems.forEach((u, i) => changed.push({ ...u, order: i }));
    saveUnits(changed);
  };

  // ─── Actions formulaire unité ─────────────────────────────────────────────
  const startAdd = () => { setEditingSymbol(null); setDraft(EMPTY_DRAFT); };
  const startEdit = (u) => {
    setEditingSymbol(u.symbol);
    setDraft({
      symbol: u.symbol,
      label: u.label || '',
      dimension: u.dimension || 'count',
      factor: u.factor ?? 1,
      aliases: (u.aliases || []).join(', '),
    });
  };
  const cancel = () => { setEditingSymbol(null); setDraft(EMPTY_DRAFT); };
  const draftAliases = useMemo(
    () => draft.aliases.split(',').map((a) => a.trim()).filter(Boolean),
    [draft.aliases],
  );

  const submit = (e) => {
    e.preventDefault();
    const symbol = draft.symbol.trim();
    const label = draft.label.trim();
    if (!symbol || !label) {
      toast.error('Symbole et libellé requis.', { title: 'Champs manquants' });
      return;
    }
    const clash = units.find(
      (u) => normalizeUnitSymbol(u.symbol) === normalizeUnitSymbol(symbol) && u.symbol !== editingSymbol,
    );
    if (clash) {
      toast.error(`Le symbole « ${symbol} » existe déjà (${clash.label}).`, { title: 'Doublon' });
      return;
    }
    if (isEditing && isSystemUnit(editingSymbol) && normalizeUnitSymbol(symbol) !== normalizeUnitSymbol(editingSymbol)) {
      toast.error('Cette unité système peut être enrichie, mais son symbole ne peut pas être renommé.', { title: 'Unité protégée' });
      return;
    }
    const factor = Number(draft.factor);
    const descriptor = enrichUnit({
      symbol,
      label,
      dimension: draft.dimension,
      factor: Number.isFinite(factor) && factor > 0 ? factor : 1,
      aliases: draft.aliases.split(',').map((a) => a.trim()).filter(Boolean),
    });
    if (isEditing && editingSymbol && editingSymbol !== descriptor.symbol) {
      deleteUnit(editingSymbol);
    }
    saveUnit(descriptor);
    cancel();
  };

  const askDelete = async (u) => {
    if (isSystemUnit(u.symbol)) {
      toast.error(`"${u.symbol}" est une unité système protégée.`, { title: 'Suppression bloquée' });
      return;
    }
    const uses = usageOf(u.symbol);
    if (uses > 0) {
      const candidates = units.filter((candidate) =>
        candidate.symbol !== u.symbol && (candidate.dimension || 'count') === (u.dimension || 'count'));
      setReplaceTarget(u);
      setReplacementSymbol(candidates[0]?.symbol || '');
      return;
    }
    const msg = uses > 0
      ? `L'unité « ${u.symbol} » est utilisée par ${uses} article(s) de la bibliothèque. `
        + `Les supprimer laissera ces articles sans unité reconnue. Supprimer quand même ?`
      : `Supprimer l'unité « ${u.symbol} » ?`;
    const ok = await confirm(msg, { danger: true });
    if (ok) deleteUnit(u.symbol);
  };

  const replaceBpuUnit = async (fromSymbol, toSymbol) => {
    if (!updateBpuItem) return 0;
    const fromKey = normalizeUnitSymbol(fromSymbol);
    const affected = (bpu || []).filter((item) => normalizeUnitSymbol(item?.unit || '') === fromKey);
    await Promise.all(affected.map((item) => updateBpuItem(item.id, { unit: toSymbol })));
    return affected.length;
  };

  const commitReplaceAndDelete = async () => {
    if (!replaceTarget || !replacementSymbol) {
      toast.error('Choisissez une unité de remplacement.', { title: 'Remplacement requis' });
      return;
    }
    if (normalizeUnitSymbol(replaceTarget.symbol) === normalizeUnitSymbol(replacementSymbol)) {
      toast.error('Choisissez une unité différente.', { title: 'Remplacement invalide' });
      return;
    }
    const uses = usageOf(replaceTarget.symbol);
    const ok = await confirm(
      `Remplacer "${replaceTarget.symbol}" par "${replacementSymbol}" dans ${uses} article(s), puis supprimer l'unité ?`,
      { danger: true },
    );
    if (!ok) return;
    const count = await replaceBpuUnit(replaceTarget.symbol, replacementSymbol);
    await deleteUnit(replaceTarget.symbol);
    setReplaceTarget(null);
    setReplacementSymbol('');
    toast.success(`${count} article(s) mis à jour.`, { title: 'Unité remplacée' });
  };

  const applyBpuNormalization = async () => {
    if (!updateBpuItem || audit.legacyUsages.length === 0) return;
    const total = audit.legacyUsages.reduce((sum, entry) => sum + entry.count, 0);
    const ok = await confirm(`Normaliser ${total} article(s) vers les symboles canoniques ?`);
    if (!ok) return;
    let count = 0;
    for (const entry of audit.legacyUsages) {
      count += await replaceBpuUnit(entry.symbol, entry.canonical);
    }
    toast.success(`${count} article(s) normalisé(s).`, { title: 'Audit des unités' });
  };

  const prepareUnknownUnit = (entry) => {
    const symbol = entry.suggestion || normalizeUnitSymbol(entry.symbol);
    setEditingSymbol(null);
    setDraft({
      symbol,
      label: symbol,
      dimension: 'count',
      factor: 1,
      aliases: normalizeUnitSymbol(entry.symbol) !== symbol ? entry.symbol : '',
    });
  };

  // ─── Actions catégories ───────────────────────────────────────────────────
  const startRenameDim = (dim) => { setEditingDim(dim.key); setDimName(dim.label); };
  const commitRenameDim = () => {
    const name = dimName.trim();
    if (name && editingDim) {
      saveDimensions(dims.map((d) => (d.key === editingDim ? { ...d, label: name } : d)));
    }
    setEditingDim(null);
  };

  const commitAddDim = () => {
    const name = newDimName.trim();
    if (!name) { setAddingDim(false); return; }
    const key = slugify(name) || `cat_${dims.length}`;
    if (dims.some((d) => d.key === key)) {
      toast.error(`La catégorie « ${name} » existe déjà.`, { title: 'Doublon' });
      return;
    }
    const color = DIMENSION_COLORS[dims.length % DIMENSION_COLORS.length];
    saveDimensions([...dims, { key, label: name, color, order: dims.length, custom: true }]);
    setAddingDim(false);
    setNewDimName('');
  };

  const askDeleteDim = async (dim) => {
    const count = units.filter((u) => (u.dimension || 'count') === dim.key).length;
    if (count > 0) {
      toast.error(`« ${dim.label} » contient ${count} unité(s). Déplacez-les d'abord (glisser-déposer).`, { title: 'Catégorie non vide' });
      return;
    }
    const ok = await confirm(`Supprimer la catégorie « ${dim.label} » ?`, { danger: true });
    if (ok) saveDimensions(dims.filter((d) => d.key !== dim.key));
  };

  // ─── Convertisseur ────────────────────────────────────────────────────────
  const convResult = useMemo(() => {
    if (!convFrom || !convTo) return null;
    if (!sameDimension(convFrom, convTo)) return { error: 'dimensions différentes' };
    const r = convert(convQty, convFrom, convTo);
    return r == null ? { error: 'conversion impossible' } : { value: r };
  }, [convFrom, convTo, convQty]);

  return (
    <div className="space-y-8">
      {/* En-tête + recherche + boutons */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="flex items-center gap-3">
          <Ruler size={22} className="text-emerald-600" />
          <div>
            <h3 className="font-black uppercase text-sm tracking-widest text-slate-700">Gestion des Unités</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
              {units.length} unité(s) · {dims.length} catégorie(s) · glisser-déposer pour déplacer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="bg-white border border-slate-200 rounded pl-8 pr-3 py-2 text-sm w-44 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setAddingDim(true)}
            className="bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 px-3 py-2 rounded font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5"
            title="Créer une catégorie personnalisée"
          >
            <FolderPlus size={14} /> Catégorie
          </button>
          <button
            type="button"
            onClick={startAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} /> Nouvelle
          </button>
        </div>
      </div>

      {/* Ajout de catégorie (inline) */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <div className="bg-slate-100 p-0.5 rounded-xl flex">
            {['simple', 'expert'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {value === 'simple' ? 'Simple' : 'Expert'}
              </button>
            ))}
          </div>
          {audit.issueCount > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1">
              <AlertTriangle size={12} /> {audit.issueCount} point(s) à vérifier
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 focus:border-emerald-500 outline-none"
          >
            <option value="all">Toutes catégories</option>
            {dims.map((dim) => <option key={dim.key} value={dim.key}>{dim.label}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 focus:border-emerald-500 outline-none"
          >
            <option value="all">Tous statuts</option>
            <option value="used">Utilisées</option>
            <option value="unused">Non utilisées</option>
            <option value="issues">À vérifier</option>
          </select>
        </div>
      </div>

      {addingDim && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <FolderPlus size={14} className="text-slate-400" />
          <input
            autoFocus
            value={newDimName}
            onChange={(e) => setNewDimName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitAddDim(); if (e.key === 'Escape') setAddingDim(false); }}
            placeholder="Nom de la catégorie (ex: Signalisation)"
            className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          />
          <button type="button" onClick={commitAddDim} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded" title="Créer"><Check size={14} /></button>
          <button type="button" onClick={() => { setAddingDim(false); setNewDimName(''); }} className="bg-white border border-slate-200 text-slate-500 p-2 rounded hover:bg-slate-100" title="Annuler"><X size={14} /></button>
        </div>
      )}

      {/* Formulaire ajout / édition d'unité */}
      {replaceTarget && (
        <section className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-red-500 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-red-700">Remplacement requis avant suppression</h4>
              <p className="text-xs text-red-700 mt-1">
                {replaceTarget.symbol} est utilisée par {usageOf(replaceTarget.symbol)} article(s). Choisissez l’unité qui la remplacera dans la bibliothèque.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UnitSelect
              units={units.filter((u) => u.symbol !== replaceTarget.symbol && (u.dimension || 'count') === (replaceTarget.dimension || 'count'))}
              value={replacementSymbol}
              onChange={setReplacementSymbol}
              placeholder="remplacer par..."
            />
            <button type="button" onClick={commitReplaceAndDelete} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5">
              <RotateCcw size={14} /> Remplacer
            </button>
            <button type="button" onClick={() => setReplaceTarget(null)} className="bg-white border border-red-200 text-red-600 px-3 py-2 rounded-xl font-bold text-xs hover:bg-red-100">
              Annuler
            </button>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Wand2 size={15} className="text-amber-500" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Audit des unités</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${audit.issueCount ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {audit.issueCount ? `${audit.issueCount} point(s)` : 'OK'}
            </span>
          </div>
          {audit.legacyUsages.length > 0 && updateBpuItem && (
            <button type="button" onClick={applyBpuNormalization} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5">
              <Wand2 size={14} /> Normaliser les articles
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          <AuditBox title="Inconnues" value={audit.unknownUsages.length} tone={audit.unknownUsages.length ? 'amber' : 'slate'} />
          <AuditBox title="À normaliser" value={audit.legacyUsages.length} tone={audit.legacyUsages.length ? 'amber' : 'slate'} />
          <AuditBox title="Conflits alias" value={audit.aliasConflicts.length} tone={audit.aliasConflicts.length ? 'red' : 'slate'} />
          <AuditBox title="Custom inutilisées" value={audit.unusedCustomUnits.length} tone="slate" />
        </div>
        {(audit.unknownUsages.length > 0 || audit.legacyUsages.length > 0 || audit.aliasConflicts.length > 0) && (
          <div className="mt-3 space-y-2">
            {audit.unknownUsages.slice(0, 4).map((entry) => (
              <div key={entry.normalized} className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <span className="text-xs text-amber-800"><b>{entry.symbol}</b> inconnue dans {entry.count} article(s)</span>
                <button type="button" onClick={() => prepareUnknownUnit(entry)} className="text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900">
                  Ajouter
                </button>
              </div>
            ))}
            {audit.legacyUsages.slice(0, 4).map((entry) => (
              <div key={`${entry.normalized}-${entry.canonical}`} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-600"><b>{entry.symbol}</b> sera normalisée en <b>{entry.canonical}</b> ({entry.count} article(s))</span>
              </div>
            ))}
            {audit.aliasConflicts.slice(0, 3).map((entry) => (
              <div key={entry.alias} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                Alias <b>{entry.alias}</b> partage par {entry.units.join(', ')}
              </div>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-1">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Symbole</label>
          <input
            value={draft.symbol}
            onChange={(e) => setDraft((d) => ({ ...d, symbol: e.target.value.toUpperCase() }))}
            placeholder="M2"
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold focus:border-emerald-500 outline-none"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Libellé</label>
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Mètre carré"
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Catégorie</label>
          <select
            value={draft.dimension}
            onChange={(e) => setDraft((d) => ({ ...d, dimension: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded px-2 py-2 text-sm focus:border-emerald-500 outline-none"
          >
            {dims.map((dim) => <option key={dim.key} value={dim.key}>{dim.label}</option>)}
          </select>
        </div>
        {expertMode && (
        <div className="md:col-span-1">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1" title="Quantité en unité de base de la catégorie (ex: 1 T = 1000 KG)">Facteur</label>
          <input
            type="number"
            step="any"
            min="0"
            value={draft.factor}
            onChange={(e) => setDraft((d) => ({ ...d, factor: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          />
        </div>
        )}
        {expertMode && (
        <div className="md:col-span-6">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Alias (séparés par des virgules)</label>
          <input
            value={draft.aliases}
            onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))}
            placeholder="m2, mètre carré"
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          />
          {draftAliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {draftAliases.map((alias) => (
                <span key={alias} className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-0.5 flex items-center gap-1">
                  <Tag size={10} /> {alias}
                </span>
              ))}
            </div>
          )}
        </div>
        )}
        <div className="md:col-span-6 flex gap-2 justify-end">
          {isEditing && (
            <button type="button" onClick={cancel} className="bg-white text-slate-500 border border-slate-200 py-2 px-4 rounded hover:bg-slate-100 flex items-center gap-1.5 text-sm">
              <X size={14} /> Annuler
            </button>
          )}
          <button type="submit" className={`text-white py-2 px-5 rounded font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-sm ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {isEditing ? <><Check size={14} /> Mettre à jour</> : <><Plus size={14} /> Ajouter</>}
          </button>
        </div>
      </form>

      {searching && (
        <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1.5">
          <AlertTriangle size={12} /> Glisser-déposer désactivé pendant une recherche.
        </p>
      )}

      {/* Catégories + unités (drag & drop) */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-5">
          {groups.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-6">Aucune unité ne correspond à « {search} ».</p>
          )}
          {groups.map(({ dim, items }) => (
            <section key={dim.key}>
              <div className="flex items-center gap-2 mb-2 group/dim">
                {editingDim === dim.key ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={dimName}
                      onChange={(e) => setDimName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRenameDim(); if (e.key === 'Escape') setEditingDim(null); }}
                      className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-bold focus:outline-none w-44"
                    />
                    <button type="button" onClick={commitRenameDim} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Valider"><Check size={13} /></button>
                    <button type="button" onClick={() => setEditingDim(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Annuler"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${COLOR_BADGE[dim.color] || COLOR_BADGE.slate}`}>●</span>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{dim.label}</h4>
                    <span className="text-[10px] text-slate-300 font-bold">({items.length})</span>
                    <button
                      type="button"
                      onClick={() => startRenameDim(dim)}
                      className="p-1 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded opacity-0 group-hover/dim:opacity-100 transition-opacity"
                      title="Renommer la catégorie"
                    >
                      <Edit2 size={12} />
                    </button>
                    {dim.custom && (
                      <button
                        type="button"
                        onClick={() => askDeleteDim(dim)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/dim:opacity-100 transition-opacity"
                        title="Supprimer la catégorie (doit être vide)"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                )}
              </div>
              <Droppable droppableId={dim.key} isDropDisabled={searching}>
                {(dropProvided, dropSnapshot) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className={`grid grid-cols-1 gap-1.5 rounded-lg transition-colors p-1 min-h-[38px] border border-dashed ${dropSnapshot.isDraggingOver ? 'bg-emerald-50/70 border-emerald-300' : 'border-transparent'}`}
                  >
                    {items.length === 0 && !dropSnapshot.isDraggingOver && (
                      <p className="text-[10px] text-slate-300 italic px-2 py-1.5">Déposez une unité ici…</p>
                    )}
                    {items.map((u, index) => {
                      const uses = usageOf(u.symbol);
                      return (
                        <Draggable key={u.symbol} draggableId={u.symbol} index={index} isDragDisabled={searching}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`flex items-center justify-between p-2.5 bg-white border rounded-lg group shadow-sm transition-all ${dragSnapshot.isDragging ? 'border-emerald-400 shadow-lg rotate-1' : 'border-slate-100 hover:border-emerald-200'}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  {...dragProvided.dragHandleProps}
                                  className={`p-0.5 rounded ${searching ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing'}`}
                                  title={searching ? 'Videz la recherche pour déplacer' : 'Glisser pour déplacer / réordonner'}
                                >
                                  <GripVertical size={14} />
                                </span>
                                <span className="text-sm font-black text-emerald-600 min-w-[42px]">{u.symbol}</span>
                                <span className="text-xs font-semibold text-slate-600 truncate">{u.label}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${COLOR_BADGE[dimColor(u.dimension)] || COLOR_BADGE.slate}`}>
                                  {dimLabel(u.dimension)}
                                </span>
                                {u.factor != null && u.factor !== 1 && (
                                  <span className="text-[9px] text-slate-400 font-bold" title="Facteur vers l'unité de base">×{u.factor}</span>
                                )}
                                {isSystemUnit(u.symbol) && (
                                  <span className="text-[8px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    système
                                  </span>
                                )}
                                {expertMode && (u.aliases || []).slice(0, 3).map((alias) => (
                                  <span key={`${u.symbol}-${alias}`} className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                    {alias}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {uses > 0 && (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded" title="Articles de la bibliothèque utilisant cette unité">
                                    {uses} art.
                                  </span>
                                )}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => startEdit(u)} className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded" title="Modifier">
                                    <Edit2 size={15} />
                                  </button>
                                  <button type="button" onClick={() => askDelete(u)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded" title="Supprimer">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          ))}
        </div>
      </DragDropContext>

      {/* Convertisseur rapide */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={14} className="text-slate-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Convertisseur</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number" step="any" value={convQty}
            onChange={(e) => setConvQty(e.target.value)}
            className="bg-white border border-slate-200 rounded px-3 py-2 w-24 focus:border-emerald-500 outline-none"
          />
          <UnitSelect units={units} value={convFrom} onChange={setConvFrom} placeholder="de…" />
          <span className="text-slate-400 font-bold">→</span>
          <UnitSelect units={units} value={convTo} onChange={setConvTo} placeholder="vers…" />
          <div className="min-w-[120px] font-bold">
            {convResult?.error && <span className="text-amber-600 text-xs flex items-center gap-1"><AlertTriangle size={12} />{convResult.error}</span>}
            {convResult?.value != null && (
              <span className="text-emerald-700">= {convResult.value.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} {convTo}</span>
            )}
          </div>
        </div>
      </section>

      {/* Densités matériaux (préréglages blocs) — ÉDITABLES */}
      <DensityPanel densities={densList} saveDensities={saveDensities} />
    </div>
  );
};

// ─── Densités matériaux éditables ────────────────────────────────────────────
// Chaque ligne (libellé + densité T/M3) est modifiable ; ajout et suppression
// libres. La liste complète est persistée d'un bloc via saveDensities.
const DensityPanel = ({ densities, saveDensities }) => {
  const [editKey, setEditKey] = useState(null);       // key de la ligne en édition
  const [rowDraft, setRowDraft] = useState({ label: '', density: '' });
  const [adding, setAdding] = useState(false);

  const startEdit = (m) => { setEditKey(m.key); setRowDraft({ label: m.label, density: String(m.density) }); setAdding(false); };
  const startAdd = () => { setAdding(true); setEditKey(null); setRowDraft({ label: '', density: '' }); };
  const cancelRow = () => { setEditKey(null); setAdding(false); };

  const commitRow = () => {
    const label = rowDraft.label.trim();
    const density = Number(String(rowDraft.density).replace(',', '.'));
    if (!label || !Number.isFinite(density) || density <= 0) {
      toast.error('Libellé et densité (> 0) requis.', { title: 'Densité invalide' });
      return;
    }
    if (adding) saveDensities([...densities, { key: `mat_${Date.now().toString(36)}`, label, density }]);
    else saveDensities(densities.map((m) => (m.key === editKey ? { ...m, label, density } : m)));
    cancelRow();
  };

  const removeRow = async (m) => {
    const ok = await confirm(`Supprimer la densité « ${m.label} » ?`, { danger: true });
    if (ok) saveDensities(densities.filter((d) => d.key !== m.key));
  };

  const editorRow = (
    <div className="flex items-center gap-1.5 bg-white border border-emerald-300 rounded px-2 py-1.5">
      <input
        autoFocus
        value={rowDraft.label}
        onChange={(e) => setRowDraft((d) => ({ ...d, label: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') commitRow(); if (e.key === 'Escape') cancelRow(); }}
        placeholder="Matériau"
        className="flex-1 min-w-0 text-xs font-semibold text-slate-700 outline-none"
      />
      <input
        value={rowDraft.density}
        onChange={(e) => setRowDraft((d) => ({ ...d, density: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') commitRow(); if (e.key === 'Escape') cancelRow(); }}
        placeholder="2.4"
        className="w-14 text-xs font-black text-amber-600 text-right outline-none"
        inputMode="decimal"
      />
      <button type="button" onClick={commitRow} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Valider"><Check size={13} /></button>
      <button type="button" onClick={cancelRow} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Annuler"><X size={13} /></button>
    </div>
  );

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scale size={14} className="text-slate-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Densités matériaux (T/M3)</h4>
          <span className="text-[9px] text-slate-400 font-medium normal-case">— préréglages réutilisables dans les blocs</span>
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 px-2.5 py-1.5 rounded font-black text-[9px] uppercase tracking-widest flex items-center gap-1"
        >
          <Plus size={12} /> Matériau
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {densities.map((m) => (
          editKey === m.key ? (
            <React.Fragment key={m.key}>{editorRow}</React.Fragment>
          ) : (
            <div key={m.key} className="flex items-center justify-between bg-white border border-slate-100 rounded px-3 py-2 group hover:border-emerald-200 transition-colors">
              <span className="text-xs font-semibold text-slate-600 truncate">{m.label}</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs font-black text-amber-600 ml-2">{m.density}</span>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => startEdit(m)} className="p-1 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded" title="Modifier">
                    <Edit2 size={12} />
                  </button>
                  <button type="button" onClick={() => removeRow(m)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded" title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        ))}
        {adding && editorRow}
      </div>
    </section>
  );
};

DensityPanel.propTypes = {
  densities: PropTypes.array.isRequired,
  saveDensities: PropTypes.func.isRequired,
};

// Petit sélecteur d'unité réutilisé par le convertisseur.
const UnitSelect = ({ units, value, onChange, placeholder }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="bg-white border border-slate-200 rounded px-2 py-2 text-sm focus:border-emerald-500 outline-none"
  >
    <option value="">{placeholder}</option>
    {units.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol} — {u.label}</option>)}
  </select>
);

UnitSelect.propTypes = {
  units: PropTypes.array.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

UnitManager.propTypes = {
  units: PropTypes.array,
  bpu: PropTypes.array,
  dimensions: PropTypes.array,
  densities: PropTypes.array,
  saveUnit: PropTypes.func.isRequired,
  saveUnits: PropTypes.func.isRequired,
  deleteUnit: PropTypes.func.isRequired,
  updateBpuItem: PropTypes.func,
  saveDimensions: PropTypes.func.isRequired,
  saveDensities: PropTypes.func.isRequired,
};

export default UnitManager;

const AuditBox = ({ title, value, tone = 'slate' }) => {
  const classes = {
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`border rounded-xl px-3 py-2 ${classes[tone] || classes.slate}`}>
      <div className="text-[9px] font-black uppercase tracking-widest opacity-70">{title}</div>
      <div className="text-lg font-black leading-tight">{value}</div>
    </div>
  );
};

AuditBox.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  tone: PropTypes.string,
};
