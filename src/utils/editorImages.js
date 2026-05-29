// src/utils/editorImages.js
//
// Gestion des photos dans les descriptions d'articles (bibliothèque BPU + override
// projet du devis). Disposition imposée et cohérente pour chaque article :
//   • le TEXTE reste en haut ;
//   • les PHOTOS sont regroupées dans une grille épinglée EN BAS (bloc non-éditable) ;
//   • 1 photo = pleine largeur, 2 = 50/50, 3 = une paire + une pleine, 4 = 2×2.
//
// Méthodes d'ajout : glisser-déposer, coller (Ctrl+V), bouton image.
// Stockage : base64 (dataURL) compressé, inline dans le champ description HTML
//   → compatible export PDF (html2canvas) et Word (processHtmlToDocx) sans refonte.
//
// Les boutons de suppression (✕) sont marqués [data-ui] : injectés pour l'édition
// mais JAMAIS persistés (getCleanDescriptionHtml les retire) ni exportés.

import { compressImage } from './imageCompressor';
import { toast } from './globalUI';

export const MAX_PHOTOS = 4;

// Styles INLINE (volontaire) : html2canvas respecte l'inline à l'export PDF.
// flex + flex-grow : 1 photo grandit à 100%, 2 → 50/50, impair → la dernière à 100%.
const GRID_STYLE = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
const FIG_STYLE  = 'position:relative;flex:1 1 calc(50% - 3px);min-width:0;margin:0;';
const IMG_STYLE  = 'width:100%;height:auto;display:block;border-radius:6px;';

const toSrc = (res) => (typeof res === 'string' ? res : res?.src || '');

/** Récupère les fichiers image d'un événement drop ou paste. */
export const extractImageFiles = (e) => {
  const dt = e.dataTransfer || e.clipboardData;
  if (!dt) return [];
  const files = [];
  if (dt.files && dt.files.length) {
    for (const f of dt.files) if (f.type?.startsWith('image/')) files.push(f);
  }
  // Collage d'une capture d'écran : l'image est dans items, pas dans files.
  if (!files.length && dt.items) {
    for (const it of dt.items) {
      if (it.kind === 'file' && it.type?.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
  }
  return files;
};

const buildFigure = (src) =>
  `<figure class="bpu-photo" style="${FIG_STYLE}"><img src="${src}" style="${IMG_STYLE}" alt="" /></figure>`;

/** HTML « propre » pour stockage : retire les éléments d'UI (boutons ✕). */
export const getCleanDescriptionHtml = (el) => {
  if (!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  // Grille vide résiduelle → on la retire
  clone.querySelectorAll('.bpu-photo-grid').forEach((g) => {
    if (!g.querySelector('.bpu-photo')) g.remove();
  });
  const html = clone.innerHTML.trim();
  return html === '<br>' ? '' : html;
};

/** Nombre de photos déjà présentes. */
export const countPhotos = (el) => (el ? el.querySelectorAll('.bpu-photo').length : 0);

/** Trouve la grille photo (la crée si absente) et la place TOUJOURS en dernier. */
const ensureGridAtEnd = (el) => {
  let grid = el.querySelector(':scope > .bpu-photo-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'bpu-photo-grid';
    grid.setAttribute('contenteditable', 'false');
    grid.setAttribute('style', GRID_STYLE);
  }
  if (el.lastElementChild !== grid) el.appendChild(grid); // texte tapé après → photos repassent en bas
  return grid;
};

/** Injecte les boutons ✕ (non persistés) sur chaque photo, pour l'édition. */
export const decoratePhotoGrid = (el) => {
  if (!el) return;
  el.querySelectorAll('.bpu-photo').forEach((fig) => {
    if (fig.querySelector('[data-ui].bpu-photo-del')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bpu-photo-del';
    btn.setAttribute('data-ui', '1');
    btn.setAttribute('contenteditable', 'false');
    btn.setAttribute('title', 'Retirer la photo');
    btn.setAttribute('aria-label', 'Retirer la photo');
    btn.textContent = '✕';
    fig.appendChild(btn);
  });
};

/**
 * Compresse puis ajoute des fichiers image à la grille (en bas), dans la limite MAX_PHOTOS.
 * @returns {Promise<{added:number, skipped:number}>}
 */
export const addPhotos = async (el, files) => {
  if (!el) return { added: 0, skipped: 0 };
  const imgs = [...files].filter((f) => f?.type?.startsWith('image/'));
  if (!imgs.length) return { added: 0, skipped: 0 };

  const grid = ensureGridAtEnd(el);
  let current = countPhotos(el);
  let added = 0, skipped = 0;

  for (const file of imgs) {
    if (current >= MAX_PHOTOS) { skipped += 1; continue; }
    const src = toSrc(await compressImage(file, 800, 0.7, { withGps: false }));
    if (!src) { skipped += 1; continue; }
    grid.insertAdjacentHTML('beforeend', buildFigure(src));
    current += 1; added += 1;
  }

  ensureGridAtEnd(el);   // re-épingle en bas si du texte a été ajouté entre-temps
  decoratePhotoGrid(el);

  if (skipped > 0) toast.warning(`Maximum ${MAX_PHOTOS} photos par article — ${skipped} ignorée(s).`);
  return { added, skipped };
};

/**
 * Gère un clic sur un bouton ✕ : retire la photo (et la grille si vide).
 * @returns {boolean} true si un bouton de suppression a bien été traité.
 */
export const tryDeletePhoto = (target, el) => {
  const btn = target?.closest?.('[data-ui].bpu-photo-del');
  if (!btn || !el || !el.contains(btn)) return false;
  const fig = btn.closest('.bpu-photo');
  const grid = btn.closest('.bpu-photo-grid');
  if (fig) fig.remove();
  if (grid && !grid.querySelector('.bpu-photo')) grid.remove();
  return true;
};
