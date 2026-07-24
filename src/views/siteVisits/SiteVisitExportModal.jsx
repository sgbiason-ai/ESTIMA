// src/views/siteVisits/SiteVisitExportModal.jsx
// Modale d'export PDF d'une visite — choix des vues cartographiques (vignettes
// d'observation + carte pleine page), memorisees en localStorage.
// Partagee desktop / mobile.

import React, { useState } from 'react';
import { X, FileDown, Layers, Map as MapIcon, FileImage } from 'lucide-react';
import {
  PDF_MAP_VIEWS, PDF_OVERVIEW_VIEWS, DEFAULT_PDF_VIEWS,
  buildTileUrl, lng2tileX, lat2tileY,
} from '../../utils/ignTiles';

const LS_KEY = 'estima:siteVisit:pdfViews';
const PREVIEW_ZOOM = 16;

/** Preferences d'export memorisees (valeurs inconnues → defauts historiques). */
const loadPdfViewPrefs = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return {
      obs: PDF_MAP_VIEWS[raw.obs] ? raw.obs : DEFAULT_PDF_VIEWS.obs,
      overview: PDF_OVERVIEW_VIEWS[raw.overview] ? raw.overview : DEFAULT_PDF_VIEWS.overview,
      plans: raw.plans !== false, // inclure les plans annotés (défaut : oui)
    };
  } catch { return { ...DEFAULT_PDF_VIEWS, plans: true }; }
};

const savePdfViewPrefs = (prefs) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* quota/private mode */ }
};

// Position representative de la visite, pour afficher un apercu reel du calque
const visitAnchor = (visit) => {
  const coords = (visit?.gpsTracking?.coordinates || []).filter(c => !c.break);
  if (coords.length > 0) return { lat: coords[0].lat, lng: coords[0].lng };
  for (const obs of (visit?.observations || [])) {
    if (obs.segmentFrom?.lat != null) return { lat: obs.segmentFrom.lat, lng: obs.segmentFrom.lng };
    if (obs.pointLocation?.lat != null) return { lat: obs.pointLocation.lat, lng: obs.pointLocation.lng };
    for (const img of (obs.images || [])) {
      if (typeof img === 'object' && img?.lat != null) return { lat: img.lat, lng: img.lng };
    }
  }
  return null;
};

// Apercu : la tuile IGN reelle du lieu de la visite, calques empiles
function TileThumb({ stack, anchor }) {
  if (!anchor) return <div className="w-full h-full bg-gray-100" />;
  const x = lng2tileX(anchor.lng, PREVIEW_ZOOM);
  const y = lat2tileY(anchor.lat, PREVIEW_ZOOM);
  return (
    <div className="relative w-full h-full bg-gray-100">
      {stack.map(key => (
        <img
          key={key}
          src={buildTileUrl(key, PREVIEW_ZOOM, x, y)}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ))}
    </div>
  );
}

function ViewOption({ viewKey, view, selected, onSelect, anchor }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(viewKey)}
      className={`text-left rounded-2xl border overflow-hidden transition active:scale-[0.98] ${
        selected
          ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/50'
          : 'border-gray-200/60 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="h-16 flex gap-0.5">
        {(view.dual || [view.stack]).map((stack, i) => (
          <div key={i} className="flex-1 overflow-hidden">
            <TileThumb stack={stack} anchor={anchor} />
          </div>
        ))}
      </div>
      <div className="px-2.5 py-2">
        <div className={`text-xs font-semibold ${selected ? 'text-blue-700' : 'text-gray-800'}`}>{view.label}</div>
        <div className="text-[10px] text-gray-400 leading-tight">{view.hint}</div>
      </div>
    </button>
  );
}

export default function SiteVisitExportModal({ isOpen, onClose, visit, onExport }) {
  const [prefs, setPrefs] = useState(loadPdfViewPrefs);
  if (!isOpen) return null;

  const anchor = visitAnchor(visit);
  const hasOverview = (visit?.gpsTracking?.coordinates?.length || 0) > 0;

  const handleExport = () => {
    savePdfViewPrefs(prefs);
    onClose();
    onExport({ obsMapView: prefs.obs, overviewMapView: prefs.overview, includePlans: prefs.plans });
  };

  const sectionLabel = "flex items-center gap-1.5 text-[11px] text-gray-500 font-medium mb-2";

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-modal flex items-center justify-center p-3" onMouseDown={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-[460px] max-w-full max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50"><FileDown size={18} className="text-blue-600" /></div>
            <h3 className="text-sm font-bold text-gray-900">Export PDF de la visite</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition"><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className={sectionLabel}><Layers size={11} /> Vignettes des observations</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PDF_MAP_VIEWS).map(([key, view]) => (
                <ViewOption
                  key={key} viewKey={key} view={view} anchor={anchor}
                  selected={prefs.obs === key}
                  onSelect={(k) => setPrefs(p => ({ ...p, obs: k }))}
                />
              ))}
            </div>
          </div>

          {hasOverview && (
            <div>
              <label className={sectionLabel}><MapIcon size={11} /> Carte pleine page (vue d'ensemble)</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PDF_OVERVIEW_VIEWS).map(([key, view]) => (
                  <ViewOption
                    key={key} viewKey={key} view={view} anchor={anchor}
                    selected={prefs.overview === key}
                    onSelect={(k) => setPrefs(p => ({ ...p, overview: k }))}
                  />
                ))}
              </div>
            </div>
          )}

          {(visit?.plans?.length || 0) > 0 && (
            <div>
              <label className={sectionLabel}><FileImage size={11} /> Plans annotés</label>
              <label className="flex items-center gap-2.5 rounded-2xl border border-gray-200/60 bg-white px-3 py-2.5 cursor-pointer hover:border-gray-300 transition">
                <input
                  type="checkbox"
                  checked={prefs.plans}
                  onChange={(e) => { const v = e.target.checked; setPrefs(p => ({ ...p, plans: v })); }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-gray-800">
                  Inclure les plans annotés ({visit.plans.length})
                </span>
              </label>
            </div>
          )}

          {!anchor && (
            <p className="text-[11px] text-gray-400">
              Aucune position GPS sur cette visite — les vignettes ne pourront pas être générées.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200/60 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 rounded-xl hover:bg-gray-100 transition">Annuler</button>
          <button onClick={handleExport} className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition active:scale-[0.97]">Exporter le PDF</button>
        </div>
      </div>
    </div>
  );
}
