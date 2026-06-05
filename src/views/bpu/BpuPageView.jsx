import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cleanText, normalizeUnitSymbol } from '../../utils/helpers';
import { getCurrentPhase } from '../../utils/phaseModel';
import {
  extractImageFiles, addPhotos, getCleanDescriptionHtml, decoratePhotoGrid, tryDeletePhoto,
} from '../../utils/editorImages';
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
  const [dragOverId, setDragOverId]             = useState(null);
  const activeDescRef = useRef(null);

  const today = new Date().toLocaleDateString('fr-FR');

  // ── Photos dans une description (drag-drop / coller / bouton toolbar) ──────────
  // Grille épinglée en bas (texte au-dessus), base64 inline, sauvegarde immédiate.
  const addPhotosAndSave = async (el, files) => {
    if (!el || !files?.length) return;
    const itemId = el.closest('[data-bpu-item-id]')?.getAttribute('data-bpu-item-id');
    await addPhotos(el, files);
    if (itemId) saveOverride(itemId, 'description', getCleanDescriptionHtml(el));
  };

  const handleDescDrop = (e) => {
    if (!setProject) return;
    const files = extractImageFiles(e);
    setDragOverId(null);
    if (!files.length) return;
    e.preventDefault();
    addPhotosAndSave(e.currentTarget, files);
  };

  const handleDescDragOver = (e, itemId) => {
    if (!setProject || !e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    if (dragOverId !== itemId) setDragOverId(itemId);
  };

  const handleDescDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverId(null);
  };

  const handleDescPaste = (e) => {
    if (!setProject) return;
    const files = extractImageFiles(e);
    if (!files.length) return;
    e.preventDefault();
    addPhotosAndSave(e.currentTarget, files);
  };

  // Clic sur ✕ d'une photo → suppression + sauvegarde.
  const handleDescClick = (e) => {
    if (!setProject) return;
    const el = e.currentTarget;
    if (tryDeletePhoto(e.target, el)) {
      e.preventDefault();
      const itemId = el.closest('[data-bpu-item-id]')?.getAttribute('data-bpu-item-id');
      if (itemId) saveOverride(itemId, 'description', getCleanDescriptionHtml(el));
    }
  };

  // Bouton image de la toolbar flottante → ajoute dans la description active.
  const handleToolbarInsertImage = (files) => {
    if (activeDescRef.current) addPhotosAndSave(activeDescRef.current, files);
  };

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
            {/* ── EN-TÊTE DE PAGE (calquée sur le Word) ─────────────────────── */}
            <div className="mb-2 relative flex flex-col justify-between" style={{ height: `${HEADER_HEIGHT}px` }}>
              <div className="flex justify-between items-center h-[100px] pb-2">
                {/* Titre projet centré (sous-titre + nom, sans pastille ni soulignement) */}
                <div className="flex-1 h-full flex flex-col items-center justify-center px-6 text-center">
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.06em] mb-2"
                    style={{ color: branding.colors.primary, fontFamily: branding.fonts.headings }}
                  >
                    Bordereau des Prix Unitaires
                  </div>
                  <h1 className="text-[24px] font-black text-slate-900 uppercase leading-tight tracking-tight" style={{ fontFamily: branding.fonts.headings }}>
                    {project?.name || "INTITULÉ DU PROJET"}
                  </h1>
                </div>
                {/* Logo MOE (25% comme le Word) */}
                <div className="w-[25%] h-full flex items-center justify-end">
                  {resolvedLogo ? (
                    <img src={resolvedLogo} alt="Logo" className="object-contain max-h-[70px] max-w-full" onError={onLogoError} loading="lazy" />
                  ) : (
                    <span className="text-[10px] font-black text-slate-300 uppercase">Logo manquant</span>
                  )}
                </div>
              </div>

              {/* Barre méta (phase / date / page) — 3 cellules, rectangulaire comme le Word */}
              <div className="h-[40px] bg-slate-100 border border-slate-200 flex items-stretch text-[11px]" style={{ fontFamily: branding.fonts.main }}>
                <div className="flex-1 flex items-center gap-1.5 px-4">
                  <span className="font-bold uppercase text-slate-500">Phase :</span>
                  <span className="font-bold text-slate-900">{getCurrentPhase(project)?.code || "DCE"}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <span className="font-bold uppercase text-slate-500">Date :</span>
                  <span className="font-bold text-slate-900">{today}</span>
                </div>
                <div className="flex-1 flex items-center justify-end gap-1.5 px-4">
                  <span className="font-bold uppercase text-slate-500">Page</span>
                  <span className="font-bold text-slate-900">{page.index} / {pages.length}</span>
                </div>
              </div>
            </div>

            {/* ── CORPS DE PAGE ────────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 min-h-0 relative" style={{ fontFamily: branding.fonts.main }}>
              {/* En-tête colonnes */}
              {page.items.length > 0 && (
                <div
                  className="flex text-white text-[12px] font-bold uppercase text-center shrink-0"
                  style={{ height: `${TABLE_HEADER_HEIGHT}px`, backgroundColor: branding.colors.primary }}
                >
                  <div className="flex items-center justify-center border-r border-slate-600/50" style={{ width: `${COL_NUM_WIDTH}px` }}>N° Prix</div>
                  <div className="flex items-center justify-center border-r border-slate-600/50" style={{ width: `${COL_DESC_WIDTH}px` }}>Désignation des ouvrages</div>
                  <div className="flex items-center justify-center border-r border-slate-600/50" style={{ width: `${COL_UNIT_WIDTH}px` }}>U</div>
                  <div className="flex items-center justify-center" style={{ width: `${COL_PRICE_WIDTH}px` }}>P.U. HT</div>
                </div>
              )}

              {/* Lignes articles */}
              <div className="flex-col border-x border-b border-slate-200">
                {page.items.map((item, idx) => {
                  const unitLong = unitResolver(item.unit);
                  const prefix   = ['A', 'E', 'I', 'O', 'U', 'Y'].includes(unitLong.charAt(0).toUpperCase()) ? "L'" : 'LE ';
                  const displayNum = item._displayNum || '';

                  return (
                    <div key={idx} data-bpu-item-id={item.id} className="flex border-b border-slate-200 last:border-b-0 text-[10px] break-inside-avoid">
                      {/* Numéro */}
                      <div
                        className="p-3 border-r border-slate-200 bg-slate-100 text-center font-bold flex items-center justify-center text-slate-600 text-[12px]"
                        style={{ width: `${COL_NUM_WIDTH}px` }}
                      >
                        {item.isSuite ? <span className="text-[8px] text-slate-300 italic">...</span> : displayNum}
                      </div>

                      {/* Désignation + description */}
                      <div className="py-2 px-2.5 border-r border-slate-200 text-justify leading-[1.15]" style={{ width: `${COL_DESC_WIDTH}px` }}>
                        {/* Désignation — lecture seule (masquée sur la partie « suite ») */}
                        {!item.isSuite && (
                          <div
                            className="font-black uppercase mb-1.5 text-[13px]"
                            style={{ color: branding.colors.text }}
                            ref={(el) => {
                              if (el) {
                                const text = item._overrideDesignation ?? cleanText(item.designation);
                                if (el.textContent !== text) el.textContent = text;
                              }
                            }}
                          />
                        )}

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

                              const val      = getCleanDescriptionHtml(descEl);
                              const original = item._overrideDescription ?? item.displayDescription ?? '';
                              if (val !== original) saveOverride(item.id, 'description', val);
                              else if (item._overrideDescription !== undefined) resetOverride(item.id, 'description');

                              setActiveDescItemId(null);
                              setActiveDescItem(null);
                            }, 160);
                          }}
                          onClick={handleDescClick}
                          onDrop={handleDescDrop}
                          onDragOver={(e) => handleDescDragOver(e, item.id)}
                          onDragLeave={handleDescDragLeave}
                          onPaste={handleDescPaste}
                          className={`html-content text-slate-600 leading-relaxed mb-2 font-medium outline-none rounded px-0.5 -mx-0.5 transition-colors ${
                            dragOverId === item.id
                              ? 'ring-2 ring-emerald-400 bg-emerald-50'
                              : item._overrideDescription !== undefined
                                ? 'bg-amber-50 ring-1 ring-amber-300'
                                : setProject ? 'hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-300' : ''
                          }`}
                          title={setProject ? 'Cliquer pour modifier — glisser-déposer ou coller une image' : undefined}
                          ref={(el) => {
                            if (activeDescItemId === item.id) activeDescRef.current = el;
                            if (el && el !== document.activeElement) {
                              const html = item._overrideDescription ?? item.displayDescription ?? '';
                              if (getCleanDescriptionHtml(el) !== html) el.innerHTML = html;
                              decoratePhotoGrid(el);
                            }
                          }}
                        />

                        {/* Pied unité */}
                        {!item.isSplitStart && (
                          <div className="pt-1.5 border-t border-dashed border-slate-200 mt-auto flex items-center gap-1.5">
                            <div className="h-1 w-1 rounded-full" style={{ backgroundColor: branding.colors.secondary }} />
                            <span className="font-bold uppercase text-slate-700 text-[11px] tracking-wide">
                              {prefix}{unitLong.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Unité */}
                      <div
                        className="p-3 border-r border-slate-200 text-center font-bold uppercase flex items-center justify-center text-slate-600 bg-slate-50 text-[12px]"
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
          onInsertImage={handleToolbarInsertImage}
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
        .html-content,
        .html-content * {
          font-size: 13px !important;
          line-height: 1.15 !important;
        }
        .html-content ul { list-style-type: disc; padding-left: 1.2em; margin: 0.2em 0; }
        .html-content ol { list-style-type: decimal; padding-left: 1.2em; margin: 0.2em 0; }
        .html-content p { margin-bottom: 0.3em; }
        .html-content strong { font-weight: 900; color: #1e293b; }
        .html-content em { font-style: italic; color: #64748b; }
        .html-content img { max-width: 100% !important; height: auto !important; }
        .html-content .bpu-photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .html-content .bpu-photo { position: relative; flex: 1 1 calc(50% - 3px); min-width: 0; margin: 0; }
        .html-content .bpu-photo img { width: 100% !important; height: auto !important; display: block; border-radius: 4px; }
        .html-content .bpu-photo-del {
          position: absolute; top: 4px; right: 4px;
          width: 20px; height: 20px; border-radius: 9999px; padding: 0;
          background: rgba(15,23,42,.72); color: #fff !important; border: none; cursor: pointer;
          line-height: 1 !important; display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .15s; z-index: 2;
        }
        .html-content .bpu-photo:hover .bpu-photo-del { opacity: 1; }
        .html-content .bpu-photo-del:hover { background: #ef4444; }
      `}</style>
    </div>
  );
};

export default BpuPageView;