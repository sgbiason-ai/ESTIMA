// src/utils/parsePdfOffer.js
//
// Extraction d'un fichier PDF d'offre entreprise au format DQE/BPU.
// Détecte les lignes article (réf, désignation, unité, qté, P.U., montant)
// et retourne un format compatible avec le parser Excel handleImportExcel.
//
// Stratégie :
// 1. Extraction texte page par page via pdfjs-dist
// 2. Reconstruction des lignes (regroupement par position Y des items texte)
// 3. Parsing token-based à rebours : montant, PU, qté, unité, ref, désignation
//
// Limitations :
// - PDF scannés (image-only) → pas de texte extractible, échec
// - Layouts complexes (cellules multilignes, fusion) → erreurs possibles

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { recognizedUnitTokens } from '../data/units';

// Configuration du worker pour Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Unités reconnues (case-insensitive) — dérivées du catalogue central (symboles
// + alias), source unique. On ajoute les formes ASCII des exposants (m2/m3).
const UNITS = (() => {
  const set = new Set(recognizedUnitTokens());
  set.add('m2'); set.add('m3');
  return [...set];
})();

// Pattern de référence DQE : "1 005", "1.005", "1-005", "P.01", "P01", "100", etc.
const REF_PATTERNS = [
  /^\d{1,3}\s\d{2,4}$/,        // "1 005"
  /^\d{1,3}[.-]\d{2,4}$/,     // "1.005" ou "1-005"
  /^\d{3,6}$/,                 // "2086", "4012" — refs collées (OCR sans espace)
  /^P[.-]?\d{1,4}$/i,         // "P.01" ou "P01"
  /^[A-Z]\d{1,4}$/,            // "A1", "B12"
];

const looksLikeRef = (token) => REF_PATTERNS.some(r => r.test(token));

// Bruit OCR courant : séquences de 2-3 lettres majuscules qui ne sont pas des unités
// Apparaissent souvent comme polluants : "TT", "ET", "RE", "EE", etc.
const OCR_NOISE_PATTERNS = [
  /\bT{2,4}\b/g,                                // "TT", "TTT"
  /\b[EM]{2,4}\b/g,                             // "EE", "MM"
  /\b[A-Z]{2,3}[a-z]?\b(?![a-z])/g,            // séquences MAJUSCULES courtes (ET, RE, FM…)
  /\b[a-z]{1,2}\b/g,                            // mots minuscules de 1-2 lettres (sauf unités, traité après)
];

/** Nettoyage agressif des polluants OCR avant parsing — préserve unités connues. */
function aggressiveCleanOcr(text) {
  let s = text;
  // Garder les unités en les marquant
  for (const u of UNITS) {
    s = s.replace(new RegExp(`\\b${u}\\b`, 'gi'), `§${u}§`);
  }
  // Retirer le bruit
  s = s.replace(/[….]{3,}/g, ' ');             // points multiples "..."
  s = s.replace(/\bT{2,4}\b/g, ' ');
  s = s.replace(/\b[A-Z]{2,3}\b/g, ' ');         // "ET", "RE", "TT"…
  s = s.replace(/\b[a-z]{1}\b/g, ' ');           // lettres isolées
  // Restaurer unités
  s = s.replace(/§([^§]+)§/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

// Parse un nombre français : "20 410,00" → 20410.00, "1 238" → 1238, "7,25" → 7.25
const parseFrNumber = (s) => {
  if (s == null) return NaN;
  const cleaned = String(s)
    .replace(/[\s\u00A0\u202F]/g, '')  // espaces insécables / fines
    .replace(/€/g, '')
    .replace(/,/g, '.')
    .trim();
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const looksLikeNumber = (token) => {
  const n = parseFrNumber(token);
  return Number.isFinite(n);
};

const looksLikeUnit = (token) => UNITS.includes(String(token).toLowerCase().replace(/[.²³]/g, m => m === '²' ? '2' : m === '³' ? '3' : ''));

/**
 * Extrait les lignes texte d'un PDF en regroupant les items par position Y.
 * @returns {Promise<Array<{ pageNum: number, y: number, text: string, items: Array }>>}
 */
async function extractPdfLines(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Regrouper les items par Y (avec tolérance de 2 unités)
    const byY = new Map();
    for (const item of textContent.items) {
      if (!item.str || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      // Chercher un Y déjà existant à ±2 unités
      let key = null;
      for (const existingY of byY.keys()) {
        if (Math.abs(existingY - y) <= 2) { key = existingY; break; }
      }
      if (key === null) key = y;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key).push({ x: item.transform[4], str: item.str });
    }

    // Trier les lignes par Y décroissant (haut → bas) et items par X croissant
    const sortedYs = [...byY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = byY.get(y).sort((a, b) => a.x - b.x);
      // Joindre avec un séparateur multi-espaces pour préserver les colonnes
      const text = items.map(i => i.str).join('  ').replace(/\s+/g, ' ').trim();
      if (text) allLines.push({ pageNum, y, text, items });
    }
  }

  return allLines;
}

/**
 * Nettoie une chaîne issue d'OCR : retire caractères parasites, normalise chiffres confondus.
 * Conserve la structure pour ne pas casser le matching.
 */
function cleanOcrLine(text) {
  return String(text || '')
    .replace(/[|¦│]/g, ' ')                  // séparateurs verticaux OCR
    .replace(/[«»"]/g, '"')                  // guillemets
    .replace(/[‐‑‒–—]/g, '-')                // tirets unicode → tiret normal
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Corrige les confusions OCR courantes dans les SÉQUENCES NUMÉRIQUES uniquement :
 *  - O / o → 0  quand entouré de chiffres
 *  - l / I → 1  idem
 *  - S → 5      idem (plus rare, à utiliser avec précaution)
 * Ne touche pas aux mots normaux.
 */
function fixOcrNumbers(text) {
  // Cible les "mots" qui contiennent au moins 1 chiffre et des caractères confondus
  return text.replace(/\b[\dOolI]+\b/g, (m) => {
    // Au moins 2 caractères et au moins 1 chiffre
    if (m.length < 2 || !/\d/.test(m)) return m;
    return m.replace(/O/g, '0').replace(/o/g, '0').replace(/[lI]/g, '1');
  });
}

/**
 * Recolle les nombres séparés par un espace en format millier (ex. "48 412,00" → "48412,00")
 * Préserve le 1er token (la référence) pour ne pas casser "1 005".
 */
function joinThousandsSpaces(text) {
  const match = text.match(/^(\S+)\s+(.*)/);
  if (!match) return text;
  const ref = match[1];
  let rest = match[2];
  // Recoller jusqu'à 3 fois (cas "48 412 567,00" → "48412567,00")
  for (let i = 0; i < 3; i++) {
    const next = rest.replace(/\b(\d{1,3})\s(\d{3})\b/g, '$1$2');
    if (next === rest) break;
    rest = next;
  }
  return ref + ' ' + rest;
}

/**
 * Wrapper qui tente plusieurs passes de parsing (du moins agressif au plus agressif).
 * Important pour les PDF scannés à OCR dégradé.
 */
function parseArticleLine(rawText) {
  // Passe 1 : nettoyage standard, SANS jonction millier (cas normal)
  const cleaned1 = fixOcrNumbers(cleanOcrLine(rawText));
  const r1 = parseArticleLineCore(cleaned1);
  if (r1) return r1;

  // Passe 2 : nettoyage agressif
  const cleaned2 = fixOcrNumbers(aggressiveCleanOcr(cleanOcrLine(rawText)));
  const r2 = parseArticleLineCore(cleaned2);
  if (r2) return r2;

  // Passe 3 : avec jonction millier (cas OCR qui sépare "48 412,00")
  //   Risque : peut fusionner à tort 2 nombres distincts → on tente en dernier recours
  const cleaned3 = joinThousandsSpaces(fixOcrNumbers(cleanOcrLine(rawText)));
  return parseArticleLineCore(cleaned3);
}

/**
 * Tente de parser une ligne texte en article DQE (logique principale).
 * Stratégie : split par espaces multiples, identification des tokens à rebours.
 * @returns {{ ref, designation, unit, qty, price, montant } | null}
 */
function parseArticleLineCore(text) {
  if (!text || text.length < 8) return null;

  // Skip lignes qui ressemblent à des headers/totaux/chapitres
  if (/^(d[ée]signation|sous\s*total|total\s*g[ée]n[ée]ral|tva|t\.v\.a|n[°o]\s*prix|unit[ée]|qt|p\.?u\.?|montant|phase\s+dce|page\s+\d)/i.test(text)) return null;

  // Splitter intelligent : conserver les ref type "1 005" (chiffre + espace + chiffre)
  // Stratégie : repérer la zone "qté PU montant" en fin de ligne (3 nombres)
  // puis l'unité juste avant, puis la ref au début, le reste = désignation

  // Token-iser en gardant "1 005" comme un seul token
  // On utilise un split sur 2+ espaces, puis on essaie de recoller les refs.
  const rawTokens = text.split(/\s+/).filter(t => t.length > 0);
  if (rawTokens.length < 5) return null;

  // Essayer de recoller la référence si les 2 premiers tokens sont des chiffres courts
  const tokens = [...rawTokens];
  if (tokens.length >= 2 && /^\d{1,3}$/.test(tokens[0]) && /^\d{2,4}$/.test(tokens[1])) {
    tokens[0] = tokens[0] + ' ' + tokens[1];
    tokens.splice(1, 1);
  }

  // Premier token = ref candidate
  const refCandidate = tokens[0];
  if (!looksLikeRef(refCandidate)) return null;

  // Les 3 derniers tokens devraient être : qté, PU, montant
  // Mais le montant peut contenir des décimales écrites avec virgule, donc gérer les espaces internes
  // Stratégie : trouver les 3 derniers nombres consécutifs en fin de ligne
  const nums = [];
  let lastNumberEndIdx = tokens.length - 1;
  for (let i = tokens.length - 1; i >= 1; i--) {
    if (looksLikeNumber(tokens[i])) {
      nums.unshift({ idx: i, val: parseFrNumber(tokens[i]) });
      if (nums.length === 3) { lastNumberEndIdx = i - 1; break; }
    } else {
      // Si on a déjà commencé à collecter et qu'on tombe sur du non-numérique → stop
      if (nums.length > 0) break;
    }
  }
  if (nums.length < 2) return null; // pas assez de nombres → pas une ligne article

  let qty, price, montant;
  if (nums.length === 3) {
    [qty, price, montant] = nums.map(n => n.val);
  } else if (nums.length === 2) {
    // qté ou prix manquant — essayer de déduire via montant ≈ qty × price
    qty = nums[0].val;
    price = nums[1].val;
    montant = qty * price;
  }

  // Sanity check : qty × price ≈ montant (tolérance 5%)
  if (nums.length === 3) {
    const expected = qty * price;
    if (expected > 0 && Math.abs(expected - montant) / Math.max(expected, montant) > 0.05) {
      // Incohérence : les 3 nombres ne sont peut-être pas qty/price/montant
      // Tentative : peut-être qu'il n'y a que 2 vrais nombres (qté + PU=montant)
      // On tente : si on ne trouve qu'1 cohérence, on garde
      return null;
    }
  }

  // Le token juste avant les nombres = unité
  const unitIdx = lastNumberEndIdx;
  if (unitIdx < 1) return null;
  const unit = tokens[unitIdx];
  if (!looksLikeUnit(unit)) {
    // Si pas une unité reconnue, on essaie quand même mais on signale
    // Skip si le token contient des caractères non-typiques d'une unité
    if (unit.length > 6 || /[a-z]{4,}/i.test(unit) === false) {
      // Probablement pas une vraie ligne article
      return null;
    }
  }

  // Tout entre tokens[1] et tokens[unitIdx-1] = désignation
  const designation = tokens.slice(1, unitIdx).join(' ').trim();
  if (!designation || designation.length < 3) return null;

  return {
    ref: refCandidate,
    designation,
    unit,
    qty: Number(qty) || 0,
    price: Number(price) || 0,
    montant: Number(montant) || 0,
  };
}

/**
 * Extrait le texte d'un PDF via OCR (pour les scans).
 * Rend chaque page en canvas via pdfjs puis applique Tesseract.js en français.
 * @param {File} file
 * @param {Function} onProgress ({ stage, page, totalPages, progress }) → void
 * @returns {Promise<Array<{ pageNum: number, text: string }>>}
 */
async function extractPdfViaOcr(file, onProgress) {
  console.log('[OCR] 🔄 Démarrage extraction OCR…');

  // Lazy import de Tesseract (lourd : ~5-10 Mo)
  console.log('[OCR] Import de tesseract.js…');
  const Tesseract = (await import('tesseract.js')).default;
  console.log('[OCR] ✓ tesseract.js chargé');

  console.log('[OCR] Lecture du PDF…');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  console.log(`[OCR] ✓ PDF lu : ${totalPages} pages`);

  // Worker Tesseract réutilisé sur toutes les pages
  onProgress?.({ stage: 'init', page: 0, totalPages, progress: 0, message: 'Chargement du moteur OCR français…' });
  console.log('[OCR] Création du worker Tesseract (langue: fra)…');
  let worker;
  try {
    worker = await Tesseract.createWorker('fra', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress({ stage: 'ocr', message: 'Reconnaissance en cours…', progress: m.progress });
        }
        // Log des phases importantes pour debug
        if (['loading tesseract core', 'initializing tesseract', 'loading language traineddata', 'initializing api'].includes(m.status)) {
          console.log(`[OCR] ${m.status} (${Math.round((m.progress || 0) * 100)}%)`);
        }
      },
      errorHandler: (e) => {
        console.error('[OCR] Erreur worker Tesseract:', e);
      },
    });
    console.log('[OCR] ✓ Worker Tesseract prêt');
  } catch (e) {
    console.error('[OCR] ❌ Impossible d\'initialiser le worker Tesseract:', e);
    console.error('[OCR] Cause possible : pas de connexion internet (Tesseract charge ~5 Mo de données la 1ère fois).');
    throw new Error(`Tesseract n'a pas pu démarrer : ${e.message}. Vérifiez votre connexion internet.`);
  }

  const pages = [];
  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({ stage: 'render', page: pageNum, totalPages, progress: 0, message: `Rendu page ${pageNum}/${totalPages}…` });
      console.log(`[OCR] Page ${pageNum}/${totalPages} : rendu canvas…`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 }); // x2 pour meilleure OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      console.log(`[OCR] Page ${pageNum}/${totalPages} : canvas ${canvas.width}×${canvas.height} rendu`);

      onProgress?.({ stage: 'ocr', page: pageNum, totalPages, progress: 0, message: `OCR page ${pageNum}/${totalPages}…` });
      console.log(`[OCR] Page ${pageNum}/${totalPages} : reconnaissance en cours…`);

      const { data } = await worker.recognize(canvas);
      const charCount = (data?.text || '').length;
      const lineCount = (data?.text || '').split('\n').filter(l => l.trim()).length;
      console.log(`[OCR] Page ${pageNum}/${totalPages} : ✓ ${charCount} caractères, ${lineCount} lignes reconnues`);
      pages.push({ pageNum, text: data.text });
    }
  } finally {
    console.log('[OCR] Arrêt du worker…');
    await worker.terminate();
    console.log('[OCR] ✓ Worker arrêté');
  }

  return pages;
}

/**
 * Reconstruit des lignes à partir du texte OCR (séparé par \n).
 * Applique parseArticleLine ligne par ligne.
 */
function parseOcrPages(pages) {
  const articles = [];
  let totalLines = 0;
  for (const page of pages) {
    const lines = String(page.text || '').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      totalLines++;
      const article = parseArticleLine(line);
      if (article) articles.push({ ...article, pageNum: page.pageNum });
    }
  }
  return { articles, totalLines };
}

/**
 * Parse un fichier PDF d'offre et retourne les articles détectés.
 * Stratégie : extraction texte d'abord (rapide). Si 0 article, fallback OCR (lent).
 * @param {File} file Fichier PDF
 * @param {Object} options
 * @param {Function} options.onProgress Callback de progression pour l'OCR
 * @param {boolean} options.forceOcr Force l'OCR même si du texte est extractible
 * @returns {Promise<{ articles, stats, warnings, viaOcr }>}
 */
export async function parsePdfOffer(file, options = {}) {
  const { onProgress, forceOcr = false } = options;
  const warnings = [];
  let articles = [];
  let viaOcr = false;
  let totalLines = 0;

  // 1. Tentative extraction texte directe (rapide, fonctionne sur PDF avec texte)
  if (!forceOcr) {
    let lines;
    try {
      lines = await extractPdfLines(file);
    } catch (e) {
      console.error('[parsePdfOffer] Erreur extraction texte:', e);
      lines = [];
    }
    totalLines = lines.length;
    for (const line of lines) {
      const article = parseArticleLine(line.text);
      if (article) articles.push({ ...article, pageNum: line.pageNum });
    }
  }

  // 2. Fallback OCR si rien d'extrait (PDF scanné)
  if (articles.length === 0) {
    console.log('[parsePdfOffer] Aucun article extrait directement, basculement sur OCR…');
    onProgress?.({ stage: 'detect', message: 'Aucun texte direct, lancement de l\'OCR (PDF scanné détecté)…' });
    try {
      const pages = await extractPdfViaOcr(file, onProgress);
      const ocrResult = parseOcrPages(pages);
      articles = ocrResult.articles;
      totalLines = ocrResult.totalLines;
      viaOcr = true;
      console.log(`[parsePdfOffer] OCR terminé : ${articles.length} article(s) extrait(s) sur ${totalLines} ligne(s)`);

      // Si OCR n'a rien extrait : sauvegarder le texte brut dans la console pour debug
      if (articles.length === 0 && pages.length > 0) {
        console.warn('[parsePdfOffer] ⚠ L\'OCR a fonctionné mais aucune ligne ne ressemble à un article. Texte brut extrait :');
        pages.forEach(p => {
          console.warn(`──── PAGE ${p.pageNum} ────`);
          console.warn(p.text);
        });
        console.warn('Partagez ce texte pour adapter le parser si nécessaire.');
      }
    } catch (e) {
      console.error('[parsePdfOffer] ❌ Erreur OCR:', e);
      throw new Error('OCR impossible : ' + (e.message || 'erreur inconnue'));
    }
  }

  if (articles.length === 0) {
    warnings.push('Aucune ligne article détectée même après OCR. Le texte OCR brut a été affiché dans la console (F12) pour diagnostic.');
  }

  const totalAmount = articles.reduce((s, a) => s + (a.montant || a.qty * a.price), 0);

  return {
    articles,
    stats: {
      totalLines,
      articleCount: articles.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
    },
    warnings,
    viaOcr,
  };
}

/**
 * Convertit le résultat du parsing PDF en un workbook ExcelJS en mémoire,
 * au format identique à un DQE Excel (col 1 : ref, col 2 : désignation, etc.).
 * Permet de réutiliser handleImportExcel sans dupliquer la logique de matching.
 * @returns {Promise<File>} Un objet File simulé contenant le workbook XLSX
 */
export async function pdfToWorkbookFile(articles, fileName = 'offre.xlsx') {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Offre');
  ws.addRow(['N°Prix', 'Désignation', 'Unité', 'Qt', 'P.U.', 'Montant']);
  for (const a of articles) {
    ws.addRow([a.ref, a.designation, a.unit, a.qty, a.price, a.montant || (a.qty * a.price)]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
