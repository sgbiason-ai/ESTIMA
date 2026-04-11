// src/views/RcGeneratorView.jsx
import React, { useState, useCallback } from 'react';
import RcSidebar from '../components/rc/RcSidebar';
import RcPreview from '../components/rc/RcPreview';
import RcEditorModal from '../components/modals/RcEditorModal';
import FavoritesPanel from '../components/common/FavoritesPanel';
import { useRcManager } from '../hooks/useRcManager';
import { useFavorites } from '../hooks/useFavorites';
import { Star } from 'lucide-react';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

const RcGeneratorView = ({ 
  project, masterRc, onSaveMasterRc, masterBranding, 
  onSaveMasterBranding, onEditProject, onUpdateProject, onSaveProject,
  onEditBranding,
}) => {
  
  const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const manager = useRcManager({
    project, masterRc, onSaveMasterRc, masterBranding, onUpdateProject, onSaveProject
  });

  const { favorites, toggleFavorite, isFavorite, removeFavorite } = useFavorites();

  const handleInsertFavorite = useCallback((fav) => {
    manager.openEditor({
      id: `fav_insert_${Date.now()}`,
      title: fav.title,
      content: fav.content,
      level: fav.level,
      isNew: true,
    });
    setIsFavoritesPanelOpen(false);
  }, [manager]);

  const handleExportPdf = useCallback(async () => {
    const { generatePdfCctpRc } = await import('../utils/pdfCctpRcGenerator');
    await generatePdfCctpRc(
      'RC',
      manager.selectedIds,
      manager.rcData,
      manager.variables,
      project,
      manager.branding
    );
  }, [manager, project]);

  // Utilise le modal global de App.jsx via onEditProject (= modals.openProjectModal)
  const handleEditProject = () => {
    onEditProject?.();
  };

  return (
    <div className="flex h-full w-full bg-[#f8fafc] overflow-hidden">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="rc" />

      <RcSidebar 
        searchQuery={manager.searchQuery}
        setSearchQuery={manager.setSearchQuery}
        collapseAll={manager.collapseAll}
        expandAll={manager.expandAll}
        saveStatus={manager.saveStatus}
        filteredRcData={manager.filteredRcData}
        rcDataLength={manager.rcData.length}
        onEditProject={handleEditProject}
        addChapter={manager.addChapter}
        handleFileUpload={manager.handleFileUpload}
        handleExportMaster={manager.handleExportMaster}
        handleExportPdf={handleExportPdf}
        saveToCloud={manager.saveToCloud}
        expandedIds={manager.expandedIds}
        selectedIds={manager.selectedIds}
        activeNodeId={manager.activeNodeId}
        toggleExpand={manager.toggleExpand}
        toggleSelection={manager.toggleSelection}
        openEditor={manager.openEditor}
        deleteNode={manager.deleteNode}
        isFavorite={(nodeId) => isFavorite(nodeId, 'rc')}
        toggleFavorite={(node) => toggleFavorite(node, 'rc')}
        favoritesCount={favorites.filter(f => f.type === 'rc').length}
        onOpenFavorites={() => setIsFavoritesPanelOpen(true)}
      />

      <RcPreview
        rcData={manager.rcData}
        selectedIds={manager.selectedIds}
        variables={manager.variables}
        branding={manager.branding}
        setBrandingModalOpen={() => onEditBranding?.()}
        handlePreviewScroll={manager.handlePreviewScroll}
        openEditor={manager.openEditor}
        handleExportPdf={handleExportPdf}
        saveToCloud={manager.saveToCloud}
        saveStatus={manager.saveStatus}
        onEditProject={handleEditProject}
      />

      <RcEditorModal 
        isOpen={manager.modalOpen} 
        onClose={() => manager.setModalOpen(false)} 
        node={manager.nodeToEdit} 
        onSave={manager.handleSaveNode} 
        availableVariables={manager.variables} 
      />

      {/* ── Bouton flottant Aide ── */}
      <div className="fixed bottom-6 right-28 z-30">
        <HelpButton onClick={() => setShowHelp(true)} />
      </div>

      {/* ── Bouton flottant Favoris ── */}
      <button
        onClick={() => setIsFavoritesPanelOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-white rounded-full shadow-lg shadow-amber-200 hover:shadow-amber-300 transition-all hover:scale-105 font-bold text-sm"
        title="Voir les clauses favorites"
      >
        <Star size={15} className="fill-white" />
        Favoris
        {favorites.length > 0 && (
          <span className="bg-white text-amber-600 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center leading-none">
            {favorites.length}
          </span>
        )}
      </button>

      {/* ── Panneau favoris ── */}
      <FavoritesPanel
        isOpen={isFavoritesPanelOpen}
        onClose={() => setIsFavoritesPanelOpen(false)}
        favorites={favorites}
        onInsert={handleInsertFavorite}
        onRemove={removeFavorite}
        activeType="rc"
      />

      <style>{`
        .rc-content table { width: 100%; border-collapse: collapse; margin: 1em 0; border: 1px solid #e2e8f0; }
        .rc-content th, .rc-content td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        .rc-content th { background-color: #f1f5f9; font-weight: bold; }
        .rc-content ul { list-style-type: disc !important; padding-left: 1.5em !important; margin: 0.5em 0; }
        .rc-content ol { list-style-type: decimal !important; padding-left: 1.5em !important; margin: 0.5em 0; }
        .rc-content li { margin-bottom: 0.25em; }
        .rc-content p { margin-bottom: 0.8em; text-align: justify; }
      `}</style>

    </div>
  );
};

export default RcGeneratorView;