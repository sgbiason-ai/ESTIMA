import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, ClipboardList, Loader, MapPin, Search, X,
} from 'lucide-react';

const formatDate = (value) => {
  if (!value) return 'Date non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
};

export default function SiteVisitReserveImportModal({
  isOpen,
  onClose,
  visits,
  isLoading,
  loadVisit,
  onImport,
  existingReserveCount = 0,
}) {
  const [search, setSearch] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !importingId) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, importingId, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setError('');
    }
  }, [isOpen]);

  const filteredVisits = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visits || [];
    return (visits || []).filter((visit) => (
      [visit.nom, visit.lieu, visit.client, visit.date]
        .some((value) => String(value || '').toLowerCase().includes(term))
    ));
  }, [search, visits]);

  if (!isOpen) return null;

  const handleImport = async (visit) => {
    setImportingId(visit.id);
    setError('');
    try {
      const fullVisit = await loadVisit(visit.id);
      if (!fullVisit) throw new Error('Cette visite est introuvable.');
      if (!Array.isArray(fullVisit.observations) || fullVisit.observations.length === 0) {
        throw new Error('Cette visite ne contient aucune observation à importer.');
      }
      await onImport(fullVisit);
      onClose();
    } catch (importError) {
      setError(importError?.message || "Impossible d'importer cette visite.");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => !importingId && onClose()}
      />

      <div className="relative w-full max-w-2xl max-h-[82vh] overflow-hidden rounded-3xl bg-white border border-gray-200/60 shadow-2xl flex flex-col">
        <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-200/60">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
            <ClipboardList size={20} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Importer une visite de site</h2>
            <p className="text-xs text-gray-500 mt-1">
              Toutes les observations et toutes leurs photos deviendront les réserves de l’annexe EXE4 / EXE5.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!importingId}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4 space-y-3">
          {existingReserveCount > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              L’import remplacera les {existingReserveCount} réserve{existingReserveCount > 1 ? 's' : ''} actuellement présentes.
            </div>
          )}
          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, lieu, client ou date…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-100 border border-gray-200/60 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader size={17} className="animate-spin text-blue-500" /> Chargement des visites…
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500 text-center">
              {search ? 'Aucune visite ne correspond à cette recherche.' : 'Aucune visite de site accessible.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVisits.map((visit) => {
                const isImporting = importingId === visit.id;
                return (
                  <button
                    key={visit.id}
                    type="button"
                    onClick={() => handleImport(visit)}
                    disabled={!!importingId || !visit.obsCount}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-left hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-gray-200"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {visit.obsCount || 0}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{visit.nom || 'Visite sans nom'}</p>
                        {visit.isShared && <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase">Partagée</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(visit.date)}</span>
                        {visit.lieu && <span className="flex items-center gap-1 truncate"><MapPin size={11} /> {visit.lieu}</span>}
                        <span>{visit.obsCount || 0} observation{visit.obsCount > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-semibold text-blue-600">
                      {isImporting ? <Loader size={16} className="animate-spin" /> : visit.obsCount ? 'Importer' : 'Vide'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
