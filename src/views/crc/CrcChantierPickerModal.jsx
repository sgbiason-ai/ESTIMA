// src/views/crc/CrcChantierPickerModal.jsx
//
// Modal grille Bento pour selectionner un chantier CRC.
// Affiche pour chaque affaire : logo commune, nom, lieu, nb CR, derniere date,
// badge projet ESTIMA lie (nom resolu via fetch projects).

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, FolderOpen, FileText, Link2, Trash2, Calendar, CheckCircle2, RotateCcw } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { confirm } from '../../utils/globalUI';
import { partitionChantiers, formatArchivedAt } from '../../utils/crcChantierStatus';

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
  canDelete = () => true,
  onSetArchived,
  companyId,
}) {
  const [query, setQuery] = useState('');
  const [projectsById, setProjectsById] = useState({});
  // 'active' | 'archived' — onglet courant du selecteur
  const [tab, setTab] = useState('active');

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

  // Partition en cours / terminees, puis filtre par recherche dans l'onglet actif
  const { active, archived } = useMemo(() => partitionChantiers(chantiers), [chantiers]);
  const scoped = tab === 'archived' ? archived : active;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((c) => {
      const nom = (c.crrConfig?.chantierInfo?.nom || '').toLowerCase();
      const lieu = (c.crrConfig?.chantierInfo?.lieu || '').toLowerCase();
      return nom.includes(q) || lieu.includes(q);
    });
  }, [scoped, query]);

  // A l'ouverture, se placer sur l'onglet qui contient l'affaire courante :
  // rouvrir le selecteur depuis un chantier termine ne doit pas afficher une
  // liste ou il est absent.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setTab(archived.some((c) => c.id === activeId) ? 'archived' : 'active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

    const meetings = chantier.crrMeetings || [];
    const meetingCount = meetings.length;
    const obsCount = meetings.reduce((s, m) => s + (m.observations?.length || 0), 0);
    const photoCount = meetings.reduce(
      (s, m) => s + (m.observations || []).reduce((ss, o) => ss + (o.images?.length || 0), 0),
      0
    );

    let msg = `Supprimer le chantier "${nom}" ?\n\nContenu : ${meetingCount} compte-rendu${meetingCount > 1 ? 's' : ''}, ${obsCount} observation${obsCount > 1 ? 's' : ''}`;
    if (photoCount > 0) {
      msg += `, ${photoCount} photo${photoCount > 1 ? 's' : ''}.\n\nATTENTION : les photos seront DEFINITIVEMENT supprimees du serveur. Pour les conserver, exportez d'abord l'affaire en .crcestima (bouton Archiver) — l'export embarque les photos en base64.`;
    } else {
      msg += '.';
    }

    const ok = await confirm(msg, { danger: true });
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

          {/* Segment En cours / Terminees */}
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
            {[
              { id: 'active', label: 'En cours', count: active.length },
              { id: 'archived', label: 'Terminées', count: archived.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t.label}
                <span className={`px-1.5 rounded-md text-[10px] font-bold ${
                  tab === t.id ? 'bg-gray-100 text-gray-600' : 'text-gray-400'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>

          {query && (
            <div className="text-xs text-gray-400">
              {filtered.length} sur {scoped.length}
            </div>
          )}
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
                {query
                  ? 'Aucun résultat pour cette recherche.'
                  : tab === 'archived'
                    ? 'Aucune affaire terminée. Clôturez un chantier depuis le bouton « Terminer » du ruban.'
                    : chantiers.length === 0
                      ? 'Aucune affaire. Cliquez sur « Nouvelle affaire ».'
                      : 'Aucune affaire en cours — toutes vos affaires sont terminées.'}
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
                    {/* Actions au survol : terminer/réactiver puis supprimer */}
                    <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      {onSetArchived && canDelete(c) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSetArchived(c.id, tab !== 'archived'); }}
                          className={`p-1.5 rounded-lg transition-all ${
                            tab === 'archived'
                              ? 'text-gray-300 hover:text-blue-600 hover:bg-blue-50'
                              : 'text-gray-300 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={tab === 'archived' ? 'Réactiver le chantier' : 'Terminer le chantier'}
                        >
                          {tab === 'archived' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                      )}
                      {canDelete(c) && (
                        <button
                          onClick={(e) => handleDelete(e, c)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Supprimer le chantier"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

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

                    {/* Badge chantier termine */}
                    {c.archivedAt && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 mr-1.5 rounded-lg bg-amber-50 border border-amber-100 text-[10px] font-medium text-amber-700">
                        <CheckCircle2 size={11} strokeWidth={2} className="shrink-0" />
                        <span className="truncate">
                          Terminé{formatArchivedAt(c.archivedAt) ? ` le ${formatArchivedAt(c.archivedAt)}` : ''}
                        </span>
                      </div>
                    )}

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
