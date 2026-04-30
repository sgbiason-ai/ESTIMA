// src/views/crc/CrcChantierPickerModal.jsx
//
// Modal grille Bento pour selectionner un chantier CRC.
// Affiche pour chaque affaire : logo commune, nom, lieu, nb CR, derniere date,
// badge projet ESTIMA lie (nom resolu via fetch projects).

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, FolderOpen, FileText, Link2, Trash2, Calendar } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { confirm } from '../../utils/globalUI';

// Format date FR court "14 avr" / "14 avr 2025"
const formatShortDate = (isoDate) => {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const opts = d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', opts);
  } catch { return ''; }
};

// Stats d'une affaire a partir de crrMeetings
// "dernier CR" = la derniere date <= aujourd'hui. Les CR dupliques/planifies
// dans le futur ne sont pas consideres comme le dernier.
const computeStats = (chantier) => {
  const meetings = chantier?.crrMeetings || [];
  const count = meetings.length;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const pastDates = meetings
    .map((m) => m.date)
    .filter((d) => d && d <= today)
    .sort();
  const lastDate = pastDates[pastDates.length - 1] || null;
  return { count, lastDate };
};

export default function CrcChantierPickerModal({
  isOpen,
  onClose,
  chantiers,
  activeId,
  onSelect,
  onDelete,
  companyId,
}) {
  const [query, setQuery] = useState('');
  const [projectsById, setProjectsById] = useState({});

  // Fetch projects une fois a l'ouverture pour resoudre les linkedProjectId
  useEffect(() => {
    if (!isOpen || !companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'companies', companyId, 'projects'));
        if (cancelled) return;
        const map = {};
        snap.forEach((d) => {
          const data = d.data() || {};
          map[d.id] = data.name || data.projectName || data.title || '';
        });
        setProjectsById(map);
      } catch (err) {
        console.warn('[CRC] Fetch projets pour picker echoue:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, companyId]);

  // Filtre par recherche
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chantiers;
    return chantiers.filter((c) => {
      const nom = (c.crrConfig?.chantierInfo?.nom || '').toLowerCase();
      const lieu = (c.crrConfig?.chantierInfo?.lieu || '').toLowerCase();
      return nom.includes(q) || lieu.includes(q);
    });
  }, [chantiers, query]);

  // ESC pour fermer
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDelete = async (e, chantier) => {
    e.stopPropagation();
    const nom = chantier.crrConfig?.chantierInfo?.nom || 'Sans nom';
    const ok = await confirm(
      `Supprimer le chantier "${nom}" et tous ses comptes rendus ?`,
      { danger: true }
    );
    if (ok) onDelete(chantier.id);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}

    >
      <div
        className="bg-[#f5f5f7] rounded-3xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-4 flex items-center gap-4">
          <FolderOpen size={18} className="text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Choisir une affaire</h2>
          <div className="text-xs text-gray-400">
            {filtered.length} {filtered.length > 1 ? 'affaires' : 'affaire'}
            {query && ` (filtrees sur ${chantiers.length})`}
          </div>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 border border-gray-200/60 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
            title="Fermer (Echap)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grille Bento */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
              <FolderOpen size={48} strokeWidth={1.5} className="mb-3 opacity-50" />
              <p className="text-sm">
                {chantiers.length === 0 ? 'Aucune affaire. Cliquez sur "Nouvelle affaire".' : 'Aucun resultat pour cette recherche.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => {
                const info = c.crrConfig?.chantierInfo || {};
                const nom = info.nom || 'Sans nom';
                const lieu = info.lieu || '';
                const logo = info.communeLogo || null;
                const linkedProjectId = c.linkedProjectId || null;
                const linkedProjectName = linkedProjectId ? (projectsById[linkedProjectId] || 'Projet lie') : '';
                const { count, lastDate } = computeStats(c);
                const isActive = c.id === activeId;

                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { onSelect(c); onClose(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(c); onClose();
                      }
                    }}
                    className={`group relative text-left bg-white rounded-2xl border p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      isActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200/60'
                    }`}
                  >
                    {/* Bouton suppression (visible au hover) */}
                    <button
                      onClick={(e) => handleDelete(e, c)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Supprimer le chantier"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Logo / placeholder */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200/60 flex items-center justify-center">
                        {logo ? (
                          <img src={logo} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <FolderOpen size={20} className="text-gray-400" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold text-sm truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                          {nom}
                        </div>
                        {lieu && (
                          <div className="text-xs text-gray-500 truncate mt-0.5">{lieu}</div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
                      <div className="flex items-center gap-1">
                        <FileText size={12} strokeWidth={1.75} />
                        <span className="font-medium text-gray-700">{count}</span>
                        <span>{count > 1 ? 'CR' : 'CR'}</span>
                      </div>
                      {lastDate && (
                        <>
                          <span className="text-gray-300">·</span>
                          <div className="flex items-center gap-1">
                            <Calendar size={12} strokeWidth={1.75} />
                            <span>dernier le {formatShortDate(lastDate)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Badge projet ESTIMA lie */}
                    {linkedProjectId && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] font-medium text-indigo-700 max-w-full">
                        <Link2 size={11} strokeWidth={2} className="shrink-0" />
                        <span className="truncate">{linkedProjectName || 'Projet lie'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
