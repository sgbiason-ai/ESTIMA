// src/views/estimaTp/ressources/TpResourcesTab.jsx
// ESTIMA TP — bibliothèque commune de ressources : une seule liste, chaque ligne
// porte sa catégorie (poste). Réutilisable dans les sous-détails (volet latéral).
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, Search, Package, Download, Upload, ChevronDown } from 'lucide-react';
import { useTpResources, emptyResource } from '../../../hooks/useTpResources';
import { POSTES, POSTE_LABELS, ressourceDailyCost } from '../../../utils/tp/tpPriceCompute';
import { NumCell, TxtCell } from '../sousDetail/sdShared';
import { useToast } from '../../../contexts/ToastContext';
import { useDialog } from '../../../contexts/DialogContext';

const removeAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RENDER_CAP = 200; // évite de monter des milliers de lignes éditables d'un coup

const CAT_BADGE = {
  materiel: 'bg-orange-100 text-orange-700', mo: 'bg-blue-100 text-blue-700',
  fourniture: 'bg-emerald-100 text-emerald-700', soustraitance: 'bg-violet-100 text-violet-700',
  transport: 'bg-sky-100 text-sky-700',
};

export default function TpResourcesTab({ companyId }) {
  const { resources, loading, saveResource, deleteResource, importResources, mergeResources } = useTpResources(companyId);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(null); // catégorie en cours d'export
  const fileRef = useRef(null);      // import « barème fournisseur » (remplace tout)
  const typeFileRef = useRef(null);  // import « par type » (fusion sans doublon)
  const toast = useToast();
  const { confirm } = useDialog();

  // Compteur de ressources par catégorie (badges du menu Exporter)
  const counts = useMemo(() => {
    const c = {};
    resources.forEach(r => { c[r.category] = (c[r.category] || 0) + 1; });
    return c;
  }, [resources]);

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
      if (counts.fourniture) parts.push(`${counts.fourniture} fournitures`);
      if (counts.soustraitance) parts.push(`${counts.soustraitance} sous-traitance`);
      if (counts.materiel) parts.push(`${counts.materiel} matériel`);
      if (counts.mo) parts.push(`${counts.mo} MO`);
      if (counts.transport) parts.push(`${counts.transport} transport`);
      toast.success(`${n} ressources importées${parts.length ? ` (${parts.join(', ')})` : ''}${skipped ? ` — ${skipped} ignorée(s)` : ''}.`);
    } catch (err) {
      console.error('[ESTIMA TP] Import barème échoué:', err);
      toast.error('Impossible de lire le fichier. Vérifiez le format Excel.');
    } finally {
      setImporting(false);
    }
  };

  // Export d'UN type → fichier .xlsx dédié (colonnes adaptées au poste).
  const handleExportType = async (category) => {
    if (!counts[category]) { toast.error(`Aucune ressource « ${POSTE_LABELS[category]} » à exporter.`); return; }
    setExporting(category);
    try {
      const { exportBaremeType } = await import('../../../utils/tp/tpBaremeTypeXlsx');
      const n = await exportBaremeType(category, resources);
      toast.success(`${n} ressource(s) « ${POSTE_LABELS[category]} » exportée(s).`);
    } catch (err) {
      console.error('[ESTIMA TP] Export barème par type échoué:', err);
      toast.error("Export impossible. Réessayez.");
    } finally {
      setExporting(null);
    }
  };

  // Import par type → fusion sans doublon (clé = catégorie + désignation).
  const handleImportType = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;
    setImporting(true);
    try {
      const { parseBaremeTypeXlsx } = await import('../../../utils/tp/tpBaremeTypeXlsx');
      const { category, resources: list, error } = await parseBaremeTypeXlsx(file);
      if (error) { toast.error(error); return; }
      if (!list.length) { toast.error('Aucune ressource trouvée dans le fichier.'); return; }
      const { added, updated } = await mergeResources(list);
      toast.success(`${POSTE_LABELS[category]} : ${added} ajoutée(s), ${updated} mise(s) à jour.`);
    } catch (err) {
      console.error('[ESTIMA TP] Import barème par type échoué:', err);
      toast.error('Impossible de lire le fichier. Vérifiez le format .xlsx.');
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
    <div className="flex-1 min-h-0 flex flex-col bg-[#f5f5f7]">
      {/* En-tête figé : filtres + recherche + actions (reste visible au défilement) */}
      {/* relative z-30 : garde les menus déroulants au-dessus de la liste qui suit dans le DOM */}
      <div className="shrink-0 relative z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-xl">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Tout</FilterBtn>
            {POSTES.map(p => <FilterBtn key={p} active={filter === p} onClick={() => setFilter(p)}>{POSTE_LABELS[p]}</FilterBtn>)}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400" />
          </div>
          {/* Exporter — un fichier .xlsx par type */}
          <ActionMenu label="Exporter" icon={Download} busy={!!exporting}>
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Barème par type (.xlsx)</div>
            {POSTES.map(p => (
              <MenuItem key={p} onClick={() => handleExportType(p)} disabled={!counts[p]}>
                <span>{POSTE_LABELS[p]}</span>
                <span className="text-xs font-mono text-gray-400">{counts[p] || 0}</span>
              </MenuItem>
            ))}
          </ActionMenu>

          {/* Importer — par type (fusion) ou barème fournisseur (remplace tout) */}
          <ActionMenu label="Importer" icon={Upload} busy={importing}>
            <MenuItem onClick={() => typeFileRef.current?.click()} disabled={importing}>
              <span className="flex flex-col">
                <span>Fichier par type (.xlsx)</span>
                <span className="text-[11px] text-gray-400">Fusion sans doublon</span>
              </span>
            </MenuItem>
            <div className="my-1 border-t border-gray-100" />
            <MenuItem onClick={() => fileRef.current?.click()} disabled={importing}>
              <span className="flex flex-col">
                <span>Barème fournisseur…</span>
                <span className="text-[11px] text-gray-400">Remplace toute la bibliothèque</span>
              </span>
            </MenuItem>
          </ActionMenu>

          <button onClick={() => saveResource(emptyResource(filter === 'all' ? 'materiel' : filter))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all shadow-sm">
            <Plus size={15} /> Ajouter
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          <input ref={typeFileRef} type="file" accept=".xlsx" onChange={handleImportType} className="hidden" />
        </div>
      </div>

      {/* Liste défilante */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] text-gray-400 mb-2.5">Bibliothèque commune de ressources, réutilisable dans les sous-détails (volet « Bibliothèque » à gauche). Chaque ressource a une catégorie.</p>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={26} className="animate-spin text-orange-500" /></div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 bg-white/60 border border-dashed border-gray-200 rounded-2xl text-center px-6">
              <div className="p-4 rounded-2xl bg-orange-50 mb-3"><Package size={26} className="text-orange-500" /></div>
              <p className="text-sm font-semibold text-gray-700">Bibliothèque vide</p>
              <p className="text-xs text-gray-400 mt-1">Cliquez « Ajouter » pour créer une ressource (choisissez sa catégorie).</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {list.slice(0, RENDER_CAP).map(r => (
                  <ResourceRow key={r.id} r={r} upd={(p) => upd(r, p)} del={() => deleteResource(r.id)} badge={CAT_BADGE[r.category]} />
                ))}
              </div>
              {list.length > RENDER_CAP && (
                <p className="text-center text-xs text-gray-400 py-3">
                  {list.length.toLocaleString('fr-FR')} ressources — affichage des {RENDER_CAP} premières. Filtrez par catégorie ou recherchez pour affiner.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ r, upd, del, badge }) {
  const isRes = r.category === 'materiel' || r.category === 'mo';
  const isPrix = r.category === 'fourniture' || r.category === 'soustraitance';
  const isTransport = r.category === 'transport';
  return (
    <div className="group bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 flex-wrap">
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
        <Labeled label="Perso."><Num v={r.puJour} on={(v) => upd({ puJour: v })} /></Labeled>
        <Labeled label="Amort."><Num v={r.amort} on={(v) => upd({ amort: v })} /></Labeled>
        <Labeled label="Entret."><Num v={r.entret} on={(v) => upd({ entret: v })} /></Labeled>
        <Labeled label="Cons."><Num v={r.cons} on={(v) => upd({ cons: v })} /></Labeled>
        <Labeled label="Loc."><Num v={r.loc} on={(v) => upd({ loc: v })} /></Labeled>
        <Labeled label="PU/J">
          <div className="w-[72px] text-right text-sm font-mono font-black text-orange-700 px-1 py-0.5" title="Coût journalier = Perso. + Amort. + Entret. + Cons. + Loc.">
            {ressourceDailyCost(r).toLocaleString('fr-FR')}
          </div>
        </Labeled>
      </>}
      {isPrix && <Labeled label="PU barème"><Num v={r.puBareme} on={(v) => upd({ puBareme: v })} /></Labeled>}
      {isTransport && <>
        <Labeled label="Contenance"><Num v={r.contenance} on={(v) => upd({ contenance: v })} /></Labeled>
        <Labeled label="Coût/j"><Num v={r.coutJour} on={(v) => upd({ coutJour: v })} /></Labeled>
      </>}
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

// Menu déroulant léger (bouton + liste). Se ferme au clic extérieur ou sur un item.
function ActionMenu({ label, icon: Icon, busy = false, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200/60 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm">
        {busy ? <Loader2 size={15} className="animate-spin text-orange-500" /> : (Icon && <Icon size={15} />)}
        {label}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 min-w-[230px] bg-white border border-gray-200 rounded-xl shadow-lg py-1"
            onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ onClick, disabled = false, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-between gap-4 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
      {children}
    </button>
  );
}
