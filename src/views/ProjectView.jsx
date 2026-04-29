// src/views/ProjectView.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useStableHash } from '../hooks/useStableHash';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Layers, HelpCircle, Archive, BarChart3 } from 'lucide-react';

import { ProjectContext } from '../context/ProjectContext';
import { EditableTitle, OptionToggle } from '../components/ProjectUI';
import ItemList from '../components/ItemList';
import { formatPrice, generateId } from '../utils/helpers';
import { toast, confirm } from '../utils/globalUI';

import ProjectDetailsModal from '../components/modals/ProjectDetailsModal';
import CalculationModal from '../components/modals/CalculationModal';
import ExportModal from '../components/modals/ExportModal'; 
import EditBpuModal from '../components/database/EditBpuModal';
import ProjectToolbar from '../components/ProjectToolbar';
import BpuSidebar from '../components/BpuSidebar';
import TranchesBar from '../components/TranchesBar';
import ProjectStatsBar from '../components/ProjectStatsBar';
import ProjectFooterStats from '../components/ProjectFooterStats';

// NOUVEAUX COMPOSANTS EXTRAITS
import ProjectFormulaBar from '../components/project/ProjectFormulaBar'; 
import FormulaHelpModal from '../components/modals/FormulaHelpModal';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
import ArchiveManagerModal from '../components/modals/ArchiveManagerModal';
import ArchiveAuditModal from '../components/modals/ArchiveAuditModal';
import PriceAuditModal from '../components/modals/PriceAuditModal';
import CloudProjectPicker from '../components/modals/CloudProjectPicker';

// NOS CUSTOM HOOKS
import { useProjectTranches } from '../hooks/useProjectTranches';
import { useProjectCalculations } from '../hooks/useProjectCalculations';
import { saveFileWithPicker, openFileWithPicker, FILE_TYPES, PICKER_IDS } from '../utils/fileSaver';

const ProjectView = ({
  project,
  showBpu,
  setShowBpu,
  bpuSearch,
  setBpuSearch,
  filteredBpu,
  categories,
  addItemToProject,
  selection,
  setSelection,
  updateProjectItem,
  setModal, 
  addChapter,
  addSubChapter,
  updateProjectName,
  onDragEnd,
  viewMode = 'study',
  setViewMode,
  clientPercent,
  bpuConfig,
  setBpuConfig,
  onSaveProject,
  onSaveStatusChange, // <-- AJOUT DE LA PROP MANQUANTE ICI
  onReplaceProject,
  masterBranding = null,
  units = [],
  masterCctp = [],
  allBpuItems = [],
  companyId,
  onLoadCloudProject,
  // Archives
  archives = [],
  activeArchive = null,
  onCreateArchive,
  onDeleteArchive,
  onViewArchive,
  onCloseArchive,
}) => {
  const currentMode = viewMode || 'study';
  // En mode archive, toujours read-only
  const isReadOnly = currentMode === 'client' || !!activeArchive;
  // Le projet affiché : soit l'archive, soit le projet courant
  const viewedProject = activeArchive ? activeArchive.projectSnapshot : project;

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showArchiveManager, setShowArchiveManager] = useState(false);
  const [showPriceAudit, setShowPriceAudit] = useState(false);
  const [showCloudPicker, setShowCloudPicker] = useState(false);

  const handleArchive = async () => {
    if (!onCreateArchive) return;
    const phase = project?.phase || 'DCE';
    try {
      const archive = await onCreateArchive(phase);
      toast.success(`Archive "${archive.label}" créée avec succès`);
    } catch (e) {
      toast.error('Erreur lors de la création de l\'archive : ' + e.message);
    }
  };

  // ── Handlers Audit Prix ──
  const handleRestorePrice = (itemId, bpuPrice) => {
    if (bpuPrice == null) return;
    // Trouver le parentId de l'item
    const findParent = (nodes, targetId, parentId = 'root') => {
      for (const node of nodes) {
        if (node.id === targetId) return parentId;
        if (node.children) {
          const found = findParent(node.children, targetId, node.id);
          if (found) return found;
        }
      }
      return null;
    };
    const parentId = findParent(project?.chapters || [], itemId);
    if (parentId) {
      updateProjectItem(parentId, itemId, 'price', Number(bpuPrice));
    }
  };

  const handleRestoreAllPrices = (restorations) => {
    if (!restorations?.length) return;
    // Batch : cloner les chapters et appliquer toutes les restaurations d'un coup
    const chaptersClone = JSON.parse(JSON.stringify(project?.chapters || []));
    const priceMap = new Map(restorations.map(r => [r.id, Number(r.price)]));
    const applyAll = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'item' && priceMap.has(node.id)) {
          node.price = priceMap.get(node.id);
        }
        if (node.children) applyAll(node.children);
      });
    };
    applyAll(chaptersClone);
    updateProjectItem('root', 'root', 'chapters', chaptersClone);
  };

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState(null); 
  const [exportModalState, setExportModalState] = useState({ show: false, format: 'pdf', type: 'ESTIMATION' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, itemId: null });
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);
  const [calculationAnalysis, setCalculationAnalysis] = useState({ totalStudy: 0, fixedTotal: 0, smallQtyTotal: 0 });
  const [formulaMode, setFormulaMode] = useState({ isActive: false, callback: null });

  // ── SAUVEGARDE / OUVERTURE D'AFFAIRE ─────────────────────────────────────────
  const loadAffaireRef = useRef(null);

  const handleNewProject = async () => {
    const ok = await confirm('Créer un nouveau projet ? Les modifications non sauvegardées seront perdues.');
    if (!ok) return;
    const newProject = {
      id: generateId(),
      name: '',
      chapters: [{ id: 'c1', title: 'TRAVAUX PREPARATOIRES', children: [], type: 'chapter', isOption: false }],
      tranches: [],
      sourceIds: [],
    };
    try {
      if (onReplaceProject) onReplaceProject(newProject);
      toast.success('Nouveau projet créé.');
    } catch (e) {
      console.error('[ProjectView] Erreur création nouveau projet:', e);
      toast.error('Impossible de créer le projet.');
    }
  };

  const handleSaveAffaire = async () => {
    if (!project) return;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const safeName = (project.name || 'affaire').replace(/[^a-z0-9_\-]/gi, '_');
    await saveFileWithPicker(blob, `${safeName}_${new Date().toISOString().slice(0, 10)}.json`, FILE_TYPES.json, PICKER_IDS.affaireSave);
  };

  const handleOpenAffaire = async (e) => {
    // Tenter d'abord la File System Access API (retient le dernier dossier)
    const file = await openFileWithPicker(FILE_TYPES.json, PICKER_IDS.affaireOpen);
    if (file) {
      readAndLoadAffaire(file);
      return;
    }
    // Fallback : utiliser le file input caché
    if (e) {
      const fallbackFile = e.target?.files?.[0];
      if (fallbackFile) readAndLoadAffaire(fallbackFile);
    } else {
      loadAffaireRef.current?.click();
    }
  };

  const handleOpenAffaireFallback = (e) => {
    const file = e.target.files?.[0];
    if (file) readAndLoadAffaire(file);
    e.target.value = null;
  };

  const readAndLoadAffaire = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data || !data.chapters) {
          toast.error('Fichier invalide : ce JSON ne contient pas une structure d\'affaire valide.');
          return;
        }
        if (onReplaceProject) {
          onReplaceProject(data);
        } else {
          toast.error('Connectez onReplaceProject dans App.jsx pour charger une affaire.');
        }
      } catch {
        toast.error('Erreur de lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
  };
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (project && project.__isNew) {
        setShowDetailsModal(true);
        updateProjectItem('root', 'root', '__isNew', false);
    }
  }, [project]);

  const handleSaveDetails = (details) => {
    if (details?.name && details.name !== project?.name) updateProjectName(details.name);
    Object.keys(details || {}).forEach(key => {
        if (key !== 'name') updateProjectItem('root', 'root', key, details[key]);
    });
  };

  const theme = {
    bg: currentMode === 'client' ? 'bg-indigo-50/30' : 'bg-[#f8fafc]',
    textMain: currentMode === 'client' ? 'text-indigo-900' : 'text-slate-900',
    chapterHeader: currentMode === 'client' ? 'bg-indigo-900' : 'bg-slate-900',
  };

  const { activeTrancheId, setActiveTrancheId, tranches, hasTranches, isGlobalMode, addTranche, removeTranche } = useProjectTranches(project, updateProjectItem);

  const { studyQtyMaps, clientQtyMap, clientQtyMaps, displayProject, refMap, projectStats, currentStats, totalBase, totalOption } = useProjectCalculations({
    project: viewedProject, clientPercent, hasTranches, tranches, activeTrancheId, currentMode, bpuConfig
  });

  const flattenItems = (nodes, result = []) => {
    nodes?.forEach(node => {
      if (node.type === 'item') {
        result.push({ 
          id: node.id, 
          designation: node.designation || '', 
          unit: node.unit || '', 
          formula: node.formula || '', 
          quantitiesFormula: node.quantitiesFormula || {} 
        });
      }
      if (node.children) flattenItems(node.children, result);
    });
    return result;
  };
  
  const allItems = flattenItems(displayProject?.chapters);

  const findItemById = (nodes, id) => {
    for (const node of (nodes || [])) {
      if (node.id === id) return node;
      const found = findItemById(node.children, id);
      if (found) return found;
    }
    return null;
  };
  
  const selectedItem = selection?.type === 'item' ? findItemById(displayProject?.chapters, selection?.id) : null;
  const selectedFormula = selectedItem ? ((activeTrancheId && activeTrancheId !== 'global') ? selectedItem.quantitiesFormula?.[activeTrancheId] : selectedItem.formula) : null;
  const hasSelectedFormula = !!(selectedFormula && selectedFormula.startsWith('='));

  const renderFormulaReadable = (formulaStr) => {
    if (!formulaStr) return '';
    return formulaStr.replace(/\{([^}]+)\}/g, (match, id) => {
      const item = allItems.find(it => it.id === id);
      const desig = item?.designation || '';
      // ⚠️ NE PAS tronquer la désignation : displayToRaw doit retrouver la clé exacte
      return item ? `[${desig}]` : match;
    });
  };

  const [formulaBarState, setFormulaBarState] = useState({ isEditing: false, displayValue: '', rawValue: '' });
  const formulaInputRef = useRef(null);

  const designationToIdMap = React.useMemo(() => {
    const map = {};
    allItems.forEach(it => { map[it.designation] = it.id; });
    return map;
  }, [allItems]);

  const displayToRaw = (displayStr) => {
    return (displayStr || '').replace(/\[([^\]]+)\]/g, (match, label) => {
      const id = designationToIdMap[label];
      return id ? `{${id}}` : match;
    });
  };

  const openFormulaBar = () => {
    const currentFormula = selectedFormula || '';
    setFormulaBarState({ isEditing: true, displayValue: renderFormulaReadable(currentFormula) || '=', rawValue: currentFormula || '=' });
    setFormulaMode({
      isActive: true,
      onInsert: (item) => {
        setFormulaBarState(prev => {
          const inputEl = formulaInputRef.current;
          const pos = inputEl ? inputEl.selectionStart : prev.displayValue.length;
          const label = `[${item?.designation || ''}]`;
          const newDisplay = prev.displayValue.slice(0, pos) + label + prev.displayValue.slice(pos);
          return { ...prev, displayValue: newDisplay, rawValue: displayToRaw(newDisplay) };
        });
        setTimeout(() => formulaInputRef.current?.focus(), 50);
      },
      get callback() { return this.onInsert; },
    });
    setTimeout(() => formulaInputRef.current?.focus(), 50);
  };

  const commitFormulaBar = () => {
    // displayToRaw repart du displayValue pour être toujours en phase avec ce que l'utilisateur a tapé
    // rawValue peut être périmé si l'utilisateur a tapé manuellement sans passer par onInsert
    const raw = displayToRaw(formulaBarState.displayValue);
    if (selectedItem) handleUpdateItem(selection?.type, selection?.id, 'qty', raw);
    closeFormulaBar();
  };

  const closeFormulaBar = () => {
    setFormulaBarState({ isEditing: false, displayValue: '', rawValue: '' });
    setFormulaMode({ isActive: false, onInsert: null });
  };

  const clearFormula = () => {
    if (!selectedItem) return;
    if (hasTranches) {
      updateProjectItem(selection?.type, selection?.id, 'qty_tranche', { trancheId: activeTrancheId, value: 0, clearAllFormulas: true });
    } else {
      handleUpdateItem(selection?.type, selection?.id, 'qty', 0);
    }
    closeFormulaBar();
  };

  useEffect(() => { closeFormulaBar(); }, [selection?.id, activeTrancheId]);

  const mousePos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMouseMove = (e) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  const getInnermostDroppableAtPos = (x, y) => {
    try {
      const elements = document.elementsFromPoint(x, y);
      // @hello-pangea/dnd utilise le préfixe data-rfd-* (pas data-rbd-*).
      // Le Droppable d'un sous-chapitre n'enveloppe que sa zone enfants, pas son header.
      // On utilise data-subchapter-id sur le wrapper du sous-chapitre pour le détecter
      // même si on survole son header, et le préférer au droppable du chapitre parent.
      let pendingSubchapterId = null;
      for (const el of elements) {
        if (!el.getAttribute) continue;
        const subId = el.getAttribute('data-subchapter-id');
        if (subId && !pendingSubchapterId) pendingSubchapterId = subId;
        const dropId = el.getAttribute('data-rfd-droppable-id');
        if (dropId) {
          if (pendingSubchapterId && pendingSubchapterId !== dropId) return pendingSubchapterId;
          return dropId;
        }
      }
    } catch (e) {} return null;
  };

  const getIndexInDroppable = (droppableId, y) => {
    try {
      const droppableEl = document.querySelector('[data-rfd-droppable-id="' + droppableId + '"]');
      if (!droppableEl) return 0;
      const draggables = droppableEl.querySelectorAll(':scope > [data-rfd-draggable-id]');
      let index = 0;
      for (const draggable of draggables) {
        const rect = draggable.getBoundingClientRect();
        if (y > rect.top + rect.height / 2) index++;
      }
      return index;
    } catch (e) { return 0; }
  };

  const handleDragEndFixed = (result) => {
    const { destination, type } = result;

    if (!destination) { onDragEnd(result); return; }
    if (type !== 'ITEM') { onDragEnd(result); return; }

    const { x, y } = mousePos.current;
    const realDestId = getInnermostDroppableAtPos(x, y);

    if (realDestId && realDestId !== 'root' && realDestId !== destination.droppableId) {
      onDragEnd({ ...result, destination: { droppableId: realDestId, index: getIndexInDroppable(realDestId, y) } });
    } else {
      onDragEnd(result);
    }
  };

  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimeoutRef = useRef(null);
  const projectHash = useStableHash(project);
  const lastSavedHashRef = useRef(projectHash);

  useEffect(() => {
    if (isReadOnly || !project) return;
    if (projectHash === lastSavedHashRef.current) return;

    setSaveStatus('waiting');
    if (onSaveStatusChange) onSaveStatusChange('waiting');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      if (onSaveProject) {
        setSaveStatus('saving');
        if (onSaveStatusChange) onSaveStatusChange('saving');
        try {
          await onSaveProject(project);
          setSaveStatus('saved');
          if (onSaveStatusChange) onSaveStatusChange('saved');
          lastSavedHashRef.current = projectHash;
        } catch (error) { setSaveStatus('error'); if (onSaveStatusChange) onSaveStatusChange('error'); }
      }
    }, 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [projectHash, onSaveProject, isReadOnly, onSaveStatusChange]);

  // Sauvegarde cloud manuelle (bouton) avec mise à jour du statut
  const handleManualCloudSave = async () => {
    if (!onSaveProject || !project) return;
    // Annuler l'auto-save en cours pour éviter un double appel
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      await onSaveProject(project);
      setSaveStatus('saved');
      if (onSaveStatusChange) onSaveStatusChange('saved');
      lastSavedHashRef.current = projectHash;
    } catch (error) {
      setSaveStatus('error');
      if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleUpdateItem = (type, id, field, value) => {
    if (type === 'root') return updateProjectItem(type, id, field, value);
    
    if (field === 'price') {
        const chaptersClone = JSON.parse(JSON.stringify(project?.chapters || []));
        let targetUid = null;
        const findInfo = (nodes) => {
            for (const node of nodes) {
                if (String(node.id) === String(id)) { targetUid = node.uid; return; }
                if (node.children) findInfo(node.children);
            }
        };
        findInfo(chaptersClone);
        if (targetUid) {
            const updateAll = (nodes) => {
                nodes.forEach(node => {
                    if (node.type === 'item' && String(node.uid) === String(targetUid)) node.price = Number(value);
                    if (node.children) updateAll(node.children);
                });
            };
            updateAll(chaptersClone);
            updateProjectItem('root', 'root', 'chapters', chaptersClone);
        } else {
            updateProjectItem(type, id, field, value);
        }
    } else if (field === 'qty') {
        if (isGlobalMode) { toast.warning("Modification interdite en mode Global."); return; }
        if (hasTranches) updateProjectItem(type, id, 'qty_tranche', { trancheId: activeTrancheId, value });
        else updateProjectItem(type, id, field, value);
    } else {
        updateProjectItem(type, id, field, value);
    }
  };

  const handleAutoSort = async () => {
    if (bpuConfig?.numberingMode !== 'manual') return;
    const ok = await confirm("Voulez-vous trier automatiquement tous les chapitres par ordre de Numéro BPU ?");
    if (!ok) return;

    const sortNodes = (nodes) => {
        const sorted = [...nodes].sort((a, b) => {
            const valA = String(a.bpuNum || '').trim();
            const valB = String(b.bpuNum || '').trim();
            if (!valA && !valB) return 0;
            if (!valA) return 1;
            if (!valB) return -1;
            return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        });
        return sorted.map(node => node.children?.length > 0 ? { ...node, children: sortNodes(node.children) } : node);
    };

    const chaptersClone = JSON.parse(JSON.stringify(project?.chapters || []));
    updateProjectItem('root', 'root', 'chapters', sortNodes(chaptersClone));
  };

  const handleOpenCalculation = () => {
    let fixedSum = 0; let smallQtySum = 0;
    const traverse = (nodes) => {
        nodes?.forEach(node => {
            if (node.type === 'item') {
                const sMap = studyQtyMaps?.[activeTrancheId || 'global'];
                const qty = sMap ? (sMap[node.id] || 0) : Number(node.qty || 0);
                const lineTotal = qty * Number(node.price || 0);
                if (node.isFixed) fixedSum += lineTotal;
                else if (qty > -20 && qty < 20) smallQtySum += lineTotal;
            } else if (node.children) traverse(node.children);
        });
    };
    traverse(displayProject?.chapters);
    setCalculationAnalysis({ totalStudy: projectStats?.study?.base || 0, fixedTotal: fixedSum, smallQtyTotal: smallQtySum });
    setShowCalculationModal(true);
  };

  const handleApplyCalculation = (newPercent) => {
    updateProjectItem('root', 'root', 'clientPercent', newPercent);
    setShowCalculationModal(false);
  };

  const handlePreviewPdf = async ({ includeCover, selectedExports, includeSummary, includePM }) => {
    const { type } = exportModalState;
    const projectForExport = { ...project, ...displayProject, clientLogo: project?.clientLogo };
    const { generateProfessionalPDF } = await import('../utils/pdfGenerator');
    return await generateProfessionalPDF(
      projectForExport, clientQtyMaps, type, bpuConfig,
      { includeCover, selectedExports, includeSummary, includePM, tranches, previewOnly: true },
      masterBranding
    );
  };

  const handleConfirmExport = async ({ includeCover, selectedExports, includeSummary, includePM, _previewBlob, _suggestedName }) => {
    setExportModalState(prev => ({ ...prev, show: false }));
    const { format, type } = exportModalState;
    const projectForExport = { ...project, ...displayProject, clientLogo: project?.clientLogo };

    if (format === 'pdf') {
      if (_previewBlob && _suggestedName) {
        await saveFileWithPicker(_previewBlob, _suggestedName, FILE_TYPES.pdf, PICKER_IDS.exportPdf);
      } else {
        const { generateProfessionalPDF } = await import('../utils/pdfGenerator');
        generateProfessionalPDF(projectForExport, clientQtyMaps, type, bpuConfig, { includeCover, selectedExports, includeSummary, includePM, tranches }, masterBranding);
      }
    } else if (format === 'excel') {
      const { generateProfessionalExcel } = await import('../utils/excelGenerator');
      generateProfessionalExcel(projectForExport, clientQtyMaps, type, bpuConfig, { selectedExports, includeSummary, includePM, tranches }, masterBranding);
    }
  };

  const handleRemoveItem = (itemId) => {
    const removeRecursive = (nodes) => nodes.filter(node => {
        if (node.id === itemId) return false;
        if (node.children) node.children = removeRecursive(node.children);
        return true;
    });
    updateProjectItem('root', 'root', 'chapters', removeRecursive(JSON.parse(JSON.stringify(project?.chapters || []))));
  };

  const handleModalIntercept = (modalData) => {
    if (['item', 'chapter', 'subChapter'].includes(modalData?.target?.type)) {
        setDeleteConfirm({ show: true, itemId: modalData.target.id });
    } else {
        setModal(modalData);
    }
  };

  const handleSaveEditedItem = (updatedFields) => {
    if (!editItemTarget) return;
    const findParent = (nodes, targetId) => {
      for (const node of nodes) {
        if (node.children?.some(c => c.id === targetId)) return node.id;
        if (node.children) { const found = findParent(node.children, targetId); if (found) return found; }
      }
      return null;
    };
    const parentId = findParent(project?.chapters || [], editItemTarget.id) ?? 'root';
    ['designation','description','unit','price','bpuNum','cctpRefs','categoryIds'].forEach(key => {
      if (updatedFields[key] !== undefined) updateProjectItem(parentId, editItemTarget.id, key, updatedFields[key]);
    });
    setEditItemTarget(null);
  };

  const contextValue = { 
      selection, setSelection, updateProjectItem: handleUpdateItem, removeProjectItem: handleRemoveItem,
      setModal: handleModalIntercept, addSubChapter, refMap, viewMode: currentMode, showComparison, 
      clientQtyMap, activeTrancheId, isGlobalMode, bpuConfig, onOpenCalculation: handleOpenCalculation,
      formulaMode, setFormulaMode, allItems, sourceIds: project?.sourceIds || [],
      onEditItem: (item) => {
        const bpuSource = allBpuItems?.find(b => String(b.id) === String(item?.uid) || String(b.uid) === String(item?.uid));
        setEditItemTarget({
          ...item,
          description: item?.description || bpuSource?.description || '',
          cctpRefs: item?.cctpRefs?.length ? item.cctpRefs : (bpuSource?.cctpRefs || []),
          categoryIds: item?.categoryIds?.length ? item.categoryIds : (bpuSource?.categoryIds || []),
        });
      },
  };

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 gap-3">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        Chargement du projet...
      </div>
    );
  }

  return (
    <ProjectContext.Provider value={contextValue}>
      <div className={`flex-1 flex overflow-hidden ${theme.bg}`}>
        
        {!isReadOnly && (
          <BpuSidebar
            showBpu={showBpu} setShowBpu={setShowBpu} bpuSearch={bpuSearch} setBpuSearch={setBpuSearch}
            filteredBpu={filteredBpu} categories={categories} bpuConfig={bpuConfig} addItemToProject={addItemToProject}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <ProjectToolbar
            project={project} updateProjectName={updateProjectName} saveStatus={saveStatus} onSaveProject={handleManualCloudSave}
            isReadOnly={isReadOnly} showBpu={showBpu} setShowBpu={setShowBpu} currentMode={currentMode} setViewMode={setViewMode}
            showComparison={showComparison} setShowComparison={setShowComparison} totalBase={totalBase} activeTrancheId={activeTrancheId}
            onExport={(format, type) => setExportModalState({ show: true, format, type })} 
            onOpenCalculation={handleOpenCalculation} onOpenDetails={() => setShowDetailsModal(true)} onAddChapter={addChapter}
            bpuConfig={bpuConfig} setBpuConfig={setBpuConfig}
            onSaveAffaire={handleSaveAffaire}
            onOpenAffaire={() => handleOpenAffaire(null)}
            onNewProject={handleNewProject}
            onOpenCloudProject={() => setShowCloudPicker(v => !v)}
            onArchive={handleArchive}
            archiveCount={archives.length}
            onOpenArchiveManager={() => setShowArchiveManager(true)}
            onOpenPriceAudit={() => setShowPriceAudit(true)}
          />
          <input ref={loadAffaireRef} type="file" accept=".json" className="hidden" onChange={handleOpenAffaireFallback} />

          {/* Picker projet cloud */}
          {showCloudPicker && companyId && (
            <div className="relative shrink-0">
              <CloudProjectPicker
                companyId={companyId}
                currentProjectId={project?.id}
                onSelect={(proj) => {
                  setShowCloudPicker(false);
                  if (onLoadCloudProject) onLoadCloudProject(proj);
                }}
                onClose={() => setShowCloudPicker(false)}
              />
            </div>
          )}

          {/* Bandeau archive active */}
          {activeArchive && (
            <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
              <Archive size={15} className="text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Archive</span>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                {activeArchive.label}
              </span>
              <span className="text-[11px] text-amber-600">
                {activeArchive.projectName} — {formatPrice(activeArchive.totalHT)} HT — {new Date(activeArchive.createdAt).toLocaleDateString('fr-FR')}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowAuditModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors active:scale-95"
                >
                  <BarChart3 size={13} />
                  Audit
                </button>
                <button
                  onClick={onCloseArchive}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide bg-white text-amber-700 border border-amber-300 rounded hover:bg-amber-100 transition-colors active:scale-95"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          <ProjectStatsBar projectStats={projectStats} bpuConfig={bpuConfig} isReadOnly={isReadOnly} handleAutoSort={handleAutoSort} />

          <TranchesBar 
            hasTranches={hasTranches} isReadOnly={isReadOnly} activeTrancheId={activeTrancheId} setActiveTrancheId={setActiveTrancheId}
            tranches={tranches} updateProjectItem={updateProjectItem} removeTranche={removeTranche} addTranche={addTranche} theme={theme}
          />

          {!isReadOnly && (hasSelectedFormula || formulaBarState.isEditing || formulaMode.isActive) && (
            <ProjectFormulaBar 
              formulaBarState={formulaBarState} setFormulaBarState={setFormulaBarState}
              formulaMode={formulaMode} selectedItem={selectedItem} selectedFormula={selectedFormula}
              hasSelectedFormula={hasSelectedFormula} renderFormulaReadable={renderFormulaReadable}
              displayToRaw={displayToRaw} commitFormulaBar={commitFormulaBar} openFormulaBar={openFormulaBar}
              closeFormulaBar={closeFormulaBar} clearFormula={clearFormula} formulaInputRef={formulaInputRef}
            />
          )}

          <DragDropContext onDragEnd={isReadOnly ? () => {} : handleDragEndFixed}>
            <div className={`flex-1 overflow-y-auto p-6 space-y-8 ${theme.bg} ${currentMode === 'client' ? 'border-l-[6px] border-indigo-600' : ''}`}>
              
              {isGlobalMode && !isReadOnly && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-3 shadow-sm mb-4">
                      <div className="p-1.5 bg-blue-100 rounded-full text-blue-600"><Layers size={16} /></div>
                      <div>
                        <strong className="block uppercase text-[10px] tracking-widest mb-0.5">Mode Synthèse Globale</strong>
                        Les quantités affichées sont la somme de toutes les tranches (majorées ou fixes).
                      </div>
                  </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm min-h-[500px]">
                <Droppable droppableId="root" type="CHAPTER" isDropDisabled={isReadOnly}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="p-4 space-y-8">
                      {displayProject?.chapters?.map((chap, index) => {
                        const chapTotal = currentStats?.chapters?.[chap.id] || 0;
                        return (
                          <Draggable key={chap.id} draggableId={`chapter:${chap.id}`} index={index} isDragDisabled={isReadOnly}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className={`rounded-xl border overflow-hidden transition-all duration-200 ${selection?.id === chap.id ? 'ring-4 ring-emerald-50/50 border-emerald-500' : 'hover:shadow-md'} ${chap.isOption ? 'bg-slate-50 border-slate-300 border-dashed' : 'bg-white border-slate-200'} ${snapshot.isDragging ? 'shadow-2xl z-50 ring-4 ring-emerald-500/20 rotate-1 bg-white' : ''}`}>
                                <div className={`p-3 flex justify-between items-center transition-colors duration-300 ${selection?.id === chap.id ? 'bg-emerald-600 text-white' : chap.isOption ? 'bg-slate-100 text-slate-600' : theme.chapterHeader + ' text-white'}`} onClick={() => setSelection({ type: 'chapter', id: chap.id })}>
                                  <div className="flex items-center gap-4">
                                    <div {...provided.dragHandleProps} className={`p-1 ${isReadOnly ? 'opacity-0 pointer-events-none' : chap.isOption ? 'text-slate-400 hover:text-slate-600' : 'text-white/40 hover:text-white cursor-grab active:cursor-grabbing'}`}>{!isReadOnly && <GripVertical size={18} />}</div>
                                    <span className={`w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-black ${chap.isOption ? 'bg-slate-200 text-slate-500' : 'bg-white/20 text-white'}`}>{index + 1}</span>
                                    <EditableTitle value={chap.title} onSave={(val) => updateProjectItem('root', chap.id, 'title', val)} disabled={isReadOnly} className="font-black uppercase tracking-widest text-[11px] hover:bg-white/10" />
                                    <OptionToggle isOption={chap.isOption} onClick={() => updateProjectItem('root', chap.id, 'isOption', !chap.isOption)} disabled={isReadOnly} />
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className={`font-mono font-black text-xs px-3 py-1 rounded-full ${chap.isOption ? 'bg-slate-200 text-slate-600 line-through decoration-slate-400' : 'bg-black/20 text-white'}`}>{formatPrice(chapTotal)}</span>
                                    {!isReadOnly && (
                                      <div className={`flex gap-1 border-l pl-2 ${chap.isOption ? 'border-slate-300' : 'border-white/20'}`}>
                                        <button onClick={(e) => { e.stopPropagation(); addSubChapter(chap.id); }} className={`p-1.5 rounded-md ${chap.isOption ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/20 text-white'}`}><Plus size={16} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleModalIntercept({ show: true, target: { type: 'chapter', id: chap.id } }); }} className={`p-1.5 ${chap.isOption ? 'text-slate-400 hover:text-red-500' : 'text-white/30 hover:text-red-400'}`}><Trash2 size={16} /></button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className={`flex flex-col w-full ${chap.isOption ? 'opacity-80' : ''}`}>
                                  <Droppable droppableId={chap.id} type="ITEM" isDropDisabled={isReadOnly}>
                                    {(providedItem, snapshotItem) => (
                                      <div ref={providedItem.innerRef} {...providedItem.droppableProps} className={`flex flex-col w-full min-h-[50px] transition-colors ${snapshotItem.isDraggingOver ? 'bg-emerald-50/50' : chap.isOption ? 'bg-slate-50/30' : 'bg-white'}`}>
                                        <ItemList items={chap.children} parentId={chap.id} bpuConfig={bpuConfig} readOnly={isGlobalMode} />
                                        {providedItem.placeholder}
                                        {(!chap.children || chap.children.length === 0) && !snapshotItem.isDraggingOver && <div className="p-8 text-center border-t border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Chapitre vide</div>}
                                      </div>
                                    )}
                                  </Droppable>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              <ProjectFooterStats totalBase={totalBase} totalOption={totalOption} currentMode={currentMode} theme={theme} />
              
            </div>
          </DragDropContext>
        </div>
      
      <ProjectDetailsModal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} project={project} onSave={handleSaveDetails} />
      {editItemTarget && <EditBpuModal item={editItemTarget} onClose={() => setEditItemTarget(null)} onUpdate={handleSaveEditedItem} units={units} categories={categories} bpuConfig={bpuConfig} existingItems={[]} masterCctp={masterCctp} projectOnly />}
      <CalculationModal show={showCalculationModal} onClose={() => setShowCalculationModal(false)} onConfirm={handleApplyCalculation} analysis={calculationAnalysis} />
      <ExportModal isOpen={exportModalState.show} onClose={() => setExportModalState(prev => ({ ...prev, show: false }))} onConfirm={handleConfirmExport} onPreviewPdf={handlePreviewPdf} format={exportModalState.format} type={exportModalState.type} hasTranches={hasTranches} tranches={tranches} activeTrancheId={activeTrancheId} />
      <ConfirmDeleteModal isOpen={deleteConfirm.show} onClose={() => setDeleteConfirm({ show: false, itemId: null })} onConfirm={() => { if(deleteConfirm.itemId) { handleRemoveItem(deleteConfirm.itemId); setDeleteConfirm({ show: false, itemId: null }); } }} />
      <FormulaHelpModal isOpen={showFormulaHelp} onClose={() => setShowFormulaHelp(false)} />
      <ArchiveManagerModal
        show={showArchiveManager}
        onClose={() => setShowArchiveManager(false)}
        archives={archives}
        activeArchive={activeArchive}
        onViewArchive={(archive) => { onViewArchive(archive); setShowArchiveManager(false); }}
        onDeleteArchive={onDeleteArchive}
        onOpenAudit={(archive) => { setShowArchiveManager(false); setShowAuditModal(true); }}
      />
      <ArchiveAuditModal
        show={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        sourceArchive={activeArchive}
        archives={archives}
        currentProject={project}
      />
      <PriceAuditModal
        show={showPriceAudit}
        onClose={() => setShowPriceAudit(false)}
        project={project}
        allBpuItems={allBpuItems}
        onRestorePrice={handleRestorePrice}
        onRestoreAllPrices={handleRestoreAllPrices}
      />

      {!isReadOnly && (
        <button onClick={() => setShowFormulaHelp(true)} className="fixed bottom-6 right-6 z-[9000] flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group">
          <HelpCircle size={16} />
          <span className="text-[11px] font-bold uppercase tracking-wide max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">Aide formules</span>
        </button>
      )}

      </div>
    </ProjectContext.Provider>
  );
};

ProjectView.propTypes = {
  project: PropTypes.object,
  showBpu: PropTypes.bool,
  setShowBpu: PropTypes.func.isRequired,
  bpuSearch: PropTypes.string,
  setBpuSearch: PropTypes.func.isRequired,
  filteredBpu: PropTypes.array,
  categories: PropTypes.array,
  addItemToProject: PropTypes.func.isRequired,
  selection: PropTypes.object,
  setSelection: PropTypes.func.isRequired,
  updateProjectItem: PropTypes.func.isRequired,
  setModal: PropTypes.func.isRequired,
  addChapter: PropTypes.func.isRequired,
  addSubChapter: PropTypes.func.isRequired,
  updateProjectName: PropTypes.func.isRequired,
  onDragEnd: PropTypes.func.isRequired,
  viewMode: PropTypes.string,
  setViewMode: PropTypes.func.isRequired,
  clientPercent: PropTypes.number,
  bpuConfig: PropTypes.object,
  setBpuConfig: PropTypes.func,
  onSaveProject: PropTypes.func.isRequired,
  onSaveStatusChange: PropTypes.func,
  onReplaceProject: PropTypes.func.isRequired,
  masterBranding: PropTypes.object,
  units: PropTypes.array,
  masterCctp: PropTypes.array,
  allBpuItems: PropTypes.array,
  companyId: PropTypes.string,
  onLoadCloudProject: PropTypes.func,
  archives: PropTypes.array,
  activeArchive: PropTypes.object,
  onCreateArchive: PropTypes.func,
  onDeleteArchive: PropTypes.func,
  onViewArchive: PropTypes.func,
  onCloseArchive: PropTypes.func,
};

export default ProjectView;