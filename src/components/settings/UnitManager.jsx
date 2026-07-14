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
  GripVertical, FolderPlus,
} from 'lucide-react';
import { confirm, toast } from '../../utils/globalUI';
import { normalizeUnitSymbol } from '../../utils/helpers';
import {
  mergeDimensions, enrichUnit, convert, sameDimension,
  MATERIAL_DENSITIES, DIMENSION_COLORS,
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
  saveUnit, saveUnits, deleteUnit, saveDimensions, saveDensities,
}) => {
  const dims = useMemo(() => (dimensions?.length ? dimensions : mergeDimensions([])), [dimensions]);
  const densList = densities?.length ? densities : MATERIAL_DENSITIES;
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingSymbol, setEditingSymbol] = useState(null); // null = mode ajout
  const [editingDim, setEditingDim] = useState(null);       // key de la catégorie en cours de renommage
  const [dimName, setDimName] = useState('');
  const [addingDim, setAddingDim] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [convFrom, setConvFrom] = useState('');
  const [convTo, setConvTo] = useState('');
  const [convQty, setConvQty] = useState('1');

  const isEditing = editingSymbol !== null;
  const searching = search.trim() !== '';

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

  // Filtre recherche (symbole, libellé, catégorie, alias).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => {
      const hay = [u.symbol, u.label, dimLabel(u.dimension), ...(u.aliases || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, search, dims]);

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
    const uses = usageOf(u.symbol);
    const msg = uses > 0
      ? `L'unité « ${u.symbol} » est utilisée par ${uses} article(s) de la bibliothèque. `
        + `Les supprimer laissera ces articles sans unité reconnue. Supprimer quand même ?`
      : `Supprimer l'unité « ${u.symbol} » ?`;
    const ok = await confirm(msg, { danger: true });
    if (ok) deleteUnit(u.symbol);
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
        <div className="md:col-span-6">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Alias (séparés par des virgules)</label>
          <input
            value={draft.aliases}
            onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))}
            placeholder="m2, mètre carré"
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          />
        </div>
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
  saveDimensions: PropTypes.func.isRequired,
  saveDensities: PropTypes.func.isRequired,
};

export default UnitManager;
