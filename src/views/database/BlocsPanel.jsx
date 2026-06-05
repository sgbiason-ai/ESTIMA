// src/views/database/BlocsPanel.jsx
// Gestion des "blocs" = ouvrages composites. Chaque bloc a une UNITÉ ; chaque
// article composant est ramené à cette unité via épaisseur/densité (voir blocPricing).
// Utilisé dans la Bibliothèque (DatabaseView) via le toggle Articles / Blocs.
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Boxes, Plus, Trash2, Search, X, Save, ArrowUp, ArrowDown,
  Package, AlertTriangle, Layers,
} from 'lucide-react';
import { formatPrice, cleanText, normalizeUnitSymbol } from '../../utils/helpers';
import {
  getBlocArticles, blocUnitPrice, articleContribution, needsThickness, needsDensity,
} from '../../utils/blocPricing';
import { useDialog } from '../../contexts/DialogContext';

const BlocsPanel = ({ blocs = [], fullBpu = [], units = [], addBloc, updateBloc, deleteBloc }) => {
  const { confirm } = useDialog();

  // Lookup rapide article par id
  const bpuById = useMemo(() => {
    const map = {};
    (fullBpu || []).forEach(i => { map[String(i.id)] = i; });
    return map;
  }, [fullBpu]);

  // Sélection / brouillon d'édition. Composant = { id, epaisseur, densite }.
  const NEW = '__new__';
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ name: '', unit: '', articles: [] });
  const [search, setSearch] = useState('');

  // Charge le brouillon quand on change de bloc sélectionné
  useEffect(() => {
    if (selectedId === NEW) {
      setDraft({ name: '', unit: '', articles: [] });
    } else if (selectedId) {
      const b = blocs.find(x => x.id === selectedId);
      if (b) setDraft({ name: b.name || '', unit: b.unit || '', articles: getBlocArticles(b).map(a => ({ ...a })) });
    }
    setSearch('');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = selectedId != null;
  const currentBloc = selectedId && selectedId !== NEW ? blocs.find(b => b.id === selectedId) : null;
  const isDirty = selectedId === NEW
    ? (draft.name.trim() !== '' || draft.articles.length > 0)
    : currentBloc && (
        draft.name !== currentBloc.name ||
        draft.unit !== (currentBloc.unit || '') ||
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

  const addArticle = (id) => setDraft(d => ({ ...d, articles: [...d.articles, { id: String(id), epaisseur: '', densite: '' }] }));
  const removeArticle = (idx) => setDraft(d => ({ ...d, articles: d.articles.filter((_, i) => i !== idx) }));
  const setArticle = (idx, patch) => setDraft(d => ({ ...d, articles: d.articles.map((a, i) => i === idx ? { ...a, ...patch } : a) }));
  const move = (idx, dir) => setDraft(d => {
    const arr = [...d.articles];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return d;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return { ...d, articles: arr };
  });

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) return;
    if (selectedId === NEW) {
      const created = await addBloc(name, draft.unit, draft.articles);
      if (created) setSelectedId(created.id);
    } else {
      await updateBloc(selectedId, { name, unit: draft.unit, articles: draft.articles });
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    const ok = await confirm('Supprimer ce bloc ? Les articles de la bibliothèque ne sont pas affectés.', { title: 'Supprimer le bloc', danger: true, confirmLabel: 'Supprimer' });
    if (!ok) return;
    await deleteBloc(id);
    if (selectedId === id) setSelectedId(null);
  };

  const blocUnitLabel = draft.unit ? normalizeUnitSymbol(draft.unit) : 'unité';

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-50">
      {/* ── Colonne gauche : liste des blocs ── */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-black text-xs uppercase text-slate-500 tracking-widest mb-3 flex items-center gap-2">
            <Boxes size={14} /> Blocs ({blocs.length})
          </h3>
          <button
            onClick={() => setSelectedId(NEW)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
          >
            <Plus size={14} /> Nouveau bloc
          </button>
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
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-600">
              <Plus size={16} /><span className="text-xs font-bold italic">Nouveau bloc…</span>
            </div>
          )}

          {[...blocs].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr')).map(b => {
            const count = getBlocArticles(b).length;
            const active = selectedId === b.id;
            const u = b.unit ? normalizeUnitSymbol(b.unit) : '';
            return (
              <div
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${active ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-500'}`}>
                  <Boxes size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate uppercase tracking-tight">{b.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{count} art. · {formatPrice(blocUnitPrice(b, bpuById))}{u ? `/${u}` : ''}</p>
                </div>
                <button onClick={(e) => handleDelete(b.id, e)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
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
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0"><Boxes size={18} /></div>
              <input
                autoFocus
                type="text"
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="Nom du bloc (ex : Voirie légère en granulaire)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-colors uppercase tracking-tight"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <div className="flex flex-col shrink-0">
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 ml-1">Unité du bloc</label>
                <select
                  value={draft.unit}
                  onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors uppercase cursor-pointer min-w-[110px]"
                >
                  <option value="">— choisir —</option>
                  {(units || []).map(u => <option key={u.symbol} value={u.symbol}>{normalizeUnitSymbol(u.symbol)} — {u.label}</option>)}
                </select>
              </div>
              <button
                onClick={handleSave}
                disabled={!draft.name.trim() || !isDirty}
                className="flex items-center gap-2 px-4 py-2 mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95"
              >
                <Save size={14} /> {selectedId === NEW ? 'Créer' : 'Enregistrer'}
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Table des articles du bloc */}
              <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
                <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><Package size={13} /> Composition ({draft.articles.length})</span>
                  <span className="text-xs font-black text-indigo-700">{formatPrice(draftPrice)} <span className="text-slate-400 font-bold">/ {blocUnitLabel}</span></span>
                </div>

                {/* En-tête de colonnes */}
                {draft.articles.length > 0 && (
                  <div className="px-4 py-2 flex items-center gap-2 bg-white border-b border-slate-100 text-[8px] font-black uppercase tracking-widest text-slate-400">
                    <span className="w-5 text-center">#</span>
                    <span className="flex-1">Article</span>
                    <span className="w-10 text-center">U</span>
                    <span className="w-16 text-center">Ép. (m)</span>
                    <span className="w-16 text-center">Densité</span>
                    <span className="w-20 text-right">→ /{blocUnitLabel}</span>
                    <span className="w-14" />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {draft.articles.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs italic">Ajoutez des articles depuis la liste de droite →</div>
                  )}
                  {draft.articles.map((a, idx) => {
                    const article = bpuById[String(a.id)];
                    const wantEp = article && needsThickness(article.unit);
                    const wantD = article && needsDensity(article.unit);
                    const contrib = article ? articleContribution(article, a.epaisseur, a.densite) : 0;
                    return (
                      <div key={`${a.id}-${idx}`} className="group flex items-center gap-2 px-2 py-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-all">
                        <span className="w-5 text-center text-[10px] font-black text-slate-400">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          {article ? (
                            <>
                              <p className="text-[11px] font-bold text-slate-800 uppercase truncate tracking-tight leading-tight">{cleanText(article.designation)}</p>
                              <p className="text-[9px] text-slate-400 font-bold">{formatPrice(article.price)}/{normalizeUnitSymbol(article.unit)}</p>
                            </>
                          ) : (
                            <p className="text-[11px] font-bold text-amber-600 italic flex items-center gap-1"><AlertTriangle size={12} /> Article introuvable</p>
                          )}
                        </div>
                        <span className="w-10 text-center text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1 py-0.5 uppercase">{article ? normalizeUnitSymbol(article.unit) : '—'}</span>
                        {/* Épaisseur */}
                        <div className="w-16 flex justify-center">
                          {wantEp ? (
                            <input
                              type="number" step="0.01" min="0" inputMode="decimal"
                              value={a.epaisseur ?? ''}
                              onChange={(e) => setArticle(idx, { epaisseur: e.target.value })}
                              placeholder="0.00"
                              className="w-14 text-center text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-1 outline-none focus:border-indigo-400 focus:bg-white"
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
                              className="w-14 text-center text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-1 outline-none focus:border-indigo-400 focus:bg-white"
                            />
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </div>
                        <span className="w-20 text-right text-[11px] font-black text-indigo-700">{formatPrice(contrib)}</span>
                        <div className="w-14 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-20"><ArrowUp size={13} /></button>
                          <button onClick={() => move(idx, 1)} disabled={idx === draft.articles.length - 1} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-20"><ArrowDown size={13} /></button>
                          <button onClick={() => removeArticle(idx)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><X size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                {draft.articles.length > 0 && (
                  <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Prix du bloc</span>
                    <span className="text-sm font-black text-indigo-700">{formatPrice(draftPrice)} <span className="text-indigo-400 text-xs">/ {blocUnitLabel}</span></span>
                  </div>
                )}
              </div>

              {/* Ajout d'articles */}
              <div className="w-72 flex flex-col overflow-hidden bg-white shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un article à ajouter…"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {available.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addArticle(item.id)}
                      className="w-full group flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left active:scale-[0.98]"
                    >
                      <Plus size={14} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-700 uppercase truncate leading-snug group-hover:text-indigo-800">{cleanText(item.designation)}</p>
                      </div>
                      <span className="text-[9px] font-black text-slate-500 shrink-0">{normalizeUnitSymbol(item.unit)}</span>
                      <span className="text-[10px] font-black text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded shrink-0">{formatPrice(item.price)}</span>
                    </button>
                  ))}
                  {available.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-[11px] italic">{search ? 'Aucun article trouvé.' : 'Tous les articles sont déjà dans le bloc.'}</div>
                  )}
                  {availableTotal > LIST_CAP && (
                    <div className="p-2 text-center text-slate-400 text-[10px] italic">{availableTotal - LIST_CAP} autre(s) article(s) — affinez la recherche</div>
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
};

export default BlocsPanel;
