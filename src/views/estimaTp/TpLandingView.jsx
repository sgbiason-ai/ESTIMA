// src/views/estimaTp/TpLandingView.jsx
// ESTIMA TP — écran d'accueil : liste des études de prix + création / suppression.
import React, { useMemo, useState } from 'react';
import {
  Search, FilePlus2, Loader2, Trash2, ChevronRight, Coins, Clock, Building2, Hash,
} from 'lucide-react';
import { useDialog } from '../../contexts/DialogContext';
import { useToast } from '../../contexts/ToastContext';

const removeAccents = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const countItems = (study) =>
  (study?.cadre?.chapters || []).reduce((n, c) => n + (c.items || []).length, 0);

export default function TpLandingView({ studies, loading, onOpen, onCreate, onDelete }) {
  const { prompt, confirm } = useDialog();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleCreate = async () => {
    const name = await prompt('Nom de l\'étude de prix :', '', {
      title: 'Nouvelle étude de prix',
      placeholder: 'Ex : Aménagement RD820 — Tranche 1',
      confirmLabel: 'Créer l\'étude',
    });
    if (name === null) return;
    setBusy(true);
    try {
      const created = await onCreate({ name: name.trim() || 'Nouvelle étude' });
      if (created) { toast.success('Étude créée.'); onOpen(created.id); }
    } catch (e) {
      console.error('[TpLanding] Création échouée:', e);
      toast.error('Impossible de créer l\'étude.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (study) => {
    const ok = await confirm(
      `Supprimer définitivement l'étude "${study.name}" ?\n\nCette action est irréversible.`,
      { title: 'Supprimer l\'étude', danger: true, confirmLabel: 'Supprimer' }
    );
    if (!ok) return;
    setDeletingId(study.id);
    try {
      await onDelete(study.id);
      toast.success('Étude supprimée.');
    } catch (e) {
      console.error('[TpLanding] Suppression échouée:', e);
      toast.error('Erreur lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return studies;
    const q = removeAccents(search);
    return studies.filter(s =>
      removeAccents(s.name).includes(q) ||
      removeAccents(s.reference).includes(q) ||
      removeAccents(s.maitreOuvrage).includes(q)
    );
  }, [studies, search]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Action principale */}
        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full flex items-center gap-3 px-5 py-4 bg-white border border-orange-200 rounded-2xl hover:shadow-lg hover:shadow-orange-100/60 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group disabled:opacity-50"
        >
          <div className="p-2.5 rounded-xl bg-orange-50 group-hover:bg-orange-100 transition-colors">
            {busy ? <Loader2 size={20} className="text-orange-600 animate-spin" />
                  : <FilePlus2 size={20} className="text-orange-600" strokeWidth={1.5} />}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-gray-900">Nouvelle étude de prix</div>
            <div className="text-xs text-gray-400">Saisir le bordereau à la main (import DPGF Excel à venir en Phase 3)</div>
          </div>
        </button>

        {/* Recherche */}
        {studies.length > 0 && (
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une étude..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200/60 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            />
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-orange-500" />
            <span className="ml-3 text-sm text-gray-500">Chargement des études…</span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(s => (
              <div
                key={s.id}
                className="group relative flex flex-col bg-white border border-gray-200/60 rounded-2xl hover:shadow-lg hover:shadow-gray-200/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                <button
                  onClick={() => onOpen(s.id)}
                  disabled={deletingId === s.id}
                  className="flex-1 flex flex-col text-left px-5 pt-4 pb-3 disabled:opacity-50"
                >
                  <div className="flex items-start gap-2 pr-10">
                    <div className="p-2 rounded-lg bg-orange-50 shrink-0">
                      <Coins size={16} className="text-orange-600" strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mt-1">
                      {s.name || 'Étude sans nom'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Hash size={11} /> {countItems(s)} article{countItems(s) > 1 ? 's' : ''}
                    </span>
                    {s.reference && <span className="font-mono text-gray-500">{s.reference}</span>}
                    {s.maitreOuvrage && (
                      <span className="flex items-center gap-1"><Building2 size={11} /> {s.maitreOuvrage}</span>
                    )}
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock size={11} /> {formatDate(s.lastSaved)}
                    </span>
                  </div>
                </button>
                <div className="absolute top-3 right-3 flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                    disabled={deletingId === s.id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Supprimer l'étude"
                  >
                    {deletingId === s.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                  <ChevronRight size={16} className="text-gray-200 group-hover:text-orange-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-white/60 border border-dashed border-gray-200 rounded-2xl text-center px-6">
            <div className="p-4 rounded-2xl bg-orange-50 mb-4">
              <Coins size={28} className="text-orange-500" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {search.trim() ? 'Aucune étude trouvée.' : 'Aucune étude de prix'}
            </p>
            {!search.trim() && (
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Créez votre première étude pour chiffrer une réponse à appel d'offres.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
