// src/views/CcapGeneratorView.jsx
import React, { useState, useCallback } from 'react';
import CcapSidebar from '../components/ccap/CcapSidebar';
import CcapPreview from '../components/ccap/CcapPreview';
import CcapEditorModal from '../components/modals/CcapEditorModal';
import DocumentVariablesModal from '../components/modals/DocumentVariablesModal';
import FavoritesPanel from '../components/common/FavoritesPanel';
import { useCcapManager } from '../hooks/useCcapManager';
import { useFavorites } from '../hooks/useFavorites';
import { Star } from 'lucide-react';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

const CcapGeneratorView = ({
  project, companyId, masterCcap, onSaveMasterCcap, masterBranding,
  onEditProject, onUpdateProject, onSaveProject,
  onEditBranding,
}) => {

  const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
  const [varsModalOpen, setVarsModalOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const manager = useCcapManager({
    project, companyId, masterCcap, onSaveMasterCcap, masterBranding, onUpdateProject, onSaveProject
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
      'CCAP',
      manager.selectedIds,
      manager.ccapData,
      manager.variables,
      project,
      manager.branding
    );
  }, [manager, project]);

  const handleEditProject = () => {
    onEditProject?.();
  };

  return (
    <div className="flex h-full w-full bg-[#f8fafc] overflow-hidden">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="ccap" />

      <CcapSidebar
        searchQuery={manager.searchQuery}
        setSearchQuery={manager.setSearchQuery}
        collapseAll={manager.collapseAll}
        expandAll={manager.expandAll}
        selectAll={manager.selectAll}
        deselectAll={manager.deselectAll}
        saveStatus={manager.saveStatus}
        filteredCcapData={manager.filteredCcapData}
        ccapDataLength={manager.ccapData.length}
        onEditProject={handleEditProject}
        addChapter={manager.addChapter}
        handleFileUpload={manager.handleFileUpload}
        handlePdfUpload={manager.handlePdfUpload}
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
        isFavorite={(nodeId) => isFavorite(nodeId, 'ccap')}
        toggleFavorite={(node) => toggleFavorite(node, 'ccap')}
        favoritesCount={favorites.filter(f => f.type === 'ccap').length}
        onOpenFavorites={() => setIsFavoritesPanelOpen(true)}
      />

      <CcapPreview
        ccapData={manager.ccapData}
        selectedIds={manager.selectedIds}
        variables={manager.variables}
        branding={manager.branding}
        setBrandingModalOpen={() => onEditBranding?.()}
        handlePreviewScroll={manager.handlePreviewScroll}
        openEditor={manager.openEditor}
        handleExportPdf={handleExportPdf}
        saveToCloud={manager.saveToCloud}
        saveStatus={manager.saveStatus}
        onEditVariables={() => setVarsModalOpen(true)}
      />

      <DocumentVariablesModal
        isOpen={varsModalOpen}
        onClose={() => setVarsModalOpen(false)}
        project={project}
        activeModule="ccap"
        onSave={(p) => onUpdateProject?.(p)}
        onOpenFullSheet={handleEditProject}
      />

      <CcapEditorModal
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
        activeType="ccap"
      />

      <style>{`
        .ccap-content { font-size: 15px; line-height: 1.7; }
        .ccap-content table { width: 100%; border-collapse: collapse; margin: 1em 0; table-layout: fixed; }
        .ccap-content td, .ccap-content th { border: 1px solid #cbd5e1; padding: 6px 10px; min-width: 30px; vertical-align: top; position: relative; font-size: 14px; text-align: left; }
        .ccap-content th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        .ccap-content ul { list-style-type: disc !important; padding-left: 1.5em !important; margin: 0.6em 0; }
        .ccap-content ol { list-style-type: decimal !important; padding-left: 1.5em !important; margin: 0.6em 0; }
        .ccap-content li { margin-bottom: 0.2em; }
        .ccap-content p { margin: 0 0 0.7em; }
        .ccap-content a { color: #2563eb; text-decoration: underline; }
        .ccap-content [align="justify"] { text-align: justify; }
        .ccap-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.4em 0; }
      `}</style>

    </div>
  );
};

export default CcapGeneratorView;
