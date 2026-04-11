import React from 'react';
import { Cloud, Folder, Clock, RefreshCw, CloudOff, Trash2, RotateCcw, Info, ClipboardList, BarChart3 } from 'lucide-react';
import { NEUTRAL_COLOR } from './folderColors';

const PmProjectGrid = ({
  viewMode = 'grid',
  cloudLoading, cloudError, cloudProjects, filteredProjects,
  selectedFolderId, setSelectedFolderId,
  project, folders, folderColorMap = {},
  presenceByProject, deletingId,
  onLoadProject, onDeleteProject, onMoveProject, onRestoreSnapshot, onInfoProject, linkedCrcMap = {}, raoProjectIds = new Set(), onNavigateModule,
}) => {

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

  if (filteredProjects.length === 0) return (
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

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getProjectMeta = (proj) => {
    const date = proj.lastSaved ? new Date(proj.lastSaved) : null;
    const dateStr = date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const timeStr = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const isToday = date && new Date().toDateString() === date.toDateString();
    const chapCount = (proj.chapters || []).length;
    const elemCount = (proj.chapters || []).reduce((acc, c) => acc + (c.children || c.items || []).length, 0);
    const projFolder = proj.folderId ? folders.find(f => f.id === proj.folderId) : null;
    const presence = presenceByProject[proj.id] || [];
    const saveHistory = (() => {
      if (Array.isArray(proj.saveHistory) && proj.saveHistory.length > 0) return proj.saveHistory;
      try { return JSON.parse(localStorage.getItem(`save_history_${proj.id}`) || '[]'); } catch { return []; }
    })();
    const fc = proj.folderId ? (folderColorMap[proj.folderId] || NEUTRAL_COLOR) : NEUTRAL_COLOR;
    return { date, dateStr, timeStr, isToday, chapCount, elemCount, projFolder, presence, saveHistory, fc };
  };

  // ── Vue LISTE ────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-0 border border-gray-200/60 rounded-2xl overflow-hidden bg-white">
        <div className="grid grid-cols-[1fr_100px_80px_80px_140px_70px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200/60 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span>Nom du projet</span><span>N°</span><span className="text-center">Chap.</span><span className="text-center">Elem.</span><span>Dernière sauvegarde</span><span />
        </div>
        {filteredProjects.map((proj) => {
          const isActive = proj.id === project?.id;
          const { dateStr, timeStr, isToday, chapCount, elemCount, projFolder, presence, fc } = getProjectMeta(proj);
          return (
            <div
              key={proj.id}
              onClick={() => onLoadProject(proj)}
              className={`group relative grid grid-cols-[1fr_100px_80px_80px_140px_70px] gap-2 items-center px-4 pl-6 py-2.5 cursor-pointer transition-all border-b border-gray-100 ${
                isActive ? fc.card : 'hover:bg-gray-50'
              }`}
            >
              {/* Left stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${fc.stripe}`} />
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${fc.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold truncate ${isActive ? fc.accent : 'text-gray-900'}`}>
                    {proj.name || 'Projet sans nom'}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {proj.location && <span className="text-[11px] text-gray-400 truncate">📍 {proj.location}</span>}
                    {projFolder && <span className="flex items-center gap-1 text-[11px] text-gray-400"><Folder size={10} /> {projFolder.name}</span>}
                    {raoProjectIds.has(proj.id) && (
                      <button onClick={e => { e.stopPropagation(); onNavigateModule?.('rao_analysis'); }} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60 hover:bg-blue-100 transition-colors cursor-pointer" title="Ouvrir l'analyse des offres">
                        <BarChart3 size={10} /> RAO
                      </button>
                    )}
                    {linkedCrcMap[proj.id] && (
                      <button onClick={e => { e.stopPropagation(); onNavigateModule?.('crc'); }} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100 transition-colors cursor-pointer" title={`Ouvrir CR : ${linkedCrcMap[proj.id].join(', ')}`}>
                        <ClipboardList size={10} /> {linkedCrcMap[proj.id].length} CR
                      </button>
                    )}
                  </div>
                </div>
                {isActive && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${fc.badge}`}>Actif</span>}
                {presence.length > 0 && presence.map(p => (
                  <span key={p.uid} title={`${p.displayName || p.email} est sur ce projet`}
                    className="flex items-center gap-1 bg-blue-50 text-blue-500 border border-blue-200/60 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {p.displayName || p.email?.split('@')[0]}
                  </span>
                ))}
              </div>
              <span className="text-xs font-medium text-gray-600 truncate">{proj.code || <span className="text-gray-300">—</span>}</span>
              <span className="text-xs text-gray-400 text-center">{chapCount}</span>
              <span className="text-xs text-gray-400 text-center">{elemCount}</span>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Clock size={12} className={isToday ? 'text-emerald-500' : 'text-gray-300'} />
                <span className={isToday ? 'text-gray-600 font-medium' : ''}>{isToday ? "Aujourd'hui" : dateStr}</span>
                <span className="text-gray-300">{timeStr}</span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button onClick={e => { e.stopPropagation(); onInfoProject?.(proj); }} className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100" title="Fiche projet"><Info size={13} /></button>
                <button onClick={e => { e.stopPropagation(); onMoveProject(proj); }} className="p-1 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100" title="Déplacer"><Folder size={13} /></button>
                <button onClick={e => onDeleteProject(proj, e)} disabled={deletingId === proj.id} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="Supprimer">
                  {deletingId === proj.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
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
        const { dateStr, timeStr, isToday, chapCount, elemCount, projFolder, presence, saveHistory, fc } = getProjectMeta(proj);

        return (
          <div
            key={proj.id}
            onClick={() => onLoadProject(proj)}
            className={`group relative cursor-pointer border-2 rounded-2xl p-5 transition-all duration-200 flex flex-col h-full overflow-hidden ${
              isActive ? fc.cardActive : `${fc.card} ${fc.cardHover} hover:shadow-lg hover:-translate-y-0.5`
            }`}
          >
            {/* Left color stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${fc.stripe}`} />

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

            {/* Save history */}
            {saveHistory.length > 0 && (
              <div className="mb-2 pt-2 border-t border-gray-100 min-h-[60px]">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Dernières sauvegardes</p>
                <div className="space-y-0.5">
                  {saveHistory.map((iso, idx) => {
                    const d = new Date(iso);
                    const dStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const tStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const today = new Date().toDateString() === d.toDateString();
                    return (
                      <div key={idx} className="group/snap flex items-center gap-1.5 text-[10px]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${idx === 0 ? fc.dot : 'bg-gray-200'}`} />
                        <span className={idx === 0 ? 'text-gray-600 font-medium' : 'text-gray-400'}>{today ? "Aujourd'hui" : dStr}</span>
                        <span className="text-gray-300">{tStr}</span>
                        {idx === 0 ? (
                          <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${fc.accent}`}>Dernière</span>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); onRestoreSnapshot?.(proj.id, iso); }}
                            title={`Restaurer la version du ${dStr} à ${tStr}`}
                            className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors opacity-0 group-hover/snap:opacity-100">
                            <RotateCcw size={10} /> Restaurer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto pt-2.5 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <div className="flex items-center gap-1.5" title={`${dateStr} à ${timeStr}`}>
                  <Clock size={13} className={isToday ? 'text-emerald-500' : 'text-gray-300'} />
                  <span className={isToday ? 'text-gray-600 font-medium' : ''}>{isToday ? "Aujourd'hui" : dateStr}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span><strong>{chapCount}</strong> ch.</span>
                  <span className="w-1 h-1 rounded-full bg-gray-200" />
                  <span><strong>{elemCount}</strong> el.</span>
                </div>
                <button onClick={e => { e.stopPropagation(); onInfoProject?.(proj); }} className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100" title="Fiche projet"><Info size={13} /></button>
                <button onClick={e => { e.stopPropagation(); onMoveProject(proj); }} className="p-1 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100" title="Déplacer"><Folder size={13} /></button>
                <button onClick={e => onDeleteProject(proj, e)} disabled={deletingId === proj.id} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="Supprimer">
                  {deletingId === proj.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
