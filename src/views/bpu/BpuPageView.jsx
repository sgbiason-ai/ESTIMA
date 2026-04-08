import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cleanText, normalizeUnitSymbol } from '../../utils/helpers';
import { lighten } from './utils/bpuBrandingUtils';
import FloatingRichToolbar from './FloatingRichToolbar';
import {
  PAGE_WIDTH_PX, PAGE_HEIGHT_PX,
  MARGIN_TOP_PX, MARGIN_BOTTOM_PX, MARGIN_X_PX,
  HEADER_HEIGHT, TABLE_HEADER_HEIGHT,
  COL_NUM_WIDTH, COL_DESC_WIDTH, COL_UNIT_WIDTH, COL_PRICE_WIDTH,
} from './constants/bpuLayout';

/**
 * BpuPageView
 * Zone scrollable affichant les pages A4 générées par useBpuPagination.
 * Gère l'édition inline (désignation + description rich text) via contentEditable
 * et la FloatingRichToolbar.
 */
const BpuPageView = ({
  pages,
  project,
  branding,
  resolvedLogo,
  onLogoError,
  zoom,
  unitResolver,
  setProject,
  saveOverride,
  resetOverride,
}) => {
  const [activeDescItemId, setActiveDescItemId] = useState(null);
  const [activeDescItem, setActiveDescItem]     = useState(null);
  const activeDescRef = useRef(null);

  const today = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="flex-1 overflow-auto bg-slate-200/50 print:p-0 print:overflow-visible">
      {/* Wrapper zoomable */}
      <div
        className="flex flex-col items-center py-8 print:py-0"
        style={{
          transformOrigin: 'top center',
          transform: `scale(${zoom})`,
          minHeight: zoom < 1 ? `${100 / zoom}%` : undefined,
        }}
      >
        {/* État vide — pagination en cours */}
        {pages.length === 0 && (
          <div className="mt-20 flex flex-col items-center text-slate-400 animate-pulse">
            <Loader2 size={48} className="animate-spin mb-4 text-slate-300" />
            <span className="font-bold text-sm uppercase tracking-widest">Calcul de la mise en page...</span>
          </div>
        )}

        {/* Pages A4 */}
        {pages.map((page, i) => (
          <div
            key={i}
            className="bpu-page-to-pdf bg-white shadow-2xl mb-8 relative print:shadow-none print:mb-0 print:break-after-page overflow-hidden shrink-0 flex flex-col"
            style={{
              width: `${PAGE_WIDTH_PX}px`, height: `${PAGE_HEIGHT_PX}px`,
              paddingTop: `${MARGIN_TOP_PX}px`, paddingBottom: `${MARGIN_BOTTOM_PX}px`,
              paddingLeft: `${MARGIN_X_PX}px`, paddingRight: `${MARGIN_X_PX}px`,
            }}
          >
            {/* ── EN-TÊTE DE PAGE ─────────────────────────────────────────── */}
            <div className="mb-4 relative flex flex-col justify-between" style={{ height: `${HEADER_HEIGHT}px` }}>
              <div className="flex justify-between items-start h-[155px] pb-2">
                {/* Titre projet */}
                <div className="flex-1 h-full flex flex-col items-center justify-center px-6 text-center">
                  <div
                    className="bg-[#ecfdf5] border px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] mb-4 shadow-sm"
                    style={{ color: branding.colors.primary, borderColor: lighten(branding.colors.primary, 0.8), backgroundColor: lighten(branding.colors.primary, 0.95) }}
                  >
                    Bordereau des Prix Unitaires
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 uppercase leading-tight tracking-tight" style={{ fontFamily: branding.fonts.headings }}>
                    {project?.name || "INTITULÉ DU PROJET"}
                  </h1>
                  <div className="w-12 h-1 mt-4 rounded-full" style={{ backgroundColor: branding.colors.secondary }} />
                </div>
                {/* Logo MOE */}
                <div className="w-[20%] h-full flex flex-col items-end justify-center">
                  {resolvedLogo ? (
                    <img src={resolvedLogo} alt="Logo" className="object-contain max-h-[70px] max-w-full" onError={onLogoError} loading="lazy" />
                  ) : (
                    <span className="text-[10px] font-black text-slate-300 uppercase">Logo manquant</span>
                  )}
                </div>
              </div>

              {/* Barre méta (phase / date / page) */}
              <div className="h-[35px] bg-slate-100 rounded-lg flex items-center justify-between px-4 text-[9px] border border-slate-200" style={{ fontFamily: branding.fonts.main }}>
                <div className="flex items-center gap-8 text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-slate-400">Phase</span>
                    <div className="font-black text-slate-900 bg-white px-2 h-5 flex items-center justify-center rounded border border-slate-200 leading-none pb-[1px]">
                      {project?.phase || "DCE"}
                    </div>
                  </div>
                  <div className="w-px h-3 bg-slate-300" />
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-slate-400">Date</span>
                    <span className="font-bold text-slate-800">{today}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase text-[8px]">Page</span>
                  <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm min-w-[40px] text-center">
                    {page.index} / {pages.length}
                  </span>
                </div>
              </div>
            </div>

            {/* ── CORPS DE PAGE ────────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 min-h-0 relative" style={{ fontFamily: branding.fonts.main }}>
              {/* En-tête colonnes */}
              {page.items.length > 0 && (
                <div
                  className="flex text-white text-[10px] font-bold uppercase text-center shrink-0 rounded-t-lg overflow-hidden"
                  style={{ height: `${TABLE_HEADER_HEIGHT}px`, backgroundColor: branding.colors.primary }}
                >
                  <div className="flex items-center justify-center border-r border-slate-600/50" style={{ width: `${COL_NUM_WIDTH}px` }}>N° Prix</div>
                  <div className="flex items-center justify-center border-r border-slate-600/50" style={{ width: `${COL_DESC_WIDTH}px` }}>Désignation des ouvrages</div>
                  <div className="flex items-center justify-center border-r border-slate-600/50" style={{ width: `${COL_UNIT_WIDTH}px` }}>U</div>
                  <div className="flex items-center justify-center" style={{ width: `${COL_PRICE_WIDTH}px` }}>P.U. HT</div>
                </div>
              )}

              {/* Lignes articles */}
              <div className="flex-col border-x border-b border-slate-200 rounded-b-lg overflow-hidden">
                {page.items.map((item, idx) => {
                  const unitLong = unitResolver(item.unit);
                  const prefix   = ['A', 'E', 'I', 'O', 'U', 'Y'].includes(unitLong.charAt(0).toUpperCase()) ? "L'" : 'LE ';
                  const displayNum = item._displayNum || '';

                  return (
                    <div key={idx} data-bpu-item-id={item.id} className="flex border-b border-slate-200 last:border-b-0 text-[10px] break-inside-avoid">
                      {/* Numéro */}
                      <div
                        className="p-3 border-r border-slate-200 bg-slate-50/50 text-center font-bold font-mono flex items-start justify-center pt-3 text-slate-600"
                        style={{ width: `${COL_NUM_WIDTH}px` }}
                      >
                        {item.isSuite ? <span className="text-[8px] text-slate-300 italic">...</span> : displayNum}
                      </div>

                      {/* Désignation + description */}
                      <div className="p-3 border-r border-slate-200 text-justify" style={{ width: `${COL_DESC_WIDTH}px` }}>
                        {/* Désignation — lecture seule */}
                        <div
                          className="font-black uppercase mb-1.5 text-[11px]"
                          style={{ color: branding.colors.text }}
                          ref={(el) => {
                            if (el) {
                              const text = item._overrideDesignation ?? cleanText(item.designation);
                              if (el.textContent !== text) el.textContent = text;
                            }
                          }}
                        />

                        {/* Description — rich text éditable */}
                        <div
                          contentEditable={!!setProject}
                          suppressContentEditableWarning
                          onFocus={() => {
                            setActiveDescItemId(item.id);
                            setActiveDescItem(item);
                          }}
                          onBlur={(e) => {
                            const descEl = e.currentTarget;
                            setTimeout(() => {
                              const active    = document.activeElement;
                              const toolbarEl = document.getElementById('bpu-floating-toolbar');
                              if (toolbarEl && toolbarEl.contains(active)) return;

                              const val      = descEl.innerHTML.trim();
                              const original = item._overrideDescription ?? item.displayDescription ?? '';
                              if (val !== original) saveOverride(item.id, 'description', val);
                              else if (item._overrideDescription !== undefined) resetOverride(item.id, 'description');

                              setActiveDescItemId(null);
                              setActiveDescItem(null);
                            }, 160);
                          }}
                          className={`html-content text-slate-600 leading-relaxed mb-2 font-medium outline-none rounded px-0.5 -mx-0.5 transition-colors ${
                            item._overrideDescription !== undefined
                              ? 'bg-amber-50 ring-1 ring-amber-300'
                              : setProject ? 'hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-300' : ''
                          }`}
                          title={setProject ? 'Cliquer pour modifier — utilisez la barre de formatage' : undefined}
                          ref={(el) => {
                            if (activeDescItemId === item.id) activeDescRef.current = el;
                            if (el && el !== document.activeElement) {
                              const html = item._overrideDescription ?? item.displayDescription ?? '';
                              if (el.innerHTML !== html) el.innerHTML = html;
                            }
                          }}
                        />

                        {/* Pied unité */}
                        {!item.isSplitStart && (
                          <div className="pt-2 border-t border-dashed border-slate-200 mt-auto flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full" style={{ backgroundColor: branding.colors.secondary }} />
                            <span className="font-bold uppercase text-slate-700 text-[9px] tracking-wide">
                              {prefix}{unitLong.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {item.isSplitStart && (
                          <div className="pt-2 border-t border-dashed border-slate-200 text-center mt-auto">
                            <span className="font-bold italic text-slate-400 text-[8px] bg-slate-50 px-2 py-0.5 rounded-full">
                              (...Suite page suivante)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Unité */}
                      <div
                        className="p-3 border-r border-slate-200 text-center font-bold uppercase flex items-center justify-center text-slate-500 bg-slate-50/30"
                        style={{ width: `${COL_UNIT_WIDTH}px` }}
                      >
                        {!item.isSuite && (normalizeUnitSymbol(item.unit) || '-')}
                      </div>

                      {/* P.U. HT (vide — rempli par l'entreprise) */}
                      <div className="p-3 bg-white" style={{ width: `${COL_PRICE_WIDTH}px` }} />
                    </div>
                  );
                })}
              </div>

              {/* Bloc signature (dernière page) */}
              {page.hasSignature && (
                <div className="mt-auto pt-6 flex justify-end items-end pb-4 px-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase mb-2 text-[#1e293b]">Cachet et Signature de l'entreprise</p>
                    <div className="h-28 w-56 border-2 border-slate-200 border-dashed bg-slate-50 rounded-xl flex items-center justify-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Zone réservée</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR RICH TEXT — rendue une seule fois en dehors de la boucle ── */}
      <div id="bpu-floating-toolbar">
        <FloatingRichToolbar
          targetRef={activeDescRef}
          visible={!!activeDescItemId && !!setProject}
          itemLabel={activeDescItem ? cleanText(activeDescItem._overrideDesignation ?? activeDescItem.designation ?? '') : ''}
          hasOverride={activeDescItem?._overrideDescription !== undefined}
          primary={branding.colors.primary}
          onSave={() => { if (activeDescRef.current) activeDescRef.current.blur(); }}
          onReset={() => {
            if (activeDescItem) {
              resetOverride(activeDescItem.id, 'description');
              if (activeDescRef.current) activeDescRef.current.innerHTML = activeDescItem.displayDescription ?? '';
            }
          }}
        />
      </div>

      {/* Styles globaux pour le contenu rich text */}
      <style>{`
        .html-content ul { list-style-type: disc; padding-left: 1.2em; margin: 0.2em 0; }
        .html-content ol { list-style-type: decimal; padding-left: 1.2em; margin: 0.2em 0; }
        .html-content p { margin-bottom: 0.3em; }
        .html-content strong { font-weight: 900; color: #1e293b; }
        .html-content em { font-style: italic; color: #64748b; }
      `}</style>
    </div>
  );
};

export default BpuPageView;