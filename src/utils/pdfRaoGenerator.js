// src/utils/pdfRaoGenerator.js
// Génère le PDF du Rapport d'Analyse des Offres (RAO)
// INCLUT l'Analyse Financière (Synthèse A4 + Détails A3) avec codes couleurs par entreprise
// Style : Vert Papyrus — typographie H1 14pt / H2 12pt / body 9pt — marges 15mm

import { DEFAULT_CRITERIA, DEFAULT_ADMIN_PIECES, DEFAULT_OFFER_PIECES } from '../hooks/useRao';
import { normalizeUnitSymbol } from './helpers';
import { formatNumberFr, cleanText, loadLogos, drawCoverPage as _drawCoverPage } from './pdf/pdfSharedHelpers';
import { buildTheme as _buildTheme } from './pdf/buildTheme';
import { getCurrentPhaseCode } from './phaseModel';

// ─── COULEUR PRIMAIRE RAO : VERT PAPYRUS ────────────────────────────────────
const VERT_PAPYRUS = [45, 138, 78];   // #2d8a4e
const VERT_CLAIR   = [232, 245, 233]; // fond léger
const VERT_FONCE   = [30, 100, 55];   // texte foncé

const RAO_OVERRIDES = {
  primary: VERT_PAPYRUS,
  accent:  VERT_PAPYRUS,
  yes: [40, 167, 69],
  no:  [220, 53, 69],
};
const RAO_DEFAULTS = {
  tableAlt: [245, 250, 247],
};

const buildTheme = (branding) => {
  const base = _buildTheme(branding, RAO_OVERRIDES, RAO_DEFAULTS);
  // Forcer la couleur primaire RAO vert papyrus (indépendant du branding)
  return { ...base, primary: VERT_PAPYRUS, accent: VERT_PAPYRUS };
};

// Couleurs entreprises
const COMPANY_COLORS = [
  { header: [30, 58, 138],  body: [239, 246, 255], text: [30, 58, 138] },
  { header: [6, 78, 59],    body: [236, 253, 245], text: [6, 78, 59] },
  { header: [88, 28, 135],  body: [250, 245, 255], text: [88, 28, 135] },
  { header: [124, 45, 18],  body: [255, 247, 237], text: [124, 45, 18] },
  { header: [131, 24, 67],  body: [255, 241, 242], text: [131, 24, 67] },
  { header: [22, 78, 99],   body: [236, 254, 255], text: [22, 78, 99] },
];
const getCompanyStyle = (index) => COMPANY_COLORS[index % COMPANY_COLORS.length];

// Éclaircit une couleur RGB d'environ 45 % vers le blanc (utilisé pour les variantes).
const lighten = (rgb, factor = 0.45) => {
  if (!Array.isArray(rgb) || rgb.length < 3) return rgb;
  return rgb.map(c => Math.min(255, Math.round(c + (255 - c) * factor)));
};

// ─── HELPERS FORMATAGE ──────────────────────────────────────────────────────
const fmt = (n) => {
  if (typeof n !== 'number') return n || '—';
  const fixed = n.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
};
const fmtScore = (n) => typeof n === 'number' ? n.toFixed(2) : '—';

const calculateOABThreshold = (values) => {
  const validValues = values.filter(v => v > 0);
  if (validValues.length === 0) return 0;
  const M1 = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const upperLimit = M1 * 1.20;
  const filteredValues = validValues.filter(v => v <= upperLimit);
  if (filteredValues.length === 0) return M1 * 0.90;
  return (filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length) * 0.90;
};

const getHeatmapStyle = (value, reference) => {
  if (!value || !reference || reference === 0) return null;
  const delta = (value - reference) / reference;
  if (delta > 0.50) return { fill: [248, 113, 113], text: [255, 255, 255] };
  if (delta > 0.25) return { fill: [252, 165, 165], text: [30, 41, 59] };
  if (delta > 0.10) return { fill: [254, 202, 202], text: [30, 41, 59] };
  if (delta > 0.00) return { fill: [254, 226, 226], text: [30, 41, 59] };
  if (delta < -0.50) return { fill: [52, 211, 153], text: [255, 255, 255] };
  if (delta < -0.25) return { fill: [110, 231, 183], text: [30, 41, 59] };
  if (delta < -0.10) return { fill: [167, 243, 208], text: [30, 41, 59] };
  if (delta < 0) return { fill: [209, 250, 229], text: [30, 41, 59] };
  return null;
};

// ─── HELPERS VISUELS ────────────────────────────────────────────────────────
// Barre de score CARRÉE (pas arrondie)
// opts.label : string custom OU null/'' pour masquer le label intérieur
const drawScoreBar = (doc, x, y, w, h, score, maxScore, color, opts = {}) => {
  if (maxScore <= 0) return;
  const pct = Math.min(1, Math.max(0, score / maxScore));
  // Fond gris
  doc.setFillColor(235, 235, 240);
  doc.rect(x, y, w, h, 'F');
  // Barre colorée
  if (pct > 0.01) {
    doc.setFillColor(...color);
    doc.rect(x, y, Math.max(2, w * pct), h, 'F');
  }
  // Texte centré dans la barre (sauf si label explicitement masqué)
  const label = ('label' in opts) ? opts.label : fmtScore(score);
  if (label === null || label === '' || label === undefined) {
    doc.setTextColor(0, 0, 0);
    return;
  }
  const fs = h > 5 ? 7 : 5.5;
  doc.setFontSize(fs);
  doc.setFont('Helvetica', 'bold');
  const textY = y + h / 2 + fs * 0.13;
  const textX = pct > 0.15 ? x + (w * pct) / 2 : x + w * pct + 4;
  doc.setTextColor(pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60, pct > 0.4 ? 255 : 60);
  doc.text(label, textX, textY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

// ─── CONSTANTES LAYOUT ─────────────────────────────────────────────────────
const M = 15; // marge standard 15mm

// ─── HELPER : TEXTE JUSTIFIÉ MULTI-PARAGRAPHES ─────────────────────────────
// Le texte est splité sur "\n" : chaque sous-paragraphe est justifié SÉPARÉMENT,
// ce qui évite d'étirer la dernière ligne d'un paragraphe avant un retour ligne.
// Retourne { y, lines } pour avancer le curseur de l'appelant.
const drawJustifiedText = (doc, text, x, y, maxWidth, lineH = 4.5) => {
  const paragraphs = String(text == null ? '' : text).split('\n');
  let curY = y;
  let totalLines = 0;
  paragraphs.forEach((para) => {
    if (para.trim() === '') {
      // Ligne vide : on avance d'une hauteur de ligne
      curY += lineH;
      totalLines += 1;
      return;
    }
    const lines = doc.splitTextToSize(para, maxWidth);
    if (lines.length === 1) {
      // Une seule ligne (pas de wrap) → on rend sans justify pour ne pas étirer
      doc.text(lines[0], x, curY);
    } else {
      // Plusieurs lignes → justify (jsPDF ne stretche pas la dernière ligne)
      doc.text(para, x, curY, { align: 'justify', maxWidth });
    }
    curY += lines.length * lineH;
    totalLines += lines.length;
  });
  return { y: curY, lines: totalLines };
};

// ─── PAGE DE GARDE RAO — utilise drawCoverPage partagé + bloc consultation ──
const drawCoverPageRao = (doc, project, consultation, logoMoe, logoClient, today, branding, THEME) => {
  // Formater la date de remise
  let remiseStr = '—';
  if (consultation?.dateRemise) {
    try {
      const parts = consultation.dateRemise.split('-');
      if (parts.length === 3) remiseStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      else remiseStr = consultation.dateRemise;
      if (consultation.timeRemise) remiseStr += ` à ${consultation.timeRemise}`;
    } catch { /* ignore */ }
  }

  _drawCoverPage(doc, {
    docType: "RAPPORT D'ANALYSE DES OFFRES",
    title: consultation?.objet || project?.name,
    subtitle1: (consultation?.subtitle1 || project?.subtitle1 || '').trim(),
    subtitle2: (consultation?.subtitle2 || project?.subtitle2 || '').trim(),
    phaseLabel: (consultation?.phase || getCurrentPhaseCode(project)).toUpperCase(),
    clientName: consultation?.client || project?.client || 'Non renseigné',
    clientStreet: project?.clientAddress ? project.clientAddress.trim() : '',
    clientCityZip: [project?.clientZip, project?.clientCity].filter(Boolean).join(' ').trim(),
    locationRaw: consultation?.lieu || project?.location || 'Non renseignée',
    codeAffaire: consultation?.code || project?.code || 'Non défini',
    showSignatures: project?.showSignatures !== false,
    signatories: project?.signatories || ['', '', '', ''],
    branding,
    today,
    extraBlocks: [
      {
        height: 30,
        rows: [
          { label: 'PROCÉDURE', value: consultation?.procedure || '—', col: 1 },
          { label: 'DATE LIMITE REMISE', value: remiseStr, col: 2 },
        ],
      },
      // Bloc LOT affiché uniquement si un lot est renseigné
      ...((consultation?.lot || '').trim() ? [{
        height: 30,
        rows: [
          { label: 'LOT', value: consultation.lot.trim(), col: 1 },
        ],
      }] : []),
    ],
  }, THEME, { logoMoe, logoClient });
};

// ── EN-TÊTE : bande verte pleine + titre blanc ────────────────────────────
// Hauteur dynamique : 22mm si titre tient sur 1 ligne, 30mm si wrap sur 2 lignes.
// Renvoie la hauteur effective pour que l'appelant ajuste le `y` de départ.
const drawHeader = (doc, title, consultation, project, THEME, logoMoe) => {
  const W = doc.internal.pageSize.getWidth();

  // Calcul du logo (pour réserver la place à droite)
  let logoW = 0;
  if (logoMoe) {
    const maxW = 30; const maxH = 12;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    logoW = w;
  }

  // Largeur dispo pour le titre = W - marge gauche - logo - marge droite - padding sécurité
  const TITLE_FS = 12;
  const titleMaxW = W - M - logoW - M - 6;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(TITLE_FS);
  const titleText = (title || '').toUpperCase();
  const titleLines = doc.splitTextToSize(titleText, titleMaxW);
  // Hauteur du bandeau = base 22mm + supplément si plus d'une ligne (~5.5mm/ligne en plus)
  const extraLines = Math.max(0, titleLines.length - 1);
  const headerHeight = 22 + extraLines * 5.5;

  // Bande latérale verte
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, 6, doc.internal.pageSize.getHeight(), 'F');

  // Bandeau header : fond vert plein avec texte blanc — hauteur adaptée
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, W, headerHeight, 'F');

  // Logo : positionné verticalement centré dans le bandeau
  if (logoMoe) {
    const maxW = 30; const maxH = 12;
    const ratio = logoMoe.width / logoMoe.height;
    let w = maxW; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const logoY = (headerHeight - h) / 2;
    doc.addImage(logoMoe, 'JPEG', W - M - w, logoY, w, h);
  }

  // Titre — 1 ou 2 lignes selon longueur
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(TITLE_FS);
  const titleStartY = 10;
  titleLines.forEach((ln, idx) => {
    doc.text(ln, M, titleStartY + idx * 5.5);
  });

  // Sous-titre (objet/projet) — placé sous le titre
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text((consultation?.objet || project?.name || '').toUpperCase(), M, headerHeight - 5);

  return headerHeight;
};

// ── PIED DE PAGE : Réf + Date + Page (idempotent, 1 seul rendu par page) ──
const drawFooter = (doc, _ignoredPageNum, consultation, project, THEME) => {
  // Idempotence : on ne dessine le pied qu'une seule fois par page physique.
  // Les multiples appels (addPage + didDrawPage d'autoTable + pages internes
  // d'autoTable) sont ainsi déduplicés.
  const currentPage = doc.internal.getNumberOfPages();
  if (!doc._raoFootedPages) doc._raoFootedPages = new Set();
  if (doc._raoFootedPages.has(currentPage)) return;
  doc._raoFootedPages.add(currentPage);

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...THEME.primary);
  doc.setLineWidth(0.4);
  doc.line(M, H - 15, W - M, H - 15);
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.ref || project?.code || '', M, H - 9);
  const today = new Date().toLocaleDateString('fr-FR');
  doc.text(`Édité le ${today}`, W / 2, H - 9, { align: 'center' });
  // Numéro de page LIVE (et non figé), pour que les pages internes d'autoTable
  // affichent leur vrai numéro et pas celui de la page d'origine du tableau.
  doc.text(`Page ${currentPage}`, W - M, H - 9, { align: 'right' });
};

// ── TITRE DE SECTION : fond vert plein + texte blanc ──────────────────────
const sectionTitle = (doc, text, y, colorArr) => {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...(colorArr || VERT_PAPYRUS));
  doc.rect(M, y - 4, W - 2 * M, 10, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(text, M + 4, y + 3);
  doc.setTextColor(0, 0, 0);
  return y + 14;
};

// ── GÉNÉRATION PRINCIPALE DU RAO ───────────────────────────────────────────
export const generateRaoPDF = async (optionsParams) => {
  const {
    project, consultation, criteria, rao, analysisCompanies, ranking, branding,
    analysisStats, chaptersData, bpuRefMap, tranches, analysisMode, scoringConfig,
    // Nouvelles props refonte complète
    optionChapters = [], includedOptions = {},
  } = optionsParams;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const THEME = buildTheme(branding);

  const { logoMoe, logoClient } = await loadLogos(branding, project);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const companiesData = rao.companies || {};
  const companyNames = analysisCompanies.map(c => c.name);
  const today = new Date().toLocaleDateString('fr-FR');
  const W = doc.internal.pageSize.getWidth();
  let pageNum = 1;

  // Tracking des sections pour le sommaire (on enregistre la page de début)
  const tocEntries = [];

  // ── EXTENDED RANKING : base + variantes retenues, scores recalculés ──
  // Calculé EN AMONT pour être utilisé à la fois dans la Synthèse Exécutive
  // et dans le Récapitulatif Final (cohérence des chiffres).
  // - Exclut les bases irrégulières du Pmin/Pmax/Pmoy
  // - Recalcule priceScore + totalScore pour TOUTES les lignes valides
  // - Réattribue les rangs (1, 2, 3...) après recalcul
  const NON_REG_RECAP = ['irreguliere', 'inacceptable', 'inappropriee'];
  const buildExtendedRanking = () => {
    if (!ranking || ranking.length === 0) return [];
    const N = Number(scoringConfig?.maxScore || 40);
    const mode = scoringConfig?.mode || 'f1';

    const flat = [];
    ranking.forEach(r => {
      flat.push({ ...r, kind: 'base' });
      const co = analysisCompanies.find(c => c.name === r.name);
      const retainedVars = (co?.variants || []).filter(v => v.retained);
      retainedVars.forEach((v, vi) => {
        const variantConcl = v.adminConclusion || null;
        const variantIrregular = variantConcl && NON_REG_RECAP.includes(variantConcl);
        flat.push({
          ...r,
          kind: 'variant',
          variantId: v.id,
          variantIndex: vi + 1,
          variantLabel: v.label || '',
          price: Number(v.total || 0),
          irregular: !!variantIrregular,
          irregularLabel: variantConcl,
        });
      });
    });

    const valid = flat.filter(r => !r.irregular && r.price > 0).map(r => r.price);
    const Pmin = valid.length ? Math.min(...valid) : 0;
    const Pmax = valid.length ? Math.max(...valid) : 0;
    const Pmoy = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;

    const scoreFor = (p) => {
      if (p <= 0 || Pmin <= 0) return 0;
      let s = 0;
      switch (mode) {
        case 'f1': s = N * (Pmin / p); break;
        case 'f2': s = N * Math.pow(Pmin / p, 2); break;
        case 'f3': s = N * Math.pow(Pmin / p, 3); break;
        case 'f4': s = N * (1 - (p - Pmin) / Pmin); break;
        case 'f5': s = N * (1 - (p - Pmin) / Pmoy); break;
        case 'f6': s = p <= Pmoy ? N * Math.sqrt(Pmin / p) : N * Math.pow(Pmin / p, 2); break;
        case 'f7': s = Pmax === Pmin ? N : N * (1 - (p - Pmin) / (Pmax - Pmin)); break;
        case 'f8': s = (N * Pmoy) / (Pmoy + p); break;
        case 'f9': s = N * ((2 * Pmin) / (Pmin + p)); break;
        default:   s = 0;
      }
      return Math.max(0, Math.min(N, s));
    };

    const recomputed = flat.map(r => {
      const priceScore = r.irregular ? 0 : scoreFor(r.price);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      return { ...r, priceScore, totalScore: priceScore + techTotal };
    });

    const reg = recomputed.filter(r => !r.irregular).sort((a, b) => b.totalScore - a.totalScore);
    const irreg = recomputed.filter(r => r.irregular);
    return [
      ...reg.map((r, i) => ({ ...r, rank: i + 1 })),
      ...irreg.map(r => ({ ...r, rank: null })),
    ];
  };
  const extendedRanking = buildExtendedRanking();

  const addPage = (sectionTitle_, format = 'a4', orientation = 'portrait') => {
    doc.addPage(format, orientation);
    pageNum++;
    const hdrH = drawHeader(doc, sectionTitle_, consultation, project, THEME, logoMoe);
    drawFooter(doc, pageNum, consultation, project, THEME);
    // y de départ contenu = bas du header + 8mm de respiration
    return (hdrH || 22) + 8;
  };

  // ── PAGE 1 : COUVERTURE ──
  drawCoverPageRao(doc, project, consultation, logoMoe, logoClient, today, branding, THEME);

  // ── PAGE 2 : SOMMAIRE ──
  // On insère une page placeholder pour le sommaire — on la remplira à la fin
  doc.addPage('a4', 'portrait');
  pageNum++;
  drawHeader(doc, 'Sommaire', consultation, project, THEME, logoMoe);
  drawFooter(doc, pageNum, consultation, project, THEME);
  // On garde la référence de cette page pour la remplir plus tard
  const sommairePageIndex = doc.internal.getNumberOfPages();

  // ── PAGE : OBJET + CRITÈRES ──
  // (Synthèse Exécutive supprimée — les données clés sont déjà présentes dans le
  //  Récapitulatif Général et la Recommandation finale.)
  let y = addPage('Critères de notation', 'a4', 'portrait');
  tocEntries.push({ label: '1. Objet de la consultation', page: pageNum });
  y = sectionTitle(doc, '1  Objet de la consultation', y, THEME.primary);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9); // body
  doc.setTextColor(...THEME.text);
  doc.text('Objet des travaux', M, y + 2);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  const objLines = doc.splitTextToSize(consultation?.objet || project?.name || '—', W - 2 * M);
  doc.text(objLines, M, y);
  y += objLines.length * 4.5 + 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.text);
  doc.text('Lieu d\'exécution :', M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.lieu || '—', 55, y);
  y += 5;

  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...THEME.text);
  doc.text('Procédure :', M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(consultation?.procedure || '—', 55, y);
  y += 10;

  // Section 2 : Remise des dossiers
  tocEntries.push({ label: '2. Remise des dossiers de réponse', page: pageNum });
  y = sectionTitle(doc, '2  Remise des dossiers de réponse', y, THEME.primary);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text('Date et heure limites de réception des offres :', M, y + 2);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...THEME.text);

  let remiseStr = '—';
  if (consultation?.dateRemise) {
      try {
          const parts = consultation.dateRemise.split('-');
          if(parts.length === 3) remiseStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
          else remiseStr = consultation.dateRemise;
          if (consultation.timeRemise) remiseStr += ` à ${consultation.timeRemise}`;
      } catch { /* ignore */ }
  }
  doc.text(remiseStr, W / 2, y + 10, { align: 'center' });
  y += 18;

  // Section 3 (Négociations) supprimée — les négociations sont exclues du PDF RAO.

  // Section 3 : Critères de notation — RENDU MANUEL (pas d'autoTable)
  //   pour avoir un contrôle total sur la hauteur des blocs et la justification.
  tocEntries.push({ label: '3. Rappel des critères de notation', page: pageNum });
  y = sectionTitle(doc, '3  Rappel des critères de notation', y, THEME.primary);

  // Constantes layout
  const BOTTOM_CRIT = 297 - 25;
  const COL_NUM_W = 28;        // largeur "Critère N" / "N.M"
  const COL_WEIGHT_W = 34;     // largeur "%"
  const COL_LABEL_W = W - 2 * M - COL_NUM_W - COL_WEIGHT_W;
  const PAD_X = 4;             // padding horizontal cellule
  const PAD_Y = 5;             // padding vertical cellule
  const FS_MAIN = 11;          // font critère principal
  const FS_SUB = 9;            // font sous-critère
  const FS_WEIGHT_MAIN = 12;
  const FS_WEIGHT_SUB = 10;

  // Header tableau (bandeau vert pleine largeur)
  const drawCritHeader = (yPos) => {
    doc.setFillColor(...THEME.primary);
    doc.rect(M, yPos, W - 2 * M, 10, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Critère',     M + COL_NUM_W / 2,                           yPos + 6, { align: 'center' });
    doc.text('Intitulé',    M + COL_NUM_W + COL_LABEL_W / 2,             yPos + 6, { align: 'center' });
    doc.text('Pondération', M + COL_NUM_W + COL_LABEL_W + COL_WEIGHT_W / 2, yPos + 6, { align: 'center' });
    return yPos + 10;
  };
  y = drawCritHeader(y);

  // Calcule la hauteur effective d'un bloc (label + ligne vide + description)
  const computeBlockHeight = (label, description, fs) => {
    const lineH = fs * 0.5;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(fs);
    const labelLines = doc.splitTextToSize(label || '', COL_LABEL_W - 2 * PAD_X);
    let h = labelLines.length * lineH;
    if (description) {
      doc.setFont('Helvetica', 'normal');
      // Compte les lignes par paragraphe (même logique que drawJustifiedText)
      const paragraphs = String(description).split('\n');
      paragraphs.forEach(para => {
        if (para.trim() === '') { h += lineH; return; }
        const ls = doc.splitTextToSize(para, COL_LABEL_W - 2 * PAD_X);
        h += ls.length * lineH;
      });
      h += lineH; // ligne vide entre label et description
    }
    return h + 2 * PAD_Y;
  };

  // Dessine un bloc complet (1 critère ou 1 sous-critère)
  const drawCritBlock = (numLabel, label, description, weightLabel, isMain, yPos) => {
    const fs = isMain ? FS_MAIN : FS_SUB;
    const fsWeight = isMain ? FS_WEIGHT_MAIN : FS_WEIGHT_SUB;
    const bgFill = isMain ? VERT_CLAIR : null;
    const textColor = isMain ? VERT_FONCE : [60, 60, 60];
    const numColor = isMain ? VERT_FONCE : [80, 80, 80];
    const lineH = fs * 0.5;

    const blockH = computeBlockHeight(label, description, fs);

    // Fond bloc (uniquement pour les critères principaux)
    if (bgFill) {
      doc.setFillColor(...bgFill);
      doc.rect(M, yPos, W - 2 * M, blockH, 'F');
    }
    // Bordure inférieure fine pour séparer les blocs
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.3);
    doc.line(M, yPos + blockH, W - M, yPos + blockH);
    // Bordures verticales pour matérialiser les colonnes
    doc.line(M + COL_NUM_W, yPos, M + COL_NUM_W, yPos + blockH);
    doc.line(M + COL_NUM_W + COL_LABEL_W, yPos, M + COL_NUM_W + COL_LABEL_W, yPos + blockH);

    // Col 1 : Numéro (centré horizontalement et en haut verticalement)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(isMain ? fs : 9.5);
    doc.setTextColor(...numColor);
    doc.text(numLabel, M + COL_NUM_W / 2, yPos + PAD_Y + fs * 0.4, { align: 'center' });

    // Col 2 : Label (gras) + description (justifiée)
    let textY = yPos + PAD_Y + fs * 0.4;
    const textX = M + COL_NUM_W + PAD_X;
    const textW = COL_LABEL_W - 2 * PAD_X;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(fs);
    doc.setTextColor(...textColor);
    const labelLines = doc.splitTextToSize(label || '', textW);
    labelLines.forEach((ln, idx) => doc.text(ln, textX, textY + idx * lineH));
    textY += labelLines.length * lineH;
    if (description) {
      textY += lineH; // ligne vide
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(fs);
      doc.setTextColor(...textColor);
      drawJustifiedText(doc, description, textX, textY, textW, lineH);
    }

    // Col 3 : Pondération (% en haut)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(fsWeight);
    doc.setTextColor(...numColor);
    doc.text(weightLabel, M + COL_NUM_W + COL_LABEL_W + COL_WEIGHT_W / 2, yPos + PAD_Y + fs * 0.4, { align: 'center' });

    return yPos + blockH;
  };

  // Itérer sur les critères
  criteria.forEach((c, i) => {
    const hasSubs = (c.subCriteria || []).length > 0;
    const weight = c.auto
      ? (scoringConfig?.maxScore || c.weight)
      : (hasSubs ? c.subCriteria.reduce((s, sc) => s + (Number(sc.weight) || 0), 0) : c.weight);

    // Hauteur estimée pour saut de page (avec petite marge)
    const blockH = computeBlockHeight(c.label, !hasSubs ? c.description : '', FS_MAIN);
    if (y + blockH > BOTTOM_CRIT) {
      y = addPage('Critères de notation (suite)', 'a4', 'portrait');
      y = drawCritHeader(y);
    }
    y = drawCritBlock(`Critère ${i + 1}`, c.label, !hasSubs ? c.description : '', `${weight}%`, true, y);

    if (hasSubs) {
      c.subCriteria.forEach((sc, si) => {
        const subH = computeBlockHeight(sc.label, sc.description, FS_SUB);
        if (y + subH > BOTTOM_CRIT) {
          y = addPage('Critères de notation (suite)', 'a4', 'portrait');
          y = drawCritHeader(y);
        }
        y = drawCritBlock(`${i + 1}.${si + 1}`, sc.label, sc.description, `${sc.weight || 0}%`, false, y);
      });
    }
  });
  y += 10;

  // ── PAGE : RÉGIME DES VARIANTES (CCP R2151-8) ──
  y = addPage('Régime des variantes', 'a4', 'portrait');
  tocEntries.push({ label: '3.bis Régime des variantes (R2151-8)', page: pageNum });
  y = sectionTitle(doc, '3.bis  Régime des variantes — CCP R2151-8 à R2151-11', y, THEME.primary);

  const variantsRegime = consultation?.variantsAllowed || 'forbidden';
  const variantsRegimeLabels = {
    forbidden: { label: 'INTERDITES', color: [220, 53, 69], desc: 'Aucune variante ne sera examinée.' },
    allowed:   { label: 'AUTORISÉES', color: [30, 100, 180], desc: 'Les variantes sont examinées en complément de l\'offre de base.' },
    mandatory: { label: 'OBLIGATOIRES', color: [180, 100, 30], desc: 'Le soumissionnaire doit proposer au moins une variante.' },
  };
  const regimeInfo = variantsRegimeLabels[variantsRegime] || variantsRegimeLabels.forbidden;

  // Tuile régime
  doc.setFillColor(...regimeInfo.color);
  doc.rect(M, y, 60, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(regimeInfo.label, M + 30, y + 9, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text(regimeInfo.desc, M + 65, y + 9);
  y += 22;

  // Exigences minimales (si déclarées)
  if (consultation?.variantsRequirements && variantsRegime !== 'forbidden') {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.text);
    doc.text('Exigences minimales fixées dans la consultation :', M, y);
    y += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.lightText);
    const reqLines = doc.splitTextToSize(consultation.variantsRequirements, W - 2 * M - 10);
    doc.setFillColor(248, 250, 252);
    doc.rect(M, y - 3, W - 2 * M, reqLines.length * 4.5 + 6, 'F');
    drawJustifiedText(doc, consultation.variantsRequirements, M + 5, y + 2, W - 2 * M - 10, 4.5);
    y += reqLines.length * 4.5 + 12;
  }

  // Référence CCP
  doc.setFillColor(...VERT_CLAIR);
  doc.rect(M, y, W - 2 * M, 24, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...VERT_FONCE);
  doc.text('Article R2151-8 du Code de la Commande Publique', M + 4, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.lightText);
  const ccpText = "En procédure formalisée par un pouvoir adjudicateur, les variantes sont interdites sauf mention contraire dans l'avis de marché. En procédure adaptée, elles sont autorisées sauf mention contraire dans les documents de consultation. La variante retenue se substitue à la solution de base dans ses éléments qui en diffèrent (R2151-11).";
  drawJustifiedText(doc, ccpText, M + 4, y + 12, W - 2 * M - 8, 4);
  y += 32;

  // ── Section "Réponses reçues" supprimée — les conclusions admin et les
  //    groupements sont déjà visibles dans le PV de dépouillement et l'analyse
  //    administrative qui suivent.

  // ── PV DE DÉPOUILLEMENT (devient la section 5 après suppression de "Réponses reçues") ──
  y = addPage('PV de dépouillement', 'a4', 'portrait');
  tocEntries.push({ label: '4. PV de dépouillement', page: pageNum });
  y = sectionTitle(doc, '4  Procès-verbal de dépouillement (CCP L2113-1)', y, THEME.primary);

  // Date d'ouverture des plis
  const dateOuverture = consultation?.dateOuverturePLis || consultation?.dateRemise || '';
  let dateOuvStr = '—';
  if (dateOuverture) {
    try {
      const parts = dateOuverture.split('-');
      if (parts.length === 3) dateOuvStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      else dateOuvStr = dateOuverture;
    } catch { /* ignore */ }
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.text);
  doc.text("Date d'ouverture des plis :", M, y);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...THEME.lightText);
  doc.text(dateOuvStr, 75, y);
  y += 10;

  // Tableau des entreprises avec montants AE annoncés + variantes (montant inclus)
  // Une ligne par variante en plus de la base — pas de ligne de cumul (peu utile)
  const depouillementBody = [];

  analysisCompanies.forEach((c, idx) => {
    // Ligne entreprise (offre de base)
    const aeAmount = c.aeAmount != null ? fmt(c.aeAmount) + ' €' : '—';
    depouillementBody.push([
      { content: String(idx + 1), styles: { halign: 'center', fontStyle: 'bold' } },
      { content: cleanText(c.name), styles: { fontStyle: 'bold' } },
      { content: aeAmount, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: (c.variants || []).length > 0 ? `${c.variants.length} variante${c.variants.length > 1 ? 's' : ''}` : '—', styles: { fontSize: 7, halign: 'center' } },
    ]);

    // Une ligne supplémentaire par variante (montant explicite)
    (c.variants || []).forEach((v, vi) => {
      const vAmount = v.aeAmount != null
        ? fmt(v.aeAmount) + ' €'
        : (v.total ? fmt(v.total) + ' €' : '—');
      depouillementBody.push([
        { content: '', styles: { } },
        { content: `   > V${vi + 1} ${cleanText(v.label || `Variante ${vi + 1}`)}`, styles: { fontSize: 7, textColor: [88, 28, 135], fontStyle: 'italic' } },
        { content: vAmount, styles: { halign: 'right', fontSize: 7, textColor: [88, 28, 135], fontStyle: 'italic' } },
        { content: '', styles: { } },
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [['N°', 'Entreprise / Variante', 'Montant AE annoncé', 'Variantes']],
    body: depouillementBody,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 40 }, 3: { cellWidth: 30, halign: 'center' } },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 8;

  // Note de bas
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const noteAe = "Les montants ci-dessus sont ceux relevés sur les actes d'engagement (AE) à l'ouverture des plis. Ils engagent contractuellement les soumissionnaires (article L2113-1 CCP). Toute divergence avec le total recalculé à partir du BPU sera signalée à la section Conformité.";
  drawJustifiedText(doc, noteAe, M, y, W - 2 * M, 4);

  // ── ANALYSE ADMINISTRATIVE — Tableau comparatif avec colonnes subdivisées pour groupements ──
  {
    y = addPage('Analyse administrative', 'a4', 'portrait');
    tocEntries.push({ label: '5. Analyse administrative', page: pageNum });
    y = sectionTitle(doc, '5  ANALYSE ADMINISTRATIVE — PIÈCES DE CANDIDATURE', y, THEME.primary);

    const conclLabelsA = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' };
    const conclColorsA = { reguliere: THEME.yes, irreguliere: [255, 140, 0], inacceptable: THEME.no, inappropriee: THEME.no };

    // Utiliser les pièces custom si définies
    const pdfAdminPieces = rao.adminPieces || DEFAULT_ADMIN_PIECES;
    const pdfOfferPieces = rao.offerPieces || DEFAULT_OFFER_PIECES;

    // Construire les colonnes avec subdivision pour groupements
    // subColumns = [{ companyName, memberKey, memberLabel, companyIndex }]
    const subColumns = [];
    companyNames.forEach((name, ci) => {
      const admin = companiesData[name]?.admin || {};
      if (admin.isGroupement && admin.groupementMembers?.length > 0) {
        admin.groupementMembers.forEach(m => {
          subColumns.push({ companyName: name, memberKey: m.id, memberLabel: m.name || 'Sans nom', role: m.role || 'Cotraitant', companyIndex: ci });
        });
      } else {
        subColumns.push({ companyName: name, memberKey: '_self', memberLabel: name, role: null, companyIndex: ci });
      }
    });

    const totalCols = 1 + subColumns.length; // Pièce + sub-columns
    // Largeur disponible = largeur page - marges. La 1ère colonne (libellé pièce) prend une portion fixe,
    // les colonnes entreprises se partagent équitablement le reste pour remplir toute la page.
    const usableWidth = W - 2 * M;
    const labelColWidth = Math.max(40, Math.min(60, usableWidth * 0.28)); // ~28% pour le libellé, mini 40mm / maxi 60mm
    const colW = Math.max(8, (usableWidth - labelColWidth) / subColumns.length);

    // Header row 1 : company names spanning their members
    const headRow1 = ['Pièce'];
    const headRow1Spans = []; // track spans for merging
    let colIdx = 1;
    companyNames.forEach((name, ci) => {
      const admin = companiesData[name]?.admin || {};
      const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
      headRow1.push({ content: name, colSpan: memberCount, styles: { fillColor: getCompanyStyle(ci).header, halign: 'center' } });
      headRow1Spans.push({ start: colIdx, span: memberCount, ci });
      colIdx += memberCount;
    });

    // Header row 2 : member names / roles (only if at least one groupement)
    const hasAnyGroupement = companyNames.some(n => {
      const a = companiesData[n]?.admin || {};
      return a.isGroupement && a.groupementMembers?.length > 0;
    });

    const headRows = [headRow1];
    if (hasAnyGroupement) {
      const headRow2 = [''];
      subColumns.forEach(sc => {
        headRow2.push(sc.role ? `${sc.role}\n${sc.memberLabel}` : sc.memberLabel);
      });
      headRows.push(headRow2);
    }

    // Body rows
    const adminBody = [];

    // Section: Pièces administratives (par membre)
    adminBody.push([{ content: 'PIÈCES ADMINISTRATIVES', colSpan: totalCols, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
    pdfAdminPieces.forEach(p => {
      adminBody.push([p.label, ...subColumns.map(sc => {
        const pieces = companiesData[sc.companyName]?.admin?.pieces || {};
        const pieceKey = sc.memberKey === '_self' ? p.id : `${sc.memberKey}_${p.id}`;
        return pieces[pieceKey] === false ? 'NON' : pieces[pieceKey] === true ? 'OUI' : '—';
      })]);
    });

    // Section: Offre de l'entreprise (une seule colonne par entreprise, span si groupement)
    adminBody.push([{ content: 'OFFRE DE L\'ENTREPRISE', colSpan: totalCols, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
    pdfOfferPieces.forEach(p => {
      const row = [p.label];
      companyNames.forEach(name => {
        const admin = companiesData[name]?.admin || {};
        const pieces = admin.pieces || {};
        const val = pieces[p.id] === false ? 'NON' : pieces[p.id] === true ? 'OUI' : '—';
        const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
        row.push(memberCount > 1 ? { content: val, colSpan: memberCount, styles: { halign: 'center' } } : val);
      });
      adminBody.push(row);
    });

    // Ligne CONCLUSION supprimee (la conclusion admin apparait deja dans le bloc
    // Recommandation finale + ailleurs dans le PDF — eviter la redondance).

    // Observations admin (si saisies)
    const hasObs = companyNames.some(n => companiesData[n]?.admin?.obsAdmin || companiesData[n]?.admin?.obsOffre);
    if (hasObs) {
      adminBody.push([{ content: 'OBSERVATIONS', colSpan: totalCols, styles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 } }]);
      const obsRow = [{ content: 'Observations', styles: { fontStyle: 'bold' } }];
      companyNames.forEach(name => {
        const admin = companiesData[name]?.admin || {};
        const obs = [admin.obsAdmin, admin.obsOffre].filter(Boolean).join(' / ') || '—';
        const memberCount = (admin.isGroupement && admin.groupementMembers?.length > 0) ? admin.groupementMembers.length : 1;
        obsRow.push(memberCount > 1 ? { content: obs, colSpan: memberCount, styles: { halign: 'center', fontSize: 6 } } : { content: obs, styles: { halign: 'center', fontSize: 6 } });
      });
      adminBody.push(obsRow);
    }

    const compColStyles = {};
    subColumns.forEach((_, i) => { compColStyles[i + 1] = { cellWidth: colW, halign: 'center', fontSize: 6.5 }; });

    autoTable(doc, {
      startY: y,
      head: headRows,
      body: adminBody,
      tableWidth: usableWidth, // remplit toute la largeur utile
      styles: { font: 'Helvetica', fontSize: 6.5, cellPadding: 2 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
      columnStyles: { 0: { cellWidth: labelColWidth, fontSize: 6.5 }, ...compColStyles },
      alternateRowStyles: { fillColor: THEME.tableAlt },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          // Extraire le texte brut (gère les cellules simples ET celles avec colSpan/objet)
          const cellText = typeof data.cell.raw === 'object' && data.cell.raw !== null ? data.cell.raw.content : data.cell.raw;
          if (cellText === 'OUI') { data.cell.styles.textColor = THEME.yes; data.cell.styles.fontStyle = 'bold'; }
          else if (cellText === 'NON') { data.cell.styles.textColor = THEME.no; data.cell.styles.fontStyle = 'bold'; }
          else if (cellText === '—') { data.cell.styles.textColor = [180, 180, 180]; }
          const conclVals = Object.values(conclLabelsA);
          if (conclVals.includes(cellText)) {
            const conclKey = Object.keys(conclLabelsA).find(k => conclLabelsA[k] === cellText) || 'reguliere';
            data.cell.styles.textColor = conclColorsA[conclKey] || THEME.yes;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 6;
          }
        }
        if (data.section === 'head' && data.row.index === 0 && data.column.index > 0) {
          // Company color on first header row
          const sc = subColumns[data.column.index - 1];
          if (sc) data.cell.styles.fillColor = getCompanyStyle(sc.companyIndex).header;
        }
        if (data.section === 'head' && data.row.index === 1 && data.column.index > 0) {
          // Member sub-header: lighter shade
          const sc = subColumns[data.column.index - 1];
          if (sc) {
            const c = getCompanyStyle(sc.companyIndex).header;
            data.cell.styles.fillColor = [Math.min(255, c[0] + 40), Math.min(255, c[1] + 40), Math.min(255, c[2] + 40)];
            data.cell.styles.fontSize = 5.5;
          }
        }
      },
      margin: { left: M, right: M },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── SECTION 6.bis : CONFORMITÉ ET ANOMALIES DÉTECTÉES ──
  // Pour chaque entreprise avec écart AE / écart quantité, liste détaillée
  {
    const irregularCompanies = analysisCompanies.filter(c => {
      const admin = companiesData[c.name]?.admin || {};
      return (c.amountMismatch || (c.quantityMismatches || []).length > 0 || ['irreguliere', 'inacceptable', 'inappropriee'].includes(admin.conclusion));
    });

    if (irregularCompanies.length > 0) {
      y = addPage('Conformité et anomalies', 'a4', 'portrait');
      tocEntries.push({ label: '5.bis Conformité et anomalies', page: pageNum });
      y = sectionTitle(doc, '5.bis  Conformité et anomalies (CCP L2152-2)', y, THEME.primary);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const introCnf = "Les offres présentant des écarts avec le DQE ou avec leur acte d'engagement sont signalées ci-dessous. Conformément à l'article L2152-2 du CCP, une offre qui modifie les quantités du DQE est considérée comme irrégulière (régularisable manuellement par décision motivée du pouvoir adjudicateur).";
      ({ y } = drawJustifiedText(doc, introCnf, M, y, W - 2 * M, 4.5));
      y += 6;

      irregularCompanies.forEach(c => {
        const admin = companiesData[c.name]?.admin || {};
        const concl = admin.conclusion || 'reguliere';
        const conclLabel = { reguliere: 'RÉGULIÈRE', irreguliere: 'IRRÉGULIÈRE', inacceptable: 'INACCEPTABLE', inappropriee: 'INAPPROPRIÉE' }[concl] || concl;

        // Pagination
        if (y > 250) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }

        // Header entreprise
        doc.setFillColor(...VERT_CLAIR);
        doc.rect(M, y, W - 2 * M, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...VERT_FONCE);
        doc.text(cleanText(c.name), M + 3, y + 5);

        // Badge statut
        const badgeColor = concl === 'reguliere' ? THEME.yes : (concl === 'irreguliere' ? [255, 140, 0] : THEME.no);
        const badgeW = doc.getTextWidth(conclLabel) + 6;
        doc.setFillColor(...badgeColor);
        doc.roundedRect(W - M - badgeW - 3, y + 1, badgeW, 5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(conclLabel, W - M - badgeW / 2 - 3, y + 4.5, { align: 'center' });
        y += 10;

        // Écart AE (si présent)
        if (c.amountMismatch) {
          const mm = c.amountMismatch;
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.text);
          doc.text("Écart Acte d'Engagement vs total recalculé", M + 3, y);
          y += 5;

          autoTable(doc, {
            startY: y,
            head: [['Annoncé AE', 'Recalculé', 'Écart', '%']],
            body: [[
              fmt(mm.expectedAe) + ' €',
              fmt(mm.computedTotal) + ' €',
              { content: (mm.delta >= 0 ? '+' : '') + fmt(mm.delta) + ' €', styles: { textColor: mm.delta > 0 ? [180, 80, 50] : [30, 130, 50], fontStyle: 'bold' } },
              { content: (mm.deltaPct >= 0 ? '+' : '') + mm.deltaPct + ' %', styles: { textColor: mm.delta > 0 ? [180, 80, 50] : [30, 130, 50] } },
            ]],
            styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2, halign: 'center' },
            headStyles: { fillColor: [254, 215, 170], textColor: [120, 60, 0], fontStyle: 'bold', halign: 'center' },
            margin: { left: M, right: M },
            didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
          });
          y = doc.lastAutoTable.finalY + 4;
        }

        // Écarts de quantités vs DQE
        const qtyMM = c.quantityMismatches || [];
        if (qtyMM.length > 0) {
          if (y > 240) { y = addPage('Conformité et anomalies (suite)', 'a4', 'portrait'); }
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.text);
          doc.text(`Écarts de quantités vs DQE — ${qtyMM.length} article${qtyMM.length > 1 ? 's' : ''}`, M + 3, y);
          y += 5;
          autoTable(doc, {
            startY: y,
            head: [['Article', 'Unité', 'Qté DQE', 'Qté offre', 'Écart']],
            body: qtyMM.slice(0, 30).map(m => [
              cleanText(m.designation || ''),
              m.unit || '',
              { content: fmt(m.moeQty), styles: { halign: 'right' } },
              { content: fmt(m.offerQty), styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 53, 69] } },
              { content: (m.delta >= 0 ? '+' : '') + fmt(m.delta), styles: { halign: 'right', textColor: m.delta > 0 ? [180, 80, 50] : [30, 80, 180] } },
            ]),
            styles: { font: 'Helvetica', fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [254, 202, 202], textColor: [120, 30, 30], fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 25 } },
            margin: { left: M, right: M },
            didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
          });
          y = doc.lastAutoTable.finalY + 4;
          if (qtyMM.length > 30) {
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text(`(${qtyMM.length - 30} articles supplémentaires non affichés — voir l'analyse complète dans l'application)`, M + 3, y);
            y += 5;
          }
        }

        // Raison du flag automatique
        if (admin.autoFlaggedReason) {
          doc.setFontSize(7);
          doc.setTextColor(120, 60, 0);
          const reasonLabel = admin.autoFlaggedReason === 'quantity_mismatch' ? 'Flag automatique : quantités du DQE modifiées par le soumissionnaire (L2152-2)' : `Flag automatique : ${admin.autoFlaggedReason}`;
          doc.text(reasonLabel, M + 3, y);
          y += 5;
        }

        y += 4;
      });
    }
  }

  // ── ANALYSE FINANCIÈRE ──
  if (analysisStats && analysisCompanies.length > 0) {
    y = addPage('Analyse financière — Synthèse', 'a4', 'portrait');
    tocEntries.push({ label: '6. Synthèse de l\'analyse financière', page: pageNum });
    y = sectionTitle(doc, `6  SYNTHÈSE DE L'ANALYSE FINANCIÈRE`, y, THEME.primary);

    const maxScore = Number(scoringConfig?.maxScore || 40);
    const grandTotalBase = analysisStats.totalEstimation || 0;
    const NON_REGULAR_SYNTH = ['irreguliere', 'inacceptable', 'inappropriee'];

    // 1. Construire la liste : base régulière + variantes retenues (irrégulières éliminées)
    const synthRows = [];
    analysisCompanies.forEach(c => {
      const admin = companiesData[c.name]?.admin || {};
      const isBaseIrregular = admin.conclusion && NON_REGULAR_SYNTH.includes(admin.conclusion);
      // Base : uniquement si régulière
      if (!isBaseIrregular) {
        synthRows.push({
          id: c.id, name: c.name, kind: 'base',
          total: analysisStats.companiesTotals[c.id] || 0,
        });
      }
      // Variantes retenues : ajoutées en plus
      (c.variants || []).filter(v => v.retained).forEach((v, vi) => {
        const vConcl = v.adminConclusion || null;
        if (vConcl && NON_REGULAR_SYNTH.includes(vConcl)) return; // variante elle-même irrégulière → exclue
        synthRows.push({
          id: `${c.id}_${v.id}`,
          name: c.name,
          kind: 'variant',
          variantIndex: vi + 1,
          variantLabel: v.label || `Variante ${vi + 1}`,
          baseCompanyId: c.id,
          total: Number(v.total || 0),
        });
      });
    });

    // 2. Recalcul Pmin/Pmoy/Pmax sur les lignes valides (prix > 0)
    const validPrices = synthRows.map(r => r.total).filter(t => t > 0);
    const PminS = validPrices.length ? Math.min(...validPrices) : 0;
    const PmaxS = validPrices.length ? Math.max(...validPrices) : 0;
    const PmoyS = validPrices.length ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;
    const modeS = scoringConfig?.mode || 'f1';
    const scoreForS = (p) => {
      if (p <= 0 || PminS <= 0) return 0;
      let s = 0;
      switch (modeS) {
        case 'f1': s = maxScore * (PminS / p); break;
        case 'f2': s = maxScore * Math.pow(PminS / p, 2); break;
        case 'f3': s = maxScore * Math.pow(PminS / p, 3); break;
        case 'f4': s = maxScore * (1 - (p - PminS) / PminS); break;
        case 'f5': s = maxScore * (1 - (p - PminS) / PmoyS); break;
        case 'f6': s = p <= PmoyS ? maxScore * Math.sqrt(PminS / p) : maxScore * Math.pow(PminS / p, 2); break;
        case 'f7': s = PmaxS === PminS ? maxScore : maxScore * (1 - (p - PminS) / (PmaxS - PminS)); break;
        case 'f8': s = (maxScore * PmoyS) / (PmoyS + p); break;
        case 'f9': s = maxScore * ((2 * PminS) / (PminS + p)); break;
        default:   s = 0;
      }
      return Math.max(0, Math.min(maxScore, s));
    };

    const summaryData = synthRows.map(r => ({
      ...r,
      score: scoreForS(r.total),
      deviation: grandTotalBase > 0 ? ((r.total - grandTotalBase) / grandTotalBase) * 100 : 0,
    }));
    summaryData.sort((a, b) => b.score - a.score);

    const summaryBody = summaryData.map((d, index) => {
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const ttc = d.total * 1.2;
      const isVariant = d.kind === 'variant';
      const displayName = isVariant
        ? `  > ${d.name} - V${d.variantIndex}${d.variantLabel ? ` (${d.variantLabel})` : ''}`
        : d.name;
      const rangSuffix = index === 0 ? 'er' : 'ème';
      const nameStyles = isVariant
        ? { textColor: [88, 28, 135], fontStyle: 'italic', fontSize: 8 }
        : { textColor: cStyle.header, fontStyle: 'bold' };
      return [
        { content: `${index + 1}${rangSuffix}`, styles: { fontStyle: 'bold', halign: 'center', fillColor: isVariant ? [243, 232, 255] : undefined } },
        { content: displayName, styles: { ...nameStyles, fillColor: isVariant ? [243, 232, 255] : undefined } },
        { content: formatNumberFr(d.total) + ' €', styles: { fontStyle: 'bold', halign: 'right', fillColor: isVariant ? [243, 232, 255] : undefined } },
        { content: formatNumberFr(ttc) + ' €', styles: { halign: 'right', fillColor: isVariant ? [243, 232, 255] : undefined } },
        { content: (d.deviation > 0 ? '+' : '') + d.deviation.toFixed(2) + '%', styles: { textColor: d.deviation > 0 ? [200, 0, 0] : [0, 150, 0], halign: 'center', fillColor: isVariant ? [243, 232, 255] : undefined } },
        { content: d.score.toFixed(2) + ` / ${maxScore}`, styles: { fontStyle: 'bold', halign: 'center', fillColor: isVariant ? [243, 232, 255] : undefined } }
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [['Rang', 'Entreprise', 'Montant HT', 'Montant TTC', 'Écart / Estim.', 'Note Finale']],
      body: summaryBody,
      theme: 'striped',
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 5: { cellWidth: 28 } },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 8;

    // Barres visuelles des montants
    const maxTotal = Math.max(...summaryData.map(d => d.total));
    const barW = W - 80;
    summaryData.forEach((d) => {
      if (y > 270) { y = addPage('Analyse financière — Synthèse', 'a4', 'portrait'); }
      const origIdx = analysisCompanies.findIndex(c => c.name === d.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...cStyle.header);
      const bHf = 6;
      doc.text(d.name, M, y + bHf / 2 + 1);
      // Barre sans label intérieur : le montant est affiché à droite
      drawScoreBar(doc, 55, y, barW, bHf, d.total, maxTotal, cStyle.header, { label: null });
      doc.setTextColor(...THEME.lightText);
      doc.setFontSize(6);
      doc.text(fmt(d.total) + ' €', 55 + barW + 2, y + bHf / 2 + 1);
      y += 9;
    });
    y += 6;

    // ── DÉTAIL DES PRIX UNITAIRES — Un tableau A3 par tranche ──
    if (chaptersData && chaptersData.length > 0) {

      // Helper : construit chaptersData pour une tranche donnée
      const buildTrancheChapters = (trancheId) => {
        return (project?.chapters || []).map(chapter => {
          const items = [];
          const extract = (nodes) => {
            nodes.forEach(node => {
              if (node.type === 'item') {
                const rawQty = trancheId ? node.quantities?.[trancheId] : node.qty;
                const activeQty = Number(rawQty) || 0;
                items.push({ ...node, activeQty });
              } else if (node.children) extract(node.children);
            });
          };
          extract(chapter.children || []);
          return { id: chapter.id, title: chapter.title, isOption: chapter.isOption, items };
        });
      };

      // Déterminer les tranches à afficher
      const hasTr = tranches && tranches.length > 0;
      const trancheList = hasTr
        ? tranches.map(t => ({ id: t.id, name: t.name || t.id, chapters: buildTrancheChapters(t.id) }))
        : [{ id: 'global', name: 'Global', chapters: chaptersData }];

      let tocAdded = false;

      // ─── Construction des "colonnes virtuelles" : base régulière + variantes retenues ─
      // Même logique que l'onglet d'analyse financière de l'app (AnalysisTable).
      // Exclusion des bases irrégulières (CCP L2152-2).
      const NON_REG_DETAIL = ['irreguliere', 'inacceptable', 'inappropriee'];
      const detailColumns = [];
      analysisCompanies.forEach((c, idx) => {
        const admin = companiesData[c.name]?.admin || {};
        const isBaseIrregular = admin.conclusion && NON_REG_DETAIL.includes(admin.conclusion);
        if (!isBaseIrregular) {
          detailColumns.push({
            key: `${c.id}_base`,
            companyId: c.id,
            companyName: c.name,
            companyIndex: idx,
            kind: 'base',
            offers: c.offers || {},
            quantities: {},
            removedIds: new Set(),
            newItems: [],
          });
        }
        // Variantes retenues uniquement (CCP R2151-11)
        (c.variants || []).filter(v => v.retained).forEach((v, vi) => {
          const vConcl = v.adminConclusion || null;
          if (vConcl && NON_REG_DETAIL.includes(vConcl)) return;
          detailColumns.push({
            key: `${c.id}_${v.id}`,
            companyId: c.id,
            companyName: c.name,
            companyIndex: idx,
            variantIndex: vi + 1,
            variantLabel: v.label || `Variante ${vi + 1}`,
            kind: 'variant',
            offers: { ...(c.offers || {}), ...(v.offers || {}) },
            quantities: v.quantities || {},
            removedIds: new Set((v.removedItems || []).map(it => it.itemId)),
            newItems: v.newItems || [],
          });
        });
      });

      // Nombre de sous-colonnes par "colonne" : 3 (base) ou 4 (variante avec Qté var)
      const subCount = (col) => col.kind === 'variant' ? 4 : 3;
      const totalSubCols = detailColumns.reduce((a, c) => a + subCount(c), 0);

      trancheList.forEach((tranche) => {
        const trLabel = hasTr ? tranche.name : 'Détail des Prix Unitaires';
        y = addPage(`Analyse financière — ${trLabel}`, 'a3', 'landscape');
        if (!tocAdded) {
          tocEntries.push({ label: '7. Détail des prix unitaires (A3)', page: pageNum });
          tocAdded = true;
        }

        doc.setFontSize(14); doc.setTextColor(...THEME.primary); doc.setFont("Helvetica", "bold");
        const title = hasTr ? `DÉTAIL DES PRIX UNITAIRES — ${tranche.name.toUpperCase()}` : "DÉTAIL DES PRIX UNITAIRES";
        doc.text(title, M, y);

        if (analysisMode === 'oab' || analysisMode === 'heatmap') {
          doc.setFontSize(8); doc.setTextColor(0); doc.setFont("Helvetica", "normal");
          if (analysisMode === 'oab') {
            doc.setFillColor(255, 237, 213); doc.rect(80, y - 3, 4, 4, 'F');
            doc.text("Prix bas suspecté (OAB)", 86, y);
          } else if (analysisMode === 'heatmap') {
            doc.setFillColor(248, 113, 113); doc.rect(80, y - 3, 4, 4, 'F'); doc.text("> +50%", 86, y);
            doc.setFillColor(52, 211, 153); doc.rect(100, y - 3, 4, 4, 'F'); doc.text("< -50%", 106, y);
          }
        }
        y += 6;

        const trChapters = tranche.chapters;

        // Calcul totaux pour cette tranche (par colonne virtuelle)
        let trEstTotal = 0;
        const trColumnTotals = {};
        detailColumns.forEach(col => { trColumnTotals[col.key] = 0; });
        trChapters.forEach(chap => {
          if (chap.isOption) return;
          chap.items.forEach(item => {
            trEstTotal += item.activeQty * (item.price || 0);
            detailColumns.forEach(col => {
              if (col.removedIds.has(item.id)) return;
              const pu = Number(col.offers[item.id] || 0);
              const qty = col.quantities[item.id] != null ? Number(col.quantities[item.id]) : item.activeQty;
              trColumnTotals[col.key] += qty * pu;
            });
          });
        });

        const tableBody = [];
        const mainHeaders = [
          { content: 'N°', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Désignation', rowSpan: 2, styles: { halign: 'left', valign: 'middle', cellWidth: 60 } },
          { content: 'U', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Qté', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Estimation', colSpan: 2, styles: { halign: 'center', fillColor: [240, 240, 255] } }
        ];
        const subHeaders = [
          { content: 'P.U.', styles: { halign: 'right', fillColor: [240, 240, 255], fontStyle: 'bold' } },
          { content: 'Total', styles: { halign: 'right', fillColor: [240, 240, 255], fontStyle: 'bold' } }
        ];
        const columnStyles = {};

        let runningColIdx = 6;
        detailColumns.forEach((col) => {
          const style = getCompanyStyle(col.companyIndex);
          const isVar = col.kind === 'variant';
          // Variante = même couleur que l'entreprise mais plus claire (header + body)
          const headerBg = isVar ? lighten(style.header, 0.45) : style.header;
          const headerText = isVar ? style.text : [255, 255, 255];
          const bodyBg = isVar ? lighten(style.header, 0.88) : style.body;
          const labelTitle = isVar
            ? `${col.companyName} - V${col.variantIndex} (RETENUE)`
            : col.companyName;

          mainHeaders.push({
            content: labelTitle,
            colSpan: subCount(col),
            styles: { halign: 'center', fillColor: headerBg, fontStyle: 'bold', textColor: headerText },
          });
          if (isVar) {
            subHeaders.push({ content: 'Qté var', styles: { halign: 'center', fillColor: bodyBg, textColor: style.text, fontStyle: 'bold' } });
          }
          subHeaders.push({ content: 'P.U.', styles: { halign: 'right', fillColor: bodyBg, textColor: style.text } });
          subHeaders.push({ content: 'Total', styles: { halign: 'right', fillColor: bodyBg, textColor: style.text } });
          subHeaders.push({ content: '%', styles: { halign: 'center', fillColor: bodyBg, textColor: style.text } });

          for (let i = 0; i < subCount(col); i++) {
            columnStyles[runningColIdx + i] = { fillColor: bodyBg };
          }
          runningColIdx += subCount(col);
        });

        trChapters.forEach(chapter => {
          const activeItems = chapter.items.filter(i => i.activeQty > 0);
          if (activeItems.length === 0) return;

          tableBody.push([{ content: chapter.title.toUpperCase(), colSpan: 6 + totalSubCols, styles: { fillColor: [220, 220, 225], fontStyle: 'bold', textColor: [50, 50, 60] } }]);
          activeItems.forEach((item) => {
            const qty = item.activeQty;
            const estTotal = item.price * qty;
            const row = [
              { content: bpuRefMap?.get?.(item.id) || (item.bpuNum || '-') },
              { content: cleanText(item.designation) },
              { content: normalizeUnitSymbol(item.unit) },
              { content: qty },
              { content: formatNumberFr(item.price) },
              { content: formatNumberFr(estTotal), styles: { fontStyle: 'bold' } }
            ];
            const itemPrices = detailColumns.map(col => Number(col.offers[item.id] || 0));
            const lineOabThreshold = analysisMode === 'oab' ? calculateOABThreshold(itemPrices) : 0;

            detailColumns.forEach((col) => {
              const isVar = col.kind === 'variant';
              const isRemoved = col.removedIds.has(item.id);
              const variantQty = col.quantities[item.id];
              const activeQty = variantQty != null ? Number(variantQty) : qty;
              const priceVal = col.offers[item.id];
              const price = (priceVal !== undefined && priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
              const hasPrice = price !== null && !isRemoved;
              const total = hasPrice ? price * activeQty : 0;
              const deviation = (hasPrice && item.price > 0) ? ((price - item.price) / item.price) * 100 : 0;
              let cellStyle = {};
              if (isRemoved) {
                cellStyle = { fillColor: [241, 245, 249], textColor: [150, 150, 150], fontStyle: 'italic' };
              } else if (analysisMode === 'oab' && hasPrice && price > 0 && price < lineOabThreshold) {
                cellStyle = { fillColor: [255, 237, 213], textColor: [180, 83, 9], fontStyle: 'bold' };
              } else if (analysisMode === 'heatmap' && hasPrice && item.price > 0) {
                const hs = getHeatmapStyle(price, item.price);
                if (hs) cellStyle = { fillColor: hs.fill, textColor: hs.text, fontStyle: 'bold' };
              }

              // Pour les variantes : ajouter colonne Qté var en premier
              if (isVar) {
                const qtyChanged = variantQty != null && Number(variantQty) !== qty;
                row.push({
                  content: isRemoved ? '-' : String(activeQty),
                  styles: { halign: 'center', fontStyle: qtyChanged ? 'bold' : 'normal', textColor: qtyChanged ? [180, 83, 9] : undefined },
                });
              }

              row.push({ content: isRemoved ? 'supprimé' : (hasPrice ? formatNumberFr(price) : '-'), styles: { halign: 'right', ...cellStyle } });
              row.push({ content: isRemoved ? '-' : (hasPrice ? formatNumberFr(total) : '-'), styles: { halign: 'right' } });
              row.push({ content: isRemoved ? '-' : (hasPrice ? (deviation > 0 ? '+' : '') + deviation.toFixed(0) + '%' : '-'), styles: { halign: 'center', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fontSize: 6 } });
            });
            tableBody.push(row);
          });

          // Total chapitre
          {
            const chapEstTotal = activeItems.reduce((acc, i) => acc + (i.activeQty * i.price), 0);
            const isPSE = chapter.isOption;
            const bgColor  = isPSE ? [254, 243, 199] : [226, 232, 240];
            const prefix   = isPSE ? 'PSE — ' : 'TOTAL ';
            const chapTotalRow = [
              { content: `${prefix}${chapter.title.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } },
              { content: '', colSpan: 1, styles: { fillColor: bgColor } },
              { content: formatNumberFr(chapEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } }
            ];
            detailColumns.forEach(col => {
              const isVar = col.kind === 'variant';
              const totalChap = activeItems.reduce((acc, i) => {
                if (col.removedIds.has(i.id)) return acc;
                const p = Number(col.offers[i.id] || 0);
                const q = col.quantities[i.id] != null ? Number(col.quantities[i.id]) : i.activeQty;
                return acc + q * p;
              }, 0);
              const deviation = chapEstTotal > 0 ? ((totalChap - chapEstTotal) / chapEstTotal) * 100 : 0;
              if (isVar) chapTotalRow.push({ content: '', styles: { fillColor: bgColor } }); // Qté var
              chapTotalRow.push({ content: '', styles: { fillColor: bgColor } });
              chapTotalRow.push({ content: formatNumberFr(totalChap), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgColor } });
              chapTotalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(1) + '%', styles: { halign: 'center', fontSize: 7, fontStyle: 'bold', textColor: deviation > 0 ? [220, 38, 38] : [21, 128, 61], fillColor: bgColor } });
            });
            tableBody.push(chapTotalRow);
            tableBody.push([{ content: '', colSpan: 6 + totalSubCols, styles: { cellPadding: 1, fillColor: [255, 255, 255] } }]);
          }
        });

        // ─── Articles hors DQE (newItems des variantes retenues) ────────────
        const newItemsByCol = detailColumns
          .filter(col => col.kind === 'variant' && (col.newItems || []).length > 0)
          .flatMap(col => col.newItems.filter(it => Number(it.qty || 0) > 0).map(it => ({ ...it, col })));
        if (newItemsByCol.length > 0) {
          tableBody.push([{ content: 'ARTICLES HORS DQE (AJOUTÉS PAR VARIANTES)', colSpan: 6 + totalSubCols, styles: { fillColor: [220, 252, 231], fontStyle: 'bold', textColor: [22, 101, 52] } }]);
          // Agrégation par (ref + désignation)
          const aggMap = new Map();
          newItemsByCol.forEach(({ col, ...it }) => {
            const key = `${(it.ref || '').toLowerCase()}|${(it.designation || '').toLowerCase()}`;
            if (!aggMap.has(key)) {
              aggMap.set(key, { ref: it.ref || '+', designation: it.designation || '', unit: it.unit || '', perCol: {} });
            }
            aggMap.get(key).perCol[col.key] = { qty: it.qty, price: it.price, total: it.lineTotal || (it.qty * it.price) };
          });
          [...aggMap.values()].forEach(row => {
            const r = [
              { content: row.ref, styles: { fontSize: 6 } },
              { content: '+ ' + cleanText(row.designation), styles: { fontStyle: 'italic', textColor: [22, 101, 52] } },
              { content: normalizeUnitSymbol(row.unit), styles: { halign: 'center' } },
              { content: '-', styles: { halign: 'center', textColor: [180, 180, 180] } },
              { content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } },
              { content: 'Hors estim.', styles: { halign: 'right', fontSize: 6, fontStyle: 'italic', textColor: [120, 120, 120] } },
            ];
            detailColumns.forEach(col => {
              const cell = row.perCol[col.key];
              const isVar = col.kind === 'variant';
              if (!isVar) {
                // Base : pas de nouveaux articles → tirets
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'center', textColor: [180, 180, 180], fontSize: 6 } });
                return;
              }
              // Variante : Qté var + PU + Total + %
              if (cell) {
                r.push({ content: String(cell.qty), styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 252, 231] } });
                r.push({ content: formatNumberFr(cell.price), styles: { halign: 'right', fillColor: [220, 252, 231] } });
                r.push({ content: formatNumberFr(cell.total), styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 252, 231] } });
                r.push({ content: '+', styles: { halign: 'center', fontStyle: 'bold', textColor: [22, 101, 52], fillColor: [220, 252, 231] } });
              } else {
                r.push({ content: '-', styles: { halign: 'center', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'right', textColor: [180, 180, 180] } });
                r.push({ content: '-', styles: { halign: 'center', textColor: [180, 180, 180], fontSize: 6 } });
              }
            });
            tableBody.push(r);
          });
        }

        // Total HT tranche (avec newItems pour les variantes)
        const totalRow = [
          { content: `TOTAL ${hasTr ? tranche.name.toUpperCase() : 'GÉNÉRAL'} HT`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: '-', styles: { halign: 'center' } },
          { content: formatNumberFr(trEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } },
        ];
        detailColumns.forEach(col => {
          const isVar = col.kind === 'variant';
          let total = trColumnTotals[col.key] || 0;
          if (isVar) {
            total += (col.newItems || []).reduce((s, it) => s + Number(it.lineTotal || (it.qty * it.price) || 0), 0);
          }
          const deviation = trEstTotal > 0 ? ((total - trEstTotal) / trEstTotal) * 100 : 0;
          if (isVar) totalRow.push({ content: '-', styles: { halign: 'center' } });
          totalRow.push({ content: '-', styles: { halign: 'center' } });
          totalRow.push({ content: formatNumberFr(total), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255] } });
          totalRow.push({ content: (deviation > 0 ? '+' : '') + deviation.toFixed(2) + '%', styles: { halign: 'center', fontStyle: 'bold' } });
        });
        tableBody.push(totalRow);

        // TVA 20%
        const tvaRate = 0.20;
        const tvaEstTotal = trEstTotal * tvaRate;
        const tvaRow = [{ content: 'TVA (20%)', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } }, { content: '', styles: { fillColor: [245, 245, 250] } }, { content: formatNumberFr(tvaEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } }];
        detailColumns.forEach(col => {
          const isVar = col.kind === 'variant';
          let total = trColumnTotals[col.key] || 0;
          if (isVar) total += (col.newItems || []).reduce((s, it) => s + Number(it.lineTotal || (it.qty * it.price) || 0), 0);
          const tva = total * tvaRate;
          if (isVar) tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
          tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
          tvaRow.push({ content: formatNumberFr(tva), styles: { halign: 'right', fillColor: [245, 245, 250] } });
          tvaRow.push({ content: '', styles: { fillColor: [245, 245, 250] } });
        });
        tableBody.push(tvaRow);

        // Total TTC
        const ttcEstTotal = trEstTotal + tvaEstTotal;
        const ttcRow = [{ content: `TOTAL ${hasTr ? tranche.name.toUpperCase() : 'GÉNÉRAL'} TTC`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }, { content: '', styles: { fillColor: [209, 250, 229] } }, { content: formatNumberFr(ttcEstTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } }];
        detailColumns.forEach(col => {
          const isVar = col.kind === 'variant';
          let total = trColumnTotals[col.key] || 0;
          if (isVar) total += (col.newItems || []).reduce((s, it) => s + Number(it.lineTotal || (it.qty * it.price) || 0), 0);
          const ttc = total * (1 + tvaRate);
          if (isVar) ttcRow.push({ content: '', styles: { fillColor: [209, 250, 229] } });
          ttcRow.push({ content: '', styles: { fillColor: [209, 250, 229] } });
          ttcRow.push({ content: formatNumberFr(ttc), styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229] } });
          ttcRow.push({ content: '', styles: { fillColor: [209, 250, 229] } });
        });
        tableBody.push(ttcRow);

        autoTable(doc, {
          startY: y,
          head: [mainHeaders, subHeaders],
          body: tableBody,
          theme: 'grid',
          styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [180, 180, 180] },
          columnStyles,
          margin: { left: 10, right: 10 },
          didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
        });
      }); // fin boucle tranches
    }
  }

  // ── SECTION 8.bis : ANALYSE DES VARIANTES RETENUES ──
  // Pour chaque entreprise ayant des variantes retenues, détail des modifications
  {
    const companiesWithRetainedVariants = analysisCompanies.filter(c =>
      (c.variants || []).some(v => v.retained)
    );

    if (companiesWithRetainedVariants.length > 0) {
      y = addPage('Variantes retenues', 'a4', 'portrait');
      tocEntries.push({ label: '7.bis Analyse des variantes retenues', page: pageNum });
      y = sectionTitle(doc, '7.bis  Analyse des variantes retenues (CCP R2151-11)', y, THEME.primary);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...THEME.lightText);
      const introVar = "Les variantes ci-dessous ont été déclarées 'retenues' par le pouvoir adjudicateur. Conformément à l'article R2151-11 du CCP, la variante retenue se substitue à la solution de base dans ses éléments qui en diffèrent.";
      ({ y } = drawJustifiedText(doc, introVar, M, y, W - 2 * M, 4.5));
      y += 6;

      companiesWithRetainedVariants.forEach(c => {
        const retainedVariants = (c.variants || []).filter(v => v.retained);
        retainedVariants.forEach((v, vi) => {
          if (y > 240) { y = addPage('Variantes retenues (suite)', 'a4', 'portrait'); }

          // Header variante
          doc.setFillColor(...VERT_CLAIR);
          doc.rect(M, y, W - 2 * M, 12, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...VERT_FONCE);
          doc.text(`${cleanText(c.name)} — V${vi + 1} ${v.label ? `(${cleanText(v.label)})` : ''}`, M + 3, y + 5);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...THEME.lightText);
          doc.text(`Total HT : ${fmt(v.total || 0)} €  •  Base HT : ${fmt(analysisStats?.companiesTotals?.[c.id] || 0)} €`, M + 3, y + 10);
          y += 16;

          if (v.description) {
            doc.setFontSize(8);
            doc.setTextColor(...THEME.lightText);
            const descTxt = `Descriptif : ${v.description}`;
            ({ y } = drawJustifiedText(doc, descTxt, M + 3, y, W - 2 * M - 3, 4.5));
            y += 3;
          }

          // ► Justification de l'acceptation (saisie en tab Technique)
          if (v.justification && v.justification.trim()) {
            // Encadré vert clair pour faire ressortir la motivation
            doc.setFillColor(236, 253, 245); // emerald-50
            const tmpY = y;
            // Calcul approximatif de la hauteur avant de dessiner le fond
            const justifLines = doc.splitTextToSize(v.justification, W - 2 * M - 10);
            const justifH = 6 + justifLines.length * 4.2 + 4;
            doc.rect(M + 3, y, W - 2 * M - 3, justifH, 'F');
            doc.setDrawColor(167, 243, 208); // emerald-200
            doc.setLineWidth(0.3);
            doc.rect(M + 3, y, W - 2 * M - 3, justifH);
            // Label
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(6, 78, 59); // emerald-900
            doc.text("Motivation de l'acceptation par le pouvoir adjudicateur :", M + 6, y + 5);
            // Texte justifié
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 50, 40);
            ({ y } = drawJustifiedText(doc, v.justification, M + 6, y + 9, W - 2 * M - 12, 4.2));
            y = tmpY + justifH + 4;
          }

          // Articles ajoutés (newItems)
          const newItems = (v.newItems || []).filter(it => Number(it.qty || 0) > 0);
          if (newItems.length > 0) {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.text);
            doc.text(`Articles ajoutés (+ ${newItems.length})`, M + 3, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Réf', 'Désignation', 'Unité', 'Qté', 'PU', 'Total']],
              body: newItems.map(it => [
                it.ref || '',
                cleanText(it.designation || ''),
                it.unit || '',
                { content: fmt(it.qty), styles: { halign: 'right' } },
                { content: fmt(it.price), styles: { halign: 'right' } },
                { content: fmt(it.lineTotal || it.qty * it.price), styles: { halign: 'right', fontStyle: 'bold' } },
              ]),
              styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold' },
              margin: { left: M, right: M },
              didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
            });
            y = doc.lastAutoTable.finalY + 4;
          }

          // Articles supprimés (removedItems)
          const removedItems = (v.removedItems || []).filter(it => Number(it.lostAmount || 0) > 0);
          if (removedItems.length > 0) {
            if (y > 250) { y = addPage('Variantes retenues (suite)', 'a4', 'portrait'); }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.text);
            doc.text(`Articles supprimés (- ${removedItems.length})`, M + 3, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Désignation', 'Unité', 'Qté DQE', 'PU base', 'Montant perdu']],
              body: removedItems.map(it => [
                cleanText(it.designation || ''),
                it.unit || '',
                { content: fmt(it.moeQty), styles: { halign: 'right' } },
                { content: fmt(it.basePrice), styles: { halign: 'right' } },
                { content: '- ' + fmt(it.lostAmount), styles: { halign: 'right', fontStyle: 'bold', textColor: [120, 60, 60] } },
              ]),
              styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
              margin: { left: M, right: M },
              didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
            });
            y = doc.lastAutoTable.finalY + 4;
          }

          // Quantités modifiées
          const qtyChanges = (v.mismatchesVsMoe || []).filter(m => Number(m.delta || 0) !== 0);
          if (qtyChanges.length > 0) {
            if (y > 250) { y = addPage('Variantes retenues (suite)', 'a4', 'portrait'); }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...THEME.text);
            doc.text(`Quantités modifiées (${qtyChanges.length})`, M + 3, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Désignation', 'Qté DQE', 'Qté variante', 'Écart']],
              body: qtyChanges.slice(0, 25).map(m => [
                cleanText(m.designation || ''),
                { content: fmt(m.moeQty), styles: { halign: 'right' } },
                { content: fmt(m.offerQty), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: (m.delta >= 0 ? '+' : '') + fmt(m.delta), styles: { halign: 'right', textColor: m.delta > 0 ? [180, 80, 50] : [30, 80, 180] } },
              ]),
              styles: { font: 'Helvetica', fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [254, 215, 170], textColor: [120, 60, 0], fontStyle: 'bold' },
              margin: { left: M, right: M },
              didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
            });
            y = doc.lastAutoTable.finalY + 6;
          }

          y += 4;
        });
      });
    }
  }

  // ── SECTION 8.ter : PSE / OPTIONS ──
  // Décision sur les chapitres marqués comme options dans le DQE
  if (optionChapters && optionChapters.length > 0) {
    y = addPage('PSE / Options', 'a4', 'portrait');
    tocEntries.push({ label: '7.ter Décision sur les PSE / Options', page: pageNum });
    y = sectionTitle(doc, '7.ter  Prestations Supplémentaires Éventuelles (PSE) / Options', y, THEME.primary);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    const introPse = "Les chapitres déclarés comme options (PSE) dans le DQE sont listés ci-dessous. Pour chaque option, le pouvoir adjudicateur indique si elle est retenue dans le marché final.";
    ({ y } = drawJustifiedText(doc, introPse, M, y, W - 2 * M, 4.5));
    y += 6;

    const pseBody = optionChapters.map(chap => {
      const inclus = !!includedOptions[chap.id];
      return [
        cleanText(chap.title || 'Option sans titre'),
        {
          content: inclus ? 'RETENUE' : 'NON RETENUE',
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [255, 255, 255],
            fillColor: inclus ? [40, 167, 69] : [120, 120, 120],
          },
        },
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Option / PSE', 'Décision']],
      body: pseBody,
      styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { cellWidth: 40, halign: 'center' } },
      alternateRowStyles: { fillColor: THEME.tableAlt },
      margin: { left: M, right: M },
      didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
    });
    y = doc.lastAutoTable.finalY + 6;

    const nbRetenues = optionChapters.filter(c => includedOptions[c.id]).length;
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    doc.text(`${nbRetenues} option${nbRetenues > 1 ? 's' : ''} retenue${nbRetenues > 1 ? 's' : ''} sur ${optionChapters.length}.`, M, y);
  }

  // ── ANALYSE TECHNIQUE — 1 à 2 pages par critère pour aérer la lecture ──
  {
    const nonAutoCriteria = criteria.filter(c => !c.auto);
    if (nonAutoCriteria.length > 0) {
      // Bas de page utile (A4 portrait = 297mm, footer ~20mm)
      const BOTTOM = 297 - 22;

      nonAutoCriteria.forEach((crit, critIdx) => {
        // ► NOUVEAU : chaque critère démarre sur une nouvelle page A4 portrait
        y = addPage('Analyse technique', 'a4', 'portrait');
        if (critIdx === 0) {
          tocEntries.push({ label: '8. Analyse technique', page: pageNum });
        }

        const hasSubs = (crit.subCriteria || []).length > 0;

        // Header critère — bande verte avec poids
        y = sectionTitle(doc, `${critIdx + 2}.  ${crit.label}  (${crit.weight}%)`, y, THEME.primary);
        y += 2;

        // Pondération max = poids critère (échelle de la barre)
        const critMax = Number(crit.weight) || 1;

        if (hasSubs) {
          crit.subCriteria.forEach((sc, si) => {
            // ► Nouvelle page pour chaque sous-critère (sauf le 1er qui reste sous le titre du critère)
            if (si > 0) {
              y = addPage(`${crit.label} (suite)`, 'a4', 'portrait');
              doc.setFont('Helvetica', 'italic');
              doc.setFontSize(8);
              doc.setTextColor(...THEME.lightText);
              doc.text(`Critère : ${crit.label}  (${crit.weight}%)`, M, y);
              y += 6;
            }

            // Bandeau sous-critère — wrap si trop long pour tenir sur 1 ligne
            {
              const bandText = `${critIdx + 2}.${si + 1}  ${sc.label || 'Sous-critère'}  (${sc.weight || 0}%)`;
              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(10);
              const bandLines = doc.splitTextToSize(bandText, W - 2 * M - 6);
              const bandH = Math.max(8, bandLines.length * 5 + 3);
              doc.setFillColor(...VERT_CLAIR);
              doc.rect(M, y, W - 2 * M, bandH, 'F');
              doc.setTextColor(...VERT_FONCE);
              bandLines.forEach((ln, idx) => doc.text(ln, M + 3, y + 5 + idx * 5));
              y += bandH + 4;
            }

            if (sc.description) {
              doc.setFont('Helvetica', 'italic');
              doc.setFontSize(8);
              doc.setTextColor(...THEME.lightText);
              ({ y } = drawJustifiedText(doc, sc.description, M, y, W - 2 * M, 4));
              y += 4;
            }

            const scMax = Number(sc.weight) || 1;
            const FONT_BODY = 8.5, LINE_H = 4.5, MIN_GAP = 6, MAX_GAP = 25;
            const BAR_H = 6, HEADER_BLOCK = BAR_H + 4; // nom + barre + note + petit gap interne

            // Mesure chaque bloc entreprise (texte complet, pas de troncature)
            const blocks = companyNames.map((name, ci) => {
              const tech = companiesData[name]?.technical || {};
              const sd = tech[sc.id] || {};
              let h = HEADER_BLOCK;
              let lines = [];
              if (sd.text) {
                lines = doc.splitTextToSize(sd.text, W - 2 * M - 10);
                h += lines.length * LINE_H;
              }
              return { name, ci, sd, h, lines };
            });

            // Distribution gloutonne sur 1+ pages
            const spaceAvail = BOTTOM - y;
            const pages = [];
            let cur = [], curH = 0;
            for (const b of blocks) {
              const needGap = cur.length > 0 ? MIN_GAP : 0;
              if (curH + needGap + b.h > spaceAvail && cur.length > 0) {
                pages.push(cur);
                cur = [b];
                curH = b.h;
              } else {
                cur.push(b);
                curH += needGap + b.h;
              }
            }
            if (cur.length) pages.push(cur);

            pages.forEach((pg, pgIdx) => {
              if (pgIdx > 0) {
                y = addPage(`${sc.label} (suite ${pgIdx + 1}/${pages.length})`, 'a4', 'portrait');
                // Bandeau de continuation — wrap si trop long
                const bandText = `${critIdx + 2}.${si + 1}  ${sc.label || 'Sous-critère'}  (suite ${pgIdx + 1}/${pages.length})`;
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(10);
                const bandLines = doc.splitTextToSize(bandText, W - 2 * M - 6);
                const bandH = Math.max(8, bandLines.length * 5 + 3);
                doc.setFillColor(...VERT_CLAIR);
                doc.rect(M, y, W - 2 * M, bandH, 'F');
                doc.setTextColor(...VERT_FONCE);
                bandLines.forEach((ln, idx) => doc.text(ln, M + 3, y + 5 + idx * 5));
                y += bandH + 4;
              }
              // Gap aéré : on répartit l'espace restant entre les blocs
              const pageStart = y;
              const totalContent = pg.reduce((a, b) => a + b.h, 0);
              const remainingSpace = (BOTTOM - pageStart) - totalContent;
              const effectiveGap = pg.length > 1
                ? Math.max(MIN_GAP, Math.min(MAX_GAP, remainingSpace / pg.length))
                : 0;

              pg.forEach((b, k) => {
                const cStyle = getCompanyStyle(b.ci);
                const sNote = Number(b.sd.note || 0);
                const sMaxN = Number(b.sd.noteMax || 5);
                const sPond = sMaxN > 0 ? (sNote / sMaxN) * (Number(sc.weight) || 0) : 0;

                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(...cStyle.header);
                doc.text(cleanText(b.name), M + 3, y + BAR_H / 2 + 1.5);
                drawScoreBar(doc, 75, y, W - 115, BAR_H, sPond, scMax, cStyle.header);
                doc.setTextColor(...THEME.text);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(`${sNote}/${sMaxN}  =  ${fmtScore(sPond)}`, W - M, y + BAR_H / 2 + 1.5, { align: 'right' });
                y += BAR_H + 4;

                if (b.lines.length > 0) {
                  doc.setFont('Helvetica', 'normal');
                  doc.setFontSize(FONT_BODY);
                  doc.setTextColor(...THEME.lightText);
                  drawJustifiedText(doc, b.sd.text, M + 10, y, W - 2 * M - 10, LINE_H);
                  y += b.lines.length * LINE_H;
                }

                if (k < pg.length - 1) y += effectiveGap;
              });
            });
          });
        } else {
          if (crit.description) {
            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(...THEME.lightText);
            ({ y } = drawJustifiedText(doc, crit.description, M, y, W - 2 * M, 4));
            y += 4;
          }

          // Même logique de distribution multi-pages que pour les sous-critères
          const FONT_BODY = 8.5, LINE_H = 4.5, MIN_GAP = 6, MAX_GAP = 25;
          const BAR_H = 6, HEADER_BLOCK = BAR_H + 4;

          const blocks = companyNames.map((name, ci) => {
            const tech = companiesData[name]?.technical || {};
            const d = tech[crit.id] || {};
            let h = HEADER_BLOCK;
            let lines = [];
            if (d.text) {
              lines = doc.splitTextToSize(d.text, W - 2 * M - 5);
              h += lines.length * LINE_H;
            }
            return { name, ci, d, h, lines };
          });

          const spaceAvail = BOTTOM - y;
          const pages = [];
          let cur = [], curH = 0;
          for (const b of blocks) {
            const needGap = cur.length > 0 ? MIN_GAP : 0;
            if (curH + needGap + b.h > spaceAvail && cur.length > 0) {
              pages.push(cur);
              cur = [b];
              curH = b.h;
            } else {
              cur.push(b);
              curH += needGap + b.h;
            }
          }
          if (cur.length) pages.push(cur);

          pages.forEach((pg, pgIdx) => {
            if (pgIdx > 0) {
              y = addPage(`${crit.label} (suite ${pgIdx + 1}/${pages.length})`, 'a4', 'portrait');
              y = sectionTitle(doc, `${critIdx + 2}.  ${crit.label}  (${crit.weight}%) — suite ${pgIdx + 1}/${pages.length}`, y, THEME.primary);
              y += 2;
            }
            const pageStart = y;
            const totalContent = pg.reduce((a, b) => a + b.h, 0);
            const remainingSpace = (BOTTOM - pageStart) - totalContent;
            const effectiveGap = pg.length > 1
              ? Math.max(MIN_GAP, Math.min(MAX_GAP, remainingSpace / pg.length))
              : 0;

            pg.forEach((b, k) => {
              const cStyle = getCompanyStyle(b.ci);
              const note = Number(b.d.note || 0);
              const noteMax = Number(b.d.noteMax || 5);
              const notePond = noteMax > 0 ? (note / noteMax) * crit.weight : 0;

              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(9);
              doc.setTextColor(...cStyle.header);
              doc.text(cleanText(b.name), M + 3, y + BAR_H / 2 + 1.5);
              drawScoreBar(doc, 75, y, W - 115, BAR_H, notePond, critMax, cStyle.header);
              doc.setTextColor(...THEME.text);
              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(8);
              doc.text(`${note}/${noteMax}  =  ${fmtScore(notePond)}`, W - M, y + BAR_H / 2 + 1.5, { align: 'right' });
              y += BAR_H + 4;

              if (b.lines.length > 0) {
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(FONT_BODY);
                doc.setTextColor(...THEME.lightText);
                drawJustifiedText(doc, b.d.text, M + 5, y, W - 2 * M - 5, LINE_H);
                y += b.lines.length * LINE_H;
              }

              if (k < pg.length - 1) y += effectiveGap;
            });
          });
        }
      });

      // Tableau récap des notes techniques — toujours sur sa propre page
      y = addPage('Récapitulatif des notes techniques', 'a4', 'portrait');
      y = sectionTitle(doc, 'Récapitulatif des notes techniques', y, THEME.primary);
      const techRecapCols = [];
      nonAutoCriteria.forEach(crit => {
        const hasSubs = (crit.subCriteria || []).length > 0;
        if (hasSubs) {
          crit.subCriteria.forEach((sc) => {
            techRecapCols.push({ id: sc.id, label: `${sc.label || 'SC'}`, weight: sc.weight || 0, parentId: crit.id, isSub: true });
          });
        } else {
          techRecapCols.push({ id: crit.id, label: crit.label, weight: crit.weight, isSub: false });
        }
      });

      const techRecapHead = ['Entreprise', ...techRecapCols.map(c => {
        const short = c.label.length > 14 ? c.label.slice(0, 13) + '...' : c.label;
        return `${short}\n(${c.weight}%)`;
      }), 'Total'];

      const techRecapBody = companyNames.map((name) => {
        const tech = companiesData[name]?.technical || {};
        let total = 0;
        const notes = techRecapCols.map(col => {
          const d = tech[col.id] || {};
          const n = Number(d.note || 0);
          const m = Number(d.noteMax || 5);
          const score = m > 0 ? (n / m) * col.weight : 0;
          total += score;
          return fmtScore(score);
        });
        return [name, ...notes, { content: fmtScore(total), styles: { fontStyle: 'bold' } }];
      });

      autoTable(doc, {
        startY: y,
        head: [techRecapHead],
        body: techRecapBody,
        styles: { font: 'Helvetica', fontSize: 6.5, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 }, [techRecapHead.length - 1]: { fontStyle: 'bold', fillColor: VERT_CLAIR } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const cStyle = getCompanyStyle(data.row.index);
            data.cell.styles.textColor = cStyle.header;
          }
        },
        margin: { left: M, right: M },
        didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // Section Négociation supprimée — les négociations sont exclues du PDF RAO.

  // ── RÉCAPITULATIF FINAL ──
  y = addPage('Récapitulatif général', 'a4', 'portrait');
  tocEntries.push({ label: '9. Récapitulatif général', page: pageNum });
  y = sectionTitle(doc, 'RÉCAPITULATIF GÉNÉRAL', y, THEME.primary);

  const techCs = criteria.filter(c => !c.auto);

  // extendedRanking est déjà calculé en haut du générateur (cohérence Synthèse + Récap)
  const maxScorePrice = Number(scoringConfig?.maxScore || 50);
  const headCols = [
    'Entreprise',
    ...techCs.map(c => c.label.length > 25 ? c.label.slice(0, 25) + '...' : c.label),
    `C1 Prix\n/${maxScorePrice} pts`,
    'Prix HT',
    'Total\n/100',
    'Rang'
  ];

  const bodyRows = extendedRanking.map((r) => {
    const displayName = r.kind === 'variant'
      ? `  > ${r.name} - V${r.variantIndex}${r.variantLabel ? ` (${r.variantLabel})` : ''} [RETENUE]`
      : r.name.toUpperCase();
    return [
      displayName,
      ...techCs.map(c => r.irregular ? '—' : fmtScore(r.techScores?.[c.id] || 0)),
      r.irregular ? '—' : fmtScore(r.priceScore || 0),
      fmt(r.price) + ' €',
      r.irregular ? 'HORS' : fmtScore(r.totalScore),
      r.rank == null ? '—' : `${r.rank}`,
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [headCols],
    body: bodyRows,
    styles: { font: 'Helvetica', fontSize: 8, cellPadding: 4, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', minCellWidth: 35 },
      [headCols.length - 3]: { halign: 'right', minCellWidth: 26 },
      [headCols.length - 2]: { fontStyle: 'bold', textColor: THEME.primary, fontSize: 9 },
      [headCols.length - 1]: { fontStyle: 'bold', fontSize: 10 }
    },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowData = extendedRanking[data.row.index];
        if (!rowData) return;
        const rank = rowData.rank;
        const isVariant = rowData.kind === 'variant';
        const isIrregular = !!rowData.irregular;

        const originalIdx = analysisCompanies.findIndex(c => c.name === rowData.name);
        const cStyle = getCompanyStyle(originalIdx !== -1 ? originalIdx : 0);

        // Ligne irrégulière : grisée
        if (isIrregular) {
          data.cell.styles.textColor = [120, 120, 120];
          data.cell.styles.fillColor = [241, 245, 249];
        } else {
          // Ligne variante : fond légèrement violet
          if (isVariant) {
            data.cell.styles.fillColor = [243, 232, 255];
            if (data.column.index === 0) {
              data.cell.styles.textColor = [88, 28, 135];
              data.cell.styles.fontStyle = 'italic';
            }
          }

          if (data.column.index === 0 && !isVariant) {
            data.cell.styles.textColor = cStyle.header;
          }

          if (rank === 1) {
            data.cell.styles.fillColor = VERT_CLAIR;
          }
          if (data.column.index === headCols.length - 1) {
            if (rank === 1) {
              data.cell.styles.fillColor = [255, 215, 0];
              data.cell.styles.textColor = [0, 0, 0];
            } else if (rank === 2) {
              data.cell.styles.fillColor = [224, 224, 224];
              data.cell.styles.textColor = [0, 0, 0];
            } else if (rank === 3) {
              data.cell.styles.fillColor = [205, 127, 50];
              data.cell.styles.textColor = [255, 255, 255];
            }
          }
        }
      }
    },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Barres empilées (prix + technique) — utilise extendedRanking ──
  // (mêmes scores que le tableau au-dessus : variantes retenues + Pmin recalculé,
  //  offres irrégulières exclues de l'affichage car non-notées)
  if (y < 297 - 60) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...VERT_FONCE);
    doc.text('VISUALISATION DES SCORES', M, y + 3);
    y += 8;
    const barMaxW = W - 80;
    extendedRanking.filter(r => !r.irregular).forEach((r) => {
      if (y > 280) return;
      const origIdx = analysisCompanies.findIndex(c => c.name === r.name);
      const cStyle = getCompanyStyle(origIdx !== -1 ? origIdx : 0);
      const techTotal = Object.values(r.techScores || {}).reduce((a, b) => a + b, 0);
      const priceW = barMaxW * (r.priceScore || 0) / 100;
      const techW = barMaxW * techTotal / 100;

      const barH = 6;
      const isVariant = r.kind === 'variant';
      const label = isVariant
        ? `${r.name} · V${r.variantIndex}`
        : r.name;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...cStyle.header);
      doc.text(label, M, y + barH / 2 + 6.5 * 0.13);

      // Fond gris
      doc.setFillColor(235, 235, 240);
      doc.rect(55, y, barMaxW, barH, 'F');
      // Barre prix (vert papyrus pour base, plus clair pour variante)
      if (priceW > 2) {
        const priceColor = isVariant ? lighten(VERT_PAPYRUS, 0.35) : VERT_PAPYRUS;
        doc.setFillColor(...priceColor);
        doc.rect(55, y, priceW, barH, 'F');
        if (priceW > 12) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
          doc.text(fmtScore(r.priceScore || 0), 55 + priceW / 2, y + barH / 2 + 0.8, { align: 'center' });
        }
      }
      // Barre technique (bleu)
      if (techW > 2) {
        const techColor = isVariant ? lighten([59, 130, 246], 0.35) : [59, 130, 246];
        doc.setFillColor(...techColor);
        doc.rect(55 + priceW, y, techW, barH, 'F');
        if (techW > 12) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
          doc.text(fmtScore(techTotal), 55 + priceW + techW / 2, y + barH / 2 + 0.8, { align: 'center' });
        }
      }
      // Total à droite
      doc.setTextColor(...THEME.text);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(fmtScore(r.totalScore), 55 + barMaxW + 2, y + barH / 2 + 0.8);
      y += 8;
    });
    // Légende
    doc.setFillColor(...VERT_PAPYRUS); doc.rect(55, y, 4, 3, 'F');
    doc.setFillColor(59, 130, 246); doc.rect(65, y, 4, 3, 'F');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...THEME.lightText);
    doc.text('Prix', 60, y + 2.5); doc.text('Technique', 70, y + 2.5);
    y += 10;
  }

  // ── Avertissement OAB si applicable ──
  const allTotals = ranking.map(r => r.price).filter(p => p > 0);
  const oabThreshold = calculateOABThreshold(allTotals);
  const oabCompanies = ranking.filter(r => r.price > 0 && r.price < oabThreshold);
  if (oabCompanies.length > 0) {
    if (y > 260) { y = addPage('Récapitulatif général', 'a4', 'portrait'); }
    doc.setFillColor(255, 237, 213);
    doc.roundedRect(M, y, W - 2 * M, 22, 3, 3, 'F');
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(M, y, W - 2 * M, 22, 3, 3, 'S');
    doc.setTextColor(180, 83, 9);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OFFRE(S) ANORMALEMENT BASSE(S) DÉTECTÉE(S)', W / 2, y + 6, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    const oabNames = oabCompanies.map(r => r.name).join(', ');
    doc.text(`${oabNames} — Seuil OAB : ${fmt(oabThreshold)} € HT (méthode Double Moyenne)`, W / 2, y + 12, { align: 'center' });
    doc.text('Conformément aux articles L2152-5 et R2152-3 du CCP, le pouvoir adjudicateur doit demander des précisions', W / 2, y + 17, { align: 'center' });
    doc.text('sur le prix proposé avant tout rejet éventuel de l\'offre (CE, 1er mars 2012, n°354159).', W / 2, y + 21, { align: 'center' });
    y += 28;
  }

  // ── Recommandation conforme CCP — utilise extendedRanking (rang 1 réel) ──
  const winner = extendedRanking.find(r => r.rank === 1) || ranking[0];
  if (winner) {
    if (y > 265) { y = addPage('Récapitulatif général', 'a4', 'portrait'); }
    const isVariantWinner = winner.kind === 'variant';
    const winnerLabel = isVariantWinner
      ? `${winner.name.toUpperCase()} — VARIANTE V${winner.variantIndex}${winner.variantLabel ? ` (${cleanText(winner.variantLabel)})` : ''}`
      : winner.name.toUpperCase();
    // Texte personnalise si l'utilisateur l'a edite dans TabRecap, sinon texte par defaut.
    // Le texte custom est stocke dans rao.recommendation (string).
    const customText = (rao?.recommendation || '').trim();
    const recoText = customText || `Au regard des critères d'attribution définis dans les documents de consultation, l'offre de l'entreprise ${winnerLabel} est l'offre économiquement la plus avantageuse.`;
    // Mesurer la hauteur pour adapter le rectangle (wrap auto)
    const textWidth = W - 2 * M - 8;
    const lines = doc.splitTextToSize(cleanText(recoText), textWidth);
    const lineH = 4.5;
    const padTop = 6;
    const padBottom = 10;
    const scoreLineH = 6;
    const rectH = padTop + lines.length * lineH + scoreLineH + padBottom;
    doc.setFillColor(...THEME.primary);
    doc.roundedRect(M, y, W - 2 * M, rectH, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    let textY = y + padTop;
    lines.forEach(ln => { doc.text(ln, W / 2, textY, { align: 'center' }); textY += lineH; });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Score : ${fmtScore(winner.totalScore)} / 100  —  Montant : ${fmt(winner.price)} € HT  —  ${fmt(winner.price * 1.2)} € TTC`, W / 2, textY + 2, { align: 'center' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── ANNEXES (méthode OAB, formules de scoring, références CCP) ──
  // ─────────────────────────────────────────────────────────────────────────
  y = addPage('Annexes', 'a4', 'portrait');
  tocEntries.push({ label: 'Annexe A — Méthode OAB', page: pageNum });
  y = sectionTitle(doc, 'ANNEXE A — Méthode OAB (Offre Anormalement Basse)', y, THEME.primary);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.text);
  const oabIntro = "La méthode de la double moyenne, dite \"OAB\", permet de détecter les offres dont le prix peut être considéré comme anormalement bas par rapport au marché et qui doivent faire l'objet d'une demande de précision auprès du soumissionnaire (articles L2152-5 et R2152-3 du CCP).";
  ({ y } = drawJustifiedText(doc, oabIntro, M, y, W - 2 * M, 4.5));
  y += 6;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...VERT_FONCE);
  doc.text('Étapes de calcul :', M, y);
  y += 6;

  const oabSteps = [
    '1. M1 = moyenne arithmétique de toutes les offres reçues (HT)',
    '2. Borne haute = M1 × 1,20 (offres considérées comme acceptables au-dessus)',
    '3. M2 = moyenne des offres inférieures ou égales à la borne haute',
    '4. Seuil OAB = M2 × 0,90 (10% sous la moyenne corrigée)',
    '5. Toute offre dont le montant total est strictement inférieur au seuil OAB est signalée comme anormalement basse.',
  ];
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.lightText);
  oabSteps.forEach(step => {
    const lines = doc.splitTextToSize(step, W - 2 * M - 4);
    drawJustifiedText(doc, step, M + 4, y, W - 2 * M - 4, 4.2);
    y += lines.length * 4.2 + 1;
  });
  y += 4;

  doc.setFillColor(254, 252, 232);
  doc.rect(M, y, W - 2 * M, 22, 'F');
  doc.setDrawColor(252, 211, 77);
  doc.setLineWidth(0.5);
  doc.rect(M, y, W - 2 * M, 22);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 80, 0);
  doc.text('Important :', M + 3, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text("Une offre anormalement basse ne peut pas être rejetée automatiquement. Le pouvoir adjudicateur doit", M + 3, y + 12);
  doc.text("demander par écrit au soumissionnaire des précisions sur le prix proposé avant tout rejet motivé.", M + 3, y + 17);

  // ── ANNEXE B — Formules de scoring ──
  y = addPage('Annexes — Formules', 'a4', 'portrait');
  tocEntries.push({ label: 'Annexe B — Formules de scoring', page: pageNum });
  y = sectionTitle(doc, 'ANNEXE B — Formules de notation du critère prix', y, THEME.primary);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.lightText);
  doc.text('Notations : P = prix de l\'offre ; Pmin = prix le plus bas ; Pmoy = moyenne des prix ; N = note maximale.', M, y);
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...VERT_FONCE);
  doc.text(`Formule active sur ce dossier : ${(scoringConfig?.mode || 'f1').toUpperCase()}  —  Note max : ${scoringConfig?.maxScore || 40} points`, M, y);
  y += 8;

  const formulasBody = [
    ['f1', 'Lineaire',                     'N x (Pmin / P)'],
    ['f2', 'Quadratique',                  'N x (Pmin / P)^2'],
    ['f3', 'Cubique',                      'N x (Pmin / P)^3'],
    ['f4', 'Ecart relatif',                'N x (1 - (P - Pmin) / Pmin)'],
    ['f5', 'Amortie par moyenne',          'N x (1 - (P - Pmin) / Pmoy)'],
    ['f6', 'Mixte (sous/au-dessus moy.)',  'Si P <= Pmoy : N x racine(Pmin/P) ; sinon : N x (Pmin/P)^2'],
    ['f7', 'Bornee Pmin / Pmax',           'N x (1 - (P - Pmin) / (Pmax - Pmin))'],
    ['f8', 'Inverse de moyenne',           '(N x Pmoy) / (Pmoy + P)'],
    ['f9', 'Double minimum',               'N x (2 x Pmin / (Pmin + P))'],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Nom', 'Formule mathématique']],
    body: formulasBody.map(([c, n, f]) => [
      { content: c, styles: { fontStyle: 'bold', halign: 'center', fillColor: c === (scoringConfig?.mode || 'f1') ? VERT_CLAIR : undefined } },
      n,
      { content: f, styles: { font: 'Courier', fontSize: 8 } },
    ]),
    styles: { font: 'Helvetica', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: THEME.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 18 } },
    alternateRowStyles: { fillColor: THEME.tableAlt },
    margin: { left: M, right: M },
    didDrawPage: () => drawFooter(doc, pageNum, consultation, project, THEME),
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── ANNEXE C — Références CCP ──
  if (y > 200) { y = addPage('Annexes — Références CCP', 'a4', 'portrait'); }
  tocEntries.push({ label: 'Annexe C — Références CCP', page: pageNum });
  y = sectionTitle(doc, 'ANNEXE C — Références du Code de la Commande Publique', y, THEME.primary);

  const ccpRefs = [
    {
      art: 'L2113-1',
      titre: "Acte d'engagement",
      desc: "L'acte d'engagement (AE) constitue le document contractuel par lequel le candidat s'engage à exécuter le marché aux conditions qu'il propose. Le montant porté sur l'AE engage le soumissionnaire."
    },
    {
      art: 'L2152-2',
      titre: 'Offre irrégulière',
      desc: "Une offre est irrégulière lorsqu'elle ne respecte pas les exigences des documents de consultation, notamment si elle modifie les quantités du DQE. Elle peut être régularisée par décision motivée du pouvoir adjudicateur dans le respect du principe d'égalité de traitement."
    },
    {
      art: 'L2152-5 / R2152-3',
      titre: 'Offre anormalement basse',
      desc: "L'acheteur ne peut rejeter une offre anormalement basse qu'après avoir demandé par écrit au soumissionnaire des précisions sur la teneur de son offre. La motivation du rejet doit s'appuyer sur les justifications fournies (CE, 1er mars 2012, n°354159)."
    },
    {
      art: 'R2151-8 à R2151-11',
      titre: 'Variantes',
      desc: "En procédure formalisée, les variantes sont interdites par défaut sauf mention contraire dans l'avis de marché. En procédure adaptée, elles sont autorisées sauf mention contraire. Les exigences minimales doivent être précisées dans les documents de consultation. La variante retenue se substitue à la solution de base dans ses éléments qui en diffèrent."
    },
    {
      art: 'R2152-2',
      titre: "Régularisation des offres",
      desc: "Toutes les offres irrégulières peuvent faire l'objet d'une régularisation. Cette faculté ne peut être exercée que dans le respect des principes d'égalité de traitement, de transparence et sans modification substantielle des caractéristiques de l'offre."
    },
  ];

  ccpRefs.forEach(ref => {
    if (y > 250) { y = addPage('Annexes — Références CCP (suite)', 'a4', 'portrait'); }
    // Largeur dynamique selon longueur du label article (min 30, +2mm par caractère au-delà de 12)
    const labelText = `Article ${ref.art}`;
    const labelW = Math.max(30, doc.getTextWidth(labelText) + 6);
    doc.setFillColor(...VERT_CLAIR);
    doc.rect(M, y, labelW, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...VERT_FONCE);
    doc.text(labelText, M + 2, y + 4);
    doc.setFontSize(9);
    doc.setTextColor(...THEME.text);
    doc.text(ref.titre, M + labelW + 5, y + 4);
    y += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...THEME.lightText);
    const lines = doc.splitTextToSize(ref.desc, W - 2 * M - 4);
    drawJustifiedText(doc, ref.desc, M + 4, y, W - 2 * M - 4, 4.5);
    y += lines.length * 4.5 + 6;
  });

  // ── REMPLIR LE SOMMAIRE (page 2) ──
  doc.setPage(sommairePageIndex);
  let tocY = 30;
  // Titre H1
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14); // H1
  doc.setTextColor(...VERT_PAPYRUS);
  doc.text('SOMMAIRE', M, tocY);
  tocY += 4;
  // Ligne décorative
  doc.setDrawColor(...VERT_PAPYRUS);
  doc.setLineWidth(1);
  doc.line(M, tocY, M + 30, tocY);
  tocY += 10;

  tocEntries.forEach((entry) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.text);
    doc.text(entry.label, M + 2, tocY);
    // Points de conduite
    const labelW = doc.getTextWidth(entry.label);
    const pageStr = `${entry.page}`;
    const pageW = doc.getTextWidth(pageStr);
    const dotsStart = M + 2 + labelW + 2;
    const dotsEnd = W - M - pageW - 2;
    doc.setTextColor(...THEME.lightText);
    doc.setFontSize(8);
    let dotX = dotsStart;
    while (dotX < dotsEnd) {
      doc.text('.', dotX, tocY);
      dotX += 2;
    }
    // Numéro de page
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...VERT_PAPYRUS);
    doc.text(pageStr, W - M, tocY, { align: 'right' });
    tocY += 8;
  });

  const safeName = (consultation?.objet || project?.name || 'RAO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  doc.save(`RAO_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
