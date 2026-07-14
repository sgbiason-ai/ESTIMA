// src/components/settings/UnitManager.jsx
//
// Gestionnaire des unités « complet » : recherche, regroupement par dimension
// physique, facteur de conversion éditable, compteur d'usage (articles BPU),
// garde-fou à la suppression d'une unité utilisée, et bibliothèque de densités
// matériaux réutilisables dans les blocs.
//
// Source unique : toute la métadonnée d'unité provient de src/data/units.js ;
// la persistance passe par saveUnit/deleteUnit (useDatabase).

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Ruler, Plus, Edit2, Trash2, X, Check, Search, Layers, Scale, AlertTriangle,
} from 'lucide-react';
import { confirm, toast } from '../../utils/globalUI';
import { normalizeUnitSymbol } from '../../utils/helpers';
import {
  DIMENSIONS, dimensionLabel, enrichUnit, convert, sameDimension,
  MATERIAL_DENSITIES,
} from '../../data/units';

// Teintes par dimension (badges). Classes Tailwind statiques → pas de purge.
const DIM_BADGE = {
  length:  'bg-sky-50 text-sky-700 border-sky-200',
  area:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  volume:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  mass:    'bg-amber-50 text-amber-700 border-amber-200',
  count:   'bg-rose-50 text-rose-700 border-rose-200',
  time:    'bg-violet-50 text-violet-700 border-violet-200',
  lumpsum: 'bg-slate-100 text-slate-600 border-slate-200',
};

const EMPTY_DRAFT = { symbol: '', label: '', dimension: 'count', factor: 1, aliases: '' };

const UnitManager = ({ units = [], bpu = [], saveUnit, deleteUnit }) => {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingSymbol, setEditingSymbol] = useState(null); // null = mode ajout
  const [convFrom, setConvFrom] = useState('');
  const [convTo, setConvTo] = useState('');
  const [convQty, setConvQty] = useState('1');

  const isEditing = editingSymbol !== null;

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

  // Filtre recherche (symbole, libellé, dimension, alias).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => {
      const hay = [
        u.symbol, u.label, dimensionLabel(u.dimension),
        ...(u.aliases || []),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [units, search]);

  // Regroupement par dimension, dans l'ordre canonique des dimensions.
  const groups = useMemo(() => {
    return DIMENSIONS.map((dim) => ({
      dim,
      items: filtered
        .filter((u) => (u.dimension || 'count') === dim.key)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.symbol).localeCompare(String(b.symbol), 'fr')),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  // ─── Actions formulaire ────────────────────────────────────────────────────
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
    // Doublon de symbole (hors l'unité en cours d'édition).
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
    // Renommage de symbole : supprimer l'ancien document après avoir écrit le nouveau.
    if (isEditing && editingSymbol && editingSymbol !== symbol) {
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

  // ─── Convertisseur (démonstration du moteur de conversion) ─────────────────
  const convResult = useMemo(() => {
    if (!convFrom || !convTo) return null;
    if (!sameDimension(convFrom, convTo)) return { error: 'dimensions différentes' };
    const r = convert(convQty, convFrom, convTo);
    return r == null ? { error: 'conversion impossible' } : { value: r };
  }, [convFrom, convTo, convQty]);

  return (
    <div className="space-y-8">
      {/* En-tête + recherche + bouton ajouter */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="flex items-center gap-3">
          <Ruler size={22} className="text-emerald-600" />
          <div>
            <h3 className="font-black uppercase text-sm tracking-widest text-slate-700">Gestion des Unités</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
              {units.length} unité(s) · {groups.length} dimension(s)
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
              className="bg-white border border-slate-200 rounded pl-8 pr-3 py-2 text-sm w-48 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={startAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} /> Nouvelle
          </button>
        </div>
      </div>

      {/* Formulaire ajout / édition */}
      <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-1">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Symbole</label>
          <input
            value={draft.symbol}
            onChange={(e) => setDraft((d) => ({ ...d, symbol: e.target.value }))}
            placeholder="m²"
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
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Dimension</label>
          <select
            value={draft.dimension}
            onChange={(e) => setDraft((d) => ({ ...d, dimension: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded px-2 py-2 text-sm focus:border-emerald-500 outline-none"
          >
            {DIMENSIONS.map((dim) => <option key={dim.key} value={dim.key}>{dim.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1" title="Quantité en unité de base de la dimension (ex: 1 t = 1000 kg)">Facteur</label>
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

      {/* Liste groupée par dimension */}
      <div className="space-y-5">
        {groups.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-6">Aucune unité ne correspond à « {search} ».</p>
        )}
        {groups.map(({ dim, items }) => (
          <section key={dim.key}>
            <div className="flex items-center gap-2 mb-2">
              <Layers size={13} className="text-slate-400" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{dim.label}</h4>
              <span className="text-[10px] text-slate-300 font-bold">({items.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((u) => {
                const uses = usageOf(u.symbol);
                return (
                  <div key={u.symbol} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group hover:border-emerald-200 shadow-sm transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-black text-emerald-600 min-w-[42px]">{u.symbol}</span>
                      <span className="text-xs font-semibold text-slate-600 truncate">{u.label}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${DIM_BADGE[u.dimension] || DIM_BADGE.count}`}>
                        {dimensionLabel(u.dimension)}
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
                );
              })}
            </div>
          </section>
        ))}
      </div>

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

      {/* Densités matériaux (préréglages blocs) */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={14} className="text-slate-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Densités matériaux (t/m³)</h4>
          <span className="text-[9px] text-slate-400 font-medium normal-case">— préréglages réutilisables dans les blocs</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {MATERIAL_DENSITIES.map((m) => (
            <div key={m.key} className="flex items-center justify-between bg-white border border-slate-100 rounded px-3 py-2">
              <span className="text-xs font-semibold text-slate-600 truncate">{m.label}</span>
              <span className="text-xs font-black text-amber-600 ml-2">{m.density}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
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
  saveUnit: PropTypes.func.isRequired,
  deleteUnit: PropTypes.func.isRequired,
};

export default UnitManager;
