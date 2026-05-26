import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, BarChart3, Folder, MapPin, Clock,
  FileSpreadsheet, FilePlus2, ChevronRight, Loader2, Layers, Trash2, X, CheckSquare, Square
} from 'lucide-react';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDialog } from '../../contexts/DialogContext';
import { useToast } from '../../contexts/ToastContext';

const removeAccents = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'estima' | 'rao'
  const [deletingId, setDeletingId] = useState(null);
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

        // Détection RAO actif via subcollection analysis/data
        const ids = new Set();
        await Promise.all(list.map(async (proj) => {
          try {
            const s = await getDoc(doc(db, 'companies', companyId, 'projects', proj.id, 'analysis', 'data'));
            if (s.exists() && s.data()?.companies?.length > 0) ids.add(proj.id);
          } catch { /* ignore */ }
        }));
        if (!cancelled) setRaoProjectIds(ids);
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
    const ids = projects.filter(isRaoStandalone).map(p => p.id);
    setSelectedIds(new Set(ids));
  };

  // Helper bas-niveau (sans toast, sans confirmation) — utilisé par bulk + single
  const deleteRaoFirestore = async (project) => {
    await Promise.allSettled([
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'analysis', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'rao', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'branding', 'data')),
      deleteDoc(doc(db, 'companies', companyId, 'projects', project.id, 'metadata', 'data')),
    ]);
    await deleteDoc(doc(db, 'companies', companyId, 'projects', project.id));
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
        try { await deleteRaoFirestore(p); okCount++; }
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

  // Suppression d'un RAO autonome (jamais les projets ESTIMA)
  const handleDeleteRao = async (project) => {
    if (!isRaoStandalone(project)) {
      toast.error('Seuls les RAO autonomes peuvent être supprimés depuis cet écran.');
      return;
    }
    const ok = await confirm(
      `Supprimer définitivement le RAO "${project.name}" ?\n\nCette action est irréversible. Toutes les offres, variantes et analyses seront perdues.`,
      { title: 'Supprimer le RAO autonome', danger: true, confirmLabel: 'Supprimer' }
    );
    if (!ok) return;

    setDeletingId(project.id);
    try {
      await deleteRaoFirestore(project);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setRaoProjectIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      toast.success(`RAO "${project.name}" supprimé.`);
    } catch (e) {
      console.error('[RaoLanding] Erreur suppression:', e);
      toast.error('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    let list = projects;
    if (activeTab === 'estima') list = projects.filter(p => !isRaoStandalone(p));
    else if (activeTab === 'rao') list = projects.filter(isRaoStandalone);

    if (!search.trim()) return list;
    const q = removeAccents(search);
    return list.filter(p =>
      removeAccents(p.name).includes(q) ||
      removeAccents(p.code).includes(q) ||
      removeAccents(p.location).includes(q)
    );
  }, [projects, search, activeTab]);

  const raoActive = filtered.filter(p => raoProjectIds.has(p.id));
  const raoInactive = filtered.filter(p => !raoProjectIds.has(p.id));

  const counts = useMemo(() => ({
    all: projects.length,
    estima: projects.filter(p => !isRaoStandalone(p)).length,
    rao: projects.filter(isRaoStandalone).length,
  }), [projects]);

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const chapCount = (p) => (p.chapters || []).length;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Actions principales */}
        <div className="flex gap-3">
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
        </div>

        {/* Onglets de filtre + actions sélection */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-100 p-0.5 rounded-xl w-fit">
            <TabBtn active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
              Tous <span className="text-gray-400 ml-1">({counts.all})</span>
            </TabBtn>
            <TabBtn active={activeTab === 'estima'} onClick={() => setActiveTab('estima')}>
              ESTIMA <span className="text-gray-400 ml-1">({counts.estima})</span>
            </TabBtn>
            <TabBtn active={activeTab === 'rao'} onClick={() => setActiveTab('rao')}>
              RAO Autonomes <span className="text-gray-400 ml-1">({counts.rao})</span>
            </TabBtn>
          </div>

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
            placeholder="Rechercher un projet..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200/60 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Liste des projets */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-gray-500">Chargement des projets…</span>
          </div>
        ) : (
          <section>
            {/* Projets avec RAO actif en premier */}
            {raoActive.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Layers size={11} />
                  RAO en cours ({raoActive.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {raoActive.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      hasRao
                      isStandalone={isRaoStandalone(p)}
                      formatDate={formatDate}
                      chapCount={chapCount}
                      onClick={() => onSelectProject(p)}
                      onDelete={isRaoStandalone(p) ? () => handleDeleteRao(p) : null}
                      deleting={deletingId === p.id}
                      selectable={isRaoStandalone(p)}
                      selected={selectedIds.has(p.id)}
                      onToggleSelect={() => toggleSelect(p.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Autres projets */}
            {raoInactive.length > 0 && (
              <div>
                {raoActive.length > 0 && (
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    Autres projets ({raoInactive.length})
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {raoInactive.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      isStandalone={isRaoStandalone(p)}
                      formatDate={formatDate}
                      chapCount={chapCount}
                      onClick={() => onSelectProject(p)}
                      onDelete={isRaoStandalone(p) ? () => handleDeleteRao(p) : null}
                      deleting={deletingId === p.id}
                      selectable={isRaoStandalone(p)}
                      selected={selectedIds.has(p.id)}
                      onToggleSelect={() => toggleSelect(p.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm bg-white/60 border border-dashed border-gray-200 rounded-2xl">
                {search.trim()
                  ? 'Aucun projet trouvé pour cette recherche.'
                  : activeTab === 'rao'
                    ? 'Aucun RAO autonome. Créez-en un avec "Nouveau RAO" ou "Importer un DQE".'
                    : 'Aucun projet ESTIMA.'}
              </div>
            )}
          </section>
        )}
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

function ProjectCard({
  project: p, hasRao, isStandalone, formatDate, chapCount, onClick,
  onDelete = null, deleting = false,
  selectable = false, selected = false, onToggleSelect = null,
}) {
  return (
    <div
      className={`group w-full flex items-center gap-3 px-5 py-4 bg-white border rounded-2xl transition-all duration-200 ${
        selected
          ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20'
          : 'border-gray-200/60 hover:shadow-lg hover:shadow-gray-200/40 hover:-translate-y-0.5'
      }`}
    >
      {/* Checkbox de sélection — uniquement sur les RAO autonomes */}
      {selectable && onToggleSelect && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          disabled={deleting}
          className={`shrink-0 p-1 rounded-lg transition-all ${
            selected
              ? 'text-red-600 hover:bg-red-100'
              : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100'
          } ${selected ? 'opacity-100' : ''}`}
          title={selected ? 'Désélectionner' : 'Sélectionner pour suppression groupée'}
        >
          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
      )}

      {/* Zone cliquable principale */}
      <button
        onClick={onClick}
        disabled={deleting}
        className="flex-1 flex items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Icône projet */}
        <div className={`p-2.5 rounded-xl shrink-0 ${
          hasRao ? 'bg-emerald-50' : isStandalone ? 'bg-amber-50' : 'bg-gray-50'
        }`}>
          <Folder
            size={20}
            className={hasRao ? 'text-emerald-600' : isStandalone ? 'text-amber-600' : 'text-gray-400'}
            strokeWidth={1.5}
          />
        </div>

        {/* Infos projet */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {p.name || 'Projet sans nom'}
            </span>
            {hasRao && (
              <span className="shrink-0 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                RAO actif
              </span>
            )}
            {isStandalone && (
              <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">
                Autonome
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            {p.code && (
              <span className="font-mono text-gray-500">{p.code}</span>
            )}
            {p.location && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {p.location}
              </span>
            )}
            {chapCount(p) > 0 && (
              <span>{chapCount(p)} chapitre{chapCount(p) > 1 ? 's' : ''}</span>
            )}
            {p.lastSaved && (
              <span className="flex items-center gap-1">
                <Clock size={11} /> {formatDate(p.lastSaved)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Bouton supprimer — uniquement pour les RAO autonomes */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          className="shrink-0 p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
          title="Supprimer ce RAO autonome"
        >
          {deleting
            ? <Loader2 size={16} className="animate-spin" />
            : <Trash2 size={16} />}
        </button>
      )}

      {/* Flèche cliquable */}
      <button
        onClick={onClick}
        disabled={deleting}
        className="shrink-0 disabled:opacity-50"
      >
        <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
      </button>
    </div>
  );
}
