// src/views/estimaTp/ressources/TpResourcesTab.jsx
// ESTIMA TP — bibliothèque commune de ressources : une seule liste, chaque ligne
// porte sa catégorie (poste). Réutilisable dans les sous-détails (volet latéral).
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, Search, Package, FileSpreadsheet } from 'lucide-react';
import { useTpResources, emptyResource } from '../../../hooks/useTpResources';
import { POSTES, POSTE_LABELS } from '../../../utils/tp/tpPriceCompute';
import { NumCell, TxtCell } from '../sousDetail/sdShared';
import { useToast } from '../../../contexts/ToastContext';
import { useDialog } from '../../../contexts/DialogContext';

const removeAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CAT_BADGE = {
  materiel: 'bg-orange-100 text-orange-700', mo: 'bg-blue-100 text-blue-700',
  fourniture: 'bg-emerald-100 text-emerald-700', soustraitance: 'bg-violet-100 text-violet-700',
  transport: 'bg-sky-100 text-sky-700',
};

export default function TpResourcesTab({ companyId }) {
  const { resources, loading, saveResource, deleteResource, importResources } = useTpResources(companyId);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();
  const { confirm } = useDialog();

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;
    const ok = await confirm(
      `Importer ce barème REMPLACERA toute la bibliothèque actuelle (${resources.length} ressource(s)).\n\nContinuer ?`,
      { title: 'Importer un barème Excel', danger: true, confirmLabel: 'Remplacer et importer' }
    );
    if (!ok) return;
    setImporting(true);
    try {
      const { parseBaremeExcel } = await import('../../../utils/tp/tpBaremeImport');
      const { resources: list, counts, skipped } = await parseBaremeExcel(file);
      if (list.length === 0) {
        toast.error('Aucune ressource reconnue. Vérifiez les colonnes (Type, Libellé, U…).');
        return;
      }
      const n = await importResources(list, { replace: true });
      const parts = [];
      if (counts.FOU) parts.push(`${counts.FOU} fournitures`);
      if (counts.ST) parts.push(`${counts.ST} sous-traitance`);
      if ((counts.MA || 0) + (counts.LOC || 0)) parts.push(`${(counts.MA || 0) + (counts.LOC || 0)} matériel`);
      if (counts.MO) parts.push(`${counts.MO} MO`);
      toast.success(`${n} ressources importées${parts.length ? ` (${parts.join(', ')})` : ''}${skipped ? ` — ${skipped} ignorée(s)` : ''}.`);
    } catch (err) {
      console.error('[ESTIMA TP] Import barème échoué:', err);
      toast.error('Impossible de lire le fichier. Vérifiez le format Excel.');
    } finally {
      setImporting(false);
    }
  };

  const list = useMemo(() => {
    let l = filter === 'all' ? resources : resources.filter(r => r.category === filter);
    if (search.trim()) { const q = removeAccents(search); l = l.filter(r => removeAccents(r.designation).includes(q)); }
    return [...l].sort((a, b) => POSTES.indexOf(a.category) - POSTES.indexOf(b.category) || (a.designation || '').localeCompare(b.designation || '', 'fr'));
  }, [resources, filter, search]);

  const upd = (r, patch) => saveResource({ ...r, ...patch });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-4xl mx-auto space-y-4">
        <p className="text-xs text-gray-400">Bibliothèque commune de ressources, réutilisable dans les sous-détails (volet « Bibliothèque » à gauche). Chaque ressource a une catégorie.</p>

        {/* Barre : filtre + recherche + ajout */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Tout</FilterBtn>
            {POSTES.map(p => <FilterBtn key={p} active={filter === p} onClick={() => setFilter(p)}>{POSTE_LABELS[p]}</FilterBtn>)}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400" />
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50">
            {importing ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            {importing ? 'Import…' : 'Importer un barème'}
          </button>
          <button onClick={() => saveResource(emptyResource(filter === 'all' ? 'materiel' : filter))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all shadow-sm">
            <Plus size={16} /> Ajouter
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={26} className="animate-spin text-orange-500" /></div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 bg-white/60 border border-dashed border-gray-200 rounded-2xl text-center px-6">
            <div className="p-4 rounded-2xl bg-orange-50 mb-3"><Package size={26} className="text-orange-500" /></div>
            <p className="text-sm font-semibold text-gray-700">Bibliothèque vide</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez « Ajouter » pour créer une ressource (choisissez sa catégorie).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map(r => (
              <ResourceRow key={r.id} r={r} upd={(p) => upd(r, p)} del={() => deleteResource(r.id)} badge={CAT_BADGE[r.category]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceRow({ r, upd, del, badge }) {
  const isFourn = r.category === 'fourniture';
  const isST = r.category === 'soustraitance';
  const isRes = !isFourn && !isST;
  return (
    <div className="group bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
      {/* Catégorie */}
      <select value={r.category} onChange={(e) => upd({ category: e.target.value })}
        className={`shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-lg px-2 py-1 border-0 outline-none cursor-pointer ${badge}`}>
        {POSTES.map(p => <option key={p} value={p}>{POSTE_LABELS[p]}</option>)}
      </select>
      {/* Désignation */}
      <div className="flex-1 min-w-[160px]">
        <TxtCell value={r.designation} onCommit={(v) => upd({ designation: v })} placeholder="Désignation" className="font-semibold text-slate-800" />
      </div>
      {/* Unité */}
      <Labeled label="U"><div className="w-12"><TxtCell value={r.unit} upper onCommit={(v) => upd({ unit: v })} className="text-center" /></div></Labeled>
      {/* Coûts selon catégorie */}
      {isRes && <>
        <Labeled label="PU/J"><Num v={r.puJour} on={(v) => upd({ puJour: v })} /></Labeled>
        <Labeled label="Amort."><Num v={r.amort} on={(v) => upd({ amort: v })} /></Labeled>
        <Labeled label="Entret."><Num v={r.entret} on={(v) => upd({ entret: v })} /></Labeled>
        <Labeled label="Cons."><Num v={r.cons} on={(v) => upd({ cons: v })} /></Labeled>
        <Labeled label="Loc."><Num v={r.loc} on={(v) => upd({ loc: v })} /></Labeled>
      </>}
      {isFourn && <>
        <Labeled label="Épaiss."><Num v={r.epaisseur} on={(v) => upd({ epaisseur: v })} ph="—" /></Labeled>
        <Labeled label="Densité"><Num v={r.densite} on={(v) => upd({ densite: v })} ph="—" /></Labeled>
        <Labeled label="PU barème"><Num v={r.puBareme} on={(v) => upd({ puBareme: v })} /></Labeled>
      </>}
      {isST && <Labeled label="PU barème"><Num v={r.puBareme} on={(v) => upd({ puBareme: v })} /></Labeled>}
      <button onClick={del} className="shrink-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
    </div>
  );
}

const Num = ({ v, on, ph = '0' }) => <div className="w-[68px]"><NumCell value={v} onCommit={on} placeholder={ph} /></div>;
const Labeled = ({ label, children }) => (
  <div className="shrink-0 flex flex-col items-end">
    <span className="text-[8px] font-bold uppercase tracking-wide text-slate-400 pr-0.5">{label}</span>
    {children}
  </div>
);

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
      {children}
    </button>
  );
}
