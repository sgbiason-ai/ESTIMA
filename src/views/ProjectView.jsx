// src/views/ProjectView.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useStableHash } from '../hooks/useStableHash';
import { useRobustSave } from '../hooks/useRobustSave';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Layers, AlertTriangle, Target, ChevronDown, ChevronRight, Lock, Unlock, Eye } from 'lucide-react';

import { ProjectContext } from '../context/ProjectContext';
import { EditableTitle, OptionToggle, PseModeControl, PseDescriptionEditor, ChapterCommentButton, ChapterCommentEditor } from '../components/ProjectUI';
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
import ProjectDocBanner from '../components/ProjectDocBanner';
import ProjectTableHeader from '../components/ProjectTableHeader';
import HelpPanel from '../components/help/HelpPanel';

// NOUVEAUX COMPOSANTS EXTRAITS
import ProjectFormulaBar from '../components/project/ProjectFormulaBar';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
import PriceAuditModal from '../components/modals/PriceAuditModal';
import PriceConsistencyModal from '../components/modals/PriceConsistencyModal';
import CloudProjectPicker from '../components/modals/CloudProjectPicker';
import BpuAuditPanel from './bpu/BpuAuditPanel';

// NOS CUSTOM HOOKS
import { useProjectTranches } from '../hooks/useProjectTranches';
import { useProjectCalculations } from '../hooks/useProjectCalculations';
import { checkPriceConsistency } from '../utils/projectCalculations';
import { useBpuData } from './bpu/hooks/useBpuData';
import { useBpuAudit } from './bpu/hooks/useBpuAudit';
import { saveFileWithPicker, openFileWithPicker, FILE_TYPES, PICKER_IDS } from '../utils/fileSaver';
import lazyWithReload from '../utils/lazyWithReload';
import { applyTakeoffToProject } from '../utils/takeoff/applyTakeoff';

const DxfTakeoffModal = lazyWithReload(() => import('../components/takeoff/DxfTakeoffModal'));

const ProjectView = ({
  project,
  showBpu,
  setShowBpu,
  bpuSearch,
  setBpuSearch,
  filteredBpu,
  categories,
  addItemToProject,
  addItemsToProject,
  selection,
  setSelection,
  insertTargetId,
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
  onAddToBpu,
  onUpdateBpuItem,
  blocs = [],
  companyId,
  onLoadCloudProject,
  onUndo,
  canUndo = false,
  archives = [],
  onOpenGed,
  multiSelection,
  toggleMultiSelection,
  clearMultiSelection,
  openMultiDeleteModal,
}) => {
  // Verrou « lecture seule » : verrouillé par défaut à l'ouverture d'une affaire
  // (cf. effet de réinitialisation plus bas). Évite les modifications accidentelles.
  const [isLocked, setIsLocked] = useState(true);
  const isReadOnly = isLocked;
  const currentMode = viewMode || 'study';
  // Le projet affiché est toujours le projet courant (la consultation des
  // versions figées se fait désormais dans la vue dédiée « Documents émis »).
  const viewedProject = project;

  const [showPriceAudit, setShowPriceAudit] = useState(false);
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const [showCloudPicker, setShowCloudPicker] = useState(false);
  const [showBpuAudit, setShowBpuAudit] = useState(false);
  const [showDxfTakeoff, setShowDxfTakeoff] = useState(false);

  // ── Audit Bordereau (panneau latéral) ──
  // Adaptateur : onReplaceProject prend une valeur, useBpuAudit/useBpuData attendent un functional updater
  const projectRef = useRef(project);
  projectRef.current = project;
  const setProjectForBpuAudit = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(projectRef.current) : updater;
    if (onReplaceProject) onReplaceProject(next);
  }, [onReplaceProject]);

  const handleApplyTakeoff = useCallback((mappings, options) => {
    const nextProject = applyTakeoffToProject(projectRef.current, mappings, options);
    if (nextProject !== projectRef.current) onReplaceProject(nextProject);
  }, [onReplaceProject]);

  const { sortedCatalog: bpuSortedCatalog } = useBpuData({
    project, setProject: setProjectForBpuAudit, bpuConfig, units,
  });
  const {
    audit: bpuAudit,
    refresh: refreshBpuAudit,
    syncDescriptions: syncBpuDescriptions,
    restoreIssues: restoreBpuIssues,
  } = useBpuAudit({
    sortedCatalog: bpuSortedCatalog,
    articlesDb: allBpuItems,
    bpuOverrides: project?.bpuOverrides,
    setProject: setProjectForBpuAudit,
  });

  // ── Handlers Audit Prix ──
  // Aller à une ligne d'article : scroll + surbrillance temporaire (réutilise .rao-highlight-pulse)
  const goToItem = useCallback((itemId) => {
    if (!itemId) return;
    // Laisse la modale se fermer avant de scroller
    setTimeout(() => {
      const el = document.getElementById(`estima-item-${itemId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('rao-highlight-pulse');
      setTimeout(() => el.classList.remove('rao-highlight-pulse'), 2000);
    }, 80);
  }, []);

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
  const [exportGuard, setExportGuard] = useState({ show: false, format: 'pdf', type: 'ESTIMATION' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, itemId: null });
  const [showHelp, setShowHelp] = useState(false);
  const [calculationAnalysis, setCalculationAnalysis] = useState({ totalStudy: 0, lines: [] });
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
    const safeName = (project.name || 'affaire').replace(/[^a-z0-9_-]/gi, '_');
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
  // Diff par ligne (Étude→Rendu) : réservé à un futur mode comparatif chiffré, inactif pour l'instant.
  const [showComparison] = useState(false);
  // Vue du tableau pilotée par le verrou (un seul bouton) :
  //  • Déverrouillé → 'comparison' = vue ÉTUDE (qté réelle + à valoir + comparatifs, modifiable).
  //  • Verrouillé   → 'rendu'       = vue RENDU « avant impression » (à valoir uniquement, lecture seule).
  const tableViewEffective = isReadOnly ? 'rendu' : 'comparison';
  const isRenduView = tableViewEffective === 'rendu';
  // En Rendu, le tableau affiche les quantités à valoir (mode 'client') ; sinon mode Étude.
  const contextViewMode = isRenduView ? 'client' : currentMode;

  useEffect(() => {
    if (project && project.__isNew) {
        setShowDetailsModal(true);
        updateProjectItem('root', 'root', '__isNew', false);
    }
  }, [project]);

  // Verrouillage par défaut à chaque ouverture d'affaire ; un nouveau projet (__isNew)
  // s'ouvre en édition pour pouvoir être construit immédiatement.
  useEffect(() => {
    setIsLocked(!project?.__isNew);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { studyQtyMaps, clientQtyMap, clientQtyMaps, displayProject, refMap, duplicateIndex, pseDeltaMap, pseCandidatesFor, pseNumbers, projectStats, totalBase, valoirTotals, etudeTotals } = useProjectCalculations({
    project: viewedProject, clientPercent, hasTranches, tranches, activeTrancheId, currentMode, bpuConfig
  });

  // Nombre d'articles descendants (tous niveaux) — affiché quand le chapitre est replié.
  const countTreeItems = (nodes) => {
    let n = 0;
    const walk = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach(x => {
        if (!x) return;
        if (x.type === 'item') n++;
        else if (x.children) walk(x.children);
      });
    };
    walk(nodes);
    return n;
  };

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
      } else if (node.isBloc) {
        // Sous-chapitre bloc : ses composants le référencent par {blocId}.
        // On l'expose (désignation = titre) pour que la formule s'affiche en clair
        // ([Voirie légère…]) et soit ré-encodable depuis la barre ƒ(x).
        result.push({
          id: node.id,
          designation: node.title || 'Bloc',
          unit: node.unit || '',
          formula: '',
          quantitiesFormula: {},
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
  // Mémorise l'id EXACT de chaque ligne cliquée pour cette session d'édition de la barre.
  // Indispensable car plusieurs lignes peuvent partager la même désignation (même prix BPU
  // utilisé à plusieurs endroits) : designationToIdMap ne garde qu'un id et la formule
  // pointerait vers la mauvaise ligne (souvent vide → résultat 0).
  const formulaBarSessionMap = useRef(new Map());

  const designationToIdMap = React.useMemo(() => {
    const map = {};
    allItems.forEach(it => { map[it.designation] = it.id; });
    return map;
  }, [allItems]);

  const displayToRaw = (displayStr) => {
    return (displayStr || '').replace(/\[([^\]]+)\]/g, (match, label) => {
      // Priorité à l'id exact mémorisé pour cette session (lève l'ambiguïté des désignations
      // en double), sinon repli sur la map globale (référence tapée/collée à la main).
      const id = formulaBarSessionMap.current.get(label) ?? designationToIdMap[label];
      return id ? `{${id}}` : match;
    });
  };

  const openFormulaBar = () => {
    const currentFormula = selectedFormula || '';
    // Réinitialise puis pré-remplit la session avec les ids déjà référencés : un aller-retour
    // d'édition ([Désignation] affiché → {id} stocké) doit conserver l'instance d'origine.
    formulaBarSessionMap.current = new Map();
    String(currentFormula).replace(/\{([^}]+)\}/g, (m, id) => {
      const it = allItems.find(x => x.id === id);
      if (it?.designation) formulaBarSessionMap.current.set(it.designation, id);
      return m;
    });
    setFormulaBarState({ isEditing: true, displayValue: renderFormulaReadable(currentFormula) || '=', rawValue: currentFormula || '=' });
    setFormulaMode({
      isActive: true,
      // ⚠️ ItemList appelle onInsert(el.id) : l'argument est un ID, pas l'objet ligne.
      // On résout la ligne depuis allItems (tolère aussi un objet par sécurité), sinon
      // item.designation = undefined → la barre insérait « [] » au lieu de la tâche.
      onInsert: (arg) => {
        const item = (arg && typeof arg === 'object')
          ? arg
          : allItems.find(x => String(x.id) === String(arg));
        if (!item) return;
        // Mémorise la ligne EXACTE cliquée pour cette désignation (préservée au commit même en doublon).
        if (item.designation) formulaBarSessionMap.current.set(item.designation, item.id);
        setFormulaBarState(prev => {
          const inputEl = formulaInputRef.current;
          const pos = inputEl ? inputEl.selectionStart : prev.displayValue.length;
          const label = `[${item.designation || ''}]`;
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
    } catch { /* ignore */ } return null;
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
    } catch { return 0; }
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

  // ── Sauvegarde robuste : debounce + brouillon localStorage + flush
  //    (beforeunload / pagehide / visibilitychange) + retry. Même socle que le CRC.
  const projectHash = useStableHash(project);
  const lastTriggeredHashRef = useRef(projectHash);
  const lastProjectIdRef = useRef(project?.id);

  const draftKey = project?.id ? `draft_estima_${project.id}` : null;
  const { saveStatus, triggerSave, forceSave } = useRobustSave({
    saveFn: onSaveProject,
    draftKey,
    debounceMs: 2000,
  });

  // Déclenche l'autosave à chaque modification réelle. Un changement de projet
  // (chargement initial / ouverture cloud) resynchronise le hash SANS sauvegarder
  // (évite l'écriture parasite que provoquait l'ancien autosave au chargement).
  useEffect(() => {
    if (isReadOnly || !project) return;
    if (project.id !== lastProjectIdRef.current) {
      lastProjectIdRef.current = project.id;
      lastTriggeredHashRef.current = projectHash;
      return;
    }
    if (projectHash === lastTriggeredHashRef.current) return;
    lastTriggeredHashRef.current = projectHash;
    triggerSave(project);
  }, [projectHash, isReadOnly, project, triggerSave]);

  // 'idle' (état initial du hook) affiché comme 'saved' dans l'UI existante.
  const displayStatus = saveStatus === 'idle' ? 'saved' : saveStatus;

  // Remonte le statut au conteneur (App.jsx → ProjectToolbar).
  useEffect(() => {
    if (onSaveStatusChange) onSaveStatusChange(displayStatus);
  }, [displayStatus, onSaveStatusChange]);

  // Sauvegarde cloud manuelle (bouton) / relance après erreur : flush immédiat
  // sans attendre le debounce.
  const handleManualCloudSave = () => {
    if (!onSaveProject || !project) return;
    triggerSave(project);
    forceSave();
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
    // Lignes brutes pour la modale : la ventilation forfaits / petites quantités
    // y est recalculée en live selon le seuil choisi par l'utilisateur.
    const lines = [];
    const traverse = (nodes) => {
        nodes?.forEach(node => {
            if (node.type === 'item') {
                const sMap = studyQtyMaps?.[activeTrancheId || 'global'];
                const qty = sMap ? (sMap[node.id] || 0) : Number(node.qty || 0);
                const lineTotal = qty * Number(node.price || 0);
                lines.push({ qty, total: lineTotal, fixed: !!(node.isFixed || node.qtyLocked) });
            } else if (node.children) traverse(node.children);
        });
    };
    traverse(displayProject?.chapters);
    setCalculationAnalysis({ totalStudy: projectStats?.study?.base || 0, lines });
    setShowCalculationModal(true);
  };

  const handleApplyCalculation = (newPercent, newThreshold) => {
    updateProjectItem('root', 'root', 'clientPercent', newPercent);
    if (newThreshold !== undefined) updateProjectItem('root', 'root', 'clientQtyThreshold', newThreshold);
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

  const handleConfirmExport = async ({ includeCover, selectedExports, includeSummary, includePM, lockPrices, uniquePrices, _previewBlob, _suggestedName }) => {
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
      generateProfessionalExcel(projectForExport, clientQtyMaps, type, bpuConfig, { includeCover, selectedExports, includeSummary, includePM, lockPrices, uniquePrices, tranches }, masterBranding);
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
    if (['item', 'chapter', 'subchapter'].includes(modalData?.target?.type)) {
        setDeleteConfirm({ show: true, itemId: modalData.target.id });
    } else {
        setModal(modalData);
    }
  };

  const findItemParentId = (targetId) => {
    const findParent = (nodes, id) => {
      for (const node of nodes) {
        if (node.children?.some(c => c.id === id)) return node.id;
        if (node.children) { const found = findParent(node.children, id); if (found) return found; }
      }
      return null;
    };
    return findParent(project?.chapters || [], targetId) ?? 'root';
  };

  // Ajoute un article « libre » (hors bibliothèque BPU) à remplir directement dans le tableau.
  // Cible : la cible d'insertion persistante (dernier chapitre/sous-chapitre sélectionné),
  // résolue côté App.jsx et injectée dans addItemsToProject.
  const handleAddFreeItem = () => {
    if (isReadOnly) return;
    const targetId = insertTargetId || project?.chapters?.[0]?.id || null;
    if (!targetId) { toast.warning("Ajoutez d'abord un chapitre pour y placer l'article."); return; }

    const newLine = {
      type: 'item',
      id: `line_${generateId()}`,
      uid: '',           // non lié à la bibliothèque BPU
      isFree: true,      // article libre → édition inline désignation + unité
      designation: '',
      unit: '',
      price: 0,
      qty: 0,
      formula: '',
      quantities: {},
      quantitiesFormula: {},
      bpuNum: '',
      isFixed: false,
    };
    addItemsToProject([newLine]); // la cible d'insertion est injectée par App.jsx
    setSelection({ type: 'item', id: newLine.id, parentId: targetId });
    toast.success('Article libre ajouté — complétez désignation, unité, quantité et prix.');
  };

  // Applique les champs édités à la SEULE ligne du projet (n'altère pas le BPU).
  const applyFieldsToProjectLine = (fields) => {
    if (!editItemTarget) return;
    const parentId = findItemParentId(editItemTarget.id);
    ['designation','description','unit','price','bpuNum','cctpRefs','categoryIds','isFixed'].forEach(key => {
      if (fields[key] !== undefined) updateProjectItem(parentId, editItemTarget.id, key, fields[key]);
    });
  };

  const handleSaveEditedItem = (updatedFields) => {
    applyFieldsToProjectLine(updatedFields);
    setEditItemTarget(null);
  };

  // Pousse l'article édité vers la bibliothèque : 'new' = prix nouveau, 'update' = écraser la source.
  // Dans les deux cas, on applique aussi l'édition à la ligne du projet pour rester cohérent.
  const handleSaveItemToLibrary = ({ mode, data }) => {
    if (!editItemTarget) return;
    applyFieldsToProjectLine(data);

    if (mode === 'update') {
      const source = allBpuItems?.find(
        b => String(b.id) === String(editItemTarget.uid) || String(b.uid) === String(editItemTarget.uid)
      );
      const sourceId = source?.id || editItemTarget.uid;
      if (sourceId && onUpdateBpuItem) {
        onUpdateBpuItem(sourceId, data);
        toast.success("Article source mis à jour dans la bibliothèque.");
      } else {
        toast.error("Article source introuvable dans la bibliothèque.", { title: 'Mise à jour impossible' });
      }
    } else {
      const newId = generateId();
      onAddToBpu?.({ ...data, id: newId });
      // Relie la ligne du projet au nouvel article (le prix nouveau devient sa source).
      const parentId = findItemParentId(editItemTarget.id);
      updateProjectItem(parentId, editItemTarget.id, 'uid', newId);
    }
    setEditItemTarget(null);
  };

  // ── Contrôle d'unicité des numéros de prix, recalculé en continu (pur, instantané) ──
  const priceCheck = useMemo(
    () => checkPriceConsistency(displayProject?.chapters || [], bpuConfig),
    [displayProject, bpuConfig]
  );
  const priceIssueIds = useMemo(() => new Set(priceCheck.flaggedItemIds), [priceCheck]);

  // ── Arborescence : chapitres / sous-chapitres repliés (persisté par projet) ──
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  useEffect(() => {
    if (!project?.id) { setCollapsedIds(new Set()); return; }
    try {
      const raw = localStorage.getItem(`estima_collapsed_${project.id}`);
      setCollapsedIds(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setCollapsedIds(new Set()); }
  }, [project?.id]);
  const toggleCollapsed = (id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (project?.id) {
        try { localStorage.setItem(`estima_collapsed_${project.id}`, JSON.stringify([...next])); } catch { /* quota plein : on continue sans persister */ }
      }
      return next;
    });
  };

  // ── Commentaires de chapitre : panneaux ouverts (état d'affichage, non persisté) ──
  const [commentOpenIds, setCommentOpenIds] = useState(() => new Set());
  const toggleCommentOpen = (id) => {
    setCommentOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Navigation vers une occurrence d'un prix répété ───────────────────────
  // Déplie les chapitres/sous-chapitres ancêtres si besoin, puis scroll + flash.
  const revealAndFlashItem = (itemId) => {
    const path = [];
    const findPath = (nodes, trail) => {
      for (const n of nodes || []) {
        if (!n) continue;
        if (n.id === itemId) { path.push(...trail); return true; }
        if (n.children && findPath(n.children, [...trail, n.id])) return true;
      }
      return false;
    };
    findPath(displayProject?.chapters || [], []);

    setCollapsedIds(prev => {
      if (!path.some(id => prev.has(id))) return prev;
      const next = new Set(prev);
      path.forEach(id => next.delete(id));
      if (project?.id) {
        try { localStorage.setItem(`estima_collapsed_${project.id}`, JSON.stringify([...next])); } catch { /* ignore */ }
      }
      return next;
    });

    // Laisse le re-render déplier avant de scroller.
    setTimeout(() => {
      const el = document.getElementById(`estima-item-${itemId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-inset', 'ring-violet-400', 'bg-violet-50');
      setTimeout(() => el.classList.remove('ring-2', 'ring-inset', 'ring-violet-400', 'bg-violet-50'), 1500);
    }, 90);
  };

  const contextValue = {
      selection, setSelection, updateProjectItem: handleUpdateItem, removeProjectItem: handleRemoveItem,
      setModal: handleModalIntercept, addSubChapter, refMap, viewMode: contextViewMode, isReadOnly, showComparison,
      // Colonne secondaire « Qté à valoir » + écart sous le total : présents en vue Étude
      // (déverrouillé), masqués en vue Rendu (verrouillé, avant impression).
      showRendu: tableViewEffective === 'comparison',
      clientQtyMap, activeTrancheId, isGlobalMode, bpuConfig, onOpenCalculation: handleOpenCalculation,
      formulaMode, setFormulaMode, allItems, sourceIds: project?.sourceIds || [],
      multiSelection, toggleMultiSelection, priceIssueIds, insertTargetId,
      collapsedIds, toggleCollapsed,
      duplicateIndex, revealAndFlashItem,
      pseDeltaMap, pseCandidatesFor, pseNumbers,
      valoirTotals, etudeTotals,
      onEditItem: (item) => {
        const bpuSource = allBpuItems?.find(b => String(b.id) === String(item?.uid) || String(b.uid) === String(item?.uid));
        setEditItemTarget({
          ...item,
          description: item?.description || bpuSource?.description || '',
          cctpRefs: item?.cctpRefs?.length ? item.cctpRefs : (bpuSource?.cctpRefs || []),
          categoryIds: item?.categoryIds?.length ? item.categoryIds : (bpuSource?.categoryIds || []),
          // Prix réel observé de l'article source (affichage seul, non écrit dans la ligne projet)
          observedPrice: item?.observedPrice ?? bpuSource?.observedPrice ?? null,
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
            blocs={blocs} allBpu={allBpuItems} tranches={viewedProject?.tranches || []} onInsertLines={addItemsToProject}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <ProjectToolbar
            project={project} updateProjectName={updateProjectName} saveStatus={displayStatus} onSaveProject={handleManualCloudSave}
            isReadOnly={isReadOnly} onToggleLock={() => setIsLocked(v => !v)} showBpu={showBpu} setShowBpu={setShowBpu} currentMode={currentMode} setViewMode={setViewMode}
            totalBase={totalBase} activeTrancheId={activeTrancheId}
            onExport={(format, type) => {
              if (priceCheck.anomalyCount > 0) setExportGuard({ show: true, format, type });
              else setExportModalState({ show: true, format, type });
            }}
            onOpenCalculation={handleOpenCalculation} onOpenDetails={() => setShowDetailsModal(true)} onAddChapter={addChapter} onAddFreeItem={handleAddFreeItem}
            bpuConfig={bpuConfig} setBpuConfig={setBpuConfig}
            onSaveAffaire={handleSaveAffaire}
            onOpenAffaire={() => handleOpenAffaire(null)}
            onNewProject={handleNewProject}
            onOpenCloudProject={() => setShowCloudPicker(v => !v)}
            onOpenPriceAudit={() => setShowPriceAudit(true)}
            onOpenPriceCheck={() => setShowPriceCheck(true)}
            priceCheckCount={priceCheck.anomalyCount}
            onOpenBpuAudit={() => { refreshBpuAudit(); setShowBpuAudit(v => !v); }}
            bpuAuditActive={showBpuAudit}
            onOpenTakeoff={() => setShowDxfTakeoff(true)}
            onUndo={onUndo}
            canUndo={canUndo}
            archives={archives}
            onOpenGed={onOpenGed}
            onShowHelp={() => setShowHelp(true)}
          />
          <input ref={loadAffaireRef} type="file" accept=".json" className="hidden" onChange={handleOpenAffaireFallback} />

          {/* Picker projet cloud (modal plein écran) */}
          {showCloudPicker && companyId && (
            <CloudProjectPicker
              companyId={companyId}
              currentProjectId={project?.id}
              onSelect={(proj) => {
                setShowCloudPicker(false);
                if (onLoadCloudProject) onLoadCloudProject(proj);
              }}
              onClose={() => setShowCloudPicker(false)}
            />
          )}

          {isReadOnly && (
            <div className="flex items-center justify-center gap-3 px-4 py-1.5 bg-indigo-50 border-b border-indigo-200 text-indigo-800 text-[11px] font-bold uppercase tracking-wide shrink-0">
              <Eye size={13} strokeWidth={2.2} />
              <span>Vue Rendu — lecture seule (avant impression)</span>
              <button
                onClick={() => setIsLocked(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold normal-case hover:bg-indigo-700 transition-colors"
                title="Déverrouiller pour passer en mode Étude (modifiable)"
              >
                <Unlock size={11} /> Passer en Étude
              </button>
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
            <div className={`flex-1 overflow-y-auto px-6 pb-6 pt-0 space-y-8 ${theme.bg} ${(currentMode === 'client' || isRenduView) ? 'border-l-[6px] border-indigo-600' : ''}`}>

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
                {displayProject?.chapters?.length > 0 && (
                  <ProjectTableHeader viewMode={contextViewMode} showRendu={tableViewEffective === 'comparison'} />
                )}
                <Droppable droppableId="root" type="CHAPTER" isDropDisabled={isReadOnly}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="p-4 space-y-8">
                      {displayProject?.chapters?.map((chap, index) => {
                        // Total de chapitre = quantités « à valoir » (rendu), quel que soit le mode.
                        const chapTotal = projectStats?.client?.chapters?.[chap.id] || 0;
                        const isCollapsed = collapsedIds.has(chap.id);
                        const nbLines = isCollapsed ? countTreeItems(chap.children) : 0;
                        return (
                          <Draggable key={chap.id} draggableId={`chapter:${chap.id}`} index={index} isDragDisabled={isReadOnly}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className={`rounded-xl border overflow-hidden transition-all duration-200 ${selection?.id === chap.id ? 'ring-4 ring-emerald-50/50 border-emerald-500' : 'hover:shadow-md'} ${chap.id === insertTargetId ? 'outline outline-2 outline-blue-500 -outline-offset-2' : ''} ${chap.isOption ? 'bg-slate-50 border-slate-300 border-dashed' : 'bg-white border-slate-200'} ${snapshot.isDragging ? 'shadow-2xl z-50 ring-4 ring-emerald-500/20 rotate-1 bg-white' : ''}`}>
                                <div className={`p-3 flex justify-between items-center transition-colors duration-300 ${selection?.id === chap.id ? 'bg-emerald-600 text-white' : chap.isOption ? 'bg-slate-100 text-slate-600' : theme.chapterHeader + ' text-white'}`} onClick={() => setSelection({ type: 'chapter', id: chap.id })}>
                                  <div className="flex items-center gap-4">
                                    {!isReadOnly && (
                                      <button onClick={(e) => { e.stopPropagation(); handleModalIntercept({ show: true, target: { type: 'chapter', id: chap.id } }); }} className={`p-1 ${chap.isOption ? 'text-slate-400 hover:text-red-500' : 'text-white/40 hover:text-red-300'}`} title="Supprimer le chapitre"><Trash2 size={16} /></button>
                                    )}
                                    <div {...provided.dragHandleProps} className={`p-1 ${isReadOnly ? 'opacity-0 pointer-events-none' : chap.isOption ? 'text-slate-400 hover:text-slate-600' : 'text-white/40 hover:text-white cursor-grab active:cursor-grabbing'}`}>{!isReadOnly && <GripVertical size={18} />}</div>
                                    <button onClick={(e) => { e.stopPropagation(); toggleCollapsed(chap.id); }} className={`p-1 rounded-md transition-colors ${chap.isOption ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200' : 'text-white/50 hover:text-white hover:bg-white/10'}`} title={isCollapsed ? 'Déplier le chapitre' : 'Replier le chapitre'}>
                                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    <span className={`w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-black ${chap.isOption ? 'bg-slate-200 text-slate-500' : 'bg-white/20 text-white'}`}>{index + 1}</span>
                                    <EditableTitle value={chap.title} onSave={(val) => updateProjectItem('root', chap.id, 'title', val)} disabled={isReadOnly} className="font-black uppercase tracking-widest text-[11px] hover:bg-white/10" />
                                    <OptionToggle isOption={chap.isOption} pseNumber={pseNumbers.get(chap.id)} onClick={() => updateProjectItem('root', chap.id, 'isOption', !chap.isOption)} disabled={isReadOnly} />
                                    {chap.isOption && (
                                      <PseModeControl
                                        mode={chap.pseMode || 'simple'}
                                        baseId={chap.pseBaseId || ''}
                                        candidates={pseCandidatesFor(chap.id)}
                                        baseRef={pseDeltaMap.get(chap.id)?.baseRef || ''}
                                        baseLabel={pseDeltaMap.get(chap.id)?.baseLabel || ''}
                                        baseMissing={!!pseDeltaMap.get(chap.id)?.missing}
                                        disabled={isReadOnly}
                                        onChange={(m, baseId) => {
                                          updateProjectItem('root', chap.id, 'pseMode', m === 'substitution' ? 'substitution' : '');
                                          updateProjectItem('root', chap.id, 'pseBaseId', m === 'substitution' ? baseId : '');
                                        }}
                                      />
                                    )}
                                    {!isReadOnly && chap.id === insertTargetId && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0" title="Les nouveaux articles (libre ou bibliothèque) seront insérés dans ce chapitre">
                                        <Target size={10} /> Insertion ici
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {isCollapsed && (
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${chap.isOption ? 'bg-slate-200 text-slate-500' : 'bg-white/15 text-white/80'}`}>{nbLines} ligne{nbLines > 1 ? 's' : ''}</span>
                                    )}
                                    {(() => {
                                      const isSub = chap.isOption && chap.pseMode === 'substitution' && !pseDeltaMap.get(chap.id)?.missing;
                                      const cls = isSub
                                        ? 'bg-violet-100 text-violet-700'
                                        : chap.isOption
                                          ? 'bg-slate-200 text-slate-600 line-through decoration-slate-400'
                                          : 'bg-black/20 text-white';
                                      return (
                                        <span className={`font-mono font-black text-xs px-3 py-1 rounded-full ${cls}`} title={isSub ? `${chapTotal >= 0 ? 'Plus-value' : 'Moins-value'} PSE (montant PSE − prestation de base remplacée)` : undefined}>
                                          {isSub && chapTotal >= 0 ? '+' : ''}{formatPrice(chapTotal)}
                                        </span>
                                      );
                                    })()}
                                    {(!isReadOnly || chap.comment) && (
                                      <ChapterCommentButton
                                        hasComment={!!chap.comment}
                                        onClick={() => toggleCommentOpen(chap.id)}
                                        className={chap.isOption ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200' : 'text-white/50 hover:text-white hover:bg-white/10'}
                                      />
                                    )}
                                    {!isReadOnly && (
                                      <button onClick={(e) => { e.stopPropagation(); addSubChapter(chap.id); }} className={`p-1.5 rounded-md ${chap.isOption ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/20 text-white'}`} title="Ajouter un sous-chapitre"><Plus size={16} /></button>
                                    )}
                                  </div>
                                </div>
                                {chap.isOption && !isCollapsed && (
                                  <PseDescriptionEditor
                                    value={chap.pseDescription || ''}
                                    onChange={(html) => updateProjectItem('root', chap.id, 'pseDescription', html)}
                                    disabled={isReadOnly}
                                  />
                                )}
                                {!isCollapsed && commentOpenIds.has(chap.id) && (
                                  <ChapterCommentEditor
                                    value={chap.comment || ''}
                                    onSave={(val) => updateProjectItem('root', chap.id, 'comment', val)}
                                    disabled={isReadOnly}
                                  />
                                )}
                                <div className={`flex flex-col w-full ${chap.isOption ? 'opacity-80' : ''}`}>
                                  <Droppable droppableId={chap.id} type="ITEM" isDropDisabled={isReadOnly}>
                                    {(providedItem, snapshotItem) => (
                                      <div ref={providedItem.innerRef} {...providedItem.droppableProps} className={`flex flex-col w-full ${isCollapsed ? '' : 'min-h-[50px]'} transition-colors ${snapshotItem.isDraggingOver ? 'bg-emerald-50/50' : chap.isOption ? 'bg-slate-50/30' : 'bg-white'}`}>
                                        {!isCollapsed && <ItemList items={chap.children} parentId={chap.id} bpuConfig={bpuConfig} readOnly={isGlobalMode} parentNumber={String(index + 1)} />}
                                        {providedItem.placeholder}
                                        {!isCollapsed && (!chap.children || chap.children.length === 0) && !snapshotItem.isDraggingOver && <div className="p-8 text-center border-t border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Chapitre vide</div>}
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

              {/* Récap de totaux en pied de tableau (les 2 vues) : montants à valoir HT/TVA/TTC. */}
              <div className="mt-8 mb-20">
                <ProjectDocBanner
                  projectStats={projectStats}
                  tableView={tableViewEffective}
                  tvaRate={Number(project?.tauxTVA ?? 20)}
                />
              </div>

            </div>
          </DragDropContext>
        </div>

        {showBpuAudit && bpuAudit && (
          <BpuAuditPanel
            audit={bpuAudit}
            onClose={() => setShowBpuAudit(false)}
            onSyncDescriptions={syncBpuDescriptions}
            onRestoreIssues={restoreBpuIssues}
          />
        )}

      <ProjectDetailsModal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} project={project} onSave={handleSaveDetails} branding={masterBranding} archives={archives} />
      {editItemTarget && <EditBpuModal item={editItemTarget} onClose={() => setEditItemTarget(null)} onUpdate={handleSaveEditedItem} units={units} categories={categories} bpuConfig={bpuConfig} existingItems={[]} masterCctp={masterCctp} projectOnly onSaveToLibrary={handleSaveItemToLibrary} libraryItems={allBpuItems} />}
      <CalculationModal show={showCalculationModal} onClose={() => setShowCalculationModal(false)} onConfirm={handleApplyCalculation} analysis={calculationAnalysis} defaultThreshold={Number(project?.clientQtyThreshold ?? 20)} defaultPercent={Number(project?.clientPercent ?? clientPercent ?? 10)} />
      <ExportModal isOpen={exportModalState.show} onClose={() => setExportModalState(prev => ({ ...prev, show: false }))} onConfirm={handleConfirmExport} onPreviewPdf={handlePreviewPdf} format={exportModalState.format} type={exportModalState.type} hasTranches={hasTranches} tranches={tranches} activeTrancheId={activeTrancheId} />
      <ConfirmDeleteModal isOpen={deleteConfirm.show} onClose={() => setDeleteConfirm({ show: false, itemId: null })} onConfirm={() => { if(deleteConfirm.itemId) { handleRemoveItem(deleteConfirm.itemId); setDeleteConfirm({ show: false, itemId: null }); } }} />
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="estimation" />
      {showDxfTakeoff && (
        <React.Suspense fallback={null}>
          <DxfTakeoffModal
            project={project}
            activeTrancheId={activeTrancheId}
            onApply={handleApplyTakeoff}
            onClose={() => setShowDxfTakeoff(false)}
          />
        </React.Suspense>
      )}
      <PriceAuditModal
        show={showPriceAudit}
        onClose={() => setShowPriceAudit(false)}
        project={project}
        allBpuItems={allBpuItems}
        onRestorePrice={handleRestorePrice}
        onRestoreAllPrices={handleRestoreAllPrices}
        branding={masterBranding}
      />
      <PriceConsistencyModal
        show={showPriceCheck}
        onClose={() => setShowPriceCheck(false)}
        project={displayProject}
        bpuConfig={bpuConfig}
        onGoToItem={goToItem}
      />

      {/* Garde à l'export : avertir si des numéros de prix sont incohérents */}
      {exportGuard.show && (
        <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-[440px] border border-gray-200/60 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Numéros de prix incohérents</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {priceCheck.anomalyCount} anomalie{priceCheck.anomalyCount > 1 ? 's' : ''} détectée{priceCheck.anomalyCount > 1 ? 's' : ''} sur la numérotation des prix.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Le document exporté reprendra ces incohérences (un même numéro avec des libellés / unités différents, ou des doublons). Souhaitez-vous corriger avant d'exporter ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { const { format, type } = exportGuard; setExportGuard(g => ({ ...g, show: false })); setExportModalState({ show: true, format, type }); }}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide border border-gray-200/60 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
              >
                Exporter quand même
              </button>
              <button
                onClick={() => { setExportGuard(g => ({ ...g, show: false })); setShowPriceCheck(true); }}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
              >
                Corriger d'abord
              </button>
            </div>
          </div>
        </div>
      )}

      {!isReadOnly && multiSelection && multiSelection.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
              {multiSelection.size}
            </div>
            <span className="text-xs font-bold text-slate-900">
              article{multiSelection.size > 1 ? 's' : ''} sélectionné{multiSelection.size > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <button
            onClick={clearMultiSelection}
            className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Désélectionner
          </button>
          <button
            onClick={openMultiDeleteModal}
            className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            Supprimer
          </button>
        </div>
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
  blocs: PropTypes.array,
  addItemToProject: PropTypes.func.isRequired,
  addItemsToProject: PropTypes.func,
  selection: PropTypes.object,
  setSelection: PropTypes.func.isRequired,
  insertTargetId: PropTypes.string,
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
  onAddToBpu: PropTypes.func,
  onUpdateBpuItem: PropTypes.func,
  companyId: PropTypes.string,
  onLoadCloudProject: PropTypes.func,
  onUndo: PropTypes.func,
  canUndo: PropTypes.bool,
  archives: PropTypes.array,
  onOpenGed: PropTypes.func,
  multiSelection: PropTypes.object,
  toggleMultiSelection: PropTypes.func,
  clearMultiSelection: PropTypes.func,
  openMultiDeleteModal: PropTypes.func,
};

export default ProjectView;
