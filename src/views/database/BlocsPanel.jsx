// src/views/database/BlocsPanel.jsx
// Gestion des "blocs" = ouvrages composites. Chaque bloc a une UNITÉ ; chaque
// article composant est ramené à cette unité via épaisseur/densité (voir blocPricing).
// Utilisé dans la Bibliothèque (DatabaseView) via le toggle Articles / Blocs.
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Boxes, Plus, Trash2, Search, X, Save, Copy, Filter, GripVertical,
  Package, AlertTriangle, Layers,
} from 'lucide-react';
import { formatPrice, cleanText, normalizeUnitSymbol } from '../../utils/helpers';
import {
  getBlocArticles, getBlocKind, blocUnitPrice, articleContribution, needsThickness, needsDensity, isBlocRef,
} from '../../utils/blocPricing';
import { useDialog } from '../../contexts/DialogContext';

// Le bloc `root` contient-il (transitivement) `targetId` via ses réfs de blocs ?
// Sert à interdire, à l'édition, l'ajout d'un bloc qui créerait un cycle (A⊂B⊂A).
function blocContainsBloc(root, targetId, blocsById, seen = new Set()) {
  if (!root || !targetId || seen.has(String(root.id))) return false;
  seen.add(String(root.id));
  return getBlocArticles(root).some(a => {
    if (!isBlocRef(a)) return false;
    if (String(a.id) === String(targetId)) return true;
    return blocContainsBloc(blocsById[String(a.id)], targetId, blocsById, seen);
  });
}

const BlocsPanel = ({ blocs = [], fullBpu = [], units = [], addBloc, updateBloc, deleteBloc, dragEndRef }) => {
  const { confirm } = useDialog();

  // Lookup rapide article par id
  const bpuById = useMemo(() => {
    const map = {};
    (fullBpu || []).forEach(i => { map[String(i.id)] = i; });
    return map;
  }, [fullBpu]);

  // Lookup rapide bloc par id (résolution des sous-blocs imbriqués).
  const blocsByIdMap = useMemo(() => {
    const m = {};
    (blocs || []).forEach(b => { m[String(b.id)] = b; });
    return m;
  }, [blocs]);

  // Sélection / brouillon d'édition. Composant = { id, epaisseur, densite }.
  const NEW = '__new__';
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ name: '', unit: '', articles: [], kind: 'formula' });
  const [search, setSearch] = useState('');
  const [addMode, setAddMode] = useState('articles'); // volet Ajout (agrégats) : 'articles' | 'blocs'
  const [blocSearch, setBlocSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');   // '' = toutes les unités
  const [kindFilter, setKindFilter] = useState('all'); // 'all' | 'formula' | 'aggregate'
  const [sortField, setSortField] = useState('name'); // 'name' | 'unit' | 'price'
  const [sortDir, setSortDir] = useState('asc');       // 'asc' | 'desc'
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  // Charge le brouillon quand on change de bloc sélectionné
  useEffect(() => {
    if (selectedId === NEW) {
      setDraft({ name: '', unit: '', articles: [], kind: 'formula' });
    } else if (selectedId) {
      const b = blocs.find(x => x.id === selectedId);
      if (b) setDraft({ name: b.name || '', unit: b.unit || '', articles: getBlocArticles(b).map(a => ({ ...a })), kind: getBlocKind(b) });
    }
    setSearch('');
    setAddMode('articles');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = selectedId != null;
  const currentBloc = selectedId && selectedId !== NEW ? blocs.find(b => b.id === selectedId) : null;
  const isDirty = selectedId === NEW
    ? (draft.name.trim() !== '' || draft.articles.length > 0)
    : currentBloc && (
        draft.name !== currentBloc.name ||
        draft.unit !== (currentBloc.unit || '') ||
        draft.kind !== getBlocKind(currentBloc) ||
        JSON.stringify(draft.articles) !== JSON.stringify(getBlocArticles(currentBloc))
      );

  const draftPrice = useMemo(() => blocUnitPrice(draft, bpuById), [draft, bpuById]);

  // Articles disponibles (non déjà dans le bloc), recherche accent-insensible.
  const LIST_CAP = 60;
  const { available, availableTotal } = useMemo(() => {
    const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const inBloc = new Set(draft.articles.map(a => String(a.id)));
    const q = norm(search).trim();
    const matches = (fullBpu || [])
      .filter(i => !inBloc.has(String(i.id)))
      .filter(i => !q || norm(cleanText(i.designation || '')).includes(q));
    return { available: matches.slice(0, LIST_CAP), availableTotal: matches.length };
  }, [fullBpu, draft.articles, search]);

  // Blocs ajoutables dans un agrégat : exclut soi-même, les déjà-ajoutés et tout
  // bloc qui (transitivement) contient le bloc courant (anti-cycle).
  const { availableBlocs, availableBlocsTotal } = useMemo(() => {
    const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const already = new Set(draft.articles.filter(isBlocRef).map(a => String(a.id)));
    const q = norm(search).trim();
    const matches = (blocs || [])
      .filter(b => String(b.id) !== String(selectedId))
      .filter(b => !already.has(String(b.id)))
      .filter(b => !blocContainsBloc(b, selectedId, blocsByIdMap))
      .filter(b => !q || norm(b.name).includes(q));
    return { availableBlocs: matches.slice(0, LIST_CAP), availableBlocsTotal: matches.length };
  }, [blocs, draft.articles, search, selectedId, blocsByIdMap]);

  // Blocs visibles dans la colonne de gauche : filtre accent-insensible par nom
  // OU par article contenu (comme la bibliothèque de l'estimation), puis tri alpha.
  // Unités distinctes présentes parmi les blocs (pour le menu de filtre).
  const blocUnits = useMemo(() => {
    const set = new Set();
    (blocs || []).forEach(b => { const u = normalizeUnitSymbol(b.unit || ''); if (u) set.add(u); });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [blocs]);

  const visibleBlocs = useMemo(() => {
    const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const q = norm(blocSearch).trim();
    let arr = blocs || [];
    if (kindFilter !== 'all') arr = arr.filter(b => getBlocKind(b) === kindFilter);
    if (unitFilter) arr = arr.filter(b => normalizeUnitSymbol(b.unit || '') === unitFilter);
    if (q) arr = arr.filter(b => {
      if (norm(b.name).includes(q)) return true;
      return getBlocArticles(b).some(a => norm(cleanText(bpuById[String(a.id)]?.designation || '')).includes(q));
    });
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...arr].sort((a, b) => {
      if (sortField === 'price') return dir * (blocUnitPrice(a, bpuById) - blocUnitPrice(b, bpuById));
      if (sortField === 'unit') return dir * normalizeUnitSymbol(a.unit || '').localeCompare(normalizeUnitSymbol(b.unit || ''), 'fr');
      return dir * (a.name || '').localeCompare(b.name || '', 'fr');
    });
  }, [blocs, blocSearch, bpuById, unitFilter, kindFilter, sortField, sortDir]);

  const addArticle = (id) => setDraft(d => ({ ...d, articles: [...d.articles, { id: String(id), epaisseur: '', densite: '', perte: '' }] }));
  const addBlocRef = (id) => setDraft(d => ({ ...d, articles: [...d.articles, { ref: 'bloc', id: String(id) }] }));
  const removeArticle = (idx) => setDraft(d => ({ ...d, articles: d.articles.filter((_, i) => i !== idx) }));
  const setArticle = (idx, patch) => setDraft(d => ({ ...d, articles: d.articles.map((a, i) => i === idx ? { ...a, ...patch } : a) }));
  // Réordonnancement par glisser-déposer. Le DragDropContext est porté par DatabaseView ;
  // il délègue ici via dragEndRef car le brouillon des articles vit dans ce composant
  // (hello-pangea n'autorise pas les DragDropContext imbriqués).
  const reorderArticles = useCallback((from, to) => setDraft(d => {
    if (to == null || to < 0 || to >= d.articles.length || from === to) return d;
    const arr = [...d.articles];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return { ...d, articles: arr };
  }), []);

  useEffect(() => {
    if (!dragEndRef) return undefined;
    dragEndRef.current = ({ source, destination }) => {
      if (!destination) return;
      reorderArticles(source.index, destination.index);
    };
    return () => { dragEndRef.current = null; };
  }, [dragEndRef, reorderArticles]);

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const unit = isAggregate ? '' : draft.unit;
    if (selectedId === NEW) {
      const created = await addBloc(name, unit, draft.articles, draft.kind);
      if (created) setSelectedId(created.id);
    } else {
      await updateBloc(selectedId, { name, unit, articles: draft.articles, kind: draft.kind });
    }
  };

  // « Comme nouveau » : crée un nouveau bloc à partir du brouillon courant en
  // conservant le bloc d'origine intact (déclinaison/variante sous un autre nom).
  const handleSaveAsNew = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const created = await addBloc(name, isAggregate ? '' : draft.unit, draft.articles, draft.kind);
    if (created) setSelectedId(created.id);
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    const ok = await confirm('Supprimer ce bloc ? Les articles de la bibliothèque ne sont pas affectés.', { title: 'Supprimer le bloc', danger: true, confirmLabel: 'Supprimer' });
    if (!ok) return;
    await deleteBloc(id);
    if (selectedId === id) setSelectedId(null);
  };

  const isAggregate = draft.kind === 'aggregate';
  // Volet Ajout en mode « Blocs » : seulement pour les agrégats.
  const showBlocs = isAggregate && addMode === 'blocs';
  // Bascule de type : un agrégat n'a pas d'unité de bloc (articles à unités mixtes).
  const setKind = (kind) => setDraft(d => ({ ...d, kind, unit: kind === 'aggregate' ? '' : d.unit }));

  const blocUnitLabel = draft.unit ? normalizeUnitSymbol(draft.unit) : 'unité';

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-50">
      {/* ── Colonne gauche : liste des blocs ── */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-black text-xs uppercase text-slate-500 tracking-widest mb-3 flex items-center gap-2">
            <Boxes size={14} /> Blocs ({(blocSearch.trim() || unitFilter || kindFilter !== 'all') ? `${visibleBlocs.length}/${blocs.length}` : blocs.length})
          </h3>
          <button
            onClick={() => setSelectedId(NEW)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
          >
            <Plus size={14} /> Nouveau bloc
          </button>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              value={blocSearch}
              onChange={(e) => setBlocSearch(e.target.value)}
              placeholder="Rechercher un bloc…"
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
            />
            {blocSearch && (
              <button onClick={() => setBlocSearch('')} title="Effacer la recherche" className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          {/* Filtre par type : tous / formule / agrégat */}
          <div className="mt-2 grid grid-cols-3 bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {[{ key: 'all', label: 'Tous' }, { key: 'formula', label: 'Formule' }, { key: 'aggregate', label: 'Agrégat' }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setKindFilter(key); if (key === 'aggregate') setUnitFilter(''); }}
                title={`Afficher ${key === 'all' ? 'tous les blocs' : key === 'formula' ? 'les blocs formule' : 'les blocs agrégat'}`}
                className={`py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${kindFilter === key ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Filtre par unité (masqué pour les agrégats, sans unité) */}
          {kindFilter !== 'aggregate' && (
          <div className="relative mt-2">
            <Filter className="absolute left-3 top-2.5 text-slate-400" size={12} />
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none focus:border-emerald-500 appearance-none cursor-pointer hover:bg-slate-50 transition-colors uppercase tracking-wide"
            >
              <option value="">Toutes les unités</option>
              {blocUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          )}
          {/* Tri : nom / unité / prix — clic répété inverse le sens */}
          <div className="mt-2 grid grid-cols-3 bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {[{ key: 'name', label: 'Nom' }, { key: 'unit', label: 'Unité' }, { key: 'price', label: 'Prix' }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                title={`Trier par ${label.toLowerCase()} (cliquer pour inverser ↑ / ↓)`}
                className={`py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${sortField === key ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}{sortField === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {blocs.length === 0 && selectedId !== NEW && (
            <div className="p-6 text-center text-slate-400">
              <Layers size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs italic">Aucun bloc pour l'instant.</p>
              <p className="text-[10px] text-slate-300 mt-1">Créez un ensemble d'articles réutilisable.</p>
            </div>
          )}

          {selectedId === NEW && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600">
              <Plus size={16} /><span className="text-xs font-bold italic">Nouveau bloc…</span>
            </div>
          )}

          {blocs.length > 0 && visibleBlocs.length === 0 && (
            <div className="p-6 text-center text-slate-400">
              <Search size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs italic">Aucun bloc ne correspond</p>
              {blocSearch.trim() && <p className="text-[11px] font-bold text-slate-500 mt-0.5">« {blocSearch.trim()} »</p>}
              {kindFilter !== 'all' && <p className="text-[10px] font-bold text-slate-500 mt-0.5">Type : {kindFilter === 'aggregate' ? 'agrégat' : 'formule'}</p>}
              {unitFilter && <p className="text-[10px] font-bold text-slate-500 mt-0.5">Unité : {unitFilter}</p>}
              <button onClick={() => { setBlocSearch(''); setUnitFilter(''); setKindFilter('all'); }} className="mt-3 text-[10px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700">Réinitialiser</button>
            </div>
          )}

          {visibleBlocs.map(b => {
            const count = getBlocArticles(b).length;
            const active = selectedId === b.id;
            const isAgg = getBlocKind(b) === 'aggregate';
            const u = b.unit ? normalizeUnitSymbol(b.unit) : '';
            return (
              <div
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${active ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-100' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 line-clamp-2 uppercase tracking-tight">{b.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                    {isAgg && <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[8px] font-black uppercase tracking-wider">Agrégat</span>}
                    <span>{count} article{count > 1 ? 's' : ''}</span>
                  </p>
                </div>
                {!isAgg && (
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="text-[11px] font-black text-emerald-700 font-mono bg-emerald-100/60 border border-emerald-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">{formatPrice(blocUnitPrice(b, bpuById))}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{u ? `/ ${u}` : '/ unité'}</span>
                  </div>
                )}
                <button onClick={(e) => handleDelete(b.id, e)} title="Supprimer le bloc" className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Colonne droite : éditeur ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {!isEditing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <Boxes size={48} strokeWidth={1.2} className="mb-3 opacity-50" />
            <p className="text-sm font-bold text-slate-400">Sélectionnez un bloc ou créez-en un</p>
            <p className="text-xs text-slate-300 mt-1">Un bloc regroupe plusieurs articles à insérer en un clic.</p>
          </div>
        ) : (
          <>
            {/* En-tête éditeur : nom + unité + enregistrer */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center gap-3 shadow-sm">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0"><Boxes size={18} /></div>
              <div className="flex flex-col shrink-0">
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 ml-1">Type de bloc</label>
                <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setKind('formula')}
                    title="Ouvrage composite : chaque article est ramené à l'unité du bloc via épaisseur / densité / perte (PU au m², ml…)"
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${!isAggregate ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Formule
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('aggregate')}
                    title="Simple regroupement d'articles, sans calcul : chaque article garde son unité, les quantités se saisissent dans l'estimation"
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${isAggregate ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Agrégat
                  </button>
                </div>
              </div>
              <input
                autoFocus
                type="text"
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="Nom du bloc (ex : Voirie légère en granulaire)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors uppercase tracking-tight"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              {!isAggregate && (
                <div className="flex flex-col shrink-0">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 ml-1">Unité du bloc</label>
                  <select
                    value={draft.unit}
                    onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors uppercase cursor-pointer min-w-[110px]"
                  >
                    <option value="">— choisir —</option>
                    {(units || []).map(u => <option key={u.symbol} value={u.symbol}>{normalizeUnitSymbol(u.symbol)} — {u.label}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={!draft.name.trim() || !isDirty}
                className="flex items-center gap-2 px-4 py-2 mt-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95 shrink-0"
              >
                <Save size={14} /> {selectedId === NEW ? 'Créer' : 'Enregistrer'}
              </button>
              {selectedId !== NEW && (
                <button
                  onClick={handleSaveAsNew}
                  disabled={!draft.name.trim()}
                  title="Crée un nouveau bloc à partir des modifications (nom, composition) sans toucher au bloc actuel"
                  className="flex items-center gap-2 px-4 py-2 mt-3 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black uppercase tracking-widest rounded-lg shadow-sm transition-all active:scale-95 shrink-0"
                >
                  <Copy size={14} /> Comme nouveau
                </button>
              )}
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Table des articles du bloc */}
              <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
                <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><Package size={13} /> Composition ({draft.articles.length}){isAggregate && <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[8px] font-black uppercase tracking-wider">Agrégat</span>}</span>
                  {!isAggregate && (
                    <span className="text-xs font-black text-emerald-700">{formatPrice(draftPrice)} <span className="text-slate-400 font-bold">/ {blocUnitLabel}</span></span>
                  )}
                </div>

                {/* En-tête de colonnes */}
                {draft.articles.length > 0 && (
                  <div className="px-4 py-2 flex items-center gap-2 bg-white border-b border-slate-100 text-[8px] font-black uppercase tracking-widest text-slate-400">
                    <span className="w-5 text-center">#</span>
                    <span className="flex-1">Article</span>
                    <span className="w-10 text-center">U</span>
                    {!isAggregate && (
                      <>
                        <span className="w-16 text-center">Ép. (m)</span>
                        <span className="w-16 text-center">Densité</span>
                        <span className="w-14 text-center">Perte %</span>
                        <span className="w-20 text-right">→ /{blocUnitLabel}</span>
                      </>
                    )}
                    <span className="w-8" />
                  </div>
                )}

                <Droppable droppableId="bloc-composition" type="BLOC_ARTICLE">
                  {(dropProvided) => (
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className="flex-1 overflow-y-auto p-2 space-y-1.5"
                    >
                      {draft.articles.length === 0 && (
                        <div className="p-6 text-center text-slate-400 text-xs italic">{isAggregate ? 'Ajoutez des articles ou des blocs depuis la liste de droite →' : 'Ajoutez des articles depuis la liste de droite →'}</div>
                      )}
                      {draft.articles.map((a, idx) => {
                        const blocRef = isBlocRef(a);
                        const childBloc = blocRef ? blocsByIdMap[String(a.id)] : null;
                        const article = blocRef ? null : bpuById[String(a.id)];
                        const wantEp = article && needsThickness(article.unit);
                        const wantD = article && needsDensity(article.unit);
                        const contrib = article ? articleContribution(article, a.epaisseur, a.densite, a.perte) : 0;
                        const dndId = `${blocRef ? 'bloc' : 'art'}_${String(a.id)}`;
                        return (
                          <Draggable key={dndId} draggableId={dndId} index={idx}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`group flex items-center gap-2 px-2 py-2 bg-white border rounded-lg transition-all ${dragSnapshot.isDragging ? 'border-emerald-400 shadow-lg ring-2 ring-emerald-100 rotate-1' : blocRef ? 'border-violet-200 hover:border-violet-300 bg-violet-50/20' : 'border-slate-200 hover:border-emerald-300'}`}
                              >
                                {/* Poignée de glissement (remplace le n° au survol) */}
                                <div
                                  {...dragProvided.dragHandleProps}
                                  title="Glisser pour réordonner"
                                  className="w-5 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing"
                                >
                                  <span className="text-[10px] font-black text-slate-400 group-hover:hidden">{idx + 1}</span>
                                  <GripVertical size={13} className="hidden group-hover:block text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  {blocRef ? (
                                    childBloc ? (
                                      <>
                                        <p className="text-[11px] font-bold text-violet-900 uppercase line-clamp-2 tracking-tight leading-tight flex items-center gap-1.5">
                                          <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700 text-[8px] font-black shrink-0">{getBlocKind(childBloc) === 'aggregate' ? 'Agrégat' : 'Formule'}</span>
                                          {childBloc.name}
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-bold">{getBlocArticles(childBloc).length} article{getBlocArticles(childBloc).length > 1 ? 's' : ''}{childBloc.unit ? ` · ${normalizeUnitSymbol(childBloc.unit)}` : ''}</p>
                                      </>
                                    ) : (
                                      <p className="text-[11px] font-bold text-amber-600 italic flex items-center gap-1"><AlertTriangle size={12} /> Bloc introuvable</p>
                                    )
                                  ) : article ? (
                                    <>
                                      <p className="text-[11px] font-bold text-slate-800 uppercase line-clamp-2 tracking-tight leading-tight">{cleanText(article.designation)}</p>
                                      <p className="text-[9px] text-slate-400 font-bold">{formatPrice(article.price)}/{normalizeUnitSymbol(article.unit)}</p>
                                    </>
                                  ) : (
                                    <p className="text-[11px] font-bold text-amber-600 italic flex items-center gap-1"><AlertTriangle size={12} /> Article introuvable</p>
                                  )}
                                </div>
                                <span className={`w-10 text-center text-[9px] font-black rounded px-1 py-0.5 uppercase border ${blocRef ? 'text-violet-600 bg-violet-50 border-violet-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>{blocRef ? 'bloc' : (article ? normalizeUnitSymbol(article.unit) : '—')}</span>
                                {!isAggregate && !blocRef && (
                                <>
                                {/* Épaisseur */}
                                <div className="w-16 flex justify-center">
                                  {wantEp ? (
                                    <input
                                      type="number" step="0.01" min="0" inputMode="decimal"
                                      value={a.epaisseur ?? ''}
                                      onChange={(e) => setArticle(idx, { epaisseur: e.target.value })}
                                      placeholder="0.00"
                                      className="w-14 text-center text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-1 outline-none focus:border-emerald-400 focus:bg-white"
                                    />
                                  ) : <span className="text-slate-300 text-xs">—</span>}
                                </div>
                                {/* Densité */}
                                <div className="w-16 flex justify-center">
                                  {wantD ? (
                                    <input
                                      type="number" step="0.01" min="0" inputMode="decimal"
                                      value={a.densite ?? ''}
                                      onChange={(e) => setArticle(idx, { densite: e.target.value })}
                                      placeholder="t/m³"
                                      className="w-14 text-center text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-1 outline-none focus:border-emerald-400 focus:bg-white"
                                    />
                                  ) : <span className="text-slate-300 text-xs">—</span>}
                                </div>
                                {/* Perte (%) — tous articles */}
                                <div className="w-14 flex justify-center">
                                  {article ? (
                                    <input
                                      type="number" step="1" min="0" inputMode="decimal"
                                      value={a.perte ?? ''}
                                      onChange={(e) => setArticle(idx, { perte: e.target.value })}
                                      placeholder="0"
                                      title="Coefficient de perte en % (chutes, foisonnement)"
                                      className="w-12 text-center text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-1 outline-none focus:border-amber-400 focus:bg-white"
                                    />
                                  ) : <span className="text-slate-300 text-xs">—</span>}
                                </div>
                                <span className="w-20 text-right text-[11px] font-black text-emerald-700">{formatPrice(contrib)}</span>
                                </>
                                )}
                                <div className="w-8 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => removeArticle(idx)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><X size={13} /></button>
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

                {/* Total — blocs formule uniquement (un agrégat n'a pas de PU unique) */}
                {!isAggregate && draft.articles.length > 0 && (
                  <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Prix du bloc</span>
                    <span className="text-sm font-black text-emerald-700">{formatPrice(draftPrice)} <span className="text-emerald-400 text-xs">/ {blocUnitLabel}</span></span>
                  </div>
                )}
              </div>

              {/* Ajout d'articles */}
              <div className="w-96 flex flex-col overflow-hidden bg-white shrink-0">
                <div className="p-4 border-b border-slate-100 space-y-2">
                  {isAggregate && (
                    <div className="grid grid-cols-2 bg-slate-100 rounded-lg p-0.5 gap-0.5">
                      <button onClick={() => setAddMode('articles')} className={`py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${!showBlocs ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>Articles</button>
                      <button onClick={() => setAddMode('blocs')} className={`py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${showBlocs ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>Blocs</button>
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={showBlocs ? 'Rechercher un bloc à ajouter…' : 'Rechercher un article à ajouter…'}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {showBlocs ? (
                    <>
                      {availableBlocs.map(b => (
                        <button
                          key={b.id}
                          onClick={() => addBlocRef(b.id)}
                          title={`Imbriquer le bloc « ${b.name} »`}
                          className="w-full group relative flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-violet-400 hover:shadow-md hover:bg-violet-50/30 cursor-pointer transition-all duration-200 active:scale-[0.98] text-left"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Boxes size={15} className="text-violet-400 shrink-0 ml-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-700 uppercase leading-snug group-hover:text-violet-800 line-clamp-2 transition-colors">{b.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">{getBlocArticles(b).length} art. · {getBlocKind(b) === 'aggregate' ? 'agrégat' : 'formule'}</p>
                          </div>
                        </button>
                      ))}
                      {availableBlocs.length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-[11px] italic">{search ? 'Aucun bloc trouvé.' : 'Aucun autre bloc à imbriquer.'}</div>
                      )}
                      {availableBlocsTotal > LIST_CAP && (
                        <div className="p-2 text-center text-slate-400 text-[10px] italic">{availableBlocsTotal - LIST_CAP} autre(s) bloc(s) — affinez la recherche</div>
                      )}
                    </>
                  ) : (
                    <>
                      {available.map(item => (
                        <button
                          key={item.id}
                          onClick={() => addArticle(item.id)}
                          title={`Ajouter « ${cleanText(item.designation)} » au bloc`}
                          className="w-full group relative flex items-start justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-emerald-400 hover:shadow-md hover:bg-emerald-50/30 cursor-pointer transition-all duration-200 active:scale-[0.98] text-left"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1 min-w-0 pr-2 pl-1.5">
                            <p className="text-[10px] font-bold text-slate-700 uppercase leading-snug group-hover:text-emerald-800 line-clamp-2 transition-colors">{cleanText(item.designation)}</p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            <span className="text-[10px] font-black text-emerald-700 font-mono bg-emerald-100/50 border border-emerald-100 px-2 py-0.5 rounded shadow-sm group-hover:bg-emerald-200 group-hover:text-emerald-900 transition-colors">{formatPrice(item.price)}</span>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">{normalizeUnitSymbol(item.unit)}</span>
                          </div>
                        </button>
                      ))}
                      {available.length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-[11px] italic">{search ? 'Aucun article trouvé.' : 'Tous les articles sont déjà dans le bloc.'}</div>
                      )}
                      {availableTotal > LIST_CAP && (
                        <div className="p-2 text-center text-slate-400 text-[10px] italic">{availableTotal - LIST_CAP} autre(s) article(s) — affinez la recherche</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

BlocsPanel.propTypes = {
  blocs: PropTypes.array,
  fullBpu: PropTypes.array,
  units: PropTypes.array,
  addBloc: PropTypes.func.isRequired,
  updateBloc: PropTypes.func.isRequired,
  deleteBloc: PropTypes.func.isRequired,
  dragEndRef: PropTypes.shape({ current: PropTypes.any }),
};

export default BlocsPanel;
