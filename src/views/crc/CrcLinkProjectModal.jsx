// src/views/crc/CrcLinkProjectModal.jsx
// Modale de sélection d'un projet existant pour lier à un nouveau chantier CRC

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Link2, FolderOpen, MapPin, Building2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function CrcLinkProjectModal({ isOpen, onClose, onSelect, companyId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Chargement des projets cloud
  useEffect(() => {
    if (!isOpen || !companyId) return;
    setLoading(true);
    getDocs(collection(db, 'companies', companyId, 'projects'))
      .then(snap => {
        const list = snap.docs
          .map(d => d.data())
          .filter(p => p.name)
          .sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));
        setProjects(list);
      })
      .catch(e => console.error('[CrcLinkProject] Erreur chargement:', e))
      .finally(() => setLoading(false));
  }, [isOpen, companyId]);

  const removeAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = removeAccents(search);
    return projects.filter(p =>
      removeAccents(p.name).includes(q) ||
      removeAccents(p.client).includes(q) ||
      removeAccents(p.location).includes(q)
    );
  }, [projects, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50">
              <Link2 size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Lier à un projet</h3>
              <p className="text-[10px] text-gray-400">Sélectionnez un projet pour pré-remplir les infos chantier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-all">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200/60 rounded-xl">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un projet..."
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              {search ? 'Aucun projet trouvé.' : 'Aucun projet disponible.'}
            </div>
          )}

          {!loading && filtered.map(proj => {
            const dateStr = proj.lastSaved
              ? new Date(proj.lastSaved).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
              : '';
            return (
              <button
                key={proj.id}
                onClick={() => onSelect(proj)}
                className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <FolderOpen size={16} className="text-gray-400 group-hover:text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{proj.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                    {proj.client && (
                      <span className="flex items-center gap-0.5 truncate">
                        <Building2 size={10} />
                        {proj.client}
                      </span>
                    )}
                    {proj.location && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin size={10} />
                        {proj.location}
                      </span>
                    )}
                    {dateStr && <span>{dateStr}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200/60 flex items-center justify-between shrink-0">
          <button
            onClick={() => onSelect(null)}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
          >
            Créer sans lier
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 rounded-xl transition-all">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
