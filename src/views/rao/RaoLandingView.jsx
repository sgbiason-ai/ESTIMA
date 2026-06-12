import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, BarChart3, Folder, FolderOpen, MapPin, Clock,
  FileSpreadsheet, FilePlus2, ChevronRight, Loader2, Trash2, X,
  CheckSquare, Square, Building2, TrendingDown, TrendingUp,
  LayoutGrid, List, BarChartHorizontal,
} from 'lucide-react';
import { collection, getDocs, doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDialog } from '../../contexts/DialogContext';
import { useToast } from '../../contexts/ToastContext';
import { computeQtyMaps } from '../../utils/projectCalculations';
import { computeChaptersData, computeAnalysisStats } from '../../utils/analysisCompute';

const removeAccents = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const formatMoney = (n) =>
  `${Math.round(n || 0).toLocaleString('fr-FR')} €`;

const formatPct = (v) => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${sign}${Math.abs(v).toFixed(1).replace('.', ',')} %`;
};

// Couleurs rotatives des pastilles entreprises (initiales)
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

const initials = (name) => {
  const words = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || '?').slice(0, 2).toUpperCase();
};

// Clé localStorage du mode d'affichage de la landing (cartes / liste / barres)
const VIEW_KEY = 'estima_rao_landing_view';

// Grille partagée entre l'en-tête et les lignes du mode liste
const LIST_GRID = 'grid grid-cols-[minmax(0,2.4fr)_70px_110px_140px_90px_100px_64px] gap-3 items-center';

const getItems = (chapters) => {
  const items = [];
  const traverse = (nodes) => {
    (nodes || []).forEach(n => {
      if (n.type === 'item') items.push(n);
      else if (n.children) traverse(n.children);
    });
  };
  traverse(chapters || []);
  return items;
};

// Synthèse financière d'un RAO : mêmes fonctions pures que la vue d'analyse
// (computeQtyMaps → computeChaptersData → computeAnalysisStats), tranche "global".
function computeRaoSummary(proj, companies) {
  const base = { count: companies.length, names: companies.map(c => c.name || '?') };
  try {
    const tranches = proj.tranches || [];
    const { clientQtyMaps } = computeQtyMaps(
      getItems(proj.chapters),
      tranches.length > 0,
      tranches,
      proj.clientPercent !== undefined ? Number(proj.clientPercent) : (proj.isDqeImport ? 0 : 10),
      Number(proj.clientQtyThreshold ?? 20)
    );
    const chaptersData = computeChaptersData(proj, companies, clientQtyMaps.global || {});
    const stats = computeAnalysisStats(chaptersData, companies, proj.scoringConfig);
    const offers = companies
      .map(c => ({ name: c.name || 'Entreprise', total: stats.companiesTotals[c.id] || 0 }))
      .filter(t => t.total > 0)
      .sort((a, b) => a.total - b.total);
    const best = offers[0] || null;
    const ecartPct = best && stats.totalEstimation > 0
      ? ((best.total - stats.totalEstimation) / stats.totalEstimation) * 100
      : null;
    return { ...base, totalEstimation: stats.totalEstimation, best, ecartPct, offers };
  } catch (e) {
    console.error('[RaoLanding] Erreur calcul synthèse:', e);
    return { ...base, totalEstimation: 0, best: null, ecartPct: null, offers: [] };
  }
}

export default function RaoLandingView({
  companyId,
  onSelectProject,
  onNewRao,
  onImportDqe,
  importing = false,
}) {
  const { confirm } = useDialog();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [raoProjectIds, setRaoProjectIds] = useState(new Set());
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'estima' | 'rao'
  // Mode d'affichage : 'cards' (A) | 'list' (B) | 'bars' (C) — mémorisé
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'cards'; } catch { return 'cards'; }
  });
  const changeView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_KEY, mode); } catch { /* ignore */ }
  };
  const [deletingId, setDeletingId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Multi-sélection des RAO autonomes pour suppression groupée
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'companies', companyId, 'projects'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.id !== 'draft_project')
          .sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));

        if (!cancelled) setProjects(list);

        // Détection RAO actif + synthèse financière via analysis/data
        const ids = new Set();
        const sums = {};
        await Promise.all(list.map(async (proj) => {
          try {
            const s = await getDoc(doc(db, 'companies', companyId, 'projects', proj.id, 'analysis', 'data'));
            const companies = s.exists() ? (s.data()?.companies || []) : [];
            if (companies.length > 0) {
              ids.add(proj.id);
              sums[proj.id] = computeRaoSummary(proj, companies);
            }
          } catch { /* ignore */ }
        }));
        if (!cancelled) {
          setRaoProjectIds(ids);
          setSummaries(sums);
        }
      } catch (e) {
        console.error('[RaoLanding] Erreur chargement:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [companyId]);

  // Classification ESTIMA vs RAO autonome
  const isRaoStandalone = (p) => p.isDqeImport === true || (p.id || '').startsWith('rao_');

  // Seuls les RAO sont visibles : autonomes (toujours) + projets ESTIMA avec RAO actif
  const visible = useMemo(
    () => projects.filter(p => isRaoStandalone(p) || raoProjectIds.has(p.id)),
    [projects, raoProjectIds]
  );

  // Projets ESTIMA sans RAO — accessibles via la modale "Reprendre un projet ESTIMA"
  const estimaCandidates = useMemo(
    () => projects.filter(p => !isRaoStandalone(p) && !raoProjectIds.has(p.id)),
    [projects, raoProjectIds]
  );

  // ─── Multi-sélection ────────────────────────────────────────────────────
  const toggleSelect = (projectId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAllStandalone = () => {
    const ids = visible.filter(isRaoStandalone).map(p => p.id);
    setSelectedIds(new Set(ids));
  };

  // Suppression d'un RAO AUTONOME : efface tout le document projet (il n'existe
  // que pour porter le RAO). Sans toast ni confirmation — utilisé par bulk + single.
  const deleteStandaloneRao = async (project) => {
    await Promise.allSettled([
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'analysis', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'rao', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'branding', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'metadata', 'data')),
    ]);
    await deleteDoc(doc(db, 'companies', companyId, 'projects', project.id));
  };

  // Suppression du RAO d'un projet ESTIMA : on retire UNIQUEMENT l'analyse des
  // offres (analysis/data + rao/data) et le flag dénormalisé hasRao. Le projet
  // ESTIMA et son estimation sont conservés (toujours accessibles dans le Workspace).
  const deleteEstimaRaoAnalysis = async (project) => {
    await Promise.allSettled([
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'analysis', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'rao', 'data')),
    ]);
    // Réinitialiser le flag lu par le Workspace (pastille RAO) — best effort.
    try {
      await setDoc(doc(db, 'companies', companyId, 'projects', project.id), { hasRao: false }, { merge: true });
    } catch (e) { console.warn('[RaoLanding] flag hasRao non réinitialisé:', e?.message); }
  };

  const handleBulkDelete = async () => {
    const toDelete = projects.filter(p => selectedIds.has(p.id) && isRaoStandalone(p));
    if (toDelete.length === 0) return;

    const ok = await confirm(
      `Supprimer définitivement ${toDelete.length} RAO autonome${toDelete.length > 1 ? 's' : ''} ?\n\n${
        toDelete.map(p => `• ${p.name || 'Sans nom'}`).join('\n')
      }\n\nCette action est irréversible. Toutes les offres, variantes et analyses associées seront perdues.`,
      { title: 'Suppression groupée', danger: true, confirmLabel: `Supprimer ${toDelete.length} RAO` }
    );
    if (!ok) return;

    setBulkDeleting(true);
    let okCount = 0, errCount = 0;
    try {
      await Promise.all(toDelete.map(async (p) => {
        try { await deleteStandaloneRao(p); okCount++; }
        catch (e) { console.error(`[RaoLanding] Erreur suppression ${p.id}:`, e); errCount++; }
      }));

      const deletedIds = new Set(toDelete.filter((_, i) => i < okCount).map(p => p.id));
      setProjects(prev => prev.filter(p => !deletedIds.has(p.id)));
      setRaoProjectIds(prev => {
        const next = new Set(prev);
        deletedIds.forEach(id => next.delete(id));
        return next;
      });
      clearSelection();

      if (errCount === 0) toast.success(`${okCount} RAO supprimé${okCount > 1 ? 's' : ''}.`);
      else if (okCount > 0) toast.warning(`${okCount} supprimé(s), ${errCount} en erreur.`);
      else toast.error('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Suppression d'un RAO — comportement selon le type de projet :
  //  • RAO autonome  → efface tout le projet (irréversible)
  //  • projet ESTIMA → efface seulement l'analyse, le projet/estimation est conservé
  const handleDeleteRao = async (project) => {
    const standalone = isRaoStandalone(project);

    const ok = standalone
      ? await confirm(
          `Supprimer définitivement le RAO "${project.name}" ?\n\nCette action est irréversible. Toutes les offres, variantes et analyses seront perdues.`,
          { title: 'Supprimer le RAO autonome', danger: true, confirmLabel: 'Supprimer' }
        )
      : await confirm(
          `Supprimer l'analyse des offres (RAO) de "${project.name}" ?\n\nLe projet ESTIMA et son estimation sont conservés — seules les offres et l'analyse comparative sont effacées. Le projet reste accessible dans le Workspace.`,
          { title: 'Supprimer le RAO du projet', danger: true, confirmLabel: 'Supprimer le RAO' }
        );
    if (!ok) return;

    setDeletingId(project.id);
    try {
      if (standalone) {
        await deleteStandaloneRao(project);
        setProjects(prev => prev.filter(p => p.id !== project.id));
      } else {
        await deleteEstimaRaoAnalysis(project);
        // Le projet reste dans la liste ESTIMA mais sort de la vue RAO
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, hasRao: false } : p));
      }
      setRaoProjectIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      setSummaries(prev => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      toast.success(standalone ? `RAO "${project.name}" supprimé.` : `Analyse RAO de "${project.name}" supprimée.`);
    } catch (e) {
      console.error('[RaoLanding] Erreur suppression:', e);
      toast.error('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    let list = visible;
    if (activeTab === 'estima') list = visible.filter(p => !isRaoStandalone(p));
    else if (activeTab === 'rao') list = visible.filter(isRaoStandalone);

    if (!search.trim()) return list;
    const q = removeAccents(search);
    return list.filter(p =>
      removeAccents(p.name).includes(q) ||
      removeAccents(p.code).includes(q) ||
      removeAccents(p.location).includes(q)
    );
  }, [visible, search, activeTab]);

  const counts = useMemo(() => ({
    all: visible.length,
    estima: visible.filter(p => !isRaoStandalone(p)).length,
    rao: visible.filter(isRaoStandalone).length,
  }), [visible]);

  // ─── Stats globales du bandeau ──────────────────────────────────────────
  const globalStats = useMemo(() => {
    const sums = visible.map(p => summaries[p.id]).filter(Boolean);
    const companiesTotal = sums.reduce((a, s) => a + s.count, 0);
    const ecarts = sums.map(s => s.ecartPct).filter(v => v !== null && v !== undefined);
    const avgEcart = ecarts.length > 0 ? ecarts.reduce((a, b) => a + b, 0) / ecarts.length : null;
    return { raoCount: visible.length, companiesTotal, avgEcart };
  }, [visible, summaries]);

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Bandeau de stats */}
        {!loading && visible.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<BarChart3 size={18} className="text-blue-600" strokeWidth={1.5} />}
              iconBg="bg-blue-50"
              label="RAO en cours"
              value={globalStats.raoCount}
            />
            <StatCard
              icon={<Building2 size={18} className="text-violet-600" strokeWidth={1.5} />}
              iconBg="bg-violet-50"
              label="Entreprises analysées"
              value={globalStats.companiesTotal}
            />
            <StatCard
              icon={globalStats.avgEcart !== null && globalStats.avgEcart > 0
                ? <TrendingUp size={18} className="text-red-500" strokeWidth={1.5} />
                : <TrendingDown size={18} className="text-emerald-600" strokeWidth={1.5} />}
              iconBg={globalStats.avgEcart !== null && globalStats.avgEcart > 0 ? 'bg-red-50' : 'bg-emerald-50'}
              label="Écart mieux-disant moyen"
              value={globalStats.avgEcart !== null ? formatPct(globalStats.avgEcart) : '—'}
              valueClass={globalStats.avgEcart === null
                ? 'text-gray-400'
                : globalStats.avgEcart > 0 ? 'text-red-500' : 'text-emerald-600'}
            />
          </div>
        )}

        {/* Actions principales */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onNewRao}
            disabled={importing}
            className="flex-1 flex items-center gap-3 px-5 py-4 bg-white border border-blue-200 rounded-2xl hover:shadow-lg hover:shadow-blue-100/60 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="p-2.5 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
              <FilePlus2 size={20} className="text-blue-600" strokeWidth={1.5} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-gray-900">Nouveau RAO</div>
              <div className="text-xs text-gray-400">Nommer le projet puis importer l'estimation MOE</div>
            </div>
          </button>

          <button
            onClick={onImportDqe}
            disabled={importing}
            className="flex-1 flex items-center gap-3 px-5 py-4 bg-white border border-emerald-200 rounded-2xl hover:shadow-lg hover:shadow-emerald-100/60 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
              {importing
                ? <Loader2 size={20} className="text-emerald-600 animate-spin" />
                : <FileSpreadsheet size={20} className="text-emerald-600" strokeWidth={1.5} />}
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-gray-900">
                {importing ? 'Import en cours…' : 'Importer une estimation MOE'}
              </div>
              <div className="text-xs text-gray-400">Raccourci : sélection du fichier d'abord</div>
            </div>
          </button>

          <button
            onClick={() => setPickerOpen(true)}
            disabled={importing}
            className="flex-1 flex items-center gap-3 px-5 py-4 bg-white border border-violet-200 rounded-2xl hover:shadow-lg hover:shadow-violet-100/60 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="p-2.5 rounded-xl bg-violet-50 group-hover:bg-violet-100 transition-colors">
              <FolderOpen size={20} className="text-violet-600" strokeWidth={1.5} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-gray-900">Reprendre un projet ESTIMA</div>
              <div className="text-xs text-gray-400">
                {estimaCandidates.length > 0
                  ? `${estimaCandidates.length} projet${estimaCandidates.length > 1 ? 's' : ''} sans RAO`
                  : 'Tous vos projets ont déjà un RAO'}
              </div>
            </div>
          </button>
        </div>

        {/* Onglets de filtre + actions sélection */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-100 p-0.5 rounded-xl w-fit">
            <TabBtn active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
              Tous <span className="text-gray-400 ml-1">({counts.all})</span>
            </TabBtn>
            <TabBtn active={activeTab === 'estima'} onClick={() => setActiveTab('estima')}>
              Projets ESTIMA <span className="text-gray-400 ml-1">({counts.estima})</span>
            </TabBtn>
            <TabBtn active={activeTab === 'rao'} onClick={() => setActiveTab('rao')}>
              RAO Autonomes <span className="text-gray-400 ml-1">({counts.rao})</span>
            </TabBtn>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton "Tout sélectionner" — visible si on est sur l'onglet RAO Autonomes et qu'il y en a */}
            {activeTab === 'rao' && counts.rao > 0 && selectedIds.size < counts.rao && (
              <button
                onClick={selectAllStandalone}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
              >
                <CheckSquare size={13} />
                Tout sélectionner
              </button>
            )}

            {/* Sélecteur de mode d'affichage */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-xl">
              <ViewBtn active={viewMode === 'cards'} onClick={() => changeView('cards')} icon={LayoutGrid} label="Cartes" />
              <ViewBtn active={viewMode === 'list'} onClick={() => changeView('list')} icon={List} label="Liste" />
              <ViewBtn active={viewMode === 'bars'} onClick={() => changeView('bars')} icon={BarChartHorizontal} label="Barres" />
            </div>
          </div>
        </div>

        {/* Barre d'action de sélection — visible dès qu'au moins 1 RAO est sélectionné */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare size={16} className="text-red-600" />
              <span className="font-semibold text-red-900">
                {selectedIds.size} RAO autonome{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearSelection}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-white transition-all disabled:opacity-50"
              >
                <X size={12} />
                Désélectionner
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkDeleting
                  ? <><Loader2 size={12} className="animate-spin" /> Suppression…</>
                  : <><Trash2 size={12} /> Supprimer la sélection</>}
              </button>
            </div>
          </div>
        )}

        {/* Barre de recherche */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un RAO..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200/60 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Grille des RAO */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-gray-500">Chargement des RAO…</span>
          </div>
        ) : filtered.length > 0 ? (
          viewMode === 'list' ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl overflow-x-auto">
              <div className="min-w-[860px]">
                <div className={`${LIST_GRID} px-5 py-2.5 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400`}>
                  <span>Projet</span>
                  <span>Offres</span>
                  <span>Estimation</span>
                  <span>Mieux-disant</span>
                  <span>Écart</span>
                  <span>Modifié</span>
                  <span />
                </div>
                {filtered.map(p => (
                  <RaoListRow
                    key={p.id}
                    project={p}
                    summary={summaries[p.id]}
                    isStandalone={isRaoStandalone(p)}
                    formatDate={formatDate}
                    onClick={() => onSelectProject(p)}
                    onDelete={() => handleDeleteRao(p)}
                    deleting={deletingId === p.id}
                    selectable={isRaoStandalone(p)}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={() => toggleSelect(p.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${viewMode === 'bars' ? '' : 'xl:grid-cols-3'} gap-3`}>
              {filtered.map(p => (
                <RaoCard
                  key={p.id}
                  variant={viewMode === 'bars' ? 'bars' : 'cards'}
                  project={p}
                  summary={summaries[p.id]}
                  isStandalone={isRaoStandalone(p)}
                  formatDate={formatDate}
                  onClick={() => onSelectProject(p)}
                  onDelete={() => handleDeleteRao(p)}
                  deleting={deletingId === p.id}
                  selectable={isRaoStandalone(p)}
                  selected={selectedIds.has(p.id)}
                  onToggleSelect={() => toggleSelect(p.id)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-white/60 border border-dashed border-gray-200 rounded-2xl text-center px-6">
            <div className="p-4 rounded-2xl bg-blue-50 mb-4">
              <BarChart3 size={28} className="text-blue-500" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {search.trim() ? 'Aucun RAO trouvé pour cette recherche.' : 'Aucun RAO en cours'}
            </p>
            {!search.trim() && (
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Créez un nouveau RAO, importez une estimation MOE ou reprenez un projet ESTIMA existant.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modale de reprise d'un projet ESTIMA sans RAO */}
      <EstimaPickerModal
        open={pickerOpen}
        projects={estimaCandidates}
        formatDate={formatDate}
        onClose={() => setPickerOpen(false)}
        onPick={(p) => { setPickerOpen(false); onSelectProject(p); }}
      />
    </div>
  );
}

function StatCard({ icon, iconBg, label, value, valueClass = 'text-gray-900' }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 bg-white border border-gray-200/60 rounded-2xl">
      <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <p className={`text-xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? 'bg-white shadow-sm text-gray-900'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function ViewBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? 'bg-white shadow-sm text-gray-900'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// Mini-graphe horizontal : une barre par offre, ligne pointillée = estimation MOE.
// Vert = mieux-disant, rouge = au-dessus de l'estimation, bleu = entre les deux.
function OfferBars({ summary }) {
  const offers = summary?.offers || [];
  const est = summary?.totalEstimation || 0;

  if (offers.length === 0) {
    return <p className="mt-3 text-[11px] text-gray-400">Aucun montant d'offre saisi pour l'instant.</p>;
  }

  const shown = offers.slice(0, 5);
  const hidden = offers.length - shown.length;
  const scale = Math.max(est, offers[offers.length - 1].total) * 1.05;
  const estLeft = est > 0 ? Math.min((est / scale) * 100, 100) : null;
  const bestTotal = offers[0].total;
  const barColor = (o) =>
    o.total === bestTotal ? 'bg-emerald-400'
      : est > 0 && o.total > est ? 'bg-red-300'
        : 'bg-blue-300';

  return (
    <div className="mt-3">
      <div className="relative">
        {shown.map((o, i) => (
          <div key={i} className="flex items-center gap-2 h-5">
            <span className="w-20 shrink-0 text-[10px] text-gray-500 truncate" title={o.name}>
              {o.name}
            </span>
            <div className="flex-1 h-2.5 relative min-w-0">
              <div
                className={`absolute inset-y-0 left-0 rounded-md ${barColor(o)}`}
                style={{ width: `${Math.min((o.total / scale) * 100, 100)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[10px] font-semibold text-gray-600">
              {formatMoney(o.total)}
            </span>
          </div>
        ))}
        {/* Ligne d'estimation MOE — superposée à la zone des barres uniquement */}
        {estLeft !== null && (
          <div className="absolute inset-y-0 left-[5.5rem] right-[4.5rem] pointer-events-none">
            <div
              className="absolute top-0 bottom-0 border-l-[1.5px] border-dashed border-amber-500/80"
              style={{ left: `${estLeft}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 flex-wrap">
        {hidden > 0 && <span>+{hidden} autre{hidden > 1 ? 's' : ''} offre{hidden > 1 ? 's' : ''}</span>}
        {est > 0 && <span className="text-amber-600">– – estimation {formatMoney(est)}</span>}
        {summary.ecartPct !== null && summary.ecartPct !== undefined && (
          <span className={`px-1.5 py-0.5 rounded-md font-bold ${
            summary.ecartPct > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {formatPct(summary.ecartPct)}
          </span>
        )}
      </div>
    </div>
  );
}

function CompanyAvatars({ names = [] }) {
  const shown = names.slice(0, 4);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((name, i) => (
        <span
          key={i}
          title={name}
          className={`w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-white ${
            AVATAR_COLORS[i % AVATAR_COLORS.length]
          } ${i > 0 ? '-ml-1.5' : ''}`}
        >
          {initials(name)}
        </span>
      ))}
      {extra > 0 && (
        <span className="w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-white bg-gray-100 text-gray-500 -ml-1.5">
          +{extra}
        </span>
      )}
    </div>
  );
}

function RaoCard({
  project: p, summary, isStandalone, formatDate, onClick,
  variant = 'cards',
  onDelete = null, deleting = false,
  selectable = false, selected = false, onToggleSelect = null,
}) {
  const hasOffers = (summary?.count || 0) > 0;
  const ecart = summary?.ecartPct;

  return (
    <div
      className={`group relative flex flex-col bg-white border rounded-2xl transition-all duration-200 ${
        selected
          ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20'
          : 'border-gray-200/60 hover:shadow-lg hover:shadow-gray-200/40 hover:-translate-y-0.5'
      }`}
    >
      {/* Zone cliquable principale */}
      <button
        onClick={onClick}
        disabled={deleting}
        className="flex-1 flex flex-col text-left px-5 pt-4 pb-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Titre + badges */}
        <div className="flex items-start gap-2 pr-12">
          <span className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
            {p.name || 'Projet sans nom'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {hasOffers ? (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
              {summary.count} offre{summary.count > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">
              En préparation
            </span>
          )}
          {isStandalone && (
            <span className="px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 text-[10px] font-bold uppercase">
              Autonome
            </span>
          )}
        </div>

        {variant === 'bars' ? (
          hasOffers && <OfferBars summary={summary} />
        ) : (
          <>
            {/* Entreprises */}
            {hasOffers && (
              <div className="flex items-center gap-2 mt-3">
                <CompanyAvatars names={summary.names} />
                {summary.best && (
                  <span className="text-[11px] text-gray-400 truncate">
                    mieux-disant : <span className="text-gray-600 font-medium">{summary.best.name}</span>
                  </span>
                )}
              </div>
            )}

            {/* Montants */}
            {hasOffers && summary.best && summary.totalEstimation > 0 && (
              <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
                <span className="text-gray-400">
                  Est. <span className="text-gray-900 font-semibold">{formatMoney(summary.totalEstimation)}</span>
                </span>
                <span className="text-gray-400">
                  Offre <span className="text-gray-900 font-semibold">{formatMoney(summary.best.total)}</span>
                </span>
                {ecart !== null && ecart !== undefined && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    ecart > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {formatPct(ecart)}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Méta */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex-wrap">
          {p.code && <span className="font-mono text-gray-500">{p.code}</span>}
          {p.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {p.location}
            </span>
          )}
          {p.lastSaved && (
            <span className="flex items-center gap-1 ml-auto">
              <Clock size={11} /> {formatDate(p.lastSaved)}
            </span>
          )}
        </div>
      </button>

      {/* Coin haut-droit : checkbox + corbeille (RAO autonomes) + chevron */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5">
        {selectable && onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            disabled={deleting}
            className={`p-1.5 rounded-lg transition-all ${
              selected
                ? 'text-red-600 hover:bg-red-100 opacity-100'
                : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100'
            }`}
            title={selected ? 'Désélectionner' : 'Sélectionner pour suppression groupée'}
          >
            {selected ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
            title={isStandalone ? 'Supprimer ce RAO autonome' : "Supprimer l'analyse RAO (le projet ESTIMA est conservé)"}
          >
            {deleting
              ? <Loader2 size={15} className="animate-spin" />
              : <Trash2 size={15} />}
          </button>
        )}
        <ChevronRight size={16} className="text-gray-200 group-hover:text-blue-500 transition-colors" />
      </div>
    </div>
  );
}

function RaoListRow({
  project: p, summary, isStandalone, formatDate, onClick,
  onDelete = null, deleting = false,
  selectable = false, selected = false, onToggleSelect = null,
}) {
  const hasOffers = (summary?.count || 0) > 0;
  const ecart = summary?.ecartPct;

  return (
    <div
      onClick={deleting ? undefined : onClick}
      className={`group ${LIST_GRID} px-5 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${
        selected ? 'bg-red-50/40' : 'hover:bg-gray-50'
      }`}
    >
      {/* Projet */}
      <div className="flex items-center gap-2 min-w-0">
        {selectable && onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            disabled={deleting}
            className={`shrink-0 p-0.5 rounded transition-all ${
              selected
                ? 'text-red-600 opacity-100'
                : 'text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100'
            }`}
            title={selected ? 'Désélectionner' : 'Sélectionner pour suppression groupée'}
          >
            {selected ? <CheckSquare size={15} /> : <Square size={15} />}
          </button>
        )}
        <span className="text-sm font-semibold text-gray-900 truncate">
          {p.name || 'Projet sans nom'}
        </span>
        {isStandalone && (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-bold uppercase">
            Aut
          </span>
        )}
        {!hasOffers && (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold uppercase">
            Prépa
          </span>
        )}
      </div>

      {/* Offres */}
      <span className="flex items-center gap-1 text-xs text-gray-600">
        <Building2 size={12} className="text-gray-400" strokeWidth={1.5} />
        {summary?.count || 0}
      </span>

      {/* Estimation */}
      <span className="text-xs font-medium text-gray-900">
        {hasOffers && summary.totalEstimation > 0
          ? formatMoney(summary.totalEstimation)
          : <span className="text-gray-300">—</span>}
      </span>

      {/* Mieux-disant */}
      <div className="min-w-0">
        {summary?.best ? (
          <>
            <p className="text-xs font-semibold text-gray-900">{formatMoney(summary.best.total)}</p>
            <p className="text-[10px] text-gray-400 truncate">{summary.best.name}</p>
          </>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      {/* Écart */}
      <span>
        {ecart !== null && ecart !== undefined ? (
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
            ecart > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {formatPct(ecart)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </span>

      {/* Modifié */}
      <span className="text-[11px] text-gray-400">
        {p.lastSaved ? formatDate(p.lastSaved) : '—'}
      </span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5">
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
            title={isStandalone ? 'Supprimer ce RAO autonome' : "Supprimer l'analyse RAO (le projet ESTIMA est conservé)"}
          >
            {deleting
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} />}
          </button>
        )}
        <ChevronRight size={15} className="text-gray-200 group-hover:text-blue-500 transition-colors" />
      </div>
    </div>
  );
}

function EstimaPickerModal({ open, projects, formatDate, onClose, onPick }) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = removeAccents(search);
    return projects.filter(p =>
      removeAccents(p.name).includes(q) ||
      removeAccents(p.code).includes(q) ||
      removeAccents(p.location).includes(q)
    );
  }, [projects, search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="p-2 rounded-xl bg-violet-50">
            <FolderOpen size={18} className="text-violet-600" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Reprendre un projet ESTIMA</h2>
            <p className="text-xs text-gray-400">Démarrer un RAO sur un projet existant sans analyse d'offres</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Recherche */}
        {projects.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un projet..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        )}

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filtered.length > 0 ? filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-left group"
            >
              <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-white shrink-0">
                <Folder size={16} className="text-gray-400" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name || 'Projet sans nom'}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {[p.code, p.location, p.lastSaved ? formatDate(p.lastSaved) : null]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
              <ChevronRight size={15} className="text-gray-200 group-hover:text-blue-500 shrink-0 transition-colors" />
            </button>
          )) : (
            <div className="py-10 text-center text-sm text-gray-400">
              {projects.length === 0
                ? 'Tous vos projets ESTIMA ont déjà un RAO en cours.'
                : 'Aucun projet trouvé pour cette recherche.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
