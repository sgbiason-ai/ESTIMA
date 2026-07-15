import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle, Eye, EyeOff, Link2, Plus, Search, Trash2,
} from 'lucide-react';
import { buildMeasurementRows, METRIC_LABELS } from '../../utils/takeoff/dxfTakeoff';
import { isUnitCompatible } from '../../utils/takeoff/applyTakeoff';
import { toast } from '../../utils/globalUI';

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

export default function DxfMappingPanel({
  summary,
  projectItems,
  mappings,
  onMappingsChange,
  scaleToMeters,
  onScaleChange,
  isolatedLayer,
  onIsolateLayer,
  pick,
}) {
  const [search, setSearch] = useState('');
  const [mappedOnly, setMappedOnly] = useState(false);
  const [flashLayer, setFlashLayer] = useState('');
  const listRef = useRef(null);
  const rows = useMemo(() => buildMeasurementRows(summary, scaleToMeters), [summary, scaleToMeters]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (mappedOnly && !mappings[row.id]) return false;
      return !query || row.layer.toLowerCase().includes(query) || row.metric.includes(query);
    });
  }, [mappedOnly, mappings, rows, search]);

  // Objet cliqué dans l'aperçu → réinitialise les filtres, surligne et défile jusqu'au calque
  useEffect(() => {
    if (!pick?.layer) return undefined;
    setSearch('');
    setMappedOnly(false);
    setFlashLayer(pick.layer);
    if (!rowsRef.current.some((row) => row.layer === pick.layer)) {
      toast.info(`Calque « ${pick.layer} » isolé — aucun métré mesurable sur ce calque.`);
    }
    const timer = setTimeout(() => setFlashLayer(''), 1400);
    return () => clearTimeout(timer);
  }, [pick]);

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

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
        Les calques mesurables apparaîtront ici après analyse du fichier.
      </div>
    );
  }

  const metadata = summary.metadata || {};
  const displayedRows = visibleRows.slice(0, 150);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-gray-200 p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gray-50 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Calques</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{summary.layers?.length || 0}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Entités</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{metadata.parsedEntityTotal || 0}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Objets proxy</p>
            <p className={`mt-0.5 text-lg font-bold ${metadata.proxyEntityCount ? 'text-amber-600' : 'text-gray-900'}`}>
              {metadata.proxyEntityCount || 0}
            </p>
          </div>
        </div>

        {metadata.proxyEntityCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {metadata.proxyEntityCount} objet(s) propriétaire(s) Covadis/AutoCAD ne sont pas métrés automatiquement.
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
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

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un calque…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setMappedOnly((value) => !value)}
            className={`rounded-xl border px-3 text-[11px] font-semibold ${mappedOnly ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            Associés
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="space-y-2">
          {displayedRows.map((row) => {
            const mapping = mappings[row.id];
            const metric = METRIC_LABELS[row.metric];
            const coefficient = Number(mapping?.coefficient ?? 1);
            const appliedQuantity = row.quantity * (Number.isFinite(coefficient) ? coefficient : 0);
            const selectedItem = projectItems.find((item) => String(item.id) === String(mapping?.itemId));
            const incompatible = selectedItem && !isUnitCompatible(row.metric, selectedItem.unit);
            let rowTone = mapping ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white';
            if (flashLayer === row.layer) rowTone = 'border-amber-400 bg-amber-50 ring-2 ring-amber-300';

            return (
              <div key={row.id} data-dxf-row-layer={row.layer} className={`rounded-2xl border p-3 transition-colors ${rowTone}`}>
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onIsolateLayer(isolatedLayer === row.layer ? '' : row.layer)}
                    title={isolatedLayer === row.layer ? 'Afficher tous les calques' : 'Isoler ce calque'}
                    className={`mt-0.5 rounded-lg p-1.5 ${isolatedLayer === row.layer ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-blue-600'}`}
                  >
                    {isolatedLayer === row.layer ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-800" title={row.layer}>{row.layer}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-500">{metric.label}</span>
                      <span className="text-xs font-bold text-blue-700">{formatQuantity(row.quantity)} {metric.unit}</span>
                      {row.approximateCount > 0 && <span className="text-[9px] text-amber-600">approx.</span>}
                    </div>
                  </div>
                  {!mapping ? (
                    <button
                      type="button"
                      onClick={() => updateMapping(row.id, {})}
                      className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-gray-700"
                    >
                      <Plus size={12} /> Associer
                    </button>
                  ) : (
                    <button type="button" onClick={() => removeMapping(row.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Retirer l’association">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {mapping && (
                  <div className="mt-3 space-y-2 border-t border-blue-100 pt-3">
                    <div className="flex items-center gap-2">
                      <Link2 size={14} className="shrink-0 text-blue-500" />
                      <select
                        value={mapping.itemId || ''}
                        onChange={(event) => updateMapping(row.id, { itemId: event.target.value })}
                        className={`min-w-0 flex-1 rounded-xl border bg-white px-2.5 py-2 text-[11px] outline-none ${incompatible ? 'border-amber-300' : 'border-gray-200 focus:border-blue-400'}`}
                      >
                        <ProjectItemOptions items={projectItems} metric={row.metric} />
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pl-[22px]">
                      <label className="text-[10px] font-medium text-gray-500">Coefficient</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mapping.coefficient ?? 1}
                        onChange={(event) => updateMapping(row.id, { coefficient: event.target.value })}
                        className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-xs font-semibold outline-none focus:border-blue-400"
                      />
                      <span className="ml-auto text-[11px] font-bold text-gray-700">→ {formatQuantity(appliedQuantity)} {metric.unit}</span>
                    </div>
                    {incompatible && (
                      <p className="pl-[22px] text-[10px] font-medium text-amber-700">L’unité de l’article ({selectedItem.unit}) ne correspond pas à {metric.unit}.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visibleRows.length > displayedRows.length && (
          <p className="py-4 text-center text-[11px] text-gray-400">
            {visibleRows.length - displayedRows.length} résultat(s) supplémentaires — affinez la recherche.
          </p>
        )}
        {visibleRows.length === 0 && <p className="py-12 text-center text-sm text-gray-400">Aucun calque mesurable trouvé.</p>}
      </div>
    </div>
  );
}

DxfMappingPanel.propTypes = {
  summary: PropTypes.object,
  projectItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  mappings: PropTypes.object.isRequired,
  onMappingsChange: PropTypes.func.isRequired,
  scaleToMeters: PropTypes.number.isRequired,
  onScaleChange: PropTypes.func.isRequired,
  isolatedLayer: PropTypes.string,
  onIsolateLayer: PropTypes.func.isRequired,
  pick: PropTypes.shape({ layer: PropTypes.string, nonce: PropTypes.number }),
};
