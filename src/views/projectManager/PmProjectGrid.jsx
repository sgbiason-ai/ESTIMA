import React, { useState, useEffect } from 'react';
import { Cloud, Folder, Clock, RefreshCw, CloudOff, Trash2, RotateCcw, Info, ClipboardList, BarChart3, Copy, ExternalLink, User, SearchX, MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { NEUTRAL_COLOR } from './folderColors';
import { formatRelativeDate } from './relativeDate';

// En-tête de colonne triable (vue liste)
const SortHeader = ({ label, sortKey, sortBy, sortDir, onSort, className = '' }) => {
  const active = sortBy === sortKey;
  return (
    <button
      onClick={() => onSort?.(sortKey)}
      className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600'
      } ${className}`}
    >
      {label}
      {active && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
    </button>
  );
};

const MenuItem = ({ icon: Icon, label, danger, onClick, disabled, spinning }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left disabled:opacity-50 ${
      danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    <Icon size={14} className={`shrink-0 ${spinning ? 'animate-spin' : ''}`} />
    {label}
  </button>
);

const PmProjectGrid = ({
  viewMode = 'grid',
  cloudLoading, cloudError, cloudProjects, filteredProjects,
  searchQuery = '', onClearSearch,
  sortBy = 'date', sortDir = 'desc', onSort,
  setSelectedFolderId,
  project, folders, folderColorMap = {},
  presenceByProject, deletingId,
  onLoadProject, onOpenInEstima, onDeleteProject, onDuplicateProject, onMoveProject, onRestoreSnapshot, onInfoProject, linkedCrcMap = {}, raoProjectIds = new Set(), onNavigateModule,
}) => {
  // Popover "Versions précédentes" : ouvrable au clic (tactile) en plus du hover
  const [openHistId, setOpenHistId] = useState(null);
  // Menu kebab « ⋯ » d'une tuile
  const [openMenuId, setOpenMenuId] = useState(null);

  // Fermeture des menus : clic extérieur + Échap (les déclencheurs font stopPropagation)
  useEffect(() => {
    if (!openHistId && !openMenuId) return undefined;
    const close = () => { setOpenHistId(null); setOpenMenuId(null); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [openHistId, openMenuId]);

  // Simple clic = sélection/aperçu (chargement silencieux dans la session, reste sur le Workspace).
  // Double-clic OU bouton "Ouvrir" = ouverture dans Estima VRD. Plus de délai artificiel :
  // le simple clic étant non-bloquant (pas de modale), il peut précéder un double-clic sans gêne.
  const handleCardClick = (proj) => onLoadProject?.(proj);
  const handleCardDoubleClick = (proj) => {
    if (onOpenInEstima) onOpenInEstima(proj);
    else onLoadProject?.(proj);
  };

  // ── Empty states (Apple-style) ───────────────────────────────────────────
  if (cloudLoading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
      <RefreshCw size={28} className="animate-spin text-blue-500" />
      <p className="text-sm font-medium">Chargement des projets...</p>
    </div>
  );

  if (cloudError) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-red-400">
      <CloudOff size={32} />
      <p className="text-sm font-medium">{cloudError}</p>
    </div>
  );

  if (cloudProjects.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
        <Cloud size={32} className="text-gray-300" />
      </div>
      <p className="text-base font-medium text-gray-600">Aucun projet sauvegardé sur le Cloud</p>
      <p className="text-sm text-center max-w-sm text-gray-400">
        Utilisez le bouton « Sauvegarder » dans la barre d'outils pour synchroniser un projet.
      </p>
    </div>
  );

  if (filteredProjects.length === 0) {
    // Empty state recherche : différencié du "dossier vide" (cause différente, CTA différent)
    if (searchQuery.trim()) return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <SearchX size={28} className="text-gray-300" />
        </div>
        <p className="text-base font-medium text-gray-600">Aucun résultat pour « {searchQuery.trim()} »</p>
        <p className="text-sm text-center max-w-xs text-gray-400">Vérifiez l'orthographe ou essayez un nom, un n° ou un lieu.</p>
        <button onClick={() => onClearSearch?.()} className="text-xs text-blue-500 hover:text-blue-600 transition-colors">
          Effacer la recherche
        </button>
      </div>
    );
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <Folder size={28} className="text-gray-300" />
        </div>
        <p className="text-base font-medium text-gray-600">Dossier vide</p>
        <p className="text-sm text-center max-w-xs text-gray-400">Aucune affaire dans ce dossier.</p>
        <button onClick={() => setSelectedFolderId('__all__')} className="text-xs text-blue-500 hover:text-blue-600 transition-colors">
          &larr; Voir tous les projets
        </button>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getProjectMeta = (proj) => {
    const date = proj.lastSaved ? new Date(proj.lastSaved) : null;
    const dateStr = date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const timeStr = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const isToday = date && new Date().toDateString() === date.toDateString();
    const projFolder = proj.folderId ? folders.find(f => f.id === proj.folderId) : null;
    const presence = presenceByProject[proj.id] || [];
    const saveHistory = (() => {
      if (Array.isArray(proj.saveHistory) && proj.saveHistory.length > 0) return proj.saveHistory;
      try { return JSON.parse(localStorage.getItem(`save_history_${proj.id}`) || '[]'); } catch { return []; }
    })();
    const fc = proj.folderId ? (folderColorMap[proj.folderId] || NEUTRAL_COLOR) : NEUTRAL_COLOR;
    const savedBy = proj.updatedBy || proj.savedBy || '';
    const savedByName = savedBy ? savedBy.split('@')[0] : '';
    const relative = date ? formatRelativeDate(date) : '—';
    return { date, dateStr, timeStr, isToday, projFolder, presence, saveHistory, fc, savedBy, savedByName, relative };
  };

  // ── Vue LISTE (pilotage : colonnes triables) ──────────────────────────────
  if (viewMode === 'list') {
    const COLS = 'grid-cols-[minmax(0,2.2fr)_90px_minmax(0,1.1fr)_minmax(0,1.1fr)_130px_92px]';
    return (
      <div className="flex flex-col gap-0 border border-gray-200/60 rounded-2xl overflow-hidden bg-white">
        <div className={`grid ${COLS} gap-2 px-4 pl-6 py-2.5 bg-gray-50 border-b border-gray-200/60`}>
          <SortHeader label="Nom du projet" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="N°" sortKey="code" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Lieu" sortKey="location" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Dossier" sortKey="folder" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Sauvegarde" sortKey="date" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <span />
        </div>
        {filteredProjects.map((proj) => {
          const isActive = proj.id === project?.id;
          const { dateStr, timeStr, isToday, projFolder, presence, fc, savedBy, savedByName, relative, saveHistory } = getProjectMeta(proj);
          return (
            <div
              key={proj.id}
              draggable
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(proj); }}
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', proj.id); e.dataTransfer.effectAllowed = 'move'; }}
              onClick={() => handleCardClick(proj)}
              onDoubleClick={() => handleCardDoubleClick(proj)}
              title="Clic : charger en session • Double-clic ou « Ouvrir » : Estima VRD • Glisser vers un dossier"
              className={`group relative grid ${COLS} gap-2 items-center px-4 pl-6 py-2.5 min-h-[48px] cursor-pointer transition-all border-b border-gray-100 last:border-b-0 ${
                isActive ? fc.card : 'hover:bg-gray-50'
              }`}
            >
              {/* Left stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${fc.stripe}`} />

              {/* Nom + badges */}
              <div className="flex items-center gap-2 min-w-0">
                <div className={`text-sm font-semibold truncate ${isActive ? fc.accent : 'text-gray-900'}`}>
                  {proj.name || 'Projet sans nom'}
                </div>
                {isActive && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${fc.badge}`}>Actif</span>}
                {raoProjectIds.has(proj.id) && (
                  <button onClick={e => { e.stopPropagation(); onNavigateModule?.('rao_analysis'); }} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60 hover:bg-blue-100 transition-colors shrink-0" title="Ouvrir l'analyse des offres">
                    <BarChart3 size={10} /> RAO
                  </button>
                )}
                {linkedCrcMap[proj.id] && (
                  <button onClick={e => { e.stopPropagation(); onNavigateModule?.('crc'); }} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100 transition-colors shrink-0" title={`Ouvrir CR : ${linkedCrcMap[proj.id].join(', ')}`}>
                    <ClipboardList size={10} /> {linkedCrcMap[proj.id].length} CR
                  </button>
                )}
                {presence.length > 0 && presence.map(p => (
                  <span key={p.uid} title={`${p.displayName || p.email} est sur ce projet`}
                    className="flex items-center gap-1 bg-blue-50 text-blue-500 border border-blue-200/60 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {p.displayName || p.email?.split('@')[0]}
                  </span>
                ))}
              </div>

              {/* N° */}
              <span className="text-xs font-medium text-gray-600 truncate">{proj.code || <span className="text-gray-300">—</span>}</span>

              {/* Lieu */}
              <span className="text-xs text-gray-500 truncate" title={proj.location || ''}>
                {proj.location || <span className="text-gray-300">—</span>}
              </span>

              {/* Dossier */}
              <span className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                {projFolder ? (
                  <>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${fc.dot}`} />
                    <span className="truncate" title={projFolder.name}>{projFolder.name}</span>
                  </>
                ) : <span className="text-gray-300">—</span>}
              </span>

              {/* Sauvegarde + auteur */}
              <div className="text-xs text-gray-500 min-w-0" title={`Enregistré le ${dateStr} à ${timeStr}${savedBy ? ' par ' + savedBy : ''}`}>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className={`shrink-0 ${isToday ? 'text-emerald-500' : 'text-gray-300'}`} />
                  <span className={`truncate ${isToday ? 'text-gray-700 font-medium' : ''}`}>{relative}</span>
                </div>
                {savedByName && (
                  <div className="flex items-center gap-1 text-gray-400 truncate pl-[18px]">
                    <User size={10} className="shrink-0" />{savedByName}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <button onClick={e => { e.stopPropagation(); onOpenInEstima?.(proj); }} title="Ouvrir dans Estima VRD"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-900 text-white hover:bg-gray-700 active:scale-[0.97] transition-all shadow-sm">
                  <ExternalLink size={11} /> Ouvrir
                </button>
                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === proj.id ? null : proj.id); }}
                    title="Plus d'actions" aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded={openMenuId === proj.id}
                    className={`p-1.5 rounded-lg transition-colors ${openMenuId === proj.id ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {openMenuId === proj.id && (
                    <div onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-lg border border-gray-200/70 p-1.5 z-40">
                      <MenuItem icon={Info} label="Fiche projet"
                        onClick={e => { e.stopPropagation(); setOpenMenuId(null); onInfoProject?.(proj); }} />
                      <MenuItem icon={Copy} label="Dupliquer cette affaire"
                        onClick={e => { setOpenMenuId(null); onDuplicateProject?.(proj, e); }} />
                      <MenuItem icon={Folder} label="Déplacer vers un dossier"
                        onClick={e => { e.stopPropagation(); setOpenMenuId(null); onMoveProject(proj); }} />
                      {saveHistory.length > 1 && (
                        <MenuItem icon={RotateCcw} label="Restaurer une version…"
                          onClick={e => { e.stopPropagation(); setOpenMenuId(null); onRestoreSnapshot?.(proj.id, saveHistory[1]); }} />
                      )}
                      <div className="h-px bg-gray-100 my-1 mx-2" />
                      <MenuItem icon={deletingId === proj.id ? RefreshCw : Trash2} label="Supprimer" danger
                        disabled={deletingId === proj.id} spinning={deletingId === proj.id}
                        onClick={e => { setOpenMenuId(null); onDeleteProject(proj, e); }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Vue GRILLE ───────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {filteredProjects.map((proj) => {
        const isActive = proj.id === project?.id;
        const { dateStr, timeStr, isToday, projFolder, presence, saveHistory, fc, savedBy, savedByName, relative } = getProjectMeta(proj);

        return (
          <div
            key={proj.id}
            draggable
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(proj); }}
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', proj.id); e.dataTransfer.effectAllowed = 'move'; }}
            onClick={() => handleCardClick(proj)}
            onDoubleClick={() => handleCardDoubleClick(proj)}
            title="Clic : charger en session • Double-clic ou « Ouvrir » : Estima VRD • Glisser vers un dossier"
            className={`group relative cursor-pointer border-2 rounded-2xl p-5 transition-all duration-200 flex flex-col h-full ${
              isActive ? fc.cardActive : `${fc.card} ${fc.cardHover} hover:shadow-lg hover:-translate-y-0.5`
            }`}
          >
            {/* Left color stripe — arrondie pour suivre la carte (plus d'overflow-hidden,
                afin que les menus kebab/versions puissent dépasser de la tuile) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[14px] ${fc.stripe}`} />

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2 pl-4">
              <h4 className={`font-semibold text-sm leading-snug flex-1 line-clamp-2 min-h-[36px] ${isActive ? fc.accent : 'text-gray-900'}`}>
                {proj.name || 'Projet sans nom'}
              </h4>
              {isActive && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg shrink-0 ${fc.badge}`}>Actif</span>}
              {presence.length > 0 && (
                <div className="flex items-center gap-1">
                  {presence.map(p => (
                    <span key={p.uid} title={`${p.displayName || p.email} est sur ce projet`}
                      className="flex items-center gap-1.5 bg-blue-50 text-blue-500 border border-blue-200/60 text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                      {p.displayName || p.email?.split('@')[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-1.5 mb-2 h-[20px] flex-wrap overflow-hidden">
              {proj.code && <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200/60">N° {proj.code}</span>}
              {proj.location && <span className="text-[11px] text-gray-400 flex items-center gap-1">📍 {proj.location}</span>}
              {raoProjectIds.has(proj.id) && (
                <button onClick={e => { e.stopPropagation(); onNavigateModule?.('rao_analysis'); }} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 hover:bg-blue-100 transition-colors cursor-pointer" title="Ouvrir l'analyse des offres">
                  <BarChart3 size={10} /> RAO
                </button>
              )}
              {linkedCrcMap[proj.id] && (
                <button onClick={e => { e.stopPropagation(); onNavigateModule?.('crc'); }} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100 transition-colors cursor-pointer" title={`Ouvrir CR : ${linkedCrcMap[proj.id].join(', ')}`}>
                  <ClipboardList size={10} /> {linkedCrcMap[proj.id].length} CR
                </button>
              )}
              {projFolder && <span className={`flex items-center gap-1 text-xs ml-auto ${fc.accent}`}><Folder size={10} /> {projFolder.name}</span>}
              {!proj.code && !proj.location && !projFolder && !linkedCrcMap[proj.id] && !raoProjectIds.has(proj.id) && <span className="text-xs text-gray-300 italic">Aucune info complémentaire</span>}
            </div>

            {/* Footer — 2 lignes : (date·heure | historique) puis (auteur | actions) */}
            <div className="mt-auto pt-2.5 border-t border-gray-100 space-y-1.5">
              {/* Ligne 1 : date + heure | historique */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0" title={`Enregistré le ${dateStr} à ${timeStr}${savedBy ? ' par ' + savedBy : ''}`}>
                  <Clock size={13} className={`shrink-0 ${isToday ? 'text-emerald-500' : 'text-gray-300'}`} />
                  <span className={`truncate ${isToday ? 'text-gray-700 font-medium' : ''}`}>{relative}</span>
                </div>
                {saveHistory.length > 1 && (
                  <div className="relative group/hist shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenHistId(openHistId === proj.id ? null : proj.id); }}
                      title="Versions précédentes" aria-label="Versions précédentes"
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                      <RotateCcw size={11} /> {saveHistory.length}
                    </button>
                    <div className={`${openHistId === proj.id ? 'block' : 'hidden group-hover/hist:block'} absolute bottom-full right-0 pb-1.5 z-30`}>
                      <div className="w-44 bg-white rounded-xl shadow-lg border border-gray-200/70 p-1.5">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1">Restaurer une version</p>
                        {saveHistory.slice(1).map((iso, i) => {
                          const d = new Date(iso);
                          const dStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                          const tStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <button key={i} onClick={e => { e.stopPropagation(); setOpenHistId(null); onRestoreSnapshot?.(proj.id, iso); }}
                              title={`Restaurer la version du ${dStr} à ${tStr}`}
                              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-[10px] text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                              <RotateCcw size={10} className="shrink-0" />
                              <span className="flex-1 text-left">{dStr} <span className="text-gray-300">{tStr}</span></span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Ligne 2 : auteur | actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[11px] text-gray-400 min-w-0 truncate" title={savedBy ? `Enregistré par ${savedBy}` : undefined}>
                  {savedByName && (<><User size={11} className="shrink-0 text-gray-300" /><span className="truncate">{savedByName}</span></>)}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={e => { e.stopPropagation(); onOpenInEstima?.(proj); }} title="Ouvrir dans Estima VRD"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-900 text-white hover:bg-gray-700 active:scale-[0.97] transition-all shadow-sm">
                    <ExternalLink size={11} /> Ouvrir
                  </button>
                  <div className="relative">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === proj.id ? null : proj.id); }}
                      title="Plus d'actions" aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded={openMenuId === proj.id}
                      className={`p-1.5 rounded-lg transition-colors ${
                        openMenuId === proj.id ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {openMenuId === proj.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        onDoubleClick={e => e.stopPropagation()}
                        className="absolute right-0 bottom-full mb-1.5 w-52 bg-white rounded-2xl shadow-lg border border-gray-200/70 p-1.5 z-40"
                      >
                        <MenuItem icon={Info} label="Fiche projet"
                          onClick={e => { e.stopPropagation(); setOpenMenuId(null); onInfoProject?.(proj); }} />
                        <MenuItem icon={Copy} label="Dupliquer cette affaire"
                          onClick={e => { setOpenMenuId(null); onDuplicateProject?.(proj, e); }} />
                        <MenuItem icon={Folder} label="Déplacer vers un dossier"
                          onClick={e => { e.stopPropagation(); setOpenMenuId(null); onMoveProject(proj); }} />
                        <div className="h-px bg-gray-100 my-1 mx-2" />
                        <MenuItem icon={deletingId === proj.id ? RefreshCw : Trash2} label="Supprimer" danger
                          disabled={deletingId === proj.id} spinning={deletingId === proj.id}
                          onClick={e => { setOpenMenuId(null); onDeleteProject(proj, e); }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PmProjectGrid;
