// src/utils/parsePdfBpu.js
//
// Extraction d'un BPU (Bordereau de Prix Unitaires) au format PDF marché public,
// avec colonnes N° / Désignation / Unité / PU HT.
//
// Diffère de parsePdfOffer.js (offre entreprise avec qté/montant) : ici on capture
// uniquement N°, désignation, description (texte multi-lignes sous le titre),
// unité (potentiellement multi-lignes : "le mètre" + "carré") et PU.
//
// Stratégie :
// 1. Extraction texte par pdfjs avec positions (X, Y) de chaque token
// 2. Regroupement par Y (tolérance ±2) pour reconstituer les lignes physiques
// 3. Détection d'une "ligne d'en-tête de prix" : 1er token = nombre court à X ≤ 71
// 4. Classement des items par colonne X (texte < 440, unité 440-510, PU ≥ 510)
// 5. Filtrage des "montants en lettres" (TRENTE-NEUF EUROS) via lexique numbers FR
// 6. Bascule désignation → description dès qu'apparaît "Ce prix" ou similaire

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Bornes X (en unités PDF user space) pour le format BPU CCCT MABC observé.
// Ces valeurs sont volontairement larges pour tolérer des variations de layout.
const X_NUM_MAX = 75;       // colonne N° : X ≤ 75
const X_UNIT_MIN = 440;     // colonne Unité : X ≥ 440
const X_UNIT_MAX = 515;     // colonne Unité : X < 515
const X_PRICE_MIN = 515;    // colonne PU : X ≥ 515

// Lexique des nombres écrits en lettres pour identifier les "montants en lettres"
// type "TRENTE-NEUF EUROS", "MILLE SIX CENT QUATRE-VINGT-DIX EUROS"
const NUMBER_WORDS_FR = [
  'ZERO', 'UN', 'UNE', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
  'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE',
  'VINGT', 'VINGTS', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE',
  'CENT', 'CENTS', 'MILLE', 'MILLION', 'MILLIONS', 'MILLIARD', 'MILLIARDS',
];
const NUMBERS_GROUP = `(?:\\b(?:${NUMBER_WORDS_FR.join('|')})\\b[\\s\\-]*)+`;
// Capture aussi la queue "EUROS ET ... CENTS/CENTIMES" pour les prix décimaux écrits en lettres.
const AMOUNT_IN_WORDS_RE = new RegExp(
  `${NUMBERS_GROUP}EUROS(?:\\s+ET\\s+${NUMBERS_GROUP}(?:CENTIMES|CENTS|CENT))?\\b`,
  'g'
);

/** Retire les mots-nombres orphelins en queue d'une chaîne (cas où "EUROS" est sur la ligne suivante). */
function trimTrailingNumberWords(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  while (words.length > 0) {
    const last = words[words.length - 1].toUpperCase().replace(/[,;:\.]+$/, '');
    if (!last) { words.pop(); continue; }
    const parts = last.split('-');
    if (parts.length > 0 && parts.every(p => p && NUMBER_WORDS_FR.includes(p))) {
      words.pop();
    } else {
      break;
    }
  }
  return words.join(' ');
}

// Phrases qui marquent le début de la description (sous le titre du prix)
const DESC_START_RE = /^(Ce prix|Le [Ff]orfait\b|La journée\b|L['’]unité\b|Au m[²2³3]|Au mètre)/;

// Parse un nombre français : "3 000,00" → 3000, "1 690,00" → 1690, "39,00" → 39
const parseFrNumber = (s) => {
  if (s == null) return NaN;
  const cleaned = String(s)
    .replace(/[\s  ]/g, '')
    .replace(/€/g, '')
    .replace(/,/g, '.')
    .trim();
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const looksLikePrice = (str) => {
  const cleaned = String(str).replace(/[\s €]/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(cleaned);
};

/** Retire toute séquence "MONTANT EN LETTRES EUROS" d'un texte. */
function stripAmountsInWords(text) {
  return String(text || '')
    .replace(AMOUNT_IN_WORDS_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Détecte les lignes structurelles à ignorer (header de page, bandeau, footer). */
function isStructuralLine(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  // Header de tableau : "N° Désignation Unité PU HT"
  if (/^N[°o]\s+.*D[ée]signation.*Unit[ée].*PU\s*HT/i.test(t)) return true;
  // Bandeau haut : "CC CENTRE TARN ... BPU_LOT2"
  if (/CC\s+CENTRE\s+TARN/i.test(t) && /BPU/i.test(t)) return true;
  // Footer : "Août 2025 ... Page X sur N"
  if (/Page\s+\d+\s+sur\s+\d+/i.test(t)) return true;
  return false;
}

/**
 * Fusionne un fragment d'unité dans l'unité accumulée. Gère les cas de coupure de mot :
 *  - "La demi-" + "journée" → "La demi-journée" (tiret final = continuation)
 *  - "Le kilogramm" + "e" → "Le kilogramme" (fragment très court collant à un mot)
 *  - "le mètre" + "carré" → "le mètre carré" (mot complet → espace)
 */
function mergeUnitFragment(current, fragment) {
  const frag = String(fragment).trim();
  if (!frag) return current;
  if (!current) return frag;
  // Tiret de continuation en fin → coller sans espace ("La demi-" + "journée")
  if (/-\s*$/.test(current)) return current.replace(/\s+$/, '') + frag;
  // Fragment d'une ou deux lettres complétant un mot tronqué ("Le kilogramm" + "e")
  if (frag.length <= 2 && /[A-Za-zÀ-ÿ]$/.test(current)) return current + frag;
  // Doublon déjà présent (uniquement pour fragments significatifs, sinon un "e" matcherait par hasard)
  if (frag.length >= 3 && current.toLowerCase().includes(frag.toLowerCase())) return current;
  return (current + ' ' + frag).trim();
}

/** Ajoute du texte à un buffer (désignation ou description) avec espace de séparation. */
function appendText(current, fragment) {
  const frag = String(fragment).trim();
  if (!frag) return current;
  if (!current) return frag;
  return current + ' ' + frag;
}

/** Extrait les lignes texte avec positions d'un PDF. */
async function extractPdfLines(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const byY = new Map();
    for (const item of content.items) {
      if (!item.str || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      let key = null;
      for (const ey of byY.keys()) {
        if (Math.abs(ey - y) <= 2) { key = ey; break; }
      }
      if (key === null) key = y;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key).push({ x: item.transform[4], str: item.str });
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = byY.get(y).sort((a, b) => a.x - b.x);
      const text = items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text) allLines.push({ pageNum, y, text, items });
    }
  }
  return allLines;
}

/** Traite les items d'une ligne en répartissant texte / unité / PU. */
function distributeLineItems(items, current, state) {
  // Pré-calcul : reconstruire la "zone texte" (X < UNIT_MIN) pour détecter "Ce prix"
  const textZoneRaw = items
    .filter(i => i.x < X_UNIT_MIN && i.x > X_NUM_MAX)
    .map(i => i.str.trim())
    .filter(Boolean)
    .join(' ');
  const textZoneClean = stripAmountsInWords(textZoneRaw);

  // Bascule en mode description si la zone texte démarre par "Ce prix" / "Le forfait" / ...
  if (!state.descStarted && DESC_START_RE.test(textZoneClean.trim())) {
    state.descStarted = true;
  }

  // 1. Texte : ajouter à désignation OU description (filtré des montants en lettres)
  if (textZoneClean) {
    if (state.descStarted) {
      current.description = appendText(current.description, textZoneClean);
    } else {
      current.designation = appendText(current.designation, textZoneClean);
    }
  }

  // 2. Unité : items dans colonne unité
  for (const item of items) {
    if (item.x < X_UNIT_MIN || item.x >= X_UNIT_MAX) continue;
    const str = item.str.trim();
    if (!str) continue;
    if (looksLikePrice(str)) continue; // un PU mal positionné — skip
    if (/^€$/.test(str)) continue;
    if (AMOUNT_IN_WORDS_RE.test(str)) continue;
    current.unit = mergeUnitFragment(current.unit, str);
  }

  // 3. PU : premier nombre dans la colonne PU
  if (!current.price) {
    for (const item of items) {
      if (item.x < X_PRICE_MIN) continue;
      const str = item.str.trim();
      if (!str || /^€$/.test(str)) continue;
      const num = parseFrNumber(str);
      if (Number.isFinite(num) && num > 0) {
        current.price = num;
        break;
      }
    }
  }
}

/** Détecte si une ligne ouvre un nouveau prix (numéro court à gauche). */
function isNewPriceLine(items) {
  if (!items.length) return false;
  const first = items[0];
  if (first.x > X_NUM_MAX) return false;
  const str = first.str.trim();
  return /^\d{1,3}$/.test(str);
}

/** Normalise les apostrophes Unicode et les espaces. */
function normalizeText(s) {
  return String(s || '')
    .replace(/[’ʼ‛]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Post-traitement : nettoyage final d'un prix avant export JSON. */
function finalizePrice(p) {
  // Re-passer le filtre montant en lettres sur le texte complet, car
  // "MILLE SIX CENT QUATRE-VINGT-DIX" et "EUROS" peuvent être sur 2 lignes
  // distinctes et ne sont concaténés qu'ici.
  let designation = stripAmountsInWords(normalizeText(p.designation));
  // Et retirer les mots-nombres orphelins en queue (cas où "EUROS" est absent).
  designation = trimTrailingNumberWords(designation);
  return {
    id: p.num,
    bpuNum: p.num,
    designation,
    description: stripAmountsInWords(normalizeText(p.description)),
    unit: normalizeText(p.unit) || 'u',
    price: Number(p.price) || 0,
  };
}

/**
 * Parse un PDF BPU et retourne la liste des prix au format identique
 * à la sortie de handleConvertXlsxToJson :
 *   [{ id, bpuNum, designation, description, unit, price }, ...]
 *
 * @param {File} file Fichier PDF
 * @returns {Promise<{ articles, stats, warnings }>}
 */
export async function parsePdfBpu(file) {
  const warnings = [];
  let lines = [];
  try {
    lines = await extractPdfLines(file);
  } catch (e) {
    console.error('[parsePdfBpu] Erreur extraction texte:', e);
    throw new Error("Impossible de lire le PDF (extraction texte échouée).");
  }

  const prices = [];
  let current = null;
  let state = { descStarted: false };

  for (const line of lines) {
    if (isStructuralLine(line.text)) continue;

    if (isNewPriceLine(line.items)) {
      // Clôturer le prix précédent
      if (current) prices.push(current);
      // Initialiser le nouveau
      const num = line.items[0].str.trim();
      current = { num, designation: '', description: '', unit: '', price: 0, pageNum: line.pageNum };
      state = { descStarted: false };
      // Traiter le reste de la ligne (items après le numéro)
      distributeLineItems(line.items.slice(1), current, state);
    } else if (current) {
      distributeLineItems(line.items, current, state);
    }
    // Sinon : on est avant le 1er prix (page de garde) → on ignore
  }
  if (current) prices.push(current);

  const articles = prices
    .map(finalizePrice)
    .filter(p => p.designation && p.price > 0);

  if (articles.length === 0) {
    warnings.push('Aucun prix détecté. Le format du PDF n\'est peut-être pas reconnu (colonnes N° / Désignation / Unité / PU HT attendues).');
  }

  return {
    articles,
    stats: {
      totalLines: lines.length,
      pageCount: lines.length > 0 ? lines[lines.length - 1].pageNum : 0,
      articleCount: articles.length,
    },
    warnings,
  };
}
