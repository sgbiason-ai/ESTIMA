// src/components/modals/ArchiveManagerModal.jsx
import React, { useState, useMemo } from 'react';
import { X, Archive, Eye, BarChart3, Clock, FileText, Layers, User, ChevronRight, Search, Trash2 } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';

const PHASES = ['ESQ', 'AVP', 'PRO', 'DCE', 'DCE+', 'EXE'];

const PHASE_STYLES = {
  ESQ:   { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', ring: 'ring-purple-200' },
  AVP:   { bg: 'bg-amber-500',  light: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  ring: 'ring-amber-200' },
  PRO:   { bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   ring: 'ring-blue-200' },
  DCE:   { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  'DCE+': { bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', ring: 'ring-teal-200' },
  EXE:   { bg: 'bg-red-500',    light: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    ring: 'ring-red-200' },
};

const getStyle = (phase) => PHASE_STYLES[phase] || PHASE_STYLES.DCE;

const ArchiveManagerModal = ({ show, onClose, archives, onViewArchive, onDeleteArchive, onOpenAudit, activeArchive }) => {
  const [filterPhase, setFilterPhase] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // archiveId en attente de confirmation
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // Grouper et filtrer
  const grouped = useMemo(() => {
    const map = {};
    (archives || []).forEach(a => {
      if (filterPhase && a.phase !== filterPhase) return;
      if (search && !a.label.toLowerCase().includes(search.toLowerCase()) && !a.projectName?.toLowerCase().includes(search.toLowerCase())) return;
      if (!map[a.phase]) map[a.phase] = [];
      map[a.phase].push(a);
    });
    // Trier chaque groupe par index
    Object.values(map).forEach(list => list.sort((a, b) => a.index - b.index));
    return map;
  }, [archives, filterPhase, search]);

  const sortedPhases = PHASES.filter(p => grouped[p]);
  const totalArchives = archives?.length || 0;
  const selectedArchive = archives?.find(a => a.id === selectedId) || null;

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[950px] max-h-[80vh] flex flex-col overflow-hidden border border-slate-200">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl">
              <Archive size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">Gestionnaire d'archives</h2>
              <p className="text-[11px] text-slate-400">{totalArchives} archive{totalArchives > 1 ? 's' : ''} enregistrée{totalArchives > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar gauche : filtres + liste ── */}
          <div className="w-[360px] border-r border-slate-200 flex flex-col bg-slate-50/50 shrink-0">

            {/* Recherche */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-8 pr-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none"
                />
              </div>
            </div>

            {/* Filtres phase */}
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-100">
              <button
                onClick={() => setFilterPhase(null)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-colors
                  ${!filterPhase ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
              >
                Toutes
              </button>
              {PHASES.map(phase => {
                const count = (archives || []).filter(a => a.phase === phase).length;
                if (count === 0) return null;
                const s = getStyle(phase);
                return (
                  <button
                    key={phase}
                    onClick={() => setFilterPhase(filterPhase === phase ? null : phase)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-colors
                      ${filterPhase === phase
                        ? `${s.light} ${s.text} ${s.border}`
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    {phase} ({count})
                  </button>
                );
              })}
            </div>

            {/* Liste des archives */}
            <div className="flex-1 overflow-y-auto">
              {sortedPhases.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-[12px]">
                  Aucune archive trouvée
                </div>
              )}
              {sortedPhases.map(phase => {
                const s = getStyle(phase);
                return (
                  <div key={phase}>
                    {/* Header phase */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/80 sticky top-0">
                      <div className={`w-2 h-2 rounded-full ${s.bg}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>
                        Phase {phase}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({grouped[phase].length})
                      </span>
                    </div>

                    {/* Items */}
                    {grouped[phase].map(archive => {
                      const isSelected = selectedId === archive.id;
                      const isActive = activeArchive?.id === archive.id;
                      return (
                        <button
                          key={archive.id}
                          onClick={() => setSelectedId(isSelected ? null : archive.id)}
                          className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all
                            ${isSelected ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500' : 'hover:bg-white border-l-[3px] border-l-transparent'}
                            ${isActive ? 'ring-1 ring-amber-300 bg-amber-50/30' : ''}
                          `}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${s.light} ${s.text} ${s.border} border`}>
                                {archive.label}
                              </span>
                              {isActive && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                                  Affiché
                                </span>
                              )}
                            </div>
                            <ChevronRight size={14} className={`transition-transform ${isSelected ? 'text-indigo-500 rotate-90' : 'text-slate-300'}`} />
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="font-mono font-semibold text-slate-600">{formatPrice(archive.totalHT)} HT</span>
                            <span>{archive.itemsCount} art.</span>
                            <span>{archive.chaptersCount} chap.</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400">
                            <Clock size={10} />
                            <span>{new Date(archive.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span>— {archive.createdBy}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Panneau droit : détail de l'archive sélectionnée ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedArchive ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
                <Archive size={40} strokeWidth={1.2} />
                <p className="text-[13px] font-medium">Sélectionnez une archive</p>
                <p className="text-[11px]">Cliquez sur une archive à gauche pour voir le détail</p>
              </div>
            ) : (
              <>
                {/* En-tête détail */}
                <div className="px-6 py-4 border-b border-slate-100 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-[13px] font-bold px-3 py-1 rounded-lg ${getStyle(selectedArchive.phase).light} ${getStyle(selectedArchive.phase).text} ${getStyle(selectedArchive.phase).border} border`}>
                        {selectedArchive.label}
                      </span>
                      <span className="text-[13px] font-medium text-slate-700">
                        {selectedArchive.projectName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(selectedArchive.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1"><User size={12} /> {selectedArchive.createdBy}</span>
                  </div>
                </div>

                {/* KPIs */}
                <div className="px-6 py-4 border-b border-slate-100 shrink-0">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total HT</div>
                      <div className="text-[18px] font-bold text-slate-800 font-mono">{formatPrice(selectedArchive.totalHT)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Articles</div>
                      <div className="text-[18px] font-bold text-slate-800 font-mono">{selectedArchive.itemsCount}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Chapitres</div>
                      <div className="text-[18px] font-bold text-slate-800 font-mono">{selectedArchive.chaptersCount}</div>
                    </div>
                  </div>
                </div>

                {/* Aperçu chapitres */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Sommaire</h3>
                  <div className="space-y-1">
                    {(selectedArchive.projectSnapshot?.chapters || []).map((chap, i) => {
                      let chapTotal = 0;
                      const countItems = (nodes) => {
                        let c = 0;
                        (nodes || []).forEach(n => {
                          if (n.type === 'item' && !n.isOption) {
                            chapTotal += (Number(n.qty) || 0) * (Number(n.price) || 0);
                            c++;
                          }
                          if (n.children) c += countItems(n.children);
                        });
                        return c;
                      };
                      const items = countItems(chap.children);
                      return (
                        <div key={chap.id || i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <span className="text-[11px] font-mono font-bold text-slate-400 w-6 text-right">{i + 1}.</span>
                          <span className="text-[12px] font-medium text-slate-700 flex-1 truncate">{chap.title || 'Sans titre'}</span>
                          <span className="text-[10px] text-slate-400">{items} art.</span>
                          <span className="text-[11px] font-mono font-semibold text-slate-600 w-24 text-right">{formatPrice(chapTotal)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => { onViewArchive(selectedArchive); onClose(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700 transition-colors active:scale-95"
                  >
                    <Eye size={14} />
                    Visualiser
                  </button>
                  <button
                    onClick={() => { onViewArchive(selectedArchive); onOpenAudit(selectedArchive); onClose(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-[11px] font-bold border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors active:scale-95"
                  >
                    <BarChart3 size={14} />
                    Comparer
                  </button>
                  <div className="ml-auto">
                    {confirmDelete === selectedArchive.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-red-600 font-medium">Confirmer ?</span>
                        <button
                          onClick={async () => {
                            await onDeleteArchive(selectedArchive.id);
                            setConfirmDelete(null);
                            setSelectedId(null);
                          }}
                          className="px-3 py-1.5 text-[10px] font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors active:scale-95"
                        >
                          Supprimer
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(selectedArchive.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors"
                        title="Supprimer cette archive"
                      >
                        <Trash2 size={13} />
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveManagerModal;
