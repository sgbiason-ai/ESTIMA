import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Cloud, RefreshCw, X, Search, Clock, FolderOpen, CloudOff } from 'lucide-react';

/**
 * CloudProjectPicker
 * Popup ancré au bouton qui liste les projets cloud et permet d'en ouvrir un.
 */
const CloudProjectPicker = ({ companyId, currentProjectId, onSelect, onClose }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Fermer au clic en dehors
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Charger les projets
  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, 'companies', companyId, 'projects'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));
        setProjects(list);
      } catch {
        setError('Impossible de charger les projets.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const removeAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = projects.filter(p =>
    !search.trim() || removeAccents(p.name).includes(removeAccents(search))
  );

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-[380px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
      style={{ maxHeight: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Cloud size={14} className="text-blue-500" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Ouvrir un projet Cloud</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Recherche */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un projet..."
            autoFocus
            className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 transition-colors"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto" style={{ maxHeight: '310px' }}>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-[12px]">Chargement...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-8 text-red-400">
            <CloudOff size={20} />
            <span className="text-[12px]">{error}</span>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <FolderOpen size={20} />
            <span className="text-[12px]">{search ? 'Aucun résultat' : 'Aucun projet'}</span>
          </div>
        )}

        {!loading && !error && filtered.map(proj => {
          const isActive = proj.id === currentProjectId;
          const date = proj.lastSaved ? new Date(proj.lastSaved) : null;
          const isToday = date && new Date().toDateString() === date.toDateString();
          const dateStr = date
            ? isToday
              ? `Aujourd'hui ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
          const chapCount = (proj.chapters || []).length;

          return (
            <button
              key={proj.id}
              onClick={() => { if (!isActive) onSelect(proj); }}
              disabled={isActive}
              className={`w-full text-left px-4 py-2.5 border-b border-slate-50 transition-colors ${
                isActive
                  ? 'bg-blue-50 cursor-default'
                  : 'hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[12px] font-semibold truncate flex-1 ${isActive ? 'text-blue-600' : 'text-slate-800'}`}>
                  {proj.name || 'Projet sans nom'}
                </span>
                {isActive && (
                  <span className="text-[9px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                    ACTIF
                  </span>
                )}
                {proj.code && (
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                    {proj.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                {dateStr && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} className={isToday ? 'text-emerald-500' : ''} />
                    {dateStr}
                  </span>
                )}
                <span>{chapCount} chap.</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CloudProjectPicker;
