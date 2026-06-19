// src/views/CctpGeneratorView.jsx
import React, { useState, useCallback, useMemo } from 'react';
import CctpSidebar from '../components/cctp/CctpSidebar';
import CctpPreview from '../components/cctp/CctpPreview';
import CctpEditorModal from '../components/modals/CctpEditorModal';
import DocumentVariablesModal from '../components/modals/DocumentVariablesModal';
import FavoritesPanel from '../components/common/FavoritesPanel';
import { useCctpManager } from '../hooks/useCctpManager';
import { useFavorites } from '../hooks/useFavorites';
import { Star } from 'lucide-react';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

const CctpGeneratorView = ({ 
  project, companyId, masterCctp, onSaveMasterCctp, masterBranding,
  onEditProject, onUpdateProject, onSaveProject,
  onEditBranding,
}) => {
  
  const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [varsModalOpen, setVarsModalOpen] = useState(false);

  const manager = useCctpManager({
    project, companyId, masterCctp, onSaveMasterCctp, masterBranding, onUpdateProject, onSaveProject
  });

  const { favorites, toggleFavorite, isFavorite, removeFavorite } = useFavorites();

  // Insère un favori dans le document CCTP courant via l'éditeur
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

  // Utilise le modal global de App.jsx via onEditProject (= modals.openProjectModal)
  const handleEditProject = () => {
    onEditProject?.();
  };

  // ── Mode « focus article » : apprentissage des correspondances devis ↔ CCTP ──
  const [focusArticleId, setFocusArticleId] = useState(null);
  const focusArticle = useMemo(
    () => manager.devisItems.find((i) => i.id === focusArticleId) || null,
    [manager.devisItems, focusArticleId]
  );
  const focusTargets = useMemo(
    () => (focusArticle ? manager.getArticleTargets(focusArticle) : null),
    [focusArticle, manager.cctpData, manager.learnedLinks] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Coche/décoche un chapitre en mode focus ET mémorise la correction pour cet article.
  const handleLearnToggle = useCallback((nodeId) => {
    if (!focusArticle) return;
    const willSelect = !manager.selectedIds.has(nodeId);
    manager.toggleSelection(nodeId);
    manager.learnLink(focusArticle, nodeId, willSelect ? 'add' : 'remove');
  }, [focusArticle, manager]);

  return (
    <div className="flex h-full w-full bg-[#f8fafc] overflow-hidden">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="cctp" />

      <CctpSidebar 
        searchQuery={manager.searchQuery}
        setSearchQuery={manager.setSearchQuery}
        collapseAll={manager.collapseAll}
        expandAll={manager.expandAll}
        selectAll={manager.selectAll}
        deselectAll={manager.deselectAll}
        autoSelectChapters={manager.autoSelectChapters}
        saveStatus={manager.saveStatus}
        filteredCctpData={manager.filteredCctpData}
        cctpDataLength={manager.cctpData.length}
        onEditProject={handleEditProject}
        addChapter={manager.addChapter}
        handleFileUpload={manager.handleFileUpload}
        handlePdfUpload={manager.handlePdfUpload}
        handleExportMaster={manager.handleExportMaster}
        saveToCloud={manager.saveToCloud}
        expandedIds={manager.expandedIds}
        selectedIds={manager.selectedIds}
        activeNodeId={manager.activeNodeId}
        toggleExpand={manager.toggleExpand}
        toggleSelection={manager.toggleSelection}
        openEditor={manager.openEditor}
        deleteNode={manager.deleteNode}
        isFavorite={(nodeId) => isFavorite(nodeId, 'cctp')}
        toggleFavorite={(node) => toggleFavorite(node, 'cctp')}
        favoritesCount={favorites.filter(f => f.type === 'cctp').length}
        onOpenFavorites={() => setIsFavoritesPanelOpen(true)}
        provenance={manager.provenance}
        devisItems={manager.devisItems}
        focusArticleId={focusArticleId}
        setFocusArticleId={setFocusArticleId}
        focusTargets={focusTargets}
        onLearnToggle={handleLearnToggle}
      />

      <CctpPreview
        cctpData={manager.cctpData}
        selectedIds={manager.selectedIds}
        variables={manager.variables}
        branding={manager.branding}
        setBrandingModalOpen={() => onEditBranding?.()}
        handlePreviewScroll={manager.handlePreviewScroll}
        openEditor={manager.openEditor}
        saveToCloud={manager.saveToCloud}
        saveStatus={manager.saveStatus}
        onEditVariables={() => setVarsModalOpen(true)}
      />

      <DocumentVariablesModal
        isOpen={varsModalOpen}
        onClose={() => setVarsModalOpen(false)}
        project={project}
        activeModule="cctp"
        onSave={(p) => onUpdateProject?.(p)}
        onOpenFullSheet={handleEditProject}
      />

      <CctpEditorModal
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
        activeType="cctp"
      />

      <style>{`
        .cctp-content { font-size: 15px; line-height: 1.7; }
        .cctp-content table { width: 100%; border-collapse: collapse; margin: 1em 0; table-layout: fixed; }
        .cctp-content td, .cctp-content th { border: 1px solid #cbd5e1; padding: 6px 10px; min-width: 30px; vertical-align: top; position: relative; font-size: 14px; text-align: left; }
        .cctp-content th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        .cctp-content ul { list-style-type: disc !important; padding-left: 1.5em !important; margin: 0.6em 0; }
        .cctp-content ol { list-style-type: decimal !important; padding-left: 1.5em !important; margin: 0.6em 0; }
        .cctp-content li { margin-bottom: 0.2em; }
        .cctp-content p { margin: 0 0 0.7em; }
        .cctp-content a { color: #2563eb; text-decoration: underline; }
        .cctp-content [align="justify"] { text-align: justify; }
        .cctp-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.4em 0; }
      `}</style>

    </div>
  );
};

export default CctpGeneratorView;