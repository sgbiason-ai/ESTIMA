import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle, FileText, FileUp, Layers3, LockKeyhole, Map as MapIcon, PanelRightOpen, Power, Ruler, X,
} from 'lucide-react';
import DxfViewerPanel from './DxfViewerPanel';
import DxfMappingPanel from './DxfMappingPanel';
import {
  RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonContainer,
} from '../common/RibbonParts';
import { assignMissingMeasurementColors, suggestMeasurementColor } from './measurementColors';
import {
  applyRowAdjustments, buildMeasurementRows, buildSelectionRows, measureSelection, METRIC_LABELS,
} from '../../utils/takeoff/dxfTakeoff';
import { flattenProjectItems, takeoffConversionFactor } from '../../utils/takeoff/applyTakeoff';
import {
  loadDxfSession, saveDxfFile, clearDxfSession,
} from '../../utils/takeoff/dxfPersistence';
import { useTakeoffAssociations, dxfFileKey } from '../../hooks/useTakeoffAssociations';
import { confirm, toast } from '../../utils/globalUI';

const formatQty = (value) => Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

// Préfixe du nom auto d'une sélection, selon le mode qui l'a créée (renommable ensuite).
const SELECTION_LABEL_PREFIX = { length: 'Linéaire', area: 'Surface', count: 'Comptage' };

// Disposition des trois colonnes (Métrés · Plan · Calques) : préférence d'affichage LOCALE
// par projet (localStorage), séparée des données métier cloud. Repli auto des Calques sur petit
// écran/tablette (< 1024px) pour laisser Métrés + Plan respirer.
const DXF_LAYOUT_DEFAULT = {
  leftWidth: 400,
  rightWidth: 440,
  layersCollapsed: typeof window !== 'undefined' && window.innerWidth < 1024,
  hiddenLayers: [],
};
const dxfLayoutKey = (id) => `estima:dxf:layout:${id || 'default'}`;
const readDxfLayout = (id) => {
  try {
    const raw = localStorage.getItem(dxfLayoutKey(id));
    if (!raw) return DXF_LAYOUT_DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      leftWidth: Number(parsed.leftWidth) || DXF_LAYOUT_DEFAULT.leftWidth,
      rightWidth: Number(parsed.rightWidth) || DXF_LAYOUT_DEFAULT.rightWidth,
      layersCollapsed: Boolean(parsed.layersCollapsed),
      hiddenLayers: Array.isArray(parsed.hiddenLayers) ? parsed.hiddenLayers.filter((n) => typeof n === 'string') : [],
    };
  } catch {
    return DXF_LAYOUT_DEFAULT;
  }
};

export default function DxfTakeoffModal({
  project, companyId, branding, activeTrancheId, onApply, onSync, onClose, visible = true, onUnload,
}) {
  const projectId = project?.id;
  const inputRef = useRef(null);
  const mainRef = useRef(null);
  const viewerRef = useRef(null);
  const skipFileSaveRef = useRef(false);
  const restoredKeyRef = useRef(null);
  const skipCloudSaveRef = useRef(false);
  const syncedMappingsRef = useRef(null);
  const skipNextSyncRef = useRef(false);
  const lastSyncSignatureRef = useRef('');
  const { associations, saveAssociations } = useTakeoffAssociations(companyId, projectId);
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [viewerLayers, setViewerLayers] = useState([]);
  const [mappings, setMappings] = useState({});
  const [scaleToMeters, setScaleToMeters] = useState(1);
  const [isolatedLayer, setIsolatedLayer] = useState('');
  // Gestionnaire de calques : calques masqués (multi, indépendant de l'isolation, persisté) +
  // calque survolé (transitoire, pré-isolation/surbrillance sur le plan, non persisté).
  const [hiddenLayers, setHiddenLayers] = useState(() => new Set(readDxfLayout(projectId).hiddenLayers));
  const [hoverLayer, setHoverLayer] = useState('');
  const [pick, setPick] = useState({ layer: '', nonce: 0 });
  const [applyMode, setApplyMode] = useState('replace');
  const [loadError, setLoadError] = useState('');
  const [leftWidth, setLeftWidth] = useState(() => readDxfLayout(projectId).leftWidth);
  const [rightWidth, setRightWidth] = useState(() => readDxfLayout(projectId).rightWidth);
  const [layersCollapsed, setLayersCollapsed] = useState(() => readDxfLayout(projectId).layersCollapsed);
  // Sélection d'éléments : mode actif ('' | 'length' | 'area' | 'count'), éléments cochés
  // (ids DXF), lignes de métré créées.
  const [selectionMode, setSelectionMode] = useState('');
  const [selectedEntityIds, setSelectedEntityIds] = useState([]);
  const [entitySelections, setEntitySelections] = useState([]);
  const [editingSelectionId, setEditingSelectionId] = useState('');
  const [previewSelectionId, setPreviewSelectionId] = useState('');
  const [focusEntities, setFocusEntities] = useState({ ids: [], nonce: 0 });
  // Corrections manuelles (+/−) par ligne : rowId → delta dans l'unité de la métrique.
  const [adjustments, setAdjustments] = useState({});

  const projectItems = useMemo(() => flattenProjectItems(project?.chapters), [project?.chapters]);
  const rows = useMemo(() => applyRowAdjustments([
    ...buildSelectionRows(entitySelections, scaleToMeters),
    ...buildMeasurementRows(summary, scaleToMeters),
  ], adjustments), [entitySelections, summary, scaleToMeters, adjustments]);
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const selectedMappings = useMemo(() => Object.entries(mappings).flatMap(([rowId, mapping]) => {
    const row = rowMap.get(rowId);
    const coefficient = Number(mapping?.coefficient ?? 1);
    if (!row || !mapping?.itemId || !Number.isFinite(coefficient) || coefficient < 0) return [];
    const article = projectItems.find((item) => String(item.id) === String(mapping.itemId));
    const metricUnit = row.unit || METRIC_LABELS[row.metric]?.unit;
    const conversion = article ? takeoffConversionFactor(metricUnit, article.unit, mapping) : 1;
    return [{
      rowId,
      layer: row.layer,
      metric: row.metric,
      itemId: mapping.itemId,
      coefficient,
      measuredQuantity: row.quantity,
      largeur: mapping.largeur ?? '',
      epaisseur: mapping.epaisseur ?? '',
      densite: mapping.densite ?? '',
      perte: mapping.perte ?? '',
      appliedQuantity: Math.round(row.quantity * coefficient * conversion * 1000) / 1000,
    }];
  }), [mappings, rowMap, projectItems]);

  const hasTranches = (project?.tranches || []).length > 0;
  const targetTrancheId = hasTranches && activeTrancheId !== 'global' ? activeTrancheId : null;
  const trancheMissing = hasTranches && !targetTrancheId;
  const dxfKey = dxfFileKey(file);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.dxf')) {
      toast.error('Sélectionnez un fichier au format .dxf');
      return;
    }
    setFile(selectedFile);
    setSummary(null);
    setViewerLayers([]);
    setMappings({});
    setIsolatedLayer('');
    setHiddenLayers(new Set());
    setHoverLayer('');
    setLoadError('');
    setSelectionMode('');
    setSelectedEntityIds([]);
    setEntitySelections([]);
    setEditingSelectionId('');
    setPreviewSelectionId('');
    setFocusEntities({ ids: [], nonce: 0 });
    setAdjustments({});
  };

  const handleLoaded = useCallback((nextSummary, layers) => {
    setSummary(nextSummary);
    setViewerLayers(layers);
    setScaleToMeters(Number(nextSummary?.metadata?.detectedScaleToMeters) || 1);
    setLoadError('');
  }, []);

  const handleError = useCallback((message) => setLoadError(message), []);

  // Séparateurs redimensionnables. `side` = 'left' (volet Métrés) ou 'right' (volet Calques).
  // Borne max : jamais recouvrir le plan → on réserve ~380px pour le plan + la largeur de l'autre
  // volet (0 si les Calques sont repliés à droite).
  const startResize = (side) => (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const container = mainRef.current;
    const containerWidth = container ? container.clientWidth : 1400;
    const otherWidth = side === 'left' ? (layersCollapsed ? 36 : startRight) : startLeft;
    const minWidth = side === 'left' ? 340 : 320;
    const maxWidth = Math.max(minWidth, containerWidth - otherWidth - 380);
    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = side === 'left' ? startLeft + delta : startRight - delta;
      const clamped = Math.min(Math.max(minWidth, next), maxWidth);
      if (side === 'left') setLeftWidth(clamped); else setRightWidth(clamped);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Recharge la disposition mémorisée quand on change de projet.
  useEffect(() => {
    const layout = readDxfLayout(projectId);
    setLeftWidth(layout.leftWidth);
    setRightWidth(layout.rightWidth);
    setLayersCollapsed(layout.layersCollapsed);
    setHiddenLayers(new Set(layout.hiddenLayers));
  }, [projectId]);

  // Persiste la disposition (débounce) en localStorage — préférence locale, hors cloud métier.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(dxfLayoutKey(projectId), JSON.stringify({
          leftWidth, rightWidth, layersCollapsed, hiddenLayers: Array.from(hiddenLayers),
        }));
      } catch { /* quota/localStorage indisponible : sans effet */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [projectId, leftWidth, rightWidth, layersCollapsed, hiddenLayers]);

  // --- Gestionnaire de calques : visibilité multi (masquer/afficher), « tout afficher/masquer »,
  //     survol = surbrillance sur le plan. L'isolation (isolatedLayer) reste gérée à part.
  const handleToggleLayerHidden = useCallback((layer) => {
    if (!layer) return;
    setHiddenLayers((previous) => {
      const next = new Set(previous);
      if (next.has(layer)) next.delete(layer); else next.add(layer);
      return next;
    });
  }, []);

  const handleShowAllLayers = useCallback(() => {
    setIsolatedLayer('');
    setHiddenLayers((previous) => (previous.size ? new Set() : previous));
  }, []);

  const handleHideLayers = useCallback((names) => {
    setHiddenLayers((previous) => {
      const next = new Set(previous);
      for (const name of names || []) if (name) next.add(name);
      return next;
    });
  }, []);

  const handleSetHoverLayer = useCallback((layer) => setHoverLayer(layer || ''), []);

  // Clic sur un objet de l'aperçu : isole son calque (vide = affiche tout) et cible le volet
  // Calques (qui se déplie s'il était replié pour que la ligne surlignée soit visible).
  const handlePickLayer = useCallback((layer) => {
    setIsolatedLayer(layer || '');
    if (layer) {
      setLayersCollapsed(false);
      setPick((previous) => ({ layer, nonce: previous.nonce + 1 }));
    }
  }, []);

  // --- Sélection d'entités réelles (mode « Sélection » de l'aperçu) ---
  const entityIndex = summary?.entityIndex || null;
  const liveSelectionMeasure = useMemo(
    () => measureSelection(entityIndex, selectedEntityIds),
    [entityIndex, selectedEntityIds],
  );

  // Le mode restreint la visée à sa métrique → on n'affiche que celle-là (une polyligne
  // fermée prise en mode Linéaire a une aire, mais elle n'entre pas dans ce métré).
  const selectionSummary = useMemo(() => {
    if (!selectionMode) return null;
    const measure = liveSelectionMeasure;
    let text = '';
    if (selectionMode === 'length') text = `${formatQty(measure.rawLength * scaleToMeters)} ml`;
    else if (selectionMode === 'area') text = `${formatQty(measure.rawArea * scaleToMeters * scaleToMeters)} m²`;
    else if (selectionMode === 'count') text = `${formatQty(measure.rawCount)} u`;
    return { entityCount: measure.entityCount, text, editing: Boolean(editingSelectionId) };
  }, [selectionMode, liveSelectionMeasure, scaleToMeters, editingSelectionId]);

  const handleSelectionModeChange = useCallback((next) => {
    setSelectionMode(next || '');
    setSelectedEntityIds([]); // changer de mode repart d'une sélection vide (métriques disjointes)
    setEditingSelectionId(''); // …et annule une édition en cours
  }, []);

  const handlePickEntity = useCallback((entityId) => {
    setSelectedEntityIds((previous) => (previous.includes(entityId)
      ? previous.filter((id) => id !== entityId)
      : [...previous, entityId]));
  }, []);

  // Rouvre une ligne « Sélection » pour la modifier sur le plan : ses éléments redeviennent
  // la sélection courante (surlignés), le mode reprend sa métrique, on recadre dessus.
  const handleEditSelection = useCallback((selectionId) => {
    const selection = entitySelections.find((item) => item.id === selectionId);
    if (!selection) return;
    setPreviewSelectionId('');
    setEditingSelectionId(selectionId);
    setSelectionMode(selection.metric || 'length');
    setSelectedEntityIds(selection.entityIds || []);
    setFocusEntities((previous) => ({ ids: selection.entityIds || [], nonce: previous.nonce + 1 }));
  }, [entitySelections]);

  // Valide la sélection courante : met à jour la ligne en cours d'édition, sinon en crée une
  // nouvelle. Mesures brutes snapshotées → la ligne reste valide même sans reconstruire l'index.
  // `metric` = mode actif → la ligne ne porte qu'une métrique (Linéaire/Surfaces/Comptage).
  const handleCommitSelection = useCallback(() => {
    const measure = liveSelectionMeasure;
    if (!measure.entityCount || !selectionMode) return;
    const snapshot = {
      entityIds: [...selectedEntityIds],
      rawLength: measure.rawLength,
      rawArea: measure.rawArea,
      rawCount: measure.rawCount,
      entityCount: measure.entityCount,
      approximateCount: measure.approximateCount,
    };
    if (editingSelectionId) {
      setEntitySelections((previous) => previous.map((item) => (
        item.id === editingSelectionId ? { ...item, ...snapshot, isManual: false } : item
      )));
      setEditingSelectionId('');
      setSelectedEntityIds([]);
      toast.success('Sélection mise à jour.');
      return;
    }
    const prefix = SELECTION_LABEL_PREFIX[selectionMode] || 'Sélection';
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const number = entitySelections.reduce((max, item) => {
      const match = new RegExp(`^${escaped} (\\d+)$`).exec(item.label || '');
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    const selection = {
      id: `sel_${Date.now().toString(36)}`,
      label: `${prefix} ${number}`,
      metric: selectionMode,
      highlightColor: suggestMeasurementColor(`${prefix} ${number}`, entitySelections),
      ...snapshot,
      createdAt: new Date().toISOString(),
    };
    setEntitySelections((previous) => [...previous, selection]);
    setSelectedEntityIds([]);
    toast.success(`« ${selection.label} » ajoutée à la liste de métré.`);
  }, [liveSelectionMeasure, selectionMode, selectedEntityIds, entitySelections, editingSelectionId]);

  // Correction manuelle (+/−) d'une ligne : delta nul/vide → on retire la clé.
  const handleAdjustmentChange = useCallback((rowId, value) => {
    setAdjustments((previous) => {
      const num = Number(value);
      const next = { ...previous };
      if (value === '' || !Number.isFinite(num) || num === 0) delete next[rowId];
      else next[rowId] = num;
      return next;
    });
  }, []);

  const handleRenameSelection = useCallback((selectionId, label) => {
    const cleaned = String(label || '').trim().slice(0, 80);
    if (!cleaned) return;
    setEntitySelections((previous) => previous.map((selection) => {
      if (selection.id !== selectionId) return selection;
      return {
        ...selection,
        label: cleaned,
        highlightColor: selection.colorLocked
          ? selection.highlightColor
          : suggestMeasurementColor(cleaned, previous.filter((item) => item.id !== selectionId)),
      };
    }));
  }, []);

  const handleCreateManualMeasurement = useCallback(({ label, metric, unit, itemId }) => {
    const id = `manual_${Date.now().toString(36)}`;
    const rowId = `sel::${id}::${metric}`;
    setEntitySelections((previous) => [...previous, {
      id,
      label: String(label || 'Nouveau métré').trim().slice(0, 80),
      metric,
      unit,
      isManual: true,
      highlightColor: suggestMeasurementColor(label, previous),
      entityIds: [],
      rawLength: 0,
      rawArea: 0,
      rawCount: 0,
      entityCount: 0,
      createdAt: new Date().toISOString(),
    }]);
    if (itemId) {
      setMappings((previous) => ({
        ...previous,
        [rowId]: { itemId, coefficient: 1 },
      }));
    }
    toast.success(itemId ? 'Métré créé depuis le DQE.' : 'Ligne de métré vierge créée.');
  }, []);

  const handleDeleteSelection = useCallback((selectionId) => {
    setEntitySelections((previous) => previous.filter((selection) => selection.id !== selectionId));
    const purge = (map) => {
      const next = {};
      for (const [rowId, value] of Object.entries(map)) {
        if (!rowId.startsWith(`sel::${selectionId}::`)) next[rowId] = value;
      }
      return next;
    };
    setMappings(purge); // retire l'association…
    setAdjustments(purge); // …et la correction manuelle des lignes de cette sélection
    setPreviewSelectionId((current) => (current === selectionId ? '' : current));
    setEditingSelectionId((current) => (current === selectionId ? '' : current));
  }, []);

  // Œil d'une ligne sélection : surligne ses éléments et recadre l'aperçu dessus.
  const handlePreviewSelection = (selectionId) => {
    if (previewSelectionId === selectionId) {
      setPreviewSelectionId('');
      return;
    }
    setPreviewSelectionId(selectionId);
    const selection = entitySelections.find((item) => item.id === selectionId);
    if (selection) {
      setFocusEntities((previous) => ({ ids: selection.entityIds || [], nonce: previous.nonce + 1 }));
    }
  };

  const handleToggleSelectionVisibility = useCallback((selectionId) => {
    setEntitySelections((previous) => previous.map((selection) => (
      selection.id === selectionId
        ? { ...selection, highlightHidden: !selection.highlightHidden }
        : selection
    )));
    setPreviewSelectionId((current) => (current === selectionId ? '' : current));
  }, []);

  const handleSelectionColorChange = useCallback((selectionId, highlightColor) => {
    setEntitySelections((previous) => previous.map((selection) => {
      if (selection.id !== selectionId) return selection;
      return highlightColor
        ? { ...selection, highlightColor, colorLocked: true }
        : {
          ...selection,
          highlightColor: suggestMeasurementColor(
            selection.label,
            previous.filter((item) => item.id !== selectionId),
          ),
          colorLocked: false,
        };
    }));
  }, []);

  const highlightedEntityIds = useMemo(() => {
    const ids = selectionMode ? [...selectedEntityIds] : [];
    if (previewSelectionId) {
      const selection = entitySelections.find((item) => item.id === previewSelectionId);
      for (const id of selection?.entityIds || []) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    return ids;
  }, [selectionMode, selectedEntityIds, previewSelectionId, entitySelections]);
  const measuredEntityGroups = useMemo(() => entitySelections
    .filter((selection) => !selection.highlightHidden && (selection.entityIds || []).length > 0)
    .map((selection) => ({
      id: selection.id,
      color: selection.highlightColor || '#f97316',
      entityIds: selection.entityIds || [],
    })), [entitySelections]);

  // Rechargement du FICHIER au montage (IndexedDB local → réouverture instantanée + F5).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadDxfSession(projectId);
      if (cancelled || !saved?.file) return;
      skipFileSaveRef.current = true;
      setFile(saved.file);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Persistance du fichier : une écriture par changement de fichier (pas à chaque édition).
  useEffect(() => {
    if (!projectId) return;
    if (skipFileSaveRef.current) { skipFileSaveRef.current = false; return; }
    if (file) saveDxfFile(projectId, file.name, file);
  }, [file, projectId]);

  // Restaure les associations CLOUD rattachées à CE fichier (une fois par fichier), dès que
  // le plan est analysé et le doc cloud lu. Recharger le même DXF = retrouver son travail.
  useEffect(() => {
    if (!dxfKey || !summary || associations === null) return;
    if (restoredKeyRef.current === dxfKey) return;
    restoredKeyRef.current = dxfKey;
    const saved = associations[dxfKey];
    if (saved) {
      skipCloudSaveRef.current = true;
      if (saved.mappings) setMappings(saved.mappings);
      if (saved.scaleToMeters) setScaleToMeters(saved.scaleToMeters);
      if (saved.applyMode) setApplyMode(saved.applyMode);
      if (Array.isArray(saved.selections)) {
        setEntitySelections(assignMissingMeasurementColors(saved.selections));
      }
      if (saved.adjustments) setAdjustments(saved.adjustments);
    }

    const trancheKey = targetTrancheId || 'global';
    const lastApplied = [...(project?.takeoffImports || [])].reverse().find((entry) => (
      entry.fileName === file?.name && (entry.trancheId || 'global') === trancheKey
    ));
    if (lastApplied) {
      syncedMappingsRef.current = lastApplied.mappings || [];
      skipNextSyncRef.current = true;
    } else {
      syncedMappingsRef.current = null;
    }
  }, [dxfKey, summary, associations, file?.name, project?.takeoffImports, targetTrancheId]);

  // Une fois ce fichier appliqué au DQE, toute édition ultérieure est réconciliée aussitôt :
  // ancienne contribution DXF retirée, nouvelle ajoutée, saisies manuelles inchangées.
  useEffect(() => {
    if (!onSync || syncedMappingsRef.current === null) return;
    const signature = JSON.stringify(selectedMappings);
    if (signature === lastSyncSignatureRef.current) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      lastSyncSignatureRef.current = signature;
      return;
    }
    const previous = syncedMappingsRef.current;
    syncedMappingsRef.current = selectedMappings;
    lastSyncSignatureRef.current = signature;
    onSync(previous, selectedMappings, {
      fileName: file?.name,
      trancheId: targetTrancheId,
    });
  }, [selectedMappings, onSync, file?.name, targetTrancheId]);

  // Sauvegarde CLOUD des associations (débounce), uniquement après restauration pour ce
  // fichier → ne jamais écraser le cloud avec un état vide au chargement.
  useEffect(() => {
    if (!dxfKey || restoredKeyRef.current !== dxfKey) return undefined;
    if (skipCloudSaveRef.current) { skipCloudSaveRef.current = false; return undefined; }
    const timer = setTimeout(() => {
      saveAssociations(dxfKey, {
        mappings, scaleToMeters, applyMode, selections: entitySelections, adjustments,
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [dxfKey, mappings, scaleToMeters, applyMode, entitySelections, adjustments, saveAssociations]);

  const handleClose = async () => {
    if (dxfKey && restoredKeyRef.current === dxfKey) {
      try {
        await saveAssociations(dxfKey, {
          mappings, scaleToMeters, applyMode, selections: entitySelections, adjustments,
        });
      } catch {
        toast.error('Impossible d’enregistrer les associations DXF. La fenêtre reste ouverte.');
        return false;
      }
    }
    onClose();
    return true;
  };

  const handleUnload = () => {
    clearDxfSession(projectId);
    onUnload?.();
  };

  // Sélections colorées réellement représentables sur le plan (avec éléments, non masquées).
  const measuredSelections = useMemo(
    () => entitySelections.filter((sel) => (sel.entityIds || []).length > 0 && !sel.highlightHidden),
    [entitySelections],
  );

  // Export « Plan des métrés » : plan sans échelle cadré sur les sélections + légende + tableau.
  const handleExportMeasurePlan = async () => {
    if (!measuredSelections.length) {
      toast.warning('Aucune sélection à représenter. Mesurez des éléments avec l’outil « Sélection ».');
      return;
    }
    if (!viewerRef.current?.captureFrames) return;
    try {
      const overviewIds = measuredSelections.flatMap((sel) => sel.entityIds || []);
      const frames = [overviewIds, ...measuredSelections.map((sel) => sel.entityIds || [])];
      const images = await viewerRef.current.captureFrames(frames);
      const trancheName = targetTrancheId
        ? (project?.tranches?.find((t) => t.id === targetTrancheId)?.name || targetTrancheId)
        : 'Global';
      const entries = measuredSelections.map((sel, index) => {
        const row = rows.find((item) => item.selectionId === sel.id) || null;
        const mapping = row ? mappings[row.id] : null;
        const article = mapping?.itemId
          ? projectItems.find((item) => String(item.id) === String(mapping.itemId))
          : null;
        return {
          color: sel.highlightColor || '#f97316',
          label: sel.label || 'Sélection',
          row,
          mapping,
          article,
          image: images[index + 1] || null,
        };
      });
      const { generateMeasurePlanPdf } = await import('../../utils/takeoff/pdfTakeoffPlanGenerator');
      await generateMeasurePlanPdf({
        project,
        branding,
        fileName: file?.name,
        trancheName,
        overviewImage: images[0] || null,
        entries,
      });
    } catch {
      toast.error('Échec de la génération du plan des métrés.');
    }
  };

  const handleExportCurrentPdf = async () => {
    try {
      const trancheName = targetTrancheId
        ? (project?.tranches?.find((t) => t.id === targetTrancheId)?.name || targetTrancheId)
        : 'Global';
      const { generateCurrentTakeoffPdf } = await import('../../utils/takeoff/pdfTakeoffGenerator');
      await generateCurrentTakeoffPdf({
        project, branding, mappings, rows, projectItems, fileName: file?.name, trancheName,
      });
    } catch {
      toast.error('Échec de la génération du PDF.');
    }
  };

  const handleExportHistoryPdf = async () => {
    try {
      const { generateHistoryTakeoffPdf } = await import('../../utils/takeoff/pdfTakeoffGenerator');
      await generateHistoryTakeoffPdf({
        project, branding, currentFile: file?.name, currentRows: rows, currentMappings: mappings,
      });
    } catch {
      toast.error('Échec de la génération du PDF.');
    }
  };

  const handleApply = async () => {
    if (selectedMappings.length === 0) {
      toast.warning('Associez au moins un métré à un article du projet.');
      return;
    }
    if (trancheMissing) {
      toast.warning('Sélectionnez une tranche dans l’Estimation avant d’appliquer le métré.');
      return;
    }

    const targetIds = new Set(selectedMappings.map((mapping) => String(mapping.itemId)));
    const formulaCount = projectItems.filter((item) => targetIds.has(String(item.id)) && (
      targetTrancheId ? item.quantitiesFormula?.[targetTrancheId] : item.formula
    )).length;
    const warning = formulaCount > 0
      ? ` ${formulaCount} formule(s) de quantité seront remplacées.`
      : '';
    const ok = await confirm(
      `Appliquer ${selectedMappings.length} association(s) au projet ?${warning}`,
      { title: 'Appliquer le métré DXF', confirmLabel: 'Appliquer', cancelLabel: 'Annuler' },
    );
    if (!ok) return;

    onApply(selectedMappings, {
      fileName: file?.name,
      mode: applyMode,
      trancheId: targetTrancheId,
      sourceSize: file?.size,
      viewerLayerCount: viewerLayers.length,
    });
    syncedMappingsRef.current = selectedMappings;
    lastSyncSignatureRef.current = JSON.stringify(selectedMappings);
    if (await handleClose()) {
      toast.success('Les quantités du métré DXF ont été appliquées et sauvegardées.');
    }
  };

  // Props communes aux deux volets (Métrés à gauche, Calques à droite) : source unique = la modale.
  // Seuls diffèrent `mode`, `pick` (Calques seul) et `onCollapse` (Calques seul).
  const panelProps = {
    summary,
    rows,
    projectItems,
    mappings,
    onMappingsChange: setMappings,
    scaleToMeters,
    onScaleChange: setScaleToMeters,
    isolatedLayer,
    onIsolateLayer: setIsolatedLayer,
    hiddenLayers,
    onToggleLayerHidden: handleToggleLayerHidden,
    onShowAllLayers: handleShowAllLayers,
    onHideLayers: handleHideLayers,
    onSetHoverLayer: handleSetHoverLayer,
    onDeleteSelection: handleDeleteSelection,
    onRenameSelection: handleRenameSelection,
    onEditSelection: handleEditSelection,
    editingSelectionId,
    adjustments,
    onAdjustmentChange: handleAdjustmentChange,
    previewSelectionId,
    onPreviewSelection: handlePreviewSelection,
    onToggleSelectionVisibility: handleToggleSelectionVisibility,
    onSelectionColorChange: handleSelectionColorChange,
    onCreateMeasurement: handleCreateManualMeasurement,
  };

  return (
    <div className={`fixed inset-0 z-modal flex ${visible ? '' : 'invisible pointer-events-none'}`} role="dialog" aria-modal="true" aria-label="Métré DXF">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-5 py-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Ruler size={21} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Métré DXF</h2>
                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">POC</span>
              </div>
              <p className="truncate text-xs text-gray-500">{file?.name || 'Import local — aucune donnée envoyée à un service CAO externe'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700 lg:inline-flex">
              <LockKeyhole size={13} /> Traitement local
            </span>
            <button type="button" onClick={handleClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fermer">
              <X size={20} />
            </button>
            <input ref={inputRef} type="file" accept=".dxf" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
          </div>
        </header>

        {/* ═══════ RIBBON (Fichier · Exports) — comme les autres modules ═══════ */}
        <RibbonContainer>
          <RibbonGroup label="Fichier">
            <RibbonBtnLarge
              icon={FileUp}
              label={file ? 'Changer' : 'Ouvrir'}
              onClick={() => inputRef.current?.click()}
              accent="text-blue-600"
              title={file ? 'Charger un autre fichier DXF' : 'Ouvrir un fichier DXF (traitement 100 % local)'}
            />
            <RibbonBtnLarge
              icon={Power}
              label="Décharger"
              onClick={handleUnload}
              disabled={!file}
              accent="text-slate-500"
              title="Décharger le DXF de la mémoire (les associations restent enregistrées et reviendront en rechargeant ce fichier)"
            />
          </RibbonGroup>

          <RibbonGroup label="Exports" noBorder>
            <RibbonBtnLarge
              icon={MapIcon}
              label="Plan des métrés"
              onClick={handleExportMeasurePlan}
              disabled={measuredSelections.length === 0}
              accent="text-violet-500"
              title="Plan des métrés PDF : plan sans échelle cadré sur les sélections + légende + tableau détaillé"
            />
            <div className="flex flex-col justify-center gap-[3px]">
              <RibbonBtnSmall
                icon={FileText}
                label="Feuille PDF"
                onClick={handleExportCurrentPdf}
                disabled={selectedMappings.length === 0}
                accent="text-red-500"
                title="Feuille de métré PDF (associations en cours)"
              />
              <RibbonBtnSmall
                icon={FileText}
                label="Historique"
                onClick={handleExportHistoryPdf}
                disabled={(project?.takeoffImports || []).length === 0}
                accent="text-slate-500"
                title="PDF de l'historique des imports DXF appliqués au projet"
              />
            </div>
          </RibbonGroup>
        </RibbonContainer>

        {file?.size > 75 * 1024 * 1024 && !loadError && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[11px] text-amber-800">
            <AlertTriangle size={14} /> Plan volumineux ({Math.round(file.size / 1024 / 1024)} Mo) : utilisez de préférence un ordinateur avec au moins 8 Go de RAM.
          </div>
        )}

        <main ref={mainRef} className="flex flex-1 min-h-0">
          {/* Volet Métrés (gauche) — toujours visible (volet primaire du métreur) */}
          <div className="min-h-0 shrink-0" style={{ width: `${leftWidth}px` }}>
            <DxfMappingPanel mode="metres" {...panelProps} />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startResize('left')}
            title="Glisser pour redimensionner"
            className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400"
          />

          {/* Plan (centre) */}
          <div className="min-w-0 flex-1">
            <DxfViewerPanel
              ref={viewerRef}
              file={file}
              isolatedLayer={isolatedLayer}
              onLoaded={handleLoaded}
              onError={handleError}
              onPickLayer={handlePickLayer}
              selectionMode={selectionMode}
              onSelectionModeChange={handleSelectionModeChange}
              highlightedEntityIds={highlightedEntityIds}
              measuredEntityGroups={measuredEntityGroups}
              onPickEntity={handlePickEntity}
              selectionSummary={selectionSummary}
              onCreateSelectionRow={handleCommitSelection}
              onClearSelection={() => setSelectedEntityIds([])}
              focusEntities={focusEntities}
              scaleToMeters={scaleToMeters}
              hiddenLayers={hiddenLayers}
              hoverLayer={hoverLayer}
              onShowAllLayers={handleShowAllLayers}
            />
          </div>

          {/* Volet Calques (droite) — escamotable en rail */}
          {layersCollapsed ? (
            <button
              type="button"
              onClick={() => setLayersCollapsed(false)}
              title="Afficher les calques du dessin"
              className="flex w-9 shrink-0 flex-col items-center gap-2 border-l border-gray-200 bg-gray-50 py-3 text-gray-500 hover:bg-gray-100"
            >
              <PanelRightOpen size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wide [writing-mode:vertical-rl]">Calques</span>
              <span className="rounded bg-white px-1 py-0.5 text-[9px] font-bold text-gray-500">{summary?.layers?.length || 0}</span>
            </button>
          ) : (
            <>
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={startResize('right')}
                title="Glisser pour redimensionner"
                className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400"
              />
              <div className="min-h-0 shrink-0" style={{ width: `${rightWidth}px` }}>
                <DxfMappingPanel
                  mode="layers"
                  pick={pick}
                  onCollapse={() => setLayersCollapsed(true)}
                  {...panelProps}
                />
              </div>
            </>
          )}
        </main>

        {/* pr-20 : dégage le coin bas-droite occupé par le FAB feedback (z-9998, fixe viewport) */}
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 py-3 pl-5 pr-20">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl bg-gray-200/70 p-0.5">
              <button type="button" onClick={() => setApplyMode('replace')} className={`rounded-[10px] px-3 py-1.5 text-[11px] font-semibold ${applyMode === 'replace' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Remplacer</button>
              <button type="button" onClick={() => setApplyMode('add')} className={`rounded-[10px] px-3 py-1.5 text-[11px] font-semibold ${applyMode === 'add' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Ajouter</button>
            </div>
            <span className="text-[11px] text-gray-500">
              {selectedMappings.length} association(s) prête(s)
              {targetTrancheId && ` · ${project.tranches.find((tranche) => tranche.id === targetTrancheId)?.name || targetTrancheId}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {trancheMissing && <span className="text-[10px] font-semibold text-amber-700">Sélectionnez une tranche dans l’Estimation</span>}
            <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200">Annuler</button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!summary}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Layers3 size={15} /> Appliquer au DQE
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

DxfTakeoffModal.propTypes = {
  project: PropTypes.object.isRequired,
  companyId: PropTypes.string,
  branding: PropTypes.object,
  activeTrancheId: PropTypes.string,
  onApply: PropTypes.func.isRequired,
  onSync: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  visible: PropTypes.bool,
  onUnload: PropTypes.func,
};
