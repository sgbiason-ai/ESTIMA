// src/views/ged/GedView.jsx
//
// GED — « Documents émis ».
// Vue dédiée au versionnage de l'étude de prix : figer une version (snapshot
// immuable horodaté + indice), consulter en lecture seule, comparer deux
// versions (audit ligne par ligne), supprimer.
//
// S'appuie sur le hook useProjectArchives (déjà branché dans App.jsx) :
//   archives, createArchive, deleteArchive  → passés en props.
// La consultation/comparaison est 100% locale à cette vue (viewer léger + modal).

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  FileStack, Archive, Eye, BarChart3, Trash2, Clock, User, Plus, Lock, Send, FileEdit, Mail,
} from 'lucide-react';
import { formatPrice } from '../../utils/helpers';
import { toast, confirm } from '../../utils/globalUI';
import { PHASES, getPhaseStyle, formatDateShort } from './gedConstants';
import GedVersionViewer from './GedVersionViewer';
import GedCompareModal from './GedCompareModal';
import FreezeVersionModal from './FreezeVersionModal';
import HelpButton from '../../components/help/HelpButton';
import HelpPanel from '../../components/help/HelpPanel';
import { gedHelp } from './gedHelp';

const GedView = ({ project, archives = [], onCreateArchive, onDeleteArchive, masterBranding = null }) => {
  const [viewingArchive, setViewingArchive] = useState(null); // archive consultée (viewer plein écran)
  const [compareSource, setCompareSource] = useState(null);   // archive source de la comparaison (modal)
  const [filterPhase, setFilterPhase] = useState(null);
  const [freezing, setFreezing] = useState(false);
  const [showFreeze, setShowFreeze] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const currentPhase = project?.phase || 'DCE';

  // Regroupement par phase, trié par indice.
  const grouped = useMemo(() => {
    const map = {};
    (archives || []).forEach((a) => {
      if (filterPhase && a.phase !== filterPhase) return;
      if (!map[a.phase]) map[a.phase] = [];
      map[a.phase].push(a);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (b.index || 0) - (a.index || 0)));
    return map;
  }, [archives, filterPhase]);

  const sortedPhases = PHASES.filter((p) => grouped[p]);
  const total = archives?.length || 0;

  // ── Figer la version actuelle (depuis la modal) ──
  const handleFreezeConfirm = async ({ phase, subject, recipient, status, note }) => {
    if (!onCreateArchive) return;
    setFreezing(true);
    try {
      const archive = await onCreateArchive(phase, { subject, recipient, status, note });
      toast.success(`Version « ${archive.label} » figée avec succès`);
      setShowFreeze(false);
    } catch (e) {
      toast.error('Erreur lors du gel : ' + e.message);
    } finally {
      setFreezing(false);
    }
  };

  const handleDelete = async (archive) => {
    const ok = await confirm(`Supprimer définitivement la version « ${archive.label} » ?`);
    if (!ok) return;
    try {
      await onDeleteArchive(archive.id);
      toast.success(`Version « ${archive.label} » supprimée`);
    } catch (e) {
      toast.error('Erreur suppression : ' + e.message);
    }
  };

  // ── Mode consultation plein écran ──
  if (viewingArchive) {
    return (
      <GedVersionViewer
        archive={viewingArchive}
        onBack={() => setViewingArchive(null)}
        branding={masterBranding}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f7]">

      {/* En-tête */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gray-900 rounded-xl"><FileStack size={20} className="text-white" /></div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Documents émis</h1>
            <p className="text-[11px] text-gray-400">
              {total} version{total > 1 ? 's' : ''} figée{total > 1 ? 's' : ''} — {project?.name || 'Projet sans nom'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <HelpButton onClick={() => setHelpOpen(true)} />
            <button
              onClick={() => setShowFreeze(true)}
              disabled={freezing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-[12px] font-bold rounded-xl hover:bg-gray-700 transition-colors active:scale-95 disabled:opacity-50"
            >
              <Plus size={15} />
              Figer la version
            </button>
          </div>
        </div>

        {/* Filtres phase */}
        {total > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => setFilterPhase(null)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${!filterPhase ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
            >
              Toutes
            </button>
            {PHASES.map((phase) => {
              const count = (archives || []).filter((a) => a.phase === phase).length;
              if (count === 0) return null;
              const s = getPhaseStyle(phase);
              return (
                <button
                  key={phase}
                  onClick={() => setFilterPhase(filterPhase === phase ? null : phase)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${filterPhase === phase ? `${s.light} ${s.text} ${s.border}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                >
                  {phase} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-4">
            <Archive size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="text-[14px] font-medium text-gray-500">Aucun document émis</p>
              <p className="text-[12px] text-gray-400 mt-1">
                Figez la version actuelle pour créer le premier indice de cette étude de prix.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {sortedPhases.map((phase) => {
              const s = getPhaseStyle(phase);
              return (
                <div key={phase}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${s.bg}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${s.text}`}>Phase {phase}</span>
                    <span className="text-[10px] text-gray-400">({grouped[phase].length})</span>
                  </div>
                  <div className="space-y-2">
                    {grouped[phase].map((archive) => (
                      <div
                        key={archive.id}
                        className="group bg-white border border-gray-200/60 rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          {/* Indice + lock */}
                          <div className="flex flex-col items-center gap-1 shrink-0 w-20">
                            <span className={`text-[13px] font-bold px-2.5 py-1 rounded-lg border ${s.light} ${s.text} ${s.border}`}>{archive.label}</span>
                            <span className="flex items-center gap-1 text-[8px] text-amber-500 font-bold uppercase tracking-wide"><Lock size={8} /> Figée</span>
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[14px] font-bold text-gray-900 font-mono">{formatPrice(archive.totalHT)} HT</span>
                              <span className="text-[11px] text-gray-400">{archive.itemsCount} articles · {archive.chaptersCount} chapitres</span>
                              <StatusBadge status={archive.status} />
                            </div>
                            {(archive.subject || archive.recipient) && (
                              <div className="flex items-center gap-3 text-[11px] text-gray-600 mb-1 truncate">
                                {archive.subject && <span className="font-medium truncate">{archive.subject}</span>}
                                {archive.recipient && (
                                  <span className="flex items-center gap-1 text-gray-400 shrink-0"><Mail size={11} /> {archive.recipient}</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-gray-400">
                              <span className="flex items-center gap-1"><Clock size={11} /> {formatDateShort(archive.createdAt)}</span>
                              <span className="flex items-center gap-1"><User size={11} /> {archive.createdBy}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <ActionBtn icon={Eye} label="Consulter" onClick={() => setViewingArchive(archive)} />
                            <ActionBtn icon={BarChart3} label="Comparer" onClick={() => setCompareSource(archive)} />
                            <ActionBtn icon={Trash2} label="Supprimer" danger onClick={() => handleDelete(archive)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de comparaison */}
      <GedCompareModal
        show={!!compareSource}
        onClose={() => setCompareSource(null)}
        sourceArchive={compareSource}
        archives={archives}
        currentProject={project}
      />

      {/* Modal de gel */}
      <FreezeVersionModal
        show={showFreeze}
        onClose={() => setShowFreeze(false)}
        onConfirm={handleFreezeConfirm}
        defaultPhase={currentPhase}
        archives={archives}
        projectName={project?.name}
        busy={freezing}
      />

      {/* Aide contextuelle */}
      <HelpPanel isOpen={helpOpen} onClose={() => setHelpOpen(false)} content={gedHelp} />
    </div>
  );
};

const ActionBtn = ({ icon: Icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-colors active:scale-95 ${danger ? 'text-gray-400 border-transparent hover:text-red-600 hover:bg-red-50 hover:border-red-200' : 'text-gray-500 border-gray-200 hover:text-gray-900 hover:bg-gray-100'}`}
  >
    <Icon size={15} />
  </button>
);

ActionBtn.propTypes = { icon: PropTypes.elementType, label: PropTypes.string, onClick: PropTypes.func, danger: PropTypes.bool };

// Badge de statut d'émission. Défaut 'emis' pour les archives d'avant le Lot 2.
const StatusBadge = ({ status }) => {
  const isDraft = status === 'brouillon';
  const Icon = isDraft ? FileEdit : Send;
  return (
    <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${isDraft ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
      <Icon size={9} /> {isDraft ? 'Brouillon' : 'Émis'}
    </span>
  );
};

StatusBadge.propTypes = { status: PropTypes.string };

GedView.propTypes = {
  project: PropTypes.object,
  archives: PropTypes.array,
  onCreateArchive: PropTypes.func,
  onDeleteArchive: PropTypes.func,
  masterBranding: PropTypes.object,
};

export default GedView;
