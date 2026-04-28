import { useState, useRef, useLayoutEffect } from 'react';
import { cleanText } from '../../../utils/helpers';
import { getRawDescription, normalizeToHtml, escapeHtml } from '../utils/bpuDescriptionUtils';
import {
  CONTENT_HEIGHT_PX,
  HEADER_HEIGHT,
  TABLE_HEADER_HEIGHT,
  SIGNATURE_BLOCK_HEIGHT,
  MIN_SPACE_TO_FILL,
  COL_DESC_WIDTH,
  MAX_DESC_CHARS_FOR_SPLIT,
  MAX_SPLIT_ATTEMPTS,
} from '../constants/bpuLayout';

/**
 * useBpuPagination
 * Calcule la répartition des articles BPU en pages A4, avec gestion du
 * split d'articles sur plusieurs pages (binaire sur nœuds HTML puis phrases).
 *
 * @param {object} params
 * @param {Array}  params.sortedCatalog - articles triés avec overrides
 * @param {Array}  params.articlesDb    - base de données articles
 * @param {Function} params.unitResolver - résolveur d'unités
 * @param {React.RefObject} params.measureRef - div cachée pour mesurer la hauteur HTML
 */
export const useBpuPagination = ({ sortedCatalog, articlesDb, unitResolver, measureRef }) => {
  const [pages, setPages] = useState([]);
  const heightCacheRef = useRef(new Map());

  // ── MESURE DE HAUTEUR HTML ───────────────────────────────────────────────────
  const measureHtmlHeight = (html, widthPx) => {
    const el = measureRef.current;
    if (!el) return 0;
    el.style.width = `${widthPx}px`;
    el.innerHTML = html || '';
    return Math.ceil(el.scrollHeight);
  };

  const measureHtmlHeightCached = (html, widthPx) => {
    const key = `${widthPx}::${html}`;
    const cache = heightCacheRef.current;
    if (cache.has(key)) return cache.get(key);
    const h = measureHtmlHeight(html, widthPx);
    cache.set(key, h);
    return h;
  };

  // ── CONSTRUCTION DU HTML DE MESURE D'UNE LIGNE ───────────────────────────────
  const buildDesignationCellHtml = ({ designation, descriptionHtml, unitFooterText, showUnitFooter, isSplitStart }) => `
    <div style="padding: 12px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10px; line-height: 1.625; text-align: justify;">
      <div style="font-weight: 900; text-transform: uppercase; margin-bottom: 6px; font-size: 11px; color: #0f172a;">
        ${escapeHtml(cleanText(designation || 'ARTICLE SANS NOM'))}
      </div>
      <div class="html-content" style="color: #475569; margin-bottom: 8px; font-weight: 500; font-size: 10px; line-height: 1.625;">
        ${descriptionHtml || "<em style='color:#cbd5e1'>Aucune description technique disponible.</em>"}
      </div>
      ${showUnitFooter ? `
        <div style="padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; gap: 6px;">
          <div style="width: 4px; height: 4px; border-radius: 999px; background-color: #34d399;"></div>
          <span style="font-weight: 700; text-transform: uppercase; color: #334155; font-size: 9px;">${escapeHtml(unitFooterText || '')}</span>
        </div>
      ` : ''}
      ${isSplitStart ? `
        <div style="padding-top: 8px; border-top: 1px dashed #cbd5e1; text-align: center;">
          <span style="font-weight: 700; font-style: italic; color: #94a3b8; font-size: 9px;">(...Suite page suivante)</span>
        </div>
      ` : ''}
    </div>`;

  // ── SPLIT HTML BINAIRE ────────────────────────────────────────────────────────
  // Tente de couper le HTML d'une description en deux parties qui tiennent
  // dans l'espace restant (d'abord par nœuds DOM, puis par phrases).
  const splitHtmlToFit = (fullHtml, maxHeight, ctx) => {
    if (maxHeight < 10) return ['', fullHtml];

    const div = document.createElement('div');
    div.innerHTML = fullHtml;
    const nodes = Array.from(div.childNodes);

    const fits = (html) =>
      measureHtmlHeightCached(
        buildDesignationCellHtml({ ...ctx, descriptionHtml: html, isSplitStart: true, showUnitFooter: false }),
        COL_DESC_WIDTH
      ) <= maxHeight;

    // Tentative 1 : split par nœuds DOM
    if (nodes.length > 1) {
      let low = 1, high = nodes.length, best = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const htmlPart = nodes.slice(0, mid).map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join('');
        if (fits(htmlPart)) { best = mid; low = mid + 1; } else { high = mid - 1; }
      }
      if (best > 0) return [
        nodes.slice(0, best).map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join(''),
        nodes.slice(best).map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join(''),
      ];
    }

    // Tentative 2 : split par phrases
    const text = div.textContent || '';
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    if (sentences.length > 1) {
      let low = 1, high = sentences.length, best = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const txt = sentences.slice(0, mid).join(' ');
        if (fits(txt)) { best = mid; low = mid + 1; } else { high = mid - 1; }
      }
      if (best > 0) return [sentences.slice(0, best).join(' '), sentences.slice(best).join(' ')];
    }

    // Tentative 3 : split par mots (dernier recours)
    const words = text.split(/\s+/);
    if (words.length > 1) {
      let low = 1, high = words.length, best = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const txt = words.slice(0, mid).join(' ');
        if (fits(txt)) { best = mid; low = mid + 1; } else { high = mid - 1; }
      }
      if (best > 0) return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }

    return ['', fullHtml];
  };

  // ── CALCUL DE PAGINATION ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    let cancelled = false;
    heightCacheRef.current = new Map();

    const computePagination = () => {
      if (cancelled) return;
      const newPages = [];
      let currentPageItems = [];
      let currentY = 0;
      let pageIndex = 1;
      const splitAttempts = new Map();

      const finalizePage = (hasSignature = false) => {
        newPages.push({ index: pageIndex, items: currentPageItems, hasSignature });
        pageIndex++;
        currentPageItems = [];
        currentY = 0;
      };

      const queue = sortedCatalog.map((i) => ({ ...i }));

      while (queue.length > 0) {
        if (cancelled) return;

        const item = queue.shift();
        const rawDesc = getRawDescription(item, articlesDb);
        const htmlDesc = normalizeToHtml(rawDesc);
        const unitLong = unitResolver(item.unit);
        const prefix = ['A', 'E', 'I', 'O', 'U', 'Y'].includes(unitLong.charAt(0).toUpperCase()) ? "L'" : 'LE ';
        const unitFooterText = `${prefix}${unitLong.toUpperCase()}`;

        const fullRowHtml = buildDesignationCellHtml({
          designation: item.designation,
          descriptionHtml: htmlDesc,
          unitFooterText,
          showUnitFooter: !item.isSplitStart,
          isSplitStart: item.isSplitStart,
        });

        const measuredH = measureHtmlHeightCached(fullRowHtml, COL_DESC_WIDTH);
        const rowHeight = Math.max(50, measuredH);
        const spaceLeft = CONTENT_HEIGHT_PX - HEADER_HEIGHT - TABLE_HEADER_HEIGHT - currentY;

        if (rowHeight <= spaceLeft) {
          // L'article tient dans l'espace restant
          currentPageItems.push({ ...item, displayDescription: htmlDesc, rowHeight });
          currentY += rowHeight;
        } else {
          // L'article ne tient pas

          // Pas assez de place restante : nouvelle page
          if (spaceLeft < MIN_SPACE_TO_FILL && currentPageItems.length > 0) {
            queue.unshift(item);
            finalizePage(false);
            continue;
          }

          // Description trop longue pour être splitée : passer à la page suivante
          if ((rawDesc || '').length > MAX_DESC_CHARS_FOR_SPLIT) {
            if (currentPageItems.length > 0) { queue.unshift(item); finalizePage(false); }
            else { currentPageItems.push({ ...item, displayDescription: htmlDesc, rowHeight }); currentY += rowHeight; }
            continue;
          }

          // Sécurité anti-boucle infinie
          const attemptKey = `${item.bpuNum || ''}::${item.designation || ''}`;
          const tries = (splitAttempts.get(attemptKey) || 0) + 1;
          splitAttempts.set(attemptKey, tries);
          if (tries > MAX_SPLIT_ATTEMPTS) {
            if (currentPageItems.length > 0) { queue.unshift(item); finalizePage(false); }
            else { currentPageItems.push({ ...item, displayDescription: htmlDesc, rowHeight }); currentY += rowHeight; }
            continue;
          }

          // Tentative de split
          const strictSpaceLeft = Math.max(0, spaceLeft);
          const [part1, part2] = splitHtmlToFit(htmlDesc, strictSpaceLeft, {
            designation: item.designation,
            unitFooterText,
          });

          if (!part1 || part1.trim() === '') {
            // Split impossible : placer en entier sur la page (si elle est vide) ou nouvelle page
            if (currentPageItems.length === 0) {
              currentPageItems.push({ ...item, displayDescription: htmlDesc, rowHeight });
              currentY += rowHeight;
            } else {
              queue.unshift(item);
              finalizePage(false);
            }
          } else {
            // Split réussi : part1 sur cette page, part2 repoussée
            currentPageItems.push({ ...item, displayDescription: part1, isSplitStart: true });
            finalizePage(false);
            queue.unshift({
              ...item,
              partialDescription: part2,
              isSuite: true,
              designation: item.designation.endsWith('(SUITE)')
                ? item.designation
                : `${item.designation} (SUITE)`,
              bpuNum: item.bpuNum,
              _displayNum: item._displayNum,
              price: '',
              unit: item.unit,
            });
          }
        }
      }

      // Dernière page : vérifier si le bloc signature tient
      const spaceLeftLast = CONTENT_HEIGHT_PX - HEADER_HEIGHT - TABLE_HEADER_HEIGHT - currentY;
      if (currentPageItems.length > 0) {
        if (spaceLeftLast < SIGNATURE_BLOCK_HEIGHT) {
          finalizePage(false);
          newPages.push({ index: pageIndex, items: [], hasSignature: true });
        } else {
          newPages.push({ index: pageIndex, items: currentPageItems, hasSignature: true });
        }
      } else if (newPages.length > 0) {
        newPages[newPages.length - 1].hasSignature = true;
      }

      setPages(newPages);
    };

    const timer = setTimeout(computePagination, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sortedCatalog, articlesDb, unitResolver]);

  return { pages };
};
