import React from 'react';
import { Cloud, Folder, Clock, RefreshCw, CloudOff, Trash2, RotateCcw } from 'lucide-react';

/**
 * PmProjectGrid
 * Grille ou liste des projets cloud avec etats de chargement, erreur, vide et presence.
 */
const PmProjectGrid = ({
  viewMode = 'grid',
  cloudLoading,
  cloudError,
  cloudProjects,
  filteredProjects,
  selectedFolderId,
  setSelectedFolderId,
  project,
  folders,
  presenceByProject,
  deletingId,
  onLoadProject,
  onDeleteProject,
  onMoveProject,
  onRestoreSnapshot,
}) => {

  if (cloudLoading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
      <RefreshCw size={28} className="animate-spin text-emerald-500" />
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
    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2">
        <Cloud size={32} className="text-slate-400" />
      </div>
      <p className="text-base font-medium text-slate-300">Aucun projet sauvegarde sur le Cloud</p>
      <p className="text-sm text-center max-w-sm">
        Utilise le bouton "Sauvegarder (Cloud)" dans le panneau de gauche pour synchroniser un projet.
      </p>
    </div>
  );

  if (filteredProjects.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
      <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-2">
        <Folder size={28} className="text-slate-400" />
      </div>
      <p className="text-base font-medium text-slate-300">Dossier vide</p>
      <p className="text-sm text-center max-w-xs">
        Aucune affaire dans ce dossier. Survole une affaire et clique sur l'icone dossier pour la deplacer ici.
      </p>
      <button onClick={() => setSelectedFolderId('__all__')} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
        &larr; Voir tous les projets
      </button>
    </div>
  );

  // ── Helpers communs ──────────────────────────────────────────────────────────
  const getProjectMeta = (proj) => {
    const date      = proj.lastSaved ? new Date(proj.lastSaved) : null;
    const dateStr   = date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const timeStr   = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const isToday   = date && new Date().toDateString() === date.toDateString();
    const chapCount = (proj.chapters || []).length;
    const elemCount = (proj.chapters || []).reduce((acc, c) => acc + (c.children || c.items || []).length, 0);
    const projFolder = proj.folderId ? folders.find(f => f.id === proj.folderId) : null;
    const presence  = presenceByProject[proj.id] || [];
    const saveHistory = (() => {
      if (Array.isArray(proj.saveHistory) && proj.saveHistory.length > 0) return proj.saveHistory;
      try { return JSON.parse(localStorage.getItem(`save_history_${proj.id}`) || '[]'); }
      catch { return []; }
    })();
    return { date, dateStr, timeStr, isToday, chapCount, elemCount, projFolder, presence, saveHistory };
  };

  // ── Vue LISTE ────────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-0 border border-slate-800 rounded-lg overflow-hidden">
        {/* Header du tableau */}
        <div className="grid grid-cols-[1fr_100px_80px_80px_140px_70px] gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span>Nom du projet</span>
          <span>N°</span>
          <span className="text-center">Chap.</span>
          <span className="text-center">Elem.</span>
          <span>Derniere sauvegarde</span>
          <span />
        </div>
        {filteredProjects.map((proj) => {
          const isActive = proj.id === project?.id;
          const { dateStr, timeStr, isToday, chapCount, elemCount, projFolder, presence } = getProjectMeta(proj);

          return (
            <div
              key={proj.id}
              onClick={() => onLoadProject(proj)}
              className={`group grid grid-cols-[1fr_100px_80px_80px_140px_70px] gap-2 items-center px-4 py-2.5 cursor-pointer transition-colors border-b border-slate-800/50 ${
                isActive
                  ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                  : 'hover:bg-slate-800/40 border-l-2 border-l-transparent'
              }`}
            >
              {/* Nom + localisation + presence */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-400' : 'text-slate-100'}`}>
                    {proj.name || 'Projet sans nom'}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {proj.location && (
                      <span className="text-[11px] text-slate-500 truncate">
                        <span className="text-slate-600">📍</span> {proj.location}
                      </span>
                    )}
                    {projFolder && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-600">
                        <Folder size={10} /> {projFolder.name}
                      </span>
                    )}
                  </div>
                </div>
                {isActive && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0">
                    Actif
                  </span>
                )}
                {presence.length > 0 && presence.map(p => (
                  <span
                    key={p.uid}
                    title={`${p.displayName || p.email} est sur ce projet`}
                    className="flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {p.displayName || p.email?.split('@')[0]}
                  </span>
                ))}
              </div>

              {/* N° */}
              <span className="text-xs font-medium text-slate-300 truncate">
                {proj.code || <span className="text-slate-600">—</span>}
              </span>

              {/* Chapitres */}
              <span className="text-xs text-slate-400 text-center">{chapCount}</span>

              {/* Elements */}
              <span className="text-xs text-slate-400 text-center">{elemCount}</span>

              {/* Date */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock size={12} className={isToday ? 'text-emerald-500' : 'text-slate-600'} />
                <span className={isToday ? 'text-slate-300 font-medium' : ''}>
                  {isToday ? "Aujourd'hui" : dateStr}
                </span>
                <span className="text-slate-600">{timeStr}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={e => { e.stopPropagation(); onMoveProject(proj); }}
                  className="p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Deplacer vers un dossier"
                >
                  <Folder size={13} />
                </button>
                <button
                  onClick={e => onDeleteProject(proj, e)}
                  disabled={deletingId === proj.id}
                  className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Supprimer definitivement"
                >
                  {deletingId === proj.id
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Vue GRILLE (defaut) ──────────────────────────────────────────────────────
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {filteredProjects.map((proj) => {
        const isActive = proj.id === project?.id;
        const { dateStr, timeStr, isToday, chapCount, elemCount, projFolder, presence, saveHistory } = getProjectMeta(proj);

        return (
          <div
            key={proj.id}
            onClick={() => onLoadProject(proj)}
            className={`group relative cursor-pointer bg-slate-900 border rounded-lg p-4 transition-all duration-200 flex flex-col h-full ${
              isActive
                ? 'border-emerald-500/50 shadow-sm shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                : 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/50'
            }`}
          >
            {/* En-tete carte */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className={`font-semibold text-sm leading-snug flex-1 line-clamp-2 min-h-[36px] ${isActive ? 'text-emerald-400' : 'text-slate-100 group-hover:text-white'}`}>
                {proj.name || 'Projet sans nom'}
              </h4>
              {isActive && (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0">
                  Actif
                </span>
              )}
              {presence.length > 0 && (
                <div className="flex items-center gap-1">
                  {presence.map(p => (
                    <span
                      key={p.uid}
                      title={`${p.displayName || p.email} est sur ce projet`}
                      className="flex items-center gap-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                      {p.displayName || p.email?.split('@')[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-1.5 mb-2 h-[20px] flex-wrap overflow-hidden">
              {proj.code && (
                <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  N° {proj.code}
                </span>
              )}
              {proj.location && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="text-slate-500">📍</span> {proj.location}
                </span>
              )}
              {projFolder && (
                <span className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                  <Folder size={10} className="text-slate-600" />
                  {projFolder.name}
                </span>
              )}
              {!proj.code && !proj.location && !projFolder && (
                <span className="text-xs text-slate-600 italic">Aucune information complementaire</span>
              )}
            </div>

            {/* Historique des 3 dernieres sauvegardes */}
            {saveHistory.length > 0 && (
              <div className="mb-2 pt-2 border-t border-slate-800/60 min-h-[60px]">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Dernieres sauvegardes
                </p>
                <div className="space-y-0.5">
                  {saveHistory.map((iso, idx) => {
                    const d     = new Date(iso);
                    const dStr  = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const tStr  = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const today = new Date().toDateString() === d.toDateString();
                    return (
                      <div key={idx} className="group/snap flex items-center gap-1.5 text-[10px]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${idx === 0 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                        <span className={idx === 0 ? 'text-slate-300 font-medium' : 'text-slate-500'}>
                          {today ? "Aujourd'hui" : dStr}
                        </span>
                        <span className="text-slate-600">{tStr}</span>
                        {idx === 0 ? (
                          <span className="ml-auto text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">
                            Derniere
                          </span>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); onRestoreSnapshot?.(proj.id, iso); }}
                            title={`Restaurer la version du ${dStr} a ${tStr}`}
                            className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors opacity-0 group-hover/snap:opacity-100"
                          >
                            <RotateCcw size={10} />
                            Restaurer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pied de carte */}
            <div className="mt-auto pt-2.5 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5" title={`${dateStr} a ${timeStr}`}>
                  <Clock size={13} className={isToday ? 'text-emerald-500' : 'text-slate-500'} />
                  <span className={isToday ? 'text-slate-300 font-medium' : ''}>{isToday ? "Aujourd'hui" : dateStr}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span title="Chapitres"><strong>{chapCount}</strong> ch.</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span title="Elements"><strong>{elemCount}</strong> el.</span>
                </div>
                {/* Deplacer */}
                <button
                  onClick={e => { e.stopPropagation(); onMoveProject(proj); }}
                  className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Deplacer vers un dossier"
                >
                  <Folder size={13} />
                </button>
                {/* Supprimer */}
                <button
                  onClick={e => onDeleteProject(proj, e)}
                  disabled={deletingId === proj.id}
                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Supprimer definitivement"
                >
                  {deletingId === proj.id
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PmProjectGrid;
