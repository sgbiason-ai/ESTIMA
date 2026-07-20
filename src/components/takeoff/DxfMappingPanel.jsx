import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle, Eye, EyeOff, Focus, Link2, PanelRightClose, Pencil, Plus, Search, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { METRIC_LABELS } from '../../utils/takeoff/dxfTakeoff';
import { isUnitCompatible, takeoffGeoSpec, takeoffConversionFactor } from '../../utils/takeoff/applyTakeoff';
import { toast } from '../../utils/globalUI';
import { MEASUREMENT_COLOR_GROUPS } from './measurementColors';

const formatQuantity = (value) => Number(value || 0).toLocaleString('fr-FR', {
  maximumFractionDigits: 3,
});

const UNIT_SCALE_OPTIONS = [
  { label: 'Millimètres', value: 0.001 },
  { label: 'Centimètres', value: 0.01 },
  { label: 'Décimètres', value: 0.1 },
  { label: 'Mètres', value: 1 },
  { label: 'Kilomètres', value: 1000 },
];

const inferMetricFromUnit = (unit) => {
  const normalized = String(unit || '').toLowerCase().replace(/²/g, '2').replace(/\s+/g, '');
  if (['ml', 'm', 'mètre', 'metre'].includes(normalized)) return 'length';
  if (['m2', 'mètrecarré', 'metrecarre'].includes(normalized)) return 'area';
  return 'count';
};

function ProjectItemOptions({ items, metric }) {
  const sorted = useMemo(() => [...items].sort((a, b) => {
    const compatibility = Number(isUnitCompatible(metric, b.unit)) - Number(isUnitCompatible(metric, a.unit));
    return compatibility || a.designation.localeCompare(b.designation, 'fr');
  }), [items, metric]);

  return (
    <>
      <option value="">Choisir un article du projet…</option>
      {sorted.map((item) => (
        <option key={item.id} value={item.id}>
          {isUnitCompatible(metric, item.unit) ? '✓ ' : ''}{item.isBloc ? '▦ Bloc — ' : ''}{item.designation} [{item.unit || '—'}]
        </option>
      ))}
    </>
  );
}

ProjectItemOptions.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  metric: PropTypes.string.isRequired,
};

function GeoInput({ label, value, onChange, step = '0.01', placeholder = '0.00' }) {
  return (
    <label className="flex items-center gap-1 text-[9px] font-medium text-gray-500">
      {label}
      <input
        type="number"
        min="0"
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-12 rounded border border-gray-200 bg-white px-1 py-0.5 text-right text-[10px] font-semibold text-gray-800 outline-none focus:border-blue-400"
      />
    </label>
  );
}

GeoInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  step: PropTypes.string,
  placeholder: PropTypes.string,
};

export default function DxfMappingPanel({
  mode = 'layers',
  onCollapse,
  summary,
  rows = [],
  projectItems,
  mappings,
  onMappingsChange,
  scaleToMeters,
  onScaleChange,
  isolatedLayer,
  onIsolateLayer,
  hiddenLayers = null,
  onToggleLayerHidden = () => {},
  onShowAllLayers = () => {},
  onHideLayers = () => {},
  onSetHoverLayer = () => {},
  pick,
  onDeleteSelection = () => {},
  onRenameSelection = () => {},
  onEditSelection = () => {},
  editingSelectionId = '',
  adjustments = {},
  onAdjustmentChange = () => {},
  onToggleSelectionVisibility = () => {},
  onSelectionColorChange = () => {},
  onCreateMeasurement = () => {},
}) {
  const [search, setSearch] = useState('');
  const [mappedOnly, setMappedOnly] = useState(false);
  const [metricFilters, setMetricFilters] = useState({ length: false, area: false, count: false });
  const [flashLayer, setFlashLayer] = useState('');
  const [adjustingRowId, setAdjustingRowId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ itemId: '', label: '', metric: 'length', unit: 'ml' });
  const [colorPickerRowId, setColorPickerRowId] = useState('');
  const listRef = useRef(null);
  const isMetres = mode === 'metres';
  // Lignes (sélections puis calques) construites et ajustées par le parent (source unique).
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Sous-ensemble propre au volet : à gauche (metres) les sélections + les calques ASSOCIÉS à un
  // article ; à droite (layers) les calques NON associés. Un calque associé « migre » vers le volet
  // Métrés → jamais de doublon entre les deux volets.
  const baseRows = useMemo(() => (isMetres
    ? rows.filter((row) => row.isSelection || mappings[row.id])
    : rows.filter((row) => !row.isSelection && !mappings[row.id])), [isMetres, rows, mappings]);
  const metricCounts = useMemo(() => {
    const counts = { length: 0, area: 0, count: 0 };
    for (const row of baseRows) { if (counts[row.metric] != null) counts[row.metric] += 1; }
    return counts;
  }, [baseRows]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const activeMetrics = Object.keys(metricFilters).filter((m) => metricFilters[m]);
    return baseRows.filter((row) => {
      if (mappedOnly && !mappings[row.id]) return false;
      if (activeMetrics.length && !metricFilters[row.metric]) return false;
      return !query || row.layer.toLowerCase().includes(query) || row.metric.includes(query);
    });
  }, [mappedOnly, mappings, metricFilters, baseRows, search]);
  const measurementUnits = useMemo(() => Array.from(new Set([
    'ml', 'm²', 'u',
    ...projectItems.map((item) => String(item.unit || '').trim()).filter(Boolean),
  ])), [projectItems]);

  // Objet cliqué dans l'aperçu → réinitialise les filtres, surligne et défile jusqu'au calque.
  // Action « calque » → seul le volet Calques (layers) y réagit ; le volet Métrés reste intact.
  useEffect(() => {
    if (mode !== 'layers' || !pick?.layer) return undefined;
    setSearch('');
    setMappedOnly(false);
    setMetricFilters({ length: false, area: false, count: false });
    setFlashLayer(pick.layer);
    if (!rowsRef.current.some((row) => row.layer === pick.layer)) {
      toast.info(`Calque « ${pick.layer} » isolé — aucun métré mesurable sur ce calque.`);
    }
    const timer = setTimeout(() => setFlashLayer(''), 1400);
    return () => clearTimeout(timer);
  }, [pick, mode]);

  useEffect(() => {
    if (flashLayer && listRef.current) {
      const target = listRef.current.querySelector(`[data-dxf-row-layer="${CSS.escape(flashLayer)}"]`);
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [flashLayer]);

  const updateMapping = (rowId, patch) => {
    onMappingsChange((previous) => ({
      ...previous,
      [rowId]: { ...(previous[rowId] || { itemId: '', coefficient: 1 }), ...patch },
    }));
  };

  const removeMapping = (rowId) => {
    onMappingsChange((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  };

  const selectDqeItem = (itemId) => {
    const item = projectItems.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) {
      setDraft((previous) => ({ ...previous, itemId: '' }));
      return;
    }
    const unit = item.unit || 'u';
    setDraft({
      itemId: String(item.id),
      label: item.designation || 'Nouveau métré',
      metric: inferMetricFromUnit(unit),
      unit,
    });
  };

  const createMeasurement = () => {
    const label = draft.label.trim();
    if (!label) {
      toast.warning('Saisissez un nom pour le métré.');
      return;
    }
    onCreateMeasurement({ ...draft, label });
    setDraft({ itemId: '', label: '', metric: 'length', unit: 'ml' });
    setCreateOpen(false);
  };

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
        {mode === 'metres'
          ? 'Vos métrés apparaîtront ici après analyse du fichier.'
          : 'Les calques mesurables apparaîtront ici après analyse du fichier.'}
      </div>
    );
  }

  const metadata = summary.metadata || {};
  const displayedRows = visibleRows.slice(0, 150);
  const visibleCount = visibleRows.length;
  const presentMetrics = ['length', 'area', 'count'].filter((m) => metricCounts[m] > 0);

  // Gestionnaire de calques (volet layers) : actions globales de visibilité.
  // Consts simples (PAS de hook : on est après le early return `if (!summary)`).
  const hiddenSet = hiddenLayers || null;
  const allLayerNames = [...new Set(baseRows.map((row) => row.layer))];
  const filteredLayerNames = [...new Set(visibleRows.map((row) => row.layer))];
  const hasActiveFilter = search.trim() !== '' || mappedOnly || Object.values(metricFilters).some(Boolean);
  const hasHiddenOrIsolated = (hiddenSet?.size || 0) > 0 || Boolean(isolatedLayer);
  const allHidden = allLayerNames.length > 0 && allLayerNames.every((name) => hiddenSet?.has(name));

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-gray-200 p-3">
        {!isMetres && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">
            <span><span className="font-bold text-gray-900">{summary.layers?.length || 0}</span> calques</span>
            <span className="text-gray-300">·</span>
            <span><span className="font-bold text-gray-900">{Number(metadata.parsedEntityTotal || 0).toLocaleString('fr-FR')}</span> entités</span>
            {metadata.proxyEntityCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600"><span className="font-bold">{Number(metadata.proxyEntityCount).toLocaleString('fr-FR')}</span> proxy</span>
              </>
            )}
          </div>
        )}

        {!isMetres && metadata.proxyEntityCount > 0 && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] leading-snug text-amber-800">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            <span>{metadata.proxyEntityCount} objet(s) Covadis/AutoCAD (proxy) non métrés automatiquement.</span>
          </div>
        )}

        {isMetres && (
          <div className="flex items-center gap-2">
            <label htmlFor="dxf-unit" className="text-[11px] font-semibold text-gray-600">Unité du dessin</label>
            <select
              id="dxf-unit"
              value={String(scaleToMeters)}
              onChange={(event) => onScaleChange(Number(event.target.value))}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-400"
            >
              {UNIT_SCALE_OPTIONS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
            </select>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isMetres ? 'Rechercher un métré…' : 'Rechercher un calque…'}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </div>
          {isMetres && (
            <button
              type="button"
              onClick={() => setMappedOnly((value) => !value)}
              className={`rounded-xl border px-3 text-[11px] font-semibold ${mappedOnly ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              Associés
            </button>
          )}
        </div>

        {presentMetrics.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="self-center text-[10px] font-semibold text-gray-400">Type :</span>
            {presentMetrics.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetricFilters((previous) => ({ ...previous, [m]: !previous[m] }))}
                title={`Filtrer sur ${METRIC_LABELS[m].label.toLowerCase()} (${METRIC_LABELS[m].unit})`}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${metricFilters[m] ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {METRIC_LABELS[m].label} · {metricCounts[m]}
              </button>
            ))}
          </div>
        )}

        {/* Gestionnaire de calques : actions globales de visibilité (volet Calques) */}
        {!isMetres && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="self-center text-[10px] font-semibold text-gray-400">Calques :</span>
            <button
              type="button"
              onClick={onShowAllLayers}
              disabled={!hasHiddenOrIsolated}
              title="Réafficher tous les calques (annule masquages et isolation)"
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${hasHiddenOrIsolated ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-gray-100 text-gray-300 cursor-not-allowed'}`}
            >
              <Eye size={12} /> Tout afficher
            </button>
            <button
              type="button"
              onClick={() => onHideLayers(allLayerNames)}
              disabled={allHidden}
              title="Masquer tous les calques (repartir d’un plan vide)"
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${allHidden ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <EyeOff size={12} /> Tout masquer
            </button>
            {hasActiveFilter && filteredLayerNames.length > 0 && (
              <button
                type="button"
                onClick={() => onHideLayers(filteredLayerNames)}
                title="Masquer les calques du résultat filtré (ex. tout le cadastre « CAD_ »)"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
              >
                <EyeOff size={12} /> Masquer les résultats
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col">
        {(() => {
          const cards = displayedRows.map((row) => {
            const mapping = mappings[row.id];
            const metric = {
              ...METRIC_LABELS[row.metric],
              unit: row.unit || METRIC_LABELS[row.metric].unit,
            };
            const coefficient = Number(mapping?.coefficient ?? 1);
            const selectedItem = projectItems.find((item) => String(item.id) === String(mapping?.itemId));
            const spec = selectedItem ? takeoffGeoSpec(metric.unit, selectedItem.unit) : null;
            const needsGeo = !!(spec && (spec.needsLargeur || spec.needsEpaisseur || spec.needsDensity));
            const conversion = selectedItem ? takeoffConversionFactor(metric.unit, selectedItem.unit, mapping) : 1;
            const appliedQuantity = row.quantity * (Number.isFinite(coefficient) ? coefficient : 0) * conversion;
            // Incompatible seulement si l'unité ne matche PAS et n'est PAS convertible géométriquement.
            const incompatible = selectedItem && !isUnitCompatible(row.metric, selectedItem.unit) && !needsGeo;
            const targetUnit = needsGeo && selectedItem ? selectedItem.unit : metric.unit;
            const isSelection = Boolean(row.isSelection);
            const isManual = Boolean(row.isManual);
            const isLayerRow = !isSelection;
            const layerHidden = isLayerRow && Boolean(hiddenSet?.has(row.layer));
            const isIsolated = isLayerRow && isolatedLayer === row.layer;
            const isEditing = isSelection && editingSelectionId === row.selectionId;
            const highlightHidden = isSelection && Boolean(row.highlightHidden);
            const hasAdjustment = Number.isFinite(row.adjustment) && row.adjustment !== 0;
            const adjustOpen = adjustingRowId === row.id;
            let rowTone = mapping ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white';
            if (isSelection && !mapping) rowTone = 'border-orange-200 bg-orange-50/30';
            if (flashLayer === row.layer && !isSelection) rowTone = 'border-amber-400 bg-amber-50 ring-2 ring-amber-300';
            if (isIsolated) rowTone = 'border-blue-300 bg-blue-50 ring-1 ring-blue-200';
            if (isEditing) rowTone = 'border-orange-400 bg-orange-50 ring-2 ring-orange-300';

            return (
              <div
                key={row.id}
                data-dxf-row-layer={isSelection ? undefined : row.layer}
                onMouseEnter={isLayerRow ? () => onSetHoverLayer(row.layer) : undefined}
                onMouseLeave={isLayerRow ? () => onSetHoverLayer('') : undefined}
                className={`relative rounded-xl border p-2 transition-colors ${rowTone} ${layerHidden ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-1.5">
                  {isSelection && !isManual && (
                    <button
                      type="button"
                      onClick={() => onToggleSelectionVisibility(row.selectionId)}
                      title={highlightHidden ? 'Afficher la surépaisseur' : 'Masquer la surépaisseur'}
                      className={`mt-0.5 rounded-md p-1 ${highlightHidden ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white'}`}
                    >
                      {highlightHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                  {isLayerRow && (
                    <>
                      <button
                        type="button"
                        onClick={() => onToggleLayerHidden(row.layer)}
                        title={layerHidden ? 'Afficher ce calque' : 'Masquer ce calque'}
                        aria-label={layerHidden ? 'Afficher ce calque' : 'Masquer ce calque'}
                        className={`mt-0.5 rounded-md p-1 ${layerHidden ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-500 hover:text-blue-600'}`}
                      >
                        {layerHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onIsolateLayer(isIsolated ? '' : row.layer)}
                        title={isIsolated ? 'Afficher tous les calques' : 'Isoler ce calque (masquer tous les autres)'}
                        aria-label={isIsolated ? 'Afficher tous les calques' : 'Isoler ce calque'}
                        className={`mt-0.5 rounded-md p-1 ${isIsolated ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-blue-600'}`}
                      >
                        <Focus size={13} />
                      </button>
                    </>
                  )}
                  {isSelection && (
                    <div className="relative mt-0.5">
                      <button
                        type="button"
                        onClick={() => setColorPickerRowId((current) => (current === row.id ? '' : row.id))}
                        title="Modifier la couleur de ce métré"
                        aria-label={`Couleur du métré ${row.layer}`}
                        className="h-[21px] w-[21px] rounded-md border-2 border-white shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-110"
                        style={{ backgroundColor: row.highlightColor || '#f97316' }}
                      />
                      {colorPickerRowId === row.id && (
                        <div
                          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm"
                          onClick={() => setColorPickerRowId('')}
                          role="presentation"
                        >
                          <div
                            className="max-h-[min(620px,85vh)] w-full max-w-sm space-y-2 overflow-y-auto rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-label={`Couleur du métré ${row.layer}`}
                          >
                          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                            <div>
                              <p className="text-xs font-bold text-gray-900">Couleur du métré</p>
                              <p className="max-w-[220px] truncate text-[10px] text-gray-500">{row.layer}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectionColorChange(row.selectionId, '');
                                setColorPickerRowId('');
                              }}
                              className="rounded-md bg-gray-100 px-2 py-1 text-[9px] font-bold text-gray-600 hover:bg-gray-200"
                            >
                              Couleur auto
                            </button>
                          </div>
                          {MEASUREMENT_COLOR_GROUPS.map((group) => (
                            <div key={group.id}>
                              <p className={`mb-1 text-[9px] font-bold uppercase tracking-wide ${group.isNetwork ? 'text-blue-700' : 'text-gray-400'}`}>{group.label}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {group.options.map((option) => (
                                  <button
                                    key={option.color}
                                    type="button"
                                    onClick={() => {
                                      onSelectionColorChange(row.selectionId, option.color);
                                      setColorPickerRowId('');
                                    }}
                                    aria-label={`Choisir ${option.label}`}
                                    title={option.label}
                                    className={`h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110 ${row.highlightColor === option.color ? 'border-gray-900' : 'border-white'}`}
                                    style={{ backgroundColor: option.color }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {isSelection ? (
                      // Nom éditable en place : Entrée/blur = renommer, Échap = annuler.
                      // La clé force le resync du defaultValue si le libellé change ailleurs.
                      <input
                        key={`${row.selectionId}::${row.layer}`}
                        type="text"
                        defaultValue={row.layer}
                        title="Renommer la sélection"
                        maxLength={80}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') {
                            event.stopPropagation(); // ne pas quitter le mode sélection de l'aperçu
                            event.currentTarget.value = row.layer;
                            event.currentTarget.blur();
                          }
                        }}
                        onBlur={(event) => {
                          const value = event.target.value.trim();
                          if (value && value !== row.layer) onRenameSelection(row.selectionId, value);
                          else event.target.value = row.layer;
                        }}
                        className="-mx-1 w-full truncate rounded-md border border-transparent bg-transparent px-1 text-[11px] font-semibold text-gray-800 outline-none hover:border-gray-200 focus:border-blue-400 focus:bg-white"
                      />
                    ) : (
                      <p className="truncate text-[11px] font-semibold text-gray-800" title={row.layer}>{row.layer}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {isSelection && !isManual && (
                        <span className="rounded bg-orange-100 px-1 py-0.5 text-[8px] font-bold uppercase text-orange-600">
                          {row.entityCount} élém.
                        </span>
                      )}
                      <span className="rounded bg-gray-100 px-1 py-0.5 text-[8px] font-bold uppercase text-gray-500">{metric.label}</span>
                      <span className="text-[11px] font-bold text-blue-700">{formatQuantity(row.quantity)} {metric.unit}</span>
                      {hasAdjustment && (
                        <span
                          className="rounded bg-purple-100 px-1 py-0.5 text-[8px] font-bold text-purple-700"
                          title={`Mesuré ${formatQuantity(row.baseQuantity)} ${metric.unit} · correction ${row.adjustment > 0 ? '+' : ''}${formatQuantity(row.adjustment)} ${metric.unit}`}
                        >
                          {row.adjustment > 0 ? '+' : ''}{formatQuantity(row.adjustment)}
                        </span>
                      )}
                      {isEditing && <span className="text-[8px] font-semibold text-orange-600">édition sur le plan…</span>}
                      {row.approximateCount > 0 && <span className="text-[8px] text-amber-600">approx.</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdjustingRowId((current) => (current === row.id ? '' : row.id))}
                    title="Corriger la quantité (+/−)"
                    className={`rounded-md p-1 ${adjustOpen || hasAdjustment ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:bg-gray-100 hover:text-purple-600'}`}
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                  {isSelection && (
                    <button
                      type="button"
                      onClick={() => onEditSelection(row.selectionId)}
                      title="Modifier les éléments sur le plan"
                      className={`rounded-md p-1 ${isEditing ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-orange-50 hover:text-orange-600'}`}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {!mapping ? (
                    <button
                      type="button"
                      onClick={() => updateMapping(row.id, {})}
                      className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-gray-700"
                    >
                      <Plus size={11} /> Associer
                    </button>
                  ) : (
                    <button type="button" onClick={() => removeMapping(row.id)} className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Retirer l’association">
                      <Trash2 size={13} />
                    </button>
                  )}
                  {isSelection && (
                    <button
                      type="button"
                      onClick={() => onDeleteSelection(row.selectionId)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="Supprimer cette sélection"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {adjustOpen && (
                  <div className="mt-1.5 flex items-center gap-2 border-t border-purple-100 pt-1.5">
                    <SlidersHorizontal size={13} className="shrink-0 text-purple-500" />
                    <span className="text-[10px] font-medium text-gray-500">Corriger&nbsp;:</span>
                    <span className="text-[10px] text-gray-400">{formatQuantity(row.baseQuantity ?? row.quantity)} {metric.unit}</span>
                    <span className="text-[10px] font-medium text-gray-400">+</span>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustments[row.id] ?? ''}
                      onChange={(event) => onAdjustmentChange(row.id, event.target.value)}
                      placeholder="0"
                      title="Quantité à ajouter (positif) ou retrancher (négatif)"
                      className="w-20 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-right text-[11px] font-semibold outline-none focus:border-purple-400"
                    />
                    <span className="text-[10px] text-gray-400">{metric.unit}</span>
                    <span className="ml-auto shrink-0 text-[11px] font-bold text-gray-700">= {formatQuantity(row.quantity)} {metric.unit}</span>
                  </div>
                )}

                {mapping && (
                  <div className="mt-1.5 border-t border-blue-100 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <Link2 size={13} className="shrink-0 text-blue-500" />
                      <select
                        value={mapping.itemId || ''}
                        onChange={(event) => updateMapping(row.id, { itemId: event.target.value })}
                        className={`min-w-0 flex-1 rounded-lg border bg-white px-2 py-1 text-[11px] outline-none ${incompatible ? 'border-amber-300' : 'border-gray-200 focus:border-blue-400'}`}
                      >
                        <ProjectItemOptions items={projectItems} metric={row.metric} />
                      </select>
                      <span className="text-[10px] font-medium text-gray-400">×</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mapping.coefficient ?? 1}
                        onChange={(event) => updateMapping(row.id, { coefficient: event.target.value })}
                        title="Coefficient (multiplicateur général)"
                        className="w-14 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-right text-[11px] font-semibold outline-none focus:border-blue-400"
                      />
                    </div>

                    {needsGeo && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[20px]">
                        {spec.needsLargeur && (
                          <GeoInput label="Larg. (m)" value={mapping.largeur} onChange={(v) => updateMapping(row.id, { largeur: v })} />
                        )}
                        {spec.needsEpaisseur && (
                          <GeoInput label="Ép. (m)" value={mapping.epaisseur} onChange={(v) => updateMapping(row.id, { epaisseur: v })} />
                        )}
                        {spec.needsDensity && (
                          <GeoInput label="Densité" value={mapping.densite} onChange={(v) => updateMapping(row.id, { densite: v })} />
                        )}
                        <GeoInput label="Perte %" value={mapping.perte} step="1" placeholder="0" onChange={(v) => updateMapping(row.id, { perte: v })} />
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-between gap-2 pl-[20px]">
                      {(() => {
                        if (incompatible) return <span className="truncate text-[9px] font-medium text-amber-700">Unité {selectedItem.unit} ≠ {metric.unit}</span>;
                        if (needsGeo) return <span className="text-[9px] font-medium text-blue-600">Conversion {metric.unit} → {selectedItem.unit}</span>;
                        return <span className="text-[9px] text-gray-400">Coefficient ×</span>;
                      })()}
                      <span className="shrink-0 text-[11px] font-bold text-gray-700">→ {formatQuantity(appliedQuantity)} {targetUnit}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          });
          return (
            <>
              <div className={`flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2 ${isMetres ? 'bg-orange-50/60' : 'bg-gray-50/80'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isMetres ? 'text-orange-700' : 'text-gray-600'}`}>
                  {isMetres ? 'Métrés réalisés' : 'Calques du dessin'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold ${isMetres ? 'text-orange-600' : 'text-gray-500'}`}>{visibleCount}</span>
                  {isMetres && (
                    <button
                      type="button"
                      onClick={() => setCreateOpen((value) => !value)}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-orange-700"
                    >
                      {createOpen ? <X size={11} /> : <Plus size={11} />}{createOpen ? 'Fermer' : 'Créer'}
                    </button>
                  )}
                  {!isMetres && onCollapse && (
                    <button
                      type="button"
                      onClick={onCollapse}
                      title="Replier le volet des calques"
                      aria-label="Replier le volet des calques"
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                    >
                      <PanelRightClose size={15} />
                    </button>
                  )}
                </div>
              </div>
              {isMetres && createOpen && (
                <div className="shrink-0 space-y-2 border-b border-orange-200 bg-orange-50 p-2.5">
                  <select
                    value={draft.itemId}
                    onChange={(event) => selectDqeItem(event.target.value)}
                    className="w-full rounded-lg border border-orange-200 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-700 outline-none focus:border-orange-400"
                  >
                    <option value="">Ligne vierge — sans article DQE</option>
                    {projectItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.designation} [{item.unit || '—'}]</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-[1fr_92px_72px] gap-1.5">
                    <input
                      value={draft.label}
                      onChange={(event) => setDraft((previous) => ({ ...previous, label: event.target.value }))}
                      placeholder="Nom du métré"
                      maxLength={80}
                      className="min-w-0 rounded-lg border border-orange-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-orange-400"
                    />
                    <select
                      value={draft.metric}
                      onChange={(event) => setDraft((previous) => ({
                        ...previous,
                        metric: event.target.value,
                        unit: event.target.value === 'length' ? 'ml' : event.target.value === 'area' ? 'm²' : 'u',
                      }))}
                      className="rounded-lg border border-orange-200 bg-white px-1.5 py-1.5 text-[11px] outline-none focus:border-orange-400"
                    >
                      <option value="length">Longueur</option>
                      <option value="area">Surface</option>
                      <option value="count">Comptage</option>
                    </select>
                    <select
                      value={draft.unit}
                      onChange={(event) => setDraft((previous) => ({ ...previous, unit: event.target.value }))}
                      className="rounded-lg border border-orange-200 bg-white px-1.5 py-1.5 text-[11px] outline-none focus:border-orange-400"
                    >
                      {measurementUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-orange-700">La quantité se renseigne ensuite avec le bouton de correction.</span>
                    <button type="button" onClick={createMeasurement} className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-gray-700">
                      Créer le métré
                    </button>
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="space-y-1.5">{cards}</div>
                {visibleCount > 150 && <p className="py-3 text-center text-[10px] text-gray-400">Affinez la recherche pour voir {isMetres ? 'les autres métrés' : 'les autres calques'}.</p>}
                {visibleCount === 0 && (
                  <p className="py-8 text-center text-xs text-gray-400">{isMetres ? 'Aucun métré réalisé sur le dessin.' : 'Aucun calque mesurable.'}</p>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

DxfMappingPanel.propTypes = {
  mode: PropTypes.oneOf(['metres', 'layers']),
  onCollapse: PropTypes.func,
  summary: PropTypes.object,
  rows: PropTypes.arrayOf(PropTypes.object),
  projectItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  mappings: PropTypes.object.isRequired,
  onMappingsChange: PropTypes.func.isRequired,
  scaleToMeters: PropTypes.number.isRequired,
  onScaleChange: PropTypes.func.isRequired,
  isolatedLayer: PropTypes.string,
  onIsolateLayer: PropTypes.func.isRequired,
  hiddenLayers: PropTypes.instanceOf(Set),
  onToggleLayerHidden: PropTypes.func,
  onShowAllLayers: PropTypes.func,
  onHideLayers: PropTypes.func,
  onSetHoverLayer: PropTypes.func,
  pick: PropTypes.shape({ layer: PropTypes.string, nonce: PropTypes.number }),
  onDeleteSelection: PropTypes.func,
  onRenameSelection: PropTypes.func,
  onEditSelection: PropTypes.func,
  editingSelectionId: PropTypes.string,
  adjustments: PropTypes.object,
  onAdjustmentChange: PropTypes.func,
  onToggleSelectionVisibility: PropTypes.func,
  onSelectionColorChange: PropTypes.func,
  onCreateMeasurement: PropTypes.func,
};
